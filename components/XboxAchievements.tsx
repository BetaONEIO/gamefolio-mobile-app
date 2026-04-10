import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Gamepad2, Trophy } from 'lucide-react-native';

interface GameTile {
  titleId: string;
  name: string;
  coverArt?: string | null;
  earnedCount: number;
  totalCount: number;
  earnedGamerscore: number;
  totalGamerscore: number;
}

interface XboxAchievementsProps {
  games: GameTile[];
  totalAchievements: number;
  gamerscore: number;
  lastSync?: string | null;
}

const XBOX_GREEN = '#107C10';
const XBOX_LIGHT = '#52B043';

function GameTileItem({ item }: { item: GameTile }) {
  const [imgError, setImgError] = useState(false);
  const progress = item.totalCount > 0 ? item.earnedCount / item.totalCount : 0;
  const pct = Math.round(progress * 100);

  return (
    <View style={styles.gameTile}>
      <View style={styles.coverWrapper}>
        {item.coverArt && !imgError ? (
          <Image
            source={{ uri: item.coverArt }}
            style={styles.coverArt}
            onError={() => setImgError(true)}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.coverPlaceholder}>
            <Gamepad2 size={20} color={XBOX_LIGHT} />
          </View>
        )}
        {pct === 100 ? (
          <View style={styles.completedBadge}>
            <Trophy size={10} color="#FFF" />
          </View>
        ) : null}
      </View>

      <View style={styles.tileInfo}>
        <Text style={styles.gameName} numberOfLines={2}>{item.name}</Text>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>

        <View style={styles.tileStats}>
          <Text style={styles.achCount}>
            <Text style={styles.achEarned}>{item.earnedCount}</Text>
            <Text style={styles.achTotal}>/{item.totalCount} achievements</Text>
          </Text>
          <View style={[styles.gsBadge]}>
            <Text style={styles.gsText}>{item.earnedGamerscore.toLocaleString()}G</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function formatSync(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function XboxAchievements({
  games,
  totalAchievements,
  gamerscore,
  lastSync,
}: XboxAchievementsProps) {
  const [expanded, setExpanded] = useState(false);
  const displayedGames = expanded ? games : games.slice(0, 5);

  if (!games || games.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.platformBadge]}>
            <Gamepad2 size={14} color={XBOX_LIGHT} />
            <Text style={styles.platformLabel}>Xbox Achievements</Text>
          </View>
        </View>
        <Text style={styles.emptyText}>No achievements synced yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.platformBadge}>
          <Gamepad2 size={14} color={XBOX_LIGHT} />
          <Text style={styles.platformLabel}>Xbox Achievements</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Trophy size={12} color={XBOX_LIGHT} />
            <Text style={styles.statValue}>{totalAchievements.toLocaleString()}</Text>
          </View>
          <View style={styles.scoreBadge}>
            <Text style={styles.scoreBadgeText}>{gamerscore.toLocaleString()}G</Text>
          </View>
        </View>
      </View>

      {lastSync ? (
        <Text style={styles.syncLabel}>Last synced {formatSync(lastSync)}</Text>
      ) : null}

      <View style={styles.list}>
        {displayedGames.map((item) => (
          <GameTileItem key={item.titleId} item={item} />
        ))}
      </View>

      {games.length > 5 ? (
        <TouchableOpacity style={styles.expandButton} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
          <Text style={styles.expandText}>
            {expanded ? 'Show less' : `Show all ${games.length} games`}
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
    backgroundColor: 'rgba(16, 124, 16, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(82, 176, 67, 0.3)',
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  platformLabel: {
    color: XBOX_LIGHT,
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
  scoreBadge: {
    backgroundColor: 'rgba(82, 176, 67, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(82, 176, 67, 0.4)',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  scoreBadgeText: {
    color: XBOX_LIGHT,
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
    paddingTop: 6,
    gap: 8,
  },
  gameTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(82, 176, 67, 0.06)',
    borderRadius: 12,
    padding: 10,
    gap: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(82, 176, 67, 0.18)',
  },
  coverWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  coverArt: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  coverPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: 'rgba(82, 176, 67, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: XBOX_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0a0a0a',
  },
  tileInfo: {
    flex: 1,
    gap: 4,
  },
  gameName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: XBOX_LIGHT,
    borderRadius: 2,
  },
  tileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  achCount: {
    fontSize: 11,
  },
  achEarned: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  achTotal: {
    color: '#64748B',
    fontWeight: '500',
  },
  gsBadge: {
    backgroundColor: 'rgba(82, 176, 67, 0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  gsText: {
    color: XBOX_LIGHT,
    fontSize: 11,
    fontWeight: '800',
  },
  expandButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 124, 16, 0.15)',
  },
  expandText: {
    color: XBOX_LIGHT,
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
