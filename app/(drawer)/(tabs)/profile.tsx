import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import ScrollView from '@/components/ThemedScrollView';
import { Share2, Check, Heart, Flame, Monitor, Gamepad2, MessageSquare, Eye, Star, Upload, FolderHeart, Camera, Hexagon } from 'lucide-react-native';
import { truncateTitle } from '@/constants/formatters';
import { getClipThumbnail, getReelThumbnail, getScreenshotThumbnail } from '@/utils/thumbnails';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { getProfileTheme, ProfileThemeTokens } from '@/constants/themes';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import AddGamesModal from '@/components/AddGamesModal';
import ConfirmationModal from '@/components/ConfirmationModal';
import ProfilePictureModal from '@/components/ProfilePictureModal';
import ProfileBannerModal from '@/components/ProfileBannerModal';
import ShareProfileModal from '@/components/ShareProfileModal';
import LevelBadge from '@/components/LevelBadge';
import LevelDetailsModal from '@/components/LevelDetailsModal';
import UserTypeBadge from '@/components/UserTypeBadge';
import StyledUsername, { FONT_STYLES } from '@/components/StyledUsername';
import { ThemeBackgroundEffect } from '@/components/ThemeBackgroundEffect';
import ScreenshotViewerModal from '@/components/ScreenshotViewerModal';
import BirthdayBanner, { isBirthdayToday } from '@/components/BirthdayBanner';

import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { api, Clip, Screenshot, Game, getEffectiveAvatarUrl } from '@/lib/api';
import { Env } from '@/constants/Env';
import { resolveNftImageUrl } from '@/lib/image-utils';


const { width } = Dimensions.get('window');

const TABS = ['Clips', 'Reels', 'Screenshots', 'Favorites', 'Collection'];

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
      <Image source={{ uri: getClipThumbnail(clip) }} style={styles.clipImage} />
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
      <Image source={{ uri: getReelThumbnail(reel) }} style={styles.reelImage} />
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
        <Image source={{ uri: getScreenshotThumbnail(screenshot) }} style={styles.screenshotImage} />
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


