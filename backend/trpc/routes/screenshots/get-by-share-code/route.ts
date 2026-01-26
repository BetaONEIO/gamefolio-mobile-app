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
    console.log('[tRPC] Fetching screenshot by share code:', input.shareCode);
    
    const { data: screenshot, error } = await supabaseAdmin
      .from('screenshots')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('share_code', input.shareCode)
      .single();

    if (error || !screenshot) {
      console.error('[tRPC] Error fetching screenshot by share code:', error);
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Screenshot not found',
      });
    }

    console.log('[tRPC] Found screenshot:', screenshot.id);

    const { count: likesCount } = await supabaseAdmin
      .from('screenshot_likes')
      .select('*', { count: 'exact', head: true })
      .eq('screenshot_id', screenshot.id);

    const { count: commentsCount } = await supabaseAdmin
      .from('screenshot_comments')
      .select('*', { count: 'exact', head: true })
      .eq('screenshot_id', screenshot.id);

    const { count: reactionsCount } = await supabaseAdmin
      .from('screenshot_reactions')
      .select('*', { count: 'exact', head: true })
      .eq('screenshot_id', screenshot.id);

    return {
      id: screenshot.id,
      userId: screenshot.user_id,
      gameId: screenshot.game_id,
      title: screenshot.title,
      description: screenshot.description || null,
      imageUrl: await generateSignedUrl(screenshot.image_url),
      thumbnailUrl: await generateSignedUrl(screenshot.thumbnail_url),
      shareCode: screenshot.share_code,
      views: screenshot.views || 0,
      ageRestricted: screenshot.age_restricted || false,
      createdAt: screenshot.created_at,
      user: {
        id: screenshot.user.id,
        username: screenshot.user.username,
        displayName: screenshot.user.display_name,
        avatarUrl: screenshot.user.avatar_url,
      },
      game: screenshot.game ? {
        id: screenshot.game.id,
        name: screenshot.game.name,
        imageUrl: screenshot.game.image_url,
        twitchId: screenshot.game.twitch_id,
      } : null,
      _count: {
        likes: likesCount || 0,
        comments: commentsCount || 0,
        reactions: reactionsCount || 0,
      }
    };
  });
