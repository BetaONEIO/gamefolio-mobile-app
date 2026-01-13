import { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Image, ScrollView, ActivityIndicator } from 'react-native';
import { X, Gift, Star, Coins, Zap, Clock, Sparkles, Award } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useLootboxCollection } from '@/context/LootboxCollectionContext';
import { api } from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import LootboxSpinAnimation from './LootboxSpinAnimation';

interface DailyLootboxModalProps {
  visible: boolean;
  onClose: () => void;
  onClaimed?: () => void;
}

interface LootboxReward {
  id: number;
  name: string;
  imageUrl: string | null;
  assetType: 'xp_reward' | 'gf_tokens' | 'avatar_border';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  rewardValue: number;
}

interface SpinReward {
  id?: number;
  type: 'xp' | 'coins' | 'item' | 'asset';
  amount: number;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  imageUrl?: string | null;
}

const RARITY_COLORS = {
  common: '#94A3B8',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
};

const RARITY_GRADIENTS: Record<string, [string, string]> = {
  common: ['#64748B', '#94A3B8'],
  rare: ['#2563EB', '#3B82F6'],
  epic: ['#7C3AED', '#A855F7'],
  legendary: ['#D97706', '#F59E0B'],
};

export default function DailyLootboxModal({ visible, onClose, onClaimed }: DailyLootboxModalProps) {
  const { getAccessToken } = useAuth();
  const { addItems } = useLootboxCollection();
  
  const [isClaimed, setIsClaimed] = useState(false);
  const [claimedReward, setClaimedReward] = useState<LootboxReward | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [wasConsumed, setWasConsumed] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');

  const boxScale = useRef(new Animated.Value(1)).current;
  const boxRotate = useRef(new Animated.Value(0)).current;
  const [isOpening, setIsOpening] = useState(false);
  const [showSpinAnimation, setShowSpinAnimation] = useState(false);
  const [wonReward, setWonReward] = useState<SpinReward | null>(null);
  const [timeLeft, setTimeLeft] = useState('');

  const statusQuery = useQuery({
    queryKey: ['lootbox-status'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      console.log('[DailyLootbox] Fetching lootbox status...');
      return api.lootbox.getStatus(token);
    },
    enabled: visible,
    refetchOnWindowFocus: false,
  });

  const availableRewardsQuery = useQuery({
    queryKey: ['lootbox-available-rewards'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      console.log('[DailyLootbox] Fetching available rewards...');
      return api.lootbox.getAvailableRewards(token);
    },
    enabled: visible,
    refetchOnWindowFocus: false,
  });

  const openLootboxMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      console.log('[DailyLootbox] Opening lootbox...');
      return api.lootbox.open(token);
    },
    onSuccess: async (data) => {
      console.log('[DailyLootbox] Lootbox opened successfully:', data);
      setClaimedReward(data.reward);
      setIsDuplicate(data.isDuplicate);
      setWasConsumed(data.consumed);
      setRewardMessage(data.message);

      const spinReward: SpinReward = {
        id: data.reward.id,
        type: data.reward.assetType === 'xp_reward' ? 'xp' : 
              data.reward.assetType === 'gf_tokens' ? 'coins' : 'asset',
        amount: data.reward.rewardValue,
        name: data.reward.name,
        rarity: data.reward.rarity,
        imageUrl: data.reward.imageUrl,
      };
      setWonReward(spinReward);

      await addItems([{
        type: spinReward.type,
        name: spinReward.name,
        amount: spinReward.amount,
        rarity: spinReward.rarity,
        imageUrl: spinReward.imageUrl,
      }]);

      statusQuery.refetch();

      setShowSpinAnimation(true);
      statusQuery.refetch();
    },
    onError: (error: Error) => {
      console.error('[DailyLootbox] Failed to open:', error);
      let errorMessage = 'Unknown error';
      if (error?.message) {
        if (error.message.includes('<!DOCTYPE') || error.message.includes('Unexpected token')) {
          errorMessage = 'Server connection error. Please try again later.';
        } else {
          errorMessage = error.message;
        }
      }
      alert(`Failed to open lootbox: ${errorMessage}`);
      setIsOpening(false);
      boxScale.setValue(1);
      boxRotate.setValue(0);
    },
  });

  const canOpen = statusQuery.data?.canOpen ?? false;
  const nextOpenAt = useMemo(() => {
    return statusQuery.data?.nextOpenAt ? new Date(statusQuery.data.nextOpenAt) : null;
  }, [statusQuery.data?.nextOpenAt]);
  
  const { refetch: refetchStatus } = statusQuery;

  useEffect(() => {
    if (!nextOpenAt || canOpen) {
      setTimeLeft('');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const diff = nextOpenAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('Available now!');
        refetchStatus();
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [nextOpenAt, canOpen, refetchStatus]);

  const handleOpenLootbox = async () => {
    if (!canOpen || isOpening) return;
    
    setIsOpening(true);

    Animated.sequence([
      Animated.timing(boxScale, {
        toValue: 1.1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(boxScale, {
          toValue: 1.3,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(boxRotate, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      openLootboxMutation.mutate();
    });
  };

  const handleClose = () => {
    setIsClaimed(false);
    setClaimedReward(null);
    setIsDuplicate(false);
    setWasConsumed(false);
    setRewardMessage('');
    setShowSpinAnimation(false);
    setWonReward(null);
    setIsOpening(false);
    boxScale.setValue(1);
    boxRotate.setValue(0);
    onClose();
  };

  const handleSpinComplete = () => {
    setShowSpinAnimation(false);
    setIsClaimed(true);
    setIsOpening(false);
    boxScale.setValue(1);
    boxRotate.setValue(0);
    if (onClaimed) {
      onClaimed();
    }
  };

  const allPossibleRewards = useMemo<SpinReward[]>(() => {
    if (availableRewardsQuery.data && availableRewardsQuery.data.length > 0) {
      return availableRewardsQuery.data.map(r => ({
        id: r.id,
        type: r.assetType === 'xp_reward' ? 'xp' as const : 
              r.assetType === 'gf_tokens' ? 'coins' as const : 'asset' as const,
        amount: r.rewardValue,
        name: r.name,
        rarity: r.rarity,
        imageUrl: r.imageUrl,
      }));
    }
    return [
      { type: 'xp', amount: 100, name: 'XP Boost', rarity: 'common' },
      { type: 'xp', amount: 200, name: 'XP Surge', rarity: 'rare' },
      { type: 'xp', amount: 350, name: 'XP Blast', rarity: 'epic' },
      { type: 'xp', amount: 500, name: 'XP Mega', rarity: 'legendary' },
      { type: 'coins', amount: 50, name: 'GF Token Pouch', rarity: 'common' },
      { type: 'coins', amount: 100, name: 'GF Token Sack', rarity: 'rare' },
      { type: 'coins', amount: 150, name: 'GF Token Chest', rarity: 'epic' },
      { type: 'coins', amount: 200, name: 'GF Token Vault', rarity: 'legendary' },
    ];
  }, [availableRewardsQuery.data]);

  const rotation = boxRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const getRewardIcon = (assetType: string, rarity: string) => {
    const color = RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] || RARITY_COLORS.common;
    switch (assetType) {
      case 'xp_reward':
        return <Zap size={48} color={color} />;
      case 'gf_tokens':
        return <Coins size={48} color={color} />;
      case 'avatar_border':
        return <Award size={48} color={color} />;
      default:
        return <Star size={48} color={color} />;
    }
  };

  const getRewardLabel = (assetType: string, value: number) => {
    switch (assetType) {
      case 'xp_reward':
        return `+${value} XP`;
      case 'gf_tokens':
        return `+${value} GF Tokens`;
      case 'avatar_border':
        return 'Border Unlocked';
      default:
        return `+${value}`;
    }
  };

  if (showSpinAnimation && wonReward) {
    return (
      <Modal
        visible={visible}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <LootboxSpinAnimation
          rewards={allPossibleRewards}
          wonReward={wonReward}
          onAnimationComplete={handleSpinComplete}
        />
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#0F1520', '#7C3AED', '#0F1520']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconContainer}>
                <Gift size={24} color="#A855F7" fill="#A855F7" />
              </View>
              <Text style={styles.headerTitle}>Daily Lootbox</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {statusQuery.isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#A855F7" />
              <Text style={styles.loadingText}>Loading lootbox status...</Text>
            </View>
          ) : timeLeft && !canOpen ? (
            <View style={styles.timerBanner}>
              <Clock size={16} color="#F59E0B" />
              <Text style={styles.timerText}>Next lootbox in: </Text>
              <Text style={styles.timerValue}>{timeLeft}</Text>
            </View>
          ) : null}

          {!isClaimed ? (
            <ScrollView 
              style={styles.claimSection}
              contentContainerStyle={styles.claimSectionContent}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View 
                style={[
                  styles.lootboxContainer,
                  {
                    transform: [{ scale: boxScale }, { rotate: rotation }],
                  },
                ]}
              >
                <Image
                  source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/5ujigkcshjiyky073gh67' }}
                  style={styles.lootbox}
                  resizeMode="contain"
                />
              </Animated.View>

              <Text style={styles.title}>
                {canOpen ? 'Your Daily Lootbox Awaits!' : 'Come Back Later'}
              </Text>
              <Text style={styles.description}>
                {canOpen 
                  ? 'Open your daily reward and earn XP, GF Tokens, and exclusive items!' 
                  : timeLeft 
                    ? `Next lootbox available in ${timeLeft}`
                    : 'Check back tomorrow for your next reward!'
                }
              </Text>

              <TouchableOpacity 
                style={[styles.claimButton, !canOpen && styles.claimButtonDisabled]}
                onPress={handleOpenLootbox}
                disabled={!canOpen || isOpening}
              >
                <LinearGradient
                  colors={canOpen ? ['#A855F7', '#7C3AED'] : ['#334155', '#1E293B']}
                  style={styles.claimButtonGradient}
                >
                  <Text style={[styles.claimButtonText, !canOpen && styles.claimButtonTextDisabled]}>
                    {isOpening ? 'Opening...' : canOpen ? 'Open Lootbox' : 'Not Available'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>{"What's Inside?"}</Text>
                <View style={styles.infoItems}>
                  <View style={styles.infoItem}>
                    <Zap size={16} color="#F59E0B" />
                    <Text style={styles.infoItemText}>XP Rewards</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Coins size={16} color="#EAB308" />
                    <Text style={styles.infoItemText}>GF Tokens</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Award size={16} color="#A855F7" />
                    <Text style={styles.infoItemText}>Avatar Borders</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          ) : claimedReward ? (
            <ScrollView 
              style={styles.rewardsSection}
              contentContainerStyle={styles.rewardsSectionContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.rewardsContainer}>
                <View style={styles.celebrationHeader}>
                  <Sparkles size={32} color="#F59E0B" />
                  <Text style={styles.congratsText}>
                    {isDuplicate ? 'Already Owned!' : wasConsumed ? 'Reward Claimed!' : 'New Unlock!'}
                  </Text>
                  <Sparkles size={32} color="#F59E0B" />
                </View>
                
                <Text style={styles.rewardsTitle}>{rewardMessage}</Text>
                
                <View style={[
                  styles.rewardShowcase,
                  { borderColor: RARITY_COLORS[claimedReward.rarity] }
                ]}>
                  <LinearGradient
                    colors={RARITY_GRADIENTS[claimedReward.rarity] || RARITY_GRADIENTS.common}
                    style={styles.rewardShowcaseGradient}
                  >
                    <View style={styles.rewardIconContainer}>
                      {claimedReward.imageUrl ? (
                        <Image 
                          source={{ uri: claimedReward.imageUrl }} 
                          style={styles.rewardImageLarge} 
                        />
                      ) : (
                        getRewardIcon(claimedReward.assetType, claimedReward.rarity)
                      )}
                    </View>
                    
                    <Text style={styles.rewardShowcaseName}>{claimedReward.name}</Text>
                    
                    <View style={styles.rewardValueContainer}>
                      <Text style={styles.rewardShowcaseValue}>
                        {getRewardLabel(claimedReward.assetType, claimedReward.rewardValue)}
                      </Text>
                    </View>
                    
                    <View style={[
                      styles.rarityBadge,
                      { backgroundColor: `${RARITY_COLORS[claimedReward.rarity]}30` }
                    ]}>
                      <Text style={[
                        styles.rarityBadgeText,
                        { color: RARITY_COLORS[claimedReward.rarity] }
                      ]}>
                        {claimedReward.rarity.toUpperCase()}
                      </Text>
                    </View>

                    {isDuplicate && (
                      <View style={styles.duplicateBadge}>
                        <Text style={styles.duplicateBadgeText}>DUPLICATE</Text>
                      </View>
                    )}
                  </LinearGradient>
                </View>

                <TouchableOpacity 
                  style={styles.doneButton}
                  onPress={handleClose}
                >
                  <LinearGradient
                    colors={['#4ADE80', '#22C55E']}
                    style={styles.doneButtonGradient}
                  >
                    <Text style={styles.doneButtonText}>Awesome!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    height: '90%',
    backgroundColor: '#0F1520',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {},
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  closeButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F59E0B',
    gap: 8,
  },
  timerText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  timerValue: {
    fontSize: 16,
    color: '#F59E0B',
    fontWeight: 'bold' as const,
  },
  claimSection: {
    flex: 1,
  },
  claimSectionContent: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  lootboxContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
  },
  lootbox: {
    width: 320,
    height: 320,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  claimButton: {
    width: '100%',
    marginBottom: 32,
    borderRadius: 12,
    overflow: 'hidden',
  },
  claimButtonDisabled: {
    opacity: 0.5,
  },
  claimButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  claimButtonText: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  claimButtonTextDisabled: {
    color: '#64748B',
  },
  infoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#FFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  infoItems: {
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoItemText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  rewardsSection: {
    flex: 1,
  },
  rewardsSectionContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  rewardsContainer: {
    alignItems: 'center',
  },
  celebrationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  congratsText: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: '#FFF',
    textAlign: 'center',
  },
  rewardsTitle: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  rewardShowcase: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 3,
    overflow: 'hidden',
    marginBottom: 32,
  },
  rewardShowcaseGradient: {
    padding: 32,
    alignItems: 'center',
  },
  rewardIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  rewardImageLarge: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },
  rewardShowcaseName: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  rewardValueContainer: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  rewardShowcaseValue: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#4ADE80',
  },
  rarityBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  rarityBadgeText: {
    fontSize: 12,
    fontWeight: 'bold' as const,
    letterSpacing: 2,
  },
  duplicateBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#EF4444',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  duplicateBadgeText: {
    fontSize: 10,
    fontWeight: 'bold' as const,
    color: '#FFF',
    letterSpacing: 1,
  },
  doneButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  doneButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#0F1520',
  },
});
