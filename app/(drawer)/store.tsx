import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  ShoppingCart,
  Heart,
  TrendingUp,
  Sparkles,
  X,
  CheckCircle,
  AlertCircle,
  Plus,
  Minus,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Env } from '@/constants/Env';
import { resolveNftImageUrl } from '@/lib/image-utils';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 52) / 2;
const MINT_PRICE_PER_NFT = 250;
const MAX_MINT_QTY = 5;

interface NftCollectionItem {
  tokenId: number;
  name: string;
  description: string;
  image: string | null;
  attributes: { trait_type: string; value: string }[];
  gfCost: number;
}

interface OwnedNFT {
  tokenId: number;
  txHash: string;
  mintedAt: string;
  sold: boolean;
  name?: string;
  image?: string;
  imageDataUrl?: string;
}

interface MarketplaceListing {
  token_id: number;
  listed_price: number;
  sold_at: string;
  user_id: number;
  username: string;
  display_name: string;
  image_url?: string | null;
}

type TabType = 'buy' | 'sell' | 'mint' | 'watchlist';
type PurchaseState = 'idle' | 'confirming' | 'processing' | 'success' | 'error';
type MintState = 'idle' | 'processing' | 'success' | 'error';
type SellState = 'idle' | 'confirming' | 'processing' | 'success' | 'error';

const QUICK_SELL_PRICE = 250;
const QUICK_SELL_PLATFORM_FEE = QUICK_SELL_PRICE * 0.015;
const QUICK_SELL_LIST_FEE = 1.25;
const QUICK_SELL_NET = QUICK_SELL_PRICE - QUICK_SELL_PLATFORM_FEE - QUICK_SELL_LIST_FEE;


