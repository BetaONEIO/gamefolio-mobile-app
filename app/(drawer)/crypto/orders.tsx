import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Receipt, ShoppingBag, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle, XCircle, Filter } from 'lucide-react-native';

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'stakes', label: 'Stakes' },
  { id: 'rewards', label: 'Rewards' },
];

const ORDERS: Array<{
  id: string;
  type: 'purchase' | 'stake' | 'reward' | 'withdrawal';
  title: string;
  amount: string;
  date: string;
  status: 'completed' | 'pending' | 'failed';
  tokens?: string;
}> = [
  // Empty for placeholder
];

const STATUS_CONFIG = {
  completed: { icon: CheckCircle, color: '#4ADE80', label: 'Completed' },
  pending: { icon: Clock, color: '#F59E0B', label: 'Pending' },
  failed: { icon: XCircle, color: '#EF4444', label: 'Failed' },
};

const TYPE_CONFIG = {
  purchase: { icon: ArrowDownLeft, color: '#3B82F6', label: 'Purchase' },
  stake: { icon: ArrowUpRight, color: '#8B5CF6', label: 'Stake' },
  reward: { icon: Receipt, color: '#4ADE80', label: 'Reward' },
  withdrawal: { icon: ArrowUpRight, color: '#F59E0B', label: 'Withdrawal' },
};

export default function OrdersPage() {
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredOrders = activeFilter === 'all'
    ? ORDERS
    : ORDERS.filter(order => {
        if (activeFilter === 'purchases') return order.type === 'purchase';
        if (activeFilter === 'stakes') return order.type === 'stake';
        if (activeFilter === 'rewards') return order.type === 'reward';
        return true;
      });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>Track your transactions and order history</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>Total Orders</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>$0</Text>
          <Text style={styles.statLabel}>Total Spent</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>0</Text>
          <Text style={styles.statLabel}>GF Earned</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterScroll}
        style={styles.filterContainer}
      >
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.filterTab, activeFilter === tab.id && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, activeFilter === tab.id && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Receipt size={48} color="#475569" />
          </View>
          <Text style={styles.emptyTitle}>No Orders Yet</Text>
          <Text style={styles.emptyText}>
            Your transaction history will appear here once you make your first purchase or stake
          </Text>
          <TouchableOpacity style={styles.emptyButton} activeOpacity={0.8}>
            <ShoppingBag size={18} color="#0A0E27" />
            <Text style={styles.emptyButtonText}>Browse Store</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.ordersList}>
          {filteredOrders.map((order) => {
            const typeConfig = TYPE_CONFIG[order.type];
            const statusConfig = STATUS_CONFIG[order.status];
            const TypeIcon = typeConfig.icon;
            const StatusIcon = statusConfig.icon;
            
            return (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                activeOpacity={0.7}
              >
                <View style={[styles.orderIcon, { backgroundColor: `${typeConfig.color}20` }]}>
                  <TypeIcon size={20} color={typeConfig.color} />
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTitle}>{order.title}</Text>
                  <View style={styles.orderMeta}>
                    <Text style={styles.orderDate}>{order.date}</Text>
                    <View style={styles.orderStatus}>
                      <StatusIcon size={12} color={statusConfig.color} />
                      <Text style={[styles.orderStatusText, { color: statusConfig.color }]}>
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.orderAmount}>
                  <Text style={styles.orderAmountText}>{order.amount}</Text>
                  {order.tokens && (
                    <Text style={styles.orderTokens}>{order.tokens}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
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
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500' as const,
  },
  filterContainer: {
    marginBottom: 20,
  },
  filterScroll: {
    gap: 10,
  },
  filterTab: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterTabActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  filterTabTextActive: {
    color: '#4ADE80',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4ADE80',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#0A0E27',
  },
  ordersList: {
    gap: 10,
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  orderIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderDate: {
    fontSize: 12,
    color: '#64748B',
  },
  orderStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  orderAmount: {
    alignItems: 'flex-end',
  },
  orderAmountText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  orderTokens: {
    fontSize: 12,
    color: '#4ADE80',
    marginTop: 2,
  },
});
