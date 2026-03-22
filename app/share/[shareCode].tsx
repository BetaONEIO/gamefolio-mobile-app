import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-video';
import { ArrowLeft, Play, Camera, Film, Eye } from 'lucide-react-native';
import { api } from '@/lib/api';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SharedContent =
  | { type: 'clip'; data: any }
  | { type: 'reel'; data: any }
  | { type: 'screenshot'; data: any }
  | null;

export default function ShareCodeScreen() {
  const { shareCode } = useLocalSearchParams<{ shareCode: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState<SharedContent>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!shareCode) return;
    fetchSharedContent(shareCode as string);
  }, [shareCode]);

  const fetchSharedContent = async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [clipRes, reelRes, screenshotRes] = await Promise.allSettled([
        api.clips.getByShareCode ? api.clips.getByShareCode(code) : Promise.reject('no method'),
        api.reels ? api.reels.getByShareCode(code) : Promise.reject('no method'),
        api.screenshots.getByShareCode ? api.screenshots.getByShareCode(code) : Promise.reject('no method'),
      ]);

      if (clipRes.status === 'fulfilled' && clipRes.value) {
        setContent({ type: 'clip', data: clipRes.value });
      } else if (reelRes.status === 'fulfilled' && reelRes.value) {
        setContent({ type: 'reel', data: reelRes.value });
      } else if (screenshotRes.status === 'fulfilled' && screenshotRes.value) {
        setContent({ type: 'screenshot', data: screenshotRes.value });
      } else {
        setError('This shared content could not be found or has been removed.');
      }
    } catch {
      setError('This shared content could not be found or has been removed.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    if (!content) return '';
    return content.data?.title || content.data?.clipTitle || 'Shared Content';
  };

  const getAuthor = () => {
    if (!content) return '';
    return content.data?.user?.username || content.data?.username || 'Unknown';
  };

  const getThumbnail = () => {
    if (!content) return null;
    return content.data?.thumbnailUrl || content.data?.imageUrl || content.data?.url || null;
  };

  const getGameName = () => {
    if (!content) return null;
    return content.data?.game?.name || content.data?.gameName || null;
  };

  const getTypeIcon = () => {
    if (!content) return null;
    if (content.type === 'screenshot') return <Camera size={16} color="#94A3B8" />;
    return <Film size={16} color="#94A3B8" />;
  };

  const getTypeLabel = () => {
    if (!content) return '';
    if (content.type === 'screenshot') return 'Screenshot';
    if (content.type === 'reel') return 'Reel';
    return 'Clip';
  };

  const getViewCount = () => {
    if (!content) return null;
    const v = content.data?.views ?? content.data?.viewCount;
    if (v == null) return null;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
    return String(v);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backBtn} testID="button-share-back">
          <ArrowLeft size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shared Content</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Loading shared content...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorIcon}>
            <Film size={40} color="#4A5568" />
          </View>
          <Text style={styles.errorTitle}>Content Not Found</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(drawer)/(tabs)/home')} testID="button-go-home">
            <Text style={styles.homeBtnText}>Go to Home</Text>
          </TouchableOpacity>
        </View>
      ) : content ? (
        <View style={styles.contentWrap}>
          <View style={styles.card}>
            <View style={styles.thumbnailWrap}>
              {getThumbnail() ? (
                <Image source={{ uri: getThumbnail()! }} style={styles.thumbnail} contentFit="cover" />
              ) : (
                <View style={[styles.thumbnail, styles.thumbnailFallback]}>
                  <Film size={48} color="#2D3F55" />
                </View>
              )}
              <LinearGradient colors={['transparent', 'rgba(8,14,23,0.85)']} style={styles.thumbnailGrad} />
              {content.type !== 'screenshot' && (
                <View style={styles.playOverlay}>
                  <Play size={32} color="#FFF" fill="#FFF" />
                </View>
              )}
              <View style={styles.typeBadge}>
                {getTypeIcon()}
                <Text style={styles.typeBadgeText}>{getTypeLabel()}</Text>
              </View>
            </View>

            <View style={styles.meta}>
              <Text style={styles.title} numberOfLines={2}>{getTitle()}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.author}>@{getAuthor()}</Text>
                {getGameName() ? (
                  <View style={styles.gameBadge}>
                    <Text style={styles.gameBadgeText}>{getGameName()}</Text>
                  </View>
                ) : null}
              </View>
              {getViewCount() ? (
                <View style={styles.viewsRow}>
                  <Eye size={14} color="#64748B" />
                  <Text style={styles.viewsText}>{getViewCount()} views</Text>
                </View>
              ) : null}
            </View>
          </View>

          <TouchableOpacity style={styles.openBtn} onPress={() => router.replace('/(drawer)/(tabs)/home')} testID="button-open-in-app">
            <Text style={styles.openBtnText}>Open in Gamefolio</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C1821' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFF', fontSize: 17, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  loadingText: { color: '#64748B', marginTop: 16, fontSize: 14 },
  errorIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  errorTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  errorText: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  homeBtn: { marginTop: 24, backgroundColor: '#4ADE80', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  homeBtnText: { color: '#131F2A', fontSize: 15, fontWeight: '700' },
  contentWrap: { flex: 1, padding: 16 },
  card: { backgroundColor: '#131F2A', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#1E293B' },
  thumbnailWrap: { position: 'relative', width: '100%', aspectRatio: 16 / 9 },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailFallback: { backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  thumbnailGrad: { ...StyleSheet.absoluteFillObject },
  playOverlay: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -28 }, { translateY: -28 }], width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  typeBadge: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(8,14,23,0.75)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  typeBadgeText: { color: '#94A3B8', fontSize: 12, fontWeight: '500' },
  meta: { padding: 16 },
  title: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  author: { color: '#4ADE80', fontSize: 14, fontWeight: '500' },
  gameBadge: { backgroundColor: '#1E293B', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  gameBadgeText: { color: '#94A3B8', fontSize: 12 },
  viewsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewsText: { color: '#64748B', fontSize: 12 },
  openBtn: { marginTop: 16, backgroundColor: '#4ADE80', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  openBtnText: { color: '#131F2A', fontSize: 16, fontWeight: '700' },
});
