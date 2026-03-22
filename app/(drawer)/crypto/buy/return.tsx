import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, XCircle, Clock, ArrowRight, Receipt, Home, RefreshCw, HelpCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

type TransactionStatus = 'success' | 'pending' | 'failed';

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle,
    title: 'Purchase Successful!',
    subtitle: 'Your tokens have been added to your wallet',
    color: '#4ADE80',
    bgColor: 'rgba(74, 222, 128, 0.15)',
  },
  pending: {
    icon: Clock,
    title: 'Processing Payment',
    subtitle: 'Your transaction is being processed',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
  },
  failed: {
    icon: XCircle,
    title: 'Transaction Failed',
    subtitle: 'Something went wrong with your payment',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
};

export default function BuyReturnPage() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [scaleAnim] = useState(new Animated.Value(0));
  
  const status: TransactionStatus = (params.status as TransactionStatus) || 'success';
  const amount = params.amount || '0';
  const tokens = params.tokens || '0';
  const transactionId = params.txId || 'TX' + Math.random().toString(36).substring(2, 10).toUpperCase();
  
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statusSection}>
        <Animated.View 
          style={[
            styles.iconContainer,
            { backgroundColor: config.bgColor, transform: [{ scale: scaleAnim }] }
          ]}
        >
          <StatusIcon size={64} color={config.color} />
        </Animated.View>
        
        <Text style={styles.title}>{config.title}</Text>
        <Text style={styles.subtitle}>{config.subtitle}</Text>
      </View>

      {status === 'success' && (
        <View style={styles.tokensCard}>
          <LinearGradient
            colors={['rgba(74, 222, 128, 0.1)', 'rgba(59, 130, 246, 0.05)']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <Text style={styles.tokensLabel}>Tokens Received</Text>
          <Text style={styles.tokensValue}>{Number(tokens).toLocaleString()} GF</Text>
          <Text style={styles.tokensUsd}>≈ ${amount} USD</Text>
        </View>
      )}

      <View style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Transaction Details</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Transaction ID</Text>
          <Text style={styles.detailValue}>{transactionId}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount Paid</Text>
          <Text style={styles.detailValue}>${amount}</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Tokens</Text>
          <Text style={[styles.detailValue, styles.detailValueGreen]}>{tokens} GF</Text>
        </View>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status</Text>
          <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
            <Text style={[styles.statusBadgeText, { color: config.color }]}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </View>
        </View>
        
        <View style={[styles.detailRow, styles.detailRowLast]}>
          <Text style={styles.detailLabel}>Date</Text>
          <Text style={styles.detailValue}>{new Date().toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.actionsSection}>
        {status === 'success' && (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/crypto/wallet')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>View Wallet</Text>
              <ArrowRight size={18} color="#0E1831" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/crypto/orders')}
              activeOpacity={0.7}
            >
              <Receipt size={18} color="#94A3B8" />
              <Text style={styles.secondaryButtonText}>View Order History</Text>
            </TouchableOpacity>
          </>
        )}
        
        {status === 'failed' && (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/crypto/buy')}
              activeOpacity={0.8}
            >
              <RefreshCw size={18} color="#0E1831" />
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => console.log('Contact support')}
              activeOpacity={0.7}
            >
              <HelpCircle size={18} color="#94A3B8" />
              <Text style={styles.secondaryButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </>
        )}
        
        {status === 'pending' && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/crypto/orders')}
            activeOpacity={0.7}
          >
            <Clock size={18} color="#94A3B8" />
            <Text style={styles.secondaryButtonText}>Track Order Status</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push('/crypto/dashboard')}
          activeOpacity={0.7}
        >
          <Home size={18} color="#64748B" />
          <Text style={styles.homeButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
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
  statusSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
  },
  tokensCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
    overflow: 'hidden',
  },
  tokensLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  tokensValue: {
    fontSize: 42,
    fontWeight: '700' as const,
    color: '#4ADE80',
    marginBottom: 4,
  },
  tokensUsd: {
    fontSize: 14,
    color: '#64748B',
  },
  detailsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  detailValueGreen: {
    color: '#4ADE80',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  actionsSection: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#4ADE80',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#0E1831',
  },
  secondaryButton: {
    backgroundColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    marginTop: 8,
  },
  homeButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500' as const,
  },
});
