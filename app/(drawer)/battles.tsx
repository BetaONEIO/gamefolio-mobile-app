import { LinearGradient } from 'expo-linear-gradient';
import {
  Sword, Shield, Trophy, Zap, Users, X, ChevronRight,
  Play, RotateCcw, CheckSquare, Square, Crown, Star
} from 'lucide-react-native';
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Image, Modal, Pressable, ActivityIndicator, Animated, Easing,
  FlatList,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useUser } from '@/context/UserContext';
import AppHeader from '@/components/AppHeader';

interface Fighter {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  level: number;
  selected: boolean;
  status: 'alive' | 'eliminated' | 'victor' | 'idle';
}

type BattlePhase = 'select' | 'fighting' | 'results';

function PulseAnim({ children, active }: { children: React.ReactNode; active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (active) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.08, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
  }, [active]);
  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

export default function BattlesScreen() {
  const { authTokens } = useAuth();
  const { user: currentUser } = useUser();
  const token = authTokens?.accessToken;

  const [phase, setPhase] = useState<BattlePhase>('select');
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [victor, setVictor] = useState<Fighter | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [fightingIndex, setFightingIndex] = useState(0);
  const battleProgress = useRef(new Animated.Value(0)).current;

  // Fetch featured/searched users as potential fighters
  const followingQuery = useQuery({
    queryKey: ['fighters-for-battles'],
    queryFn: async () => {
      if (!token) return [];
      try {
        const featured = await api.users.getFeatured(token);
        return (featured ?? []).map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          level: u.level ?? 1,
          selected: false,
          status: 'idle' as const,
        }));
      } catch {
        const result = await api.users.search('gamer', token);
        return (result?.users ?? []).map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatarUrl: u.avatarUrl,
          level: u.level ?? 1,
          selected: false,
          status: 'idle' as const,
        }));
      }
    },
    enabled: !!token,
    staleTime: 120000,
  });

  const allUsers: Fighter[] = followingQuery.data ?? [];
  const selectedFighters = fighters.filter((f) => f.selected);

  const toggleFighter = (id: number) => {
    setFighters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f))
    );
  };

  const selectAll = () => setFighters((prev) => prev.map((f) => ({ ...f, selected: true })));
  const deselectAll = () => setFighters((prev) => prev.map((f) => ({ ...f, selected: false })));

  // Initialize fighters from query results
  useEffect(() => {
    if (allUsers.length > 0 && fighters.length === 0) {
      setFighters(allUsers);
    }
  }, [allUsers]);

  const startBattle = useCallback(() => {
    if (selectedFighters.length < 2) return;

    const arena = selectedFighters.map((f) => ({ ...f, status: 'alive' as const }));
    setPhase('fighting');
    setBattleLog([]);
    setFightingIndex(0);

    const log: string[] = [];
    let remaining = [...arena];

    const eliminate = (round: number) => {
      if (remaining.length <= 1) {
        const winner = remaining[0];
        setVictor(winner);
        setFighters((prev) =>
          prev.map((f) => ({
            ...f,
            status: f.id === winner.id ? 'victor' : selectedFighters.find((sf) => sf.id === f.id) ? 'eliminated' : 'idle',
          }))
        );
        setBattleLog(log);
        setTimeout(() => setPhase('results'), 800);
        return;
      }

      setTimeout(() => {
        const elimIdx = Math.floor(Math.random() * remaining.length);
        const eliminated = remaining[elimIdx];
        const attacker = remaining[(elimIdx + 1) % remaining.length];
        remaining = remaining.filter((_, i) => i !== elimIdx);

        const messages = [
          `${attacker.displayName} eliminated ${eliminated.displayName}!`,
          `${eliminated.displayName} was taken down by ${attacker.displayName}!`,
          `${attacker.displayName} knocked out ${eliminated.displayName}!`,
          `${eliminated.displayName} couldn't keep up — eliminated by ${attacker.displayName}!`,
        ];
        log.push(messages[Math.floor(Math.random() * messages.length)]);
        setBattleLog([...log]);
        setFightingIndex(round);

        eliminate(round + 1);
      }, 900);
    };

    eliminate(0);
  }, [selectedFighters]);

  const reset = () => {
    setPhase('select');
    setVictor(null);
    setBattleLog([]);
    setFighters((prev) => prev.map((f) => ({ ...f, selected: false, status: 'idle' })));
  };

  const renderSelectPhase = () => (
    <View style={{ flex: 1 }}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Shield size={18} color="#4ADE80" />
          <Text style={styles.statValue}>{selectedFighters.length}</Text>
          <Text style={styles.statLabel}>Selected</Text>
        </View>
        <View style={styles.statCard}>
          <Users size={18} color="#60A5FA" />
          <Text style={styles.statValue}>{fighters.length}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statCard}>
          <Zap size={18} color="#FACC15" />
          <Text style={styles.statValue}>{Math.max(0, selectedFighters.length - 1)}</Text>
          <Text style={styles.statLabel}>Rounds</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlBtn} onPress={selectAll}>
          <CheckSquare size={16} color="#94A3B8" />
          <Text style={styles.controlText}>Select All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlBtn} onPress={deselectAll}>
          <Square size={16} color="#94A3B8" />
          <Text style={styles.controlText}>Deselect All</Text>
        </TouchableOpacity>
      </View>

      {/* Fighter List */}
      {followingQuery.isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#4ADE80" size="large" />
          <Text style={styles.loadingText}>Loading fighters...</Text>
        </View>
      ) : fighters.length === 0 ? (
        <View style={styles.emptyBox}>
          <Users size={48} color="#334155" />
          <Text style={styles.emptyTitle}>No fighters found</Text>
          <Text style={styles.emptySub}>Follow some gamers to add them as battle opponents</Text>
        </View>
      ) : (
        <FlatList
          data={fighters}
          keyExtractor={(f) => String(f.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, gap: 10 }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.fighterRow, f.selected && styles.fighterRowSelected]}
              onPress={() => toggleFighter(f.id)}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: f.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop' }}
                style={[styles.fighterAvatar, f.selected && styles.fighterAvatarSelected]}
              />
              <View style={styles.fighterInfo}>
                <Text style={styles.fighterName}>{f.displayName}</Text>
                <Text style={styles.fighterHandle}>@{f.username} · Lvl {f.level}</Text>
              </View>
              <View style={[styles.checkbox, f.selected && styles.checkboxSelected]}>
                {f.selected && <CheckSquare size={20} color="#4ADE80" />}
                {!f.selected && <Square size={20} color="#475569" />}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Start Button */}
      <View style={styles.startButtonContainer}>
        <TouchableOpacity
          style={[styles.startButton, selectedFighters.length < 2 && styles.startButtonDisabled]}
          onPress={startBattle}
          disabled={selectedFighters.length < 2}
        >
          <Sword size={20} color={selectedFighters.length < 2 ? '#475569' : '#002E15'} />
          <Text style={[styles.startButtonText, selectedFighters.length < 2 && styles.startButtonTextDisabled]}>
            {selectedFighters.length < 2 ? 'Select at least 2 fighters' : `Start Battle (${selectedFighters.length} fighters)`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFightingPhase = () => (
    <View style={styles.fightingContainer}>
      <LinearGradient colors={['rgba(220,38,38,0.15)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />
      <View style={styles.fightingHeader}>
        <Sword size={28} color="#EF4444" fill="#EF4444" />
        <Text style={styles.fightingTitle}>Battle in Progress!</Text>
        <Sword size={28} color="#EF4444" fill="#EF4444" style={{ transform: [{ scaleX: -1 }] }} />
      </View>

      <View style={styles.arenaGrid}>
        {selectedFighters.map((f) => {
          const current = fighters.find((ff) => ff.id === f.id);
          const isEliminated = current?.status === 'eliminated';
          const isVictor = current?.status === 'victor';
          return (
            <PulseAnim key={f.id} active={!isEliminated}>
              <View style={[styles.arenaCard, isEliminated && styles.arenaCardElim, isVictor && styles.arenaCardVictor]}>
                <Image
                  source={{ uri: f.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop' }}
                  style={[styles.arenaAvatar, isEliminated && styles.arenaAvatarElim]}
                />
                {isEliminated && (
                  <View style={styles.elimOverlay}>
                    <X size={18} color="#EF4444" strokeWidth={3} />
                  </View>
                )}
                <Text style={[styles.arenaName, isEliminated && styles.arenaNameElim]} numberOfLines={1}>
                  {f.displayName}
                </Text>
              </View>
            </PulseAnim>
          );
        })}
      </View>

      <View style={styles.battleLogBox}>
        <Text style={styles.battleLogTitle}>Battle Log</Text>
        {battleLog.map((line, i) => (
          <Text key={i} style={[styles.battleLogLine, i === battleLog.length - 1 && styles.battleLogLatest]}>
            {i === battleLog.length - 1 ? '⚔️ ' : '• '}{line}
          </Text>
        ))}
        {battleLog.length === 0 && <Text style={styles.battleLogLine}>Battle commencing...</Text>}
      </View>

      <ActivityIndicator color="#EF4444" style={{ marginTop: 16 }} />
    </View>
  );

  const renderResults = () => (
    <ScrollView contentContainerStyle={styles.resultsContainer}>
      <LinearGradient colors={['rgba(250,204,21,0.15)', 'rgba(0,0,0,0)']} style={StyleSheet.absoluteFill} />

      {victor && (
        <View style={styles.victorSection}>
          <Crown size={48} color="#FACC15" fill="#FACC15" />
          <Text style={styles.victorTitle}>VICTOR!</Text>
          <Image
            source={{ uri: victor.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&h=120&fit=crop' }}
            style={styles.victorAvatar}
          />
          <Text style={styles.victorName}>{victor.displayName}</Text>
          <Text style={styles.victorHandle}>@{victor.username}</Text>
          <View style={styles.victorBadge}>
            <Star size={14} color="#FACC15" fill="#FACC15" />
            <Text style={styles.victorBadgeText}>Battle Champion</Text>
          </View>
        </View>
      )}

      <View style={styles.resultsBoardCard}>
        <Text style={styles.resultsBoardTitle}>Final Standings</Text>
        <View style={{ gap: 8, marginTop: 12 }}>
          {selectedFighters.map((f, i) => {
            const isW = victor?.id === f.id;
            return (
              <View key={f.id} style={[styles.resultRow, isW && styles.resultRowWinner]}>
                <Text style={[styles.resultRank, isW && styles.resultRankWinner]}>
                  {isW ? '👑' : `#${i + 1}`}
                </Text>
                <Image
                  source={{ uri: f.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&h=80&fit=crop' }}
                  style={styles.resultAvatar}
                />
                <Text style={[styles.resultName, isW && styles.resultNameWinner]}>{f.displayName}</Text>
                {isW && <Trophy size={16} color="#FACC15" fill="#FACC15" />}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.battleLogCard}>
        <Text style={styles.resultsBoardTitle}>Battle Log</Text>
        <View style={{ gap: 6, marginTop: 10 }}>
          {battleLog.map((line, i) => (
            <Text key={i} style={styles.battleLogLineFinal}>⚔️ {line}</Text>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.resetButton} onPress={reset}>
        <RotateCcw size={18} color="#4ADE80" />
        <Text style={styles.resetText}>New Battle</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0D0D1A', '#000000']} style={StyleSheet.absoluteFill} />
      <AppHeader />

      <View style={styles.heroHeader}>
        <Sword size={28} color="#4ADE80" />
        <Text style={styles.heroTitle}>Battle Arena</Text>
        <TouchableOpacity onPress={() => setShowHelp(true)} style={styles.helpBtn}>
          <Text style={styles.helpBtnText}>?</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.heroSub}>Select gamers and watch them battle it out!</Text>

      <View style={{ flex: 1 }}>
        {phase === 'select' && renderSelectPhase()}
        {phase === 'fighting' && renderFightingPhase()}
        {phase === 'results' && renderResults()}
      </View>

      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowHelp(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>How Battles Work</Text>
            <Text style={styles.modalText}>1. Select 2 or more fighters from your network</Text>
            <Text style={styles.modalText}>2. Tap "Start Battle" to begin</Text>
            <Text style={styles.modalText}>3. Watch fighters get eliminated one by one</Text>
            <Text style={styles.modalText}>4. The last fighter standing wins!</Text>
            <Text style={[styles.modalText, { marginTop: 12, color: '#64748B' }]}>
              Battles are randomly determined and purely for fun!
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowHelp(false)}>
              <Text style={styles.modalCloseText}>Got it!</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  heroHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, gap: 10 },
  heroTitle: { flex: 1, fontSize: 26, fontWeight: 'bold' as const, color: '#FFF' },
  heroSub: { fontSize: 13, color: '#64748B', paddingHorizontal: 20, paddingBottom: 16 },
  helpBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  helpBtnText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },

  statsRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12,
  },
  statCard: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 12,
    padding: 12, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)',
  },
  statValue: { fontSize: 22, fontWeight: 'bold' as const, color: '#FFF' },
  statLabel: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  controls: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  controlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  controlText: { fontSize: 13, color: '#94A3B8' },

  fighterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: 'rgba(51,65,85,0.4)',
  },
  fighterRowSelected: { borderColor: 'rgba(74,222,128,0.4)', backgroundColor: 'rgba(74,222,128,0.07)' },
  fighterAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#334155' },
  fighterAvatarSelected: { borderColor: '#4ADE80' },
  fighterInfo: { flex: 1 },
  fighterName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  fighterHandle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  checkbox: {},
  checkboxSelected: {},

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 40 },
  loadingText: { color: '#64748B', fontSize: 14 },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 40, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#94A3B8' },
  emptySub: { fontSize: 14, color: '#475569', textAlign: 'center' as const },

  startButtonContainer: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
  },
  startButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#4ADE80', borderRadius: 14, paddingVertical: 16,
  },
  startButtonDisabled: { backgroundColor: 'rgba(255,255,255,0.07)' },
  startButtonText: { fontSize: 16, fontWeight: 'bold' as const, color: '#002E15' },
  startButtonTextDisabled: { color: '#475569' },

  fightingContainer: {
    flex: 1, paddingHorizontal: 16, paddingTop: 12, alignItems: 'center',
  },
  fightingHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
  },
  fightingTitle: { fontSize: 22, fontWeight: 'bold' as const, color: '#EF4444' },
  arenaGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    justifyContent: 'center', marginBottom: 20,
  },
  arenaCard: {
    width: 80, alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 14, padding: 10,
    borderWidth: 2, borderColor: 'rgba(74,222,128,0.3)',
  },
  arenaCardElim: { borderColor: 'rgba(239,68,68,0.3)', opacity: 0.5 },
  arenaCardVictor: { borderColor: '#FACC15' },
  arenaAvatar: { width: 48, height: 48, borderRadius: 24 },
  arenaAvatarElim: { opacity: 0.4 },
  elimOverlay: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 10, padding: 2,
  },
  arenaName: { fontSize: 11, color: '#E2E8F0', fontWeight: '600', textAlign: 'center' as const },
  arenaNameElim: { color: '#475569' },

  battleLogBox: {
    width: '100%', backgroundColor: 'rgba(15,23,42,0.8)', borderRadius: 14,
    padding: 14, borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)',
    maxHeight: 200,
  },
  battleLogTitle: { fontSize: 14, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  battleLogLine: { fontSize: 13, color: '#64748B', lineHeight: 20 },
  battleLogLatest: { color: '#E2E8F0', fontWeight: '600' },

  resultsContainer: { paddingHorizontal: 16, paddingBottom: 100, paddingTop: 12, gap: 16 },
  victorSection: {
    alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(250,204,21,0.08)', borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: 'rgba(250,204,21,0.2)',
  },
  victorTitle: { fontSize: 30, fontWeight: 'bold' as const, color: '#FACC15', letterSpacing: 4 },
  victorAvatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#FACC15' },
  victorName: { fontSize: 22, fontWeight: 'bold' as const, color: '#FFF' },
  victorHandle: { fontSize: 14, color: '#94A3B8' },
  victorBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(250,204,21,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
  },
  victorBadgeText: { fontSize: 13, fontWeight: '600', color: '#FACC15' },

  resultsBoardCard: {
    backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)',
  },
  resultsBoardTitle: { fontSize: 16, fontWeight: 'bold' as const, color: '#FFF' },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)',
  },
  resultRowWinner: { borderBottomColor: 'rgba(250,204,21,0.2)' },
  resultRank: { width: 28, fontSize: 14, color: '#64748B', fontWeight: '700' },
  resultRankWinner: { fontSize: 18 },
  resultAvatar: { width: 36, height: 36, borderRadius: 18 },
  resultName: { flex: 1, fontSize: 14, color: '#E2E8F0', fontWeight: '600' },
  resultNameWinner: { color: '#FACC15' },

  battleLogCard: {
    backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)',
  },
  battleLogLineFinal: { fontSize: 13, color: '#94A3B8', lineHeight: 22 },

  resetButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 14, paddingVertical: 16,
    borderWidth: 1, borderColor: 'rgba(74,222,128,0.3)',
  },
  resetText: { fontSize: 16, fontWeight: 'bold' as const, color: '#4ADE80' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: {
    backgroundColor: '#0F172A', borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 340, borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)',
    gap: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold' as const, color: '#FFF', marginBottom: 8 },
  modalText: { fontSize: 14, color: '#94A3B8', lineHeight: 22 },
  modalClose: {
    backgroundColor: '#4ADE80', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  modalCloseText: { fontSize: 15, fontWeight: 'bold' as const, color: '#002E15' },
});
