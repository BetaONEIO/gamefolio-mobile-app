import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ActivityIndicator, ScrollView, ImageBackground } from 'react-native';
import { useMemo } from 'react';
import Svg, { Path, Ellipse } from 'react-native-svg';
import { Share2, Check, Heart, Flame, Monitor, Gamepad2, MessageSquare, Eye, Play, Camera, FolderHeart } from 'lucide-react-native';
import { truncateTitle } from '@/constants/formatters';
import { getClipThumbnail, getReelThumbnail, getScreenshotThumbnail } from '@/utils/thumbnails';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import ProfilePictureModal from '@/components/ProfilePictureModal';
import ProfileBannerModal from '@/components/ProfileBannerModal';
import ScreenshotViewerModal from '@/components/ScreenshotViewerModal';
import LevelBadge from '@/components/LevelBadge';
import { Clip, Screenshot, getEffectiveAvatarUrl, api } from '@/lib/api';
import ReportModal from '@/components/ReportModal';
import ShareProfileModal from '@/components/ShareProfileModal';
import { useQuery, useMutation } from '@tanstack/react-query';
import BirthdayBanner, { isBirthdayToday } from '@/components/BirthdayBanner';
import UserTypeBadge from '@/components/UserTypeBadge';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProfileTheme, ProfileThemeTokens } from '@/constants/themes';
import { ThemeBackgroundEffect } from '@/components/ThemeBackgroundEffect';
import StyledUsername from '@/components/StyledUsername';
import AppHeader from '@/components/AppHeader';
import StreamEmbed from '@/components/StreamEmbed';
import XboxAchievements from '@/components/XboxAchievements';
import PsnTrophies from '@/components/PsnTrophies';

const { width, height: windowHeight } = Dimensions.get('window');

const TABS = ['Clips', 'Reels', 'Screenshots', 'Favorites'];

function ZombieDrip({ cardWidth, color = '#9ae600' }: { cardWidth: number; color?: string }) {
  const drips = [
    { x: 32, h: 22, r: 5.5 },
    { x: 72, h: 14, r: 4 },
    { x: 118, h: 28, r: 6.5 },
    { x: 162, h: 17, r: 4.5 },
    { x: 210, h: 24, r: 5 },
    { x: 256, h: 13, r: 3.5 },
    { x: 300, h: 20, r: 5.5 },
  ].filter(d => d.x + d.r < cardWidth - 4);

  const svgH = 36;
  return (
    <Svg
      width={cardWidth}
      height={svgH}
      style={{ position: 'absolute', bottom: -svgH + 2, left: 0 }}
    >
      {drips.map((d, i) => {
        const colH = Math.max(0, d.h - d.r);
        return (
          <Path
            key={i}
            d={`M ${d.x - d.r} 0 L ${d.x - d.r} ${colH} Q ${d.x - d.r} ${d.h} ${d.x} ${d.h} Q ${d.x + d.r} ${d.h} ${d.x + d.r} ${colH} L ${d.x + d.r} 0 Z`}
            fill={color}
            opacity={0.9}
          />
        );
      })}
    </Svg>
  );
}

