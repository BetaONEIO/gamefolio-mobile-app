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
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Image,
} from 'react-native';
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
  Maximize,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useVideoPlayer, VideoView } from 'expo-video';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import * as Haptics from 'expo-haptics';
import FlameAnimation from '@/components/FlameAnimation';
import { shortenGameName, truncateTitle, formatNumber } from '@/constants/formatters';
import Slider from '@react-native-community/slider';
import * as ScreenOrientation from 'expo-screen-orientation';
import { CommentText } from '@/utils/parseCommentText';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  _count: { likes: number; comments: number; fires?: number };
  isLiked?: boolean;
  isFired?: boolean;
}

interface Comment {
  id: number;
  userId: number;
  content: string;
  createdAt: string;
  user: UserBasic;
}

interface ClipItemProps {
  item: ClipWithUser;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onUserPress: (username: string) => void;
  onLike: () => void;
  onFire: () => void;
  onShare: () => void;
  showComments: boolean;
  onToggleComments: () => void;
  comments: Comment[];
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onSubmitComment: () => void;
  isLoadingComments: boolean;
  isTabFocused: boolean;
  itemHeight: number;
}

const ClipItem = React.memo(({
  item,
  isActive,
  isMuted,
  onToggleMute,
  onUserPress,
  onLike,
  onFire,
  onShare,
  showComments,
  onToggleComments,
  comments,
  commentText,
  onCommentTextChange,
  onSubmitComment,
  isLoadingComments,
  isTabFocused,
  itemHeight,
}: ClipItemProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [duration, setDuration] = useState(item.duration || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);

  const playIconOpacity = useRef(new Animated.Value(0)).current;
  const commentsSlideAnim = useRef(new Animated.Value(0)).current;
  const commentsListRef = useRef<FlatList>(null);
  const nativeVideoRef = useRef<VideoView>(null);

  const player = useVideoPlayer(item.videoUrl, (p) => {
    p.loop = true;
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    Animated.spring(commentsSlideAnim, {
      toValue: showComments ? 1 : 0,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  }, [showComments, commentsSlideAnim]);

  useEffect(() => {
    if (isActive && isTabFocused) {
      try { player.play(); } catch {}
    } else {
      try { player.pause(); } catch {}
    }
  }, [isActive, player, isTabFocused]);

  useEffect(() => {
    player.volume = isMuted ? 0 : 1;
  }, [isMuted, player]);

  useEffect(() => {
    const playingSub = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
    });
    const statusSub = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') setDuration(player.duration);
    });
    const interval = setInterval(() => {
      if (!isSeeking) setCurrentTime(player.currentTime);
    }, 100);
    return () => {
      playingSub.remove();
      statusSub.remove();
      clearInterval(interval);
    };
  }, [player, isSeeking]);

  useEffect(() => {
    return () => { try { player.pause(); } catch {} };
  }, [player]);

  const togglePlayPause = useCallback(() => {
    try {
      if (isPlaying) { player.pause(); } else { player.play(); }
    } catch {}
    setShowPlayIcon(true);
    Animated.sequence([
      Animated.timing(playIconOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.delay(300),
      Animated.timing(playIconOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowPlayIcon(false));
  }, [isPlaying, player, playIconOpacity]);

  const toggleFullScreen = useCallback(() => {
    if (nativeVideoRef.current) nativeVideoRef.current.enterFullscreen();
  }, []);

  const onFullscreenEnter = useCallback(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  }, []);

  const onFullscreenExit = useCallback(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  const onSeek = useCallback((value: number) => {
    setIsSeeking(true);
    setCurrentTime(value);
  }, []);

  const onSeekComplete = useCallback((value: number) => {
    player.currentTime = value;
    setIsSeeking(false);
    if (!isPlaying) player.play();
  }, [player, isPlaying]);

  const lastTap = useRef<number>(0);
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLike();
    } else {
      setShowControls(prev => !prev);
    }
    lastTap.current = now;
  }, [onLike]);

  const videoHeight = commentsSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [itemHeight, itemHeight * 0.35],
  });
  const commentsHeight = commentsSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, itemHeight * 0.65],
  });

  const renderCommentItem = useCallback(({ item: c }: { item: Comment }) => (
    <TouchableOpacity style={styles.commentItem} onPress={() => onUserPress(c.user.username)} activeOpacity={0.7}>
      <Image source={{ uri: c.user.avatarUrl }} style={styles.commentAvatar} />
      <View style={styles.commentContent}>
        <Text style={styles.commentText}>
          <Text style={styles.commentUsername}>{c.user.displayName}</Text>{' '}
          <CommentText content={c.content} />
        </Text>
      </View>
    </TouchableOpacity>
  ), [onUserPress]);

  return (
    <View style={[styles.clipContainer, { height: itemHeight }]}>
      <Animated.View style={[styles.videoSection, { height: videoHeight, justifyContent: 'center' }]}>
        <View style={{ width: '100%', aspectRatio: 16 / 9 }}>
          <TouchableOpacity activeOpacity={1} style={styles.videoTouchable} onPress={handleTap}>
            <VideoView
              ref={nativeVideoRef}
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls={false}
              onFullscreenEnter={onFullscreenEnter}
              onFullscreenExit={onFullscreenExit}
            />

            {showPlayIcon && (
              <Animated.View style={[styles.playIconOverlay, { opacity: playIconOpacity }]}>
                <View style={styles.playIconCircle}>
                  {isPlaying ? (
                    <Pause size={40} color="#FFF" fill="#FFF" />
                  ) : (
                    <Play size={40} color="#FFF" fill="#FFF" />
                  )}
                </View>
              </Animated.View>
            )}

            {!showComments && (
              <>
                <TouchableOpacity
                  style={styles.fullScreenButton}
                  onPress={toggleFullScreen}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Maximize size={20} color="#FFF" />
                </TouchableOpacity>

                {showControls && (
                  <TouchableOpacity
                    activeOpacity={1}
                    style={styles.videoControls}
                    onPress={(e) => e.stopPropagation()}
                  >
                    <View style={styles.controlsRow}>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={(e) => { e.stopPropagation(); togglePlayPause(); }}
                      >
                        {isPlaying ? (
                          <Pause size={20} color="#FFF" fill="#FFF" />
                        ) : (
                          <Play size={20} color="#FFF" fill="#FFF" />
                        )}
                      </TouchableOpacity>
                      <View style={styles.sliderContainer}>
                        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                        <Slider
                          style={styles.slider}
                          minimumValue={0}
                          maximumValue={duration}
                          value={currentTime}
                          onValueChange={onSeek}
                          onSlidingComplete={onSeekComplete}
                          minimumTrackTintColor="#4ADE80"
                          maximumTrackTintColor="rgba(255,255,255,0.3)"
                          thumbTintColor="#4ADE80"
                        />
                        <Text style={styles.timeText}>{formatTime(duration)}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.controlButton}
                        onPress={(e) => { e.stopPropagation(); onToggleMute(); }}
                      >
                        {isMuted ? <VolumeX size={20} color="#FFF" /> : <Volume2 size={20} color="#FFF" />}
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                )}
              </>
            )}
          </TouchableOpacity>
        </View>

        {showComments && (
          <View style={[styles.miniInfo, { paddingTop: insets.top + 50 }]}>
            <TouchableOpacity style={styles.miniUserRow} onPress={() => onUserPress(item.user.username)}>
              <Image source={{ uri: item.user.avatarUrl }} style={styles.miniAvatar} />
              <Text style={styles.miniUsername}>@{item.user.username}</Text>
            </TouchableOpacity>
            <Text style={styles.miniTitle} numberOfLines={1}>{truncateTitle(item.title)}</Text>
          </View>
        )}
      </Animated.View>

      {!showComments && (
        <View style={[styles.clipOverlay, { paddingBottom: insets.bottom + 60 }]}>
          <View style={styles.clipTopInfo}>
            <TouchableOpacity style={styles.userRow} onPress={() => onUserPress(item.user.username)}>
              <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
              <Text style={styles.username}>@{item.user.username}</Text>
            </TouchableOpacity>
            <Text style={styles.clipTitle} numberOfLines={2}>{truncateTitle(item.title, 34)}</Text>
            {item.game ? (
              <TouchableOpacity
                style={styles.gameRow}
                onPress={() => router.push({ pathname: '/game/[id]', params: { id: item.game.id.toString() } })}
                activeOpacity={0.7}
              >
                <Gamepad2 size={14} color="#4ADE80" />
                <Text style={styles.gameText}>{shortenGameName(item.game.name)}</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.clipActions}>
            <TouchableOpacity style={styles.actionButton} onPress={onLike}>
              <Heart
                size={24}
                color={item.isLiked ? '#EF4444' : '#FFF'}
                fill={item.isLiked ? '#EF4444' : 'transparent'}
              />
              <Text style={styles.actionText}>{formatNumber(item._count?.likes || 0)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onFire}>
              {item.isFired ? (
                <FlameAnimation isActive={false} size={24} />
              ) : (
                <Flame size={24} color="#FFF" fill="transparent" />
              )}
              <Text style={styles.actionText}>{formatNumber(item._count?.fires || 0)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onToggleComments}>
              <MessageSquare size={24} color="#FFF" />
              <Text style={styles.actionText}>{formatNumber(item._count?.comments || 0)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onShare}>
              <Share2 size={24} color="#FFF" />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.viewsBadge}>
        <Eye size={12} color="#FFF" />
        <Text style={styles.viewsText}>{formatNumber(item.views)}</Text>
      </View>

      <Animated.View style={[styles.commentsSection, { height: commentsHeight }]}>
        <View style={styles.commentsHeader}>
          <View style={styles.dragHandle} />
          <Text style={styles.commentsTitle}>Comments ({item._count?.comments || 0})</Text>
          <TouchableOpacity style={styles.closeComments} onPress={onToggleComments}>
            <X size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.commentsListWrapper, keyboardHeight > 0 ? { flex: 1, marginBottom: 0 } : null]}>
          {isLoadingComments ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" color="#4ADE80" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.noComments}>
              <MessageSquare size={40} color="#64748B" />
              <Text style={styles.noCommentsText}>No comments yet</Text>
              <Text style={styles.noCommentsSubtext}>Be the first to comment!</Text>
            </View>
          ) : (
            <FlatList
              ref={commentsListRef}
              data={comments}
              renderItem={renderCommentItem}
              keyExtractor={(c) => `comment-${c.id}`}
              contentContainerStyle={[styles.commentsList, keyboardHeight > 0 ? { paddingBottom: 8 } : null]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? itemHeight * 0.35 + 60 : 0}
          style={styles.commentInputWrapper}
        >
          <View style={[styles.commentInputContainer, { paddingBottom: Math.max(insets.bottom, 8) + 60 }]}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor="#64748B"
              value={commentText}
              onChangeText={onCommentTextChange}
              multiline
            />
            <TouchableOpacity
              style={[styles.postButton, !commentText ? styles.postButtonDisabled : null]}
              disabled={!commentText}
              onPress={onSubmitComment}
            >
              <Text style={[styles.postButtonText, commentText ? styles.postButtonTextActive : null]}>Post</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
});

