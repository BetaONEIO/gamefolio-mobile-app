import { useAuth } from '@/context/AuthContext';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, ScrollView, Keyboard, Modal, StatusBar, PanResponder, GestureResponderEvent, LayoutChangeEvent, FlatList, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import ShareClipModal from '@/components/ShareClipModal';
import { Heart, MessageSquare, Flame, Share2, Send, Flag, Play, Pause, Volume2, VolumeX, Maximize, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { api, Clip } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import AppHeader from '@/components/AppHeader';
import { LinearGradient } from 'expo-linear-gradient';
import ReelViewer, { ReelData, Comment as ReelComment } from '@/components/ReelViewer';
import FlameAnimation from '@/components/FlameAnimation';



const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type VideoElement = HTMLVideoElement & { pause: () => void; play: () => void };

const timeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

const ExpandableText = ({ text, maxLength = 150 }: { text: string; maxLength?: number }) => {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > maxLength;

  if (!needsTruncation) {
    return <Text style={styles.description}>{text}</Text>;
  }

  return (
    <Text style={styles.description}>
      {expanded ? text : `${text.substring(0, maxLength)}...`}
      {!expanded && needsTruncation && (
        <Text style={styles.seeMoreButton} onPress={() => setExpanded(true)}>
          {' '}see more
        </Text>
      )}
    </Text>
  );
};

// Memoized video component for non-active clips (shows thumbnail)
const ClipThumbnail = React.memo(({ clipItem }: { clipItem: Clip }) => (
  <Image
    source={{ uri: clipItem.thumbnailUrl }}
    style={styles.video}
    resizeMode="cover"
  />
));

ClipThumbnail.displayName = 'ClipThumbnail';

export default function ClipDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const clipId = Array.isArray(id) ? id[0] : id;
  const insets = useSafeAreaInsets();
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const clipsFlatListRef = useRef<FlatList>(null);
  const [comment, setComment] = useState('');
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<VideoElement | null>(null);
  const fullscreenVideoRef = useRef<VideoElement | null>(null);
  const progressBarWidthRef = useRef<number>(0);
  const fullscreenProgressBarWidthRef = useRef<number>(0);
  const [, setIsSeeking] = useState(false);
  const [localIsLiked, setLocalIsLiked] = useState(false);
  const [localIsFired, setLocalIsFired] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(0);
  const [localFireCount, setLocalFireCount] = useState(0);
  const [showFlameAnimation, setShowFlameAnimation] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;
  
  const { getAccessToken, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all clips for horizontal scrolling
  const { data: allClips = [] } = useQuery<Clip[]>({
    queryKey: ['clips', 'feed'],
    queryFn: async () => {
      const token = await getAccessToken();
      console.log('[ClipDetail] Fetching all clips for swipe navigation');
      try {
        const clips = await api.clips.getFeed(token || undefined, { page: 1, limit: 50 });
        return clips.filter(c => c.videoType !== 'reel');
      } catch (error) {
        console.log('[ClipDetail] Error fetching clips:', error);
        return [];
      }
    },
  });

  // Find the index of current clip in all clips
  useEffect(() => {
    if (allClips.length > 0 && clipId) {
      const index = allClips.findIndex(c => c.id.toString() === clipId);
      if (index !== -1 && index !== currentClipIndex) {
        setCurrentClipIndex(index);
        // Scroll to the clip without animation on initial load
        setTimeout(() => {
          clipsFlatListRef.current?.scrollToIndex({ index, animated: false });
        }, 100);
      }
    }
  }, [allClips, clipId, currentClipIndex]);

  const { data: clip, isLoading } = useQuery<Clip>({
    queryKey: ['clip', clipId],
    queryFn: async () => {
      const token = await getAccessToken();
      console.log('[ClipDetail] Fetching clip:', clipId);
      const clipData = await api.clips.getClip(clipId || '', token || undefined);
      console.log('[ClipDetail] Received clip data:', clipData);
      return clipData;
    },
    enabled: !!clipId,
  });

  useEffect(() => {
    if (clip) {
      setLocalIsLiked(clip.isLiked || false);
      setLocalIsFired(clip.isFired || false);
      setLocalLikeCount(clip._count?.likes || 0);
      setLocalFireCount(clip._count?.fires || 0);
    }
  }, [clip]);

  const { data: comments = [], refetch: refetchComments } = useQuery<any[]>({
    queryKey: ['clip', clipId, 'comments'],
    queryFn: async () => {
      const token = await getAccessToken();
      const commentsData = await api.clips.getComments(clipId || '', token || undefined);
      return commentsData;
    },
    enabled: !!clipId,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.addComment(clipId || '', { content }, token);
    },
    onSuccess: () => {
      setComment('');
      Keyboard.dismiss();
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ['clip', clipId] });
    },
  });

  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const playerRef = useRef<any>(null);
  
  const player = useVideoPlayer(clip?.videoUrl || '', (player) => {
    if (player) {
      player.loop = false;
      playerRef.current = player;
      setPlayerInstance(player);
    }
  });

  useEffect(() => {
    if (player) {
      playerRef.current = player;
      setPlayerInstance(player);
    }
  }, [player]);

  useEffect(() => {
    if (clip?.videoUrl && playerRef.current) {
      const timer = setTimeout(() => {
        try {
          const p = playerRef.current;
          if (p && typeof p.play === 'function' && p.playing === false) {
            p.play();
            setIsPlaying(true);
          }
        } catch (error) {
          console.log('[ClipDetail] Error playing video:', error);
        }
      }, 100);
      
      return () => {
        clearTimeout(timer);
        try {
          const p = playerRef.current;
          if (p && typeof p.pause === 'function') {
            if (p.playing === true) {
              p.pause();
              setIsPlaying(false);
            }
          }
        } catch (error) {
          console.log('[ClipDetail] Error pausing video in cleanup:', error);
        }
      };
    }
  }, [clip?.videoUrl]);

  useEffect(() => {
    try {
      const p = playerRef.current;
      if (p && typeof p.volume !== 'undefined') {
        p.volume = isMuted ? 0 : 1;
      }
    } catch (error) {
      console.log('[ClipDetail] Error setting volume:', error);
    }
  }, [isMuted]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    let rafId: number;
    let lastUpdate = 0;
    const updateInterval = 100;
    
    const updateTime = () => {
      const now = Date.now();
      if (now - lastUpdate >= updateInterval) {
        try {
          const p = playerRef.current;
          if (p && typeof p.currentTime !== 'undefined' && typeof p.duration !== 'undefined') {
            setCurrentTime(p.currentTime);
            setDuration(p.duration);
            lastUpdate = now;
          }
        } catch (error) {
          console.log('[ClipDetail] Error updating time:', error);
        }
      }
      rafId = requestAnimationFrame(updateTime);
    };
    
    rafId = requestAnimationFrame(updateTime);
    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [playerInstance]);

  const togglePlayPause = useCallback(() => {
    if (Platform.OS === 'web') {
      if (isPlaying) {
        videoRef.current?.pause();
        fullscreenVideoRef.current?.pause();
        setIsPlaying(false);
      } else {
        videoRef.current?.play().catch(() => {});
        fullscreenVideoRef.current?.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      try {
        const p = playerRef.current;
        if (p && typeof p.pause === 'function' && typeof p.play === 'function') {
          if (isPlaying && p.playing) {
            p.pause();
            setIsPlaying(false);
          } else if (!isPlaying && !p.playing) {
            p.play();
            setIsPlaying(true);
          }
        }
      } catch (error) {
        console.log('[ClipDetail] Error toggling play/pause:', error);
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (Platform.OS === 'web') {
      if (videoRef.current) videoRef.current.muted = newMuted;
      if (fullscreenVideoRef.current) fullscreenVideoRef.current.muted = newMuted;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isMuted]);



  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVideoPress = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleSeek = useCallback((locationX: number, barWidth: number, isFullscreenSeek: boolean = false) => {
    if (duration <= 0 || barWidth <= 0) return;
    const seekPercentage = Math.max(0, Math.min(1, locationX / barWidth));
    const seekTime = seekPercentage * duration;
    
    if (Platform.OS === 'web') {
      if (isFullscreenSeek && fullscreenVideoRef.current) {
        fullscreenVideoRef.current.currentTime = seekTime;
      } else if (videoRef.current) {
        videoRef.current.currentTime = seekTime;
      }
    } else {
      try {
        const p = playerRef.current;
        if (p && typeof p.currentTime !== 'undefined') {
          p.currentTime = seekTime;
        }
      } catch (error) {
        console.log('[ClipDetail] Error seeking:', error);
      }
    }
    setCurrentTime(seekTime);
  }, [duration]);

  const createProgressPanResponder = useCallback((isFullscreenBar: boolean) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        setIsSeeking(true);
        const barWidth = isFullscreenBar ? fullscreenProgressBarWidthRef.current : progressBarWidthRef.current;
        const locationX = evt.nativeEvent.locationX;
        handleSeek(locationX, barWidth, isFullscreenBar);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const barWidth = isFullscreenBar ? fullscreenProgressBarWidthRef.current : progressBarWidthRef.current;
        const locationX = evt.nativeEvent.locationX;
        handleSeek(locationX, barWidth, isFullscreenBar);
      },
      onPanResponderRelease: () => {
        setIsSeeking(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderTerminate: () => {
        setIsSeeking(false);
      },
    });
  }, [handleSeek]);

  const progressPanResponder = useRef(createProgressPanResponder(false)).current;
  const fullscreenProgressPanResponder = useRef(createProgressPanResponder(true)).current;

  const handleProgressBarLayout = useCallback((event: LayoutChangeEvent) => {
    progressBarWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  const handleFullscreenProgressBarLayout = useCallback((event: LayoutChangeEvent) => {
    fullscreenProgressBarWidthRef.current = event.nativeEvent.layout.width;
  }, []);

  const handleFullscreen = useCallback(async () => {
    console.log('Fullscreen requested');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Capture current playback state before entering fullscreen
    const wasPlaying = isPlaying;
    let currentTimeValue = 0;
    
    if (Platform.OS === 'web') {
      currentTimeValue = videoRef.current?.currentTime || 0;
    } else {
      try {
        const p = playerRef.current;
        currentTimeValue = p?.currentTime || 0;
      } catch (error) {
        console.log('[ClipDetail] Error getting current time:', error);
      }
    }
    
    setIsFullscreen(true);
    
    if (Platform.OS !== 'web') {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (error) {
        console.log('Failed to lock orientation:', error);
      }
    } else {
      // On web, sync fullscreen video with main video
      setTimeout(() => {
        if (fullscreenVideoRef.current) {
          fullscreenVideoRef.current.currentTime = currentTimeValue;
          fullscreenVideoRef.current.muted = isMuted;
          if (wasPlaying) {
            fullscreenVideoRef.current.play().catch(() => {});
          } else {
            fullscreenVideoRef.current.pause();
          }
        }
        // Pause the main video while fullscreen is active
        videoRef.current?.pause();
      }, 50);
    }
  }, [isPlaying, isMuted]);

  const handleExitFullscreen = async () => {
    console.log('Exiting fullscreen');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (Platform.OS === 'web' && fullscreenVideoRef.current && videoRef.current) {
      // Sync main video with fullscreen video state
      const currentTimeValue = fullscreenVideoRef.current.currentTime;
      const wasPlaying = !fullscreenVideoRef.current.paused;
      
      videoRef.current.currentTime = currentTimeValue;
      if (wasPlaying) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
    
    setIsFullscreen(false);
    if (Platform.OS !== 'web') {
      try {
        await ScreenOrientation.unlockAsync();
      } catch (error) {
        console.log('Failed to unlock orientation:', error);
      }
    }
  };

  const handlePostComment = () => {
    if (comment.trim().length === 0) return;
    addCommentMutation.mutate(comment.trim());
  };

  const likeMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.like(clipId || '', token);
    },
    onSuccess: (data) => {
      setLocalLikeCount(data.likeCount);
      queryClient.invalidateQueries({ queryKey: ['clip', clipId] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  });

  const fireMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.fire(clipId || '', token);
    },
    onSuccess: (data) => {
      setLocalFireCount(data.fireCount);
      queryClient.invalidateQueries({ queryKey: ['clip', clipId] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
  });

  const { mutate: mutateLikeAction } = likeMutation;
  const handleLike = useCallback(() => {
    const newLikedState = !localIsLiked;
    setLocalIsLiked(newLikedState);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(likeScale, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
    mutateLikeAction();
  }, [localIsLiked, likeScale, mutateLikeAction]);

  const { mutate: mutateFireAction } = fireMutation;
  const handleFire = useCallback(() => {
    const newFiredState = !localIsFired;
    setLocalIsFired(newFiredState);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowFlameAnimation(true);
    setTimeout(() => setShowFlameAnimation(false), 1500);
    mutateFireAction();
  }, [localIsFired, mutateFireAction]);

  const [isMutedForReel, setIsMutedForReel] = useState(false);
  const [showReelComments, setShowReelComments] = useState(false);
  const [reelCommentText, setReelCommentText] = useState('');
  const [localReelComments, setLocalReelComments] = useState<ReelComment[]>([]);
  const { user } = useAuth();

  const { data: reelCommentsData, isLoading: isLoadingReelComments } = useQuery<any[]>({
    queryKey: ['clip', clipId, 'reel-comments'],
    queryFn: async () => {
      const token = await getAccessToken();
      const commentsData = await api.clips.getComments(clipId || '', token || undefined);
      return commentsData;
    },
    enabled: !!clipId && clip?.videoType === 'reel',
  });

  useEffect(() => {
    if (reelCommentsData) {
      const mappedComments: ReelComment[] = reelCommentsData.map((c: any) => ({
        id: c.id,
        userId: c.user.id,
        content: c.content,
        createdAt: c.createdAt,
        user: {
          id: c.user.id,
          username: c.user.username,
          displayName: c.user.displayName || c.user.username,
          avatarUrl: c.user.avatarUrl,
        },
      }));
      setLocalReelComments(mappedComments);
    }
  }, [reelCommentsData]);

  const addReelCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.addComment(clipId || '', { content }, token);
    },
    onSuccess: (data: any, variables) => {
      if (user) {
        const newComment: ReelComment = {
          id: data?.id || Date.now(),
          userId: user.id,
          content: variables,
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
      setReelCommentText('');
      Keyboard.dismiss();
      queryClient.invalidateQueries({ queryKey: ['clip', clipId] });
    },
  });

  const toggleReelMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMutedForReel(prev => !prev);
  }, []);

  const toggleReelComments = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowReelComments(prev => !prev);
  }, []);

  const { mutate: mutateReelComment } = addReelCommentMutation;
  const handleReelCommentSubmit = useCallback(() => {
    if (!reelCommentText.trim() || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mutateReelComment(reelCommentText.trim());
  }, [reelCommentText, user, mutateReelComment]);

  const handleReelUserPress = useCallback((username: string) => {
    router.push({ pathname: '/user/[id]', params: { id: username } });
  }, [router]);

  const { mutate: mutateLike } = likeMutation;
  const handleReelLike = useCallback(() => {
    mutateLike();
  }, [mutateLike]);

  const { mutate: mutateFire } = fireMutation;
  const handleReelFire = useCallback(() => {
    mutateFire();
  }, [mutateFire]);

  const handleReelShare = useCallback(() => {
    setIsShareModalVisible(true);
  }, []);

  const handleReelClose = useCallback(() => {
    try {
      const p = playerRef.current;
      if (p && typeof p.pause === 'function' && p.playing) {
        p.pause();
      }
    } catch (error) {
      console.log('[ClipDetail] Error pausing in handleReelClose:', error);
    }
    router.back();
  }, [router]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentClipIndex) {
        setCurrentClipIndex(newIndex);
        const newClip = allClips[newIndex];
        if (newClip) {
          // Update URL without navigating
          router.setParams({ id: newClip.id.toString() });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  }), []);

  // Render individual clip item for horizontal FlatList - must be before early returns
  const renderClipItem = useCallback(({ item: clipItem, index }: { item: Clip; index: number }) => {
    const isCurrentClip = index === currentClipIndex;
    
    return (
      <View style={styles.clipItemContainer}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={handleVideoPress} 
            style={styles.videoContainer}
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setIsHovering(true),
              onMouseLeave: () => {
                setIsHovering(false);
                setShowControls(false);
              },
            } : {}) as any}
          >
            {isCurrentClip ? (
              Platform.OS === 'web' ? (
                <video
                  ref={videoRef as any}
                  src={clipItem.videoUrl}
                  poster={clipItem.thumbnailUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    backgroundColor: '#000',
                  } as any}
                  autoPlay
                  loop
                  playsInline
                  muted={isMuted}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={(e: any) => {
                    setCurrentTime(e.target.currentTime);
                    setDuration(e.target.duration || 0);
                  }}
                />
              ) : playerInstance ? (
                <VideoView
                  player={playerInstance}
                  style={styles.video}
                  contentFit="cover"
                  nativeControls={false}
                />
              ) : (
                <Image
                  source={{ uri: clipItem.thumbnailUrl }}
                  style={styles.video}
                  resizeMode="cover"
                />
              )
            ) : (
              <ClipThumbnail clipItem={clipItem} />
            )}

            {/* Always visible play/pause overlay when paused */}
            {!isPlaying && isCurrentClip && (
              <TouchableOpacity 
                style={styles.playOverlay} 
                onPress={(e) => { e.stopPropagation(); togglePlayPause(); }}
                activeOpacity={0.8}
              >
                <View style={styles.playButtonLarge}>
                  <Play size={40} color="#FFF" fill="#FFF" />
                </View>
              </TouchableOpacity>
            )}

            {/* Views counter overlay */}
            <View style={styles.viewsOverlay}>
              <Text style={styles.viewsOverlayText}>👁 {formatNumber(clipItem.views || 190)}</Text>
            </View>

            {/* Controls overlay - shows on hover/tap */}
            {isCurrentClip && (
              <View 
                style={[
                  styles.controlsOverlay, 
                  { opacity: showControls || isHovering || !isPlaying ? 1 : 0 }
                ]} 
                pointerEvents={showControls || isHovering || !isPlaying ? 'auto' : 'none'}
              >
                <View style={styles.controlsGradient} />
                <View style={styles.progressBarContainer}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <View
                    style={styles.progressBar}
                    onLayout={handleProgressBarLayout}
                    {...(Platform.OS === 'web' ? {
                      onMouseDown: (e: any) => {
                        e.stopPropagation();
                        setIsSeeking(true);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const locationX = e.clientX - rect.left;
                        handleSeek(locationX, rect.width, false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const moveLocationX = moveEvent.clientX - rect.left;
                          handleSeek(moveLocationX, rect.width, false);
                        };
                        
                        const handleMouseUp = () => {
                          setIsSeeking(false);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      },
                    } : progressPanResponder.panHandlers) as any}
                  >
                    <View 
                      style={[
                        styles.progressFill, 
                        { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                      ]} 
                      pointerEvents="none"
                    />
                    <View
                      style={[
                        styles.progressHandle,
                        { left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                      ]}
                      pointerEvents="none"
                    />
                  </View>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>

                <View style={styles.bottomControls}>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); togglePlayPause(); }} style={styles.controlButton}>
                    {isPlaying ? (
                      <Pause size={24} color="#FFF" fill="#FFF" />
                    ) : (
                      <Play size={24} color="#FFF" fill="#FFF" />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleMute(); }} style={styles.controlButton}>
                    {isMuted ? (
                      <VolumeX size={24} color="#FFF" />
                    ) : (
                      <Volume2 size={24} color="#FFF" />
                    )}
                  </TouchableOpacity>

                  <View style={{ flex: 1 }} />

                  <TouchableOpacity 
                    onPress={(e) => { e.stopPropagation(); handleFullscreen(); }} 
                    style={styles.fullscreenButton} 
                    activeOpacity={0.7}
                  >
                    <Maximize size={22} color="#4ADE80" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* Clip Content */}
          <View style={styles.contentContainer}>
            <TouchableOpacity 
              style={styles.userRow}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: clipItem.user.id.toString() } })}
            >
              <Image source={{ uri: clipItem.user.avatarUrl }} style={styles.avatar} />
              <Text style={styles.username}>@{clipItem.user.username}</Text>
            </TouchableOpacity>

            <Text style={styles.title}>{clipItem.title}</Text>
            {clipItem.description && (
              <ExpandableText text={clipItem.description} maxLength={150} />
            )}

            {clipItem.game && (
              <TouchableOpacity
                style={styles.gameTag}
                onPress={(e) => {
                  e?.stopPropagation();
                  router.push({ pathname: '/game/[id]', params: { id: clipItem.game.id.toString() } });
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.gameTagText}>{clipItem.game.name}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.metadataRow}>
              <Text style={styles.metadataText}>📅 {timeAgo(clipItem.createdAt)}</Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                  <Heart 
                    size={24} 
                    color={localIsLiked ? "#4ADE80" : "#64748B"} 
                    fill={localIsLiked ? "#4ADE80" : "transparent"}
                  />
                </Animated.View>
                <Text style={styles.actionCount}>{formatNumber(localLikeCount)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleFire}>
                {showFlameAnimation ? (
                  <FlameAnimation isActive={true} size={24} />
                ) : (
                  <Flame 
                    size={24} 
                    color={localIsFired ? "#FF6B2C" : "#64748B"} 
                    fill={localIsFired ? "#FF6B2C" : "transparent"}
                  />
                )}
                <Text style={styles.actionCount}>{formatNumber(localFireCount)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => setIsCommentsModalVisible(true)}>
                <MessageSquare size={24} color="#64748B" />
                <Text style={styles.actionCount}>{formatNumber(clipItem._count?.comments || 0)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => setIsShareModalVisible(true)}>
                <Share2 size={24} color="#64748B" />
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              <TouchableOpacity style={styles.reportButton}>
                <Flag size={20} color="#64748B" />
                <Text style={styles.reportText}>Report</Text>
              </TouchableOpacity>
            </View>

            {/* Comments Section */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsSectionTitle}>Comments</Text>
              
              {(clipItem._count?.comments || 0) > 0 ? (
                <TouchableOpacity onPress={() => setIsCommentsModalVisible(true)} style={styles.viewAllCommentsButton}>
                  <Text style={styles.viewAllCommentsText}>View all {clipItem._count?.comments || 0} comments</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.noInlineCommentsText}>No comments yet</Text>
              )}
              
              <TouchableOpacity 
                style={styles.addCommentButton} 
                onPress={() => setIsCommentsModalVisible(true)}
                activeOpacity={0.7}
              >
                <MessageSquare size={18} color="#64748B" />
                <Text style={styles.addCommentText}>Add a comment...</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }, [currentClipIndex, isMuted, isPlaying, showControls, isHovering, currentTime, duration, playerInstance, insets.bottom, handleSeek, handleProgressBarLayout, progressPanResponder, router, handleVideoPress, togglePlayPause, toggleMute, handleFullscreen, handleLike, handleFire, localIsLiked, localIsFired, localLikeCount, localFireCount, showFlameAnimation, likeScale]);

  if (isLoading || !clip) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#4ADE80" style={{ marginTop: 100 }} />
      </View>
    );
  }

  // If this is a reel, use the full-screen reel viewer style
  if (clip.videoType === 'reel') {
    const reelData: ReelData = {
      id: clip.id,
      userId: clip.userId,
      gameId: clip.gameId,
      title: clip.title,
      description: clip.description || '',
      videoUrl: clip.videoUrl,
      thumbnailUrl: clip.thumbnailUrl,
      videoType: clip.videoType,
      duration: clip.duration,
      views: clip.views || 0,
      shareCode: clip.shareCode,
      ageRestricted: clip.ageRestricted,
      createdAt: clip.createdAt,
      user: {
        id: clip.user.id,
        username: clip.user.username,
        displayName: clip.user.displayName || clip.user.username,
        avatarUrl: clip.user.avatarUrl,
      },
      game: clip.game ? {
        id: clip.game.id,
        name: clip.game.name,
        imageUrl: clip.game.imageUrl || '',
      } : { id: 0, name: '', imageUrl: '' },
      _count: {
        likes: clip._count?.likes || 0,
        comments: clip._count?.comments || 0,
        fires: clip._count?.fires || 0,
      },
      isLiked: clip.isLiked,
      isFired: clip.isFired,
    };

    return (
      <View style={styles.reelViewerContainer}>
        <StatusBar barStyle="light-content" />
        <ReelViewer
          item={reelData}
          isActive={true}
          isMuted={isMutedForReel}
          onToggleMute={toggleReelMute}
          onUserPress={handleReelUserPress}
          onLike={handleReelLike}
          onFire={handleReelFire}
          onShare={handleReelShare}
          showComments={showReelComments}
          onToggleComments={toggleReelComments}
          comments={localReelComments}
          commentText={reelCommentText}
          onCommentTextChange={setReelCommentText}
          onSubmitComment={handleReelCommentSubmit}
          isLoadingComments={isLoadingReelComments}
          isTabFocused={true}
          onClose={handleReelClose}
        />
        <ShareClipModal 
          visible={isShareModalVisible} 
          onClose={() => setIsShareModalVisible(false)} 
          isOwnClip={clip?.userId === currentUser?.id}
          clip={clip} 
        />
      </View>
    );
  }

  // Regular clip view with horizontal scroll
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F1520', '#020617']}
        style={StyleSheet.absoluteFill}
      />
      
      {/* App Header */}
      <AppHeader showBackButton />

      {/* Top navigation with arrows and dots */}
      {allClips.length > 1 && (
        <View style={styles.topNavigation}>
          <TouchableOpacity 
            style={[styles.navArrow, currentClipIndex === 0 && styles.navArrowDisabled]}
            onPress={() => {
              if (currentClipIndex > 0) {
                clipsFlatListRef.current?.scrollToIndex({ index: currentClipIndex - 1, animated: true });
              }
            }}
            disabled={currentClipIndex === 0}
          >
            <ChevronLeft size={24} color={currentClipIndex === 0 ? '#64748B' : '#FFF'} />
          </TouchableOpacity>
          
          <View style={styles.topNavDots}>
            {allClips.slice(Math.max(0, currentClipIndex - 2), Math.min(allClips.length, currentClipIndex + 3)).map((_, i) => {
              const actualIndex = Math.max(0, currentClipIndex - 2) + i;
              return (
                <TouchableOpacity
                  key={actualIndex}
                  onPress={() => {
                    clipsFlatListRef.current?.scrollToIndex({ index: actualIndex, animated: true });
                  }}
                >
                  <View 
                    style={[
                      styles.topNavDot,
                      actualIndex === currentClipIndex && styles.topNavDotActive
                    ]} 
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          
          <TouchableOpacity 
            style={[styles.navArrow, currentClipIndex === allClips.length - 1 && styles.navArrowDisabled]}
            onPress={() => {
              if (currentClipIndex < allClips.length - 1) {
                clipsFlatListRef.current?.scrollToIndex({ index: currentClipIndex + 1, animated: true });
              }
            }}
            disabled={currentClipIndex === allClips.length - 1}
          >
            <ChevronRight size={24} color={currentClipIndex === allClips.length - 1 ? '#64748B' : '#FFF'} />
          </TouchableOpacity>
        </View>
      )}

      {allClips.length > 0 ? (
        <FlatList
          ref={clipsFlatListRef}
          data={allClips}
          renderItem={renderClipItem}
          keyExtractor={(item) => `clip-${item.id}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          snapToInterval={SCREEN_WIDTH}
          decelerationRate="fast"
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={getItemLayout}
          initialScrollIndex={currentClipIndex}
          onScrollToIndexFailed={() => {}}
          removeClippedSubviews={Platform.OS !== 'web'}
          maxToRenderPerBatch={2}
          windowSize={3}
          initialNumToRender={1}
          extraData={currentClipIndex}
        />
      ) : (
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity 
          activeOpacity={1} 
          onPress={handleVideoPress} 
          style={styles.videoContainer}
          {...(Platform.OS === 'web' ? {
            onMouseEnter: () => setIsHovering(true),
            onMouseLeave: () => {
              setIsHovering(false);
              setShowControls(false);
            },
          } : {}) as any}
        >
          {Platform.OS === 'web' ? (
            <video
              ref={videoRef as any}
              src={clip.videoUrl}
              poster={clip.thumbnailUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                backgroundColor: '#000',
              } as any}
              autoPlay
              loop
              playsInline
              muted={isMuted}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onTimeUpdate={(e: any) => {
                setCurrentTime(e.target.currentTime);
                setDuration(e.target.duration || 0);
              }}
            />
          ) : playerInstance ? (
            <VideoView
              player={playerInstance}
              style={styles.video}
              contentFit="cover"
              nativeControls={false}
            />
          ) : (
            <Image
              source={{ uri: clip.thumbnailUrl }}
              style={styles.video}
              resizeMode="cover"
            />
          )}

          {/* Always visible play/pause overlay when paused */}
          {!isPlaying && (
            <TouchableOpacity 
              style={styles.playOverlay} 
              onPress={(e) => { e.stopPropagation(); togglePlayPause(); }}
              activeOpacity={0.8}
            >
              <View style={styles.playButtonLarge}>
                <Play size={40} color="#FFF" fill="#FFF" />
              </View>
            </TouchableOpacity>
          )}

          {/* Views counter overlay */}
          <View style={styles.viewsOverlay}>
            <Text style={styles.viewsOverlayText}>👁 {formatNumber(clip.views || 190)}</Text>
          </View>

          {/* Controls overlay - shows on hover/tap */}
          <View 
            style={[
              styles.controlsOverlay, 
              { opacity: showControls || isHovering || !isPlaying ? 1 : 0 }
            ]} 
            pointerEvents={showControls || isHovering || !isPlaying ? 'auto' : 'none'}
          >
            <View style={styles.controlsGradient} />
            <View style={styles.progressBarContainer}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <View
                style={styles.progressBar}
                onLayout={handleProgressBarLayout}
                {...(Platform.OS === 'web' ? {
                  onMouseDown: (e: any) => {
                    e.stopPropagation();
                    setIsSeeking(true);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const locationX = e.clientX - rect.left;
                    handleSeek(locationX, rect.width, false);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    
                    const handleMouseMove = (moveEvent: MouseEvent) => {
                      const moveLocationX = moveEvent.clientX - rect.left;
                      handleSeek(moveLocationX, rect.width, false);
                    };
                    
                    const handleMouseUp = () => {
                      setIsSeeking(false);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  },
                } : progressPanResponder.panHandlers) as any}
              >
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                  ]} 
                  pointerEvents="none"
                />
                <View
                  style={[
                    styles.progressHandle,
                    { left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                  ]}
                  pointerEvents="none"
                />
              </View>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>

            <View style={styles.bottomControls}>
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); togglePlayPause(); }} style={styles.controlButton}>
                {isPlaying ? (
                  <Pause size={24} color="#FFF" fill="#FFF" />
                ) : (
                  <Play size={24} color="#FFF" fill="#FFF" />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleMute(); }} style={styles.controlButton}>
                {isMuted ? (
                  <VolumeX size={24} color="#FFF" />
                ) : (
                  <Volume2 size={24} color="#FFF" />
                )}
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              {/* Fullscreen button */}
              <TouchableOpacity 
                onPress={(e) => { e.stopPropagation(); handleFullscreen(); }} 
                style={styles.fullscreenButton} 
                activeOpacity={0.7}
              >
                <Maximize size={22} color="#4ADE80" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.contentContainer}>
          <TouchableOpacity 
            style={styles.userRow}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: clip.user.id.toString() } })}
          >
            <Image source={{ uri: clip.user.avatarUrl }} style={styles.avatar} />
            <Text style={styles.username}>@{clip.user.username}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{clip.title}</Text>
          {clip.description && (
            <ExpandableText text={clip.description} maxLength={150} />
          )}

          {clip.game && (
            <View style={styles.gameTag}>
              <Text style={styles.gameTagText}>{clip.game.name}</Text>
            </View>
          )}

          <View style={styles.metadataRow}>
            <Text style={styles.metadataText}>📅 {timeAgo(clip.createdAt)}</Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Heart 
                  size={24} 
                  color={localIsLiked ? "#4ADE80" : "#64748B"} 
                  fill={localIsLiked ? "#4ADE80" : "transparent"}
                />
              </Animated.View>
              <Text style={styles.actionCount}>{formatNumber(localLikeCount)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleFire}>
              {showFlameAnimation ? (
                <FlameAnimation isActive={true} size={24} />
              ) : (
                <Flame 
                  size={24} 
                  color={localIsFired ? "#FF6B2C" : "#64748B"} 
                  fill={localIsFired ? "#FF6B2C" : "transparent"}
                />
              )}
              <Text style={styles.actionCount}>{formatNumber(localFireCount)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => setIsCommentsModalVisible(true)}>
              <MessageSquare size={24} color="#64748B" />
              <Text style={styles.actionCount}>{formatNumber(comments.length)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => setIsShareModalVisible(true)}>
              <Share2 size={24} color="#64748B" />
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity style={styles.reportButton}>
              <Flag size={20} color="#64748B" />
              <Text style={styles.reportText}>Report</Text>
            </TouchableOpacity>
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsSectionTitle}>Comments</Text>
            
            {comments.length > 0 ? (
              <>
                {comments.slice(0, 3).map((commentItem: any) => (
                  <View key={commentItem.id} style={styles.inlineCommentItem}>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/user/[id]', params: { id: commentItem.user.username } })}>
                      <Image source={{ uri: commentItem.user.avatarUrl }} style={styles.inlineCommentAvatar} />
                    </TouchableOpacity>
                    <View style={styles.inlineCommentContent}>
                      <Text style={styles.inlineCommentText} numberOfLines={2}>
                        <Text style={styles.inlineCommentUsername}>{commentItem.user.displayName || commentItem.user.username}</Text>
                        <Text style={styles.inlineCommentBody}> {commentItem.content}</Text>
                      </Text>
                    </View>
                  </View>
                ))}
                {comments.length > 3 && (
                  <TouchableOpacity onPress={() => setIsCommentsModalVisible(true)} style={styles.viewAllCommentsButton}>
                    <Text style={styles.viewAllCommentsText}>View all {comments.length} comments</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <Text style={styles.noInlineCommentsText}>No comments yet</Text>
            )}
            
            <TouchableOpacity 
              style={styles.addCommentButton} 
              onPress={() => setIsCommentsModalVisible(true)}
              activeOpacity={0.7}
            >
              <MessageSquare size={18} color="#64748B" />
              <Text style={styles.addCommentText}>Add a comment...</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      )}

      <Modal
        visible={isCommentsModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCommentsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { paddingTop: insets.top + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.commentsTitle}>Comments ({comments.length})</Text>
              <TouchableOpacity onPress={() => setIsCommentsModalVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.commentsScrollView}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {comments.length === 0 ? (
                <Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>
              ) : (
                comments.map((commentItem: any) => (
                  <View key={commentItem.id} style={styles.commentItem}>
                    <TouchableOpacity onPress={() => {
                      setIsCommentsModalVisible(false);
                      router.push({ pathname: '/user/[id]', params: { id: commentItem.user.username } });
                    }}>
                      <Image source={{ uri: commentItem.user.avatarUrl }} style={styles.commentAvatar} />
                    </TouchableOpacity>
                    <View style={styles.commentContent}>
                      <Text style={styles.commentText}>
                        <Text style={styles.commentUsername}>{commentItem.user.displayName || commentItem.user.username}</Text>
                        <Text style={styles.commentBody}> {commentItem.content}</Text>
                      </Text>
                      <Text style={styles.commentTime}>{timeAgo(commentItem.createdAt)}</Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={[styles.commentInputContainer, { paddingBottom: insets.bottom + 8 }]}
            >
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment..."
                placeholderTextColor="#64748B"
                value={comment}
                onChangeText={setComment}
              />
              <TouchableOpacity 
                style={[styles.sendButton, comment.trim().length > 0 && styles.sendButtonActive]}
                onPress={handlePostComment}
                disabled={comment.trim().length === 0 || addCommentMutation.isPending}
              >
                {addCommentMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Send size={20} color={comment.trim().length > 0 ? "#FFF" : "#64748B"} />
                )}
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>

      <ShareClipModal 
        visible={isShareModalVisible} 
        onClose={() => setIsShareModalVisible(false)} 
        isOwnClip={clip?.userId === currentUser?.id}
        clip={clip} 
      />

      {/* Fullscreen Modal */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        transparent={false}
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={handleExitFullscreen}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={() => setShowControls(!showControls)} 
            style={styles.fullscreenVideoWrapper}
          >
            {Platform.OS === 'web' ? (
              <video
                ref={fullscreenVideoRef as any}
                src={allClips.length > 0 && allClips[currentClipIndex] ? allClips[currentClipIndex].videoUrl : clip.videoUrl}
                poster={allClips.length > 0 && allClips[currentClipIndex] ? allClips[currentClipIndex].thumbnailUrl : clip.thumbnailUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: '#000',
                } as any}
                loop
                playsInline
                muted={isMuted}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={(e: any) => {
                  setCurrentTime(e.target.currentTime);
                  setDuration(e.target.duration || 0);
                }}
              />
            ) : playerInstance ? (
              <VideoView
                player={playerInstance}
                style={styles.fullscreenVideo}
                contentFit="contain"
                nativeControls={false}
              />
            ) : null}

            {/* Fullscreen controls overlay */}
            <View style={[styles.fullscreenControlsOverlay, { opacity: showControls ? 1 : 0 }]} pointerEvents={showControls ? 'auto' : 'none'}>
              {/* Close button */}
              <TouchableOpacity 
                style={styles.fullscreenCloseButton}
                onPress={handleExitFullscreen}
                activeOpacity={0.7}
              >
                <X size={28} color="#FFF" />
              </TouchableOpacity>

              {/* Center play/pause */}
              <TouchableOpacity 
                style={styles.fullscreenCenterControl}
                onPress={(e) => { e.stopPropagation(); togglePlayPause(); }}
                activeOpacity={0.8}
              >
                <View style={styles.fullscreenPlayButton}>
                  {isPlaying ? (
                    <Pause size={48} color="#FFF" fill="#FFF" />
                  ) : (
                    <Play size={48} color="#FFF" fill="#FFF" />
                  )}
                </View>
              </TouchableOpacity>

              {/* Bottom controls */}
              <View style={styles.fullscreenBottomControls}>
                <View style={styles.fullscreenProgressContainer}>
                  <Text style={styles.fullscreenTimeText}>{formatTime(currentTime)}</Text>
                  <View
                    style={styles.fullscreenProgressBar}
                    onLayout={handleFullscreenProgressBarLayout}
                    {...(Platform.OS === 'web' ? {
                      onMouseDown: (e: any) => {
                        e.stopPropagation();
                        setIsSeeking(true);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const locationX = e.clientX - rect.left;
                        handleSeek(locationX, rect.width, true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                          const moveLocationX = moveEvent.clientX - rect.left;
                          handleSeek(moveLocationX, rect.width, true);
                        };
                        
                        const handleMouseUp = () => {
                          setIsSeeking(false);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          document.removeEventListener('mousemove', handleMouseMove);
                          document.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                      },
                    } : fullscreenProgressPanResponder.panHandlers) as any}
                  >
                    <View 
                      style={[
                        styles.fullscreenProgressFill, 
                        { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                      ]} 
                      pointerEvents="none"
                    />
                    <View
                      style={[
                        styles.fullscreenProgressHandle,
                        { left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                      ]}
                      pointerEvents="none"
                    />
                  </View>
                  <Text style={styles.fullscreenTimeText}>{formatTime(duration)}</Text>
                </View>

                <View style={styles.fullscreenButtonsRow}>
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleMute(); }} style={styles.fullscreenControlButton}>
                    {isMuted ? (
                      <VolumeX size={24} color="#FFF" />
                    ) : (
                      <Volume2 size={24} color="#FFF" />
                    )}
                  </TouchableOpacity>

                  <View style={{ flex: 1 }} />

                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleExitFullscreen(); }} style={styles.fullscreenControlButton}>
                    <Maximize size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
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
  reelViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  clipItemContainer: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  topNavigation: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(15, 21, 32, 0.9)',
    gap: 16,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  navArrowDisabled: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
  },
  topNavDots: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  topNavDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  topNavDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
  },
  closeButton: {
    position: 'absolute' as const,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 20,
  },
  scrollContainer: {
    flex: 1,
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative' as const,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  playButtonLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingLeft: 4,
  },
  controlsOverlay: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
  },
  controlsGradient: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    backgroundColor: 'transparent',
    backgroundImage: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
  },
  progressBarContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 12,
  },
  timeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
    minWidth: 40,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    position: 'relative' as const,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 2,
  },
  progressHandle: {
    position: 'absolute' as const,
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4ADE80',
    marginLeft: -8,
  },
  bottomControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  controlButton: {
    width: 32,
    height: 32,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  fullscreenButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.5)',
  },

  contentContainer: {
    padding: 16,
  },
  userRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  username: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 8,
  },
  description: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  gameTag: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start' as const,
    marginBottom: 12,
  },
  gameTagText: {
    color: '#0F1520',
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
  metadataRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
    marginBottom: 16,
  },
  metadataText: {
    color: '#64748B',
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  actionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  actionCount: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  reportButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  reportText: {
    color: '#64748B',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F1520',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.7,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center' as const,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  commentsTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold' as const,
  },
  closeText: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  commentsScrollView: {
    flex: 1,
  },
  noCommentsText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center' as const,
    marginTop: 40,
  },
  commentItem: {
    flexDirection: 'row' as const,
    marginBottom: 16,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
  },
  commentUsername: {
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  commentBody: {
    color: '#E2E8F0',
  },
  commentTime: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  commentInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  sendButtonActive: {
    backgroundColor: '#4ADE80',
  },
  seeMoreButton: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  commentsSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  commentsSectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold' as const,
    marginBottom: 12,
  },
  inlineCommentItem: {
    flexDirection: 'row' as const,
    marginBottom: 12,
  },
  inlineCommentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  inlineCommentContent: {
    flex: 1,
  },
  inlineCommentText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 18,
  },
  inlineCommentUsername: {
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  inlineCommentBody: {
    color: '#CBD5E1',
  },
  viewAllCommentsButton: {
    marginTop: 4,
    marginBottom: 12,
  },
  viewAllCommentsText: {
    color: '#64748B',
    fontSize: 14,
  },
  noInlineCommentsText: {
    color: '#64748B',
    fontSize: 14,
    marginBottom: 12,
  },
  addCommentButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  addCommentText: {
    color: '#64748B',
    fontSize: 14,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  fullscreenVideoWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  fullscreenVideo: {
    width: '100%',
    height: '100%',
  },
  fullscreenControlsOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between' as const,
  },
  fullscreenCloseButton: {
    position: 'absolute' as const,
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    zIndex: 10,
  },
  fullscreenCenterControl: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  fullscreenPlayButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingLeft: 4,
  },
  fullscreenBottomControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  fullscreenProgressContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 16,
  },
  fullscreenTimeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
    minWidth: 50,
  },
  fullscreenProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  fullscreenProgressFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 3,
  },
  fullscreenProgressHandle: {
    position: 'absolute' as const,
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4ADE80',
    marginLeft: -8,
  },
  fullscreenButtonsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  fullscreenControlButton: {
    width: 44,
    height: 44,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  viewsOverlay: {
    position: 'absolute' as const,
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 5,
  },
  viewsOverlayText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
});