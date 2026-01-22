import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;

interface AssetReward {
  id: number;
  name: string;
  imageUrl: string | null;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockChance: number;
  timesRewarded: number;
}

function calculateLevel(totalXP: number): number {
  let level = 1;
  let xpNeeded = 0;
  
  while (xpNeeded <= totalXP) {
    xpNeeded += 1000 * level;
    if (xpNeeded <= totalXP) {
      level++;
    }
  }
  
  return level;
}

function selectWeightedReward(rewards: AssetReward[]): AssetReward | null {
  if (rewards.length === 0) return null;
  
  const totalChance = rewards.reduce((sum, r) => sum + r.unlockChance, 0);
  
  if (totalChance === 0) {
    return rewards[Math.floor(Math.random() * rewards.length)];
  }
  
  const roll = Math.random() * totalChance;
  let cumulative = 0;
  
  for (const reward of rewards) {
    cumulative += reward.unlockChance;
    if (roll <= cumulative) {
      return reward;
    }
  }
  
  return rewards[rewards.length - 1];
}

function generateFallbackRewards() {
  const rarityRoll = Math.random();
  let rarity: 'common' | 'rare' | 'epic' | 'legendary';
  
  if (rarityRoll < 0.6) {
    rarity = 'common';
  } else if (rarityRoll < 0.85) {
    rarity = 'rare';
  } else if (rarityRoll < 0.97) {
    rarity = 'epic';
  } else {
    rarity = 'legendary';
  }

  const xpMultiplier = {
    common: 1,
    rare: 1.5,
    epic: 2.5,
    legendary: 4,
  }[rarity];

  const coinsMultiplier = {
    common: 1,
    rare: 1.5,
    epic: 2.5,
    legendary: 4,
  }[rarity];

  const baseXP = Math.floor(Math.random() * 300) + 100;
  const baseCoins = Math.floor(Math.random() * 100) + 50;
  
  const xpAmount = Math.floor(baseXP * xpMultiplier);
  const coinsAmount = Math.floor(baseCoins * coinsMultiplier);

  const rewards = [
    {
      type: 'xp' as const,
      amount: xpAmount,
      name: 'XP',
      rarity,
    },
    {
      type: 'coins' as const,
      amount: coinsAmount,
      name: 'Coins',
      rarity,
    },
  ];

  return { rewards, xpAmount, coinsAmount };
}

export default publicProcedure
  .mutation(async ({ ctx }) => {
    console.log('[ClaimLootbox] Starting claim process');
    const authHeader = ctx.req.headers.get('authorization');
    
    if (!authHeader) {
      console.error('[ClaimLootbox] No auth header');
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No authorization header',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[ClaimLootbox] Token received:', token ? 'yes' : 'no');
    
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
      userId = decoded.userId;
      console.log('[ClaimLootbox] User ID from token:', userId);
    } catch (error) {
      console.error('[ClaimLootbox] Token verification failed:', error);
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    const { data: currentUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('total_xp, last_lootbox_claim')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('[ClaimLootbox] Fetch error:', fetchError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user',
      });
    }

    console.log('[ClaimLootbox] Current user data:', { totalXP: currentUser.total_xp, lastClaim: currentUser.last_lootbox_claim });

    const now = new Date();
    if (currentUser.last_lootbox_claim) {
      const lastClaim = new Date(currentUser.last_lootbox_claim);
      const timeDiff = now.getTime() - lastClaim.getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        const nextClaimTime = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
        console.log('[ClaimLootbox] Already claimed today. Next claim:', nextClaimTime);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Daily lootbox already claimed. Come back tomorrow!',
        });
      }
    }

    const { data: assetRewards, error: rewardsError } = await supabaseAdmin
      .from('asset_rewards')
      .select('*')
      .eq('is_active', true);

    if (rewardsError) {
      console.error('[ClaimLootbox] Error fetching asset rewards:', rewardsError);
    }

    let rewards: {
      id?: number;
      type: 'xp' | 'coins' | 'item' | 'asset';
      amount: number;
      name: string;
      rarity: 'common' | 'rare' | 'epic' | 'legendary';
      imageUrl?: string | null;
    }[];
    let xpAmount = 0;
    let wonAssetReward: AssetReward | null = null;

    const formattedAssetRewards: AssetReward[] = (assetRewards || []).map(r => ({
      id: r.id,
      name: r.name,
      imageUrl: r.image_url,
      rarity: r.rarity as 'common' | 'rare' | 'epic' | 'legendary',
      unlockChance: r.unlock_chance || 0,
      timesRewarded: r.times_rewarded || 0,
    }));

    if (formattedAssetRewards.length > 0) {
      wonAssetReward = selectWeightedReward(formattedAssetRewards);
      console.log('[ClaimLootbox] Selected asset reward:', wonAssetReward?.name);

      if (wonAssetReward) {
        const { error: claimError } = await supabaseAdmin
          .from('asset_reward_claims')
          .insert({
            reward_id: wonAssetReward.id,
            user_id: parseInt(userId),
            claimed_at: now.toISOString(),
          });

        if (claimError) {
          console.error('[ClaimLootbox] Error recording asset claim:', claimError);
        } else {
          await supabaseAdmin
            .from('asset_rewards')
            .update({ 
              times_rewarded: (wonAssetReward.timesRewarded || 0) + 1,
              updated_at: now.toISOString(),
            })
            .eq('id', wonAssetReward.id);
        }

        const rarityXpBonus = {
          common: 100,
          rare: 200,
          epic: 350,
          legendary: 500,
        }[wonAssetReward.rarity] || 100;

        xpAmount = rarityXpBonus;

        rewards = [
          {
            id: wonAssetReward.id,
            type: 'asset',
            amount: 1,
            name: wonAssetReward.name,
            rarity: wonAssetReward.rarity,
            imageUrl: wonAssetReward.imageUrl,
          },
          {
            type: 'xp',
            amount: xpAmount,
            name: 'Bonus XP',
            rarity: wonAssetReward.rarity,
          },
        ];
      } else {
        const fallback = generateFallbackRewards();
        rewards = fallback.rewards;
        xpAmount = fallback.xpAmount;
      }
    } else {
      console.log('[ClaimLootbox] No asset rewards available, using fallback');
      const fallback = generateFallbackRewards();
      rewards = fallback.rewards;
      xpAmount = fallback.xpAmount;
    }

    console.log('[ClaimLootbox] Final rewards:', { xpAmount, rewardsCount: rewards.length });

    const newTotalXP = (currentUser.total_xp || 0) + xpAmount;
    const newLevel = calculateLevel(newTotalXP);
    console.log('[ClaimLootbox] New stats:', { newTotalXP, newLevel });

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        total_xp: newTotalXP,
        level: newLevel,
        last_lootbox_claim: now.toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('[ClaimLootbox] Update error:', updateError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to claim lootbox',
      });
    }

    console.log('[ClaimLootbox] Successfully claimed lootbox');
    return { 
      success: true,
      rewards,
      assetReward: wonAssetReward ? {
        id: wonAssetReward.id,
        name: wonAssetReward.name,
        imageUrl: wonAssetReward.imageUrl,
        rarity: wonAssetReward.rarity,
      } : null,
      allAssetRewards: formattedAssetRewards,
      newXP: newTotalXP,
      newLevel,
      nextClaimTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
  });
