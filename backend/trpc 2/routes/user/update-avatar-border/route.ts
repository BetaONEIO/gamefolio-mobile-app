import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .input(z.object({
    avatarBorderId: z.number().nullable(),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[AvatarBorders] Updating selected border to:', input.avatarBorderId);
    
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
      if (input.avatarBorderId !== null) {
        const { data: claim, error: claimError } = await supabaseAdmin
          .from('asset_reward_claims')
          .select('id')
          .eq('userId', parseInt(userId))
          .eq('rewardId', input.avatarBorderId)
          .single();

        if (claimError || !claim) {
          console.error('[AvatarBorders] User has not unlocked this border');
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'You have not unlocked this border',
          });
        }

        const { data: reward, error: rewardError } = await supabaseAdmin
          .from('asset_rewards')
          .select('assetType')
          .eq('id', input.avatarBorderId)
          .single();

        if (rewardError || reward?.assetType !== 'avatar_border') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid avatar border',
          });
        }
      }

      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ 
          selectedAvatarBorderId: input.avatarBorderId,
          updatedAt: new Date().toISOString(),
        })
        .eq('id', parseInt(userId));

      if (updateError) {
        console.error('[AvatarBorders] Error updating selected border:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update selected border',
        });
      }

      console.log('[AvatarBorders] Successfully updated selected border');

      return { 
        success: true,
        selectedBorderId: input.avatarBorderId,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('[AvatarBorders] Unexpected error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update avatar border',
      });
    }
  });
