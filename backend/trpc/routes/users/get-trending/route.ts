import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export default publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(50).default(10),
    }).optional()
  )
  .query(async ({ input }) => {
    const limit = input?.limit || 10;
    console.log('[tRPC] Fetching trending users, limit:', limit);
    
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        banner_url,
        total_xp,
        level,
        current_streak,
        accent_color
      `)
      .order('total_xp', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[tRPC] Error fetching trending users:', error);
      throw new Error(`Failed to fetch trending users: ${error.message}`);
    }

    console.log('[tRPC] Found trending users:', users?.length);

    const formattedUsers = (users || []).map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bannerUrl: user.banner_url,
      totalXP: user.total_xp,
      level: user.level,
      currentStreak: user.current_streak,
      accentColor: user.accent_color,
    }));

    return { users: formattedUsers };
  });
