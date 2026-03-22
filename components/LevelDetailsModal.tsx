import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, Clipboard, Animated } from 'react-native';
import { X, Zap, UserPlus, MessageSquare, Video, Share2 } from 'lucide-react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface LevelProgressData {
  level: number;
  currentXP: number;
  currentPoints: number;
  pointsForCurrentLevel: number;
  pointsForNextLevel: number;
  pointsRemaining: number;
  progressPercent: number;
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

interface XPTask {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  icon: any;
  iconColor: string;
  iconBg: string;
}

const XP_TASKS: XPTask[] = [
  {
    id: 'upload-video',
    title: 'Upload a Video Clip/Reel',
    description: 'Share a new gaming highlight to your Gamefolio.',
    xpReward: 100,
    icon: Video,
    iconColor: '#4ADE80',
    iconBg: '#131F2A',
  },
  {
    id: 'invite-friends',
    title: 'Invite a Friend',
    description: 'Bring a friend to Gamefolio and share in XP rewards!',
    xpReward: 250,
    icon: UserPlus,
    iconColor: '#4ADE80',
    iconBg: '#131F2A',
  },
  {
    id: 'community-discussion',
    title: 'Comment',
    description: 'Post 3 comments on clips, reels or screenshots.',
    xpReward: 75,
    icon: MessageSquare,
    iconColor: '#4ADE80',
    iconBg: '#131F2A',
  },
];



