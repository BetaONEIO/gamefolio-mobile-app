import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { gamefolioMessages } from '@/lib/gamefolio-api';

const deleteMessageRoute = protectedProcedure
  .input(z.object({
    messageId: z.number(),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[Messages] Deleting message:', input.messageId, 'by user:', ctx.userId);
    
    try {
      const result = await gamefolioMessages.deleteMessage(ctx.accessToken, input.messageId);
      console.log('[Messages] Message deleted successfully via Gamefolio API');
      return { success: result.success, messageId: input.messageId };
    } catch (error) {
      console.error('[Messages] Error deleting message via Gamefolio:', error);
      throw error;
    }
  });

export default deleteMessageRoute;
