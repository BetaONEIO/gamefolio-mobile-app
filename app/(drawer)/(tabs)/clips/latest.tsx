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
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronDown,
  Gamepad2,
  X,
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  Flame,
  MessageSquare,
  Share2,
  Eye,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVideoPlayer, VideoView } from 'expo-video';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 16;
const VIDEO_WIDTH = SCREEN_WIDTH - CARD_PADDING * 2;
const VIDEO_HEIGHT = VIDEO_WIDTH * (9 / 16);

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

function formatViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface ClipCardProps {
  clip: ClipWithUser;
  isActive: boolean;
  onLike: () => void;
  onFire: () => void;
  onUserPress: (username: string) => void;
  onGamePress: (gameId: number) => void;
}

function ClipCard({ clip, isActive, onLike, onFire, onUserPress, onGamePress }: ClipCardProps) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);

  const player = useVideoPlayer(clip.videoUrl || '', (p) => {
    p.loop = true;
    p.muted = false;
  });

  useEffect(() => {
    if (!isActive && playing) {
      try { player.pause(); } catch {}
      setPlaying(false);
    }
  }, [isActive]);

  useEffect(() => {
    try { player.muted = muted; } catch {}
  }, [muted]);

  const togglePlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (playing) {
      try { player.pause(); } catch {}
      setPlaying(false);
    } else {
      try { player.play(); } catch {}
      setPlaying(true);
    }
  }, [playing, player]);

  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMuted(prev => !prev);
  }, []);

  return (
    <View style={styles.clipCard}>
      <View style={styles.videoContainer}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="cover"
          nativeControls={false}
        />

        {!playing && (
          <Image
            source={{ uri: clip.thumbnailUrl }}
            style={[styles.video, StyleSheet.absoluteFillObject]}
            contentFit="cover"
          />
        )}

        <Pressable style={styles.videoOverlay} onPress={togglePlay}>
          {!playing && (
            <View style={styles.playButton}>
              <Play size={28} color="#FFF" fill="#FFF" />
            </View>
          )}
        </Pressable>

        <View style={styles.videoTopRow}>
          {clip.duration > 0 ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(clip.duration)}</Text>
            </View>
          ) : <View />}
          {playing ? (
            <TouchableOpacity style={styles.muteButton} onPress={toggleMute}>
              {muted ? (
                <VolumeX size={16} color="#FFF" />
              ) : (
                <Volume2 size={16} color="#FFF" />
              )}
            </TouchableOpacity>
          ) : <View />}
        </View>
      </View>

      <View style={styles.clipInfo}>
        <View style={styles.clipInfoTop}>
          <TouchableOpacity onPress={() => onUserPress(clip.user?.username)}>
            <Image
              source={{ uri: clip.user?.avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
            />
          </TouchableOpacity>
          <View style={styles.clipMeta}>
            <Text style={styles.clipTitle} numberOfLines={2}>{clip.title}</Text>
            <View style={styles.clipMetaRow}>
              <TouchableOpacity onPress={() => onUserPress(clip.user?.username)}>
                <Text style={styles.clipUsername}>@{clip.user?.username}</Text>
              </TouchableOpacity>
              {clip.game && (
                <>
                  <Text style={styles.metaDot}> · </Text>
                  <TouchableOpacity onPress={() => onGamePress(clip.game.id)}>
                    <Text style={styles.clipGame}>{clip.game.name}</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        <View style={styles.clipActions}>
          <View style={styles.statItem}>
            <Eye size={14} color="#64748B" />
            <Text style={styles.statText}>{formatViews(clip.views ?? 0)}</Text>
          </View>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onLike();
            }}
          >
            <Heart
              size={18}
              color={clip.isLiked ? '#F43F5E' : '#94A3B8'}
              fill={clip.isLiked ? '#F43F5E' : 'none'}
            />
            <Text style={[styles.actionText, clip.isLiked && styles.actionTextActive]}>
              {clip._count?.likes ?? 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onFire();
            }}
          >
            <Flame
              size={18}
              color={clip.isFired ? '#F97316' : '#94A3B8'}
              fill={clip.isFired ? '#F97316' : 'none'}
            />
            <Text style={[styles.actionText, clip.isFired && styles.actionTextFire]}>
              {clip._count?.fires ?? 0}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function LatestClipsPage() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [showGameFilter, setShowGameFilter] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTabFocused, setIsTabFocused] = useState(true);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { getAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      setIsTabFocused(true);
      return () => {
        setIsTabFocused(false);
        setActiveIndex(-1);
      };
    }, [])
  );

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

  const { data: allClipsData = [], isLoading } = useQuery({
    queryKey: ['clips', 'all-latest'],
    queryFn: async () => {
      const token = await getAccessToken();
      try {
        const clips = await api.clips.getFeed(token || undefined, { page: 1, limit: 100 });
        const clipsOnly = clips.filter((c: any) => c.videoType !== 'reel');
        if (clipsOnly.length > 0) return clipsOnly;
        const latest = await api.clips.getLatest(token || undefined);
        return (latest || []).filter((c: any) => c.videoType !== 'reel');
      } catch {
        const latest = await api.clips.getLatest(token || undefined);
        return (latest || []).filter((c: any) => c.videoType !== 'reel');
      }
    },
  });

  const allClips = allClipsData as ClipWithUser[];

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

  const handleGamePress = useCallback((gameId: number) => {
    router.push({ pathname: '/game/[id]', params: { id: gameId.toString() } });
  }, [router]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  });

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const renderClipItem = useCallback(({ item, index }: { item: ClipWithUser; index: number }) => (
    <ClipCard
      clip={item}
      isActive={isTabFocused && index === activeIndex}
      onLike={() => likeClipMutation.mutate(item.id)}
      onFire={() => fireClipMutation.mutate(item.id)}
      onUserPress={handleUserPress}
      onGamePress={handleGamePress}
    />
  ), [activeIndex, isTabFocused, handleUserPress, handleGamePress, likeClipMutation, fireClipMutation]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#131F2A', '#061021']} style={StyleSheet.absoluteFill} />
      <StatusBar barStyle="light-content" />
      <AppHeader />

      <View style={[styles.subHeader, { paddingTop: 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/home');
          }}
        >
          <ArrowLeft size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Latest Clips</Text>
        <Text style={styles.clipsCount}>{filteredClips.length}</Text>
      </View>

      <View style={styles.filterBar}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowGameFilter(true);
          }}
        >
          <Gamepad2 size={16} color="#4ADE80" />
          <Text style={styles.filterText}>{selectedGameName}</Text>
          <ChevronDown size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Loading clips...</Text>
        </View>
      ) : filteredClips.length === 0 ? (
        <View style={styles.centered}>
          <Gamepad2 size={48} color="#334155" />
          <Text style={styles.emptyTitle}>No clips found</Text>
          <Text style={styles.emptySubtitle}>
            {selectedGame ? 'Try a different game filter' : 'Check back later for new content'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredClips}
          renderItem={renderClipItem}
          keyExtractor={(item) => `clip-${item.id}`}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          removeClippedSubviews
          maxToRenderPerBatch={4}
          windowSize={5}
          initialNumToRender={3}
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
              <TouchableOpacity onPress={() => setShowGameFilter(false)} style={styles.closeFilterButton}>
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
                      styles.gameFilterCard,
                      isSelected && styles.gameFilterCardActive,
                      !hasContent && itemId ? styles.gameFilterCardDisabled : null,
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
                        <LinearGradient colors={['#1E293B', '#131F2A']} style={styles.allGamesThumbnail}>
                          <Gamepad2 size={28} color="#4ADE80" />
                        </LinearGradient>
                      ) : (
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.gameThumbnail}
                          contentFit="cover"
                          transition={200}
                        />
                      )}
                      {!hasContent && itemId ? (
                        <View style={styles.greyedOutOverlay}>
                          <Text style={styles.noContentText}>No Clips</Text>
                        </View>
                      ) : null}
                      {isSelected && (
                        <View style={styles.selectedOverlay} />
                      )}
                      {hasContent && clipCount > 0 ? (
                        <View style={styles.clipCountBadge}>
                          <Text style={styles.clipCountBadgeText}>{clipCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.gameThumbnailInfo}>
                      <Text
                        style={[
                          styles.gameThumbnailName,
                          !hasContent && itemId ? styles.gameThumbnailNameDisabled : null,
                          isSelected ? styles.gameThumbnailNameActive : null,
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
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  clipsCount: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600' as const,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filterBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignSelf: 'flex-start',
  },
  filterText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '500' as const,
  },
  emptyTitle: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 12,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  listContent: {
    paddingTop: 8,
    gap: 2,
  },
  clipCard: {
    marginHorizontal: CARD_PADDING,
    marginVertical: 8,
    backgroundColor: '#0F1C28',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  videoContainer: {
    width: VIDEO_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: '#000',
    position: 'relative' as const,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  videoTopRow: {
    position: 'absolute' as const,
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  durationBadge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  durationText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  muteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipInfo: {
    padding: 12,
    gap: 10,
  },
  clipInfoTop: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
  },
  clipMeta: {
    flex: 1,
    gap: 3,
  },
  clipTitle: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  clipMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  clipUsername: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  metaDot: {
    color: '#475569',
    fontSize: 12,
  },
  clipGame: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  clipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingTop: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  actionTextActive: {
    color: '#F43F5E',
  },
  actionTextFire: {
    color: '#F97316',
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
    fontSize: 18,
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
  gameFilterCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
    overflow: 'hidden',
    maxWidth: '32%',
  },
  gameFilterCardActive: {
    borderColor: '#4ADE80',
    borderWidth: 2,
  },
  gameFilterCardDisabled: {
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
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
  },
  clipCountBadge: {
    position: 'absolute' as const,
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  clipCountBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  gameThumbnailInfo: {
    padding: 6,
  },
  gameThumbnailName: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  gameThumbnailNameDisabled: {
    color: '#475569',
  },
  gameThumbnailNameActive: {
    color: '#4ADE80',
    fontWeight: '700' as const,
  },
});
