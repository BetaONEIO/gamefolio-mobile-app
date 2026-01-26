import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { gamefolioMessages } from '@/lib/gamefolio-api';

const getMessagesRoute = protectedProcedure
  .input(z.object({
    userId: z.number(),
  }))
  .query(async ({ ctx, input }) => {
    console.log('[Messages] Getting messages between user:', ctx.userId, 'and:', input.userId);
    
    try {
      const messages = await gamefolioMessages.getMessages(ctx.accessToken, input.userId);
      console.log('[Messages] Found', messages.length, 'messages from Gamefolio API');
      return messages;
    } catch (error) {
      console.error('[Messages] Error fetching messages from Gamefolio:', error);
      throw error;
    }
  });

export default getMessagesRoute;
