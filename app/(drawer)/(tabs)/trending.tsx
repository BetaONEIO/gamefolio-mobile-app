import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Animated,
  ViewToken,
  Keyboard,
  PanResponder,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TrendingUp,
  Video,
  Film,
  Camera,
  Eye,
  EyeOff,
  Heart,
  Flame,
  MessageSquare,
  Share2,
  Flag,
  X,
  Trash2,
  Clock,
  Gamepad2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Music2,
  Settings,
  Check,
  Maximize,
  Search,
} from 'lucide-react-native';
import FlameAnimation from '@/components/FlameAnimation';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

import { shortenGameName, formatNumber as formatNum, truncateTitle } from '@/constants/formatters';
import { Env } from '@/constants/Env';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CommentText } from '@/utils/parseCommentText';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';
import ShareClipModal from '@/components/ShareClipModal';

import Slider from '@react-native-community/slider';

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
  _count: {
    likes: number;
    comments: number;
    fires?: number;
  };
  isLiked?: boolean;
  isFired?: boolean;
}

interface ScreenshotWithUser {
  id: number;
  userId: number;
  gameId: number;
  title: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  shareCode: string;
  views: number;
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

interface Comment {
  id: number;
  userId: number;
  content: string;
  createdAt: string;
  user: UserBasic;
}

type ContentType = 'reels' | 'clips' | 'screenshots';
type TimePeriod = 'recent' | '1w' | '1m' | 'ever';

const formatNumber = formatNum;

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

interface ReelItemProps {
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
  onSubmitComment: (text: string) => void;
  isLoadingComments: boolean;
  isTabFocused: boolean;
  containerHeight: number;
  onToggleOverlay: () => void;
}

const ExpandableText = ({ text, maxLength = 100 }: { text: string; maxLength?: number }) => {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > maxLength;

  if (!needsTruncation) {
    return <Text style={styles.reelDescription}>{text}</Text>;
  }

  return (
    <Text style={styles.reelDescription}>
      {expanded ? text : `${text.substring(0, maxLength)}...`}
      <Text 
        style={styles.seeMoreButton} 
        onPress={() => setExpanded(!expanded)}
      >
        {' '}{expanded ? 'see less' : 'see more'}
      </Text>
    </Text>
  );
};

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
  onSubmitComment: (text: string) => void;
  isLoadingComments: boolean;
  isTabFocused: boolean;
  containerHeight: number;
  onToggleOverlay: () => void;
}

const ReelItem = React.memo(({ 
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
  onSubmitComment,
  isLoadingComments,
  isTabFocused,
  containerHeight,
  onToggleOverlay,
}: ReelItemProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [localCommentText, setLocalCommentText] = useState('');
  const playIconOpacity = useRef(new Animated.Value(0)).current;
  const commentsSlideAnim = useRef(new Animated.Value(0)).current;
  const commentsListRef = useRef<FlatList>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const player = useVideoPlayer(item.videoUrl, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
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
      try {
        player.play();
        if (Platform.OS === 'web' && videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      } catch (error) {
        console.log('[ReelItem] Error playing video:', error);
      }
    } else {
      try {
        if (player) {
          player.pause();
          player.currentTime = 0;
        }
        if (Platform.OS === 'web' && videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      } catch (error) {
        console.log('[ReelItem] Error pausing video:', error);
      }
    }
  }, [isActive, player, isTabFocused]);

  useEffect(() => {
    player.volume = isMuted ? 0 : 1;
  }, [isMuted, player]);

  useEffect(() => {
    const subscription = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    return () => {
      try {
        if (player) {
          player.pause();
        }
        if (Platform.OS === 'web' && videoRef.current) {
          videoRef.current.pause();
        }
      } catch (error) {
        console.log('[ReelItem] Error in cleanup:', error);
      }
    };
  }, [player]);

  const togglePlayPause = useCallback(() => {
    try {
      if (isPlaying) {
        if (player) player.pause();
      } else {
        if (player) player.play();
      }
      
      setShowPlayIcon(true);
      Animated.sequence([
        Animated.timing(playIconOpacity, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(300),
        Animated.timing(playIconOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setShowPlayIcon(false));
    } catch (error) {
      console.log('[ReelItem] Error toggling play/pause:', error);
    }
  }, [isPlaying, player, playIconOpacity]);

  const handleDoubleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLike();
  }, [onLike]);

  const lastTap = useRef<number>(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap
      handleDoubleTap();
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
    } else {
      // Single tap - toggle overlay after a delay to see if it's part of a double tap
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      tapTimeout.current = setTimeout(() => {
        togglePlayPause();
        onToggleOverlay();
      }, 300);
    }
    lastTap.current = now;
  }, [handleDoubleTap, togglePlayPause, onToggleOverlay]);

  const videoHeight = commentsSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, SCREEN_HEIGHT * 0.35],
  });

  const commentsHeight = commentsSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT * 0.65],
  });

  const renderCommentItem = useCallback(({ item: c }: { item: Comment }) => (
    <TouchableOpacity 
      style={styles.reelCommentItem}
      onPress={() => onUserPress(c.user.username)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: c.user.avatarUrl }} style={styles.reelCommentAvatar} />
      <View style={styles.reelCommentContent}>
        <Text style={styles.reelCommentText}>
          <Text style={styles.reelCommentUsername}>{c.user.displayName}</Text>{' '}
          <CommentText content={c.content} />
        </Text>
        <Text style={styles.reelCommentTime}>{timeAgo(c.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  ), [onUserPress]);

  return (
    <View style={[styles.reelContainer, { height: containerHeight }]}>
      <View style={styles.reelVideoWrapper}>
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.videoTouchable}
          onPress={handleTap}
        >
          {Platform.OS === 'web' ? (
            <video
              ref={(el) => { videoRef.current = el; }}
              src={item.videoUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: showComments ? 'contain' : 'cover',
                backgroundColor: '#000',
              } as any}
              autoPlay={isActive}
              loop
              playsInline
              muted={isMuted}
              poster={item.thumbnailUrl}
            />
          ) : (
            <VideoView
              player={player}
              style={styles.video}
              contentFit={showComments ? "contain" : "cover"}
              nativeControls={false}
            />
          )}
          
          {!showComments && (
            <LinearGradient
              colors={['transparent', 'transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
              style={styles.videoGradient}
            />
          )}

          {showPlayIcon && (
            <Animated.View style={[styles.playIconOverlay, { opacity: playIconOpacity }]}>
              <View style={styles.playIconCircle}>
                {isPlaying ? (
                  <Pause size={40} color="#FFF" fill="#FFF" />
                ) : (
                  <Play size={40} color="#FFF" fill="#FFF" style={{ marginLeft: 4 }} />
                )}
              </View>
            </Animated.View>
          )}
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.commentsSection, { height: commentsHeight }]}>
        <View style={styles.commentsHeader}>
          <View style={styles.commentsHeaderDragHandle} />
          <Text style={styles.commentsSectionTitle}>Comments ({item._count?.comments || 0})</Text>
          <TouchableOpacity style={styles.closeCommentsButton} onPress={onToggleComments}>
            <X size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.commentsListWrapper, keyboardHeight > 0 && { flex: 1, marginBottom: 0 }]}>
          {isLoadingComments ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" color="#4ADE80" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.noCommentsContainer}>
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
              contentContainerStyle={[styles.commentsList, keyboardHeight > 0 && { paddingBottom: 8 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.35 + 60 : 0}
          style={styles.commentInputWrapper}
        >
          <View style={[styles.reelCommentInputContainer, { paddingBottom: Math.max(insets.bottom, 8) + 60 }]}>
            <TextInput
              style={styles.reelCommentInput}
              placeholder="Add a comment..."
              placeholderTextColor="#64748B"
              value={localCommentText}
              onChangeText={setLocalCommentText}
              multiline
            />
            <TouchableOpacity
              style={[styles.reelPostButton, !localCommentText && styles.reelPostButtonDisabled]}
              disabled={!localCommentText}
              onPress={() => { onSubmitComment(localCommentText); setLocalCommentText(''); }}
            >
              <Text style={[styles.reelPostButtonText, localCommentText && styles.reelPostButtonTextActive]}>
                Post
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

    </View>
  );
});

ReelItem.displayName = 'ReelItem';

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
  onSubmitComment: (text: string) => void;
  isLoadingComments: boolean;
  isTabFocused: boolean;
  containerHeight: number;
  onToggleOverlay: () => void;
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
  onSubmitComment,
  isLoadingComments,
  isTabFocused,
  containerHeight,
  onToggleOverlay,
}: ClipItemProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [localCommentText, setLocalCommentText] = useState('');
  const [duration, setDuration] = useState(item.duration || 0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  
  const playIconOpacity = useRef(new Animated.Value(0)).current;
  const commentsSlideAnim = useRef(new Animated.Value(0)).current;
  const commentsListRef = useRef<FlatList>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
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
    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
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
      try {
        if (Platform.OS === 'web' && videoRef.current) {
          videoRef.current.play().catch(() => {});
        } else if (player) {
          player.play();
        }
      } catch (error) {
        console.log('[ClipItem] Error playing video:', error);
      }
    } else {
      try {
        if (Platform.OS === 'web' && videoRef.current) {
          videoRef.current.pause();
        } else if (player) {
          player.pause();
        }
      } catch (error) {
        console.log('[ClipItem] Error pausing video:', error);
      }
    }
  }, [isActive, player, isTabFocused]);

  useEffect(() => {
    player.volume = isMuted ? 0 : 1;
    if (Platform.OS === 'web' && videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted, player]);

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      const video = videoRef.current;
      
      const handlePlay = () => {
        setIsPlaying(true);
      };
      const handlePause = () => {
        setIsPlaying(false);
      };
      const handleTimeUpdate = () => {
        if (!isSeeking) {
          setCurrentTime(video.currentTime);
        }
      };
      const handleLoadedMetadata = () => {
        setDuration(video.duration);
        setIsPlaying(!video.paused);
      };
      
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      
      if (video.duration) {
        setDuration(video.duration);
      }
      
      setIsPlaying(!video.paused);
      
      return () => {
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [isSeeking]);

  useEffect(() => {
    const subscription = player.addListener('playingChange', (event) => {
      if (Platform.OS !== 'web') {
        setIsPlaying(event.isPlaying);
      }
    });
    
    const statusSub = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setDuration(player.duration);
      }
    });

    const interval = setInterval(() => {
      if (!isSeeking) {
        setCurrentTime(player.currentTime);
      }
    }, 100);

    return () => {
      subscription.remove();
      statusSub.remove();
      clearInterval(interval);
    };
  }, [player, isSeeking]);

  useEffect(() => {
    return () => {
      try {
        if (player) {
          player.pause();
        }
        if (Platform.OS === 'web' && videoRef.current) {
          videoRef.current.pause();
        }
      } catch (error) {
        console.log('[ClipItem] Error in cleanup:', error);
      }
    };
  }, [player]);

  const togglePlayPause = useCallback(() => {
    try {
      if (Platform.OS === 'web' && videoRef.current) {
        const video = videoRef.current;
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      } else if (player) {
        if (isPlaying) {
          player.pause();
        } else {
          player.play();
        }
      }
    } catch (error) {
      console.log('[ClipItem] Error toggling play/pause:', error);
    }
    
    setShowPlayIcon(true);
    Animated.sequence([
      Animated.timing(playIconOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.delay(300),
      Animated.timing(playIconOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowPlayIcon(false));
  }, [isPlaying, player, playIconOpacity]);

  const toggleFullScreen = useCallback(() => {
    if (Platform.OS === 'web') {
      if (videoRef.current) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          videoRef.current.requestFullscreen();
        }
      }
    } else {
      if (nativeVideoRef.current) {
        nativeVideoRef.current.enterFullscreen();
      }
    }
  }, []);

  const onFullscreenEnter = useCallback(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
  }, []);

  const onFullscreenExit = useCallback(() => {
    if (Platform.OS !== 'web') {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
  }, []);

  const onSeek = useCallback((value: number) => {
    setIsSeeking(true);
    setCurrentTime(value);
  }, []);

  const onSeekComplete = useCallback((value: number) => {
    if (Platform.OS === 'web' && videoRef.current) {
      videoRef.current.currentTime = value;
    } else {
      player.currentTime = value;
    }
    setIsSeeking(false);
    if (!isPlaying) {
      if (Platform.OS === 'web' && videoRef.current) {
        videoRef.current.play().catch(() => {});
      } else {
        player.play();
      }
    }
  }, [player, isPlaying]);

  const handleDoubleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onLike();
  }, [onLike]);

  const lastTap = useRef<number>(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap
      handleDoubleTap();
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
    } else {
      // Single tap - toggle overlay after a delay to see if it's part of a double tap
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      tapTimeout.current = setTimeout(() => {
        if (Platform.OS === 'web' && videoRef.current) {
          setIsPlaying(!videoRef.current.paused);
        }
        setShowControls(prev => !prev);
        onToggleOverlay();
      }, 300);
    }
    lastTap.current = now;
  }, [handleDoubleTap, onToggleOverlay]);

  const videoHeight = commentsSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, SCREEN_HEIGHT * 0.35],
  });

  const commentsHeight = commentsSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT * 0.65],
  });

  const renderCommentItem = useCallback(({ item: c }: { item: Comment }) => (
    <TouchableOpacity 
      style={styles.reelCommentItem}
      onPress={() => onUserPress(c.user.username)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: c.user.avatarUrl }} style={styles.reelCommentAvatar} />
      <View style={styles.reelCommentContent}>
        <Text style={styles.reelCommentText}>
          <Text style={styles.reelCommentUsername}>{c.user.displayName}</Text>{' '}
          <CommentText content={c.content} />
        </Text>
        <Text style={styles.reelCommentTime}>{timeAgo(c.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  ), [onUserPress]);

  return (
    <View style={[styles.reelContainer, { height: containerHeight }]}>
      <Animated.View style={[styles.videoSection, { height: videoHeight, justifyContent: 'center' }]}>
        <View style={{ width: '100%', aspectRatio: 16/9 }}>
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.videoTouchable}
            onPress={handleTap}
          >
            {Platform.OS === 'web' ? (
              <video
                ref={(el) => { videoRef.current = el; }}
                src={item.videoUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: '#000',
                } as any}
                autoPlay={isActive}
                loop
                playsInline
                muted={isMuted}
                poster={item.thumbnailUrl}
              />
            ) : (
              <VideoView
                ref={nativeVideoRef}
                player={player}
                style={styles.video}
                contentFit="contain"
                nativeControls={false}
                onFullscreenEnter={onFullscreenEnter}
                onFullscreenExit={onFullscreenExit}
              />
            )}
            
            {showPlayIcon && (
              <Animated.View style={[styles.playIconOverlay, { opacity: playIconOpacity }]}>
                <View style={styles.playIconCircle}>
                  {isPlaying ? (
                    <Pause size={40} color="#FFF" fill="#FFF" />
                  ) : (
                    <Play size={40} color="#FFF" fill="#FFF" style={{ marginLeft: 4 }} />
                  )}
                </View>
              </Animated.View>
            )}

            {!showComments && (
               <>
                 <TouchableOpacity 
                    style={styles.fullScreenButtonOverlay}
                    onPress={toggleFullScreen}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Maximize size={20} color="#FFF" />
                  </TouchableOpacity>

                  {showControls && (
                    <TouchableOpacity 
                      activeOpacity={1} 
                      style={styles.clipVideoPlayerControls}
                      onPress={(e) => e.stopPropagation()}
                    >
                      <View style={styles.clipControlsRow}>
                        <TouchableOpacity 
                          style={styles.clipControlButton} 
                          onPress={(e) => {
                            e.stopPropagation();
                            togglePlayPause();
                          }}
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
                            maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                            thumbTintColor="#4ADE80"
                          />
                          <Text style={styles.timeText}>{formatTime(duration)}</Text>
                        </View>
                        
                        <TouchableOpacity 
                          style={styles.clipControlButton} 
                          onPress={(e) => {
                            e.stopPropagation();
                            onToggleMute();
                          }}
                        >
                          {isMuted ? (
                            <VolumeX size={20} color="#FFF" />
                          ) : (
                            <Volume2 size={20} color="#FFF" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  )}
               </>
            )}
          </TouchableOpacity>
        </View>

        {showComments && (
          <View style={[styles.miniReelInfo, { paddingTop: insets.top + 50 }]}>
            <TouchableOpacity 
              style={styles.miniUserRow}
              onPress={() => onUserPress(item.user.username)}
            >
              <Image source={{ uri: item.user.avatarUrl }} style={styles.miniAvatar} />
              <Text style={styles.miniUsername}>@{item.user.username}</Text>
            </TouchableOpacity>
            <Text style={styles.miniTitle} numberOfLines={1}>{truncateTitle(item.title)}</Text>
          </View>
        )}
      </Animated.View>

      <Animated.View style={[styles.commentsSection, { height: commentsHeight }]}>
        <View style={styles.commentsHeader}>
          <View style={styles.commentsHeaderDragHandle} />
          <Text style={styles.commentsSectionTitle}>Comments ({item._count?.comments || 0})</Text>
          <TouchableOpacity style={styles.closeCommentsButton} onPress={onToggleComments}>
            <X size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.commentsListWrapper, keyboardHeight > 0 && { flex: 1, marginBottom: 0 }]}>
          {isLoadingComments ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" color="#4ADE80" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.noCommentsContainer}>
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
              contentContainerStyle={[styles.commentsList, keyboardHeight > 0 && { paddingBottom: 8 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? SCREEN_HEIGHT * 0.35 + 60 : 0}
          style={styles.commentInputWrapper}
        >
          <View style={[styles.reelCommentInputContainer, { paddingBottom: Math.max(insets.bottom, 8) + 60 }]}>
            <TextInput
              style={styles.reelCommentInput}
              placeholder="Add a comment..."
              placeholderTextColor="#64748B"
              value={localCommentText}
              onChangeText={setLocalCommentText}
              multiline
            />
            <TouchableOpacity
              style={[styles.reelPostButton, !localCommentText && styles.reelPostButtonDisabled]}
              disabled={!localCommentText}
              onPress={() => { onSubmitComment(localCommentText); setLocalCommentText(''); }}
            >
              <Text style={[styles.reelPostButtonText, localCommentText && styles.reelPostButtonTextActive]}>
                Post
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>

      <View style={styles.viewsOverlay}>
        <Eye size={12} color="#FFF" />
        <Text style={styles.viewsText}>{formatNumber(item.views)}</Text>
      </View>
    </View>
  );
});

