import { protectedProcedure } from "../../../create-context";
import { gamefolioMessages } from '@/lib/gamefolio-api';

const getConversationsRoute = protectedProcedure.query(async ({ ctx }) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[Messages/getConversations] Starting query');
  console.log('[Messages/getConversations] User ID:', ctx.userId);
  console.log('[Messages/getConversations] Timestamp:', new Date().toISOString());
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  try {
    const conversations = await gamefolioMessages.getConversations(ctx.accessToken);
    console.log('[Messages] Returning', conversations.length, 'conversations from Gamefolio API');
    return conversations;
  } catch (error) {
    console.error('[Messages] Error fetching conversations from Gamefolio:', error);
    throw error;
  }
});

export default getConversationsRoute;
