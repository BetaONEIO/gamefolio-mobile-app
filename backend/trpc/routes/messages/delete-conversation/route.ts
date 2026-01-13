import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { gamefolioMessages } from '@/lib/gamefolio-api';

const deleteConversationRoute = protectedProcedure
  .input(z.object({
    userId: z.number(),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[Messages] Deleting conversation with user:', input.userId, 'by user:', ctx.userId);
    
    try {
      const result = await gamefolioMessages.deleteConversation(ctx.accessToken, input.userId);
      console.log('[Messages] Conversation deleted successfully via Gamefolio API');
      return { success: result.success, userId: input.userId };
    } catch (error) {
      console.error('[Messages] Error deleting conversation via Gamefolio:', error);
      return { success: false, userId: input.userId };
    }
  });

export default deleteConversationRoute;
