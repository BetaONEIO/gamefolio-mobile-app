import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSignedUrl } from '@/backend/lib/signed-urls';
import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';
import { z } from 'zod';

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .input(z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    type: z.enum(['xp', 'coins', 'item', 'badge', 'theme', 'avatar_frame', 'emote']),
    rarity: z.enum(['common', 'rare', 'epic', 'legendary']),
    imageUrl: z.string().url().optional(),
    value: z.number().optional(),
    isActive: z.boolean().default(true),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[AddReward] Adding new reward:', input.name);
    
    const authHeader = ctx.req.headers.get('authorization');
    if (!authHeader) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No authorization header',
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number | string; role: string };
      
      if (decoded.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required',
        });
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    try {
      const { data: reward, error } = await supabaseAdmin
        .from('assets_rewards')
        .insert({
          name: input.name,
          description: input.description || null,
          type: input.type,
          rarity: input.rarity,
          image_url: input.imageUrl || null,
          value: input.value || null,
          is_active: input.isActive,
        })
        .select()
        .single();

      if (error) {
        console.error('[AddReward] Error adding reward:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add reward',
        });
      }

      console.log('[AddReward] Reward added successfully:', reward.id);

      return {
        success: true,
        reward: {
          id: reward.id,
          name: reward.name,
          description: reward.description,
          type: reward.type,
          rarity: reward.rarity,
          imageUrl: await generateSignedUrl(reward.image_url),
          value: reward.value,
          isActive: reward.is_active,
          createdAt: reward.created_at,
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('[AddReward] Unexpected error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to add reward',
      });
    }
  });
