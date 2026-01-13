import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Gift,
  ArrowLeft,
  Sparkles,
  Zap,
  Coins,
  Star,
  Trophy,
  Crown,
  Gem,
  Award,
  Package,
  RefreshCw
} from 'lucide-react-native';
import { useLootboxCollection, CollectedItem } from '@/context/LootboxCollectionContext';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const RARITY_COLORS = {
  common: '#94A3B8',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
};

const RARITY_GRADIENTS: Record<string, readonly [string, string]> = {
  common: ['#475569', '#334155'] as const,
  rare: ['#3B82F6', '#1D4ED8'] as const,
  epic: ['#A855F7', '#7C3AED'] as const,
  legendary: ['#F59E0B', '#D97706'] as const,
};

type TabType = 'all' | 'xp' | 'coins' | 'items';

const TABS: { key: TabType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'xp', label: 'XP' },
  { key: 'coins', label: 'Coins' },
  { key: 'items', label: 'Items' },
];

const ItemCard = ({ item }: { item: CollectedItem }) => {
  const getIcon = () => {
    switch (item.type) {
      case 'xp':
        return <Zap size={28} color="#FFF" />;
      case 'coins':
        return <Coins size={28} color="#FFF" />;
      case 'item':
        if (item.name.toLowerCase().includes('badge')) {
          return <Award size={28} color="#FFF" />;
        }
        if (item.name.toLowerCase().includes('legend')) {
          return <Crown size={28} color="#FFF" />;
        }
        return <Gem size={28} color="#FFF" />;
      default:
        return <Star size={28} color="#FFF" />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.itemCard}>
      <LinearGradient
        colors={RARITY_GRADIENTS[item.rarity]}
        style={styles.itemCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.itemIconContainer}>
          {getIcon()}
        </View>
        
        <View style={styles.rarityBadge}>
          <Text style={[styles.rarityText, { color: RARITY_COLORS[item.rarity] }]}>
            {item.rarity.toUpperCase()}
          </Text>
        </View>
      </LinearGradient>
      
      <View style={styles.itemContent}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemAmount}>+{item.amount.toLocaleString()}</Text>
        <Text style={styles.itemDate}>{formatDate(item.claimedAt)}</Text>
      </View>
    </View>
  );
};

