import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect } from 'react';
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import { useQuery, useMutation } from '@tanstack/react-query';

function getRCToken() {
  if (Platform.OS === 'web') return null;
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: null,
  });
}

let isConfigured = false;

export const [RevenueCatProvider, useRevenueCat] = createContextHook(() => {
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initRC = async () => {
      try {
        if (Platform.OS === 'web') {
          console.log('[RevenueCat] Skipping on web platform');
          setIsReady(true);
          return;
        }

        const apiKey = getRCToken();
        if (!apiKey) {
          console.log('[RevenueCat] No API key configured for this platform');
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

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: PurchasesPackage) => {
      console.log('[RevenueCat] Purchasing package:', pkg.identifier);
      const { customerInfo: info } = await Purchases.purchasePackage(pkg);
      return info;
    },
    onSuccess: (info) => {
      console.log('[RevenueCat] Purchase successful');
      setCustomerInfo(info);
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
    },
    onError: (error) => {
      console.error('[RevenueCat] Restore error:', error);
    },
  });

  const isPro = customerInfo?.entitlements.active['pro'] !== undefined;

  return {
    customerInfo,
    isPro,
    isReady,
    offerings: offeringsQuery.data,
    isLoadingOfferings: offeringsQuery.isLoading,
    purchasePackage: purchaseMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    restorePurchases: restoreMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
  };
});
