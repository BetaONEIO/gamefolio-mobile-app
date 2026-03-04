import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSignedUrl } from '@/backend/lib/signed-urls';
import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .query(async ({ ctx }) => {
    console.log('[AvatarBorders] Fetching unlocked borders for user');
    
    const authHeader = ctx.req.headers.get('authorization');
    
    if (!authHeader) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No authorization header',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    let userId: string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = decoded.userId;
    } catch {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    try {
      const { data: claims, error: claimsError } = await supabaseAdmin
        .from('asset_reward_claims')
        .select(`
          id,
          claimed_at,
          reward_id,
          asset_rewards (
            id,
            name,
            image_url,
            rarity,
            asset_type
          )
        `)
        .eq('user_id', parseInt(userId));

      if (claimsError) {
        console.error('[AvatarBorders] Error fetching claims:', claimsError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch unlocked borders',
        });
      }

      const avatarBorders = await Promise.all((claims || [])
        .filter((claim: any) => claim.asset_rewards?.asset_type === 'avatar_border')
        .map(async (claim: any) => ({
          id: claim.asset_rewards.id,
          name: claim.asset_rewards.name,
          imageUrl: await generateSignedUrl(claim.asset_rewards.image_url),
          rarity: claim.asset_rewards.rarity as 'common' | 'rare' | 'epic' | 'legendary',
          claimedAt: claim.claimed_at,
        })));

      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('selected_avatar_border_id')
        .eq('id', parseInt(userId))
        .single();

      if (userError) {
        console.log('[AvatarBorders] Could not fetch user selected border:', userError);
      }

      console.log('[AvatarBorders] Found', avatarBorders.length, 'unlocked avatar borders');

      return { 
        borders: avatarBorders,
        selectedBorderId: user?.selected_avatar_border_id || null,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('[AvatarBorders] Unexpected error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch avatar borders',
      });
    }
  });
