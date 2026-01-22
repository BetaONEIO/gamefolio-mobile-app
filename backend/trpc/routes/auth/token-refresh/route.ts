import { z } from 'zod';
import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;
const JWT_REFRESH_SECRET = Env.JWT_SECRET + '-refresh';

const tokenRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export default publicProcedure
  .input(tokenRefreshSchema)
  .mutation(async ({ input }) => {
    const { refreshToken } = input;

    console.log('[AUTH] Token refresh attempt');

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
      
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', decoded.userId)
        .single();

      if (profileError) {
        console.error('[AUTH] Profile fetch error:', profileError);
        throw new Error('Failed to fetch user profile');
      }

      const accessToken = jwt.sign(
        { userId: profileData.id, username: profileData.username, role: profileData.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const newRefreshToken = jwt.sign(
        { userId: profileData.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );

      console.log('[AUTH] Token refreshed successfully');

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: 7 * 24 * 60 * 60,
        user: {
          id: profileData.id,
          username: profileData.username,
          displayName: profileData.display_name,
          email: profileData.email,
          emailVerified: profileData.email_verified,
          role: profileData.role,
          totalXP: profileData.total_xp ?? 0,
          level: profileData.level ?? 1,
          currentStreak: profileData.current_streak ?? 0,
          longestStreak: profileData.longest_streak ?? 0,
          avatarUrl: profileData.avatar_url,
          bannerUrl: profileData.banner_url,
          bio: profileData.bio,
          messagingEnabled: profileData.messaging_enabled,
          isPrivate: profileData.is_private,
          userType: profileData.user_type,
          ageRange: profileData.age_range,
          gfTokenBalance: profileData.gf_token_balance,
        },
      };
    } catch (error) {
      console.error('[AUTH] Refresh token error:', error);
      throw new Error('Invalid or expired refresh token');
    }
  });
