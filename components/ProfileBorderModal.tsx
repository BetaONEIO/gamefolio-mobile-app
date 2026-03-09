import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView, Image, ActivityIndicator, Animated } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, Trash2, Lock, ShoppingBag } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export interface AvatarBorder {
  id: number;
  name: string;
  imageUrl: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  claimedAt?: string;
  unlocked?: boolean;
}

interface ProfileBorderModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (border: AvatarBorder | null) => void;
  currentBorderId?: number | null;
  previewImageUrl?: string;
}

const { width } = Dimensions.get('window');

export default function ProfileBorderModal({ 
  visible, 
  onClose, 
  onSelect, 
  currentBorderId = null,
  previewImageUrl 
}: ProfileBorderModalProps) {
  const [selectedBorderId, setSelectedBorderId] = useState<number | null>(currentBorderId);
  const [activeTab, setActiveTab] = useState<'owned' | 'store'>('owned');
  const { getAccessToken } = useAuth();

  const starAnimations = useRef(
    Array.from({ length: 20 }).map(() => ({
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(Math.random() * 0.5 + 0.3),
    }))
  ).current;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/profile-borders'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.profileBorders.getAll(token);
    },
    enabled: visible,
  });

  const updateBorderMutation = useMutation({
    mutationFn: async (borderId: number | null) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.profileBorders.updateSelected(borderId, token);
    },
    onSuccess: (result) => {
      console.log('[ProfileBorderModal] Border updated successfully:', result);
      const selectedBorder = data?.borders.find(b => b.id === result.selectedBorderId);
      onSelect(selectedBorder || null);
      onClose();
    },
    onError: (error) => {
      console.error('[ProfileBorderModal] Failed to update border:', error);
    },
  });

  useEffect(() => {
    if (visible) {
      setSelectedBorderId(currentBorderId);
      refetch();
    }
  }, [visible, currentBorderId, refetch]);

  useEffect(() => {
    if (data?.selectedBorderId !== undefined) {
      setSelectedBorderId(data.selectedBorderId);
    }
  }, [data?.selectedBorderId]);

  useEffect(() => {
    if (!visible) return;
    
    starAnimations.forEach((anim) => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(anim.translateY, {
              toValue: -20,
              duration: 2000 + Math.random() * 1000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 0.8,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(anim.translateY, {
              toValue: 0,
              duration: 2000 + Math.random() * 1000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.opacity, {
              toValue: 0.3,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    });
  }, [visible, starAnimations]);

  const handleConfirm = () => {
    console.log('[ProfileBorderModal] Confirming border selection:', selectedBorderId);
    updateBorderMutation.mutate(selectedBorderId);
  };

  const handleRemoveBorder = () => {
    console.log('[ProfileBorderModal] Removing border');
    setSelectedBorderId(null);
  };
  
  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return '#94A3B8';
      case 'rare': return '#3B82F6';
      case 'epic': return '#A855F7';
      case 'legendary': return '#FFD700';
      default: return '#94A3B8';
    }
  };

  const getRarityGlow = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return { shadowColor: '#FFD700', shadowOpacity: 0.6, shadowRadius: 12 };
      case 'epic': return { shadowColor: '#A855F7', shadowOpacity: 0.5, shadowRadius: 10 };
      case 'rare': return { shadowColor: '#3B82F6', shadowOpacity: 0.4, shadowRadius: 8 };
      default: return {};
    }
  };

  const renderBorderPreview = (border: AvatarBorder) => {
    return (
      <View style={[styles.borderPreviewContainer, getRarityGlow(border.rarity)]}>
        <Image 
          source={{ uri: border.imageUrl }} 
          style={styles.borderImage}
          resizeMode="contain"
        />
        <View style={styles.previewImageContainer}>
          {previewImageUrl ? (
            <Image 
              source={{ uri: previewImageUrl }} 
              style={styles.previewImage} 
            />
          ) : (
            <View style={styles.previewPlaceholder} />
          )}
        </View>
      </View>
    );
  };

  const borders = data?.borders || [];
  const groupedBorders = {
    legendary: borders.filter(b => b.rarity === 'legendary'),
    epic: borders.filter(b => b.rarity === 'epic'),
    rare: borders.filter(b => b.rarity === 'rare'),
    common: borders.filter(b => b.rarity === 'common'),
  };

  const hasChanges = selectedBorderId !== currentBorderId;
  const hasBorders = borders.length > 0;
  const currentBorder = borders.find(b => b.id === selectedBorderId);

  const storeBorders = [
    { id: 's1', name: 'Diamond Edge', price: 500, rarity: 'legendary' as const, locked: true },
    { id: 's2', name: 'Neon Pulse', price: 350, rarity: 'epic' as const, locked: true },
    { id: 's3', name: 'Fire Ring', price: 250, rarity: 'epic' as const, locked: true },
    { id: 's4', name: 'Crystal Frame', price: 200, rarity: 'rare' as const, locked: true },
    { id: 's5', name: 'Ice Border', price: 150, rarity: 'rare' as const, locked: true },
    { id: 's6', name: 'Shadow Edge', price: 100, rarity: 'common' as const, locked: true },
  ];

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <LinearGradient
          colors={['#0F1520', '#3730A3', '#0F1520']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        {starAnimations.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.star,
              {
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: anim.opacity,
                transform: [{ translateY: anim.translateY }],
              },
            ]}
          />
        ))}
        <View style={styles.backdrop} onTouchEnd={onClose} />
        
        <View style={styles.modalView}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile Borders</Text>
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
            >
              <X size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Loading borders...</Text>
            </View>
          ) : (
            <>
              {currentBorder && (
                <View style={styles.currentBorderSection}>
                  <Text style={styles.currentBorderLabel}>Currently Selected</Text>
                  <View style={styles.currentBorderDisplay}>
                    {renderBorderPreview(currentBorder)}
                    <Text style={styles.currentBorderName}>{currentBorder.name}</Text>
                    <View style={[styles.rarityBadgeLarge, { backgroundColor: getRarityColor(currentBorder.rarity) }]}>
                      <Text style={styles.rarityBadgeLargeText}>{currentBorder.rarity.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.tabsContainer}>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'owned' && styles.activeTab]}
                  onPress={() => setActiveTab('owned')}
                >
                  <Text style={[styles.tabText, activeTab === 'owned' && styles.activeTabText]}>Your Borders</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tab, activeTab === 'store' && styles.activeTab]}
                  onPress={() => setActiveTab('store')}
                >
                  <ShoppingBag size={16} color={activeTab === 'store' ? '#8B5CF6' : '#94A3B8'} />
                  <Text style={[styles.tabText, activeTab === 'store' && styles.activeTabText]}>Store</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {!isLoading && activeTab === 'owned' && !hasBorders ? (
            <View style={styles.emptyContainer}>
              <Lock size={48} color="#4B5563" />
              <Text style={styles.emptyTitle}>No Borders Unlocked</Text>
              <Text style={styles.emptyText}>
                No profile picture borders unlocked yet. Open lootboxes or visit the store!
              </Text>
            </View>
          ) : !isLoading && activeTab === 'owned' && hasBorders ? (
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
            >
              {selectedBorderId !== null && (
                <TouchableOpacity 
                  style={styles.removeBorderButton}
                  onPress={handleRemoveBorder}
                >
                  <Trash2 size={18} color="#EF4444" />
                  <Text style={styles.removeBorderText}>Remove Current Border</Text>
                </TouchableOpacity>
              )}

              {Object.entries(groupedBorders).map(([rarity, rarityBorders]) => {
                if (rarityBorders.length === 0) return null;
                
                return (
                  <View key={rarity} style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <View style={[styles.rarityDot, { backgroundColor: getRarityColor(rarity) }]} />
                      <Text style={[styles.sectionTitle, { color: getRarityColor(rarity) }]}>
                        {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                      </Text>
                      <Text style={styles.countBadge}>{rarityBorders.length}</Text>
                    </View>
                    
                    <View style={styles.bordersGrid}>
                      {rarityBorders.map((border) => (
                        <TouchableOpacity
                          key={border.id}
                          style={[
                            styles.borderOption,
                            selectedBorderId === border.id && styles.selectedBorder,
                            { borderColor: selectedBorderId === border.id ? getRarityColor(border.rarity) : 'transparent' }
                          ]}
                          onPress={() => setSelectedBorderId(border.id)}
                        >
                          {renderBorderPreview(border)}
                          <Text style={[
                            styles.borderName,
                            selectedBorderId === border.id && styles.selectedBorderName
                          ]}>
                            {border.name}
                          </Text>
                          <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(border.rarity) }]}>
                            <Text style={styles.rarityBadgeText}>
                              {border.rarity.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
              
              <View style={styles.bottomPadding} />
            </ScrollView>
          ) : !isLoading && activeTab === 'store' ? (
            <ScrollView 
              style={styles.scrollView}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.storeDescription}>
                Purchase exclusive borders to customize your profile
              </Text>

              <View style={styles.storeGrid}>
                {storeBorders.map((item) => (
                  <View key={item.id} style={styles.storeItem}>
                    <View style={[styles.storeItemOverlay, { borderColor: getRarityColor(item.rarity) }]}>
                      <Lock size={32} color="#64748B" />
                      <Text style={styles.storeItemName}>{item.name}</Text>
                      <View style={[styles.storeRarityBadge, { backgroundColor: getRarityColor(item.rarity) }]}>
                        <Text style={styles.storeRarityText}>{item.rarity.toUpperCase()}</Text>
                      </View>
                      <View style={styles.storePriceContainer}>
                        <Text style={styles.storePriceLabel}>Price</Text>
                        <Text style={styles.storePrice}>{item.price} coins</Text>
                      </View>
                      <TouchableOpacity style={styles.storeBuyButton} disabled>
                        <ShoppingBag size={16} color="#64748B" />
                        <Text style={styles.storeBuyText}>Coming Soon</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.bottomPadding} />
            </ScrollView>
          ) : null}

          {hasBorders && hasChanges && (
            <View style={styles.confirmButtonContainer}>
              <TouchableOpacity 
                style={[styles.confirmButton, updateBorderMutation.isPending && styles.confirmButtonDisabled]}
                onPress={handleConfirm}
                disabled={updateBorderMutation.isPending}
              >
                {updateBorderMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Check size={20} color="#FFF" />
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  star: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#8B5CF6',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalView: {
    height: '85%',
    backgroundColor: '#0F1520',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold' as const,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentBorderSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  currentBorderLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
    textAlign: 'center',
  },
  currentBorderDisplay: {
    alignItems: 'center',
    backgroundColor: '#161F2E',
    padding: 24,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#8B5CF6',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  currentBorderName: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  rarityBadgeLarge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
  },
  rarityBadgeLargeText: {
    fontSize: 12,
    fontWeight: 'bold' as const,
    color: '#FFF',
    letterSpacing: 1,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#334155',
    gap: 6,
  },
  activeTab: {
    borderColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#8B5CF6',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold' as const,
    marginTop: 8,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  removeBorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  removeBorderText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rarityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
  },
  countBadge: {
    marginLeft: 8,
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600' as const,
    overflow: 'hidden',
  },
  bordersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  borderOption: {
    width: (width - 64) / 3,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#161F2E',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedBorder: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  borderPreviewContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  borderImage: {
    width: 66,
    height: 66,
    position: 'absolute',
  },
  previewImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#334155',
  },
  borderName: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  selectedBorderName: {
    color: '#FFF',
    fontWeight: 'bold' as const,
  },
  rarityBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rarityBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold' as const,
  },
  bottomPadding: {
    height: 20,
  },
  confirmButtonContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F1520',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  storeDescription: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  storeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
  },
  storeItem: {
    width: (width - 64) / 2,
    aspectRatio: 0.75,
  },
  storeItemOverlay: {
    flex: 1,
    backgroundColor: '#161F2E',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    gap: 8,
  },
  storeItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFF',
    marginTop: 8,
    textAlign: 'center',
  },
  storeRarityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  storeRarityText: {
    fontSize: 9,
    fontWeight: 'bold' as const,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  storePriceContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  storePriceLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  storePrice: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#FFA500',
  },
  storeBuyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    marginTop: 8,
  },
  storeBuyText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#64748B',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold' as const,
  },
});
