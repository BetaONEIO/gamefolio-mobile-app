import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { api } from '@/lib/api';

export interface CollectedItem {
  id: string;
  type: 'xp' | 'coins' | 'item' | 'asset';
  name: string;
  amount: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  claimedAt: string;
  imageUrl?: string | null;
  description?: string | null;
}

interface LootboxStats {
  totalOpened: number;
  totalXP: number;
  totalCoins: number;
  legendaryCount: number;
  epicCount: number;
  rareCount: number;
  commonCount: number;
}

const STORAGE_KEY = 'lootbox_collection';
const STATS_KEY = 'lootbox_stats';

export const [LootboxCollectionProvider, useLootboxCollection] = createContextHook(() => {
  const [items, setItems] = useState<CollectedItem[]>([]);
  const [stats, setStats] = useState<LootboxStats>({
    totalOpened: 0,
    totalXP: 0,
    totalCoins: 0,
    legendaryCount: 0,
    epicCount: 0,
    rareCount: 0,
    commonCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadCollection();
  }, []);

  const loadCollection = async () => {
    try {
      console.log('[LootboxCollection] Loading collection from storage...');
      const [storedItems, storedStats] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(STATS_KEY),
      ]);

      if (storedItems) {
        const parsed = JSON.parse(storedItems);
        setItems(parsed);
        console.log('[LootboxCollection] Loaded', parsed.length, 'items from local storage');
      }

      if (storedStats) {
        const parsedStats = JSON.parse(storedStats);
        setStats(parsedStats);
        console.log('[LootboxCollection] Loaded stats from local storage:', parsedStats);
      }
    } catch (error) {
      console.error('[LootboxCollection] Failed to load collection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncWithDatabase = useCallback(async (token: string) => {
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      console.log('[LootboxCollection] Syncing with database...');
      const response = await api.rewards.getUserRewards(token);
      
      if (response.rewards && response.rewards.length > 0) {
        const dbItems: CollectedItem[] = response.rewards
          .filter(ur => ur.reward !== null)
          .map(ur => ({
            id: String(ur.id),
            type: (ur.reward?.type as 'xp' | 'coins' | 'item') || 'item',
            name: ur.reward?.name || 'Unknown',
            amount: ur.quantity || 1,
            rarity: ur.reward?.rarity || 'common',
            claimedAt: ur.claimedAt,
            imageUrl: ur.reward?.imageUrl,
            description: ur.reward?.description,
          }));
        
        setItems(dbItems);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dbItems));
        console.log('[LootboxCollection] Synced', dbItems.length, 'items from database');
      }

      if (response.stats) {
        const dbStats: LootboxStats = {
          totalOpened: response.stats.totalItems,
          totalXP: 0,
          totalCoins: 0,
          legendaryCount: response.stats.legendaryCount,
          epicCount: response.stats.epicCount,
          rareCount: response.stats.rareCount,
          commonCount: response.stats.commonCount,
        };
        setStats(dbStats);
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify(dbStats));
        console.log('[LootboxCollection] Synced stats from database');
      }
    } catch (error) {
      console.error('[LootboxCollection] Failed to sync with database:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const addItems = useCallback(async (newItems: Omit<CollectedItem, 'id' | 'claimedAt'>[]) => {
    try {
      console.log('[LootboxCollection] Adding', newItems.length, 'items');
      
      const itemsWithIds: CollectedItem[] = newItems.map((item) => ({
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        claimedAt: new Date().toISOString(),
      }));

      const updatedItems = [...items, ...itemsWithIds];
      setItems(updatedItems);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));

      const newStats = { ...stats };
      newStats.totalOpened += 1;
      
      newItems.forEach((item) => {
        if (item.type === 'xp') {
          newStats.totalXP += item.amount;
        } else if (item.type === 'coins') {
          newStats.totalCoins += item.amount;
        }

        switch (item.rarity) {
          case 'legendary':
            newStats.legendaryCount += 1;
            break;
          case 'epic':
            newStats.epicCount += 1;
            break;
          case 'rare':
            newStats.rareCount += 1;
            break;
          case 'common':
            newStats.commonCount += 1;
            break;
        }
      });

      setStats(newStats);
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));
      
      console.log('[LootboxCollection] Items added successfully');
    } catch (error) {
      console.error('[LootboxCollection] Failed to add items:', error);
    }
  }, [items, stats]);

  const clearCollection = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([STORAGE_KEY, STATS_KEY]);
      setItems([]);
      setStats({
        totalOpened: 0,
        totalXP: 0,
        totalCoins: 0,
        legendaryCount: 0,
        epicCount: 0,
        rareCount: 0,
        commonCount: 0,
      });
      console.log('[LootboxCollection] Collection cleared');
    } catch (error) {
      console.error('[LootboxCollection] Failed to clear collection:', error);
    }
  }, []);

  const getItemsByType = useCallback((type: 'xp' | 'coins' | 'item' | 'asset') => {
    return items.filter((item) => item.type === type);
  }, [items]);

  const getItemsByRarity = useCallback((rarity: 'common' | 'rare' | 'epic' | 'legendary') => {
    return items.filter((item) => item.rarity === rarity);
  }, [items]);

  const getSpecialItems = useCallback(() => {
    return items.filter((item) => item.type === 'item' || item.type === 'asset');
  }, [items]);

  return {
    items,
    stats,
    isLoading,
    isSyncing,
    addItems,
    clearCollection,
    getItemsByType,
    getItemsByRarity,
    getSpecialItems,
    syncWithDatabase,
  };
});