function createHeaderStyles(theme: ProfileThemeTokens) {
  return {
    containerBg: theme.bg,
    avatarBorderColor: theme.avatarBorderColor,
    namePrimary: theme.textPrimary,
    handleColor: theme.textHandle,
    statNumberColor: theme.statNumberColor,
    statLabelColor: theme.muted,
    memberSinceColor: theme.memberSinceColor,
    bioColor: theme.bioTextColor,
    verifiedBg: theme.verifiedBg,
    verifiedBorder: theme.verifiedBorderColor,
    cardBg: theme.cardBg,
    cardBorder: theme.cardBorder,
    cardBorderRadius: theme.cardBorderRadius,
    statNumberSize: theme.statNumberFontSize,
    statLabels: theme.statLabels,
    statAlign: theme.statAlign,
    statLabelPill: theme.statLabelPill,
    displayNameFontId: theme.displayNameFontId,
    displayNameEffectId: theme.displayNameEffectId,
    displayNameUppercase: theme.displayNameUppercase,
    platformTagStyle: theme.platformTagStyle || 'solid',
    platformTagBorderColor: theme.platformTagBorderColor,
    tabActiveBorder: theme.tabActiveBorder,
    tabActiveText: theme.tabActiveText,
    tabBg: theme.tabInactiveBg,
    tabBorderColor: theme.tabInactiveBorder,
    gradientColors: theme.nametagGradient as [string, string, ...string[]],
    accentMuted: theme.accentMuted,
    dividerColor: theme.dividerColor,
    isLight: theme.isLight,
    accent: theme.accent,
    bioBg: theme.bioBg,
    bioBorderColor: theme.bioBorderColor,
  };
}

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState('Clips');
  const [isAddGamesModalVisible, setIsAddGamesModalVisible] = useState(false);
  const [profileSectionTab, setProfileSectionTab] = useState<'stats' | 'collection'>('stats');
  const router = useRouter();
  const { user, getAccessToken } = useAuth();
  const theme = useMemo(() => getProfileTheme((user as any)?.profileTheme), [user]);
  const h = useMemo(() => createHeaderStyles(theme), [theme]);
  const displayFont = useMemo(() => FONT_STYLES.find(f => f.id === (theme.displayNameFontId || 'default')), [theme]);
  
  // Fetch profile stats (clips count, followers, following) using REST
  const { data: profileStats } = useQuery({
    queryKey: ['/api/users', user?.username, 'profile'],
    queryFn: async () => {
      if (!user?.username) return null;
      const token = await getAccessToken();
      const result = await api.users.getProfile(user.username, token ?? undefined);
      return result?.user ?? null;
    },
    enabled: !!user?.username,
  });

  // Fetch user clips (and reels) using REST
  const { data: clipsData, isLoading: clipsLoading, error: clipsError } = useQuery({
    queryKey: ['/api/users', user?.username, 'clips'],
    queryFn: async () => {
      if (!user?.username) return [];
      const token = await getAccessToken();
      return api.users.getUserClips(user.username, token ?? undefined);
    },
    enabled: !!user?.username,
  });
  const allClips = (clipsData || []) as Clip[];

  console.log('[Profile] All clips query:', {
    length: allClips.length,
    loading: clipsLoading,
    error: clipsError?.message || null,
    userId: user?.id
  });
  
  if (clipsError) {
    console.error('[Profile] Clips error details:', clipsError);
  }
  const clips = allClips.filter(c => c.videoType !== 'reel');
  const reels = allClips.filter(c => c.videoType === 'reel');
  console.log('[Profile] Filtered - Clips:', clips.length, 'Reels:', reels.length);

  // Fetch screenshots using REST
  const { data: screenshotsData, isLoading: screenshotsLoading, error: screenshotsError } = useQuery({
    queryKey: ['/api/users', user?.id, 'screenshots'],
    queryFn: async () => {
      if (!user?.id) return [];
      const token = await getAccessToken();
      return api.screenshots.getUserScreenshots(user.id, token ?? undefined);
    },
    enabled: !!user?.id,
  });
  const allScreenshots = (screenshotsData || []) as Screenshot[];

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

  // Fetch favorite games using REST
  const { data: favoritesData, isLoading: favoritesLoading, error: favoritesError } = useQuery({
    queryKey: ['/api/users', user?.username, 'favorites'],
    queryFn: async () => {
      if (!user?.username) return [];
      const token = await getAccessToken();
      return api.users.getFavorites(user.username, token ?? undefined);
    },
    enabled: !!user?.username,
  });
  const favoriteGames = (favoritesData || []) as Game[];

  console.log('[Profile] Favorite games:', {
    count: favoriteGames.length,
    loading: favoritesLoading,
    error: favoritesError?.message || null,
    games: favoriteGames.slice(0, 3)
  });

  const formatJoinDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const buildPlatforms = () => {
    const platforms: { name: string; type: string; color: string }[] = [];
    if (user?.xboxUsername) platforms.push({ name: user.xboxUsername, type: 'xbox', color: '#107C10' });
    if (user?.playstationUsername) platforms.push({ name: user.playstationUsername, type: 'ps', color: '#00439C' });
    if (user?.steamUsername) platforms.push({ name: user.steamUsername, type: 'pc', color: '#00A4EF' });
    if (user?.nintendoUsername) platforms.push({ name: user.nintendoUsername, type: 'nintendo', color: '#E60012' });
    if (user?.epicUsername) platforms.push({ name: user.epicUsername, type: 'epic', color: '#2F2D2E' });
    return platforms;
  };

  const profileData = {
    name: user?.displayName || user?.username || 'User',
    handle: user?.username ? `@${user.username}` : '@user',
    avatar: getEffectiveAvatarUrl(profileStats as any) || getEffectiveAvatarUrl(user) || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop',
    banner: (profileStats as any)?.bannerUrl || user?.bannerUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2671&auto=format&fit=crop',
    level: user?.level || 1,
    totalXP: user?.totalXP || 0,
    verified: user?.emailVerified || false,
    stats: {
      uploads: clips.length + reels.length + screenshots.length,
      followers: profileStats?._count?.followers ?? user?._count?.followers ?? 0,
      following: profileStats?._count?.following ?? user?._count?.following ?? 0
    },
    engagement: {
      likes: 0,
      fires: 0,
      streak: user?.currentStreak || 0
    },
    joined: formatJoinDate(user?.createdAt),
    bio: (profileStats as any)?.bio || user?.bio || '',
    platforms: buildPlatforms()
  };

  // Fetch owned NFTs — only when collection tab is active
  const { data: nftData, isLoading: nftsLoading } = useQuery<{ nfts: any[]; count: number }>({
    queryKey: ['/api/nfts/owned'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${Env.BACKEND_URL}/api/nfts/owned`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch NFTs');
      return res.json();
    },
    enabled: activeTab === 'Collection',
    staleTime: 60_000,
  });

  const ownedNfts = useMemo(() => (nftData?.nfts || []).filter((n: any) => !n.sold), [nftData]);

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
    <View style={[styles.container, { backgroundColor: h.containerBg }]}>
      <AppHeader onOpenLevelTracker={() => setIsLevelModalVisible(true)} />
      {(user as any)?.profileTheme && (
        <View style={[StyleSheet.absoluteFill, { opacity: 0.45 }]} pointerEvents="none">
          <ThemeBackgroundEffect themeId={(user as any).profileTheme} />
        </View>
      )}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {isBirthdayToday(user?.birthday) && (
          <BirthdayBanner 
            displayName={user?.displayName || user?.username || 'User'} 
            isOwnProfile={true} 
          />
        )}
        <TouchableOpacity 
          style={styles.bannerContainer} 
          onPress={() => setIsBannerModalVisible(true)}
          activeOpacity={0.9}
        >

        {profileData.banner ? (
          <>
            <Image source={{ uri: profileData.banner }} style={styles.banner} resizeMode="cover" />
          </>
        ) : (
          <>
            <View style={[styles.banner, { backgroundColor: h.accentMuted }]} />
          </>
        )}
        <LinearGradient
          colors={['transparent', h.containerBg]}
          locations={[0.3, 1]}
          style={styles.bannerFadeGradient}
        />
        
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
          <View style={[styles.avatarWrapper, {
            borderRadius: 74,
            shadowColor: theme.shadowColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: theme.avatarGlowOpacity,
            shadowRadius: theme.avatarGlowRadius,
          }]}>
            <TouchableOpacity onPress={() => setIsProfileModalVisible(true)}>
                <Image 
                  source={{ uri: profileData.avatar }} 
                  style={[styles.avatar, { borderColor: theme.avatarBorderColor }]} 
                />
                <View style={[styles.onlineIndicator, { borderColor: h.containerBg }]} />
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
          {favoriteGames.length > 0 ? (
            <View style={styles.nametagTopColumn}>
              <LinearGradient
                colors={theme.nametagGradient as [string, string, ...string[]]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.nametagTopCard}
              >
                {favoriteGames[0].imageUrl ? (
                  <Image source={{ uri: getImageUrl(favoriteGames[0].imageUrl) }} style={styles.nametagTopImg} resizeMode="contain" />
                ) : null}
                <Text style={[styles.nametagTopGameName, { color: theme.isLight ? '#1a1a1a' : '#FFFFFF' }]} numberOfLines={1}>
                  {favoriteGames[0].name.toUpperCase()}
                </Text>
              </LinearGradient>
              <Text style={styles.nametagLabel}>NAMETAG</Text>
            </View>
          ) : null}
        </View>

        {/* Profile Header */}
        <View style={styles.header}>
          <View style={styles.userInfoSection}>
            <View style={[styles.nameRow, { paddingTop: 12 }]}>
              <View style={styles.nameRowLeft}>
                {(() => {
                  const userFontId = (user as any)?.profileFont;
                  const userEffectId = (user as any)?.profileFontEffect;
                  const userFontColor = (user as any)?.profileFontColor;
                  const hasUserFont = userFontId && userFontId !== 'default';
                  const hasUserEffect = userEffectId && userEffectId !== 'none';
                  const resolvedFontId = hasUserFont ? userFontId : (h.displayNameFontId || 'default');
                  const resolvedEffectId = hasUserEffect ? userEffectId : (h.displayNameEffectId || 'none');
                  const hasAnyOverride = hasUserFont || hasUserEffect || h.displayNameFontId || h.displayNameEffectId;
                  return (
                    <StyledUsername 
                      username={h.displayNameUppercase ? profileData.name.toUpperCase() : profileData.name}
                      textStyleConfig={hasAnyOverride ? {
                        fontId: resolvedFontId,
                        effectId: resolvedEffectId,
                        customColor: userFontColor || h.namePrimary,
                      } : undefined}
                      textStyleId={!hasAnyOverride ? ((user as any)?.textStyleId || 'default') : undefined}
                      fontSize={h.isLight ? 22 : 26}
                      style={{ color: h.namePrimary }}
                    />
                  );
                })()}
                {profileData.verified && (
                  <View style={[styles.verifiedBadge, { backgroundColor: h.verifiedBg, borderWidth: 1, borderColor: h.verifiedBorder }]}>
                    <Check size={10} color={h.isLight ? '#ff2056' : '#FFF'} strokeWidth={4} />
                  </View>
                )}
              </View>
            </View>
            <Text style={[styles.handle, { color: h.handleColor }]}>{profileData.handle}</Text>
            <UserTypeBadge 
              userType={user?.userType} 
              showUserType={user?.showUserType !== false} 
            />
            {profileData.bio ? (
              <Text style={[styles.bio, { color: h.bioColor, marginTop: 16 }]}>{profileData.bio}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.infoSection}>
          {/* Floating Collection button — overlaps card top border */}
          <TouchableOpacity
            style={[styles.collectionButton, {
              position: 'absolute',
              top: -17,
              right: 0,
              zIndex: 10,
              borderColor: theme.accent,
              borderWidth: 1.5,
              overflow: 'hidden',
            }]}
            onPress={() => setActiveTab(activeTab === 'Collection' ? 'Clips' : 'Collection')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={theme.collectionGradient as [string, string, ...string[]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.collectionButtonGradient}
            >
              <FolderHeart size={14} color='#0f172b' />
              <Text style={[styles.collectionButtonText, { color: '#0f172b', fontFamily: displayFont?.fontFamily }]}>
                Collection
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <View
            style={[
              styles.infoBorderContainer,
              {
                backgroundColor: h.cardBg,
                borderRadius: h.cardBorderRadius,
                borderWidth: 1,
                borderColor: h.cardBorder,
                shadowColor: theme.shadowColor,
                shadowOffset: { width: 0, height: 0 },
              },
            ]}
          >
            {profileSectionTab === 'stats' ? (
              <View style={[styles.infoBorderInner, { paddingTop: 14, paddingBottom: 22 }]}>
                <View style={[
                  styles.statsRowCompact,
                  { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 },
                  h.statAlign === 'flex-start' && { justifyContent: 'flex-start', gap: 24 },
                ]}>
                  {([
                    { value: profileData.stats.uploads, label: h.statLabels[0] },
                    { value: profileData.stats.followers, label: h.statLabels[1] },
                    { value: profileData.stats.following, label: h.statLabels[2] },
                  ] as { value: number; label: string }[]).map((stat, i) => (
                    <View key={i} style={[styles.statColumn, h.statAlign === 'flex-start' && { alignItems: 'flex-start' }]}>
                      <Text style={[styles.statNumber, { color: h.statNumberColor, fontSize: h.statNumberSize }]}>{stat.value}</Text>
                      {h.statLabelPill ? (
                        <View style={[styles.statLabelPill, { borderColor: h.accent, backgroundColor: h.accentMuted }]}>
                          <Text style={[styles.statLabelPillText, { color: h.accent }]}>{stat.label.toUpperCase()}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.statLabel, { color: h.statLabelColor }]}>{stat.label.toUpperCase()}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.nftCollectionContainer}>
                {nftsLoading ? (
                  <Text style={styles.nftLoadingText}>Loading collection...</Text>
                ) : ownedNfts.length === 0 ? (
                  <View style={styles.nftEmptyState}>
                    <Text style={[styles.nftEmptyTitle, { color: h.statNumberColor }]}>No NFTs yet</Text>
                    <Text style={[styles.nftEmptySubtitle, { color: h.statLabelColor }]}>Mint your first Gamefolio NFT to start your collection</Text>
                  </View>
                ) : (
                  <View style={styles.nftGrid}>
                    {ownedNfts.map((nft: any) => (
                      <View key={nft.tokenId} style={[styles.nftCard, { backgroundColor: h.cardBg, borderColor: h.cardBorder }]}>
                        {nft.image ? (
                          <Image source={{ uri: nft.image }} style={styles.nftImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.nftImagePlaceholder, { backgroundColor: theme.accentMuted }]} />
                        )}
                        <Text style={[styles.nftName, { color: h.statNumberColor }]} numberOfLines={1}>{nft.name || `#${nft.tokenId}`}</Text>
                        <Text style={[styles.nftTokenId, { color: h.statLabelColor }]}>#{nft.tokenId}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {profileSectionTab === 'stats' && profileData.platforms.length > 0 ? (
          <View style={[styles.platformsRow, { marginTop: 12, paddingHorizontal: 4 }]}>
            {profileData.platforms.map((platform, index) => {
              const isOutlined = h.platformTagStyle === 'outlined';
              const tagBg = isOutlined ? 'transparent' : platform.color;
              const tagBorder = isOutlined ? (h.platformTagBorderColor || h.accent) : 'transparent';
              const tagTextColor = isOutlined ? (h.platformTagBorderColor || h.accent) : '#FFF';
              const iconColor = isOutlined ? (h.platformTagBorderColor || h.accent) : '#FFF';
              return (
                <View key={index} style={[
                  styles.platformTag,
                  {
                    backgroundColor: tagBg,
                    borderColor: tagBorder,
                    borderWidth: isOutlined ? 1.5 : 0,
                  }
                ]}>
                  {platform.type === 'xbox' && <Gamepad2 size={12} color={iconColor} />}
                  {platform.type === 'ps' && <Gamepad2 size={12} color={iconColor} />}
                  {platform.type === 'pc' && <Monitor size={12} color={iconColor} />}
                  <Text style={[styles.platformText, { color: tagTextColor }]}>{platform.name}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Tabs */}
        {theme.displayNameFontId === 'impact' ? (
          <View style={[styles.tabsContainer, { borderBottomColor: h.dividerColor, backgroundColor: theme.bg, paddingHorizontal: 16, paddingVertical: 4 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {/* CLIPS tab */}
              <TouchableOpacity style={styles.zombieTab} onPress={() => setActiveTab('Clips')} activeOpacity={0.8}>
                {activeTab === 'Clips' ? (
                  <View style={[styles.zombieTabPill, { backgroundColor: theme.accent }]}>
                    <Text style={styles.zombieTabPillLabel}>CLIPS</Text>
                    <Text style={styles.zombieTabPillCount}>{clips.length}/15</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.zombieTabLabel, { color: theme.muted }]}>CLIPS</Text>
                    <Text style={[styles.zombieTabCount, { color: theme.muted }]}>{clips.length}/15</Text>
                  </>
                )}
              </TouchableOpacity>
              {/* REELS tab */}
              <TouchableOpacity style={styles.zombieTab} onPress={() => setActiveTab('Reels')} activeOpacity={0.8}>
                {activeTab === 'Reels' ? (
                  <View style={[styles.zombieTabPill, { backgroundColor: theme.accent }]}>
                    <Text style={styles.zombieTabPillLabel}>REELS</Text>
                    <Text style={styles.zombieTabPillCount}>{reels.length}/15</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.zombieTabLabel, { color: theme.muted }]}>REELS</Text>
                    <Text style={[styles.zombieTabCount, { color: theme.muted }]}>{reels.length}/15</Text>
                  </>
                )}
              </TouchableOpacity>
              {/* GAMES tab */}
              <TouchableOpacity style={styles.zombieTab} onPress={() => setActiveTab('Favorites')} activeOpacity={0.8}>
                {activeTab === 'Favorites' ? (
                  <View style={[styles.zombieTabPill, { backgroundColor: theme.accent }]}>
                    <Text style={styles.zombieTabPillLabel}>GAMES</Text>
                  </View>
                ) : (
                  <Text style={[styles.zombieTabLabel, { color: theme.muted }]}>GAMES</Text>
                )}
              </TouchableOpacity>
              {/* Screenshots indicator — camera icon + count */}
              <TouchableOpacity style={[styles.zombieTab, styles.zombieScreenshotsBtn]} onPress={() => setActiveTab('Screenshots')} activeOpacity={0.8}>
                <Camera size={18} color={activeTab === 'Screenshots' ? theme.accent : theme.muted} />
                <Text style={[styles.zombieTabCount, { color: activeTab === 'Screenshots' ? theme.accent : theme.muted, marginTop: 2 }]}>{screenshots.length}/10</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : activeTab === 'Collection' ? (
          <View style={[styles.tabsContainer, { borderBottomColor: h.dividerColor, backgroundColor: h.tabBg, paddingHorizontal: 16, paddingVertical: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Hexagon size={16} color={theme.accent} />
              <Text style={[styles.tabText, { color: h.tabActiveText, marginLeft: 8, fontWeight: '600' }]}>NFT Collection ({ownedNfts.length})</Text>
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabsContainer, { borderBottomColor: h.dividerColor, backgroundColor: h.tabBg }]} contentContainerStyle={[styles.tabsContent, { paddingHorizontal: 16 }]}>
            {TABS.filter((tab) => tab !== 'Collection').map((tab) => {
              const countMap: Record<string, number> = {
                Clips: clips.length,
                Reels: reels.length,
                Screenshots: screenshots.length,
                Favorites: favoriteGames.length,
              };
              const count = countMap[tab];
              const label = `${tab} · ${count}`;
              const isActive = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.tab,
                    isActive && { borderBottomColor: h.tabActiveBorder },
                    isActive && { backgroundColor: theme.tabActiveBg, borderRadius: 8, paddingHorizontal: 12 },
                  ]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, { color: h.statLabelColor }, isActive && { color: h.tabActiveText }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

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

        {activeTab === 'Collection' && (
          <View style={styles.collectionContent}>
            {nftsLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>Loading NFTs...</Text>
              </View>
            ) : ownedNfts.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <View style={styles.emptyState}>
                  <Hexagon size={48} color="#4ADE80" strokeWidth={1.5} />
                  <Text style={styles.emptyStateTitle}>No NFTs yet</Text>
                  <Text style={styles.emptyStateSubtitle}>Mint your first Gamefolio NFT to start your collection</Text>
                </View>
              </View>
            ) : (
              <View style={styles.nftGrid}>
                {ownedNfts.map((nft) => (
                  <TouchableOpacity 
                    key={nft.tokenId || nft.id}
                    style={styles.nftCard}
                    activeOpacity={0.8}
                    onPress={() => router.push('/collections')}
                  >
                    <Image
                      source={{ uri: resolveNftImageUrl(nft.image || nft.imageDataUrl) }}
                      style={styles.nftImage}
                    />
                    <View style={styles.nftRarityBadge}>
                      <Text style={styles.nftRarityText}>{nft.rarity || 'COMMON'}</Text>
                    </View>
                    <Text style={styles.nftLabel}>#{nft.tokenId}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
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
          stats: {
            uploads: profileData.stats.uploads,
            followers: profileData.stats.followers,
            following: profileData.stats.following,
          },
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
    backgroundColor: '#131F2A',
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
  bannerFadeGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 120,
  },
  content: {
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
  onlineIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#131F2A',
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
  infoBorderContainer: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  topBorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    zIndex: 10,
  },
  topBorderFadeLeft: {
    height: 2,
    flex: 1,
    marginTop: 13,
  },
  topBorderFadeRight: {
    height: 2,
    flex: 0.3,
    marginTop: 13,
  },
  collectionButton: {
    borderRadius: 100,
  },
  collectionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
  },
  collectionButtonText: {
    color: '#0f172b',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  zombieTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  zombieTabPill: {
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: 'center',
  },
  zombieTabPillLabel: {
    color: '#0f172b',
    fontFamily: 'Impact',
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  zombieTabPillCount: {
    color: '#0f172b',
    fontFamily: 'Impact',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  zombieTabLabel: {
    fontSize: 12,
    fontFamily: 'Impact',
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  zombieTabCount: {
    fontSize: 12,
    fontFamily: 'Impact',
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  zombieScreenshotsBtn: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  nftCollectionContainer: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 16,
  },
  nftLoadingText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  nftEmptyState: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  nftEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  nftEmptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  nftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nftCard: {
    width: (width - 48) / 2,
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  nftImage: {
    width: '100%',
    aspectRatio: 1,
  },
  nftImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    opacity: 0.4,
  },
  nftName: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  nftTokenId: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingBottom: 6,
    opacity: 0.7,
  },
  leftBorderFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 2,
  },
  infoBorderInner: {
    padding: 16,
    paddingTop: 36,
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
    marginTop: 10,
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
    gap: 32,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  statColumn: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  statNumber: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  statLabelPill: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  statLabelPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
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
    color: '#A855F7',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'left',
  },
  bio: {
    color: '#E2E8F0',
    fontSize: 14,
    textAlign: 'left',
  },
  platformsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  platformTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 6,
  },
  platformText: {
    color: '#FFF',
    fontSize: 13,
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
  nametagTopColumn: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    paddingTop: 10,
  },
  nametagLabel: {
    color: '#6b7a8a',
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.2,
    marginTop: 4,
  },
  nametagImage: {
    width: 130,
    height: 50,
  },
  nametagTopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    width: 130,
    overflow: 'hidden',
  },
  nametagTopImg: {
    width: 28,
    height: 28,
  },
  nametagTopGameName: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  collectionContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  nftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nftCard: {
    width: '48%',
    aspectRatio: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  nftImage: {
    width: '100%',
    height: '100%',
  },
  nftRarityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nftRarityText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '700',
  },
  nftLabel: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
