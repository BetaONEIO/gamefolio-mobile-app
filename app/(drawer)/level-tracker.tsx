import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Zap, Flame, Trophy, Star, Upload, Heart, MessageSquare, Share2, Eye } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';

const XP_ACTIONS = [
  { icon: Flame, label: 'Daily Login', xp: 10, description: 'Log in every day to maintain your streak' },
  { icon: Upload, label: 'Upload a Clip', xp: 25, description: 'Share a gaming clip with the community' },
  { icon: Upload, label: 'Upload a Reel', xp: 20, description: 'Share a gaming reel with the community' },
  { icon: Upload, label: 'Upload a Screenshot', xp: 15, description: 'Share a screenshot from your game' },
  { icon: Heart, label: 'Like Content', xp: 2, description: 'Like clips, reels, or screenshots' },
  { icon: MessageSquare, label: 'Leave a Comment', xp: 5, description: 'Comment on community content' },
  { icon: Share2, label: 'Share Content', xp: 3, description: 'Share content with others' },
  { icon: Eye, label: 'Watch a Clip', xp: 1, description: 'Watch a clip from another user' },
];

const STREAK_MILESTONES = [
  { days: 7, label: '1 Week', bonus: '+25 XP' },
  { days: 14, label: '2 Weeks', bonus: '+50 XP' },
  { days: 30, label: '1 Month', bonus: '+100 XP' },
  { days: 60, label: '2 Months', bonus: '+200 XP' },
  { days: 100, label: '100 Days', bonus: '+500 XP' },
];

