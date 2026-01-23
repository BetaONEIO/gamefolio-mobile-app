import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export default publicProcedure
  .input(
    z.object({
      period: z.enum(['recent', '1w', '1m', 'ever']).optional().default('ever'),
      limit: z.number().optional().default(20),
    }).optional()
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Fetching trending clips:', input);
    
    let dateFilter: Date | null = null;
    const now = new Date();

    switch (input?.period) {
      case 'recent':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '1w':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '1m':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        dateFilter = null;
    }

    let query = supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('video_type', 'clip');

    if (dateFilter) {
      query = query.gte('created_at', dateFilter.toISOString());
    }

    query = query
      .order('views', { ascending: false })
      .limit(input?.limit || 20);

    const { data: clips, error } = await query;

    if (error) {
      console.error('[tRPC] Error fetching trending clips:', error);
      throw new Error(`Failed to fetch trending clips: ${error.message}`);
    }

    console.log('[tRPC] Found trending clips:', clips?.length || 0);

    const formattedClips = await Promise.all(clips?.map(async (clip: any) => {
      const { count: likesCount } = await supabaseAdmin
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      const { count: commentsCount } = await supabaseAdmin
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('clip_id', clip.id);

      const { count: firesCount } = await supabaseAdmin
        .from('fires')
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
          fires: firesCount || 0,
        }
      };
    }) || []);

    return formattedClips;
  });
