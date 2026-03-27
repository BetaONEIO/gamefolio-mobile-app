import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Search, Star, ShoppingBag, Sparkles, Crown, Palette, Gamepad2, X, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Env } from '@/constants/Env';
import * as Haptics from 'expo-haptics';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'avatars', label: 'Avatars', icon: Crown },
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
];

const RARITY_COLORS: Record<string, string> = {
  common: '#94A3B8',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};

interface StoreItem {
  id: number;
  name: string;
  description: string | null;
  category: string;
  rarity: string;
  gfCost: number;
  originalPrice?: number;
  proDiscount?: boolean;
  imageUrl: string | null;
  featured?: boolean;
}

type PurchaseState = 'idle' | 'confirming' | 'processing' | 'success' | 'error';

export default function StorePage() {
  const { user, getAccessToken, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>('idle');
  const [purchaseError, setPurchaseError] = useState('');
  const [pendingPurchaseId, setPendingPurchaseId] = useState<number | null>(null);

  const { data: storeItems = [], isLoading } = useQuery<StoreItem[]>({
    queryKey: ['/api/store/items', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/store/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id,
  });

  const filteredItems = selectedCategory === 'all'
    ? storeItems
    : storeItems.filter(item => item.category === selectedCategory);

  const featuredItem = storeItems.find(item => item.featured) || storeItems[0];

  const handleBuyPress = async (item: StoreItem) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedItem(item);
    setPurchaseState('confirming');
    setPurchaseError('');
    setPendingPurchaseId(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/store/purchase-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId: item.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setPendingPurchaseId(data.purchaseId ?? null);
      }
    } catch {
      /* non-fatal – confirm modal still shows with local item data */
    }
  };

  const handleConfirmPurchase = async () => {
    if (!selectedItem) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPurchaseState('processing');

    try {
      const token = await getAccessToken();
      const endpoint = pendingPurchaseId
        ? `${Env.BACKEND_URL}/api/store/complete-purchase`
        : `${Env.BACKEND_URL}/api/store/buy-with-gf`;
      const body = pendingPurchaseId
        ? { purchaseId: pendingPurchaseId }
        : { itemId: selectedItem.id };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setPurchaseState('error');
        setPurchaseError(data.error || 'Purchase failed. Please try again.');
        return;
      }

      if (data.newBalance !== undefined) {
        updateUser({ gfTokenBalance: data.newBalance });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/store/owned'] });
      setPurchaseState('success');
    } catch {
      setPurchaseState('error');
      setPurchaseError('Network error. Please try again.');
    }
  };

  const handleCloseModal = () => {
    setSelectedItem(null);
    setPurchaseState('idle');
    setPurchaseError('');
    setPendingPurchaseId(null);
  };

  const gfBalance = user?.gfTokenBalance ?? 0;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ADE80" />
        <Text style={styles.loadingText}>Loading store...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Store</Text>
          <Text style={styles.subtitle}>Spend your GF tokens on exclusive items</Text>
          <View style={styles.balancePill}>
            <Sparkles size={14} color="#4ADE80" />
            <Text style={styles.balanceText}>{gfBalance.toLocaleString()} GF</Text>
          </View>
        </View>

        {featuredItem ? (
          <View style={styles.featuredCard}>
            <View style={styles.featuredBadge}>
              <Star size={12} color="#F59E0B" />
              <Text style={styles.featuredBadgeText}>Featured</Text>
            </View>
            <View style={styles.featuredContent}>
              <View style={[styles.featuredImagePlaceholder, {
                borderColor: (RARITY_COLORS[featuredItem.rarity] || '#94A3B8') + '50',
              }]}>
                <Crown size={48} color={RARITY_COLORS[featuredItem.rarity] || '#F59E0B'} />
              </View>
              <View style={styles.featuredInfo}>
                <Text style={styles.featuredName}>{featuredItem.name}</Text>
                <View style={styles.featuredRarity}>
                  <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[featuredItem.rarity] || '#94A3B8' }]} />
                  <Text style={[styles.rarityText, { color: RARITY_COLORS[featuredItem.rarity] || '#94A3B8' }]}>
                    {featuredItem.rarity.charAt(0).toUpperCase() + featuredItem.rarity.slice(1)}
                  </Text>
                </View>
                {featuredItem.proDiscount ? (
                  <View>
                    <Text style={styles.originalPrice}>{(featuredItem.originalPrice || featuredItem.gfCost).toLocaleString()} GF</Text>
                    <View style={styles.discountRow}>
                      <TouchableOpacity
                        style={styles.featuredButton}
                        onPress={() => handleBuyPress(featuredItem)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.featuredButtonText}>{featuredItem.gfCost} GF</Text>
                      </TouchableOpacity>
                      <View style={styles.proBadge}>
                        <Text style={styles.proBadgeText}>PRO -20%</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.featuredButton}
                    onPress={() => handleBuyPress(featuredItem)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.featuredButtonText}>{featuredItem.gfCost.toLocaleString()} GF</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.7}
                >
                  <Icon size={16} color={isActive ? '#4ADE80' : '#94A3B8'} />
                  <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <ShoppingBag size={48} color="#475569" />
            <Text style={styles.emptyTitle}>No items available</Text>
            <Text style={styles.emptyText}>Check back later for new items in the store.</Text>
          </View>
        ) : (
          <View style={styles.itemsGrid}>
            {filteredItems.map((item) => {
              const rarityColor = RARITY_COLORS[item.rarity] || '#94A3B8';
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemCard}
                  activeOpacity={0.7}
                  onPress={() => handleBuyPress(item)}
                >
                  <View style={styles.itemImageWrap}>
                    <View style={[styles.itemImagePlaceholder, { borderColor: rarityColor + '40' }]}>
                      <ShoppingBag size={32} color={rarityColor} />
                    </View>
                    <View style={[styles.itemRarityBadge, { backgroundColor: rarityColor + '20' }]}>
                      <Text style={[styles.itemRarityText, { color: rarityColor }]}>
                        {item.rarity.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <View style={styles.itemPriceRow}>
                    <View>
                      {item.proDiscount ? (
                        <Text style={styles.originalPriceSmall}>{(item.originalPrice || item.gfCost)} GF</Text>
                      ) : null}
                      <Text style={styles.itemPrice}>{item.gfCost} GF</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.buySmallBtn}
                      onPress={() => handleBuyPress(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.buySmallBtnText}>Buy</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.emptyPadding} />
      </ScrollView>

      <Modal
        visible={selectedItem !== null}
        transparent
        animationType="slide"
        onRequestClose={handleCloseModal}
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
                  {selectedItem?.name} has been added to your inventory.
                </Text>
                <TouchableOpacity style={styles.doneButton} onPress={handleCloseModal} activeOpacity={0.8}>
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
                <TouchableOpacity style={styles.retryButton} onPress={() => setPurchaseState('confirming')} activeOpacity={0.8}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelLink} onPress={handleCloseModal} activeOpacity={0.7}>
                  <Text style={styles.cancelLinkText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : purchaseState === 'processing' ? (
              <View style={styles.resultContainer}>
                <ActivityIndicator size="large" color="#4ADE80" />
                <Text style={styles.resultTitle}>Processing...</Text>
                <Text style={styles.resultText}>Please wait while we complete your purchase.</Text>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Confirm Purchase</Text>
                  <TouchableOpacity onPress={handleCloseModal} activeOpacity={0.7} style={styles.closeBtn}>
                    <X size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                {selectedItem ? (
                  <>
                    <View style={styles.modalItemCard}>
                      <View style={[styles.modalItemIcon, {
                        backgroundColor: (RARITY_COLORS[selectedItem.rarity] || '#94A3B8') + '20',
                      }]}>
                        <ShoppingBag size={36} color={RARITY_COLORS[selectedItem.rarity] || '#94A3B8'} />
                      </View>
                      <View style={styles.modalItemInfo}>
                        <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                        <View style={styles.modalRarityRow}>
                          <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[selectedItem.rarity] || '#94A3B8' }]} />
                          <Text style={[styles.rarityText, { color: RARITY_COLORS[selectedItem.rarity] || '#94A3B8' }]}>
                            {selectedItem.rarity.charAt(0).toUpperCase() + selectedItem.rarity.slice(1)}
                          </Text>
                        </View>
                        {selectedItem.description ? (
                          <Text style={styles.modalItemDesc} numberOfLines={2}>{selectedItem.description}</Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.priceSummary}>
                      {selectedItem.proDiscount ? (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceRowLabel}>Original Price</Text>
                          <Text style={styles.priceRowStrike}>{(selectedItem.originalPrice || selectedItem.gfCost).toLocaleString()} GF</Text>
                        </View>
                      ) : null}
                      {selectedItem.proDiscount ? (
                        <View style={styles.priceRow}>
                          <Text style={styles.priceRowLabel}>Pro Discount</Text>
                          <Text style={styles.discountText}>-20%</Text>
                        </View>
                      ) : null}
                      <View style={[styles.priceRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>{selectedItem.gfCost.toLocaleString()} GF</Text>
                      </View>
                      <View style={styles.priceRow}>
                        <Text style={styles.priceRowLabel}>Your Balance</Text>
                        <Text style={[
                          styles.balanceValue,
                          gfBalance < selectedItem.gfCost && styles.balanceInsufficient,
                        ]}>
                          {gfBalance.toLocaleString()} GF
                        </Text>
                      </View>
                    </View>

                    {gfBalance < selectedItem.gfCost ? (
                      <View style={styles.insufficientBanner}>
                        <AlertCircle size={16} color="#F59E0B" />
                        <Text style={styles.insufficientText}>
                          Insufficient GF balance. You need {(selectedItem.gfCost - gfBalance).toLocaleString()} more GF.
                        </Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={[
                        styles.confirmButton,
                        gfBalance < selectedItem.gfCost && styles.confirmButtonDisabled,
                      ]}
                      onPress={handleConfirmPurchase}
                      disabled={gfBalance < selectedItem.gfCost}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.confirmButtonText,
                        gfBalance < selectedItem.gfCost && styles.confirmButtonTextDisabled,
                      ]}>
                        Confirm Purchase
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { fontSize: 14, color: '#94A3B8' },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 10 },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  balanceText: { fontSize: 14, fontWeight: '700' as const, color: '#4ADE80' },
  featuredCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    marginBottom: 24,
    position: 'relative',
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  featuredBadgeText: { fontSize: 11, fontWeight: '700' as const, color: '#F59E0B' },
  featuredContent: { flexDirection: 'row', alignItems: 'center', marginTop: 24, gap: 20 },
  featuredImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  featuredInfo: { flex: 1 },
  featuredName: { fontSize: 20, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 8 },
  featuredRarity: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  rarityDot: { width: 8, height: 8, borderRadius: 4 },
  rarityText: { fontSize: 13, fontWeight: '600' as const },
  originalPrice: { fontSize: 12, color: '#64748B', textDecorationLine: 'line-through', marginBottom: 4 },
  discountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featuredButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  featuredButtonText: { fontSize: 15, fontWeight: '700' as const, color: '#0E1831' },
  proBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  proBadgeText: { fontSize: 10, fontWeight: '700' as const, color: '#4ADE80' },
  section: { marginBottom: 20 },
  categoriesScroll: { gap: 10 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryChipActive: { backgroundColor: 'rgba(74, 222, 128, 0.15)', borderColor: 'rgba(74, 222, 128, 0.3)' },
  categoryText: { fontSize: 14, fontWeight: '600' as const, color: '#94A3B8' },
  categoryTextActive: { color: '#4ADE80' },
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700' as const, color: '#FFFFFF' },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  itemsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemCard: { width: '48%', backgroundColor: '#1E293B', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#334155' },
  itemImageWrap: { position: 'relative', marginBottom: 12 },
  itemImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#131F2A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  itemRarityBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemRarityText: { fontSize: 12, fontWeight: '700' as const },
  itemName: { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF', marginBottom: 10, minHeight: 36 },
  itemPriceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  originalPriceSmall: { fontSize: 10, color: '#64748B', textDecorationLine: 'line-through' },
  itemPrice: { fontSize: 15, fontWeight: '700' as const, color: '#4ADE80' },
  buySmallBtn: { backgroundColor: 'rgba(74, 222, 128, 0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  buySmallBtnText: { fontSize: 12, fontWeight: '700' as const, color: '#4ADE80' },
  emptyPadding: { height: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
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
  priceSummary: {
    backgroundColor: '#131F2A',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    marginBottom: 16,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceRowLabel: { fontSize: 14, color: '#94A3B8' },
  priceRowStrike: { fontSize: 14, color: '#64748B', textDecorationLine: 'line-through' },
  discountText: { fontSize: 14, color: '#4ADE80', fontWeight: '700' as const },
  totalRow: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 12 },
  totalLabel: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  totalValue: { fontSize: 18, fontWeight: '700' as const, color: '#4ADE80' },
  balanceValue: { fontSize: 14, color: '#94A3B8', fontWeight: '600' as const },
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
  confirmButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  confirmButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#020617' },
  confirmButtonTextDisabled: { color: '#64748B' },
  resultContainer: { alignItems: 'center', paddingVertical: 20, gap: 16 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 22, fontWeight: '700' as const, color: '#FFFFFF' },
  resultText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  doneButton: { backgroundColor: '#4ADE80', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  doneButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#020617' },
  retryButton: { backgroundColor: '#4ADE80', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40 },
  retryButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#020617' },
  cancelLink: { paddingVertical: 8 },
  cancelLinkText: { fontSize: 14, color: '#64748B' },
});
