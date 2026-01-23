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
    
    const { data: clips, error: clipsError } = await supabaseAdmin
      .from('clips')
      .select(`
        id,
        title,
        video_type,
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

    if (clipsError) {
      console.error('[tRPC] Error fetching latest clips:', clipsError);
    }

    const { data: screenshots, error: screenshotsError } = await supabaseAdmin
      .from('screenshots')
      .select(`
        id,
        title,
        created_at,
        user:users!screenshots_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (screenshotsError) {
      console.error('[tRPC] Error fetching latest screenshots:', screenshotsError);
    }

    const formattedClips = (clips || []).map(clip => ({
      id: clip.id,
      title: clip.title,
      contentType: (clip as any).video_type === 'reel' ? 'reel' as const : 'clip' as const,
      createdAt: clip.created_at,
      user: clip.user ? {
        id: (clip.user as any).id,
        username: (clip.user as any).username,
        displayName: (clip.user as any).display_name,
        avatarUrl: (clip.user as any).avatar_url,
      } : null,
    }));

    const formattedScreenshots = (screenshots || []).map(screenshot => ({
      id: screenshot.id,
      title: screenshot.title,
      contentType: 'screenshot' as const,
      createdAt: screenshot.created_at,
      user: screenshot.user ? {
        id: (screenshot.user as any).id,
        username: (screenshot.user as any).username,
        displayName: (screenshot.user as any).display_name,
        avatarUrl: (screenshot.user as any).avatar_url,
      } : null,
    }));

    const allUploads = [...formattedClips, ...formattedScreenshots]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    console.log('[tRPC] Found latest uploads:', allUploads.length);

    return { uploads: allUploads };
  });
