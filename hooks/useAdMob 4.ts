import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { getAdUnitId } from '@/constants/admob';

let InterstitialAd: any = null;
let RewardedAd: any = null;
let AdEventType: any = null;
let RewardedAdEventType: any = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const GoogleMobileAds = require('react-native-google-mobile-ads');
    InterstitialAd = GoogleMobileAds.InterstitialAd;
    RewardedAd = GoogleMobileAds.RewardedAd;
    AdEventType = GoogleMobileAds.AdEventType;
    RewardedAdEventType = GoogleMobileAds.RewardedAdEventType;
  } catch {
    console.log('[useAdMob] react-native-google-mobile-ads not available');
  }
}

interface UseInterstitialAdOptions {
  useTestAds?: boolean;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: any) => void;
  onAdClosed?: () => void;
  onAdOpened?: () => void;
}

interface UseRewardedAdOptions {
  useTestAds?: boolean;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: any) => void;
  onAdClosed?: () => void;
  onAdOpened?: () => void;
  onRewarded?: (reward: { type: string; amount: number }) => void;
}

export function useInterstitialAd(options: UseInterstitialAdOptions = {}) {
  const {
    useTestAds = false,
    onAdLoaded,
    onAdFailedToLoad,
    onAdClosed,
    onAdOpened,
  } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const adRef = useRef<any>(null);

  const adUnitId = getAdUnitId('INTERSTITIAL', useTestAds);

  const loadAd = useCallback(() => {
    if (Platform.OS === 'web' || !InterstitialAd) {
      console.log('[useInterstitialAd] Not available on this platform');
      return;
    }

    if (isLoading || isLoaded) {
      console.log('[useInterstitialAd] Ad already loading or loaded');
      return;
    }

    console.log('[useInterstitialAd] Loading interstitial ad...');
    setIsLoading(true);

    const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribeLoaded = interstitial.addAdEventListener(
      AdEventType.LOADED,
      () => {
        console.log('[useInterstitialAd] Ad loaded');
        setIsLoaded(true);
        setIsLoading(false);
        onAdLoaded?.();
      }
    );

    const unsubscribeError = interstitial.addAdEventListener(
      AdEventType.ERROR,
      (error: any) => {
        console.error('[useInterstitialAd] Ad failed to load:', error);
        setIsLoading(false);
        setIsLoaded(false);
        onAdFailedToLoad?.(error);
      }
    );

    const unsubscribeClosed = interstitial.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log('[useInterstitialAd] Ad closed');
        setIsLoaded(false);
        onAdClosed?.();
        loadAd();
      }
    );

    const unsubscribeOpened = interstitial.addAdEventListener(
      AdEventType.OPENED,
      () => {
        console.log('[useInterstitialAd] Ad opened');
        onAdOpened?.();
      }
    );

    adRef.current = {
      interstitial,
      unsubscribers: [unsubscribeLoaded, unsubscribeError, unsubscribeClosed, unsubscribeOpened],
    };

    interstitial.load();
  }, [adUnitId, isLoading, isLoaded, onAdLoaded, onAdFailedToLoad, onAdClosed, onAdOpened]);

  const showAd = useCallback(async () => {
    if (!isLoaded || !adRef.current?.interstitial) {
      console.log('[useInterstitialAd] Ad not ready to show');
      return false;
    }

    try {
      await adRef.current.interstitial.show();
      return true;
    } catch (error) {
      console.error('[useInterstitialAd] Failed to show ad:', error);
      return false;
    }
  }, [isLoaded]);

  useEffect(() => {
    return () => {
      if (adRef.current?.unsubscribers) {
        adRef.current.unsubscribers.forEach((unsub: () => void) => unsub());
      }
    };
  }, []);

  return {
    isLoaded,
    isLoading,
    loadAd,
    showAd,
  };
}

export function useRewardedAd(options: UseRewardedAdOptions = {}) {
  const {
    useTestAds = false,
    onAdLoaded,
    onAdFailedToLoad,
    onAdClosed,
    onAdOpened,
    onRewarded,
  } = options;

  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const adRef = useRef<any>(null);

  const adUnitId = getAdUnitId('REWARDED', useTestAds);

  const loadAd = useCallback(() => {
    if (Platform.OS === 'web' || !RewardedAd) {
      console.log('[useRewardedAd] Not available on this platform');
      return;
    }

    if (isLoading || isLoaded) {
      console.log('[useRewardedAd] Ad already loading or loaded');
      return;
    }

    console.log('[useRewardedAd] Loading rewarded ad...');
    setIsLoading(true);

    const rewarded = RewardedAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: false,
    });

    const unsubscribeLoaded = rewarded.addAdEventListener(
      RewardedAdEventType.LOADED,
      () => {
        console.log('[useRewardedAd] Ad loaded');
        setIsLoaded(true);
        setIsLoading(false);
        onAdLoaded?.();
      }
    );

    const unsubscribeError = rewarded.addAdEventListener(
      AdEventType.ERROR,
      (error: any) => {
        console.error('[useRewardedAd] Ad failed to load:', error);
        setIsLoading(false);
        setIsLoaded(false);
        onAdFailedToLoad?.(error);
      }
    );

    const unsubscribeClosed = rewarded.addAdEventListener(
      AdEventType.CLOSED,
      () => {
        console.log('[useRewardedAd] Ad closed');
        setIsLoaded(false);
        onAdClosed?.();
        loadAd();
      }
    );

    const unsubscribeOpened = rewarded.addAdEventListener(
      AdEventType.OPENED,
      () => {
        console.log('[useRewardedAd] Ad opened');
        onAdOpened?.();
      }
    );

    const unsubscribeRewarded = rewarded.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      (reward: { type: string; amount: number }) => {
        console.log('[useRewardedAd] User earned reward:', reward);
        onRewarded?.(reward);
      }
    );

    adRef.current = {
      rewarded,
      unsubscribers: [
        unsubscribeLoaded,
        unsubscribeError,
        unsubscribeClosed,
        unsubscribeOpened,
        unsubscribeRewarded,
      ],
    };

    rewarded.load();
  }, [adUnitId, isLoading, isLoaded, onAdLoaded, onAdFailedToLoad, onAdClosed, onAdOpened, onRewarded]);

  const showAd = useCallback(async () => {
    if (!isLoaded || !adRef.current?.rewarded) {
      console.log('[useRewardedAd] Ad not ready to show');
      return false;
    }

    try {
      await adRef.current.rewarded.show();
      return true;
    } catch (error) {
      console.error('[useRewardedAd] Failed to show ad:', error);
      return false;
    }
  }, [isLoaded]);

  useEffect(() => {
    return () => {
      if (adRef.current?.unsubscribers) {
        adRef.current.unsubscribers.forEach((unsub: () => void) => unsub());
      }
    };
  }, []);

  return {
    isLoaded,
    isLoading,
    loadAd,
    showAd,
  };
}
