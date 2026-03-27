import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import {
  ShoppingCart,
  Coins,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  Package,
  X,
  Sparkles,
  Info,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Env } from '@/constants/Env';

const GF_PRICE_PER_POUND = 100;

const PRESET_AMOUNTS = [
  { value: 5, label: '£5', gf: 500 },
  { value: 10, label: '£10', gf: 1000 },
  { value: 25, label: '£25', gf: 2500 },
  { value: 50, label: '£50', gf: 5000 },
  { value: 100, label: '£100', gf: 10000 },
];

type CheckoutState = 'idle' | 'creating' | 'browser' | 'recovering' | 'polling' | 'success' | 'error';

interface OrderResult {
  orderId: string;
  gfAmount: number;
  status: string;
}

const ORDER_STATUS_CONFIG: Record<string, { label: string; description: string; Icon: any; color: string; bg: string }> = {
  created: {
    label: 'Order Created',
    description: 'Waiting for payment confirmation',
    Icon: Clock,
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.15)',
  },
  paid: {
    label: 'Payment Received',
    description: 'Processing your GF tokens',
    Icon: CheckCircle,
    color: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.15)',
  },
  credited: {
    label: 'Tokens Credited',
    description: 'GF tokens added to your account',
    Icon: CheckCircle,
    color: '#4ADE80',
    bg: 'rgba(74, 222, 128, 0.15)',
  },
  delivered: {
    label: 'Tokens Delivered',
    description: 'GF tokens transferred on-chain',
    Icon: Package,
    color: '#4ADE80',
    bg: 'rgba(74, 222, 128, 0.15)',
  },
  delivering: {
    label: 'Delivering Tokens',
    description: 'Transferring GF to your wallet',
    Icon: Truck,
    color: '#8B5CF6',
    bg: 'rgba(139, 92, 246, 0.15)',
  },
  failed: {
    label: 'Order Failed',
    description: 'Something went wrong. Please contact support.',
    Icon: AlertCircle,
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.15)',
  },
};

