import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Star, Gift, Zap } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const STORAGE_KEY = 'gf_welcome_pack_seen';

const REWARDS = [
  { icon: Zap, label: '+100 XP', sub: 'Welcome bonus XP', color: '#4ADE80' },
  { icon: Star, label: '50 GF Tokens', sub: 'In-app currency', color: '#F59E0B' },
  { icon: Gift, label: 'Starter Pack', sub: 'Unlock exclusive badge', color: '#8B5CF6' },
];

interface Props {
  onDismiss?: () => void;
}

export default function WelcomePackDialog({ onDismiss }: Props) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!user) return;
    checkIfShouldShow();
  }, [user]);

  const checkIfShouldShow = async () => {
    try {
      const seen = await AsyncStorage.getItem(`${STORAGE_KEY}_${user?.id}`);
      if (seen) return;
      if (!user?.createdAt) return;
      const createdAt = new Date(user.createdAt).getTime();
      const daysSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation <= 7) {
        setVisible(true);
      }
    } catch {}
  };

  const handleClaim = async () => {
    setClaimed(true);
    try {
      await AsyncStorage.setItem(`${STORAGE_KEY}_${user?.id}`, 'true');
    } catch {}
  };

  const handleClose = () => {
    setVisible(false);
    onDismiss?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient colors={['#0F1520', '#1E293B']} style={styles.gradient} />

          <View style={styles.headerRow}>
            <View style={styles.iconWrap}>
              <Gift size={28} color="#4ADE80" />
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} testID="button-close-welcome-pack">
              <Text style={styles.closeBtnText}>Skip</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Welcome to Gamefolio!</Text>
          <Text style={styles.subtitle}>
            Here's your starter pack to kick off your gaming journey.
          </Text>

          <View style={styles.rewardsWrap}>
            {REWARDS.map(({ icon: Icon, label, sub, color }) => (
              <View key={label} style={styles.rewardCard}>
                <View style={[styles.rewardIcon, { backgroundColor: color + '22' }]}>
                  <Icon size={22} color={color} />
                </View>
                <View>
                  <Text style={styles.rewardLabel}>{label}</Text>
                  <Text style={styles.rewardSub}>{sub}</Text>
                </View>
              </View>
            ))}
          </View>

          {claimed ? (
            <View style={styles.claimedBadge}>
              <Text style={styles.claimedText}>Rewards Claimed!</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.claimBtn} onPress={handleClaim} testID="button-claim-welcome-pack">
              <LinearGradient colors={['#4ADE80', '#22C55E']} style={styles.claimGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.claimBtnText}>Claim Welcome Pack</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {claimed && (
            <TouchableOpacity onPress={handleClose} style={styles.continueBtn} testID="button-welcome-continue">
              <Text style={styles.continueBtnText}>Start Playing</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  container: { width: '100%', maxWidth: 380, borderRadius: 24, overflow: 'hidden', padding: 24, borderWidth: 1, borderColor: '#1E293B' },
  gradient: { ...StyleSheet.absoluteFillObject },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  iconWrap: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#4ADE8022', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#4ADE8044' },
  closeBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  closeBtnText: { color: '#4A5568', fontSize: 14 },
  title: { color: '#FFF', fontSize: 22, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#94A3B8', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  rewardsWrap: { gap: 12, marginBottom: 24 },
  rewardCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 12 },
  rewardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rewardLabel: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  rewardSub: { color: '#64748B', fontSize: 12, marginTop: 2 },
  claimBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  claimGrad: { paddingVertical: 15, alignItems: 'center' },
  claimBtnText: { color: '#0F1520', fontSize: 16, fontWeight: '800' },
  claimedBadge: { backgroundColor: '#4ADE8022', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#4ADE8044', marginBottom: 12 },
  claimedText: { color: '#4ADE80', fontSize: 15, fontWeight: '700' },
  continueBtn: { alignItems: 'center', paddingVertical: 10 },
  continueBtnText: { color: '#94A3B8', fontSize: 14 },
});
