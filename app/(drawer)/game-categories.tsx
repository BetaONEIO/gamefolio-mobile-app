import { LinearGradient } from 'expo-linear-gradient';
import { Gamepad2, Search, X, ChevronRight, Grid, List, TrendingUp } from 'lucide-react-native';
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api, type TwitchGame } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';

const CATEGORIES = [
  { key: 'action', label: 'Action', emoji: '⚔️', color: '#EF4444' },
  { key: 'adventure', label: 'Adventure', emoji: '🗺️', color: '#F97316' },
  { key: 'rpg', label: 'RPG', emoji: '🧙', color: '#A855F7' },
  { key: 'shooter', label: 'Shooter', emoji: '🔫', color: '#3B82F6' },
  { key: 'strategy', label: 'Strategy', emoji: '♟️', color: '#6366F1' },
  { key: 'sports', label: 'Sports', emoji: '⚽', color: '#22C55E' },
  { key: 'simulation', label: 'Simulation', emoji: '🏙️', color: '#14B8A6' },
  { key: 'racing', label: 'Racing', emoji: '🏎️', color: '#F59E0B' },
  { key: 'fighting', label: 'Fighting', emoji: '🥊', color: '#EF4444' },
  { key: 'platformer', label: 'Platformer', emoji: '🎮', color: '#4ADE80' },
  { key: 'puzzle', label: 'Puzzle', emoji: '🧩', color: '#60A5FA' },
  { key: 'horror', label: 'Horror', emoji: '👻', color: '#475569' },
  { key: 'battle-royale', label: 'Battle Royale', emoji: '🏆', color: '#FACC15' },
  { key: 'indie', label: 'Indie', emoji: '🎨', color: '#F472B6' },
  { key: 'mmo', label: 'MMO', emoji: '🌐', color: '#34D399' },
];

export default function GameCategoriesScreen() {
  const router = useRouter();
  const { authTokens } = useAuth();
  const token = authTokens?.accessToken;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const topGamesQuery = useQuery({
    queryKey: ['top-games'],
    queryFn: () => api.games.getTopGames(50, token),
    staleTime: 300000,
  });

  const searchQuery = useQuery({
    queryKey: ['search-games', search],
    queryFn: () => api.games.searchGames(search, 20, token),
    enabled: search.length > 1,
    staleTime: 30000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await topGamesQuery.refetch();
    setRefreshing(false);
  }, []);

  const topGames: TwitchGame[] = topGamesQuery.data?.games ?? [];
  const searchResults: TwitchGame[] = search.length > 1 ? (searchQuery.data?.games ?? []) : [];

  const filteredGames = search.length > 1
    ? searchResults
    : selectedCategory
    ? topGames.filter((g) =>
        g.category?.toLowerCase().includes(selectedCategory) ||
        g.name.toLowerCase().includes(selectedCategory)
      )
    : topGames;

  const handleGamePress = (game: TwitchGame) => {
    router.push(`/game/${game.id}` as any);
  };

  const selectedCat = CATEGORIES.find((c) => c.key === selectedCategory);

  const renderGameCard = ({ item }: { item: TwitchGame }) => (
    <TouchableOpacity
      style={styles.gameCard}
      onPress={() => handleGamePress(item)}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: item.boxArt || item.icon || '' }}
        style={styles.gameImage}
        contentFit="cover"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.gameGradient}
      />
      <View style={styles.gameInfo}>
        <Text style={styles.gameName} numberOfLines={2}>{item.name}</Text>
        {item.players && (
          <View style={styles.gamePlayers}>
            <TrendingUp size={10} color="#4ADE80" />
            <Text style={styles.gamePlayersText}>{(item.players / 1000).toFixed(0)}K</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#021B1F', '#000000']} style={StyleSheet.absoluteFill} />
      <AppHeader />

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ADE80" />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Gamepad2 size={26} color="#4ADE80" />
          <Text style={styles.headerTitle}>Browse Games</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={18} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search games..."
            placeholderTextColor="#475569"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Grid */}
        {search.length === 0 && (
          <>
            <Text style={styles.sectionTitle}>Categories</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.key;
                return (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.categoryCard, isActive && { borderColor: cat.color, backgroundColor: `${cat.color}15` }]}
                    onPress={() => setSelectedCategory(isActive ? null : cat.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                    <Text style={[styles.categoryLabel, isActive && { color: cat.color }]}>{cat.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Active category header */}
        {selectedCategory && !search && (
          <View style={styles.activeCategoryHeader}>
            <Text style={styles.activeCategoryEmoji}>{selectedCat?.emoji}</Text>
            <Text style={[styles.activeCategoryTitle, { color: selectedCat?.color }]}>
              {selectedCat?.label} Games
            </Text>
            <TouchableOpacity onPress={() => setSelectedCategory(null)} style={styles.clearCategoryBtn}>
              <X size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        )}

        {/* Games Grid */}
        <Text style={styles.sectionTitle}>
          {search.length > 1 ? `Results for "${search}"` : selectedCategory ? `${selectedCat?.label} Games` : 'Top Games'}
        </Text>

        {(topGamesQuery.isLoading && !search) || (search.length > 1 && searchQuery.isLoading) ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#4ADE80" size="large" />
            <Text style={styles.loadingText}>Loading games...</Text>
          </View>
        ) : filteredGames.length === 0 ? (
          <View style={styles.emptyBox}>
            <Gamepad2 size={40} color="#334155" />
            <Text style={styles.emptyTitle}>No games found</Text>
            <Text style={styles.emptySub}>Try a different search or category</Text>
          </View>
        ) : (
          <View style={styles.gamesGrid}>
            {filteredGames.map((game) => renderGameCard({ item: game }))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  headerTitle: { fontSize: 26, fontWeight: 'bold' as const, color: '#FFF' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },

  sectionTitle: {
    fontSize: 16, fontWeight: 'bold' as const, color: '#FFF',
    paddingHorizontal: 16, marginBottom: 12,
  },

  categoryGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 20,
  },
  categoryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  categoryEmoji: { fontSize: 16 },
  categoryLabel: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },

  activeCategoryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  activeCategoryEmoji: { fontSize: 22 },
  activeCategoryTitle: { flex: 1, fontSize: 18, fontWeight: 'bold' as const },
  clearCategoryBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },

  gamesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 10,
  },
  gameCard: {
    width: '47%', aspectRatio: 0.75,
    borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)',
  },
  gameImage: { width: '100%', height: '100%', position: 'absolute' },
  gameGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' },
  gameInfo: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10 },
  gameName: { fontSize: 13, fontWeight: '700', color: '#FFF', lineHeight: 16 },
  gamePlayers: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  gamePlayersText: { fontSize: 11, color: '#4ADE80', fontWeight: '600' },

  loadingBox: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },
  emptyBox: { alignItems: 'center', paddingVertical: 48, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#94A3B8' },
  emptySub: { fontSize: 14, color: '#475569', textAlign: 'center' as const },
});