export default function LevelTrackerScreen() {
  const { user, getAccessToken } = useAuth();

  const { data: levelData, isLoading } = useQuery({
    queryKey: ['level-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const token = await getAccessToken();
      return api.users.getLevelProgress(user.id, token || undefined);
    },
    enabled: !!user?.id,
  });

  const level = levelData?.level ?? user?.level ?? 1;
  const progressPercent = levelData?.progressPercent ?? 0;
  const currentPoints = levelData?.currentPoints ?? 0;
  const pointsForNextLevel = levelData?.pointsForNextLevel ?? 100;
  const pointsRemaining = levelData?.pointsRemaining ?? pointsForNextLevel;
  const currentStreak = user?.currentStreak ?? 0;
  const longestStreak = user?.longestStreak ?? 0;

  const nextMilestone = STREAK_MILESTONES.find(m => m.days > currentStreak);

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0F1520', '#020617']} style={StyleSheet.absoluteFill} />
      <AppHeader />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Level Tracker</Text>
          <Text style={styles.pageSubtitle}>Track your XP progress and earn rewards</Text>
        </View>

        {isLoading ? (
          <View style={styles.centerLoader}>
            <ActivityIndicator color="#4ADE80" size="large" />
          </View>
        ) : (
          <>
            {/* Level Card */}
            <LinearGradient
              colors={['#1A2D1A', '#0F1520']}
              style={styles.levelCard}
            >
              <View style={styles.levelBadgeRow}>
                <View style={styles.levelBadge}>
                  <Zap size={20} color="#4ADE80" />
                  <Text style={styles.levelNumber}>Level {level}</Text>
                </View>
                <View style={styles.xpTag}>
                  <Text style={styles.xpTagText}>{user?.totalXP?.toLocaleString() ?? 0} Total XP</Text>
                </View>
              </View>
              <Text style={styles.levelProgressLabel}>
                {currentPoints.toLocaleString()} / {pointsForNextLevel.toLocaleString()} XP to Level {level + 1}
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.min(progressPercent, 100)}%` }]} />
              </View>
              <Text style={styles.progressPct}>{Math.round(progressPercent)}% — {pointsRemaining.toLocaleString()} XP remaining</Text>
            </LinearGradient>

            {/* Streak Card */}
            <View style={styles.streakCard}>
              <View style={styles.streakHeader}>
                <Flame size={20} color="#F97316" />
                <Text style={styles.streakTitle}>Login Streak</Text>
              </View>
              <View style={styles.streakStats}>
                <View style={styles.streakStat}>
                  <Text style={styles.streakStatNumber}>{currentStreak}</Text>
                  <Text style={styles.streakStatLabel}>Current</Text>
                </View>
                <View style={styles.streakDivider} />
                <View style={styles.streakStat}>
                  <Text style={styles.streakStatNumber}>{longestStreak}</Text>
                  <Text style={styles.streakStatLabel}>Longest</Text>
                </View>
                {nextMilestone && (
                  <>
                    <View style={styles.streakDivider} />
                    <View style={styles.streakStat}>
                      <Text style={[styles.streakStatNumber, { color: '#4ADE80' }]}>
                        {nextMilestone.days - currentStreak}
                      </Text>
                      <Text style={styles.streakStatLabel}>To {nextMilestone.label}</Text>
                    </View>
                  </>
                )}
              </View>
              {nextMilestone && (
                <View style={styles.streakMilestone}>
                  <Trophy size={14} color="#F59E0B" />
                  <Text style={styles.streakMilestoneText}>
                    Reach {nextMilestone.days} days for {nextMilestone.bonus} bonus
                  </Text>
                </View>
              )}
            </View>

            {/* Milestones */}
            <Text style={styles.sectionTitle}>Streak Milestones</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.milestonesRow}
            >
              {STREAK_MILESTONES.map((m) => {
                const reached = currentStreak >= m.days;
                return (
                  <View key={m.days} style={[styles.milestoneChip, reached && styles.milestoneChipReached]}>
                    <Trophy size={14} color={reached ? '#F59E0B' : '#64748B'} />
                    <Text style={[styles.milestoneLabel, reached && styles.milestoneLabelReached]}>{m.label}</Text>
                    <Text style={[styles.milestoneBonus, reached && styles.milestoneBonusReached]}>{m.bonus}</Text>
                  </View>
                );
              })}
            </ScrollView>

            {/* How to Earn XP */}
            <Text style={styles.sectionTitle}>How to Earn XP</Text>
            <View style={styles.xpActionsContainer}>
              {XP_ACTIONS.map((action, i) => (
                <View key={i} style={styles.xpAction}>
                  <View style={styles.xpActionIcon}>
                    <action.icon size={18} color="#4ADE80" />
                  </View>
                  <View style={styles.xpActionInfo}>
                    <Text style={styles.xpActionLabel}>{action.label}</Text>
                    <Text style={styles.xpActionDesc}>{action.description}</Text>
                  </View>
                  <View style={styles.xpBadge}>
                    <Star size={12} color="#4ADE80" />
                    <Text style={styles.xpBadgeText}>+{action.xp}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F1520' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  pageHeader: { paddingHorizontal: 20, paddingBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '800' as const, color: '#FFFFFF', marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: '#64748B' },
  centerLoader: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },

  levelCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  levelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(74,222,128,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
  },
  levelNumber: { fontSize: 18, fontWeight: '800' as const, color: '#4ADE80' },
  xpTag: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  xpTagText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' as const },
  levelProgressLabel: { fontSize: 13, color: '#94A3B8', marginBottom: 10 },
  progressBar: {
    height: 10,
    backgroundColor: '#1E293B',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 5,
  },
  progressPct: { fontSize: 12, color: '#64748B' },

  streakCard: {
    marginHorizontal: 16,
    backgroundColor: '#1A2332',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  streakHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  streakTitle: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  streakStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  streakStat: { flex: 1, alignItems: 'center' },
  streakStatNumber: { fontSize: 28, fontWeight: '800' as const, color: '#FFFFFF' },
  streakStatLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  streakDivider: { width: 1, height: 40, backgroundColor: '#2D3748' },
  streakMilestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  streakMilestoneText: { fontSize: 13, color: '#F59E0B', flex: 1 },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  milestonesRow: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 20,
  },
  milestoneChip: {
    alignItems: 'center',
    gap: 4,
    padding: 14,
    backgroundColor: '#1A2332',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    minWidth: 90,
  },
  milestoneChipReached: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  milestoneLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' as const },
  milestoneLabelReached: { color: '#F59E0B' },
  milestoneBonus: { fontSize: 11, color: '#475569' },
  milestoneBonusReached: { color: '#F59E0B', fontWeight: '700' as const },

  xpActionsContainer: { paddingHorizontal: 16, gap: 8, marginBottom: 20 },
  xpAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2332',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  xpActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(74,222,128,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpActionInfo: { flex: 1 },
  xpActionLabel: { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF', marginBottom: 2 },
  xpActionDesc: { fontSize: 12, color: '#64748B' },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(74,222,128,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  xpBadgeText: { fontSize: 13, fontWeight: '700' as const, color: '#4ADE80' },
});
