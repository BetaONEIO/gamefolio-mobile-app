import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useOnboarding } from '@/context/OnboardingContext';
import { Wallet, Check, Info } from 'lucide-react-native';

export default function OnboardingWalletScreen() {
  const router = useRouter();
  const { data, setWalletAddress } = useOnboarding();
  const [inputValue, setInputValue] = useState(data.walletAddress || '');
  const [error, setError] = useState<string | null>(null);

  const colors = {
    background: '#0F1520', 
    primary: '#4ADE80',    
    text: '#FFFFFF',
    textDim: '#94A3B8',
    surface: '#1E293B',
    surfaceHighlight: '#334155',
    error: '#EF4444',
    warning: '#F59E0B',
  };

  const steps = [
    { label: 'Welcome', status: 'completed' },
    { label: 'Games', status: 'completed' },
    { label: 'Avatar', status: 'completed' },
    { label: 'User Type', status: 'completed' },
    { label: 'Age', status: 'completed' },
    { label: 'Wallet', status: 'active' },
    { label: 'Complete', status: 'pending' },
  ];

  const validateWalletAddress = (address: string): boolean => {
    if (!address) return true;
    
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    const solRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    return ethRegex.test(address) || solRegex.test(address);
  };

  const handleInputChange = (text: string) => {
    setInputValue(text.trim());
    setError(null);
    
    if (text.trim() && !validateWalletAddress(text.trim())) {
      setError('Please enter a valid wallet address');
    }
  };

  const handleNext = () => {
    if (inputValue && !validateWalletAddress(inputValue)) {
      setError('Please enter a valid wallet address');
      return;
    }
    
    setWalletAddress(inputValue || null);
    router.push('/onboarding/complete');
  };

  const handleSkip = () => {
    setWalletAddress(null);
    router.push('/onboarding/complete');
  };

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
            <Wallet size={40} color={colors.warning} />
          </View>

          <Text style={styles.title}>Connect your wallet</Text>
          <Text style={styles.subtitle}>
            Link your crypto wallet to unlock exclusive features and rewards
          </Text>

          <View style={styles.optionalBadge}>
            <Text style={styles.optionalText}>Optional</Text>
          </View>

          <View style={styles.inputContainer}>
            <View style={[
              styles.inputWrapper,
              error && { borderColor: colors.error }
            ]}>
              <Wallet size={20} color="#64748B" />
              <TextInput
                style={styles.input}
                placeholder="Enter wallet address"
                placeholderTextColor="#64748B"
                value={inputValue}
                onChangeText={handleInputChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Info size={14} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>

          <View style={styles.infoContainer}>
            <View style={styles.infoItem}>
              <View style={styles.infoDot} />
              <Text style={styles.infoText}>Supports Ethereum and Solana addresses</Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoDot} />
              <Text style={styles.infoText}>Earn exclusive NFT rewards</Text>
            </View>
            <View style={styles.infoItem}>
              <View style={styles.infoDot} />
              <Text style={styles.infoText}>You can add this later in settings</Text>
            </View>
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
              style={styles.skipButton}
              activeOpacity={0.8}
              onPress={handleSkip}
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>

          {inputValue.length > 0 && !error && (
            <TouchableOpacity 
              style={styles.nextButton}
              activeOpacity={0.8}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>Connect Wallet</Text>
            </TouchableOpacity>
          )}
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
    paddingTop: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
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
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  optionalBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 32,
  },
  optionalText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600' as const,
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
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
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
  infoContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ADE80',
  },
  infoText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  footer: {
    paddingTop: 20,
    paddingBottom: 20,
    gap: 12,
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
  skipButton: {
    flex: 1,
    backgroundColor: 'transparent',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  skipButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#94A3B8',
  },
  nextButton: {
    backgroundColor: '#F59E0B',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000000',
  },
});
