import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native';
import { ChevronDown, ChevronUp, MessageCircle, Mail, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import AppHeader from '@/components/AppHeader';

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

const FAQS: FAQ[] = [
  {
    id: '1',
    question: 'How do I upload a clip or reel?',
    answer: 'Tap the upload button in the navigation bar at the bottom of the screen. Select your video file, add a title and game tag, then tap Upload. Your clip will appear on your profile once processed.',
  },
  {
    id: '2',
    question: 'What is a Gamefolio?',
    answer: 'Your Gamefolio is your personal gaming portfolio — a profile that showcases your best clips, screenshots, and gaming stats. You can share it with other gamers or potential teams.',
  },
  {
    id: '3',
    question: 'How do I earn XP and level up?',
    answer: 'You earn XP by uploading clips, maintaining daily streaks, receiving likes and comments, and completing challenges. As you accumulate XP, your level increases and unlocks new features.',
  },
  {
    id: '4',
    question: 'What are GF Tokens?',
    answer: 'GF Tokens are Gamefolio\'s in-app currency. You can earn them through daily logins, completing challenges, and leveling up. Tokens can be used in the store for exclusive items.',
  },
  {
    id: '5',
    question: 'How do I enable two-factor authentication?',
    answer: 'Go to Account Settings, tap "Two-Factor Authentication", then follow the steps to link your authenticator app. This adds an extra layer of security to your account.',
  },
  {
    id: '6',
    question: 'Can I make my profile private?',
    answer: 'Yes! Go to Account Settings and toggle "Private Profile". When private, only approved followers can see your clips and screenshots.',
  },
  {
    id: '7',
    question: 'How do battles work?',
    answer: 'Battles let you compete head-to-head with other gamers. Submit your best clip and the community votes on who had the better play. Win battles to earn bonus XP and tokens.',
  },
  {
    id: '8',
    question: 'How do I report inappropriate content?',
    answer: 'Tap the three-dot menu on any clip, reel, or screenshot and select "Report". Our moderation team will review it within 24 hours.',
  },
  {
    id: '9',
    question: 'How do I connect my gaming accounts?',
    answer: 'Go to Profile & Appearance and scroll to "Gaming Handles". You can link your Steam, PlayStation, Xbox, Discord, Epic Games, and Nintendo accounts.',
  },
  {
    id: '10',
    question: 'What video formats are supported?',
    answer: 'We support MP4, MOV, and AVI formats. Maximum file size is 500MB for clips and 100MB for reels. Recommended resolution is 1080p or higher.',
  },
];

function FAQItem({ item }: { item: FAQ }) {
  const [open, setOpen] = useState(false);
  return (
    <TouchableOpacity
      style={[styles.faqCard, open && styles.faqCardOpen]}
      onPress={() => setOpen(v => !v)}
      activeOpacity={0.8}
      testID={`button-faq-${item.id}`}
    >
      <View style={styles.faqRow}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        {open ? <ChevronUp size={18} color="#4ADE80" /> : <ChevronDown size={18} color="#4A5568" />}
      </View>
      {open && <Text style={styles.faqAnswer}>{item.answer}</Text>}
    </TouchableOpacity>
  );
}

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const handleContact = (method: 'email' | 'discord') => {
    if (method === 'email') {
      Linking.openURL('mailto:support@gamefolio.com');
    } else {
      Linking.openURL('https://discord.gg/gamefolio');
    }
  };

  return (
    <View style={styles.container}>
      <AppHeader title="Help & Support" />
      <FlatList
        data={FAQS}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <FAQItem item={item} />}
        contentContainerStyle={{ paddingTop: headerHeight + 16, paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListHeaderComponent={
          <View>
            <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.contactSection}>
            <Text style={styles.contactTitle}>Still need help?</Text>
            <Text style={styles.contactSub}>Our support team is here for you</Text>
            <TouchableOpacity style={styles.contactBtn} onPress={() => handleContact('email')} testID="button-contact-email">
              <Mail size={18} color="#131F2A" />
              <Text style={styles.contactBtnText}>Email Support</Text>
              <ExternalLink size={14} color="#131F2A" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, styles.discordBtn]} onPress={() => handleContact('discord')} testID="button-contact-discord">
              <MessageCircle size={18} color="#FFF" />
              <Text style={[styles.contactBtnText, { color: '#FFF' }]}>Join Discord</Text>
              <ExternalLink size={14} color="#FFF" />
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C1821' },
  sectionTitle: { color: '#64748B', fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12 },
  faqCard: { backgroundColor: '#131F2A', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#1E293B' },
  faqCardOpen: { borderColor: '#4ADE8044' },
  faqRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  faqQuestion: { color: '#FFF', fontSize: 15, fontWeight: '600', flex: 1, lineHeight: 22 },
  faqAnswer: { color: '#94A3B8', fontSize: 14, lineHeight: 22, marginTop: 12 },
  contactSection: { marginTop: 32, padding: 20, backgroundColor: '#131F2A', borderRadius: 16, borderWidth: 1, borderColor: '#1E293B' },
  contactTitle: { color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  contactSub: { color: '#4A5568', fontSize: 14, marginBottom: 16 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4ADE80', borderRadius: 12, paddingVertical: 13, marginBottom: 10 },
  contactBtnText: { color: '#131F2A', fontSize: 15, fontWeight: '700', flex: 1, textAlign: 'center' },
  discordBtn: { backgroundColor: '#5865F2' },
});
