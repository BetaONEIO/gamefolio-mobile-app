import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export default publicProcedure
  .input(
    z.object({
      limit: z.number().optional().default(20),
    }).optional()
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Fetching trending reels:', input);
    
    const { data: reels, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('video_type', 'reel')
      .eq('aspect_ratio', '9:16')
      .order('views', { ascending: false })
      .limit(input?.limit || 20);

    if (error) {
      console.error('[tRPC] Error fetching trending reels:', error);
      throw new Error(`Failed to fetch trending reels: ${error.message}`);
    }

    console.log('[tRPC] Found trending reels:', reels?.length || 0);

    const formattedReels = await Promise.all(reels?.map(async (reel: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', reel.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', reel.id);

      return {
        id: reel.id,
        userId: reel.user_id,
        gameId: reel.game_id,
        title: reel.title,
        description: reel.description || '',
        videoUrl: reel.video_url,
        thumbnailUrl: reel.thumbnail_url,
        videoType: reel.video_type || 'reel',
        duration: reel.duration || 0,
        views: reel.views || 0,
        shareCode: reel.share_code,
        ageRestricted: reel.age_restricted || false,
        createdAt: reel.created_at,
        user: {
          id: reel.user.id,
          username: reel.user.username,
          displayName: reel.user.display_name,
          avatarUrl: reel.user.avatar_url,
        },
        game: reel.game ? {
          id: reel.game.id,
          name: reel.game.name,
          imageUrl: reel.game.image_url,
          twitchId: reel.game.twitch_id,
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }) || []);

    return formattedReels;
  });
