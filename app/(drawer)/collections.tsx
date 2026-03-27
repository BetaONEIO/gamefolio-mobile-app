import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList, Image, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, RefreshCw } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Env } from '@/constants/Env';
import { resolveNftImageUrl } from '@/lib/image-utils';

const { width } = Dimensions.get('window');
const NUM_COLS = 2;
const CARD_MARGIN = 12;
const SIDE_PAD = 16;
const CARD_WIDTH = (width - SIDE_PAD * 2 - CARD_MARGIN * (NUM_COLS - 1)) / NUM_COLS;

type TabType = 'nfts' | 'borders' | 'tags';
type FilterType = 'owned' | 'sold';

export default function Collections() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('nfts');
  const [filter, setFilter] = useState<FilterType>('owned');
  const [refreshing, setRefreshing] = useState(false);

  const { data: nftData, isLoading, refetch } = useQuery({
    queryKey: ['/api/nfts/owned'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`${Env.BACKEND_URL}/api/nfts/owned`, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to fetch NFTs');
      return res.json();
    },
  });

  const allNfts: any[] = nftData?.nfts || [];

  const nfts = useMemo(
    () => allNfts.filter((n: any) => (filter === 'owned' ? !n.sold : n.sold)),
    [allNfts, filter]
  );

  const ownedCount = useMemo(() => allNfts.filter((n: any) => !n.sold).length, [allNfts]);
  const soldCount = useMemo(() => allNfts.filter((n: any) => n.sold).length, [allNfts]);
  const totalCount = allNfts.length;

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderNFTCard = ({ item }: { item: any }) => {
    const imageUrl = resolveNftImageUrl(item.image || item.imageDataUrl);
    const rarity = item.rarity || 'RARE';
    const isSold = !!item.sold;

    return (
      <View style={styles.nftCard}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.nftImage} resizeMode="cover" />
        ) : (
          <View style={styles.nftImagePlaceholder} />
        )}

        <View style={styles.tokenIdBadge}>
          <Text style={styles.tokenIdBadgeText}>#{item.tokenId}</Text>
        </View>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.cardOverlay}
        >
          <View style={styles.cardOverlayContent}>
            <Text style={styles.cardNftId}>#{item.tokenId}</Text>
            {isSold ? (
              <View style={styles.soldBadge}>
                <Text style={styles.soldBadgeText}>SOLD</Text>
              </View>
            ) : (
              <View style={styles.rarityRow}>
                <View style={styles.rarityDot} />
                <Text style={styles.rarityText}>{rarity}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>My Collection</Text>
          <Text style={styles.headerSubtitle}>NFTs & Lootbox rewards</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton} disabled={isLoading}>
          <RefreshCw size={20} color="#4ADE80" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['nfts', 'borders', 'tags'] as TabType[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab === 'nfts' ? 'NFTs' : tab === 'borders' ? 'Profile Borders' : 'Name Tags'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'nfts' ? (
        <>
          <View style={styles.filterSection}>
            <View>
              <Text style={styles.filterLabel}>MY NFTS</Text>
              <View style={styles.totalCountRow}>
                <Text style={styles.totalCountNumber}>{totalCount}</Text>
                <Text style={styles.totalCountLabel}>Items Total</Text>
              </View>
            </View>
            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={[styles.filterButton, filter === 'owned' && styles.filterButtonActive]}
                onPress={() => setFilter('owned')}
              >
                <Text style={[styles.filterButtonText, filter === 'owned' && styles.filterButtonTextActive]}>
                  Owned {ownedCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, filter === 'sold' && styles.filterButtonActive]}
                onPress={() => setFilter('sold')}
              >
                <Text style={[styles.filterButtonText, filter === 'sold' && styles.filterButtonTextActive]}>
                  Sold {soldCount}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4ADE80" />
            </View>
          ) : nfts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No NFTs yet</Text>
              <Text style={styles.emptySubtext}>Mint your first Gamefolio NFT to start your collection</Text>
            </View>
          ) : (
            <FlatList
              data={nfts}
              renderItem={renderNFTCard}
              keyExtractor={(item) => String(item.tokenId)}
              numColumns={NUM_COLS}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.gridContent}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          )}
        </>
      ) : (
        <View style={styles.comingSoonContainer}>
          <Text style={styles.comingSoonText}>Coming Soon</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
  },
  headerText: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 4,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderColor: '#4ADE80',
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#4ADE80',
  },
  filterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  filterLabel: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  totalCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  totalCountNumber: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
  },
  totalCountLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterButtonActive: {
    backgroundColor: '#4ADE80',
    borderColor: '#4ADE80',
  },
  filterButtonText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  filterButtonTextActive: {
    color: '#020617',
  },
  row: {
    justifyContent: 'flex-start',
    gap: CARD_MARGIN,
    paddingHorizontal: SIDE_PAD,
    marginBottom: CARD_MARGIN,
  },
  gridContent: {
    paddingBottom: 32,
  },
  nftCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    position: 'relative',
  },
  nftImage: {
    width: '100%',
    height: '100%',
  },
  nftImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#334155',
  },
  tokenIdBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tokenIdBadgeText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700',
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingTop: 20,
    paddingBottom: 8,
  },
  cardOverlayContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardNftId: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  rarityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rarityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  rarityText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '700',
  },
  soldBadge: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  soldBadgeText: {
    color: '#EF4444',
    fontSize: 9,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  comingSoonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
});
