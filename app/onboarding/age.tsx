import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
} from 'react-native';
import ThemedScrollView from '@/components/ThemedScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useOnboarding } from '@/context/OnboardingContext';
import { 
  Target,
  Check
} from 'lucide-react-native';

export default function OnboardingAgeScreen() {
  const router = useRouter();
  const { data, setAgeRange } = useOnboarding();
  const [selectedAge, setSelectedAge] = useState<string | null>(data.ageRange);

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
    { label: 'Age', status: 'active' },
    { label: 'Wallet', status: 'pending' },
    { label: 'Complete', status: 'pending' },
  ];

  useEffect(() => {
    if (selectedAge) {
      setAgeRange(selectedAge);
    }
  }, [selectedAge, setAgeRange]);

  const ageOptions = [
    { id: '13-17', label: '13-17', subLabel: 'Teen gamer', emoji: '🎮' },
    { id: '18-24', label: '18-24', subLabel: 'Young adult', emoji: '🚀' },
    { id: '25-34', label: '25-34', subLabel: 'Adult gamer', emoji: '💼' },
    { id: '35-44', label: '35-44', subLabel: 'Veteran', emoji: '🎖️' },
    { id: '45-54', label: '45-54', subLabel: 'OG gamer', emoji: '👑' },
    { id: '55+', label: '55+', subLabel: 'Legend', emoji: '🏆' },
  ];

  const canProceed = selectedAge !== null;

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

        <ThemedScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.headerColumn}>
            <View style={styles.targetIconContainer}>
               <Target size={40} color="#F87171" fill="#F87171" fillOpacity={0.2} />
            </View>
            <Text style={styles.title}>What&apos;s your age range?</Text>
            <Text style={styles.subtitle}>
              This helps us provide age-appropriate content and recommendations
            </Text>
          </View>

          <View style={styles.grid}>
            {ageOptions.map((option) => {
              const isSelected = selectedAge === option.id;
              
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.card,
                    isSelected && styles.cardSelected
                  ]}
                  onPress={() => setSelectedAge(option.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emoji}>{option.emoji}</Text>
                  <Text style={styles.cardLabel}>{option.label}</Text>
                  <Text style={[
                    styles.cardSubLabel,
                    isSelected && styles.cardSubLabelSelected
                  ]}>{option.subLabel}</Text>
                  
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Check size={12} color="#002E15" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

        </ThemedScrollView>

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
                  router.push('/onboarding/wallet');
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
  headerColumn: {
    alignItems: 'center',
    marginBottom: 32,
  },
  targetIconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: '90%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%', 
    backgroundColor: '#0F1520',
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
    marginBottom: 4,
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: '#1F4631', 
    borderColor: '#4ADE80',
  },
  emoji: {
    fontSize: 32,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubLabel: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  cardSubLabelSelected: {
    color: '#FFFFFF',
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4ADE80',
    alignItems: 'center',
    justifyContent: 'center',
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
