import { supabaseAdmin } from "@/lib/supabase";

interface PushMessage {
  to: string;
  sound?: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export async function sendPushNotification(
  userId: number,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<boolean> {
  console.log('[PushNotifications] Sending to user:', userId);

  try {
    const { data: tokens, error } = await supabaseAdmin
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (error || !tokens || tokens.length === 0) {
      console.log('[PushNotifications] No push tokens found for user:', userId);
      return false;
    }

    const messages: PushMessage[] = tokens.map(t => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json() as { data: PushTicket[] };
    console.log('[PushNotifications] Expo response:', result);

    const failedTokens: string[] = [];
    result.data.forEach((ticket, index) => {
      if (ticket.status === 'error') {
        console.error('[PushNotifications] Error for token:', messages[index].to, ticket.message);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          failedTokens.push(messages[index].to);
        }
      }
    });

    if (failedTokens.length > 0) {
      console.log('[PushNotifications] Removing invalid tokens:', failedTokens.length);
      await supabaseAdmin
        .from('push_tokens')
        .delete()
        .in('token', failedTokens);
    }

    return true;
  } catch (error) {
    console.error('[PushNotifications] Failed to send:', error);
    return false;
  }
}

export async function sendBulkPushNotifications(
  userIds: number[],
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  console.log('[PushNotifications] Sending bulk to users:', userIds.length);

  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const success = await sendPushNotification(userId, title, body, data);
    if (success) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

export async function sendBroadcastNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<{ sent: number; failed: number }> {
  console.log('[PushNotifications] Broadcasting to all users');

  try {
    const { data: tokens, error } = await supabaseAdmin
      .from('push_tokens')
      .select('token, user_id');

    if (error || !tokens || tokens.length === 0) {
      console.log('[PushNotifications] No push tokens found');
      return { sent: 0, failed: 0 };
    }

    const messages: PushMessage[] = tokens.map(t => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

    const chunks: PushMessage[][] = [];
    const chunkSize = 100;
    for (let i = 0; i < messages.length; i += chunkSize) {
      chunks.push(messages.slice(i, i + chunkSize));
    }

    let sent = 0;
    let failed = 0;
    const failedTokens: string[] = [];

    for (const chunk of chunks) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });

        const result = await response.json() as { data: PushTicket[] };

        result.data.forEach((ticket, index) => {
          if (ticket.status === 'ok') {
            sent++;
          } else {
            failed++;
            if (ticket.details?.error === 'DeviceNotRegistered') {
              failedTokens.push(chunk[index].to);
            }
          }
        });
      } catch (error) {
        console.error('[PushNotifications] Chunk send failed:', error);
        failed += chunk.length;
      }
    }

    if (failedTokens.length > 0) {
      await supabaseAdmin
        .from('push_tokens')
        .delete()
        .in('token', failedTokens);
    }

    console.log('[PushNotifications] Broadcast complete:', { sent, failed });
    return { sent, failed };
  } catch (error) {
    console.error('[PushNotifications] Broadcast failed:', error);
    return { sent: 0, failed: 0 };
  }
}
