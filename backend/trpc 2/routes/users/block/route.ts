import { z } from "zod";
import { protectedProcedure } from "../../../create-context";

const blockUserRoute = protectedProcedure
  .input(z.object({
    userId: z.number(),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[Users] Blocking user:', input.userId, 'by user:', ctx.userId);
    
    return { success: true, blockedUserId: input.userId };
  });

export default blockUserRoute;
