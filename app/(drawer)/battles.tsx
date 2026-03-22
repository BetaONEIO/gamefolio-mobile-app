import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Swords, RefreshCw, Star, Trophy, Zap, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48 - 12) / 2;

interface BattleUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level?: number;
  totalXP?: number;
}

type VoteResult = 'left' | 'right' | null;

export default function BattlesScreen() {
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const router = useRouter();

  const [pairIndex, setPairIndex] = useState(0);
  const [voted, setVoted] = useState<VoteResult>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [battleCount, setBattleCount] = useState(0);
  const leftAnim = useRef(new Animated.Value(1)).current;
  const rightAnim = useRef(new Animated.Value(1)).current;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['battles', 'random-users'],
    queryFn: async () => {
      const token = await getAccessToken();
      try {
        return await api.users.getRandom(20, token || undefined);
      } catch {
        return [] as BattleUser[];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const users = Array.isArray(data) ? data : [];
  const pairs = [];
  for (let i = 0; i + 1 < users.length; i += 2) {
    pairs.push([users[i], users[i + 1]]);
  }

  const currentPair = pairs[pairIndex] || null;
  const left = currentPair?.[0] || null;
  const right = currentPair?.[1] || null;

  const handleVote = useCallback((side: 'left' | 'right') => {
    if (voted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const winner = side === 'left' ? left : right;
    if (winner) {
      setScores(prev => ({ ...prev, [winner.id]: (prev[winner.id] || 0) + 1 }));
    }
    setVoted(side);

    const winAnim = side === 'left' ? leftAnim : rightAnim;
    const loseAnim = side === 'left' ? rightAnim : leftAnim;
    Animated.parallel([
      Animated.spring(winAnim, { toValue: 1.05, useNativeDriver: true }),
      Animated.spring(loseAnim, { toValue: 0.93, useNativeDriver: true }),
    ]).start();

    setBattleCount(c => c + 1);
  }, [voted, left, right, leftAnim, rightAnim]);

  const handleNext = useCallback(() => {
    Haptics.selectionAsync();
    leftAnim.setValue(1);
    rightAnim.setValue(1);
    setVoted(null);
    if (pairIndex + 1 < pairs.length) {
      setPairIndex(p => p + 1);
    } else {
      setPairIndex(0);
      refetch();
    }
  }, [pairIndex, pairs.length, leftAnim, rightAnim, refetch]);

  const handleRefresh = () => {
    Haptics.selectionAsync();
    setPairIndex(0);
    leftAnim.setValue(1);
    rightAnim.setValue(1);
    setVoted(null);
    refetch();
  };

  const renderPlayerCard = (user: BattleUser | null, side: 'left' | 'right') => {
    const anim = side === 'left' ? leftAnim : rightAnim;
    const isWinner = voted === side;
    const isLoser = voted !== null && voted !== side;

    return (
      <Animated.View style={[{ transform: [{ scale: anim }] }]}>
        <TouchableOpacity
          style={[
            styles.playerCard,
            isWinner && styles.playerCardWinner,
            isLoser && styles.playerCardLoser,
          ]}
          onPress={() => user && handleVote(side)}
          disabled={voted !== null || !user}
          activeOpacity={0.85}
        >
          {user ? (
            <>
              <Image
                source={{
                  uri: user.avatarUrl ||
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
                }}
                style={styles.avatar}
              />
              {isWinner && (
                <View style={styles.winnerBadge}>
                  <Trophy size={14} color="#FFD700" />
                  <Text style={styles.winnerText}>Winner</Text>
                </View>
              )}
              <Text style={styles.displayName} numberOfLines={1}>
                {user.displayName || user.username}
              </Text>
              <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Star size={10} color="#4ADE80" />
                  <Text style={styles.statValue}>Lv {user.level || 1}</Text>
                </View>
                <View style={styles.statChip}>
                  <Zap size={10} color="#FBBF24" />
                  <Text style={styles.statValue}>{((user.totalXP || 0) / 1000).toFixed(1)}K</Text>
                </View>
              </View>
              {!voted && (
                <View style={styles.voteHint}>
                  <Text style={styles.voteHintText}>Tap to vote</Text>
                </View>
              )}
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id.toString() } })}
                style={styles.profileLink}
              >
                <Text style={styles.profileLinkText}>Profile</Text>
                <ChevronRight size={12} color="#4ADE80" />
              </TouchableOpacity>
            </>
          ) : (
            <ActivityIndicator color="#4ADE80" />
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
      <LinearGradient colors={['#131F2A', '#061021']} style={StyleSheet.absoluteFill} />
      <AppHeader />

      <View style={styles.pageHeader}>
        <View style={styles.pageTitleRow}>
          <Swords size={22} color="#4ADE80" />
          <Text style={styles.pageTitle}>Battles</Text>
        </View>
        <Text style={styles.pageSubtitle}>Vote for the better gamer</Text>
      </View>

      <View style={styles.battleCounter}>
        <Text style={styles.battleCountText}>{battleCount} battles played</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh} disabled={isFetching}>
          <RefreshCw size={16} color="#4ADE80" />
          <Text style={styles.refreshText}>New Players</Text>
        </TouchableOpacity>
      </View>

      {isLoading || isFetching ? (
        <View style={styles.center}>
          <ActivityIndicator color="#4ADE80" size="large" />
          <Text style={styles.loadingText}>Loading battle...</Text>
        </View>
      ) : !currentPair ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Swords size={36} color="#4ADE80" />
          </View>
          <Text style={styles.emptyTitle}>No battles available</Text>
          <Text style={styles.emptyMessage}>Check back soon as more gamers join the community</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRefresh}>
            <RefreshCw size={16} color="#002E15" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.battleArea}>
          <View style={styles.playersRow}>
            {renderPlayerCard(left, 'left')}
            <View style={styles.vsContainer}>
              <LinearGradient colors={['#4ADE80', '#22C55E']} style={styles.vsCircle}>
                <Text style={styles.vsText}>VS</Text>
              </LinearGradient>
            </View>
            {renderPlayerCard(right, 'right')}
          </View>

          {voted ? (
            <View style={styles.resultArea}>
              <Text style={styles.resultText}>
                {voted === 'left' ? left?.displayName || left?.username : right?.displayName || right?.username} wins this round!
              </Text>
              <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
                <Text style={styles.nextBtnText}>Next Battle</Text>
                <ChevronRight size={18} color="#002E15" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.instructionArea}>
              <Text style={styles.instructionText}>Tap a player to vote for them</Text>
              <Text style={styles.progressText}>{pairIndex + 1} / {pairs.length}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131F2A' },
  pageHeader: { paddingHorizontal: 16, paddingBottom: 8 },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  pageTitle: { fontSize: 24, fontWeight: '800' as const, color: '#FFFFFF' },
  pageSubtitle: { fontSize: 13, color: '#64748B' },
  battleCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  battleCountText: { fontSize: 13, color: '#94A3B8' },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4ADE8033',
  },
  refreshText: { fontSize: 12, color: '#4ADE80', fontWeight: '600' as const },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 60,
  },
  loadingText: { color: '#94A3B8', fontSize: 15 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700' as const, color: '#FFFFFF' },
  emptyMessage: { fontSize: 14, color: '#64748B', textAlign: 'center', paddingHorizontal: 40 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4ADE80',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryText: { fontSize: 15, fontWeight: '700' as const, color: '#002E15' },
  battleArea: { flex: 1, paddingHorizontal: 16 },
  playersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  playerCard: {
    width: CARD_WIDTH,
    backgroundColor: '#1E2D3C',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#1E293B',
    minHeight: 240,
    justifyContent: 'center',
  },
  playerCardWinner: {
    borderColor: '#4ADE80',
    backgroundColor: '#0D2016',
  },
  playerCardLoser: {
    borderColor: '#1E293B',
    opacity: 0.55,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2D3748',
    borderWidth: 3,
    borderColor: '#1E293B',
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1A3A1A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD70055',
  },
  winnerText: { fontSize: 11, color: '#FFD700', fontWeight: '700' as const },
  displayName: { fontSize: 14, fontWeight: '700' as const, color: '#FFFFFF', textAlign: 'center' },
  username: { fontSize: 11, color: '#64748B', textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 6 },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#131F2A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statValue: { fontSize: 11, color: '#94A3B8', fontWeight: '600' as const },
  voteHint: {
    backgroundColor: '#4ADE8022',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4ADE8044',
  },
  voteHintText: { fontSize: 11, color: '#4ADE80', fontWeight: '600' as const },
  profileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  profileLinkText: { fontSize: 11, color: '#4ADE80' },
  vsContainer: { alignItems: 'center', justifyContent: 'center' },
  vsCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  vsText: { fontSize: 14, fontWeight: '900' as const, color: '#002E15' },
  resultArea: {
    marginTop: 24,
    alignItems: 'center',
    gap: 14,
  },
  resultText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#4ADE80',
    textAlign: 'center',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4ADE80',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 28,
  },
  nextBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#002E15' },
  instructionArea: {
    marginTop: 24,
    alignItems: 'center',
    gap: 6,
  },
  instructionText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  progressText: { fontSize: 12, color: '#475569' },
});
