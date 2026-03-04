import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSignedUrl } from '@/backend/lib/signed-urls';
import { z } from 'zod';

export default publicProcedure
  .input(z.object({
    userId: z.number(),
  }))
  .query(async ({ input }) => {
    console.log('[AvatarBorders] Fetching selected border for user:', input.userId);

    try {
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('selectedAvatarBorderId')
        .eq('id', input.userId)
        .single();

      if (userError || !user?.selectedAvatarBorderId) {
        console.log('[AvatarBorders] No border selected for user');
        return { border: null };
      }

      const { data: border, error: borderError } = await supabaseAdmin
        .from('asset_rewards')
        .select('id, name, imageUrl, rarity')
        .eq('id', user.selectedAvatarBorderId)
        .single();

      if (borderError || !border) {
        console.log('[AvatarBorders] Border not found:', borderError);
        return { border: null };
      }

      console.log('[AvatarBorders] Found border:', border.name);

      return { 
        border: {
          id: border.id,
          name: border.name,
          imageUrl: await generateSignedUrl(border.imageUrl),
          rarity: border.rarity as 'common' | 'rare' | 'epic' | 'legendary',
        },
      };
    } catch (error) {
      console.error('[AvatarBorders] Unexpected error:', error);
      return { border: null };
    }
  });
