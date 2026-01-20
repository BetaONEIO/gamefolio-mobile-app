import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export default publicProcedure
  .input(
    z.object({
      id: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Fetching clip:', input.id);
    
    const { data: clip, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('id', parseInt(input.id))
      .single();

    if (error) {
      console.error('[tRPC] Error fetching clip:', error);
      throw new Error(`Failed to fetch clip: ${error.message}`);
    }

    if (!clip) {
      throw new Error('Clip not found');
    }

    console.log('[tRPC] Fetched clip:', clip.id);

    const { data: likesCount } = await supabaseAdmin
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('clip_id', clip.id);

    const { data: commentsCount } = await supabaseAdmin
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('clip_id', clip.id);

    const formattedClip = {
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
        likes: likesCount?.length || 0,
        comments: commentsCount?.length || 0,
      }
    };

    return formattedClip;
  });
