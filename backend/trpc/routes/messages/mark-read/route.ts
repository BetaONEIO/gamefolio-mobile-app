import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { gamefolioMessages } from '@/lib/gamefolio-api';

const markReadRoute = protectedProcedure
  .input(z.object({
    userId: z.number(),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[Messages] Marking messages as read from user:', input.userId, 'to user:', ctx.userId);
    
    try {
      const result = await gamefolioMessages.markRead(ctx.accessToken, input.userId);
      console.log('[Messages] Messages marked as read via Gamefolio API');
      return { success: result.success };
    } catch (error) {
      console.error('[Messages] Error marking messages as read via Gamefolio:', error);
      return { success: false };
    }
  });

export default markReadRoute;
