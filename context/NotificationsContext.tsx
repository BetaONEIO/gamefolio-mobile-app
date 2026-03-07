import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as ExpoNotifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { trpc } from '@/lib/trpc';
import { api, Notification } from '@/lib/api';

ExpoNotifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface PushTokens {
  expoToken: string | null;
  deviceToken: string | null;
}

async function registerForPushNotificationsAsync(): Promise<PushTokens> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform - skipping push registration');
    return { expoToken: null, deviceToken: null };
  }

  if (!Device.isDevice) {
    console.log('[Notifications] Must use physical device for push notifications');
    return { expoToken: null, deviceToken: null };
  }

  try {
    const { status: existingStatus } = await ExpoNotifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('[Notifications] Requesting permission...');
      const { status } = await ExpoNotifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return { expoToken: null, deviceToken: null };
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    
    if (!projectId) {
      console.log('[Notifications] No project ID found, using default');
    }

    const expoTokenData = await ExpoNotifications.getExpoPushTokenAsync({
      projectId: projectId || process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    console.log('[Notifications] Expo push token:', expoTokenData.data);

    const deviceTokenData = await ExpoNotifications.getDevicePushTokenAsync();
    console.log('[Notifications] Native device token (use this in Firebase):', deviceTokenData.data);

    if (Platform.OS === 'android') {
      await ExpoNotifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: ExpoNotifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      });
    }

    return { 
      expoToken: expoTokenData.data, 
      deviceToken: deviceTokenData.data as string 
    };
  } catch (error) {
    console.error('[Notifications] Error getting push token:', error);
    return { expoToken: null, deviceToken: null };
  }
}

let nextLocalId = -1;

function pushDataToNotification(data: Record<string, any>, title?: string, body?: string): Notification {
  const id = nextLocalId--;
  return {
    id,
    userId: 0,
    type: data?.type || 'like',
    title: title || '',
    message: body || title || '',
    isRead: false,
    createdAt: new Date().toISOString(),
    fromUserId: data?.fromUserId ? Number(data.fromUserId) : undefined,
    clipId: data?.clipId ? Number(data.clipId) : undefined,
    screenshotId: data?.screenshotId ? Number(data.screenshotId) : undefined,
    commentId: data?.commentId ? Number(data.commentId) : undefined,
    actionUrl: data?.actionUrl,
    fromUser: data?.fromUserId ? {
      id: Number(data.fromUserId),
      username: data?.username || '',
      avatarUrl: data?.avatarUrl || '',
    } : undefined,
  };
}

