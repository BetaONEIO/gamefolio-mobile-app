import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StatusBar,
  ViewToken,
  Modal,
  Keyboard,
  ImageBackground,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Eye, Heart, Flame, Gamepad2, X, ArrowLeft, Search, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { shortenGameName } from '@/constants/formatters';
import { useAuth } from '@/context/AuthContext';
import ReelViewer from '@/components/ReelViewer';
import type { ReelData, Comment } from '@/components/ReelViewer';
import AppHeader from '@/components/AppHeader';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Game {
  id: string;
  name: string;
  imageUrl: string;
}

const formatViews = (views: number) => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const PLACEHOLDER_THUMBNAIL = 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=600&fit=crop';

const getThumbnailUrl = (item: any): string => {
  if (item.thumbnailUrl && item.thumbnailUrl.trim() !== '') {
    return item.thumbnailUrl;
  }
  if (item.game?.imageUrl && item.game.imageUrl.trim() !== '') {
    return item.game.imageUrl;
  }
  return PLACEHOLDER_THUMBNAIL;
};

export default function LatestReelsPage() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [showGameFilter, setShowGameFilter] = useState(false);
  const [showReelsModal, setShowReelsModal] = useState(false);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showReelComments, setShowReelComments] = useState(false);
  const [reelCommentText, setReelCommentText] = useState('');
  
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  const reelsFlatListRef = useRef<FlatList>(null);

  const likeReelMutation = useMutation({
    mutationFn: async (clipId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.like(clipId.toString(), token);
    },
    onSuccess: (data, clipId) => {
      queryClient.setQueryData(['reels', 'all-latest'], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(clip => 
          clip.id === clipId 
            ? { ...clip, isLiked: data.liked, _count: { ...clip._count, likes: data.likeCount } }
            : clip
        );
      });
    },
  });

  const fireReelMutation = useMutation({
    mutationFn: async (clipId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.fire(clipId.toString(), token);
    },
    onSuccess: (data, clipId) => {
      queryClient.setQueryData(['reels', 'all-latest'], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(clip => 
          clip.id === clipId 
            ? { ...clip, isFired: data.fired, _count: { ...clip._count, fires: data.fireCount } }
            : clip
        );
      });
    },
  });

  const { data: allReels = [], isLoading } = useQuery({
    queryKey: ['reels', 'all-latest'],
    queryFn: async () => {
      const token = await getAccessToken();
      console.log('[Latest Reels] Fetching all latest reels');
      const reels = await api.reels.getLatest(token || undefined);
      console.log('[Latest Reels] Received reels:', reels.length);
      return reels;
    },
  });

  const filteredReels = selectedGame 
    ? allReels.filter(reel => reel.game?.id === parseInt(selectedGame))
    : allReels;

  const [gameSearchQuery, setGameSearchQuery] = useState('');

  const topGamesQuery = useQuery({
    queryKey: ['/api/twitch/games/top', 30],
    queryFn: async () => {
      const token = await getAccessToken();
      return api.games.getTopGames(30, token ?? undefined);
    },
  });

  const topGamesData = React.useMemo(() => {
    if (!topGamesQuery.data?.games) return { games: [] };
    return { games: topGamesQuery.data.games };
  }, [topGamesQuery.data]);

  const searchGamesQuery = useQuery({
    queryKey: ['/api/twitch/games/search', gameSearchQuery.trim()],
    queryFn: async () => {
      const token = await getAccessToken();
      return api.games.searchGames(gameSearchQuery.trim(), 50, token ?? undefined);
    },
    enabled: gameSearchQuery.trim().length > 0,
  });

  const uniqueGames = React.useMemo(() => {
    const games = new Map<string, Game>();
    allReels.forEach(reel => {
      if (reel.game && !games.has(reel.game.id.toString())) {
        games.set(reel.game.id.toString(), {
          id: reel.game.id.toString(),
          name: reel.game.name,
          imageUrl: reel.game.imageUrl,
        });
      }
    });
    return Array.from(games.values());
  }, [allReels]);

  const gamesWithoutContent = React.useMemo(() => {
    if (!topGamesData?.games) return [];
    const existingGameIds = new Set(uniqueGames.map(g => g.id));
    return topGamesData.games
      .filter(game => !existingGameIds.has(game.id))
      .map(game => ({
        id: game.id,
        name: game.name,
        imageUrl: game.boxArt?.replace('{width}', '285').replace('{height}', '380') || '',
      }));
  }, [topGamesData, uniqueGames]);

  const allGamesForFilter = React.useMemo(() => {
    // If searching, use search results
    if (gameSearchQuery.trim() && searchGamesQuery.data?.games) {
      return searchGamesQuery.data.games.map(game => ({
        id: game.id,
        name: game.name,
        imageUrl: game.icon || '',
      }));
    }
    // Otherwise show all games
    return [
      ...uniqueGames,
      ...gamesWithoutContent,
    ];
  }, [uniqueGames, gamesWithoutContent, gameSearchQuery, searchGamesQuery.data]);

  const formatBoxArt = (url: string | undefined): string => {
    if (!url) return '';
    return url.replace('{width}', '285').replace('{height}', '380');
  };

  const activeReelId = filteredReels[activeReelIndex]?.id;
  const { data: reelCommentsData, isLoading: isLoadingReelComments } = useQuery({
    queryKey: ['clips', 'comments', activeReelId],
    queryFn: async () => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/clips/${activeReelId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!activeReelId && showReelComments && showReelsModal,
  });

  const [localReelComments, setLocalReelComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (reelCommentsData) {
      setLocalReelComments(reelCommentsData as Comment[]);
    }
  }, [reelCommentsData]);

  useEffect(() => {
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

  const { mutate: likeReelMutate } = likeReelMutation;
  const { mutate: fireReelMutate } = fireReelMutation;

  const renderReelItem = useCallback(({ item, index }: { item: any; index: number }) => (
    <ReelViewer
      item={item as ReelData}
      isActive={index === activeReelIndex && showReelsModal}
      isMuted={isMuted}
      onToggleMute={toggleMute}
      onUserPress={handleUserPress}
      onLike={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        likeReelMutate(item.id);
      }}
      onFire={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        fireReelMutate(item.id);
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
      isTabFocused={showReelsModal}
    />
  ), [activeReelIndex, showReelsModal, isMuted, toggleMute, handleUserPress, showReelComments, toggleReelComments, localReelComments, reelCommentText, handleReelCommentSubmit, isLoadingReelComments, likeReelMutate, fireReelMutate]);

  const selectedGameName = selectedGame 
    ? allGamesForFilter.find(g => g.id === selectedGame)?.name || uniqueGames.find(g => g.id === selectedGame)?.name
    : 'All Games';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F1520', '#020617']}
        style={StyleSheet.absoluteFill}
      />

      <StatusBar barStyle="light-content" />

      <AppHeader />

      {/* Page Title */}
      <View style={styles.pageTitleContainer}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/home');
          }}
        >
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Latest Reels</Text>
          <Text style={styles.reelsCount}>{filteredReels.length} reels</Text>
        </View>
      </View>

      {/* Game Filter */}
      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowGameFilter(true);
          }}
        >
          <Gamepad2 size={18} color="#FFF" />
          <Text style={styles.filterText}>
            {selectedGameName} ({filteredReels.length})
          </Text>
          <ChevronDown size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Reels Grid */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Loading reels...</Text>
        </View>
      ) : filteredReels.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Gamepad2 size={48} color="#475569" />
          <Text style={styles.emptyTitle}>No reels found</Text>
          <Text style={styles.emptySubtitle}>
            {selectedGame ? 'Try selecting a different game' : 'Check back later for new content'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReels}
          renderItem={({ item, index }) => (
            <TouchableOpacity 
              style={styles.reelCard}
              onPress={() => openReelsViewer(index)}
              activeOpacity={0.9}
            >
              <ImageBackground
                source={{ uri: getThumbnailUrl(item) }}
                style={styles.reelThumbnail}
                imageStyle={{ borderRadius: 16 }}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.reelGradient}
                >
                  <View style={styles.reelTopRow}>
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>{formatDuration(item.duration)}</Text>
                    </View>
                  </View>

                  <View style={styles.reelInfo}>
                    <Text style={styles.reelTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.reelUsername}>@{item.user.username}</Text>
                    {item.game && (
                      <View style={styles.gameBadge}>
                        <Text style={styles.gameBadgeText} numberOfLines={1}>
                          {shortenGameName(item.game.name)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.reelStats}>
                      <View style={styles.statItem}>
                        <Eye size={12} color="#FFF" />
                        <Text style={styles.statText}>{formatViews(item.views)}</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Heart size={12} color="#FFF" />
                        <Text style={styles.statText}>{item._count?.likes || 0}</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Flame size={12} color="#F59E0B" />
                        <Text style={styles.statText}>{item._count?.fires || 0}</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => `reel-grid-${item.id}`}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Game Filter Modal */}
      <Modal
        visible={showGameFilter}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowGameFilter(false);
          setGameSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setShowGameFilter(false);
              setGameSearchQuery('');
            }}
          />
          <View style={[styles.filterModal, { paddingBottom: insets.bottom + 20 }]}>
            {/* Header */}
            <View style={styles.filterModalHeader}>
              <View style={styles.filterModalTitleRow}>
                <View style={styles.filterIconContainer}>
                  <Gamepad2 size={24} color="#4ADE80" />
                </View>
                <Text style={styles.filterModalTitle}>Filter Reels by Game</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setShowGameFilter(false);
                  setGameSearchQuery('');
                }}
                style={styles.closeFilterButton}
              >
                <X size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <Search size={20} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for games..."
                placeholderTextColor="#64748B"
                value={gameSearchQuery}
                onChangeText={setGameSearchQuery}
              />
              {gameSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setGameSearchQuery('')}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>

            {/* Section Header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {gameSearchQuery.trim() ? 'Search Results' : 'Available Games'}
              </Text>
              {selectedGame && (
                <TouchableOpacity 
                  style={styles.clearFilterBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedGame(null);
                    setShowGameFilter(false);
                    setGameSearchQuery('');
                  }}
                >
                  <Text style={styles.clearFilterText}>Clear Filter</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Games Grid */}
            {searchGamesQuery.isLoading && gameSearchQuery.trim() ? (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size="large" color="#4ADE80" />
              </View>
            ) : (
              <FlatList
                data={gameSearchQuery.trim() ? allGamesForFilter : [{ id: null, name: 'All Games', imageUrl: '' }, ...allGamesForFilter]}
                renderItem={({ item }) => {
                  const itemId = item.id as string | null;
                  const reelCount = itemId 
                    ? allReels.filter(r => r.game?.id === (typeof itemId === 'string' ? parseInt(itemId) : itemId)).length
                    : allReels.length;
                  const isSelected = selectedGame === item.id || (!selectedGame && !itemId);
                  
                  return (
                    <TouchableOpacity
                      style={[
                        styles.gameFilterThumbnailCard,
                        isSelected && styles.gameFilterThumbnailActive,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedGame(itemId);
                        setShowGameFilter(false);
                        setGameSearchQuery('');
                      }}
                      activeOpacity={0.7}
                    >
                      {!itemId ? (
                        <View style={styles.allGamesThumbnail}>
                          <Gamepad2 size={40} color="#4ADE80" />
                          {isSelected && (
                            <View style={styles.selectedBadgeOverlay}>
                              <Check size={14} color="#0F1520" strokeWidth={3} />
                            </View>
                          )}
                          <View style={styles.gameInfoOverlay}>
                            <Text style={styles.gameInfoName} numberOfLines={2}>All Games</Text>
                          </View>
                        </View>
                      ) : (
                        <View style={styles.thumbnailWrapper}>
                          <Image
                            source={{ uri: formatBoxArt(item.imageUrl) }}
                            style={styles.gameThumbnail}
                            contentFit="cover"
                            transition={200}
                          />
                          {isSelected && (
                            <View style={styles.selectedBadgeOverlay}>
                              <Check size={14} color="#0F1520" strokeWidth={3} />
                            </View>
                          )}
                          <View style={styles.gameInfoOverlay}>
                            <Text style={styles.gameInfoName} numberOfLines={2}>{item.name}</Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
                keyExtractor={(item) => `game-filter-${item.id || 'all'}`}
                contentContainerStyle={styles.gameFilterList}
                numColumns={3}
                columnWrapperStyle={styles.gameFilterRow}
                showsVerticalScrollIndicator={false}
                onEndReached={() => {
                  if (!gameSearchQuery.trim() && topGamesQuery.hasNextPage && !topGamesQuery.isFetchingNextPage) {
                    console.log('[Latest Reels] Loading more games...');
                    topGamesQuery.fetchNextPage();
                  }
                }}
                onEndReachedThreshold={0.3}
                ListFooterComponent={
                  topGamesQuery.isFetchingNextPage && !gameSearchQuery.trim() ? (
                    <View style={styles.loadMoreContainer}>
                      <ActivityIndicator size="small" color="#4ADE80" />
                      <Text style={styles.loadMoreText}>Loading more games...</Text>
                    </View>
                  ) : null
                }
              />
            )}
          </View>
        </View>
      </Modal>

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
            data={filteredReels}
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
    backgroundColor: '#0F1520',
  },
  pageTitleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  reelsCount: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500' as const,
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterText: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 16,
    fontWeight: '500' as const,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    color: '#94A3B8',
    fontSize: 20,
    fontWeight: '600' as const,
    marginTop: 16,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
  },
  gridContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  gridRow: {
    gap: 12,
  },
  reelCard: {
    flex: 1,
    height: 280,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  reelThumbnail: {
    flex: 1,
  },
  reelGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 12,
  },
  reelTopRow: {
    alignItems: 'flex-end',
  },
  durationBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  reelInfo: {
    gap: 4,
  },
  reelTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reelUsername: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  gameBadge: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  gameBadgeText: {
    color: '#002E15',
    fontSize: 9,
    fontWeight: '700' as const,
  },
  reelStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#0F1520',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  filterModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  closeFilterButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4ADE80',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    ...Platform.select({
      web: {
        outlineStyle: 'none' as const,
      },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFF',
  },
  clearFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  clearFilterText: {
    color: '#EF4444',
    fontWeight: '600' as const,
    fontSize: 13,
  },
  searchLoadingContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameFilterList: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  gameFilterRow: {
    gap: 10,
    marginBottom: 10,
  },
  gameFilterThumbnailCard: {
    flex: 1,
    maxWidth: '32%',
    aspectRatio: 0.75,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  gameFilterThumbnailActive: {
    borderColor: '#4ADE80',
    borderWidth: 2,
  },
  allGamesThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' as const,
  },
  thumbnailWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative' as const,
  },
  gameThumbnail: {
    width: '100%',
    height: '100%',
  },
  selectedBadgeOverlay: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadMoreContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    gap: 10,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  gameInfoOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  gameInfoName: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
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
});
