import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image, TextInput, Animated, Keyboard, Platform, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Bell, Menu, Plus, Search, ChevronLeft, X, Hash, User, Gamepad2, BadgeCheck, Gift } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter, useSegments } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import ProfileDropdown from '@/components/ProfileDropdown';
import NotificationDropdown from '@/components/NotificationDropdown';
import UploadDropdown from '@/components/UploadDropdown';
import DailyLootboxModal from '@/components/DailyLootboxModal';
import { Env } from '@/constants/Env';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { api, getEffectiveAvatarUrl } from '@/lib/api';

interface AppHeaderProps {
  showBackButton?: boolean;
  onOpenLevelTracker?: () => void;
  hideProfile?: boolean;
  hideUpload?: boolean;
}

interface Hashtag {
  id: string;
  name: string;
  count: number;
}

interface UserResult {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  verified: boolean;
  followers: number;
}

interface Game {
  id: string;
  name: string;
  icon: string;
  category: string;
  players: number;
}

interface SearchResponse {
  hashtags: Hashtag[];
  users: UserResult[];
  games: Game[];
}

function getBackendUrl(): string {
  if (Env.BACKEND_URL) {
    return Env.BACKEND_URL;
  }
  if (typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    if (origin && origin !== 'null') {
      return origin;
    }
  }
  return '';
}

const mockHashtags = [
  { id: '1', name: 'valorant', count: 15420 },
  { id: '2', name: 'fortnite', count: 12300 },
  { id: '3', name: 'apex', count: 9800 },
  { id: '4', name: 'csgo', count: 8500 },
  { id: '5', name: 'leagueoflegends', count: 7200 },
  { id: '6', name: 'minecraft', count: 6800 },
  { id: '7', name: 'overwatch', count: 5400 },
  { id: '8', name: 'rocketleague', count: 4200 },
  { id: '9', name: 'callofduty', count: 3900 },
  { id: '10', name: 'gta', count: 3500 },
];

// No mock users - only real users from database will be shown

