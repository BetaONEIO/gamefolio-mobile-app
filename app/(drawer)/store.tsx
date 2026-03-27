import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, ShoppingCart, Heart, TrendingUp, Sparkles } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 52) / 2;

interface NFT {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  priceGF: number;
  priceUSD: number;
  rarity: string;
  type: string;
  mintNumber?: string;
}

const mockNFTs: NFT[] = [
  {
    id: '1',
    name: 'Cyber Pilot #001',
    description: 'Elite cyber pilot with advanced tech helmet and...',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400',
    priceGF: 250,
    priceUSD: 12.5,
    rarity: 'Elite',
    type: 'Avatar',
  },
  {
    id: '2',
    name: 'Divine Guardian #002',
    description: 'Blessed guardian with golden halo and pure spirit',
    imageUrl: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=400',
    priceGF: 800,
    priceUSD: 40,
    rarity: 'Legendary',
    type: 'Avatar',
  },
  {
    id: '3',
    name: 'Street Samurai #003',
    description: 'Tattooed warrior with deadly precision and street style',
    imageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400',
    priceGF: 550,
    priceUSD: 27.5,
    rarity: 'Rare',
    type: 'Avatar',
  },
  {
    id: '4',
    name: 'Urban Rogue #004',
    description: 'Mysterious rogue with ice-blue shades and urban...',
    imageUrl: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=400',
    priceGF: 350,
    priceUSD: 17.5,
    rarity: 'Uncommon',
    type: 'Avatar',
  },
  {
    id: '5',
    name: 'Neon Hacker #005',
    description: 'Digital wizard with matrix vision and neon powers',
    imageUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400',
    priceGF: 420,
    priceUSD: 21,
    rarity: 'Rare',
    type: 'Avatar',
  },
  {
    id: '6',
    name: 'Desert Nomad #006',
    description: 'Wandering warrior with ancient wisdom and skills',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    priceGF: 380,
    priceUSD: 19,
    rarity: 'Uncommon',
    type: 'Avatar',
  },
];

type TabType = 'buy' | 'sell' | 'mint' | 'watchlist';

