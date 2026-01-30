import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Search, Filter, Star, ShoppingBag, Sparkles, Crown, Palette, Gamepad2 } from 'lucide-react-native';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'avatars', label: 'Avatars', icon: Crown },
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
];

const STORE_ITEMS = [
  { id: '1', name: 'Golden Avatar Frame', category: 'avatars', price: 500, image: null, rarity: 'legendary', featured: true },
  { id: '2', name: 'Neon Theme Pack', category: 'themes', price: 250, image: null, rarity: 'rare' },
  { id: '3', name: 'Pro Gamer Badge', category: 'gaming', price: 150, image: null, rarity: 'common' },
  { id: '4', name: 'Diamond Border', category: 'avatars', price: 1000, image: null, rarity: 'legendary' },
  { id: '5', name: 'Cyber Theme', category: 'themes', price: 300, image: null, rarity: 'epic' },
  { id: '6', name: 'Victory Emote', category: 'gaming', price: 75, image: null, rarity: 'common' },
];

const RARITY_COLORS: Record<string, string> = {
  common: '#94A3B8',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};

export default function StorePage() {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredItems = selectedCategory === 'all' 
    ? STORE_ITEMS 
    : STORE_ITEMS.filter(item => item.category === selectedCategory);

  const featuredItem = STORE_ITEMS.find(item => item.featured);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Store</Text>
        <Text style={styles.subtitle}>Spend your GF tokens on exclusive items</Text>
      </View>

      {featuredItem && (
        <View style={styles.featuredCard}>
          <View style={styles.featuredBadge}>
            <Star size={12} color="#F59E0B" />
            <Text style={styles.featuredBadgeText}>Featured</Text>
          </View>
          <View style={styles.featuredContent}>
            <View style={styles.featuredImagePlaceholder}>
              <Crown size={48} color="#F59E0B" />
            </View>
            <View style={styles.featuredInfo}>
              <Text style={styles.featuredName}>{featuredItem.name}</Text>
              <View style={styles.featuredRarity}>
                <View style={[styles.rarityDot, { backgroundColor: RARITY_COLORS[featuredItem.rarity] }]} />
                <Text style={[styles.rarityText, { color: RARITY_COLORS[featuredItem.rarity] }]}>
                  {featuredItem.rarity.charAt(0).toUpperCase() + featuredItem.rarity.slice(1)}
                </Text>
              </View>
              <TouchableOpacity style={styles.featuredButton} activeOpacity={0.8}>
                <Text style={styles.featuredButtonText}>{featuredItem.price} GF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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

      <View style={styles.itemsGrid}>
        {filteredItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.itemCard}
            activeOpacity={0.7}
          >
            <View style={styles.itemImageWrap}>
              <View style={[styles.itemImagePlaceholder, { borderColor: RARITY_COLORS[item.rarity] + '40' }]}>
                <ShoppingBag size={32} color={RARITY_COLORS[item.rarity]} />
              </View>
              <View style={[styles.itemRarityBadge, { backgroundColor: RARITY_COLORS[item.rarity] + '20' }]}>
                <Text style={[styles.itemRarityText, { color: RARITY_COLORS[item.rarity] }]}>
                  {item.rarity.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
            <View style={styles.itemPriceRow}>
              <Text style={styles.itemPrice}>{item.price} GF</Text>
              <TouchableOpacity style={styles.buySmallBtn} activeOpacity={0.7}>
                <Text style={styles.buySmallBtnText}>Buy</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.emptyPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
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
  featuredBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#F59E0B',
  },
  featuredContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 20,
  },
  featuredImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  featuredInfo: {
    flex: 1,
  },
  featuredName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  featuredRarity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rarityText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  featuredButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  featuredButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0A0E27',
  },
  section: {
    marginBottom: 20,
  },
  categoriesScroll: {
    gap: 10,
  },
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
  categoryChipActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  categoryTextActive: {
    color: '#4ADE80',
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  itemCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemImageWrap: {
    position: 'relative',
    marginBottom: 12,
  },
  itemImagePlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: '#0F1520',
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
  itemRarityText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 10,
    minHeight: 36,
  },
  itemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#4ADE80',
  },
  buySmallBtn: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buySmallBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#4ADE80',
  },
  emptyPadding: {
    height: 20,
  },
});
