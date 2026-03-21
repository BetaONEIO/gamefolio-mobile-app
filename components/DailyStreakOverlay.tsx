import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { Flame, Zap, Star, Trophy } from 'lucide-react-native';
import { useDailyStreak } from '@/context/DailyStreakContext';

export default function DailyStreakOverlay() {
  const { streakInfo, dismissStreak } = useDailyStreak();
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (streakInfo) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 80,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [streakInfo]);

  if (!streakInfo) return null;

  const isNewMilestone = streakInfo.isNewMilestone;

  return (
    <Modal
      transparent
      visible={!!streakInfo}
      onRequestClose={dismissStreak}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: scaleAnim }], opacity: opacityAnim },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconCircle, isNewMilestone && styles.iconCircleMilestone]}>
            {isNewMilestone ? (
              <Trophy size={40} color="#F59E0B" />
            ) : (
              <Flame size={40} color="#F97316" />
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {isNewMilestone ? 'Milestone Reached!' : 'Daily Login Bonus'}
          </Text>

          {/* Message */}
          <Text style={styles.message}>{streakInfo.message}</Text>

          {/* XP Badge */}
          <View style={styles.xpRow}>
            <View style={styles.xpBadge}>
              <Zap size={16} color="#4ADE80" />
              <Text style={styles.xpText}>+{streakInfo.bonusAwarded} XP</Text>
            </View>
          </View>

          {/* Streak */}
          <View style={styles.streakRow}>
            <Flame size={14} color="#F97316" />
            <Text style={styles.streakText}>{streakInfo.currentStreak} day streak</Text>
            <Star size={14} color="#F97316" />
          </View>

          {/* Dismiss button */}
          <TouchableOpacity style={styles.claimBtn} onPress={dismissStreak}>
            <Text style={styles.claimBtnText}>Claim Reward</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  card: {
    width: '100%',
    backgroundColor: '#1A2332',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(249,115,22,0.3)',
  },
  iconCircleMilestone: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.3)',
  },
  title: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  xpRow: {
    marginBottom: 12,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(74,222,128,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
  },
  xpText: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#4ADE80',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
  },
  streakText: {
    fontSize: 14,
    color: '#F97316',
    fontWeight: '600' as const,
  },
  claimBtn: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
  },
  claimBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0F1520',
  },
});