export default function StorePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('buy');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFavorite = (nftId: string) => {
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nftId)) {
        newSet.delete(nftId);
      } else {
        newSet.add(nftId);
      }
      return newSet;
    });
  };

  const handleBuyNFT = (nft: NFT) => {
    console.log('Buy NFT:', nft);
  };

  const renderContent = () => {
    if (activeTab === 'buy') {
      return (
        <View style={styles.mainContent}>
          <Text style={styles.mainTitle}>Gamefolio Collection</Text>
          <Text style={styles.subtitle}>
            Browse and purchase exclusive Gamefolio NFT avatars for your profile
          </Text>
          
          <View style={styles.nftGrid}>
            {mockNFTs.map((nft) => (
              <View key={nft.id} style={styles.nftCard}>
                <View style={styles.nftImageContainer}>
                  <Image source={{ uri: nft.imageUrl }} style={styles.nftImage} />
                  <View style={styles.forSaleBadge}>
                    <Text style={styles.forSaleText}>For Sale</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.heartButton}
                    onPress={() => toggleFavorite(nft.id)}
                    activeOpacity={0.7}
                  >
                    <Heart
                      size={20}
                      color={favorites.has(nft.id) ? '#EF4444' : '#64748B'}
                      fill={favorites.has(nft.id) ? '#EF4444' : 'transparent'}
                    />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.nftContent}>
                  <Text style={styles.nftName}>{nft.name}</Text>
                  <Text style={styles.nftDescription} numberOfLines={2}>
                    {nft.description}
                  </Text>
                  
                  <View style={styles.nftPriceRow}>
                    <View style={styles.priceInfo}>
                      <Text style={styles.priceLabel}>Price</Text>
                      <View style={styles.priceContainer}>
                        <Sparkles size={14} color="#4ADE80" />
                        <Text style={styles.priceGF}>{nft.priceGF} GF</Text>
                      </View>
                      <Text style={styles.priceUSD}>≈ ${nft.priceUSD}</Text>
                    </View>
                    
                    <TouchableOpacity
                      style={styles.buyButton}
                      onPress={() => handleBuyNFT(nft)}
                      activeOpacity={0.8}
                    >
                      <ShoppingCart size={14} color="#FFFFFF" />
                      <Text style={styles.buyButtonText}>Buy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        {activeTab === 'sell' && (
          <>
            <ShoppingCart size={48} color="#475569" />
            <Text style={styles.emptyTitle}>No NFTs to Sell</Text>
            <Text style={styles.emptyText}>
              You don&apos;t own any NFTs yet. Purchase from the store to get started!
            </Text>
          </>
        )}
        {activeTab === 'mint' && (
          <>
            <Sparkles size={48} color="#475569" />
            <Text style={styles.emptyTitle}>Mint NFTs</Text>
            <Text style={styles.emptyText}>
              Create your own unique NFT avatars. Minting feature coming soon!
            </Text>
          </>
        )}
        {activeTab === 'watchlist' && (
          <>
            <Heart size={48} color="#475569" />
            <Text style={styles.emptyTitle}>
              {favorites.size === 0 ? 'No Favorites Yet' : 'My Watchlist'}
            </Text>
            <Text style={styles.emptyText}>
              {favorites.size === 0
                ? 'Add NFTs to your watchlist by tapping the heart icon'
                : `You have ${favorites.size} NFT${favorites.size > 1 ? 's' : ''} in your watchlist`}
            </Text>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0E1831', '#1E293B', '#0F172A']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerContainer}>
            <Text style={styles.storeTitle}>Store</Text>
            
            <View style={styles.balanceCard}>
              <View style={styles.balanceIcon}>
                <Sparkles size={24} color="#4ADE80" />
              </View>
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>GF Balance</Text>
                <Text style={styles.balanceAmount}>0 GF</Text>
                <Text style={styles.balanceUSD}>≈ $0.00 USD</Text>
              </View>
            </View>
          </View>

          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'buy' && styles.tabActive]}
              onPress={() => setActiveTab('buy')}
              activeOpacity={0.7}
            >
              <ShoppingCart size={16} color={activeTab === 'buy' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.tabText, activeTab === 'buy' && styles.tabTextActive]}>
                Buy NFT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'sell' && styles.tabActive]}
              onPress={() => setActiveTab('sell')}
              activeOpacity={0.7}
            >
              <TrendingUp size={16} color={activeTab === 'sell' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.tabText, activeTab === 'sell' && styles.tabTextActive]}>
                Sell NFT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'mint' && styles.tabActive]}
              onPress={() => setActiveTab('mint')}
              activeOpacity={0.7}
            >
              <Sparkles size={16} color={activeTab === 'mint' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.tabText, activeTab === 'mint' && styles.tabTextActive]}>
                Mint NFT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'watchlist' && styles.tabActive]}
              onPress={() => setActiveTab('watchlist')}
              activeOpacity={0.7}
            >
              <Heart size={16} color={activeTab === 'watchlist' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.tabText, activeTab === 'watchlist' && styles.tabTextActive]}>
                Watchlist
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {renderContent()}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E1831',
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContainer: {
    backgroundColor: '#0E1831',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  storeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  balanceUSD: {
    fontSize: 13,
    color: '#64748B',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
    backgroundColor: '#0E1831',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#4ADE80',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#020617',
  },
  mainContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  mainTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 24,
    lineHeight: 20,
  },
  nftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nftCard: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  nftImageContainer: {
    width: '100%',
    height: CARD_WIDTH * 1.1,
    position: 'relative' as const,
  },
  nftImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E293B',
  },
  forSaleBadge: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    backgroundColor: '#4ADE80',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  forSaleText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#020617',
  },
  heartButton: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nftContent: {
    padding: 12,
  },
  nftName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  nftDescription: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
    marginBottom: 12,
  },
  nftPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  priceInfo: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  priceGF: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4ADE80',
  },
  priceUSD: {
    fontSize: 11,
    color: '#64748B',
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  buyButtonText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});
