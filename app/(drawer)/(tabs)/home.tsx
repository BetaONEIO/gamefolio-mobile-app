import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Eye, Video, VideoOff, Film, X, Upload, Camera } from 'lucide-react-native';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, Modal, FlatList, Dimensions, StatusBar, ViewToken, Keyboard, Animated } from 'react-native';
import ScrollView from '@/components/ThemedScrollView';
import { useRouter, useFocusEffect } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Clip, TaggedUser } from '@/lib/api';
import { shortenGameName, truncateTitle } from '@/constants/formatters';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/context/AuthContext';
import { useUser } from '@/context/UserContext';
import ReelViewer from '@/components/ReelViewer';
import LevelDetailsModal from '@/components/LevelDetailsModal';
import HeroBanner from '@/components/HeroBanner';
import AdBanner from '@/components/AdBanner';
import type { ReelData, Comment } from '@/components/ReelViewer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LatestUpload {
  id: number;
  title: string;
  contentType: 'clip' | 'reel' | 'screenshot';
  createdAt: string;
  user: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}








const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatViews = (views: number) => {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
};

const PLACEHOLDER_THUMBNAILS = {
  clip: [
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&h=450&fit=crop',
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&h=450&fit=crop',
    'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800&h=450&fit=crop',
  ],
  reel: [
    'https://images.unsplash.com/photo-1591405351990-4726e331f141?w=450&h=800&fit=crop',
    'https://images.unsplash.com/photo-1563207153-f403bf289096?w=450&h=800&fit=crop',
    'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=450&h=800&fit=crop',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=450&h=800&fit=crop',
  ],
};

const isValidThumbnailUrl = (url: string | undefined | null): boolean => {
  if (!url || url.trim() === '') return false;
  if (url === 'null' || url === 'undefined') return false;
  const invalidPatterns = [
    'placeholder',
    'default-thumbnail',
    'no-image',
  ];
  return !invalidPatterns.some(pattern => url.toLowerCase().includes(pattern.toLowerCase()));
};