function createStyles(theme: ProfileThemeTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scrollView: {
      flex: 1,
      backgroundColor: 'transparent',
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

    content: {
      paddingHorizontal: 16,
      marginTop: -90,
    },
    header: {
      marginBottom: 12,
      marginTop: 0,
    },
    userInfoSection: {
      alignItems: 'flex-start',
      width: '100%',
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
    displayName: {
      color: theme.textPrimary,
      fontSize: theme.displayNameSize,
      fontWeight: '900',
      letterSpacing: -0.8,
      textTransform: theme.displayNameUppercase ? 'uppercase' : 'none',
    },
    verifiedBadge: {
      backgroundColor: '#3B82F6',
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
    },
    handle: {
      fontSize: 15,
      color: theme.textHandle,
      marginBottom: 4,
      textAlign: 'left',
    },
    badgesRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    streamerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.tabActiveBg,
      borderWidth: 0.5,
      borderColor: theme.tabActiveBorder,
      borderRadius: 100,
      paddingVertical: 4,
      paddingHorizontal: 12,
    },
    onlineBadge: {
      backgroundColor: '#22c55e1a',
      borderColor: '#22c55e66',
    },
    streamerText: {
      color: theme.tabActiveText,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    onlineDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#22c55e',
    },

    nametagSection: {
      marginBottom: 4,
    },
    nametagLabel: {
      color: theme.muted,
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    nametagCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: theme.isLight ? 'rgba(255,255,255,0.5)' : '#ff69004d',
      paddingVertical: 8,
      paddingHorizontal: 10,
      alignSelf: 'flex-start',
      shadowColor: theme.isLight ? theme.shadowColor : '#ff6900',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 2,
      overflow: 'hidden',
    },
    nametagGameImg: {
      width: 24,
      height: 24,
      borderRadius: 4,
    },
    nametagGameName: {
      color: theme.isLight ? '#fff' : '#ff8904',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: -0.4,
      textTransform: 'uppercase',
      maxWidth: 120,
    },

    infoSection: {
      position: 'relative',
      marginTop: 8,
      alignItems: 'flex-start',
    },
    infoBorderContainer: {
      width: '100%',
      borderRadius: 16,
      backgroundColor: 'transparent',
      position: 'relative',
    },
    infoBorderInner: {
      padding: 16,
      paddingTop: 36,
    },
    collectionButtonFloat: {
      position: 'absolute',
      top: -17,
      right: 0,
      zIndex: 10,
      borderWidth: 1.5,
      borderRadius: 100,
      overflow: 'hidden',
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
    collectionEmptyState: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 8,
    },
    collectionEmptyText: {
      fontSize: 13,
      fontWeight: '600',
    },
    statsGradientBar: {
      height: 3,
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
      color: theme.statNumberColor,
      fontSize: theme.statNumberFontSize,
      fontWeight: '900',
      letterSpacing: -0.5,
      marginBottom: 2,
    },
    statLabel: {
      color: theme.muted,
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
      color: theme.accent,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
    },
    statsCardBioSection: {
      borderTopWidth: 0.5,
      borderTopColor: theme.dividerColor,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      gap: 6,
    },
    statsCardCollectionBtn: {
      borderRadius: 100,
      paddingVertical: 5,
      paddingHorizontal: 14,
      alignSelf: 'flex-start',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    statsCardCollectionText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },
    followingBar: {
      borderTopWidth: 0.5,
      borderTopColor: theme.followingBarBorder,
      paddingVertical: 6,
      alignItems: 'center',
    },
    followingLabel: {
      color: theme.followingLabelColor,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },

    profileInfoSection: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    bio: {
      color: theme.bioTextColor || '#E2E8F0',
      fontSize: 14,
      textAlign: 'left',
      lineHeight: 20,
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
      fontSize: 13,
      fontWeight: '600',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bannerActionsOverlay: {
      position: 'absolute',
      top: 192,
      right: 16,
      alignItems: 'flex-end',
      gap: 8,
      zIndex: 10,
    },
    followBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFFFFF',
      height: 44,
      borderRadius: 100,
      gap: 6,
      paddingHorizontal: 20,
    },
    followingBtn: {
      backgroundColor: 'rgba(255,255,255,0.15)',
    },
    followBtnText: {
      color: '#0F172A',
      fontSize: 15,
      fontWeight: '700',
    },
    followBtnTextActive: {
      color: '#FFF',
      fontSize: 14,
      fontWeight: '700',
    },
    iconActionBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      borderWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    blockBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: 'rgba(249,115,22,0.1)',
      borderWidth: 0.5,
      borderColor: 'rgba(249,115,22,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    blockBtnActive: {
      backgroundColor: '#F97316',
      borderColor: '#F97316',
    },
    reportBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: 'rgba(239,68,68,0.1)',
      borderWidth: 0.5,
      borderColor: 'rgba(239,68,68,0.3)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    bannerSection: {
      position: 'relative',
    },
    bannerContainer: {
      height: 180,
      width: '100%',
      overflow: 'hidden',
    },
    bannerImage: {
      width: '100%',
      height: '100%',
    },
    bannerBottomFade: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 100,
    },
    topRowWithActions: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
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
    rightColumn: {
      flex: 1,
      marginLeft: 12,
    },
    onlineIndicator: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.bg,
      borderWidth: 3,
      borderColor: theme.bg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    onlineDotLg: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#22c55e',
    },
    onlineTooltip: {
      position: 'absolute',
      bottom: 24,
      left: '50%',
      transform: [{ translateX: -60 }],
      backgroundColor: 'rgba(0,0,0,0.9)',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      zIndex: 1000,
      minWidth: 120,
    },
    onlineTooltipText: {
      color: '#22c55e',
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
    },

    tabsContainer: {
      marginBottom: 16,
      backgroundColor: '#131F2A',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 20,
    },
    tabsContent: {
      paddingBottom: 0,
      alignItems: 'center',
      gap: 12,
    },
    tab: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      marginRight: 0,
      borderRadius: 20,
      backgroundColor: 'transparent',
    },
    tabActive: {
      backgroundColor: '#4ADE80',
    },
    tabText: {
      color: '#94A3B8',
      fontSize: 14,
      fontWeight: '600',
    },
    tabTextActive: {
      color: '#002E15',
    },
    tabsCameraContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginLeft: 'auto',
      paddingVertical: 8,
    },
    tabsCameraText: {
      color: '#94A3B8',
      fontWeight: '600',
      fontSize: 14,
    },
    menuTab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 6,
    },
    menuTabPill: {
      borderRadius: 100,
      paddingHorizontal: 18,
      paddingVertical: 11,
      alignItems: 'center',
    },
    menuTabPillLabel: {
      color: '#0f172b',
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    menuTabPillCount: {
      color: '#ff4646',
      fontSize: 11,
      fontWeight: '600',
      marginTop: 1,
    },
    menuTabLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    menuTabCount: {
      fontSize: 11,
      fontWeight: '500',
      marginTop: 1,
    },

    nametagTopColumn: {
      alignItems: 'flex-end',
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
      color: theme.isLight ? '#1a1a1a' : '#FFFFFF',
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.5,
      flex: 1,
    },
    nametagTopLabel: {
      color: '#6b7a8a',
      fontSize: 9,
      fontWeight: '500',
      letterSpacing: 1.2,
      marginTop: 3,
    },

    tabContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
    },
    grid: {
      gap: 12,
      paddingBottom: 20,
    },
    reelsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      paddingBottom: 20,
    },
    clipCard: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: '#1E293B',
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
    clipBadges: {
      position: 'absolute',
      top: 8,
      right: 8,
      flexDirection: 'row',
      gap: 4,
    },
    metaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(0,0,0,0.8)',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
    },
    metaBadgeText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: 'bold',
    },
    clipInfo: {
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
      textShadowColor: 'rgba(0,0,0,0.5)',
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
      backgroundColor: '#22C55E',
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
    gameChip: {
      borderRadius: 6,
      paddingVertical: 3,
      paddingHorizontal: 8,
      alignSelf: 'flex-start',
    },
    gameChipText: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    reelCard: {
      width: (width - 32 - 12) / 2,
      aspectRatio: 9 / 16,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: '#1E293B',
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
      backgroundColor: '#22C55E',
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
    screenshotsList: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
      paddingBottom: 20,
      justifyContent: 'space-between' as const,
    },
    screenshotCard: {
      width: '48%',
      aspectRatio: 0.75,
      backgroundColor: '#1E293B',
      borderRadius: 16,
      overflow: 'hidden',
    },
    screenshotImage: {
      width: '100%',
      height: '100%',
      backgroundColor: '#2D3748',
      justifyContent: 'flex-end',
    },
    screenshotGridInfo: {
      padding: 6,
      gap: 2,
    },
    screenshotGridTitle: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: '600' as const,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    statVal: {
      color: '#94A3B8',
      fontSize: 13,
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
    emptyState: {
      paddingVertical: 48,
      alignItems: 'center',
      gap: 10,
    },
    emptyTitle: {
      color: theme.textHandle,
      fontSize: 15,
      fontWeight: '700',
    },
  });
}

