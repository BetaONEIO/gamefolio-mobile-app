import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle, Share2, Home, Eye } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export default function UploadSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { type = 'clip', title = 'Your content' } = useLocalSearchParams<{ type?: string; title?: string }>();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const getLabel = () => {
    if (type === 'reel') return 'Reel';
    if (type === 'screenshot') return 'Screenshot';
    return 'Clip';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={['#080E17', '#0F1520', '#080E17']} style={StyleSheet.absoluteFill} />

      <View style={styles.content}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <LinearGradient colors={['#4ADE80', '#22C55E']} style={styles.iconGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <CheckCircle size={52} color="#0F1520" strokeWidth={2.5} />
          </LinearGradient>
        </Animated.View>

        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Text style={styles.title}>{getLabel()} Uploaded!</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            "{title}" is now live on your Gamefolio
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>+50 XP earned</Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/(drawer)/(tabs)/profile')}
          testID="button-view-profile"
          activeOpacity={0.85}
        >
          <Eye size={18} color="#0F1520" />
          <Text style={styles.primaryBtnText}>View on Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(drawer)/(tabs)/home')}
          testID="button-go-home-upload"
          activeOpacity={0.85}
        >
          <Home size={18} color="#4ADE80" />
          <Text style={styles.secondaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080E17', justifyContent: 'space-between' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, paddingHorizontal: 32 },
  iconWrap: { marginBottom: 8 },
  iconGrad: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#94A3B8', fontSize: 16, textAlign: 'center', lineHeight: 24 },
  badge: { marginTop: 16, backgroundColor: '#4ADE8022', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#4ADE8044' },
  badgeText: { color: '#4ADE80', fontSize: 14, fontWeight: '700' },
  actions: { paddingHorizontal: 24, gap: 12 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#4ADE80', borderRadius: 14, paddingVertical: 16 },
  primaryBtnText: { color: '#0F1520', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1E293B', borderRadius: 14, paddingVertical: 16 },
  secondaryBtnText: { color: '#4ADE80', fontSize: 16, fontWeight: '600' },
});
