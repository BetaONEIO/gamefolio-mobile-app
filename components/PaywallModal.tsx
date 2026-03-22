import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { X, Crown, Upload, Sparkles, Gift, Store } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PaywallModal({ visible, onClose }: PaywallModalProps) {
  const { offerings, isLoadingOfferings, purchasePackage, isPurchasing, restorePurchases, isRestoring } = useRevenueCat();

  const currentOffering = offerings?.current;
  const introPackage = currentOffering?.availablePackages.find(pkg => pkg.identifier === 'monthly');

  const handlePurchase = async () => {
    if (!introPackage) return;

    try {
      await purchasePackage(introPackage);
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
    { icon: Upload, title: 'Unlimited upload space', subtitle: 'Share your clips without limits' },
    { icon: Sparkles, title: 'Animated profile customization', subtitle: 'Custom banners, borders & effects' },
    { icon: Gift, title: '100s of exclusive assets', subtitle: 'Premium stickers, badges & themes' },
    { icon: Store, title: 'Store discounts', subtitle: 'Save on games and merchandise' },
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
            colors={['#1A1F35', '#131F2A']}
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
                <View style={styles.iconContainer}>
                  <View style={styles.glowOuter}>
                    <View style={styles.glowMiddle}>
                      <View style={styles.glowInner}>
                        <View style={styles.iconBox}>
                          <View style={styles.proBadge}>
                            <Text style={styles.proText}>PRO</Text>
                          </View>
                          <Crown size={36} color="#10B981" strokeWidth={2.5} fill="#10B98130" />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
                <Text style={styles.title}>
                  Gamefolio <Text style={styles.titlePro}>Pro</Text>
                </Text>
                <Text style={styles.subtitle}>
                  Unlock the ultimate experience and level up your gaming profile today.
                </Text>
              </View>

              <Text style={styles.benefitsTitle}>Premium Benefits</Text>

              <View style={styles.featuresContainer}>
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  return (
                    <View key={index} style={styles.featureItem}>
                      <View style={styles.featureIcon}>
                        <Icon size={18} color="#10B981" strokeWidth={2.5} />
                      </View>
                      <View style={styles.featureTextContainer}>
                        <Text style={styles.featureTitle}>{feature.title}</Text>
                        <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {isLoadingOfferings ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#10B981" />
                  <Text style={styles.loadingText}>Loading offer...</Text>
                </View>
              ) : (
                <>
                  <View style={styles.pricingContainer}>
                    <View style={styles.specialBadge}>
                      <Text style={styles.specialBadgeText}>SPECIAL INTRO OFFER</Text>
                    </View>
                    <View style={styles.priceRow}>
                      <Text style={styles.mainPrice}>
                        {introPackage?.product.introPrice?.priceString || introPackage?.product.priceString || '£0.99'}
                      </Text>
                      <Text style={styles.pricePeriod}>/ 1st month</Text>
                    </View>
                    <Text style={styles.thenPrice}>
                      Then {introPackage?.product.priceString || '£3.00'}/month, Cancel anytime.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.upgradeButton, (isPurchasing || !introPackage) && styles.upgradeButtonDisabled]}
                    onPress={handlePurchase}
                    disabled={isPurchasing || !introPackage}
                    activeOpacity={0.8}
                  >
                    {isPurchasing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                        <Text style={styles.upgradeArrow}>→</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.maybeLaterButton}
                    onPress={onClose}
                  >
                    <Text style={styles.maybeLaterText}>Maybe Later</Text>
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.footer}>
                <View style={styles.footerLinks}>
                  <Text style={styles.footerLink}>Terms of Service</Text>
                  <Text style={styles.footerDivider}>•</Text>
                  <Text style={styles.footerLink}>Privacy Policy</Text>
                  <Text style={styles.footerDivider}>•</Text>
                  <TouchableOpacity onPress={handleRestore} disabled={isRestoring}>
                    {isRestoring ? (
                      <ActivityIndicator size="small" color="#666" />
                    ) : (
                      <Text style={styles.footerLink}>Restore Purchase</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '92%',
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
    marginBottom: 16,
    backgroundColor: '#1E2538',
    borderRadius: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    marginBottom: 20,
  },
  glowOuter: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: '#10B98108',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowMiddle: {
    width: 104,
    height: 104,
    borderRadius: 28,
    backgroundColor: '#10B98115',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowInner: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#10B98125',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#1E2D3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  proText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 12,
  },
  titlePro: {
    color: '#10B981',
  },
  subtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featuresContainer: {
    marginBottom: 36,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#10B98118',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureTextContainer: {
    flex: 1,
    paddingTop: 2,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  featureSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#6B7280',
    marginTop: 16,
    fontSize: 14,
  },
  pricingContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  specialBadge: {
    backgroundColor: '#10B98120',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 20,
  },
  specialBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#10B981',
    letterSpacing: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  mainPrice: {
    fontSize: 56,
    fontWeight: '700' as const,
    color: '#fff',
  },
  pricePeriod: {
    fontSize: 18,
    color: '#6B7280',
    marginLeft: 4,
  },
  thenPrice: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  upgradeButton: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  upgradeButtonDisabled: {
    opacity: 0.5,
  },
  upgradeButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    marginRight: 8,
  },
  upgradeArrow: {
    fontSize: 18,
    color: '#fff',
  },
  maybeLaterButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  maybeLaterText: {
    fontSize: 16,
    color: '#6B7280',
  },
  footer: {
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#1E2538',
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerLink: {
    fontSize: 12,
    color: '#6B7280',
  },
  footerDivider: {
    fontSize: 12,
    color: '#374151',
    marginHorizontal: 8,
  },
});
