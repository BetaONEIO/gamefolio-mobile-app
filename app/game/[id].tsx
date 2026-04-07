import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, ActivityIndicator, Dimensions, Modal, StatusBar, ViewToken, Keyboard, ImageBackground } from 'react-native';
import { useRouter, useLocalSearchParams, Stack, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, Play, Settings, Camera, X, Heart, Flame, MessageSquare } from 'lucide-react-native';
import { truncateTitle } from '@/constants/formatters';
import { getClipThumbnail, getReelThumbnail, getScreenshotThumbnail } from '@/utils/thumbnails';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { api, Clip, Screenshot, TwitchGame } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader from '@/components/AppHeader';
import ReelViewer from '@/components/ReelViewer';
import type { ReelData, Comment } from '@/components/ReelViewer';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ContentType = 'clips' | 'reels' | 'screenshots';
type SortOption = 'trending' | 'latest' | 'most-viewed';

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function GameDetailScreen() {
  const router = useRouter();
  const { id, name, boxArt } = useLocalSearchParams();
  const gameId = typeof id === 'string' ? id : Array.isArray(id) ? id[0] : '';
  const gameName = typeof name === 'string' ? name : Array.isArray(name) ? name[0] : '';
  const gameBoxArt = typeof boxArt === 'string' ? boxArt : Array.isArray(boxArt) ? boxArt[0] : '';
  const { getAccessToken, user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  
  const [contentType, setContentType] = useState<ContentType>('clips');
  const [sortOption, setSortOption] = useState<SortOption>('trending');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showReelsModal, setShowReelsModal] = useState(false);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showReelComments, setShowReelComments] = useState(false);
  const [reelCommentText, setReelCommentText] = useState('');
  const [isTabFocused, setIsTabFocused] = useState(true);
  const reelsFlatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      setIsTabFocused(true);
      return () => {
        setIsTabFocused(false);
      };
    }, [])
  );

  const { data: gameData, isLoading: isLoadingGame } = useQuery<{ game: TwitchGame | null }>({
    queryKey: ['game', gameId],
    queryFn: async () => {
      const token = await getAccessToken();
      console.log('[GameDetail] Fetching game with ID:', gameId);
      
      try {
        if (!gameId) return null;
        const game = await api.games.getGame(gameId, token || undefined);
        console.log('[GameDetail] Game fetched:', game ? game.name : 'not found');
        return { game: game || null };
      } catch (error) {
        console.error('[GameDetail] Error fetching game:', error);
        return { game: null };
      }
    },
    enabled: !!gameId,
  });

  const applySortToClips = (items: Clip[], sort: SortOption): Clip[] => {
    const sorted = [...items];
    if (sort === 'latest') {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === 'most-viewed') {
      sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (sort === 'trending') {
      sorted.sort((a, b) => ((b._count?.likes || 0) + (b._count?.fires || 0)) - ((a._count?.likes || 0) + (a._count?.fires || 0)));
    }
    return sorted;
  };

  const { data: clips = [], isLoading: isLoadingClips } = useQuery<Clip[]>({
    queryKey: ['game-clips', gameId, sortOption],
    queryFn: async () => {
      const token = await getAccessToken();
      try {
        if (!gameId) return [];
        const result = await api.games.getGameClips(gameId, token || undefined, 50);
        return applySortToClips(result, sortOption);
      } catch (error) {
        console.log('[GameDetail] Error fetching clips:', error);
        return [];
      }
    },
    enabled: !!gameId && contentType === 'clips',
  });

  const { data: reels = [], isLoading: isLoadingReels } = useQuery<Clip[]>({
    queryKey: ['game-reels', gameId, sortOption],
    queryFn: async () => {
      const token = await getAccessToken();
      try {
        if (!gameId) return [];
        const result = await api.games.getGameReels(gameId, token || undefined, 50);
        return applySortToClips(result, sortOption);
      } catch (error) {
        console.log('[GameDetail] Error fetching reels:', error);
        return [];
      }
    },
    enabled: !!gameId && contentType === 'reels',
  });

  const { data: screenshots = [], isLoading: isLoadingScreenshots } = useQuery<Screenshot[]>({
    queryKey: ['game-screenshots', gameId],
    queryFn: async () => {
      const token = await getAccessToken();
      try {
        if (!gameId) return [];
        return await api.games.getGameScreenshots(gameId, token || undefined, 50);
      } catch (error) {
        console.log('[GameDetail] Error fetching screenshots:', error);
        return [];
      }
    },
    enabled: !!gameId && contentType === 'screenshots',
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

  const activeReelId = contentType === 'reels' ? reels[activeReelIndex]?.id : null;
  const { data: reelCommentsData, isLoading: isLoadingReelComments } = useQuery({
    queryKey: ['clips', 'comments', activeReelId],
    queryFn: async () => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/clips/${activeReelId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!activeReelId && showReelComments && showReelsModal,
  });

  const [localReelComments, setLocalReelComments] = React.useState<Comment[]>([]);

  React.useEffect(() => {
    if (reelCommentsData) {
      setLocalReelComments(reelCommentsData as Comment[]);
    }
  }, [reelCommentsData]);

  React.useEffect(() => {
    setLocalReelComments([]);
  }, [activeReelId]);

  const addReelCommentMutation = useMutation({
    mutationFn: async ({ clipId, content }: { clipId: number; content: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/clips/${clipId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      
      if (!response.ok) throw new Error('Failed to add comment');
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (user) {
        const newComment: Comment = {
          id: data.id || Date.now(),
          userId: user.id,
          content: variables.content,
          createdAt: new Date().toISOString(),
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName || user.username,
            avatarUrl: user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
          },
        };
        setLocalReelComments(prev => [newComment, ...prev]);
      }
      queryClient.invalidateQueries({ queryKey: ['clips', 'comments', activeReelId] });
    },
  });

  const handleUserPress = useCallback((username: string) => {
    setShowReelsModal(false);
    router.push({ pathname: '/user/[id]', params: { id: username } });
  }, [router]);

  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(prev => !prev);
  }, []);

  const toggleReelComments = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowReelComments(prev => !prev);
  }, []);

  const { mutate: submitReelComment } = addReelCommentMutation;

  const handleReelCommentSubmit = useCallback(() => {
    if (!reelCommentText.trim() || !activeReelId || !user) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    submitReelComment({
      clipId: activeReelId,
      content: reelCommentText.trim(),
    });
    setReelCommentText('');
    Keyboard.dismiss();
  }, [reelCommentText, activeReelId, user, submitReelComment]);

  const onViewableItemsChangedRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const newIndex = viewableItems[0].index;
      setShowReelComments(false);
      Keyboard.dismiss();
      setActiveReelIndex(newIndex);
    }
  });

  const viewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 50,
  });

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_HEIGHT,
    offset: SCREEN_HEIGHT * index,
    index,
  }), []);

  const openReelsViewer = useCallback((startIndex: number = 0) => {
    setActiveReelIndex(startIndex);
    setShowReelsModal(true);
  }, []);

  const closeReelsViewer = useCallback(() => {
    setShowReelsModal(false);
    setShowReelComments(false);
    setReelCommentText('');
  }, []);

  const renderReelItem = useCallback(({ item, index }: { item: Clip; index: number }) => (
    <ReelViewer
      item={item as ReelData}
      isActive={index === activeReelIndex && showReelsModal}
      isMuted={isMuted}
      onToggleMute={toggleMute}
      onUserPress={handleUserPress}
      onLike={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        console.log('Like reel:', item.id);
      }}
      onFire={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        console.log('Fire reel:', item.id);
      }}
      onShare={() => {
        console.log('Share reel:', item.id);
      }}
      showComments={index === activeReelIndex && showReelComments}
      onToggleComments={toggleReelComments}
      comments={index === activeReelIndex ? localReelComments : []}
      commentText={reelCommentText}
      onCommentTextChange={setReelCommentText}
      onSubmitComment={handleReelCommentSubmit}
      isLoadingComments={isLoadingReelComments}
      isTabFocused={isTabFocused && showReelsModal}
    />
  ), [activeReelIndex, showReelsModal, isMuted, toggleMute, handleUserPress, showReelComments, toggleReelComments, localReelComments, reelCommentText, handleReelCommentSubmit, isLoadingReelComments, isTabFocused]);

  const renderContentItem = ({ item, index }: { item: Clip; index: number }) => {
    if (contentType === 'reels') {
      return (
        <TouchableOpacity
          style={styles.reelGridCard}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openReelsViewer(index);
          }}
          activeOpacity={0.8}
        >
          <ImageBackground 
            source={{ uri: item.videoType === 'reel' ? getReelThumbnail(item) : getClipThumbnail(item) }} 
            style={styles.reelGridThumbnail} 
            imageStyle={{ borderRadius: 16 }}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.85)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.reelGridOverlay}>
              <View style={styles.cardTopRow}>
                <View />
                <View style={styles.reelDurationBadge}>
                  <Text style={styles.reelDurationText}>
                    {formatDuration(item.duration || 0)}
                  </Text>
                </View>
              </View>
              <View style={styles.reelGridInfo}>
                <Text style={styles.reelGridTitle} numberOfLines={2}>{truncateTitle(item.title, 34)}</Text>
                <Text style={styles.reelGridUsername}>@{item.user?.username}</Text>
                <View style={styles.reelGameTag}>
                  <Text style={styles.reelGameTagText} numberOfLines={1}>{game?.name}</Text>
                </View>
              </View>
            </View>
          </ImageBackground>
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
              colors={['rgba(0,0,0,0.5)', 'transparent', 'rgba(0,0,0,0.85)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.contentOverlay}>
              <View style={styles.cardTopRow}>
                <View style={styles.topBadgesLeft} />
                <View style={styles.statsBadgesRight}>
                  {(item.duration || 0) > 0 && (
                    <View style={styles.statsBadge}>
                      <Text style={styles.statsText}>
                        {Math.floor((item.duration || 0) / 60)}:{String(Math.floor((item.duration || 0) % 60)).padStart(2, '0')}
                      </Text>
                    </View>
                  )}
                  <View style={styles.statsBadge}>
                    <Eye size={12} color="#FFF" />
                    <Text style={styles.statsText}>{formatNumber(item.views || 0)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.contentInfo}>
                <Text style={styles.contentTitle} numberOfLines={1}>{item.title}</Text>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push({ pathname: '/user/[id]', params: { id: item.user.username } });
                  }}
                >
                  <Text style={styles.contentUsername}>@{item.user?.username}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ImageBackground>
        </TouchableOpacity>
      </View>
    );
  };

  const game = gameData?.game || (gameName && gameBoxArt ? {
    id: gameId || '',
    name: gameName,
    boxArt: gameBoxArt,
  } as TwitchGame : null);
  const isLoading = isLoadingGame || (contentType === 'clips' && isLoadingClips) || (contentType === 'reels' && isLoadingReels) || (contentType === 'screenshots' && isLoadingScreenshots);
  const activeCount = contentType === 'clips' ? clips.length : contentType === 'reels' ? reels.length : screenshots.length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#131F2A', '#061021']}
        style={StyleSheet.absoluteFill}
      />

      <AppHeader />

      <View style={styles.header}>
        <View style={styles.gameHeaderRow}>
          {game?.boxArt && (
            <Image source={{ uri: game.boxArt }} style={styles.gameIcon} />
          )}
          <View style={styles.gameInfo}>
            <Text style={styles.gameName}>{game?.name || 'Loading...'}</Text>
            <Text style={styles.gameSubtitle}>
              Browse clips from the {game?.name || 'game'} community
            </Text>
            <Text style={styles.clipsCount}>
              {activeCount} {contentType} available
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
      ) : activeCount === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIcon}>
            {contentType === 'reels' ? (
              <Play size={48} color="#475569" />
            ) : contentType === 'screenshots' ? (
              <Camera size={48} color="#475569" />
            ) : (
              <Play size={48} color="#475569" />
            )}
          </View>
          <Text style={styles.emptyStateTitle}>No {contentType} found</Text>
          <Text style={styles.emptyStateSubtitle}>
            No {contentType} have been uploaded for {game?.name || 'this game'} yet.
          </Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(drawer)/(tabs)/create');
            }}
          >
            <Text style={styles.uploadButtonText}>
              {contentType === 'reels' ? 'Upload First Reel' : contentType === 'screenshots' ? 'Upload First Screenshot' : 'Upload First Clip'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : contentType === 'screenshots' ? (
        <FlatList
          data={screenshots}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.screenshotCard}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: getScreenshotThumbnail(item) }}
                style={styles.screenshotCardImage}
                resizeMode="cover"
              />
              <View style={styles.screenshotCardBody}>
                <Text style={styles.screenshotCardTitle} numberOfLines={1}>{item.title}</Text>
                {item.user ? (
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); router.push({ pathname: '/user/[id]', params: { id: item.user!.username } }); }}>
                    <Text style={styles.screenshotCardUser}>@{item.user.username}</Text>
                  </TouchableOpacity>
                ) : null}
                {item.game ? (
                  <View style={styles.screenshotCardTag}>
                    <Text style={styles.screenshotCardTagText}>{item.game.name}</Text>
                  </View>
                ) : null}
                <View style={styles.screenshotCardStats}>
                  <View style={styles.screenshotCardStat}>
                    <Heart size={15} color="#94A3B8" />
                    <Text style={styles.screenshotCardStatText}>{item._count?.likes || 0}</Text>
                  </View>
                  <View style={styles.screenshotCardStat}>
                    <Flame size={15} color="#94A3B8" />
                    <Text style={styles.screenshotCardStatText}>{item._count?.fires || 0}</Text>
                  </View>
                  <View style={styles.screenshotCardStat}>
                    <MessageSquare size={15} color="#94A3B8" />
                    <Text style={styles.screenshotCardStatText}>{item._count?.comments || 0}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => `screenshot-${item.id}`}
          key="screenshots-1col"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.screenshotsListContent}
        />
      ) : contentType === 'reels' ? (
        <FlatList
          key="reels-2col"
          data={reels}
          renderItem={renderContentItem}
          keyExtractor={(item) => `reel-${item.id}`}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.reelsGridContent}
          columnWrapperStyle={styles.reelsGridRow}
        />
      ) : (
        <FlatList
          key="clips-1col"
          data={clips}
          renderItem={renderContentItem}
          keyExtractor={(item) => `clip-${item.id}`}
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_WIDTH * (9/16) + 80}
          decelerationRate="fast"
          contentContainerStyle={styles.clipsScrollContent}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          initialScrollIndex={0}
          onScrollToIndexFailed={() => {}}
        />
      )}

      {/* Reels Viewer Modal */}
      <Modal
        visible={showReelsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeReelsViewer}
      >
        <View style={styles.reelsModalContainer}>
          <StatusBar barStyle="light-content" />
          <FlatList
            ref={reelsFlatListRef}
            data={reels}
            renderItem={renderReelItem}
            keyExtractor={(item) => `reel-viewer-${item.id}`}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={SCREEN_HEIGHT}
            decelerationRate="fast"
            onViewableItemsChanged={onViewableItemsChangedRef.current}
            viewabilityConfig={viewabilityConfigRef.current}
            getItemLayout={getItemLayout}
            removeClippedSubviews={false}
            maxToRenderPerBatch={2}
            windowSize={3}
            initialNumToRender={1}
            initialScrollIndex={activeReelIndex}
            onScrollToIndexFailed={() => {}}
          />
          <TouchableOpacity 
            style={[styles.reelsModalCloseButton, { top: insets.top + 10 }]}
            onPress={closeReelsViewer}
          >
            <X size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Modal>
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
  },
  gameHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    gap: 16,
  },
  gameIcon: {
    width: 140,
    height: 186,
    borderRadius: 12,
    backgroundColor: '#1E293B',
  },
  gameInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  gameName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 8,
  },
  gameSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
    lineHeight: 20,
  },
  clipsCount: {
    fontSize: 14,
    color: '#94A3B8',
  },
  contentTypeTabs: {
    flexDirection: 'row',
    gap: 12,
    position: 'relative' as const,
    marginBottom: 8,
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
    position: 'absolute' as const,
    top: 48,
    right: 0,
    width: 200,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2D3748',
    overflow: 'hidden',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
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
    paddingTop: 8,
    paddingBottom: 100,
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
  contentInfo: {
    gap: 4,
  },
  contentTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  contentUsername: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reelsModalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  reelsModalCloseButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
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
  cardTopRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },
  topBadgesLeft: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  statsBadgesRight: {
    flexDirection: 'row' as const,
    gap: 4,
    alignItems: 'center' as const,
  },
  statsBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  reelGridCard: {
    width: (SCREEN_WIDTH - 36) / 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  reelGridThumbnail: {
    width: '100%',
    height: (SCREEN_WIDTH - 36) / 2 * 1.4,
    backgroundColor: '#2D3748',
    justifyContent: 'space-between' as const,
  },
  reelGridOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 10,
    justifyContent: 'space-between' as const,
  },
  reelDurationBadge: {
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
    gap: 3,
  },
  reelGridTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reelGridUsername: {
    color: '#94A3B8',
    fontSize: 11,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reelGameTag: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start' as const,
    marginTop: 2,
  },
  reelGameTagText: {
    color: '#002E15',
    fontSize: 9,
    fontWeight: '700' as const,
  },
  screenshotsListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
    gap: 12,
  },
  screenshotCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
  },
  screenshotCardImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#2D3748',
  },
  screenshotCardBody: {
    padding: 12,
    gap: 4,
  },
  screenshotCardTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold' as const,
  },
  screenshotCardUser: {
    color: '#94A3B8',
    fontSize: 13,
  },
  screenshotCardTag: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start' as const,
    marginTop: 4,
  },
  screenshotCardTagText: {
    color: '#002E15',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  screenshotCardStats: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
    marginTop: 6,
  },
  screenshotCardStat: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  screenshotCardStatText: {
    color: '#94A3B8',
    fontSize: 13,
  },
});
