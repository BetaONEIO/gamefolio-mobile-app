import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { TrendingUp, Lock, Gift, Clock, ChevronRight, Info, Percent } from 'lucide-react-native';

const STAKING_TIERS = [
  { id: '30', days: 30, apy: '5%', minStake: 100, label: 'Flexible' },
  { id: '90', days: 90, apy: '12%', minStake: 500, label: 'Standard', popular: true },
  { id: '180', days: 180, apy: '20%', minStake: 1000, label: 'Premium' },
  { id: '365', days: 365, apy: '35%', minStake: 5000, label: 'Diamond' },
];

const ACTIVE_STAKES = [
  // Empty for now - placeholder
];

export default function StakingPage() {
  const [selectedTier, setSelectedTier] = useState('90');
  const [stakeAmount, setStakeAmount] = useState('');

  const currentTier = STAKING_TIERS.find(t => t.id === selectedTier);
  const estimatedRewards = stakeAmount && currentTier
    ? ((parseFloat(stakeAmount) || 0) * (parseFloat(currentTier.apy) / 100) * (currentTier.days / 365)).toFixed(2)
    : '0';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Staking</Text>
        <Text style={styles.subtitle}>Earn rewards by staking your GF tokens</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
            <Lock size={18} color="#4ADE80" />
          </View>
          <Text style={styles.statLabel}>Total Staked</Text>
          <Text style={styles.statValue}>0 GF</Text>
        </View>
        <View style={styles.statCard}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
            <Gift size={18} color="#8B5CF6" />
          </View>
          <Text style={styles.statLabel}>Rewards Earned</Text>
          <Text style={styles.statValue}>0 GF</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Staking Period</Text>
        <View style={styles.tiersGrid}>
          {STAKING_TIERS.map((tier) => (
            <TouchableOpacity
              key={tier.id}
              style={[
                styles.tierCard,
                selectedTier === tier.id && styles.tierCardSelected,
                tier.popular && styles.tierCardPopular
              ]}
              onPress={() => setSelectedTier(tier.id)}
              activeOpacity={0.7}
            >
              {tier.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>Popular</Text>
                </View>
              )}
              <Text style={styles.tierLabel}>{tier.label}</Text>
              <Text style={styles.tierDays}>{tier.days} days</Text>
              <View style={styles.tierApyWrap}>
                <Percent size={14} color="#4ADE80" />
                <Text style={styles.tierApy}>{tier.apy} APY</Text>
              </View>
              <Text style={styles.tierMin}>Min: {tier.minStake} GF</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.stakeCard}>
        <Text style={styles.cardLabel}>Amount to Stake</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.stakeInput}
            value={stakeAmount}
            onChangeText={setStakeAmount}
            placeholder="0"
            placeholderTextColor="#475569"
            keyboardType="decimal-pad"
          />
          <Text style={styles.inputSuffix}>GF</Text>
          <TouchableOpacity style={styles.maxButton} activeOpacity={0.7}>
            <Text style={styles.maxButtonText}>MAX</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.estimateSection}>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Lock Period</Text>
            <Text style={styles.estimateValue}>{currentTier?.days} days</Text>
          </View>
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>APY Rate</Text>
            <Text style={[styles.estimateValue, { color: '#4ADE80' }]}>{currentTier?.apy}</Text>
          </View>
          <View style={styles.estimateDivider} />
          <View style={styles.estimateRow}>
            <Text style={styles.estimateLabel}>Estimated Rewards</Text>
            <Text style={styles.estimateReward}>+{estimatedRewards} GF</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.stakeButton, !stakeAmount && styles.stakeButtonDisabled]}
          activeOpacity={0.8}
          disabled={!stakeAmount}
        >
          <Lock size={18} color="#0E1831" />
          <Text style={styles.stakeButtonText}>Stake Tokens</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Stakes</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.viewAllText}>History</Text>
          </TouchableOpacity>
        </View>

        {ACTIVE_STAKES.length === 0 ? (
          <View style={styles.emptyState}>
            <TrendingUp size={40} color="#475569" />
            <Text style={styles.emptyTitle}>No Active Stakes</Text>
            <Text style={styles.emptyText}>Stake your tokens to start earning rewards</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.infoBox}>
        <Info size={16} color="#3B82F6" />
        <Text style={styles.infoText}>
          Staked tokens are locked for the selected period. Early withdrawal may result in penalty fees. Rewards are calculated daily and distributed upon unlock.
        </Text>
      </View>
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: '#4ADE80',
    fontWeight: '600' as const,
  },
  tiersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tierCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  tierCardSelected: {
    borderColor: 'rgba(74, 222, 128, 0.5)',
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
  },
  tierCardPopular: {
    borderColor: 'rgba(139, 92, 246, 0.4)',
  },
  popularBadge: {
    position: 'absolute',
    top: -8,
    right: 10,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  popularBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  tierLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  tierDays: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 10,
  },
  tierApyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  tierApy: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#4ADE80',
  },
  tierMin: {
    fontSize: 11,
    color: '#64748B',
  },
  stakeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  cardLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 12,
    fontWeight: '500' as const,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131F2A',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  stakeInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    paddingVertical: 16,
  },
  inputSuffix: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#64748B',
    marginRight: 12,
  },
  maxButton: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  maxButtonText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#4ADE80',
  },
  estimateSection: {
    backgroundColor: '#131F2A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  estimateLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  estimateValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  estimateDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 10,
  },
  estimateReward: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#4ADE80',
  },
  stakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  stakeButtonDisabled: {
    backgroundColor: '#1E293B',
    opacity: 0.6,
  },
  stakeButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0E1831',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
});
