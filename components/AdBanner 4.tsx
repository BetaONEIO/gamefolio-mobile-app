import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Linking,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ExternalLink, X, Sparkles } from 'lucide-react-native';
import { Image } from 'expo-image';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type AdSize = 'banner' | 'medium' | 'large';
export type AdPlacement = 'feed' | 'between-content' | 'bottom';

interface AdData {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  ctaText: string;
  ctaUrl: string;
  advertiser: string;
  sponsored?: boolean;
}

interface AdBannerProps {
  size?: AdSize;
  placement?: AdPlacement;
  onAdLoaded?: () => void;
  onAdError?: (error: string) => void;
  onAdClicked?: (adId: string) => void;
  style?: object;
  testMode?: boolean;
}

const PLACEHOLDER_ADS: AdData[] = [
  {
    id: 'placeholder-1',
    title: 'Level Up Your Gaming Setup',
    description: 'Premium gaming gear for serious players',
    imageUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=800&h=400&fit=crop',
    ctaText: 'Shop Now',
    ctaUrl: 'https://example.com',
    advertiser: 'Gaming Gear Co',
    sponsored: true,
  },
  {
    id: 'placeholder-2',
    title: 'Stream Like a Pro',
    description: 'Everything you need to start streaming today',
    imageUrl: 'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=800&h=400&fit=crop',
    ctaText: 'Learn More',
    ctaUrl: 'https://example.com',
    advertiser: 'StreamTech',
    sponsored: true,
  },
  {
    id: 'placeholder-3',
    title: 'Join the Community',
    description: 'Connect with millions of gamers worldwide',
    imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop',
    ctaText: 'Join Free',
    ctaUrl: 'https://example.com',
    advertiser: 'GameConnect',
    sponsored: true,
  },
];

const getAdDimensions = (size: AdSize) => {
  switch (size) {
    case 'banner':
      return { height: 60, aspectRatio: undefined };
    case 'medium':
      return { height: 120, aspectRatio: undefined };
    case 'large':
      return { height: 200, aspectRatio: undefined };
    default:
      return { height: 120, aspectRatio: undefined };
  }
};

export default function AdBanner({
  size = 'medium',
  placement = 'feed',
  onAdLoaded,
  onAdError,
  onAdClicked,
  style,
  testMode = true,
}: AdBannerProps) {
  const [currentAd, setCurrentAd] = useState<AdData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAd();
  }, []);

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
  }, [isLoading]);

  const loadAd = async () => {
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const randomAd = PLACEHOLDER_ADS[Math.floor(Math.random() * PLACEHOLDER_ADS.length)];
      setCurrentAd(randomAd);
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      onAdLoaded?.();
      console.log('[AdBanner] Ad loaded:', randomAd.id);
    } catch (error) {
      console.error('[AdBanner] Failed to load ad:', error);
      onAdError?.('Failed to load advertisement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdClick = async () => {
    if (!currentAd) return;
    
    console.log('[AdBanner] Ad clicked:', currentAd.id);
    onAdClicked?.(currentAd.id);
    
    if (currentAd.ctaUrl && currentAd.ctaUrl !== 'https://example.com') {
      try {
        await Linking.openURL(currentAd.ctaUrl);
      } catch (error) {
        console.error('[AdBanner] Failed to open URL:', error);
      }
    }
  };

  const handleDismiss = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsDismissed(true);
    });
  };

  if (isDismissed) {
    return null;
  }

  const dimensions = getAdDimensions(size);

  if (isLoading) {
    return (
      <View style={[styles.container, { height: dimensions.height }, style]}>
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={styles.loadingContainer}
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
      </View>
    );
  }

  if (!currentAd) {
    return null;
  }

  if (size === 'banner') {
    return (
      <Animated.View style={[styles.container, { opacity: fadeAnim }, style]}>
        <TouchableOpacity
          style={styles.bannerContainer}
          onPress={handleAdClick}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#1E293B', '#0F172A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bannerGradient}
          >
            <View style={styles.bannerContent}>
              <View style={styles.bannerLeft}>
                <View style={styles.sponsoredBadge}>
                  <Sparkles size={10} color="#FCD34D" />
                  <Text style={styles.sponsoredText}>Sponsored</Text>
                </View>
                <Text style={styles.bannerTitle} numberOfLines={1}>
                  {currentAd.title}
                </Text>
              </View>
              <TouchableOpacity style={styles.bannerCta} onPress={handleAdClick}>
                <Text style={styles.bannerCtaText}>{currentAd.ctaText}</Text>
                <ExternalLink size={12} color="#002E15" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
              <X size={14} color="#64748B" />
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }, style]}>
      <TouchableOpacity
        style={[styles.adCard, { height: dimensions.height }]}
        onPress={handleAdClick}
        activeOpacity={0.95}
      >
        <Image
          source={{ uri: currentAd.imageUrl }}
          style={styles.adImage}
          contentFit="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
          style={styles.adOverlay}
        >
          <View style={styles.adContent}>
            <View style={styles.adHeader}>
              <View style={styles.sponsoredBadge}>
                <Sparkles size={10} color="#FCD34D" />
                <Text style={styles.sponsoredText}>Sponsored</Text>
              </View>
              <Text style={styles.advertiserText}>{currentAd.advertiser}</Text>
            </View>
            <Text style={styles.adTitle} numberOfLines={2}>
              {currentAd.title}
            </Text>
            {size === 'large' && (
              <Text style={styles.adDescription} numberOfLines={2}>
                {currentAd.description}
              </Text>
            )}
            <TouchableOpacity style={styles.ctaButton} onPress={handleAdClick}>
              <Text style={styles.ctaText}>{currentAd.ctaText}</Text>
              <ExternalLink size={14} color="#002E15" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
        <TouchableOpacity style={styles.dismissButtonOverlay} onPress={handleDismiss}>
          <X size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#334155',
    borderRadius: 12,
  },
  bannerContainer: {
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
    borderRadius: 12,
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flex: 1,
    marginRight: 12,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginTop: 2,
  },
  bannerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  bannerCtaText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#002E15',
  },
  adCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  adImage: {
    ...StyleSheet.absoluteFillObject,
  },
  adOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 16,
  },
  adContent: {
    gap: 8,
  },
  adHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sponsoredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  sponsoredText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#FCD34D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  advertiserText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  adTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  adDescription: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#4ADE80',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#002E15',
  },
  dismissButton: {
    padding: 8,
    marginLeft: 8,
  },
  dismissButtonOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 6,
  },
});
