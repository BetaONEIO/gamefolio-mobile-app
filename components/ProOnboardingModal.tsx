import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Crown, Check, X } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORAGE_KEY = 'gf_pro_onboarding_seen';
const SHOW_AFTER_DAYS = 3;

const PRO_FEATURES = [
  'Unlimited clip uploads',
  'HD video quality',
  'Custom profile themes',
  'Priority in search results',
  'Exclusive Pro badge',
  'Advanced analytics',
];

interface Props {
  onDismiss?: () => void;
  onUpgrade?: () => void;
}

export default function ProOnboardingModal({ onDismiss, onUpgrade }: Props) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user || user.isPro) return;
    checkIfShouldShow();
  }, [user]);

  const checkIfShouldShow = async () => {
    try {
      const key = `${STORAGE_KEY}_${user?.id}`;
      const seen = await AsyncStorage.getItem(key);
      if (seen) return;
      if (!user?.createdAt) return;
      const createdAt = new Date(user.createdAt).getTime();
      const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation >= SHOW_AFTER_DAYS) {
        setVisible(true);
        await AsyncStorage.setItem(key, 'true');
      }
    } catch {}
  };

  const handleClose = () => {
    setVisible(false);
    onDismiss?.();
  };

  const handleUpgrade = () => {
    setVisible(false);
    onUpgrade?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient colors={['#1a0f2e', '#131F2A']} style={StyleSheet.absoluteFill} />

          <TouchableOpacity style={styles.closeBtn} onPress={handleClose} testID="button-close-pro-modal">
            <X size={20} color="#4A5568" />
          </TouchableOpacity>

          <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.proBadgeWrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Crown size={32} color="#FFF" />
          </LinearGradient>

          <Text style={styles.title}>Upgrade to Pro</Text>
          <Text style={styles.subtitle}>Unlock the full Gamefolio experience and take your gaming to the next level.</Text>

          <View style={styles.features}>
            {PRO_FEATURES.map(feature => (
              <View key={feature} style={styles.featureRow}>
                <View style={styles.checkWrap}>
                  <Check size={14} color="#4ADE80" strokeWidth={3} />
                </View>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.upgradeBtn} onPress={handleUpgrade} testID="button-upgrade-pro">
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.upgradeGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Crown size={18} color="#FFF" />
              <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleClose} style={styles.skipBtn} testID="button-skip-pro">
            <Text style={styles.skipBtnText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingTop: 32, overflow: 'hidden', borderTopWidth: 1, borderColor: '#2D3F55' },
  closeBtn: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  proBadgeWrap: { width: 68, height: 68, borderRadius: 20, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  features: { gap: 10, marginBottom: 28 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkWrap: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#4ADE8022', alignItems: 'center', justifyContent: 'center' },
  featureText: { color: '#E2E8F0', fontSize: 15 },
  upgradeBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  upgradeGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  upgradeBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  skipBtn: { alignItems: 'center', paddingVertical: 10 },
  skipBtnText: { color: '#4A5568', fontSize: 14 },
});
