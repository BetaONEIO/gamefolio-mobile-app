import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Video } from 'lucide-react-native';
import { Env } from '@/constants/Env';

interface HeroTextData {
  title: string;
  subtitle: string;
  buttonText: string;
  buttonUrl: string;
  targetAudience: string;
  isActive: boolean;
  backgroundUrl?: string;
  backgroundType?: 'image' | 'gif' | 'video';
}

export default function HeroBanner() {
  const router = useRouter();

  const { data: heroData, isLoading, error } = useQuery<HeroTextData>({
    queryKey: ['hero-text', 'experienced'],
    queryFn: async () => {
      console.log('[HeroBanner] Fetching hero text from API...');
      const response = await fetch(`${Env.BACKEND_URL}/api/hero-text/experienced`);
      
      if (!response.ok) {
        console.log('[HeroBanner] API request failed, using fallback');
        throw new Error('Failed to fetch hero text');
      }
      
      const data = await response.json();
      console.log('[HeroBanner] Received hero data:', data);
      return data;
    },
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    retry: 1,
  });

  const handleButtonPress = useCallback(() => {
    const data = heroData?.isActive ? heroData : { buttonUrl: '/upload' };
    const buttonUrl = data.buttonUrl || '/upload';
    console.log('[HeroBanner] Button pressed, navigating to:', buttonUrl);
    
    if (buttonUrl === '/upload' || buttonUrl === '/(drawer)/(tabs)/create') {
      router.push('/(drawer)/(tabs)/create');
    } else if (buttonUrl.startsWith('/')) {
      router.push(buttonUrl as any);
    }
  }, [heroData, router]);

  const renderTitle = useCallback((title: string) => {
    const lines = title.split('\\n');
    return lines.map((line, index) => (
      <Text key={index} style={styles.heroTitle}>
        {line}
      </Text>
    ));
  }, []);

  // Use fallback data if API fails or returns no data
  const fallbackData: HeroTextData = {
    title: 'Build Your Gamefolio',
    subtitle: 'Upload, discover, and share epic gaming clips with the community',
    buttonText: 'Start Building Now',
    buttonUrl: '/upload',
    targetAudience: 'experienced_users',
    isActive: true,
  };

  const displayData = heroData?.isActive ? heroData : fallbackData;
  const backgroundUrl = displayData.backgroundUrl || 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&auto=format&fit=crop&q=80';

  // Show loading skeleton
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingTitle} />
          <View style={styles.loadingSubtitle} />
          <View style={styles.loadingButton} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: backgroundUrl }}
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.7)']}
          locations={[0, 0.5, 1]}
          style={styles.gradient}
        >
          <View style={styles.contentContainer}>
            <View style={styles.titleContainer}>
              {renderTitle(displayData.title)}
            </View>
            
            <Text style={styles.heroSubtitle}>{displayData.subtitle}</Text>
            
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleButtonPress}
              activeOpacity={0.85}
            >
              <Video size={18} color="#002E15" />
              <Text style={styles.ctaButtonText}>{displayData.buttonText}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 380,
    marginBottom: 24,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
    ...Platform.select({
      ios: {
        shadowColor: '#4ADE80',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImageStyle: {
    borderRadius: 24,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    borderRadius: 24,
  },
  contentContainer: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#4ADE80',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
    paddingHorizontal: 8,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#4ADE80',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#002E15',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    gap: 16,
  },
  loadingTitle: {
    width: 200,
    height: 32,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  loadingSubtitle: {
    width: 280,
    height: 20,
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  loadingButton: {
    width: 160,
    height: 44,
    backgroundColor: '#334155',
    borderRadius: 14,
    marginTop: 12,
  },
});
