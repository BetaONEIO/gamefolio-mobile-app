import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import ScrollView from '@/components/ThemedScrollView';
import { Share2, Check, Heart, Flame, Monitor, Gamepad2, MessageSquare, Eye, UserPlus, Mail, Play, Camera, Flag } from 'lucide-react-native';
import { truncateTitle } from '@/constants/formatters';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import ProfilePictureModal from '@/components/ProfilePictureModal';
import ProfileBannerModal from '@/components/ProfileBannerModal';
import ScreenshotViewerModal from '@/components/ScreenshotViewerModal';
import LevelBadge from '@/components/LevelBadge';
import StyledUsername from '@/components/StyledUsername';
import { api, Clip, Screenshot } from '@/lib/api';
import ReportModal from '@/components/ReportModal';
import ShareProfileModal from '@/components/ShareProfileModal';
import { trpc } from '@/lib/trpc';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const TABS = ['Clips', 'Reels', 'Screenshots', 'Favorites'];

export default function PublicProfileScreen() {
  const [activeTab, setActiveTab] = useState('Clips');
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const username = Array.isArray(id) ? id[0] : id;
  const { user: currentUser } = useAuth();

  const isMe = currentUser && (currentUser.username === username);

  // Fetch Profile via REST API
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ['userProfile', username],
    queryFn: () => api.users.getProfile(username || ''),
    enabled: !!username,
  });

  const user = profileData?.user;
  const userId = user?.id;

  const bgColor = user?.backgroundColor || '#0F1520';
  const accentColor = user?.accentColor || '#4ADE80';

  // Fetch clips (and reels) via REST API
  const { data: allClips = [] } = useQuery({
    queryKey: ['userClips', username],
    queryFn: () => api.users.getUserClips(username || ''),
    enabled: !!username,
  });

  const clips = allClips.filter((c: Clip) => c.videoType !== 'reel' && c.userId === userId);
  const reels = allClips.filter((c: Clip) => c.videoType === 'reel' && c.userId === userId);

  // Fetch screenshots via REST API
  const { data: allScreenshots = [] } = useQuery({
    queryKey: ['userScreenshots', userId],
    queryFn: () => api.screenshots.getUserScreenshots(userId || 0),
    enabled: !!userId,
  });

  const screenshots = allScreenshots.filter((s: Screenshot) => s.userId === userId);

  // Fetch favorite games via REST API
  const { data: favoriteGames = [] } = useQuery({
    queryKey: ['userFavorites', username],
    queryFn: () => api.users.getFavorites(username || ''),
    enabled: !!username,
  });

  const [isFollowing, setIsFollowing] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isBannerModalVisible, setIsBannerModalVisible] = useState(false);

  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(0);
  const [isScreenshotModalVisible, setIsScreenshotModalVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);

  const submitReportMutation = trpc.reports.submit.useMutation({
    onSuccess: () => {
      console.log('[UserProfile] Report submitted successfully');
    },
    onError: (error) => {
      console.error('[UserProfile] Error submitting report:', error);
    },
  });

  // Format duration helper
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

  // Construct display profile
  const displayProfile = {
      name: user.displayName || user.username,
      handle: `@${user.username}`,
      avatar: user.avatarUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop',
      banner: user.bannerUrl || 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=2671&auto=format&fit=crop',
      level: user.level || 1,
      verified: user.emailVerified,
      stats: {
        clips: user._count?.clips || 0,
        followers: user._count?.followers || 0,
        following: user._count?.following || 0
      },
      engagement: {
        likes: 0, // Not in User object
        fires: 0,
        streak: user.currentStreak || 0
      },
      joined: 'August 2025', // Not in User object
      bio: user.bio || 'No bio yet.',
      platforms: [
        { name: user.username, type: 'xbox', color: '#107C10' },
        { name: user.username, type: 'ps', color: '#00439C' },
        { name: user.username, type: 'pc', color: '#00A4EF' }
      ]
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <AppHeader showBackButton />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <TouchableOpacity 
          style={styles.bannerContainer}
          onPress={() => setIsBannerModalVisible(true)}
          activeOpacity={0.9}
        >
          {displayProfile.banner ? (
            <>
              <Image source={{ uri: displayProfile.banner }} style={styles.banner} resizeMode="cover" />
              <LinearGradient
                colors={['transparent', `${bgColor}99`, `${bgColor}DD`, bgColor]}
                style={styles.bannerGradient}
                locations={[0, 0.4, 0.7, 1]}
                pointerEvents="none"
              />
              <LinearGradient
                colors={[`${bgColor}60`, 'transparent']}
                style={styles.bannerGradientTop}
                locations={[0, 1]}
                pointerEvents="none"
              />
            </>
          ) : (
            <>
              <View style={[styles.banner, { backgroundColor: accentColor }]} />
              <LinearGradient
                colors={['transparent', `${bgColor}99`, `${bgColor}DD`, bgColor]}
                style={styles.bannerGradient}
                locations={[0, 0.4, 0.7, 1]}
                pointerEvents="none"
              />
              <LinearGradient
                colors={[`${bgColor}60`, 'transparent']}
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setIsShareModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Share2 size={20} color="#FFF" />
          </TouchableOpacity>
        </TouchableOpacity>

        <View style={styles.content}>
          {/* Profile Picture and Action Buttons Row */}
          <View style={styles.profileRow}>
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                <TouchableOpacity onPress={() => setIsProfileModalVisible(true)}>
                  <Image 
                    source={{ uri: displayProfile.avatar }} 
                    style={[styles.avatar, { borderColor: bgColor }]} 
                  />
                  {user.isOnline && !isMe && (
                    <View style={styles.onlineIndicator} />
                  )}
                </TouchableOpacity>
                <View style={styles.badgesContainer}>
                  <View style={styles.levelBadgeContainer}>
                    <LevelBadge level={displayProfile.level} size={32} thickness={3} />
                  </View>
                </View>
              </View>
            </View>

            {/* Action Buttons - Top Right */}
            {!isMe && (
              <View style={styles.actionButtonsRow}>
                <TouchableOpacity 
                  style={[styles.followButtonSmall, { backgroundColor: isFollowing ? '#334155' : accentColor }]}
                  onPress={() => setIsFollowing(!isFollowing)}
                >
                  {isFollowing ? (
                    <Text style={[styles.followButtonTextSmall, styles.followingButtonText]}>Following</Text>
                  ) : (
                    <>
                      <UserPlus size={14} color="#000" />
                      <Text style={styles.followButtonTextSmall}>Follow</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.messageIconButtonSmall}
                  onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: userId?.toString() || 'unknown', username: username } })}
                >
                  <Mail size={18} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.reportIconButtonSmall}
                  onPress={() => setIsReportModalVisible(true)}
                >
                  <Flag size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Profile Header */}
          <View style={styles.header}>
            <View style={styles.userInfoSection}>
              <View style={styles.nameRow}>
                <View style={styles.nameRowLeft}>
                  <StyledUsername 
                    username={displayProfile.name} 
                    textStyleId={(user as any)?.textStyleId || 'default'}
                    fontSize={26}
                  />
                  {displayProfile.verified && (
                    <View style={styles.verifiedBadge}>
                      <Check size={10} color="#FFF" strokeWidth={4} />
                    </View>
                  )}
                </View>
              </View>
              <Text style={styles.handle}>{displayProfile.handle}</Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.memberSince}>Member since {displayProfile.joined}</Text>
            <Text style={styles.bio}>{displayProfile.bio}</Text>
            <View style={styles.divider} />

            <View style={styles.statsRowCompact}>
              <View style={styles.statColumn}>
                <Text style={styles.statNumber}>{displayProfile.stats.clips}</Text>
                <Text style={styles.statLabel}>Clips</Text>
              </View>
              <View style={styles.statColumn}>
                <Text style={styles.statNumber}>{displayProfile.stats.followers}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statColumn}>
                <Text style={styles.statNumber}>{displayProfile.stats.following}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>

          <View style={styles.platformsRow}>
            {displayProfile.platforms.map((platform, index) => (
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
                style={[styles.tab, activeTab === tab && [styles.activeTab, { borderBottomColor: accentColor }]]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Content based on active tab */}
          {activeTab === 'Clips' && (
            <View style={styles.grid}>
              {clips.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyStateIcon}>
                    <Play size={48} color="#475569" />
                  </View>
                  <Text style={styles.emptyStateTitle}>No clips found</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    No clips have been uploaded yet.
                  </Text>
                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: accentColor }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push('/(drawer)/(tabs)/create');
                    }}
                  >
                    <Text style={styles.uploadButtonText}>Upload First Clip</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                clips.map((clip) => (
                  <TouchableOpacity 
                    key={clip.id} 
                    style={styles.clipItem}
                    onPress={() => router.push({ pathname: '/clip/[id]', params: { id: clip.id.toString(), fromUser: username } })}
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
                      <Text style={styles.clipHandle}>{displayProfile.handle}</Text>
                      {clip.game && (
                          <View style={[styles.clipGameTag, { backgroundColor: accentColor }]}>
                          <Text style={styles.clipGameTagText}>{clip.game.name}</Text>
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
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyStateIcon}>
                    <Play size={48} color="#475569" />
                  </View>
                  <Text style={styles.emptyStateTitle}>No reels found</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    No reels have been uploaded yet.
                  </Text>
                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: accentColor }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push('/(drawer)/(tabs)/create');
                    }}
                  >
                    <Text style={styles.uploadButtonText}>Upload First Reel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                reels.map((reel) => (
                  <TouchableOpacity 
                      key={reel.id} 
                      style={styles.reelItem}
                      onPress={() => router.push({ pathname: '/clip/[id]', params: { id: reel.id.toString(), fromUser: username } })}
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
                      <Text style={styles.reelHandle}>{displayProfile.handle}</Text>
                      {reel.game && (
                          <View style={[styles.gameTag, { backgroundColor: accentColor }]}>
                          <Text style={styles.gameTagText}>{reel.game.name}</Text>
                          </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {activeTab === 'Screenshots' && (
            <View style={styles.screenshotsList}>
              {screenshots.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyStateIcon}>
                    <Camera size={48} color="#475569" />
                  </View>
                  <Text style={styles.emptyStateTitle}>No screenshots found</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    No screenshots have been uploaded yet.
                  </Text>
                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: accentColor }]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push('/(drawer)/(tabs)/create');
                    }}
                  >
                    <Text style={styles.uploadButtonText}>Upload First Screenshot</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                screenshots.map((item, index) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={styles.screenshotCard}
                    onPress={() => {
                      setSelectedScreenshotIndex(index);
                      setIsScreenshotModalVisible(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.screenshotImage} />
                    <View style={styles.screenshotContent}>
                        <Text style={styles.screenshotTitle}>{item.title}</Text>
                        <Text style={styles.screenshotHandle}>{displayProfile.handle}</Text>
                        {item.game && (
                          <View style={[styles.gameTag, { marginBottom: 12 }]}>
                              <Text style={styles.gameTagText}>{item.game.name}</Text>
                          </View>
                        )}
                        <View style={styles.screenshotFooter}>
                            <View style={styles.screenshotStats}>
                                <View style={styles.statItem}>
                                    <Heart size={16} color="#94A3B8" />
                                    <Text style={styles.statValue}>{item._count?.likes || 0}</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Flame size={16} color="#94A3B8" />
                                    <Text style={styles.statValue}>{0}</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <MessageSquare size={16} color="#94A3B8" />
                                    <Text style={styles.statValue}>{item._count?.comments || 0}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
          
          {activeTab === 'Favorites' && (
            <View style={styles.favoritesGrid}>
              {favoriteGames.map((game) => (
                <TouchableOpacity key={game.id} style={styles.favoriteItem} activeOpacity={0.8}>
                    <Image source={{ uri: getImageUrl(game.imageUrl) }} style={styles.favoriteImage} resizeMode="cover" />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.9)']}
                        style={styles.favoriteGradient}
                    />
                    <View style={styles.favoriteBottom}>
                        <Text style={styles.favoriteTitle} numberOfLines={2}>{game.name}</Text>
                    </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      <ProfilePictureModal
        visible={isProfileModalVisible}
        onClose={() => setIsProfileModalVisible(false)}
        imageUrl={displayProfile.avatar}
        username={displayProfile.handle}
        viewOnly={true}
      />

      <ProfileBannerModal
        visible={isBannerModalVisible}
        onClose={() => setIsBannerModalVisible(false)}
        bannerUrl={displayProfile.banner}
        username={displayProfile.handle}
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
          bio: user?.bio || 'No bio yet.',
          avatarUrl: user?.avatarUrl || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop',
          bannerUrl: user?.bannerUrl ?? undefined,
          level: user?.level || 1,
          totalXP: user?.totalXP || 0,
          verified: user?.emailVerified || false,
          stats: {
            clips: user?._count?.clips || 0,
            followers: user?._count?.followers || 0,
            following: user?._count?.following || 0,
          },
          engagement: {
            likes: 0,
            fires: 0,
            streak: user?.currentStreak || 0,
          },
          games: favoriteGames.map((g: any) => ({ id: g.id, name: g.name, imageUrl: g.imageUrl })),
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
    flex: 1,
    paddingHorizontal: 16,
    marginTop: -90,
  },
  header: {
    marginBottom: 16,
    marginTop: 8,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  avatarSection: {
    marginBottom: 0,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  followButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
  },
  followButtonTextSmall: {
    color: '#002E15',
    fontWeight: '600' as const,
    fontSize: 13,
  },
  messageIconButtonSmall: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportIconButtonSmall: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoSection: {
    alignItems: 'flex-start',
    width: '100%',
  },
  reportUserButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
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
    borderColor: '#0F1520',
  },
  followButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  followButtonText: {
    color: '#002E15',
    fontWeight: 'bold',
    fontSize: 14,
  },
  followingButtonText: {
    color: '#FFF',
  },
  infoSection: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    width: '100%',
  },
  nameRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  handle: {
    fontSize: 15,
    color: '#94A3B8',
    marginBottom: 8,
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
  screenshotsList: {
    paddingBottom: 40,
    gap: 16,
  },
  screenshotCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
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
  },
  favoriteGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  favoriteBottom: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  favoriteTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyState: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  emptyStateContainer: {
    width: '100%',
    paddingVertical: 60,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  uploadButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: '#4ADE80',
    borderRadius: 12,
  },
  uploadButtonText: {
    color: '#0F1520',
    fontSize: 16,
    fontWeight: '700' as const,
  },
});