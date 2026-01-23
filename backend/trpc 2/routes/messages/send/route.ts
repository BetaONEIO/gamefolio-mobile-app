import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { gamefolioMessages } from '@/lib/gamefolio-api';

const sendMessageRoute = protectedProcedure
  .input(z.object({
    receiverId: z.number(),
    content: z.string().min(1).max(2000),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[Messages] Sending message from user:', ctx.userId, 'to:', input.receiverId);
    
    try {
      const message = await gamefolioMessages.send(ctx.accessToken, input.receiverId, input.content);
      console.log('[Messages] Message sent successfully via Gamefolio API:', message.id);
      return message;
    } catch (error) {
      console.error('[Messages] Error sending message via Gamefolio:', error);
      throw error;
    }
  });

export default sendMessageRoute;
