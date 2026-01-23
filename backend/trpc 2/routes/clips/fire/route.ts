import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";
import { sendPushNotification } from "../../../../lib/push-notifications";

export default protectedProcedure
  .input(
    z.object({
      clipId: z.number(),
      emoji: z.string().default("🔥"),
    })
  )
  .mutation(async ({ input, ctx }) => {
    console.log('[tRPC] Toggling fire reaction for clip:', input.clipId, 'user:', ctx.userId);
    
    const { data: existingReaction } = await supabaseAdmin
      .from('reactions')
      .select('id')
      .eq('clip_id', input.clipId)
      .eq('user_id', ctx.userId)
      .eq('emoji', input.emoji)
      .single();

    if (existingReaction) {
      const { error: deleteError } = await supabaseAdmin
        .from('reactions')
        .delete()
        .eq('id', existingReaction.id);

      if (deleteError) {
        console.error('[tRPC] Error removing reaction:', deleteError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove reaction',
        });
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from('reactions')
        .insert({
          clip_id: input.clipId,
          user_id: ctx.userId,
          emoji: input.emoji,
        });

      if (insertError) {
        console.error('[tRPC] Error adding reaction:', insertError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add reaction',
        });
      }
    }

    const { count } = await supabaseAdmin
      .from('reactions')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', input.clipId)
      .eq('emoji', input.emoji);

    if (!existingReaction) {
      const { data: clip } = await supabaseAdmin
        .from('clips')
        .select('user_id, title')
        .eq('id', input.clipId)
        .single();

      if (clip && clip.user_id !== ctx.userId) {
        const { data: reactor } = await supabaseAdmin
          .from('users')
          .select('username')
          .eq('id', ctx.userId)
          .single();

        sendPushNotification(
          clip.user_id,
          'Your clip is on fire! 🔥',
          `${reactor?.username || 'Someone'} reacted to your clip${clip.title ? `: ${clip.title}` : ''}`,
          { type: 'fire', contentType: 'clip', contentId: input.clipId }
        ).catch(err => console.error('[Notifications] Failed to send fire notification:', err));
      }
    }

    return {
      hasFired: !existingReaction,
      count: count || 0,
    };
  });
