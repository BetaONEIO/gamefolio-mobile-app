import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  isRegistering: boolean;
  error: string | null;
}

export function usePushNotifications(isAuthenticated: boolean) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const hasRegisteredRef = useRef<boolean>(false);

  const { getAccessToken } = useAuth();

  const registerForPushNotifications = useCallback(async () => {
    if (Platform.OS === 'web') {
      console.log('[PushNotifications] Push notifications not supported on web');
      return null;
    }

    if (!Device.isDevice) {
      console.log('[PushNotifications] Push notifications require a physical device');
      setError('Push notifications require a physical device');
      return null;
    }

    setIsRegistering(true);
    setError(null);

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('[PushNotifications] Requesting permission...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[PushNotifications] Permission not granted');
        setError('Permission not granted for push notifications');
        return null;
      }

      console.log('[PushNotifications] Permission granted, getting token...');
      
      const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      
      if (!projectId) {
        console.log('[PushNotifications] No project ID found, using default');
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId || undefined,
      });

      const token = tokenData.data;
      console.log('[PushNotifications] Got push token:', token.slice(0, 30) + '...');
      
      setExpoPushToken(token);

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B35',
        });
      }

      return token;
    } catch (err) {
      console.error('[PushNotifications] Error registering:', err);
      setError(err instanceof Error ? err.message : 'Failed to register for push notifications');
      return null;
    } finally {
      setIsRegistering(false);
    }
  }, []);

  const registerTokenWithBackend = useCallback(async (token: string) => {
    if (hasRegisteredRef.current) {
      console.log('[PushNotifications] Already registered this session');
      return;
    }

    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    
    console.log('[PushNotifications] Registering token with backend, platform:', platform);
    
    try {
      const authToken = await getAccessToken();
      if (!authToken) {
        console.log('[PushNotifications] No auth token available');
        return;
      }
      await api.pushTokens.register(
        { token, platform: platform as 'ios' | 'android' | 'web' },
        authToken
      );
      hasRegisteredRef.current = true;
      console.log('[PushNotifications] Token registered with backend');
    } catch (err) {
      console.error('[PushNotifications] Failed to register token with backend:', err);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!isAuthenticated) {
      hasRegisteredRef.current = false;
      return;
    }

    if (Platform.OS === 'web') {
      return;
    }

    const initPushNotifications = async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await registerTokenWithBackend(token);
      }
    };

    initPushNotifications();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[PushNotifications] Notification received:', notification.request.content.title);
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[PushNotifications] Notification response:', response.notification.request.content.data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [isAuthenticated, registerForPushNotifications, registerTokenWithBackend]);

  return {
    expoPushToken,
    notification,
    isRegistering,
    error,
    registerForPushNotifications,
  };
}
