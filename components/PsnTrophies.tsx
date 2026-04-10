import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';

interface TrophyCounts {
  platinum: number;
  gold: number;
  silver: number;
  bronze: number;
}

interface GameTile {
  npCommunicationId: string;
  name: string;
  coverArt?: string | null;
  platform?: string;
  earnedTrophies: TrophyCounts;
  definedTrophies: TrophyCounts;
  earnedTotal: number;
  definedTotal: number;
  lastUpdatedDateTime?: string | null;
}

interface PsnTrophiesProps {
  games: GameTile[];
  trophyLevel: number;
  totalTrophies: number;
  lastSync?: string | null;
}

const PSN_BLUE = '#00439C';
const PSN_LIGHT = '#4B9DFF';

const TROPHY_COLORS: Record<string, string> = {
  platinum: '#B0C4DE',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
};

function TrophyPip({ type, earned, total }: { type: keyof TrophyCounts; earned: number; total: number }) {
  if (total === 0) return null;
  const color = TROPHY_COLORS[type] ?? '#94A3B8';
  const label = type.charAt(0).toUpperCase();
  return (
    <View style={[styles.trophyPip, { borderColor: `${color}44` }]}>
      <Text style={[styles.trophyPipLabel, { color }]}>{label}</Text>
      <Text style={styles.trophyPipCount}>
        <Text style={styles.trophyEarned}>{earned}</Text>
        <Text style={styles.trophyTotal}>/{total}</Text>
      </Text>
    </View>
  );
}

function GameTileItem({ item }: { item: GameTile }) {
  const [imgError, setImgError] = useState(false);
  const progress = item.definedTotal > 0 ? item.earnedTotal / item.definedTotal : 0;
  const pct = Math.round(progress * 100);
  const hasPlatinum = item.definedTrophies.platinum > 0;
  const earnedPlatinum = item.earnedTrophies.platinum > 0;

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
            <Text style={styles.coverPlaceholderText}>PSN</Text>
          </View>
        )}
        {hasPlatinum && earnedPlatinum ? (
          <View style={styles.platBadge}>
            <Text style={styles.platBadgeText}>P</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tileInfo}>
        <Text style={styles.gameName} numberOfLines={2}>{item.name}</Text>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
        </View>

        <View style={styles.trophyRow}>
          <TrophyPip type="platinum" earned={item.earnedTrophies.platinum} total={item.definedTrophies.platinum} />
          <TrophyPip type="gold" earned={item.earnedTrophies.gold} total={item.definedTrophies.gold} />
          <TrophyPip type="silver" earned={item.earnedTrophies.silver} total={item.definedTrophies.silver} />
          <TrophyPip type="bronze" earned={item.earnedTrophies.bronze} total={item.definedTrophies.bronze} />
        </View>
      </View>
    </View>
  );
}

function OverallTrophyCount({ type, count }: { type: keyof TrophyCounts; count: number }) {
  const color = TROPHY_COLORS[type] ?? '#94A3B8';
  const label = type.charAt(0).toUpperCase();
  return (
    <View style={[styles.overallTrophyItem, { borderColor: `${color}33` }]}>
      <Text style={[styles.overallTrophyLabel, { color }]}>{label}</Text>
      <Text style={styles.overallTrophyCount}>{count}</Text>
    </View>
  );
}

function formatSync(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PsnTrophies({
  games,
  trophyLevel,
  totalTrophies,
  lastSync,
}: PsnTrophiesProps) {
  const [expanded, setExpanded] = useState(false);
  const displayedGames = expanded ? games : games.slice(0, 5);

  // Aggregate overall trophy counts from all games
  const overallEarned = games.reduce(
    (acc, g) => ({
      platinum: acc.platinum + (g.earnedTrophies.platinum ?? 0),
      gold: acc.gold + (g.earnedTrophies.gold ?? 0),
      silver: acc.silver + (g.earnedTrophies.silver ?? 0),
      bronze: acc.bronze + (g.earnedTrophies.bronze ?? 0),
    }),
    { platinum: 0, gold: 0, silver: 0, bronze: 0 }
  );

  if (!games || games.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.platformBadge}>
            <Text style={styles.psnLogo}>PS</Text>
            <Text style={styles.platformLabel}>PSN Trophies</Text>
          </View>
        </View>
        <Text style={styles.emptyText}>No trophies synced yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.platformBadge}>
          <Text style={styles.psnLogo}>PS</Text>
          <Text style={styles.platformLabel}>PSN Trophies</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>Lvl {trophyLevel}</Text>
          </View>
          <View style={styles.totalBadge}>
            <Text style={styles.totalText}>{totalTrophies.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.overallSummary}>
        <OverallTrophyCount type="platinum" count={overallEarned.platinum} />
        <OverallTrophyCount type="gold" count={overallEarned.gold} />
        <OverallTrophyCount type="silver" count={overallEarned.silver} />
        <OverallTrophyCount type="bronze" count={overallEarned.bronze} />
      </View>

      {lastSync ? (
        <Text style={styles.syncLabel}>Last synced {formatSync(lastSync)}</Text>
      ) : null}

      <View style={styles.list}>
        {displayedGames.map((item) => (
          <GameTileItem key={item.npCommunicationId} item={item} />
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
    backgroundColor: 'rgba(0, 67, 156, 0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(75, 157, 255, 0.2)',
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
    borderBottomColor: 'rgba(75, 157, 255, 0.15)',
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 67, 156, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(75, 157, 255, 0.3)',
    borderRadius: 100,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  psnLogo: {
    color: PSN_LIGHT,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  platformLabel: {
    color: PSN_LIGHT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBadge: {
    backgroundColor: 'rgba(0, 67, 156, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(75, 157, 255, 0.4)',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelText: {
    color: PSN_LIGHT,
    fontSize: 12,
    fontWeight: '800',
  },
  totalBadge: {
    backgroundColor: 'rgba(75, 157, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(75, 157, 255, 0.3)',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  totalText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  overallSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 157, 255, 0.1)',
  },
  overallTrophyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flex: 1,
    justifyContent: 'center',
  },
  overallTrophyLabel: {
    fontSize: 12,
    fontWeight: '900',
  },
  overallTrophyCount: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: 'rgba(75, 157, 255, 0.06)',
    borderRadius: 12,
    padding: 10,
    gap: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(75, 157, 255, 0.18)',
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
    backgroundColor: 'rgba(0, 67, 156, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    color: PSN_LIGHT,
    fontSize: 13,
    fontWeight: '900',
  },
  platBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#6B7FA3',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0a0a0a',
  },
  platBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  tileInfo: {
    flex: 1,
    gap: 5,
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
    backgroundColor: PSN_LIGHT,
    borderRadius: 2,
  },
  trophyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  trophyPip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  trophyPipLabel: {
    fontSize: 10,
    fontWeight: '900',
  },
  trophyPipCount: {
    fontSize: 10,
  },
  trophyEarned: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  trophyTotal: {
    color: '#64748B',
    fontWeight: '500',
  },
  expandButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(75, 157, 255, 0.15)',
  },
  expandText: {
    color: PSN_LIGHT,
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
