import { Router, Request, Response } from 'express';
import { db } from '../db';
import { storeItems, storePurchases, users, nameTags, userUnlockedNameTags, profileBorders, userUnlockedBorders } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { privateKeyToAccount } from 'viem/accounts';
import { createPublicClient, http, parseUnits, decodeEventLog, type Address } from 'viem';
import { GF_TOKEN_ADDRESS, GF_TOKEN_ABI, SKALE_NEBULA_TESTNET } from '../../shared/contracts';
import { hybridAuth } from '../middleware/hybrid-auth';

const GF_DECIMALS = 18;

const publicClient = createPublicClient({
  chain: SKALE_NEBULA_TESTNET,
  transport: http(SKALE_NEBULA_TESTNET.rpcUrls.default.http[0]),
});

const router = Router();

const GENESIS_NFT_SEEDS = [
  { name: 'Genesis Common', description: 'A common genesis NFT from the Gamefolio founding collection.', gfCost: 100, category: 'genesis', rarity: 'common' },
  { name: 'Genesis Rare', description: 'A rare genesis NFT with exclusive traits from the Gamefolio collection.', gfCost: 500, category: 'genesis', rarity: 'rare' },
  { name: 'Genesis Epic', description: 'An epic genesis NFT with powerful in-game attributes.', gfCost: 1000, category: 'genesis', rarity: 'epic' },
  { name: 'Genesis Legendary', description: 'An ultra-rare legendary NFT, one of only 100 in existence.', gfCost: 2500, category: 'genesis', rarity: 'legendary' },
];

(async () => {
  try {
    for (const seed of GENESIS_NFT_SEEDS) {
      const existing = await db.select().from(storeItems)
        .where(and(eq(storeItems.name, seed.name), eq(storeItems.category, 'genesis')))
        .limit(1);
      if (!existing.length) {
        await db.insert(storeItems).values({ ...seed, available: true });
      }
    }
  } catch {
    // Non-fatal: items may already exist
  }
})();

