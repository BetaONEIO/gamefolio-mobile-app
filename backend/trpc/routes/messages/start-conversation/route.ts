import { z } from "zod";
import { protectedProcedure } from "../../../create-context";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from '@/lib/supabase';

const startConversationRoute = protectedProcedure
  .input(z.object({
    username: z.string().min(1),
    content: z.string().min(1).max(2000),
  }))
  .mutation(async ({ ctx, input }) => {
    console.log('[Messages] Starting conversation with:', input.username, 'from user:', ctx.userId);
    
    try {
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('id, username, display_name, avatar_url')
        .eq('username', input.username)
        .single();

      if (userError || !user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      const { data: message, error: messageError } = await supabaseAdmin
        .from('messages')
        .insert({
          sender_id: ctx.userId,
          receiver_id: user.id,
          content: input.content,
          is_read: false,
        })
        .select('id, content, sender_id, receiver_id, created_at, is_read')
        .single();

      if (messageError || !message) {
        console.error('[Messages] Error creating message:', messageError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to send message',
        });
      }

      console.log('[Messages] Conversation started successfully');
      return {
        message: {
          id: message.id,
          content: message.content,
          senderId: message.sender_id,
          receiverId: message.receiver_id,
          createdAt: message.created_at,
          isRead: message.is_read,
        },
        conversation: {
          id: message.id,
          recipientId: user.id,
          recipient: {
            id: user.id,
            username: user.username,
            displayName: user.display_name || user.username,
            avatarUrl: user.avatar_url,
          },
          lastMessage: {
            id: message.id,
            content: message.content,
            senderId: message.sender_id,
            createdAt: message.created_at,
          },
          unreadCount: 0,
          updatedAt: message.created_at,
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      console.error('[Messages] Unexpected error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      });
    }
  });

export default startConversationRoute;
