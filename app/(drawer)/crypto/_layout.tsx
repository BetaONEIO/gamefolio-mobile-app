import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';

import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Wallet, LayoutDashboard, ShoppingCart, Coins, Package, Receipt, Boxes } from 'lucide-react-native';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, route: '/crypto/dashboard' },
  { key: 'wallet', label: 'Wallet', icon: Wallet, route: '/crypto/wallet' },
  { key: 'buy', label: 'Buy', icon: ShoppingCart, route: '/crypto/buy' },
  { key: 'staking', label: 'Staking', icon: Coins, route: '/crypto/staking' },
  { key: 'store', label: 'Store', icon: Package, route: '/crypto/store' },
  { key: 'inventory', label: 'Inventory', icon: Boxes, route: '/crypto/inventory' },
  { key: 'orders', label: 'Orders', icon: Receipt, route: '/crypto/orders' },
];

function BalanceWidget() {
  return (
    <View style={styles.balanceWidget}>
      <View style={styles.balanceIconWrap}>
        <Wallet size={16} color="#4ADE80" />
      </View>
      <View>
        <Text style={styles.balanceLabel}>Balance</Text>
        <Text style={styles.balanceValue}>0 GF</Text>
      </View>
    </View>
  );
}

function TopNav() {
  const router = useRouter();
  const pathname = usePathname();

  const getActiveKey = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.includes('buy')) return 'buy';
    const path = segments.pop();
    return path || 'dashboard';
  };

  return (
    <View style={styles.topNavContainer}>
      <View style={styles.topNavHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wallet</Text>
        <BalanceWidget />
      </View>
      
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.navScrollContent}
        style={styles.navScroll}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = getActiveKey() === item.key;
          const Icon = item.icon;
          
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Icon size={18} color={isActive ? '#4ADE80' : '#94A3B8'} />
              <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function CryptoLayout() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TopNav />
        <View style={styles.content}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              contentStyle: { backgroundColor: '#0F1520' },
            }}
          >
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="wallet" />
            <Stack.Screen name="buy" />
            <Stack.Screen name="staking" />
            <Stack.Screen name="store" />
            <Stack.Screen name="inventory" />
            <Stack.Screen name="orders" />
          </Stack>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  topNavContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  topNavHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  balanceWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
    gap: 8,
  },
  balanceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  balanceValue: {
    fontSize: 14,
    color: '#4ADE80',
    fontWeight: '700' as const,
  },
  navScroll: {
    maxHeight: 52,
  },
  navScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    gap: 8,
  },
  navItemActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  navItemText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  navItemTextActive: {
    color: '#4ADE80',
  },
});
