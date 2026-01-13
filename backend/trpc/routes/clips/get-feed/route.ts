import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export default publicProcedure
  .input(
    z.object({
      page: z.number().optional().default(1),
      limit: z.number().optional().default(20),
      gameId: z.number().optional(),
      userId: z.number().optional(),
    }).optional()
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Fetching clips feed:', input);
    
    let query = supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .order('created_at', { ascending: false });

    if (input?.gameId) {
      query = query.eq('game_id', input.gameId);
    }

    if (input?.userId) {
      query = query.eq('user_id', input.userId);
    }

    const page = input?.page || 1;
    const limit = input?.limit || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query.range(from, to);

    const { data: clips, error } = await query;

    if (error) {
      console.error('[tRPC] Error fetching clips feed:', error);
      throw new Error(`Failed to fetch clips: ${error.message}`);
    }

    console.log('[tRPC] Found clips:', clips?.length || 0);

    const formattedClips = await Promise.all(clips?.map(async (clip: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      return {
        id: clip.id,
        userId: clip.user_id,
        gameId: clip.game_id,
        title: clip.title,
        description: clip.description || '',
        videoUrl: clip.video_url,
        thumbnailUrl: clip.thumbnail_url,
        videoType: clip.video_type || 'clip',
        duration: clip.duration || 0,
        views: clip.views || 0,
        shareCode: clip.share_code,
        ageRestricted: clip.age_restricted || false,
        createdAt: clip.created_at,
        user: {
          id: clip.user.id,
          username: clip.user.username,
          displayName: clip.user.display_name,
          avatarUrl: clip.user.avatar_url,
        },
        game: clip.game ? {
          id: clip.game.id,
          name: clip.game.name,
          imageUrl: clip.game.image_url,
          twitchId: clip.game.twitch_id,
        } : null,
        _count: {
          likes: likesCount || 0,
          comments: commentsCount || 0,
        }
      };
    }) || []);

    return formattedClips;
  });
