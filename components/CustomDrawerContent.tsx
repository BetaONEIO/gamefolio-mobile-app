import { useAuth } from '@/context/AuthContext';
import { useUser } from '@/context/UserContext';
import { DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import { useRouter, usePathname } from 'expo-router';
import { 
  X, 
  Search, 
  Flame, 
  Trophy, 
  MessageSquare, 
  User, 
  LogOut,
  Home,
  Leaf,
  ShoppingBag,
  Wallet,
  Layers,
  Settings,
  Plus,
  Hash,
  Gamepad2,
  BadgeCheck
} from 'lucide-react-native';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, Image, Animated, LayoutChangeEvent, Pressable, ActivityIndicator, Keyboard, ScrollView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddGamesModal from '@/components/AddGamesModal';
import { useQuery } from '@tanstack/react-query';
import { Env } from '@/constants/Env';

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

type NavItemProps = {
  icon: React.ElementType;
  label: string;
  onPress: () => void;
  isActive?: boolean;
};

const mockHashtags = [
  { id: '1', name: 'valorant', count: 15420 },
  { id: '2', name: 'fortnite', count: 12300 },
  { id: '3', name: 'apex', count: 9800 },
  { id: '4', name: 'csgo', count: 8500 },
  { id: '5', name: 'leagueoflegends', count: 7200 },
];

const mockUsers = [
  { id: '1', username: 'ProGamer123', displayName: 'Pro Gamer', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100', verified: true, followers: 125000 },
  { id: '2', username: 'NinjaStreamer', displayName: 'Ninja Streamer', avatar: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=100', verified: true, followers: 89000 },
  { id: '3', username: 'GameMaster', displayName: 'Game Master', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100', verified: false, followers: 45000 },
];

const mockGames = [
  { id: '1', name: 'Valorant', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-100x100.jpg', category: 'FPS', players: 450000 },
  { id: '2', name: 'Fortnite', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/33214-100x100.jpg', category: 'Battle Royale', players: 380000 },
  { id: '3', name: 'League of Legends', icon: 'https://static-cdn.jtvnw.net/ttv-boxart/21779-100x100.jpg', category: 'MOBA', players: 320000 },
];

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

function searchMockData(query: string, limit: number): SearchResponse {
  const searchTerm = query.toLowerCase();
  
  const hashtags = mockHashtags
    .filter(tag => tag.name.toLowerCase().includes(searchTerm))
    .slice(0, limit);
    
  const users = mockUsers
    .filter(user => 
      user.username.toLowerCase().includes(searchTerm) || 
      user.displayName.toLowerCase().includes(searchTerm)
    )
    .slice(0, limit);
    
  const games = mockGames
    .filter(game => game.name.toLowerCase().includes(searchTerm))
    .slice(0, limit);
    
  return { hashtags, users, games };
}

async function searchAll(query: string, limit: number): Promise<SearchResponse> {
  const baseUrl = getBackendUrl();
  
  if (!baseUrl) {
    console.log('[Drawer Search] No backend URL, using mock data');
    return searchMockData(query, limit);
  }
  
  console.log('[Drawer Search] Fetching search results for:', query);
  const url = `${baseUrl}/api/search?query=${encodeURIComponent(query)}&limit=${limit}`;
  
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
    
    const text = await response.text();
    
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html') || text.startsWith('<')) {
      console.log('[Drawer Search] Received HTML, falling back to mock data');
      return searchMockData(query, limit);
    }
    
    if (!response.ok) {
      console.log('[Drawer Search] Error response, falling back to mock data');
      return searchMockData(query, limit);
    }
    
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.log('[Drawer Search] Failed to parse JSON, falling back to mock data');
      return searchMockData(query, limit);
    }
    
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
      console.log('[Drawer Search] Request timed out, falling back to mock data');
    } else {
      console.log('[Drawer Search] Error:', error?.message || error, ', falling back to mock data');
    }
    return searchMockData(query, limit);
  }
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

  const NavItem = ({ icon: Icon, label, onPress, isActive }: NavItemProps) => {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
      <Pressable 
        style={[
          styles.navItem, 
          isActive && styles.navItemActive,
          isHovered && styles.navItemHovered
        ]} 
        onPress={onPress}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
      >
        <View style={styles.navItemContent}>
          <Icon size={24} color="#4ADE80" strokeWidth={2} />
          <Text style={[styles.navItemLabel, isActive && styles.navItemLabelActive]}>
            {label}
          </Text>
        </View>
      </Pressable>
    );
  };

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout: authLogout } = useAuth();
  const { favoriteGames, logout: userLogout } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const [contentHeight, setContentHeight] = useState(0);
  const [visibleHeight, setVisibleHeight] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showGamesModal, setShowGamesModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  const navigate = (path: string) => {
    router.push(path as any);
    props.navigation.closeDrawer();
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchResults = useQuery({
    queryKey: ['drawer-search', debouncedQuery],
    queryFn: () => searchAll(debouncedQuery, 5),
    enabled: debouncedQuery.length > 0,
  });

  const handleHashtagPress = useCallback((hashtag: Hashtag) => {
    Keyboard.dismiss();
    setIsSearchFocused(false);
    setSearchQuery('');
    setDebouncedQuery('');
    props.navigation.closeDrawer();
    router.push(`/tag/${hashtag.name}`);
  }, [router, props.navigation]);

  const handleUserPress = useCallback((user: UserResult) => {
    Keyboard.dismiss();
    setIsSearchFocused(false);
    setSearchQuery('');
    setDebouncedQuery('');
    props.navigation.closeDrawer();
    router.push(`/user/${user.id}`);
  }, [router, props.navigation]);

  const handleGamePress = useCallback((game: Game) => {
    Keyboard.dismiss();
    setIsSearchFocused(false);
    setSearchQuery('');
    setDebouncedQuery('');
    props.navigation.closeDrawer();
    router.push(`/game/${game.id}`);
  }, [router, props.navigation]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  const hasResults = searchResults.data && (
    searchResults.data.hashtags.length > 0 ||
    searchResults.data.users.length > 0 ||
    searchResults.data.games.length > 0
  );

  const showDropdown = debouncedQuery.length > 0;

  const indicatorSize = visibleHeight > 0 && contentHeight > 0 && contentHeight > visibleHeight
    ? (visibleHeight / contentHeight) * visibleHeight
    : 0;
    
  const difference = visibleHeight > indicatorSize ? visibleHeight - indicatorSize : 1;
  
  const scrollRange = contentHeight > visibleHeight ? contentHeight - visibleHeight : 1;
  
  const scrollIndicatorPosition = Animated.multiply(
    scrollY,
    visibleHeight / (contentHeight || 1)
  ).interpolate({
    inputRange: [0, scrollRange],
    outputRange: [0, difference],
    extrapolate: 'clamp'
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
         <TouchableOpacity 
            style={styles.logoContainer}
            onPress={() => navigate('/(drawer)/(tabs)/home')}
            activeOpacity={0.7}
          >
            <Image 
              source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bpo9i1ux8et2igcgnomrk' }}
              style={{ width: 32, height: 32 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        <TouchableOpacity onPress={() => props.navigation.closeDrawer()} style={styles.closeButton}>
          <X size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        {isSearchFocused && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {Platform.OS !== 'web' ? (
              <BlurView 
                intensity={40} 
                tint="dark" 
                style={StyleSheet.absoluteFill}
              >
                <View style={styles.searchOverlay} />
              </BlurView>
            ) : (
              <View style={styles.searchOverlayWeb} />
            )}
          </View>
        )}
        <View style={styles.searchInputContainer}>
          <TextInput 
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Search #hashtags, users, games..."
            placeholderTextColor="#64748B"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            returnKeyType="search"
          />
          <View style={styles.searchIconContainer}>
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <X size={18} color="#64748B" />
              </TouchableOpacity>
            ) : (
              <Search size={20} color="#64748B" />
            )}
          </View>
        </View>
        
        {isSearchFocused && showDropdown && (
          <View style={styles.searchDropdown}>
            <ScrollView 
              style={styles.searchResultsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.isLoading ? (
                <View style={styles.searchLoading}>
                  <ActivityIndicator color="#4ADE80" size="small" />
                  <Text style={styles.searchLoadingText}>Searching...</Text>
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
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* User Profile */}
      <TouchableOpacity 
        style={styles.userProfile}
        onPress={() => navigate('/(drawer)/(tabs)/profile')}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: user?.avatarUrl || 'https://images.unsplash.com/photo-1642436855380-00dccba82294?w=400&auto=format&fit=crop&q=60' }}
              style={styles.avatar}
            />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.displayName || user?.username || 'User'}</Text>
          <Text style={styles.userHandle}>@{user?.username || 'user'}</Text>
        </View>
      </TouchableOpacity>
      
      <View style={styles.divider} />

      <View style={{ flex: 1, position: 'relative' }}>
        <DrawerContentScrollView 
          {...props} 
          contentContainerStyle={styles.scrollContent}
          onLayout={(e: LayoutChangeEvent) => setVisibleHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(w: number, h: number) => setContentHeight(h)}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          
        {/* Main Navigation */}
        <View style={styles.section}>
          <NavItem 
            icon={Home}
            label="Home"
            onPress={() => navigate('/(drawer)/(tabs)/home')}
            isActive={pathname.includes('/home')}
          />
          <NavItem 
            icon={Leaf}
            label="Explore"
            onPress={() => navigate('/(drawer)/(tabs)/explore')}
            isActive={pathname.includes('/explore')}
          />
          <NavItem 
            icon={Flame}
            label="Trending"
            onPress={() => navigate('/(drawer)/(tabs)/trending')}
            isActive={pathname.includes('trending')}
          />
          <NavItem 
            icon={Trophy}
            label="Leaderboard"
            onPress={() => navigate('/(drawer)/(tabs)/leaderboard')}
            isActive={pathname.includes('leaderboard')}
          />
          <NavItem 
            icon={ShoppingBag}
            label="Store"
            onPress={() => navigate('/(drawer)/store')}
            isActive={pathname.includes('store')}
          />
          <NavItem 
            icon={Wallet}
            label="Wallet"
            onPress={() => navigate('/(drawer)/wallet')}
            isActive={pathname.includes('wallet')}
          />
          <NavItem 
            icon={Layers}
            label="Collections"
            onPress={() => navigate('/(drawer)/collections')}
            isActive={pathname.includes('collections')}
          />
          <NavItem 
            icon={MessageSquare}
            label="Messages"
            onPress={() => navigate('/(drawer)/messages')} 
            isActive={pathname.includes('messages')} 
          />
          <NavItem 
            icon={User}
            label="My Gamefolio"
            onPress={() => navigate('/(drawer)/(tabs)/profile')}
            isActive={pathname.includes('profile')}
          />
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderText}>SETTINGS</Text>
          <NavItem 
            icon={Settings}
            label="Account Settings"
            onPress={() => navigate('/account-settings')}
            isActive={pathname.includes('account-settings')}
          />
          <NavItem 
            icon={User}
            label="Profile & Appearance"
            onPress={() => navigate('/profile-appearance')}
            isActive={pathname.includes('profile-appearance')}
          />
        </View>

        {/* Your Games Section */}
        <View style={styles.section}>
          <View style={styles.gamesHeaderRow}>
            <Text style={styles.sectionHeaderText}>YOUR GAMES</Text>
            <TouchableOpacity 
              style={styles.addGameButton}
              onPress={() => setShowGamesModal(true)}
            >
              <Plus size={16} color="#4ADE80" />
            </TouchableOpacity>
          </View>
          {favoriteGames.length > 0 ? (
            favoriteGames.map((game) => (
              <TouchableOpacity 
                key={game.id} 
                style={styles.gameItem}
                onPress={() => {}}
              >
                <Image 
                  source={{ uri: game.box_art_url.replace('{width}', '52').replace('{height}', '72') }}
                  style={styles.gameBoxArt}
                />
                <Text style={styles.gameName} numberOfLines={1}>{game.name}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <TouchableOpacity 
              style={styles.addGamesPrompt}
              onPress={() => setShowGamesModal(true)}
            >
              <Text style={styles.addGamesText}>Add your favorite games</Text>
            </TouchableOpacity>
          )}
        </View>

      </DrawerContentScrollView>
      
      {/* Custom Scrollbar */}
      {contentHeight > visibleHeight && (
        <View style={styles.scrollbarTrack}>
          <Animated.View 
            style={[
              styles.scrollbarThumb,
              {
                height: indicatorSize,
                transform: [{ translateY: scrollIndicatorPosition }]
              }
            ]}
          />
        </View>
      )}
      </View>

      {/* Logout Button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={styles.logoutButton} onPress={async () => {
          props.navigation.closeDrawer();
          await authLogout();
          await userLogout();
          router.replace('/');
        }}>
            <LogOut size={20} color="#002E15" style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <AddGamesModal 
        visible={showGamesModal} 
        onClose={() => setShowGamesModal(false)} 
      />
    </View>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    width: '100%',
  },
  logoContainer: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: 8,
  },
  scrollContent: {
    paddingTop: 10,
  },
  searchContainer: {
    marginHorizontal: 20,
    paddingVertical: 16,
    position: 'relative',
    zIndex: 100,
  },
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  searchOverlayWeb: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 20, 0.85)',
  },
  searchInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    color: '#FFF',
    fontSize: 14,
  },
  searchIconContainer: {
    paddingHorizontal: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  clearButton: {
    padding: 2,
  },
  searchDropdown: {
    position: 'absolute' as const,
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#0D1117',
    borderRadius: 12,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 200,
  },
  searchResultsList: {
    maxHeight: 400,
  },
  resultSection: {
    paddingBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
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
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
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
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  searchLoading: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 24,
    gap: 10,
  },
  searchLoadingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  noResults: {
    paddingVertical: 24,
    alignItems: 'center' as const,
  },
  noResultsText: {
    color: '#64748B',
    fontSize: 13,
  },
  section: {
    marginBottom: 24,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 4,
    paddingHorizontal: 12, 
    height: 48,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#152C24', 
  },
  navItemHovered: {
    backgroundColor: '#152C24',
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navItemLabel: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
  navItemLabelActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  scrollbarTrack: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollbarThumb: {
    width: 4,
    backgroundColor: '#4ADE80',
    borderRadius: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  logoutButton: {
    backgroundColor: '#4ADE80',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16, // Taller button
    borderRadius: 8,
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutText: {
    color: '#002E15',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionHeaderText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 8,
    marginTop: 0,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4ADE80',
    overflow: 'hidden',
    marginRight: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    justifyContent: 'center',
  },
  userName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userHandle: {
    color: '#64748B',
    fontSize: 14,
  },
  gamesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  addGameButton: {
    padding: 4,
  },
  gameItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  gameBoxArt: {
    width: 32,
    height: 44,
    borderRadius: 4,
    backgroundColor: '#1E293B',
  },
  gameName: {
    color: '#FFF',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  addGamesPrompt: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  addGamesText: {
    color: '#64748B',
    fontSize: 14,
  },
});
