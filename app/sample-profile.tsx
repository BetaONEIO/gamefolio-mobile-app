import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ActivityIndicator, Animated, Modal, Pressable } from 'react-native';
import ScrollView from '@/components/ThemedScrollView';
import { Share2, Check, Heart, Flame, Monitor, Gamepad2, MessageSquare, Eye, UserPlus, MessageCircle, Play, Camera, ChevronDown, Zap, LayoutGrid, FolderHeart } from 'lucide-react-native';
import { truncateTitle } from '@/constants/formatters';
import { getClipThumbnail, getReelThumbnail, getScreenshotThumbnail } from '@/utils/thumbnails';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import ProfilePictureModal from '@/components/ProfilePictureModal';
import ProfileBannerModal from '@/components/ProfileBannerModal';
import LevelBadge from '@/components/LevelBadge';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const TABS = ['Clips', 'Reels', 'Screenshots', 'Favorites'];

export default function SampleProfileScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Clips');
  const { user: currentUser, getAccessToken } = useAuth();

  const { data: profileData, isLoading: isProfileLoading, error: profileError } = useQuery({
    queryKey: ['/api/users', currentUser?.username, 'sample-profile'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!currentUser?.username) return null;
      const result = await api.users.getProfile(currentUser.username, token ?? undefined);
      return result;
    },
    enabled: !!currentUser?.username,
  });

  const { data: allClips = [] } = useQuery({
    queryKey: ['/api/users', currentUser?.username, 'clips'],
    queryFn: async () => {
      if (!currentUser?.username) return [];
      const token = await getAccessToken();
      return api.users.getUserClips(currentUser.username, token ?? undefined);
    },
    enabled: !!currentUser?.username,
  });

  const { data: allScreenshots = [] } = useQuery({
    queryKey: ['/api/users', currentUser?.id, 'screenshots'],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const token = await getAccessToken();
      return api.screenshots.getUserScreenshots(currentUser.id, token ?? undefined);
    },
    enabled: !!currentUser?.id,
  });

  const { data: favoriteGames = [] } = useQuery({
    queryKey: ['/api/users', currentUser?.username, 'favorites'],
    queryFn: async () => {
      if (!currentUser?.username) return [];
      const token = await getAccessToken();
      return api.users.getFavorites(currentUser.username, token ?? undefined);
    },
    enabled: !!currentUser?.username,
  });

  const user = profileData?.user;
  const bgColor = user?.backgroundColor || '#0F1520';
  const accentColor = user?.accentColor || '#4ADE80';

  const clips = allClips.filter(c => c.videoType !== 'reel');
  const reels = allClips.filter(c => c.videoType === 'reel');
  const screenshots = allScreenshots;

  const [isFollowing, setIsFollowing] = useState(false);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [isBannerModalVisible, setIsBannerModalVisible] = useState(false);
  const [isEngagementExpanded, setIsEngagementExpanded] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const [tooltipVisible, setTooltipVisible] = useState<string | null>(null);
  const [onlineTooltipVisible, setOnlineTooltipVisible] = useState(false);

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

  console.log('[SampleProfile] Loading:', isProfileLoading, 'Error:', profileError, 'Data:', profileData);

  if (isProfileLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <AppHeader showBackButton />
        <ActivityIndicator size="large" color="#4ADE80" />
        <Text style={{ color: '#94A3B8', marginTop: 16 }}>Loading sample profile...</Text>
      </View>
    );
  }

  if (profileError || !user) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Text style={{ color: '#FFF', fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
          {profileError ? 'Failed to load profile' : 'No sample profile found'}
        </Text>
        <TouchableOpacity
          style={styles.followButton}
          onPress={() => router.back()}
        >
          <Text style={styles.followButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        likes: 1523,
        fires: 892,
        streak: user.currentStreak || 0
      },
      joined: 'August 2025',
      bio: user.bio || 'No bio yet.',
      platforms: [
        { name: user.username, type: 'xbox' as const, color: '#107C10' },
        { name: user.username, type: 'ps' as const, color: '#00439C' },
        { name: user.username, type: 'pc' as const, color: '#00A4EF' }
      ]
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <AppHeader showBackButton />
      <TouchableOpacity 
        style={styles.gamefolioButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.back();
        }}
      >
        <LayoutGrid size={20} color="#FFF" />
      </TouchableOpacity>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity 
          style={styles.bannerContainer}
          onPress={() => setIsBannerModalVisible(true)}
          activeOpacity={0.9}
        >
          {displayProfile.banner ? (
            <>
              <Image source={{ uri: displayProfile.banner }} style={styles.banner} />
              <LinearGradient
                colors={['transparent', `${bgColor}CC`, `${bgColor}FF`, bgColor]}
                style={styles.bannerGradient}
                locations={[0, 0.5, 0.85, 1]}
              />
            </>
          ) : (
            <>
              <View style={[styles.banner, { backgroundColor: accentColor }]} />
              <LinearGradient
                colors={['transparent', `${bgColor}CC`, `${bgColor}FF`, bgColor]}
                style={styles.bannerGradient}
                locations={[0, 0.5, 0.85, 1]}
              />
            </>
          )}
        </TouchableOpacity>

        {/* Online/Share buttons underneath banner, aligned right */}
        <View style={styles.topActionsRow}>
          {user.isOnline && (
            <TouchableOpacity 
              style={styles.onlineStatusBadge}
              activeOpacity={0.7}
            >
              <View style={styles.onlineStatusDot} />
              <Text style={styles.onlineStatusText}>Online</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.iconButton}>
            <Share2 size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.profileRow}>
              <View style={styles.avatarWrapper}>
                <TouchableOpacity onPress={() => setIsProfileModalVisible(true)}>
                  <View style={styles.avatarContainer}>
                    <Image source={{ uri: displayProfile.avatar }} style={styles.avatar} />
                    <View style={styles.levelContainer}>
                      <LevelBadge level={displayProfile.level} size={36} />
                    </View>
                  </View>
                </TouchableOpacity>
                {user.isOnline && (
                  <TouchableOpacity 
                    style={styles.avatarOnlineDot}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setOnlineTooltipVisible(true);
                      setTimeout(() => setOnlineTooltipVisible(false), 2000);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.avatarOnlineDotInner} />
                    {onlineTooltipVisible && (
                      <View style={styles.onlineTooltip}>
                        <Text style={styles.onlineTooltipText}>{displayProfile.handle} is online</Text>
                        <View style={styles.onlineTooltipArrow} />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.userInfoContainer}>
                <View style={styles.handleRow}>
                  <Text style={styles.name}>{displayProfile.name}</Text>
                  {displayProfile.verified && (
                    <View style={styles.verifiedBadge}>
                      <Check size={10} color="#FFF" strokeWidth={4} />
                    </View>
                  )}
                </View>
                <Text style={styles.handle}>{displayProfile.handle}</Text>
              </View>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity 
                style={[styles.followButton, { backgroundColor: isFollowing ? '#334155' : accentColor }]}
                onPress={() => setIsFollowing(!isFollowing)}
            >
                {isFollowing ? (
                <Text style={[styles.followButtonText, styles.followingButtonText]}>Following</Text>
                ) : (
                <>
                    <UserPlus size={16} color="#000" />
                    <Text style={styles.followButtonText}>Follow</Text>
                </>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconButton}>
              <MessageCircle size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.borderFrameContainer}>
              {/* Collection button row */}
              <View style={styles.collectionRow}>
                <TouchableOpacity 
                  style={[styles.collectionButton, { borderColor: accentColor }]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push('/collections');
                  }}
                  activeOpacity={0.8}
                >
                  <FolderHeart size={14} color={accentColor} />
                  <Text style={[styles.collectionButtonText, { color: accentColor }]}>Collections</Text>
                </TouchableOpacity>
                <LinearGradient
                  colors={[accentColor, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.topBorderRight}
                />
              </View>
              
              {/* Border frame with curved corner */}
              <View style={styles.borderFrame}>
                {/* Curved corner piece */}
                <View style={[styles.curvedCorner, { borderColor: accentColor }]} />
                
                {/* Top border extending from corner */}
                <LinearGradient
                  colors={[accentColor, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.topBorderFromCorner}
                />
                
                {/* Left border extending from corner */}
                <LinearGradient
                  colors={[accentColor, 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.leftBorderFromCorner}
                />
              </View>
              
              {/* Content inside frame */}
              <View style={styles.frameContent}>
                <Text style={styles.memberSince}>Member since {displayProfile.joined}</Text>
                <Text style={styles.bio}>{displayProfile.bio}</Text>

                <View>
                  <View style={styles.statsRow}>
                    <Text style={styles.statText}><Text style={styles.statBold}>{displayProfile.stats.clips}</Text> Clips</Text>
                    <Text style={styles.statText}><Text style={styles.statBold}>{displayProfile.stats.followers}</Text> Followers</Text>
                    <Text style={styles.statText}><Text style={styles.statBold}>{displayProfile.stats.following}</Text> Following</Text>
                    <TouchableOpacity 
                      onPress={() => {
                        setIsEngagementExpanded(!isEngagementExpanded);
                        Animated.timing(rotateAnim, {
                          toValue: isEngagementExpanded ? 0 : 1,
                          duration: 200,
                          useNativeDriver: true,
                        }).start();
                      }}
                      style={styles.dropdownButton}
                    >
                      <Animated.View
                        style={{
                          transform: [
                            {
                              rotate: rotateAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '180deg'],
                              }),
                            },
                          ],
                        }}
                      >
                        <ChevronDown size={16} color="#94A3B8" />
                      </Animated.View>
                    </TouchableOpacity>
                  </View>

                  {isEngagementExpanded && (
                    <View style={styles.engagementContainer}>
                      <LinearGradient
                        colors={['rgba(34, 197, 94, 0.15)', 'rgba(34, 197, 94, 0.05)']}
                        style={styles.engagementGradient}
                      >
                        <View style={styles.engagementRow}>
                          <TouchableOpacity 
                            style={styles.engagementItem}
                            onPress={() => setTooltipVisible('likes')}
                            activeOpacity={0.7}
                          >
                            <View style={styles.engagementIconWrapper}>
                              <Heart size={16} color="#F472B6" fill="#F472B6" />
                            </View>
                            <Text style={styles.engagementValue}>{displayProfile.engagement.likes}</Text>
                            {tooltipVisible === 'likes' && (
                              <View style={styles.tooltip}>
                                <Text style={styles.tooltipText}>Likes</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.engagementItem}
                            onPress={() => setTooltipVisible('flame')}
                            activeOpacity={0.7}
                          >
                            <View style={styles.engagementIconWrapper}>
                              <Flame size={16} color="#FB923C" fill="#FB923C" />
                            </View>
                            <Text style={styles.engagementValue}>{displayProfile.engagement.fires}</Text>
                            {tooltipVisible === 'flame' && (
                              <View style={styles.tooltip}>
                                <Text style={styles.tooltipText}>Flames</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.engagementItem}
                            onPress={() => setTooltipVisible('streak')}
                            activeOpacity={0.7}
                          >
                            <View style={styles.engagementIconWrapper}>
                              <Zap size={16} color="#FBBF24" fill="#FBBF24" />
                            </View>
                            <Text style={styles.engagementValue}>{displayProfile.engagement.streak} days</Text>
                            {tooltipVisible === 'streak' && (
                              <View style={styles.tooltip}>
                                <Text style={styles.tooltipText}>Streak</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        </View>
                      </LinearGradient>
                    </View>
                  )}
                </View>
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
                </View>
              ) : (
                clips.map((clip) => (
                  <TouchableOpacity 
                    key={clip.id} 
                    style={styles.clipItem}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
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
            <View style={styles.grid}>
              {reels.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <View style={styles.emptyStateIcon}>
                    <Play size={48} color="#475569" />
                  </View>
                  <Text style={styles.emptyStateTitle}>No reels found</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    No reels have been uploaded yet.
                  </Text>
                </View>
              ) : (
                reels.map((reel) => (
                  <TouchableOpacity 
                      key={reel.id} 
                      style={styles.reelItem}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
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
                </View>
              ) : (
                screenshots.map((item) => (
                  <View key={item.id} style={styles.screenshotCard}>
                    <Image source={{ uri: getScreenshotThumbnail(item) }} style={styles.screenshotImage} />
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
                  </View>
                ))
              )}
            </View>
          )}
          
          {activeTab === 'Favorites' && (
            <View style={styles.grid}>
              {favoriteGames.map((game) => (
                <TouchableOpacity key={game.id} style={styles.clipItem} activeOpacity={0.8}>
                    <Image source={{ uri: getImageUrl(game.imageUrl) }} style={styles.clipImage} resizeMode="cover" />
                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.9)']}
                        style={styles.clipGradient}
                    />
                    <View style={styles.clipBottom}>
                        <Text style={styles.clipTitle} numberOfLines={2}>{game.name}</Text>
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

      <Modal
        visible={tooltipVisible !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setTooltipVisible(null)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setTooltipVisible(null)}
        />
      </Modal>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: -80,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    marginBottom: 16,
    position: 'relative',
    marginTop: 10,
  },
  onlineStatusAbsolute: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 10,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarContainer: {
    width: 114,
    height: 114,
    borderRadius: 57,
    borderWidth: 4,
    borderColor: '#0F1520',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 114,
    height: 114,
    borderRadius: 57,
    resizeMode: 'cover',
  },
  userInfoContainer: {
    flex: 1,
    justifyContent: 'center',
    height: 114,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  levelContainer: {
    position: 'absolute',
    bottom: -12,
    alignSelf: 'center',
    zIndex: 10,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  followButtonText: {
    color: '#002E15',
    fontWeight: 'bold',
    fontSize: 14,
  },
  followingButtonText: {
    color: '#FFF',
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoSection: {
    marginTop: 0,
  },
  borderFrameContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  topBorderRight: {
    flex: 1,
    height: 2,
    marginLeft: 8,
  },
  collectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  collectionButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  borderFrame: {
    position: 'absolute',
    left: 0,
    top: 40,
    width: 20,
    height: 130,
  },
  curvedCorner: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 16,
    height: 16,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 16,
    backgroundColor: 'transparent',
  },
  topBorderFromCorner: {
    position: 'absolute',
    left: 14,
    top: 0,
    width: 60,
    height: 2,
  },
  leftBorderFromCorner: {
    position: 'absolute',
    left: 0,
    top: 14,
    width: 2,
    height: 110,
  },
  frameContent: {
    paddingLeft: 16,
    paddingTop: 4,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  handle: {
    fontSize: 16,
    color: '#94A3B8',
    marginRight: 8,
  },
  verifiedBadge: {
    backgroundColor: '#3B82F6',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  dropdownButton: {
    padding: 4,
    marginLeft: 8,
  },
  statText: {
    color: '#94A3B8',
    marginRight: 16,
    fontSize: 14,
  },
  statBold: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  engagementContainer: {
    marginBottom: 12,
    marginTop: 8,
  },
  engagementGradient: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.2)',
  },
  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  engagementItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  engagementIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
    fontSize: 16,
    fontWeight: '700',
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
    justifyContent: 'flex-start',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 40,
  },
  clipItem: {
    width: (width - 32 - 12) / 2,
    aspectRatio: 16/10,
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
  onlineStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    gap: 6,
  },
  onlineStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  onlineStatusText: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '600',
  },
  gamefolioButton: {
    position: 'absolute',
    top: 60,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  avatarOnlineDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0F1520',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  avatarOnlineDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
  },
  onlineTooltip: {
    position: 'absolute',
    top: -40,
    left: '50%',
    transform: [{ translateX: -60 }],
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 1000,
    minWidth: 120,
  },
  onlineTooltipText: {
    color: '#22C55E',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  onlineTooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: '50%',
    marginLeft: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(0, 0, 0, 0.9)',
  },
});