export default function LevelDetailsModal({ visible, onClose, level: propLevel, currentXP: propCurrentXP, userId, onTaskStart }: LevelDetailsModalProps) {
  const [activeTab, setActiveTab] = useState<'earn' | 'refer'>('earn');
  const [levelProgress, setLevelProgress] = useState<LevelProgressData | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const { authTokens } = useAuth();

  useEffect(() => {
    const fetchLevelProgress = async () => {
      if (!visible || !userId) return;
      
      setIsLoadingProgress(true);
      try {
        const numericUserId = parseInt(userId, 10);
        if (!isNaN(numericUserId)) {
          console.log('[LevelDetailsModal] Fetching level progress from server for user:', numericUserId);
          const progress = await api.users.getLevelProgress(numericUserId, authTokens?.accessToken || undefined);
          console.log('[LevelDetailsModal] Server level progress:', progress);
          setLevelProgress(progress);
        }
      } catch (error) {
        console.log('[LevelDetailsModal] Error fetching level progress, using local calculation:', error);
        setLevelProgress(null);
      } finally {
        setIsLoadingProgress(false);
      }
    };

    fetchLevelProgress();
  }, [visible, userId, authTokens?.accessToken]);

  const handleTaskStart = (taskId: string) => {
    if (taskId === 'invite-friends') {
      setActiveTab('refer');
    }
    if (onTaskStart) {
      onTaskStart(taskId);
    }
  };

  const referralLink = `https://gamefolio.app/ref/${userId || 'XXXXX'}`;
  
  const level = levelProgress?.level ?? propLevel;
  const currentXP = levelProgress?.currentXP ?? propCurrentXP;
  const pointsForNextLevel = levelProgress?.pointsForNextLevel ?? (1000 * level);
  const pointsRemaining = levelProgress?.pointsRemaining ?? 0;
  
  const xpForCurrentLevel = levelProgress?.pointsForNextLevel 
    ? (levelProgress.pointsForNextLevel - levelProgress.pointsForCurrentLevel) 
    : (1000 * propLevel);
  const xpStartOfLevel = levelProgress?.pointsForCurrentLevel ?? (500 * propLevel * (propLevel - 1));
  const xpInLevel = levelProgress 
    ? (levelProgress.currentXP - levelProgress.pointsForCurrentLevel) 
    : Math.max(0, propCurrentXP - xpStartOfLevel);
  
  const progressPercent = levelProgress?.progressPercent ?? (() => {
    const localProgress = Math.min(1, xpInLevel / xpForCurrentLevel);
    return Math.round(localProgress * 100);
  })();
  
  const progress = progressPercent / 100;

  const badgeSize = 160;
  const thickness = 8;
  const radius = (badgeSize - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = badgeSize / 2;



  const starAnimations = useRef(
    Array.from({ length: 20 }).map(() => ({
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(Math.random() * 0.5 + 0.3),
    }))
  ).current;

  useEffect(() => {
    starAnimations.forEach((anim, index) => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(anim.translateY, {
              toValue: -20,
              duration: 2000 + Math.random() * 1000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 0.8,
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
              toValue: 0.3,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    });
  }, [starAnimations]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#131F2A', '#134E4A', '#131F2A']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        {starAnimations.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.star,
              {
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: anim.opacity,
                transform: [{ translateY: anim.translateY }],
              },
            ]}
          />
        ))}
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconContainer}>
                <Zap size={24} color="#4ADE80" fill="#4ADE80" />
              </View>
              <Text style={styles.headerTitle}>Level Progress</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Level Badge */}
            <View style={styles.badgeContainer}>
              <View style={[styles.levelBadge, { width: badgeSize, height: badgeSize }]}>
                <View style={styles.outerRing}>
                  <View style={styles.innerBadge}>
                    <View style={styles.greenCircle}>
                      <Text style={styles.levelNumber}>{level}</Text>
                    </View>
                  </View>
                  
                  <View style={StyleSheet.absoluteFillObject}>
                    <Svg width={badgeSize} height={badgeSize}>
                      <G transform={`rotate(-90 ${center} ${center})`}>
                        <Circle
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

              <View style={styles.shadowCircle1} />
              <View style={styles.shadowCircle2} />
            </View>

            {/* Level Info */}
            <Text style={styles.levelTitle}>Level {level}</Text>
            <Text style={styles.progressText}>{progressPercent}% to next level</Text>

            {/* Progress Bar */}
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.progressLabel}>{xpInLevel} XP</Text>
                <Text style={styles.progressLabel}>{xpForCurrentLevel} XP</Text>
              </View>
            </View>



            {/* Tabs */}
            <View style={styles.tabsContainer}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'earn' && styles.activeTab]}
                onPress={() => setActiveTab('earn')}
              >
                <Text style={[styles.tabText, activeTab === 'earn' && styles.activeTabText]}>Earn XP</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'refer' && styles.activeTab]}
                onPress={() => setActiveTab('refer')}
              >
                <Text style={[styles.tabText, activeTab === 'refer' && styles.activeTabText]}>Refer Friends</Text>
              </TouchableOpacity>
            </View>

            {/* Earn XP Tab Content */}
            {activeTab === 'earn' && (
              <View style={styles.tasksSection}>
                <Text style={styles.sectionSubtitle}>Complete tasks to level up faster</Text>

                <View style={styles.tasksList}>
                  {XP_TASKS.map((task) => (
                    <View key={task.id} style={styles.taskCard}>
                      <View style={[styles.taskIcon, { backgroundColor: task.iconBg }]}>
                        <task.icon size={24} color={task.iconColor} />
                      </View>
                      
                      <View style={styles.taskContent}>
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        <Text style={styles.taskDescription}>{task.description}</Text>
                      </View>

                      <View style={styles.taskRight}>
                        <View style={styles.xpBadge}>
                          <Text style={styles.xpBadgeText}>+{task.xpReward} XP</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.startButton}
                          onPress={() => handleTaskStart(task.id)}
                        >
                          <Text style={styles.startButtonText}>Start</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Refer Friends Tab Content */}
            {activeTab === 'refer' && (
              <View style={styles.referSection}>
                <Text style={styles.sectionSubtitle}>Share your unique referral link</Text>

                <View style={styles.referCard}>
                  <View style={styles.referIconContainer}>
                    <Share2 size={32} color="#4ADE80" />
                  </View>
                  <Text style={styles.referDescription}>
                    Earn <Text style={styles.referHighlight}>250 XP</Text> for each friend that joins using your link!
                  </Text>
                  
                  <View style={styles.referLinkContainer}>
                    <TextInput
                      style={styles.referLinkInput}
                      value={referralLink}
                      editable={false}
                      selectTextOnFocus
                    />
                    <TouchableOpacity 
                      style={styles.copyButton}
                      onPress={() => {
                        Clipboard.setString(referralLink);
                      }}
                    >
                      <Text style={styles.copyButtonText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
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
  content: {
    height: '90%',
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  closeButton: {
    padding: 4,
  },

  scrollContent: {
    paddingBottom: 40,
  },
  badgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    marginBottom: 24,
    position: 'relative',
  },
  levelBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  outerRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#131F2A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  innerBadge: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#131F2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greenCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
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
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFF',
  },
  shadowCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    zIndex: 1,
  },
  shadowCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(74, 222, 128, 0.04)',
    zIndex: 0,
  },
  levelTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressBarContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 6,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  activeTab: {
    borderColor: '#4ADE80',
    backgroundColor: '#1E293B',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#4ADE80',
  },
  tasksSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  tasksList: {
    gap: 12,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  taskIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  taskContent: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  taskDescription: {
    fontSize: 12,
    color: '#94A3B8',
  },
  taskRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  xpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  xpBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4ADE80',
  },
  startButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4ADE80',
    borderRadius: 8,
  },
  startButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#131F2A',
  },
  referSection: {
    marginBottom: 40,
  },
  referCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  referIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#131F2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  referDescription: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  referHighlight: {
    color: '#4ADE80',
    fontWeight: 'bold',
  },
  referLinkContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  referLinkInput: {
    flex: 1,
    backgroundColor: '#131F2A',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
    color: '#FFF',
    borderWidth: 1,
    borderColor: '#334155',
  },
  copyButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#131F2A',
  },
});
