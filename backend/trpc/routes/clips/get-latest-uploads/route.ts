import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export default publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(50).default(20),
    }).optional()
  )
  .query(async ({ input }) => {
    const limit = input?.limit || 20;
    console.log('[tRPC] Fetching latest uploads, limit:', limit);
    
    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select(`
        id,
        title,
        created_at,
        user:users!clips_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[tRPC] Error fetching latest uploads:', error);
      throw new Error(`Failed to fetch latest uploads: ${error.message}`);
    }

    console.log('[tRPC] Found latest uploads:', clips?.length);

    const formattedClips = (clips || []).map(clip => ({
      id: clip.id,
      title: clip.title,
      createdAt: clip.created_at,
      user: clip.user ? {
        id: (clip.user as any).id,
        username: (clip.user as any).username,
        displayName: (clip.user as any).display_name,
        avatarUrl: (clip.user as any).avatar_url,
      } : null,
    }));

    return { uploads: formattedClips };
  });
