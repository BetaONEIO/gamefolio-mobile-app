import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";
import { sendPushNotification } from "../../../../lib/push-notifications";

export default protectedProcedure
  .input(
    z.object({
      screenshotId: z.number(),
      content: z.string().min(1).max(1000),
      parentId: z.number().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    console.log('[tRPC] Adding comment to screenshot:', input.screenshotId, 'user:', ctx.userId);
    
    const { data: comment, error } = await supabaseAdmin
      .from('screenshot_comments')
      .insert({
        screenshot_id: input.screenshotId,
        user_id: ctx.userId,
        content: input.content,
        parent_id: input.parentId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[tRPC] Error adding comment:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to add comment',
      });
    }

    const { data: screenshot } = await supabaseAdmin
      .from('screenshots')
      .select('user_id, title')
      .eq('id', input.screenshotId)
      .single();

    if (screenshot && screenshot.user_id !== ctx.userId) {
      const { data: commenter } = await supabaseAdmin
        .from('users')
        .select('username')
        .eq('id', ctx.userId)
        .single();

      sendPushNotification(
        screenshot.user_id,
        'New Comment! 💬',
        `${commenter?.username || 'Someone'} commented: "${input.content.slice(0, 50)}${input.content.length > 50 ? '...' : ''}"`,
        { type: 'comment', contentType: 'screenshot', contentId: input.screenshotId, commentId: comment.id }
      ).catch(err => console.error('[Notifications] Failed to send comment notification:', err));
    }

    return {
      id: comment.id,
      content: comment.content,
      userId: comment.user_id,
      screenshotId: comment.screenshot_id,
      parentId: comment.parent_id,
      createdAt: comment.created_at,
    };
  });