function getTreasuryAddress(): string {
  const privateKey = process.env.TREASURY_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('TREASURY_WALLET_PRIVATE_KEY not configured');
  }
  const formattedKey = privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}` as `0x${string}`;
  const account = privateKeyToAccount(formattedKey);
  return account.address;
}

router.get('/api/store/items', hybridAuth, async (req: Request, res: Response) => {
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

router.get('/api/store/owned', hybridAuth, async (req: Request, res: Response) => {
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

router.post('/api/store/purchase-intent', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { itemId, itemType = 'item' } = req.body as { itemId: number; itemType?: 'item' | 'name-tag' | 'border' };
    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required' });
    }

    const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isPro = !!userRow.isPro;
    const currentBalance = userRow.gfTokenBalance ?? 0;

    // --- Name Tag ---
    if (itemType === 'name-tag') {
      const [tag] = await db.select().from(nameTags).where(eq(nameTags.id, itemId)).limit(1);
      if (!tag) return res.status(404).json({ error: 'Name tag not found' });
      if (!tag.availableInStore || !tag.isActive) return res.status(400).json({ error: 'Name tag is not available for purchase' });
      if (tag.isDefault) return res.status(400).json({ error: 'This name tag is free for everyone' });
      const cost = Math.max(tag.gfCost ?? 0, 0);
      if (cost <= 0) return res.status(400).json({ error: 'This name tag has no price set' });
      const [existing] = await db.select().from(userUnlockedNameTags)
        .where(and(eq(userUnlockedNameTags.userId, userId), eq(userUnlockedNameTags.nameTagId, itemId))).limit(1);
      if (existing) return res.status(400).json({ error: 'You already own this name tag' });
      if (currentBalance < cost) return res.status(400).json({ error: `Insufficient GF tokens. Need ${cost} GF, you have ${currentBalance} GF` });
      await db.update(users).set({ gfTokenBalance: sql`COALESCE(${users.gfTokenBalance}, 0) - ${cost}` }).where(eq(users.id, userId));
      await db.insert(userUnlockedNameTags).values({ userId, nameTagId: itemId });
      return res.json({ success: true, itemName: tag.name, gfCost: cost, newBalance: currentBalance - cost });
    }

    // --- Border ---
    if (itemType === 'border') {
      const [border] = await db.select().from(profileBorders).where(eq(profileBorders.id, itemId)).limit(1);
      if (!border) return res.status(404).json({ error: 'Border not found' });
      if (!border.availableInStore || !border.isActive) return res.status(400).json({ error: 'Border is not available for purchase' });
      if (border.isDefault) return res.status(400).json({ error: 'This border is free for everyone' });
      if (border.proOnly && !isPro) return res.status(403).json({ error: 'Profile borders are a Pro-only feature. Upgrade to Pro to use borders!' });
      const cost = Math.max(border.gfCost ?? 0, 0);
      if (cost <= 0) return res.status(400).json({ error: 'This border has no price set' });
      const [existing] = await db.select().from(userUnlockedBorders)
        .where(and(eq(userUnlockedBorders.userId, userId), eq(userUnlockedBorders.borderId, itemId))).limit(1);
      if (existing) return res.status(400).json({ error: 'You already own this border' });
      if (currentBalance < cost) return res.status(400).json({ error: `Insufficient GF tokens. Need ${cost} GF, you have ${currentBalance} GF` });
      await db.update(users).set({ gfTokenBalance: sql`COALESCE(${users.gfTokenBalance}, 0) - ${cost}` }).where(eq(users.id, userId));
      await db.insert(userUnlockedBorders).values({ userId, borderId: itemId });
      return res.json({ success: true, itemName: border.name, gfCost: cost, newBalance: currentBalance - cost });
    }

    // --- Store Item (default) ---
    const [item] = await db.select().from(storeItems).where(eq(storeItems.id, itemId)).limit(1);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!item.available) {
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

    const baseCost = item.gfCost;
    const finalCost = isPro ? Math.floor(baseCost * 0.8) : baseCost;
    const walletAddress = userRow.walletAddress || 'gf-balance';

    const [purchase] = await db.insert(storePurchases).values({
      userId,
      itemId,
      walletAddress,
      gfAmount: finalCost,
      status: 'pending',
    }).returning();

    let treasuryAddress = '';
    try {
      treasuryAddress = getTreasuryAddress();
    } catch {
      treasuryAddress = '';
    }

    return res.json({
      purchaseId: purchase.id,
      itemId: item.id,
      itemName: item.name,
      itemDescription: item.description,
      itemCategory: item.category,
      itemRarity: item.rarity,
      gfCost: finalCost,
      originalPrice: baseCost,
      discountApplied: isPro,
      currentBalance,
      treasuryAddress,
    });
  } catch (error) {
    console.error('Create purchase intent error:', error);
    return res.status(500).json({ error: 'Failed to create purchase intent' });
  }
});

router.post('/api/store/buy-with-gf', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { itemId } = req.body;
    if (!itemId) {
      return res.status(400).json({ error: 'itemId is required' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [item] = await db.select().from(storeItems).where(eq(storeItems.id, itemId)).limit(1);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    if (!item.available) {
      return res.status(400).json({ error: 'Item is not available' });
    }

    const existing = await db
      .select()
      .from(storePurchases)
      .where(and(
        eq(storePurchases.userId, userId),
        eq(storePurchases.itemId, itemId),
        eq(storePurchases.status, 'completed')
      ))
      .limit(1);
    if (existing.length) {
      return res.status(400).json({ error: 'You already own this item' });
    }

    const isPro = !!user.isPro;
    const finalCost = isPro ? Math.floor(item.gfCost * 0.8) : item.gfCost;
    const currentBalance = user.gfTokenBalance ?? 0;

    if (currentBalance < finalCost) {
      return res.status(400).json({
        error: `Insufficient GF balance. You need ${finalCost - currentBalance} more GF.`,
        required: finalCost,
        current: currentBalance,
      });
    }

    const newBalance = currentBalance - finalCost;
    await db.update(users).set({ gfTokenBalance: newBalance }).where(eq(users.id, userId));

    const [purchase] = await db.insert(storePurchases).values({
      userId,
      itemId,
      walletAddress: user.walletAddress || 'gf-balance',
      gfAmount: finalCost,
      status: 'completed',
      completedAt: new Date(),
    }).returning();

    return res.json({
      success: true,
      purchaseId: purchase.id,
      itemName: item.name,
      gfCost: finalCost,
      newBalance,
    });
  } catch (error: any) {
    console.error('Buy with GF error:', error);
    return res.status(500).json({ error: 'Failed to complete purchase' });
  }
});

router.post('/api/store/complete-purchase', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { purchaseId } = req.body;
    if (!purchaseId) {
      return res.status(400).json({ error: 'purchaseId is required' });
    }

    const [purchase] = await db
      .select()
      .from(storePurchases)
      .where(and(
        eq(storePurchases.id, purchaseId),
        eq(storePurchases.userId, userId),
        eq(storePurchases.status, 'pending')
      ))
      .limit(1);

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase intent not found or already completed' });
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [item] = await db.select().from(storeItems).where(eq(storeItems.id, purchase.itemId)).limit(1);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const gfCost = purchase.gfAmount;
    const currentBalance = user.gfTokenBalance ?? 0;

    if (currentBalance < gfCost) {
      await db.update(storePurchases)
        .set({ status: 'failed' })
        .where(eq(storePurchases.id, purchaseId));
      return res.status(400).json({
        error: `Insufficient GF balance. You need ${gfCost - currentBalance} more GF.`,
        required: gfCost,
        current: currentBalance,
      });
    }

    const newBalance = currentBalance - gfCost;
    await db.update(users).set({ gfTokenBalance: newBalance }).where(eq(users.id, userId));
    await db.update(storePurchases)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(storePurchases.id, purchaseId));

    return res.json({
      success: true,
      purchaseId,
      itemName: item.name,
      gfCost,
      newBalance,
    });
  } catch (error: any) {
    console.error('Complete purchase error:', error);
    return res.status(500).json({ error: 'Failed to complete purchase' });
  }
});

router.post('/api/store/verify-purchase', hybridAuth, async (req: Request, res: Response) => {
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
