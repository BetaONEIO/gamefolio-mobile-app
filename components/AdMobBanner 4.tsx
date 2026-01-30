import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAdUnitId } from '@/constants/admob';

let BannerAd: any = null;
let BannerAdSize: any = null;

if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const GoogleMobileAds = require('react-native-google-mobile-ads');
    BannerAd = GoogleMobileAds.BannerAd;
    BannerAdSize = GoogleMobileAds.BannerAdSize;
  } catch {
    console.log('[AdMobBanner] react-native-google-mobile-ads not available');
  }
}

export type AdMobBannerSize = 'banner' | 'largeBanner' | 'mediumRectangle' | 'fullBanner' | 'leaderboard' | 'adaptive';

interface AdMobBannerProps {
  size?: AdMobBannerSize;
  useTestAds?: boolean;
  onAdLoaded?: () => void;
  onAdFailedToLoad?: (error: any) => void;
  onAdOpened?: () => void;
  onAdClosed?: () => void;
  style?: object;
}

const getBannerAdSize = (size: AdMobBannerSize) => {
  if (!BannerAdSize) return null;
  
  switch (size) {
    case 'banner':
      return BannerAdSize.BANNER;
    case 'largeBanner':
      return BannerAdSize.LARGE_BANNER;
    case 'mediumRectangle':
      return BannerAdSize.MEDIUM_RECTANGLE;
    case 'fullBanner':
      return BannerAdSize.FULL_BANNER;
    case 'leaderboard':
      return BannerAdSize.LEADERBOARD;
    case 'adaptive':
      return BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
    default:
      return BannerAdSize.BANNER;
  }
};

const getBannerHeight = (size: AdMobBannerSize): number => {
  switch (size) {
    case 'banner':
      return 50;
    case 'largeBanner':
      return 100;
    case 'mediumRectangle':
      return 250;
    case 'fullBanner':
      return 60;
    case 'leaderboard':
      return 90;
    case 'adaptive':
      return 60;
    default:
      return 50;
  }
};

export default function AdMobBanner({
  size = 'banner',
  useTestAds = false,
  onAdLoaded,
  onAdFailedToLoad,
  onAdOpened,
  onAdClosed,
  style,
}: AdMobBannerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const adUnitId = getAdUnitId('BANNER', useTestAds);
  const bannerHeight = getBannerHeight(size);

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    
    if (isLoading) {
      shimmerLoop.start();
    } else {
      shimmerLoop.stop();
    }

    return () => shimmerLoop.stop();
  }, [isLoading, shimmerAnim]);

  const handleAdLoaded = () => {
    console.log('[AdMobBanner] Ad loaded successfully');
    setIsLoading(false);
    setHasError(false);
    
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    onAdLoaded?.();
  };

  const handleAdFailedToLoad = (error: any) => {
    console.error('[AdMobBanner] Ad failed to load:', error);
    setIsLoading(false);
    setHasError(true);
    onAdFailedToLoad?.(error);
  };

  if (Platform.OS === 'web' || !BannerAd) {
    return (
      <View style={[styles.container, { height: bannerHeight }, style]}>
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={styles.placeholderContainer}
        >
          <Text style={styles.placeholderText}>Ad Space</Text>
        </LinearGradient>
      </View>
    );
  }

  if (hasError) {
    return null;
  }

  const bannerAdSize = getBannerAdSize(size);

  return (
    <View style={[styles.container, { minHeight: bannerHeight }, style]}>
      {isLoading && (
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={[styles.loadingContainer, { height: bannerHeight }]}
        >
          <Animated.View
            style={[
              styles.shimmer,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.6],
                }),
              },
            ]}
          />
        </LinearGradient>
      )}
      <Animated.View style={{ opacity: fadeAnim }}>
        <BannerAd
          unitId={adUnitId}
          size={bannerAdSize}
          requestOptions={{
            requestNonPersonalizedAdsOnly: false,
          }}
          onAdLoaded={handleAdLoaded}
          onAdFailedToLoad={handleAdFailedToLoad}
          onAdOpened={onAdOpened}
          onAdClosed={onAdClosed}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  loadingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  placeholderContainer: {
    flex: 1,
    width: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  placeholderText: {
    fontSize: 12,
    color: '#64748B',
  },
});
