import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(
    z.object({
      screenshotId: z.number(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    console.log('[tRPC] Deleting screenshot:', input.screenshotId, 'user:', ctx.userId);
    
    const { data: screenshot, error: fetchError } = await supabaseAdmin
      .from('screenshots')
      .select('id, user_id')
      .eq('id', input.screenshotId)
      .single();

    if (fetchError || !screenshot) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Screenshot not found',
      });
    }

    if (screenshot.user_id !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only delete your own screenshots',
      });
    }

    await supabaseAdmin
      .from('screenshot_likes')
      .delete()
      .eq('screenshot_id', input.screenshotId);

    await supabaseAdmin
      .from('screenshot_comments')
      .delete()
      .eq('screenshot_id', input.screenshotId);

    await supabaseAdmin
      .from('screenshot_reactions')
      .delete()
      .eq('screenshot_id', input.screenshotId);

    const { error: deleteError } = await supabaseAdmin
      .from('screenshots')
      .delete()
      .eq('id', input.screenshotId);

    if (deleteError) {
      console.error('[tRPC] Error deleting screenshot:', deleteError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete screenshot',
      });
    }

    return {
      message: 'Screenshot deleted successfully',
    };
  });
