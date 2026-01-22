import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import ScrollView from '@/components/ThemedScrollView';
import { Share2, Check, Heart, Flame, Monitor, Gamepad2, MessageSquare, Eye, Star, Upload } from 'lucide-react-native';
import { truncateTitle } from '@/constants/formatters';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import AddGamesModal from '@/components/AddGamesModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import ProfilePictureModal from '@/components/ProfilePictureModal';
import ProfileBannerModal from '@/components/ProfileBannerModal';
import ShareProfileModal from '@/components/ShareProfileModal';
import LevelBadge from '@/components/LevelBadge';
import LevelDetailsModal from '@/components/LevelDetailsModal';
import DailyLootboxModal from '@/components/DailyLootboxModal';
import UserTypeBadge from '@/components/UserTypeBadge';
import StyledUsername from '@/components/StyledUsername';
import ScreenshotViewerModal from '@/components/ScreenshotViewerModal';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api, Clip, Screenshot, Game } from '@/lib/api';


const { width } = Dimensions.get('window');

const TABS = ['Clips', 'Reels', 'Screenshots', 'Favorites'];

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const ClipItem = ({ clip, onPress, onDelete }: { clip: any, onPress: () => void, onDelete: () => void }) => {
  return (
    <Pressable
      style={styles.clipItem}
      onPress={onPress}
    >
      <Image source={{ uri: clip.thumbnailUrl }} style={styles.clipImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.clipGradient}
      />

      <View style={styles.clipTopRight}>
        <View style={styles.clipBadge}>
          <Text style={styles.clipBadgeText}>{formatDuration(clip.duration)}</Text>
        </View>
        <View style={styles.clipBadge}>
          <Eye size={10} color="#FFF" />
          <Text style={styles.clipBadgeText}>{clip.views}</Text>
        </View>
      </View>

      <View style={styles.clipBottom}>
        <Text style={styles.clipTitle} numberOfLines={1}>{truncateTitle(clip.title)}</Text>
        <Text style={styles.clipHandle}>{clip.user?.username ? `@${clip.user.username}` : ''}</Text>
        <View style={styles.clipGameTag}>
          <Text style={styles.clipGameTagText}>{clip.game?.name}</Text>
        </View>
      </View>
    </Pressable>
  );
};

const ReelItem = ({ reel, onPress, onDelete }: { reel: any, onPress: () => void, onDelete: () => void }) => {
  return (
    <Pressable 
      style={styles.reelItem}
      onPress={onPress}
    >
      <Image source={{ uri: reel.thumbnailUrl }} style={styles.reelImage} />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.reelGradient}
      />

      <View style={styles.reelTopRight}>
        <View style={styles.reelBadge}>
          <Text style={styles.reelBadgeText}>{formatDuration(reel.duration)}</Text>
        </View>
        <View style={styles.reelBadge}>
          <Eye size={10} color="#FFF" />
          <Text style={styles.reelBadgeText}>{reel.views}</Text>
        </View>
      </View>

      <View style={styles.reelBottom}>
        <Text style={styles.reelTitle}>{reel.title}</Text>
        <Text style={styles.reelHandle}>{reel.user?.username ? `@${reel.user.username}` : ''}</Text>
        <View style={styles.gameTag}>
          <Text style={styles.gameTagText}>{reel.game?.name}</Text>
        </View>
      </View>
    </Pressable>
  );
};

