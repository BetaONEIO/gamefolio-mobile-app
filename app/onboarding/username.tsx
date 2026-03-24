import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useOnboarding } from '@/context/OnboardingContext';
import { AtSign, Check, X, Info } from 'lucide-react-native';
import { useDebounce } from '@/hooks/useDebounce';
import { trpcClient } from '@/lib/trpc';

export default function OnboardingUsernameScreen() {
  const router = useRouter();
  const { data, setUsername } = useOnboarding();
  const [inputValue, setInputValue] = useState(data.username || '');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const debouncedUsername = useDebounce(inputValue, 500);

  const colors = {
    background: '#131F2A', 
    primary: '#4ADE80',    
    text: '#FFFFFF',
    textDim: '#94A3B8',
    surface: '#1E293B',
    surfaceHighlight: '#334155',
    error: '#EF4444',
  };

  const steps = [
    { label: 'Welcome', status: 'completed' },
    { label: 'Username', status: 'active' },
    { label: 'Games', status: 'pending' },
    { label: 'Avatar', status: 'pending' },
    { label: 'User Type', status: 'pending' },
    { label: 'Age', status: 'pending' },
    { label: 'Wallet', status: 'pending' },
    { label: 'Complete', status: 'pending' },
  ];

  const validateUsername = (username: string): string | null => {
    if (username.length < 3) {
      return 'Username must be at least 3 characters';
    }
    if (username.length > 20) {
      return 'Username must be 20 characters or less';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return 'Only letters, numbers, and underscores allowed';
    }
    if (/^\d/.test(username)) {
      return 'Username cannot start with a number';
    }
    return null;
  };

  useEffect(() => {
    const checkAvailability = async () => {
      if (!debouncedUsername || debouncedUsername.length < 3) {
        setIsAvailable(null);
        setError(null);
        return;
      }

      const validationError = validateUsername(debouncedUsername);
      if (validationError) {
        setError(validationError);
        setIsAvailable(false);
        return;
      }

      setIsChecking(true);
      setError(null);

      try {
        const result = await trpcClient.auth.checkUsername.query({ username: debouncedUsername });
        if (result.available) {
          setIsAvailable(true);
          setUsername(debouncedUsername.toLowerCase());
        } else {
          setIsAvailable(false);
          setError('Username is already taken');
        }
      } catch (err) {
        console.error('[Username] Error checking availability:', err);
        setError('Failed to check availability');
        setIsAvailable(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAvailability();
  }, [debouncedUsername, setUsername]);

  const handleInputChange = (text: string) => {
    const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setInputValue(cleaned);
    setIsAvailable(null);
  };

  const canProceed = isAvailable === true && inputValue.length >= 3;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <View style={styles.progressContainer}>
          <View style={styles.stepsRow}>
            {steps.slice(0, 6).map((step, index) => (
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
                
                {index < 5 && (
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
            <AtSign size={40} color={colors.primary} />
          </View>

          <Text style={styles.title}>Choose your username</Text>
          <Text style={styles.subtitle}>
            This will be your unique identifier on Gamefolio
          </Text>

          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <Text style={styles.atSymbol}>@</Text>
              <TextInput
                style={styles.input}
                placeholder="username"
                placeholderTextColor="#64748B"
                value={inputValue}
                onChangeText={handleInputChange}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {isChecking && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
              {!isChecking && isAvailable === true && (
                <Check size={20} color={colors.primary} />
              )}
              {!isChecking && isAvailable === false && (
                <X size={20} color={colors.error} />
              )}
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Info size={14} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {isAvailable === true && !error && (
              <Text style={styles.successText}>Username is available!</Text>
            )}
          </View>

          <View style={styles.rulesContainer}>
            <Text style={styles.rulesTitle}>Username rules:</Text>
            <Text style={styles.ruleText}>• 3-20 characters long</Text>
            <Text style={styles.ruleText}>• Letters, numbers, and underscores only</Text>
            <Text style={styles.ruleText}>• Cannot start with a number</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.nextButton,
                !canProceed && styles.nextButtonDisabled
              ]}
              activeOpacity={0.8}
              onPress={() => {
                if (canProceed) {
                  router.push('/onboarding/games');
                }
              }}
              disabled={!canProceed}
            >
              <Text style={[
                styles.nextButtonText,
                !canProceed && styles.nextButtonTextDisabled
              ]}>Next</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#131F2A',
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
    paddingTop: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: '#334155',
  },
  atSymbol: {
    fontSize: 18,
    color: '#64748B',
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
  },
  successText: {
    color: '#4ADE80',
    fontSize: 14,
    marginTop: 8,
  },
  rulesContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    width: '100%',
  },
  rulesTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  ruleText: {
    fontSize: 14,
    color: '#4ADE80',
    marginBottom: 4,
  },
  footer: {
    paddingTop: 20,
    paddingBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#334155',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#4ADE80',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonDisabled: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#002E15',
  },
  nextButtonTextDisabled: {
    color: '#64748B',
  },
});
