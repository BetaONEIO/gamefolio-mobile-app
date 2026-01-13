import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Eye, Video, VideoOff, Film, X, Upload, Flame, TrendingUp } from 'lucide-react-native';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View, Modal, FlatList, Dimensions, StatusBar, ViewToken, Keyboard, Animated, Image } from 'react-native';
import ScrollView from '@/components/ThemedScrollView';
import { useRouter, useFocusEffect } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Clip } from '@/lib/api';
import { shortenGameName, truncateTitle } from '@/constants/formatters';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/context/AuthContext';
import { useUser } from '@/context/UserContext';
import ReelViewer from '@/components/ReelViewer';
import LevelDetailsModal from '@/components/LevelDetailsModal';
import type { ReelData, Comment } from '@/components/ReelViewer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LatestUpload {
  id: number;
  title: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

interface TrendingUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  totalXP: number;
  level: number;
  currentStreak: number;
  accentColor: string | null;
}

const MOCK_TRENDING_USERS: TrendingUser[] = [
  {
    id: 1,
    username: 'ProGamer99',
    displayName: 'Pro Gamer',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400',
    totalXP: 15000,
    level: 25,
    currentStreak: 12,
    accentColor: '#4ADE80',
  },
  {
    id: 2,
    username: 'NinjaPlayer',
    displayName: 'Ninja Player',
    avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100',
    bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400',
    totalXP: 12500,
    level: 20,
    currentStreak: 8,
    accentColor: '#F59E0B',
  },
  {
    id: 3,
    username: 'WarzoneKing',
    displayName: 'Warzone King',
    avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
    bannerUrl: 'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=400',
    totalXP: 10000,
    level: 18,
    currentStreak: 5,
    accentColor: '#EF4444',
  },
  {
    id: 4,
    username: 'EpicGamer',
    displayName: 'Epic Gamer',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400',
    totalXP: 9500,
    level: 17,
    currentStreak: 3,
    accentColor: '#8B5CF6',
  },
];

const MOCK_LATEST_UPLOADS: LatestUpload[] = [
  { id: 1, title: 'Nice junk 4k', createdAt: new Date().toISOString(), user: { id: 1, username: 'JawaTheGathering', displayName: 'Jawa', avatarUrl: null } },
  { id: 2, title: 'Every sim main deserves this', createdAt: new Date().toISOString(), user: { id: 2, username: 'JawaTheGathering', displayName: 'Jawa', avatarUrl: null } },
  { id: 3, title: 'Insane clutch moment', createdAt: new Date().toISOString(), user: { id: 3, username: 'ProGamer99', displayName: 'Pro Gamer', avatarUrl: null } },
  { id: 4, title: 'First win of the season', createdAt: new Date().toISOString(), user: { id: 4, username: 'NinjaPlayer', displayName: 'Ninja', avatarUrl: null } },
];


