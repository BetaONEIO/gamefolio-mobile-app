import { useAuth } from '@/context/AuthContext';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, ScrollView, Keyboard, Modal, StatusBar, PanResponder, GestureResponderEvent, LayoutChangeEvent, FlatList, Animated } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import ShareClipModal from '@/components/ShareClipModal';
import ReportModal from '@/components/ReportModal';

import { Heart, MessageSquare, Flame, Share2, Send, Flag, Play, Pause, Volume2, VolumeX, Maximize, X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ScreenOrientation from 'expo-screen-orientation';
import { api, Clip, TaggedUser, APIError } from '@/lib/api';
import { getGamefolioToken, forceRefreshGamefolioToken } from '@/lib/gamefolio-api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import AppHeader from '@/components/AppHeader';
import { LinearGradient } from 'expo-linear-gradient';
import ReelViewer, { ReelData, Comment as ReelComment } from '@/components/ReelViewer';
import FlameAnimation from '@/components/FlameAnimation';
import { CommentText } from '@/utils/parseCommentText';

let hasShownAuthError = false;

const getErrorMessage = (error: unknown, context?: string): { title: string; message: string; isAuthError: boolean; shouldShowAlert: boolean; shouldLogout?: boolean } => {
  if (error instanceof APIError) {
    if (error.status === 401) {
      // Don't auto-logout for fire/like actions - just show a message to retry
      const isReactionAction = context === 'fire' || context === 'like';
      if (isReactionAction) {
        return {
          title: 'Action Failed',
          message: 'Unable to complete this action. Please try again.',
          isAuthError: true,
          shouldShowAlert: false,
          shouldLogout: false,
        };
      }
      const shouldAlert = !hasShownAuthError;
      hasShownAuthError = true;
      return {
        title: 'Session Expired',
        message: 'Your session has expired. You will be logged out.',
        isAuthError: true,
        shouldShowAlert: shouldAlert,
        shouldLogout: true,
      };
    }
    if (error.status === 429) {
      return {
        title: 'Slow Down',
        message: error.message || 'You\'re doing that too fast. Please wait a moment and try again.',
        isAuthError: false,
        shouldShowAlert: false,
      };
    }
    if (error.status === 403) {
      return {
        title: 'Access Denied',
        message: 'You don\'t have permission to perform this action.',
        isAuthError: false,
        shouldShowAlert: false,
      };
    }
    return {
      title: 'Error',
      message: error.message || 'Something went wrong. Please try again.',
      isAuthError: false,
      shouldShowAlert: false,
    };
  }
  
  if (error instanceof Error) {
    if (error.message === 'Not authenticated') {
      const shouldAlert = !hasShownAuthError;
      hasShownAuthError = true;
      return {
        title: 'Session Expired',
        message: 'Your session has expired. You will be logged out.',
        isAuthError: true,
        shouldShowAlert: shouldAlert,
        shouldLogout: true,
      };
    }
    return {
      title: 'Error',
      message: error.message,
      isAuthError: false,
      shouldShowAlert: false,
    };
  }
  
  return {
    title: 'Error',
    message: 'An unexpected error occurred. Please try again.',
    isAuthError: false,
    shouldShowAlert: false,
  };
};



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

const formatNumber = (num: number | null | undefined): string => {
  const safeNum = typeof num === 'number' && !isNaN(num) ? num : 0;
  if (safeNum >= 1000000) {
    return (safeNum / 1000000).toFixed(1) + 'M';
  }
  if (safeNum >= 1000) {
    return (safeNum / 1000).toFixed(1) + 'K';
  }
  return safeNum.toString();
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
  const { id, fromUser, contentType } = useLocalSearchParams();
  const clipId = Array.isArray(id) ? id[0] : id;
  const fromUsername = Array.isArray(fromUser) ? fromUser[0] : fromUser;
  const browseContentType = Array.isArray(contentType) ? contentType[0] : contentType;
  const insets = useSafeAreaInsets();
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const currentClipIndexRef = useRef(0);
  currentClipIndexRef.current = currentClipIndex;
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
  const [localIsLiked, setLocalIsLiked] = useState<boolean | null>(null);
  const [localIsFired, setLocalIsFired] = useState<boolean | null>(null);
  const [localLikeCount, setLocalLikeCount] = useState<number | null>(null);
  const [localFireCount, setLocalFireCount] = useState<number | null>(null);
  const [localUserReactionId, setLocalUserReactionId] = useState<number | null>(null);
  const lastSyncedClipId = useRef<string | null>(null);
  const [showFlameAnimation, setShowFlameAnimation] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;
  const isLikeInProgress = useRef(false);
  const isFireInProgress = useRef(false);

  const [likeCooldown, setLikeCooldown] = useState(0);
  const [fireCooldown, setFireCooldown] = useState(0);
  const likeCooldownProgress = useRef(new Animated.Value(0)).current;
  const fireCooldownProgress = useRef(new Animated.Value(0)).current;
  const COOLDOWN_DURATION = 5000;
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'warning' | 'success' } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const showToast = useCallback((message: string, type: 'error' | 'warning' | 'success' = 'error') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ message, type });
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    toastTimeoutRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 3000);
  }, [toastOpacity]);
  
  const { getAccessToken, user: currentUser } = useAuth();
  
  const submitReportMutation = useMutation({
    mutationFn: async (data: { contentType: string; contentId: number; reason: string; details?: string; contentTitle?: string; reportedUserId?: number; reportedUsername?: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to submit report');
      return response.json();
    },
    onSuccess: () => {
      console.log('[ClipDetail] Report submitted successfully');
    },
    onError: (error) => {
      console.error('[ClipDetail] Error submitting report:', error);
    },
  });
  const queryClient = useQueryClient();

  const deleteClipMutation = useMutation({
    mutationFn: async (clipIdToDelete: string) => {
      console.log('[ClipDetail] Attempting to delete clip:', clipIdToDelete);
      let token = await getGamefolioToken();
      if (!token) {
        console.log('[ClipDetail] No Gamefolio token, trying to refresh...');
        token = await forceRefreshGamefolioToken();
      }
      if (!token) throw new Error('Not authenticated');
      console.log('[ClipDetail] Using Gamefolio token for delete');
      return api.clips.delete(clipIdToDelete, token);
    },
    onSuccess: () => {
      console.log('[ClipDetail] Clip deleted successfully');
      setIsDeleteModalVisible(false);
      setIsDeleting(false);
      queryClient.invalidateQueries({ queryKey: ['clips'] });
      queryClient.invalidateQueries({ queryKey: ['userClips'] });
      router.back();
    },
    onError: (error) => {
      console.error('[ClipDetail] Error deleting clip:', error);
      setIsDeleting(false);
      showToast('Failed to delete clip. Please try again.', 'error');
    },
  });

  // Fetch the specific clip first (used only for deep-link entry and reel branch)
  const { data: clip, isLoading } = useQuery<Clip>({
    queryKey: ['clip', clipId],
    queryFn: async () => {
      const token = await getAccessToken();
      console.log('[ClipDetail] Fetching clip:', clipId);
      const clipData = await api.clips.getClip(clipId || '', token || undefined);
      console.log('[ClipDetail] Received clip data:', clipData);
      console.log('[ClipDetail] clip.isFired from API:', clipData.isFired);
      return clipData;
    },
    enabled: !!clipId,
    staleTime: 60000,
  });

  // Fetch clips for swipe navigation - either from specific user or general feed
  // When contentType is specified, only browse that type (clips or reels)
  const { data: feedClips = [] } = useQuery<Clip[]>({
    queryKey: fromUsername ? ['userClips', fromUsername, browseContentType] : ['clips', 'feed', browseContentType],
    queryFn: async () => {
      const token = await getAccessToken();
      try {
        if (fromUsername) {
          console.log('[ClipDetail] Fetching content from user:', fromUsername, 'contentType:', browseContentType);
          const userClips = await api.users.getUserClips(fromUsername);
          if (browseContentType === 'reel') {
            return userClips.filter((c: Clip) => c.videoType === 'reel');
          } else if (browseContentType === 'clip') {
            return userClips.filter((c: Clip) => c.videoType !== 'reel');
          }
          return userClips.filter((c: Clip) => c.videoType !== 'reel');
        } else {
          console.log('[ClipDetail] Fetching all clips for swipe navigation');
          const clips = await api.clips.getFeed(token || undefined, { page: 1, limit: 50 });
          return clips.filter((c: Clip) => c.videoType !== 'reel');
        }
      } catch (error) {
        console.log('[ClipDetail] Error fetching clips:', error);
        return [];
      }
    },
    staleTime: 60000,
  });

  // Combine clips: ensure the current clip is always in the list
  const allClips = React.useMemo(() => {
    if (!clip) return feedClips;
    const clipExistsInFeed = feedClips.some(c => c.id.toString() === clipId);
    if (clipExistsInFeed) {
      return feedClips;
    }
    // Prepend the current clip if it's not in the feed (deep-linked clip not in feed)
    return [clip, ...feedClips];
  }, [feedClips, clip, clipId]);

  const allClipsRef = useRef(allClips);
  allClipsRef.current = allClips;

  // activeClip is the currently visible clip — drives all per-clip queries, never the URL param
  const activeClip = allClips[currentClipIndex] || null;
  const activeClipId = activeClip?.id?.toString() || clipId;

  const isOwnClip = activeClip?.userId === currentUser?.id || clip?.userId === currentUser?.id;

  // Find the index of current clip in all clips (only sync when URL param changes, not on swipe)
  useEffect(() => {
    if (allClips.length > 0 && clipId) {
      const index = allClips.findIndex(c => c.id.toString() === clipId);
      if (index !== -1 && index !== currentClipIndexRef.current) {
        setCurrentClipIndex(index);
        // Scroll to the clip without animation on initial load
        setTimeout(() => {
          clipsFlatListRef.current?.scrollToIndex({ index, animated: false });
        }, 100);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allClips, clipId]);

  // Sync URL param to the currently visible clip once when navigating away (blur).
  // This ensures that back-links / share URLs reflect the last-seen clip without
  // causing per-swipe query churn.
  useFocusEffect(
    useCallback(() => {
      return () => {
        const currentId = allClipsRef.current[currentClipIndexRef.current]?.id?.toString();
        if (currentId && currentId !== clipId) {
          router.setParams({ id: currentId });
        }
      };
    }, [clipId, router])
  );

  const EMOJI_OPTIONS = ['😮', '💯', '🎮', '👏', '🤣', '😍', '💀', '🤯'];

  // Query to check if user has fired the ACTIVE (currently visible) clip — keyed on activeClipId
  const { data: userFireStatus } = useQuery({
    queryKey: ['clip', activeClipId, 'fire-status', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id || !activeClipId) return { hasFired: false, userReactionId: null, fireCount: 0 };
      try {
        const token = await getGamefolioToken();
        if (!token) return { hasFired: false, userReactionId: null, fireCount: 0 };
        console.log('[ClipDetail] 🔍 BACKEND CHECK - Fetching fire status for clip:', activeClipId, 'user:', currentUser.id);
        const reactions = await api.clips.getReactions(activeClipId, token);
        const fireReactions = reactions.filter(r => r.emoji === '🔥');
        const userFireReaction = fireReactions.find(r => Number(r.userId) === Number(currentUser.id));
        const userHasFired = !!userFireReaction;
        console.log('[ClipDetail] 🔍 BACKEND RESULT - hasFired:', userHasFired, 'reactionId:', userFireReaction?.id, 'totalFires:', fireReactions.length);
        return { hasFired: userHasFired, fireCount: fireReactions.length, userReactionId: userFireReaction?.id || null };
      } catch (error) {
        console.log('[ClipDetail] Error checking fire status:', error);
        return { hasFired: false, userReactionId: null, fireCount: 0 };
      }
    },
    enabled: !!activeClipId && !!currentUser?.id,
    staleTime: 60000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const { data: allReactions = [], refetch: refetchReactions } = useQuery({
    queryKey: ['clip', activeClipId, 'all-reactions'],
    queryFn: async () => {
      if (!activeClipId) return [];
      try {
        const token = await getGamefolioToken();
        return await api.clips.getReactions(activeClipId, token || undefined);
      } catch {
        return [];
      }
    },
    enabled: !!activeClipId,
    staleTime: 60000,
  });

  const emojiCounts = React.useMemo(() => {
    const counts: Record<string, { count: number; userReacted: boolean; reactionId: number | null }> = {};
    allReactions.forEach((r: any) => {
      if (!counts[r.emoji]) counts[r.emoji] = { count: 0, userReacted: false, reactionId: null };
      counts[r.emoji].count++;
      if (currentUser && Number(r.userId) === Number(currentUser.id)) {
        counts[r.emoji].userReacted = true;
        counts[r.emoji].reactionId = r.id;
      }
    });
    return counts;
  }, [allReactions, currentUser]);

  const handleEmojiReact = async (emoji: string) => {
    setShowEmojiPicker(false);
    const token = await getGamefolioToken();
    if (!token) return;
    const existing = emojiCounts[emoji];
    try {
      if (existing?.userReacted && existing.reactionId) {
        await api.clips.deleteReaction(activeClipId!, existing.reactionId, token);
      } else {
        await api.clips.fire(activeClipId!, token, emoji);
      }
      refetchReactions();
    } catch (e) {
      showToast('Could not add reaction', 'error');
    }
  };

  const { mutate: deleteClip } = deleteClipMutation;
  const handleDeleteClip = useCallback(() => {
    if (!activeClipId) return;
    setIsDeleting(true);
    deleteClip(activeClipId);
  }, [activeClipId, deleteClip]);

  // Fast seed from in-memory feed data when swiping — avoids waiting for API round-trip
  useEffect(() => {
    if (!activeClip || isFireInProgress.current || isLikeInProgress.current) return;
    setLocalIsLiked(activeClip.isLiked === true);
    setLocalIsFired(activeClip.isFired === true);
    setLocalLikeCount(activeClip._count?.likes || 0);
    setLocalFireCount(activeClip._count?.fires || 0);
    setLocalUserReactionId(null);
    // Reset lastSyncedClipId so the backend sync effect will run for this clip
    lastSyncedClipId.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClipIndex]);

  useEffect(() => {
    // Only sync on initial load or clip change - don't continuously override local state
    if (lastSyncedClipId.current === activeClipId) {
      return;
    }
    
    // Skip sync if mutation is in progress
    if (isFireInProgress.current || isLikeInProgress.current) {
      console.log('[ClipDetail] Skipping initial sync - mutation in progress');
      return;
    }
    
    // Backend sync: override feed-seeded values with accurate backend data
    if (activeClip && userFireStatus) {
      const backendHasFired = userFireStatus.hasFired === true;
      const backendFireCount = userFireStatus.fireCount ?? 0;
      
      console.log('[ClipDetail] 📡 INITIAL SYNC FROM BACKEND:');
      console.log('[ClipDetail]   - Backend hasFired:', backendHasFired);
      console.log('[ClipDetail]   - Backend fireCount:', backendFireCount);
      console.log('[ClipDetail]   - Backend reactionId:', userFireStatus.userReactionId);
      
      setLocalIsFired(backendHasFired);
      setLocalFireCount(backendFireCount);
      setLocalUserReactionId(userFireStatus.userReactionId ?? null);
      setLocalIsLiked(activeClip.isLiked === true);
      setLocalLikeCount(activeClip._count?.likes || 0);
      lastSyncedClipId.current = activeClipId || null;
    } else if (activeClip && !userFireStatus) {
      console.log('[ClipDetail] Initial sync (waiting for backend fire status)');
      setLocalIsLiked(activeClip.isLiked === true);
      setLocalIsFired(activeClip.isFired === true);
      setLocalLikeCount(activeClip._count?.likes || 0);
      setLocalFireCount(activeClip._count?.fires ?? 0);
      // Don't set lastSyncedClipId yet - wait for userFireStatus to load
    }
  }, [activeClip, activeClipId, userFireStatus]);

  const { data: comments = [], refetch: refetchComments } = useQuery<any[]>({
    queryKey: ['clip', activeClipId, 'comments'],
    queryFn: async () => {
      const token = await getAccessToken();
      const commentsData = await api.clips.getComments(activeClipId || '', token || undefined);
      return commentsData;
    },
    enabled: !!activeClipId,
    staleTime: 60000,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (data: { clipId: number; content: string }) => {
      console.log('[ClipDetail] Adding comment, getting Gamefolio token...');
      const token = await getGamefolioToken();
      console.log('[ClipDetail] Gamefolio token retrieved:', token ? 'yes (length: ' + token.length + ')' : 'no');
      if (!token) {
        console.error('[ClipDetail] No token available for comment');
        throw new Error('Please log in to comment');
      }
      console.log('[ClipDetail] Adding comment via REST API to /api/clips/' + data.clipId + '/comments');
      console.log('[ClipDetail] Comment content:', data.content);
      const result = await api.clips.addComment(data.clipId.toString(), { content: data.content }, token);
      console.log('[ClipDetail] Comment API response:', JSON.stringify(result));
      return result;
    },
    onSuccess: (data, variables) => {
      console.log('[ClipDetail] Comment added successfully:', JSON.stringify(data));
      setComment('');
      Keyboard.dismiss();
      refetchComments();
      // Invalidate clip query to update comment count
      queryClient.invalidateQueries({ queryKey: ['clip', variables.clipId.toString()] });
    },
    onError: (error: any) => {
      console.error('[ClipDetail] Failed to add comment:', error);
      console.error('[ClipDetail] Error name:', error?.name);
      console.error('[ClipDetail] Error message:', error?.message);
      console.error('[ClipDetail] Error status:', error?.status);
    },
  });

  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const playerRef = useRef<any>(null);
  
  const player = useVideoPlayer(activeClip?.videoUrl || clip?.videoUrl || '', (player) => {
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
    const activeVideoUrl = activeClip?.videoUrl || clip?.videoUrl;
    if (activeVideoUrl && playerRef.current) {
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
  }, [activeClip?.videoUrl, clip?.videoUrl]);

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
    togglePlayPause();
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, [togglePlayPause]);

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
    if (comment.trim().length === 0 || !activeClipId) return;
    console.log('[ClipDetail] handlePostComment called with:', comment.trim());
    addCommentMutation.mutate({
      clipId: parseInt(activeClipId, 10),
      content: comment.trim(),
    });
  };

  const likeMutation = useMutation({
    mutationFn: async ({ clipIdToLike, previousLiked, isRetry = false }: { clipIdToLike: string; previousLiked: boolean; isRetry?: boolean }) => {
      console.log('[ClipDetail] Like mutation starting for clip:', clipIdToLike, 'was liked:', previousLiked, 'isRetry:', isRetry);
      let token = await getGamefolioToken();
      console.log('[ClipDetail] Using Gamefolio token for like:', token ? 'present' : 'missing');
      if (!token) throw new Error('Not authenticated');
      
      try {
        return await api.clips.like(clipIdToLike, token);
      } catch (error) {
        if (error instanceof APIError && error.status === 401 && !isRetry) {
          console.log('[ClipDetail] Got 401, attempting token refresh...');
          const newToken = await forceRefreshGamefolioToken();
          if (newToken) {
            console.log('[ClipDetail] Token refreshed, retrying like...');
            return await api.clips.like(clipIdToLike, newToken);
          }
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.log('[ClipDetail] Like mutation success:', JSON.stringify(data));
      isLikeInProgress.current = false;
      // Server response is the source of truth - use the values directly
      setLocalIsLiked(data.liked);
      setLocalLikeCount(data.likeCount);
      // Invalidate clip query to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['clip', variables.clipIdToLike] });
    },
    onError: (error, variables) => {
      isLikeInProgress.current = false;
      // Revert optimistic update on error
      setLocalIsLiked(variables.previousLiked);
      setLocalLikeCount(prev => variables.previousLiked ? prev : Math.max(0, (prev ?? 0) - 1));
      
      const { message, isAuthError } = getErrorMessage(error, 'like');
      if (error instanceof APIError && error.status === 429) {
        console.log('[ClipDetail] Rate limited on like action');
        showToast(message, 'warning');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (isAuthError) {
        console.error('[ClipDetail] Like mutation auth error:', error);
        // Don't auto-logout for like actions - just show error
        showToast('Unable to like. Please try again.', 'error');
      } else {
        console.error('[ClipDetail] Like mutation error:', error);
        showToast(message, 'error');
      }
    },
  });

  const fireMutation = useMutation({
    mutationFn: async ({ clipIdToFire, previousFired, userReactionId, isRetry = false }: { clipIdToFire: string; previousFired: boolean; userReactionId?: number | null; isRetry?: boolean }) => {
      console.log('[ClipDetail] Fire mutation starting for clip:', clipIdToFire, 'was fired:', previousFired, 'reactionId:', userReactionId, 'isRetry:', isRetry);
      
      // Double-check user is available (should be caught in handleFire, but safety check)
      if (!currentUser?.id) {
        console.error('[ClipDetail] Fire mutation called without user - this should not happen');
        throw new Error('Please sign in to react');
      }
      
      let token = await getGamefolioToken();
      console.log('[ClipDetail] Using Gamefolio token for fire:', token ? `present (${token.length} chars)` : 'missing');
      
      if (!token) {
        console.error('[ClipDetail] No Gamefolio token available for fire');
        throw new Error('Session expired. Please try again.');
      }
      
      try {
        console.log('[ClipDetail] Calling api.clips.toggleFire');
        const result = await api.clips.toggleFire(clipIdToFire, token);
        console.log('[ClipDetail] toggleFire API result:', JSON.stringify(result));
        return result;
      } catch (error) {
        console.error('[ClipDetail] Fire API error:', error);
        if (error instanceof APIError && error.status === 401 && !isRetry) {
          console.log('[ClipDetail] Got 401, attempting token refresh...');
          const newToken = await forceRefreshGamefolioToken();
          if (newToken) {
            console.log('[ClipDetail] Token refreshed, retrying fire...');
            return await api.clips.toggleFire(clipIdToFire, newToken);
          } else {
            console.error('[ClipDetail] Token refresh failed');
            throw new Error('Session expired. Please log in again.');
          }
        }
        throw error;
      }
    },
    onSuccess: (data, variables) => {
      console.log('[ClipDetail] Fire mutation success:', JSON.stringify(data));
      console.log('[ClipDetail] Fire mutation - previousFired:', variables.previousFired, 'serverFired:', data.fired, 'serverCount:', data.fireCount, 'newReactionId:', data.reactionId);
      
      isFireInProgress.current = false;
      
      // Server response is the source of truth - use the values directly (same as like)
      const newFiredState = data.fired === true;
      const newFireCount = typeof data.fireCount === 'number' ? data.fireCount : 0;
      
      console.log('[ClipDetail] 🔥 MUTATION RESULT - fired:', newFiredState, 'count:', newFireCount);
      
      setLocalIsFired(newFiredState);
      setLocalFireCount(newFireCount);
      setLocalUserReactionId(newFiredState && data.reactionId ? data.reactionId : null);
      
      // Invalidate clip query to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['clip', variables.clipIdToFire] });
    },
    onError: (error, variables) => {
      isFireInProgress.current = false;
      // Revert optimistic update on error - fire was not previously set
      setLocalIsFired(false);
      setLocalFireCount(prev => Math.max(0, (prev ?? 0) - 1));
      
      const { message, isAuthError } = getErrorMessage(error, 'fire');
      
      // Check for daily limit error
      const errorMessage = error instanceof APIError ? error.message?.toLowerCase() : '';
      const isDailyLimitError = errorMessage.includes('daily') || 
                                errorMessage.includes('limit') || 
                                errorMessage.includes('fires for today') ||
                                (error instanceof APIError && error.status === 403 && errorMessage.includes('fire'));
      
      if (isDailyLimitError) {
        console.log('[ClipDetail] Daily fire limit reached');
        showToast("You've used all your fires for today. Come back tomorrow!", 'warning');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (error instanceof APIError && error.status === 429) {
        console.log('[ClipDetail] Rate limited on fire action');
        showToast(message, 'warning');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (error instanceof APIError && error.status === 400 && errorMessage.includes('own content')) {
        console.log('[ClipDetail] Cannot fire own content');
        showToast("You can't fire your own content!", 'warning');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (isAuthError) {
        console.error('[ClipDetail] Fire mutation auth error:', error);
        showToast('Unable to update fire. Please try again.', 'error');
      } else {
        console.error('[ClipDetail] Fire mutation error:', error);
        showToast(message, 'error');
      }
    },
  });

  useEffect(() => {
    if (likeCooldown > 0) {
      const timer = setInterval(() => {
        setLikeCooldown(prev => Math.max(0, prev - 100));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [likeCooldown]);

  useEffect(() => {
    if (fireCooldown > 0) {
      const timer = setInterval(() => {
        setFireCooldown(prev => Math.max(0, prev - 100));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [fireCooldown]);

  const { mutate: mutateLikeAction, isPending: isLikePending } = likeMutation;
  const handleLike = useCallback(() => {
    if (isLikePending || isLikeInProgress.current || !activeClipId || likeCooldown > 0) {
      if (likeCooldown > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      console.log('[ClipDetail] Like mutation already in progress, cooldown active, or no clipId, ignoring click');
      return;
    }
    isLikeInProgress.current = true;
    const wasLiked = localIsLiked === true;
    const newLikedState = !wasLiked;
    console.log('[ClipDetail] handleLike called, wasLiked:', wasLiked, 'newLikedState:', newLikedState);
    // Optimistic update
    setLocalIsLiked(newLikedState);
    setLocalLikeCount(prev => newLikedState ? (prev ?? 0) + 1 : Math.max(0, (prev ?? 0) - 1));
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
    // Start cooldown
    setLikeCooldown(COOLDOWN_DURATION);
    likeCooldownProgress.setValue(1);
    Animated.timing(likeCooldownProgress, {
      toValue: 0,
      duration: COOLDOWN_DURATION,
      useNativeDriver: false,
    }).start();
    mutateLikeAction({ clipIdToLike: activeClipId, previousLiked: wasLiked });
  }, [localIsLiked, likeScale, mutateLikeAction, isLikePending, activeClipId, likeCooldown, likeCooldownProgress]);

  const { mutate: mutateFireAction, isPending: isFirePending } = fireMutation;
  const handleFire = useCallback(() => {
    console.log('[ClipDetail] ========== HANDLE FIRE START ==========');
    console.log('[ClipDetail] Current localIsFired:', localIsFired);
    
    if (!currentUser?.id) {
      console.log('[ClipDetail] No authenticated user, showing login prompt');
      showToast('Please sign in to react to clips', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    // Fire reactions are permanent - cannot be removed once given
    if (localIsFired === true) {
      console.log('[ClipDetail] Already fired - fire reactions are permanent');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    
    if (isFirePending || isFireInProgress.current || !activeClipId || fireCooldown > 0) {
      if (fireCooldown > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      return;
    }
    
    isFireInProgress.current = true;
    
    console.log('[ClipDetail] FIRE ACTION - adding permanent fire reaction');
    
    // Optimistic update - fire can only be added, never removed
    setLocalIsFired(true);
    setLocalFireCount(prev => (prev ?? 0) + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setShowFlameAnimation(true);
    setTimeout(() => setShowFlameAnimation(false), 1500);
    
    // Start cooldown
    setFireCooldown(COOLDOWN_DURATION);
    fireCooldownProgress.setValue(1);
    Animated.timing(fireCooldownProgress, {
      toValue: 0,
      duration: COOLDOWN_DURATION,
      useNativeDriver: false,
    }).start();
    
    // Call the API to add fire reaction (permanent, no toggle)
    mutateFireAction({ clipIdToFire: activeClipId, previousFired: false, userReactionId: localUserReactionId });
  }, [localIsFired, mutateFireAction, isFirePending, activeClipId, fireCooldown, fireCooldownProgress, currentUser, showToast, localUserReactionId]);

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
    mutationFn: async (data: { clipId: number; content: string }) => {
      console.log('[ClipDetail Reel] Adding comment, getting Gamefolio token...');
      const token = await getGamefolioToken();
      console.log('[ClipDetail Reel] Gamefolio token retrieved:', token ? 'yes (length: ' + token.length + ')' : 'no');
      if (!token) {
        console.error('[ClipDetail Reel] No token available for comment');
        throw new Error('Please log in to comment');
      }
      console.log('[ClipDetail Reel] Adding comment via REST API to /api/clips/' + data.clipId + '/comments');
      const result = await api.clips.addComment(data.clipId.toString(), { content: data.content }, token);
      console.log('[ClipDetail Reel] Comment API response:', JSON.stringify(result));
      return result;
    },
    onSuccess: (data: any, variables) => {
      console.log('[ClipDetail Reel] Comment added successfully:', JSON.stringify(data));
      if (user) {
        const newComment: ReelComment = {
          id: data?.comment?.id || data?.id || Date.now(),
          userId: user.id,
          content: data?.comment?.content || data?.content || reelCommentText,
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
      queryClient.invalidateQueries({ queryKey: ['clip', clipId, 'reel-comments'] });
      queryClient.invalidateQueries({ queryKey: ['clip', variables.clipId.toString()] });
    },
    onError: (error: any) => {
      console.error('[ClipDetail Reel] Failed to add comment:', error);
      console.error('[ClipDetail Reel] Error name:', error?.name);
      console.error('[ClipDetail Reel] Error message:', error?.message);
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
    if (!reelCommentText.trim() || !user || !clipId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mutateReelComment({
      clipId: parseInt(clipId, 10),
      content: reelCommentText.trim(),
    });
  }, [reelCommentText, user, clipId, mutateReelComment]);

  const handleReelUserPress = useCallback((username: string) => {
    router.push({ pathname: '/user/[id]', params: { id: username } });
  }, [router]);

  const { mutate: mutateLike, isPending: isLikePendingForReel } = likeMutation;
  const handleReelLike = useCallback(() => {
    if (isLikePendingForReel || isLikeInProgress.current || !clipId) {
      console.log('[ClipDetail Reel] Like mutation already in progress or no clipId, ignoring click');
      return;
    }
    isLikeInProgress.current = true;
    const wasLiked = localIsLiked === true;
    const newLikedState = !wasLiked;
    console.log('[ClipDetail Reel] handleReelLike called, wasLiked:', wasLiked, 'newLikedState:', newLikedState);
    // Optimistic update
    setLocalIsLiked(newLikedState);
    setLocalLikeCount(prev => newLikedState ? (prev ?? 0) + 1 : Math.max(0, (prev ?? 0) - 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    mutateLike({ clipIdToLike: clipId, previousLiked: wasLiked });
  }, [mutateLike, isLikePendingForReel, localIsLiked, clipId]);

  const { mutate: mutateFire, isPending: isFirePendingForReel } = fireMutation;
  const handleReelFire = useCallback(() => {
    console.log('[ClipDetail Reel] ========== HANDLE REEL FIRE START ==========');
    
    if (!currentUser?.id) {
      console.log('[ClipDetail Reel] No authenticated user');
      showToast('Please sign in to react to clips', 'error');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    
    // Fire reactions are permanent - cannot be removed once given
    if (localIsFired === true) {
      console.log('[ClipDetail Reel] Already fired - fire reactions are permanent');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    
    if (isFirePendingForReel || isFireInProgress.current || !clipId) {
      console.log('[ClipDetail Reel] Fire mutation already in progress or no clipId, ignoring click');
      return;
    }
    
    isFireInProgress.current = true;
    
    console.log('[ClipDetail Reel] handleReelFire - adding permanent fire reaction');
    
    // Optimistic update - fire can only be added, never removed
    setLocalIsFired(true);
    setLocalFireCount(prev => (prev ?? 0) + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setShowFlameAnimation(true);
    setTimeout(() => setShowFlameAnimation(false), 1500);
    
    // Call the API to add fire reaction (permanent, no toggle)
    mutateFire({ clipIdToFire: clipId, previousFired: false, userReactionId: localUserReactionId });
  }, [mutateFire, isFirePendingForReel, localIsFired, clipId, localUserReactionId, currentUser, showToast]);

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
      if (newIndex !== currentClipIndexRef.current) {
        setCurrentClipIndex(newIndex);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
              <View style={styles.playOverlay} pointerEvents="none">
                <View style={styles.playButtonLarge}>
                  <Play size={56} color="#FFF" fill="#FFF" />
                </View>
              </View>
            )}

            {/* Top right buttons */}
            {isCurrentClip && (showControls || isHovering || !isPlaying) && (
              <View style={styles.topRightButtons}>
                {isOwnClip && (
                  <TouchableOpacity 
                    onPress={(e) => { e.stopPropagation(); setIsDeleteModalVisible(true); }} 
                    style={styles.topRightDeleteButton} 
                    activeOpacity={0.7}
                  >
                    <Trash2 size={20} color="#EF4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity 
                  onPress={(e) => { e.stopPropagation(); toggleMute(); }} 
                  style={styles.topRightVolumeButton} 
                  activeOpacity={0.7}
                >
                  {isMuted ? (
                    <VolumeX size={20} color="#FFF" />
                  ) : (
                    <Volume2 size={20} color="#FFF" />
                  )}
                </TouchableOpacity>
              </View>
            )}

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
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); togglePlayPause(); }} style={styles.controlButton}>
                    {isPlaying ? (
                      <Pause size={18} color="#FFF" fill="#FFF" />
                    ) : (
                      <Play size={18} color="#FFF" fill="#FFF" />
                    )}
                  </TouchableOpacity>
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
                  <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleFullscreen(); }} style={styles.controlButton}>
                    <Maximize size={18} color="#4ADE80" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>

          {/* Clip Content */}
          <View style={styles.contentContainer}>
            <View style={styles.userRowContainer}>
              <TouchableOpacity 
                style={styles.userRow}
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: clipItem.user.username } })}
              >
                <Image source={{ uri: clipItem.user.avatarUrl }} style={styles.avatar} />
                <Text style={styles.username}>@{clipItem.user.username}</Text>
              </TouchableOpacity>
              {clipItem.taggedUsers && clipItem.taggedUsers.length > 0 && (
                <Text style={styles.taggedUsersText}>
                  with {clipItem.taggedUsers.map((u: TaggedUser) => `@${u.username}`).join(', ')}
                </Text>
              )}
              <Text style={styles.viewCountText}>{formatNumber(clipItem.views || 0)} views</Text>
            </View>

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
              <Text style={styles.metadataText}>{timeAgo(clipItem.createdAt)}</Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={[styles.actionButton, likeCooldown > 0 && styles.actionButtonCooldown]} 
                onPress={handleLike} 
                disabled={isLikePending || likeCooldown > 0}
              >
                <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                  <View style={styles.iconWithCooldown}>
                    <Heart 
                      size={24} 
                      color={localIsLiked === true ? "#4ADE80" : likeCooldown > 0 ? "#475569" : "#64748B"} 
                      fill={localIsLiked === true ? "#4ADE80" : "transparent"}
                    />
                    {likeCooldown > 0 && (
                      <Animated.View style={[
                        styles.cooldownOverlay,
                        {
                          opacity: likeCooldownProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 0.8],
                          }),
                        },
                      ]}>
                        <Text style={styles.cooldownText}>{Math.ceil(likeCooldown / 1000)}</Text>
                      </Animated.View>
                    )}
                  </View>
                </Animated.View>
                <Text style={[styles.actionCount, likeCooldown > 0 && styles.actionCountCooldown]}>
                  {formatNumber(localLikeCount ?? clipItem._count?.likes ?? 0)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, fireCooldown > 0 && styles.actionButtonCooldown]} 
                onPress={handleFire} 
                disabled={isFirePending || fireCooldown > 0}
              >
                <View style={styles.iconWithCooldown}>
                  {showFlameAnimation ? (
                    <FlameAnimation isActive={true} size={24} />
                  ) : (
                    <Flame 
                      size={24} 
                      color={localIsFired === true ? "#FF6B2C" : fireCooldown > 0 ? "#475569" : "#64748B"} 
                      fill={localIsFired === true ? "#FF6B2C" : "transparent"}
                    />
                  )}
                  {fireCooldown > 0 && (
                    <Animated.View style={[
                      styles.cooldownOverlay,
                      {
                        opacity: fireCooldownProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 0.8],
                        }),
                      },
                    ]}>
                      <Text style={styles.cooldownText}>{Math.ceil(fireCooldown / 1000)}</Text>
                    </Animated.View>
                  )}
                </View>
                <Text style={[styles.actionCount, fireCooldown > 0 && styles.actionCountCooldown]}>
                  {formatNumber(localFireCount ?? clipItem._count?.fires ?? 0)}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => setIsCommentsModalVisible(true)}>
                <MessageSquare size={24} color="#64748B" />
                <Text style={styles.actionCount}>{formatNumber(clipItem._count?.comments || 0)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => setIsShareModalVisible(true)}>
                <Share2 size={24} color="#64748B" />
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              <TouchableOpacity 
                style={styles.reportButton}
                onPress={() => setIsReportModalVisible(true)}
              >
                <Flag size={20} color="#64748B" />
                <Text style={styles.reportText}>Report</Text>
              </TouchableOpacity>
            </View>

            {/* Comments Section */}
            <View style={styles.commentsSection}>
              <Text style={styles.commentsSectionTitle}>Comments</Text>
              
              {isCurrentClip && comments.length > 0 ? (
                <>
                  {comments.slice(0, 5).map((commentItem: any) => (
                    <View key={commentItem.id} style={styles.inlineCommentItem}>
                      <TouchableOpacity onPress={() => router.push({ pathname: '/user/[id]', params: { id: commentItem.user.username } })}>
                        <Image source={{ uri: commentItem.user.avatarUrl }} style={styles.inlineCommentAvatar} />
                      </TouchableOpacity>
                      <View style={styles.inlineCommentContent}>
                        <Text style={styles.inlineCommentText} numberOfLines={2}>
                          <Text style={styles.inlineCommentUsername}>{commentItem.user.displayName || commentItem.user.username}</Text>
                          <Text style={styles.inlineCommentBody}> <CommentText content={commentItem.content} /></Text>
                        </Text>
                      </View>
                    </View>
                  ))}
                  {comments.length > 5 && (
                    <TouchableOpacity onPress={() => setIsCommentsModalVisible(true)} style={styles.viewAllCommentsButton}>
                      <Text style={styles.viewAllCommentsText}>View all {comments.length} comments</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (clipItem._count?.comments || 0) > 0 && !isCurrentClip ? (
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
  }, [currentClipIndex, isMuted, isPlaying, showControls, isHovering, currentTime, duration, playerInstance, insets.bottom, handleSeek, handleProgressBarLayout, progressPanResponder, router, handleVideoPress, togglePlayPause, toggleMute, handleFullscreen, handleLike, handleFire, localIsLiked, localIsFired, localLikeCount, localFireCount, showFlameAnimation, likeScale, isOwnClip, comments, isLikePending, isFirePending, likeCooldown, fireCooldown, likeCooldownProgress, fireCooldownProgress]);

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
        colors={['#131F2A', '#061021']}
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
          extraData={{ currentClipIndex, localIsFired, localFireCount, localIsLiked, localLikeCount }}
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
            <View style={styles.playOverlay} pointerEvents="none">
              <View style={styles.playButtonLarge}>
                <Play size={56} color="#FFF" fill="#FFF" />
              </View>
            </View>
          )}

          {/* Top right buttons */}
          {(showControls || isHovering || !isPlaying) && (
            <View style={styles.topRightButtons}>
              {isOwnClip && (
                <TouchableOpacity 
                  onPress={(e) => { e.stopPropagation(); setIsDeleteModalVisible(true); }} 
                  style={styles.topRightDeleteButton} 
                  activeOpacity={0.7}
                >
                  <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                onPress={(e) => { e.stopPropagation(); toggleMute(); }} 
                style={styles.topRightVolumeButton} 
                activeOpacity={0.7}
              >
                {isMuted ? (
                  <VolumeX size={20} color="#FFF" />
                ) : (
                  <Volume2 size={20} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
          )}

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
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); togglePlayPause(); }} style={styles.controlButton}>
                {isPlaying ? (
                  <Pause size={18} color="#FFF" fill="#FFF" />
                ) : (
                  <Play size={18} color="#FFF" fill="#FFF" />
                )}
              </TouchableOpacity>
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
              <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleFullscreen(); }} style={styles.controlButton}>
                <Maximize size={18} color="#4ADE80" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.contentContainer}>
          <View style={styles.userRowContainer}>
            <TouchableOpacity 
              style={styles.userRow}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: clip.user.username } })}
            >
              <Image source={{ uri: clip.user.avatarUrl }} style={styles.avatar} />
              <Text style={styles.username}>@{clip.user.username}</Text>
            </TouchableOpacity>
            {clip.taggedUsers && clip.taggedUsers.length > 0 && (
              <Text style={styles.taggedUsersText}>
                with {clip.taggedUsers.map((u: TaggedUser) => `@${u.username}`).join(', ')}
              </Text>
            )}
            <Text style={styles.viewCountText}>{formatNumber(clip.views || 0)} views</Text>
          </View>

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
            <Text style={styles.metadataText}>{timeAgo(clip.createdAt)}</Text>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike} disabled={isLikePending}>
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Heart 
                  size={24} 
                  color={localIsLiked ? "#4ADE80" : "#64748B"} 
                  fill={localIsLiked ? "#4ADE80" : "transparent"}
                />
              </Animated.View>
              <Text style={styles.actionCount}>{String(formatNumber(localLikeCount ?? clip?._count?.likes ?? 0))}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleFire} disabled={isFirePending}>
              {showFlameAnimation ? (
                <FlameAnimation isActive={true} size={24} />
              ) : (
                <Flame 
                  size={24} 
                  color={localIsFired === true ? "#FF6B2C" : "#64748B"} 
                  fill={localIsFired === true ? "#FF6B2C" : "transparent"}
                />
              )}
              <Text style={styles.actionCount}>{String(formatNumber(localFireCount ?? clip?._count?.fires ?? 0))}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => setIsCommentsModalVisible(true)}>
              <MessageSquare size={24} color="#64748B" />
              <Text style={styles.actionCount}>{String(formatNumber(comments.length))}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={() => setIsShareModalVisible(true)}>
              <Share2 size={24} color="#64748B" />
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            <TouchableOpacity 
              style={styles.reportButton}
              onPress={() => setIsReportModalVisible(true)}
            >
              <Flag size={20} color="#64748B" />
              <Text style={styles.reportText}>Report</Text>
            </TouchableOpacity>
          </View>

          {/* Emoji Reactions */}
          <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(emojiCounts)
                .filter(([emoji]) => emoji !== '🔥')
                .map(([emoji, data]) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => handleEmojiReact(emoji)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: data.userReacted ? '#4ADE8022' : '#1E293B',
                      borderRadius: 20,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      gap: 4,
                      borderWidth: 1,
                      borderColor: data.userReacted ? '#4ADE8066' : 'transparent',
                    }}
                    testID={`button-emoji-${emoji}`}
                  >
                    <Text style={{ fontSize: 16 }}>{emoji}</Text>
                    <Text style={{ color: data.userReacted ? '#4ADE80' : '#94A3B8', fontSize: 12, fontWeight: '600' }}>{data.count}</Text>
                  </TouchableOpacity>
                ))}
              <TouchableOpacity
                onPress={() => setShowEmojiPicker(v => !v)}
                style={{ backgroundColor: '#1E293B', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}
                testID="button-open-emoji-picker"
              >
                <Text style={{ color: '#64748B', fontSize: 13 }}>+ React</Text>
              </TouchableOpacity>
            </View>
            {showEmojiPicker && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, backgroundColor: '#131F2A', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1E293B' }}>
                {EMOJI_OPTIONS.map(emoji => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => handleEmojiReact(emoji)}
                    style={{ padding: 8 }}
                    testID={`button-pick-emoji-${emoji}`}
                  >
                    <Text style={{ fontSize: 24 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Comments Section */}
          <View style={styles.commentsSection}>
            <Text style={styles.commentsSectionTitle}>Comments</Text>
            
            {comments.length > 0 ? (
              <>
                {comments.slice(0, 5).map((commentItem: any) => (
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
                {comments.length > 5 && (
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
                        <Text style={styles.commentBody}> <CommentText content={commentItem.content} /></Text>
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
        isOwnClip={isOwnClip}
        clip={activeClip || clip} 
      />

      <ReportModal
        visible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
        onSubmit={async (reason, details) => {
          const reportClip = activeClip || clip;
          await submitReportMutation.mutateAsync({
            contentType: 'clip',
            contentId: reportClip?.id || 0,
            reason,
            details,
            contentTitle: reportClip?.title,
            reportedUserId: reportClip?.userId,
            reportedUsername: reportClip?.user?.username,
          });
        }}
        contentType="clip"
        contentId={(activeClip || clip)?.id || 0}
        contentTitle={(activeClip || clip)?.title}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={isDeleteModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => !isDeleting && setIsDeleteModalVisible(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>Delete Clip</Text>
            <Text style={styles.deleteModalMessage}>Are you sure you want to delete this clip? This action cannot be undone.</Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity 
                style={styles.deleteModalCancelButton}
                onPress={() => !isDeleting && setIsDeleteModalVisible(false)}
                disabled={isDeleting}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteModalConfirmButton}
                onPress={handleDeleteClip}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

      {/* Toast Notification */}
      {toast && (
        <Animated.View 
          style={[
            styles.toastContainer, 
            { opacity: toastOpacity, top: insets.top + 60 },
            toast.type === 'warning' && styles.toastWarning,
            toast.type === 'error' && styles.toastError,
            toast.type === 'success' && styles.toastSuccess,
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131F2A',
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
    overflow: 'hidden' as const,
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
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingLeft: 6,
  },
  controlsOverlay: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 10,
  },
  controlsGradient: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: 'transparent',
    backgroundImage: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
  },
  progressBarContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    height: 36,
  },
  timeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
    minWidth: 36,
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

  topRightButtons: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    zIndex: 15,
  },
  topRightDeleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  topRightVolumeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
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
  userRowContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  viewCountText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  taggedUsersText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '500' as const,
    marginLeft: 12,
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
    color: '#131F2A',
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
    backgroundColor: '#131F2A',
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
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  deleteModalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold' as const,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  deleteModalMessage: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center' as const,
  },
  deleteModalCancelText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  deleteModalConfirmButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center' as const,
  },
  deleteModalConfirmText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  toastContainer: {
    position: 'absolute' as const,
    left: 20,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
    alignItems: 'center' as const,
  },
  toastWarning: {
    backgroundColor: '#78350F',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  toastError: {
    backgroundColor: '#7F1D1D',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  toastSuccess: {
    backgroundColor: '#14532D',
    borderLeftWidth: 4,
    borderLeftColor: '#4ADE80',
  },
  toastText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  actionButtonCooldown: {
    opacity: 0.6,
  },
  actionCountCooldown: {
    color: '#475569',
  },
  iconWithCooldown: {
    position: 'relative' as const,
    width: 24,
    height: 24,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  cooldownOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 21, 32, 0.85)',
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  cooldownText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: 'bold' as const,
  },
});