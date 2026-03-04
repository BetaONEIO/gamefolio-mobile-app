import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";
import jwt from 'jsonwebtoken';
import { Env } from '@/constants/Env';
import { generateSignedUrl } from "@/backend/lib/signed-urls";

const JWT_SECRET = Env.JWT_SECRET;

export default publicProcedure
  .input(
    z.object({
      userId: z.number(),
    })
  )
  .query(async ({ input, ctx }) => {
    console.log('[tRPC] Fetching clips for user:', input.userId);
    
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
    
    const { data: clips, error } = await supabaseAdmin
      .from('clips')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url),
        game:games(id, name, image_url, twitch_id)
      `)
      .eq('user_id', input.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[tRPC] Error fetching clips:', error);
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
    }) || []);

    return formattedClips;
  });
