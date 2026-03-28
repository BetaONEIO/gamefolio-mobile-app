import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Gamepad2, Upload, Share2, LogOut } from 'lucide-react-native';
import OnboardingProgress, { OnboardingStep } from '@/components/OnboardingProgress';
import { useAuth } from '@/context/AuthContext';

export default function OnboardingWelcomeScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  const steps: OnboardingStep[] = [
    { label: 'Welcome', status: 'active', route: '/onboarding' },
    { label: 'Games', status: 'pending', route: '/onboarding/games' },
    { label: 'Avatar', status: 'pending', route: '/onboarding/avatar' },
    { label: 'User Type', status: 'pending', route: '/onboarding/user-type' },
    { label: 'Wallet', status: 'pending', route: '/onboarding/wallet' },
    { label: 'Complete', status: 'pending', route: '/onboarding/complete' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <View style={styles.progressWrapper}>
          <OnboardingProgress steps={steps} currentIndex={0} />
        </View>

        <View style={styles.mainContent}>
          <View style={styles.textSection}>
            <Text style={styles.title}>Welcome to Gamefolio!</Text>
            <Text style={styles.subtitle}>
              Upload your best gaming clips to show off or store any clips you like.
            </Text>
          </View>

          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <View style={styles.iconCircle}>
                <Gamepad2 size={24} color="#4ADE80" />
              </View>
              <Text style={styles.featureText}>
                Source your clips from your{'\n'}favourite games
              </Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.iconCircle}>
                <Upload size={24} color="#4ADE80" />
              </View>
              <Text style={styles.featureText}>Upload your clips</Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.iconCircle}>
                <Share2 size={24} color="#4ADE80" />
              </View>
              <Text style={styles.featureText}>Share online</Text>
            </View>
          </View>

        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.nextButton}
            activeOpacity={0.8}
            onPress={() => {
              router.push('/onboarding/games');
            }}
          >
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.7}
            onPress={handleLogout}
          >
            <LogOut size={15} color="#64748B" />
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1821',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  progressWrapper: {
    marginBottom: 30,
  },
  mainContent: {
    flex: 1,
  },
  textSection: {
    marginBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#94A3B8',
    lineHeight: 28,
  },
  featuresContainer: {
    gap: 24,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 22,
    flex: 1,
  },
  footer: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  nextButton: {
    backgroundColor: '#4ADE80',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#0D1821',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 14,
    color: '#64748B',
  },
});
