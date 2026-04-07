import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, RefreshCw, ExternalLink, Hexagon, Image as ImageIcon, Tag } from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Env } from '@/constants/Env';
import { resolveNftImageUrl } from '@/lib/image-utils';
import { api } from '@/lib/api';

const { width } = Dimensions.get('window');
const NUM_COLS = 2;
const CARD_MARGIN = 12;
const SIDE_PAD = 16;
const CARD_WIDTH = (width - SIDE_PAD * 2 - CARD_MARGIN * (NUM_COLS - 1)) / NUM_COLS;

type TabType = 'nfts' | 'borders' | 'tags';
type FilterType = 'owned' | 'sold';

// Rarity color mapping
const RARITY_COLORS: Record<string, string> = {
  LEGENDARY: '#F59E0B',
  EPIC: '#A855F7',
  RARE: '#4ADE80',
  COMMON: '#94A3B8',
};

// Rare traits lookup (ported from web app)
const RARE_TRAITS: Record<string, string[]> = {
  Background: ['Legendary Forge', 'Void Rift', 'Neon Nexus'],
  Eyes: ['Cyber Glow', 'Dragon Flame', 'Void Eyes'],
  Mouth: ['Golden Grin', 'Cyber Smile'],
  Headwear: ['Crown of Power', 'Dragon Helm', 'Cyber Crown'],
  Body: ['Legendary Armor', 'Dragon Scale', 'Void Cloak'],
};

function calculateRarity(attributes: Array<{ trait_type: string; value: string }> = []): {
  score: number;
  label: 'LEGENDARY' | 'EPIC' | 'RARE' | 'COMMON';
} {
  let score = 0;
  for (const attr of attributes) {
    const rareTrait = RARE_TRAITS[attr.trait_type];
    if (rareTrait && rareTrait.includes(attr.value)) {
      score += 30;
    } else {
      score += 5;
    }
  }

  let label: 'LEGENDARY' | 'EPIC' | 'RARE' | 'COMMON' = 'COMMON';
  if (score >= 90) label = 'LEGENDARY';
  else if (score >= 60) label = 'EPIC';
  else if (score >= 30) label = 'RARE';

  return { score, label };
}

function getRarityCardColors(rarity: string): [string, string, string] {
  switch (rarity) {
    case 'LEGENDARY':
      return ['#78350F', '#92400E', '#B45309'];
    case 'EPIC':
      return ['#3B0764', '#4C1D95', '#5B21B6'];
    case 'RARE':
      return ['#0A2318', '#14532D', '#166534'];
    default:
      return ['#0F172A', '#1E293B', '#1E293B'];
  }
}

interface NftDetailModalProps {
  nft: any;
  visible: boolean;
  onClose: () => void;
}

// Approximate rarity percentage per trait value (lower score = rarer = lower %)
function getRarityPercent(traitType: string, value: string): number {
  const isRare = RARE_TRAITS[traitType]?.includes(value);
  if (isRare) return Math.floor(Math.random() * 6) + 3; // 3–8%
  return Math.floor(Math.random() * 25) + 15; // 15–40%
}

