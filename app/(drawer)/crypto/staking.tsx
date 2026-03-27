import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import {
  TrendingUp,
  Lock,
  Unlock,
  Gift,
  Info,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Clock,
  X,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { Env } from '@/constants/Env';
import * as Haptics from 'expo-haptics';

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

interface HistoryItem {
  id: number;
  type: 'stake' | 'unstake' | 'claim';
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

export default function StakingPage() {
  const { user, getAccessToken, updateUser } = useAuth();
  const queryClient = useQueryClient();

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
  const gfBalance = gfBalanceData?.balance ?? user?.gfTokenBalance ?? 0;

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

  const { data: stats } = useQuery<StakingStats>({
    queryKey: ['/api/staking/stats'],
    queryFn: async () => {
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/stats`);
      if (!res.ok) return { totalStaked: '0', rewardRate: '0.001' };
      return res.json();
    },
  });

  const { data: history = [] } = useQuery<HistoryItem[]>({
    queryKey: ['/api/staking/history', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.id,
  });

  const stakedAmount = position ? parseFloat(position.onChainStaked) || position.dbStaked : 0;
  const earnedAmount = position ? parseFloat(position.onChainEarned) : 0;
  const rewardRateStr = stats?.rewardRate || '0.001';
  const dailyRate = parseFloat(rewardRateStr) * 100;
  const apy = stats?.apy || dailyRate * 365;

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
    if (isNaN(amt) || amt <= 0) {
      setTxError('Please enter a valid amount.');
      return;
    }
    if (amt > gfBalance) {
      setTxError(`Insufficient balance. You have ${gfBalance.toFixed(2)} GF.`);
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTxState('processing');
    setTxError('');

    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/stake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTxState('error');
        setTxError(data.error || 'Staking failed. Please try again.');
        return;
      }
      setTxHash(data.txHash || '');
      if (data.balance !== undefined) {
        updateUser({ gfTokenBalance: data.balance });
      }
      refetchPosition();
      queryClient.invalidateQueries({ queryKey: ['/api/staking/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/gf-balance', user?.id] });
      setTxState('success');
    } catch (err: any) {
      setTxState('error');
      setTxError(err.message || 'Network error. Please try again.');
    }
  };

  const handleUnstake = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setTxError('Please enter a valid amount.');
      return;
    }
    if (amt > stakedAmount) {
      setTxError(`You only have ${stakedAmount.toFixed(2)} GF staked.`);
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTxState('processing');
    setTxError('');

    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/unstake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTxState('error');
        setTxError(data.error || 'Unstaking failed. Please try again.');
        return;
      }
      setTxHash(data.txHash || '');
      if (data.balance !== undefined) {
        updateUser({ gfTokenBalance: data.balance });
      }
      refetchPosition();
      queryClient.invalidateQueries({ queryKey: ['/api/staking/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/gf-balance', user?.id] });
      setTxState('success');
    } catch (err: any) {
      setTxState('error');
      setTxError(err.message || 'Network error. Please try again.');
    }
  };

  const handleClaim = async () => {
    if (earnedAmount <= 0) {
      setTxError('No rewards to claim yet.');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTxState('processing');
    setTxError('');

    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/staking/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setTxState('error');
        setTxError(data.error || 'Claim failed. Please try again.');
        return;
      }
      setTxHash(data.txHash || '');
      if (data.balance !== undefined) {
        updateUser({ gfTokenBalance: data.balance });
      }
      refetchPosition();
      queryClient.invalidateQueries({ queryKey: ['/api/staking/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/me/gf-balance', user?.id] });
      setTxState('success');
    } catch (err: any) {
      setTxState('error');
      setTxError(err.message || 'Network error. Please try again.');
    }
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

  if (positionLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ADE80" />
        <Text style={styles.loadingText}>Loading staking data...</Text>
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
          <Text style={styles.title}>Staking</Text>
          <Text style={styles.subtitle}>Earn rewards by staking your GF tokens on-chain</Text>
        </View>

        <View style={styles.statsRow}>
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

        {!position?.hasWallet ? (
          <View style={styles.noWalletCard}>
            <Info size={24} color="#F59E0B" />
            <Text style={styles.noWalletTitle}>Wallet Required</Text>
            <Text style={styles.noWalletText}>
              Staking requires an on-chain wallet. Your account doesn't have one yet.
              Contact support to enable staking.
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
              <Text style={styles.positionValue}>{gfBalance.toFixed(2)} GF</Text>
            </View>

            {position?.stakedAt ? (
              <View style={styles.positionRow}>
                <Text style={styles.positionLabel}>Last Staked</Text>
                <Text style={styles.positionValueSm}>
                  {new Date(position.stakedAt).toLocaleDateString()}
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {position?.hasWallet ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.stakeButton]}
              onPress={() => openModal('stake')}
              activeOpacity={0.8}
            >
              <Lock size={20} color="#020617" />
              <Text style={styles.actionButtonText}>Stake</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.unstakeButton, stakedAmount <= 0 && styles.actionButtonDisabled]}
              onPress={() => { if (stakedAmount > 0) openModal('unstake'); }}
              disabled={stakedAmount <= 0}
              activeOpacity={0.8}
            >
              <Unlock size={20} color={stakedAmount > 0 ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.actionButtonText, styles.unstakeButtonText, stakedAmount <= 0 && styles.actionButtonTextDisabled]}>
                Unstake
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.claimButton, earnedAmount <= 0 && styles.actionButtonDisabled]}
              onPress={() => { if (earnedAmount > 0) openModal('claim'); }}
              disabled={earnedAmount <= 0}
              activeOpacity={0.8}
            >
              <Gift size={20} color={earnedAmount > 0 ? '#F59E0B' : '#64748B'} />
              <Text style={[styles.actionButtonText, styles.claimButtonText, earnedAmount <= 0 && styles.actionButtonTextDisabled]}>
                Claim
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Info size={18} color="#94A3B8" />
            <Text style={styles.infoTitle}>How Staking Works</Text>
          </View>
          <View style={styles.infoList}>
            {[
              'Stake GF tokens to earn passive rewards',
              'Rewards accrue based on time staked and total pool size',
              `Current daily rate: ~${dailyRate.toFixed(3)}% per day`,
              'Unstake anytime — no lock-up period',
            ].map((item, i) => (
              <View key={i} style={styles.infoItem}>
                <View style={styles.infoBullet} />
                <Text style={styles.infoText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {history.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={styles.historySectionTitle}>Recent Activity</Text>
            <View style={styles.historyList}>
              {history.slice(0, 5).map((item) => {
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
                      <ItemIcon size={18} color={config.color} />
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
          </View>
        ) : null}
      </ScrollView>

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
                    <Text style={styles.txHashText} numberOfLines={1}>
                      TX: {txHash.substring(0, 20)}...
                    </Text>
                  ) : null}
                  <Text style={styles.resultSubtext}>On-chain transaction complete.</Text>
                  <TouchableOpacity style={styles.doneButton} onPress={closeModal} activeOpacity={0.8}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </TouchableOpacity>
                </View>
              ) : txState === 'processing' ? (
                <View style={styles.resultContainer}>
                  <ActivityIndicator size="large" color="#4ADE80" />
                  <Text style={styles.resultTitle}>Processing...</Text>
                  <Text style={styles.resultSubtext}>
                    This on-chain transaction can take 15-60 seconds. Please wait.
                  </Text>
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
                      {txError ? (
                        <Text style={styles.inputError}>{txError}</Text>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.inputSection}>
                      <View style={styles.inputRow}>
                        <Text style={styles.availableLabel}>
                          Available: {modalType === 'stake'
                            ? `${gfBalance.toFixed(2)} GF`
                            : `${stakedAmount.toFixed(2)} GF staked`}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setAmount(
                            String(modalType === 'stake' ? gfBalance : stakedAmount)
                          )}
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
                      {txError ? (
                        <Text style={styles.inputError}>{txError}</Text>
                      ) : null}
                    </View>
                  )}

                  <View style={styles.txWarning}>
                    <Clock size={14} color="#94A3B8" />
                    <Text style={styles.txWarningText}>
                      On-chain transactions can take up to 60 seconds
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleAction}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmButtonText}>{getActionLabel()}</Text>
                    <ChevronRight size={18} color="#020617" />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
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
  subtitle: { fontSize: 14, color: '#94A3B8' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 8,
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 18, fontWeight: '700' as const, color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: '#64748B', fontWeight: '500' as const },
  noWalletCard: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    gap: 12,
    marginBottom: 20,
  },
  noWalletTitle: { fontSize: 18, fontWeight: '700' as const, color: '#F59E0B' },
  noWalletText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  positionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
    gap: 14,
  },
  positionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  positionTitle: { fontSize: 18, fontWeight: '700' as const, color: '#FFFFFF' },
  positionStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  positionStatusActive: { backgroundColor: 'rgba(74, 222, 128, 0.15)' },
  positionStatusText: { fontSize: 12, fontWeight: '600' as const, color: '#64748B' },
  positionStatusTextActive: { color: '#4ADE80' },
  positionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  positionLabel: { fontSize: 14, color: '#94A3B8' },
  positionValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  positionValue: { fontSize: 15, fontWeight: '700' as const, color: '#FFFFFF' },
  positionValueSm: { fontSize: 13, color: '#94A3B8' },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  stakeButton: { backgroundColor: '#4ADE80' },
  unstakeButton: { backgroundColor: '#334155' },
  claimButton: { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  actionButtonDisabled: { backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155' },
  actionButtonText: { fontSize: 14, fontWeight: '700' as const, color: '#020617' },
  unstakeButtonText: { color: '#FFFFFF' },
  claimButtonText: { color: '#F59E0B' },
  actionButtonTextDisabled: { color: '#64748B' },
  infoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  infoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  infoTitle: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  infoList: { gap: 10 },
  infoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoBullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80', marginTop: 6, flexShrink: 0 },
  infoText: { fontSize: 13, color: '#94A3B8', lineHeight: 20, flex: 1 },
  historySection: { marginBottom: 24 },
  historySectionTitle: { fontSize: 18, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 14 },
  historyList: { gap: 10 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  historyIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  historyInfo: { flex: 1 },
  historyLabel: { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF' },
  historyDate: { fontSize: 12, color: '#64748B', marginTop: 2 },
  historyAmount: { fontSize: 14, fontWeight: '700' as const },
  modalKAV: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: '#FFFFFF' },
  closeBtn: { padding: 4 },
  inputSection: { marginBottom: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  availableLabel: { fontSize: 13, color: '#94A3B8' },
  maxButton: { fontSize: 13, fontWeight: '700' as const, color: '#4ADE80' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131F2A',
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '700' as const, color: '#FFFFFF', paddingVertical: 16 },
  inputSuffix: { fontSize: 18, fontWeight: '700' as const, color: '#4ADE80' },
  inputError: { fontSize: 13, color: '#EF4444', marginTop: 8 },
  claimSummary: { marginBottom: 20 },
  claimAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#131F2A',
    borderRadius: 14,
    padding: 20,
  },
  claimAmountLabel: { fontSize: 13, color: '#94A3B8', marginBottom: 4 },
  claimAmountValue: { fontSize: 24, fontWeight: '700' as const, color: '#F59E0B' },
  txWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  txWarningText: { fontSize: 12, color: '#64748B', flex: 1 },
  confirmButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#020617' },
  resultContainer: { alignItems: 'center', paddingVertical: 20, gap: 16 },
  resultIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 22, fontWeight: '700' as const, color: '#FFFFFF' },
  resultSubtext: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  txHashText: { fontSize: 11, color: '#64748B', fontFamily: 'monospace' },
  doneButton: { backgroundColor: '#4ADE80', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, marginTop: 8 },
  doneButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#020617' },
  cancelLink: { paddingVertical: 8 },
  cancelLinkText: { fontSize: 14, color: '#64748B' },
});
