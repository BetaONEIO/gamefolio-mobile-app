import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
} from 'react-native';
import ScrollView from '@/components/ThemedScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Gamepad2, Upload, Share2, ArrowRight, Sparkles } from 'lucide-react-native';

export default function OnboardingWelcomeScreen() {
  const router = useRouter();

  const colors = {
    background: '#0F1520',
    primary: '#4ADE80',
    text: '#FFFFFF',
    textDim: '#94A3B8',
    surface: '#1E293B',
  };

  const steps = [
    { label: 'Welcome', active: true, completed: false },
    { label: 'Games', active: false, completed: false },
    { label: 'Avatar', active: false, completed: false },
    { label: 'User Type', active: false, completed: false },
    { label: 'Age', active: false, completed: false },
    { label: 'Wallet', active: false, completed: false },
    { label: 'Complete', active: false, completed: false },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <View style={styles.progressContainer}>
          <View style={styles.stepsRow}>
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <View style={styles.stepWrapper}>
                  <View style={[
                    styles.stepCircle, 
                    step.active && { backgroundColor: colors.primary, borderColor: colors.primary },
                    !step.active && { backgroundColor: 'transparent', borderColor: '#334155' }
                  ]}>
                    <Text style={[
                      styles.stepNumber,
                      step.active ? { color: '#002E15' } : { color: '#64748B' }
                    ]}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    step.active ? { color: '#FFFFFF' } : { color: '#64748B' }
                  ]} numberOfLines={1}>
                    {step.label}
                  </Text>
                </View>
                
                {index < steps.length - 1 && (
                  <View style={styles.stepLine} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.heroContainer}>
            <View style={styles.heroIconContainer}>
              <Sparkles size={32} color={colors.primary} />
            </View>
            <Text style={styles.title}>Welcome to Gamefolio!</Text>
            <Text style={styles.subtitle}>
              Upload your best gaming clips to show off or store any clips you like.
            </Text>
          </View>

          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                <Gamepad2 size={24} color="#4ADE80" />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Source your clips</Text>
                <Text style={styles.featureDescription}>From your favourite games</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Upload size={24} color="#3B82F6" />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Upload your clips</Text>
                <Text style={styles.featureDescription}>Share your best moments</Text>
              </View>
            </View>

            <View style={styles.featureItem}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
                <Share2 size={24} color="#A855F7" />
              </View>
              <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>Share online</Text>
                <Text style={styles.featureDescription}>Connect with gamers worldwide</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.socialLink}>
            <Text style={styles.socialLinkText}>Check us out on Socials</Text>
            <ArrowRight size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.nextButton}
            activeOpacity={0.8}
            onPress={() => {
              router.push('/onboarding/games');
            }}
          >
            <Text style={styles.nextButtonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  progressContainer: {
    marginTop: 20,
    marginBottom: 40,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepWrapper: {
    alignItems: 'center',
    zIndex: 1,
    width: 40,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#0F1520',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  stepLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#334155',
    marginTop: 13, 
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  heroContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  featuresContainer: {
    gap: 16,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600' as const,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    color: '#94A3B8',
  },
  socialLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 'auto',
    marginBottom: 20,
  },
  socialLinkText: {
    fontSize: 16,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
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
    fontWeight: '700' as const,
    color: '#002E15',
  },
});