const StatCard = ({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  color: string;
}) => (
  <View style={styles.statCard}>
    <View style={[styles.statIconContainer, { backgroundColor: `${color}20` }]}>
      {icon}
    </View>
    <Text style={styles.statValue}>{value.toLocaleString()}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default function CollectionsScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, stats, isLoading, isSyncing, getItemsByType, getSpecialItems, syncWithDatabase } = useLootboxCollection();
  const { getAccessToken, isAuthenticated } = useAuth();

  const filteredItems = useMemo(() => {
    switch (activeTab) {
      case 'xp':
        return getItemsByType('xp');
      case 'coins':
        return getItemsByType('coins');
      case 'items':
        return getSpecialItems();
      default:
        return items;
    }
  }, [activeTab, items, getItemsByType, getSpecialItems]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => 
      new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime()
    );
  }, [filteredItems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isAuthenticated) {
        const token = await getAccessToken();
        if (token) {
          await syncWithDatabase(token);
        }
      }
    } catch (error) {
      console.error('[Collections] Failed to refresh:', error);
    } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated, getAccessToken, syncWithDatabase]);

  useEffect(() => {
    const syncOnMount = async () => {
      if (isAuthenticated) {
        const token = await getAccessToken();
        if (token) {
          await syncWithDatabase(token);
        }
      }
    };
    
    if (isAuthenticated && !isLoading) {
      syncOnMount();
    }
  }, [isAuthenticated, isLoading, getAccessToken, syncWithDatabase]);

  const renderHeader = () => (
    <View style={styles.headerSection}>
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Lootbox Stats</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon={<Package size={20} color="#A855F7" />}
            label="Opened"
            value={stats.totalOpened}
            color="#A855F7"
          />
          <StatCard
            icon={<Zap size={20} color="#F59E0B" />}
            label="Total XP"
            value={stats.totalXP}
            color="#F59E0B"
          />
          <StatCard
            icon={<Coins size={20} color="#EAB308" />}
            label="Total Coins"
            value={stats.totalCoins}
            color="#EAB308"
          />
          <StatCard
            icon={<Trophy size={20} color="#4ADE80" />}
            label="Legendaries"
            value={stats.legendaryCount}
            color="#4ADE80"
          />
        </View>
      </View>

      <View style={styles.rarityBreakdown}>
        <Text style={styles.sectionTitle}>Rarity Breakdown</Text>
        <View style={styles.rarityBars}>
          <View style={styles.rarityRow}>
            <View style={styles.rarityLabelContainer}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS.legendary }]} />
              <Text style={styles.rarityLabel}>Legendary</Text>
            </View>
            <Text style={[styles.rarityCount, { color: RARITY_COLORS.legendary }]}>
              {stats.legendaryCount}
            </Text>
          </View>
          <View style={styles.rarityRow}>
            <View style={styles.rarityLabelContainer}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS.epic }]} />
              <Text style={styles.rarityLabel}>Epic</Text>
            </View>
            <Text style={[styles.rarityCount, { color: RARITY_COLORS.epic }]}>
              {stats.epicCount}
            </Text>
          </View>
          <View style={styles.rarityRow}>
            <View style={styles.rarityLabelContainer}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS.rare }]} />
              <Text style={styles.rarityLabel}>Rare</Text>
            </View>
            <Text style={[styles.rarityCount, { color: RARITY_COLORS.rare }]}>
              {stats.rareCount}
            </Text>
          </View>
          <View style={styles.rarityRow}>
            <View style={styles.rarityLabelContainer}>
              <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS.common }]} />
              <Text style={styles.rarityLabel}>Common</Text>
            </View>
            <Text style={[styles.rarityCount, { color: RARITY_COLORS.common }]}>
              {stats.commonCount}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.collectionsHeader}>
        <Text style={styles.sectionTitle}>Collected Items</Text>
        <Text style={styles.itemCountBadge}>{items.length} total</Text>
      </View>

      <View style={styles.tabsContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Gift size={56} color="#A855F7" />
        <Sparkles size={24} color="#F59E0B" style={styles.sparkle} />
      </View>
      <Text style={styles.emptyTitle}>No items yet</Text>
      <Text style={styles.emptyDescription}>
        Open daily lootboxes to collect XP, coins, and exclusive items!
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Loading collection...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0F1520', '#1A1F2E']}
        style={StyleSheet.absoluteFillObject}
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Gift size={22} color="#A855F7" />
          <Text style={styles.headerTitle}>Lootbox Collection</Text>
        </View>
        {isSyncing ? (
          <ActivityIndicator size="small" color="#A855F7" />
        ) : (
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
            activeOpacity={0.7}
          >
            <RefreshCw size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={sortedItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        renderItem={({ item }) => <ItemCard item={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A855F7"
            colors={['#A855F7']}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSpacer: {
    width: 40,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  headerSection: {
    paddingTop: 20,
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: (width - 60) / 2,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  rarityBreakdown: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rarityBars: {
    gap: 10,
  },
  rarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rarityLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rarityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rarityLabel: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  rarityCount: {
    fontSize: 16,
    fontWeight: '700',
  },
  collectionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemCountBadge: {
    fontSize: 13,
    color: '#94A3B8',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#A855F7',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#FFF',
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemCard: {
    width: CARD_WIDTH,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemCardGradient: {
    width: '100%',
    aspectRatio: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  itemIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rarityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rarityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  itemContent: {
    padding: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  itemAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4ADE80',
    marginBottom: 4,
  },
  itemDate: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  sparkle: {
    position: 'absolute',
    top: -10,
    right: -16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
});
