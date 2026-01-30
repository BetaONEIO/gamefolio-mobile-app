import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertCircle, ShoppingCart, Store, TrendingUp, ArrowDownLeft, QrCode, ArrowUpRight, Clock, Coins } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');

const MOCK_BALANCE = {
  available: 0,
  staked: 0,
  rewards: 0,
};

const MOCK_LAST_ACTIVITY: string | null = null;

function formatNumber(num: number): string {
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardPage() {
  const router = useRouter();
  const { authTokens } = useAuth();

  const { data: walletData, isLoading: walletLoading, isError: walletError } = useQuery({
    queryKey: ['wallet-status'],
    queryFn: () => api.wallet.getStatus(authTokens?.accessToken || ''),
    enabled: !!authTokens?.accessToken,
    retry: 1,
    staleTime: 30000,
  });

  const balance = MOCK_BALANCE;
  const totalBalance = balance.available + balance.staked + balance.rewards;
  const hasBalance = totalBalance > 0;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1a3a2f', '#0F1520']}
        style={styles.gradientBackground}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.5 }}
      />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Status Indicator */}
        <View style={styles.statusRow}>
          {walletLoading ? (
            <ActivityIndicator size="small" color="#94A3B8" />
          ) : walletError || !walletData ? (
            <View style={styles.statusBadge}>
              <AlertCircle size={14} color="#EF4444" />
              <Text style={[styles.statusText, styles.statusTextError]}>Account unavailable</Text>
            </View>
          ) : (
            <View style={styles.statusBadge}>
              <CheckCircle size={14} color="#4ADE80" />
              <Text style={styles.statusText}>Account ready</Text>
            </View>
          )}
        </View>

        {/* Balance Section */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>GAMEFOLIO BALANCE</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceAmount}>{formatLargeNumber(balance.available)}</Text>
            <Text style={styles.balanceCurrency}> GF</Text>
          </View>
          
          {/* Sub-balances badge */}
          <View style={styles.subBalanceBadge}>
            <TrendingUp size={12} color="#4ADE80" />
            <Text style={styles.subBalanceText}>
              {formatNumber(balance.staked)} staked • {formatNumber(balance.rewards)} rewards
            </Text>
          </View>
        </View>

        {/* Pagination dots */}
        <View style={styles.dotsContainer}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/crypto/buy')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconWrap}>
              <ShoppingCart size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>BUY</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/crypto/staking')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconWrap}>
              <Coins size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>STAKE</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/crypto/store')}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconWrap}>
              <Store size={22} color="#FFFFFF" />
            </View>
            <Text style={styles.actionLabel}>STORE</Text>
          </TouchableOpacity>
        </View>

        {/* Assets Section */}
        <View style={styles.assetsSection}>
          <View style={styles.assetsSectionHeader}>
            <Text style={styles.assetsSectionTitle}>Token details</Text>
            <View style={styles.headerIcons}>
              <Clock size={18} color="#64748B" />
            </View>
          </View>

          {/* Available Balance Card */}
          <View style={styles.assetCard}>
            <View style={styles.assetLeft}>
              <View style={[styles.assetIcon, { backgroundColor: '#4ADE80' }]}>
                <Text style={styles.assetIconText}>GF</Text>
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>Available</Text>
                <Text style={styles.assetSubname}>Gamefolio Token</Text>
              </View>
            </View>
            <View style={styles.assetRight}>
              <Text style={styles.assetAmount}>{formatNumber(balance.available)}</Text>
              <Text style={styles.assetValue}>GF</Text>
            </View>
          </View>

          {/* Staked Balance Card */}
          <View style={styles.assetCard}>
            <View style={styles.assetLeft}>
              <View style={[styles.assetIcon, { backgroundColor: '#3B82F6' }]}>
                <Coins size={16} color="#FFFFFF" />
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>Staked</Text>
                <Text style={styles.assetSubname}>Earning rewards</Text>
              </View>
            </View>
            <View style={styles.assetRight}>
              <Text style={styles.assetAmount}>{formatNumber(balance.staked)}</Text>
              <Text style={styles.assetValue}>GF</Text>
            </View>
          </View>

          {/* Rewards Balance Card */}
          <View style={styles.assetCard}>
            <View style={styles.assetLeft}>
              <View style={[styles.assetIcon, { backgroundColor: '#F59E0B' }]}>
                <TrendingUp size={16} color="#FFFFFF" />
              </View>
              <View style={styles.assetInfo}>
                <Text style={styles.assetName}>Rewards</Text>
                <Text style={styles.assetSubname}>Claimable</Text>
              </View>
            </View>
            <View style={styles.assetRight}>
              <Text style={styles.assetAmount}>{formatNumber(balance.rewards)}</Text>
              <Text style={styles.assetValue}>GF</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <Text style={styles.activityTitle}>Recent activity</Text>
          <Text style={styles.activityText}>
            {MOCK_LAST_ACTIVITY || 'No recent activity'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
  },
  gradientBackground: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    height: 350,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  statusRow: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4ADE80',
  },
  statusTextError: {
    color: '#EF4444',
  },
  balanceSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#4ADE80',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  balanceCurrency: {
    fontSize: 24,
    fontWeight: '500' as const,
    color: '#94A3B8',
  },
  subBalanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
  },
  subBalanceText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#4ADE80',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  actionButton: {
    alignItems: 'center',
    gap: 8,
  },
  actionIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  assetsSection: {
    backgroundColor: '#151C28',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  assetsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  assetsSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  assetCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  assetLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assetIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetIconText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#0F172A',
  },
  assetInfo: {
    gap: 2,
  },
  assetName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  assetSubname: {
    fontSize: 13,
    color: '#64748B',
  },
  assetRight: {
    alignItems: 'flex-end',
  },
  assetAmount: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  assetValue: {
    fontSize: 13,
    color: '#64748B',
  },
  activitySection: {
    backgroundColor: '#151C28',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#94A3B8',
    marginBottom: 8,
  },
  activityText: {
    fontSize: 14,
    color: '#64748B',
    fontStyle: 'italic' as const,
  },
});
