import { z } from "zod";
import { protectedProcedure } from "../../../create-context";

const unblockUserRoute = protectedProcedure
  .input(z.object({
    userId: z.number(),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[Users] Unblocking user:', input.userId, 'by user:', ctx.userId);
    
    return { success: true, unblockedUserId: input.userId };
  });

export default unblockUserRoute;
