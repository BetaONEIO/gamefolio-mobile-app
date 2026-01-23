import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .input(
    z.object({
      userId: z.number(),
    })
  )
  .query(async ({ input, ctx }) => {
    console.log('[tRPC] Fetching screenshots for user:', input.userId);
    
    let currentUserId: number | null = null;
    const authHeader = ctx.req.headers.get('authorization');
    
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        currentUserId = parseInt(decoded.userId);
      } catch {
        console.log('[tRPC] Invalid token, treating as guest');
      }
    }
    
    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, is_private')
      .eq('id', input.userId)
      .single();

    if (userError || !targetUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    if (targetUser.is_private) {
      if (!currentUserId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'This profile is private. Follow the user to see their content.',
        });
      }

      if (currentUserId !== targetUser.id) {
        const { data: following } = await supabaseAdmin
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUser.id)
          .single();

        if (!following) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'This profile is private. Follow the user to see their content.',
          });
        }
      }
    }
    
    const { data: screenshots, error } = await supabaseAdmin
      .from('screenshots')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('user_id', input.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[tRPC] Error fetching screenshots:', error);
      throw new Error(`Failed to fetch screenshots: ${error.message}`);
    }

    console.log('[tRPC] Found screenshots:', screenshots?.length || 0);

    const formattedScreenshots = await Promise.all(screenshots?.map(async (screenshot: any) => {
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
        imageUrl: screenshot.image_url,
        thumbnailUrl: screenshot.thumbnail_url,
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
    }) || []);

    return formattedScreenshots;
  });