ClipItem.displayName = 'ClipItem';

export default function LatestClipsPage() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);
  const [showGameFilter, setShowGameFilter] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [showClipComments, setShowClipComments] = useState(false);
  const [clipCommentText, setClipCommentText] = useState('');
  const [localClipComments, setLocalClipComments] = useState<Comment[]>([]);

  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const ITEM_HEIGHT = SCREEN_HEIGHT - tabBarHeight;
  const { getAccessToken, user } = useAuth();
  const queryClient = useQueryClient();

  useFocusEffect(
    useCallback(() => {
      setIsTabFocused(true);
      return () => {
        setIsTabFocused(false);
      };
    }, [])
  );

  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(prev => !prev);
  }, []);

  const toggleClipComments = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowClipComments(prev => !prev);
  }, []);

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

  const activeClipId = filteredClips[activeIndex]?.id;

  const { data: clipCommentsData, isLoading: isLoadingClipComments } = useQuery({
    queryKey: ['clips', 'comments', activeClipId],
    queryFn: async () => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/clips/${activeClipId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!activeClipId && showClipComments,
  });

  useEffect(() => {
    if (clipCommentsData) setLocalClipComments(clipCommentsData as Comment[]);
  }, [clipCommentsData]);

  useEffect(() => {
    setLocalClipComments([]);
  }, [activeClipId]);

  const addCommentMutation = useMutation({
    mutationFn: async ({ clipId, content }: { clipId: number; content: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/clips/${clipId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
            avatarUrl: user.avatarUrl || '',
          },
        };
        setLocalClipComments(prev => [newComment, ...prev]);
      }
      queryClient.invalidateQueries({ queryKey: ['clips', 'comments', activeClipId] });
    },
  });

  const handleCommentSubmit = useCallback(() => {
    if (!clipCommentText.trim() || !activeClipId || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addCommentMutation.mutate({ clipId: activeClipId, content: clipCommentText.trim() });
    setClipCommentText('');
    Keyboard.dismiss();
  }, [clipCommentText, activeClipId, user, addCommentMutation]);

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
        games.set(clip.game.id.toString(), { id: clip.game.id, name: clip.game.name, imageUrl: clip.game.imageUrl });
      }
    });
    return Array.from(games.values());
  }, [allClips]);

  const gamesWithoutContent = React.useMemo(() => {
    if (!topGamesData?.games) return [];
    const existingGameIds = new Set(uniqueGames.map(g => g.id.toString()));
    return topGamesData.games
      .filter(game => !existingGameIds.has(game.id))
      .map(game => ({ id: parseInt(game.id), name: game.name, imageUrl: game.boxArt }));
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

  const onViewableItemsChangedRef = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setShowClipComments(false);
      Keyboard.dismiss();
      setActiveIndex(viewableItems[0].index);
    }
  });

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 });

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  }), [ITEM_HEIGHT]);

  const renderClipItem = useCallback(({ item, index }: { item: ClipWithUser; index: number }) => (
    <ClipItem
      item={item}
      isActive={index === activeIndex}
      isMuted={isMuted}
      onToggleMute={toggleMute}
      onUserPress={handleUserPress}
      onLike={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        likeClipMutation.mutate(item.id);
      }}
      onFire={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        fireClipMutation.mutate(item.id);
      }}
      onShare={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      showComments={index === activeIndex && showClipComments}
      onToggleComments={toggleClipComments}
      comments={index === activeIndex ? localClipComments : []}
      commentText={clipCommentText}
      onCommentTextChange={setClipCommentText}
      onSubmitComment={handleCommentSubmit}
      isLoadingComments={isLoadingClipComments}
      isTabFocused={isTabFocused}
      itemHeight={ITEM_HEIGHT}
    />
  ), [activeIndex, isMuted, toggleMute, handleUserPress, isTabFocused, likeClipMutation, fireClipMutation, showClipComments, toggleClipComments, localClipComments, clipCommentText, handleCommentSubmit, isLoadingClipComments, ITEM_HEIGHT]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Floating header */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/home');
          }}
        >
          <ArrowLeft size={20} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowGameFilter(true);
          }}
        >
          <Gamepad2 size={14} color="#4ADE80" />
          <Text style={styles.filterText}>{selectedGameName}</Text>
          <ChevronDown size={14} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.clipCountBadge}>
          <Text style={styles.clipCountText}>{filteredClips.length}</Text>
        </View>
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
          ref={flatListRef}
          data={filteredClips}
          renderItem={renderClipItem}
          keyExtractor={(item) => `clip-${item.id}`}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          onViewableItemsChanged={onViewableItemsChangedRef.current}
          viewabilityConfig={viewabilityConfig.current}
          getItemLayout={getItemLayout}
          removeClippedSubviews
          maxToRenderPerBatch={3}
          windowSize={5}
          initialNumToRender={2}
        />
      )}

      {/* Game filter modal */}
      <Modal
        visible={showGameFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGameFilter(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowGameFilter(false)} />
          <View style={[styles.filterModal, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>Filter by Game</Text>
              <TouchableOpacity onPress={() => setShowGameFilter(false)} style={styles.closeFilter}>
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
                      styles.gameCard,
                      isSelected ? styles.gameCardActive : null,
                      !hasContent && itemId ? styles.gameCardDisabled : null,
                    ]}
                    onPress={() => {
                      if (!hasContent) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); return; }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedGame(itemId ? itemId.toString() : null);
                      setShowGameFilter(false);
                    }}
                    activeOpacity={hasContent ? 0.7 : 1}
                  >
                    <View style={styles.gameThumbnailWrapper}>
                      {!itemId ? (
                        <LinearGradient colors={['#1E293B', '#131F2A']} style={styles.allGamesThumbnail}>
                          <Gamepad2 size={28} color="#4ADE80" />
                        </LinearGradient>
                      ) : (
                        <Image source={{ uri: item.imageUrl }} style={styles.gameThumbnail} />
                      )}
                      {!hasContent && itemId ? (
                        <View style={styles.greyedOverlay}>
                          <Text style={styles.noContentText}>No Clips</Text>
                        </View>
                      ) : null}
                      {isSelected ? <View style={styles.selectedOverlay} /> : null}
                      {hasContent && clipCount > 0 ? (
                        <View style={styles.gameClipCount}>
                          <Text style={styles.gameClipCountText}>{clipCount}</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.gameNameContainer}>
                      <Text
                        style={[
                          styles.gameName,
                          !hasContent && itemId ? styles.gameNameDisabled : null,
                          isSelected ? styles.gameNameActive : null,
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
    backgroundColor: '#000',
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
    zIndex: 100,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  filterText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  clipCountBadge: {
    marginLeft: 'auto' as any,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  clipCountText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  centered: {
    flex: 1,
    backgroundColor: '#0F1C28',
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
  clipContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  videoSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  videoTouchable: {
    flex: 1,
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenButton: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    zIndex: 20,
  },
  videoControls: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  timeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500' as const,
    minWidth: 40,
    textAlign: 'center',
  },
  miniInfo: {
    position: 'absolute' as const,
    top: 0,
    left: 16,
    right: 16,
  },
  miniUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  miniUsername: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  miniTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  clipOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    pointerEvents: 'box-none',
  },
  clipTopInfo: {
    marginBottom: 4,
    pointerEvents: 'auto',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
    marginRight: 10,
  },
  username: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  clipTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  gameText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  clipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 24,
    pointerEvents: 'auto',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  viewsBadge: {
    position: 'absolute' as const,
    top: 60,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  viewsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  commentsSection: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    position: 'absolute' as const,
    top: 8,
    left: '50%' as any,
    marginLeft: -20,
  },
  commentsTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
    textAlign: 'center',
  },
  closeComments: {
    padding: 4,
  },
  commentsListWrapper: {
    flex: 1,
  },
  commentsLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noComments: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 24,
  },
  noCommentsText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  noCommentsSubtext: {
    color: '#64748B',
    fontSize: 14,
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentContent: {
    flex: 1,
  },
  commentText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
  commentUsername: {
    color: '#FFF',
    fontWeight: '700' as const,
  },
  commentInputWrapper: {
    backgroundColor: '#131F2A',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    maxHeight: 80,
  },
  postButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  postButtonDisabled: {
    opacity: 0.4,
  },
  postButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  postButtonTextActive: {
    color: '#4ADE80',
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
  closeFilter: {
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
  gameCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#334155',
    overflow: 'hidden',
    maxWidth: '32%',
  },
  gameCardActive: {
    borderColor: '#4ADE80',
    borderWidth: 2,
  },
  gameCardDisabled: {
    opacity: 0.5,
  },
  gameThumbnailWrapper: {
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
  greyedOverlay: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
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
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(74, 222, 128, 0.18)',
  },
  gameClipCount: {
    position: 'absolute' as const,
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  gameClipCountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  gameNameContainer: {
    padding: 6,
  },
  gameName: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  gameNameDisabled: {
    color: '#475569',
  },
  gameNameActive: {
    color: '#4ADE80',
    fontWeight: '700' as const,
  },
});
