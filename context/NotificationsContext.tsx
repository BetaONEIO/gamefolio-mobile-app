import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { trpc } from '@/lib/trpc';

Notifications.setNotificationHandler({
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
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('[Notifications] Requesting permission...');
      const { status } = await Notifications.requestPermissionsAsync();
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

    // Get Expo push token (for Expo push service)
    const expoTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    console.log('[Notifications] Expo push token:', expoTokenData.data);

    // Get native device token (for Firebase Console)
    const deviceTokenData = await Notifications.getDevicePushTokenAsync();
    console.log('[Notifications] Native device token (use this in Firebase):', deviceTokenData.data);

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
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

export const [NotificationsProvider, useNotifications] = createContextHook(() => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [devicePushToken, setDevicePushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const { isAuthenticated, user } = useAuth();

  const registerTokenMutation = trpc.notifications.registerToken.useMutation();

  const registerToken = useCallback(async (token: string) => {
    if (!isAuthenticated || !user) {
      console.log('[Notifications] Not authenticated, skipping token registration');
      return;
    }

    try {
      console.log('[Notifications] Registering push token with backend...');
      await registerTokenMutation.mutateAsync({
        token,
        platform: Platform.OS as 'ios' | 'android' | 'web',
      });
      console.log('[Notifications] Push token registered successfully');
    } catch (error) {
      console.error('[Notifications] Failed to register push token:', error);
    }
  }, [isAuthenticated, user, registerTokenMutation]);

  const initialize = useCallback(async () => {
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

    const permResult = await Notifications.getPermissionsAsync();
    setPermissionStatus(permResult.status);

    notificationListener.current = Notifications.addNotificationReceivedListener(
      (receivedNotification: Notifications.Notification) => {
        console.log('[Notifications] Received:', receivedNotification);
        setNotification(receivedNotification);
      }
    );

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (receivedResponse: Notifications.NotificationResponse) => {
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
    }

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated, initialize]);

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
    const permResult = await Notifications.getPermissionsAsync();
    setPermissionStatus(permResult.status);
    return permResult.status === 'granted';
  }, [registerToken]);

  const clearBadge = useCallback(async () => {
    await Notifications.setBadgeCountAsync(0);
  }, []);

  return {
    expoPushToken,
    devicePushToken,
    notification,
    permissionStatus,
    requestPermission,
    clearBadge,
  };
});
