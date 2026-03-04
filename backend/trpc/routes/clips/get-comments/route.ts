import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSignedUrl } from "@/backend/lib/signed-urls";

export default publicProcedure
  .input(
    z.object({
      clipId: z.string(),
    })
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Fetching comments for clip:', input.clipId);
    
    const { data: comments, error } = await supabaseAdmin
      .from('comments')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url)
      `)
      .eq('clip_id', parseInt(input.clipId))
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[tRPC] Error fetching comments:', error);
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    console.log('[tRPC] Found comments:', comments?.length || 0);

    const formattedComments = await Promise.all((comments || []).map(async (comment: any) => ({
      id: comment.id,
      clipId: comment.clip_id,
      userId: comment.user_id,
      content: comment.content,
      createdAt: comment.created_at,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        displayName: comment.user.display_name,
        avatarUrl: await generateSignedUrl(comment.user.avatar_url),
      }
    })));

    return formattedComments;
  });
