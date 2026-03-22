import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Search, Gamepad2, ChevronRight, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { api } from '@/lib/api';
import AppHeader from '@/components/AppHeader';

const CATEGORIES = [
  { id: 'action', label: 'Action', color: '#EF4444', emoji: 'A' },
  { id: 'fps', label: 'First-Person Shooter', color: '#F97316', emoji: 'F' },
  { id: 'rpg', label: 'RPG', color: '#8B5CF6', emoji: 'R' },
  { id: 'strategy', label: 'Strategy', color: '#3B82F6', emoji: 'S' },
  { id: 'sports', label: 'Sports', color: '#10B981', emoji: 'SP' },
  { id: 'racing', label: 'Racing', color: '#F59E0B', emoji: 'RC' },
  { id: 'moba', label: 'MOBA', color: '#6366F1', emoji: 'M' },
  { id: 'battle-royale', label: 'Battle Royale', color: '#EC4899', emoji: 'BR' },
  { id: 'horror', label: 'Horror', color: '#991B1B', emoji: 'H' },
  { id: 'adventure', label: 'Adventure', color: '#059669', emoji: 'AV' },
  { id: 'simulation', label: 'Simulation', color: '#0891B2', emoji: 'SI' },
  { id: 'puzzle', label: 'Puzzle', color: '#D97706', emoji: 'PZ' },
  { id: 'fighting', label: 'Fighting', color: '#DC2626', emoji: 'FG' },
  { id: 'sandbox', label: 'Sandbox', color: '#16A34A', emoji: 'SB' },
  { id: 'mmorpg', label: 'MMORPG', color: '#7C3AED', emoji: 'MM' },
  { id: 'indie', label: 'Indie', color: '#0284C7', emoji: 'I' },
];

export default function GameCategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [search, setSearch] = useState('');

  const { data: games = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/games'],
    queryFn: () => api.games?.getAll ? api.games.getAll() : Promise.resolve([]),
  });

  const filtered = CATEGORIES.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase())
  );

  const renderCategory = ({ item }: { item: typeof CATEGORIES[0] }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: '/(drawer)/(tabs)/explore', params: { category: item.id } })}
      testID={`button-category-${item.id}`}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.color + '22' }]}>
        <Text style={[styles.iconText, { color: item.color }]}>{item.emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardLabel}>{item.label}</Text>
        <Text style={styles.cardSub}>Browse {item.label} clips & reels</Text>
      </View>
      <ChevronRight size={18} color="#4A5568" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <AppHeader title="Game Categories" />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderCategory}
        contentContainerStyle={{ paddingTop: headerHeight + 16, paddingBottom: insets.bottom + 24, paddingHorizontal: 16 }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ListHeaderComponent={
          <View style={styles.searchWrap}>
            <Search size={16} color="#4A5568" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search categories..."
              placeholderTextColor="#4A5568"
              value={search}
              onChangeText={setSearch}
              testID="input-category-search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <X size={16} color="#4A5568" />
              </TouchableOpacity>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Gamepad2 size={40} color="#2D3F55" />
            <Text style={styles.emptyText}>No categories found</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C1821' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#131F2A', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#1E293B', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 13, fontWeight: '800' },
  cardLabel: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  cardSub: { color: '#4A5568', fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 48, gap: 12 },
  emptyText: { color: '#4A5568', fontSize: 15 },
});
