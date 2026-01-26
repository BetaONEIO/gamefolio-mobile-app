import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;

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

export default publicProcedure
  .input(
    z.object({
      xpAmount: z.number().min(1).max(10000),
    })
  )
  .mutation(async ({ ctx, input }) => {
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
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
      userId = decoded.userId;
    } catch {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      });
    }

    const { data: currentUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('total_xp')
      .eq('id', userId)
      .single();

    if (fetchError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user',
      });
    }

    const newTotalXP = (currentUser.total_xp || 0) + input.xpAmount;
    const newLevel = calculateLevel(newTotalXP);

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        total_xp: newTotalXP,
        level: newLevel,
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update XP',
      });
    }

    return { 
      success: true, 
      user: updatedUser,
      xpAdded: input.xpAmount,
      newTotalXP,
      newLevel,
    };
  });
