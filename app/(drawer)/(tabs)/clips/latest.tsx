import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Modal,
  ActivityIndicator,
  Dimensions,
  ViewToken,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, Gamepad2, X, ArrowLeft } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import * as Haptics from 'expo-haptics';
import ReelViewer from '@/components/ReelViewer';
import type { ReelData } from '@/components/ReelViewer';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface UserBasic {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

interface Game {
  id: number;
  name: string;
  imageUrl: string;
}

interface ClipWithUser {
  id: number;
  userId: number;
  gameId: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  videoType: 'clip' | 'reel';
  duration: number;
  views: number;
  shareCode: string;
  ageRestricted: boolean;
  createdAt: string;
  user: UserBasic;
  game: Game;
  _count: {
    likes: number;
    comments: number;
    fires?: number;
  };
  isLiked?: boolean;
  isFired?: boolean;
}

export default function LatestClipsPage() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [showGameFilter, setShowGameFilter] = useState(false);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [showClipComments, setShowClipComments] = useState(false);
  const [clipCommentText, setClipCommentText] = useState('');
  const clipsFlatListRef = useRef<FlatList>(null);
  
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  const likeClipMutation = useMutation({
    mutationFn: async (clipId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.like(clipId.toString(), token);
    },
    onSuccess: (data, clipId) => {
      queryClient.setQueryData(['clips', 'all-latest'], (oldData: ClipWithUser[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(clip => 
          clip.id === clipId 
            ? { ...clip, isLiked: data.liked, _count: { ...clip._count, likes: data.likeCount } }
            : clip
        );
      });
    },
  });

  const fireClipMutation = useMutation({
    mutationFn: async (clipId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.fire(clipId.toString(), token);
    },
    onSuccess: (data, clipId) => {
      queryClient.setQueryData(['clips', 'all-latest'], (oldData: ClipWithUser[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(clip => 
          clip.id === clipId 
            ? { ...clip, isFired: data.fired, _count: { ...clip._count, fires: data.fireCount } }
            : clip
        );
      });
    },
  });

  useFocusEffect(
    useCallback(() => {
      setIsTabFocused(true);
      return () => {
        setIsTabFocused(false);
      };
    }, [])
  );

  const { data: allClipsData = [], isLoading } = useQuery({
    queryKey: ['clips', 'all-latest'],
    queryFn: async () => {
      const token = await getAccessToken();
      console.log('[Latest Clips] Fetching all latest clips');
      try {
        // Try the feed endpoint which is more reliable
        const clips = await api.clips.getFeed(token || undefined, { page: 1, limit: 100 });
        // Filter to only show clips (not reels)
        const filteredClips = clips.filter(clip => clip.videoType !== 'reel');
        console.log('[Latest Clips] Received clips:', filteredClips.length);
        return filteredClips;
      } catch (error) {
        console.log('[Latest Clips] Feed endpoint failed, trying latest endpoint');
        const clips = await api.clips.getLatest(token || undefined);
        const filteredClips = (clips || []).filter((clip: any) => clip.videoType !== 'reel');
        console.log('[Latest Clips] Received clips from latest:', filteredClips.length);
        return filteredClips;
      }
    },
  });

  const allClips = allClipsData as ClipWithUser[] | any[];

  const filteredClips = selectedGame 
    ? allClips.filter(clip => clip.game?.id === parseInt(selectedGame))
    : allClips;

  const { data: topGamesData } = useQuery({
    queryKey: ['/api/twitch/games/top', 25],
    queryFn: async () => {
      const token = await getAccessToken();
      return api.games.getTopGames(25, token ?? undefined);
    },
  });

  const uniqueGames = React.useMemo(() => {
    const games = new Map<string, Game>();
    allClips.forEach((clip: any) => {
      if (clip.game && !games.has(clip.game.id.toString())) {
        games.set(clip.game.id.toString(), {
          id: clip.game.id,
          name: clip.game.name,
          imageUrl: clip.game.imageUrl,
        });
      }
    });
    return Array.from(games.values());
  }, [allClips]);

  const gamesWithoutContent = React.useMemo(() => {
    if (!topGamesData?.games) return [];
    const existingGameIds = new Set(uniqueGames.map(g => g.id.toString()));
    return topGamesData.games
      .filter(game => !existingGameIds.has(game.id))
      .map(game => ({
        id: parseInt(game.id),
        name: game.name,
        imageUrl: game.boxArt,
      }));
  }, [topGamesData, uniqueGames]);

  const allGamesForFilter = React.useMemo(() => [
    ...uniqueGames,
    ...gamesWithoutContent,
  ], [uniqueGames, gamesWithoutContent]);

  const selectedGameName = selectedGame 
    ? uniqueGames.find(g => g.id.toString() === selectedGame)?.name 
    : 'All Games';

  const handleUserPress = useCallback((username: string) => {
    router.push({ pathname: '/user/[id]', params: { id: username } });
  }, [router]);

  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(prev => !prev);
  }, []);

  const activeClipId = filteredClips[activeClipIndex]?.id;
  const { data: clipCommentsData, isLoading: isLoadingClipComments } = useQuery({
    queryKey: ['clips', 'comments', activeClipId],
    queryFn: async () => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/clips/${activeClipId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!activeClipId && showClipComments,
  });

  const [localClipComments, setLocalClipComments] = useState<any[]>([]);

  useEffect(() => {
    if (clipCommentsData) {
      setLocalClipComments(clipCommentsData as any[]);
    }
  }, [clipCommentsData]);

  useEffect(() => {
    setLocalClipComments([]);
  }, [activeClipId]);

  const addClipCommentMutation = useMutation({
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
        const newComment: any = {
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
        setLocalClipComments(prev => [newComment, ...prev]);
      }
      queryClient.invalidateQueries({ queryKey: ['clips', 'comments', activeClipId] });
    },
  });

  const toggleClipComments = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowClipComments(prev => !prev);
  }, []);

  const { mutate: submitClipComment } = addClipCommentMutation;
  const { mutate: likeClipMutate } = likeClipMutation;
  const { mutate: fireClipMutate } = fireClipMutation;

  const handleClipCommentSubmit = useCallback(() => {
    if (!clipCommentText.trim() || !activeClipId || !user) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    submitClipComment({
      clipId: activeClipId,
      content: clipCommentText.trim(),
    });
    setClipCommentText('');
    Keyboard.dismiss();
  }, [clipCommentText, activeClipId, user, submitClipComment]);

  const onClipsViewableItemsChangedRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const newIndex = viewableItems[0].index;
      setShowClipComments(false);
      Keyboard.dismiss();
      setActiveClipIndex(newIndex);
    }
  });

  const clipsViewabilityConfigRef = useRef({
    itemVisiblePercentThreshold: 50,
  });

  const getClipItemLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_HEIGHT,
    offset: SCREEN_HEIGHT * index,
    index,
  }), []);

  const renderClipItem = useCallback(({ item, index }: { item: ClipWithUser; index: number }) => (
    <ReelViewer
      item={item as ReelData}
      isActive={index === activeClipIndex}
      isMuted={isMuted}
      onToggleMute={toggleMute}
      onUserPress={handleUserPress}
      onLike={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        likeClipMutate(item.id);
      }}
      onFire={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        fireClipMutate(item.id);
      }}
      onShare={() => {
        console.log('Share clip:', item.id);
      }}
      showComments={index === activeClipIndex && showClipComments}
      onToggleComments={toggleClipComments}
      comments={index === activeClipIndex ? localClipComments : []}
      commentText={clipCommentText}
      onCommentTextChange={setClipCommentText}
      onSubmitComment={handleClipCommentSubmit}
      isLoadingComments={isLoadingClipComments}
      isTabFocused={isTabFocused}
    />
  ), [activeClipIndex, isMuted, toggleMute, handleUserPress, showClipComments, toggleClipComments, localClipComments, clipCommentText, handleClipCommentSubmit, isLoadingClipComments, isTabFocused, likeClipMutate, fireClipMutate]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#131F2A', '#061021']}
        style={StyleSheet.absoluteFill}
      />

      <StatusBar barStyle="light-content" />

      <AppHeader />

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
          <Text style={styles.headerTitle}>Latest Clips</Text>
          <Text style={styles.clipsCount}>{filteredClips.length} clips</Text>
        </View>
      </View>

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
            {selectedGameName} ({filteredClips.length})
          </Text>
          <ChevronDown size={18} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Loading clips...</Text>
        </View>
      ) : filteredClips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Gamepad2 size={48} color="#475569" />
          <Text style={styles.emptyTitle}>No clips found</Text>
          <Text style={styles.emptySubtitle}>
            {selectedGame ? 'Try selecting a different game' : 'Check back later for new content'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={clipsFlatListRef}
          data={filteredClips}
          renderItem={renderClipItem}
          keyExtractor={(item) => `clip-${item.id}`}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToInterval={SCREEN_HEIGHT}
          decelerationRate="fast"
          onViewableItemsChanged={onClipsViewableItemsChangedRef.current}
          viewabilityConfig={clipsViewabilityConfigRef.current}
          getItemLayout={getClipItemLayout}
          removeClippedSubviews={false}
          maxToRenderPerBatch={2}
          windowSize={3}
          initialNumToRender={1}
          initialScrollIndex={0}
          onScrollToIndexFailed={() => {}}
        />
      )}

      <Modal
        visible={showGameFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGameFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowGameFilter(false)}
          />
          <View style={[styles.filterModal, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter by Game</Text>
              <TouchableOpacity 
                onPress={() => setShowGameFilter(false)}
                style={styles.closeFilterButton}
              >
                <X size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={[{ id: null, name: 'All Games', imageUrl: '' }, ...allGamesForFilter]}
              renderItem={({ item }) => {
                const itemId = item.id as number | null;
                const clipCount = itemId 
                  ? allClips.filter((r: any) => r.game?.id === itemId).length
                  : allClips.length;
                const hasContent = clipCount > 0 || !itemId;
                const isSelected = selectedGame === (itemId ? itemId.toString() : null);
                
                return (
                  <TouchableOpacity
                    style={[
                      styles.gameFilterThumbnailCard,
                      isSelected && styles.gameFilterThumbnailActive,
                      !hasContent && itemId && styles.gameFilterThumbnailDisabled,
                    ]}
                    onPress={() => {
                      if (!hasContent) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        return;
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedGame(itemId ? itemId.toString() : null);
                      setShowGameFilter(false);
                    }}
                    activeOpacity={hasContent ? 0.7 : 1}
                  >
                    <View style={styles.thumbnailWrapper}>
                      {!itemId ? (
                        <LinearGradient
                          colors={['#1E293B', '#131F2A']}
                          style={styles.allGamesThumbnail}
                        >
                          <Gamepad2 size={32} color="#4ADE80" />
                        </LinearGradient>
                      ) : (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.gameThumbnail}
                          contentFit="cover"
                          transition={200}
                        />
                      )}
                      {!hasContent && itemId && (
                        <View style={styles.greyedOutOverlay}>
                          <Text style={styles.noContentText}>No Clips</Text>
                        </View>
                      )}
                      {isSelected && (
                        <View style={styles.selectedOverlay}>
                          <View style={styles.selectedBadge}>
                            <View style={styles.checkmark} />
                          </View>
                        </View>
                      )}
                      {hasContent && clipCount > 0 && (
                        <View style={styles.clipCountBadge}>
                          <Text style={styles.clipCountBadgeText}>{clipCount}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.gameThumbnailInfo}>
                      <Text 
                        style={[
                          styles.gameThumbnailName,
                          !hasContent && itemId && styles.gameThumbnailNameDisabled,
                          isSelected && styles.gameThumbnailNameActive
                        ]} 
                        numberOfLines={2}
                      >
                        {item.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => `game-filter-${item.id || 'all'}`}
              contentContainerStyle={styles.gameFilterList}
              numColumns={3}
              columnWrapperStyle={styles.gameFilterRow}
              showsVerticalScrollIndicator={false}
            />
          </View>
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
  clipsCount: {
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  closeFilterButton: {
    padding: 4,
  },
  gameFilterList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  gameFilterRow: {
    gap: 8,
    marginBottom: 8,
  },
  gameFilterThumbnailCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
    overflow: 'hidden',
    maxWidth: '32%',
  },
  gameFilterThumbnailActive: {
    borderColor: '#4ADE80',
    borderWidth: 2,
  },
  gameFilterThumbnailDisabled: {
    opacity: 0.5,
  },
  thumbnailWrapper: {
    width: '100%',
    aspectRatio: 0.75,
    position: 'relative' as const,
  },
  allGamesThumbnail: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameThumbnail: {
    width: '100%',
    height: '100%',
  },
  greyedOutOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 21, 32, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noContentText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600' as const,
  },
  selectedOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  selectedBadge: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    width: 6,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: '#002E15',
    transform: [{ rotate: '45deg' }],
    marginLeft: 1,
    marginBottom: 2,
  },
  clipCountBadge: {
    position: 'absolute' as const,
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  clipCountBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  gameThumbnailInfo: {
    padding: 8,
  },
  gameThumbnailName: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
  },
  gameThumbnailNameActive: {
    color: '#4ADE80',
  },
  gameThumbnailNameDisabled: {
    color: '#64748B',
  },
});
