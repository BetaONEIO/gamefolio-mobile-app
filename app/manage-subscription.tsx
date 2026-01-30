import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Linking,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Crown, 
  X, 
  Check, 
  ExternalLink,
  Calendar
} from 'lucide-react-native';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import AppHeader from '@/components/AppHeader';

export default function ManageSubscription() {
  const router = useRouter();
  const { user, getAccessToken } = useAuth();
  const { isPro, customerInfo } = useRevenueCat();
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const subscriptionQuery = useQuery({
    queryKey: ['subscription', 'status', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      try {
        const status = await api.subscription.getStatus(token);
        console.log('[ManageSubscription] Subscription status:', status);
        return status;
      } catch (error) {
        console.log('[ManageSubscription] Failed to fetch subscription status:', error);
        return null;
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const subscriptionData = subscriptionQuery.data;
  const managementURL = customerInfo?.managementURL;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const getSubscriptionTypeLabel = (type: string | null | undefined) => {
    if (type === 'yearly') return 'Yearly';
    if (type === 'monthly') return 'Monthly';
    return 'Pro';
  };

  const handleOpenBillingPortal = async () => {
    if (!managementURL) {
      Alert.alert(
        'Billing Portal Unavailable',
        'The billing portal is not available. Please manage your subscription through the App Store or Google Play.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsOpeningPortal(true);
    try {
      const canOpen = await Linking.canOpenURL(managementURL);
      if (canOpen) {
        await Linking.openURL(managementURL);
      } else {
        Alert.alert('Error', 'Unable to open billing portal.');
      }
    } catch (error) {
      console.error('[ManageSubscription] Error opening billing portal:', error);
      Alert.alert('Error', 'Failed to open billing portal.');
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Pro Subscription?',
      "Are you sure? You'll lose access to:\n\n• Unlimited uploads\n• Higher file size limits\n• Exclusive avatar borders\n• Ad-free experience\n• Monthly bonus lootboxes\n\nYour access continues until the end of your billing period.",
      [
        {
          text: 'Keep Pro',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => {
            if (managementURL) {
              handleOpenBillingPortal();
              Alert.alert(
                'Manage Subscription',
                'Please cancel your subscription through the billing portal.',
                [{ text: 'OK' }]
              );
            } else {
              const storeMessage = Platform.OS === 'ios' 
                ? 'Please cancel your subscription through the App Store Settings.'
                : 'Please cancel your subscription through Google Play Settings.';
              Alert.alert('Cancel Subscription', storeMessage, [{ text: 'OK' }]);
            }
          },
        },
      ]
    );
  };

  

  const benefits = [
    'Unlimited video and screenshot uploads',
    '500MB video file size limit',
    '100MB image file size limit',
    'Access to all avatar borders',
    'No video ads',
    'Monthly bonus lootboxes',
    'Priority support',
  ];

  if (!isPro) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <AppHeader showBackButton={true} />
          <SafeAreaView style={styles.safeArea} edges={['bottom']}>
            <View style={styles.notProContainer}>
              <Crown size={64} color="#64748B" strokeWidth={1.5} />
              <Text style={styles.notProTitle}>Not a Pro Member</Text>
              <Text style={styles.notProSubtitle}>
                Upgrade to Pro to unlock unlimited uploads, exclusive borders, and more!
              </Text>
              <TouchableOpacity 
                style={styles.upgradeButton}
                onPress={() => router.back()}
              >
                <Text style={styles.upgradeButtonText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <AppHeader showBackButton={true} />
        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <View style={styles.crownContainer}>
                <Crown size={40} color="#10B981" strokeWidth={2} fill="#10B98130" />
              </View>
              <Text style={styles.title}>Manage Pro Subscription</Text>
            </View>

            <View style={styles.subscriptionCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <Crown size={24} color="#10B981" strokeWidth={2} />
                  <Text style={styles.cardTitle}>Gamefolio Pro</Text>
                </View>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>
                    {getSubscriptionTypeLabel(subscriptionData?.proSubscriptionType)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardDetails}>
                <View style={styles.detailRow}>
                  <Calendar size={16} color="#64748B" />
                  <Text style={styles.detailLabel}>Member since:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(subscriptionData?.proSubscriptionStartDate)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Calendar size={16} color="#64748B" />
                  <Text style={styles.detailLabel}>Next billing:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(subscriptionData?.proSubscriptionEndDate)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.benefitsSection}>
              <Text style={styles.benefitsTitle}>Pro Benefits</Text>
              <View style={styles.benefitsList}>
                {benefits.map((benefit, index) => (
                  <View key={index} style={styles.benefitItem}>
                    <View style={styles.benefitIconContainer}>
                      <Check size={16} color="#10B981" strokeWidth={2.5} />
                    </View>
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.actionsSection}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => router.back()}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>

              {managementURL && (
                <TouchableOpacity 
                  style={styles.billingButton}
                  onPress={handleOpenBillingPortal}
                  disabled={isOpeningPortal}
                >
                  {isOpeningPortal ? (
                    <ActivityIndicator size="small" color="#10B981" />
                  ) : (
                    <>
                      <ExternalLink size={18} color="#10B981" />
                      <Text style={styles.billingButtonText}>Billing Portal</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelSubscription}
              >
                <X size={18} color="#EF4444" />
                <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  crownContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subscriptionCard: {
    backgroundColor: '#161F2E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    padding: 20,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  typeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#10B981',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#94A3B8',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#FFFFFF',
  },
  benefitsSection: {
    marginBottom: 32,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  benefitsList: {
    backgroundColor: '#161F2E',
    borderRadius: 12,
    padding: 16,
    gap: 14,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: '#E2E8F0',
    flex: 1,
  },
  actionsSection: {
    gap: 12,
  },
  closeButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  billingButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  billingButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  cancelButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  notProContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  notProTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 12,
  },
  notProSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  upgradeButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
