import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  X,
  Zap,
  Calendar,
  Clock,
  Flame,
  Trophy,
  Star,
  Upload,
  Heart,
  MessageSquare,
  Share2,
  Eye,
  UserPlus,
  CheckCircle,
  Circle,
  Video,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

type Tab = 'today' | 'streaks' | 'milestones' | 'earnxp' | 'history';

interface LevelProgressData {
  level: number;
  currentXP: number;
  currentPoints: number;
  pointsForCurrentLevel: number;
  pointsForNextLevel: number;
  pointsRemaining: number;
  progressPercent: number;
}

interface DailyActivity {
  clipsWatchedToday: number;
  watch5Done: boolean;
  watch20Done: boolean;
  commentedToday: boolean;
  likedToday: boolean;
  sharedToday: boolean;
  loginXPToday: number;
  streakBonusToday: number;
  lootboxOpenedToday: boolean;
  streak?: {
    currentStreak: number;
    longestStreak: number;
    lastLoginDate?: string;
  };
  isWeekend?: boolean;
}

interface XPHistoryEntry {
  id: number;
  xpAmount: number;
  source: string;
  description?: string;
  createdAt: string;
}

interface LevelDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  level: number;
  currentXP: number;
  userId?: string;
  onXPAdded?: (newXP: number, newLevel: number) => void;
  onTaskStart?: (taskId: string) => void;
}

const STREAK_MILESTONES = [
  { days: 3, label: '3 Days', bonus: '+10 XP' },
  { days: 7, label: '1 Week', bonus: '+25 XP' },
  { days: 14, label: '2 Weeks', bonus: '+50 XP' },
  { days: 30, label: '1 Month', bonus: '+100 XP' },
  { days: 60, label: '2 Months', bonus: '+200 XP' },
  { days: 100, label: '100 Days', bonus: '+500 XP' },
];

const LEVEL_MILESTONES = [
  { level: 5, title: 'Rising Star', reward: '500 XP Bonus' },
  { level: 10, title: 'Veteran Gamer', reward: '1,000 XP Bonus' },
  { level: 20, title: 'Elite Player', reward: '2,500 XP Bonus' },
  { level: 30, title: 'Legend', reward: '5,000 XP Bonus' },
  { level: 50, title: 'Champion', reward: '10,000 XP Bonus' },
  { level: 100, title: 'Hall of Fame', reward: '25,000 XP Bonus' },
];

function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.floor((midnight.getTime() - now.getTime()) / 1000);
}

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

function getXPColor(color: 'green' | 'cyan' | 'pink' | 'white'): string {
  switch (color) {
    case 'green': return '#4ADE80';
    case 'cyan': return '#22D3EE';
    case 'pink': return '#F472B6';
    default: return '#FFFFFF';
  }
}

