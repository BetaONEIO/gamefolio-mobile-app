import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

export default publicProcedure
  .input(z.object({
    rarity: z.enum(['common', 'rare', 'epic', 'legendary']).optional(),
    type: z.enum(['xp', 'coins', 'item', 'badge', 'theme', 'avatar_frame', 'emote']).optional(),
    isActive: z.boolean().optional(),
  }).optional())
  .query(async ({ input }) => {
    console.log('[Rewards] Fetching all rewards with filters:', input);

    try {
      let query = supabaseAdmin
        .from('assets_rewards')
        .select('*')
        .order('rarity', { ascending: true })
        .order('name', { ascending: true });

      if (input?.rarity) {
        query = query.eq('rarity', input.rarity);
      }

      if (input?.type) {
        query = query.eq('type', input.type);
      }

      if (input?.isActive !== undefined) {
        query = query.eq('is_active', input.isActive);
      }

      const { data: rewards, error } = await query;

      if (error) {
        console.error('[Rewards] Error fetching rewards:', error);
        return { rewards: [] };
      }

      console.log('[Rewards] Found', rewards?.length || 0, 'rewards');

      const formattedRewards = (rewards || []).map(reward => ({
        id: reward.id,
        name: reward.name,
        description: reward.description,
        type: reward.type,
        rarity: reward.rarity,
        imageUrl: reward.image_url,
        value: reward.value,
        isActive: reward.is_active,
        createdAt: reward.created_at,
      }));

      return { rewards: formattedRewards };
    } catch (error) {
      console.error('[Rewards] Unexpected error:', error);
      return { rewards: [] };
    }
  });
