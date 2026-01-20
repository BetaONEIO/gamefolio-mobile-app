import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";

export default protectedProcedure
  .input(
    z.object({
      isOnline: z.boolean(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    console.log('[tRPC] Updating online status for user:', ctx.userId, 'status:', input.isOnline);
    
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        is_online: input.isOnline,
        last_active: new Date().toISOString(),
      })
      .eq('id', ctx.userId);

    if (error) {
      console.error('[tRPC] Error updating online status:', error);
      throw new Error(`Failed to update online status: ${error.message}`);
    }

    console.log('[tRPC] Online status updated successfully');

    return { success: true };
  });
