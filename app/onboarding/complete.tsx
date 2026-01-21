import React, { useEffect, useState, useRef } from 'react';
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
import { Image } from 'expo-image';
import { Check } from 'lucide-react-native';
import OnboardingProgress, { OnboardingStep } from '@/components/OnboardingProgress';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/context/AuthContext';
import { useUser } from '@/context/UserContext';
import { gamefolioOnboarding, mapUserTypeToBackend, getGamefolioToken } from '@/lib/gamefolio-api';

interface SaveStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

export default function OnboardingCompleteScreen() {
  const router = useRouter();
  const { data, resetOnboarding } = useOnboarding();
  const { user, updateUser, getAccessToken } = useAuth();
  const { favoriteGames } = useUser();
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [overallError, setOverallError] = useState<string | null>(null);
  const saveAttemptedRef = useRef(false);
  
  const [saveSteps, setSaveSteps] = useState<SaveStep[]>([
    { id: 'profile', label: 'Saving profile', status: 'pending' },
    { id: 'avatar', label: 'Uploading avatar', status: 'pending' },
    { id: 'games', label: 'Adding favorite games', status: 'pending' },
  ]);

  const updateStepStatus = (stepId: string, status: SaveStep['status'], error?: string) => {
    setSaveSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status, error } : step
    ));
  };

  useEffect(() => {
    const saveOnboardingData = async () => {
      if (saveAttemptedRef.current || !user) return;
      saveAttemptedRef.current = true;
      
      const hasRequiredData = data.userType;
      if (!hasRequiredData) {
        console.log('[Onboarding] Missing required data (userType)');
        setHasSaved(true);
        return;
      }

      setIsSaving(true);
      console.log('[Onboarding] ========================================');
      console.log('[Onboarding] Starting onboarding data sync');
      console.log('[Onboarding] User ID:', user.id);
      console.log('[Onboarding] Username:', data.username || user.username);
      console.log('[Onboarding] User Type:', data.userType);
      console.log('[Onboarding] Age Range:', data.ageRange);
      console.log('[Onboarding] Avatar URI:', data.avatarLocalUri ? 'set' : 'not set');
      console.log('[Onboarding] Games count:', favoriteGames.length);
      console.log('[Onboarding] Create wallet:', data.createWallet);
      console.log('[Onboarding] ========================================');

      try {
        let accessToken = await getAccessToken();
        if (!accessToken) {
          accessToken = await getGamefolioToken();
        }
        
        if (!accessToken) {
          throw new Error('No access token available');
        }

        // STEP 1: Update Profile (REQUIRED)
        updateStepStatus('profile', 'in_progress');
        try {
          const mappedUserType = mapUserTypeToBackend(data.userType || 'viewer');
          console.log('[Onboarding] Mapped userType:', data.userType, '->', mappedUserType);
          
          const profileData = {
            username: data.username || user.username,
            displayName: data.username || user.displayName || user.username,
            bio: 'Just joined Gamefolio!',
            userType: mappedUserType,
            ageRange: '18-24',
          };
          
          const profileResult = await gamefolioOnboarding.updateProfile(
            user.id,
            profileData,
            accessToken
          );
          
          if (profileResult.success && profileResult.user) {
            await updateUser({
              username: profileResult.user.username,
              displayName: profileResult.user.displayName,
              userType: profileResult.user.userType,
              ageRange: profileResult.user.ageRange,
            });
          }
          
          updateStepStatus('profile', 'completed');
          console.log('[Onboarding] ✅ Profile updated successfully');
        } catch (error: any) {
          console.error('[Onboarding] ❌ Profile update failed:', error.message);
          updateStepStatus('profile', 'error', error.message);
          setOverallError('Failed to save profile. Please try again.');
          setIsSaving(false);
          return;
        }

        // STEP 2: Upload Avatar (Optional)
        if (data.avatarLocalUri) {
          updateStepStatus('avatar', 'in_progress');
          try {
            const avatarResult = await gamefolioOnboarding.uploadAvatar(
              data.avatarLocalUri,
              user.id,
              accessToken
            );
            
            if (avatarResult.success && avatarResult.avatarUrl) {
              await updateUser({ avatarUrl: avatarResult.avatarUrl });
            }
            
            updateStepStatus('avatar', 'completed');
            console.log('[Onboarding] ✅ Avatar uploaded successfully');
          } catch (error: any) {
            console.error('[Onboarding] ⚠️ Avatar upload failed:', error.message);
            updateStepStatus('avatar', 'error', error.message);
          }
        } else {
          updateStepStatus('avatar', 'completed');
        }

        // STEP 3: Add Favorite Games (Optional)
        if (favoriteGames.length > 0) {
          updateStepStatus('games', 'in_progress');
          let gamesAdded = 0;
          
          for (const game of favoriteGames) {
            try {
              console.log('[Onboarding] Adding game:', game.name, '(Twitch ID:', game.id, ')');
              
              const dbGame = await gamefolioOnboarding.addGameToDatabase(
                game.id,
                accessToken
              );
              
              await gamefolioOnboarding.addGameToFavorites(
                user.id,
                dbGame.id,
                accessToken
              );
              
              gamesAdded++;
              console.log('[Onboarding] ✅ Game added:', game.name);
            } catch (error: any) {
              console.error('[Onboarding] ⚠️ Failed to add game:', game.name, error.message);
            }
          }
          
          if (gamesAdded > 0) {
            updateStepStatus('games', 'completed');
            console.log('[Onboarding] ✅ Added', gamesAdded, 'games to favorites');
          } else {
            updateStepStatus('games', 'error', 'Could not add games');
          }
        } else {
          updateStepStatus('games', 'completed');
        }

        console.log('[Onboarding] ========================================');
        console.log('[Onboarding] ✅ Onboarding sync completed!');
        console.log('[Onboarding] ========================================');
        
        setHasSaved(true);
        resetOnboarding();
      } catch (error: any) {
        console.error('[Onboarding] ❌ Onboarding sync failed:', error.message);
        setOverallError(error.message);
      } finally {
        setIsSaving(false);
      }
    };

    saveOnboardingData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const colors = {
    background: '#0F1520', 
    primary: '#4ADE80',    
    text: '#FFFFFF',
    textDim: '#94A3B8',
    surface: '#1E293B',
    surfaceHighlight: '#334155',
    error: '#EF4444',
  };

  const steps: OnboardingStep[] = [
    { label: 'Welcome', status: 'completed', route: '/onboarding' },
    { label: 'Games', status: 'completed', route: '/onboarding/games' },
    { label: 'Avatar', status: 'completed', route: '/onboarding/avatar' },
    { label: 'User Type', status: 'completed', route: '/onboarding/user-type' },
    { label: 'Complete', status: 'active', route: '/onboarding/complete' },
  ];

  const canProceed = hasSaved || !isSaving;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <OnboardingProgress steps={steps} currentIndex={4} />

        <View style={styles.mainContent}>
          <View style={styles.iconContainer}>
            <View style={styles.logoCircle}>
              {isSaving ? (
                <ActivityIndicator size="large" color="#4ADE80" />
              ) : (
                <Image 
                  source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bpo9i1ux8et2igcgnomrk" }}
                  style={styles.logoImage}
                  contentFit="contain"
                />
              )}
            </View>
            <View style={styles.glowEffect} />
          </View>

          <Text style={styles.title}>
            {isSaving ? 'Setting up your account...' : 'Setup Complete'}
          </Text>
          <Text style={styles.subtitle}>
            {isSaving ? 'Please wait while we sync your preferences' : "You're ready to join the game."}
          </Text>

          {isSaving && (
            <View style={styles.stepsContainer}>
              {saveSteps.map((step) => (
                <View key={step.id} style={styles.saveStepRow}>
                  <View style={[
                    styles.saveStepIndicator,
                    step.status === 'completed' && { backgroundColor: colors.primary },
                    step.status === 'in_progress' && { backgroundColor: colors.primary, opacity: 0.5 },
                    step.status === 'error' && { backgroundColor: colors.error },
                  ]}>
                    {step.status === 'completed' && <Check size={12} color="#002E15" strokeWidth={3} />}
                    {step.status === 'in_progress' && <ActivityIndicator size="small" color="#002E15" />}
                  </View>
                  <Text style={[
                    styles.saveStepLabel,
                    step.status === 'completed' && { color: colors.primary },
                    step.status === 'error' && { color: colors.error },
                  ]}>
                    {step.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {overallError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{overallError}</Text>
            </View>
          )}

          {!isSaving && data.userType && (
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
              {favoriteGames.length > 0 && (
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Favorite Games</Text>
                  <Text style={styles.summaryValue}>{favoriteGames.length} selected</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.primaryButton, !canProceed && styles.primaryButtonDisabled]}
            activeOpacity={0.8}
            onPress={() => router.replace('/(drawer)/(tabs)/home')}
            disabled={!canProceed}
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
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logoImage: {
    width: 70,
    height: 70,
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
  stepsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  saveStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveStepIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveStepLabel: {
    fontSize: 14,
    color: '#94A3B8',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
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