function NftDetailModal({ nft, visible, onClose }: NftDetailModalProps) {
  const insets = useSafeAreaInsets();
  if (!nft) return null;

  const imageUrl = resolveNftImageUrl(nft.image || nft.imageDataUrl);
  const attributes: Array<{ trait_type: string; value: string }> = nft.attributes || [];
  const { score, label } = calculateRarity(attributes);
  const rarityColor = RARITY_COLORS[label] || RARITY_COLORS.COMMON;

  const collectionName = nft.collectionName || 'Gamefolio NFT';
  const nftName = nft.name || `NFT #${nft.tokenId}`;
  const contractAddress = nft.contractAddress || null;
  const shortContract = contractAddress
    ? `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`
    : null;

  const skaleExplorerUrl = nft.txHash
    ? `https://juicy-low-small-testnet.explorer.testnet.skalenodes.com/tx/${nft.txHash}`
    : null;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={modalStyles.container}>

        {/* Header */}
        <View style={[modalStyles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={modalStyles.backBtn}>
            <ArrowLeft size={20} color="#FFF" />
          </TouchableOpacity>
          <Text style={modalStyles.headerTitle}>NFT Details</Text>
          <View style={modalStyles.headerRight} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[modalStyles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        >
          {/* NFT Image */}
          <View style={modalStyles.imageWrapper}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={modalStyles.nftImage} resizeMode="cover" />
            ) : (
              <View style={[modalStyles.nftImage, modalStyles.nftImagePlaceholder]} />
            )}
            {/* Verified Asset badge */}
            <View style={modalStyles.verifiedBadge}>
              <View style={modalStyles.verifiedDot} />
              <Text style={modalStyles.verifiedText}>VERIFIED ASSET</Text>
            </View>
            {/* Rarity badge top-right */}
            <View style={[modalStyles.rarityBadge, { backgroundColor: `${rarityColor}22`, borderColor: rarityColor }]}>
              <Text style={[modalStyles.rarityBadgeText, { color: rarityColor }]}>{label}</Text>
            </View>
          </View>

          {/* Collection + Name */}
          <View style={modalStyles.titleSection}>
            <View style={modalStyles.collectionRow}>
              <Text style={modalStyles.collectionName}>{collectionName}</Text>
              <Text style={modalStyles.verifyCheck}> </Text>
            </View>
            <Text style={modalStyles.nftTitle}>{nftName}</Text>
            <View style={modalStyles.ownerRow}>
              <View style={modalStyles.ownerAvatar} />
              <Text style={modalStyles.ownerLabel}>Owned by </Text>
              <Text style={modalStyles.ownerName}>You</Text>
            </View>
          </View>

          {/* Rarity score row */}
          <View style={modalStyles.scoreRow}>
            <View style={modalStyles.scoreBox}>
              <Text style={modalStyles.scoreBoxLabel}>RARITY SCORE</Text>
              <Text style={[modalStyles.scoreBoxValue, { color: rarityColor }]}>{score}</Text>
            </View>
            <View style={[modalStyles.scoreBox, { borderLeftWidth: 1, borderLeftColor: '#1E293B' }]}>
              <Text style={modalStyles.scoreBoxLabel}>RANK</Text>
              <Text style={[modalStyles.scoreBoxValue, { color: rarityColor }]}>{label}</Text>
            </View>
          </View>

          {/* Sell button */}
          {skaleExplorerUrl ? (
            <TouchableOpacity
              style={modalStyles.sellBtn}
              onPress={() => Linking.openURL(skaleExplorerUrl)}
            >
              <ExternalLink size={14} color="#CBD5E1" />
              <Text style={modalStyles.sellBtnText}>View on Blockchain Explorer</Text>
            </TouchableOpacity>
          ) : null}

          {/* Properties */}
          {attributes.length > 0 && (
            <View style={modalStyles.section}>
              <Text style={modalStyles.sectionTitle}>PROPERTIES</Text>
              <View style={modalStyles.propsGrid}>
                {attributes.map((attr, idx) => {
                  const isRare = RARE_TRAITS[attr.trait_type]?.includes(attr.value);
                  const pct = getRarityPercent(attr.trait_type, attr.value);
                  return (
                    <View key={idx} style={modalStyles.propCard}>
                      <Text style={modalStyles.propType}>{attr.trait_type.toUpperCase()}</Text>
                      <Text style={modalStyles.propValue}>{attr.value}</Text>
                      <Text style={[modalStyles.propPct, isRare && { color: rarityColor }]}>
                        {pct}% have this
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Details */}
          <View style={modalStyles.section}>
            <Text style={modalStyles.sectionTitle}>DETAILS</Text>
            <View style={modalStyles.detailsCard}>
              {shortContract && (
                <View style={[modalStyles.detailRow, { borderBottomWidth: 1, borderBottomColor: '#1E293B' }]}>
                  <Text style={modalStyles.detailLabel}>Contract Address</Text>
                  <TouchableOpacity onPress={() => skaleExplorerUrl && Linking.openURL(skaleExplorerUrl)}>
                    <View style={modalStyles.detailLinkRow}>
                      <Text style={modalStyles.detailLink}>{shortContract}</Text>
                      <ExternalLink size={12} color="#4ADE80" />
                    </View>
                  </TouchableOpacity>
                </View>
              )}
              <View style={[modalStyles.detailRow, { borderBottomWidth: 1, borderBottomColor: '#1E293B' }]}>
                <Text style={modalStyles.detailLabel}>Token ID</Text>
                <Text style={modalStyles.detailValue}>{String(nft.tokenId).padStart(4, '0')}</Text>
              </View>
              <View style={modalStyles.detailRow}>
                <Text style={modalStyles.detailLabel}>Blockchain</Text>
                <Text style={modalStyles.detailValue}>SKALE Nebula</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function Collections() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('nfts');
  const [filter, setFilter] = useState<FilterType>('owned');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedNft, setSelectedNft] = useState<any>(null);

  const { data: nftData, isLoading: nftLoading, refetch: refetchNfts } = useQuery({
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

  const { data: bordersData, isLoading: bordersLoading, refetch: refetchBorders } = useQuery({
    queryKey: ['/api/user/avatar-borders'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.profileBorders.getUserAvatarBorders(token);
    },
    enabled: activeTab === 'borders',
  });

  const { data: tagsData, isLoading: tagsLoading, refetch: refetchTags } = useQuery({
    queryKey: ['/api/user/name-tags'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.nameTags.getUserNameTags(token);
    },
    enabled: activeTab === 'tags',
  });

  const allNfts: any[] = nftData?.nfts || [];
  const nfts = useMemo(
    () => allNfts.filter((n: any) => (filter === 'owned' ? !n.sold : n.sold)),
    [allNfts, filter]
  );
  const ownedCount = useMemo(() => allNfts.filter((n: any) => !n.sold).length, [allNfts]);
  const soldCount = useMemo(() => allNfts.filter((n: any) => n.sold).length, [allNfts]);
  const totalCount = allNfts.length;

  const borders: any[] = Array.isArray(bordersData) ? bordersData : [];
  const tags: any[] = Array.isArray(tagsData) ? tagsData : [];

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'nfts') await refetchNfts();
    else if (activeTab === 'borders') await refetchBorders();
    else await refetchTags();
    setRefreshing(false);
  };

  const renderNFTCard = useCallback(({ item }: { item: any }) => {
    const imageUrl = resolveNftImageUrl(item.image || item.imageDataUrl);
    const attributes = item.attributes || [];
    const { label } = calculateRarity(attributes);
    const rarityFromItem = (item.rarity || label) as string;
    const rarityLabel = typeof rarityFromItem === 'string' ? rarityFromItem.toUpperCase() : label;
    const rarityColor = RARITY_COLORS[rarityLabel] || RARITY_COLORS.COMMON;
    const cardColors = getRarityCardColors(rarityLabel);
    const isSold = !!item.sold;
    const isLegendary = rarityLabel === 'LEGENDARY';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setSelectedNft(item)}
        style={[styles.nftCard, isLegendary && styles.nftCardLegendary]}
      >
        <LinearGradient colors={cardColors} style={StyleSheet.absoluteFill} />

        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.nftImage, isSold && styles.nftImageSold]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.nftImagePlaceholder, isSold && styles.nftImageSold]} />
        )}

        {isSold && (
          <View style={styles.soldOverlay}>
            <View style={styles.soldStamp}>
              <Text style={styles.soldStampText}>SOLD</Text>
            </View>
          </View>
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
                <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
                <Text style={[styles.rarityText, { color: rarityColor }]}>{rarityLabel}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }, []);

  const renderBorderCard = useCallback(({ item }: { item: any }) => {
    const imageUrl = item.imageUrl || item.image || null;
    const rarity = (item.rarity || 'COMMON').toUpperCase();
    const rarityColor = RARITY_COLORS[rarity] || RARITY_COLORS.COMMON;

    return (
      <View style={styles.simpleCard}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.simpleCardImage} resizeMode="cover" />
        ) : (
          <View style={styles.simpleCardImagePlaceholder} />
        )}
        <View style={styles.simpleCardFooter}>
          <Text style={styles.simpleCardName} numberOfLines={1}>{item.name || 'Border'}</Text>
          <View style={styles.rarityRow}>
            <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
          </View>
        </View>
      </View>
    );
  }, []);

  const renderTagCard = useCallback(({ item }: { item: any }) => {
    const imageUrl = item.imageUrl || item.image || null;
    const rarity = (item.rarity || 'COMMON').toUpperCase();
    const rarityColor = RARITY_COLORS[rarity] || RARITY_COLORS.COMMON;

    return (
      <View style={styles.simpleCard}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.simpleCardImage} resizeMode="cover" />
        ) : (
          <View style={styles.simpleCardImagePlaceholder} />
        )}
        <View style={styles.simpleCardFooter}>
          <Text style={styles.simpleCardName} numberOfLines={1}>{item.name || 'Name Tag'}</Text>
          <View style={styles.rarityRow}>
            <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
          </View>
        </View>
      </View>
    );
  }, []);

  const isLoading = activeTab === 'nfts' ? nftLoading : activeTab === 'borders' ? bordersLoading : tagsLoading;

  const renderSkeletons = () => (
    <View style={styles.skeletonGrid}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonCard} />
      ))}
    </View>
  );

  const TAB_CONFIG = [
    { key: 'nfts' as TabType, label: 'NFTs', Icon: Hexagon },
    { key: 'borders' as TabType, label: 'Profile Borders', Icon: ImageIcon },
    { key: 'tags' as TabType, label: 'Name Tags', Icon: Tag },
  ];

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
        {TAB_CONFIG.map(({ key, label, Icon }) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, activeTab === key && styles.activeTab]}
            onPress={() => setActiveTab(key)}
          >
            <Icon size={14} color={activeTab === key ? '#4ADE80' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>
              {label}
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

          {nftLoading ? (
            renderSkeletons()
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
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      ) : activeTab === 'borders' ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PROFILE BORDERS</Text>
            <Text style={styles.sectionCount}>{Array.isArray(borders) ? borders.length : 0} Items</Text>
          </View>
          {bordersLoading ? (
            renderSkeletons()
          ) : !Array.isArray(borders) || borders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No Profile Borders</Text>
              <Text style={styles.emptySubtext}>Earn profile borders from lootboxes and special events</Text>
            </View>
          ) : (
            <FlatList
              data={borders}
              renderItem={renderBorderCard}
              keyExtractor={(item, idx) => String(item.id || item._id || idx)}
              numColumns={NUM_COLS}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.gridContent}
              onRefresh={onRefresh}
              refreshing={refreshing}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>NAME TAGS</Text>
            <Text style={styles.sectionCount}>{Array.isArray(tags) ? tags.length : 0} Items</Text>
          </View>
          {tagsLoading ? (
            renderSkeletons()
          ) : !Array.isArray(tags) || tags.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No Name Tags</Text>
              <Text style={styles.emptySubtext}>Earn name tags from lootboxes and special events</Text>
            </View>
          ) : (
            <FlatList
              data={tags}
              renderItem={renderTagCard}
              keyExtractor={(item, idx) => String(item.id || item._id || idx)}
              numColumns={NUM_COLS}
              columnWrapperStyle={styles.row}
              contentContainerStyle={styles.gridContent}
              onRefresh={onRefresh}
              refreshing={refreshing}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      <NftDetailModal
        nft={selectedNft}
        visible={selectedNft !== null}
        onClose={() => setSelectedNft(null)}
      />
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
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeTab: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderColor: '#4ADE80',
  },
  tabText: {
    color: '#64748b',
    fontSize: 12,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sectionCount: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
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
  nftCardLegendary: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  nftImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  nftImageSold: {
    opacity: 0.4,
  },
  nftImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#334155',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  soldStamp: {
    borderWidth: 2,
    borderColor: 'rgba(239,68,68,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-15deg' }],
  },
  soldStampText: {
    color: 'rgba(239,68,68,0.9)',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2,
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
  simpleCard: {
    width: CARD_WIDTH,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  simpleCardImage: {
    width: '100%',
    height: CARD_WIDTH * 0.75,
  },
  simpleCardImagePlaceholder: {
    width: '100%',
    height: CARD_WIDTH * 0.75,
    backgroundColor: '#334155',
  },
  simpleCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  simpleCardName: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SIDE_PAD,
    gap: CARD_MARGIN,
    marginTop: 8,
  },
  skeletonCard: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: 10,
    backgroundColor: '#1e293b',
    opacity: 0.5,
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
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerRight: {
    width: 36,
  },
  scrollContent: {
    paddingTop: 20,
  },
  imageWrapper: {
    position: 'relative',
    marginHorizontal: 16,
    marginBottom: 20,
  },
  nftImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: '#1E293B',
  },
  nftImagePlaceholder: {
    backgroundColor: '#1E293B',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(10,15,26,0.75)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifiedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  verifiedText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  rarityBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  rarityBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  titleSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  collectionName: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
  },
  verifyCheck: {
    color: '#4ADE80',
    fontSize: 14,
  },
  nftTitle: {
    color: '#FFF',
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ownerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#A855F7',
  },
  ownerLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  ownerName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  scoreRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: '#0F1923',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  scoreBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  scoreBoxLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  scoreBoxValue: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#0F1923',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 14,
  },
  sellBtnText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  propsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  propCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#0F1923',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
  },
  propType: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  propValue: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  propPct: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '500',
  },
  detailsCard: {
    backgroundColor: '#0F1923',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailLabel: {
    color: '#64748B',
    fontSize: 13,
  },
  detailValue: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  detailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailLink: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600',
  },
});
