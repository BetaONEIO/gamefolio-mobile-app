import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { X, Check, Crown, Zap, Star, Shield } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PaywallModal({ visible, onClose }: PaywallModalProps) {
  const { offerings, isLoadingOfferings, purchasePackage, isPurchasing, restorePurchases, isRestoring } = useRevenueCat();
  const [selectedPackage, setSelectedPackage] = React.useState<'monthly' | 'yearly'>('yearly');

  const currentOffering = offerings?.current;
  const monthlyPackage = currentOffering?.availablePackages.find(pkg => pkg.identifier === 'monthly');
  const yearlyPackage = currentOffering?.availablePackages.find(pkg => pkg.identifier === 'yearly');

  const handlePurchase = async () => {
    const pkg = selectedPackage === 'monthly' ? monthlyPackage : yearlyPackage;
    if (!pkg) return;

    try {
      await purchasePackage(pkg);
      onClose();
    } catch (error: any) {
      if (!error?.userCancelled) {
        console.error('Purchase error:', error);
      }
    }
  };

  const handleRestore = async () => {
    try {
      await restorePurchases();
      onClose();
    } catch (error) {
      console.error('Restore error:', error);
    }
  };

  const features = [
    { icon: Zap, text: 'Unlimited uploads & storage', color: '#FFD700' },
    { icon: Crown, text: 'Exclusive Pro badge & styling', color: '#FF6B6B' },
    { icon: Star, text: 'Priority support & early features', color: '#4ECDC4' },
    { icon: Shield, text: 'Advanced privacy controls', color: '#A78BFA' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={80} style={StyleSheet.absoluteFill} />
        
        <View style={styles.container}>
          <LinearGradient
            colors={['#1A1F35', '#0F1520']}
            style={styles.gradient}
          >
            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={24} color="#fff" />
              </TouchableOpacity>

              <View style={styles.header}>
                <View style={styles.crownContainer}>
                  <LinearGradient
                    colors={['#FFD700', '#FFA500']}
                    style={styles.crownGradient}
                  >
                    <Crown size={40} color="#fff" />
                  </LinearGradient>
                </View>
                <Text style={styles.title}>Upgrade to Pro</Text>
                <Text style={styles.subtitle}>Unlock the full Gamefolio experience</Text>
              </View>

              <View style={styles.featuresContainer}>
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <View key={index} style={styles.featureItem}>
                      <View style={[styles.featureIcon, { backgroundColor: feature.color + '20' }]}>
                        <Icon size={24} color={feature.color} />
                      </View>
                      <Text style={styles.featureText}>{feature.text}</Text>
                    </View>
                  );
                })}
              </View>

              {isLoadingOfferings ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#FFD700" />
                  <Text style={styles.loadingText}>Loading plans...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.plansContainer}>
                    {yearlyPackage && (
                      <TouchableOpacity
                        style={[
                          styles.planCard,
                          selectedPackage === 'yearly' && styles.planCardSelected
                        ]}
                        onPress={() => setSelectedPackage('yearly')}
                        activeOpacity={0.8}
                      >
                        {selectedPackage === 'yearly' && (
                          <View style={styles.selectedBadge}>
                            <Text style={styles.selectedBadgeText}>BEST VALUE</Text>
                          </View>
                        )}
                        <View style={styles.planHeader}>
                          <Text style={styles.planName}>Annual</Text>
                          {selectedPackage === 'yearly' && (
                            <View style={styles.checkCircle}>
                              <Check size={16} color="#fff" />
                            </View>
                          )}
                        </View>
                        <Text style={styles.planPrice}>{yearlyPackage.product.priceString}/year</Text>
                        <Text style={styles.planSavings}>Save 17% vs monthly</Text>
                      </TouchableOpacity>
                    )}

                    {monthlyPackage && (
                      <TouchableOpacity
                        style={[
                          styles.planCard,
                          selectedPackage === 'monthly' && styles.planCardSelected
                        ]}
                        onPress={() => setSelectedPackage('monthly')}
                        activeOpacity={0.8}
                      >
                        <View style={styles.planHeader}>
                          <Text style={styles.planName}>Monthly</Text>
                          {selectedPackage === 'monthly' && (
                            <View style={styles.checkCircle}>
                              <Check size={16} color="#fff" />
                            </View>
                          )}
                        </View>
                        <Text style={styles.planPrice}>{monthlyPackage.product.priceString}/month</Text>
                        <Text style={styles.planDetails}>Billed monthly</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.subscribeButton, (isPurchasing || !currentOffering) && styles.subscribeButtonDisabled]}
                    onPress={handlePurchase}
                    disabled={isPurchasing || !currentOffering}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={['#FFD700', '#FFA500']}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {isPurchasing ? (
                        <ActivityIndicator color="#000" />
                      ) : (
                        <Text style={styles.subscribeButtonText}>Subscribe Now</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestore}
                disabled={isRestoring}
              >
                {isRestoring ? (
                  <ActivityIndicator size="small" color="#A0A0A0" />
                ) : (
                  <Text style={styles.restoreButtonText}>Restore Purchases</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.disclaimer}>
                Cancel anytime. Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current period.
              </Text>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  crownContainer: {
    marginBottom: 16,
  },
  crownGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#A0A0A0',
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#A0A0A0',
    marginTop: 16,
    fontSize: 14,
  },
  plansContainer: {
    marginBottom: 24,
    gap: 12,
  },
  planCard: {
    backgroundColor: '#1E2538',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    borderColor: '#FFD700',
    backgroundColor: '#252B3F',
  },
  selectedBadge: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: '#FFD700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
  },
  selectedBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.5,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#fff',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFD700',
    marginBottom: 4,
  },
  planSavings: {
    fontSize: 14,
    color: '#4ECDC4',
  },
  planDetails: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  subscribeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  subscribeButtonDisabled: {
    opacity: 0.5,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  restoreButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#A0A0A0',
  },
  disclaimer: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
