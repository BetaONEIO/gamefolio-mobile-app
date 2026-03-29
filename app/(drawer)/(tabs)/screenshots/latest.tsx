import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  Modal, Pressable, ActivityIndicator, RefreshControl,
  TextInput, ScrollView, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Heart, Flame, MessageSquare, ChevronDown, X, Search,
  Gamepad2, Share2, Eye, ArrowLeft, Camera,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, type Screenshot } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 16 * 2 - 10) / 2;

type Period = 'recent' | '1w' | '1m' | 'ever';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: '1w', label: '1 Week' },
  { key: '1m', label: '1 Month' },
  { key: 'ever', label: 'All Time' },
];

function formatTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function LatestScreenshotsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { authTokens, user } = useAuth();
  const queryClient = useQueryClient();
  const token = authTokens?.accessToken;

  const [period, setPeriod] = useState<Period>('recent');
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [showGameFilter, setShowGameFilter] = useState(false);
  const [gameSearch, setGameSearch] = useState('');
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  const screenshotsQuery = useQuery({
    queryKey: ['screenshots', 'latest', period, selectedGameId],
    queryFn: () =>
      api.screenshots.getTrending({ period, limit: 60, gameId: selectedGameId ?? undefined }, token),
    staleTime: 30000,
  });

  const gamesQuery = useQuery({
    queryKey: ['top-games-filter'],
    queryFn: () => api.games.getTopGames(30, token),
    staleTime: 300000,
  });

  const likeMutation = useMutation({
    mutationFn: async (id: number) => {
      if (!token) throw new Error('Not authenticated');
      return api.screenshots.like(String(id), token);
    },
    onSuccess: (data, id) => {
      queryClient.setQueryData(['screenshots', 'latest', period, selectedGameId], (old: Screenshot[] | undefined) =>
        old?.map((s) => s.id === id ? { ...s, isLiked: data.liked, _count: { ...s._count, likes: data.likeCount } } : s)
      );
    },
  });

  const fireMutation = useMutation({
    mutationFn: async (ss: Screenshot) => {
      if (!token || !user) throw new Error('Not authenticated');
      return api.screenshots.toggleFire(String(ss.id), token, user.id, !!ss.isFired);
    },
    onSuccess: (data, ss) => {
      queryClient.setQueryData(['screenshots', 'latest', period, selectedGameId], (old: Screenshot[] | undefined) =>
        old?.map((s) => s.id === ss.id ? { ...s, isFired: data.fired, _count: { ...s._count, fires: data.fireCount } } : s)
      );
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await screenshotsQuery.refetch();
    setRefreshing(false);
  }, [period, selectedGameId]);

  const screenshots = screenshotsQuery.data ?? [];
  const allGames = gamesQuery.data?.games ?? [];
  const filteredGames = gameSearch
    ? allGames.filter((g) => g.name.toLowerCase().includes(gameSearch.toLowerCase()))
    : allGames;
  const selectedGame = allGames.find((g) => g.id === String(selectedGameId));

  const openViewer = (ss: Screenshot) => {
    setSelectedScreenshot(ss);
    setShowViewer(true);
  };

  const renderCard = ({ item }: { item: Screenshot }) => (
    <TouchableOpacity style={styles.card} onPress={() => openViewer(item)} activeOpacity={0.9}>
      <Image
        source={{ uri: item.imageUrl || item.thumbnailUrl }}
        style={styles.cardImage}
        contentFit="cover"
      />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardGradient} />

      {/* Game badge */}
      {item.game && (
        <View style={styles.gameBadge}>
          <Text style={styles.gameBadgeText} numberOfLines={1}>{item.game.name}</Text>
        </View>
      )}

      {/* Bottom info */}
      <View style={styles.cardBottom}>
        <View style={styles.cardUser}>
          {item.user?.avatarUrl ? (
            <Image source={{ uri: item.user.avatarUrl }} style={styles.cardAvatar} />
          ) : (
            <View style={[styles.cardAvatar, { backgroundColor: '#334155' }]} />
          )}
          <Text style={styles.cardUsername} numberOfLines={1}>@{item.user?.username}</Text>
        </View>
        <View style={styles.cardStats}>
          <Heart size={11} color="#F87171" />
          <Text style={styles.cardStatText}>{item._count?.likes ?? 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderViewer = () => {
    if (!selectedScreenshot) return null;
    const ss = selectedScreenshot;
    return (
      <Modal visible={showViewer} transparent animationType="fade" onRequestClose={() => setShowViewer(false)}>
        <View style={styles.viewerContainer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowViewer(false)} />

          {/* Close */}
          <TouchableOpacity style={styles.viewerClose} onPress={() => setShowViewer(false)}>
            <X size={22} color="#FFF" />
          </TouchableOpacity>

          {/* Image */}
          <View style={styles.viewerImageContainer}>
            <Image source={{ uri: ss.imageUrl }} style={styles.viewerImage} contentFit="contain" />
          </View>

          {/* Info panel */}
          <View style={styles.viewerInfo}>
            {/* User */}
            <TouchableOpacity
              style={styles.viewerUser}
              onPress={() => { setShowViewer(false); router.push(`/user/${ss.user?.username}` as any); }}
            >
              {ss.user?.avatarUrl && (
                <Image source={{ uri: ss.user.avatarUrl }} style={styles.viewerAvatar} />
              )}
              <View>
                <Text style={styles.viewerDisplayName}>{ss.user?.displayName}</Text>
                <Text style={styles.viewerHandle}>@{ss.user?.username}</Text>
              </View>
            </TouchableOpacity>

            {/* Title / description */}
            {ss.title && <Text style={styles.viewerTitle}>{ss.title}</Text>}
            {ss.description && <Text style={styles.viewerDesc}>{ss.description}</Text>}

            {/* Meta */}
            <View style={styles.viewerMeta}>
              {ss.game && (
                <View style={styles.viewerMetaBadge}>
                  <Gamepad2 size={12} color="#94A3B8" />
                  <Text style={styles.viewerMetaText}>{ss.game.name}</Text>
                </View>
              )}
              <View style={styles.viewerMetaBadge}>
                <Eye size={12} color="#94A3B8" />
                <Text style={styles.viewerMetaText}>{ss.views} views</Text>
              </View>
              <Text style={styles.viewerTime}>{formatTimeAgo(ss.createdAt)}</Text>
            </View>

            {/* Actions */}
            <View style={styles.viewerActions}>
              <TouchableOpacity
                style={[styles.viewerAction, ss.isLiked && styles.viewerActionActive]}
                onPress={() => likeMutation.mutate(ss.id)}
              >
                <Heart size={20} color={ss.isLiked ? '#F87171' : '#94A3B8'} fill={ss.isLiked ? '#F87171' : 'none'} />
                <Text style={[styles.viewerActionText, ss.isLiked && { color: '#F87171' }]}>
                  {ss._count?.likes ?? 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewerAction, ss.isFired && styles.viewerActionActive]}
                onPress={() => fireMutation.mutate(ss)}
              >
                <Flame size={20} color={ss.isFired ? '#FB923C' : '#94A3B8'} fill={ss.isFired ? '#FB923C' : 'none'} />
                <Text style={[styles.viewerActionText, ss.isFired && { color: '#FB923C' }]}>
                  {ss._count?.fires ?? 0}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.viewerAction}>
                <MessageSquare size={20} color="#94A3B8" />
                <Text style={styles.viewerActionText}>{ss._count?.comments ?? 0}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#021B1F', '#000000']} style={StyleSheet.absoluteFill} />
      <AppHeader />

      {/* Header */}
      <View style={styles.header}>
        <Camera size={22} color="#4ADE80" />
        <Text style={styles.headerTitle}>Latest Screenshots</Text>
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        {/* Period filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScroll}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodTab, period === p.key && styles.periodTabActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodTabText, period === p.key && styles.periodTabTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Game filter */}
        <TouchableOpacity style={styles.gameFilterBtn} onPress={() => setShowGameFilter(true)}>
          <Gamepad2 size={14} color={selectedGameId ? '#4ADE80' : '#94A3B8'} />
          <Text style={[styles.gameFilterText, selectedGameId && { color: '#4ADE80' }]} numberOfLines={1}>
            {selectedGame ? selectedGame.name : 'All Games'}
          </Text>
          <ChevronDown size={14} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {screenshotsQuery.isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#4ADE80" size="large" />
          <Text style={styles.loadingText}>Loading screenshots...</Text>
        </View>
      ) : screenshots.length === 0 ? (
        <View style={styles.emptyBox}>
          <Camera size={48} color="#334155" />
          <Text style={styles.emptyTitle}>No screenshots yet</Text>
          <Text style={styles.emptySub}>Be the first to upload a screenshot!</Text>
        </View>
      ) : (
        <FlatList
          data={screenshots}
          keyExtractor={(item) => String(item.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          renderItem={renderCard}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ADE80" />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Game filter modal */}
      <Modal visible={showGameFilter} transparent animationType="slide" onRequestClose={() => setShowGameFilter(false)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setShowGameFilter(false)}>
          <Pressable style={styles.sheetCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filter by Game</Text>

            <View style={styles.sheetSearch}>
              <Search size={16} color="#64748B" />
              <TextInput
                style={styles.sheetSearchInput}
                placeholder="Search games..."
                placeholderTextColor="#475569"
                value={gameSearch}
                onChangeText={setGameSearch}
              />
              {gameSearch.length > 0 && (
                <TouchableOpacity onPress={() => setGameSearch('')}><X size={16} color="#64748B" /></TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.gameOption, !selectedGameId && styles.gameOptionActive]}
                onPress={() => { setSelectedGameId(null); setShowGameFilter(false); }}
              >
                <Text style={[styles.gameOptionText, !selectedGameId && styles.gameOptionTextActive]}>All Games</Text>
                {!selectedGameId && <View style={styles.gameOptionDot} />}
              </TouchableOpacity>

              {filteredGames.map((g) => {
                const isActive = String(selectedGameId) === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.gameOption, isActive && styles.gameOptionActive]}
                    onPress={() => {
                      setSelectedGameId(Number(g.id));
                      setShowGameFilter(false);
                    }}
                  >
                    {g.boxArt && <Image source={{ uri: g.boxArt }} style={styles.gameOptionImg} contentFit="cover" />}
                    <Text style={[styles.gameOptionText, isActive && styles.gameOptionTextActive]} numberOfLines={1}>
                      {g.name}
                    </Text>
                    {isActive && <View style={styles.gameOptionDot} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {renderViewer()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: 'bold' as const, color: '#FFF' },

  filtersRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  periodScroll: { gap: 8, flex: 1 },
  periodTab: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  periodTabActive: { backgroundColor: '#4ADE80', borderColor: '#4ADE80' },
  periodTabText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  periodTabTextActive: { color: '#002E15' },

  gameFilterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    maxWidth: 130,
  },
  gameFilterText: { fontSize: 12, color: '#94A3B8', fontWeight: '500', flex: 1 },

  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  row: { gap: 10, marginBottom: 10 },

  card: {
    width: CARD_WIDTH, borderRadius: 14, overflow: 'hidden',
    backgroundColor: '#1E293B', borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)',
    aspectRatio: 1.3,
  },
  cardImage: { width: '100%', height: '100%', position: 'absolute' },
  cardGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
  gameBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, maxWidth: '75%',
  },
  gameBadgeText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  cardBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', padding: 8,
  },
  cardUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardAvatar: { width: 18, height: 18, borderRadius: 9 },
  cardUsername: { fontSize: 10, color: '#E2E8F0', fontWeight: '600', flex: 1 },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardStatText: { fontSize: 10, color: '#E2E8F0', fontWeight: '600' },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#64748B', fontSize: 14 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#94A3B8' },
  emptySub: { fontSize: 14, color: '#475569', textAlign: 'center' as const },

  // Viewer
  viewerContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' },
  viewerClose: {
    position: 'absolute', top: 50, right: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  viewerImageContainer: { flex: 1, justifyContent: 'center' },
  viewerImage: { width: '100%', height: '100%' },
  viewerInfo: {
    backgroundColor: 'rgba(15,23,42,0.95)', paddingHorizontal: 16, paddingBottom: 32,
    paddingTop: 16, gap: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(51,65,85,0.5)',
  },
  viewerUser: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewerAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#334155' },
  viewerDisplayName: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  viewerHandle: { fontSize: 12, color: '#64748B' },
  viewerTitle: { fontSize: 15, fontWeight: '600', color: '#E2E8F0' },
  viewerDesc: { fontSize: 13, color: '#94A3B8' },
  viewerMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  viewerMetaBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewerMetaText: { fontSize: 12, color: '#64748B' },
  viewerTime: { fontSize: 12, color: '#475569', marginLeft: 'auto' },
  viewerActions: { flexDirection: 'row', gap: 16 },
  viewerAction: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  viewerActionActive: { borderColor: 'rgba(74,222,128,0.3)' },
  viewerActionText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },

  // Game filter sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheetCard: {
    backgroundColor: '#0F172A', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '70%',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#334155',
    alignSelf: 'center', marginBottom: 16,
  },
  sheetTitle: { fontSize: 18, fontWeight: 'bold' as const, color: '#FFF', marginBottom: 14 },
  sheetSearch: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetSearchInput: { flex: 1, color: '#FFF', fontSize: 14 },
  gameOption: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)',
  },
  gameOptionActive: {},
  gameOptionImg: { width: 28, height: 36, borderRadius: 4 },
  gameOptionText: { flex: 1, fontSize: 14, color: '#94A3B8' },
  gameOptionTextActive: { color: '#4ADE80', fontWeight: '600' },
  gameOptionDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80',
  },
});
