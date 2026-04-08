import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Copy, Users, Star, Gift, Share2, CheckCircle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';

const HOW_STEPS = [
  'Share your referral link or code with a friend.',
  'They enter your code during sign-up (or use your link — it auto-applies).',
  'Once they complete registration, you both get XP!',
  'You earn +250 XP and they earn +250 XP as a welcome bonus.',
];

export default function ReferAFriendScreen() {
  const { user, getAccessToken } = useAuth();
  const [copiedLink, setCopiedLink] = React.useState(false);
  const [copiedCode, setCopiedCode] = React.useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ['referral-stats', user?.id],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.users.getReferralStats(token);
    },
    enabled: !!user,
    retry: false,
  });

  const referralLink = stats?.referralLink ?? (user ? `https://gamefolio.app/ref/${user.id}` : '');
  const referralCode = stats?.referralCode ?? (user ? String(user.id) : '');

  const copyLink = async () => {
    if (!referralLink) return;
    await Clipboard.setStringAsync(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const copyCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#131F2A', '#061021']} style={StyleSheet.absoluteFill} />
      <AppHeader />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Refer a Friend</Text>
          <Text style={styles.pageSubtitle}>Invite friends and earn XP together</Text>
        </View>

        <LinearGradient
          colors={['#1A2D1A', '#131F2A']}
          style={styles.heroBanner}
        >
          <View style={styles.heroIconWrap}>
            <Gift size={36} color="#4ADE80" strokeWidth={1.5} />
          </View>
          <Text style={styles.heroTitle}>Invite Friends, Earn XP</Text>
          <Text style={styles.heroSubtitle}>
            Share your unique referral link. When a friend signs up, you both earn{' '}
            <Text style={styles.heroHighlight}>250 XP</Text> each!
          </Text>
        </LinearGradient>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#4ADE80" size="small" />
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Users size={20} color="#4ADE80" strokeWidth={2} />
                <Text style={styles.statNumber}>{stats?.referralCount ?? 0}</Text>
                <Text style={styles.statLabel}>Friends Referred</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCard}>
                <Star size={20} color="#F59E0B" strokeWidth={2} />
                <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{stats?.totalXpEarned ?? 0}</Text>
                <Text style={styles.statLabel}>XP Earned</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Your Referral Code</Text>
              <View style={styles.codeRow}>
                <Text style={styles.codeText}>{referralCode || '—'}</Text>
                <TouchableOpacity
                  style={[styles.copyBtn, copiedCode && styles.copyBtnDone]}
                  onPress={copyCode}
                  activeOpacity={0.8}
                  disabled={!referralCode}
                >
                  {copiedCode ? (
                    <CheckCircle size={16} color="#131F2A" strokeWidth={2.5} />
                  ) : (
                    <Copy size={16} color="#131F2A" strokeWidth={2.5} />
                  )}
                  <Text style={styles.copyBtnText}>{copiedCode ? 'Copied!' : 'Copy'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Your Referral Link</Text>
              <View style={styles.linkBox}>
                <Text style={styles.linkText} numberOfLines={1} ellipsizeMode="tail">
                  {referralLink || '—'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.copyLinkBtn, copiedLink && styles.copyLinkBtnDone]}
                onPress={copyLink}
                activeOpacity={0.8}
                disabled={!referralLink}
              >
                {copiedLink ? (
                  <CheckCircle size={18} color="#131F2A" strokeWidth={2.5} />
                ) : (
                  <Share2 size={18} color="#131F2A" strokeWidth={2.5} />
                )}
                <Text style={styles.copyLinkBtnText}>
                  {copiedLink ? 'Link Copied!' : 'Copy Referral Link'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.linkHint}>
                When a friend visits this link and signs up, your referral code is automatically applied.
              </Text>
            </View>

            <View style={styles.howItWorksCard}>
              <Text style={styles.howTitle}>How It Works</Text>
              {HOW_STEPS.map((step, i) => (
                <View key={i} style={styles.howStep}>
                  <View style={styles.stepNumberWrap}>
                    <Text style={styles.stepNumber}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1821',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  pageHeader: {
    marginBottom: 20,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  pageSubtitle: {
    color: '#64748B',
    fontSize: 14,
  },
  heroBanner: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  heroHighlight: {
    color: '#4ADE80',
    fontWeight: '700',
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#131F2A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#1E293B',
    marginVertical: 12,
  },
  statNumber: {
    color: '#4ADE80',
    fontSize: 28,
    fontWeight: '800',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
    gap: 10,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131F2A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  codeText: {
    flex: 1,
    color: '#4ADE80',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4ADE80',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  copyBtnDone: {
    backgroundColor: '#22D3EE',
  },
  copyBtnText: {
    color: '#131F2A',
    fontSize: 13,
    fontWeight: '700',
  },
  linkBox: {
    backgroundColor: '#131F2A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkText: {
    color: '#94A3B8',
    fontSize: 13,
    fontFamily: 'monospace',
  },
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    paddingVertical: 14,
  },
  copyLinkBtnDone: {
    backgroundColor: '#22D3EE',
  },
  copyLinkBtnText: {
    color: '#131F2A',
    fontSize: 15,
    fontWeight: '700',
  },
  linkHint: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
  howItWorksCard: {
    backgroundColor: '#131F2A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
    gap: 14,
  },
  howTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  howStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
  },
  stepText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
  },
});
