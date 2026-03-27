import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, TrendingUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Env } from '@/constants/Env';

export default function WalletPage() {
  const router = useRouter();
  const { user, getAccessToken } = useAuth();

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

  const handleButtonPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.balanceCard}>
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.15)', 'rgba(59, 130, 246, 0.08)']}
            style={styles.cardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          <Text style={styles.balanceAmount}>
            {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.tokenName}>Gamefolio Token</Text>
          <Text style={styles.usdValue}>≈ £{(balance * 0.01).toFixed(2)} GBP</Text>
        </View>

        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              handleButtonPress();
              router.push('/crypto/buy');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, styles.buyIconWrap]}>
              <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text style={styles.actionButtonText}>Buy</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              handleButtonPress();
              router.push('/crypto/staking');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconWrap, styles.stakeIconWrap]}>
              <TrendingUp size={24} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text style={styles.actionButtonText}>Stake</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131F2A',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  balanceCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    overflow: 'hidden',
    position: 'relative',
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  balanceAmount: {
    fontSize: 56,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#94A3B8',
    marginTop: 8,
  },
  usdValue: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    gap: 16,
  },
  actionButton: {
    flex: 1,
    maxWidth: 160,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 20,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buyIconWrap: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  stakeIconWrap: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
