import { LinearGradient } from 'expo-linear-gradient';
import {
  Zap, Star, Flame, Target, Gift, Clock, TrendingUp,
  CheckCircle, Circle, ChevronDown, ArrowLeft, Calendar,
  Upload, Heart, MessageSquare, Share2, Eye, Lock
} from 'lucide-react-native';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useUser } from '@/context/UserContext';
import { api } from '@/lib/api';
import AppHeader from '@/components/AppHeader';

type Tab = 'today' | 'streaks' | 'milestones' | 'earn' | 'history';

const RING_SIZE = 200;
const STROKE_WIDTH = 14;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CircularProgress({ percent }: { percent: number }) {
  const progress = Math.min(Math.max(percent, 0), 100);
  const strokeDashoffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  return (
    <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
      <SvgCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={STROKE_WIDTH}
        fill="none"
      />
      <SvgCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        stroke="#4ADE80"
        strokeWidth={STROKE_WIDTH}
        fill="none"
        strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
      />
    </Svg>
  );
}

function DailyCheckItem({
  label, done, xp, icon: Icon, color,
}: { label: string; done: boolean; xp: number; icon: React.ElementType; color: string }) {
  return (
    <View style={[styles.checkItem, done && styles.checkItemDone]}>
      <View style={[styles.checkIcon, { backgroundColor: done ? `${color}22` : 'rgba(255,255,255,0.05)' }]}>
        <Icon size={18} color={done ? color : '#475569'} />
      </View>
      <Text style={[styles.checkLabel, done && styles.checkLabelDone]}>{label}</Text>
      <View style={[styles.checkXP, done && styles.checkXPDone]}>
        {done ? <CheckCircle size={14} color="#4ADE80" /> : <Circle size={14} color="#475569" />}
        <Text style={[styles.checkXPText, done && styles.checkXPTextDone]}>+{xp} XP</Text>
      </View>
    </View>
  );
}

function EarnCard({
  icon: Icon, title, xp, color, description,
}: { icon: React.ElementType; title: string; xp: string; color: string; description: string }) {
  return (
    <View style={styles.earnCard}>
      <View style={[styles.earnIcon, { backgroundColor: `${color}22` }]}>
        <Icon size={22} color={color} />
      </View>
      <View style={styles.earnInfo}>
        <Text style={styles.earnTitle}>{title}</Text>
        <Text style={styles.earnDesc}>{description}</Text>
      </View>
      <View style={[styles.earnBadge, { backgroundColor: `${color}22` }]}>
        <Text style={[styles.earnXP, { color }]}>{xp}</Text>
      </View>
    </View>
  );
}

