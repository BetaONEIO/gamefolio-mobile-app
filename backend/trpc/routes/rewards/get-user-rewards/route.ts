import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';
import { z } from 'zod';

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .input(z.object({
    rarity: z.enum(['common', 'rare', 'epic', 'legendary']).optional(),
    type: z.enum(['xp', 'coins', 'item', 'badge', 'theme', 'avatar_frame', 'emote']).optional(),
  }).optional())
  .query(async ({ ctx, input }) => {
    console.log('[UserRewards] Fetching user rewards');
    
    const authHeader = ctx.req.headers.get('authorization');
    if (!authHeader) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No authorization header',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    let userId: number;
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
      userId = typeof decoded.userId === 'number' ? decoded.userId : parseInt(String(decoded.userId));
      
      if (isNaN(userId)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid token payload',
        });
      }
    } catch {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    try {
      let query = supabaseAdmin
        .from('user_rewards')
        .select(`
          id,
          claimed_at,
          quantity,
          reward:assets_rewards (
            id,
            name,
            description,
            type,
            rarity,
            image_url,
            value
          )
        `)
        .eq('user_id', userId)
        .order('claimed_at', { ascending: false });

      const { data: userRewards, error } = await query;

      if (error) {
        console.error('[UserRewards] Error fetching user rewards:', error);
        return { rewards: [], stats: null };
      }

      console.log('[UserRewards] Found', userRewards?.length || 0, 'user rewards');

      let filteredRewards = userRewards || [];

      if (input?.rarity) {
        filteredRewards = filteredRewards.filter((ur: any) => ur.reward?.rarity === input.rarity);
      }

      if (input?.type) {
        filteredRewards = filteredRewards.filter((ur: any) => ur.reward?.type === input.type);
      }

      const formattedRewards = filteredRewards.map((ur: any) => ({
        id: ur.id,
        claimedAt: ur.claimed_at,
        quantity: ur.quantity || 1,
        reward: ur.reward ? {
          id: ur.reward.id,
          name: ur.reward.name,
          description: ur.reward.description,
          type: ur.reward.type,
          rarity: ur.reward.rarity,
          imageUrl: ur.reward.image_url,
          value: ur.reward.value,
        } : null,
      }));

      const { data: statsData } = await supabaseAdmin
        .from('user_rewards')
        .select(`
          reward:assets_rewards (rarity)
        `)
        .eq('user_id', userId);

      const stats = {
        totalItems: statsData?.length || 0,
        legendaryCount: statsData?.filter((s: any) => s.reward?.rarity === 'legendary').length || 0,
        epicCount: statsData?.filter((s: any) => s.reward?.rarity === 'epic').length || 0,
        rareCount: statsData?.filter((s: any) => s.reward?.rarity === 'rare').length || 0,
        commonCount: statsData?.filter((s: any) => s.reward?.rarity === 'common').length || 0,
      };

      return { rewards: formattedRewards, stats };
    } catch (error) {
      console.error('[UserRewards] Unexpected error:', error);
      return { rewards: [], stats: null };
    }
  });
