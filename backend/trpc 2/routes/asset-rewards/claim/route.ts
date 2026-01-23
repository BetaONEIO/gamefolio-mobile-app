import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .input(z.object({
    rewardId: z.number(),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[AssetRewards] Recording claim for reward:', input.rewardId);
    
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
      const { data: claim, error: claimError } = await supabaseAdmin
        .from('asset_reward_claims')
        .insert({
          rewardId: input.rewardId,
          userId: parseInt(userId),
          claimedAt: new Date().toISOString(),
        })
        .select()
        .single();

      if (claimError) {
        console.error('[AssetRewards] Error recording claim:', claimError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to record claim',
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from('asset_rewards')
        .update({ 
          timesRewarded: supabaseAdmin.rpc('increment_times_rewarded', { reward_id: input.rewardId }),
          updatedAt: new Date().toISOString(),
        })
        .eq('id', input.rewardId);

      if (updateError) {
        console.log('[AssetRewards] Note: Could not update timesRewarded counter:', updateError);
      }

      console.log('[AssetRewards] Claim recorded successfully:', claim.id);

      return { 
        success: true, 
        claimId: claim.id,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('[AssetRewards] Unexpected error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to claim reward',
      });
    }
  });
