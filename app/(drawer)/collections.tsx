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
  RARE: '#3B82F6',
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
      return ['#1E3A5F', '#1E40AF', '#1D4ED8'];
    default:
      return ['#0F172A', '#1E293B', '#1E293B'];
  }
}

interface NftDetailModalProps {
  nft: any;
  visible: boolean;
  onClose: () => void;
}

function NftDetailModal({ nft, visible, onClose }: NftDetailModalProps) {
  const insets = useSafeAreaInsets();
  if (!nft) return null;

  const imageUrl = resolveNftImageUrl(nft.image || nft.imageDataUrl);
  const attributes: Array<{ trait_type: string; value: string }> = nft.attributes || [];
  const { score, label } = calculateRarity(attributes);
  const rarityColor = RARITY_COLORS[label] || RARITY_COLORS.COMMON;
  const cardColors = getRarityCardColors(label);
  const scorePercent = Math.min((score / 150) * 100, 100);

  const skaleExplorerUrl = nft.txHash
    ? `https://juicy-low-small-testnet.explorer.testnet.skalenodes.com/tx/${nft.txHash}`
    : null;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <View style={[modalStyles.container, { backgroundColor: cardColors[0] }]}>

        {/* Full-screen rarity gradient background */}
        <LinearGradient
          colors={[cardColors[0], cardColors[1], '#0A0F1E']}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFill}
        />

        {/* Header */}
        <View style={[modalStyles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={modalStyles.backBtn}>
            <ArrowLeft size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={modalStyles.headerCenter}>
            <Text style={modalStyles.headerTitle} numberOfLines={1}>
              {nft.name || `NFT #${nft.tokenId}`}
            </Text>
          </View>
          <View style={[modalStyles.rarityChip, { borderColor: rarityColor }]}>
            <View style={[modalStyles.rarityChipDot, { backgroundColor: rarityColor }]} />
            <Text style={[modalStyles.rarityChipText, { color: rarityColor }]}>{label}</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[modalStyles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        >
          {/* Hero Image */}
          <View style={modalStyles.heroContainer}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={modalStyles.heroImage} resizeMode="cover" />
            ) : (
              <View style={[modalStyles.heroImage, modalStyles.heroImagePlaceholder]} />
            )}
            {/* Token ID badge */}
            <View style={[modalStyles.tokenBadge, { backgroundColor: `${rarityColor}22`, borderColor: `${rarityColor}55` }]}>
              <Text style={[modalStyles.tokenBadgeText, { color: rarityColor }]}>#{nft.tokenId}</Text>
            </View>
          </View>

          {/* Score bar */}
          <View style={modalStyles.scoreSection}>
            <View style={modalStyles.scoreLabelRow}>
              <Text style={modalStyles.scoreLabel}>RARITY SCORE</Text>
              <Text style={[modalStyles.scoreValue, { color: rarityColor }]}>{score}</Text>
            </View>
            <View style={modalStyles.scoreBarBg}>
              <LinearGradient
                colors={[`${rarityColor}88`, rarityColor]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[modalStyles.scoreBarFill, { width: `${scorePercent}%` }]}
              />
            </View>
          </View>

          {/* Meta cards */}
          <View style={modalStyles.metaRow}>
            <View style={modalStyles.metaCard}>
              <Text style={modalStyles.metaCardLabel}>TOKEN ID</Text>
              <Text style={modalStyles.metaCardValue}>#{nft.tokenId}</Text>
            </View>
            <View style={modalStyles.metaCard}>
              <Text style={modalStyles.metaCardLabel}>RARITY</Text>
              <Text style={[modalStyles.metaCardValue, { color: rarityColor }]}>{label}</Text>
            </View>
            <View style={modalStyles.metaCard}>
              <Text style={modalStyles.metaCardLabel}>SCORE</Text>
              <Text style={modalStyles.metaCardValue}>{score}</Text>
            </View>
          </View>

          {/* Attributes */}
          {attributes.length > 0 && (
            <View style={modalStyles.attrsSection}>
              <Text style={modalStyles.attrsTitle}>ATTRIBUTES</Text>
              <View style={modalStyles.attrsGrid}>
                {attributes.map((attr, idx) => {
                  const isRare = RARE_TRAITS[attr.trait_type]?.includes(attr.value);
                  return (
                    <View
                      key={idx}
                      style={[
                        modalStyles.attrCard,
                        isRare && { borderColor: rarityColor, borderWidth: 1 },
                      ]}
                    >
                      <Text style={modalStyles.attrType}>{attr.trait_type}</Text>
                      <Text style={[modalStyles.attrValue, isRare && { color: rarityColor }]}>
                        {attr.value}
                      </Text>
                      {isRare && (
                        <Text style={[modalStyles.attrRareBadge, { color: rarityColor }]}>RARE</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Blockchain explorer */}
          {skaleExplorerUrl ? (
            <TouchableOpacity
              style={[modalStyles.explorerBtn, { borderColor: rarityColor }]}
              onPress={() => Linking.openURL(skaleExplorerUrl)}
            >
              <ExternalLink size={16} color={rarityColor} />
              <Text style={[modalStyles.explorerBtnText, { color: rarityColor }]}>View on Explorer</Text>
            </TouchableOpacity>
          ) : null}
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  rarityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  rarityChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rarityChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  heroContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  heroImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#1E293B',
  },
  heroImagePlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  tokenBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tokenBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  scoreSection: {
    marginBottom: 20,
  },
  scoreLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  scoreBarBg: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  metaCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  metaCardLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 5,
  },
  metaCardValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  attrsSection: {
    marginBottom: 24,
  },
  attrsTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  attrsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attrCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 12,
    minWidth: '30%',
    flex: 1,
  },
  attrType: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  attrValue: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  attrRareBadge: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  explorerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    marginBottom: 8,
  },
  explorerBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