const ScreenshotItem = ({ screenshot, onPress, onDelete, handle }: { screenshot: any, onPress: () => void, onDelete: () => void, handle: string }) => {
  return (
    <Pressable 
      style={styles.screenshotCard}
      onPress={onPress}
    >
      <View style={styles.screenshotImageContainer}>
        <Image source={{ uri: screenshot.thumbnailUrl }} style={styles.screenshotImage} />
      </View>
      <View style={styles.screenshotContent}>
        <Text style={styles.screenshotTitle}>{screenshot.title}</Text>
        <Text style={styles.screenshotHandle}>{handle}</Text>
        <View style={[styles.gameTag, { marginBottom: 12 }]}>
          <Text style={styles.gameTagText}>{screenshot.game?.name}</Text>
        </View>
        <View style={styles.screenshotFooter}>
          <View style={styles.screenshotStats}>
            <View style={styles.statItem}>
              <Heart size={16} color="#94A3B8" />
              <Text style={styles.statValue}>{screenshot._count?.likes || 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Flame size={16} color="#94A3B8" />
              <Text style={styles.statValue}>{0}</Text>
            </View>
            <View style={styles.statItem}>
              <MessageSquare size={16} color="#94A3B8" />
              <Text style={styles.statValue}>{screenshot._count?.comments || 0}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState('Clips');
  const [isAddGamesModalVisible, setIsAddGamesModalVisible] = useState(false);
  const router = useRouter();
  const { user, getAccessToken } = useAuth();
  
  // Fetch profile stats (clips count, followers, following) using REST API
  const { data: profileStats } = useQuery({
    queryKey: ['profileStats', user?.username],
    queryFn: async () => {
      if (!user?.username) return null;
      const token = await getAccessToken();
      console.log('[Profile] Fetching profile stats for:', user.username);
      const result = await api.users.getProfile(user.username, token || undefined);
      console.log('[Profile] Profile stats:', result.user._count);
      return result.user;
    },
    enabled: !!user?.username,
  });

  // Fetch user clips (and reels) using REST API - uses username
  const { data: allClips = [], isLoading: clipsLoading, error: clipsError } = useQuery<Clip[]>({
    queryKey: ['userClips', user?.username],
    queryFn: async () => {
      if (!user?.username) return [];
      const token = await getAccessToken();
      console.log('[Profile] Fetching clips for user:', user.username);
      const clips = await api.users.getUserClips(user.username, token || undefined);
      console.log('[Profile] Fetched clips:', clips.length);
      return clips;
    },
    enabled: !!user?.username,
  });

  console.log('[Profile] All clips query:', {
    length: allClips.length,
    loading: clipsLoading,
    error: clipsError?.message || null,
    username: user?.username
  });
  
  if (clipsError) {
    console.error('[Profile] Clips error details:', clipsError);
  }
  const clips = allClips.filter(c => c.videoType !== 'reel');
  const reels = allClips.filter(c => c.videoType === 'reel');
  console.log('[Profile] Filtered - Clips:', clips.length, 'Reels:', reels.length);

  // Fetch screenshots using REST API
  const { data: allScreenshots = [], isLoading: screenshotsLoading, error: screenshotsError } = useQuery<Screenshot[]>({
    queryKey: ['userScreenshots', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const token = await getAccessToken();
      console.log('[Profile] Fetching screenshots for user:', user.id);
      const screenshots = await api.screenshots.getUserScreenshots(user.id, token || undefined);
      console.log('[Profile] Fetched screenshots:', screenshots.length);
      return screenshots;
    },
    enabled: !!user?.id,
  });

  console.log('[Profile] All screenshots query:', {
    length: allScreenshots.length,
    loading: screenshotsLoading,
    error: screenshotsError?.message || null,
    userId: user?.id
  });
  
  if (screenshotsError) {
    console.error('[Profile] Screenshots error details:', screenshotsError);
  }
  const screenshots = allScreenshots;
  console.log('[Profile] Filtered screenshots:', screenshots.length);

  // Fetch favorite games using REST API
  const { data: favoriteGames = [], isLoading: favoritesLoading, error: favoritesError } = useQuery<Game[]>({
    queryKey: ['userFavorites', user?.username],
    queryFn: async () => {
      if (!user?.username) return [];
      const token = await getAccessToken();
      console.log('[Profile] Fetching favorite games for user:', user.username);
      const games = await api.users.getFavorites(user.username, token || undefined);
      console.log('[Profile] Fetched favorite games:', games);
      return games;
    },
    enabled: !!user?.username,
  });

  console.log('[Profile] Favorite games:', {
    count: favoriteGames.length,
    loading: favoritesLoading,
    error: favoritesError?.message || null,
    games: favoriteGames.slice(0, 3)
  });
  
  const profileData = {
    name: user?.displayName || user?.username || 'User',
    handle: user?.username ? `@${user.username}` : '@user',
    avatar: user?.avatarUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop',
    banner: user?.bannerUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2671&auto=format&fit=crop',
    level: user?.level || 1,
    totalXP: user?.totalXP || 0,
    verified: user?.emailVerified || false,
    stats: {
      clips: profileStats?._count?.clips ?? user?._count?.clips ?? 0,
      followers: profileStats?._count?.followers ?? user?._count?.followers ?? 0,
      following: profileStats?._count?.following ?? user?._count?.following ?? 0
    },
    engagement: {
      likes: 0, // Not in User object, maybe separate API
      fires: 0,
      streak: user?.currentStreak || 0
    },
    joined: 'August 2025', // Not in User object
    bio: user?.bio || 'Just joined Gamefolio!',
    platforms: [
        { name: user?.username || 'User', type: 'xbox' as const, color: '#107C10' },
        { name: user?.username || 'User', type: 'ps' as const, color: '#00439C' },
        { name: user?.username || 'User', type: 'pc' as const, color: '#00A4EF' }
    ]
  };


  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: number, type: 'clip' | 'reel' | 'screenshot' } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  const deleteClipMutation = useMutation({
    mutationFn: async (clipId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated. Please log out and log back in.');
      console.log('[Profile] Deleting clip/reel:', clipId);
      console.log('[Profile] Using auth token, length:', token.length);
      return api.clips.delete(String(clipId), token);
    },
    onSuccess: () => {
      console.log('[Profile] Clip/Reel deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['userClips', user?.username] });
      setDeleteModalVisible(false);
      setItemToDelete(null);
      setIsDeleting(false);
    },
    onError: (error) => {
      console.error('[Profile] Error deleting clip/reel:', error);
      setIsDeleting(false);
    },
  });

  const deleteScreenshotMutation = useMutation({
    mutationFn: async (screenshotId: number) => {
      const token = await getAccessToken();
      console.log('[Profile] Screenshot delete - Using auth token:', !!token);
      console.log('[Profile] Screenshot delete - Token length:', token?.length || 0);
      console.log('[Profile] Screenshot delete - Screenshot ID:', screenshotId);
      console.log('[Profile] Screenshot delete - User ID:', user?.id);
      if (!token) throw new Error('Not authenticated. Please log out and log back in.');
      console.log('[Profile] Deleting screenshot with auth token');
      return api.screenshots.delete(String(screenshotId), token);
    },
    onSuccess: () => {
      console.log('[Profile] Screenshot deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['userScreenshots', user?.id] });
      setDeleteModalVisible(false);
      setItemToDelete(null);
      setIsDeleting(false);
    },
    onError: (error: any) => {
      console.error('[Profile] Error deleting screenshot:', error);
      console.error('[Profile] Error name:', error?.name);
      console.error('[Profile] Error message:', error?.message);
      console.error('[Profile] Error status:', error?.status);
      console.error('[Profile] Error data:', JSON.stringify(error?.data, null, 2));
      setIsDeleting(false);
    },
  });
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isBannerModalVisible, setIsBannerModalVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isLevelModalVisible, setIsLevelModalVisible] = useState(false);
  const [isLootboxModalVisible, setIsLootboxModalVisible] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(0);
  const [isScreenshotModalVisible, setIsScreenshotModalVisible] = useState(false);


  


  const handleDeleteClip = (id: number) => {
    setItemToDelete({ id, type: 'clip' });
    setDeleteModalVisible(true);
  };

  const handleDeleteReel = (id: number) => {
    setItemToDelete({ id, type: 'reel' });
    setDeleteModalVisible(true);
  };

  const handleDeleteScreenshot = (id: number) => {
    setItemToDelete({ id, type: 'screenshot' });
    setDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    console.log('[Profile] Deleting item:', itemToDelete);
    
    if (itemToDelete.type === 'screenshot') {
      deleteScreenshotMutation.mutate(itemToDelete.id);
    } else {
      deleteClipMutation.mutate(itemToDelete.id);
    }
  };

  const getImageUrl = (url: string) => {
    // Check if it's already a full URL or needs formatting
    if (url.startsWith('http')) return url;
    return url.replace('{width}', '600').replace('{height}', '800');
  };

  return (
    <View style={[styles.container, user?.backgroundColor ? { backgroundColor: user.backgroundColor } : undefined]}>
      <AppHeader onOpenLevelTracker={() => setIsLevelModalVisible(true)} />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity 
          style={styles.bannerContainer} 
          onPress={() => setIsBannerModalVisible(true)}
          activeOpacity={0.9}
        >

        {profileData.banner ? (
          <>
            <Image source={{ uri: profileData.banner }} style={styles.banner} resizeMode="cover" />
            {/* Bottom gradient */}
            <LinearGradient
              colors={['transparent', `${user?.backgroundColor || '#0F1520'}99`, `${user?.backgroundColor || '#0F1520'}DD`, user?.backgroundColor || '#0F1520']}
              style={styles.bannerGradient}
              locations={[0, 0.4, 0.7, 1]}
              pointerEvents="none"
            />

            {/* Top edge gradient */}
            <LinearGradient
              colors={[`${user?.backgroundColor || '#0F1520'}60`, 'transparent']}
              style={styles.bannerGradientTop}
              locations={[0, 1]}
              pointerEvents="none"
            />
          </>
        ) : (
          <>
            <View style={[styles.banner, { backgroundColor: '#00B8A9' }]} />
            <LinearGradient
              colors={['transparent', `${user?.backgroundColor || '#0F1520'}99`, `${user?.backgroundColor || '#0F1520'}DD`, user?.backgroundColor || '#0F1520']}
              style={styles.bannerGradient}
              locations={[0, 0.4, 0.7, 1]}
              pointerEvents="none"
            />

            <LinearGradient
              colors={[`${user?.backgroundColor || '#0F1520'}60`, 'transparent']}
              style={styles.bannerGradientTop}
              locations={[0, 1]}
              pointerEvents="none"
            />
          </>
        )}
        
        <TouchableOpacity 
          style={styles.bannerShareButton} 
          onPress={(e) => {
            e.stopPropagation();
            setIsShareModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <Share2 size={20} color="#FFF" />
        </TouchableOpacity>
      </TouchableOpacity>

      <View style={styles.content}>
        {/* Profile picture and action buttons row below banner */}
        <View style={styles.topRowWithActions}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity onPress={() => setIsProfileModalVisible(true)}>
                <Image 
                  source={{ uri: profileData.avatar }} 
                  style={[
                    styles.avatar, 
                    { borderColor: user?.backgroundColor || '#0F1520' }
                  ]} 
                />
                <View style={styles.onlineIndicator} />
            </TouchableOpacity>
            <View style={styles.badgesContainer}>
              <TouchableOpacity 
                style={styles.levelBadgeContainer}
                onPress={() => setIsLevelModalVisible(true)}
                activeOpacity={0.7}
              >
                <LevelBadge level={profileData.level} currentXP={profileData.totalXP} size={32} thickness={3} />
              </TouchableOpacity>
            </View>
          </View>


        </View>

        {/* Profile Header */}
        <View style={styles.header}>

          <View style={styles.userInfoSection}>
            <View style={styles.nameRow}>
              <View style={styles.nameRowLeft}>
                <StyledUsername 
                  username={profileData.name} 
                  textStyleId={(user as any)?.textStyleId || 'default'}
                  fontSize={26}
                />
                {profileData.verified && (
                  <View style={styles.verifiedBadge}>
                    <Check size={10} color="#FFF" strokeWidth={4} />
                  </View>
                )}
              </View>
              <View style={styles.nametagContainer}>
                <Image 
                  source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/8i8wqbkgai6khk845s60z' }} 
                  style={styles.nametagImage}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={styles.handle}>{profileData.handle}</Text>
            <UserTypeBadge 
              userType={user?.userType} 
              showUserType={user?.showUserType !== false} 
            />
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.memberSince}>Member since {profileData.joined}</Text>
          <Text style={styles.bio}>{profileData.bio}</Text>
          <View style={styles.divider} />

          <View style={styles.statsRowCompact}>
            <View style={styles.statColumn}>
              <Text style={styles.statNumber}>{profileData.stats.clips}</Text>
              <Text style={styles.statLabel}>Clips</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statNumber}>{profileData.stats.followers}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statColumn}>
              <Text style={styles.statNumber}>{profileData.stats.following}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          <View style={styles.platformsRow}>
            {profileData.platforms.map((platform, index) => (
              <View key={index} style={[styles.platformTag, { backgroundColor: platform.color }]}>
                {platform.type === 'xbox' && <Gamepad2 size={12} color="#FFF" />}
                {platform.type === 'ps' && <Gamepad2 size={12} color="#FFF" />}
                {platform.type === 'pc' && <Monitor size={12} color="#FFF" />}
                <Text style={styles.platformText}>{platform.name}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer} contentContainerStyle={styles.tabsContent}>
          {TABS.map((tab) => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content based on active tab */}
        {activeTab === 'Clips' && (
          <View style={styles.grid}>
            {clipsLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Loading clips...</Text>
              </View>
            ) : clips.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyState}>
                  <Upload size={48} color="#4ADE80" strokeWidth={1.5} />
                  <Text style={styles.emptyStateTitle}>No clips yet</Text>
                  <Text style={styles.emptyStateSubtitle}>Upload your first clip to get started</Text>
                </View>
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={() => router.push('/(drawer)/(tabs)/create')}
                  activeOpacity={0.8}
                >
                  <Upload size={20} color="#FFF" />
                  <Text style={styles.uploadButtonText}>Upload Clip</Text>
                </TouchableOpacity>
              </View>
            ) : (
              clips.map((clip) => (
                <ClipItem 
                  key={clip.id} 
                  clip={clip} 
                  onPress={() => router.push({ pathname: '/clip/[id]', params: { id: clip.id, fromUser: user?.username } })}
                  onDelete={() => handleDeleteClip(clip.id)}
                />
              ))
            )}
          </View>
        )}

        {activeTab === 'Reels' && (
          <View style={styles.reelsGrid}>
            {clipsLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Loading reels...</Text>
              </View>
            ) : reels.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyState}>
                  <Upload size={48} color="#4ADE80" strokeWidth={1.5} />
                  <Text style={styles.emptyStateTitle}>No reels yet</Text>
                  <Text style={styles.emptyStateSubtitle}>Upload your first reel to get started</Text>
                </View>
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={() => router.push('/(drawer)/(tabs)/create')}
                  activeOpacity={0.8}
                >
                  <Upload size={20} color="#FFF" />
                  <Text style={styles.uploadButtonText}>Upload Reel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              reels.map((reel) => (
                <ReelItem 
                  key={reel.id} 
                  reel={reel}
                  onPress={() => router.push({ pathname: '/clip/[id]', params: { id: reel.id, fromUser: user?.username } })}
                  onDelete={() => handleDeleteReel(reel.id)}
                />
              ))
            )}
          </View>
        )}

        {activeTab === 'Screenshots' && (
          <View style={styles.screenshotsList}>
            {screenshotsLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Loading screenshots...</Text>
              </View>
            ) : screenshots.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyState}>
                  <Upload size={48} color="#4ADE80" strokeWidth={1.5} />
                  <Text style={styles.emptyStateTitle}>No screenshots yet</Text>
                  <Text style={styles.emptyStateSubtitle}>Upload your first screenshot to get started</Text>
                </View>
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={() => router.push('/(drawer)/(tabs)/create')}
                  activeOpacity={0.8}
                >
                  <Upload size={20} color="#FFF" />
                  <Text style={styles.uploadButtonText}>Upload Screenshot</Text>
                </TouchableOpacity>
              </View>
            ) : (
              screenshots.map((item, index) => (
                <ScreenshotItem
                  key={item.id}
                  screenshot={item}
                  handle={profileData.handle}
                  onPress={() => {
                    setSelectedScreenshot(item);
                    setSelectedScreenshotIndex(index);
                    setIsScreenshotModalVisible(true);
                  }}
                  onDelete={() => handleDeleteScreenshot(item.id)}
                />
              ))
            )}
          </View>
        )}

        {activeTab === 'Favorites' && (
          <View>
            <View style={styles.favoritesGrid}>
              {favoriteGames.length === 0 ? (
                  <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>No favorite games yet.</Text>
                  </View>
              ) : (
                  favoriteGames.map((game) => (
                  <TouchableOpacity key={game.id} style={styles.favoriteItem} activeOpacity={0.8}>
                      <Image source={{ uri: getImageUrl(game.imageUrl) }} style={styles.favoriteImage} />
                      <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.9)']}
                          style={styles.favoriteGradient}
                      />
                      <View style={styles.favoriteContent}>
                          <Text style={styles.favoriteTitle} numberOfLines={2}>{game.name}</Text>
                      </View>
                  </TouchableOpacity>
                  ))
              )}
            </View>

            <TouchableOpacity 
              style={styles.discoverButton}
              onPress={() => setIsAddGamesModalVisible(true)}
              activeOpacity={0.8}
            >
              <Star size={20} color="#4ADE80" />
              <Text style={styles.discoverButtonText}>Discover More Games</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      </ScrollView>

      <AddGamesModal 
        visible={isAddGamesModalVisible} 
        onClose={() => setIsAddGamesModalVisible(false)} 
      />

      <ProfilePictureModal
        visible={isProfileModalVisible}
        onClose={() => setIsProfileModalVisible(false)}
        imageUrl={profileData.avatar}
        username={profileData.handle}
      />

      <ProfileBannerModal
        visible={isBannerModalVisible}
        onClose={() => setIsBannerModalVisible(false)}
        // passing mock banner url if you want, or handle the fact we use a solid color view in render
        // For now, let's pass undefined to show color, or pass profileData.banner if we want to show the image in modal
        // The mock data HAS a banner url, so let's pass it.
        bannerUrl={profileData.banner} 
        username={profileData.handle}
      />

      <ConfirmationModal
        visible={deleteModalVisible}
        title={itemToDelete?.type === 'clip' ? "Delete Clip" : itemToDelete?.type === 'reel' ? "Delete Reel" : "Delete Screenshot"}
        message={`Are you sure you want to delete this ${itemToDelete?.type}? This action cannot be undone.`}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteModalVisible(false);
            setItemToDelete(null);
          }
        }}
        onConfirm={confirmDelete}
        cancelText="Cancel"
        confirmText={isDeleting ? "Deleting..." : "Delete"}
      />

      <ShareProfileModal
        visible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        profile={{
          displayName: profileData.name,
          username: user?.username || 'user',
          bio: profileData.bio,
          avatarUrl: profileData.avatar,
          bannerUrl: profileData.banner,
          borderColor: user?.accentColor || '#4ADE80',
          level: profileData.level,
          totalXP: profileData.totalXP,
          verified: profileData.verified,
          stats: profileData.stats,
          engagement: profileData.engagement,
          platforms: profileData.platforms,
          userType: user?.userType || 'gamer',
          games: favoriteGames.slice(0, 3).map((game, index) => ({
            id: game.id || index,
            name: game.name,
            imageUrl: game.imageUrl,
          })),
        }}
      />

      <LevelDetailsModal
        visible={isLevelModalVisible}
        onClose={() => setIsLevelModalVisible(false)}
        level={profileData.level}
        currentXP={profileData.totalXP}
      />

      <DailyLootboxModal
        visible={isLootboxModalVisible}
        onClose={() => setIsLootboxModalVisible(false)}
        onClaimed={() => {
          console.log('[Profile] Lootbox claimed successfully');
        }}
      />

      <ScreenshotViewerModal
        visible={isScreenshotModalVisible}
        onClose={() => {
          setIsScreenshotModalVisible(false);
          setSelectedScreenshot(null);
        }}
        screenshot={selectedScreenshot}
        screenshots={screenshots}
        initialIndex={selectedScreenshotIndex}
        handle={profileData.handle}
        isOwner={true}
        onDelete={() => {
          if (selectedScreenshot) {
            setIsScreenshotModalVisible(false);
            handleDeleteScreenshot(selectedScreenshot.id);
            setSelectedScreenshot(null);
          }
        }}
      />




    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
  },
  scrollView: {
    flex: 1,
  },
  bannerContainer: {
    height: 180,
    width: '100%',
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#00B8A9',
  },
  bannerGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
  },

  bannerGradientTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: -90,
  },
  header: {
    marginBottom: 12,
    marginTop: 0,
  },
  topRowWithActions: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rightColumn: {
    flex: 1,
    marginLeft: 12,
  },

  userInfoSection: {
    alignItems: 'flex-start',
    width: '100%',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 4,
  },
  badgesContainer: {
    position: 'relative',
  },
  levelBadgeContainer: {
    position: 'absolute',
    bottom: -12,
    left: '50%',
    marginLeft: -16,
  },
  lootboxBadgeContainer: {
    position: 'absolute',
    bottom: -8,
    left: 70,
  },
  lootboxBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#0F1520',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  lootboxBadgeText: {
    fontSize: 20,
  },
  onlineIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#0F1520',
  },
  bannerShareButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  infoSection: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    width: '100%',
  },
  nameRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  name: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
  },

  handle: {
    fontSize: 15,
    color: '#94A3B8',
    marginBottom: 4,
    textAlign: 'left',
  },
  verifiedBadge: {
    backgroundColor: '#3B82F6',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRowCompact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
    marginBottom: 12,
  },
  statColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  statNumber: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 15,
  },
  engagementToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  engagementToggleText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  statText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  statBold: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  engagementGradient: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 4,
    gap: 24,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  engagementIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    position: 'absolute',
    top: -35,
    left: '50%',
    transform: [{ translateX: -30 }],
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    zIndex: 1000,
  },
  tooltipText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
  },
  engagementValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    width: '65%',
    marginBottom: 16,
  },
  memberSince: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'left',
  },
  bio: {
    color: '#E2E8F0',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'left',
  },
  platformsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  platformTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    gap: 4,
  },
  platformText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 16,
  },
  tabsContent: {
    paddingBottom: 0,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4ADE80',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFF',
  },
  grid: {
    flexDirection: 'column',
    gap: 12,
    paddingBottom: 40,
  },
  reelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 40,
  },
  favoritesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 40,
  },
  clipItem: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  clipImage: {
    width: '100%',
    height: '100%',
  },
  clipGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  clipTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  clipBadge: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  clipBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  clipBottom: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
  },
  clipTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  clipHandle: {
    color: '#E2E8F0',
    fontSize: 12,
    marginBottom: 6,
    opacity: 0.9,
  },
  clipGameTag: {
    backgroundColor: '#22C55E', // Green
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  clipGameTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  gridItem: {
    width: (width - 32 - 12) / 2, // 2 columns: screen width - padding - gap
    aspectRatio: 16/9,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  viewsBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  viewsText: {
    color: '#FFF',
    fontSize: 10,
  },
  screenshotsList: {
    paddingBottom: 40,
    gap: 16,
  },
  screenshotCard: {
    backgroundColor: '#1E293B', // Slate-800
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155', // Slate-700
  },
  screenshotImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  screenshotContent: {
    padding: 12,
    paddingTop: 20,
  },
  screenshotTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  screenshotHandle: {
    color: '#CBD5E1',
    fontSize: 14,
    marginBottom: 8,
  },
  screenshotFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  screenshotStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    color: '#94A3B8',
    fontSize: 13,
  },
  reelItem: {
    width: (width - 32 - 12) / 2,
    aspectRatio: 9/16,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  reelImage: {
    width: '100%',
    height: '100%',
  },
  reelGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  reelTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  reelBadge: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reelBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  reelBottom: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  reelTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  reelHandle: {
    color: '#CBD5E1',
    fontSize: 12,
    marginBottom: 8,
  },
  gameTag: {
    backgroundColor: '#22C55E', // Green-500
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  gameTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  favoriteItem: {
    width: (width - 32 - 12) / 2,
    aspectRatio: 3/4,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  favoriteImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  favoriteGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  favoriteContent: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  favoriteTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  emptyStateContainer: {
    width: '100%',
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyStateTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
  },
  emptyStateSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  discoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4ADE80',
    paddingVertical: 14,
    borderRadius: 12,
    marginVertical: 20,
    gap: 8,
  },
  discoverButtonText: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  screenshotImageContainer: {
    position: 'relative',
  },
  screenshotDeleteButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#EF4444',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  nametagContainer: {
    marginLeft: 8,
  },
  nametagImage: {
    width: 120,
    height: 60,
  },
});
