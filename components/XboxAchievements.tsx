import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Gamepad2, Trophy, Star, Lock } from 'lucide-react-native';

interface Achievement {
  id: string | number;
  name: string;
  description: string;
  icon?: string | null;
  gamerscore: number;
  unlocked: boolean;
  gameTitle?: string;
  gameCoverArt?: string | null;
}

interface XboxAchievementsProps {
  achievements: Achievement[];
  totalAchievements: number;
  gamerscore: number;
  lastSync?: string | null;
  accentColor?: string;
}

const XBOX_GREEN = '#107C10';
const XBOX_LIGHT = '#52B043';

function AchievementItem({ item }: { item: Achievement }) {
  const [imgError, setImgError] = useState(false);

  return (
    <View style={[styles.achievementCard, !item.unlocked && styles.lockedCard]}>
      <View style={styles.iconContainer}>
        {item.icon && !imgError ? (
          <Image
            source={{ uri: item.icon }}
            style={styles.achievementIcon}
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.achievementIconPlaceholder, !item.unlocked && styles.lockedIconPlaceholder]}>
            {item.unlocked ? (
              <Star size={18} color={XBOX_LIGHT} />
            ) : (
              <Lock size={18} color='#4B5563' />
            )}
          </View>
        )}
      </View>

      <View style={styles.achievementInfo}>
        <Text style={[styles.achievementName, !item.unlocked && styles.lockedText]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.gameTitle ? (
          <Text style={styles.gameTitle} numberOfLines={1}>{item.gameTitle}</Text>
        ) : null}
        {item.description ? (
          <Text style={styles.achievementDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
      </View>

      <View style={[styles.scoreChip, !item.unlocked && styles.lockedScoreChip]}>
        <Text style={[styles.scoreText, !item.unlocked && styles.lockedScoreText]}>{item.gamerscore}G</Text>
      </View>
    </View>
  );
}

export default function XboxAchievements({
  achievements,
  totalAchievements,
  gamerscore,
  lastSync,
  accentColor = XBOX_GREEN,
}: XboxAchievementsProps) {
  const [expanded, setExpanded] = useState(false);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const displayedAchievements = expanded ? achievements : achievements.slice(0, 5);

  const formatSync = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!achievements || achievements.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.platformBadge, { backgroundColor: `${XBOX_GREEN}22`, borderColor: `${XBOX_GREEN}44` }]}>
            <Gamepad2 size={14} color={XBOX_LIGHT} />
            <Text style={[styles.platformLabel, { color: XBOX_LIGHT }]}>Xbox Achievements</Text>
          </View>
        </View>
        <Text style={styles.emptyText}>No achievements synced yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.platformBadge, { backgroundColor: `${XBOX_GREEN}22`, borderColor: `${XBOX_GREEN}44` }]}>
          <Gamepad2 size={14} color={XBOX_LIGHT} />
          <Text style={[styles.platformLabel, { color: XBOX_LIGHT }]}>Xbox Achievements</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Trophy size={12} color={XBOX_LIGHT} />
            <Text style={styles.statValue}>{unlockedCount}<Text style={styles.statTotal}>/{totalAchievements}</Text></Text>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: `${XBOX_GREEN}33`, borderColor: `${XBOX_GREEN}55` }]}>
            <Text style={[styles.scoreBadgeText, { color: XBOX_LIGHT }]}>{gamerscore.toLocaleString()}G</Text>
          </View>
        </View>
      </View>

      {lastSync ? (
        <Text style={styles.syncLabel}>Last synced {formatSync(lastSync)}</Text>
      ) : null}

      <View style={styles.list}>
        {displayedAchievements.map((item) => (
          <AchievementItem key={String(item.id)} item={item} />
        ))}
      </View>

      {achievements.length > 5 ? (
        <TouchableOpacity style={styles.expandButton} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
          <Text style={[styles.expandText, { color: XBOX_LIGHT }]}>
            {expanded ? 'Show less' : `Show all ${achievements.length} achievements`}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(16, 124, 16, 0.07)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 124, 16, 0.2)',
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 124, 16, 0.15)',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  platformLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  statTotal: {
    color: '#64748B',
    fontWeight: '500',
  },
  scoreBadge: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  syncLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '500',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
  },
  list: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 4,
    gap: 6,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(82, 176, 67, 0.08)',
    borderRadius: 10,
    padding: 10,
    gap: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(82, 176, 67, 0.2)',
  },
  lockedCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.07)',
  },
  iconContainer: {
    flexShrink: 0,
  },
  achievementIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  achievementIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(82, 176, 67, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedIconPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  achievementInfo: {
    flex: 1,
    gap: 2,
  },
  achievementName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedText: {
    color: '#64748B',
  },
  gameTitle: {
    color: '#52B043',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  achievementDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  scoreChip: {
    backgroundColor: 'rgba(82, 176, 67, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(82, 176, 67, 0.4)',
  },
  lockedScoreChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scoreText: {
    color: '#52B043',
    fontSize: 11,
    fontWeight: '800',
  },
  lockedScoreText: {
    color: '#4B5563',
  },
  expandButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 124, 16, 0.15)',
  },
  expandText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    padding: 16,
    textAlign: 'center',
  },
});
