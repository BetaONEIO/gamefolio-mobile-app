import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, RefreshCw } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

type TabType = 'nfts' | 'borders' | 'tags';
type FilterType = 'owned' | 'sold';

export default function MyCollection() {
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
      const res = await fetch(
        `${process.env.EXPO_PUBLIC_DOMAIN || 'http://localhost:5000'}/api/nfts/owned`,
        {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch NFTs');
      return res.json();
    },
  });

  const nfts = useMemo(() => {
    const allNfts = nftData?.nfts || [];
    return allNfts.filter((n: any) => (filter === 'owned' ? !n.sold : n.sold));
  }, [nftData, filter]);

  const ownedCount = useMemo(() => {
    return (nftData?.nfts || []).filter((n: any) => !n.sold).length;
  }, [nftData]);

  const soldCount = useMemo(() => {
    return (nftData?.nfts || []).filter((n: any) => n.sold).length;
  }, [nftData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderNFTCard = ({ item }: { item: any }) => (
    <View style={styles.nftCard}>
      {item.image ? (
        <Image source={{ uri: item.image }} style={styles.nftImage} resizeMode="cover" />
      ) : (
        <View style={styles.nftImagePlaceholder} />
      )}
      <View style={styles.nftCardBottom}>
        <Text style={styles.nftId}>#{item.tokenId}</Text>
        <Text style={styles.nftStatus}>{item.sold ? 'SOLD' : 'RARE'}</Text>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
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

      {/* Tabs */}
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

      {activeTab === 'nfts' && (
        <>
          {/* Filter Info */}
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>MY NFTS</Text>
            <Text style={styles.nftCount}>{nfts.length} Items</Text>
          </View>

          {/* Filter Buttons */}
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

          {/* NFT Grid */}
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
              keyExtractor={(item) => item.tokenId.toString()}
              numColumns={2}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.gridContent}
              scrollEnabled={false}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          )}
        </>
      )}

      {activeTab !== 'nfts' && (
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
    backgroundColor: '#0f172b',
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
    marginTop: 4,
  },
  refreshButton: {
    padding: 8,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  tab: {
    marginRight: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#4ADE80',
  },
  tabText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFF',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  nftCount: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  filterButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
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
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#020617',
  },
  row: {
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  gridContent: {
    paddingHorizontal: 16,
  },
  nftCard: {
    width: CARD_WIDTH,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  nftImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#0f172b',
  },
  nftImagePlaceholder: {
    width: '100%',
    height: 160,
    backgroundColor: '#334155',
  },
  nftCardBottom: {
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  nftId: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '700',
  },
  nftStatus: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
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
