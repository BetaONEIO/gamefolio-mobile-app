import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Sparkles,
  ShoppingCart,
  Tag,
  User,
  AlertCircle,
  ExternalLink,
} from 'lucide-react-native';
import { Env } from '@/constants/Env';
import { resolveNftImageUrl } from '@/lib/image-utils';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH - 48;

const RARITY_COLORS: Record<string, string> = {
  legendary: '#F59E0B',
  epic: '#8B5CF6',
  rare: '#3B82F6',
  uncommon: '#4ADE80',
  common: '#64748B',
};

interface NftMetadata {
  tokenId: number;
  name: string;
  description: string;
  image: string | null;
  attributes: { trait_type: string; value: string }[];
}

interface MarketplaceListing {
  token_id: number;
  listed_price: number;
  user_id: number;
  username: string;
  display_name: string;
  image_url?: string | null;
}

export default function NftDetailScreen() {
  const { id, listedPrice, sellerName, sellerId } = useLocalSearchParams<{
    id: string;
    listedPrice?: string;
    sellerName?: string;
    sellerId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user } = useAuth();

  const tokenId = parseInt(id || '0', 10);

  const { data: metadata, isLoading: metadataLoading, isError } = useQuery<NftMetadata>({
    queryKey: ['/api/nft/metadata', tokenId],
    queryFn: async () => {
      const res = await fetch(`${Env.BACKEND_URL}/api/nft/metadata/${tokenId}`);
      if (!res.ok) throw new Error('Failed to fetch NFT metadata');
      return res.json();
    },
    enabled: tokenId > 0,
    staleTime: 300000,
    retry: 2,
  });

  const { data: listingsData } = useQuery<{ listings: MarketplaceListing[] }>({
    queryKey: ['/api/marketplace/listings'],
    queryFn: async () => {
      const res = await fetch(`${Env.BACKEND_URL}/api/marketplace/listings`);
      if (!res.ok) return { listings: [] };
      return res.json();
    },
    staleTime: 30000,
  });

  const listing = listingsData?.listings.find(l => l.token_id === tokenId);
  const price = listing?.listed_price ?? (listedPrice ? parseInt(listedPrice, 10) : null);
  const seller = listing?.display_name || listing?.username || sellerName || null;
  const isOwn = listing?.user_id === user?.id;

  const imageUrl = resolveNftImageUrl(metadata?.image);

  const getRarity = () => {
    if (!metadata?.attributes) return null;
    return metadata.attributes.find(a => a.trait_type.toLowerCase() === 'rarity')?.value;
  };
  const rarity = getRarity();
  const rarityColor = rarity ? (RARITY_COLORS[rarity.toLowerCase()] ?? '#64748B') : null;

  const renderAttribute = (attr: { trait_type: string; value: string }, index: number) => {
    const isRarity = attr.trait_type.toLowerCase() === 'rarity';
    const color = isRarity ? (RARITY_COLORS[attr.value.toLowerCase()] ?? '#64748B') : '#4ADE80';
    return (
      <View key={index} style={[styles.attributeChip, { borderColor: color + '40', backgroundColor: color + '15' }]}>
        <Text style={[styles.attributeType, { color: color + 'CC' }]}>{attr.trait_type}</Text>
        <Text style={[styles.attributeValue, { color }]}>{attr.value}</Text>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: metadata ? metadata.name : `NFT #${tokenId}`,
          headerStyle: { backgroundColor: '#0A1628' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', color: '#FFFFFF' },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 8 }}>
              <ArrowLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />

      <View style={styles.container}>
        {metadataLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4ADE80" />
            <Text style={styles.loadingText}>Loading NFT details...</Text>
          </View>
        ) : isError ? (
          <View style={styles.errorContainer}>
            <AlertCircle size={48} color="#EF4444" />
            <Text style={styles.errorTitle}>Could not load NFT</Text>
            <Text style={styles.errorSubtext}>Failed to fetch metadata for #{tokenId}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
              <Text style={styles.retryButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, { paddingTop: headerHeight + 8 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.imageWrapper}>
              {imageUrl ? (
                <>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.nftImage}
                    resizeMode="cover"
                  />
                  {rarityColor && (
                    <LinearGradient
                      colors={['transparent', rarityColor + '30']}
                      style={styles.imageGradient}
                    />
                  )}
                </>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Sparkles size={64} color="#4ADE80" />
                  <Text style={styles.imagePlaceholderText}>Image loading...</Text>
                </View>
              )}

              <View style={styles.tokenBadge}>
                <Text style={styles.tokenBadgeText}>#{tokenId}</Text>
              </View>

              {rarityColor && rarity && (
                <View style={[styles.rarityBadge, { backgroundColor: rarityColor + '20', borderColor: rarityColor + '60' }]}>
                  <View style={[styles.rarityDot, { backgroundColor: rarityColor }]} />
                  <Text style={[styles.rarityText, { color: rarityColor }]}>{rarity}</Text>
                </View>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.nftName}>{metadata?.name ?? `Gamefolio Genesis #${tokenId}`}</Text>
              {metadata?.description ? (
                <Text style={styles.nftDescription}>{metadata.description}</Text>
              ) : null}
            </View>

            {price != null && (
              <View style={styles.priceSection}>
                <View style={styles.priceHeader}>
                  <Tag size={16} color="#4ADE80" />
                  <Text style={styles.priceSectionTitle}>Listed for Sale</Text>
                </View>

                <View style={styles.priceRow}>
                  <View>
                    <Text style={styles.priceLabel}>Price</Text>
                    <View style={styles.priceAmount}>
                      <Sparkles size={18} color="#4ADE80" />
                      <Text style={styles.priceValue}>{price.toLocaleString()} GF</Text>
                    </View>
                  </View>

                  {seller && (
                    <View style={styles.sellerInfo}>
                      <User size={14} color="#64748B" />
                      <Text style={styles.sellerText}>{seller}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.buyButton, isOwn && styles.buyButtonDisabled]}
                  disabled={isOwn}
                  onPress={() => router.back()}
                  activeOpacity={0.8}
                >
                  <ShoppingCart size={18} color={isOwn ? '#64748B' : '#020617'} />
                  <Text style={[styles.buyButtonText, isOwn && styles.buyButtonTextDisabled]}>
                    {isOwn ? 'Your Listing' : 'Buy in Store'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {metadata?.attributes && metadata.attributes.length > 0 && (
              <View style={styles.attributesSection}>
                <Text style={styles.sectionTitle}>Attributes</Text>
                <View style={styles.attributeGrid}>
                  {metadata.attributes.map(renderAttribute)}
                </View>
              </View>
            )}

            <View style={styles.metaSection}>
              <Text style={styles.sectionTitle}>Details</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Token ID</Text>
                <Text style={styles.metaValue}>#{tokenId}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Collection</Text>
                <Text style={styles.metaValue}>Gamefolio Genesis</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Blockchain</Text>
                <Text style={styles.metaValue}>Base</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Token Standard</Text>
                <Text style={styles.metaValue}>ERC-721</Text>
              </View>
            </View>

            <View style={{ height: insets.bottom + 24 }} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#4ADE80',
    fontWeight: '600',
    fontSize: 15,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  imageWrapper: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    marginBottom: 24,
    position: 'relative',
  },
  nftImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  imagePlaceholderText: {
    color: '#64748B',
    fontSize: 14,
  },
  tokenBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tokenBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  rarityBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  rarityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  rarityText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  infoSection: {
    marginBottom: 20,
  },
  nftName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  nftDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  priceSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  priceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  priceSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ADE80',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  priceAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#131F2A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sellerText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  buyButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buyButtonDisabled: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  buyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#020617',
  },
  buyButtonTextDisabled: {
    color: '#64748B',
  },
  attributesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  attributeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  attributeChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: (SCREEN_WIDTH - 48 - 10) / 3 - 10,
    alignItems: 'center',
  },
  attributeType: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  attributeValue: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  metaSection: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#131F2A',
  },
  metaLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