function getActionLabel(action: string): string {
  const map: Record<string, string> = {
    daily_login: 'Daily Login',
    watch_5_clips: 'Watch 5 Clips',
    watch_20_clips: 'Watch 20 Clips',
    comment: 'Comment on a Clip',
    like: 'Like a Clip',
    share_given: 'Share a Clip',
    upload_clip: 'Upload a Clip',
    upload_reel: 'Upload a Reel',
    upload_screenshot: 'Upload a Screenshot',
    invite_friend: 'Invite a Friend',
    streak_milestone: 'Streak Milestone',
    lootbox_bonus: 'Lootbox Bonus',
    watch_clip_counted: 'Watch a Clip',
  };
  return map[action] ?? action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LevelDetailsModal({
  visible,
  onClose,
  level: propLevel,
  currentXP: propCurrentXP,
  userId,
  onTaskStart,
}: LevelDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('today');
  const [countdown, setCountdown] = useState(getSecondsUntilMidnight());
  const { authTokens, user } = useAuth();
  const referralLink = `https://gamefolio.app/ref/${userId || 'XXXXX'}`;

  const { data: levelProgress, isLoading: loadingLevel } = useQuery<LevelProgressData>({
    queryKey: ['/api/level-progress', userId],
    queryFn: async () => {
      const numericId = parseInt(userId ?? '', 10);
      if (isNaN(numericId)) throw new Error('No user id');
      return api.users.getLevelProgress(numericId, authTokens?.accessToken ?? undefined);
    },
    enabled: visible && !!userId,
  });

  const { data: dailyActivity, isLoading: loadingActivity } = useQuery<DailyActivity>({
    queryKey: ['/api/daily-activity', userId],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/user/${userId}/daily-activity`, {
        headers: { Authorization: `Bearer ${authTokens?.accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch daily activity');
      return res.json();
    },
    enabled: visible && !!userId && !!authTokens?.accessToken,
    staleTime: 30_000,
  });

  const { data: xpHistory, isLoading: loadingHistory } = useQuery<XPHistoryEntry[]>({
    queryKey: ['/api/xp-history', userId],
    queryFn: async () => {
      const res = await fetch(`${BACKEND_URL}/api/user/${userId}/xp-history`, {
        headers: { Authorization: `Bearer ${authTokens?.accessToken}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: visible && activeTab === 'history' && !!userId,
  });

  useEffect(() => {
    if (!visible) return;
    setCountdown(getSecondsUntilMidnight());
    const id = setInterval(() => {
      setCountdown((s) => {
        if (s <= 1) return getSecondsUntilMidnight();
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [visible]);

  const level = levelProgress?.level ?? propLevel;
  const currentXP = levelProgress?.currentXP ?? propCurrentXP;
  const pointsForNextLevel = levelProgress?.pointsForNextLevel ?? 1000 * level;
  const progressPercent = levelProgress?.progressPercent ?? 0;
  const progress = progressPercent / 100;
  const xpInLevel = levelProgress
    ? levelProgress.currentXP - levelProgress.pointsForCurrentLevel
    : 0;
  const xpForCurrentLevel = levelProgress
    ? levelProgress.pointsForNextLevel - levelProgress.pointsForCurrentLevel
    : 1000 * level;

  const currentStreak =
    dailyActivity?.streak?.currentStreak ?? user?.currentStreak ?? 0;
  const longestStreak =
    dailyActivity?.streak?.longestStreak ?? user?.longestStreak ?? 0;
  const nextMilestone = STREAK_MILESTONES.find((m) => m.days > currentStreak);

  const loginDone = (dailyActivity?.loginXPToday ?? 0) > 0;
  const clipsWatched = dailyActivity?.clipsWatchedToday ?? 0;
  const watch5Done = dailyActivity?.watch5Done ?? false;
  const watch20Done = dailyActivity?.watch20Done ?? false;
  const commentDone = dailyActivity?.commentedToday ?? false;
  const likeDone = dailyActivity?.likedToday ?? false;
  const shareDone = dailyActivity?.sharedToday ?? false;

  const badgeSize = 140;
  const thickness = 8;
  const radius = (badgeSize - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = badgeSize / 2;

  const starAnimations = useRef(
    Array.from({ length: 16 }).map(() => ({
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(Math.random() * 0.5 + 0.2),
      left: Math.random() * 100,
      top: Math.random() * 100,
    }))
  ).current;

  useEffect(() => {
    starAnimations.forEach((anim) => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(anim.translateY, {
              toValue: -15,
              duration: 2000 + Math.random() * 1000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 0.7,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(anim.translateY, {
              toValue: 0,
              duration: 2000 + Math.random() * 1000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 0.2,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    });
  }, []);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'streaks', label: 'Streaks' },
    { key: 'milestones', label: 'Milestones' },
    { key: 'earnxp', label: 'Earn XP' },
    { key: 'history', label: 'History' },
  ];

  const renderTaskRow = ({
    done,
    label,
    xp,
    xpColor,
    progress: prog,
    total,
  }: {
    done: boolean;
    label: string;
    xp: number;
    xpColor: 'green' | 'cyan' | 'pink' | 'white';
    progress?: number;
    total?: number;
  }) => {
    const hasProgress = prog !== undefined && total !== undefined;
    return (
      <View style={styles.taskRow} key={label}>
        <View style={styles.taskRowLeft}>
          {done ? (
            <CheckCircle size={22} color="#4ADE80" fill="#4ADE80" strokeWidth={0} />
          ) : (
            <Circle size={22} color="#4B5563" strokeWidth={1.5} />
          )}
        </View>
        <View style={styles.taskRowContent}>
          <Text style={[styles.taskRowLabel, done && styles.taskRowLabelDone]}>
            {label}
          </Text>
          {hasProgress && !done ? (
            <View style={styles.taskProgressWrap}>
              <View style={styles.taskProgressBar}>
                <View
                  style={[
                    styles.taskProgressFill,
                    { width: `${Math.min(100, (prog! / total!) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.taskProgressLabel}>
                {prog}/{total}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.taskRowXP}>
          <Text style={[styles.taskXPText, { color: done ? '#64748B' : getXPColor(xpColor) }]}>
            +{xp} XP
          </Text>
        </View>
      </View>
    );
  };

  const renderTodayTab = () => (
    <View>
      <View style={styles.dailyCard}>
        <View style={styles.dailyCardHeader}>
          <View style={styles.dailyCardTitleRow}>
            <Calendar size={18} color="#4ADE80" />
            <Text style={styles.dailyCardTitle}>Daily Activity</Text>
          </View>
          <View style={styles.countdownRow}>
            <Clock size={13} color="#94A3B8" />
            <Text style={styles.countdownLabel}>
              Resets in{' '}
              <Text style={styles.countdownValue}>{formatCountdown(countdown)}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.taskList}>
          {renderTaskRow({ done: loginDone, label: 'Daily Login', xp: 25, xpColor: 'white' })}
          {renderTaskRow({
            done: watch5Done,
            label: 'Watch 5 Clips',
            xp: 10,
            xpColor: 'green',
            progress: Math.min(clipsWatched, 5),
            total: 5,
          })}
          {renderTaskRow({
            done: watch20Done,
            label: 'Watch 20 Clips',
            xp: 30,
            xpColor: 'green',
            progress: Math.min(clipsWatched, 20),
            total: 20,
          })}
          {renderTaskRow({ done: commentDone, label: 'Comment on a Clip', xp: 15, xpColor: 'cyan' })}
          {renderTaskRow({ done: likeDone, label: 'Like a Clip', xp: 5, xpColor: 'pink' })}
          {renderTaskRow({ done: shareDone, label: 'Share a Clip', xp: 20, xpColor: 'cyan' })}
        </View>
      </View>

      <View style={styles.todayXPSummary}>
        <Text style={styles.todayXPLabel}>XP earned today</Text>
        <Text style={styles.todayXPValue}>
          {(dailyActivity?.loginXPToday ?? 0) +
            (watch5Done ? 10 : 0) +
            (watch20Done ? 30 : 0) +
            (commentDone ? 15 : 0) +
            (likeDone ? 5 : 0) +
            (shareDone ? 20 : 0)}{' '}
          XP
        </Text>
      </View>
    </View>
  );

  const renderStreaksTab = () => (
    <View>
      <View style={styles.streakCard}>
        <View style={styles.streakHeaderRow}>
          <Flame size={20} color="#F97316" />
          <Text style={styles.streakCardTitle}>Login Streak</Text>
        </View>
        <View style={styles.streakStatsRow}>
          <View style={styles.streakStat}>
            <Text style={styles.streakStatNumber}>{currentStreak}</Text>
            <Text style={styles.streakStatLabel}>Current</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakStat}>
            <Text style={styles.streakStatNumber}>{longestStreak}</Text>
            <Text style={styles.streakStatLabel}>Longest</Text>
          </View>
          {nextMilestone ? (
            <>
              <View style={styles.streakDivider} />
              <View style={styles.streakStat}>
                <Text style={[styles.streakStatNumber, { color: '#4ADE80' }]}>
                  {nextMilestone.days - currentStreak}
                </Text>
                <Text style={styles.streakStatLabel}>To {nextMilestone.label}</Text>
              </View>
            </>
          ) : null}
        </View>
        {nextMilestone ? (
          <View style={styles.streakMilestoneBanner}>
            <Trophy size={14} color="#F59E0B" />
            <Text style={styles.streakMilestoneBannerText}>
              Reach {nextMilestone.days} days for {nextMilestone.bonus} bonus
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.subSectionTitle}>Streak Milestones</Text>
      <View style={styles.streakMilestonesGrid}>
        {STREAK_MILESTONES.map((m) => {
          const reached = currentStreak >= m.days;
          return (
            <View
              key={m.days}
              style={[styles.milestoneChip, reached && styles.milestoneChipReached]}
            >
              <Trophy size={16} color={reached ? '#F59E0B' : '#475569'} />
              <Text style={[styles.milestoneChipLabel, reached && styles.milestoneChipLabelReached]}>
                {m.label}
              </Text>
              <Text style={[styles.milestoneChipBonus, reached && styles.milestoneChipBonusReached]}>
                {m.bonus}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderMilestonesTab = () => (
    <View>
      <Text style={styles.subSectionDesc}>Reach these levels for big XP bonuses</Text>
      <View style={styles.levelMilestonesList}>
        {LEVEL_MILESTONES.map((m) => {
          const reached = level >= m.level;
          return (
            <View key={m.level} style={[styles.levelMilestoneRow, reached && styles.levelMilestoneRowReached]}>
              <View style={[styles.levelMilestoneBadge, reached && styles.levelMilestoneBadgeReached]}>
                <Text style={[styles.levelMilestoneBadgeText, reached && styles.levelMilestoneBadgeTextReached]}>
                  Lv {m.level}
                </Text>
              </View>
              <View style={styles.levelMilestoneInfo}>
                <Text style={[styles.levelMilestoneTitle, reached && { color: '#F59E0B' }]}>
                  {m.title}
                </Text>
                <Text style={styles.levelMilestoneReward}>{m.reward}</Text>
              </View>
              {reached ? (
                <CheckCircle size={20} color="#F59E0B" fill="rgba(245,158,11,0.15)" strokeWidth={1.5} />
              ) : (
                <View style={styles.levelMilestoneLock}>
                  <Text style={styles.levelMilestoneLockText}>{m.level - level} lvls</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );

  const XP_ACTIONS = [
    { icon: Flame, label: 'Daily Login', xp: 25, desc: 'Log in every day to maintain your streak', color: '#F97316' },
    { icon: Eye, label: 'Watch 5 Clips', xp: 10, desc: 'Watch 5 gaming clips from the community', color: '#4ADE80' },
    { icon: Eye, label: 'Watch 20 Clips', xp: 30, desc: 'Watch 20 gaming clips from the community', color: '#4ADE80' },
    { icon: MessageSquare, label: 'Comment on a Clip', xp: 15, desc: 'Leave a comment on any clip', color: '#22D3EE' },
    { icon: Heart, label: 'Like a Clip', xp: 5, desc: 'Like a clip from another user', color: '#F472B6' },
    { icon: Share2, label: 'Share a Clip', xp: 20, desc: 'Share a clip with others', color: '#22D3EE' },
    { icon: Upload, label: 'Upload a Clip', xp: 50, desc: 'Share a gaming highlight clip', color: '#4ADE80' },
    { icon: UserPlus, label: 'Invite a Friend', xp: 250, desc: 'Earn XP for each friend who joins', color: '#A78BFA' },
  ];

  const renderEarnXPTab = () => (
    <View style={styles.earnList}>
      {XP_ACTIONS.map((action, i) => (
        <View key={i} style={styles.earnRow}>
          <View style={[styles.earnIcon, { backgroundColor: `${action.color}18` }]}>
            <action.icon size={18} color={action.color} />
          </View>
          <View style={styles.earnInfo}>
            <Text style={styles.earnLabel}>{action.label}</Text>
            <Text style={styles.earnDesc}>{action.desc}</Text>
          </View>
          <View style={[styles.earnBadge, { borderColor: `${action.color}40`, backgroundColor: `${action.color}15` }]}>
            <Text style={[styles.earnBadgeText, { color: action.color }]}>+{action.xp}</Text>
          </View>
        </View>
      ))}

      <View style={styles.referCard}>
        <View style={styles.referIconWrap}>
          <Share2 size={28} color="#A78BFA" />
        </View>
        <Text style={styles.referTitle}>Refer Friends</Text>
        <Text style={styles.referDesc}>
          Earn <Text style={{ color: '#A78BFA', fontWeight: '700' }}>250 XP</Text> for each friend who joins with your link
        </Text>
        <View style={styles.referLinkRow}>
          <TextInput
            style={styles.referLinkInput}
            value={referralLink}
            editable={false}
            selectTextOnFocus
          />
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={() => Clipboard.setStringAsync(referralLink)}
          >
            <Text style={styles.copyBtnText}>Copy</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderHistoryTab = () => {
    if (loadingHistory) {
      return <Text style={styles.historyEmpty}>Loading history...</Text>;
    }
    if (!xpHistory || xpHistory.length === 0) {
      return <Text style={styles.historyEmpty}>No XP history yet. Start earning XP!</Text>;
    }
    return (
      <View style={styles.historyList}>
        {xpHistory.slice(0, 30).map((entry) => (
          <View key={entry.id} style={styles.historyRow}>
            <View style={styles.historyDot} />
            <View style={styles.historyInfo}>
              <Text style={styles.historyAction}>{entry.description ?? getActionLabel(entry.source)}</Text>
              <Text style={styles.historyDate}>
                {new Date(entry.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={styles.historyXP}>+{entry.xpAmount} XP</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['#131F2A', '#0D1B26', '#131F2A']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        {starAnimations.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.star,
              {
                left: `${anim.left}%`,
                top: `${anim.top}%`,
                opacity: anim.opacity,
                transform: [{ translateY: anim.translateY }],
              },
            ]}
          />
        ))}

        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <Zap size={20} color="#4ADE80" fill="#4ADE80" />
              <Text style={styles.sheetTitle}>Level Tracker</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Level Badge + Progress */}
          <View style={styles.badgeSection}>
            <View style={styles.badgeWrap}>
              <View style={[styles.outerRing, { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 }]}>
                <View style={styles.innerBadge}>
                  <View style={styles.greenCircle}>
                    <Text style={styles.levelNumber}>{level}</Text>
                  </View>
                </View>
                <View style={StyleSheet.absoluteFillObject}>
                  <Svg width={badgeSize} height={badgeSize}>
                    <G transform={`rotate(-90 ${center} ${center})`}>
                      <SvgCircle
                        cx={center}
                        cy={center}
                        r={radius}
                        stroke="#4ADE80"
                        strokeWidth={thickness}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - progress)}
                        strokeLinecap="round"
                      />
                    </G>
                  </Svg>
                </View>
              </View>
            </View>
            <Text style={styles.levelLabel}>Level {level}</Text>
            <View style={styles.levelProgressBar}>
              <View style={[styles.levelProgressFill, { width: `${Math.min(100, progressPercent)}%` }]} />
            </View>
            <View style={styles.levelProgressLabels}>
              <Text style={styles.levelProgressXP}>{xpInLevel.toLocaleString()} XP</Text>
              <Text style={styles.levelProgressPct}>{Math.round(progressPercent)}%</Text>
              <Text style={styles.levelProgressXP}>{xpForCurrentLevel.toLocaleString()} XP</Text>
            </View>
          </View>

          {/* Tab Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabBarScroll}
            contentContainerStyle={styles.tabBarContent}
          >
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
                onPress={() => setActiveTab(t.key)}
              >
                <Text style={[styles.tabBtnText, activeTab === t.key && styles.tabBtnTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.tabUnderline} />

          {/* Tab Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.tabContent}
          >
            {activeTab === 'today' ? renderTodayTab() : null}
            {activeTab === 'streaks' ? renderStreaksTab() : null}
            {activeTab === 'milestones' ? renderMilestonesTab() : null}
            {activeTab === 'earnxp' ? renderEarnXPTab() : null}
            {activeTab === 'history' ? renderHistoryTab() : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#4ADE80',
  },
  sheet: {
    height: '92%',
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: 2,
  },

  badgeSection: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  badgeWrap: {
    marginBottom: 8,
  },
  outerRing: {
    backgroundColor: '#131F2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerBadge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#131F2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  levelNumber: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  levelLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  levelProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  levelProgressFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 3,
  },
  levelProgressLabels: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  levelProgressXP: {
    fontSize: 11,
    color: '#64748B',
  },
  levelProgressPct: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600' as const,
  },

  tabBarScroll: {
    flexGrow: 0,
    marginTop: 4,
  },
  tabBarContent: {
    paddingHorizontal: 16,
    gap: 4,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#4ADE80',
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#4ADE80',
    fontWeight: '600' as const,
  },
  tabUnderline: {
    height: 1,
    backgroundColor: '#1E293B',
    marginBottom: 4,
  },
  tabContent: {
    padding: 16,
    paddingBottom: 48,
  },

  // Today tab
  dailyCard: {
    backgroundColor: '#1A2535',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  dailyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dailyCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dailyCardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countdownLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  countdownValue: {
    color: '#4ADE80',
    fontWeight: '700' as const,
  },
  taskList: {
    gap: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2D3C',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 12,
  },
  taskRowLeft: {
    width: 24,
    alignItems: 'center',
  },
  taskRowContent: {
    flex: 1,
  },
  taskRowLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#E2E8F0',
  },
  taskRowLabelDone: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  taskProgressWrap: {
    marginTop: 6,
  },
  taskProgressBar: {
    height: 3,
    backgroundColor: '#2D3D50',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 3,
  },
  taskProgressFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 2,
  },
  taskProgressLabel: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
  },
  taskRowXP: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  taskXPText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  todayXPSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  todayXPLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  todayXPValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#4ADE80',
  },

  // Streaks tab
  streakCard: {
    backgroundColor: '#1A2535',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 20,
  },
  streakHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  streakCardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  streakStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  streakStat: {
    flex: 1,
    alignItems: 'center',
  },
  streakStatNumber: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  streakStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  streakDivider: {
    width: 1,
    height: 44,
    backgroundColor: '#2D3748',
  },
  streakMilestoneBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  streakMilestoneBannerText: {
    fontSize: 13,
    color: '#F59E0B',
    flex: 1,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  subSectionDesc: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  streakMilestonesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  milestoneChip: {
    width: '30%',
    alignItems: 'center',
    gap: 4,
    padding: 12,
    backgroundColor: '#1A2535',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  milestoneChipReached: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  milestoneChipLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  milestoneChipLabelReached: {
    color: '#F59E0B',
  },
  milestoneChipBonus: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
  milestoneChipBonusReached: {
    color: '#F59E0B',
    fontWeight: '700' as const,
  },

  // Milestones tab
  levelMilestonesList: {
    gap: 10,
  },
  levelMilestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2535',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 12,
  },
  levelMilestoneRowReached: {
    backgroundColor: 'rgba(245,158,11,0.06)',
    borderColor: 'rgba(245,158,11,0.2)',
  },
  levelMilestoneBadge: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  levelMilestoneBadgeReached: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.4)',
  },
  levelMilestoneBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#64748B',
  },
  levelMilestoneBadgeTextReached: {
    color: '#F59E0B',
  },
  levelMilestoneInfo: {
    flex: 1,
  },
  levelMilestoneTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#94A3B8',
    marginBottom: 2,
  },
  levelMilestoneReward: {
    fontSize: 12,
    color: '#4ADE80',
  },
  levelMilestoneLock: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelMilestoneLockText: {
    fontSize: 11,
    color: '#475569',
  },

  // Earn XP tab
  earnList: {
    gap: 10,
  },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2535',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 12,
  },
  earnIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  earnInfo: {
    flex: 1,
  },
  earnLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#E2E8F0',
    marginBottom: 2,
  },
  earnDesc: {
    fontSize: 12,
    color: '#64748B',
  },
  earnBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 50,
    alignItems: 'center',
  },
  earnBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  referCard: {
    backgroundColor: '#1A2535',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.2)',
    alignItems: 'center',
    marginTop: 4,
  },
  referIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(167,139,250,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  referTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  referDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 20,
  },
  referLinkRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  referLinkInput: {
    flex: 1,
    backgroundColor: '#0D1B26',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  copyBtn: {
    backgroundColor: '#A78BFA',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },

  // History tab
  historyEmpty: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 40,
  },
  historyList: {
    gap: 8,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2535',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  historyInfo: {
    flex: 1,
  },
  historyAction: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#E2E8F0',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 11,
    color: '#64748B',
  },
  historyXP: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#4ADE80',
  },
});
