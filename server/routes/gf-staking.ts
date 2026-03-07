import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, userStaking, userStakingHistory } from '@shared/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { parseUnits, formatUnits, maxUint256, type Address } from 'viem';
import { writeContractWithPoW, publicClient } from '../skale-pow';
import { GF_STAKING_ADDRESS, GF_STAKING_ABI, GF_TOKEN_ADDRESS, GF_TOKEN_ABI } from '../../shared/contracts';
import { getStakingStats, getStakePosition } from '../gf-staking-service';
import { transferGfTokens } from '../gf-token-service';

const router = Router();
const GF_DECIMALS = 18;

router.get('/api/staking/position/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return res.status(400).json({ error: 'Invalid wallet address' });
    }

    const position = await getStakePosition(address);
    return res.json({ staked: position.staked, earned: position.earned });
  } catch (error: any) {
    console.error('[Staking] Get position error:', error);
    return res.json({ staked: '0', earned: '0' });
  }
});

router.get('/api/staking/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const history = await db
      .select()
      .from(userStakingHistory)
      .where(eq(userStakingHistory.userId, userId))
      .orderBy(desc(userStakingHistory.createdAt))
      .limit(50);

    return res.json(history);
  } catch (error: any) {
    console.error('[Staking] Get history error:', error);
    return res.status(500).json({ error: 'Failed to get staking history' });
  }
});

router.get('/api/staking/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getStakingStats();
    return res.json(stats);
  } catch (error: any) {
    const aggregate = await db
      .select({ total: sql<number>`coalesce(sum(${userStaking.stakedAmount}), 0)` })
      .from(userStaking);
    return res.json({ totalStaked: aggregate[0]?.total?.toString() || '0', rewardRate: '0.001' });
  }
});

router.post('/api/staking/stake', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { amount } = req.body;
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const amountFloat = parseFloat(amount);
    const amountRaw = parseUnits(String(amountFloat), GF_DECIMALS);

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.walletAddress || !user.encryptedPrivateKey) {
      return res.status(400).json({ error: 'No server-side wallet available', code: 'NO_WALLET' });
    }

    const inAppBalance = user.gfTokenBalance || 0;
    if (inAppBalance < amountFloat) {
      return res.status(400).json({
        error: `Insufficient GFT balance. Have: ${inAppBalance.toFixed(2)} GFT, Need: ${amountFloat} GFT`,
        code: 'INSUFFICIENT_BALANCE',
      });
    }

    const userAddress = user.walletAddress as Address;

    console.log(`[Staking] Transferring ${amountFloat} GFT from treasury to user wallet ${userAddress}`);
    const transferResult = await transferGfTokens(userAddress, amountFloat);
    if (!transferResult.success) {
      return res.status(400).json({
        error: `Treasury transfer failed: ${transferResult.error}`,
        code: 'TREASURY_TRANSFER_FAILED',
      });
    }
    console.log(`[Staking] Treasury transfer confirmed. TX: ${transferResult.txHash}`);

    const allowance = await publicClient.readContract({
      address: GF_TOKEN_ADDRESS as Address,
      abi: GF_TOKEN_ABI,
      functionName: 'allowance',
      args: [userAddress, GF_STAKING_ADDRESS as Address],
    }) as bigint;

    if (allowance < amountRaw) {
      console.log(`[Staking] Approving staking contract for user ${userId}`);
      const approveHash = await writeContractWithPoW({
        encryptedPrivateKey: user.encryptedPrivateKey,
        contractAddress: GF_TOKEN_ADDRESS as Address,
        abi: GF_TOKEN_ABI,
        functionName: 'approve',
        args: [GF_STAKING_ADDRESS as Address, maxUint256],
      });
      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 60_000 });
      if (approveReceipt.status !== 'success') {
        return res.status(400).json({ error: 'Token approval failed', txHash: approveHash });
      }
      console.log(`[Staking] Approved. TX: ${approveHash}`);
    }

    console.log(`[Staking] Staking ${amountFloat} GFT on-chain for user ${userId}`);
    const stakeHash = await writeContractWithPoW({
      encryptedPrivateKey: user.encryptedPrivateKey,
      contractAddress: GF_STAKING_ADDRESS as Address,
      abi: GF_STAKING_ABI,
      functionName: 'stake',
      args: [amountRaw],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: stakeHash, timeout: 60_000 });
    if (receipt.status !== 'success') {
      return res.status(400).json({ error: 'Stake transaction reverted', txHash: stakeHash });
    }

    console.log(`[Staking] On-chain stake confirmed. TX: ${stakeHash}`);

    await db.update(users)
      .set({ gfTokenBalance: sql`${users.gfTokenBalance} - ${amountFloat}` })
      .where(eq(users.id, userId));

    const now = new Date();
    const [existing] = await db.select().from(userStaking).where(eq(userStaking.userId, userId)).limit(1);

    if (existing) {
      await db.update(userStaking)
        .set({ stakedAmount: existing.stakedAmount + amountFloat, stakedAt: now })
        .where(eq(userStaking.userId, userId));
    } else {
      await db.insert(userStaking).values({
        userId,
        stakedAmount: amountFloat,
        stakedAt: now,
        lastClaimAt: now,
        totalEarned: 0,
      });
    }

    const [updated] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    await db.insert(userStakingHistory).values({
      userId,
      type: 'stake',
      amount: amountFloat,
      balanceAfter: updated.gfTokenBalance || 0,
      createdAt: now,
    });

    return res.json({
      success: true,
      txHash: stakeHash,
      stakedAmount: existing ? existing.stakedAmount + amountFloat : amountFloat,
      balance: updated.gfTokenBalance,
    });
  } catch (error: any) {
    console.error('[Staking] Stake error:', error);
    return res.status(500).json({ error: error.message || 'Stake failed' });
  }
});