export default function PublicProfileScreen() {
  const [activeTab, setActiveTab] = useState('Clips');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id, previewTheme } = useLocalSearchParams();
  const username = Array.isArray(id) ? id[0] : id;
  const themePreview = Array.isArray(previewTheme) ? previewTheme[0] : previewTheme;
  const { user: currentUser, getAccessToken } = useAuth();

  const isMe = currentUser && (currentUser.username === username);

  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ['/api/users', username, 'profile'],
    queryFn: async () => {
      if (!username) return null;
      const token = await getAccessToken();
      const result = await api.users.getProfile(username, token ?? undefined);
      return result?.user ?? null;
    },
    enabled: !!username,
  });

  const user = profileData;
  const userId = user?.id;

  const activeThemeId = themePreview ?? user?.profileTheme ?? null;
  const theme = getProfileTheme(activeThemeId);
  const styles = useMemo(() => createStyles(theme), [themePreview, user?.profileTheme]);
  const accentColor = theme.accent;

  const { data: clipsData } = useQuery({
    queryKey: ['/api/users', username, 'clips'],
    queryFn: async () => {
      if (!username) return [];
      const token = await getAccessToken();
      return api.users.getUserClips(username, token ?? undefined);
    },
    enabled: !!username,
  });
  const allClips = clipsData || [];
  const clips = allClips.filter((c: any) => c.videoType !== 'reel' && c.userId === userId);
  const reels = allClips.filter((c: any) => c.videoType === 'reel' && c.userId === userId);

  const { data: screenshotsData } = useQuery({
    queryKey: ['/api/users', userId, 'screenshots'],
    queryFn: async () => {
      if (!userId) return [];
      const token = await getAccessToken();
      return api.screenshots.getUserScreenshots(userId, token ?? undefined);
    },
    enabled: !!userId,
  });
  const screenshots = (screenshotsData || []).filter((s: any) => s.userId === userId);

  const { data: favoritesData } = useQuery({
    queryKey: ['/api/users', username, 'favorites'],
    queryFn: async () => {
      if (!username) return [];
      const token = await getAccessToken();
      return api.users.getFavorites(username, token ?? undefined);
    },
    enabled: !!username,
  });
  const favoriteGames = favoritesData || [];

  const isStreamer = !!(user?.userType?.split(',').map(t => t.trim()).includes('streamer'));
  const hasStreamSetup = !!(isStreamer && (user?.twitchUsername || user?.kickUsername));

  const { data: liveStatus } = useQuery({
    queryKey: ['/api/user', userId, 'live-status'],
    queryFn: async () => {
      if (!userId) return null;
      const token = await getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const base = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : '';
      const res = await fetch(`${base}/api/user/${userId}/live-status`, { headers });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!userId && hasStreamSetup,
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
  });

  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isBannerModalVisible, setIsBannerModalVisible] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(0);
  const [isScreenshotModalVisible, setIsScreenshotModalVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [onlineTooltipVisible, setOnlineTooltipVisible] = useState(false);
  const [statsCardWidth, setStatsCardWidth] = useState(0);
  const [profileSectionTab, setProfileSectionTab] = useState<'stats' | 'collection'>('stats');

  const submitReportMutation = useMutation({
    mutationFn: async (reportData: Record<string, unknown>) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.reports.submit(reportData as any, token);
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ block }: { block: boolean }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      if (block) return api.blocking.block(Number(userId), token);
      return api.blocking.unblock(Number(userId), token);
    },
    onMutate: ({ block }) => setIsBlocked(block),
    onError: (_err, { block }) => setIsBlocked(!block),
  });

  const handleToggleBlock = () => {
    blockMutation.mutate({ block: !isBlocked });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return url.replace('{width}', '600').replace('{height}', '800');
  };

  if (isProfileLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4ADE80" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', gap: 12 }]}>
        <Text style={{ color: '#94A3B8', fontSize: 18, fontWeight: '600' }}>User not found</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#4ADE80', fontSize: 15 }}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const avatarUrl = getEffectiveAvatarUrl(user) || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=400&auto=format&fit=crop';
  const bannerUrl = user.bannerUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop';
  const displayName = user.displayName || user.username;
  const handle = `@${user.username}`;
  const currentGame = favoriteGames[0] || null;

  const buildPlatforms = () => {
    const p: { name: string; type: string; color: string }[] = [];
    if (user.xboxUsername) p.push({ name: user.xboxUsername, type: 'xbox', color: '#107C10' });
    if (user.playstationUsername) p.push({ name: user.playstationUsername, type: 'ps', color: '#00439C' });
    if (user.steamUsername) p.push({ name: user.steamUsername, type: 'pc', color: '#00A4EF' });
    if (user.nintendoUsername) p.push({ name: user.nintendoUsername, type: 'nintendo', color: '#E60012' });
    if (user.epicUsername) p.push({ name: user.epicUsername, type: 'epic', color: '#2F2D2E' });
    return p;
  };
  const platforms = buildPlatforms();

  const [statUploads, statFollowers, statFollowing] = theme.statLabels;

  return (
    <View style={styles.container}>
      <AppHeader showBackButton={true} />
      {activeThemeId ? (
        <View style={[StyleSheet.absoluteFill, { opacity: 0.45 }]} pointerEvents="none">
          <ThemeBackgroundEffect themeId={activeThemeId} />
        </View>
      ) : null}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {isBirthdayToday(user?.birthday) && (
          <BirthdayBanner
            displayName={displayName}
            isOwnProfile={isMe || false}
          />
        )}
        {/* Banner */}
        <View style={styles.bannerSection}>
          <View style={styles.bannerContainer}>
            <Image source={{ uri: bannerUrl }} style={styles.bannerImage} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', theme.bg]}
              locations={[0.3, 1]}
              style={styles.bannerBottomFade}
            />
            <TouchableOpacity
              style={styles.bannerShareButton}
              onPress={() => setIsShareModalVisible(true)}
              activeOpacity={0.8}
            >
              <Share2 size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
          {!isMe && (
            <View style={styles.bannerActionsOverlay}>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.iconActionBtn}
                  onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: userId?.toString() || 'unknown', username } })}
                >
                  <MessageSquare size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.followBtn, isFollowing && styles.followingBtn]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIsFollowing(f => !f);
                  }}
                >
                  {isFollowing ? (
                    <Text style={styles.followBtnTextActive}>Following</Text>
                  ) : (
                    <Text style={styles.followBtnText}>Follow</Text>
                  )}
                </TouchableOpacity>
              </View>
              {currentGame ? (
                <View style={styles.nametagTopColumn}>
                  {activeThemeId === 'cyberpunk' ? (
                    <View style={styles.nametagTopCard}>
                      {currentGame.imageUrl ? (
                        <Image source={{ uri: getImageUrl(currentGame.imageUrl) }} style={styles.nametagTopImg} resizeMode="contain" />
                      ) : null}
                      <Text style={styles.nametagTopGameName} numberOfLines={1}>{currentGame.name.toUpperCase()}</Text>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={theme.nametagGradient}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.nametagTopCard}
                    >
                      {currentGame.imageUrl ? (
                        <Image source={{ uri: getImageUrl(currentGame.imageUrl) }} style={styles.nametagTopImg} resizeMode="contain" />
                      ) : null}
                      <Text style={styles.nametagTopGameName} numberOfLines={1}>{currentGame.name.toUpperCase()}</Text>
                    </LinearGradient>
                  )}
                  <Text style={styles.nametagTopLabel}>NAMETAG</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.content}>
        {/* Profile Top Row: large avatar + action buttons */}
        <View style={styles.topRowWithActions}>
          <View style={[styles.avatarWrapper, {
            borderRadius: 74,
            shadowColor: theme.shadowColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: theme.avatarGlowOpacity,
            shadowRadius: theme.avatarGlowRadius,
          }]}>
            <TouchableOpacity onPress={() => setIsProfileModalVisible(true)}>
              <Image source={{ uri: avatarUrl }} style={[styles.avatar, { borderColor: theme.avatarBorderColor }]} />
              {user.isOnline && !isMe && (
                <TouchableOpacity
                  style={[styles.onlineIndicator, { borderColor: theme.bg }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setOnlineTooltipVisible(true);
                    setTimeout(() => setOnlineTooltipVisible(false), 2000);
                  }}
                >
                  <View style={styles.onlineDotLg} />
                  {onlineTooltipVisible && (
                    <View style={styles.onlineTooltip}>
                      <Text style={styles.onlineTooltipText}>{handle} is online</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            <View style={styles.badgesContainer}>
              <View style={styles.levelBadgeContainer}>
                <LevelBadge level={user.level || 1} currentXP={user.totalXP} size={32} thickness={3} />
              </View>
            </View>
          </View>
        </View>

        {/* User Name / Handle / Badge */}
        <View style={styles.header}>
          <View style={styles.userInfoSection}>
          <View style={[styles.nameRow, { paddingTop: 12 }]}>
            <View style={styles.nameRowLeft}>
            {(() => {
              const userFontId = user?.profileFont;
              const userEffectId = user?.profileFontEffect;
              const userFontColor = user?.profileFontColor;
              const hasUserFont = userFontId && userFontId !== 'default';
              const hasUserEffect = userEffectId && userEffectId !== 'none';
              const resolvedFontId = hasUserFont ? userFontId : (theme.displayNameFontId || 'default');
              const resolvedEffectId = hasUserEffect ? userEffectId : (theme.displayNameEffectId || 'none');
              const hasAnyOverride = hasUserFont || hasUserEffect || theme.displayNameFontId || theme.displayNameEffectId;
              return (
                <StyledUsername
                  username={theme.displayNameUppercase ? displayName.toUpperCase() : displayName}
                  textStyleConfig={hasAnyOverride ? {
                    fontId: resolvedFontId,
                    effectId: resolvedEffectId,
                    customColor: userFontColor || theme.textPrimary,
                  } : undefined}
                  textStyleId={!hasAnyOverride ? ((user as any)?.textStyleId || 'default') : undefined}
                  fontSize={theme.displayNameSize}
                  style={{ color: theme.textPrimary }}
                />
              );
            })()}
            {user.emailVerified && (
              <View style={[styles.verifiedBadge, { backgroundColor: theme.verifiedBg, borderWidth: 1, borderColor: theme.verifiedBorderColor }]}>
                <Check size={10} color={theme.isLight ? '#ff2056' : '#FFF'} strokeWidth={4} />
              </View>
            )}
            </View>
          </View>
          <Text style={[styles.handle, { color: theme.textHandle }]}>{handle}</Text>
          <UserTypeBadge userType={user.userType} showUserType={user.showUserType !== false} />
          {user.bio ? (
            <Text style={[styles.bio, { marginTop: 16 }]}>{user.bio}</Text>
          ) : null}

          </View>
        </View>

        {/* Stats card with floating Collection button */}
        <View style={styles.infoSection}>
          <TouchableOpacity
            style={[styles.collectionButtonFloat, { borderColor: theme.accent }]}
            onPress={() => setProfileSectionTab(profileSectionTab === 'collection' ? 'stats' : 'collection')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={theme.collectionGradient as [string, string, ...string[]]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.collectionButtonGradient}
            >
              <FolderHeart size={14} color='#0f172b' />
              <Text style={styles.collectionButtonText}>
                Collection
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <View
            style={[
              styles.infoBorderContainer,
              {
                backgroundColor: theme.cardBg,
                borderRadius: activeThemeId === 'neo' ? 8 : theme.cardBorderRadius,
                borderWidth: activeThemeId === 'cyberpunk' ? 2 : (activeThemeId === 'neo' ? 1 : 1),
                borderColor: activeThemeId === 'cyberpunk' ? '#00D9FF' : (activeThemeId === 'neo' ? '#00FF00' : theme.cardBorder),
                overflow: theme.hasDripEffect ? 'visible' : 'hidden',
                marginBottom: theme.hasDripEffect ? 28 : 4,
                shadowColor: activeThemeId === 'cyberpunk' ? '#00D9FF' : theme.shadowColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: activeThemeId === 'cyberpunk' ? 0.6 : 0.55,
                shadowRadius: activeThemeId === 'cyberpunk' ? 12 : 16,
                elevation: 10,
              }
            ]}
            onLayout={e => setStatsCardWidth(e.nativeEvent.layout.width)}
          >
            {profileSectionTab === 'stats' ? (
              <View style={[styles.infoBorderInner, { paddingTop: 14, paddingBottom: 22 }]}>
                <View style={[
                  styles.statsRowCompact,
                  { borderBottomWidth: 0, paddingBottom: 0, marginBottom: 0 },
                  theme.statAlign === 'flex-start' ? { justifyContent: 'flex-start', gap: 24 } : undefined,
                ]}>
                  {([
                    { value: clips.length + reels.length + screenshots.length, label: statUploads },
                    { value: user._count?.followers || 0, label: statFollowers },
                    { value: user._count?.following || 0, label: statFollowing },
                  ] as { value: number; label: string }[]).map((stat, i) => (
                    <View key={i} style={[styles.statColumn, theme.statAlign === 'flex-start' ? { alignItems: 'flex-start' } : undefined]}>
                      <Text style={[styles.statNumber, { color: activeThemeId === 'cyberpunk' ? '#00D9FF' : (activeThemeId === 'neo' ? '#00FF00' : theme.statNumberColor), fontSize: theme.statNumberFontSize }, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 20 }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 20 }]}>{stat.value}</Text>
                      {theme.statLabelPill ? (
                        <View style={[styles.statLabelPill, { borderColor: theme.accent, backgroundColor: theme.accentMuted }]}>
                          <Text style={[styles.statLabelPillText, { color: activeThemeId === 'cyberpunk' ? '#D600FF' : (activeThemeId === 'neo' ? '#00FF00' : theme.accent) }, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 8 }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 8.5 }]}>{stat.label.toUpperCase()}</Text>
                        </View>
                      ) : (
                        <Text style={[styles.statLabel, { color: activeThemeId === 'cyberpunk' ? '#D600FF' : (activeThemeId === 'neo' ? '#00FF00' : theme.muted) }, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 8 }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 8.5 }]}>{stat.label.toUpperCase()}</Text>
                      )}
                    </View>
                  ))}
                </View>
                {theme.hasDripEffect && statsCardWidth > 0 && (
                  <ZombieDrip cardWidth={statsCardWidth} color={theme.accent} />
                )}
                {isFollowing && (
                  <View style={styles.followingBar}>
                    <Text style={styles.followingLabel}>FOLLOWING</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.collectionEmptyState}>
                <FolderHeart size={32} color={theme.muted} strokeWidth={1.5} />
                <Text style={[styles.collectionEmptyText, { color: theme.muted }]}>No collection yet</Text>
              </View>
            )}
          </View>
        </View>
        </View>

        {/* Profile Info — platform chips */}
        {platforms.length > 0 ? (
          <View style={[styles.platformsRow, { marginTop: 12, paddingHorizontal: 4 }]}>
            {platforms.map((p, i) => {
              const isOutlined = theme.platformTagStyle === 'outlined';
              const tagBg = isOutlined ? 'transparent' : p.color;
              const tagBorder = isOutlined ? (theme.platformTagBorderColor || theme.accent) : 'transparent';
              const iconColor = isOutlined ? (theme.platformTagBorderColor || theme.accent) : '#FFF';
              const tagTextColor = isOutlined ? (theme.platformTagBorderColor || theme.accent) : '#FFF';
              return (
                <View key={i} style={[styles.platformTag, { backgroundColor: activeThemeId === 'cyberpunk' ? 'transparent' : (activeThemeId === 'neo' ? 'transparent' : tagBg), borderColor: activeThemeId === 'cyberpunk' ? '#00D9FF' : (activeThemeId === 'neo' ? '#00FF00' : tagBorder), borderWidth: activeThemeId === 'cyberpunk' ? 1.5 : (activeThemeId === 'neo' ? 1.5 : (isOutlined ? 1.5 : 0)), borderRadius: activeThemeId === 'neo' ? 0 : 16 }]}>
                  {p.type === 'xbox' && <Gamepad2 size={12} color={activeThemeId === 'cyberpunk' ? '#00D9FF' : (activeThemeId === 'neo' ? '#00FF00' : iconColor)} />}
                  {p.type === 'ps' && <Gamepad2 size={12} color={activeThemeId === 'cyberpunk' ? '#00D9FF' : (activeThemeId === 'neo' ? '#00FF00' : iconColor)} />}
                  {p.type === 'pc' && <Monitor size={12} color={activeThemeId === 'cyberpunk' ? '#00D9FF' : (activeThemeId === 'neo' ? '#00FF00' : iconColor)} />}
                  {p.type === 'nintendo' && <Gamepad2 size={12} color={activeThemeId === 'cyberpunk' ? '#00D9FF' : (activeThemeId === 'neo' ? '#00FF00' : iconColor)} />}
                  {p.type === 'epic' && <Gamepad2 size={12} color={activeThemeId === 'cyberpunk' ? '#00D9FF' : (activeThemeId === 'neo' ? '#00FF00' : iconColor)} />}
                  <Text style={[styles.platformText, { color: activeThemeId === 'cyberpunk' ? '#00D9FF' : (activeThemeId === 'neo' ? '#00FF00' : tagTextColor) }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 11.5 }]}>{p.name}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Stream Embed */}
        {hasStreamSetup ? (
          <View style={{ marginTop: 16, paddingHorizontal: 0 }}>
            <StreamEmbed
              twitchChannel={user?.twitchUsername}
              kickChannel={user?.kickUsername}
              activePlatform={liveStatus?.activePlatform}
              activeChannel={liveStatus?.activeChannel}
              isLive={liveStatus?.isLive ?? false}
              accentColor={accentColor}
            />
          </View>
        ) : null}

        {/* Xbox Achievements */}
        {user?.showXboxAchievements && (user.xboxAchievements?.length ?? 0) > 0 ? (
          <View style={{ marginTop: 16 }}>
            <XboxAchievements
              games={user.xboxAchievements ?? []}
              totalAchievements={user.xboxTotalAchievements ?? 0}
              gamerscore={user.xboxGamerscore ?? 0}
              lastSync={user.xboxAchievementsLastSync ?? undefined}
            />
          </View>
        ) : null}

        {/* PSN Trophies */}
        {user?.showPsnTrophies && (user.psnTrophyData?.length ?? 0) > 0 ? (
          <View style={{ marginTop: 16 }}>
            <PsnTrophies
              games={user.psnTrophyData ?? []}
              trophyLevel={user.psnTrophyLevel ?? 0}
              totalTrophies={user.psnTotalTrophies ?? 0}
              lastSync={user.psnTrophiesLastSync ?? undefined}
            />
          </View>
        ) : null}

        {/* Content Tabs */}
        {theme.displayNameFontId === 'impact' || theme.displayNameFontId === 'Orbitron' ? (
          <View style={[styles.tabsContainer, { backgroundColor: theme.bg, paddingHorizontal: 16, paddingVertical: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity style={styles.menuTab} onPress={() => setActiveTab('Clips')} activeOpacity={0.8}>
                {activeTab === 'Clips' ? (
                  <View style={[styles.menuTabPill, { backgroundColor: activeThemeId === 'neo' ? '#00FF00' : theme.accent, borderRadius: activeThemeId === 'neo' ? 0 : 100 }]}>
                    <Text style={[styles.menuTabPillLabel, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 9 }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 9, color: '#0f172b' }]}>CLIPS</Text>
                    <Text style={[styles.menuTabPillCount, activeThemeId === 'cyberpunk' && { color: '#D600FF', fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 8 }, activeThemeId === 'neo' && { color: '#0f172b', fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 8 }]}>{clips.length}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.menuTabLabel, { color: theme.muted }, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 11, color: '#00D9FF' }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 11, color: '#00FF00' }]}>CLIPS</Text>
                    <Text style={[styles.menuTabCount, { color: theme.muted }, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 9, color: '#D600FF' }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 9, color: '#00FF00' }]}>{clips.length}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuTab} onPress={() => setActiveTab('Reels')} activeOpacity={0.8}>
                {activeTab === 'Reels' ? (
                  <View style={[styles.menuTabPill, { backgroundColor: activeThemeId === 'neo' ? '#00FF00' : theme.accent, borderRadius: activeThemeId === 'neo' ? 0 : 100 }]}>
                    <Text style={[styles.menuTabPillLabel, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 9 }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 9, color: '#0f172b' }]}>REELS</Text>
                    <Text style={[styles.menuTabPillCount, activeThemeId === 'cyberpunk' && { color: '#D600FF', fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 8 }, activeThemeId === 'neo' && { color: '#0f172b', fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 8 }]}>{reels.length}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.menuTabLabel, { color: theme.muted }, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 11, color: '#00D9FF' }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 11, color: '#00FF00' }]}>REELS</Text>
                    <Text style={[styles.menuTabCount, { color: theme.muted }, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 9, color: '#D600FF' }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 9, color: '#00FF00' }]}>{reels.length}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuTab} onPress={() => setActiveTab('Favorites')} activeOpacity={0.8}>
                {activeTab === 'Favorites' ? (
                  <View style={[styles.menuTabPill, { backgroundColor: activeThemeId === 'neo' ? '#00FF00' : theme.accent, borderRadius: activeThemeId === 'neo' ? 0 : 100 }]}>
                    <Text style={[styles.menuTabPillLabel, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 9 }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 9, color: '#0f172b' }]}>GAMES</Text>
                  </View>
                ) : (
                  <Text style={[styles.menuTabLabel, { color: theme.muted }, activeThemeId === 'cyberpunk' && { fontFamily: 'Orbitron', letterSpacing: 2.5, fontWeight: '900', fontSize: 11, color: '#00D9FF' }, activeThemeId === 'neo' && { fontFamily: 'JetBrains Mono', letterSpacing: 1.5, fontWeight: '700', fontSize: 11, color: '#00FF00' }]}>GAMES</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuTab, styles.menuCameraTab]} onPress={() => setActiveTab('Screenshots')} activeOpacity={0.8}>
                <Camera size={20} color={activeTab === 'Screenshots' ? theme.accent : theme.muted} />
                <Text style={[styles.menuTabCount, { color: activeTab === 'Screenshots' ? theme.accent : theme.muted, marginTop: 2 }]}>{screenshots.length}/10</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.tabsContainer, { backgroundColor: '#131F2A', paddingHorizontal: 16, paddingVertical: 4, borderRadius: 20 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity style={styles.menuTab} onPress={() => setActiveTab('Clips')} activeOpacity={0.8}>
                {activeTab === 'Clips' ? (
                  <View style={[styles.menuTabPill, { backgroundColor: theme.accent }]}>
                    <Text style={styles.menuTabPillLabel}>Clips</Text>
                    <Text style={styles.menuTabPillCount}>{clips.length}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.menuTabLabel, { color: theme.muted }]}>Clips</Text>
                    <Text style={[styles.menuTabCount, { color: theme.muted }]}>{clips.length}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuTab} onPress={() => setActiveTab('Reels')} activeOpacity={0.8}>
                {activeTab === 'Reels' ? (
                  <View style={[styles.menuTabPill, { backgroundColor: theme.accent }]}>
                    <Text style={styles.menuTabPillLabel}>Reels</Text>
                    <Text style={styles.menuTabPillCount}>{reels.length}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.menuTabLabel, { color: theme.muted }]}>Reels</Text>
                    <Text style={[styles.menuTabCount, { color: theme.muted }]}>{reels.length}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuTab} onPress={() => setActiveTab('Favorites')} activeOpacity={0.8}>
                {activeTab === 'Favorites' ? (
                  <View style={[styles.menuTabPill, { backgroundColor: theme.accent }]}>
                    <Text style={styles.menuTabPillLabel}>Games</Text>
                  </View>
                ) : (
                  <Text style={[styles.menuTabLabel, { color: theme.muted }]}>Games</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuTab, { flex: 0, paddingHorizontal: 8 }]} onPress={() => setActiveTab('Screenshots')} activeOpacity={0.8}>
                <Camera size={18} color={activeTab === 'Screenshots' ? theme.accent : theme.muted} />
                <Text style={[styles.menuTabCount, { color: activeTab === 'Screenshots' ? theme.accent : theme.muted, marginTop: 2 }]}>{screenshots.length}/10</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'Clips' && (
            <View style={styles.grid}>
              {clips.length === 0 ? (
                <View style={styles.emptyState}>
                  <Play size={40} color="#334155" />
                  <Text style={styles.emptyTitle}>No clips yet</Text>
                </View>
              ) : (
                clips.map((clip) => (
                  <TouchableOpacity
                    key={clip.id}
                    style={styles.clipCard}
                    onPress={() => router.push({ pathname: '/clip/[id]', params: { id: clip.id.toString(), fromUser: username, contentType: 'clip' } })}
                  >
                    <Image source={{ uri: getClipThumbnail(clip) }} style={styles.clipImage} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.clipGradient} />
                    <View style={styles.clipBadges}>
                      <View style={styles.metaBadge}>
                        <Text style={styles.metaBadgeText}>{formatDuration(clip.duration)}</Text>
                      </View>
                      <View style={styles.metaBadge}>
                        <Eye size={9} color="#FFF" />
                        <Text style={styles.metaBadgeText}>{clip.views}</Text>
                      </View>
                    </View>
                    <View style={styles.clipInfo}>
                      <Text style={styles.clipTitle} numberOfLines={1}>{truncateTitle(clip.title)}</Text>
                      <Text style={styles.clipHandle}>{clip.user?.username ? `@${clip.user.username}` : ''}</Text>
                      {clip.game ? (
                        <View style={styles.clipGameTag}>
                          <Text style={styles.clipGameTagText}>{clip.game.name}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {activeTab === 'Reels' && (
            <View style={styles.reelsGrid}>
              {reels.length === 0 ? (
                <View style={styles.emptyState}>
                  <Play size={40} color="#334155" />
                  <Text style={styles.emptyTitle}>No reels yet</Text>
                </View>
              ) : (
                reels.map((reel) => (
                  <TouchableOpacity
                    key={reel.id}
                    style={styles.reelCard}
                    onPress={() => router.push({ pathname: '/clip/[id]', params: { id: reel.id.toString(), fromUser: username, contentType: 'reel' } })}
                  >
                    <Image source={{ uri: getReelThumbnail(reel) }} style={styles.reelImage} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.reelGradient} />
                    <View style={styles.reelTopRight}>
                      <View style={styles.reelBadge}>
                        <Text style={styles.reelBadgeText}>{formatDuration(reel.duration)}</Text>
                      </View>
                      <View style={styles.reelBadge}>
                        <Eye size={10} color="#FFF" />
                        <Text style={styles.reelBadgeText}>{reel.views ?? 0}</Text>
                      </View>
                    </View>
                    <View style={styles.reelBottom}>
                      <Text style={styles.reelTitle} numberOfLines={2}>{truncateTitle(reel.title)}</Text>
                      <Text style={styles.reelHandle}>{reel.user?.username ? `@${reel.user.username}` : ''}</Text>
                      {reel.game ? (
                        <View style={styles.gameTag}>
                          <Text style={styles.gameTagText}>{reel.game.name}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {activeTab === 'Screenshots' && (
            <View style={styles.screenshotsList}>
              {screenshots.length === 0 ? (
                <View style={styles.emptyState}>
                  <Camera size={40} color="#334155" />
                  <Text style={styles.emptyTitle}>No screenshots yet</Text>
                </View>
              ) : (
                screenshots.map((item, index) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.screenshotCard}
                    onPress={() => {
                      setSelectedScreenshotIndex(index);
                      setIsScreenshotModalVisible(true);
                    }}
                    activeOpacity={0.8}
                  >
                    <ImageBackground
                      source={{ uri: getScreenshotThumbnail(item) }}
                      style={styles.screenshotImage}
                      imageStyle={{ borderRadius: 16 }}
                    >
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.8)']}
                        style={StyleSheet.absoluteFill}
                      />
                      <View style={styles.screenshotGridInfo}>
                        {item.title ? (
                          <Text style={styles.screenshotGridTitle} numberOfLines={1}>{item.title}</Text>
                        ) : null}
                      </View>
                    </ImageBackground>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {activeTab === 'Favorites' && (
            <View style={styles.reelsGrid}>
              {favoriteGames.length === 0 ? (
                <View style={styles.emptyState}>
                  <Gamepad2 size={40} color="#334155" />
                  <Text style={styles.emptyTitle}>No favorites yet</Text>
                </View>
              ) : (
                favoriteGames.map((game) => (
                  <TouchableOpacity key={game.id} style={styles.reelCard} activeOpacity={0.8}>
                    <Image source={{ uri: getImageUrl(game.imageUrl) }} style={styles.reelImage} resizeMode="cover" />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.9)']} style={styles.clipGradient} />
                    <View style={styles.clipInfo}>
                      <Text style={styles.clipTitle} numberOfLines={2}>{game.name}</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <ProfilePictureModal
        visible={isProfileModalVisible}
        onClose={() => setIsProfileModalVisible(false)}
        imageUrl={avatarUrl}
        username={handle}
        viewOnly={true}
        borderColor={theme.avatarBorderColor}
      />
      <ProfileBannerModal
        visible={isBannerModalVisible}
        onClose={() => setIsBannerModalVisible(false)}
        bannerUrl={bannerUrl}
        username={handle}
      />
      <ReportModal
        visible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
        onSubmit={async (reason, details) => {
          await submitReportMutation.mutateAsync({
            contentType: 'user',
            contentId: userId || 0,
            reason,
            details,
            contentTitle: user?.displayName || user?.username,
            reportedUserId: userId,
            reportedUsername: user?.username,
          });
        }}
        contentType="user"
        contentId={userId || 0}
        contentTitle={user?.displayName || user?.username}
      />
      <ScreenshotViewerModal
        visible={isScreenshotModalVisible}
        onClose={() => setIsScreenshotModalVisible(false)}
        screenshot={screenshots[selectedScreenshotIndex] || null}
        screenshots={screenshots}
        initialIndex={selectedScreenshotIndex}
        handle={user?.username || ''}
        isOwner={isMe || false}
      />
      <ShareProfileModal
        visible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        profile={{
          displayName: user?.displayName || user?.username || '',
          username: user?.username || '',
          bio: user?.bio || '',
          avatarUrl,
          bannerUrl: user?.bannerUrl ?? undefined,
          borderColor: theme.avatarBorderColor,
          level: user?.level || 1,
          totalXP: user?.totalXP || 0,
          verified: user?.emailVerified || false,
          stats: {
            uploads: clips.length + reels.length + screenshots.length,
            followers: user?._count?.followers || 0,
            following: user?._count?.following || 0,
          },
          engagement: { likes: 0, fires: 0, streak: user?.currentStreak || 0 },
          games: favoriteGames.map((g: any) => ({ id: g.id, name: g.name, imageUrl: g.imageUrl })),
          accentColor: theme.accent,
          backgroundColor: theme.bg,
          cardBgColor: theme.cardBg,
          cardBorderColor: theme.cardBorder,
          platformTagStyle: theme.platformTagStyle,
          platformTagBorderColor: theme.platformTagBorderColor,
        }}
      />
    </View>
  );
}
