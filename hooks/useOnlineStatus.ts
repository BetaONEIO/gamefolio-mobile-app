import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

export function useOnlineStatus() {
  const { isAuthenticated, getAccessToken } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const updateStatus = useCallback(async (isOnline: boolean) => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      await api.users.updateProfile(0, { isOnline }, token);
    } catch (err) {
      console.error('[OnlineStatus] Failed to update status:', err);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('[OnlineStatus] Setting up online status tracking');
    
    updateStatus(true);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('[OnlineStatus] App state changed:', appStateRef.current, '->', nextAppState);
      
      const wasInactive = appStateRef.current.match(/inactive|background/);
      const isActive = nextAppState === 'active';
      
      if (wasInactive && isActive) {
        console.log('[OnlineStatus] App became active, setting online');
        updateStatus(true);
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[OnlineStatus] App went to background, setting offline');
        updateStatus(false);
      }
      
      appStateRef.current = nextAppState;
    });

    return () => {
      console.log('[OnlineStatus] Cleaning up, setting offline');
      updateStatus(false);
      subscription.remove();
    };
  }, [isAuthenticated, updateStatus]);
}