const mockGames = [
  { id: '1', name: 'Valorant', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-100x100.jpg', category: 'FPS', players: 450000 },
  { id: '2', name: 'Fortnite', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-100x100.jpg', category: 'Battle Royale', players: 380000 },
  { id: '3', name: 'League of Legends', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/21779-100x100.jpg', category: 'MOBA', players: 320000 },
  { id: '4', name: 'Apex Legends', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/511224-100x100.jpg', category: 'Battle Royale', players: 280000 },
  { id: '5', name: 'Minecraft', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/27471-100x100.jpg', category: 'Sandbox', players: 250000 },
];

async function searchAll(query: string, limit: number): Promise<SearchResponse> {
  const baseUrl = getBackendUrl();
  
  console.log('[Search] Backend URL:', baseUrl);
  console.log('[Search] Env.BACKEND_URL:', Env.BACKEND_URL);
  
  if (!baseUrl) {
    console.log('[Search] No backend URL, using local mock data');
    return searchMockData(query, limit);
  }
  
  console.log('[Search] Fetching search results for:', query);
  const url = `${baseUrl}/api/search?query=${encodeURIComponent(query)}&limit=${limit}`;
  console.log('[Search] Request URL:', url);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log('[Search] Response status:', response.status);
    const contentType = response.headers.get('content-type');
    console.log('[Search] Content-Type:', contentType);
    
    const text = await response.text();
    console.log('[Search] Raw response (first 300 chars):', text.substring(0, 300));
    
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html') || text.startsWith('<')) {
      console.log('[Search] Received HTML, falling back to mock data');
      return searchMockData(query, limit);
    }
    
    if (!response.ok) {
      console.log('[Search] Error response, falling back to mock data');
      return searchMockData(query, limit);
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.log('[Search] Failed to parse JSON, falling back to mock data');
      return searchMockData(query, limit);
    }
    
    console.log('[Search] Data received:', JSON.stringify(data).substring(0, 200));
    
    return {
      hashtags: (data.hashtags || data.tags || []).map((tag: any) => ({
        id: tag.id?.toString() || tag.name,
        name: tag.name || tag.tag || '',
        count: tag.count || tag.postCount || 0,
      })),
      users: (data.users || []).map((user: any) => ({
        id: user.id?.toString() || '',
        username: user.username || '',
        displayName: user.displayName || user.display_name || user.username || '',
        avatar: user.avatarUrl || user.avatar_url || user.avatar || '',
        verified: user.verified || user.isVerified || false,
        followers: user.followers || user._count?.followers || 0,
      })),
      games: (data.games || []).map((game: any) => ({
        id: game.id?.toString() || game.twitchId || '',
        name: game.name || '',
        icon: game.icon || game.imageUrl || game.box_art_url?.replace('{width}', '100').replace('{height}', '100') || '',
        category: game.category || 'Game',
        players: game.players || 0,
      })),
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.log('[Search] Request timed out, falling back to mock data');
    } else {
      console.log('[Search] Error:', error?.message || error, ', falling back to mock data');
    }
    return searchMockData(query, limit);
  }
}

function searchMockData(query: string, limit: number): SearchResponse {
  const searchTerm = query.toLowerCase();
  
  const hashtags = mockHashtags
    .filter(tag => tag.name.toLowerCase().includes(searchTerm))
    .slice(0, limit);
    
  // No mock users - return empty array, real users come from backend
  const users: UserResult[] = [];
    
  const games = mockGames
    .filter(game => game.name.toLowerCase().includes(searchTerm))
    .slice(0, limit);
    
  console.log('[Search] Mock results (users always empty - real users from backend):', { hashtags: hashtags.length, users: users.length, games: games.length });
  
  return { hashtags, users, games };
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

export default function AppHeader({ showBackButton = false, onOpenLevelTracker, hideProfile = false, hideUpload = false }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { user, getAccessToken } = useAuth();
  const { unreadCount, markAllRead, fetchNotifications } = useNotifications();

  const { data: selfProfile } = useQuery({
    queryKey: ['/api/users', user?.username, 'profile'],
    queryFn: async () => {
      if (!user?.username) return null;
      const token = await getAccessToken();
      return api.users.getProfile(user.username, token ?? undefined);
    },
    enabled: !!user?.username,
    staleTime: 5 * 60 * 1000,
  });
  const [isProfileDropdownVisible, setIsProfileDropdownVisible] = useState(false);
  const [isNotificationDropdownVisible, setIsNotificationDropdownVisible] = useState(false);
  const [isUploadDropdownVisible, setIsUploadDropdownVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isLootboxModalVisible, setIsLootboxModalVisible] = useState(false);

  const lootboxStatusQuery = useQuery({
    queryKey: ['lootbox-status', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.lootbox.getStatus(token);
    },
    staleTime: 60 * 1000,
    enabled: !!user,
  });

  const lootboxCanOpen = lootboxStatusQuery.data?.canOpen ?? false;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchAnimation = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);
  const navigation = useNavigation();
  const router = useRouter();
  const segments = useSegments();
  
  const isInsideDrawer = segments[0] === '(drawer)';

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchResults = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchAll(debouncedQuery, 8),
    enabled: debouncedQuery.length >= 1,
    staleTime: 30000,
  });

  useEffect(() => {
    if (debouncedQuery) {
      console.log('[Search] Querying for:', debouncedQuery);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    if (searchResults.data) {
      console.log('[Search] Query results:', JSON.stringify(searchResults.data));
    }
    if (searchResults.error) {
      console.error('[Search] Query error:', searchResults.error);
    }
    console.log('[Search] Results state:', {
      isLoading: searchResults.isLoading,
      isError: searchResults.isError,
      hasData: !!searchResults.data,
    });
  }, [searchResults.data, searchResults.error, searchResults.isLoading, searchResults.isError]);

  const openSearch = () => {
    setIsSearchVisible(true);
    Animated.spring(searchAnimation, {
      toValue: 1,
      useNativeDriver: false,
      tension: 100,
      friction: 10,
    }).start(() => {
      searchInputRef.current?.focus();
    });
  };

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    Animated.spring(searchAnimation, {
      toValue: 0,
      useNativeDriver: false,
      tension: 100,
      friction: 10,
    }).start(() => {
      setIsSearchVisible(false);
      setSearchQuery('');
      setDebouncedQuery('');
    });
  }, [searchAnimation]);

  const handleHashtagPress = useCallback((hashtag: Hashtag) => {
    router.push(`/tag/${hashtag.name}`);
    closeSearch();
  }, [router, closeSearch]);

  const handleUserPress = useCallback((user: UserResult) => {
    router.push(`/user/${user.id}`);
    closeSearch();
  }, [router, closeSearch]);

  const handleGamePress = useCallback((game: Game) => {
    router.push(`/game/${game.id}`);
    closeSearch();
  }, [router, closeSearch]);

  const searchBarOpacity = searchAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 1],
  });

  const headerHeight = insets.top + 70;

  const hasResults = searchResults.data && (
    searchResults.data.hashtags.length > 0 ||
    searchResults.data.users.length > 0 ||
    searchResults.data.games.length > 0
  );

  const showDropdown = debouncedQuery.length > 0;

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          {showBackButton ? (
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => router.back()}
            >
              <ChevronLeft size={24} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => {
                if (isInsideDrawer) {
                  navigation.dispatch(DrawerActions.openDrawer());
                } else {
                  router.back();
                }
              }}
            >
              {isInsideDrawer ? (
                <Menu size={24} color="#FFF" />
              ) : (
                <ChevronLeft size={24} color="#FFF" />
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton} onPress={openSearch}>
            <Search size={24} color="#FFF" />
          </TouchableOpacity>

          {!!user && (
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setIsLootboxModalVisible(true)}
            >
              <View style={styles.giftWrapper}>
                <Gift size={24} color={lootboxCanOpen ? '#A855F7' : '#FFF'} />
                {lootboxCanOpen ? (
                  <View style={styles.lootboxAvailableDot} />
                ) : null}
              </View>
            </TouchableOpacity>
          )}
      
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setIsNotificationDropdownVisible(true)}
          >
            <View style={styles.bellWrapper}>
              <Bell size={24} color="#FFF" />
              {unreadCount > 0 ? (
                <View style={[styles.notificationBadge, unreadCount > 9 ? styles.notificationBadgeWide : null]}>
                  <Text style={styles.notificationText} numberOfLines={1}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>

          {!hideUpload && (
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setIsUploadDropdownVisible(true)}
            >
              <Plus size={24} color="#000" />
            </TouchableOpacity>
          )}

          {!hideProfile && (
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={() => setIsProfileDropdownVisible(true)}
              activeOpacity={1}
            >
              <ExpoImage
                source={{ uri: getEffectiveAvatarUrl(selfProfile?.user) || getEffectiveAvatarUrl(user) || undefined }}
                placeholder={{ uri: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?q=80&w=100&auto=format&fit=crop' }}
                contentFit="cover"
                style={styles.avatar}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal
        visible={isSearchVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSearch}
      >
        <View style={styles.modalContainer}>
          <Animated.View 
            style={[
              StyleSheet.absoluteFill, 
              { opacity: searchAnimation }
            ]}
            pointerEvents="none"
          >
            {Platform.OS !== 'web' ? (
              <BlurView 
                intensity={100} 
                tint="dark" 
                style={StyleSheet.absoluteFill}
              >
                <View style={styles.darkOverlay} />
              </BlurView>
            ) : (
              <View style={styles.webBlurFallback} />
            )}
          </Animated.View>
          
          <TouchableOpacity 
            style={StyleSheet.absoluteFill} 
            activeOpacity={1} 
            onPress={closeSearch}
          />

          <Animated.View 
            style={[
              styles.searchContainer,
              {
                top: headerHeight,
                opacity: searchBarOpacity,
                transform: [{
                  translateY: searchAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  })
                }]
              }
            ]}
          >
            <View style={styles.searchInputWrapper}>
              <Search size={18} color="#64748B" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search #hashtags, users, games..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={18} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.cancelButton} onPress={closeSearch}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>

          {showDropdown && (
            <Animated.View 
              style={[
                styles.resultsDropdown,
                {
                  top: headerHeight + 56,
                  opacity: searchBarOpacity,
                }
              ]}
            >
              <ScrollView 
                style={styles.resultsScroll}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {searchResults.isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#4ADE80" />
                    <Text style={styles.loadingText}>Searching...</Text>
                  </View>
                ) : hasResults ? (
                  <>
                    <View style={styles.resultSection}>
                      <View style={styles.sectionHeader}>
                        <Hash size={14} color="#64748B" />
                        <Text style={styles.sectionTitle}>Hashtags</Text>
                      </View>
                      {searchResults.data?.hashtags && searchResults.data.hashtags.length > 0 ? (
                        searchResults.data.hashtags.map((hashtag) => (
                          <TouchableOpacity
                            key={hashtag.id}
                            style={styles.resultItem}
                            onPress={() => handleHashtagPress(hashtag)}
                          >
                            <View style={styles.hashtagIcon}>
                              <Hash size={16} color="#4ADE80" />
                            </View>
                            <View style={styles.resultInfo}>
                              <Text style={styles.resultName}>#{hashtag.name}</Text>
                              <Text style={styles.resultMeta}>{formatNumber(hashtag.count)} posts</Text>
                            </View>
                          </TouchableOpacity>
                        ))
                      ) : (
                        <TouchableOpacity
                          style={styles.resultItem}
                          onPress={() => handleHashtagPress({ id: debouncedQuery, name: debouncedQuery.replace(/^#/, ''), count: 0 })}
                        >
                          <View style={styles.hashtagIcon}>
                            <Hash size={16} color="#4ADE80" />
                          </View>
                          <View style={styles.resultInfo}>
                            <Text style={styles.resultName}>Search for #{debouncedQuery.replace(/^#/, '')}</Text>
                            <Text style={styles.resultMeta}>View all posts</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>

                    {searchResults.data?.users && searchResults.data.users.length > 0 && (
                      <View style={styles.resultSection}>
                        <View style={styles.sectionHeader}>
                          <User size={14} color="#64748B" />
                          <Text style={styles.sectionTitle}>Users</Text>
                        </View>
                        {searchResults.data.users.map((user) => (
                          <TouchableOpacity
                            key={user.id}
                            style={styles.resultItem}
                            onPress={() => handleUserPress(user)}
                          >
                            <Image source={{ uri: user.avatar }} style={styles.userAvatar} />
                            <View style={styles.resultInfo}>
                              <View style={styles.usernameRow}>
                                <Text style={styles.resultName}>{user.displayName}</Text>
                                {user.verified && (
                                  <BadgeCheck size={14} color="#4ADE80" style={styles.verifiedBadge} />
                                )}
                              </View>
                              <Text style={styles.resultMeta}>@{user.username} · {formatNumber(user.followers)} followers</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {searchResults.data?.games && searchResults.data.games.length > 0 && (
                      <View style={styles.resultSection}>
                        <View style={styles.sectionHeader}>
                          <Gamepad2 size={14} color="#64748B" />
                          <Text style={styles.sectionTitle}>Games</Text>
                        </View>
                        {searchResults.data.games.map((game) => (
                          <TouchableOpacity
                            key={game.id}
                            style={styles.resultItem}
                            onPress={() => handleGamePress(game)}
                          >
                            <Image source={{ uri: game.icon }} style={styles.gameIcon} />
                            <View style={styles.resultInfo}>
                              <Text style={styles.resultName}>{game.name}</Text>
                              <Text style={styles.resultMeta}>{game.category} · {formatNumber(game.players)} players</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </>
                ) : debouncedQuery.length > 0 ? (
                  <View style={styles.resultSection}>
                    <View style={styles.sectionHeader}>
                      <Hash size={14} color="#64748B" />
                      <Text style={styles.sectionTitle}>Hashtags</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.resultItem}
                      onPress={() => handleHashtagPress({ id: debouncedQuery, name: debouncedQuery.replace(/^#/, ''), count: 0 })}
                    >
                      <View style={styles.hashtagIcon}>
                        <Hash size={16} color="#4ADE80" />
                      </View>
                      <View style={styles.resultInfo}>
                        <Text style={styles.resultName}>Search for #{debouncedQuery.replace(/^#/, '')}</Text>
                        <Text style={styles.resultMeta}>View all posts</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </ScrollView>
            </Animated.View>
          )}
        </View>
      </Modal>

      <ProfileDropdown 
        visible={isProfileDropdownVisible}
        onClose={() => setIsProfileDropdownVisible(false)}
        topOffset={insets.top + 60}
        onOpenLevelTracker={onOpenLevelTracker}
      />

      <NotificationDropdown 
        visible={isNotificationDropdownVisible}
        onClose={() => setIsNotificationDropdownVisible(false)}
        topOffset={insets.top + 60}
        onOpen={() => {
          fetchNotifications();
          markAllRead();
        }}
      />

      <UploadDropdown 
        visible={isUploadDropdownVisible}
        onClose={() => setIsUploadDropdownVisible(false)}
        topOffset={insets.top + 60}
      />

      <DailyLootboxModal
        visible={isLootboxModalVisible}
        onClose={() => setIsLootboxModalVisible(false)}
        onClaimed={() => {
          lootboxStatusQuery.refetch();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
    backgroundColor: '#0F1520',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 8,
    overflow: 'visible',
  },
  bellWrapper: {
    width: 24,
    height: 24,
    overflow: 'visible',
  },
  giftWrapper: {
    width: 24,
    height: 24,
    overflow: 'visible',
  },
  lootboxAvailableDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
    borderWidth: 1.5,
    borderColor: '#0F1520',
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#4ADE80',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: '#0F1520',
  },
  notificationBadgeWide: {
    minWidth: 20,
    borderRadius: 9,
  },
  notificationText: {
    color: '#002E15',
    fontSize: 10,
    fontWeight: 'bold' as const,
    lineHeight: 12,
  },
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    marginLeft: 4,
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 10,
    overflow: 'hidden',
  },
  avatar: {
    width: 36,
    height: 36,
  },
  modalContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  webBlurFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 21, 32, 0.85)',
    backdropFilter: 'blur(40px)',
  },
  searchContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 101,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 15,
    paddingVertical: 0,
    height: 44,
    textAlignVertical: 'center' as const,
    outlineStyle: 'none' as const,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelText: {
    color: '#4ADE80',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  resultsDropdown: {
    position: 'absolute',
    left: 20,
    right: 20,
    maxHeight: 400,
    backgroundColor: '#0D1117',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    zIndex: 102,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  resultsScroll: {
    maxHeight: 400,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
    backgroundColor: '#0D1117',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  resultSection: {
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0A0E14',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#151D2E',
  },
  hashtagIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  gameIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  resultMeta: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 2,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
    backgroundColor: '#0D1117',
  },
  noResultsText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 8,
  },
  noResultsSubtext: {
    color: '#64748B',
    fontSize: 14,
  },
});
