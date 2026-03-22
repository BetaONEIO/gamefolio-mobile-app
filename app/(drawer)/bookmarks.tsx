import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Bookmark, Film, Camera, Grid2x2, List, Play } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_COLS = 2;
const CARD_W = (SCREEN_WIDTH - 48) / GRID_COLS;

type Tab = 'clips' | 'screenshots';

export default function BookmarksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { getAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('clips');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data: bookmarkedClips = [], isLoading: isLoadingClips } = useQuery<any[]>({
    queryKey: ['/api/clips/bookmarked'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return [];
      try {
        return await api.clips.getBookmarked ? api.clips.getBookmarked(token) : [];
      } catch {
        return [];
      }
    },
  });

  const { data: bookmarkedScreenshots = [], isLoading: isLoadingShots } = useQuery<any[]>({
    queryKey: ['/api/screenshots/bookmarked'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return [];
      try {
        return await api.screenshots.getBookmarked ? api.screenshots.getBookmarked(token) : [];
      } catch {
        return [];
      }
    },
  });

  const items = activeTab === 'clips' ? bookmarkedClips : bookmarkedScreenshots;
  const isLoading = activeTab === 'clips' ? isLoadingClips : isLoadingShots;

  const renderGridItem = ({ item }: { item: any }) => {
    const thumb = item.thumbnailUrl || item.imageUrl || item.url;
    return (
      <TouchableOpacity
        style={styles.gridCard}
        onPress={() => router.push({ pathname: '/(drawer)/(tabs)/home' })}
        activeOpacity={0.85}
        testID={`card-bookmark-${item.id}`}
      >
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.gridThumb} contentFit="cover" />
        ) : (
          <View style={[styles.gridThumb, styles.thumbFallback]}>
            {activeTab === 'clips' ? <Film size={24} color="#2D3F55" /> : <Camera size={24} color="#2D3F55" />}
          </View>
        )}
        <LinearGradient colors={['transparent', 'rgba(8,14,23,0.85)']} style={styles.gridGrad} />
        {activeTab === 'clips' && (
          <View style={styles.playIcon}>
            <Play size={14} color="#FFF" fill="#FFF" />
          </View>
        )}
        <Text style={styles.gridTitle} numberOfLines={2}>
          {item.title || item.clipTitle || 'Untitled'}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderListItem = ({ item }: { item: any }) => {
    const thumb = item.thumbnailUrl || item.imageUrl || item.url;
    return (
      <TouchableOpacity
        style={styles.listCard}
        onPress={() => router.push({ pathname: '/(drawer)/(tabs)/home' })}
        activeOpacity={0.85}
        testID={`card-bookmark-list-${item.id}`}
      >
        <View style={styles.listThumbWrap}>
          {thumb ? (
            <Image source={{ uri: thumb }} style={styles.listThumb} contentFit="cover" />
          ) : (
            <View style={[styles.listThumb, styles.thumbFallback]}>
              {activeTab === 'clips' ? <Film size={20} color="#2D3F55" /> : <Camera size={20} color="#2D3F55" />}
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle} numberOfLines={2}>{item.title || item.clipTitle || 'Untitled'}</Text>
          <Text style={styles.listMeta}>@{item.user?.username || item.username || 'unknown'}</Text>
          {item.game?.name ? <Text style={styles.listGame}>{item.game.name}</Text> : null}
        </View>
        {activeTab === 'clips' ? <Film size={16} color="#4A5568" /> : <Camera size={16} color="#4A5568" />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Bookmarks" />
      <View style={{ flex: 1 }}>
        <FlatList
          key={viewMode === 'grid' ? 'grid' : 'list'}
          data={isLoading ? [] : items}
          keyExtractor={item => String(item.id)}
          renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
          numColumns={viewMode === 'grid' ? GRID_COLS : 1}
          contentContainerStyle={{
            paddingTop: headerHeight + 16,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 24,
            ...(viewMode === 'grid' ? { gap: 8 } : {}),
          }}
          columnWrapperStyle={viewMode === 'grid' ? { gap: 8 } : undefined}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          ListHeaderComponent={
            <View style={styles.filterBar}>
              <View style={styles.tabs}>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'clips' && styles.tabActive]}
                  onPress={() => setActiveTab('clips')}
                  testID="button-bookmark-clips"
                >
                  <Film size={15} color={activeTab === 'clips' ? '#131F2A' : '#64748B'} />
                  <Text style={[styles.tabText, activeTab === 'clips' && styles.tabTextActive]}>Clips</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, activeTab === 'screenshots' && styles.tabActive]}
                  onPress={() => setActiveTab('screenshots')}
                  testID="button-bookmark-screenshots"
                >
                  <Camera size={15} color={activeTab === 'screenshots' ? '#131F2A' : '#64748B'} />
                  <Text style={[styles.tabText, activeTab === 'screenshots' && styles.tabTextActive]}>Screenshots</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.viewToggle}
                onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
                testID="button-toggle-view-mode"
              >
                {viewMode === 'grid' ? <List size={18} color="#94A3B8" /> : <Grid2x2 size={18} color="#94A3B8" />}
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.empty}>
                <ActivityIndicator size="large" color="#4ADE80" />
              </View>
            ) : (
              <View style={styles.empty}>
                <Bookmark size={40} color="#2D3F55" />
                <Text style={styles.emptyTitle}>No Bookmarks Yet</Text>
                <Text style={styles.emptyText}>
                  Save your favorite {activeTab} to access them here
                </Text>
              </View>
            )
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C1821' },
  filterBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  tabs: { flex: 1, flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 10, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8 },
  tabActive: { backgroundColor: '#4ADE80' },
  tabText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#131F2A' },
  viewToggle: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  gridCard: { width: CARD_W, aspectRatio: 16 / 10, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1E293B', position: 'relative' },
  gridThumb: { width: '100%', height: '100%' },
  thumbFallback: { backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  gridGrad: { ...StyleSheet.absoluteFillObject },
  gridTitle: { position: 'absolute', bottom: 8, left: 8, right: 8, color: '#FFF', fontSize: 11, fontWeight: '600' },
  playIcon: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 },
  listCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#131F2A', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#1E293B', marginBottom: 8, gap: 12 },
  listThumbWrap: { borderRadius: 8, overflow: 'hidden' },
  listThumb: { width: 80, height: 52 },
  listTitle: { color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  listMeta: { color: '#4ADE80', fontSize: 12, marginBottom: 2 },
  listGame: { color: '#4A5568', fontSize: 11 },
  empty: { alignItems: 'center', paddingTop: 64, gap: 12 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  emptyText: { color: '#4A5568', fontSize: 14, textAlign: 'center' },
});
