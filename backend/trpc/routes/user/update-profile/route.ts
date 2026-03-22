import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';
import { generateSignedUrl } from '@/backend/lib/signed-urls';

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .input(
    z.object({
      username: z.string().min(3).max(20).regex(/^[a-zA-Z][a-zA-Z0-9_]{2,19}$/, 'Username must start with a letter and contain only letters, numbers, and underscores').optional(),
      displayName: z.string().optional(),
      bio: z.string().optional(),
      avatarUrl: z.string().optional(),
      bannerUrl: z.string().optional(),
      accentColor: z.string().optional(),
      primaryColor: z.string().optional(),
      backgroundColor: z.string().optional(),
      displayNameColor: z.string().optional(),
      profileBorderId: z.string().optional(),
      userType: z.string().optional(),
      showUserType: z.boolean().optional(),
      ageRange: z.string().optional(),
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

    const updates: any = {};
    if (input.username !== undefined) updates.username = input.username;
    if (input.displayName !== undefined) updates.display_name = input.displayName;
    if (input.bio !== undefined) updates.bio = input.bio;
    if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl;
    if (input.bannerUrl !== undefined) updates.banner_url = input.bannerUrl;
    if (input.accentColor !== undefined) updates.accent_color = input.accentColor;
    if (input.primaryColor !== undefined) updates.primary_color = input.primaryColor;
    if (input.backgroundColor !== undefined) updates.background_color = input.backgroundColor;
    if (input.displayNameColor !== undefined) updates.display_name_color = input.displayNameColor;
    if (input.profileBorderId !== undefined) updates.profile_border_id = input.profileBorderId;
    if (input.userType !== undefined) updates.user_type = input.userType;
    if (input.showUserType !== undefined) updates.show_user_type = input.showUserType;
    if (input.ageRange !== undefined) updates.age_range = input.ageRange;

    if (Object.keys(updates).length === 0) {
      return { success: true };
    }

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update profile:', updateError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update profile',
      });
    }

    return {
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        displayName: updatedUser.display_name,
        email: updatedUser.email,
        emailVerified: updatedUser.email_verified,
        role: updatedUser.role,
        totalXP: updatedUser.total_xp ?? 0,
        level: updatedUser.level ?? 1,
        currentStreak: updatedUser.current_streak ?? 0,
        longestStreak: updatedUser.longest_streak ?? 0,
        avatarUrl: await generateSignedUrl(updatedUser.avatar_url),
        bannerUrl: await generateSignedUrl(updatedUser.banner_url),
        bio: updatedUser.bio,
        messagingEnabled: updatedUser.messaging_enabled,
        isPrivate: updatedUser.is_private,
        accentColor: updatedUser.accent_color,
        primaryColor: updatedUser.primary_color,
        backgroundColor: updatedUser.background_color,
        displayNameColor: updatedUser.display_name_color,
        userType: updatedUser.user_type,
        ageRange: updatedUser.age_range,
        gfTokenBalance: updatedUser.gf_token_balance,
        isOnline: updatedUser.is_online,
        lastActive: updatedUser.last_active,
        profileBorderId: updatedUser.profile_border_id,
      },
    };
  });
