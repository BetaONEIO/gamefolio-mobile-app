import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { supabaseAdmin } from "@/lib/supabase";

const searchUsersRoute = protectedProcedure
  .input(z.object({
    query: z.string().min(1),
  }))
  .query(async ({ ctx, input }) => {
    const searchTerm = input.query.trim();
    console.log('[tRPC Users] Searching users with query:', searchTerm, 'by user:', ctx.userId);
    
    try {
      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, username, display_name, avatar_url, is_online, level, total_xp')
        .or(`username.ilike.%${searchTerm}%,display_name.ilike.%${searchTerm}%`)
        .neq('id', ctx.userId)
        .order('total_xp', { ascending: false })
        .limit(20);

      if (error) {
        console.error('[tRPC Users] Error searching users:', error);
        return [];
      }

      const formattedUsers = (users || []).map(user => ({
        id: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        avatarUrl: user.avatar_url,
        isOnline: user.is_online || false,
        level: user.level ?? 1,
        totalXP: user.total_xp ?? 0,
      }));

      console.log('[tRPC Users] Found', formattedUsers.length, 'real users from database');
      return formattedUsers;
    } catch (error) {
      console.error('[tRPC Users] Unexpected error:', error);
      return [];
    }
  });

export default searchUsersRoute;
