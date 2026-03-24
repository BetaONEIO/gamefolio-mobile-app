import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import { useMemo } from 'react';
import Svg, { Path, Ellipse } from 'react-native-svg';
import { Share2, Check, Heart, Flame, Monitor, Gamepad2, MessageSquare, Eye, UserPlus, Mail, Play, Camera, Flag, ChevronLeft, Bell, Upload, UserX } from 'lucide-react-native';
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
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getProfileTheme, ProfileThemeTokens } from '@/constants/themes';
import { ThemeBackgroundEffect } from '@/components/ThemeBackgroundEffect';

const { width } = Dimensions.get('window');

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
    },

    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 10,
      backgroundColor: theme.navBg,
      borderBottomWidth: 0.5,
      borderBottomColor: theme.navBorderColor,
    },
    navLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      width: 72,
    },
    navCenter: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    navRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      width: 120,
      justifyContent: 'flex-end',
    },
    navIconBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navUsername: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    navVerified: {
      backgroundColor: theme.verifiedBg,
      borderWidth: 0.5,
      borderColor: theme.verifiedBorderColor,
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navGreenBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    navAvatarChip: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.isLight ? theme.verifiedBorderColor : (theme.accent + '80'),
      backgroundColor: theme.isLight ? 'rgba(255,255,255,0.8)' : '#1d293d',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    navAvatar: {
      width: 34,
      height: 34,
    },
    navStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      backgroundColor: theme.accentFaint,
      borderWidth: 0.5,
      borderColor: theme.accentMuted,
      marginLeft: 4,
    },
    navStatusText: {
      color: theme.accent,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },

    identitySection: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 4,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    displayName: {
      color: theme.textPrimary,
      fontSize: theme.displayNameSize,
      fontWeight: '900',
      letterSpacing: -0.8,
      textTransform: theme.displayNameUppercase ? 'uppercase' : 'none',
    },
    verifiedBadge: {
      backgroundColor: theme.verifiedBg,
      borderRadius: 100,
      borderWidth: 0.5,
      borderColor: theme.verifiedBorderColor,
      paddingHorizontal: 10,
      paddingVertical: 4,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 5,
    },
    verifiedBadgeIcon: {
      backgroundColor: '#3B82F6',
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    verifiedBadgeText: {
      color: theme.verifiedText,
      fontSize: theme.isLight ? 10 : 8,
      fontWeight: '900',
      letterSpacing: theme.isLight ? -0.5 : 0.8,
      textTransform: 'uppercase',
    },
    handle: {
      color: theme.textHandle,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: 10,
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

    statsCard: {
      marginHorizontal: 16,
      marginTop: 14,
      marginBottom: theme.hasDripEffect ? 28 : 4,
      backgroundColor: theme.cardBg,
      borderWidth: theme.hasDripEffect ? 1.5 : 0.5,
      borderColor: theme.cardBorder,
      borderRadius: theme.cardBorderRadius,
      overflow: theme.hasDripEffect ? 'visible' : 'hidden',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: theme.hasDripEffect ? 0.6 : 0.15,
      shadowRadius: theme.hasDripEffect ? 16 : 12,
      elevation: theme.hasDripEffect ? 8 : 3,
    },
    statsGradientBar: {
      height: 3,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 8,
    },
    statCol: {
      flex: 1,
      alignItems: theme.statAlign,
    },
    statDivider: {
      width: 0.5,
      height: 36,
      backgroundColor: theme.dividerColor,
    },
    statNumber: {
      color: theme.statNumberColor,
      fontSize: theme.statNumberFontSize,
      fontWeight: '900',
      letterSpacing: -0.5,
      marginBottom: 2,
    },
    statLabel: {
      color: theme.isLight ? theme.followingLabelColor : (theme.statLabelPill ? theme.accentDark : (theme.accentDark === '#022c22' ? '#62748e' : theme.accentDark)),
      fontSize: theme.statLabelPill ? 10 : 8,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: theme.isLight ? 0.8 : 1.2,
      backgroundColor: theme.isLight ? 'transparent' : (theme.accent + 'e6'),
      paddingHorizontal: theme.statLabelPill ? 10 : (theme.isLight ? 0 : 6),
      paddingVertical: theme.statLabelPill ? 4 : (theme.isLight ? 0 : 2),
      borderRadius: theme.statLabelPill ? 100 : 4,
      overflow: 'hidden',
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
      color: theme.isLight ? theme.bioTextColor : (theme.accent + 'cc'),
      fontSize: 10,
      fontWeight: '700',
      lineHeight: 16,
      letterSpacing: theme.isLight ? -0.2 : 0.5,
      textTransform: theme.isLight ? 'none' : 'uppercase',
    },
    platformsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 14,
    },
    platformChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 6,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    platformText: {
      fontSize: 11,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 14,
    },
    followBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.followBtnBg,
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6,
      shadowColor: theme.followBtnBg,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 3,
    },
    followingBtn: {
      backgroundColor: '#1d293d',
    },
    followBtnText: {
      color: theme.followBtnTextColor,
      fontSize: 13,
      fontWeight: '800',
    },
    followBtnTextActive: {
      color: '#FFF',
      fontSize: 13,
      fontWeight: '700',
    },
    iconActionBtn: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: theme.iconBtnBg,
      borderWidth: 0.5,
      borderColor: theme.iconBtnBorder,
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
    collectionBtn: {
      borderRadius: 100,
      paddingVertical: 9,
      paddingHorizontal: 24,
      alignSelf: 'flex-start',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 2,
    },
    collectionBtnText: {
      color: theme.isLight ? '#fff' : '#0f172b',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.9,
      textTransform: 'uppercase',
    },

    featuredSection: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 4,
    },
    featuredLabel: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    featuredMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    featuredMetaDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.accent,
    },
    featuredMetaText: {
      color: theme.accent + '99',
      fontSize: 8,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    featuredCard: {
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: theme.cardBorder,
      overflow: 'hidden',
      height: 190,
      backgroundColor: theme.isLight ? 'rgba(255,255,255,0.15)' : '#0a1628',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 10,
      elevation: 4,
    },
    featuredImage: {
      width: '100%',
      height: '100%',
    },
    featuredGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '60%',
    },
    featuredInfo: {
      position: 'absolute',
      top: 12,
      left: 12,
    },
    featuredPlayBtn: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featuredPlayCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.playCircleBg,
      borderWidth: 0.5,
      borderColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingLeft: 3,
    },
    featuredOnline: {
      position: 'absolute',
      top: 12,
      right: 12,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    featuredOnlineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: '#22c55e',
    },

    bannerSection: {
      position: 'relative',
      marginBottom: 60,
    },
    bannerContainer: {
      height: 160,
      width: '100%',
      overflow: 'hidden',
      borderBottomWidth: 1.5,
      borderBottomColor: theme.accentMuted,
    },
    bannerImage: {
      width: '100%',
      height: '100%',
    },
    bannerTopGradient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    avatarContainer: {
      position: 'absolute',
      bottom: -48,
      left: 20,
    },
    avatarBorder: {
      width: 96,
      height: 96,
      borderRadius: 18,
      borderWidth: theme.avatarBorderWidth,
      borderColor: theme.avatarBorderColor,
      backgroundColor: theme.isLight ? '#fdf2f8' : '#0a0c0a',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.isLight ? 0.2 : 0.3,
      shadowRadius: 10,
      elevation: 6,
    },
    avatar: {
      width: 92,
      height: 92,
      borderRadius: 16,
    },
    levelBadge: {
      position: 'absolute',
      bottom: -10,
      right: -10,
    },
    onlineIndicator: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.bg,
      borderWidth: 2,
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

    tabsScroll: {
      marginTop: 24,
      paddingHorizontal: 16,
    },
    tabsContent: {
      paddingHorizontal: 16,
      gap: 8,
      flexDirection: 'row',
      paddingBottom: 4,
    },
    tabPill: {
      paddingVertical: 7,
      paddingHorizontal: 16,
      borderRadius: 100,
      backgroundColor: theme.tabInactiveBg,
      borderWidth: 0.5,
      borderColor: theme.tabInactiveBorder,
      marginRight: 4,
    },
    tabPillActive: {
      backgroundColor: theme.tabActiveBg,
      borderColor: theme.tabActiveBorder,
    },
    tabPillText: {
      color: theme.textHandle,
      fontSize: 13,
      fontWeight: '700',
    },
    tabPillTextActive: {
      color: theme.tabActiveText,
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
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: '#0a1628',
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
      height: '65%',
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
      gap: 3,
      backgroundColor: 'rgba(0,0,0,0.75)',
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 6,
    },
    metaBadgeText: {
      color: '#FFF',
      fontSize: 9,
      fontWeight: '700',
    },
    clipInfo: {
      position: 'absolute',
      bottom: 8,
      left: 10,
      right: 10,
    },
    clipTitle: {
      color: '#FFF',
      fontSize: 13,
      fontWeight: '800',
      marginBottom: 4,
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
      width: (width - 32 - 10) / 2,
      aspectRatio: 9 / 16,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: '#0a1628',
      position: 'relative',
    },
    reelImage: {
      width: '100%',
      height: '100%',
    },
    screenshotsList: {
      gap: 10,
      paddingBottom: 20,
    },
    screenshotCard: {
      flexDirection: 'row',
      backgroundColor: theme.isLight ? 'rgba(255,255,255,0.5)' : '#0a1628',
      borderRadius: 14,
      borderWidth: 0.5,
      borderColor: theme.cardBorder,
      overflow: 'hidden',
    },
    screenshotImage: {
      width: 100,
      height: 80,
    },
    screenshotInfo: {
      flex: 1,
      padding: 10,
      justifyContent: 'center',
      gap: 4,
    },
    screenshotTitle: {
      color: theme.isLight ? theme.textPrimary : '#FFF',
      fontSize: 13,
      fontWeight: '700',
    },
    screenshotStats: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 4,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    statVal: {
      color: '#62748e',
      fontSize: 11,
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

  if (isProfileLoading || !user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#4ADE80" />
      </View>
    );
  }

  const avatarUrl = getEffectiveAvatarUrl(user) || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=400&auto=format&fit=crop';
  const bannerUrl = user.bannerUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800&auto=format&fit=crop';
  const displayName = user.displayName || user.username;
  const handle = `@${user.username}`;
  const featuredClip = clips[0] || reels[0] || null;
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
      <ThemeBackgroundEffect themeId={activeThemeId} />
      {/* Top Nav */}
      <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
        <View style={styles.navLeft}>
          <TouchableOpacity style={styles.navIconBtn} onPress={() => router.back()}>
            <ChevronLeft size={22} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.navCenter}>
          <Text style={styles.navUsername} numberOfLines={1}>{displayName}</Text>
          {user.emailVerified && (
            <View style={styles.navVerified}>
              <Check size={8} color={theme.verifiedText} strokeWidth={4} />
            </View>
          )}
          {theme.statusText.length > 0 && (
            <View style={styles.navStatusBadge}>
              <Text style={styles.navStatusText}>{theme.statusText}</Text>
            </View>
          )}
        </View>

        <View style={styles.navRight}>
          <TouchableOpacity style={styles.navIconBtn} onPress={() => setIsShareModalVisible(true)}>
            <Share2 size={18} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navGreenBtn}
            onPress={() => router.push('/(drawer)/(tabs)/create')}
          >
            <Upload size={16} color={theme.followBtnTextColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navAvatarChip}
            onPress={() => setIsProfileModalVisible(true)}
          >
            <Image source={{ uri: avatarUrl }} style={styles.navAvatar} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* Banner with Avatar */}
        <View style={styles.bannerSection}>
          <TouchableOpacity style={styles.bannerContainer} onPress={() => setIsBannerModalVisible(true)} activeOpacity={0.9}>
            <Image source={{ uri: bannerUrl }} style={styles.bannerImage} resizeMode="cover" />
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.5)']}
              style={styles.bannerTopGradient}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.avatarContainer} onPress={() => setIsProfileModalVisible(true)}>
            <View style={styles.avatarBorder}>
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            </View>
            <View style={styles.levelBadge}>
              <LevelBadge level={user.level || 1} size={28} thickness={2} />
            </View>
            {user.isOnline && !isMe && (
              <TouchableOpacity
                style={styles.onlineIndicator}
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
        </View>

        {isBirthdayToday(user?.birthday) && (
          <BirthdayBanner
            displayName={displayName}
            isOwnProfile={isMe || false}
          />
        )}

        {/* User Name / Handle / Badge */}
        <View style={styles.identitySection}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>{displayName}</Text>
            {/* Badge inline with name only for dark themes */}
            {!theme.isLight && user.emailVerified && (
              theme.verifiedLabel.length > 0 ? (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>{theme.verifiedLabel}</Text>
                </View>
              ) : (
                <View style={styles.verifiedBadgeIcon}>
                  <Check size={9} color="#FFF" strokeWidth={4} />
                </View>
              )
            )}
          </View>
          <Text style={styles.handle}>{handle}</Text>
          {user.bio ? (
            <Text style={[styles.bio, { marginTop: 6, textTransform: 'none', fontSize: 13, fontWeight: '400', letterSpacing: 0 }]} numberOfLines={3}>{user.bio}</Text>
          ) : null}

          {/* Pill badge below handle for light/pink theme */}
          {theme.isLight && user.emailVerified && theme.verifiedLabel.length > 0 && (
            <View style={[styles.verifiedBadge, { marginBottom: 8, alignSelf: 'flex-start' }]}>
              <Check size={9} color={theme.verifiedText} strokeWidth={4} />
              <Text style={styles.verifiedBadgeText}>{theme.verifiedLabel}</Text>
            </View>
          )}

          <View style={styles.badgesRow}>
            {user.isPro && (
              <View style={styles.streamerBadge}>
                <Text style={styles.streamerText}>PRO</Text>
              </View>
            )}
            {user.isOnline && (
              <View style={[styles.streamerBadge, styles.onlineBadge]}>
                <View style={styles.onlineDot} />
                <Text style={styles.streamerText}>ONLINE</Text>
              </View>
            )}
          </View>

          {/* Current Game Nametag — shown here for dark themes */}
          {currentGame && !theme.statsCardIncludesBio && (
            <View style={styles.nametagSection}>
              <Text style={styles.nametagLabel}>NAMETAG</Text>
              <LinearGradient
                colors={theme.nametagGradient}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.nametagCard}
              >
                {currentGame.imageUrl ? (
                  <Image source={{ uri: getImageUrl(currentGame.imageUrl) }} style={styles.nametagGameImg} />
                ) : (
                  <Gamepad2 size={20} color={theme.isLight ? '#fff' : '#ff8904'} />
                )}
                <Text style={styles.nametagGameName} numberOfLines={1}>{currentGame.name.toUpperCase()}</Text>
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Stats Card */}
        <View
          style={styles.statsCard}
          onLayout={e => setStatsCardWidth(e.nativeEvent.layout.width)}
        >
          {theme.hasStatsGradientBar && (
            <LinearGradient
              colors={theme.statsTopGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.statsGradientBar}
            />
          )}
          <View style={[styles.statsRow, theme.statsCardIncludesBio && { paddingHorizontal: 16 }]}>
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{clips.length + reels.length + screenshots.length}</Text>
              <Text style={styles.statLabel}>{statUploads}</Text>
            </View>
            {!theme.statsCardIncludesBio && <View style={styles.statDivider} />}
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{user._count?.followers || 0}</Text>
              <Text style={styles.statLabel}>{statFollowers}</Text>
            </View>
            {!theme.statsCardIncludesBio && <View style={styles.statDivider} />}
            <View style={styles.statCol}>
              <Text style={styles.statNumber}>{user._count?.following || 0}</Text>
              <Text style={styles.statLabel}>{statFollowing}</Text>
            </View>
          </View>
          {theme.hasDripEffect && statsCardWidth > 0 && (
            <ZombieDrip cardWidth={statsCardWidth} color={theme.accent} />
          )}
          {isFollowing && (
            <View style={styles.followingBar}>
              <Text style={styles.followingLabel}>FOLLOWING</Text>
            </View>
          )}
          {/* Collection button inside card for pink theme */}
          {theme.statsCardIncludesBio && (
            <View style={styles.statsCardBioSection}>
              <LinearGradient
                colors={theme.collectionGradient}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.statsCardCollectionBtn}
              >
                <Text style={styles.statsCardCollectionText}>Collection</Text>
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Nametag below stats card — pink theme */}
        {currentGame && theme.statsCardIncludesBio && (
          <View style={[styles.nametagSection, { alignItems: 'center', marginHorizontal: 16, marginBottom: 8 }]}>
            <Text style={[styles.nametagLabel, { textAlign: 'center', letterSpacing: 2.1 }]}>NAMETAG</Text>
            <LinearGradient
              colors={theme.nametagGradient}
              start={{ x: 1, y: 0.5 }}
              end={{ x: 0, y: 0.5 }}
              style={styles.nametagCard}
            >
              {currentGame.imageUrl ? (
                <Image source={{ uri: getImageUrl(currentGame.imageUrl) }} style={styles.nametagGameImg} />
              ) : (
                <Gamepad2 size={20} color="#fff" />
              )}
              <Text style={styles.nametagGameName} numberOfLines={1}>{currentGame.name.toUpperCase()}</Text>
            </LinearGradient>
          </View>
        )}

        {/* Profile Info */}
        <View style={styles.profileInfoSection}>
          {/* Platform chips */}
          {platforms.length > 0 && (
            <View style={styles.platformsRow}>
              {platforms.map((p, i) => (
                <View key={i} style={[styles.platformChip, { backgroundColor: `${p.color}22` }]}>
                  {p.type === 'xbox' && <Gamepad2 size={10} color={p.color} />}
                  {p.type === 'ps' && <Gamepad2 size={10} color={p.color} />}
                  {p.type === 'pc' && <Monitor size={10} color={p.color} />}
                  {p.type === 'nintendo' && <Gamepad2 size={10} color={p.color} />}
                  {p.type === 'epic' && <Gamepad2 size={10} color={p.color} />}
                  <Text style={[styles.platformText, { color: p.color }]}>{p.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action buttons */}
          {!isMe && (
            <View style={styles.actionsRow}>
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
                  <>
                    <UserPlus size={14} color={theme.followBtnTextColor} />
                    <Text style={styles.followBtnText}>Follow</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconActionBtn}
                onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: userId?.toString() || 'unknown', username } })}
              >
                <Mail size={16} color={theme.memberSinceColor} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.blockBtn, isBlocked && styles.blockBtnActive]}
                onPress={handleToggleBlock}
                disabled={blockMutation.isPending}
              >
                <UserX size={14} color={isBlocked ? '#FFFFFF' : '#F97316'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() => setIsReportModalVisible(true)}
              >
                <Flag size={14} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Collection button — only shown outside the stats card for default/zombie themes */}
          {!theme.statsCardIncludesBio && (
            <LinearGradient
              colors={theme.collectionGradient}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.collectionBtn}
            >
              <Text style={styles.collectionBtnText}>COLLECTION</Text>
            </LinearGradient>
          )}
        </View>

        {/* Featured Clip */}
        {featuredClip && (
          <View style={styles.featuredSection}>
            <TouchableOpacity
              style={styles.featuredCard}
              onPress={() => router.push({ pathname: '/clip/[id]', params: { id: featuredClip.id.toString(), fromUser: username, contentType: featuredClip.videoType === 'reel' ? 'reel' : 'clip' } })}
              activeOpacity={0.9}
            >
              <Image source={{ uri: getClipThumbnail(featuredClip) }} style={styles.featuredImage} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
                style={styles.featuredGradient}
              />
              <View style={styles.featuredInfo}>
                <Text style={styles.featuredLabel}>
                  {theme.verifiedLabel.length > 0 ? `Extract Mission #${featuredClip.id}` : featuredClip.title}
                </Text>
                {theme.verifiedLabel.length > 0 && (
                  <View style={styles.featuredMeta}>
                    <View style={styles.featuredMetaDot} />
                    <Text style={styles.featuredMetaText}>Confidential Archive</Text>
                  </View>
                )}
              </View>
              <View style={styles.featuredPlayBtn}>
                <View style={styles.featuredPlayCircle}>
                  <Play size={16} color="#FFF" fill="#FFF" />
                </View>
              </View>
              {user.isOnline && (
                <View style={styles.featuredOnline}>
                  <View style={styles.featuredOnlineDot} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Content Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsContent}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabPillText, activeTab === tab && styles.tabPillTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.clipGradient} />
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
                      {clip.game && (
                        <View style={[styles.gameChip, { backgroundColor: `${accentColor}33` }]}>
                          <Text style={[styles.gameChipText, { color: accentColor }]}>{clip.game.name}</Text>
                        </View>
                      )}
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
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.clipGradient} />
                    <View style={styles.clipBadges}>
                      <View style={styles.metaBadge}>
                        <Text style={styles.metaBadgeText}>{formatDuration(reel.duration)}</Text>
                      </View>
                    </View>
                    <View style={styles.clipInfo}>
                      <Text style={styles.clipTitle} numberOfLines={1}>{truncateTitle(reel.title)}</Text>
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
                    <Image source={{ uri: getScreenshotThumbnail(item) }} style={styles.screenshotImage} />
                    <View style={styles.screenshotInfo}>
                      <Text style={styles.screenshotTitle}>{item.title}</Text>
                      {item.game && (
                        <View style={[styles.gameChip, { backgroundColor: `${accentColor}22` }]}>
                          <Text style={[styles.gameChipText, { color: accentColor }]}>{item.game.name}</Text>
                        </View>
                      )}
                      <View style={styles.screenshotStats}>
                        <View style={styles.statItem}>
                          <Heart size={13} color="#62748e" />
                          <Text style={styles.statVal}>{item._count?.likes || 0}</Text>
                        </View>
                        <View style={styles.statItem}>
                          <MessageSquare size={13} color="#62748e" />
                          <Text style={styles.statVal}>{item._count?.comments || 0}</Text>
                        </View>
                      </View>
                    </View>
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
        }}
      />
    </View>
  );
}