ClipItem.displayName = 'ClipItem';

interface ScreenshotItemProps {
  item: ScreenshotWithUser;
  showComments: boolean;
  onToggleComments: () => void;
  comments: Comment[];
  onSubmitComment: (text: string) => void;
  isLoadingComments: boolean;
  onLike: () => void;
  onFire: () => void;
  onShare: () => void;
  onUserPress: (username: string) => void;
  containerHeight: number;
  onToggleOverlay: () => void;
}

const ScreenshotItem = React.memo(({
  item,
  showComments,
  onToggleComments,
  comments,
  onSubmitComment,
  isLoadingComments,
  onLike,
  onFire,
  onShare,
  onUserPress,
  containerHeight,
  onToggleOverlay,
}: ScreenshotItemProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [localCommentText, setLocalCommentText] = useState('');
  const commentsSlideAnim = useRef(new Animated.Value(0)).current;
  const commentsListRef = useRef<FlatList>(null);

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

  const imageHeight = commentsSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, SCREEN_HEIGHT * 0.35],
  });

  const commentsHeight = commentsSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT * 0.65],
  });

  const renderCommentItem = useCallback(({ item: c }: { item: Comment }) => (
    <TouchableOpacity
      style={styles.reelCommentItem}
      onPress={() => onUserPress(c.user.username)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: c.user.avatarUrl }} style={styles.reelCommentAvatar} />
      <View style={styles.reelCommentContent}>
        <Text style={styles.reelCommentUsername}>@{c.user.username}</Text>
        <Text style={styles.reelCommentText}>
          <CommentText content={c.content} />
        </Text>
      </View>
    </TouchableOpacity>
  ), [onUserPress]);

  const lastTap = useRef<number>(0);
  const tapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // Double tap
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onLike();
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
    } else {
      // Single tap - toggle overlay after a delay to see if it's part of a double tap
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      tapTimeout.current = setTimeout(() => {
        onToggleOverlay();
      }, 300);
    }
    lastTap.current = now;
  }, [onLike, onToggleOverlay]);

  return (
    <View style={[styles.screenshotPageItem, { height: containerHeight }]}>
      <Animated.View style={[styles.screenshotPageImageWrapper, { height: imageHeight }]}>
        <TouchableOpacity activeOpacity={1} style={styles.screenshotTouchable} onPress={handleTap}>
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.screenshotPageImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      </Animated.View>


      {showComments && (
        <View style={[styles.miniReelInfo, { paddingTop: insets.top + 50 }]}>
          <TouchableOpacity
            style={styles.miniUserRow}
            onPress={() => onUserPress(item.user.username)}
          >
            <Image source={{ uri: item.user.avatarUrl }} style={styles.miniAvatar} />
            <Text style={styles.miniUsername}>@{item.user.username}</Text>
          </TouchableOpacity>
          <Text style={styles.miniTitle} numberOfLines={1}>{truncateTitle(item.title)}</Text>
        </View>
      )}

      <Animated.View style={[styles.commentsSection, { height: commentsHeight }]}>
        <View style={styles.commentsHeader}>
          <View style={styles.commentsHeaderDragHandle} />
          <Text style={styles.commentsSectionTitle}>Comments ({item._count?.comments || 0})</Text>
          <TouchableOpacity style={styles.closeCommentsButton} onPress={onToggleComments}>
            <X size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
        <View style={[styles.commentsListWrapper, keyboardHeight > 0 && { flex: 1, marginBottom: 0 }]}>
          {isLoadingComments ? (
            <View style={styles.commentsLoading}>
              <ActivityIndicator size="small" color="#4ADE80" />
            </View>
          ) : comments.length === 0 ? (
            <View style={styles.commentsEmpty}>
              <Text style={styles.commentsEmptyText}>No comments yet</Text>
            </View>
          ) : (
            <FlatList
              ref={commentsListRef}
              data={comments}
              renderItem={renderCommentItem}
              keyExtractor={(c) => `ss-comment-${c.id}`}
              style={styles.commentsList}
              contentContainerStyle={styles.commentsListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          )}
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardHeight}
        >
          <View style={[styles.commentInputContainer, keyboardHeight > 0 && { marginBottom: keyboardHeight }]}>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={localCommentText}
              onChangeText={setLocalCommentText}
              multiline={false}
            />
            <TouchableOpacity
              style={[styles.reelPostButton, !localCommentText && styles.reelPostButtonDisabled]}
              disabled={!localCommentText}
              onPress={() => { onSubmitComment(localCommentText); setLocalCommentText(''); }}
            >
              <Text style={[styles.reelPostButtonText, localCommentText && styles.reelPostButtonTextActive]}>
                Post
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
});

ScreenshotItem.displayName = 'ScreenshotItem';

interface ClipCardItemProps {
  item: ClipWithUser;
  onUserPress: (username: string) => void;
  onLike: () => void;
  onFire: () => void;
  onShare: () => void;
}

const ClipCardItem = React.memo(({ item, onUserPress, onLike, onFire, onShare }: ClipCardItemProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.duration || 0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const player = useVideoPlayer(item.videoUrl, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    const playingSub = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
    });
    
    const statusSub = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setDuration(player.duration);
      }
    });

    const interval = setInterval(() => {
      setCurrentTime(player.currentTime);
    }, 100);

    return () => {
      playingSub.remove();
      statusSub.remove();
      clearInterval(interval);
      try {
        if (player) player.pause();
      } catch (error) {
        console.log('[ClipCardItem] Error in cleanup:', error);
      }
    };
  }, [player]);

  const togglePlay = () => {
    try {
      if (player) {
        if (isPlaying) {
          player.pause();
        } else {
          player.play();
        }
      }
    } catch (error) {
      console.log('[ClipCardItem] Error toggling play:', error);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <View style={styles.twitterClipContainer}>
      <TouchableOpacity 
        style={styles.twitterVideoSection}
        activeOpacity={1}
        onPress={togglePlay}
      >
        {Platform.OS === 'web' ? (
          <video
            ref={(el) => { videoRef.current = el; }}
            src={item.videoUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              backgroundColor: '#000',
            } as any}
            playsInline
            poster={item.thumbnailUrl}
          />
        ) : (
          <VideoView
            player={player}
            style={styles.twitterVideo}
            contentFit="cover"
            nativeControls={false}
          />
        )}

        <View style={styles.twitterVideoControls}>
          <View style={styles.twitterProgressBarContainer}>
            <View style={styles.twitterProgressBarBg}>
              <View style={[styles.twitterProgressBarFill, { width: `${progress}%` }]} />
            </View>
          </View>
          
          <View style={styles.twitterControlsRow}>
            <TouchableOpacity style={styles.twitterPlayButton} onPress={togglePlay}>
              {isPlaying ? (
                <Pause size={20} color="#FFF" fill="#FFF" />
              ) : (
                <Play size={20} color="#FFF" fill="#FFF" />
              )}
            </TouchableOpacity>
            
            <Text style={styles.twitterTimeText}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.twitterClipContent}>
        <TouchableOpacity 
          style={styles.twitterUserSection}
          onPress={() => onUserPress(item.user.username)}
          activeOpacity={0.7}
        >
          <Image source={{ uri: item.user.avatarUrl }} style={styles.twitterAvatar} />
          <View style={styles.twitterUserInfo}>
            <View style={styles.twitterNameRow}>
              <Text style={styles.twitterDisplayName}>{item.user.displayName}</Text>
            </View>
            <Text style={styles.twitterUsername}>@{item.user.username}</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.twitterPostText}>{item.title}</Text>
        {item.description && (
          <Text style={styles.twitterPostText}>{item.description}</Text>
        )}

        <View style={styles.twitterActionsRow}>
          <TouchableOpacity 
            style={styles.twitterActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <MessageSquare size={18} color="#71767B" />
            <Text style={styles.twitterActionText}>{formatNumber(item._count?.comments || 0)}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.twitterActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onFire();
            }}
          >
            {item.isFired ? (
              <FlameAnimation isActive={false} size={18} />
            ) : (
              <Flame size={18} color="#71767B" fill="transparent" />
            )}
            <Text style={[styles.twitterActionText, item.isFired && { color: '#F97316' }]}>
              {formatNumber(item._count?.fires || 0)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.twitterActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onLike();
            }}
          >
            <Heart 
              size={18} 
              color={item.isLiked ? "#F91880" : "#71767B"}
              fill={item.isLiked ? "#F91880" : "transparent"}
            />
            <Text style={[styles.twitterActionText, item.isLiked && { color: '#F91880' }]}>
              {formatNumber(item._count?.likes || 0)}
            </Text>
          </TouchableOpacity>

          <View style={styles.twitterActionBtn}>
            <Eye size={18} color="#71767B" />
            <Text style={styles.twitterActionText}>{formatNumber(item.views)}</Text>
          </View>

          <TouchableOpacity 
            style={styles.twitterActionBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onShare();
            }}
          >
            <Share2 size={18} color="#71767B" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

ClipCardItem.displayName = 'ClipCardItem';