router.post('/api/staking/unstake', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const { amount } = req.body;
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const amountStr = String(amount).trim();
    const amountFloat = parseFloat(amountStr);
    let amountRaw: bigint;
    try {
      amountRaw = parseUnits(amountStr, GF_DECIMALS);
    } catch {
      return res.status(400).json({ error: 'Invalid amount format' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.walletAddress || !user.encryptedPrivateKey) {
      return res.status(400).json({ error: 'No server-side wallet available', code: 'NO_WALLET' });
    }

    const stakesResult = await publicClient.readContract({
      address: GF_STAKING_ADDRESS as Address,
      abi: GF_STAKING_ABI,
      functionName: 'stakes',
      args: [user.walletAddress as Address],
    }) as readonly [bigint, bigint, bigint];
    const onChainStakedRaw = stakesResult[0];
    const onChainStaked = parseFloat(formatUnits(onChainStakedRaw, GF_DECIMALS));

    console.log(`[Staking] On-chain staked for user ${userId}: ${onChainStaked} GFT (raw: ${onChainStakedRaw})`);

    if (onChainStakedRaw === 0n) {
      return res.status(400).json({ error: 'No active staking position on-chain', code: 'NO_POSITION' });
    }

    if (amountRaw > onChainStakedRaw) {
      return res.status(400).json({
        error: `Insufficient staked amount on-chain. Staked: ${onChainStaked.toFixed(6)} GFT, Requested: ${amountFloat} GFT`,
        code: 'INSUFFICIENT_STAKED',
      });
    }

    // Use the exact on-chain raw amount when user is unstaking their full position
    // (avoids 1-wei precision mismatch from float→string→parseUnits conversion)
    const ONE_GFT = parseUnits('1', GF_DECIMALS);
    const diff = onChainStakedRaw > amountRaw ? onChainStakedRaw - amountRaw : amountRaw - onChainStakedRaw;
    const finalAmountRaw = diff < ONE_GFT ? onChainStakedRaw : amountRaw;
    const finalAmountFloat = parseFloat(formatUnits(finalAmountRaw, GF_DECIMALS));

    console.log(`[Staking] Unstaking ${finalAmountFloat} GFT (raw: ${finalAmountRaw}) on-chain for user ${userId}`);

    // Simulate first to surface revert reason
    try {
      await publicClient.simulateContract({
        address: GF_STAKING_ADDRESS as Address,
        abi: GF_STAKING_ABI,
        functionName: 'unstake',
        args: [finalAmountRaw],
        account: user.walletAddress as Address,
      });
    } catch (simErr: any) {
      const reason = simErr?.cause?.reason || simErr?.shortMessage || simErr?.message || 'Unknown revert reason';
      console.error(`[Staking] Unstake simulation failed: ${reason}`);
      return res.status(400).json({ error: `Unstake would fail: ${reason}`, code: 'SIMULATE_FAILED' });
    }

    const txHash = await writeContractWithPoW({
      encryptedPrivateKey: user.encryptedPrivateKey,
      contractAddress: GF_STAKING_ADDRESS as Address,
      abi: GF_STAKING_ABI,
      functionName: 'unstake',
      args: [finalAmountRaw],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
    if (receipt.status !== 'success') {
      return res.status(400).json({ error: 'Unstake transaction reverted', txHash });
    }

    console.log(`[Staking] On-chain unstake confirmed. TX: ${txHash}`);

    const remainingStakedFloat = parseFloat(formatUnits(onChainStakedRaw - finalAmountRaw, GF_DECIMALS));
    const now = new Date();

    const [existing] = await db.select().from(userStaking).where(eq(userStaking.userId, userId)).limit(1);
    if (existing) {
      await db.update(userStaking)
        .set({ stakedAmount: Math.max(0, remainingStakedFloat), lastClaimAt: now })
        .where(eq(userStaking.userId, userId));
    }

    await db.update(users)
      .set({ gfTokenBalance: sql`${users.gfTokenBalance} + ${finalAmountFloat}` })
      .where(eq(users.id, userId));

    const [updated] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    await db.insert(userStakingHistory).values({
      userId,
      type: 'unstake',
      amount: finalAmountFloat,
      balanceAfter: updated.gfTokenBalance || 0,
      createdAt: now,
    });

    return res.json({
      success: true,
      txHash,
      unstaked: finalAmountFloat,
      balance: updated.gfTokenBalance,
    });
  } catch (error: any) {
    console.error('[Staking] Unstake error:', error);
    return res.status(500).json({ error: error.message || 'Unstake failed' });
  }
});

router.post('/api/staking/claim', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.walletAddress || !user.encryptedPrivateKey) {
      return res.status(400).json({ error: 'No server-side wallet available', code: 'NO_WALLET' });
    }

    const [position] = await db.select().from(userStaking).where(eq(userStaking.userId, userId)).limit(1);

    const [onChainStakesResult, pendingRewardsRaw] = await Promise.all([
      publicClient.readContract({
        address: GF_STAKING_ADDRESS as Address,
        abi: GF_STAKING_ABI,
        functionName: 'stakes',
        args: [user.walletAddress as Address],
      }) as Promise<readonly [bigint, bigint, bigint]>,
      publicClient.readContract({
        address: GF_STAKING_ADDRESS as Address,
        abi: GF_STAKING_ABI,
        functionName: 'pendingRewards',
        args: [user.walletAddress as Address],
      }) as Promise<bigint>,
    ]);
    const onChainStakedRaw = onChainStakesResult[0];

    if (onChainStakedRaw === 0n) {
      return res.status(400).json({ error: 'No active staking position on-chain', code: 'NO_POSITION' });
    }

    const rewards = parseFloat(formatUnits(pendingRewardsRaw, GF_DECIMALS));

    if (rewards < 0.000001) {
      return res.status(400).json({ error: 'No rewards available to claim', code: 'NO_REWARDS' });
    }

    console.log(`[Staking] Claiming ${rewards.toFixed(6)} GFT rewards (pendingRewards from contract) on-chain for user ${userId}`);
    const txHash = await writeContractWithPoW({
      encryptedPrivateKey: user.encryptedPrivateKey,
      contractAddress: GF_STAKING_ADDRESS as Address,
      abi: GF_STAKING_ABI,
      functionName: 'claimRewards',
      args: [],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
    if (receipt.status !== 'success') {
      return res.status(400).json({ error: 'Claim transaction reverted', txHash });
    }

    console.log(`[Staking] On-chain claim confirmed. TX: ${txHash}. Rewards: ${rewards}`);

    const now = new Date();

    await db.update(userStaking)
      .set({
        lastClaimAt: now,
        totalEarned: position.totalEarned + rewards,
      })
      .where(eq(userStaking.userId, userId));

    await db.update(users)
      .set({ gfTokenBalance: sql`${users.gfTokenBalance} + ${rewards}` })
      .where(eq(users.id, userId));

    const [updated] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    await db.insert(userStakingHistory).values({
      userId,
      type: 'claim',
      amount: rewards,
      balanceAfter: updated.gfTokenBalance || 0,
      createdAt: now,
    });

    return res.json({
      success: true,
      txHash,
      rewards,
      balance: updated.gfTokenBalance,
    });
  } catch (error: any) {
    console.error('[Staking] Claim error:', error);
    return res.status(500).json({ error: error.message || 'Claim failed' });
  }
});

export default router;
