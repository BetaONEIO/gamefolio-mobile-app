import { publicProcedure } from '../../../create-context';
import { supabaseAdmin } from '@/lib/supabase';
import { generateSignedUrl } from '@/backend/lib/signed-urls';
import jwt from 'jsonwebtoken';

import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get('authorization');
    
    console.log('[AUTH] Get user request');

    if (!authHeader) {
      console.log('[AUTH] No authorization header');
      return null;
    }

    const token = authHeader.replace('Bearer ', '');

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; role: string };
      
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', decoded.userId)
        .single();

      if (profileError) {
        console.error('[AUTH] Profile fetch error:', profileError);
        return null;
      }

      console.log('[AUTH] User fetched:', profileData.username);

      return {
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
        avatarUrl: await generateSignedUrl(profileData.avatar_url),
        bannerUrl: await generateSignedUrl(profileData.banner_url),
        bio: profileData.bio,
        messagingEnabled: profileData.messaging_enabled,
        isPrivate: profileData.is_private,
      };
    } catch (error) {
      console.error('[AUTH] Invalid token:', error);
      return null;
    }
  });
