import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSignedUrl } from '@/backend/lib/signed-urls';

export default publicProcedure
  .query(async () => {
    console.log('[AssetRewards] Fetching active rewards for lootbox');

    try {
      const { data: rewards, error } = await supabaseAdmin
        .from('asset_rewards')
        .select('*')
        .eq('isActive', true)
        .order('rarity', { ascending: true });

      if (error) {
        console.error('[AssetRewards] Error fetching rewards:', error);
        return { rewards: [] };
      }

      console.log('[AssetRewards] Found', rewards?.length || 0, 'active rewards');

      const formattedRewards = await Promise.all((rewards || []).map(async reward => ({
        id: reward.id,
        name: reward.name,
        imageUrl: await generateSignedUrl(reward.imageUrl),
        rarity: reward.rarity as 'common' | 'rare' | 'epic' | 'legendary',
        unlockChance: reward.unlockChance,
        timesRewarded: reward.timesRewarded,
      })));

      return { rewards: formattedRewards };
    } catch (error) {
      console.error('[AssetRewards] Unexpected error:', error);
      return { rewards: [] };
    }
  });
