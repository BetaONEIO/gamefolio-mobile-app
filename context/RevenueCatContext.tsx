import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from './AuthContext';

function getRCToken() {
  if (__DEV__ || Platform.OS === 'web') return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY,
  });
}

let isConfigured = false;

export const [RevenueCatProvider, useRevenueCat] = createContextHook(() => {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [backendProStatus, setBackendProStatus] = useState<{
    isPro: boolean;
    proSubscriptionType: 'yearly' | 'monthly' | null;
  }>({ isPro: false, proSubscriptionType: null });
  
  const { user, authTokens, getAccessToken, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const loginToRevenueCat = useCallback(async (userId: string) => {
    if (Platform.OS === 'web') return;
    try {
      console.log('[RevenueCat] Logging in user:', userId);
      const { customerInfo: info } = await Purchases.logIn(userId);
      setCustomerInfo(info);
      console.log('[RevenueCat] User logged in successfully');
      return info;
    } catch (error) {
      console.error('[RevenueCat] Login error:', error);
    }
  }, []);

  const logoutFromRevenueCat = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      console.log('[RevenueCat] Logging out user');
      const info = await Purchases.logOut();
      setCustomerInfo(info);
      setBackendProStatus({ isPro: false, proSubscriptionType: null });
      console.log('[RevenueCat] User logged out successfully');
    } catch (error) {
      console.error('[RevenueCat] Logout error:', error);
    }
  }, []);

  useEffect(() => {
    const initRC = async () => {
      try {
        const apiKey = getRCToken();
        if (!apiKey) {
          console.log('[RevenueCat] No API key configured for this platform');
          setIsReady(true);
          return;
        }

        if (Platform.OS === 'web') {
          console.log('[RevenueCat] Web platform - limited functionality');
          setIsReady(true);
          return;
        }

        if (!isConfigured) {
          console.log('[RevenueCat] Configuring with API key');
          await Purchases.configure({ apiKey });
          isConfigured = true;
        }

        console.log('[RevenueCat] Fetching customer info');
        const info = await Purchases.getCustomerInfo();
        setCustomerInfo(info);
        setIsReady(true);
        console.log('[RevenueCat] Initialized successfully');
      } catch (error) {
        console.error('[RevenueCat] Initialization error:', error);
        setIsReady(true);
      }
    };

    initRC();
  }, []);

  useEffect(() => {
    if (!isReady || !user?.id) return;
    
    const userId = String(user.id);
    loginToRevenueCat(userId);
  }, [isReady, user?.id, loginToRevenueCat]);

  useEffect(() => {
    if (!user) {
      logoutFromRevenueCat();
    }
  }, [user, logoutFromRevenueCat]);

  const backendProQuery = useQuery({
    queryKey: ['subscription', 'status', user?.id, user?.isPro],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      
      // First try the subscription status endpoint
      try {
        const status = await api.subscription.getStatus(token);
        console.log('[RevenueCat] Backend Pro status from /api/subscription/status:', status);
        return status;
      } catch (error) {
        console.log('[RevenueCat] Backend Pro status fetch failed, trying /api/user...', error);
      }
      
      // Fallback: fetch fresh user data from /api/user
      try {
        const userData = await api.auth.getUser(token);
        console.log('[RevenueCat] User data from /api/user:', userData);
        if (userData?.user?.isPro) {
          // Update the user in AuthContext with fresh data
          updateUser({ isPro: true });
          return { 
            isPro: true, 
            proSubscriptionType: null, 
            proSubscriptionStartDate: null, 
            proSubscriptionEndDate: null 
          };
        }
      } catch (userError) {
        console.log('[RevenueCat] /api/user fetch also failed:', userError);
      }
      
      // Final fallback: check stored user data
      if (user?.isPro) {
        return { isPro: true, proSubscriptionType: null, proSubscriptionStartDate: null, proSubscriptionEndDate: null };
      }
      return null;
    },
    enabled: !!user && !!authTokens,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (backendProQuery.data) {
      setBackendProStatus({
        isPro: backendProQuery.data.isPro,
        proSubscriptionType: backendProQuery.data.proSubscriptionType,
      });
    } else if (user?.isPro) {
      setBackendProStatus({ isPro: true, proSubscriptionType: null });
    }
  }, [backendProQuery.data, user?.isPro]);

  const offeringsQuery = useQuery({
    queryKey: ['revenuecat', 'offerings'],
    queryFn: async () => {
      if (Platform.OS === 'web') {
        console.log('[RevenueCat] Offerings not available on web');
        return null;
      }
      console.log('[RevenueCat] Fetching offerings');
      const offerings = await Purchases.getOfferings();
      console.log('[RevenueCat] Offerings fetched:', offerings);
      return offerings;
    },
    enabled: isReady && Platform.OS !== 'web',
    staleTime: 1000 * 60 * 5,
  });

  const syncSubscriptionMutation = useMutation({
    mutationFn: async (data: { isPro: boolean; subscriptionType: 'yearly' | 'monthly' | null }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No auth token');
      return api.subscription.sync(token, data);
    },
    onSuccess: (response) => {
      console.log('[RevenueCat] Subscription synced to backend');
      if (response.user) {
        updateUser({ isPro: response.user.isPro });
      }
      queryClient.invalidateQueries({ queryKey: ['subscription', 'status'] });
    },
    onError: (error) => {
      console.error('[RevenueCat] Failed to sync subscription to backend:', error);
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      console.log('[RevenueCat] Purchasing package:', pkg.identifier);
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      return { info, packageId: pkg.identifier };
    },
    onSuccess: ({ info, packageId }) => {
      console.log('[RevenueCat] Purchase successful');
      setCustomerInfo(info);
      
      const hasProEntitlement = info.entitlements.active['pro'] !== undefined;
      if (hasProEntitlement) {
        const subscriptionType = packageId.toLowerCase().includes('year') ? 'yearly' as const : 'monthly' as const;
        console.log('[RevenueCat] Syncing Pro subscription to backend:', subscriptionType);
        syncSubscriptionMutation.mutate({ isPro: true, subscriptionType });
      }
    },
    onError: (error: any) => {
      console.error('[RevenueCat] Purchase error:', error);
      if (error?.userCancelled) {
        console.log('[RevenueCat] User cancelled purchase');
      }
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      console.log('[RevenueCat] Restoring purchases');
      const info = await Purchases.restorePurchases();
      return info;
    },
    onSuccess: (info) => {
      console.log('[RevenueCat] Restore successful');
      setCustomerInfo(info);
      
      const hasProEntitlement = info.entitlements.active['pro'] !== undefined;
      if (hasProEntitlement) {
        console.log('[RevenueCat] Syncing restored Pro subscription to backend');
        syncSubscriptionMutation.mutate({ isPro: true, subscriptionType: 'monthly' });
      }
    },
    onError: (error) => {
      console.error('[RevenueCat] Restore error:', error);
    },
  });

  const rcIsPro = customerInfo?.entitlements.active['pro'] !== undefined;
  const isPro = rcIsPro || backendProStatus.isPro || user?.isPro === true;
  const proSubscriptionType = backendProStatus.proSubscriptionType;

  const refreshProStatus = useCallback(async () => {
    console.log('[RevenueCat] Refreshing Pro status from all sources');
    
    if (Platform.OS !== 'web') {
      try {
        const info = await Purchases.getCustomerInfo();
        setCustomerInfo(info);
      } catch (error) {
        console.error('[RevenueCat] Failed to refresh customer info:', error);
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ['subscription', 'status'] });
  }, [queryClient]);

  const managementURL = customerInfo?.managementURL || null;

  return {
    customerInfo,
    isPro,
    proSubscriptionType,
    managementURL,
    isReady,
    offerings: offeringsQuery.data,
    isLoadingOfferings: offeringsQuery.isLoading,
    purchasePackage: async (pkg: PurchasesPackage) => {
      const result = await purchaseMutation.mutateAsync(pkg);
      return result.info;
    },
    isPurchasing: purchaseMutation.isPending,
    restorePurchases: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
    syncSubscription: syncSubscriptionMutation.mutate,
    isSyncing: syncSubscriptionMutation.isPending,
    refreshProStatus,
    loginToRevenueCat,
    logoutFromRevenueCat,
  };
});
