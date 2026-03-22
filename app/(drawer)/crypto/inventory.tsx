import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Package, Crown, Palette, Gamepad2, Sparkles, Filter, Grid3X3, List, ShoppingBag } from 'lucide-react-native';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'avatars', label: 'Avatars', icon: Crown },
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'gaming', label: 'Gaming', icon: Gamepad2 },
];

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  acquiredDate: string;
  equipped: boolean;
}

const INVENTORY_ITEMS: InventoryItem[] = [];

const RARITY_COLORS: Record<string, string> = {
  common: '#94A3B8',
  rare: '#3B82F6',
  epic: '#8B5CF6',
  legendary: '#F59E0B',
};

export default function InventoryPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredItems = selectedCategory === 'all'
    ? INVENTORY_ITEMS
    : INVENTORY_ITEMS.filter(item => item.category === selectedCategory);

  const equippedItems = INVENTORY_ITEMS.filter(item => item.equipped);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Inventory</Text>
            <Text style={styles.subtitle}>Manage your owned items</Text>
          </View>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'grid' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('grid')}
              activeOpacity={0.7}
            >
              <Grid3X3 size={18} color={viewMode === 'grid' ? '#4ADE80' : '#64748B'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, viewMode === 'list' && styles.viewToggleBtnActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <List size={18} color={viewMode === 'list' ? '#4ADE80' : '#64748B'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Package size={20} color="#4ADE80" />
          <Text style={styles.statValue}>{INVENTORY_ITEMS.length}</Text>
          <Text style={styles.statLabel}>Total Items</Text>
        </View>
        <View style={styles.statCard}>
          <Crown size={20} color="#F59E0B" />
          <Text style={styles.statValue}>{equippedItems.length}</Text>
          <Text style={styles.statLabel}>Equipped</Text>
        </View>
        <View style={styles.statCard}>
          <Sparkles size={20} color="#8B5CF6" />
          <Text style={styles.statValue}>
            {INVENTORY_ITEMS.filter(i => i.rarity === 'legendary').length}
          </Text>
          <Text style={styles.statLabel}>Legendary</Text>
        </View>
      </View>

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
          <View style={styles.emptyIcon}>
            <Package size={48} color="#475569" />
          </View>
          <Text style={styles.emptyTitle}>No Items Yet</Text>
          <Text style={styles.emptyText}>
            Items you purchase from the store will appear here. Start building your collection!
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/crypto/store')}
            activeOpacity={0.8}
          >
            <ShoppingBag size={18} color="#0E1831" />
            <Text style={styles.emptyButtonText}>Browse Store</Text>
          </TouchableOpacity>
        </View>
      ) : viewMode === 'grid' ? (
        <View style={styles.itemsGrid}>
          {filteredItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemCard}
              activeOpacity={0.7}
            >
              <View style={styles.itemImageWrap}>
                <View style={[styles.itemImagePlaceholder, { borderColor: RARITY_COLORS[item.rarity] + '40' }]}>
                  <Package size={32} color={RARITY_COLORS[item.rarity]} />
                </View>
                {item.equipped && (
                  <View style={styles.equippedBadge}>
                    <Text style={styles.equippedBadgeText}>Equipped</Text>
                  </View>
                )}
                <View style={[styles.itemRarityBadge, { backgroundColor: RARITY_COLORS[item.rarity] + '20' }]}>
                  <Text style={[styles.itemRarityText, { color: RARITY_COLORS[item.rarity] }]}>
                    {item.rarity.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.itemDate}>Acquired {item.acquiredDate}</Text>
              <TouchableOpacity 
                style={[styles.equipBtn, item.equipped && styles.unequipBtn]} 
                activeOpacity={0.7}
              >
                <Text style={[styles.equipBtnText, item.equipped && styles.unequipBtnText]}>
                  {item.equipped ? 'Unequip' : 'Equip'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.itemsList}>
          {filteredItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.listItemCard}
              activeOpacity={0.7}
            >
              <View style={[styles.listItemIcon, { backgroundColor: RARITY_COLORS[item.rarity] + '20' }]}>
                <Package size={24} color={RARITY_COLORS[item.rarity]} />
              </View>
              <View style={styles.listItemInfo}>
                <View style={styles.listItemHeader}>
                  <Text style={styles.listItemName}>{item.name}</Text>
                  {item.equipped && (
                    <View style={styles.listEquippedBadge}>
                      <Text style={styles.listEquippedText}>Equipped</Text>
                    </View>
                  )}
                </View>
                <View style={styles.listItemMeta}>
                  <View style={[styles.listRarityDot, { backgroundColor: RARITY_COLORS[item.rarity] }]} />
                  <Text style={[styles.listRarityText, { color: RARITY_COLORS[item.rarity] }]}>
                    {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                  </Text>
                  <Text style={styles.listItemDate}> • {item.acquiredDate}</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={[styles.listEquipBtn, item.equipped && styles.listUnequipBtn]}
                activeOpacity={0.7}
              >
                <Text style={[styles.listEquipBtnText, item.equipped && styles.listUnequipBtnText]}>
                  {item.equipped ? 'Unequip' : 'Equip'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  viewToggleBtn: {
    padding: 8,
    borderRadius: 8,
  },
  viewToggleBtnActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500' as const,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0E1831',
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
    backgroundColor: '#131F2A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  equippedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  equippedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#0E1831',
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
    marginBottom: 4,
    minHeight: 36,
  },
  itemDate: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  equipBtn: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  unequipBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  equipBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#4ADE80',
  },
  unequipBtnText: {
    color: '#EF4444',
  },
  itemsList: {
    gap: 10,
  },
  listItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  listItemIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  listItemInfo: {
    flex: 1,
  },
  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  listItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  listEquippedBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  listEquippedText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: '#4ADE80',
  },
  listItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listRarityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  listRarityText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  listItemDate: {
    fontSize: 12,
    color: '#64748B',
  },
  listEquipBtn: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  listUnequipBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  listEquipBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#4ADE80',
  },
  listUnequipBtnText: {
    color: '#EF4444',
  },
});
