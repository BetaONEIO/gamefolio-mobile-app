import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/context/AuthContext';

export function useOnlineStatus() {
  const { isAuthenticated } = useAuth();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  
  const updateOnlineStatusMutation = trpc.user.updateOnlineStatus.useMutation();
  const { mutate: updateStatusMutation } = updateOnlineStatusMutation;

  const updateStatus = useCallback((isOnline: boolean) => {
    updateStatusMutation({ isOnline });
  }, [updateStatusMutation]);

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