export default function TrendingScreen() {
  const { tab } = useLocalSearchParams<{ tab?: ContentType }>();
  const [contentType, setContentType] = useState<ContentType>(
    tab && ['reels', 'clips', 'screenshots'].includes(tab) ? tab : 'reels'
  );
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const menuSlideAnim = useRef(new Animated.Value(1)).current;
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('ever');
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeScreenshotIndex, setActiveScreenshotIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotWithUser | null>(null);
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [showScreenshotComments, setShowScreenshotComments] = useState(false);
  const [screenshotId, setScreenshotId] = useState<number | null>(null);
  const [showReelComments, setShowReelComments] = useState(false);
  const [showClipComments, setShowClipComments] = useState(false);
  const [showReelOverlay, setShowReelOverlay] = useState(true);
  const [showClipOverlay, setShowClipOverlay] = useState(true);
  const [showScreenshotOverlay, setShowScreenshotOverlay] = useState(true);
  const [selectedReelGame, setSelectedReelGame] = useState<string | null>(null);
  const [selectedReelGameName, setSelectedReelGameName] = useState<string | null>(null);
  const [selectedClipGame, setSelectedClipGame] = useState<string | null>(null);
  const [selectedClipGameName, setSelectedClipGameName] = useState<string | null>(null);
  const [showReelGameFilter, setShowReelGameFilter] = useState(false);
  const [showClipGameFilter, setShowClipGameFilter] = useState(false);
  const [showScreenshotGameFilter, setShowScreenshotGameFilter] = useState(false);
  const [reelGameSearch, setReelGameSearch] = useState('');
  const [clipGameSearch, setClipGameSearch] = useState('');
  const [screenshotGameSearch, setScreenshotGameSearch] = useState('');
  const [selectedScreenshotGame, setSelectedScreenshotGame] = useState<string | null>(null);
  const [selectedScreenshotGameName, setSelectedScreenshotGameName] = useState<string | null>(null);
  const [twitchToken, setTwitchToken] = useState<string | null>(null);
  const [searchedGames, setSearchedGames] = useState<Game[]>([]);
  const [topGames, setTopGames] = useState<Game[]>([]);
  const [contentGames, setContentGames] = useState<Game[]>([]);
  const [isSearchingGames, setIsSearchingGames] = useState(false);

  const [containerHeight, setContainerHeight] = useState(SCREEN_HEIGHT);

  const flatListRef = useRef<FlatList>(null);
  const screenshotFlatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const router = useRouter();
  const { user, getAccessToken } = useAuth();

  useEffect(() => {
    Animated.timing(menuSlideAnim, {
      toValue: menuVisible ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [menuVisible]);

  useEffect(() => {
    const fetchTwitchToken = async () => {
      try {
        const response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${process.env.EXPO_PUBLIC_TWITCH_CLIENT_ID}&client_secret=${process.env.EXPO_PUBLIC_TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, {
          method: 'POST'
        });
        const data = await response.json();
        if (data.access_token) {
          setTwitchToken(data.access_token);
        }
      } catch (error) {
        console.error('Error fetching Twitch token:', error);
      }
    };
    fetchTwitchToken();
  }, []);

  const fetchTopGames = useCallback(async (token: string) => {
    try {
      const url = `https://api.twitch.tv/helix/games/top?first=50`;
      const response = await fetch(url, {
        headers: {
          'Client-Id': process.env.EXPO_PUBLIC_TWITCH_CLIENT_ID!,
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.data) {
        const games: Game[] = data.data.map((g: any) => ({
          id: parseInt(g.id),
          name: g.name,
          imageUrl: g.box_art_url.replace('{width}', '300').replace('{height}', '400'),
        }));
        setTopGames(games);
      }
    } catch (error) {
      console.error('Error fetching top games:', error);
    }
  }, []);

  useEffect(() => {
    if (twitchToken) {
      fetchTopGames(twitchToken);
    }
  }, [twitchToken, fetchTopGames]);


  const [isTabFocused, setIsTabFocused] = useState(true);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareContent, setShareContent] = useState<ClipWithUser | ScreenshotWithUser | null>(null);

  const likeReelMutation = useMutation({
    mutationFn: async (clipId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.like(clipId.toString(), token);
    },
    onSuccess: (data, clipId) => {
      queryClient.setQueryData(['reels', 'trending', timePeriod], (oldData: any[] | undefined) => {
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
      queryClient.setQueryData(['reels', 'trending', timePeriod], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(clip => 
          clip.id === clipId 
            ? { ...clip, isFired: data.fired, _count: { ...clip._count, fires: data.fireCount } }
            : clip
        );
      });
    },
  });

  const likeClipMutation = useMutation({
    mutationFn: async (clipId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.like(clipId.toString(), token);
    },
    onSuccess: (data, clipId) => {
      queryClient.setQueryData(['clips', 'trending', timePeriod], (oldData: any[] | undefined) => {
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
      queryClient.setQueryData(['clips', 'trending', timePeriod], (oldData: any[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(clip => 
          clip.id === clipId 
            ? { ...clip, isFired: data.fired, _count: { ...clip._count, fires: data.fireCount } }
            : clip
        );
      });
    },
  });

  const { mutate: likeReelMutate } = likeReelMutation;
  const { mutate: fireReelMutate } = fireReelMutation;
  const { mutate: likeClipMutate } = likeClipMutation;
  const { mutate: fireClipMutate } = fireClipMutation;

  const likeScreenshotMutation = useMutation({
    mutationFn: async (screenshotId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.screenshots.like(screenshotId.toString(), token);
    },
    onSuccess: (data, screenshotId) => {
      queryClient.setQueryData(['screenshots', 'trending', timePeriod], (oldData: ScreenshotWithUser[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(screenshot => 
          screenshot.id === screenshotId 
            ? { ...screenshot, isLiked: data.liked, _count: { ...screenshot._count, likes: data.likeCount } }
            : screenshot
        );
      });
      if (selectedScreenshot?.id === screenshotId) {
        setSelectedScreenshot(prev => prev ? { ...prev, isLiked: data.liked, _count: { ...prev._count, likes: data.likeCount } } : null);
      }
    },
  });

  const fireScreenshotMutation = useMutation({
    mutationFn: async (screenshotId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.screenshots.fire(screenshotId.toString(), token);
    },
    onSuccess: (data, screenshotId) => {
      queryClient.setQueryData(['screenshots', 'trending', timePeriod], (oldData: ScreenshotWithUser[] | undefined) => {
        if (!oldData) return oldData;
        return oldData.map(screenshot => 
          screenshot.id === screenshotId 
            ? { ...screenshot, isFired: data.fired, _count: { ...screenshot._count, fires: data.fireCount } }
            : screenshot
        );
      });
      if (selectedScreenshot?.id === screenshotId) {
        setSelectedScreenshot(prev => prev ? { ...prev, isFired: data.fired, _count: { ...prev._count, fires: data.fireCount } } : null);
      }
    },
  });

  const addScreenshotCommentMutation = useMutation({
    mutationFn: async ({ screenshotId, content }: { screenshotId: number; content: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(`${Env.BACKEND_URL}/api/screenshots/${screenshotId}/comments`, {
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
          user: { id: user.id, username: user.username, displayName: user.displayName || user.username, avatarUrl: user.avatarUrl || '' },
        };
        setLocalScreenshotComments(prev => [...prev, newComment]);
        queryClient.setQueryData(['screenshots', 'trending', timePeriod], (oldData: ScreenshotWithUser[] | undefined) => {
          if (!oldData) return oldData;
          return oldData.map(s =>
            s.id === variables.screenshotId
              ? { ...s, _count: { ...s._count, comments: (s._count?.comments || 0) + 1 } }
              : s
          );
        });
      }
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

  useEffect(() => {
    setScreenshotId(selectedScreenshot?.id ?? null);
  }, [selectedScreenshot]);

  const getApiTimePeriod = (period: TimePeriod): 'recent' | '1w' | '1m' | 'ever' => {
    switch (period) {
      case 'recent': return 'recent';
      case '1w': return '1w';
      case '1m': return '1m';
      case 'ever': return 'ever';
      default: return 'recent';
    }
  };

  const {
    data: reelsData,
    isLoading: isLoadingReels,
  } = useQuery({
    queryKey: ['reels', 'trending', timePeriod],
    queryFn: async () => {
      const token = await getAccessToken();
      return api.reels.getLatest(token || undefined, { period: getApiTimePeriod(timePeriod) });
    },
  });

  const {
    data: clipsData,
    isLoading: isLoadingClips,
  } = useQuery({
    queryKey: ['clips', 'trending', timePeriod],
    queryFn: async () => {
      try {
        console.log('[Trending Clips] Fetching trending clips for period:', timePeriod);
        const token = await getAccessToken();
        const result = await api.clips.getTrending(token || undefined, getApiTimePeriod(timePeriod));
        console.log('[Trending Clips] Received clips:', result?.length || 0);
        return result;
      } catch (error) {
        console.error('[Trending Clips] Error fetching clips:', error);
        return [];
      }
    },
  });

  const screenshotQueryParams = useMemo(() => {
    const params: { period: 'recent' | '1w' | '1m' | 'ever'; limit: number; gameId?: number } = {
      period: getApiTimePeriod(timePeriod),
      limit: 20,
    };
    console.log('[Trending Screenshots] Query params:', params);
    return params;
  }, [timePeriod]);

  const {
    data: screenshotsData,
    isLoading: isLoadingScreenshots,
    error: screenshotsError,
  } = useQuery({
    queryKey: ['screenshots', 'trending', timePeriod],
    queryFn: async () => {
      try {
        console.log('[Trending Screenshots] Fetching screenshots with params:', screenshotQueryParams);
        const token = await getAccessToken();
        const result = await api.screenshots.getTrending(screenshotQueryParams, token || undefined);
        console.log('[Trending Screenshots] Received screenshots:', result?.length || 0);
        return result;
      } catch (error) {
        console.error('[Trending Screenshots Query] Error:', error);
        return [];
      }
    },
    staleTime: 30000,
  });

  useEffect(() => {
    console.log('[Trending Screenshots Query] Parameters:', screenshotQueryParams);
    console.log('[Trending Screenshots Query] Loading:', isLoadingScreenshots);
    console.log('[Trending Screenshots Query] Error:', screenshotsError);
    console.log('[Trending Screenshots Query] Data length:', screenshotsData?.length || 0);
  }, [screenshotQueryParams, isLoadingScreenshots, screenshotsError, screenshotsData]);

  useEffect(() => {
    if (screenshotsData) {
      console.log('[Trending Screenshots] Loaded screenshots for period:', timePeriod, 'Count:', screenshotsData?.length || 0);
      console.log('[Trending Screenshots] API period:', getApiTimePeriod(timePeriod));
      console.log('[Trending Screenshots] Screenshot data:', screenshotsData);
    }
  }, [screenshotsData, timePeriod]);

  useEffect(() => {
    console.log('[Trending] Current contentType:', contentType);
    console.log('[Trending] Current timePeriod:', timePeriod);
    console.log('[Trending] Screenshots count:', screenshotsData?.length || 0);
  }, [contentType, timePeriod, screenshotsData]);

  const { data: screenshotCommentsData, isLoading: isLoadingScreenshotComments } = useQuery({
    queryKey: ['screenshots', 'comments', screenshotId],
    queryFn: async () => {
      const response = await fetch(`${Env.BACKEND_URL}/api/screenshots/${screenshotId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!screenshotId,
  });

  const allReels = useMemo(() => (reelsData as ClipWithUser[] | undefined) || [], [reelsData]);
  
  const reels = useMemo(() => {
    if (!selectedReelGame) return allReels;
    return allReels.filter(reel => reel.game?.id === parseInt(selectedReelGame));
  }, [allReels, selectedReelGame]);



  const searchReelGames = useCallback(async (query: string) => {
    if (!twitchToken || query.trim().length === 0) {
      setSearchedGames([]);
      return;
    }
    
    setIsSearchingGames(true);
    try {
      const url = `https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}&first=30`;
      const response = await fetch(url, {
        headers: {
          'Client-Id': process.env.EXPO_PUBLIC_TWITCH_CLIENT_ID!,
          'Authorization': `Bearer ${twitchToken}`
        }
      });
      const data = await response.json();
      if (data.data) {
        const games: Game[] = data.data.map((g: any) => ({
          id: parseInt(g.id),
          name: g.name,
          imageUrl: g.box_art_url.replace('{width}', '300').replace('{height}', '400'),
        }));
        setSearchedGames(games);
      }
    } catch (error) {
      console.error('Error searching games:', error);
    } finally {
      setIsSearchingGames(false);
    }
  }, [twitchToken]);

  useEffect(() => {
    if (!showReelGameFilter) return;
    const timer = setTimeout(() => {
      searchReelGames(reelGameSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [reelGameSearch, showReelGameFilter, searchReelGames]);

  useEffect(() => {
    if (!showClipGameFilter) return;
    const timer = setTimeout(() => {
      searchReelGames(clipGameSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [clipGameSearch, showClipGameFilter, searchReelGames]);

  useEffect(() => {
    if (!showScreenshotGameFilter) return;
    const timer = setTimeout(() => {
      searchReelGames(screenshotGameSearch);
    }, 500);
    return () => clearTimeout(timer);
  }, [screenshotGameSearch, showScreenshotGameFilter, searchReelGames]);
  


  const mockClips = useMemo<ClipWithUser[]>(() => [
    {
      id: 999,
      userId: 1,
      gameId: 1,
      title: 'Epic Valorant Ace - 1v5 Clutch',
      description: 'Insane clutch moment in ranked gameplay',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop',
      videoType: 'clip',
      duration: 45,
      views: 12500,
      shareCode: 'abc123',
      ageRestricted: false,
      createdAt: new Date().toISOString(),
      user: {
        id: 1,
        username: 'ProGamer123',
        displayName: 'Pro Gamer',
        avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
      },
      game: {
        id: 1,
        name: 'Valorant',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-285x380.jpg',
      },
      _count: {
        likes: 342,
        comments: 28,
        fires: 156,
      },
      isLiked: false,
      isFired: false,
    },
    {
      id: 998,
      userId: 2,
      gameId: 2,
      title: 'Insane Fortnite Build Battle Win',
      description: 'Quick edit plays to secure the Victory Royale',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=450&fit=crop',
      videoType: 'clip',
      duration: 32,
      views: 8900,
      shareCode: 'def456',
      ageRestricted: false,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      user: {
        id: 2,
        username: 'BuildKing',
        displayName: 'Build King',
        avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100&h=100&fit=crop',
      },
      game: {
        id: 2,
        name: 'Fortnite',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-285x380.jpg',
      },
      _count: {
        likes: 567,
        comments: 45,
        fires: 234,
      },
      isLiked: true,
      isFired: false,
    },
    {
      id: 997,
      userId: 3,
      gameId: 3,
      title: 'CS2 AWP Ace - Perfect Timing',
      description: 'Every shot counts in this insane ace',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      thumbnailUrl: 'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=800&h=450&fit=crop',
      videoType: 'clip',
      duration: 28,
      views: 15600,
      shareCode: 'ghi789',
      ageRestricted: false,
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      user: {
        id: 3,
        username: 'SniperElite',
        displayName: 'Sniper Elite',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
      },
      game: {
        id: 3,
        name: 'Counter-Strike 2',
        imageUrl: 'https://static-cdn.jtvnw.net/ttv-boxart/32399-285x380.jpg',
      },
      _count: {
        likes: 892,
        comments: 67,
        fires: 445,
      },
      isLiked: false,
      isFired: true,
    },
  ], []);

  const allClips = useMemo(() => {
    const apiClips = (clipsData as ClipWithUser[] | undefined) || [];
    console.log('[Trending Clips] Processing clips - API clips:', apiClips.length, 'Mock clips:', mockClips.length);
    const result = apiClips.length > 0 ? apiClips : mockClips;
    console.log('[Trending Clips] Final clips count:', result.length);
    return result;
  }, [clipsData, mockClips]);

  const clips = useMemo(() => {
    if (!selectedClipGame) return allClips;
    return allClips.filter(clip => clip.game?.id === parseInt(selectedClipGame));
  }, [allClips, selectedClipGame]);


  const allScreenshots = useMemo(() => {
    const apiScreenshots = (screenshotsData as ScreenshotWithUser[] | undefined) || [];
    console.log('[Trending Screenshots] Processing screenshots - API screenshots:', apiScreenshots.length);
    return apiScreenshots;
  }, [screenshotsData]);

  useEffect(() => {
    const gamesMap = new Map<number, Game>();
    
    allReels.forEach(reel => {
      if (reel.game && reel.game.id && !gamesMap.has(reel.game.id)) {
        gamesMap.set(reel.game.id, reel.game);
      }
    });
    
    allClips.forEach(clip => {
      if (clip.game && clip.game.id && !gamesMap.has(clip.game.id)) {
        gamesMap.set(clip.game.id, clip.game);
      }
    });
    
    allScreenshots.forEach(screenshot => {
      if (screenshot.game && screenshot.game.id && !gamesMap.has(screenshot.game.id)) {
        gamesMap.set(screenshot.game.id, screenshot.game);
      }
    });
    
    setContentGames(Array.from(gamesMap.values()));
  }, [allReels, allClips, allScreenshots]);

  const screenshots = useMemo(() => {
    if (!selectedScreenshotGame) return allScreenshots;
    return allScreenshots.filter(screenshot => screenshot.game?.id === parseInt(selectedScreenshotGame));
  }, [allScreenshots, selectedScreenshotGame]);

  const [featuredScreenshotIndex, setFeaturedScreenshotIndex] = useState(0);
  const featuredScreenshotAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleThumbnailPress = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(featuredScreenshotAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(featuredScreenshotAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(() => setFeaturedScreenshotIndex(index), 150);
  }, [featuredScreenshotAnim]);

  const handleSwipe = useCallback((direction: 'left' | 'right') => {
    if (screenshots.length === 0) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    let newIndex = featuredScreenshotIndex;
    if (direction === 'left') {
      newIndex = (featuredScreenshotIndex + 1) % screenshots.length;
    } else {
      newIndex = (featuredScreenshotIndex - 1 + screenshots.length) % screenshots.length;
    }
    
    const slideDirection = direction === 'left' ? -SCREEN_WIDTH : SCREEN_WIDTH;
    
    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: slideDirection,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();
    
    setTimeout(() => setFeaturedScreenshotIndex(newIndex), 200);
  }, [featuredScreenshotIndex, screenshots.length, slideAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 50) {
          if (gestureState.dx > 0) {
            handleSwipe('right');
          } else {
            handleSwipe('left');
          }
        }
      },
    })
  ).current;
  const screenshotComments: Comment[] = (screenshotCommentsData as Comment[] | undefined) || [];

  const activeReelId = reels[activeIndex]?.id;
  const { data: reelCommentsData, isLoading: isLoadingReelComments } = useQuery({
    queryKey: ['clips', 'comments', activeReelId],
    queryFn: async () => {
      const response = await fetch(`${Env.BACKEND_URL}/api/clips/${activeReelId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!activeReelId && showReelComments && contentType === 'reels',
  });

  const activeClipId = clips[activeIndex]?.id;
  const { data: clipCommentsData, isLoading: isLoadingClipComments } = useQuery({
    queryKey: ['clips', 'comments', activeClipId],
    queryFn: async () => {
      const response = await fetch(`${Env.BACKEND_URL}/api/clips/${activeClipId}/comments`);
      if (!response.ok) throw new Error('Failed to fetch comments');
      return response.json();
    },
    enabled: !!activeClipId && showClipComments && contentType === 'clips',
  });

  const [localReelComments, setLocalReelComments] = useState<Comment[]>([]);
  const [localClipComments, setLocalClipComments] = useState<Comment[]>([]);
  const [localScreenshotComments, setLocalScreenshotComments] = useState<Comment[]>([]);

  useEffect(() => {
    if (reelCommentsData) {
      setLocalReelComments(reelCommentsData as Comment[]);
    }
  }, [reelCommentsData]);

  useEffect(() => {
    setLocalReelComments([]);
  }, [activeReelId]);

  useEffect(() => {
    if (clipCommentsData) {
      setLocalClipComments(clipCommentsData as Comment[]);
    }
  }, [clipCommentsData]);

  useEffect(() => {
    setLocalClipComments([]);
  }, [activeClipId]);

  const activeScreenshotId = screenshots[activeScreenshotIndex]?.id;

  useEffect(() => {
    if (screenshotId) {
      setLocalScreenshotComments((screenshotCommentsData as Comment[] | undefined) || []);
    }
  }, [screenshotCommentsData, screenshotId]);

  useEffect(() => {
    setLocalScreenshotComments([]);
    if (screenshots[activeScreenshotIndex]) {
      setScreenshotId(screenshots[activeScreenshotIndex].id);
    }
  }, [activeScreenshotIndex]);



  const addReelCommentMutation = useMutation({
    mutationFn: async ({ clipId, content }: { clipId: number; content: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(`${Env.BACKEND_URL}/api/clips/${clipId}/comments`, {
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
      queryClient.invalidateQueries({ queryKey: ['clips', 'comments', variables.clipId] });
      queryClient.invalidateQueries({ queryKey: ['clips', 'trending'] });
      queryClient.invalidateQueries({ queryKey: ['reels', 'trending'] });
    },
  });

  const addClipCommentMutation = useMutation({
    mutationFn: async ({ clipId, content }: { clipId: number; content: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(`${Env.BACKEND_URL}/api/clips/${clipId}/comments`, {
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
        setLocalClipComments(prev => [newComment, ...prev]);
      }
      queryClient.invalidateQueries({ queryKey: ['clips', 'comments', variables.clipId] });
      queryClient.invalidateQueries({ queryKey: ['clips', 'trending'] });
      queryClient.invalidateQueries({ queryKey: ['reels', 'trending'] });
    },
  });

  const handleContentTypeChange = useCallback((type: ContentType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setContentType(type);
    setShowFilterDropdown(false);
    setShowTimeDropdown(false);
    setActiveIndex(0);
  }, []);

  const handleTimePeriodChange = useCallback((period: TimePeriod) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimePeriod(period);
    setShowTimeDropdown(false);
  }, []);

  const timePeriodLabels: Record<TimePeriod, string> = {
    recent: 'Most recent',
    '1w': '1W',
    '1m': '1M',
    ever: 'Ever',
  };

  const handleUserPress = useCallback((username: string) => {
    router.push({ pathname: '/user/[id]', params: { id: username } });
  }, [router]);



  const handleScreenshotPress = useCallback((screenshot: ScreenshotWithUser) => {
    const index = screenshots.findIndex(s => s.id === screenshot.id);
    setSelectedScreenshotIndex(index >= 0 ? index : 0);
    setSelectedScreenshot(screenshot);
  }, [screenshots]);

  const closeScreenshotModal = useCallback(() => {
    setSelectedScreenshot(null);
    setSelectedScreenshotIndex(0);
    setComment('');
    setShowScreenshotComments(false);
  }, []);

  const navigateScreenshot = useCallback((direction: 'prev' | 'next') => {
    if (screenshots.length === 0) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    let newIndex = selectedScreenshotIndex;
    if (direction === 'next') {
      newIndex = (selectedScreenshotIndex + 1) % screenshots.length;
    } else {
      newIndex = (selectedScreenshotIndex - 1 + screenshots.length) % screenshots.length;
    }
    
    setSelectedScreenshotIndex(newIndex);
    setSelectedScreenshot(screenshots[newIndex]);
  }, [selectedScreenshotIndex, screenshots]);

  const modalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dy) < 50;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > 50) {
          if (gestureState.dx > 0) {
            navigateScreenshot('prev');
          } else {
            navigateScreenshot('next');
          }
        }
      },
    })
  ).current;

  const toggleScreenshotComments = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowScreenshotComments(prev => !prev);
  }, []);

  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(prev => !prev);
  }, []);

  const toggleReelComments = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowReelComments(prev => !prev);
  }, []);

  const toggleClipComments = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowClipComments(prev => !prev);
  }, []);





  const { mutate: submitReelComment } = addReelCommentMutation;
  const { mutate: submitClipComment } = addClipCommentMutation;

  const handleReelCommentSubmit = useCallback((text: string) => {
    if (!text.trim() || !activeReelId || !user) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    submitReelComment({
      clipId: activeReelId,
      content: text.trim(),
    });
    Keyboard.dismiss();
  }, [activeReelId, user, submitReelComment]);

  const handleClipCommentSubmit = useCallback((text: string) => {
    if (!text.trim() || !activeClipId || !user) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    submitClipComment({
      clipId: activeClipId,
      content: text.trim(),
    });
    Keyboard.dismiss();
  }, [activeClipId, user, submitClipComment]);

  const handleScreenshotCommentSubmit = useCallback((text: string) => {
    if (!text.trim() || !activeScreenshotId || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addScreenshotCommentMutation.mutate({ screenshotId: activeScreenshotId, content: text.trim() });
    Keyboard.dismiss();
  }, [activeScreenshotId, user, addScreenshotCommentMutation]);

  const onViewableItemsChangedRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const newIndex = viewableItems[0].index;
      setShowReelComments(false);
      setShowClipComments(false);
      setShowScreenshotComments(false);
      Keyboard.dismiss();
      setActiveIndex(newIndex);
    }
  });

  const onViewableItemsChangedScreenshotRef = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      const newIndex = viewableItems[0].index;
      setShowScreenshotComments(false);
      Keyboard.dismiss();
      setActiveScreenshotIndex(newIndex);
    }
  });

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: containerHeight,
    offset: containerHeight * index,
    index,
  }), [containerHeight]);

  const renderReelItem = useCallback(({ item, index }: { item: ClipWithUser; index: number }) => (
    <ReelItem
      item={item}
      isActive={index === activeIndex}
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShareContent(item);
        setShareModalVisible(true);
      }}
      showComments={index === activeIndex && showReelComments}
      onToggleComments={toggleReelComments}
      comments={index === activeIndex ? localReelComments : []}
      onSubmitComment={handleReelCommentSubmit}
      isLoadingComments={isLoadingReelComments}
      isTabFocused={isTabFocused}
      containerHeight={containerHeight}
      onToggleOverlay={() => setShowReelOverlay(!showReelOverlay)}
    />
  ), [activeIndex, isMuted, toggleMute, handleUserPress, showReelComments, toggleReelComments, localReelComments, handleReelCommentSubmit, isLoadingReelComments, isTabFocused, likeReelMutate, fireReelMutate, setShareContent, setShareModalVisible, containerHeight, showReelOverlay]);



  const renderScreenshotCard = useCallback(({ item: screenshot }: { item: ScreenshotWithUser }) => (
    <TouchableOpacity
      style={styles.screenshotCard}
      onPress={() => handleScreenshotPress(screenshot)}
      activeOpacity={0.9}
    >
      <Image source={{ uri: screenshot.thumbnailUrl || screenshot.imageUrl }} style={styles.screenshotThumbnail} />
    </TouchableOpacity>
  ), [handleScreenshotPress]);

  const renderScreenshotPageItem = useCallback(({ item, index }: { item: ScreenshotWithUser; index: number }) => (
    <ScreenshotItem
      item={item}
      showComments={index === activeScreenshotIndex && showScreenshotComments}
      onToggleComments={toggleScreenshotComments}
      comments={index === activeScreenshotIndex ? localScreenshotComments : []}
      onSubmitComment={handleScreenshotCommentSubmit}
      isLoadingComments={isLoadingScreenshotComments && index === activeScreenshotIndex}
      onLike={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        likeScreenshotMutation.mutate(item.id);
      }}
      onFire={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        fireScreenshotMutation.mutate(item.id);
      }}
      onShare={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Share.share({ message: `Check out this screenshot on Gamefolio!` });
      }}
      onUserPress={handleUserPress}
      containerHeight={containerHeight}
      onToggleOverlay={() => setShowScreenshotOverlay(!showScreenshotOverlay)}
    />
  ), [activeScreenshotIndex, showScreenshotComments, toggleScreenshotComments, localScreenshotComments, handleScreenshotCommentSubmit, isLoadingScreenshotComments, likeScreenshotMutation, fireScreenshotMutation, handleUserPress, containerHeight, showScreenshotOverlay]);

  const renderEmptyState = useCallback((type: ContentType) => {
    const messages: Record<ContentType, { title: string; message: string }> = {
      reels: {
        title: 'No Reels Yet',
        message: 'Be the first to share a reel!',
      },
      clips: {
        title: 'No Clips Yet',
        message: 'Share your epic gaming moments!',
      },
      screenshots: {
        title: 'No Screenshots Yet',
        message: 'Capture your best gaming moments!',
      },
    };

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <TrendingUp size={48} color="#4ADE80" />
        </View>
        <Text style={styles.emptyTitle}>{messages[type].title}</Text>
        <Text style={styles.emptyMessage}>{messages[type].message}</Text>
      </View>
    );
  }, []);

  const renderLoadingState = useCallback(() => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#4ADE80" />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  ), []);

  const renderReelsView = () => {
    if (isLoadingReels) return renderLoadingState();
    if (reels.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Film size={48} color="#4ADE80" />
          </View>
          <Text style={styles.emptyTitle}>No Reels Yet</Text>
          <Text style={styles.emptyMessage}>
            {selectedReelGame ? `There seems to be no reels for ${selectedReelGameName} yet` : 'Be the first to share a reel!'}
          </Text>
          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={() => router.push('/(drawer)/(tabs)/create')}
          >
            <Text style={styles.uploadButtonText}>Upload a Reel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReelItem}
        keyExtractor={(item) => `reel-${item.id}`}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        extraData={localReelComments}
      />
    );
  };



  const renderClipItem = useCallback(({ item, index }: { item: ClipWithUser; index: number }) => (
    <ClipItem
      item={item}
      isActive={index === activeIndex}
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShareContent(item);
        setShareModalVisible(true);
      }}
      showComments={index === activeIndex && showClipComments}
      onToggleComments={toggleClipComments}
      comments={index === activeIndex ? localClipComments : []}
      onSubmitComment={handleClipCommentSubmit}
      isLoadingComments={isLoadingClipComments}
      isTabFocused={isTabFocused && contentType === 'clips'}
      containerHeight={containerHeight}
      onToggleOverlay={() => setShowClipOverlay(!showClipOverlay)}
    />
  ), [activeIndex, isMuted, toggleMute, handleUserPress, isTabFocused, contentType, likeClipMutate, fireClipMutate, showClipComments, toggleClipComments, localClipComments, handleClipCommentSubmit, isLoadingClipComments, containerHeight, showClipOverlay]);

  const renderClipsView = () => {
    if (isLoadingClips) return renderLoadingState();
    if (clips.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Video size={48} color="#4ADE80" />
          </View>
          <Text style={styles.emptyTitle}>No Clips Yet</Text>
          <Text style={styles.emptyMessage}>
            {selectedClipGame ? `There seems to be no clips for ${selectedClipGameName} yet` : 'Share your epic gaming moments!'}
          </Text>
          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={() => router.push('/(drawer)/(tabs)/create')}
          >
            <Text style={styles.uploadButtonText}>Upload a Clip</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        ref={flatListRef}
        data={clips}
        renderItem={renderClipItem}
        keyExtractor={(item) => `clip-${item.id}`}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        onViewableItemsChanged={onViewableItemsChangedRef.current}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        removeClippedSubviews
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        extraData={localClipComments}
      />
    );
  };

  const renderScreenshotSlideshow = () => {
    if (screenshots.length === 0) return null;
    
    const thumbnailCount = Math.min(screenshots.length, 10);
    const thumbnails = screenshots.slice(0, thumbnailCount);
    const featuredScreenshot = screenshots[featuredScreenshotIndex];
    
    return (
      <View style={styles.slideshowContainer}>
        <View style={styles.thumbnailGrid}>
          {thumbnails.map((screenshot, index) => (
            <TouchableOpacity
              key={`slideshow-thumb-${screenshot.id}`}
              style={[
                styles.gridThumbnail,
                index === featuredScreenshotIndex && styles.gridThumbnailActive,
              ]}
              onPress={() => handleThumbnailPress(index)}
              activeOpacity={0.8}
            >
              <Image 
                source={{ uri: screenshot.thumbnailUrl || screenshot.imageUrl }} 
                style={[styles.gridThumbnailImage, index !== featuredScreenshotIndex && { opacity: 0.5 }]}
              />
              {index === featuredScreenshotIndex && (
                <View style={styles.gridThumbnailOverlay} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        
        {featuredScreenshot && (
          <View style={styles.featuredScreenshotWrapper}>
            <Animated.View
              style={[
                styles.slideshowFeatured,
                {
                  transform: [
                    {
                      translateX: slideAnim,
                    },
                  ],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <TouchableOpacity
                style={styles.slideshowFeaturedTouchable}
                onPress={() => handleScreenshotPress(featuredScreenshot)}
                activeOpacity={0.9}
              >
                <Image 
                  source={{ uri: featuredScreenshot.imageUrl }} 
                  style={styles.slideshowFeaturedImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.featuredScreenshotDetails}>
              <TouchableOpacity 
                style={styles.featuredUserRow}
                onPress={() => {
                  handleUserPress(featuredScreenshot.user.username);
                }}
                activeOpacity={0.7}
              >
                <Image 
                  source={{ uri: featuredScreenshot.user.avatarUrl }} 
                  style={styles.featuredAvatar}
                />
                <View style={styles.featuredUserInfo}>
                  <Text style={styles.featuredDisplayName}>{featuredScreenshot.user.displayName}</Text>
                  <Text style={styles.featuredUsername}>@{featuredScreenshot.user.username}</Text>
                </View>
              </TouchableOpacity>

              <Text style={styles.featuredTitle}>{featuredScreenshot.title}</Text>
              
              {featuredScreenshot.description && (
                <ExpandableText text={featuredScreenshot.description} maxLength={80} />
              )}

              {featuredScreenshot.game && (
                <TouchableOpacity 
                  style={styles.featuredGameRow}
                  onPress={() => router.push({ pathname: '/game/[id]', params: { id: featuredScreenshot.game.id.toString(), name: featuredScreenshot.game.name, boxArt: featuredScreenshot.game.imageUrl || '' } })}
                  activeOpacity={0.7}
                >
                  <Gamepad2 size={16} color="#4ADE80" />
                  <Text style={styles.featuredGameText}>{shortenGameName(featuredScreenshot.game.name)}</Text>
                </TouchableOpacity>
              )}

              <View style={styles.featuredStatsRow}>
                <View style={styles.featuredStat}>
                  <Eye size={16} color="#94A3B8" />
                  <Text style={styles.featuredStatText}>{formatNumber(featuredScreenshot.views)} views</Text>
                </View>
                <View style={styles.featuredStat}>
                  <Heart size={16} color="#94A3B8" />
                  <Text style={styles.featuredStatText}>{formatNumber(featuredScreenshot._count?.likes || 0)}</Text>
                </View>
                <View style={styles.featuredStat}>
                  <Flame size={16} color="#94A3B8" />
                  <Text style={styles.featuredStatText}>{formatNumber(featuredScreenshot._count?.fires || 0)}</Text>
                </View>
                <View style={styles.featuredStat}>
                  <MessageSquare size={16} color="#94A3B8" />
                  <Text style={styles.featuredStatText}>{formatNumber(featuredScreenshot._count?.comments || 0)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderScreenshotsView = () => {
    if (isLoadingScreenshots) return renderLoadingState();
    if (screenshots.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Camera size={48} color="#4ADE80" />
          </View>
          <Text style={styles.emptyTitle}>No Screenshots Yet</Text>
          <Text style={styles.emptyMessage}>
            {selectedScreenshotGame ? `There seems to be no screenshots for ${selectedScreenshotGameName} yet` : 'Capture your best gaming moments!'}
          </Text>
          <TouchableOpacity 
            style={styles.uploadButton}
            onPress={() => router.push('/(drawer)/(tabs)/create')}
          >
            <Text style={styles.uploadButtonText}>Upload a Screenshot</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.screenshotPageContainer}>
        <FlatList
          ref={screenshotFlatListRef}
          data={screenshots}
          renderItem={renderScreenshotPageItem}
          keyExtractor={(item) => `screenshot-page-${item.id}`}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          snapToAlignment="start"
          onViewableItemsChanged={onViewableItemsChangedScreenshotRef.current}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={getItemLayout}
          initialNumToRender={2}
          maxToRenderPerBatch={3}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          decelerationRate="fast"
          disableIntervalMomentum
          extraData={localScreenshotComments}
        />
      </View>
    );
  };

  const renderScreenshotModal = () => {
    if (!selectedScreenshot) return null;

    return (
      <Modal
        visible={!!selectedScreenshot}
        animationType="slide"
        transparent={false}
        onRequestClose={closeScreenshotModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={closeScreenshotModal}>
              <X size={24} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.modalBody}>
              <View style={styles.modalImageContainer} {...modalPanResponder.panHandlers}>
                <TouchableOpacity 
                  activeOpacity={1}
                  onPress={() => {
                    if (Platform.OS === 'web') {
                      try {
                        const img = document.querySelector('img[src="' + selectedScreenshot.imageUrl + '"]') as HTMLImageElement;
                        if (img && document.fullscreenElement) {
                          document.exitFullscreen();
                        } else if (img && img.requestFullscreen) {
                          img.requestFullscreen().catch(() => {});
                        }
                      } catch {
                        console.log('Fullscreen not supported');
                      }
                    }
                  }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <Image
                    source={{ uri: selectedScreenshot.imageUrl }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                
                {screenshots.length > 1 && (
                  <View style={styles.screenshotNavOverlay}>
                    <TouchableOpacity
                      style={[styles.screenshotNavArrow, selectedScreenshotIndex === 0 && styles.screenshotNavArrowDisabled]}
                      onPress={() => navigateScreenshot('prev')}
                      activeOpacity={0.7}
                      disabled={selectedScreenshotIndex === 0}
                    >
                      <ChevronLeft size={20} color={selectedScreenshotIndex === 0 ? '#64748B' : '#FFF'} />
                    </TouchableOpacity>
                    
                    <View style={styles.screenshotNavDots}>
                      {screenshots.slice(
                        Math.max(0, selectedScreenshotIndex - 2),
                        Math.min(screenshots.length, selectedScreenshotIndex + 3)
                      ).map((_, i) => {
                        const actualIndex = Math.max(0, selectedScreenshotIndex - 2) + i;
                        return (
                          <View
                            key={actualIndex}
                            style={[
                              styles.screenshotNavDot,
                              actualIndex === selectedScreenshotIndex && styles.screenshotNavDotActive
                            ]}
                          />
                        );
                      })}
                    </View>
                    
                    <TouchableOpacity
                      style={[styles.screenshotNavArrow, selectedScreenshotIndex === screenshots.length - 1 && styles.screenshotNavArrowDisabled]}
                      onPress={() => navigateScreenshot('next')}
                      activeOpacity={0.7}
                      disabled={selectedScreenshotIndex === screenshots.length - 1}
                    >
                      <ChevronRight size={20} color={selectedScreenshotIndex === screenshots.length - 1 ? '#64748B' : '#FFF'} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <ScrollView style={styles.modalSidebar} showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={styles.modalUserRow}
                  onPress={() => {
                    closeScreenshotModal();
                    handleUserPress(selectedScreenshot.user.username);
                  }}
                >
                  <Image
                    source={{ uri: selectedScreenshot.user.avatarUrl }}
                    style={styles.modalAvatar}
                  />
                  <View>
                    <Text style={styles.modalDisplayName}>
                      {selectedScreenshot.user.displayName}
                    </Text>
                    <Text style={styles.modalUsername}>@{selectedScreenshot.user.username}</Text>
                  </View>
                </TouchableOpacity>

                <Text style={styles.modalTitle}>{selectedScreenshot.title}</Text>
                {selectedScreenshot.description && (
                  <Text style={styles.modalDescription}>{selectedScreenshot.description}</Text>
                )}

                {selectedScreenshot.game && (
                  <View style={styles.modalGameBadge}>
                    <Text style={styles.modalGameText}>{shortenGameName(selectedScreenshot.game.name)}</Text>
                  </View>
                )}

                <View style={styles.modalMeta}>
                  <View style={styles.metaItem}>
                    <Eye size={14} color="#94A3B8" />
                    <Text style={styles.metaText}>{selectedScreenshot.views} views</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <Clock size={14} color="#94A3B8" />
                    <Text style={styles.metaText}>{timeAgo(selectedScreenshot.createdAt)}</Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.modalActionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      likeScreenshotMutation.mutate(selectedScreenshot.id);
                    }}
                  >
                    <Heart
                      size={20}
                      color={selectedScreenshot.isLiked ? '#EF4444' : '#94A3B8'}
                      fill={selectedScreenshot.isLiked ? '#EF4444' : 'transparent'}
                    />
                    <Text style={styles.modalActionText}>
                      {selectedScreenshot._count?.likes || 0}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalActionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      fireScreenshotMutation.mutate(selectedScreenshot.id);
                    }}
                  >
                    {selectedScreenshot.isFired ? (
                      <FlameAnimation isActive={false} size={20} />
                    ) : (
                      <Flame size={20} color="#94A3B8" fill="transparent" />
                    )}
                    <Text style={styles.modalActionText}>
                      {selectedScreenshot._count?.fires || 0}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalActionButton}
                    onPress={toggleScreenshotComments}
                  >
                    <MessageSquare size={20} color="#94A3B8" />
                    <Text style={styles.modalActionText}>
                      {selectedScreenshot._count?.comments || 0}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.modalActionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShareContent(selectedScreenshot);
                      setShareModalVisible(true);
                    }}
                  >
                    <Share2 size={20} color="#94A3B8" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalActionButton}>
                    <Flag size={20} color="#94A3B8" />
                  </TouchableOpacity>
                  {user?.id === selectedScreenshot.userId && (
                    <TouchableOpacity style={styles.modalDeleteButton}>
                      <Trash2 size={20} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>

                {!showScreenshotComments && (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.commentsTitle}>
                      Comments ({selectedScreenshot._count?.comments || 0})
                    </Text>

                    {screenshotComments.slice(0, 3).map((c) => (
                      <View key={c.id} style={styles.commentItem}>
                        <TouchableOpacity onPress={() => handleUserPress(c.user.username)} activeOpacity={0.7}>
                          <Image source={{ uri: c.user.avatarUrl }} style={styles.commentAvatar} />
                        </TouchableOpacity>
                        <View style={styles.commentContent}>
                          <Text style={styles.commentText}>
                            <Text style={styles.commentUsername}>{c.user.displayName}</Text>{' '}
                            <CommentText content={c.content} />
                          </Text>
                          <Text style={styles.commentTime}>{timeAgo(c.createdAt)}</Text>
                        </View>
                      </View>
                    ))}

                    {screenshotComments.length === 0 && (
                      <Text style={styles.screenshotNoCommentsText}>No comments yet. Be the first!</Text>
                    )}
                    
                    {screenshotComments.length > 3 && (
                      <TouchableOpacity 
                        style={styles.viewAllCommentsButton}
                        onPress={toggleScreenshotComments}
                      >
                        <Text style={styles.viewAllCommentsText}>View all {screenshotComments.length} comments</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </ScrollView>
            </View>

            {!showScreenshotComments && (
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.modalCommentInput}
              >
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor="#64748B"
                  value={comment}
                  onChangeText={setComment}
                />
                <TouchableOpacity
                  style={[styles.postButton, !comment && styles.postButtonDisabled]}
                  disabled={!comment}
                >
                  <Text style={[styles.postButtonText, comment && styles.postButtonTextActive]}>
                    Post
                  </Text>
                </TouchableOpacity>
              </KeyboardAvoidingView>
            )}

            {/* Full Screen Comments Modal */}
            {showScreenshotComments && (
              <View style={styles.fullScreenCommentsOverlay}>
                <View style={styles.fullScreenCommentsHeader}>
                  <Text style={styles.fullScreenCommentsTitle}>Comments ({selectedScreenshot._count?.comments || 0})</Text>
                  <TouchableOpacity onPress={toggleScreenshotComments}>
                    <X size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>
                
                <ScrollView style={styles.fullScreenCommentsList} showsVerticalScrollIndicator={false}>
                  {screenshotComments.map((c) => (
                    <View key={c.id} style={styles.commentItem}>
                      <TouchableOpacity onPress={() => handleUserPress(c.user.username)} activeOpacity={0.7}>
                        <Image source={{ uri: c.user.avatarUrl }} style={styles.commentAvatar} />
                      </TouchableOpacity>
                      <View style={styles.commentContent}>
                        <Text style={styles.commentText}>
                          <Text style={styles.commentUsername}>{c.user.displayName}</Text>{' '}
                          <CommentText content={c.content} />
                        </Text>
                        <Text style={styles.commentTime}>{timeAgo(c.createdAt)}</Text>
                      </View>
                    </View>
                  ))}
                  
                  {screenshotComments.length === 0 && (
                    <Text style={styles.screenshotNoCommentsText}>No comments yet. Be the first!</Text>
                  )}
                </ScrollView>

                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                  style={styles.modalCommentInput}
                >
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment..."
                    placeholderTextColor="#64748B"
                    value={comment}
                    onChangeText={setComment}
                  />
                  <TouchableOpacity
                    style={[styles.postButton, !comment && styles.postButtonDisabled]}
                    disabled={!comment}
                  >
                    <Text style={[styles.postButtonText, comment && styles.postButtonTextActive]}>
                      Post
                    </Text>
                  </TouchableOpacity>
                </KeyboardAvoidingView>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  const contentTypeLabels: Record<ContentType, { label: string; icon: React.ReactNode }> = {
    reels: { label: 'Reels', icon: <Film size={18} color="#FFF" /> },
    clips: { label: 'Clips', icon: <Video size={18} color="#FFF" /> },
    screenshots: { label: 'Screenshots', icon: <Camera size={18} color="#FFF" /> },
  };

  const renderHeader = (isReels: boolean) => (
    <>
      <Animated.View 
        style={[
          styles.topHeader,
          {
            transform: [
              {
                translateX: menuSlideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, SCREEN_WIDTH],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.filterButtonsRow}>
          <TouchableOpacity
            style={styles.closeMenuButton}
            onPress={() => {
              setMenuVisible(false);
              setShowFilterDropdown(false);
              setShowTimeDropdown(false);
            }}
          >
            <X size={20} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {
              setShowFilterDropdown(!showFilterDropdown);
              setShowTimeDropdown(false);
            }}
          >
            {contentTypeLabels[contentType].icon}
            <Text style={styles.filterButtonText}>{contentTypeLabels[contentType].label}</Text>
            <ChevronDown size={16} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity 
              style={styles.gameFilterIconButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (contentType === 'reels') {
                  setShowReelGameFilter(true);
                } else if (contentType === 'clips') {
                  setShowClipGameFilter(true);
                } else {
                  setShowScreenshotGameFilter(true);
                }
              }}
            >
              <Image 
                source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/dfk9zrks4jxg6elvsx6wj' }}
                style={styles.gameFilterIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingsButton, showTimeDropdown && styles.settingsButtonActive]}
            onPress={() => {
              setShowTimeDropdown(!showTimeDropdown);
              setShowFilterDropdown(false);
            }}
          >
            <Clock size={18} color={showTimeDropdown ? '#4ADE80' : '#FFF'} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {showFilterDropdown && (
        <View style={styles.filterDropdown}>
          {(Object.keys(contentTypeLabels) as ContentType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterOption,
                contentType === type && styles.filterOptionActive,
              ]}
              onPress={() => handleContentTypeChange(type)}
            >
              {contentTypeLabels[type].icon}
              <Text style={[
                styles.filterOptionText,
                contentType === type && styles.filterOptionTextActive,
              ]}>
                {contentTypeLabels[type].label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showTimeDropdown && (
        <View style={styles.timeDropdown}>
          <Text style={styles.timeDropdownTitle}>Time Period</Text>
          {(Object.keys(timePeriodLabels) as TimePeriod[]).map((period) => (
            <TouchableOpacity
              key={period}
              style={[
                styles.timeOption,
                timePeriod === period && styles.timeOptionActive,
              ]}
              onPress={() => handleTimePeriodChange(period)}
            >
              <Clock size={16} color={timePeriod === period ? '#4ADE80' : '#94A3B8'} />
              <Text style={[
                styles.timeOptionText,
                timePeriod === period && styles.timeOptionTextActive,
              ]}>
                {timePeriodLabels[period]}
              </Text>
              {timePeriod === period && (
                <Check size={16} color="#4ADE80" style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </>
  );

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <StatusBar barStyle="light-content" />
      
      {contentType === 'reels' ? (
        <>
          {renderReelsView()}

          {reels.length > 0 && !showReelComments && showReelOverlay && reels[activeIndex] && (
            <View style={[styles.reelOverlayContent, { bottom: insets.bottom }]} pointerEvents="box-none">
              <View style={styles.reelBottomSection}>
                <View style={[styles.reelInfoSection, { pointerEvents: 'auto' } as any]}>
                  <TouchableOpacity
                    style={styles.reelUserRow}
                    onPress={() => handleUserPress(reels[activeIndex].user.username)}
                  >
                    <Image source={{ uri: reels[activeIndex].user.avatarUrl }} style={styles.reelAvatar} />
                    <Text style={styles.reelUsername}>@{reels[activeIndex].user.username}</Text>
                    <TouchableOpacity style={styles.followButton}>
                      <Text style={styles.followButtonText}>Follow</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>

                  <Text style={styles.reelTitle} numberOfLines={2}>{truncateTitle(reels[activeIndex].title, 34)}</Text>

                  {reels[activeIndex].description ? (
                    <ExpandableText text={reels[activeIndex].description} maxLength={20} />
                  ) : null}

                  {reels[activeIndex].game ? (
                    <TouchableOpacity
                      style={styles.reelGameRow}
                      onPress={() => router.push({ pathname: '/game/[id]', params: { id: reels[activeIndex].game.id.toString(), name: reels[activeIndex].game.name, boxArt: reels[activeIndex].game.imageUrl || '' } })}
                      activeOpacity={0.7}
                    >
                      <Gamepad2 size={14} color="#4ADE80" />
                      <Text style={styles.reelGameText}>{shortenGameName(reels[activeIndex].game.name)}</Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.reelMusicRow}>
                    <Music2 size={14} color="#FFF" />
                    <Text style={styles.reelMusicText} numberOfLines={1}>Original audio • {reels[activeIndex].user.username}</Text>
                  </View>
                </View>

                <View style={[styles.reelActionsColumn, { pointerEvents: 'auto' } as any]}>
                  <View style={styles.reelActionButton}>
                    <Eye size={28} color="#FFF" />
                    <Text style={styles.reelActionCount}>{formatNumber(reels[activeIndex].views)}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.reelActionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      likeReelMutate(reels[activeIndex].id);
                    }}
                  >
                    <Heart
                      size={28}
                      color={reels[activeIndex].isLiked ? '#EF4444' : '#FFF'}
                      fill={reels[activeIndex].isLiked ? '#EF4444' : 'transparent'}
                    />
                    <Text style={styles.reelActionCount}>{formatNumber(reels[activeIndex]._count?.likes || 0)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.reelActionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      fireReelMutate(reels[activeIndex].id);
                    }}
                  >
                    {reels[activeIndex].isFired ? (
                      <FlameAnimation isActive={false} size={28} />
                    ) : (
                      <Flame size={28} color="#FFF" fill="transparent" />
                    )}
                    <Text style={styles.reelActionCount}>{formatNumber(reels[activeIndex]._count?.fires || 0)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.reelActionButton} onPress={toggleReelComments}>
                    <MessageSquare size={28} color="#FFF" />
                    <Text style={styles.reelActionCount}>{formatNumber(reels[activeIndex]._count?.comments || 0)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.reelActionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShareContent(reels[activeIndex]);
                      setShareModalVisible(true);
                    }}
                  >
                    <Share2 size={28} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}>
            {renderHeader(true)}
          </View>
        </>
      ) : contentType === 'clips' ? (
        <>
          {renderClipsView()}

          {clips.length > 0 && !showClipComments && showClipOverlay && clips[activeIndex] && (
            <View style={[styles.reelOverlayContent, { bottom: insets.bottom }]} pointerEvents="box-none">
              <View style={styles.reelBottomSection}>
                <View style={[styles.reelInfoSection, { pointerEvents: 'auto' } as any]}>
                  <TouchableOpacity
                    style={styles.reelUserRow}
                    onPress={() => handleUserPress(clips[activeIndex].user.username)}
                  >
                    <Image source={{ uri: clips[activeIndex].user.avatarUrl }} style={styles.reelAvatar} />
                    <Text style={styles.reelUsername}>@{clips[activeIndex].user.username}</Text>
                    <TouchableOpacity style={styles.followButton}>
                      <Text style={styles.followButtonText}>Follow</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>

                  <Text style={styles.reelTitle} numberOfLines={2}>{truncateTitle(clips[activeIndex].title, 34)}</Text>

                  {clips[activeIndex].description ? (
                    <ExpandableText text={clips[activeIndex].description} maxLength={20} />
                  ) : null}

                  {clips[activeIndex].game ? (
                    <TouchableOpacity
                      style={styles.reelGameRow}
                      onPress={() => router.push({ pathname: '/game/[id]', params: { id: clips[activeIndex].game.id.toString(), name: clips[activeIndex].game.name, boxArt: clips[activeIndex].game.imageUrl || '' } })}
                      activeOpacity={0.7}
                    >
                      <Gamepad2 size={14} color="#4ADE80" />
                      <Text style={styles.reelGameText}>{shortenGameName(clips[activeIndex].game.name)}</Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={[styles.clipBottomActions, { marginBottom: 0, marginTop: 10 }]}>
                    <TouchableOpacity
                      style={styles.clipBottomActionButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        likeClipMutate(clips[activeIndex].id);
                      }}
                    >
                      <Heart
                        size={18}
                        color={clips[activeIndex].isLiked ? '#EF4444' : '#FFF'}
                        fill={clips[activeIndex].isLiked ? '#EF4444' : 'transparent'}
                      />
                      <Text style={styles.clipBottomActionText}>{formatNumber(clips[activeIndex]._count?.likes || 0)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.clipBottomActionButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        fireClipMutate(clips[activeIndex].id);
                      }}
                    >
                      {clips[activeIndex].isFired ? (
                        <FlameAnimation isActive={false} size={18} />
                      ) : (
                        <Flame size={18} color="#FFF" fill="transparent" />
                      )}
                      <Text style={styles.clipBottomActionText}>{formatNumber(clips[activeIndex]._count?.fires || 0)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.clipBottomActionButton}
                      onPress={toggleClipComments}
                    >
                      <MessageSquare size={18} color="#FFF" />
                      <Text style={styles.clipBottomActionText}>{formatNumber(clips[activeIndex]._count?.comments || 0)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.clipBottomActionButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShareContent(clips[activeIndex]);
                        setShareModalVisible(true);
                      }}
                    >
                      <Share2 size={18} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}>
            {renderHeader(true)}
          </View>
        </>
      ) : (
        <>
          {renderScreenshotsView()}

          {screenshots.length > 0 && !showScreenshotComments && showScreenshotOverlay && screenshots[activeScreenshotIndex] && (
            <View style={[styles.reelOverlayContent, { bottom: insets.bottom }]} pointerEvents="box-none">
              <View style={styles.reelBottomSection}>
                <View style={[styles.reelInfoSection, { pointerEvents: 'auto' } as any]}>
                  <TouchableOpacity
                    style={styles.reelUserRow}
                    onPress={() => handleUserPress(screenshots[activeScreenshotIndex].user.username)}
                  >
                    <Image source={{ uri: screenshots[activeScreenshotIndex].user.avatarUrl }} style={styles.reelAvatar} />
                    <Text style={styles.reelUsername}>@{screenshots[activeScreenshotIndex].user.username}</Text>
                    <TouchableOpacity style={styles.followButton}>
                      <Text style={styles.followButtonText}>Follow</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>

                  <Text style={styles.reelTitle} numberOfLines={2}>{truncateTitle(screenshots[activeScreenshotIndex].title, 34)}</Text>

                  {screenshots[activeScreenshotIndex].description ? (
                    <ExpandableText text={screenshots[activeScreenshotIndex].description} maxLength={20} />
                  ) : null}

                  {screenshots[activeScreenshotIndex].game ? (
                    <TouchableOpacity
                      style={styles.reelGameRow}
                      onPress={() => router.push({ pathname: '/game/[id]', params: { id: screenshots[activeScreenshotIndex].game.id.toString(), name: screenshots[activeScreenshotIndex].game.name, boxArt: screenshots[activeScreenshotIndex].game.imageUrl || '' } })}
                      activeOpacity={0.7}
                    >
                      <Gamepad2 size={14} color="#4ADE80" />
                      <Text style={styles.reelGameText}>{shortenGameName(screenshots[activeScreenshotIndex].game.name)}</Text>
                    </TouchableOpacity>
                  ) : null}

                  <View style={[styles.clipBottomActions, { marginBottom: 0, marginTop: 10 }]}>
                    <TouchableOpacity
                      style={styles.clipBottomActionButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        likeScreenshotMutation.mutate(screenshots[activeScreenshotIndex].id);
                      }}
                    >
                      <Heart
                        size={18}
                        color={screenshots[activeScreenshotIndex].isLiked ? '#EF4444' : '#FFF'}
                        fill={screenshots[activeScreenshotIndex].isLiked ? '#EF4444' : 'transparent'}
                      />
                      <Text style={styles.clipBottomActionText}>{formatNumber(screenshots[activeScreenshotIndex]._count?.likes || 0)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.clipBottomActionButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        fireScreenshotMutation.mutate(screenshots[activeScreenshotIndex].id);
                      }}
                    >
                      {screenshots[activeScreenshotIndex].isFired ? (
                        <FlameAnimation isActive={false} size={18} />
                      ) : (
                        <Flame size={18} color="#FFF" fill="transparent" />
                      )}
                      <Text style={styles.clipBottomActionText}>{formatNumber(screenshots[activeScreenshotIndex]._count?.fires || 0)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.clipBottomActionButton}
                      onPress={toggleScreenshotComments}
                    >
                      <MessageSquare size={18} color="#FFF" />
                      <Text style={styles.clipBottomActionText}>{formatNumber(screenshots[activeScreenshotIndex]._count?.comments || 0)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.clipBottomActionButton}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShareContent(screenshots[activeScreenshotIndex]);
                        setShareModalVisible(true);
                      }}
                    >
                      <Share2 size={18} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}

          <View style={[styles.topOverlay, { paddingTop: insets.top + 10 }]}>
            {renderHeader(false)}
          </View>
        </>
      )}

      {renderScreenshotModal()}

      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 12 }]}
        onPress={() => router.back()}
      >
        <X size={20} color="#FFF" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.menuCogButton, { top: insets.top + 12 }]}
        onPress={() => {
          setMenuVisible(!menuVisible);
          setShowFilterDropdown(false);
          setShowTimeDropdown(false);
        }}
      >
        {menuVisible ? (
          <Eye size={20} color="#4ADE80" />
        ) : (
          <EyeOff size={20} color="#4ADE80" />
        )}
      </TouchableOpacity>

      {shareContent && (
        <ShareClipModal
          visible={shareModalVisible}
          onClose={() => {
            setShareModalVisible(false);
            setShareContent(null);
          }}
          isOwnClip={shareContent.userId === user?.id}
          contentType={contentType === 'reels' ? 'reel' : 'clip'}
          clip={{
            id: shareContent.id,
            title: shareContent.title,
            thumbnail: 'videoUrl' in shareContent ? shareContent.thumbnailUrl : shareContent.imageUrl,
            videoPlaceholder: 'videoUrl' in shareContent ? shareContent.videoUrl : undefined,
            user: {
              handle: shareContent.user.username,
              username: shareContent.user.username,
            },
          }}
        />
      )}

      <Modal
        visible={showReelGameFilter}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowReelGameFilter(false);
          setReelGameSearch('');
          setSearchedGames([]);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setShowReelGameFilter(false);
              setReelGameSearch('');
              setSearchedGames([]);
            }}
          />
          <View style={[styles.gameFilterModalNew, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.gameFilterModalHeaderNew}>
              <View style={styles.gameFilterHeaderTitleRow}>
                <View style={styles.gameFilterIconContainer}>
                  <Gamepad2 size={24} color="#4ADE80" />
                </View>
                <Text style={styles.gameFilterModalTitleNew}>Filter Reels by Game</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setShowReelGameFilter(false);
                  setReelGameSearch('');
                  setSearchedGames([]);
                }}
                style={styles.closeGameFilterButtonNew}
              >
                <X size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.gameFilterSearchContainer}>
              <Search size={20} color="#94A3B8" />
              <TextInput
                style={styles.gameFilterSearchInput}
                placeholder="Search for games..."
                placeholderTextColor="#64748B"
                value={reelGameSearch}
                onChangeText={setReelGameSearch}
              />
            </View>

            <Text style={styles.gameFilterSectionTitle}>
              {reelGameSearch.length > 0 ? 'Search Results' : 'Available Games'}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gameFilterGridContainer}
            >
              {isSearchingGames && reelGameSearch.length > 0 ? (
                <View style={styles.gameFilterLoadingContainer}>
                  <ActivityIndicator size="large" color="#4ADE80" />
                </View>
              ) : (
                <View style={styles.gameFilterGridNew}>
                  <TouchableOpacity
                    style={[
                      styles.gameFilterCardNew,
                      selectedReelGame === null && styles.gameFilterCardNewSelected
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedReelGame(null);
                      setSelectedReelGameName(null);
                      setShowReelGameFilter(false);
                      setReelGameSearch('');
                      setSearchedGames([]);
                    }}
                  >
                    <View style={styles.gameFilterAllGamesPlaceholderNew}>
                      <Gamepad2 size={32} color="#4ADE80" />
                    </View>
                    {selectedReelGame === null && (
                      <View style={styles.gameFilterSelectedBadge}>
                        <Check size={14} color="#131F2A" />
                      </View>
                    )}
                    <View style={styles.gameFilterCardOverlay}>
                      <Text style={styles.gameFilterCardNameNew} numberOfLines={2}>All Games</Text>
                    </View>
                  </TouchableOpacity>

                  {(reelGameSearch.length > 0 ? searchedGames : (topGames.length > 0 ? topGames : contentGames))
                    .slice()
                    .sort((a, b) => {
                      const aCount = allReels.filter(r => r.game?.id === a.id).length;
                      const bCount = allReels.filter(r => r.game?.id === b.id).length;
                      if (aCount > 0 && bCount === 0) return -1;
                      if (aCount === 0 && bCount > 0) return 1;
                      return 0;
                    })
                    .map((game) => {
                    const reelCount = allReels.filter(r => r.game?.id === game.id).length;
                    const isSelected = selectedReelGame === game.id.toString();
                    const hasContent = reelCount > 0;
                    
                    return (
                      <TouchableOpacity
                        key={`reel-game-${game.id}`}
                        style={[
                          styles.gameFilterCardNew,
                          isSelected && styles.gameFilterCardNewSelected,
                          !hasContent && styles.gameFilterCardNewFaded
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedReelGame(game.id.toString());
                          setSelectedReelGameName(game.name);
                          setShowReelGameFilter(false);
                          setReelGameSearch('');
                          setSearchedGames([]);
                        }}
                      >
                        <Image
                          source={{ uri: game.imageUrl }}
                          style={styles.gameFilterCardImageNew}
                          resizeMode="cover"
                        />
                        {isSelected && (
                          <View style={styles.gameFilterSelectedBadge}>
                            <Check size={14} color="#131F2A" />
                          </View>
                        )}
                        <View style={styles.gameFilterCardOverlay}>
                          <Text style={styles.gameFilterCardNameNew} numberOfLines={2}>{game.name}</Text>
                          {hasContent && (
                            <Text style={styles.gameFilterCardCountNew}>{reelCount} {reelCount === 1 ? 'reel' : 'reels'}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showClipGameFilter}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowClipGameFilter(false);
          setClipGameSearch('');
          setSearchedGames([]);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setShowClipGameFilter(false);
              setClipGameSearch('');
              setSearchedGames([]);
            }}
          />
          <View style={[styles.gameFilterModalNew, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.gameFilterModalHeaderNew}>
              <View style={styles.gameFilterHeaderTitleRow}>
                <View style={styles.gameFilterIconContainer}>
                  <Gamepad2 size={24} color="#4ADE80" />
                </View>
                <Text style={styles.gameFilterModalTitleNew}>Filter Clips by Game</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setShowClipGameFilter(false);
                  setClipGameSearch('');
                  setSearchedGames([]);
                }}
                style={styles.closeGameFilterButtonNew}
              >
                <X size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.gameFilterSearchContainer}>
              <Search size={20} color="#94A3B8" />
              <TextInput
                style={styles.gameFilterSearchInput}
                placeholder="Search for games..."
                placeholderTextColor="#64748B"
                value={clipGameSearch}
                onChangeText={setClipGameSearch}
              />
            </View>

            <Text style={styles.gameFilterSectionTitle}>
              {clipGameSearch.length > 0 ? 'Search Results' : 'Available Games'}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gameFilterGridContainer}
            >
              {isSearchingGames && clipGameSearch.length > 0 ? (
                <View style={styles.gameFilterLoadingContainer}>
                  <ActivityIndicator size="large" color="#4ADE80" />
                </View>
              ) : (
                <View style={styles.gameFilterGridNew}>
                  <TouchableOpacity
                    style={[
                      styles.gameFilterCardNew,
                      selectedClipGame === null && styles.gameFilterCardNewSelected
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedClipGame(null);
                      setSelectedClipGameName(null);
                      setShowClipGameFilter(false);
                      setClipGameSearch('');
                      setSearchedGames([]);
                    }}
                  >
                    <View style={styles.gameFilterAllGamesPlaceholderNew}>
                      <Gamepad2 size={32} color="#4ADE80" />
                    </View>
                    {selectedClipGame === null && (
                      <View style={styles.gameFilterSelectedBadge}>
                        <Check size={14} color="#131F2A" />
                      </View>
                    )}
                    <View style={styles.gameFilterCardOverlay}>
                      <Text style={styles.gameFilterCardNameNew} numberOfLines={2}>All Games</Text>
                    </View>
                  </TouchableOpacity>

                  {(clipGameSearch.length > 0 ? searchedGames : (topGames.length > 0 ? topGames : contentGames))
                    .slice()
                    .sort((a, b) => {
                      const aCount = allClips.filter(c => c.game?.id === a.id).length;
                      const bCount = allClips.filter(c => c.game?.id === b.id).length;
                      if (aCount > 0 && bCount === 0) return -1;
                      if (aCount === 0 && bCount > 0) return 1;
                      return 0;
                    })
                    .map((game) => {
                    const clipCount = allClips.filter(c => c.game?.id === game.id).length;
                    const isSelected = selectedClipGame === game.id.toString();
                    const hasContent = clipCount > 0;
                    
                    return (
                      <TouchableOpacity
                        key={`clip-game-${game.id}`}
                        style={[
                          styles.gameFilterCardNew,
                          isSelected && styles.gameFilterCardNewSelected,
                          !hasContent && styles.gameFilterCardNewFaded
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedClipGame(game.id.toString());
                          setSelectedClipGameName(game.name);
                          setShowClipGameFilter(false);
                          setClipGameSearch('');
                          setSearchedGames([]);
                        }}
                      >
                        <Image
                          source={{ uri: game.imageUrl }}
                          style={styles.gameFilterCardImageNew}
                          resizeMode="cover"
                        />
                        {isSelected && (
                          <View style={styles.gameFilterSelectedBadge}>
                            <Check size={14} color="#131F2A" />
                          </View>
                        )}
                        <View style={styles.gameFilterCardOverlay}>
                          <Text style={styles.gameFilterCardNameNew} numberOfLines={2}>{game.name}</Text>
                          {hasContent && (
                            <Text style={styles.gameFilterCardCountNew}>{clipCount} {clipCount === 1 ? 'clip' : 'clips'}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showScreenshotGameFilter}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowScreenshotGameFilter(false);
          setScreenshotGameSearch('');
          setSearchedGames([]);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setShowScreenshotGameFilter(false);
              setScreenshotGameSearch('');
              setSearchedGames([]);
            }}
          />
          <View style={[styles.gameFilterModalNew, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.gameFilterModalHeaderNew}>
              <View style={styles.gameFilterHeaderTitleRow}>
                <View style={styles.gameFilterIconContainer}>
                  <Gamepad2 size={24} color="#4ADE80" />
                </View>
                <Text style={styles.gameFilterModalTitleNew}>Filter Screenshots by Game</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setShowScreenshotGameFilter(false);
                  setScreenshotGameSearch('');
                  setSearchedGames([]);
                }}
                style={styles.closeGameFilterButtonNew}
              >
                <X size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.gameFilterSearchContainer}>
              <Search size={20} color="#94A3B8" />
              <TextInput
                style={styles.gameFilterSearchInput}
                placeholder="Search for games..."
                placeholderTextColor="#64748B"
                value={screenshotGameSearch}
                onChangeText={setScreenshotGameSearch}
              />
            </View>

            <Text style={styles.gameFilterSectionTitle}>
              {screenshotGameSearch.length > 0 ? 'Search Results' : 'Available Games'}
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.gameFilterGridContainer}
            >
              {isSearchingGames && screenshotGameSearch.length > 0 ? (
                <View style={styles.gameFilterLoadingContainer}>
                  <ActivityIndicator size="large" color="#4ADE80" />
                </View>
              ) : (
                <View style={styles.gameFilterGridNew}>
                  <TouchableOpacity
                    style={[
                      styles.gameFilterCardNew,
                      selectedScreenshotGame === null && styles.gameFilterCardNewSelected
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedScreenshotGame(null);
                      setSelectedScreenshotGameName(null);
                      setShowScreenshotGameFilter(false);
                      setScreenshotGameSearch('');
                      setSearchedGames([]);
                    }}
                  >
                    <View style={styles.gameFilterAllGamesPlaceholderNew}>
                      <Gamepad2 size={32} color="#4ADE80" />
                    </View>
                    {selectedScreenshotGame === null && (
                      <View style={styles.gameFilterSelectedBadge}>
                        <Check size={14} color="#131F2A" />
                      </View>
                    )}
                    <View style={styles.gameFilterCardOverlay}>
                      <Text style={styles.gameFilterCardNameNew} numberOfLines={2}>All Games</Text>
                    </View>
                  </TouchableOpacity>

                  {(screenshotGameSearch.length > 0 ? searchedGames : (topGames.length > 0 ? topGames : contentGames))
                    .slice()
                    .sort((a, b) => {
                      const aCount = allScreenshots.filter(s => s.game?.id === a.id).length;
                      const bCount = allScreenshots.filter(s => s.game?.id === b.id).length;
                      if (aCount > 0 && bCount === 0) return -1;
                      if (aCount === 0 && bCount > 0) return 1;
                      return 0;
                    })
                    .map((game) => {
                    const screenshotCount = allScreenshots.filter(s => s.game?.id === game.id).length;
                    const isSelected = selectedScreenshotGame === game.id.toString();
                    const hasContent = screenshotCount > 0;
                    
                    return (
                      <TouchableOpacity
                        key={`screenshot-game-${game.id}`}
                        style={[
                          styles.gameFilterCardNew,
                          isSelected && styles.gameFilterCardNewSelected,
                          !hasContent && styles.gameFilterCardNewFaded
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setSelectedScreenshotGame(game.id.toString());
                          setSelectedScreenshotGameName(game.name);
                          setShowScreenshotGameFilter(false);
                          setScreenshotGameSearch('');
                          setSearchedGames([]);
                        }}
                      >
                        <Image
                          source={{ uri: game.imageUrl }}
                          style={styles.gameFilterCardImageNew}
                          resizeMode="cover"
                        />
                        {isSelected && (
                          <View style={styles.gameFilterSelectedBadge}>
                            <Check size={14} color="#131F2A" />
                          </View>
                        )}
                        <View style={styles.gameFilterCardOverlay}>
                          <Text style={styles.gameFilterCardNameNew} numberOfLines={2}>{game.name}</Text>
                          {hasContent && (
                            <Text style={styles.gameFilterCardCountNew}>{screenshotCount}</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131F2A',
  },
  screenshotsViewContainer: {
    flex: 1,
    backgroundColor: '#131F2A',
  },
  screenshotPageContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  screenshotPageItem: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  screenshotPageImageWrapper: {
    width: SCREEN_WIDTH,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  screenshotPageImage: {
    width: '100%',
    height: '100%',
  },
  screenshotTouchable: {
    flex: 1,
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  videoTouchable: {
    flex: 1,
  },
  video: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
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
  reelOverlayContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  closeOverlayButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  reelBottomSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  reelInfoSection: {
    flex: 1,
    marginBottom: 0,
  },
  reelUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reelAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FFF',
    marginRight: 8,
  },
  reelUsername: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followButton: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
    marginLeft: 8,
  },
  followButtonText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  reelTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reelDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginBottom: 3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    maxWidth: '85%',
  },
  seeMoreButton: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600' as const,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reelGameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  reelGameText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  reelMusicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reelMusicText: {
    color: '#FFF',
    fontSize: 10,
    flex: 1,
  },
  reelActionsColumn: {
    alignItems: 'center',
    gap: 12,
  },
  reelActionButton: {
    alignItems: 'center',
  },
  reelActionCount: {
    color: '#FFF',
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  clipFixedOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    pointerEvents: 'box-none',
  },
  clipTopInfo: {
    pointerEvents: 'auto',
  },
  clipBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 0,
    paddingHorizontal: 0,
    gap: 24,
    marginBottom: 20,
    pointerEvents: 'auto',
  },
  clipBottomActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  clipBottomActionText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  fullScreenButtonOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 20,
    zIndex: 20,
  },
  clipVideoPlayerControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  clipControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'center',
  },
  clipControlButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipControlsSpacer: {
    flex: 1,
  },
  viewsOverlay: {
    position: 'absolute',
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
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  gridTopHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendingTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  filterButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  filterButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  settingsButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  settingsButtonActive: {
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  backButton: {
    position: 'absolute',
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  menuCogButton: {
    position: 'absolute',
    right: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    zIndex: 100,
  },
  closeMenuButton: {
    padding: 8,
    marginRight: 12,
  },
  filterDropdown: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  filterOptionActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  filterOptionText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '500' as const,
  },
  filterOptionTextActive: {
    color: '#4ADE80',
  },
  timeDropdown: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
    paddingVertical: 8,
  },
  timeDropdownTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  timeOptionActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  timeOptionText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '500' as const,
    flex: 1,
  },
  timeOptionTextActive: {
    color: '#4ADE80',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  gridContent: {
    flex: 1,
  },


  clipVideo: {
    flex: 1,
    backgroundColor: '#000',
  },
  clipPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipPlayIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipDurationOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  clipDurationText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  clipViewsOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  clipViewsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  clipInfoContainer: {
    padding: 16,
    flex: 1,
  },
  clipInfoLeft: {
    flex: 1,
  },
  clipUserRowNew: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  clipAvatarNew: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#2D3748',
  },
  clipUsernameNew: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  clipGameName: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  clipTitleNew: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
    lineHeight: 22,
  },
  fullScreenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  fullScreenText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  clipActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  clipActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clipActionCount: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  clipActionCountActive: {
    color: '#EF4444',
  },
  clipActionCountFired: {
    color: '#F97316',
  },

  clipGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  clipDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
  },
  clipInfo: {
    padding: 10,
  },
  clipTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
    marginBottom: 6,
    lineHeight: 18,
  },
  clipUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  clipAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
    backgroundColor: '#2D3748',
  },
  clipUsername: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500' as const,
  },
  gameTag: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  gameTagText: {
    color: '#131F2A',
    fontSize: 10,
    fontWeight: 'bold' as const,
  },
  clipStats: {
    flexDirection: 'row',
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  screenshotCard: {
    width: (SCREEN_WIDTH - 6) / 3,
    height: (SCREEN_WIDTH - 6) / 3,
    backgroundColor: '#000',
  },
  screenshotThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E2D3C',
  },
  screenshotsContainer: {
    paddingBottom: 100,
  },
  screenshotsColumnWrapper: {
    gap: 1,
    marginBottom: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  uploadButton: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  uploadButtonText: {
    color: '#131F2A',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    backgroundColor: '#131F2A',
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
    top: 50,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalBody: {
    flex: 1,
    flexDirection: SCREEN_WIDTH < 768 ? 'column' : 'row',
  },
  modalImageContainer: {
    flex: SCREEN_WIDTH < 768 ? undefined : 0.75,
    height: SCREEN_WIDTH < 768 ? SCREEN_HEIGHT * 0.5 : '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalSidebar: {
    flex: SCREEN_WIDTH < 768 ? 1 : 0.25,
    backgroundColor: '#131F2A',
    padding: 16,
  },
  modalUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: '#2D3748',
  },
  modalDisplayName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  modalUsername: {
    color: '#94A3B8',
    fontSize: 13,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 8,
  },
  modalDescription: {
    color: '#CBD5E1',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  modalGameBadge: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  modalGameText: {
    color: '#131F2A',
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
  modalMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  modalActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalActionText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  modalDeleteButton: {
    marginLeft: 'auto',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 16,
  },
  commentsTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
    backgroundColor: '#2D3748',
  },
  commentContent: {
    flex: 1,
  },
  commentText: {
    color: '#FFF',
    fontSize: 13,
    lineHeight: 18,
  },
  commentUsername: {
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  commentTime: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  screenshotNoCommentsText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  viewAllCommentsButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewAllCommentsText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  fullScreenCommentsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#131F2A',
    zIndex: 1000,
  },
  fullScreenCommentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  fullScreenCommentsTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700' as const,
  },
  fullScreenCommentsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  modalCommentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#131F2A',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  postButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#64748B',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  postButtonTextActive: {
    color: '#4ADE80',
  },
  clipCardContainer: {
    backgroundColor: '#1E2D3C',
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  clipCardHeader: {
    marginBottom: 12,
  },
  clipCardUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clipCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#2D3748',
  },
  clipCardUserInfo: {
    flex: 1,
  },
  clipCardDisplayName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  clipCardUsername: {
    color: '#94A3B8',
    fontSize: 14,
  },
  clipCardTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 20,
    marginBottom: 8,
  },
  clipCardDescription: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 12,
  },
  clipCardVideoContainer: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 12,
  },
  clipCardVideo: {
    width: '100%',
    height: '100%',
  },
  clipCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#2D3748',
    marginBottom: 8,
  },
  clipCardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clipCardActionText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  clipCardActionTextActive: {
    color: '#EF4444',
  },
  clipCardActionTextFired: {
    color: '#F97316',
  },
  clipCardGameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  clipCardGameText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  twitterClipContainer: {
    backgroundColor: '#000',
    marginBottom: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#2F3336',
  },
  twitterVideoSection: {
    width: '100%',
    height: 420,
    backgroundColor: '#000',
    position: 'relative',
  },
  twitterVideo: {
    width: '100%',
    height: '100%',
  },
  twitterVideoControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  twitterProgressBarContainer: {
    marginBottom: 8,
  },
  twitterProgressBarBg: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  twitterProgressBarFill: {
    height: '100%',
    backgroundColor: '#1D9BF0',
    borderRadius: 2,
  },
  twitterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  twitterPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  twitterTimeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  twitterClipContent: {
    padding: 12,
    backgroundColor: '#000',
  },
  twitterUserSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  twitterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#2D3748',
  },
  twitterUserInfo: {
    flex: 1,
  },
  twitterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  twitterDisplayName: {
    color: '#E7E9EA',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  twitterUsername: {
    color: '#71767B',
    fontSize: 15,
    fontWeight: '400' as const,
    marginTop: 2,
  },
  twitterPostText: {
    color: '#E7E9EA',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 12,
  },
  twitterActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    maxWidth: 425,
  },
  twitterActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  twitterActionText: {
    color: '#71767B',
    fontSize: 13,
    fontWeight: '400' as const,
  },
  clipsScrollContainer: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  reelVideoWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  commentsSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  commentsSectionInner: {
    flex: 1,
  },
  commentInputWrapper: {
    backgroundColor: '#131F2A',
  },
  commentsListWrapper: {
    flex: 1,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    position: 'relative',
  },
  commentsHeaderDragHandle: {
    position: 'absolute',
    top: 8,
    width: 40,
    height: 4,
    backgroundColor: '#64748B',
    borderRadius: 2,
  },
  commentsSectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 8,
  },
  closeCommentsButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    padding: 4,
  },
  commentsLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    padding: 16,
    paddingBottom: 16,
  },
  noCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noCommentsText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 12,
  },
  noCommentsSubtext: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
  },
  reelCommentItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  reelCommentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: '#2D3748',
  },
  reelCommentContent: {
    flex: 1,
  },
  reelCommentText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 20,
  },
  reelCommentUsername: {
    fontWeight: '700' as const,
    color: '#FFF',
  },
  reelCommentTime: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  reelCommentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#131F2A',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#131F2A',
  },
  reelCommentInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
    marginRight: 12,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reelPostButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  reelPostButtonDisabled: {
    opacity: 0.5,
  },
  reelPostButtonText: {
    color: '#64748B',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  reelPostButtonTextActive: {
    color: '#4ADE80',
  },
  miniReelInfo: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 10,
  },
  miniUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFF',
    marginRight: 8,
  },
  miniUsername: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  miniTitle: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gameFilterContainer: {
    marginTop: 8,
  },
  gameFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  gameFilterButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
  },
  gameFilterCountText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  gameFilterButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    maxWidth: 140,
  },
  gameFilterButtonTextInline: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
    flexShrink: 1,
  },
  gameFilterIconButton: {
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameFilterIcon: {
    width: 20,
    height: 20,
  },
  gameFilterModal: {
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  gameFilterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  gameFilterModalTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  closeGameFilterButton: {
    padding: 4,
  },
  gameFilterOptionList: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  gameFilterOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  gameFilterOptionItemActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: '#4ADE80',
  },
  gameFilterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  gameFilterOptionName: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500' as const,
  },
  gameFilterOptionNameActive: {
    color: '#4ADE80',
    fontWeight: '600' as const,
  },
  gameFilterOptionCount: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  gameFilterOptionCountActive: {
    color: '#4ADE80',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  gameFilterModalNew: {
    height: '90%',
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  gameFilterModalHeaderNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  gameFilterHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gameFilterIconContainer: {
    // Styling if needed
  },
  gameFilterModalTitleNew: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  closeGameFilterButtonNew: {
    padding: 4,
  },
  gameFilterSearchContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  gameFilterSearchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  gameFilterSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 16,
  },
  gameFilterGridContainer: {
    paddingBottom: 40,
  },
  gameFilterLoadingContainer: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gameFilterCard: {
    width: (SCREEN_WIDTH - 40 - 12) / 2,
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    position: 'relative',
    marginBottom: 12,
    alignItems: 'center',
    padding: 8,
    gap: 10,
  },
  gameFilterCardSelected: {
    backgroundColor: '#2D3748',
  },
  gameFilterCardImage: {
    width: 80,
    height: 107,
    borderRadius: 8,
    backgroundColor: '#2D3748',
  },
  gameFilterAllGamesPlaceholder: {
    width: 80,
    height: 107,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  gameFilterSelectedOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 2,
  },
  gameFilterCardInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  gameFilterCardName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  gameFilterCardCount: {
    color: '#94A3B8',
    fontSize: 12,
  },
  gameFilterCardFaded: {
    opacity: 0.4,
  },
  gameFilterCardImageFaded: {
    opacity: 0.5,
  },
  gameFilterCardDisabled: {
    opacity: 0.5,
    backgroundColor: '#1A1F2E',
  },
  gameFilterCardImageDisabled: {
    opacity: 0.3,
  },
  gameFilterCardNameDisabled: {
    color: '#64748B',
  },
  gameFilterCardCountDisabled: {
    color: '#475569',
  },
  gameFilterGridNew: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gameFilterCardNew: {
    width: (SCREEN_WIDTH - 40 - 20) / 3,
    aspectRatio: 0.75,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    position: 'relative',
  },
  gameFilterCardNewSelected: {
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  gameFilterCardNewFaded: {
    opacity: 0.4,
  },
  gameFilterCardImageNew: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2D3748',
  },
  gameFilterAllGamesPlaceholderNew: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E2D3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameFilterSelectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameFilterCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  gameFilterCardNameNew: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  gameFilterCardCountNew: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '500' as const,
    textAlign: 'center',
    marginTop: 2,
  },
  slideshowContainer: {
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  featuredScreenshotWrapper: {
    marginHorizontal: 16,
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 0,
    paddingVertical: 8,
    gap: 1,
  },
  gridThumbnail: {
    width: (SCREEN_WIDTH - 4) / 5,
    height: (SCREEN_WIDTH - 4) / 5,
    overflow: 'hidden',
    position: 'relative',
  },
  gridThumbnailActive: {
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  gridThumbnailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E2D3C',
  },
  gridThumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  slideshowFeatured: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E2D3C',
    marginBottom: 12,
  },
  slideshowFeaturedTouchable: {
    width: '100%',
    height: '100%',
  },
  slideshowFeaturedInner: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  slideshowFeaturedImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E2D3C',
  },
  featuredScreenshotDetails: {
    gap: 8,
  },
  featuredUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featuredAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2D3748',
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  featuredUserInfo: {
    flex: 1,
  },
  featuredDisplayName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  featuredUsername: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  featuredTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  featuredDescription: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  featuredGameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  featuredGameText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  featuredStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  featuredStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featuredStatText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500' as const,
  },
  screenshotNavOverlay: {
    position: 'absolute',
    top: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 20,
  },
  screenshotNavArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  screenshotNavArrowDisabled: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  screenshotNavDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenshotNavDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  screenshotNavDotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFF',
  },
});
