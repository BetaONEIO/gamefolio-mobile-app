import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Heart, MessageSquare, Eye } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, Screenshot } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import ScreenshotViewerModal from '@/components/ScreenshotViewerModal';

const { width } = Dimensions.get('window');
const COLUMN_GAP = 10;
const H_PADDING = 16;
const CARD_WIDTH = (width - H_PADDING * 2 - COLUMN_GAP) / 2;

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function LatestScreenshotsPage() {
  const { getAccessToken } = useAuth();
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['screenshots', 'latest'],
    queryFn: async () => {
      try {
        const token = await getAccessToken();
        return api.screenshots.getLatest(token || undefined);
      } catch {
        return [] as Screenshot[];
      }
    },
    staleTime: 2 * 60 * 1000,
  });

  const screenshots = Array.isArray(data) ? data : [];

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const openViewer = (index: number) => {
    setSelectedIndex(index);
    setViewerVisible(true);
  };

  const renderItem = ({ item, index }: { item: Screenshot; index: number }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => openViewer(index)}
      activeOpacity={0.85}
      testID={`screenshot-card-${item.id}`}
    >
      <Image
        source={{ uri: item.imageUrl || item.thumbnailUrl }}
        style={styles.cardImage}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={styles.cardGradient}
      />
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <Eye size={10} color="#94A3B8" />
            <Text style={styles.statText}>{formatNumber(item.views || 0)}</Text>
          </View>
          <View style={styles.statItem}>
            <Heart size={10} color="#94A3B8" />
            <Text style={styles.statText}>{formatNumber(item._count?.likes || 0)}</Text>
          </View>
          <View style={styles.statItem}>
            <MessageSquare size={10} color="#94A3B8" />
            <Text style={styles.statText}>{formatNumber(item._count?.comments || 0)}</Text>
          </View>
        </View>
      </View>
      {item.user && (
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={(e) => {
            e.stopPropagation();
            router.push({ pathname: '/user/[id]', params: { id: item.user?.username || item.userId.toString() } });
          }}
        >
          <Image
            source={{ uri: item.user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop' }}
            style={styles.avatar}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#131F2A', '#061021']} style={StyleSheet.absoluteFill} />
      <AppHeader />
      <View style={styles.pageHeader}>
        <View style={styles.pageTitleRow}>
          <Camera size={22} color="#4ADE80" />
          <Text style={styles.pageTitle}>Latest Screenshots</Text>
        </View>
        <Text style={styles.pageSubtitle}>Fresh screenshots from the community</Text>
      </View>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#4ADE80" size="large" />
          <Text style={styles.loadingText}>Loading screenshots...</Text>
        </View>
      ) : screenshots.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIcon}>
            <Camera size={40} color="#4ADE80" />
          </View>
          <Text style={styles.emptyTitle}>No screenshots yet</Text>
          <Text style={styles.emptyMessage}>Be the first to share a screenshot from your game</Text>
        </View>
      ) : (
        <FlatList
          data={screenshots}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4ADE80"
              colors={['#4ADE80']}
            />
          }
        />
      )}

      <ScreenshotViewerModal
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        screenshot={screenshots[selectedIndex] || null}
        screenshots={screenshots}
        initialIndex={selectedIndex}
        handle={screenshots[selectedIndex]?.user?.username || ''}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131F2A' },
  pageHeader: { paddingHorizontal: 16, paddingBottom: 12 },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: '#FFFFFF' },
  pageSubtitle: { fontSize: 13, color: '#64748B' },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  loadingText: { color: '#94A3B8', fontSize: 15 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' as const, color: '#FFFFFF', textAlign: 'center' },
  emptyMessage: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  grid: {
    paddingHorizontal: H_PADDING,
    paddingBottom: 100,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: COLUMN_GAP,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E2D3C',
  },
  cardImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#2D3748',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  cardStats: { flexDirection: 'row', gap: 8 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statText: { fontSize: 10, color: '#94A3B8' },
  avatarContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#4ADE80',
    backgroundColor: '#1E293B',
  },
});
