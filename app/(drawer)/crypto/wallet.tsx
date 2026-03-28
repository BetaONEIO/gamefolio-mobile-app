import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Plus,
  TrendingUp,
  ChevronRight,
  ArrowLeft,
  Clock,
  Lock,
  Unlock,
  Gift,
  CheckCircle,
  AlertCircle,
  Sparkles,
  X,
  Info,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Env } from '@/constants/Env';

type Screen = 'home' | 'activity' | 'staking';
type ModalType = 'stake' | 'unstake' | 'claim' | null;
type TxState = 'idle' | 'processing' | 'success' | 'error';

interface StakingPosition {
  hasWallet: boolean;
  walletAddress: string | null;
  inAppBalance: number;
  onChainStaked: string;
  onChainEarned: string;
  dbStaked: number;
  totalEarned: number;
  stakedAt: string | null;
  lastClaimAt: string | null;
}

interface StakingStats {
  totalStaked: string;
  rewardRate: string;
  apy?: number;
}

interface StakingHistoryItem {
  id: number;
  type: 'stake' | 'unstake' | 'claim';
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

interface ActivityItem {
  id: number;
  type: string;
  amount: number;
  description?: string;
  createdAt: string;
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

export default function WalletPage() {
  const router = useRouter();
  const { user, getAccessToken, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const [screen, setScreen] = useState<Screen>('home');
  const [modalType, setModalType] = useState<ModalType>(null);
  const [amount, setAmount] = useState('');
  const [txState, setTxState] = useState<TxState>('idle');
  const [txError, setTxError] = useState('');
  const [txHash, setTxHash] = useState('');

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
  });
  const balance = gfBalanceData?.balance ?? user?.gfTokenBalance ?? 0;

  const { data: position, isLoading: positionLoading, refetch: refetchPosition } = useQuery<StakingPosition>({
    queryKey: ['/api/staking/my-position', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/my-position`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch position');
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: stakingStats } = useQuery<StakingStats>({
    queryKey: ['/api/staking/stats'],
    queryFn: async () => {
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/stats`);
      if (!res.ok) return { totalStaked: '0', rewardRate: '0.001' };
      return res.json();
    },
  });

