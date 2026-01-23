import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";
import { sendPushNotification } from "../../../../lib/push-notifications";

export default protectedProcedure
  .input(
    z.object({
      screenshotId: z.number(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    console.log('[tRPC] Toggling like for screenshot:', input.screenshotId, 'user:', ctx.userId);
    
    const { data: existingLike } = await supabaseAdmin
      .from('screenshot_likes')
      .select('id')
      .eq('screenshot_id', input.screenshotId)
      .eq('user_id', ctx.userId)
      .single();

    if (existingLike) {
      const { error: deleteError } = await supabaseAdmin
        .from('screenshot_likes')
        .delete()
        .eq('id', existingLike.id);

      if (deleteError) {
        console.error('[tRPC] Error removing like:', deleteError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove like',
        });
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('screenshot_likes')
        .insert({
          screenshot_id: input.screenshotId,
          user_id: ctx.userId,
        });

      if (insertError) {
        console.error('[tRPC] Error adding like:', insertError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add like',
        });
      }
    }

    const { count } = await supabaseAdmin
      .from('screenshot_likes')
      .select('*', { count: 'exact', head: true })
      .eq('screenshot_id', input.screenshotId);

    if (!existingLike) {
      const { data: screenshot } = await supabaseAdmin
        .from('screenshots')
        .select('user_id, title')
        .eq('id', input.screenshotId)
        .single();

      if (screenshot && screenshot.user_id !== ctx.userId) {
        const { data: liker } = await supabaseAdmin
          .from('users')
          .select('username')
          .eq('id', ctx.userId)
          .single();

        sendPushNotification(
          screenshot.user_id,
          'New Like! ❤️',
          `${liker?.username || 'Someone'} liked your screenshot${screenshot.title ? `: ${screenshot.title}` : ''}`,
          { type: 'like', contentType: 'screenshot', contentId: input.screenshotId }
        ).catch(err => console.error('[Notifications] Failed to send like notification:', err));
      }
    }

    return {
      hasLiked: !existingLike,
      count: count || 0,
    };
  });