export default function StorePage() {
  const router = useRouter();
  const { user, getAccessToken, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('buy');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [purchaseState, setPurchaseState] = useState<PurchaseState>('idle');
  const [purchaseError, setPurchaseError] = useState('');
  const [pendingPurchaseId, setPendingPurchaseId] = useState<number | null>(null);

  const [mintQty, setMintQty] = useState(1);
  const [mintState, setMintState] = useState<MintState>('idle');
  const [mintConfirming, setMintConfirming] = useState(false);
  const [mintError, setMintError] = useState('');
  const [mintedTokenIds, setMintedTokenIds] = useState<number[]>([]);

  const [selectedNftToSell, setSelectedNftToSell] = useState<OwnedNFT | null>(null);
  const [sellState, setSellState] = useState<SellState>('idle');
  const [sellError, setSellError] = useState('');
  const [sellNetReceived, setSellNetReceived] = useState<number>(0);

  const { data: gfBalanceData } = useQuery<{ balance: number }>({
    queryKey: ['/api/me/gf-balance', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/me/gf-balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { balance: user?.gfTokenBalance ?? 0 };
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });
  const gfBalance = gfBalanceData?.balance ?? user?.gfTokenBalance ?? 0;

  const { data: nftCollection = [], isLoading: collectionLoading } = useQuery<NftCollectionItem[]>({
    queryKey: ['/api/nfts/collection'],
    queryFn: async () => {
      const res = await fetch(`${Env.BACKEND_URL}/api/nfts/collection`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: activeTab === 'mint',
  });

  const { data: listingsData, isLoading: listingsLoading } = useQuery<{ listings: MarketplaceListing[] }>({
    queryKey: ['/api/marketplace/listings'],
    queryFn: async () => {
      const res = await fetch(`${Env.BACKEND_URL}/api/marketplace/listings`);
      if (!res.ok) return { listings: [] };
      return res.json();
    },
    enabled: activeTab === 'buy' || activeTab === 'watchlist',
    staleTime: 30000,
  });
  const marketplaceListings = listingsData?.listings ?? [];

  const { data: ownedNFTs = [], isLoading: nftsLoading } = useQuery<OwnedNFT[]>({
    queryKey: ['/api/nfts/owned', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/nfts/owned`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.nfts || [];
    },
    enabled: !!user?.id && activeTab === 'sell',
  });

  const toggleFavorite = (itemId: string | number) => {
    const key = String(itemId);
    setFavorites(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);

  const handleBuyListing = (listing: MarketplaceListing) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedListing(listing);
    setPurchaseState('confirming');
    setPurchaseError('');
  };

  const handleConfirmListingPurchase = async () => {
    if (!selectedListing) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPurchaseState('processing');

    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/marketplace/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tokenId: selectedListing.token_id, sellerId: selectedListing.user_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPurchaseState('error');
        setPurchaseError(data.error || 'Purchase failed. Please try again.');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/listings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nfts/owned', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/gf-balance', user?.id] });
      setPurchaseState('success');
    } catch {
      setPurchaseState('error');
      setPurchaseError('Network error. Please try again.');
    }
  };

  const handleClosePurchaseModal = () => {
    setSelectedListing(null);
    setPurchaseState('idle');
    setPurchaseError('');
    setPendingPurchaseId(null);
  };

  const handleOpenQuickSell = (nft: OwnedNFT) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedNftToSell(nft);
    setSellState('confirming');
    setSellError('');
    setSellNetReceived(0);
  };

  const handleConfirmQuickSell = async () => {
    if (!selectedNftToSell) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSellState('processing');

    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/nft/quick-sell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tokenId: selectedNftToSell.tokenId,
          imageUrl: selectedNftToSell.image || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSellState('error');
        setSellError(data.error || 'Quick sell failed. Please try again.');
        return;
      }

      setSellNetReceived(data.receivedAmount ?? QUICK_SELL_NET);
      queryClient.invalidateQueries({ queryKey: ['/api/nfts/owned', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/gf-balance', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/listings'] });
      if (typeof data.receivedAmount === 'number') {
        updateUser({ gfTokenBalance: (user?.gfTokenBalance ?? 0) + data.receivedAmount });
      }
      setSellState('success');
    } catch {
      setSellState('error');
      setSellError('Network error. Please try again.');
    }
  };

  const handleCloseQuickSellModal = () => {
    setSelectedNftToSell(null);
    setSellState('idle');
    setSellError('');
  };

  const handleMintNFT = async () => {
    setMintConfirming(false);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setMintState('processing');
    setMintError('');
    setMintedTokenIds([]);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/mint/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity: mintQty }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMintState('error');
        setMintError(data.error || 'Minting failed. Please try again.');
        return;
      }
      setMintedTokenIds(data.tokenIds || []);
      queryClient.invalidateQueries({ queryKey: ['/api/nfts/owned'] });
      setMintState('success');
    } catch {
      setMintState('error');
      setMintError('Network error. Please try again.');
    }
  };

  const mintTotal = mintQty * MINT_PRICE_PER_NFT;
  const canAffordMint = gfBalance >= mintTotal;

  const renderBuyTab = () => {
    if (listingsLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Loading marketplace...</Text>
        </View>
      );
    }

    if (marketplaceListings.length === 0) {
      return (
        <View style={styles.emptyState}>
          <ShoppingCart size={48} color="#475569" />
          <Text style={styles.emptyTitle}>No Listings Yet</Text>
          <Text style={styles.emptyText}>
            No NFTs are currently listed for sale. Check the Mint tab to get your own, or come back later.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.mainContent}>
        <Text style={styles.mainTitle}>NFT Marketplace</Text>
        <Text style={styles.subtitle}>
          {marketplaceListings.length} NFT{marketplaceListings.length > 1 ? 's' : ''} listed for sale by the community
        </Text>

        <View style={styles.nftGrid}>
          {marketplaceListings.map((listing) => {
            const canAfford = gfBalance >= listing.listed_price;
            const isOwnListing = listing.user_id === user?.id;
            const sellerName = listing.display_name || listing.username || 'Unknown';
            const listingImageUrl = resolveNftImageUrl(listing.image_url);
            return (
              <View key={listing.token_id} style={styles.nftCard}>
                <View style={styles.nftImageContainer}>
                  {listingImageUrl ? (
                    <Image
                      source={{ uri: listingImageUrl }}
                      style={styles.nftImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.nftImagePlaceholder, { borderColor: '#4ADE8040' }]}>
                      <Sparkles size={36} color="#4ADE80" />
                    </View>
                  )}
                  <View style={[styles.forSaleBadge, { backgroundColor: '#0F172A' }]}>
                    <Text style={styles.forSaleText}>#{listing.token_id}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.heartButton}
                    onPress={() => toggleFavorite(String(listing.token_id))}
                    activeOpacity={0.7}
                  >
                    <Heart
                      size={20}
                      color={favorites.has(String(listing.token_id)) ? '#EF4444' : '#64748B'}
                      fill={favorites.has(String(listing.token_id)) ? '#EF4444' : 'transparent'}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.nftContent}>
                  <Text style={styles.nftName}>Genesis #{listing.token_id}</Text>
                  <Text style={styles.nftDescription} numberOfLines={1}>by {sellerName}</Text>

                  <View style={styles.nftPriceRow}>
                    <View style={styles.priceInfo}>
                      <Text style={styles.priceLabel}>Listed Price</Text>
                      <View style={styles.priceContainer}>
                        <Sparkles size={14} color="#4ADE80" />
                        <Text style={styles.priceGF}>{listing.listed_price.toLocaleString()} GF</Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.buyButton, (!canAfford || isOwnListing) && { opacity: 0.5 }]}
                      onPress={() => !isOwnListing && canAfford && handleBuyListing(listing)}
                      activeOpacity={0.8}
                    >
                      <ShoppingCart size={14} color="#020617" />
                      <Text style={styles.buyButtonText}>{isOwnListing ? 'Yours' : 'Buy'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderSellTab = () => {
    if (nftsLoading) {
      return (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Loading your NFTs...</Text>
        </View>
      );
    }

    const activeNFTs = ownedNFTs.filter(nft => !nft.sold);

    if (activeNFTs.length === 0) {
      return (
        <View style={styles.emptyState}>
          <TrendingUp size={48} color="#475569" />
          <Text style={styles.emptyTitle}>No NFTs to Sell</Text>
          <Text style={styles.emptyText}>
            You don't own any NFTs yet. Mint one from the Mint tab to get started!
          </Text>
          <TouchableOpacity
            style={styles.goToMintButton}
            onPress={() => setActiveTab('mint')}
            activeOpacity={0.8}
          >
            <Sparkles size={16} color="#020617" />
            <Text style={styles.goToMintButtonText}>Go to Mint</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.mainContent}>
        <Text style={styles.mainTitle}>Your NFTs</Text>
        <Text style={styles.subtitle}>Quick Sell lists your NFT for 250 GFT and credits your balance instantly</Text>

        <View style={styles.nftGrid}>
          {activeNFTs.map((nft) => (
            <View key={nft.tokenId} style={styles.nftCard}>
              <View style={styles.nftImageContainer}>
                {nft.imageDataUrl ? (
                  <Image source={{ uri: nft.imageDataUrl }} style={styles.nftImage} />
                ) : nft.image ? (
                  <Image source={{ uri: `${Env.BACKEND_URL}${nft.image}` }} style={styles.nftImage} />
                ) : (
                  <View style={styles.nftImagePlaceholder}>
                    <Sparkles size={36} color="#4ADE80" />
                  </View>
                )}
                <View style={[styles.forSaleBadge, { backgroundColor: '#1E293B' }]}>
                  <Text style={[styles.forSaleText, { color: '#94A3B8' }]}>#{nft.tokenId}</Text>
                </View>
              </View>
              <View style={styles.nftContent}>
                <Text style={styles.nftName}>{nft.name || `Gamefolio Genesis #${nft.tokenId}`}</Text>
                <View style={styles.ownedNftActions}>
                  <View style={styles.ownedBadge}>
                    <Text style={styles.ownedBadgeText}>Owned</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.listButton}
                    activeOpacity={0.8}
                    onPress={() => handleOpenQuickSell(nft)}
                  >
                    <Text style={styles.listButtonText}>Quick Sell</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderMintTab = () => {
    if (mintState === 'processing') {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.emptyTitle}>Minting NFTs...</Text>
          <Text style={styles.emptyText}>
            This can take up to 30 seconds. Please don't close the app.
          </Text>
        </View>
      );
    }

    if (mintState === 'success') {
      return (
        <View style={styles.emptyState}>
          <View style={styles.mintSuccessIcon}>
            <CheckCircle size={48} color="#4ADE80" />
          </View>
          <Text style={styles.emptyTitle}>Minted Successfully!</Text>
          {mintedTokenIds.length > 0 ? (
            <Text style={styles.emptyText}>
              Token{mintedTokenIds.length > 1 ? 's' : ''}: #{mintedTokenIds.join(', #')}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.mintAgainButton}
            onPress={() => { setMintState('idle'); setMintQty(1); }}
            activeOpacity={0.8}
          >
            <Text style={styles.mintAgainButtonText}>Mint More</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.viewCollectionButton}
            onPress={() => setActiveTab('sell')}
            activeOpacity={0.8}
          >
            <Text style={styles.viewCollectionButtonText}>View Collection</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (mintState === 'error') {
      return (
        <View style={styles.emptyState}>
          <View style={styles.mintErrorIcon}>
            <AlertCircle size={48} color="#EF4444" />
          </View>
          <Text style={styles.emptyTitle}>Minting Failed</Text>
          <Text style={styles.emptyText}>{mintError}</Text>
          <TouchableOpacity
            style={styles.mintAgainButton}
            onPress={() => setMintState('idle')}
            activeOpacity={0.8}
          >
            <Text style={styles.mintAgainButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.mainContent}>
        <Text style={styles.mainTitle}>Mint NFTs</Text>
        <Text style={styles.subtitle}>
          Create your own unique Gamefolio NFT avatar on the SKALE blockchain
        </Text>

        <View style={styles.mintCard}>
          <View style={styles.mintCardHeader}>
            <Sparkles size={28} color="#4ADE80" />
            <Text style={styles.mintCardTitle}>Gamefolio Genesis</Text>
          </View>
          <Text style={styles.mintCardDesc}>
            Each Genesis NFT is a unique digital avatar that lives on the blockchain.
            Use it as your profile picture or sell it on the marketplace.
          </Text>

          <View style={styles.mintPriceRow}>
            <Text style={styles.mintPriceLabel}>Price per NFT</Text>
            <View style={styles.mintPriceValue}>
              <Sparkles size={16} color="#4ADE80" />
              <Text style={styles.mintPriceText}>{MINT_PRICE_PER_NFT.toLocaleString()} GF</Text>
            </View>
          </View>

          <View style={styles.mintQtyRow}>
            <Text style={styles.mintQtyLabel}>Quantity</Text>
            <View style={styles.mintQtyControls}>
              <TouchableOpacity
                style={[styles.mintQtyBtn, mintQty <= 1 && styles.mintQtyBtnDisabled]}
                onPress={() => setMintQty(q => Math.max(1, q - 1))}
                disabled={mintQty <= 1}
                activeOpacity={0.7}
              >
                <Minus size={18} color={mintQty <= 1 ? '#475569' : '#FFFFFF'} />
              </TouchableOpacity>
              <Text style={styles.mintQtyValue}>{mintQty}</Text>
              <TouchableOpacity
                style={[styles.mintQtyBtn, mintQty >= MAX_MINT_QTY && styles.mintQtyBtnDisabled]}
                onPress={() => setMintQty(q => Math.min(MAX_MINT_QTY, q + 1))}
                disabled={mintQty >= MAX_MINT_QTY}
                activeOpacity={0.7}
              >
                <Plus size={18} color={mintQty >= MAX_MINT_QTY ? '#475569' : '#FFFFFF'} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.mintTotalRow}>
            <Text style={styles.mintTotalLabel}>Total Cost</Text>
            <Text style={styles.mintTotalValue}>{mintTotal.toLocaleString()} GF</Text>
          </View>

          <View style={styles.mintBalanceRow}>
            <Text style={styles.mintBalanceLabel}>Your Balance</Text>
            <Text style={[styles.mintBalanceValue, !canAffordMint && styles.mintBalanceInsufficient]}>
              {gfBalance.toLocaleString()} GF
            </Text>
          </View>

          {!canAffordMint ? (
            <View style={styles.mintInsufficientBanner}>
              <AlertCircle size={16} color="#F59E0B" />
              <Text style={styles.mintInsufficientText}>
                You need {(mintTotal - gfBalance).toLocaleString()} more GF to mint {mintQty} NFT{mintQty > 1 ? 's' : ''}.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.mintButton, !canAffordMint && styles.mintButtonDisabled]}
            onPress={() => { if (canAffordMint) setMintConfirming(true); }}
            disabled={!canAffordMint}
            activeOpacity={0.8}
          >
            <Sparkles size={20} color={canAffordMint ? '#020617' : '#64748B'} />
            <Text style={[styles.mintButtonText, !canAffordMint && styles.mintButtonTextDisabled]}>
              Mint {mintQty} NFT{mintQty > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderWatchlistTab = () => {
    const watchedListings = marketplaceListings.filter(l => favorites.has(String(l.token_id)));
    return (
      <View style={styles.emptyState}>
        <Heart size={48} color="#475569" />
        <Text style={styles.emptyTitle}>
          {favorites.size === 0 ? 'No Favorites Yet' : 'My Watchlist'}
        </Text>
        <Text style={styles.emptyText}>
          {favorites.size === 0
            ? 'Tap the heart icon on any marketplace listing to save it here'
            : watchedListings.length > 0
              ? `${watchedListings.length} saved listing${watchedListings.length > 1 ? 's' : ''} still available`
              : 'Your saved listings are no longer available'}
        </Text>
        {watchedListings.length > 0 ? (
          <View style={[styles.nftGrid, { marginTop: 20, width: '100%' }]}>
            {watchedListings.map((listing) => (
              <View key={listing.token_id} style={styles.nftCard}>
                <View style={styles.nftContent}>
                  <Text style={styles.nftName}>Genesis #{listing.token_id}</Text>
                  <Text style={styles.nftDescription} numberOfLines={1}>
                    by {listing.display_name || listing.username}
                  </Text>
                  <View style={styles.priceContainer}>
                    <Sparkles size={12} color="#4ADE80" />
                    <Text style={styles.priceGF}>{listing.listed_price.toLocaleString()} GF</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.buyButton}
                    onPress={() => handleBuyListing(listing)}
                    activeOpacity={0.8}
                  >
                    <ShoppingCart size={14} color="#020617" />
                    <Text style={styles.buyButtonText}>Buy Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'buy': return renderBuyTab();
      case 'sell': return renderSellTab();
      case 'mint': return renderMintTab();
      case 'watchlist': return renderWatchlistTab();
    }
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
                <Text style={styles.balanceAmount}>{gfBalance.toLocaleString()} GF</Text>
                <Text style={styles.balanceUSD}>≈ £{(gfBalance * 0.01).toFixed(2)} GBP</Text>
              </View>
            </View>
          </View>

          <View style={styles.tabsContainer}>
            {([
              { key: 'buy', label: 'Buy', Icon: ShoppingCart },
              { key: 'sell', label: 'Sell', Icon: TrendingUp },
              { key: 'mint', label: 'Mint', Icon: Sparkles },
              { key: 'watchlist', label: 'Watch', Icon: Heart },
            ] as const).map(({ key, label, Icon }) => (
              <TouchableOpacity
                key={key}
                style={[styles.tab, activeTab === key && styles.tabActive]}
                onPress={() => setActiveTab(key)}
                activeOpacity={0.7}
              >
                <Icon size={16} color={activeTab === key ? '#020617' : '#64748B'} />
                <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {renderContent()}
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>

      <Modal
        visible={selectedListing !== null}
        transparent
        animationType="slide"
        onRequestClose={handleClosePurchaseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {purchaseState === 'success' ? (
              <View style={styles.resultContainer}>
                <View style={[styles.resultIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                  <CheckCircle size={40} color="#4ADE80" />
                </View>
                <Text style={styles.resultTitle}>Purchase Successful!</Text>
                <Text style={styles.resultText}>
                  Gamefolio Genesis #{selectedListing?.token_id} is now in your collection.
                </Text>
                <TouchableOpacity style={styles.doneButton} onPress={handleClosePurchaseModal} activeOpacity={0.8}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : purchaseState === 'error' ? (
              <View style={styles.resultContainer}>
                <View style={[styles.resultIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <AlertCircle size={40} color="#EF4444" />
                </View>
                <Text style={styles.resultTitle}>Purchase Failed</Text>
                <Text style={styles.resultText}>{purchaseError}</Text>
                <TouchableOpacity style={styles.doneButton} onPress={() => setPurchaseState('confirming')} activeOpacity={0.8}>
                  <Text style={styles.doneButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelLink} onPress={handleClosePurchaseModal} activeOpacity={0.7}>
                  <Text style={styles.cancelLinkText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : purchaseState === 'processing' ? (
              <View style={styles.resultContainer}>
                <ActivityIndicator size="large" color="#4ADE80" />
                <Text style={styles.resultTitle}>Processing Purchase...</Text>
                <Text style={styles.resultText}>Transferring NFT ownership. Please wait.</Text>
              </View>
            ) : selectedListing ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Confirm Purchase</Text>
                  <TouchableOpacity onPress={handleClosePurchaseModal} activeOpacity={0.7} style={styles.closeBtn}>
                    <X size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalItemCard}>
                  <View style={[styles.modalItemIcon, { backgroundColor: 'rgba(74, 222, 128, 0.12)' }]}>
                    <Sparkles size={36} color="#4ADE80" />
                  </View>
                  <View style={styles.modalItemInfo}>
                    <Text style={styles.modalItemName}>Gamefolio Genesis #{selectedListing.token_id}</Text>
                    <View style={styles.modalRarityRow}>
                      <View style={[styles.rarityDot, { backgroundColor: '#94A3B8' }]} />
                      <Text style={[styles.rarityText, { color: '#94A3B8' }]}>
                        Sold by {selectedListing.display_name || selectedListing.username}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.priceSummary}>
                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{selectedListing.listed_price.toLocaleString()} GF</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Your Balance</Text>
                    <Text style={[
                      styles.balanceCheck,
                      gfBalance < selectedListing.listed_price && styles.balanceInsufficient,
                    ]}>
                      {gfBalance.toLocaleString()} GF
                    </Text>
                  </View>
                </View>

                {gfBalance < selectedListing.listed_price ? (
                  <View style={styles.insufficientBanner}>
                    <AlertCircle size={16} color="#F59E0B" />
                    <Text style={styles.insufficientText}>
                      You need {(selectedListing.listed_price - gfBalance).toLocaleString()} more GF.
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[styles.confirmButton, gfBalance < selectedListing.listed_price && styles.confirmButtonDisabled]}
                  onPress={handleConfirmListingPurchase}
                  disabled={gfBalance < selectedListing.listed_price}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.confirmButtonText,
                    gfBalance < selectedListing.listed_price && styles.confirmButtonTextDisabled,
                  ]}>
                    Confirm Purchase
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={mintConfirming}
        transparent
        animationType="slide"
        onRequestClose={() => setMintConfirming(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Mint</Text>
              <TouchableOpacity onPress={() => setMintConfirming(false)} activeOpacity={0.7} style={styles.closeBtn}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.mintConfirmCard}>
              <View style={styles.mintConfirmRow}>
                <Sparkles size={32} color="#4ADE80" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.mintConfirmTitle}>Gamefolio Genesis</Text>
                  <Text style={styles.mintConfirmSub}>{mintQty} NFT{mintQty > 1 ? 's' : ''} on SKALE blockchain</Text>
                </View>
              </View>
            </View>

            <View style={styles.mintConfirmSummary}>
              <View style={styles.mintConfirmSummaryRow}>
                <Text style={styles.mintSummaryLabel}>Quantity</Text>
                <Text style={styles.mintSummaryValue}>{mintQty}</Text>
              </View>
              <View style={styles.mintConfirmSummaryRow}>
                <Text style={styles.mintSummaryLabel}>Price per NFT</Text>
                <Text style={styles.mintSummaryValue}>{MINT_PRICE_PER_NFT.toLocaleString()} GF</Text>
              </View>
              <View style={[styles.mintConfirmSummaryRow, styles.mintConfirmTotal]}>
                <Text style={styles.mintTotalLabelBold}>Total Cost</Text>
                <Text style={styles.mintTotalValueGreen}>{(mintQty * MINT_PRICE_PER_NFT).toLocaleString()} GF</Text>
              </View>
              <View style={styles.mintConfirmSummaryRow}>
                <Text style={styles.mintSummaryLabel}>Your Balance</Text>
                <Text style={styles.mintSummaryValue}>{gfBalance.toLocaleString()} GF</Text>
              </View>
              <View style={styles.mintConfirmSummaryRow}>
                <Text style={styles.mintSummaryLabel}>After Mint</Text>
                <Text style={styles.mintSummaryValue}>{(gfBalance - mintQty * MINT_PRICE_PER_NFT).toLocaleString()} GF</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.confirmButton} onPress={handleMintNFT} activeOpacity={0.8}>
              <Text style={styles.confirmButtonText}>Confirm Mint</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelLink} onPress={() => setMintConfirming(false)} activeOpacity={0.7}>
              <Text style={styles.cancelLinkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={sellState !== 'idle' && selectedNftToSell != null}
        transparent
        animationType="slide"
        onRequestClose={handleCloseQuickSellModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {sellState === 'success' ? 'Sale Complete' : sellState === 'error' ? 'Sale Failed' : 'Quick Sell'}
              </Text>
              <TouchableOpacity onPress={handleCloseQuickSellModal} activeOpacity={0.7} style={styles.closeBtn}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {sellState === 'success' ? (
              <>
                <View style={styles.emptyState}>
                  <View style={styles.mintSuccessIcon}>
                    <CheckCircle size={48} color="#4ADE80" />
                  </View>
                  <Text style={styles.emptyTitle}>NFT Listed!</Text>
                  <Text style={styles.emptyText}>
                    {`${sellNetReceived.toFixed(2)} GFT has been credited to your balance.\nYour NFT is now live in the marketplace.`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => { handleCloseQuickSellModal(); setActiveTab('buy'); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmButtonText}>View in Marketplace</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelLink} onPress={handleCloseQuickSellModal} activeOpacity={0.7}>
                  <Text style={styles.cancelLinkText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : sellState === 'error' ? (
              <>
                <View style={styles.emptyState}>
                  <View style={[styles.mintSuccessIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                    <AlertCircle size={48} color="#EF4444" />
                  </View>
                  <Text style={[styles.emptyTitle, { color: '#EF4444' }]}>Could Not Sell</Text>
                  <Text style={styles.emptyText}>{sellError}</Text>
                </View>
                <TouchableOpacity style={styles.confirmButton} onPress={() => setSellState('confirming')} activeOpacity={0.8}>
                  <Text style={styles.confirmButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelLink} onPress={handleCloseQuickSellModal} activeOpacity={0.7}>
                  <Text style={styles.cancelLinkText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.mintConfirmCard}>
                  <View style={styles.mintConfirmRow}>
                    {selectedNftToSell?.imageDataUrl ? (
                      <Image source={{ uri: selectedNftToSell.imageDataUrl }} style={styles.sellModalThumb} />
                    ) : selectedNftToSell?.image ? (
                      <Image source={{ uri: `${Env.BACKEND_URL}${selectedNftToSell.image}` }} style={styles.sellModalThumb} />
                    ) : (
                      <View style={[styles.sellModalThumb, styles.sellModalThumbPlaceholder]}>
                        <Sparkles size={24} color="#4ADE80" />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mintConfirmTitle}>
                        {selectedNftToSell?.name || `Gamefolio Genesis #${selectedNftToSell?.tokenId}`}
                      </Text>
                      <Text style={styles.mintConfirmSub}>Token #{selectedNftToSell?.tokenId}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.mintConfirmSummary}>
                  <View style={styles.mintConfirmSummaryRow}>
                    <Text style={styles.mintSummaryLabel}>Listing Price</Text>
                    <Text style={styles.mintSummaryValue}>{QUICK_SELL_PRICE} GFT</Text>
                  </View>
                  <View style={styles.mintConfirmSummaryRow}>
                    <Text style={styles.mintSummaryLabel}>Platform Fee (1.5%)</Text>
                    <Text style={[styles.mintSummaryValue, { color: '#EF4444' }]}>- {QUICK_SELL_PLATFORM_FEE.toFixed(2)} GFT</Text>
                  </View>
                  <View style={styles.mintConfirmSummaryRow}>
                    <Text style={styles.mintSummaryLabel}>Listing Fee</Text>
                    <Text style={[styles.mintSummaryValue, { color: '#EF4444' }]}>- {QUICK_SELL_LIST_FEE.toFixed(2)} GFT</Text>
                  </View>
                  <View style={[styles.mintConfirmSummaryRow, styles.mintConfirmTotal]}>
                    <Text style={styles.mintTotalLabelBold}>You Receive</Text>
                    <Text style={styles.mintTotalValueGreen}>{QUICK_SELL_NET.toFixed(2)} GFT</Text>
                  </View>
                  <View style={styles.mintConfirmSummaryRow}>
                    <Text style={styles.mintSummaryLabel}>Current Balance</Text>
                    <Text style={styles.mintSummaryValue}>{gfBalance.toLocaleString()} GFT</Text>
                  </View>
                  <View style={styles.mintConfirmSummaryRow}>
                    <Text style={styles.mintSummaryLabel}>After Sale</Text>
                    <Text style={styles.mintSummaryValue}>{(gfBalance + QUICK_SELL_NET).toFixed(2)} GFT</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.confirmButton, sellState === 'processing' && { opacity: 0.7 }]}
                  onPress={handleConfirmQuickSell}
                  activeOpacity={0.8}
                  disabled={sellState === 'processing'}
                >
                  {sellState === 'processing' ? (
                    <ActivityIndicator size="small" color="#020617" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Confirm Quick Sell</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelLink} onPress={handleCloseQuickSellModal} activeOpacity={0.7}>
                  <Text style={styles.cancelLinkText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1831' },
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  backButton: { paddingHorizontal: 20, paddingVertical: 16 },
  headerContainer: { backgroundColor: '#0E1831', paddingHorizontal: 20, paddingBottom: 16 },
  storeTitle: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16 },
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
  balanceInfo: { flex: 1 },
  balanceLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
  balanceAmount: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 2 },
  balanceUSD: { fontSize: 13, color: '#64748B' },
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
  tabActive: { backgroundColor: '#4ADE80' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#020617' },
  mainContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  mainTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 24, lineHeight: 20 },
  nftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  nftCard: {
    width: CARD_WIDTH,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },
  nftImageContainer: { width: '100%', height: CARD_WIDTH * 1.1, position: 'relative' },
  nftImage: { width: '100%', height: '100%', backgroundColor: '#1E293B' },
  nftImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  forSaleBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  forSaleText: { fontSize: 11, fontWeight: 'bold', color: '#020617' },
  heartButton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nftContent: { padding: 12 },
  nftName: { fontSize: 15, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 4 },
  nftDescription: { fontSize: 12, color: '#94A3B8', lineHeight: 16, marginBottom: 12 },
  nftPriceRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  priceInfo: { flex: 1 },
  priceLabel: { fontSize: 10, color: '#64748B', marginBottom: 4 },
  priceOriginal: { fontSize: 10, color: '#64748B', textDecorationLine: 'line-through' },
  priceContainer: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  priceGF: { fontSize: 15, fontWeight: 'bold', color: '#4ADE80' },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  buyButtonText: { fontSize: 13, fontWeight: 'bold', color: '#020617' },
  loadingState: { alignItems: 'center', paddingVertical: 80, gap: 16 },
  loadingText: { fontSize: 14, color: '#94A3B8' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  ownedNftActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  ownedBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ownedBadgeText: { fontSize: 11, color: '#4ADE80', fontWeight: '600' },
  listButton: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  listButtonText: { fontSize: 11, color: '#4ADE80', fontWeight: '600' },
  goToMintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4ADE80',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  goToMintButtonText: { fontSize: 14, fontWeight: 'bold', color: '#020617' },
  sellModalThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    marginRight: 12,
  },
  sellModalThumbPlaceholder: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mintCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  mintCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  mintCardTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF' },
  mintCardDesc: { fontSize: 14, color: '#94A3B8', lineHeight: 20, marginBottom: 20 },
  mintPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  mintPriceLabel: { fontSize: 14, color: '#94A3B8' },
  mintPriceValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mintPriceText: { fontSize: 16, fontWeight: 'bold', color: '#4ADE80' },
  mintQtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  mintQtyLabel: { fontSize: 14, color: '#94A3B8' },
  mintQtyControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  mintQtyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mintQtyBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.05)' },
  mintQtyValue: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', minWidth: 30, textAlign: 'center' },
  mintTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  mintTotalLabel: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
  mintTotalValue: { fontSize: 20, fontWeight: 'bold', color: '#4ADE80' },
  mintBalanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  mintBalanceLabel: { fontSize: 14, color: '#94A3B8' },
  mintBalanceValue: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
  mintBalanceInsufficient: { color: '#EF4444' },
  mintInsufficientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  mintInsufficientText: { flex: 1, fontSize: 13, color: '#F59E0B', lineHeight: 18 },
  mintButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  mintButtonDisabled: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  mintButtonText: { fontSize: 16, fontWeight: 'bold', color: '#020617' },
  mintButtonTextDisabled: { color: '#64748B' },
  mintSuccessIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mintErrorIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mintAgainButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  mintAgainButtonText: { fontSize: 15, fontWeight: 'bold', color: '#020617' },
  viewCollectionButton: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  viewCollectionButtonText: { fontSize: 15, fontWeight: '600', color: '#4ADE80' },
  rarityDot: { width: 8, height: 8, borderRadius: 4 },
  rarityText: { fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: '#FFFFFF' },
  closeBtn: { padding: 4 },
  modalItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131F2A',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    marginBottom: 20,
  },
  modalItemIcon: { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalItemInfo: { flex: 1 },
  modalItemName: { fontSize: 18, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 6 },
  modalRarityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  modalItemDesc: { fontSize: 12, color: '#64748B', lineHeight: 18 },
  priceSummary: { backgroundColor: '#131F2A', borderRadius: 14, padding: 16, gap: 12, marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: '#94A3B8' },
  summaryStrike: { fontSize: 14, color: '#64748B', textDecorationLine: 'line-through' },
  discountText: { fontSize: 14, color: '#4ADE80', fontWeight: '700' as const },
  totalRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  totalValue: { fontSize: 18, fontWeight: '700' as const, color: '#4ADE80' },
  balanceCheck: { fontSize: 14, color: '#94A3B8', fontWeight: '600' as const },
  balanceInsufficient: { color: '#EF4444' },
  insufficientBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  insufficientText: { flex: 1, fontSize: 13, color: '#F59E0B', lineHeight: 18 },
  confirmButton: { backgroundColor: '#4ADE80', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  confirmButtonDisabled: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  confirmButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#020617' },
  confirmButtonTextDisabled: { color: '#64748B' },
  resultContainer: { alignItems: 'center', paddingVertical: 20, gap: 16 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 22, fontWeight: '700' as const, color: '#FFFFFF' },
  resultText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  doneButton: { backgroundColor: '#4ADE80', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  doneButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#020617' },
  cancelLink: { paddingVertical: 8, alignItems: 'center' },
  cancelLinkText: { fontSize: 14, color: '#64748B' },
  mintConfirmCard: {
    backgroundColor: '#131F2A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  mintConfirmRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  mintConfirmTitle: { fontSize: 18, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 4 },
  mintConfirmSub: { fontSize: 13, color: '#94A3B8' },
  mintConfirmSummary: {
    backgroundColor: '#131F2A',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 20,
  },
  mintConfirmSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mintConfirmTotal: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  mintSummaryLabel: { fontSize: 14, color: '#94A3B8' },
  mintSummaryValue: { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF' },
  mintTotalLabelBold: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  mintTotalValueGreen: { fontSize: 18, fontWeight: '700' as const, color: '#4ADE80' },
});
