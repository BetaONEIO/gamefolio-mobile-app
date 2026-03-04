import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";
import { generateSignedUrl } from "@/backend/lib/signed-urls";

export default publicProcedure
  .input(
    z.object({
      shareCode: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Fetching clip by share code:', input.shareCode);
    
    const { data: clip, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('share_code', input.shareCode)
      .single();

    if (error || !clip) {
      console.error('[tRPC] Error fetching clip by share code:', error);
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Clip not found',
      });
    }

    console.log('[tRPC] Found clip:', clip.id);

    const { count: likesCount } = await supabaseAdmin
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', clip.id);

    const { count: commentsCount } = await supabaseAdmin
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', clip.id);

    const { count: reactionsCount } = await supabaseAdmin
      .from('reactions')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', clip.id);

    return {
      id: clip.id,
      userId: clip.user_id,
      gameId: clip.game_id,
      title: clip.title,
      description: clip.description || null,
      videoUrl: await generateSignedUrl(clip.video_url),
      thumbnailUrl: await generateSignedUrl(clip.thumbnail_url),
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
        avatarUrl: await generateSignedUrl(clip.user.avatar_url),
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
        reactions: reactionsCount || 0,
      }
    };
  });
