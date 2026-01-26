import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .input(
    z.object({
      birthday: z.string(),
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
      .select('birthday, birthday_last_updated')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('[updateBirthday] Failed to fetch user:', fetchError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user data',
      });
    }

    if (currentUser?.birthday_last_updated) {
      const lastUpdated = new Date(currentUser.birthday_last_updated);
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      
      if (lastUpdated > oneYearAgo) {
        const nextUpdateDate = new Date(lastUpdated);
        nextUpdateDate.setFullYear(nextUpdateDate.getFullYear() + 1);
        
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `You can only update your birthday once per year. You can update it again after ${nextUpdateDate.toLocaleDateString()}.`,
        });
      }
    }

    const birthdayDate = new Date(input.birthday);
    if (isNaN(birthdayDate.getTime())) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid birthday date format',
      });
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        birthday: input.birthday,
        birthday_last_updated: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('[updateBirthday] Failed to update birthday:', updateError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update birthday',
      });
    }

    console.log('[updateBirthday] Birthday updated successfully for user:', userId);

    return {
      success: true,
      birthday: updatedUser.birthday,
      birthdayLastUpdated: updatedUser.birthday_last_updated,
    };
  });
