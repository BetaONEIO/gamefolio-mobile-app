import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(
    z.object({
      clipId: z.number(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    console.log('[tRPC] Deleting clip:', input.clipId, 'user:', ctx.userId);
    
    const { data: clip, error: fetchError } = await supabaseAdmin
      .from('clips')
      .select('id, user_id')
      .eq('id', input.clipId)
      .single();

    if (fetchError || !clip) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Clip not found',
      });
    }

    if (clip.user_id !== ctx.userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You can only delete your own clips',
      });
    }

    await supabaseAdmin
      .from('likes')
      .delete()
      .eq('clip_id', input.clipId);

    await supabaseAdmin
      .from('comments')
      .delete()
      .eq('clip_id', input.clipId);

    await supabaseAdmin
      .from('reactions')
      .delete()
      .eq('clip_id', input.clipId);

    const { error: deleteError } = await supabaseAdmin
      .from('clips')
      .delete()
      .eq('id', input.clipId);

    if (deleteError) {
      console.error('[tRPC] Error deleting clip:', deleteError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete clip',
      });
    }

    return {
      message: 'Clip deleted successfully',
    };
  });
