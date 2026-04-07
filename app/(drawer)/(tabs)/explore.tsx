import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  Keyboard,
  Platform,
  RefreshControl,
  ScrollView,
  FlatList,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, X, Play } from 'lucide-react-native';

import { useRouter } from 'expo-router';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api, TwitchGame } from '@/lib/api';

import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';
import LevelDetailsModal from '@/components/LevelDetailsModal';

interface Game {
  id: string;
  name: string;
  boxArt?: string;
  icon?: string;
}


const { width } = Dimensions.get('window');
const HORIZONTAL_PADDING = 16;

const formatTwitchBoxArt = (url: string | undefined, width: number = 285, height: number = 380): string | undefined => {
  if (!url) return undefined;
  return url.replace('{width}', String(width)).replace('{height}', String(height));
};

const getGameImageUrl = (game: Game | TwitchGame) => {
  if (!game) return undefined;
  const boxArt = typeof game === 'object' && game && 'boxArt' in game ? game.boxArt : undefined;
  const icon = typeof game === 'object' && game && 'icon' in game ? game.icon : undefined;
  return formatTwitchBoxArt(boxArt, 285, 380) || formatTwitchBoxArt(icon, 285, 380) || boxArt || icon;
};

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLevelModalVisible, setIsLevelModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);


  const searchInputRef = useRef<TextInput>(null);
  const { getAccessToken, user } = useAuth();
  const router = useRouter();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  

  const topGamesQuery = useInfiniteQuery({
    queryKey: ['games', 'top'],
    queryFn: async ({ pageParam }) => {
      try {
        const token = await getAccessToken();
        console.log('[Explore] Fetching top games, cursor:', pageParam);
        const result = await api.games.getTopGames(20, token || undefined, pageParam);
        console.log('[Explore] Received top games:', result.games?.length, 'nextCursor:', result.nextCursor);
        return result;
      } catch (error) {
        console.log('[Explore] API error:', error);
        return { games: [], nextCursor: undefined };
      }
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5 * 60 * 1000,
  });
  const { refetch: refetchTopGames, fetchNextPage, hasNextPage, isFetchingNextPage } = topGamesQuery;

  const allGames = React.useMemo(() => 
    topGamesQuery.data?.pages.flatMap(page => page.games) || []
  , [topGamesQuery.data?.pages]);

  const searchQuery_api = useQuery({
    queryKey: ['games', 'search', debouncedSearch],
    queryFn: async () => {
      const trimmedSearch = debouncedSearch?.trim() || '';
      if (!trimmedSearch || trimmedSearch.length === 0) {
        console.log('[Explore] Skipping API search - empty query');
        return { games: [] as TwitchGame[] };
      }
      try {
        const token = await getAccessToken();
        console.log('[Explore] Searching games via API:', trimmedSearch);
        const result = await api.games.searchGames(trimmedSearch, 50, token || undefined);
        console.log('[Explore] API search returned:', result.games?.length, 'games');
        return result;
      } catch (error) {
        console.error('[Explore] Search API error:', error);
        return { games: [] as TwitchGame[] };
      }
    },
    enabled: !!debouncedSearch && debouncedSearch.trim().length > 0,
    staleTime: 30 * 1000,
  });


  const apiSearchResults = React.useMemo(() => 
    searchQuery_api.data?.games || []
  , [searchQuery_api.data?.games]);

  useEffect(() => {
    console.log('[Explore] Query States:', {
      topGames: { loading: topGamesQuery.isLoading, error: !!topGamesQuery.error, data: allGames.length },
    });

    if (topGamesQuery.error) {
      console.error('[Explore] Top games error:', topGamesQuery.error);
    }
  }, [
    topGamesQuery.isLoading, topGamesQuery.error, allGames.length,
  ]);

  const handleScroll = useCallback((event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 300;
    
    if (isCloseToBottom && hasNextPage && !isFetchingNextPage && !searchQuery.trim()) {
      console.log('[Explore] Loading more games...');
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, searchQuery]);

  

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchTopGames();
    setRefreshing(false);
  }, [refetchTopGames]);
  
  const handleGamePress = useCallback((game: Game | TwitchGame) => {
    console.log('[Explore] Selected game:', game.name);
    Keyboard.dismiss();
    const imageUrl = getGameImageUrl(game);
    router.push({ 
      pathname: '/game/[id]', 
      params: { 
        id: game.id.toString(),
        name: game.name,
        boxArt: imageUrl || '',
      } 
    });
  }, [router]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);



  const displayedGames = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return allGames;
    }
    
    // Filter local games that match the search
    const localFiltered = allGames.filter(game => 
      game.name.toLowerCase().includes(query)
    );
    
    // Always prioritize API results when available, then add unique local matches
    if (apiSearchResults.length > 0) {
      const apiIds = new Set(apiSearchResults.map(g => g.id));
      const localOnly = localFiltered.filter(g => !apiIds.has(g.id));
      // Put API results first (they're more relevant), then local matches
      const combined = [...apiSearchResults, ...localOnly];
      console.log('[Explore] Combined results:', combined.length, '(api:', apiSearchResults.length, ', local unique:', localOnly.length, ')');
      return combined;
    }
    
    // If API search is still loading, show local filtered as preview
    // Once API returns, it will update automatically
    if (searchQuery_api.isLoading) {
      console.log('[Explore] API loading, showing local filtered:', localFiltered.length);
      return localFiltered;
    }
    
    // API finished but no results - just show local filtered
    console.log('[Explore] Local filtered games:', localFiltered.length, 'for query:', query);
    return localFiltered;
  }, [searchQuery, allGames, apiSearchResults, searchQuery_api.isLoading]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#131F2A', '#061021']}
        style={StyleSheet.absoluteFill}
      />
      
      <AppHeader onOpenLevelTracker={() => setIsLevelModalVisible(true)} />

      <View style={styles.contentHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Explore Games</Text>
          <Text style={styles.subtitle}>Browse games and discover amazing content from the community</Text>
        </View>
        
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Search color="#64748B" size={18} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search games..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
                <X color="#64748B" size={16} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {topGamesQuery.isLoading && !searchQuery.trim() ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#4ADE80" size="large" />
          <Text style={styles.loadingText}>Loading games...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={400}
          onScrollBeginDrag={() => {
            Keyboard.dismiss();
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4ADE80"
              colors={['#4ADE80']}
            />
          }
        >
          {searchQuery.trim().length > 0 ? (
            <>
              {searchQuery_api.isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#4ADE80" size="large" />
                  <Text style={styles.loadingText}>Searching...</Text>
                </View>
              ) : displayedGames.length > 0 ? (
                <View style={styles.gamesGrid}>
                  {displayedGames.map((game, index) => {
                    if (!game) return null;
                    const imageUrl = getGameImageUrl(game);
                    return (
                      <TouchableOpacity
                        key={`${game.id}-${index}`}
                        style={styles.gameCard}
                        onPress={() => handleGamePress(game)}
                        activeOpacity={0.7}
                      >
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={styles.gameImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.gameImagePlaceholder}>
                            <Play color="#4ADE80" size={24} />
                          </View>
                        )}
                        <View style={styles.gameInfo}>
                          <Text style={styles.gameName} numberOfLines={2}>{game.name}</Text>
                          <Text style={styles.gameSubtext}>Tap to explore</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIcon}>
                    <Search size={40} color="#4ADE80" />
                  </View>
                  <Text style={styles.emptyTitle}>No games found</Text>
                  <Text style={styles.emptyMessage}>Try searching for a different game title</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.gamesGrid}>
              {displayedGames.map((game, index) => {
                if (!game) return null;
                const imageUrl = getGameImageUrl(game);
                return (
                  <TouchableOpacity
                    key={`${game.id}-${index}`}
                    style={styles.gameCard}
                    onPress={() => handleGamePress(game)}
                    activeOpacity={0.7}
                  >
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        style={styles.gameImage}
                        resizeMode="cover"
                        onError={(e) => {
                          console.log('[Explore] Image load error for', game.name, ':', e.nativeEvent.error);
                        }}
                      />
                    ) : (
                      <View style={styles.gameImagePlaceholder}>
                        <Play color="#4ADE80" size={24} />
                      </View>
                    )}
                    <View style={styles.gameInfo}>
                      <Text style={styles.gameName} numberOfLines={2}>{game.name}</Text>
                      <Text style={styles.gameSubtext}>Tap to explore</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {isFetchingNextPage && !searchQuery.trim() && (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator color="#4ADE80" size="small" />
              <Text style={styles.loadMoreText}>Loading more games...</Text>
            </View>
          )}
        </ScrollView>
      )}

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
    backgroundColor: '#131F2A',
  },
  contentHeader: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 16,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  searchContainer: {
    position: 'relative',
    zIndex: 20,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    height: '100%',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
    }),
  },
  clearButton: {
    padding: 6,
    marginLeft: 4,
  },
  searchDropdown: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    backgroundColor: '#1E2D3C',
    borderRadius: 12,
    maxHeight: 400,
    borderWidth: 1,
    borderColor: '#2D3748',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      },
    }),
  },
  searchResultsList: {
    maxHeight: 350,
  },
  searchSectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2D3748',
  },
  searchResultIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#2D3748',
  },
  searchResultIconRound: {
    borderRadius: 22,
  },
  searchResultIconHash: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  searchResultCategory: {
    fontSize: 12,
    color: '#64748B',
  },
  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  searchLoadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  noResults: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  noResultsText: {
    color: '#64748B',
    fontSize: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 5,
    top: 240,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  errorIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4ADE80',
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#131F2A',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 100,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFF',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 20,
  },
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingBottom: 100,
    gap: 10,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  gameCard: {
    width: '47%',
    backgroundColor: '#1E2D3C',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    marginHorizontal: '1.5%',
  },
  gameImage: {
    width: '100%',
    aspectRatio: 0.75,
    backgroundColor: '#2D3748',
  },
  gameImagePlaceholder: {
    width: '100%',
    aspectRatio: 0.75,
    backgroundColor: '#2D3748',
    justifyContent: 'center',
    alignItems: 'center',
  },

  gameInfo: {
    padding: 12,
  },
  gameName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  gameSubtext: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#64748B',
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#4ADE8022',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#4ADE8044',
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#4ADE80',
    letterSpacing: 0.5,
  },
  titleContainer: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  usersGrid: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 8,
  },
  searchTabsScroll: {
    maxHeight: 48,
  },
  searchTabsContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  searchTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  searchTabActive: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  searchTabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  searchTabTextActive: {
    color: '#131F2A',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 10,
  },
  mediaCard: {
    width: '47%',
    backgroundColor: '#1E2D3C',
    borderRadius: 10,
    overflow: 'hidden',
  },
  mediaThumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#2D3748',
  },
  mediaOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    padding: 4,
  },
  mediaInfo: {
    padding: 8,
  },
  mediaTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  mediaSubtext: {
    fontSize: 11,
    color: '#64748B',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2D3C',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2D3748',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userDisplayName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 13,
    color: '#64748B',
  },
});