export default function BuyGFPage() {
  const { user, getAccessToken, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const [selectedAmount, setSelectedAmount] = useState(10);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const gfBalance = user?.gfTokenBalance ?? 0;
  const selectedPreset = PRESET_AMOUNTS.find(p => p.value === selectedAmount);
  const gfAmount = selectedAmount * GF_PRICE_PER_POUND;

  const POLL_INTERVAL_MS = 4000;
  const MAX_POLL_ATTEMPTS = 30;

  const pollOrderStatus = useCallback(async (orderId: string, initialGfAmount: number) => {
    let attempts = 0;
    setCheckoutState('polling');

    while (attempts < MAX_POLL_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      attempts++;

      try {
        const token = await getAccessToken();
        const orderRes = await fetch(`${Env.BACKEND_URL}/api/gf/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!orderRes.ok) continue;

        const orderData = await orderRes.json();
        const status: string = orderData?.status || 'created';

        setOrderResult({
          orderId,
          gfAmount: orderData?.gfAmount ?? initialGfAmount,
          status,
        });

        if (status === 'credited' || status === 'delivered') {
          if (typeof orderData?.newBalance === 'number') {
            updateUser({ gfTokenBalance: orderData.newBalance });
          } else if (typeof orderData?.gfAmount === 'number') {
            updateUser({ gfTokenBalance: (user?.gfTokenBalance ?? 0) + orderData.gfAmount });
          }
          queryClient.invalidateQueries({ queryKey: ['/api/store/owned'] });
          queryClient.invalidateQueries({ queryKey: ['/api/me/gf-balance'] });
          setCheckoutState('success');
          return;
        }

        if (status === 'failed') {
          setCheckoutState('error');
          setErrorMessage('Your order has failed. Please try again or contact support.');
          return;
        }
        /* 'paid' and 'delivering' are intermediate — continue polling until delivered/credited */
      } catch {
        // Continue polling on network error
      }
    }

    // Timed out — show current state as success if any non-created status was seen
    setCheckoutState('error');
    setErrorMessage('We could not confirm your order status. Your tokens will be credited automatically if payment succeeded. Please check your wallet.');
  }, [getAccessToken, updateUser, queryClient, user?.gfTokenBalance]);

  const handleCheckout = useCallback(async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCheckoutState('creating');
    setErrorMessage('');
    setOrderResult(null);

    try {
      const token = await getAccessToken();
      const res = await fetch(`${Env.BACKEND_URL}/api/gf/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gbpAmount: selectedAmount }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCheckoutState('error');
        setErrorMessage(data.error || 'Failed to create checkout session. Please try again.');
        return;
      }

      const { orderId, checkoutUrl } = data;
      if (!checkoutUrl) {
        setCheckoutState('error');
        setErrorMessage('No checkout URL returned from server.');
        return;
      }

      setCheckoutState('browser');

      if (Platform.OS === 'web') {
        window.open(checkoutUrl, '_blank');
      } else {
        await WebBrowser.openBrowserAsync(checkoutUrl, {
          dismissButtonStyle: 'close',
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        });
      }

      setCheckoutState('recovering');

      try {
        const recoverToken = await getAccessToken();
        await fetch(`${Env.BACKEND_URL}/api/gf/recover-orders`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${recoverToken}` },
        });
      } catch {
        // recover-orders is best-effort
      }

      // Check order status once immediately
      const orderToken = await getAccessToken();
      const orderRes = await fetch(`${Env.BACKEND_URL}/api/gf/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${orderToken}` },
      });
      const orderData = orderRes.ok ? await orderRes.json() : null;
      const immediateStatus: string = orderData?.status || 'created';

      setOrderResult({
        orderId,
        gfAmount: orderData?.gfAmount ?? gfAmount,
        status: immediateStatus,
      });

      if (immediateStatus === 'credited' || immediateStatus === 'delivered') {
        if (typeof orderData?.newBalance === 'number') {
          updateUser({ gfTokenBalance: orderData.newBalance });
        } else if (typeof orderData?.gfAmount === 'number') {
          updateUser({ gfTokenBalance: (user?.gfTokenBalance ?? 0) + orderData.gfAmount });
        }
        queryClient.invalidateQueries({ queryKey: ['/api/store/owned'] });
        queryClient.invalidateQueries({ queryKey: ['/api/me/gf-balance'] });
        setCheckoutState('success');
        return;
      }

      if (immediateStatus === 'failed') {
        setCheckoutState('error');
        setErrorMessage('Your order has failed. Please try again or contact support.');
        return;
      }

      // Not yet terminal — start polling
      await pollOrderStatus(orderId, orderData?.gfAmount ?? gfAmount);
    } catch (err: any) {
      setCheckoutState('error');
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
    }
  }, [selectedAmount, getAccessToken, gfAmount, updateUser, queryClient, pollOrderStatus, user?.gfTokenBalance]);

  const handleReset = () => {
    setCheckoutState('idle');
    setErrorMessage('');
    setOrderResult(null);
  };

  if (checkoutState === 'success' && orderResult) {
    const config = ORDER_STATUS_CONFIG[orderResult.status] || ORDER_STATUS_CONFIG.credited;
    const StatusIcon = config.Icon;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: config.bg }]}>
            <StatusIcon size={48} color={config.color} />
          </View>
          <Text style={styles.resultTitle}>Payment Complete!</Text>
          <Text style={styles.resultSubtitle}>
            {orderResult.gfAmount.toLocaleString()} GF tokens have been added to your account
          </Text>

          <View style={styles.resultSummary}>
            <View style={styles.resultRow}>
              <Text style={styles.resultRowLabel}>Tokens Received</Text>
              <View style={styles.resultRowValue}>
                <Sparkles size={14} color="#4ADE80" />
                <Text style={styles.resultAmount}>{orderResult.gfAmount.toLocaleString()} GF</Text>
              </View>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultRowLabel}>New Balance</Text>
              <Text style={styles.resultBalance}>{(user?.gfTokenBalance ?? 0).toLocaleString()} GF</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultRowLabel}>Order ID</Text>
              <Text style={styles.resultOrderId}>#{orderResult.orderId}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={handleReset} activeOpacity={0.8}>
            <Text style={styles.doneButtonText}>Buy More Tokens</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  if (checkoutState === 'creating' || checkoutState === 'browser' || checkoutState === 'recovering' || checkoutState === 'polling') {
    const stateMessages: Record<string, { title: string; desc: string }> = {
      creating: { title: 'Creating Order...', desc: 'Setting up your checkout session.' },
      browser: { title: 'Complete Payment', desc: 'Finish your payment in the browser window, then return here.' },
      recovering: { title: 'Confirming Payment...', desc: 'Please wait while we confirm your payment.' },
      polling: { title: 'Processing Tokens...', desc: 'Waiting for your payment to be confirmed and tokens to be credited. This may take a moment.' },
    };
    const msg = stateMessages[checkoutState] || stateMessages.creating;
    const currentStatus = orderResult?.status;
    const statusConfig = currentStatus ? ORDER_STATUS_CONFIG[currentStatus] : null;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.pollingContainer}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingTitle}>{msg.title}</Text>
          <Text style={styles.loadingDesc}>{msg.desc}</Text>

          {statusConfig && orderResult ? (
            <View style={[styles.statusCard, { backgroundColor: statusConfig.bg, borderColor: statusConfig.color + '40' }]}>
              <statusConfig.Icon size={24} color={statusConfig.color} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.statusLabel, { color: statusConfig.color }]}>{statusConfig.label}</Text>
                <Text style={styles.statusDescription}>{statusConfig.description}</Text>
              </View>
            </View>
          ) : null}

          {['created', 'paid', 'delivering', 'delivered'].map((step, idx) => {
            const cfg = ORDER_STATUS_CONFIG[step];
            const currentIdx = currentStatus ? ['created', 'paid', 'delivering', 'delivered', 'credited'].indexOf(currentStatus) : -1;
            const isCompleted = currentIdx > idx;
            const isActive = currentIdx === idx;
            const stepColor = isCompleted ? '#4ADE80' : isActive ? cfg.color : '#334155';

            return (
              <View key={step} style={styles.stepRow}>
                <View style={[styles.stepDot, { backgroundColor: isCompleted ? '#4ADE80' : isActive ? cfg.color : '#1E293B', borderColor: stepColor }]}>
                  {isCompleted ? <CheckCircle size={12} color="#020617" /> : null}
                </View>
                <Text style={[styles.stepText, { color: stepColor }]}>{cfg.label}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  if (checkoutState === 'error') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.resultContainer}>
          <View style={[styles.resultIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <AlertCircle size={48} color="#EF4444" />
          </View>
          <Text style={styles.resultTitle}>Checkout Failed</Text>
          <Text style={styles.errorMessage}>{errorMessage}</Text>
          <TouchableOpacity style={styles.doneButton} onPress={handleReset} activeOpacity={0.8}>
            <Text style={styles.doneButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
          <Text style={styles.title}>Buy GF Tokens</Text>
          <Text style={styles.subtitle}>Purchase tokens to use across the Gamefolio platform</Text>
          <View style={styles.balancePill}>
            <Sparkles size={14} color="#4ADE80" />
            <Text style={styles.balanceText}>{gfBalance.toLocaleString()} GF balance</Text>
          </View>
        </View>

        <View style={styles.rateCard}>
          <View style={styles.rateLeft}>
            <Coins size={20} color="#4ADE80" />
            <Text style={styles.rateText}>1 GF Token = £0.01 GBP</Text>
          </View>
          <TouchableOpacity
            style={styles.infoButton}
            onPress={() => setShowHowItWorks(true)}
            activeOpacity={0.7}
          >
            <Info size={16} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Amount</Text>
          <View style={styles.amountsGrid}>
            {PRESET_AMOUNTS.map((preset) => (
              <TouchableOpacity
                key={preset.value}
                style={[
                  styles.amountCard,
                  selectedAmount === preset.value && styles.amountCardActive,
                ]}
                onPress={() => {
                  setSelectedAmount(preset.value);
                  if (Platform.OS !== 'web') Haptics.selectionAsync();
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.amountLabel,
                  selectedAmount === preset.value && styles.amountLabelActive,
                ]}>
                  {preset.label}
                </Text>
                <Text style={[
                  styles.amountGF,
                  selectedAmount === preset.value && styles.amountGFActive,
                ]}>
                  {preset.gf.toLocaleString()} GF
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>You Pay</Text>
            <Text style={styles.summaryValue}>£{selectedAmount}.00 GBP</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>You Receive</Text>
            <View style={styles.summaryGFRow}>
              <Sparkles size={14} color="#4ADE80" />
              <Text style={styles.summaryGFValue}>{gfAmount.toLocaleString()} GF</Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Rate</Text>
            <Text style={styles.summaryValue}>100 GF per £1</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment</Text>
            <Text style={styles.summaryValue}>Stripe (Card / PayPal)</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={handleCheckout}
          activeOpacity={0.8}
        >
          <ShoppingCart size={20} color="#020617" />
          <Text style={styles.checkoutButtonText}>Continue to Checkout</Text>
          <ChevronRight size={18} color="#020617" />
        </TouchableOpacity>

        <View style={styles.securityNote}>
          <Text style={styles.securityText}>
            Payments are securely processed by Stripe. Tokens are typically credited instantly after payment.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showHowItWorks}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHowItWorks(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>How It Works</Text>
              <TouchableOpacity onPress={() => setShowHowItWorks(false)} activeOpacity={0.7}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {[
              { step: '1', title: 'Select an amount', desc: 'Choose how many GF tokens you want to purchase.' },
              { step: '2', title: 'Pay with Stripe', desc: 'Complete your payment securely using card or PayPal.' },
              { step: '3', title: 'Tokens credited instantly', desc: 'GF tokens appear in your wallet after payment confirmation.' },
              { step: '4', title: 'Use anywhere on Gamefolio', desc: 'Spend GF on NFTs, store items, staking, and more.' },
            ].map((item) => (
              <View key={item.step} style={styles.howItWorksStep}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{item.step}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{item.title}</Text>
                  <Text style={styles.stepDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 },
  pollingContainer: { alignItems: 'center', gap: 20, padding: 32, paddingTop: 48 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    width: '100%',
    marginTop: 8,
  },
  statusLabel: { fontSize: 15, fontWeight: '700' as const, marginBottom: 2 },
  statusDescription: { fontSize: 12, color: '#94A3B8' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { fontSize: 14, fontWeight: '600' as const },
  loadingTitle: { fontSize: 20, fontWeight: '700' as const, color: '#FFFFFF' },
  loadingDesc: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  header: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 12 },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  balanceText: { fontSize: 13, fontWeight: '700' as const, color: '#4ADE80' },
  rateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rateLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rateText: { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF' },
  infoButton: { padding: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 14 },
  amountsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amountCard: {
    width: '47%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  amountCardActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: '#4ADE80',
  },
  amountLabel: { fontSize: 22, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 4 },
  amountLabelActive: { color: '#4ADE80' },
  amountGF: { fontSize: 12, color: '#64748B', fontWeight: '500' as const },
  amountGFActive: { color: '#86EFAC' },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: '#94A3B8' },
  summaryValue: { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF' },
  summaryGFRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryGFValue: { fontSize: 16, fontWeight: '700' as const, color: '#4ADE80' },
  summaryDivider: { height: 1, backgroundColor: '#334155', marginVertical: 4 },
  checkoutButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  checkoutButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#020617', flex: 1, textAlign: 'center' },
  securityNote: { alignItems: 'center', paddingHorizontal: 8 },
  securityText: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 18 },
  resultContainer: { alignItems: 'center', paddingVertical: 40, gap: 16 },
  resultIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 24, fontWeight: '700' as const, color: '#FFFFFF' },
  resultSubtitle: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  resultSummary: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 8,
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultRowLabel: { fontSize: 14, color: '#94A3B8' },
  resultRowValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultAmount: { fontSize: 16, fontWeight: '700' as const, color: '#4ADE80' },
  resultBalance: { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF' },
  resultOrderId: { fontSize: 12, color: '#64748B' },
  doneButton: { backgroundColor: '#4ADE80', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 40, marginTop: 8 },
  doneButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#020617' },
  errorMessage: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20, paddingHorizontal: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 20,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: '#FFFFFF' },
  howItWorksStep: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeText: { fontSize: 14, fontWeight: '700' as const, color: '#4ADE80' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 4 },
  stepDesc: { fontSize: 13, color: '#94A3B8', lineHeight: 18 },
});
