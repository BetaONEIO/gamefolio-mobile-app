import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';

export type StepStatus = 'completed' | 'active' | 'pending';

export interface OnboardingStep {
  label: string;
  status: StepStatus;
  route: string;
}

interface OnboardingProgressProps {
  steps: OnboardingStep[];
  currentIndex: number;
}

const ROUTE_MAP: Record<string, string> = {
  'Welcome': '/onboarding',
  'Games': '/onboarding/games',
  'Avatar': '/onboarding/avatar',
  'User Type': '/onboarding/user-type',
  'Age': '/onboarding/age',
  'Wallet': '/onboarding/wallet',
  'Complete': '/onboarding/complete',
};

export default function OnboardingProgress({ steps, currentIndex }: OnboardingProgressProps) {
  const router = useRouter();
  const primaryColor = '#4ADE80';

  const handleStepPress = (step: OnboardingStep, index: number) => {
    if (index === currentIndex) return;
    
    if (step.status === 'completed' || step.status === 'active') {
      const route = step.route || ROUTE_MAP[step.label];
      if (route) {
        router.replace(route as any);
      }
    }
  };

  return (
    <View style={styles.progressContainer}>
      <View style={styles.stepsRow}>
        {steps.map((step, index) => {
          const isClickable = step.status === 'completed' || step.status === 'active';
          
          return (
            <React.Fragment key={index}>
              <TouchableOpacity 
                style={styles.stepWrapper}
                onPress={() => handleStepPress(step, index)}
                disabled={!isClickable || index === currentIndex}
                activeOpacity={isClickable ? 0.7 : 1}
              >
                <View style={[
                  styles.stepCircle, 
                  step.status === 'active' && { backgroundColor: primaryColor, borderColor: primaryColor },
                  step.status === 'completed' && { backgroundColor: primaryColor, borderColor: primaryColor },
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
              </TouchableOpacity>
              
              {index < steps.length - 1 && (
                <View style={[
                  styles.stepLine,
                  (steps[index].status === 'completed' && steps[index+1].status !== 'pending') && { backgroundColor: primaryColor }
                ]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
