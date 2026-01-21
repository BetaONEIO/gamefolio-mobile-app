import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Dimensions, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Animated, FlatList } from 'react-native';
import { X, Heart, Flame, MessageSquare, Share2, Flag, Trash2, Send, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import * as Haptics from 'expo-haptics';
import FlameAnimation from '@/components/FlameAnimation';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

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

interface Screenshot {
  id: number;
  title: string;
  description?: string;
  thumbnailUrl: string;
  createdAt?: string;
  userId?: number;
  user?: {
    id: number;
    username: string;
    displayName?: string;
    avatarUrl: string;
  };
  game?: { id: number; name: string };
  _count?: { likes?: number; comments?: number; fires?: number };
  isLiked?: boolean;
  isFired?: boolean;
}

interface ScreenshotViewerModalProps {
  visible: boolean;
  onClose: () => void;
  screenshot: Screenshot | null;
  screenshots?: Screenshot[];
  initialIndex?: number;
  handle: string;
  onDelete?: () => void;
  isOwner?: boolean;
}

export default function ScreenshotViewerModal({
  visible,
  onClose,
  screenshot,
  screenshots = [],
  initialIndex = 0,
  handle,
  onDelete,
  isOwner = false,
}: ScreenshotViewerModalProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [localIsLiked, setLocalIsLiked] = useState(false);
  const [localIsFired, setLocalIsFired] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(0);
  const [localFireCount, setLocalFireCount] = useState(0);
  const [showFlameAnimation, setShowFlameAnimation] = useState(false);
  const [isCommentsModalVisible, setIsCommentsModalVisible] = useState(false);
  const [comment, setComment] = useState('');
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const likeScale = useRef(new Animated.Value(1)).current;

  const allScreenshots = useMemo(() => {
    if (screenshots.length > 0) return screenshots;
    if (screenshot) return [screenshot];
    return [];
  }, [screenshots, screenshot]);

  const currentScreenshot = allScreenshots[currentIndex] || screenshot;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [visible, initialIndex]);

  useEffect(() => {
    if (currentScreenshot) {
      setLocalIsLiked(currentScreenshot.isLiked || false);
      setLocalIsFired(currentScreenshot.isFired || false);
      setLocalLikeCount(currentScreenshot._count?.likes || 0);
      setLocalFireCount(currentScreenshot._count?.fires || 0);
    }
  }, [currentScreenshot]);

  const { data: comments = [], refetch: refetchComments } = useQuery<any[]>({
    queryKey: ['screenshot', currentScreenshot?.id, 'comments'],
    queryFn: async () => {
      const token = await getAccessToken();
      const commentsData = await api.screenshots.getComments(currentScreenshot?.id?.toString() || '', token || undefined);
      return commentsData;
    },
    enabled: !!currentScreenshot?.id && visible,
  });

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.screenshots.addComment(currentScreenshot?.id?.toString() || '', { content }, token);
    },
    onSuccess: () => {
      setComment('');
      Keyboard.dismiss();
      refetchComments();
      queryClient.invalidateQueries({ queryKey: ['screenshot', currentScreenshot?.id] });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.screenshots.like(currentScreenshot?.id?.toString() || '', token);
    },
    onSuccess: (data) => {
      if (typeof data.likeCount === 'number') {
        setLocalLikeCount(data.likeCount);
      }
      if (typeof data.liked === 'boolean') {
        setLocalIsLiked(data.liked);
      }
      queryClient.invalidateQueries({ queryKey: ['screenshot', currentScreenshot?.id] });
    },
    onError: () => {
      setLocalIsLiked(prev => !prev);
      setLocalLikeCount(prev => localIsLiked ? prev + 1 : Math.max(0, prev - 1));
    },
  });

  const { user: currentUser } = useAuth();

  const fireMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      if (!currentUser?.id) throw new Error('User not found');
      return api.screenshots.toggleFire(currentScreenshot?.id?.toString() || '', token, currentUser.id, localIsFired);
    },
    onSuccess: (data) => {
      if (typeof data.fired === 'boolean') {
        setLocalIsFired(data.fired);
      }
      if (typeof data.fireCount === 'number') {
        setLocalFireCount(data.fireCount);
      }
      queryClient.invalidateQueries({ queryKey: ['screenshot', currentScreenshot?.id] });
    },
    onError: () => {
      setLocalIsFired(prev => !prev);
      setLocalFireCount(prev => localIsFired ? prev + 1 : Math.max(0, prev - 1));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.screenshots.delete(currentScreenshot?.id?.toString() || '', token);
    },
    onSuccess: () => {
      setIsDeleteModalVisible(false);
      setIsDeleting(false);
      queryClient.invalidateQueries({ queryKey: ['screenshots'] });
      queryClient.invalidateQueries({ queryKey: ['userScreenshots'] });
      onDelete?.();
      onClose();
    },
    onError: () => {
      setIsDeleting(false);
    },
  });

  const { mutate: mutateLike, isPending: isLikePending } = likeMutation;
  const handleLike = useCallback(() => {
    if (isLikePending) {
      console.log('[ScreenshotViewer] Like mutation already in progress, ignoring click');
      return;
    }
    const newLikedState = !localIsLiked;
    setLocalIsLiked(newLikedState);
    setLocalLikeCount(prev => newLikedState ? prev + 1 : Math.max(0, prev - 1));
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
    mutateLike();
  }, [localIsLiked, likeScale, mutateLike, isLikePending]);

  const { mutate: mutateFire, isPending: isFirePending } = fireMutation;
  const handleFire = useCallback(() => {
    if (isFirePending) {
      console.log('[ScreenshotViewer] Fire mutation already in progress, ignoring click');
      return;
    }
    const newFiredState = !localIsFired;
    setLocalIsFired(newFiredState);
    setLocalFireCount(prev => newFiredState ? prev + 1 : Math.max(0, prev - 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (newFiredState) {
      setShowFlameAnimation(true);
      setTimeout(() => setShowFlameAnimation(false), 1500);
    }
    mutateFire();
  }, [localIsFired, mutateFire, isFirePending]);

  const handlePostComment = () => {
    if (comment.trim().length === 0) return;
    addCommentMutation.mutate(comment.trim());
  };

  const { mutate: mutateDelete } = deleteMutation;
  const handleDelete = useCallback(() => {
    setIsDeleting(true);
    mutateDelete();
  }, [mutateDelete]);

  const handleUserPress = useCallback(() => {
    onClose();
    if (currentScreenshot?.user?.id) {
      router.push({ pathname: '/user/[id]', params: { id: currentScreenshot.user.id.toString() } });
    }
  }, [router, currentScreenshot, onClose]);

  const handleGamePress = useCallback(() => {
    if (currentScreenshot?.game?.id) {
      onClose();
      router.push({ pathname: '/game/[id]', params: { id: currentScreenshot.game.id.toString() } });
    }
  }, [router, currentScreenshot, onClose]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (currentIndex < allScreenshots.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [currentIndex, allScreenshots.length]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
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

  const renderScreenshotItem = useCallback(({ item }: { item: Screenshot }) => (
    <View style={styles.screenshotItemContainer}>
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  ), []);

  if (!currentScreenshot) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#0F1520', '#020617']}
          style={StyleSheet.absoluteFill}
        />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <X size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Screenshot</Text>
          <View style={styles.headerRight}>
            {isOwner && (
              <TouchableOpacity 
                style={styles.deleteHeaderButton} 
                onPress={() => setIsDeleteModalVisible(true)}
              >
                <Trash2 size={20} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Navigation Controls */}
        {allScreenshots.length > 1 && (
          <View style={styles.topNavigation}>
            <TouchableOpacity 
              style={[styles.navArrow, currentIndex === 0 && styles.navArrowDisabled]}
              onPress={handlePrevious}
              disabled={currentIndex === 0}
            >
              <ChevronLeft size={24} color={currentIndex === 0 ? '#64748B' : '#FFF'} />
            </TouchableOpacity>
            
            <View style={styles.topNavDots}>
              {allScreenshots.slice(Math.max(0, currentIndex - 2), Math.min(allScreenshots.length, currentIndex + 3)).map((_, i) => {
                const actualIndex = Math.max(0, currentIndex - 2) + i;
                return (
                  <TouchableOpacity
                    key={actualIndex}
                    onPress={() => {
                      setCurrentIndex(actualIndex);
                      flatListRef.current?.scrollToIndex({ index: actualIndex, animated: true });
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <View 
                      style={[
                        styles.topNavDot,
                        actualIndex === currentIndex && styles.topNavDotActive
                      ]} 
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            
            <TouchableOpacity 
              style={[styles.navArrow, currentIndex === allScreenshots.length - 1 && styles.navArrowDisabled]}
              onPress={handleNext}
              disabled={currentIndex === allScreenshots.length - 1}
            >
              <ChevronRight size={24} color={currentIndex === allScreenshots.length - 1 ? '#64748B' : '#FFF'} />
            </TouchableOpacity>
          </View>
        )}

        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Image Container with horizontal scroll */}
          {allScreenshots.length > 1 ? (
            <FlatList
              ref={flatListRef}
              data={allScreenshots}
              renderItem={renderScreenshotItem}
              keyExtractor={(item) => `screenshot-${item.id}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={SCREEN_WIDTH}
              decelerationRate="fast"
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              getItemLayout={getItemLayout}
              initialScrollIndex={currentIndex}
              onScrollToIndexFailed={() => {}}
              style={styles.imageContainer}
            />
          ) : (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: currentScreenshot.thumbnailUrl }}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          )}

          {/* Content */}
          <View style={styles.contentContainer}>
            <View style={styles.userRowContainer}>
              <TouchableOpacity style={styles.userRow} onPress={handleUserPress}>
                <Image 
                  source={{ uri: currentScreenshot.user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' }} 
                  style={styles.avatar} 
                />
                <Text style={styles.username}>@{(currentScreenshot.user?.username || handle || '').replace(/^@+/, '')}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>{currentScreenshot.title}</Text>
            {currentScreenshot.description && (
              <ExpandableText text={currentScreenshot.description} maxLength={150} />
            )}

            {currentScreenshot.game && (
              <TouchableOpacity style={styles.gameTag} onPress={handleGamePress} activeOpacity={0.7}>
                <Text style={styles.gameTagText}>{currentScreenshot.game.name}</Text>
              </TouchableOpacity>
            )}

            {currentScreenshot.createdAt && (
              <View style={styles.metadataRow}>
                <Text style={styles.metadataText}>{timeAgo(currentScreenshot.createdAt)}</Text>
              </View>
            )}

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
                <Text style={styles.actionCount}>{formatNumber(currentScreenshot._count?.comments || 0)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton}>
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
                  {comments.slice(0, 5).map((commentItem: any) => (
                    <View key={commentItem.id} style={styles.inlineCommentItem}>
                      <TouchableOpacity onPress={() => {
                        onClose();
                        router.push({ pathname: '/user/[id]', params: { id: commentItem.user.username } });
                      }}>
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

        {/* Comments Modal */}
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
                        onClose();
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

        {/* Delete Confirmation Modal */}
        <Modal
          visible={isDeleteModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => !isDeleting && setIsDeleteModalVisible(false)}
        >
          <View style={styles.deleteModalOverlay}>
            <View style={styles.deleteModalContent}>
              <Text style={styles.deleteModalTitle}>Delete Screenshot</Text>
              <Text style={styles.deleteModalMessage}>Are you sure you want to delete this screenshot? This action cannot be undone.</Text>
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
                  onPress={handleDelete}
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  deleteHeaderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  navArrowDisabled: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
  },
  topNavDots: {
    flexDirection: 'row',
    alignItems: 'center',
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
  scrollContainer: {
    flex: 1,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  screenshotItemContainer: {
    width: SCREEN_WIDTH,
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  contentContainer: {
    padding: 16,
  },
  userRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  seeMoreButton: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
  },
  gameTag: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  gameTagText: {
    color: '#0F1520',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  metadataText: {
    color: '#64748B',
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportText: {
    color: '#64748B',
    fontSize: 14,
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
    fontWeight: 'bold',
    marginBottom: 12,
  },
  inlineCommentItem: {
    flexDirection: 'row',
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
    fontWeight: 'bold',
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
    flexDirection: 'row',
    alignItems: 'center',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  commentsTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeText: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '600',
  },
  commentsScrollView: {
    flex: 1,
  },
  noCommentsText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  commentItem: {
    flexDirection: 'row',
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
    fontWeight: 'bold',
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
    flexDirection: 'row',
    alignItems: 'center',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#4ADE80',
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteModalMessage: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalConfirmButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
