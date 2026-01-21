import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Animated,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { truncateTitle } from '@/constants/formatters';
import { useRouter } from 'expo-router';
import {
  Heart,
  Flame,
  MessageSquare,
  Share2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Gamepad2,
  Music2,
  X,
  Eye,
} from 'lucide-react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Haptics from 'expo-haptics';
import FlameAnimation from '@/components/FlameAnimation';

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

interface ReelData {
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

interface Comment {
  id: number;
  userId: number;
  content: string;
  createdAt: string;
  user: UserBasic;
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

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

const ExpandableText = ({ text, maxLength = 100 }: { text: string; maxLength?: number }) => {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > maxLength;

  if (!needsTruncation) {
    return <Text style={styles.reelDescription}>{text}</Text>;
  }

  return (
    <View>
      <Text style={styles.reelDescription}>
        {expanded ? text : `${text.substring(0, maxLength)}...`}
        {!expanded && needsTruncation && (
          <Text style={styles.seeMoreButton} onPress={() => setExpanded(true)}>
            {' '}see more
          </Text>
        )}
      </Text>
    </View>
  );
};

interface ReelViewerProps {
  item: ReelData;
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
  isTabFocused?: boolean;
  onClose?: () => void;
}

const ReelViewer = React.memo(({ 
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
  isTabFocused = true,
  onClose,
}: ReelViewerProps) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [localIsLiked, setLocalIsLiked] = useState(item.isLiked || false);
  const [localIsFired, setLocalIsFired] = useState(item.isFired || false);
  const [localLikeCount, setLocalLikeCount] = useState(item._count?.likes || 0);
  const [localFireCount, setLocalFireCount] = useState(item._count?.fires || 0);
  const [showFlameAnimation, setShowFlameAnimation] = useState(false);
  const playIconOpacity = useRef(new Animated.Value(0)).current;
  const likeScale = useRef(new Animated.Value(1)).current;
  const commentsSlideAnim = useRef(new Animated.Value(0)).current;
  const commentsListRef = useRef<FlatList>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playerInstance, setPlayerInstance] = useState<any>(null);
  const playerRef = useRef<any>(null);
  
  const player = useVideoPlayer(item.videoUrl, (p) => {
    if (p) {
      p.loop = true;
      playerRef.current = p;
      setPlayerInstance(p);
    }
  });

  useEffect(() => {
    if (player) {
      playerRef.current = player;
      setPlayerInstance(player);
    }
  }, [player]);

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
      const timer = setTimeout(() => {
        try {
          const p = playerRef.current;
          if (p && typeof p.play === 'function' && !p.playing) {
            p.play();
          }
        } catch (error) {
          console.log('[ReelViewer] Error playing video:', error);
        }
      }, 100);
      
