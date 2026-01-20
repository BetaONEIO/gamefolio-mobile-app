import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(
    z.object({
      screenshotId: z.number(),
      emoji: z.string().default("🔥"),
    })
  )
  .mutation(async ({ input, ctx }) => {
    console.log('[tRPC] Toggling fire reaction for screenshot:', input.screenshotId, 'user:', ctx.userId);
    
    const { data: existingReaction } = await supabaseAdmin
      .from('screenshot_reactions')
      .select('id')
      .eq('screenshot_id', input.screenshotId)
      .eq('user_id', ctx.userId)
      .eq('emoji', input.emoji)
      .single();

    if (existingReaction) {
      const { error: deleteError } = await supabaseAdmin
        .from('screenshot_reactions')
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
        .from('screenshot_reactions')
        .insert({
          screenshot_id: input.screenshotId,
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
      .from('screenshot_reactions')
      .select('*', { count: 'exact', head: true })
      .eq('screenshot_id', input.screenshotId)
      .eq('emoji', input.emoji);

    return {
      hasFired: !existingReaction,
      count: count || 0,
    };
  });
