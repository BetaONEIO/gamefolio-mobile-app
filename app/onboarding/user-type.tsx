import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity,
  ScrollView, 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useOnboarding } from '@/context/OnboardingContext';
import { 
  Video, 
  Gamepad2, 
  Trophy, 
  Upload, 
  Code, 
  Eye, 
  Coffee, 
  Scroll,
  Check
} from 'lucide-react-native';
import OnboardingProgress, { OnboardingStep } from '@/components/OnboardingProgress';

export default function OnboardingUserTypeScreen() {
  const router = useRouter();
  const { data, setUserType } = useOnboarding();
  const [selectedType, setSelectedType] = useState<string | null>(data.userType);

  const colors = {
    background: '#131F2A', 
    primary: '#4ADE80',    
    text: '#FFFFFF',
    textDim: '#94A3B8',
    surface: '#1E293B',
    surfaceHighlight: '#334155',
  };

  const steps: OnboardingStep[] = [
    { label: 'Welcome', status: 'completed', route: '/onboarding' },
    { label: 'Games', status: 'completed', route: '/onboarding/games' },
    { label: 'Avatar', status: 'completed', route: '/onboarding/avatar' },
    { label: 'User Type', status: 'active', route: '/onboarding/user-type' },
    { label: 'Complete', status: 'pending', route: '/onboarding/complete' },
  ];

  const userTypes = [
    {
      id: 'streamer',
      title: 'Streamer',
      description: 'I stream games live to audiences',
      icon: Video,
      color: '#A855F7',
      bgColor: 'rgba(168, 85, 247, 0.15)',
    },
    {
      id: 'gamer',
      title: 'Gamer',
      description: 'I love playing games casually',
      icon: Gamepad2,
      color: '#22C55E',
      bgColor: 'rgba(34, 197, 94, 0.15)',
    },
    {
      id: 'professional_gamer',
      title: 'Professional Gamer',
      description: 'I compete in esports or tournaments',
      icon: Trophy,
      color: '#EAB308',
      bgColor: 'rgba(234, 179, 8, 0.15)',
    },
    {
      id: 'content_creator',
      title: 'Content Creator',
      description: 'I create gaming videos and content',
      icon: Upload,
      color: '#3B82F6',
      bgColor: 'rgba(59, 130, 246, 0.15)',
    },
    {
      id: 'indie_developer',
      title: 'Indie Developer',
      description: 'I develop games independently',
      icon: Code,
      color: '#06B6D4',
      bgColor: 'rgba(6, 182, 212, 0.15)',
    },
    {
      id: 'viewer',
      title: 'Viewer',
      description: 'I mostly watch gaming content',
      icon: Eye,
      color: '#6B7280',
      bgColor: 'rgba(107, 114, 128, 0.15)',
    },
    {
      id: 'filthy_casual',
      title: 'Filthy Casual',
      description: 'I play games when I have time',
      icon: Coffee,
      color: '#F97316',
      bgColor: 'rgba(249, 115, 22, 0.15)',
    },
    {
      id: 'doom_scroller',
      title: 'Doom Scroller',
      description: 'I watch clips all day long',
      icon: Scroll,
      color: '#EF4444',
      bgColor: 'rgba(239, 68, 68, 0.15)',
    }
  ];

  const handleSelectType = (id: string) => {
    setSelectedType(id);
    setUserType(id);
  };

  const canProceed = selectedType !== null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <OnboardingProgress steps={steps} currentIndex={3} />

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>What type of user are you?</Text>
          <Text style={styles.subtitle}>
            Select the one that best describes you
          </Text>

          <View style={styles.grid}>
            {userTypes.map((type) => {
              const isSelected = selectedType === type.id;
              const Icon = type.icon;
              
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.card,
                    isSelected && [styles.cardSelected, { borderColor: colors.primary }]
                  ]}
                  onPress={() => handleSelectType(type.id)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.iconCircle,
                    { backgroundColor: isSelected ? colors.primary : type.bgColor }
                  ]}>
                    <Icon 
                      size={24} 
                      color={isSelected ? '#FFFFFF' : type.color} 
                    />
                  </View>
                  <Text style={[
                    styles.cardTitle,
                    isSelected && { color: colors.primary }
                  ]}>{type.title}</Text>
                  <Text style={styles.cardDescription}>{type.description}</Text>
                  
                  {isSelected && (
                    <View style={[styles.checkBadge, { backgroundColor: colors.primary }]}>
                      <Check size={12} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={() => router.navigate('/onboarding/avatar')}
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
                  router.push('/onboarding/complete');
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
  
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
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
    marginBottom: 24,
    lineHeight: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '48%',
    backgroundColor: '#131F2A',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
    minHeight: 160,
    position: 'relative',
  },
  cardSelected: {
    backgroundColor: '#1E293B',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
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
