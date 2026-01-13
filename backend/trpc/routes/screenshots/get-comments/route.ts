import { publicProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export default publicProcedure
  .input(
    z.object({
      screenshotId: z.number(),
    })
  )
  .query(async ({ input }) => {
    console.log('[tRPC] Fetching comments for screenshot:', input.screenshotId);
    
    const { data: comments, error } = await supabaseAdmin
      .from('screenshot_comments')
      .select(`
        *,
        user:users!inner(id, username, display_name, avatar_url)
      `)
      .eq('screenshot_id', input.screenshotId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[tRPC] Error fetching comments:', error);
      throw new Error(`Failed to fetch comments: ${error.message}`);
    }

    console.log('[tRPC] Found comments:', comments?.length || 0);

    const formattedComments = comments?.map((comment: any) => ({
      id: comment.id,
      screenshotId: comment.screenshot_id,
      userId: comment.user_id,
      content: comment.content,
      parentId: comment.parent_id,
      createdAt: comment.created_at,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        displayName: comment.user.display_name,
        avatarUrl: comment.user.avatar_url,
      }
    })) || [];

    return formattedComments;
  });
