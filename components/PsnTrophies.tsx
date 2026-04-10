import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Star, Lock } from 'lucide-react-native';

interface Trophy {
  id: string | number;
  name: string;
  description: string;
  icon?: string | null;
  type: 'platinum' | 'gold' | 'silver' | 'bronze';
  earned: boolean;
  gameTitle?: string;
  gameCoverArt?: string | null;
}

interface PsnTrophiesProps {
  trophies: Trophy[];
  trophyLevel: number;
  totalTrophies: number;
  lastSync?: string | null;
  accentColor?: string;
}

const PSN_BLUE = '#00439C';
const PSN_LIGHT = '#4B9DFF';

const TROPHY_COLORS: Record<string, string> = {
  platinum: '#B0C4DE',
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
};

const TROPHY_LABELS: Record<string, string> = {
  platinum: 'P',
  gold: 'G',
  silver: 'S',
  bronze: 'B',
};

function TrophyItem({ item }: { item: Trophy }) {
  const [imgError, setImgError] = useState(false);
  const trophyColor = TROPHY_COLORS[item.type] ?? '#94A3B8';

  return (
    <View style={[styles.trophyCard, !item.earned && styles.lockedCard]}>
      <View style={styles.iconContainer}>
        {item.icon && !imgError ? (
          <Image
            source={{ uri: item.icon }}
            style={styles.trophyIcon}
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.trophyIconPlaceholder, !item.earned && styles.lockedIconPlaceholder]}>
            {item.earned ? (
              <Star size={18} color={trophyColor} />
            ) : (
              <Lock size={18} color='#4B5563' />
            )}
          </View>
        )}
      </View>

      <View style={styles.trophyInfo}>
        <Text style={[styles.trophyName, !item.earned && styles.lockedText]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.gameTitle ? (
          <Text style={styles.gameTitle} numberOfLines={1}>{item.gameTitle}</Text>
        ) : null}
        {item.description ? (
          <Text style={styles.trophyDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
      </View>

      <View style={[styles.typeBadge, { backgroundColor: `${trophyColor}22`, borderColor: `${trophyColor}55` }]}>
        <Text style={[styles.typeText, { color: trophyColor }]}>{TROPHY_LABELS[item.type] ?? '?'}</Text>
      </View>
    </View>
  );
}

function TrophyCount({ type, count }: { type: string; count: number }) {
  const color = TROPHY_COLORS[type] ?? '#94A3B8';
  const label = TROPHY_LABELS[type] ?? '?';
  return (
    <View style={[styles.trophyCountItem, { borderColor: `${color}44` }]}>
      <Text style={[styles.trophyCountLabel, { color }]}>{label}</Text>
      <Text style={styles.trophyCountNum}>{count}</Text>
    </View>
  );
}

export default function PsnTrophies({
  trophies,
  trophyLevel,
  totalTrophies,
  lastSync,
}: PsnTrophiesProps) {
  const [expanded, setExpanded] = useState(false);
  const displayedTrophies = expanded ? trophies : trophies.slice(0, 5);
  const earnedCount = trophies.filter(t => t.earned).length;

  const platinumCount = trophies.filter(t => t.type === 'platinum' && t.earned).length;
  const goldCount = trophies.filter(t => t.type === 'gold' && t.earned).length;
  const silverCount = trophies.filter(t => t.type === 'silver' && t.earned).length;
  const bronzeCount = trophies.filter(t => t.type === 'bronze' && t.earned).length;

  const formatSync = (dateStr?: string | null) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!trophies || trophies.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={[styles.platformBadge, { backgroundColor: `${PSN_BLUE}22`, borderColor: `${PSN_LIGHT}44` }]}>
            <Star size={14} color={PSN_LIGHT} />
            <Text style={[styles.platformLabel, { color: PSN_LIGHT }]}>PSN Trophies</Text>
          </View>
        </View>
        <Text style={styles.emptyText}>No trophies synced yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.platformBadge, { backgroundColor: `${PSN_BLUE}22`, borderColor: `${PSN_LIGHT}44` }]}>
          <Star size={14} color={PSN_LIGHT} />
          <Text style={[styles.platformLabel, { color: PSN_LIGHT }]}>PSN Trophies</Text>
        </View>

        <View style={[styles.levelBadge, { backgroundColor: `${PSN_BLUE}33`, borderColor: `${PSN_LIGHT}55` }]}>
          <Text style={[styles.levelText, { color: PSN_LIGHT }]}>Lvl {trophyLevel}</Text>
        </View>
      </View>

      <View style={styles.trophyCountRow}>
        <TrophyCount type="platinum" count={platinumCount} />
        <TrophyCount type="gold" count={goldCount} />
        <TrophyCount type="silver" count={silverCount} />
        <TrophyCount type="bronze" count={bronzeCount} />
        <View style={styles.totalTrophies}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalNum}>{totalTrophies}</Text>
        </View>
      </View>

      {lastSync ? (
        <Text style={styles.syncLabel}>Last synced {formatSync(lastSync)}</Text>
      ) : null}

      <View style={styles.list}>
        {displayedTrophies.map((item) => (
          <TrophyItem key={String(item.id)} item={item} />
        ))}
      </View>

      {trophies.length > 5 ? (
        <TouchableOpacity style={styles.expandButton} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
          <Text style={[styles.expandText, { color: PSN_LIGHT }]}>
            {expanded ? 'Show less' : `Show all ${trophies.length} trophies`}
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
  levelBadge: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '800',
  },
  trophyCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(75, 157, 255, 0.1)',
  },
  trophyCountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  trophyCountLabel: {
    fontSize: 11,
    fontWeight: '900',
  },
  trophyCountNum: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  totalTrophies: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
  },
  totalLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  totalNum: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '800',
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
  trophyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(75, 157, 255, 0.08)',
    borderRadius: 10,
    padding: 10,
    gap: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(75, 157, 255, 0.2)',
  },
  lockedCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.07)',
  },
  iconContainer: {
    flexShrink: 0,
  },
  trophyIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  trophyIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(75, 157, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedIconPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  trophyInfo: {
    flex: 1,
    gap: 2,
  },
  trophyName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  lockedText: {
    color: '#64748B',
  },
  gameTitle: {
    color: PSN_LIGHT,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  trophyDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 15,
  },
  typeBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  expandButton: {
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(75, 157, 255, 0.15)',
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