const getClipThumbnail = (clip: Clip, isReel: boolean = false) => {
  const contentType = isReel ? 'Reel' : 'Clip';
  
  // Priority 1: Use the clip's own thumbnail if valid
  if (isValidThumbnailUrl(clip.thumbnailUrl)) {
    console.log(`[Thumbnail] ${contentType} ${clip.id} using own thumbnail: ${clip.thumbnailUrl}`);
    return clip.thumbnailUrl;
  }
  
  // Priority 2: Use the game's image as fallback
  if (isValidThumbnailUrl(clip.game?.imageUrl)) {
    console.log(`[Thumbnail] ${contentType} ${clip.id} using game image: ${clip.game?.imageUrl}`);
    return clip.game!.imageUrl;
  }
  
  // Priority 3: Use a placeholder based on clip id for variety
  const placeholders = isReel ? PLACEHOLDER_THUMBNAILS.reel : PLACEHOLDER_THUMBNAILS.clip;
  const placeholderIndex = clip.id % placeholders.length;
  const placeholder = placeholders[placeholderIndex];
  console.log(`[Thumbnail] ${contentType} ${clip.id} "${clip.title?.slice(0, 20)}" using placeholder: ${placeholder}`);
  return placeholder;
};

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<'clips' | 'reels'>('clips');
  const [showReelsModal, setShowReelsModal] = useState(false);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showReelComments, setShowReelComments] = useState(false);
  const [reelCommentText, setReelCommentText] = useState('');
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [isLevelModalVisible, setIsLevelModalVisible] = useState(false);
  
  const router = useRouter();
  const { getAccessToken, user } = useAuth();
  const { favoriteGames } = useUser();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const reelsFlatListRef = useRef<FlatList>(null);

  useFocusEffect(
    useCallback(() => {
      setIsTabFocused(true);
      return () => {
        setIsTabFocused(false);
      };
    }, [])
  );

  const { data: recommendedClips = [], isLoading: isLoadingRecommended } = useQuery<Clip[]>({
    queryKey: ['clips', 'recommended', favoriteGames.map(g => g.id).join(','), favoriteGames.length],
    queryFn: async () => {
      const token = await getAccessToken();
      console.log('[Home] Fetching recommended clips based on favorite games:', favoriteGames.length);
      try {
        if (favoriteGames.length === 0) {
          console.log('[Home] No favorite games, fetching trending clips');
          const clips = await api.clips.getTrending(token || undefined, 'ever');
          console.log('[Home] Received trending clips:', clips.length);
          if (clips.length === 0) {
            console.log('[Home] No clips from API');
            return [];
          }
          return clips;
        }
        
        // Fetch clips from all favorite games
        const allClips = await Promise.all(
          favoriteGames.map(async (game) => {
            try {
              const clips = await api.clips.getFeed(token || undefined, { 
                page: 1, 
                limit: 5,
                gameId: parseInt(game.id)
              });
              return clips;
            } catch (error) {
              console.log('[Home] Error fetching clips for game:', game.name, error);
              return [];
            }
          })
        );
        
        // Flatten and shuffle the clips
        const flatClips = allClips.flat();
        const shuffled = flatClips.sort(() => Math.random() - 0.5);
        console.log('[Home] Received recommended clips:', shuffled.length);
        
        if (shuffled.length === 0) {
          console.log('[Home] No clips from favorite games');
          return [];
        }
        
        return shuffled.slice(0, 20);
      } catch (error) {
        console.log('[Home] Error fetching clips:', error);
        return [];
      }
    },
  });

  const { data: latestClips = [], isLoading: isLoadingLatest } = useQuery<Clip[]>({
    queryKey: ['clips', 'feed'],
    queryFn: async () => {
      const token = await getAccessToken();
      console.log('[Home] Fetching feed clips...');
      try {
        const clips = await api.clips.getFeed(token || undefined, { page: 1, limit: 20 });
        console.log('[Home] Received feed clips:', clips.length);
        
        // Log each clip's thumbnail info for debugging
        clips.forEach((clip, index) => {
          console.log(`[Home] Clip ${index + 1}: id=${clip.id}, title="${clip.title}"`);
          console.log(`  - thumbnailUrl: ${clip.thumbnailUrl || 'NULL'}`);
          console.log(`  - game imageUrl: ${clip.game?.imageUrl || 'NULL'}`);
        });
        
        // Check for thumbnail issues
        const uniqueThumbnails = new Set(clips.map(c => c.thumbnailUrl).filter(Boolean));
        console.log(`[Home] Unique clip thumbnails: ${uniqueThumbnails.size} out of ${clips.length} clips`);
        
        if (clips.length === 0) {
          console.log('[Home] No feed clips from API');
          return [];
        }
        return clips;
      } catch (error) {
        console.log('[Home] Error fetching feed clips:', error);
        return [];
      }
    },
  });

  const { data: latestReels = [], isLoading: isLoadingReels } = useQuery<Clip[]>({
    queryKey: ['reels', 'latest'],
    queryFn: async () => {
      const token = await getAccessToken();
      console.log('[Home] Fetching latest reels...');
      const reels = await api.reels.getLatest(token || undefined);
      console.log('[Home] Received latest reels:', reels.length);
      
      // Log each reel's thumbnail info for debugging
      reels.forEach((reel, index) => {
        console.log(`[Home] Reel ${index + 1}: id=${reel.id}, title="${reel.title}"`);
        console.log(`  - thumbnailUrl: ${reel.thumbnailUrl || 'NULL'}`);
        console.log(`  - videoUrl: ${reel.videoUrl || 'NULL'}`);
        console.log(`  - game imageUrl: ${reel.game?.imageUrl || 'NULL'}`);
      });
      
      // Check for thumbnail issues
      const uniqueThumbnails = new Set(reels.map(r => r.thumbnailUrl).filter(Boolean));
      console.log(`[Home] Unique thumbnails: ${uniqueThumbnails.size} out of ${reels.length} reels`);
      
      if (uniqueThumbnails.size < reels.length && uniqueThumbnails.size > 0) {
        console.warn('[Home] ⚠️ Some reels share the same thumbnail - thumbnails may need to be generated per video');
      }
      
      return reels;
    },
  });



  const { data: latestUploads = [] } = useQuery<LatestUpload[]>({
    queryKey: ['recent-uploads'],
    queryFn: async () => {
      console.log('[Home] Fetching recent uploads from API...');
      try {
        const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/recent-uploads`);
        if (!response.ok) {
          console.log('[Home] Recent uploads API error:', response.status);
          return [];
        }
        const data = await response.json();
        console.log('[Home] Received recent uploads:', data.length);
        return data;
      } catch (error) {
        console.log('[Home] Error fetching recent uploads:', error);
        return [];
      }
    },
    staleTime: 30000,
  });

  
  const tickerRef = useRef<Animated.Value>(new Animated.Value(0)).current;

  useEffect(() => {
    if (latestUploads.length === 0) return;
    
    const tickerWidth = latestUploads.length * 350;
    let isMounted = true;
    
    const animateTicker = () => {
      if (!isMounted) return;
      tickerRef.setValue(0);
      Animated.timing(tickerRef, {
        toValue: -tickerWidth,
        duration: latestUploads.length * 8000,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && isMounted) {
          animateTicker();
        }
      });
    };
    animateTicker();
    
    return () => {
      isMounted = false;
    };
  }, [latestUploads.length, tickerRef]);

  const activeReelId = latestReels[activeReelIndex]?.id;
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

  const likeReelMutation = useMutation({
    mutationFn: async (clipId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.like(clipId.toString(), token);
    },
    onSuccess: (data, clipId) => {
      queryClient.setQueryData<Clip[]>(['reels', 'latest'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(clip => 
          clip.id === clipId 
            ? { ...clip, isLiked: data.liked, _count: { ...clip._count, likes: data.likeCount } }
            : clip
        );
      });
    },
  });
  const { mutate: likeReel } = likeReelMutation;

  const fireReelMutation = useMutation({
    mutationFn: async (clipId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.clips.fire(clipId.toString(), token);
    },
    onSuccess: (data, clipId) => {
      queryClient.setQueryData<Clip[]>(['reels', 'latest'], (oldData) => {
        if (!oldData) return oldData;
        return oldData.map(clip => 
          clip.id === clipId 
            ? { ...clip, isFired: data.fired, _count: { ...clip._count, fires: data.fireCount } }
            : clip
        );
      });
    },
  });
  const { mutate: fireReel } = fireReelMutation;

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

  const renderReelItem = useCallback(({ item, index }: { item: Clip; index: number}) => (
    <ReelViewer
      item={item as ReelData}
      isActive={index === activeReelIndex && showReelsModal}
      isMuted={isMuted}
      onToggleMute={toggleMute}
      onUserPress={handleUserPress}
      onLike={() => {
        likeReel(item.id);
      }}
      onFire={() => {
        fireReel(item.id);
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
  ), [activeReelIndex, showReelsModal, isMuted, toggleMute, handleUserPress, showReelComments, toggleReelComments, localReelComments, reelCommentText, handleReelCommentSubmit, isLoadingReelComments, isTabFocused, likeReel, fireReel]);

  const activeClips = activeTab === 'clips' ? recommendedClips : latestReels;

  const renderEmptyState = (message: string) => (
    <View style={styles.emptyState}>
      <VideoOff size={32} color="#475569" />
      <Text style={styles.emptyStateText}>{message}</Text>
    </View>
  );

  const renderLoadingState = () => (
    <View style={styles.loadingState}>
      <View style={styles.loadingCard} />
      <View style={styles.loadingCard} />
    </View>
  );

  return (
    <View style={styles.container}>
       <LinearGradient
        colors={['#0F1520', '#020617']}
        style={StyleSheet.absoluteFill}
      />
      
      <AppHeader onOpenLevelTracker={() => setIsLevelModalVisible(true)} />

      {/* Latest Uploads Ticker */}
      <View style={styles.tickerContainer}>
        <LinearGradient
          colors={['#065F46', '#047857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.tickerGradient}
        >
          <Animated.View
            style={[
              styles.tickerContent,
              {
                transform: [{ translateX: tickerRef }],
              },
            ]}
          >
            {[...latestUploads, ...latestUploads].map((upload, index) => {
              const contentTypeLabel = upload.contentType === 'screenshot' ? 'screenshot' : upload.contentType === 'reel' ? 'reel' : 'clip';
              const ContentIcon = upload.contentType === 'screenshot' ? Camera : upload.contentType === 'reel' ? Film : Upload;
              
              const handlePress = () => {
                if (upload.contentType === 'screenshot') {
                  router.push({ pathname: '/(drawer)/(tabs)/trending', params: { type: 'screenshots' } });
                } else {
                  router.push({ pathname: '/clip/[id]', params: { id: upload.id.toString() } });
                }
              };
              
              return (
                <TouchableOpacity
                  key={`${upload.id}-${index}`}
                  style={styles.tickerItem}
                  onPress={handlePress}
                >
                  <ContentIcon size={14} color="#FFF" />
                  <Text style={styles.tickerUsername}>{upload.user?.username || 'Unknown'}</Text>
                  <Text style={styles.tickerText}>has just uploaded a {contentTypeLabel}</Text>
                  <Text style={styles.tickerTitle}>&quot;{upload.title}&quot;</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </LinearGradient>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Banner */}
        <HeroBanner />

        {/* Featured Clips with Toggle */}
        <View style={styles.sectionHeader}>
          <Video size={20} color="#4ADE80" />
          <Text style={styles.sectionTitle}>Recommended for You</Text>
        </View>

        {/* Tabs Toggle */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'clips' && styles.activeTabButton]}
            onPress={() => setActiveTab('clips')}
          >
            <Video size={16} color={activeTab === 'clips' ? '#002E15' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === 'clips' && styles.activeTabText]}>Clips</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'reels' && styles.activeTabButton]}
            onPress={() => setActiveTab('reels')}
          >
            <Video size={16} color={activeTab === 'reels' ? '#002E15' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === 'reels' && styles.activeTabText]}>Reels</Text>
          </TouchableOpacity>
        </View>

        {/* Horizontal Carousel */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.clipsList}
        >
          {(activeTab === 'clips' ? isLoadingRecommended : isLoadingReels) ? (
            renderLoadingState()
          ) : activeClips.length === 0 ? (
            renderEmptyState(`No ${activeTab} available`)
          ) : (
            activeClips.map((clip, index) => (
              <TouchableOpacity 
                key={clip.id} 
                style={activeTab === 'clips' ? styles.featuredClipCard : styles.featuredReelCard}
                onPress={() => {
                  if (activeTab === 'reels') {
                    openReelsViewer(index);
                  } else {
                    router.push({ pathname: '/clip/[id]', params: { id: clip.id.toString() } });
                  }
                }}
              >
                <ImageBackground
                  source={{ uri: getClipThumbnail(clip, activeTab === 'reels') }}
                  style={activeTab === 'clips' ? styles.featuredClipThumbnail : styles.featuredReelThumbnail}
                  imageStyle={{ borderRadius: 16 }}
                >
                  <View style={styles.latestClipOverlay}>
                    <View style={styles.latestClipTopStats}>
                      <View style={styles.statsBadge}>
                        <Text style={styles.statsText}>{formatDuration(clip.duration)}</Text>
                        <View style={styles.statsDivider} />
                        <Eye size={12} color="#FFF" />
                        <Text style={styles.statsText}>{formatViews(clip.views)}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.latestClipInfo}>
                      <Text style={activeTab === 'clips' ? styles.latestClipTitle : styles.reelTitle} numberOfLines={1} ellipsizeMode="tail">{truncateTitle(clip.title)}</Text>
                      <TouchableOpacity onPress={(e) => {
                        e.stopPropagation();
                        router.push({ pathname: '/user/[id]', params: { id: clip.user.id.toString() } });
                      }}>
                        <Text style={styles.latestClipUser}>@{clip.user.username}</Text>
                      </TouchableOpacity>
                      {clip.taggedUsers && clip.taggedUsers.length > 0 && (
                        <Text style={styles.taggedUsersText} numberOfLines={1}>
                          with {clip.taggedUsers.map((u: TaggedUser) => `@${u.username}`).join(', ')}
                        </Text>
                      )}
                      {clip.game && (
                        <TouchableOpacity
                          style={styles.gameTag}
                          onPress={(e) => {
                            e.stopPropagation();
                            router.push({ pathname: '/game/[id]', params: { id: clip.game.id.toString() } });
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.gameTagText}>{shortenGameName(clip.game.name)}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </ImageBackground>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Latest Clips Section */}
        <View style={styles.sectionHeaderWithAction}>
          <Text style={styles.sectionTitle}>Latest Clips</Text>
          <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push('/(drawer)/(tabs)/clips/latest')}>
            <Text style={styles.viewAllText}>View all</Text>
            <ChevronRight size={16} color="#4ADE80" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.clipsList}
        >
          {isLoadingLatest ? renderLoadingState() : latestClips.length === 0 ? renderEmptyState('No clips uploaded yet') : latestClips.map((clip) => (
            <TouchableOpacity 
              key={clip.id} 
              style={styles.latestClipCard}
              onPress={() => router.push({ pathname: '/clip/[id]', params: { id: clip.id.toString() } })}
            >
              <ImageBackground
                source={{ uri: getClipThumbnail(clip, false) }}
                style={styles.latestClipThumbnail}
                imageStyle={{ borderRadius: 16 }}
              >
                <View style={styles.latestClipOverlay}>
                  <View style={styles.latestClipTopStats}>
                     <View style={styles.statsBadge}>
                        <Text style={styles.statsText}>{formatDuration(clip.duration)}</Text>
                        <View style={styles.statsDivider} />
                        <Eye size={12} color="#FFF" />
                        <Text style={styles.statsText}>{clip.views}</Text>
                     </View>
                  </View>
                  
                  <View style={styles.latestClipInfo}>
                    <Text style={styles.latestClipTitle} numberOfLines={1} ellipsizeMode="tail">{truncateTitle(clip.title)}</Text>
                    <TouchableOpacity onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: '/user/[id]', params: { id: clip.user.id.toString() } });
                    }}>
                      <Text style={styles.latestClipUser}>@{clip.user.username}</Text>
                    </TouchableOpacity>
                    {clip.game && (
                      <TouchableOpacity
                        style={styles.gameTag}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push({ pathname: '/game/[id]', params: { id: clip.game.id.toString() } });
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.gameTagText}>{shortenGameName(clip.game.name)}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </ScrollView>


        {/* Ad Banner */}
        <AdBanner 
          size="medium" 
          placement="between-content"
          onAdClicked={(adId) => console.log('[Home] Ad clicked:', adId)}
        />

        {/* Latest Reels Section */}
        <View style={styles.sectionHeaderWithAction}>
          <View style={styles.sectionHeaderLeft}>
            <Film size={20} color="#4ADE80" />
            <Text style={styles.sectionTitle}>Latest Reels</Text>
          </View>
          <TouchableOpacity style={styles.viewAllButton} onPress={() => router.push('/(drawer)/(tabs)/reels/latest')}>
            <Text style={styles.viewAllText}>View all</Text>
            <ChevronRight size={16} color="#4ADE80" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.clipsList}
        >
          {isLoadingReels ? renderLoadingState() : latestReels.length === 0 ? renderEmptyState('No reels uploaded yet') : latestReels.slice(0, 10).map((reel, index) => (
            <TouchableOpacity 
              key={reel.id} 
              style={styles.reelPreviewCard}
              onPress={() => openReelsViewer(index)}
            >
              <ImageBackground
                source={{ uri: getClipThumbnail(reel, true) }}
                style={styles.reelPreviewThumbnail}
                imageStyle={{ borderRadius: 16 }}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.8)']}
                  style={styles.reelPreviewGradient}
                >
                  <View style={styles.reelPreviewOverlay}>
                    <View style={styles.reelPreviewInfo}>
                      <Text style={styles.reelPreviewTitle} numberOfLines={1} ellipsizeMode="tail">{truncateTitle(reel.title)}</Text>
                      <TouchableOpacity onPress={(e) => {
                        e.stopPropagation();
                        router.push({ pathname: '/user/[id]', params: { id: reel.user.id.toString() } });
                      }}>
                        <Text style={styles.reelPreviewUser}>@{reel.user.username}</Text>
                      </TouchableOpacity>
                      {reel.taggedUsers && reel.taggedUsers.length > 0 && (
                        <Text style={styles.reelTaggedUsersText} numberOfLines={1}>
                          with {reel.taggedUsers.map((u: TaggedUser) => `@${u.username}`).join(', ')}
                        </Text>
                      )}
                      {reel.game && (
                        <View style={styles.reelGameBadge}>
                          <Text style={styles.reelGameBadgeText} numberOfLines={1}>{shortenGameName(reel.game.name)}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          ))}
        </ScrollView>


        {/* Extra space for scrolling */}
        <View style={{ height: 20 }} />

      </ScrollView>

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
            data={latestReels}
            renderItem={renderReelItem}
            keyExtractor={(item) => `reel-${item.id}`}
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

      <LevelDetailsModal
        visible={isLevelModalVisible}
        onClose={() => setIsLevelModalVisible(false)}
        level={user?.level || 1}
        currentXP={user?.totalXP || 0}
        userId={user?.id?.toString()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
  },
  content: {
    paddingHorizontal: 16,
  },
  heroContainer: {
    height: 400, // Large hero image
    marginBottom: 30,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  heroBackground: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  heroContent: {
    alignItems: 'center',
    marginTop: 40,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '90%',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  activeTabButton: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  tabText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 16,
  },
  activeTabText: {
    color: '#002E15',
  },
  clipsList: {
    gap: 16,
    paddingRight: 16,
    paddingLeft: 16,
    marginLeft: -16,
    marginBottom: 20,
  },
  featuredClipCard: {
    width: 280,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  featuredClipThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  featuredReelCard: {
    width: 155,
    height: 275,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  featuredReelThumbnail: {
    width: '100%',
    height: '100%',
  },
  sectionHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 24,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
  },
  latestClipCard: {
    width: 280,
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  latestClipThumbnail: {
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  latestClipOverlay: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  latestClipTopStats: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statsText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  latestClipInfo: {
    gap: 4,
  },
  latestClipTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  latestClipUser: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  gameTag: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  gameTagText: {
    color: '#002E15',
    fontSize: 10,
    fontWeight: 'bold',
  },

  reelTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  clipEngagement: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 6,
  },
  engagementItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  engagementText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyState: {
    width: 280,
    height: 180,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyStateText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  loadingState: {
    flexDirection: 'row' as const,
    gap: 16,
  },
  loadingCard: {
    width: 280,
    height: 180,
    borderRadius: 16,
    backgroundColor: '#1E293B',
  },
  reelPreviewCard: {
    width: 155,
    height: 275,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  reelPreviewThumbnail: {
    width: '100%',
    height: '100%',
  },
  reelPreviewGradient: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  reelPreviewOverlay: {
    flex: 1,
    padding: 10,
    justifyContent: 'flex-end',
  },
  reelGameBadge: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start' as const,
    marginTop: 4,
  },
  reelGameBadgeText: {
    color: '#002E15',
    fontSize: 9,
    fontWeight: '700' as const,
  },
  reelPreviewInfo: {
    gap: 4,
  },
  reelPreviewTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  reelPreviewUser: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500' as const,
  },
  reelPreviewStats: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 4,
  },
  reelPreviewStatItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  reelPreviewStatText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600' as const,
  },
  taggedUsersText: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  reelTaggedUsersText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '500' as const,
    marginTop: 2,
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
  tickerContainer: {
    height: 36,
    overflow: 'hidden',
  },
  tickerGradient: {
    flex: 1,
    justifyContent: 'center',
  },
  tickerContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  tickerItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    gap: 6,
  },
  tickerUsername: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  tickerText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
  },
  tickerTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },

});
