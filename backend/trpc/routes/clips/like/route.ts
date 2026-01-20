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
    console.log('[tRPC] Toggling like for clip:', input.clipId, 'user:', ctx.userId);
    
    const { data: existingLike } = await supabaseAdmin
      .from('likes')
      .select('id')
      .eq('clip_id', input.clipId)
      .eq('user_id', ctx.userId)
      .single();

    if (existingLike) {
      const { error: deleteError } = await supabaseAdmin
        .from('likes')
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
        .from('likes')
        .insert({
          clip_id: input.clipId,
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
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('clip_id', input.clipId);

    return {
      hasLiked: !existingLike,
      count: count || 0,
    };
  });
