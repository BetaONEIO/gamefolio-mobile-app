import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSignedUrl } from "@/backend/lib/signed-urls";

export default publicProcedure
  .input(
    z.object({
      username: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Fetching profile for user:', input.username);
    
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        _count:clips(count)
      `)
      .eq('username', input.username)
      .single();

    if (error) {
      console.error('[tRPC] Error fetching user profile:', error);
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    if (!user) {
      throw new Error('User not found');
    }

    console.log('[tRPC] Found user:', user.username);

    const formattedUser = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      email: user.email,
      emailVerified: user.email_verified,
      role: user.role,
      totalXP: user.total_xp,
      level: user.level,
      currentStreak: user.current_streak,
      longestStreak: user.longest_streak,
      avatarUrl: await generateSignedUrl(user.avatar_url),
      bannerUrl: await generateSignedUrl(user.banner_url),
      bio: user.bio,
      messagingEnabled: user.messaging_enabled,
      isPrivate: user.is_private,
      userType: user.user_type,
      ageRange: user.age_range,
      gfTokenBalance: user.gf_token_balance,
      accentColor: user.accent_color,
      backgroundColor: user.background_color,
      isOnline: user.is_online || false,
      lastActive: user.last_active || null,
      _count: {
        followers: 0,
        following: 0,
        clips: user._count?.length || 0,
      }
    };

    return { user: formattedUser };
  });
