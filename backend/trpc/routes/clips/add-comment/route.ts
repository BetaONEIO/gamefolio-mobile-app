import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(
    z.object({
      clipId: z.number(),
      content: z.string().min(1).max(1000),
      parentId: z.number().optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    console.log('[tRPC] Adding comment to clip:', input.clipId, 'user:', ctx.userId);
    
    const { data: comment, error } = await supabaseAdmin
      .from('comments')
      .insert({
        clip_id: input.clipId,
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

    return {
      id: comment.id,
      content: comment.content,
      userId: comment.user_id,
      clipId: comment.clip_id,
      parentId: comment.parent_id,
      createdAt: comment.created_at,
    };
  });