export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [devicePushToken, setDevicePushToken] = useState<string | null>(null);
  const [lastPushNotification, setLastPushNotification] = useState<ExpoNotifications.Notification | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const notificationListener = useRef<ExpoNotifications.EventSubscription | null>(null);
  const responseListener = useRef<ExpoNotifications.EventSubscription | null>(null);
  const { isAuthenticated, user, authTokens } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const registerTokenMutation = trpc.notifications.registerToken.useMutation();
  const registerTokenRef = useRef(registerTokenMutation);
  registerTokenRef.current = registerTokenMutation;

  const authTokenRef = useRef(authTokens?.accessToken);
  authTokenRef.current = authTokens?.accessToken;

  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  const userRef = useRef(user);
  userRef.current = user;

  const registerToken = useCallback(async (token: string) => {
    if (!isAuthenticatedRef.current || !userRef.current) {
      console.log('[Notifications] Not authenticated, skipping token registration');
      return;
    }

    try {
      console.log('[Notifications] Registering push token with backend...');
      await registerTokenRef.current.mutateAsync({
        token,
        platform: Platform.OS as 'ios' | 'android' | 'web',
      });
      console.log('[Notifications] Push token registered successfully');
    } catch (error) {
      console.error('[Notifications] Failed to register push token:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    const token = authTokenRef.current;
    if (!token) return;
    try {
      const [list, count] = await Promise.all([
        api.notifications.list(token),
        api.notifications.unreadCount(token),
      ]);
      setNotifications(list);
      setUnreadCount(count > 0 ? count : list.filter(n => !n.isRead).length);
    } catch {
      console.log('[Notifications] Failed to fetch notifications from API');
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    const token = authTokenRef.current;
    if (token) {
      api.notifications.markAllRead(token);
    }
  }, []);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    const token = authTokenRef.current;
    if (token) {
      api.notifications.clearAll(token);
    }
  }, []);

  const removeNotification = useCallback(async (id: number) => {
    setNotifications(prev => {
      const removed = prev.find(n => n.id === id);
      const updated = prev.filter(n => n.id !== id);
      if (removed && !removed.isRead) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return updated;
    });
    const token = authTokenRef.current;
    if (token && id > 0) {
      api.notifications.delete(id, token);
    }
  }, []);

  const markRead = useCallback(async (id: number) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
    setUnreadCount(c => Math.max(0, c - 1));
    const token = authTokenRef.current;
    if (token && id > 0) {
      api.notifications.markRead(id, token);
    }
  }, []);

  const initializedRef = useRef(false);

  const initialize = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    console.log('[Notifications] Initializing...');

    const tokens = await registerForPushNotificationsAsync();
    if (tokens.expoToken) {
      setExpoPushToken(tokens.expoToken);
      await registerToken(tokens.expoToken);
    }
    if (tokens.deviceToken) {
      setDevicePushToken(tokens.deviceToken);
      console.log('[Notifications] ========================================');
      console.log('[Notifications] DEVICE TOKEN FOR FIREBASE CONSOLE:');
      console.log('[Notifications]', tokens.deviceToken);
      console.log('[Notifications] ========================================');
    }

    const permResult = await ExpoNotifications.getPermissionsAsync();
    setPermissionStatus(permResult.status);

    notificationListener.current = ExpoNotifications.addNotificationReceivedListener(
      (receivedNotification: ExpoNotifications.Notification) => {
        console.log('[Notifications] Received:', receivedNotification);
        setLastPushNotification(receivedNotification);
        
        const data = receivedNotification.request.content.data;
        const title = receivedNotification.request.content.title ?? undefined;
        const body = receivedNotification.request.content.body ?? undefined;
        if (data) {
          const newNotif = pushDataToNotification(data, title, body);
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(c => c + 1);
        }
      }
    );

    responseListener.current = ExpoNotifications.addNotificationResponseReceivedListener(
      (receivedResponse: ExpoNotifications.NotificationResponse) => {
        console.log('[Notifications] User interacted with notification:', receivedResponse);
        const data = receivedResponse.notification.request.content.data;
        
        if (data?.type === 'like' || data?.type === 'fire' || data?.type === 'comment') {
          console.log('[Notifications] Navigation data:', data);
        }
      }
    );
  }, [registerToken]);

  useEffect(() => {
    if (isAuthenticated) {
      initialize();
      fetchNotifications();
    } else {
      initializedRef.current = false;
      setNotifications([]);
      setUnreadCount(0);
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated, initialize, fetchNotifications]);

  useEffect(() => {
    if (isAuthenticated && expoPushToken) {
      registerToken(expoPushToken);
    }
  }, [isAuthenticated, expoPushToken, registerToken]);

  const requestPermission = useCallback(async () => {
    const tokens = await registerForPushNotificationsAsync();
    if (tokens.expoToken) {
      setExpoPushToken(tokens.expoToken);
      await registerToken(tokens.expoToken);
    }
    if (tokens.deviceToken) {
      setDevicePushToken(tokens.deviceToken);
    }
    const permResult = await ExpoNotifications.getPermissionsAsync();
    setPermissionStatus(permResult.status);
    return permResult.status === 'granted';
  }, [registerToken]);

  const clearBadge = useCallback(async () => {
    await ExpoNotifications.setBadgeCountAsync(0);
  }, []);

  return {
    expoPushToken,
    devicePushToken,
    notification: lastPushNotification,
    permissionStatus,
    requestPermission,
    clearBadge,
    notifications,
    unreadCount,
    markAllRead,
    clearAll,
    removeNotification,
    markRead,
    fetchNotifications,
  };
});
