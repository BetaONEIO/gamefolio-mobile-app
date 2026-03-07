import { Router, Request, Response } from 'express';
import { db } from '../db';
import { storeItems, storePurchases, users } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, parseUnits, decodeEventLog, type Address } from 'viem';
import { GF_TOKEN_ADDRESS, GF_TOKEN_ABI, SKALE_NEBULA_TESTNET } from '../../shared/contracts';

const GF_DECIMALS = 18;

const publicClient = createPublicClient({
  chain: SKALE_NEBULA_TESTNET,
  transport: http(SKALE_NEBULA_TESTNET.rpcUrls.default.http[0]),
});

const router = Router();

function getTreasuryAddress(): string {
  const privateKey = process.env.TREASURY_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('TREASURY_WALLET_PRIVATE_KEY not configured');
  }
  const formattedKey = privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);
  return account.address;
}

router.get('/api/store/items', async (req: Request, res: Response) => {
  try {
    const items = await db
      .select()
      .from(storeItems)
      .where(eq(storeItems.available, true))
      .orderBy(desc(storeItems.createdAt));

    const userId = (req as any).user?.id;
    let isPro = false;
    if (userId) {
      const userResult = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (userResult.length > 0) {
        isPro = !!userResult[0].isPro;
      }
    }

    const itemsWithDiscount = items.map(item => ({
      ...item,
      originalPrice: item.gfCost,
      gfCost: isPro ? Math.floor(item.gfCost * 0.8) : item.gfCost,
      proDiscount: isPro,
    }));

    return res.json(itemsWithDiscount);
  } catch (error: any) {
    console.error('Get store items error:', error);
    return res.status(500).json({ error: 'Failed to fetch store items' });
  }
});

router.get('/api/store/owned', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const owned = await db
      .select({
        purchase: storePurchases,
        item: storeItems,
      })
      .from(storePurchases)
      .innerJoin(storeItems, eq(storePurchases.itemId, storeItems.id))
      .where(and(
        eq(storePurchases.userId, userId),
        eq(storePurchases.status, 'completed')
      ))
      .orderBy(desc(storePurchases.completedAt));

    return res.json(owned.map(o => ({
      ...o.item,
      purchaseId: o.purchase.id,
      purchasedAt: o.purchase.completedAt,
      txHash: o.purchase.txHash,
    })));
  } catch (error: any) {
    console.error('Get owned items error:', error);
    return res.status(500).json({ error: 'Failed to fetch owned items' });
  }
});

router.post('/api/store/purchase-intent', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { itemId } = req.body;
    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required' });
    }

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user.length || !user[0].walletAddress) {
      return res.status(400).json({ error: 'Wallet address not connected' });
    }

    const item = await db.select().from(storeItems).where(eq(storeItems.id, itemId)).limit(1);
    if (!item.length) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!item[0].available) {
      return res.status(400).json({ error: 'Item is not available' });
    }

    const existingOwned = await db
      .select()
      .from(storePurchases)
      .where(and(
        eq(storePurchases.userId, userId),
        eq(storePurchases.itemId, itemId),
        eq(storePurchases.status, 'completed')
      ))
      .limit(1);

    if (existingOwned.length) {
      return res.status(400).json({ error: 'You already own this item' });
    }

    const isPro = !!user[0].isPro;
    const baseCost = item[0].gfCost;
    const finalCost = isPro ? Math.floor(baseCost * 0.8) : baseCost;

    const [purchase] = await db.insert(storePurchases).values({
      userId,
      itemId,
      walletAddress: user[0].walletAddress,
      gfAmount: finalCost,
      status: 'pending',
    }).returning();

    const treasuryAddress = getTreasuryAddress();

    return res.json({
      purchaseId: purchase.id,
      itemId: item[0].id,
      itemName: item[0].name,
      gfCost: finalCost,
      originalPrice: baseCost,
      discountApplied: isPro,
      treasuryAddress,
    });
  } catch (error: any) {
    console.error('Create purchase intent error:', error);
    return res.status(500).json({ error: 'Failed to create purchase intent' });
  }
});

router.post('/api/store/verify-purchase', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { purchaseId, txHash } = req.body;
    if (!purchaseId || !txHash) {
      return res.status(400).json({ error: 'purchaseId and txHash are required' });
    }

    const purchase = await db
      .select()
      .from(storePurchases)
      .where(and(
        eq(storePurchases.id, purchaseId),
        eq(storePurchases.userId, userId)
      ))
      .limit(1);

    if (!purchase.length) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    if (purchase[0].status === 'completed') {
      return res.json({ success: true, message: 'Already verified' });
    }

    if (purchase[0].status !== 'pending') {
      return res.status(400).json({ error: 'Purchase cannot be verified in current status' });
    }

    const treasuryAddress = getTreasuryAddress().toLowerCase();
    const expectedAmount = parseUnits(String(purchase[0].gfAmount), GF_DECIMALS);
    const buyerAddress = purchase[0].walletAddress.toLowerCase();

    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (receipt.status !== 'success') {
      await db.update(storePurchases).set({ status: 'failed' }).where(eq(storePurchases.id, purchaseId));
      return res.status(400).json({ error: 'Transaction failed on-chain' });
    }

    let validTransfer = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== GF_TOKEN_ADDRESS.toLowerCase()) continue;
      
      try {
        const decoded = decodeEventLog({
          abi: GF_TOKEN_ABI,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === 'Transfer') {
          const { from, to, value } = decoded.args as { from: Address; to: Address; value: bigint };
          
          if (
            from.toLowerCase() === buyerAddress &&
            to.toLowerCase() === treasuryAddress &&
            value >= expectedAmount
          ) {
            validTransfer = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!validTransfer) {
      await db.update(storePurchases).set({ status: 'failed' }).where(eq(storePurchases.id, purchaseId));
      return res.status(400).json({ error: 'Invalid transfer: amount, sender, or recipient mismatch' });
    }

    await db
      .update(storePurchases)
      .set({
        status: 'completed',
        txHash,
        completedAt: new Date(),
      })
      .where(eq(storePurchases.id, purchaseId));

    return res.json({ success: true, message: 'Purchase verified' });
  } catch (error: any) {
    console.error('Verify purchase error:', error);
    return res.status(500).json({ error: 'Failed to verify purchase' });
  }
});

export default router;
