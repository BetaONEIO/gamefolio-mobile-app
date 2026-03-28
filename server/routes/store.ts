import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users, nameTags, userUnlockedNameTags, profileBorders, userUnlockedBorders } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { hybridAuth } from '../middleware/hybrid-auth';

const router = Router();

router.get('/api/store/items', hybridAuth, async (req: Request, res: Response) => {
  return res.json([]);
});

router.get('/api/store/owned', hybridAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const unlockedTags = await db
      .select({
        id: nameTags.id,
        name: nameTags.name,
        image: nameTags.imageUrl,
        category: sql<string>`'name-tag'`,
        rarity: nameTags.rarity,
        gfCost: nameTags.gfCost,
      })
      .from(userUnlockedNameTags)
      .innerJoin(nameTags, eq(userUnlockedNameTags.nameTagId, nameTags.id))
      .where(eq(userUnlockedNameTags.userId, userId));

    const unlockedBorders = await db
      .select({
        id: profileBorders.id,
        name: profileBorders.name,
        image: profileBorders.imageUrl,
        category: sql<string>`'border'`,
        rarity: profileBorders.rarity,
        gfCost: profileBorders.gfCost,
      })
      .from(userUnlockedBorders)
      .innerJoin(profileBorders, eq(userUnlockedBorders.borderId, profileBorders.id))
      .where(eq(userUnlockedBorders.userId, userId));

    return res.json([...unlockedTags, ...unlockedBorders]);
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

    if (itemType === 'name-tag') {
      const [tag] = await db.select().from(nameTags).where(eq(nameTags.id, itemId)).limit(1);
      if (!tag) return res.status(404).json({ error: 'Name tag not found' });
      if (!tag.availableInStore || !tag.isActive) return res.status(400).json({ error: 'Name tag is not available for purchase' });
      if (tag.isDefault) return res.status(400).json({ error: 'This name tag is free for everyone' });
      const baseCost = Math.max(tag.gfCost ?? 0, 0);
      if (baseCost <= 0) return res.status(400).json({ error: 'This name tag has no price set' });
      const cost = isPro ? Math.floor(baseCost * 0.8) : baseCost;
      const [existing] = await db.select().from(userUnlockedNameTags)
        .where(and(eq(userUnlockedNameTags.userId, userId), eq(userUnlockedNameTags.nameTagId, itemId))).limit(1);
      if (existing) return res.status(400).json({ error: 'You already own this name tag' });
      if (currentBalance < cost) return res.status(400).json({ error: `Insufficient GF tokens. Need ${cost} GF, you have ${currentBalance} GF` });
      await db.update(users).set({ gfTokenBalance: sql`COALESCE(${users.gfTokenBalance}, 0) - ${cost}` }).where(eq(users.id, userId));
      await db.insert(userUnlockedNameTags).values({ userId, nameTagId: itemId });
      return res.json({ success: true, itemName: tag.name, gfCost: cost, originalPrice: baseCost, discountApplied: isPro, newBalance: currentBalance - cost });
    }

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

    return res.status(400).json({ error: 'Invalid item type' });
  } catch (error) {
    console.error('Create purchase intent error:', error);
    return res.status(500).json({ error: 'Failed to create purchase intent' });
  }
});

router.post('/api/store/complete-purchase', hybridAuth, async (req: Request, res: Response) => {
  return res.status(400).json({ error: 'Use purchase-intent for direct GF purchases' });
});

router.post('/api/store/buy-with-gf', hybridAuth, async (req: Request, res: Response) => {
  return res.status(400).json({ error: 'Use purchase-intent with itemType for purchases' });
});

export default router;