  const { data: stakingHistory = [] } = useQuery<StakingHistoryItem[]>({
    queryKey: ['/api/staking/history', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id && screen === 'staking',
  });

  const { data: activityHistory = [], isLoading: activityLoading } = useQuery<ActivityItem[]>({
    queryKey: ['/api/me/activity', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/me/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id && screen === 'activity',
  });

  const { data: ownedNFTs = [] } = useQuery<OwnedNFT[]>({
    queryKey: ['/api/nfts/owned', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/nfts/owned`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.nfts || []).filter((n: OwnedNFT) => !n.sold);
    },
    enabled: !!user?.id,
  });

  const stakedAmount = position ? parseFloat(position.onChainStaked) || position.dbStaked : 0;
  const earnedAmount = position ? parseFloat(position.onChainEarned) : 0;
  const rewardRateStr = stakingStats?.rewardRate || '0.001';
  const dailyRate = parseFloat(rewardRateStr) * 100;
  const apy = stakingStats?.apy || dailyRate * 365;

  const openModal = (type: ModalType) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setModalType(type);
    setAmount('');
    setTxState('idle');
    setTxError('');
    setTxHash('');
  };

  const closeModal = () => {
    setModalType(null);
    setTxState('idle');
    setTxError('');
    setTxHash('');
    setAmount('');
  };

  const handleStake = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setTxError('Please enter a valid amount.'); return; }
    if (amt > balance) { setTxError(`Insufficient balance. You have ${balance.toFixed(2)} GF.`); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTxState('processing'); setTxError('');
    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) { setTxState('error'); setTxError(data.error || 'Staking failed.'); return; }
      setTxHash(data.txHash || '');
      if (data.balance !== undefined) updateUser({ gfTokenBalance: data.balance });
      refetchPosition();
      queryClient.invalidateQueries({ queryKey: ['/api/staking/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/gf-balance', user?.id] });
      setTxState('success');
    } catch (err: any) { setTxState('error'); setTxError(err.message || 'Network error.'); }
  };

  const handleUnstake = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setTxError('Please enter a valid amount.'); return; }
    if (amt > stakedAmount) { setTxError(`You only have ${stakedAmount.toFixed(2)} GF staked.`); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTxState('processing'); setTxError('');
    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/unstake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) { setTxState('error'); setTxError(data.error || 'Unstaking failed.'); return; }
      setTxHash(data.txHash || '');
      if (data.balance !== undefined) updateUser({ gfTokenBalance: data.balance });
      refetchPosition();
      queryClient.invalidateQueries({ queryKey: ['/api/staking/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/gf-balance', user?.id] });
      setTxState('success');
    } catch (err: any) { setTxState('error'); setTxError(err.message || 'Network error.'); }
  };

  const handleClaim = async () => {
    if (earnedAmount <= 0) { setTxError('No rewards to claim yet.'); return; }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTxState('processing'); setTxError('');
    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) { setTxState('error'); setTxError(data.error || 'Claim failed.'); return; }
      setTxHash(data.txHash || '');
      if (data.balance !== undefined) updateUser({ gfTokenBalance: data.balance });
      refetchPosition();
      queryClient.invalidateQueries({ queryKey: ['/api/staking/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/gf-balance', user?.id] });
      setTxState('success');
    } catch (err: any) { setTxState('error'); setTxError(err.message || 'Network error.'); }
  };

  const handleAction = () => {
    if (modalType === 'stake') handleStake();
    else if (modalType === 'unstake') handleUnstake();
    else if (modalType === 'claim') handleClaim();
  };

  const getModalTitle = () => {
    if (modalType === 'stake') return 'Stake GF Tokens';
    if (modalType === 'unstake') return 'Unstake GF Tokens';
    if (modalType === 'claim') return 'Claim Rewards';
    return '';
  };

  const getActionLabel = () => {
    if (modalType === 'stake') return 'Confirm Stake';
    if (modalType === 'unstake') return 'Confirm Unstake';
    if (modalType === 'claim') return 'Claim Rewards';
    return '';
  };

  const getActivityConfig = (type: string) => {
    const configs: Record<string, { label: string; color: string; icon: any }> = {
      stake: { label: 'Staked', color: '#4ADE80', icon: Lock },
      unstake: { label: 'Unstaked', color: '#EF4444', icon: Unlock },
      claim: { label: 'Claimed', color: '#F59E0B', icon: Gift },
      purchase: { label: 'Purchase', color: '#8B5CF6', icon: Sparkles },
      buy: { label: 'Bought GF', color: '#3B82F6', icon: Plus },
      earn: { label: 'Earned', color: '#4ADE80', icon: TrendingUp },
    };
    return configs[type] || { label: type, color: '#94A3B8', icon: Clock };
  };

  if (screen === 'activity') {
    return (
      <View style={styles.container}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setScreen('home')} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Activity History</Text>
          <View style={styles.backBtn} />
        </View>

        {activityLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4ADE80" />
            <Text style={styles.loadingText}>Loading activity...</Text>
          </View>
        ) : activityHistory.length === 0 ? (
          <View style={styles.centered}>
            <Clock size={48} color="#334155" />
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyText}>Your GF token transactions will appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={activityHistory}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const config = getActivityConfig(item.type);
              const IconComp = config.icon;
              const isPositive = item.type !== 'unstake' && item.type !== 'purchase';
              return (
                <View style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: config.color + '20' }]}>
                    <IconComp size={20} color={config.color} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityLabel}>{config.label}</Text>
                    <Text style={styles.activityDate}>
                      {new Date(item.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </Text>
                    {item.description ? (
                      <Text style={styles.activityDesc} numberOfLines={1}>{item.description}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.activityAmount, { color: isPositive ? '#4ADE80' : '#EF4444' }]}>
                    {isPositive ? '+' : '-'}{Math.abs(item.amount).toFixed(2)} GF
                  </Text>
                </View>
              );
            }}
          />
        )}
      </View>
    );
  }

  if (screen === 'staking') {
    return (
      <View style={styles.container}>
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={() => setScreen('home')} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.subHeaderTitle}>Staking Hub</Text>
          <View style={styles.backBtn} />
        </View>

        {positionLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color="#4ADE80" />
            <Text style={styles.loadingText}>Loading staking data...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.stakingScroll}
            contentContainerStyle={styles.stakingContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.stakingStatsRow}>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                  <TrendingUp size={20} color="#4ADE80" />
                </View>
                <Text style={styles.statValue}>{apy.toFixed(1)}%</Text>
                <Text style={styles.statLabel}>Est. APY</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
                  <Lock size={20} color="#8B5CF6" />
                </View>
                <Text style={styles.statValue}>{stakedAmount.toFixed(2)}</Text>
                <Text style={styles.statLabel}>GF Staked</Text>
              </View>
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Gift size={20} color="#F59E0B" />
                </View>
                <Text style={styles.statValue}>{earnedAmount.toFixed(4)}</Text>
                <Text style={styles.statLabel}>Earned GF</Text>
              </View>
            </View>

            {position?.hasWallet === false ? (
              <View style={styles.noWalletCard}>
                <Info size={24} color="#F59E0B" />
                <Text style={styles.noWalletTitle}>Wallet Required</Text>
                <Text style={styles.noWalletText}>
                  Staking requires an on-chain wallet. Contact support to enable staking.
                </Text>
              </View>
            ) : (
              <View style={styles.positionCard}>
                <View style={styles.positionHeader}>
                  <Text style={styles.positionTitle}>Your Position</Text>
                  <View style={[styles.positionStatus, stakedAmount > 0 && styles.positionStatusActive]}>
                    <Text style={[styles.positionStatusText, stakedAmount > 0 && styles.positionStatusTextActive]}>
                      {stakedAmount > 0 ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <View style={styles.positionRow}>
                  <Text style={styles.positionLabel}>Staked Amount</Text>
                  <View style={styles.positionValueRow}>
                    <Sparkles size={14} color="#4ADE80" />
                    <Text style={styles.positionValue}>{stakedAmount.toFixed(2)} GF</Text>
                  </View>
                </View>
                <View style={styles.positionRow}>
                  <Text style={styles.positionLabel}>Pending Rewards</Text>
                  <View style={styles.positionValueRow}>
                    <Gift size={14} color="#F59E0B" />
                    <Text style={[styles.positionValue, { color: '#F59E0B' }]}>{earnedAmount.toFixed(4)} GF</Text>
                  </View>
                </View>
                <View style={styles.positionRow}>
                  <Text style={styles.positionLabel}>Available Balance</Text>
                  <Text style={styles.positionValue}>{balance.toFixed(2)} GF</Text>
                </View>
                {position?.stakedAt ? (
                  <View style={styles.positionRow}>
                    <Text style={styles.positionLabel}>Last Staked</Text>
                    <Text style={styles.positionValueSm}>{new Date(position.stakedAt).toLocaleDateString()}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {position?.hasWallet !== false ? (
              <View style={styles.stakingActionsRow}>
                <TouchableOpacity
                  style={[styles.stakingActionBtn, styles.stakeButton]}
                  onPress={() => openModal('stake')}
                  activeOpacity={0.8}
                >
                  <Lock size={18} color="#020617" />
                  <Text style={styles.stakingActionText}>Stake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stakingActionBtn, styles.unstakeButton, stakedAmount <= 0 && styles.actionDisabled]}
                  onPress={() => { if (stakedAmount > 0) openModal('unstake'); }}
                  disabled={stakedAmount <= 0}
                  activeOpacity={0.8}
                >
                  <Unlock size={18} color={stakedAmount > 0 ? '#FFFFFF' : '#64748B'} />
                  <Text style={[styles.stakingActionText, stakedAmount <= 0 && styles.actionTextDisabled]}>Unstake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stakingActionBtn, styles.claimButton, earnedAmount <= 0 && styles.actionDisabled]}
                  onPress={() => { if (earnedAmount > 0) openModal('claim'); }}
                  disabled={earnedAmount <= 0}
                  activeOpacity={0.8}
                >
                  <Gift size={18} color={earnedAmount > 0 ? '#F59E0B' : '#64748B'} />
                  <Text style={[styles.stakingActionText, styles.claimText, earnedAmount <= 0 && styles.actionTextDisabled]}>Claim</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.infoCard}>
              <View style={styles.infoHeader}>
                <Info size={16} color="#94A3B8" />
                <Text style={styles.infoTitle}>How Staking Works</Text>
              </View>
              {[
                'Stake GF tokens to earn passive rewards',
                'Rewards accrue based on time staked and pool size',
                `Current daily rate: ~${dailyRate.toFixed(3)}% per day`,
                'Unstake anytime — no lock-up period',
              ].map((item, i) => (
                <View key={i} style={styles.infoItem}>
                  <View style={styles.infoBullet} />
                  <Text style={styles.infoText}>{item}</Text>
                </View>
              ))}
            </View>

            {stakingHistory.length > 0 ? (
              <View style={styles.historySection}>
                <Text style={styles.historySectionTitle}>Recent Activity</Text>
                {stakingHistory.slice(0, 5).map((item) => {
                  const typeConfig: Record<string, { label: string; color: string; Icon: any }> = {
                    stake: { label: 'Staked', color: '#4ADE80', Icon: Lock },
                    unstake: { label: 'Unstaked', color: '#EF4444', Icon: Unlock },
                    claim: { label: 'Claimed', color: '#F59E0B', Icon: Gift },
                  };
                  const config = typeConfig[item.type] || typeConfig.stake;
                  const ItemIcon = config.Icon;
                  return (
                    <View key={item.id} style={styles.historyItem}>
                      <View style={[styles.historyIcon, { backgroundColor: config.color + '20' }]}>
                        <ItemIcon size={16} color={config.color} />
                      </View>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyLabel}>{config.label}</Text>
                        <Text style={styles.historyDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                      </View>
                      <Text style={[styles.historyAmount, { color: config.color }]}>
                        {item.type === 'unstake' ? '-' : '+'}{item.amount.toFixed(2)} GF
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </ScrollView>
        )}

        <Modal
          visible={modalType !== null}
          transparent
          animationType="slide"
          onRequestClose={closeModal}
        >
          <KeyboardAvoidingView
            style={styles.modalKAV}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                {txState === 'success' ? (
                  <View style={styles.resultContainer}>
                    <View style={[styles.resultIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                      <CheckCircle size={40} color="#4ADE80" />
                    </View>
                    <Text style={styles.resultTitle}>
                      {modalType === 'stake' ? 'Staked!' : modalType === 'unstake' ? 'Unstaked!' : 'Claimed!'}
                    </Text>
                    {txHash ? (
                      <Text style={styles.txHashText} numberOfLines={1}>TX: {txHash.substring(0, 20)}...</Text>
                    ) : null}
                    <TouchableOpacity style={styles.doneButton} onPress={closeModal} activeOpacity={0.8}>
                      <Text style={styles.doneButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                ) : txState === 'processing' ? (
                  <View style={styles.resultContainer}>
                    <ActivityIndicator size="large" color="#4ADE80" />
                    <Text style={styles.resultTitle}>Processing...</Text>
                    <Text style={styles.resultSubtext}>This can take 15-60 seconds. Please wait.</Text>
                  </View>
                ) : txState === 'error' ? (
                  <View style={styles.resultContainer}>
                    <View style={[styles.resultIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                      <AlertCircle size={40} color="#EF4444" />
                    </View>
                    <Text style={styles.resultTitle}>Transaction Failed</Text>
                    <Text style={styles.resultSubtext}>{txError}</Text>
                    <TouchableOpacity style={styles.doneButton} onPress={() => setTxState('idle')} activeOpacity={0.8}>
                      <Text style={styles.doneButtonText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelLink} onPress={closeModal} activeOpacity={0.7}>
                      <Text style={styles.cancelLinkText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>{getModalTitle()}</Text>
                      <TouchableOpacity onPress={closeModal} activeOpacity={0.7} style={styles.closeBtn}>
                        <X size={20} color="#94A3B8" />
                      </TouchableOpacity>
                    </View>
                    {modalType === 'claim' ? (
                      <View style={styles.claimSummary}>
                        <View style={styles.claimAmountRow}>
                          <Gift size={32} color="#F59E0B" />
                          <View>
                            <Text style={styles.claimAmountLabel}>Available to Claim</Text>
                            <Text style={styles.claimAmountValue}>{earnedAmount.toFixed(6)} GF</Text>
                          </View>
                        </View>
                        {txError ? <Text style={styles.inputError}>{txError}</Text> : null}
                      </View>
                    ) : (
                      <View style={styles.inputSection}>
                        <View style={styles.inputRow}>
                          <Text style={styles.availableLabel}>
                            Available: {modalType === 'stake' ? `${balance.toFixed(2)} GF` : `${stakedAmount.toFixed(2)} GF staked`}
                          </Text>
                          <TouchableOpacity
                            onPress={() => setAmount(String(modalType === 'stake' ? balance : stakedAmount))}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.maxButton}>Max</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.inputWrap}>
                          <TextInput
                            style={styles.amountInput}
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="0.00"
                            placeholderTextColor="#475569"
                            keyboardType="decimal-pad"
                            autoFocus
                          />
                          <Text style={styles.inputSuffix}>GF</Text>
                        </View>
                        {txError ? <Text style={styles.inputError}>{txError}</Text> : null}
                      </View>
                    )}
                    <TouchableOpacity style={styles.confirmButton} onPress={handleAction} activeOpacity={0.8}>
                      <Text style={styles.confirmButtonText}>{getActionLabel()}</Text>
                      <ChevronRight size={18} color="#020617" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.balanceCard}>
        <LinearGradient
          colors={['rgba(139, 92, 246, 0.15)', 'rgba(59, 130, 246, 0.08)']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={styles.balanceAmount}>
          {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
        <Text style={styles.tokenName}>Gamefolio Token</Text>
        <Text style={styles.usdValue}>≈ £{(balance * 0.01).toFixed(2)} GBP</Text>

        <View style={styles.stakingSummaryRow}>
          <View style={styles.stakingSummaryItem}>
            <Text style={styles.stakingSummaryValue}>{stakedAmount.toFixed(2)}</Text>
            <Text style={styles.stakingSummaryLabel}>Staked</Text>
          </View>
          <View style={styles.stakingSummaryDivider} />
          <View style={styles.stakingSummaryItem}>
            <Text style={styles.stakingSummaryValue}>{earnedAmount.toFixed(4)}</Text>
            <Text style={styles.stakingSummaryLabel}>Rewards</Text>
          </View>
          <View style={styles.stakingSummaryDivider} />
          <View style={styles.stakingSummaryItem}>
            <Text style={styles.stakingSummaryValue}>{ownedNFTs.length}</Text>
            <Text style={styles.stakingSummaryLabel}>NFTs</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/crypto/buy');
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, styles.buyIconWrap]}>
            <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <Text style={styles.actionButtonText}>Buy GFT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setScreen('staking');
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, styles.stakeIconWrap]}>
            <TrendingUp size={24} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <Text style={styles.actionButtonText}>Stake</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setScreen('activity');
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.actionIconWrap, styles.activityIconWrap]}>
            <Clock size={24} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <Text style={styles.actionButtonText}>Activity</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.navCard}
        onPress={() => setScreen('staking')}
        activeOpacity={0.8}
      >
        <View style={[styles.navCardIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
          <Lock size={20} color="#8B5CF6" />
        </View>
        <View style={styles.navCardInfo}>
          <Text style={styles.navCardTitle}>Staking Hub</Text>
          <Text style={styles.navCardSub}>
            {stakedAmount > 0 ? `${stakedAmount.toFixed(2)} GF staked • ${earnedAmount.toFixed(4)} earned` : 'Earn rewards by staking your tokens'}
          </Text>
        </View>
        <ChevronRight size={20} color="#64748B" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navCard}
        onPress={() => setScreen('activity')}
        activeOpacity={0.8}
      >
        <View style={[styles.navCardIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
          <Clock size={20} color="#4ADE80" />
        </View>
        <View style={styles.navCardInfo}>
          <Text style={styles.navCardTitle}>Activity History</Text>
          <Text style={styles.navCardSub}>View all your GF token transactions</Text>
        </View>
        <ChevronRight size={20} color="#64748B" />
      </TouchableOpacity>

      {ownedNFTs.length > 0 ? (
        <View style={styles.nftSection}>
          <View style={styles.nftSectionHeader}>
            <Text style={styles.nftSectionTitle}>Your NFTs</Text>
            <TouchableOpacity onPress={() => router.push('/crypto/inventory')} activeOpacity={0.7}>
              <Text style={styles.nftSeeAll}>See all ({ownedNFTs.length})</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nftRow}>
            {ownedNFTs.slice(0, 6).map((nft) => (
              <View key={nft.tokenId} style={styles.nftCard}>
                {nft.imageDataUrl ? (
                  <Image source={{ uri: nft.imageDataUrl }} style={styles.nftImage} />
                ) : nft.image ? (
                  <Image source={{ uri: `${Env.BACKEND_URL}${nft.image}` }} style={styles.nftImage} />
                ) : (
                  <View style={[styles.nftImage, styles.nftImagePlaceholder]}>
                    <Sparkles size={24} color="#4ADE80" />
                  </View>
                )}
                <Text style={styles.nftLabel} numberOfLines={1}>#{nft.tokenId}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#131F2A' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  loadingText: { fontSize: 14, color: '#94A3B8' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#FFFFFF', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20 },
  listContent: { padding: 16, paddingBottom: 40 },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#131F2A',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  subHeaderTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
  balanceCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    overflow: 'hidden',
    marginBottom: 20,
  },
  balanceAmount: { fontSize: 52, fontWeight: '700', color: '#FFFFFF', letterSpacing: -2 },
  tokenName: { fontSize: 15, fontWeight: '500', color: '#94A3B8', marginTop: 8 },
  usdValue: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 20 },
  stakingSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 4,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    width: '100%',
  },
  stakingSummaryItem: { alignItems: 'center', flex: 1 },
  stakingSummaryValue: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  stakingSummaryLabel: { fontSize: 11, color: '#64748B' },
  stakingSummaryDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  buyIconWrap: { backgroundColor: 'rgba(74, 222, 128, 0.2)' },
  stakeIconWrap: { backgroundColor: 'rgba(139, 92, 246, 0.2)' },
  activityIconWrap: { backgroundColor: 'rgba(59, 130, 246, 0.2)' },
  actionButtonText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 14,
  },
  navCardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  navCardInfo: { flex: 1 },
  navCardTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  navCardSub: { fontSize: 12, color: '#64748B', lineHeight: 16 },
  nftSection: { marginTop: 8 },
  nftSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  nftSectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  nftSeeAll: { fontSize: 13, color: '#4ADE80', fontWeight: '600' },
  nftRow: { gap: 10, paddingBottom: 8 },
  nftCard: {
    width: 90,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nftImage: { width: 90, height: 90 },
  nftImagePlaceholder: { backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  nftLabel: { fontSize: 11, color: '#94A3B8', padding: 6, textAlign: 'center' },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  activityIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', marginBottom: 2 },
  activityDate: { fontSize: 12, color: '#64748B' },
  activityDesc: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  activityAmount: { fontSize: 15, fontWeight: '700' },
  stakingScroll: { flex: 1 },
  stakingContent: { padding: 16, paddingBottom: 40 },
  stakingStatsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#64748B', textAlign: 'center' },
  noWalletCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    marginBottom: 16,
  },
  noWalletTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  noWalletText: { fontSize: 13, color: '#F59E0B', textAlign: 'center', lineHeight: 18 },
  positionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  positionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  positionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  positionStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  positionStatusActive: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  positionStatusText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  positionStatusTextActive: { color: '#4ADE80' },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  positionLabel: { fontSize: 14, color: '#94A3B8' },
  positionValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  positionValue: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  positionValueSm: { fontSize: 13, color: '#94A3B8' },
  stakingActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stakingActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  stakeButton: { backgroundColor: '#4ADE80' },
  unstakeButton: { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  claimButton: { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  actionDisabled: { opacity: 0.4 },
  stakingActionText: { fontSize: 14, fontWeight: '700', color: '#020617' },
  claimText: { color: '#F59E0B' },
  actionTextDisabled: { color: '#64748B' },
  infoCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  infoTitle: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  infoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  infoBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80', marginTop: 5 },
  infoText: { flex: 1, fontSize: 13, color: '#64748B', lineHeight: 18 },
  historySection: { marginBottom: 16 },
  historySectionTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 10 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  historyIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  historyInfo: { flex: 1 },
  historyLabel: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
  historyDate: { fontSize: 11, color: '#64748B' },
  historyAmount: { fontSize: 13, fontWeight: '700' },
  modalKAV: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  closeBtn: { padding: 4 },
  claimSummary: { backgroundColor: '#131F2A', borderRadius: 14, padding: 16, marginBottom: 20, gap: 8 },
  claimAmountRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  claimAmountLabel: { fontSize: 13, color: '#94A3B8', marginBottom: 4 },
  claimAmountValue: { fontSize: 24, fontWeight: '700', color: '#F59E0B' },
  inputSection: { marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  availableLabel: { fontSize: 13, color: '#94A3B8' },
  maxButton: { fontSize: 13, fontWeight: '700', color: '#4ADE80' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131F2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  amountInput: { flex: 1, height: 52, fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  inputSuffix: { fontSize: 16, fontWeight: '600', color: '#64748B' },
  inputError: { fontSize: 13, color: '#EF4444', marginTop: 8 },
  confirmButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: { fontSize: 16, fontWeight: '700', color: '#020617' },
  resultContainer: { alignItems: 'center', paddingVertical: 20, gap: 14 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  resultSubtext: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 18 },
  txHashText: { fontSize: 12, color: '#64748B' },
  doneButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 4,
  },
  doneButtonText: { fontSize: 15, fontWeight: '700', color: '#020617' },
  cancelLink: { paddingVertical: 8, alignItems: 'center' },
  cancelLinkText: { fontSize: 14, color: '#64748B' },
});
