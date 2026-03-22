import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingCart, Coins, ChevronRight, Clock, CheckCircle, AlertCircle, Truck, Package } from 'lucide-react-native';

const GF_PRICE_PER_POUND = 100; // 1 GBP = 100 GF

const PRESET_AMOUNTS = [
  { value: 5, label: '£5' },
  { value: 10, label: '£10' },
  { value: 25, label: '£25' },
  { value: 50, label: '£50' },
  { value: 100, label: '£100' },
];

type OrderStatus = 'created' | 'paid' | 'delivering' | 'delivered' | 'failed';

interface OrderStatusConfig {
  label: string;
  description: string;
  icon: typeof Clock;
  color: string;
  bgColor: string;
}

const ORDER_STATUS_CONFIG: Record<OrderStatus, OrderStatusConfig> = {
  created: {
    label: 'Order Created',
    description: 'Waiting for payment confirmation',
    icon: Clock,
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
  },
  paid: {
    label: 'Payment Received',
    description: 'Processing your GF tokens',
    icon: CheckCircle,
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
  },
  delivering: {
    label: 'Delivering Tokens',
    description: 'Transferring GF to your wallet',
    icon: Truck,
    color: '#8B5CF6',
    bgColor: 'rgba(139, 92, 246, 0.15)',
  },
  delivered: {
    label: 'Delivered',
    description: 'GF tokens added to your wallet',
    icon: Package,
    color: '#4ADE80',
    bgColor: 'rgba(74, 222, 128, 0.15)',
  },
  failed: {
    label: 'Failed',
    description: 'Something went wrong. Contact support.',
    icon: AlertCircle,
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
};

interface OrderStatusCardProps {
  status: OrderStatus;
  amount?: number;
  gfAmount?: number;
  orderId?: string;
}

function OrderStatusCard({ status, amount, gfAmount, orderId }: OrderStatusCardProps) {
  const config = ORDER_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <View style={[styles.orderCard, { borderColor: `${config.color}40` }]}>
      <View style={styles.orderCardHeader}>
        <View style={[styles.orderStatusIcon, { backgroundColor: config.bgColor }]}>
          <Icon size={20} color={config.color} />
        </View>
        <View style={styles.orderStatusInfo}>
          <Text style={[styles.orderStatusLabel, { color: config.color }]}>{config.label}</Text>
          <Text style={styles.orderStatusDescription}>{config.description}</Text>
        </View>
      </View>
      
      {(amount || gfAmount || orderId) && (
        <View style={styles.orderDetails}>
          {orderId && (
            <View style={styles.orderDetailRow}>
              <Text style={styles.orderDetailLabel}>Order ID</Text>
              <Text style={styles.orderDetailValue}>#{orderId}</Text>
            </View>
          )}
          {amount && (
            <View style={styles.orderDetailRow}>
              <Text style={styles.orderDetailLabel}>Amount Paid</Text>
              <Text style={styles.orderDetailValue}>£{amount}</Text>
            </View>
          )}
          {gfAmount && (
            <View style={styles.orderDetailRow}>
              <Text style={styles.orderDetailLabel}>GF Tokens</Text>
              <Text style={[styles.orderDetailValue, { color: '#4ADE80' }]}>{gfAmount.toLocaleString()} GF</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.orderProgress}>
        {(['created', 'paid', 'delivering', 'delivered'] as OrderStatus[]).map((step, index) => {
          const stepIndex = ['created', 'paid', 'delivering', 'delivered'].indexOf(status);
          const currentIndex = index;
          const isActive = currentIndex <= stepIndex && status !== 'failed';
          const isFailed = status === 'failed';
          
          return (
            <React.Fragment key={step}>
              <View style={[
                styles.progressDot,
                isActive && styles.progressDotActive,
                isFailed && index === 0 && styles.progressDotFailed,
              ]} />
              {index < 3 && (
                <View style={[
                  styles.progressLine,
                  currentIndex < stepIndex && styles.progressLineActive,
                  isFailed && styles.progressLineFailed,
                ]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

export default function BuyPage() {
  const router = useRouter();
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [currentOrder, setCurrentOrder] = useState<{
    status: OrderStatus;
    amount: number;
    gfAmount: number;
    orderId: string;
  } | null>(null);

  const gfToReceive = selectedAmount ? selectedAmount * GF_PRICE_PER_POUND : 0;

  const handleContinueToPayment = () => {
    if (!selectedAmount) return;
    
    console.log('[BuyPage] Creating order for £' + selectedAmount);
    setCurrentOrder({
      status: 'created',
      amount: selectedAmount,
      gfAmount: gfToReceive,
      orderId: Math.random().toString(36).substring(2, 10).toUpperCase(),
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerSection}>
        <View style={styles.headerIcon}>
          <ShoppingCart size={28} color="#3B82F6" />
        </View>
        <Text style={styles.headerTitle}>Buy GF Tokens</Text>
        <Text style={styles.headerSubtitle}>
          Purchase GF tokens instantly with secure payment
        </Text>
      </View>

      <View style={styles.priceInfoCard}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Current Rate</Text>
          <View style={styles.priceValueWrap}>
            <Coins size={16} color="#4ADE80" />
            <Text style={styles.priceValue}>1 GBP = {GF_PRICE_PER_POUND} GF</Text>
          </View>
        </View>
      </View>

      {currentOrder && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Order</Text>
          <OrderStatusCard
            status={currentOrder.status}
            amount={currentOrder.amount}
            gfAmount={currentOrder.gfAmount}
            orderId={currentOrder.orderId}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Amount</Text>
        <View style={styles.amountGrid}>
          {PRESET_AMOUNTS.map((preset) => {
            const isSelected = selectedAmount === preset.value;
            const gf = preset.value * GF_PRICE_PER_POUND;
            
            return (
              <TouchableOpacity
                key={preset.value}
                style={[styles.amountCard, isSelected && styles.amountCardSelected]}
                onPress={() => setSelectedAmount(preset.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.amountPrice, isSelected && styles.amountPriceSelected]}>
                  {preset.label}
                </Text>
                <Text style={[styles.amountGF, isSelected && styles.amountGFSelected]}>
                  {gf.toLocaleString()} GF
                </Text>
                {isSelected && (
                  <View style={styles.selectedIndicator}>
                    <CheckCircle size={16} color="#4ADE80" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Amount</Text>
          <Text style={styles.summaryValue}>
            {selectedAmount ? `£${selectedAmount}` : '—'}
          </Text>
        </View>
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Rate</Text>
          <Text style={styles.summaryValue}>{GF_PRICE_PER_POUND} GF/£</Text>
        </View>
        
        <View style={styles.summaryDivider} />
        
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabelLarge}>You will receive</Text>
          <View style={styles.summaryGFWrap}>
            <Coins size={20} color="#4ADE80" />
            <Text style={styles.summaryGFValue}>
              {gfToReceive.toLocaleString()} GF
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.continueButton, !selectedAmount && styles.continueButtonDisabled]}
        onPress={handleContinueToPayment}
        activeOpacity={0.8}
        disabled={!selectedAmount}
      >
        <Text style={[styles.continueButtonText, !selectedAmount && styles.continueButtonTextDisabled]}>
          Continue to Payment
        </Text>
        <ChevronRight size={20} color={selectedAmount ? '#FFFFFF' : '#64748B'} />
      </TouchableOpacity>
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
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center' as const,
  },
  priceInfoCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  priceValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceValue: {
    fontSize: 15,
    color: '#4ADE80',
    fontWeight: '700' as const,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amountCard: {
    width: '31%',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative' as const,
  },
  amountCardSelected: {
    borderColor: '#4ADE80',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  amountPrice: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  amountPriceSelected: {
    color: '#4ADE80',
  },
  amountGF: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500' as const,
  },
  amountGFSelected: {
    color: '#94A3B8',
  },
  selectedIndicator: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  summaryValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  summaryLabelLarge: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  summaryGFWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryGFValue: {
    fontSize: 20,
    color: '#4ADE80',
    fontWeight: '700' as const,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4ADE80',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 32,
  },
  continueButtonDisabled: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#131F2A',
  },
  continueButtonTextDisabled: {
    color: '#64748B',
  },
  orderCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  orderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderStatusIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderStatusInfo: {
    flex: 1,
  },
  orderStatusLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  orderStatusDescription: {
    fontSize: 13,
    color: '#64748B',
  },
  orderDetails: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  orderDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderDetailLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  orderDetailValue: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  orderProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  progressDotActive: {
    backgroundColor: '#4ADE80',
  },
  progressDotFailed: {
    backgroundColor: '#EF4444',
  },
  progressLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#334155',
    marginHorizontal: 4,
  },
  progressLineActive: {
    backgroundColor: '#4ADE80',
  },
  progressLineFailed: {
    backgroundColor: '#EF4444',
  },
});
