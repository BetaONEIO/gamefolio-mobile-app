import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Platform,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Video, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Env } from '@/constants/Env';
import { useAuth } from '@/context/AuthContext';
import { useRevenueCat } from '@/context/RevenueCatContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HeroSlide {
  id: number;
  title: string;
  subtitle: string | null;
  buttonText: string | null;
  buttonLink: string | null;
  imageUrl: string;
  displayOrder: number;
  isActive: boolean;
  visibility: string;
  textAlign: string;
}

const FALLBACK_SLIDES: HeroSlide[] = [
  {
    id: 0,
    title: 'Welcome Back, Gamers',
    subtitle: 'Upload, discover, and share epic gaming clips with the community',
    buttonText: 'Start Building Now',
    buttonLink: '/upload',
    imageUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1200&auto=format&fit=crop&q=80',
    displayOrder: 0,
    isActive: true,
    visibility: 'everyone',
    textAlign: 'center',
  },
];

interface HeroBannerProps {
  contentPadding?: number;
  canOpenLootbox?: boolean;
  onOpenLootbox?: () => void;
}

const PRO_UPGRADE_LINKS = ['/pro', '/subscribe', '/premium', '/manage-subscription', '/(drawer)/manage-subscription'];

const LOOTBOX_SLIDE: HeroSlide = {
  id: -1,
  title: 'Your Daily Lootbox is Ready!',
  subtitle: 'A free reward is waiting for you. Tap to claim it now!',
  buttonText: 'Claim Now',
  buttonLink: '_lootbox',
  imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200&auto=format&fit=crop&q=80',
  displayOrder: -1,
  isActive: true,
  visibility: 'everyone',
  textAlign: 'center',
};

export default function HeroBanner({ contentPadding = 16, canOpenLootbox = false, onOpenLootbox }: HeroBannerProps) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [currentSlide, setCurrentSlide] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { getAccessToken } = useAuth();
  const { isPro } = useRevenueCat();

  const { data: slides, isLoading } = useQuery<HeroSlide[]>({
    queryKey: ['/api/hero-slides'],
    queryFn: async () => {
      const token = await getAccessToken().catch(() => null);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${Env.BACKEND_URL}/api/hero-slides`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch hero slides');
      return res.json();
    },
    staleTime: 1000 * 60,
    retry: 1,
  });

  const { data: settings } = useQuery<{ intervalSeconds: number }>({
    queryKey: ['/api/hero-slides/settings'],
    queryFn: async () => {
      const res = await fetch(`${Env.BACKEND_URL}/api/hero-slides/settings`);
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const rawSlides = (slides && slides.length > 0) ? slides : FALLBACK_SLIDES;
  const filteredSlides = isPro
    ? rawSlides.filter(s => !PRO_UPGRADE_LINKS.some(l => s.buttonLink?.startsWith(l)))
    : rawSlides;
  const activeSlides = canOpenLootbox ? [LOOTBOX_SLIDE, ...filteredSlides] : filteredSlides;
  const intervalMs = ((settings?.intervalSeconds) || 6) * 1000;

  const goToSlide = useCallback((idx: number) => {
    setCurrentSlide(idx);
    if (timerRef.current) clearInterval(timerRef.current);
    if (activeSlides.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
      }, intervalMs);
    }
  }, [activeSlides.length, intervalMs]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (activeSlides.length > 1) {
      timerRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
      }, intervalMs);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeSlides.length, intervalMs]);

  useEffect(() => {
    if (currentSlide >= activeSlides.length) setCurrentSlide(0);
  }, [activeSlides.length, currentSlide]);

  const handleButtonPress = useCallback((slide: HeroSlide) => {
    const link = slide.buttonLink || '/upload';
    if (link === '_lootbox') {
      onOpenLootbox?.();
    } else if (link === '/upload' || link === '/(drawer)/(tabs)/create') {
      router.push('/(drawer)/(tabs)/create');
    } else if (link === '/pro' || link === '/subscribe' || link === '/premium') {
      router.push('/(drawer)/manage-subscription' as any);
    } else if (link.startsWith('/')) {
      router.push(link as any);
    }
  }, [router, onOpenLootbox]);

  const slide = activeSlides[Math.min(currentSlide, activeSlides.length - 1)];
  const isCenter = slide.textAlign === 'center';

  const containerStyle = {
    width: screenWidth,
    marginLeft: -contentPadding,
    marginRight: -contentPadding,
  };

  if (isLoading) {
    return (
      <View style={[styles.container, containerStyle, styles.loadingContainer]}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingTitle} />
          <View style={styles.loadingSubtitle} />
          <View style={styles.loadingButton} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      <ImageBackground
        source={{ uri: slide.imageUrl }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.75)']}
          locations={[0, 0.5, 1]}
          style={styles.gradient}
        >
          <View style={[styles.contentContainer, isCenter && styles.contentCenter]}>
            <Text style={[styles.heroTitle, isCenter && styles.textCenter]} numberOfLines={3}>
              {slide.title}
            </Text>

            {slide.subtitle ? (
              <Text style={[styles.heroSubtitle, isCenter && styles.textCenter]} numberOfLines={2}>
                {slide.subtitle}
              </Text>
            ) : null}

            {slide.buttonText ? (
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => handleButtonPress(slide)}
                activeOpacity={0.85}
              >
                <Video size={16} color="#002E15" />
                <Text style={styles.ctaButtonText}>{slide.buttonText}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Nav arrows — only shown when > 1 slide */}
          {activeSlides.length > 1 ? (
            <>
              <TouchableOpacity
                style={[styles.navArrow, styles.navArrowLeft]}
                onPress={() => goToSlide((currentSlide - 1 + activeSlides.length) % activeSlides.length)}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.navArrow, styles.navArrowRight]}
                onPress={() => goToSlide((currentSlide + 1) % activeSlides.length)}
                activeOpacity={0.7}
              >
                <ChevronRight size={20} color="#FFF" />
              </TouchableOpacity>
            </>
          ) : null}

          {/* Dot indicators */}
          {activeSlides.length > 1 ? (
            <View style={styles.dotsRow}>
              {activeSlides.map((_, i) => (
                <TouchableOpacity key={i} onPress={() => goToSlide(i)} activeOpacity={0.8}>
                  <View style={[styles.dot, i === currentSlide && styles.dotActive]} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </LinearGradient>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 300,
    marginBottom: 16,
    overflow: 'hidden',
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 16,
  },
  contentContainer: {
    alignItems: 'center',
    maxWidth: SCREEN_WIDTH - 80,
  },
  contentCenter: {
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: SCREEN_WIDTH - 40,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 28,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4ADE80',
    lineHeight: 17,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  textCenter: {
    textAlign: 'center',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 7,
    ...Platform.select({
      ios: {
        shadowColor: '#4ADE80',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  ctaButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#002E15',
    letterSpacing: 0.3,
  },
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowLeft: {
    left: 10,
  },
  navArrowRight: {
    right: 10,
  },
  dotsRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#4ADE80',
  },
  loadingContainer: {
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    gap: 10,
  },
  loadingTitle: {
    width: 180,
    height: 24,
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  loadingSubtitle: {
    width: 240,
    height: 16,
    backgroundColor: '#334155',
    borderRadius: 4,
  },
  loadingButton: {
    width: 140,
    height: 36,
    backgroundColor: '#334155',
    borderRadius: 10,
    marginTop: 8,
  },
});
