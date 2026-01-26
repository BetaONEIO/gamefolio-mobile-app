import { protectedProcedure } from "../../../create-context";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { TRPCError } from "@trpc/server";

export default protectedProcedure
  .input(
    z.object({
      token: z.string().min(1),
      platform: z.enum(['ios', 'android', 'web']),
    })
  )
  .mutation(async ({ input, ctx }) => {
    console.log('[tRPC] Registering push token for user:', ctx.userId, 'platform:', input.platform);
    
    const { data: existingToken } = await supabaseAdmin
      .from('push_tokens')
      .select('id')
      .eq('user_id', ctx.userId)
      .eq('token', input.token)
      .single();

    if (existingToken) {
      const { error: updateError } = await supabaseAdmin
        .from('push_tokens')
        .update({
          platform: input.platform,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingToken.id);

      if (updateError) {
        console.error('[tRPC] Error updating push token:', updateError);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update push token',
        });
      }

      console.log('[tRPC] Push token updated');
      return { success: true, updated: true };
    }

    await supabaseAdmin
      .from('push_tokens')
      .delete()
      .eq('user_id', ctx.userId)
      .eq('platform', input.platform);

    const { error: insertError } = await supabaseAdmin
      .from('push_tokens')
      .insert({
        user_id: ctx.userId,
        token: input.token,
        platform: input.platform,
      });

    if (insertError) {
      console.error('[tRPC] Error inserting push token:', insertError);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to register push token',
      });
    }

    console.log('[tRPC] Push token registered successfully');
    return { success: true, updated: false };
  });