function useCountdownToMidnight() {
  const [timeLeft, setTimeLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return timeLeft;
}

export default function LevelTrackerScreen() {
  const router = useRouter();
  const { authTokens } = useAuth();
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [refreshing, setRefreshing] = useState(false);
  const countdown = useCountdownToMidnight();
  const token = authTokens?.accessToken;
  const userId = user?.id;

  const levelQuery = useQuery({
    queryKey: ['level-progress', userId],
    queryFn: () => api.xp.getLevelProgress(userId!, token),
    enabled: !!userId,
    staleTime: 60000,
  });

  const activityQuery = useQuery({
    queryKey: ['daily-activity', userId],
    queryFn: () => api.xp.getDailyActivity(userId!, token!),
    enabled: !!userId && !!token,
    staleTime: 30000,
  });

  const historyQuery = useQuery({
    queryKey: ['xp-history', userId],
    queryFn: () => api.xp.getXPHistory(userId!, token!, 30),
    enabled: !!userId && !!token && activeTab === 'history',
    staleTime: 60000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      levelQuery.refetch(),
      activityQuery.refetch(),
      historyQuery.refetch(),
    ]);
    setRefreshing(false);
  }, []);

  const level = levelQuery.data;
  const activity = activityQuery.data;

  const progressPercent = level?.progressPercent ?? 0;
  const currentLevel = level?.level ?? user?.level ?? 1;
  const currentXP = level?.currentXP ?? user?.totalXP ?? 0;
  const xpForNext = level?.pointsForNextLevel ?? (currentLevel * 1000);
  const xpInLevel = level?.currentPoints ?? (currentXP % (currentLevel * 100));
  const xpNeeded = level?.pointsRemaining ?? (xpForNext - xpInLevel);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'streaks', label: 'Streaks' },
    { key: 'milestones', label: 'Milestones' },
    { key: 'earn', label: 'Earn XP' },
    { key: 'history', label: 'History' },
  ];

  const renderToday = () => {
    if (activityQuery.isLoading) {
      return <ActivityIndicator color="#4ADE80" style={{ marginTop: 32 }} />;
    }
    return (
      <View style={styles.tabContent}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Clock size={16} color="#4ADE80" />
            <Text style={styles.sectionTitle}>Daily Reset In</Text>
            <View style={styles.countdownBadge}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Today's Activities</Text>
          <View style={{ gap: 8, marginTop: 12 }}>
            <DailyCheckItem label="Daily Login" done={!!activity?.loginXPToday} xp={25} icon={Calendar} color="#4ADE80" />
            <DailyCheckItem label="Like Content" done={!!activity?.likedToday} xp={5} icon={Heart} color="#F87171" />
            <DailyCheckItem label="Leave a Comment" done={!!activity?.commentedToday} xp={15} icon={MessageSquare} color="#60A5FA" />
            <DailyCheckItem label="Share a Clip" done={!!activity?.sharedToday} xp={20} icon={Share2} color="#A78BFA" />
            <DailyCheckItem label="Watch 5 Clips" done={!!activity?.watch5Done} xp={10} icon={Eye} color="#FB923C" />
            <DailyCheckItem label="Watch 20 Clips" done={!!activity?.watch20Done} xp={30} icon={Eye} color="#FB923C" />
            <DailyCheckItem label="Open Daily Lootbox" done={!!activity?.lootboxOpenedToday} xp={100} icon={Gift} color="#FACC15" />
          </View>
        </View>

        {activity?.isWeekend && (
          <View style={[styles.sectionCard, styles.bonusCard]}>
            <Zap size={18} color="#FACC15" />
            <Text style={styles.bonusText}>Weekend Bonus Active! +50% XP on uploads</Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Creator Activities</Text>
          <View style={{ gap: 8, marginTop: 12 }}>
            <DailyCheckItem label="First Upload Today" done={!!activity?.firstUploadOfDay} xp={100} icon={Upload} color="#4ADE80" />
            <DailyCheckItem label="5 Uploads This Week" done={!!activity?.weeklyUploads5} xp={300} icon={TrendingUp} color="#34D399" />
            <DailyCheckItem label="10 Uploads This Week" done={!!activity?.weeklyUploads10} xp={750} icon={Star} color="#10B981" />
          </View>
        </View>
      </View>
    );
  };

  const renderStreaks = () => {
    const streak = activity?.streak;
    const current = streak?.currentStreak ?? user?.currentStreak ?? 0;
    const longest = streak?.longestStreak ?? user?.longestStreak ?? 0;
    const milestones = [5, 10, 25, 50, 100, 200, 365];

    return (
      <View style={styles.tabContent}>
        <View style={styles.streakHero}>
          <LinearGradient colors={['rgba(251,146,60,0.2)', 'rgba(251,146,60,0.05)']} style={styles.streakHeroGrad}>
            <Flame size={48} color="#FB923C" fill="#FB923C" />
            <Text style={styles.streakNumber}>{current}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
            <Text style={styles.streakSub}>Longest: {longest} days</Text>
          </LinearGradient>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Upcoming Milestones</Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            {milestones.map((m) => {
              const reached = current >= m;
              const next = !reached && current < m;
              const daysLeft = m - current;
              return (
                <View key={m} style={[styles.milestonRow, reached && styles.milestonRowDone]}>
                  <View style={[styles.milestonIcon, reached ? styles.milestonIconDone : next ? styles.milestonIconNext : {}]}>
                    {reached ? <CheckCircle size={18} color="#4ADE80" /> : <Flame size={18} color={next ? '#FB923C' : '#475569'} />}
                  </View>
                  <Text style={[styles.milestonLabel, reached && styles.milestonLabelDone]}>{m} Day Streak</Text>
                  {reached ? (
                    <Text style={styles.milestonReached}>Achieved!</Text>
                  ) : (
                    <Text style={styles.milestonDays}>{daysLeft} days left</Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderMilestones = () => {
    const viewMilestones = [
      { views: 50, xp: 100, label: '50 Views on a Clip' },
      { views: 100, xp: 250, label: '100 Views on a Clip' },
      { views: 500, xp: 500, label: '500 Views on a Clip' },
      { views: 1000, xp: 1000, label: '1,000 Views on a Clip' },
      { views: 5000, xp: 2500, label: '5,000 Views on a Clip' },
      { views: 10000, xp: 5000, label: '10,000 Views on a Clip' },
    ];
    return (
      <View style={styles.tabContent}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Star size={16} color="#FACC15" />
            <Text style={styles.sectionTitle}>Creator Milestones</Text>
          </View>
          <Text style={styles.sectionSub}>Earn XP when your clips hit these view counts</Text>
          <View style={{ gap: 10, marginTop: 14 }}>
            {viewMilestones.map((m) => (
              <View key={m.views} style={styles.milestoneCard}>
                <View style={styles.milestoneLeft}>
                  <Eye size={18} color="#94A3B8" />
                  <Text style={styles.milestoneLabel}>{m.label}</Text>
                </View>
                <View style={styles.milestoneBadge}>
                  <Text style={styles.milestoneXP}>+{m.xp.toLocaleString()} XP</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Upload size={16} color="#4ADE80" />
            <Text style={styles.sectionTitle}>Upload Milestones</Text>
          </View>
          <View style={{ gap: 10, marginTop: 14 }}>
            <DailyCheckItem label="First Upload of the Day" done={!!activity?.firstUploadOfDay} xp={100} icon={Upload} color="#4ADE80" />
            <DailyCheckItem label="5 Uploads in a Week" done={!!activity?.weeklyUploads5} xp={300} icon={TrendingUp} color="#34D399" />
            <DailyCheckItem label="10 Uploads in a Week" done={!!activity?.weeklyUploads10} xp={750} icon={Star} color="#10B981" />
          </View>
        </View>
      </View>
    );
  };

  const renderEarnXP = () => (
    <View style={styles.tabContent}>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Content</Text>
        <View style={{ gap: 8, marginTop: 12 }}>
          <EarnCard icon={Upload} title="Upload a Clip/Reel" xp="+200 XP" color="#4ADE80" description="Share your gaming moments" />
          <EarnCard icon={Upload} title="Upload a Screenshot" xp="+100 XP" color="#34D399" description="Show off your screenshots" />
          <EarnCard icon={Upload} title="First Upload of Day" xp="+100 XP" color="#10B981" description="Daily bonus for first upload" />
        </View>
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Engagement</Text>
        <View style={{ gap: 8, marginTop: 12 }}>
          <EarnCard icon={Heart} title="Like Content" xp="+5 XP" color="#F87171" description="Appreciate others' content" />
          <EarnCard icon={MessageSquare} title="Leave a Comment" xp="+15 XP" color="#60A5FA" description="Engage with the community" />
          <EarnCard icon={Share2} title="Share a Clip" xp="+20 XP" color="#A78BFA" description="Spread great content" />
          <EarnCard icon={Eye} title="Watch 5 Clips" xp="+10 XP" color="#FB923C" description="Daily watch challenge" />
          <EarnCard icon={Eye} title="Watch 20 Clips" xp="+30 XP" color="#FB923C" description="Power viewer bonus" />
        </View>
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Received</Text>
        <View style={{ gap: 8, marginTop: 12 }}>
          <EarnCard icon={Heart} title="Like Received" xp="+10 XP" color="#F87171" description="When someone likes your content" />
          <EarnCard icon={MessageSquare} title="Comment Received" xp="+20 XP" color="#60A5FA" description="When someone comments on your content" />
          <EarnCard icon={Flame} title="Fire Reaction Received" xp="+15 XP" color="#FB923C" description="When someone fires your content" />
          <EarnCard icon={Share2} title="Your Clip is Shared" xp="+40 XP" color="#A78BFA" description="When someone shares your clip" />
          <EarnCard icon={TrendingUp} title="New Follower" xp="+50 XP" color="#4ADE80" description="When someone follows you" />
        </View>
      </View>
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Daily Bonuses</Text>
        <View style={{ gap: 8, marginTop: 12 }}>
          <EarnCard icon={Calendar} title="Daily Login" xp="+25 XP" color="#4ADE80" description="Log in every day" />
          <EarnCard icon={Gift} title="Open Daily Lootbox" xp="+100 XP" color="#FACC15" description="Open your free daily lootbox" />
          <EarnCard icon={Zap} title="Weekend Upload Bonus" xp="+50%" color="#FB923C" description="Extra XP for uploads on weekends" />
        </View>
      </View>
    </View>
  );

  const renderHistory = () => {
    if (historyQuery.isLoading) {
      return <ActivityIndicator color="#4ADE80" style={{ marginTop: 32 }} />;
    }
    const history = historyQuery.data ?? [];

    const sourceIcon: Record<string, { icon: React.ElementType; color: string }> = {
      upload: { icon: Upload, color: '#4ADE80' },
      like: { icon: Heart, color: '#F87171' },
      like_received: { icon: Heart, color: '#F87171' },
      comment: { icon: MessageSquare, color: '#60A5FA' },
      comment_received: { icon: MessageSquare, color: '#60A5FA' },
      fire: { icon: Flame, color: '#FB923C' },
      share_given: { icon: Share2, color: '#A78BFA' },
      share_received: { icon: Share2, color: '#A78BFA' },
      daily_login: { icon: Calendar, color: '#4ADE80' },
      lootbox_bonus: { icon: Gift, color: '#FACC15' },
      streak_milestone: { icon: Flame, color: '#FB923C' },
      watch_5_clips: { icon: Eye, color: '#FB923C' },
      watch_20_clips: { icon: Eye, color: '#FB923C' },
    };

    const formatDate = (iso: string) => {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60000) return 'Just now';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
      if (diff < 172800000) return 'Yesterday';
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    return (
      <View style={styles.tabContent}>
        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <Zap size={40} color="#334155" />
            <Text style={styles.emptyTitle}>No XP history yet</Text>
            <Text style={styles.emptySub}>Start engaging with content to earn XP!</Text>
          </View>
        ) : (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Recent XP Earned</Text>
            <View style={{ gap: 10, marginTop: 12 }}>
              {history.map((item) => {
                const meta = sourceIcon[item.source] ?? { icon: Zap, color: '#4ADE80' };
                const Icon = meta.icon;
                return (
                  <View key={item.id} style={styles.historyRow}>
                    <View style={[styles.historyIcon, { backgroundColor: `${meta.color}22` }]}>
                      <Icon size={16} color={meta.color} />
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDesc}>{item.description || item.source}</Text>
                      <Text style={styles.historyDate}>{formatDate(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.historyAmount}>+{item.amount} XP</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#021B1F', '#000000']} style={StyleSheet.absoluteFill} />
      <AppHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4ADE80" />}
      >
        {/* Level Ring */}
        <View style={styles.ringSection}>
          <View style={styles.ringWrapper}>
            <CircularProgress percent={progressPercent} />
            <View style={styles.ringCenter}>
              <Text style={styles.ringLevel}>LVL</Text>
              <Text style={styles.ringLevelNumber}>{currentLevel}</Text>
              <Text style={styles.ringPercent}>{Math.round(progressPercent)}%</Text>
            </View>
          </View>

          <View style={styles.xpStats}>
            <View style={styles.xpStatRow}>
              <Zap size={16} color="#4ADE80" />
              <Text style={styles.xpStatLabel}>Total XP</Text>
              <Text style={styles.xpStatValue}>{currentXP.toLocaleString()}</Text>
            </View>
            <View style={styles.xpBarBg}>
              <View style={[styles.xpBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <Text style={styles.xpNeeded}>{xpNeeded.toLocaleString()} XP to Level {currentLevel + 1}</Text>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, activeTab === t.key && styles.tabActive]}
              onPress={() => setActiveTab(t.key)}
            >
              <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {activeTab === 'today' && renderToday()}
        {activeTab === 'streaks' && renderStreaks()}
        {activeTab === 'milestones' && renderMilestones()}
        {activeTab === 'earn' && renderEarnXP()}
        {activeTab === 'history' && renderHistory()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  ringSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 20,
  },
  ringWrapper: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringLevel: { fontSize: 11, color: '#64748B', fontWeight: '700', letterSpacing: 2 },
  ringLevelNumber: { fontSize: 52, fontWeight: 'bold' as const, color: '#FFF', lineHeight: 56 },
  ringPercent: { fontSize: 13, color: '#4ADE80', fontWeight: '600' },

  xpStats: { width: '100%', gap: 8 },
  xpStatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  xpStatLabel: { flex: 1, fontSize: 14, color: '#94A3B8' },
  xpStatValue: { fontSize: 16, fontWeight: 'bold' as const, color: '#FFF' },
  xpBarBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4 },
  xpBarFill: { height: 8, backgroundColor: '#4ADE80', borderRadius: 4 },
  xpNeeded: { fontSize: 12, color: '#64748B', textAlign: 'center' as const },

  tabRow: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  tabActive: { backgroundColor: '#4ADE80', borderColor: '#4ADE80' },
  tabText: { fontSize: 13, color: '#94A3B8', fontWeight: '600' },
  tabTextActive: { color: '#002E15' },

  tabContent: { paddingHorizontal: 16, gap: 12 },
  sectionCard: {
    backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' as const, color: '#FFF' },
  sectionSub: { fontSize: 12, color: '#64748B', marginTop: 4 },

  countdownBadge: {
    marginLeft: 'auto', backgroundColor: 'rgba(74,222,128,0.15)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
  },
  countdownText: { fontSize: 13, color: '#4ADE80', fontWeight: '600' },

  checkItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(51,65,85,0.4)',
  },
  checkItemDone: { borderColor: 'rgba(74,222,128,0.2)', backgroundColor: 'rgba(74,222,128,0.05)' },
  checkIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  checkLabel: { flex: 1, fontSize: 14, color: '#94A3B8' },
  checkLabelDone: { color: '#E2E8F0' },
  checkXP: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  checkXPDone: {},
  checkXPText: { fontSize: 12, color: '#475569', fontWeight: '600' },
  checkXPTextDone: { color: '#4ADE80' },

  bonusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(250,204,21,0.08)', borderColor: 'rgba(250,204,21,0.2)',
  },
  bonusText: { fontSize: 14, color: '#FDE68A', fontWeight: '600', flex: 1 },

  streakHero: { borderRadius: 16, overflow: 'hidden' },
  streakHeroGrad: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(251,146,60,0.25)',
  },
  streakNumber: { fontSize: 64, fontWeight: 'bold' as const, color: '#FFF', lineHeight: 68 },
  streakLabel: { fontSize: 18, fontWeight: '700', color: '#FB923C' },
  streakSub: { fontSize: 13, color: '#94A3B8', marginTop: 6 },

  milestonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(51,65,85,0.4)',
  },
  milestonRowDone: { borderColor: 'rgba(74,222,128,0.2)' },
  milestonIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  milestonIconDone: { backgroundColor: 'rgba(74,222,128,0.15)' },
  milestonIconNext: { backgroundColor: 'rgba(251,146,60,0.15)' },
  milestonLabel: { flex: 1, fontSize: 14, color: '#94A3B8' },
  milestonLabelDone: { color: '#FFF' },
  milestonReached: { fontSize: 12, color: '#4ADE80', fontWeight: '600' },
  milestonDays: { fontSize: 12, color: '#475569' },

  milestoneCard: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(51,65,85,0.4)',
  },
  milestoneLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  milestoneLabel: { fontSize: 13, color: '#94A3B8' },
  milestoneBadge: { backgroundColor: 'rgba(74,222,128,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  milestoneXP: { fontSize: 12, color: '#4ADE80', fontWeight: '700' },

  earnCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(51,65,85,0.4)',
  },
  earnIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  earnInfo: { flex: 1 },
  earnTitle: { fontSize: 14, color: '#E2E8F0', fontWeight: '600' },
  earnDesc: { fontSize: 12, color: '#64748B', marginTop: 2 },
  earnBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  earnXP: { fontSize: 13, fontWeight: '700' },

  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(51,65,85,0.3)',
  },
  historyIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  historyInfo: { flex: 1 },
  historyDesc: { fontSize: 13, color: '#E2E8F0' },
  historyDate: { fontSize: 11, color: '#475569', marginTop: 2 },
  historyAmount: { fontSize: 14, fontWeight: 'bold' as const, color: '#4ADE80' },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#94A3B8' },
  emptySub: { fontSize: 13, color: '#475569', textAlign: 'center' as const },
});
