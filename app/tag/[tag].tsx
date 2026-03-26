import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Dimensions, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Eye, Play, Settings, Camera, Hash } from 'lucide-react-native';
import { truncateTitle } from '@/constants/formatters';
import { getClipThumbnail, getReelThumbnail, getScreenshotThumbnail } from '@/utils/thumbnails';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { api, Clip } from '@/lib/api';
import AppHeader from '@/components/AppHeader';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ContentType = 'clips' | 'reels' | 'screenshots';
type SortOption = 'trending' | 'latest' | 'most-viewed';

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export default function TagScreen() {
  const router = useRouter();
  const { tag } = useLocalSearchParams();
  const tagName = Array.isArray(tag) ? tag[0] : tag;
  const { getAccessToken } = useAuth();
  
  const [contentType, setContentType] = useState<ContentType>('clips');
  const [sortOption, setSortOption] = useState<SortOption>('trending');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const { data: clips = [], isLoading } = useQuery<Clip[]>({
    queryKey: ['tag', tagName, contentType, sortOption],
    queryFn: async () => {
      const token = await getAccessToken();
      console.log('[TagScreen] Fetching content for tag:', tagName, contentType, sortOption);
      
      try {
        let result: Clip[] = [];
        const hashtagQuery = `#${tagName}`;
        
        if (contentType === 'clips') {
          try {
            result = await api.search.clips(hashtagQuery, token || undefined);
          } catch {
            const feed = await api.clips.getFeed(token || undefined, { page: 1, limit: 50 });
            result = feed.filter(item => item.videoType === 'clip');
          }
          result = result.filter(item => item.videoType === 'clip' || !item.videoType);
        } else if (contentType === 'reels') {
          try {
            result = await api.search.reels(hashtagQuery, token || undefined);
          } catch {
            result = await api.reels.getLatest(token || undefined);
          }
          result = result.filter(item => item.videoType === 'reel');
        } else if (contentType === 'screenshots') {
          result = [];
        }

        let sorted = [...result];
        if (sortOption === 'latest') {
          sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (sortOption === 'most-viewed') {
          sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
        } else if (sortOption === 'trending') {
          sorted.sort((a, b) => ((b._count?.likes || 0) + (b._count?.fires || 0)) - ((a._count?.likes || 0) + (a._count?.fires || 0)));
        }

        console.log('[TagScreen] Found', sorted.length, contentType);
        return sorted;
      } catch (error) {
        console.log('[TagScreen] Error fetching content:', error);
        return [];
      }
    },
    enabled: !!tagName,
  });

  const handleContentTypeChange = (type: ContentType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setContentType(type);
    setShowSortDropdown(false);
  };

  const handleSortChange = (option: SortOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortOption(option);
    setShowSortDropdown(false);
  };

  const renderContentItem = ({ item }: { item: Clip; index: number }) => {
    if (contentType === 'screenshots') {
      return (
        <TouchableOpacity
          style={styles.screenshotGridCard}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            console.log('Open screenshot:', item.id);
          }}
          activeOpacity={0.8}
        >
          <ImageBackground 
            source={{ uri: item.videoType === 'reel' ? getReelThumbnail(item) : getClipThumbnail(item) }} 
            style={styles.screenshotGridThumbnail} 
            imageStyle={{ borderRadius: 8 }}
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={styles.screenshotGridGradient}
            />
          </ImageBackground>
        </TouchableOpacity>
      );
    }
    
    if (contentType === 'reels') {
      return (
        <TouchableOpacity
          style={styles.reelGridCard}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: '/clip/[id]', params: { id: item.id.toString() } });
          }}
          activeOpacity={0.8}
        >
          <ImageBackground 
            source={{ uri: item.videoType === 'reel' ? getReelThumbnail(item) : getClipThumbnail(item) }} 
            style={styles.reelGridThumbnail} 
            imageStyle={{ borderRadius: 12 }}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.8)']}
              style={styles.reelGridGradient}
            />
            <View style={styles.reelDurationBadge}>
              <Text style={styles.reelDurationText}>
                {Math.floor((item.duration || 0) / 60)}:{String(Math.floor((item.duration || 0) % 60)).padStart(2, '0')}
              </Text>
            </View>
          </ImageBackground>
          <View style={styles.reelGridInfo}>
            <Text style={styles.reelGridTitle} numberOfLines={2}>{truncateTitle(item.title, 34)}</Text>
            <Text style={styles.reelGridUsername}>@{item.user?.username}</Text>
            {item.game?.name && (
              <View style={styles.reelGameTag}>
                <Text style={styles.reelGameTagText} numberOfLines={1}>{item.game.name}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    }
    
    return (
      <View style={styles.carouselCard}>
        <TouchableOpacity
          style={styles.contentCard}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push({ pathname: '/clip/[id]', params: { id: item.id.toString() } });
          }}
          activeOpacity={0.8}
        >
          <ImageBackground source={{ uri: item.videoType === 'reel' ? getReelThumbnail(item) : getClipThumbnail(item) }} style={styles.contentThumbnail} imageStyle={{ borderRadius: 16 }}>
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'transparent', 'transparent', 'rgba(0,0,0,0.8)']}
              style={styles.contentGradient}
            />
            <View style={styles.contentOverlay}>
              <View style={styles.contentTopStats}>
                <View style={styles.statBadge}>
                  <Eye size={12} color="#FFF" style={{ marginRight: 4 }} />
                  <Text style={styles.statText}>{formatNumber(item.views || 0)}</Text>
                </View>
                <View style={styles.durationBadge}>
                  <Text style={styles.statText}>
                    {Math.floor((item.duration || 0) / 60)}:{String(Math.floor((item.duration || 0) % 60)).padStart(2, '0')}
                  </Text>
                </View>
              </View>
              <View style={styles.contentInfo}>
                <TouchableOpacity 
                  style={styles.userRow}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push({ pathname: '/user/[id]', params: { id: item.user.username } });
                  }}
                >
                  <Image source={{ uri: item.user.avatarUrl }} style={styles.userAvatar} />
                  <Text style={styles.contentUsername}>@{item.user?.username}</Text>
                </TouchableOpacity>
                <Text style={styles.contentTitle} numberOfLines={2}>{truncateTitle(item.title, 34)}</Text>
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#131F2A', '#061021']}
        style={StyleSheet.absoluteFill}
      />

      <AppHeader />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color="#FFF" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.tagHeader}>
          <View style={styles.hashtagIconLarge}>
            <Hash size={32} color="#4ADE80" />
          </View>
          <View style={styles.tagInfo}>
            <Text style={styles.tagName}>#{tagName}</Text>
            <Text style={styles.tagSubtitle}>
              Browse content tagged with #{tagName}
            </Text>
            <Text style={styles.clipsCount}>
              {clips.length} {contentType} found
            </Text>
          </View>
        </View>

        <View style={styles.contentTypeTabs}>
          <TouchableOpacity
            style={[styles.contentTypeTab, contentType === 'clips' && styles.contentTypeTabActive]}
            onPress={() => handleContentTypeChange('clips')}
            activeOpacity={0.7}
          >
            <Play size={16} color={contentType === 'clips' ? '#131F2A' : '#94A3B8'} />
            <Text style={[styles.contentTypeTabText, contentType === 'clips' && styles.contentTypeTabTextActive]}>
              Clips
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contentTypeTab, contentType === 'reels' && styles.contentTypeTabActive]}
            onPress={() => handleContentTypeChange('reels')}
            activeOpacity={0.7}
          >
            <Play size={16} color={contentType === 'reels' ? '#131F2A' : '#94A3B8'} />
            <Text style={[styles.contentTypeTabText, contentType === 'reels' && styles.contentTypeTabTextActive]}>
              Reels
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contentTypeTab, contentType === 'screenshots' && styles.contentTypeTabActive]}
            onPress={() => handleContentTypeChange('screenshots')}
            activeOpacity={0.7}
          >
            <Camera size={16} color={contentType === 'screenshots' ? '#131F2A' : '#94A3B8'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowSortDropdown(!showSortDropdown);
            }}
            activeOpacity={0.7}
          >
            <Settings size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {showSortDropdown && (
          <View style={styles.sortDropdown}>
            <TouchableOpacity
              style={[styles.sortOption, sortOption === 'trending' && styles.sortOptionActive]}
              onPress={() => handleSortChange('trending')}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortOptionText, sortOption === 'trending' && styles.sortOptionTextActive]}>
                Trending
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortOption, sortOption === 'latest' && styles.sortOptionActive]}
              onPress={() => handleSortChange('latest')}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortOptionText, sortOption === 'latest' && styles.sortOptionTextActive]}>
                Latest
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortOption, sortOption === 'most-viewed' && styles.sortOptionActive]}
              onPress={() => handleSortChange('most-viewed')}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortOptionText, sortOption === 'most-viewed' && styles.sortOptionTextActive]}>
                Most Viewed
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Loading {contentType}...</Text>
        </View>
      ) : clips.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            <Hash size={48} color="#475569" />
          </View>
          <Text style={styles.emptyStateTitle}>No {contentType} found</Text>
          <Text style={styles.emptyStateSubtitle}>
            No {contentType} have been tagged with #{tagName} yet.
          </Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(drawer)/(tabs)/create');
            }}
          >
            <Text style={styles.uploadButtonText}>
              Upload Content
            </Text>
          </TouchableOpacity>
        </View>
      ) : contentType === 'screenshots' ? (
        <FlatList
          data={clips}
          renderItem={renderContentItem}
          keyExtractor={(item) => `${contentType}-${item.id}`}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.screenshotsGridContent}
          columnWrapperStyle={styles.screenshotsGridRow}
        />
      ) : contentType === 'reels' ? (
        <FlatList
          data={clips}
          renderItem={renderContentItem}
          keyExtractor={(item) => `${contentType}-${item.id}`}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.reelsGridContent}
          columnWrapperStyle={styles.reelsGridRow}
        />
      ) : (
        <FlatList
          data={clips}
          renderItem={renderContentItem}
          keyExtractor={(item) => `${contentType}-${item.id}`}
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_WIDTH * (9/16) + 80}
          decelerationRate="fast"
          contentContainerStyle={styles.clipsScrollContent}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          initialScrollIndex={0}
          onScrollToIndexFailed={() => {}}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131F2A',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 16,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  tagHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
  },
  hashtagIconLarge: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagInfo: {
    flex: 1,
  },
  tagName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 6,
  },
  tagSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
    lineHeight: 20,
  },
  clipsCount: {
    fontSize: 13,
    color: '#64748B',
  },
  contentTypeTabs: {
    flexDirection: 'row',
    gap: 12,
  },
  contentTypeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#2D3748',
    gap: 6,
  },
  contentTypeTabActive: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  contentTypeTabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  contentTypeTabTextActive: {
    color: '#131F2A',
  },
  settingsButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  sortDropdown: {
    marginTop: 12,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
    overflow: 'hidden',
  },
  sortOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  sortOptionActive: {
    backgroundColor: 'rgba(74,222,128,0.1)',
  },
  sortOptionText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#94A3B8',
  },
  sortOptionTextActive: {
    color: '#4ADE80',
    fontWeight: '600' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  uploadButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#4ADE80',
    borderRadius: 12,
  },
  uploadButtonText: {
    color: '#131F2A',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  clipsScrollContent: {
    paddingTop: (SCREEN_HEIGHT - (SCREEN_WIDTH * (9/16) + 60)) / 2,
    paddingBottom: (SCREEN_HEIGHT - (SCREEN_WIDTH * (9/16) + 60)) / 2 + 100,
    paddingHorizontal: 16,
  },
  carouselCard: {
    width: SCREEN_WIDTH - 32,
  },
  contentCard: {
    width: '100%',
    height: SCREEN_WIDTH * (9/16),
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    position: 'relative' as const,
  },
  contentGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  contentThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2D3748',
    justifyContent: 'space-between',
  },
  contentOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 14,
    justifyContent: 'space-between',
  },
  contentTopStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contentInfo: {
    gap: 6,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: '#2D3748',
  },
  durationBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
  },
  statText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  contentTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  contentUsername: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  contentEngagement: {
    flexDirection: 'row' as const,
    gap: 16,
  },
  engagementItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  engagementText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reelsGridContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 100,
  },
  reelsGridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reelGridCard: {
    width: (SCREEN_WIDTH - 36) / 2,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
  },
  reelGridThumbnail: {
    width: '100%',
    height: (SCREEN_WIDTH - 36) / 2 * 1.4,
    backgroundColor: '#2D3748',
  },
  reelGridGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  reelDurationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reelDurationText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  reelGridInfo: {
    padding: 10,
  },
  reelGridTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  reelGridUsername: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 6,
  },
  reelGameTag: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
    marginBottom: 8,
  },
  reelGameTagText: {
    color: '#002E15',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  reelGridStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reelStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reelStatText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  screenshotsGridContent: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 100,
  },
  screenshotsGridRow: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  screenshotGridCard: {
    width: (SCREEN_WIDTH - 32) / 3,
    aspectRatio: 0.75,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    overflow: 'hidden',
  },
  screenshotGridThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2D3748',
  },
  screenshotGridGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  screenshotOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 6,
  },
  screenshotStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenshotStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  screenshotStatText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
});
