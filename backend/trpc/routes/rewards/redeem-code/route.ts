import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';
import { z } from 'zod';

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .input(z.object({
    code: z.string().min(1).max(50),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[RedeemCode] Redeeming code:', input.code);
    
    const authHeader = ctx.req.headers.get('authorization');
    if (!authHeader) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No authorization header',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    let userId: number | string;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string };
      userId = decoded.userId;
    } catch {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    try {
      const { data: codeData, error: codeError } = await supabaseAdmin
        .from('promo_codes')
        .select('*')
        .eq('code', input.code.toUpperCase())
        .single();

      if (codeError || !codeData) {
        console.log('[RedeemCode] Code not found:', input.code);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Invalid code',
        });
      }

      if (!codeData.is_active) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This code is no longer active',
        });
      }

      if (codeData.expires_at && new Date(codeData.expires_at) < new Date()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This code has expired',
        });
      }

      if (codeData.max_uses && codeData.uses >= codeData.max_uses) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This code has reached its usage limit',
        });
      }

      const { data: previousUse } = await supabaseAdmin
        .from('promo_code_redemptions')
        .select('id')
        .eq('user_id', userId)
        .eq('code_id', codeData.id)
        .single();

      if (previousUse) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You have already redeemed this code',
        });
      }

      const { error: redemptionError } = await supabaseAdmin
        .from('promo_code_redemptions')
        .insert({
          user_id: userId,
          code_id: codeData.id,
        });

      if (redemptionError) {
        console.error('[RedeemCode] Error recording redemption:', redemptionError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to redeem code',
        });
      }

      const { error: updateError } = await supabaseAdmin
        .from('promo_codes')
        .update({ uses: codeData.uses + 1 })
        .eq('id', codeData.id);

      if (updateError) {
        console.error('[RedeemCode] Error updating code uses:', updateError);
      }

      let rewardMessage = 'Code redeemed successfully!';

      if (codeData.reward_type === 'coins' && codeData.reward_value) {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('coins')
          .eq('id', userId)
          .single();

        if (userData) {
          const { error: coinsError } = await supabaseAdmin
            .from('users')
            .update({ coins: userData.coins + codeData.reward_value })
            .eq('id', userId);

          if (!coinsError) {
            rewardMessage = `You received ${codeData.reward_value} coins!`;
          }
        }
      } else if (codeData.reward_type === 'xp' && codeData.reward_value) {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('xp')
          .eq('id', userId)
          .single();

        if (userData) {
          const { error: xpError } = await supabaseAdmin
            .from('users')
            .update({ xp: userData.xp + codeData.reward_value })
            .eq('id', userId);

          if (!xpError) {
            rewardMessage = `You received ${codeData.reward_value} XP!`;
          }
        }
      } else if (codeData.reward_type === 'item' && codeData.reward_item_id) {
        const { error: itemError } = await supabaseAdmin
          .from('user_inventory')
          .insert({
            user_id: userId,
            item_id: codeData.reward_item_id,
          });

        if (!itemError) {
          rewardMessage = 'You received a special item!';
        }
      }

      console.log('[RedeemCode] Code redeemed successfully by user:', userId);

      return {
        success: true,
        message: rewardMessage,
        rewardType: codeData.reward_type,
        rewardValue: codeData.reward_value,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('[RedeemCode] Unexpected error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to redeem code',
      });
    }
  });
