import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check } from 'lucide-react-native';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/context/AuthContext';
import { trpc } from '@/lib/trpc';

export default function OnboardingCompleteScreen() {
  const router = useRouter();
  const { data, resetOnboarding } = useOnboarding();
  const { user, updateUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const updateProfileMutation = trpc.user.updateProfile.useMutation();

  useEffect(() => {
    const saveOnboardingData = async () => {
      if (hasSaved || !user) return;
      
      if (!data.userType && !data.ageRange) {
        console.log('[Onboarding] No data to save');
        setHasSaved(true);
        return;
      }

      setIsSaving(true);
      try {
        console.log('[Onboarding] Saving user type:', data.userType);
        console.log('[Onboarding] Saving age range:', data.ageRange);
        console.log('[Onboarding] Saving wallet address:', data.walletAddress);
        
        const result = await updateProfileMutation.mutateAsync({
          userType: data.userType || undefined,
          showUserType: true,
          ageRange: data.ageRange || undefined,
        });

        if (result.success && result.user) {
          await updateUser({
            userType: result.user.userType,
            ageRange: result.user.ageRange,
          });
          console.log('[Onboarding] Profile updated successfully');
        }
        
        setHasSaved(true);
        resetOnboarding();
      } catch (error) {
        console.error('[Onboarding] Failed to save profile:', error);
        setHasSaved(true);
      } finally {
        setIsSaving(false);
      }
    };

    saveOnboardingData();
  }, [user, data, hasSaved, updateProfileMutation, updateUser, resetOnboarding]);

  const colors = {
    background: '#0F1520', 
    primary: '#4ADE80',    
    text: '#FFFFFF',
    textDim: '#94A3B8',
    surface: '#1E293B',
    surfaceHighlight: '#334155',
  };

  const steps = [
    { label: 'Welcome', status: 'completed' },
    { label: 'Games', status: 'completed' },
    { label: 'Avatar', status: 'completed' },
    { label: 'User Type', status: 'completed' },
    { label: 'Age', status: 'completed' },
    { label: 'Wallet', status: 'completed' },
    { label: 'Complete', status: 'active' },
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
                    step.status === 'active' && { backgroundColor: colors.primary, borderColor: colors.primary },
                    step.status === 'completed' && { backgroundColor: colors.primary, borderColor: colors.primary },
                    step.status === 'pending' && { backgroundColor: 'transparent', borderColor: '#334155' }
                  ]}>
                    {step.status === 'completed' ? (
                      <Check size={16} color="#002E15" strokeWidth={3} />
                    ) : (
                      <Text style={[
                        styles.stepNumber,
                        step.status === 'active' ? { color: '#002E15' } : { color: '#64748B' }
                      ]}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    step.status === 'active' || step.status === 'completed' ? { color: '#FFFFFF' } : { color: '#64748B' }
                  ]} numberOfLines={1}>
                    {step.label}
                  </Text>
                </View>
                
                {index < steps.length - 1 && (
                  <View style={[
                    styles.stepLine,
                    (steps[index].status === 'completed' && steps[index+1].status !== 'pending') && { backgroundColor: colors.primary }
                  ]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.mainContent}>
          <View style={styles.iconContainer}>
            <View style={styles.checkCircle}>
              <Check size={48} color="#002E15" strokeWidth={4} />
            </View>
            <View style={styles.glowEffect} />
          </View>

          <Text style={styles.title}>Your Gamefolio account is now complete</Text>
          <Text style={styles.subtitle}>
            You&apos;re ready to join the game.
          </Text>

          {data.userType && (
            <View style={styles.summaryContainer}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>User Type</Text>
                <Text style={styles.summaryValue}>
                  {data.userType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
              </View>
              {data.ageRange && (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Age Range</Text>
                  <Text style={styles.summaryValue}>{data.ageRange}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.primaryButton, isSaving && styles.primaryButtonDisabled]}
            activeOpacity={0.8}
            onPress={() => router.replace('/(drawer)/(tabs)/home')}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#002E15" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Open Gamefolio</Text>
            )}
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
    marginBottom: 30,
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
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  glowEffect: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#4ADE80',
    opacity: 0.15,
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  summaryContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    gap: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  footer: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#4ADE80',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#002E15',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
});