// Mock clips for testing
const MOCK_CLIPS: Clip[] = [
  {
    id: 1,
    userId: 1,
    gameId: 1,
    title: 'Insane 1v5 Clutch in Valorant',
    description: 'Watch me clutch this impossible round!',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop',
    videoType: 'clip',
    duration: 45,
    views: 12500,
    shareCode: 'abc123',
    ageRestricted: false,
    createdAt: new Date().toISOString(),
    user: {
      id: 1,
      username: 'ProGamer99',
      displayName: 'Pro Gamer',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
    },
    game: {
      id: 1,
      name: 'Valorant',
      imageUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=100',
    },
    _count: {
      likes: 342,
      comments: 28,
    },
  },
  {
    id: 2,
    userId: 2,
    gameId: 2,
    title: 'Epic Fortnite Victory Royale',
    description: 'Got the dub with 15 eliminations',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop',
    videoType: 'clip',
    duration: 62,
    views: 8900,
    shareCode: 'def456',
    ageRestricted: false,
    createdAt: new Date().toISOString(),
    user: {
      id: 2,
      username: 'NinjaPlayer',
      displayName: 'Ninja Player',
      avatarUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100',
    },
    game: {
      id: 2,
      name: 'Fortnite',
      imageUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=100',
    },
    _count: {
      likes: 567,
      comments: 45,
    },
  },
  {
    id: 3,
    userId: 3,
    gameId: 3,
    title: 'Warzone Quad Wipe',
    description: 'Clean team wipe in Verdansk',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=800&auto=format&fit=crop',
    videoType: 'clip',
    duration: 38,
    views: 5200,
    shareCode: 'ghi789',
    ageRestricted: false,
    createdAt: new Date().toISOString(),
    user: {
      id: 3,
      username: 'WarzoneKing',
      displayName: 'Warzone King',
      avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100',
    },
    game: {
      id: 3,
      name: 'Call of Duty: Warzone',
      imageUrl: 'https://images.unsplash.com/photo-1493711662062-fa541f7f3d24?w=100',
    },
    _count: {
      likes: 189,
      comments: 12,
    },
  },
];

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
            console.log('[Home] No clips from API, using mock data');
            return MOCK_CLIPS;
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
          console.log('[Home] No clips from favorite games, using mock data');
          return MOCK_CLIPS;
        }
        
        return shuffled.slice(0, 20);
      } catch (error) {
        console.log('[Home] Error fetching clips, using mock data:', error);
        return MOCK_CLIPS;
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
        // If no clips from API, use mock data for testing
        if (clips.length === 0) {
          console.log('[Home] No feed clips from API, using mock data');
          return MOCK_CLIPS;
        }
        return clips;
      } catch (error) {
        console.log('[Home] Error fetching feed clips, using mock data:', error);
        return MOCK_CLIPS;
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
      return reels;
    },
  });

  const trendingUsersQuery = trpc.users.getTrending.useQuery(
    { limit: 10 },
    {
      retry: false,
    }
  );
  
  useEffect(() => {
    if (trendingUsersQuery.error) {
      console.log('[Home] Error fetching trending users, using mock data:', trendingUsersQuery.error.message);
    }
  }, [trendingUsersQuery.error]);
  
  const trendingUsers = trendingUsersQuery.data?.users || MOCK_TRENDING_USERS;

  const latestUploadsQuery = trpc.clips.getLatestUploads.useQuery(
    { limit: 20 },
    {
      retry: false,
    }
  );
  
  useEffect(() => {
    if (latestUploadsQuery.error) {
      console.log('[Home] Error fetching latest uploads, using mock data:', latestUploadsQuery.error.message);
    }
  }, [latestUploadsQuery.error]);
  
  const latestUploads = latestUploadsQuery.data?.uploads || MOCK_LATEST_UPLOADS;

  
  const tickerRef = useRef<Animated.Value>(new Animated.Value(0)).current;

  useEffect(() => {
    const tickerWidth = latestUploads.length * 350;
    const animateTicker = () => {
      tickerRef.setValue(0);
      Animated.timing(tickerRef, {
        toValue: -tickerWidth,
        duration: latestUploads.length * 8000,
        useNativeDriver: true,
      }).start(() => animateTicker());
    };
    animateTicker();
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
            {[...latestUploads, ...latestUploads].map((upload, index) => (
              <TouchableOpacity
                key={`${upload.id}-${index}`}
                style={styles.tickerItem}
                onPress={() => router.push({ pathname: '/clip/[id]', params: { id: upload.id.toString() } })}
              >
                <Upload size={14} color="#FFF" />
                <Text style={styles.tickerUsername}>{upload.user?.username || 'Unknown'}</Text>
                <Text style={styles.tickerText}>has just uploaded a clip</Text>
                <Text style={styles.tickerTitle}>&quot;{upload.title}&quot;</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        </LinearGradient>
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1532906619279-a76e736a55e1?q=80&w=800&auto=format&fit=crop' }}
            style={styles.heroBackground}
            imageStyle={{ borderRadius: 24 }}
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.heroGradient}
            >
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>Welcome back, Gamers!</Text>
                <Text style={styles.heroSubtitle}>
                  Continue sharing your epic moments and discover what the community has been up to.
                </Text>
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>

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
            activeClips.map((clip) => (
              <TouchableOpacity 
                key={clip.id} 
                style={activeTab === 'clips' ? styles.featuredClipCard : styles.featuredReelCard}
                onPress={() => router.push({ pathname: '/clip/[id]', params: { id: clip.id.toString() } })}
              >
                <ImageBackground
                  source={{ uri: clip.thumbnailUrl }}
                  style={activeTab === 'clips' ? styles.featuredClipThumbnail : styles.featuredReelThumbnail}
                  imageStyle={{ borderRadius: 16 }}
                >
                  <View style={styles.latestClipOverlay}>
                    <View style={styles.latestClipTopStats}>
                      <View style={styles.statsBadge}>
                        <Text style={styles.statsText}>{formatDuration(clip.duration)}</Text>
                        <View style={styles.statsDivider} />
                        <Eye size={12} color="#FFF" style={{ marginRight: 4 }} />
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
                source={{ uri: clip.thumbnailUrl }}
                style={styles.latestClipThumbnail}
                imageStyle={{ borderRadius: 16 }}
              >
                <View style={styles.latestClipOverlay}>
                  <View style={styles.latestClipTopStats}>
                     <View style={styles.statsBadge}>
                        <Text style={styles.statsText}>{formatDuration(clip.duration)}</Text>
                        <View style={styles.statsDivider} />
                        <Eye size={12} color="#FFF" style={{ marginRight: 4 }} />
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
                source={{ uri: reel.thumbnailUrl }}
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

        {/* Trending Gamefolios Section */}
        <View style={styles.sectionHeaderWithAction}>
          <View style={styles.sectionHeaderLeft}>
            <TrendingUp size={20} color="#4ADE80" />
            <Text style={styles.sectionTitle}>Trending Gamefolios</Text>
          </View>
          <TouchableOpacity style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View all</Text>
            <ChevronRight size={16} color="#4ADE80" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.clipsList}
        >
          {trendingUsers.map((trendingUser) => (
            <TouchableOpacity 
              key={trendingUser.id} 
              style={styles.trendingUserCard}
              onPress={() => {
                console.log('[Home] Navigating to user profile:', trendingUser.username);
                router.push({ pathname: '/user/[id]', params: { id: trendingUser.username } });
              }}
              activeOpacity={0.7}
            >
              <ImageBackground
                source={{ uri: trendingUser.bannerUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400' }}
                style={styles.trendingUserBanner}
                imageStyle={{ borderRadius: 16 }}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.9)']}
                  style={styles.trendingUserGradient}
                >
                  <View style={styles.trendingUserContent}>
                    <View style={styles.trendingUserAvatarContainer}>
                      <Image
                        source={{ uri: trendingUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100' }}
                        style={[
                          styles.trendingUserAvatar,
                          { borderColor: trendingUser.accentColor || '#4ADE80' }
                        ]}
                      />
                      <View style={[
                        styles.trendingUserLevelBadge,
                        { backgroundColor: trendingUser.accentColor || '#4ADE80' }
                      ]}>
                        <Text style={styles.trendingUserLevelText}>{trendingUser.level}</Text>
                      </View>
                    </View>
                    
                    <Text style={styles.trendingUserDisplayName} numberOfLines={1}>
                      {trendingUser.displayName}
                    </Text>
                    <Text style={styles.trendingUserUsername}>@{trendingUser.username}</Text>
                    
                    <View style={styles.trendingUserStats}>
                      <View style={styles.trendingUserStatItem}>
                        <Flame size={12} color="#F59E0B" />
                        <Text style={styles.trendingUserStatText}>{trendingUser.currentStreak} streak</Text>
                      </View>
                      <View style={styles.trendingUserStatItem}>
                        <TrendingUp size={12} color="#4ADE80" />
                        <Text style={styles.trendingUserStatText}>{(trendingUser.totalXP / 1000).toFixed(1)}k XP</Text>
                      </View>
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
    paddingHorizontal: 20,
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
    paddingRight: 20,
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
    width: 130,
    height: 220,
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
    gap: 6,
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
    width: 140,
    height: 220,
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
  trendingUserCard: {
    width: 160,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  trendingUserBanner: {
    width: '100%',
    height: '100%',
  },
  trendingUserGradient: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  trendingUserContent: {
    padding: 12,
    alignItems: 'center' as const,
  },
  trendingUserAvatarContainer: {
    position: 'relative' as const,
    marginBottom: 8,
  },
  trendingUserAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
  },
  trendingUserLevelBadge: {
    position: 'absolute' as const,
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  trendingUserLevelText: {
    color: '#002E15',
    fontSize: 10,
    fontWeight: '700' as const,
  },
  trendingUserDisplayName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700' as const,
    textAlign: 'center' as const,
  },
  trendingUserUsername: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 8,
  },
  trendingUserStats: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  trendingUserStatItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  trendingUserStatText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600' as const,
  },
});