      if (Platform.OS === 'web' && videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
      
      return () => clearTimeout(timer);
    } else {
      try {
        const p = playerRef.current;
        if (p && typeof p.pause === 'function') {
          if (p.playing) {
            p.pause();
          }
          if (typeof p.currentTime !== 'undefined') {
            p.currentTime = 0;
          }
        }
      } catch (error) {
        console.log('[ReelViewer] Error pausing video:', error);
      }
      if (Platform.OS === 'web' && videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        } catch (error) {
          console.log('[ReelViewer] Error pausing web video:', error);
        }
      }
    }
  }, [isActive, isTabFocused]);

  useEffect(() => {
    try {
      const p = playerRef.current;
      if (p && typeof p.volume !== 'undefined') {
        p.volume = isMuted ? 0 : 1;
      }
    } catch (error) {
      console.log('[ReelViewer] Error setting volume:', error);
    }
  }, [isMuted]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    
    try {
      const subscription = p.addListener('playingChange', (event: any) => {
        setIsPlaying(event.isPlaying);
      });
      return () => {
        try {
          subscription?.remove();
        } catch (error) {
          console.log('[ReelViewer] Error removing listener:', error);
        }
      };
    } catch (error) {
      console.log('[ReelViewer] Error adding listener:', error);
    }
  }, []);

  useEffect(() => {
    setLocalIsLiked(item.isLiked || false);
    setLocalIsFired(item.isFired || false);
    setLocalLikeCount(item._count?.likes || 0);
    setLocalFireCount(item._count?.fires || 0);
  }, [item]);

  useEffect(() => {
    return () => {
      try {
        const p = playerRef.current;
        if (p && typeof p.pause === 'function' && p.playing) {
          p.pause();
        }
      } catch (error) {
        console.log('[ReelViewer] Error pausing in cleanup:', error);
      }
      if (Platform.OS === 'web' && videoRef.current) {
        try {
          videoRef.current.pause();
        } catch (error) {
          console.log('[ReelViewer] Error pausing web video in cleanup:', error);
        }
      }
    };
  }, []);

  const togglePlayPause = useCallback(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    } else {
      try {
        const p = playerRef.current;
        if (p && typeof p.pause === 'function' && typeof p.play === 'function') {
          if (isPlaying && p.playing) {
            p.pause();
          } else if (!isPlaying && !p.playing) {
            p.play();
          }
        }
      } catch (error) {
        console.log('[ReelViewer] Error toggling play/pause:', error);
      }
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
  }, [isPlaying, playIconOpacity]);

  const handleDoubleTap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLocalIsLiked(true);
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
    onLike();
  }, [onLike, likeScale]);

  const lastTap = useRef<number>(0);
  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      handleDoubleTap();
    } else {
      togglePlayPause();
    }
    lastTap.current = now;
  }, [handleDoubleTap, togglePlayPause]);

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
          {c.content}
        </Text>
        <Text style={styles.reelCommentTime}>{timeAgo(c.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  ), [onUserPress]);

  return (
    <View style={styles.reelContainer}>
      {onClose && (
        <TouchableOpacity 
          style={[styles.closeButton, { top: insets.top + 10 }]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <X size={24} color="#FFF" />
        </TouchableOpacity>
      )}

      <Animated.View style={[styles.videoSection, { height: videoHeight }]}>
        <TouchableOpacity 
          activeOpacity={1} 
          style={styles.videoTouchable}
          onPress={handleTap}
        >
          {Platform.OS === 'web' ? (
            <video
              ref={(el) => { videoRef.current = el; }}
              src={item.videoUrl}
              poster={item.thumbnailUrl}
              style={{
                width: '100%',
                height: '100%',
                objectFit: showComments ? 'contain' : 'cover',
                backgroundColor: '#000',
                pointerEvents: 'none',
              } as any}
              autoPlay={isActive}
              loop
              playsInline
              muted={isMuted}
            />
          ) : (
            playerInstance ? (
              <VideoView
                player={playerInstance}
                style={styles.video}
                contentFit={showComments ? "contain" : "cover"}
                nativeControls={false}
              />
            ) : (
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={styles.video}
                resizeMode={showComments ? "contain" : "cover"}
              />
            )
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

        {showComments && (
          <View style={[styles.miniReelInfo, { paddingTop: insets.top + 50 }]}>
            <TouchableOpacity 
              style={styles.miniUserRow}
              onPress={() => onUserPress(item.user.username)}
            >
              <Image source={{ uri: item.user.avatarUrl }} style={styles.miniAvatar} />
              <Text style={styles.miniUsername}>@{item.user.username}</Text>
            </TouchableOpacity>
            <Text style={styles.miniTitle} numberOfLines={1} ellipsizeMode="tail">{truncateTitle(item.title)}</Text>
          </View>
        )}
      </Animated.View>

      {/* Views overlay */}
      {!showComments && (
        <View style={[styles.viewsOverlay, { top: insets.top + 60 }]}>
          <Eye size={12} color="#FFF" />
          <Text style={styles.viewsText}>{formatNumber(item.views)}</Text>
        </View>
      )}

      {!showComments && (
        <View style={[styles.reelOverlayContent, { paddingBottom: insets.bottom + 100 }]} pointerEvents="auto">
        <View style={styles.reelBottomSection}>
          <View style={styles.reelInfoSection}>
            <TouchableOpacity 
              style={styles.reelUserRow}
              onPress={() => onUserPress(item.user.username)}
            >
              <Image source={{ uri: item.user.avatarUrl }} style={styles.reelAvatar} />
              <Text style={styles.reelUsername}>@{item.user.username}</Text>
              <TouchableOpacity style={styles.followButton}>
                <Text style={styles.followButtonText}>Follow</Text>
              </TouchableOpacity>
            </TouchableOpacity>

            <Text style={styles.reelTitle} numberOfLines={2} ellipsizeMode="tail">{truncateTitle(item.title, 34)}</Text>
            
            {item.description && (
              <ExpandableText text={item.description} maxLength={100} />
            )}

            {item.game && (
              <TouchableOpacity 
                style={styles.reelGameRow}
                onPress={() => router.push({ pathname: '/game/[id]', params: { id: item.game.id.toString() } })}
                activeOpacity={0.7}
              >
                <Gamepad2 size={14} color="#4ADE80" />
                <Text style={styles.reelGameText}>{item.game.name}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.reelMusicRow}>
              <Music2 size={14} color="#FFF" />
              <Text style={styles.reelMusicText} numberOfLines={1}>Original audio • {item.user.username}</Text>
            </View>
          </View>

          <View style={styles.reelActionsColumn}>
            <TouchableOpacity 
              style={styles.reelActionButton} 
              onPress={() => {
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
                onLike();
              }}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Heart 
                  size={28} 
                  color={localIsLiked ? "#4ADE80" : "#FFF"} 
                  fill={localIsLiked ? "#4ADE80" : "transparent"}
                />
              </Animated.View>
              <Text style={styles.reelActionCount}>{formatNumber(localLikeCount)}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.reelActionButton} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowFlameAnimation(true);
                setTimeout(() => setShowFlameAnimation(false), 1500);
                onFire();
              }}
            >
              {showFlameAnimation ? (
                <FlameAnimation isActive={true} size={28} />
              ) : (
                <Flame 
                  size={28} 
                  color={localIsFired ? "#FF6B2C" : "#FFF"} 
                  fill={localIsFired ? "#FF6B2C" : "transparent"}
                />
              )}
              <Text style={styles.reelActionCount}>{formatNumber(localFireCount)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.reelActionButton} onPress={onToggleComments}>
              <MessageSquare size={28} color="#FFF" />
              <Text style={styles.reelActionCount}>{formatNumber(item._count?.comments || 0)}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.reelActionButton} onPress={onShare}>
              <Share2 size={28} color="#FFF" />
              <Text style={styles.reelActionCount}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.reelActionButton} onPress={onToggleMute}>
              {isMuted ? (
                <VolumeX size={24} color="#FFF" />
              ) : (
                <Volume2 size={24} color="#FFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
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
              value={commentText}
              onChangeText={onCommentTextChange}
              multiline
            />
            <TouchableOpacity
              style={[styles.reelPostButton, !commentText && styles.reelPostButtonDisabled]}
              disabled={!commentText}
              onPress={onSubmitComment}
            >
              <Text style={[styles.reelPostButtonText, commentText && styles.reelPostButtonTextActive]}>
                Post
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
});

ReelViewer.displayName = 'ReelViewer';

export default ReelViewer;

export type { ReelData, Comment, ReelViewerProps };

const styles = StyleSheet.create({
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  videoSection: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
    overflow: 'hidden',
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
  reelBottomSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  reelInfoSection: {
    flex: 1,
    marginBottom: 8,
  },
  reelUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  reelAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFF',
    marginRight: 10,
  },
  reelUsername: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followButton: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
  followButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  reelTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600' as const,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reelDescription: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  seeMoreButton: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600' as const,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  reelGameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  reelGameText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  reelMusicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reelMusicText: {
    color: '#FFF',
    fontSize: 12,
    flex: 1,
  },
  reelActionsColumn: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 8,
  },
  reelActionButton: {
    alignItems: 'center',
  },
  reelActionCount: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
  commentsSection: {
    backgroundColor: '#0F1520',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
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
  commentsListWrapper: {
    flex: 1,
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
  commentInputWrapper: {
    backgroundColor: '#0F1520',
  },
  reelCommentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F1520',
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
  viewsOverlay: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    zIndex: 50,
  },
  viewsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
  },
});
