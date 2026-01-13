import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export default publicProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(50),
    }).optional()
  )
  .query(async ({ input }) => {
    const limit = input?.limit || 50;
    console.log('[tRPC] Fetching latest clips, limit:', limit);
    
    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select(`
        id,
        user_id,
        game_id,
        title,
        description,
        video_url,
        thumbnail_url,
        video_type,
        duration,
        views,
        share_code,
        age_restricted,
        created_at,
        user:users!clips_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        ),
        game:games!clips_game_id_fkey (
          id,
          name,
          image_url,
          twitch_id
        ),
        likes:clip_likes(count),
        comments:clip_comments(count),
        fires:clip_fires(count)
      `)
      .eq('video_type', 'clip')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[tRPC] Error fetching latest clips:', error);
      throw new Error(`Failed to fetch latest clips: ${error.message}`);
    }

    console.log('[tRPC] Found latest clips:', clips?.length);

    const formattedClips = (clips || []).map(clip => ({
      id: clip.id,
      userId: clip.user_id,
      gameId: clip.game_id,
      title: clip.title,
      description: clip.description,
      videoUrl: clip.video_url,
      thumbnailUrl: clip.thumbnail_url,
      videoType: clip.video_type,
      duration: clip.duration,
      views: clip.views,
      shareCode: clip.share_code,
      ageRestricted: clip.age_restricted,
      createdAt: clip.created_at,
      user: clip.user ? {
        id: (clip.user as any).id,
        username: (clip.user as any).username,
        displayName: (clip.user as any).display_name,
        avatarUrl: (clip.user as any).avatar_url,
      } : null,
      game: clip.game ? {
        id: (clip.game as any).id,
        name: (clip.game as any).name,
        imageUrl: (clip.game as any).image_url,
        twitchId: (clip.game as any).twitch_id,
      } : null,
      _count: {
        likes: Array.isArray(clip.likes) ? clip.likes.length : (clip.likes as any)?.[0]?.count || 0,
        comments: Array.isArray(clip.comments) ? clip.comments.length : (clip.comments as any)?.[0]?.count || 0,
        fires: Array.isArray(clip.fires) ? clip.fires.length : (clip.fires as any)?.[0]?.count || 0,
      },
    }));

    return formattedClips;
  });
