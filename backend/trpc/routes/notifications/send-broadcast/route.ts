import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";
import { sendBroadcastNotification, sendBulkPushNotifications } from "../../../../lib/push-notifications";

export default protectedProcedure
  .input(
    z.object({
      title: z.string().min(1).max(100),
      body: z.string().min(1).max(500),
      data: z.record(z.string(), z.unknown()).optional(),
      targetUserIds: z.array(z.number()).optional(),
    })
  )
  .mutation(async ({ input, ctx }) => {
    console.log('[tRPC] Send broadcast notification requested by user:', ctx.userId);

    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('users')
      .select('is_admin')
      .eq('id', ctx.userId)
      .single();

    if (adminError || !adminUser?.is_admin) {
      console.log('[tRPC] User is not admin, denying broadcast');
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only admins can send broadcast notifications',
      });
    }

    let result: { sent: number; failed: number };

    if (input.targetUserIds && input.targetUserIds.length > 0) {
      console.log('[tRPC] Sending to specific users:', input.targetUserIds.length);
      result = await sendBulkPushNotifications(
        input.targetUserIds,
        input.title,
        input.body,
        input.data
      );
    } else {
      console.log('[tRPC] Broadcasting to all users');
      result = await sendBroadcastNotification(input.title, input.body, input.data);
    }

    console.log('[tRPC] Broadcast complete:', result);
    return result;
  });
