import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Image, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { X, Gift, Star, Coins, Zap, Clock, Sparkles, Award, AlertCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useLootboxCollection } from '@/context/LootboxCollectionContext';
import { api } from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEventListener } from 'expo';

const lootboxVideoAsset = require('../assets/videos/lootbox-open.mp4');

type LootboxPhase = 'idle' | 'opening' | 'reveal';

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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function DailyLootboxModal({ visible, onClose, onClaimed }: DailyLootboxModalProps) {
  const { getAccessToken } = useAuth();
  const { addItems } = useLootboxCollection();

  const [phase, setPhase] = useState<LootboxPhase>('idle');
  const [claimedReward, setClaimedReward] = useState<LootboxReward | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [wasConsumed, setWasConsumed] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const [errorText, setErrorText] = useState('');
  const [openingWaiting, setOpeningWaiting] = useState(false);

  const apiDoneRef = useRef(false);
  const videoDoneRef = useRef(false);
  const onClaimedRef = useRef(onClaimed);
  onClaimedRef.current = onClaimed;

  const advanceToReveal = () => {
    setPhase('reveal');
    if (onClaimedRef.current) {
      onClaimedRef.current();
    }
  };

  const player = useVideoPlayer(lootboxVideoAsset, p => {
    p.loop = false;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
  });

  useEventListener(player, 'playToEnd', () => {
    videoDoneRef.current = true;
    if (apiDoneRef.current) {
      advanceToReveal();
    } else {
      setOpeningWaiting(true);
    }
  });

  const statusQuery = useQuery({
    queryKey: ['lootbox-status'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.lootbox.getStatus(token);
    },
    enabled: visible,
    refetchOnWindowFocus: false,
  });

  const openLootboxMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.lootbox.open(token);
    },
    onSuccess: async (data) => {
      setClaimedReward(data.reward);
      setIsDuplicate(data.isDuplicate);
      setWasConsumed(data.consumed);
      setRewardMessage(data.message);

      await addItems([{
        type: data.reward.assetType === 'xp_reward' ? 'xp' :
              data.reward.assetType === 'gf_tokens' ? 'coins' : 'asset',
        name: data.reward.name,
        amount: data.reward.rewardValue,
        rarity: data.reward.rarity,
        imageUrl: data.reward.imageUrl,
      }]);

      statusQuery.refetch();
      apiDoneRef.current = true;

      if (videoDoneRef.current) {
        advanceToReveal();
      }
    },
    onError: (error: Error) => {
      try {
        player.pause();
        player.currentTime = 0;
      } catch {
      }
      apiDoneRef.current = false;
      videoDoneRef.current = false;
      setPhase('idle');
      setOpeningWaiting(false);

      let msg = 'Failed to open lootbox. Please try again.';
      if (error?.message) {
        if (error.message.includes('<!DOCTYPE') || error.message.includes('Unexpected token')) {
          msg = 'Server error. Please check your connection and try again.';
        } else if (error.message !== 'Not authenticated') {
          msg = error.message;
        }
      }
      setErrorText(msg);
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

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      setClaimedReward(null);
      setIsDuplicate(false);
      setWasConsumed(false);
      setRewardMessage('');
      setErrorText('');
      setOpeningWaiting(false);
      apiDoneRef.current = false;
      videoDoneRef.current = false;
      try {
        player.pause();
        player.currentTime = 0;
      } catch {
      }
    }
  }, [visible, player]);

  const handleOpenLootbox = () => {
    if (!canOpen || phase !== 'idle') return;
    setErrorText('');
    apiDoneRef.current = false;
    videoDoneRef.current = false;
    setOpeningWaiting(false);
    setPhase('opening');
    try {
      player.currentTime = 0;
      player.play();
    } catch {
    }
    openLootboxMutation.mutate();
  };

  const handleClose = () => {
    setPhase('idle');
    setClaimedReward(null);
    setIsDuplicate(false);
    setWasConsumed(false);
    setRewardMessage('');
    setErrorText('');
    setOpeningWaiting(false);
    apiDoneRef.current = false;
    videoDoneRef.current = false;
    try {
      player.pause();
      player.currentTime = 0;
    } catch {
    }
    onClose();
  };

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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalContainer}>
        {phase === 'opening' ? (
          <View style={styles.openingContainer}>
            <LinearGradient
              colors={['#0A0F1A', '#1A0D2E', '#0A0F1A']}
              style={StyleSheet.absoluteFillObject}
            />
            {openingWaiting ? (
              <View style={styles.openingWaitingInner}>
                <ActivityIndicator size="large" color="#A855F7" />
                <Text style={styles.openingText}>Preparing your reward...</Text>
              </View>
            ) : (
              <>
                <VideoView
                  player={player}
                  style={styles.openingVideo}
                  nativeControls={false}
                  contentFit="contain"
                />
                <Text style={styles.openingText}>Opening Lootbox...</Text>
              </>
            )}
          </View>
        ) : (
          <>
            <LinearGradient
              colors={['#131F2A', '#7C3AED', '#131F2A']}
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
              ) : phase === 'idle' ? (
                <>
                  {errorText.length > 0 ? (
                    <View style={styles.errorBanner}>
                      <AlertCircle size={16} color="#EF4444" />
                      <Text style={styles.errorText}>{errorText}</Text>
                    </View>
                  ) : null}

                  {timeLeft.length > 0 && !canOpen ? (
                    <View style={styles.timerBanner}>
                      <Clock size={16} color="#F59E0B" />
                      <Text style={styles.timerText}>Next lootbox in: </Text>
                      <Text style={styles.timerValue}>{timeLeft}</Text>
                    </View>
                  ) : null}

                  <ScrollView
                    style={styles.claimSection}
                    contentContainerStyle={styles.claimSectionContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.videoContainer}>
                      <VideoView
                        player={player}
                        style={styles.idleVideo}
                        nativeControls={false}
                        contentFit="contain"
                      />
                    </View>

                    <Text style={styles.title}>
                      {canOpen ? 'Your Daily Lootbox Awaits!' : 'Come Back Later'}
                    </Text>
                    <Text style={styles.description}>
                      {canOpen
                        ? 'Open your daily reward and earn XP, GF Tokens, and exclusive items!'
                        : timeLeft.length > 0
                          ? `Next lootbox available in ${timeLeft}`
                          : 'Check back tomorrow for your next reward!'}
                    </Text>

                    <TouchableOpacity
                      style={[styles.claimButton, !canOpen && styles.claimButtonDisabled]}
                      onPress={handleOpenLootbox}
                      disabled={!canOpen || phase !== 'idle'}
                    >
                      <LinearGradient
                        colors={canOpen ? ['#A855F7', '#7C3AED'] : ['#334155', '#1E293B']}
                        style={styles.claimButtonGradient}
                      >
                        <Text style={[styles.claimButtonText, !canOpen && styles.claimButtonTextDisabled]}>
                          {canOpen ? 'Claim Lootbox' : 'Not Available'}
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
                </>
              ) : phase === 'reveal' ? (
                claimedReward ? (
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
                ) : (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#A855F7" />
                    <Text style={styles.loadingText}>Preparing your reward...</Text>
                  </View>
                )
              ) : null}
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  openingContainer: {
    flex: 1,
    backgroundColor: '#0A0F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openingWaitingInner: {
    alignItems: 'center',
    gap: 24,
  },
  openingVideo: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.75,
  },
  openingText: {
    position: 'absolute',
    bottom: 60,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A855F7',
    letterSpacing: 2,
  },
  content: {
    height: '90%',
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2D1A1A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500' as const,
  },
  timerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
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
    paddingTop: 16,
    paddingBottom: 40,
  },
  videoContainer: {
    width: '100%',
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0A0F1A',
  },
  idleVideo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#FFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
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
    color: '#131F2A',
  },
});
