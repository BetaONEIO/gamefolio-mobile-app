import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Image,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Camera, Check, ImagePlus } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/context/OnboardingContext';

export default function OnboardingAvatarScreen() {
  const router = useRouter();
  const { setAvatarUrl } = useOnboarding();
  const [image, setImage] = useState<string | null>(null);

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
    { label: 'Avatar', status: 'active' },
    { label: 'User Type', status: 'pending' },
    { label: 'Age', status: 'pending' },
    { label: 'Wallet', status: 'pending' },
    { label: 'Complete', status: 'pending' },
  ];

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setAvatarUrl(result.assets[0].uri);
    }
  };

  const handleNext = () => {
    router.push('/onboarding/user-type');
  };

  const handleSkip = () => {
    setAvatarUrl(null);
    router.push('/onboarding/user-type');
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
          <View style={styles.topIconContainer}>
            <Camera size={40} color="#94A3B8" />
          </View>

          <Text style={styles.title}>Upload your profile picture</Text>
          
          <View style={styles.optionalBadge}>
            <Text style={styles.optionalText}>Optional</Text>
          </View>

          <TouchableOpacity 
            style={styles.uploadContainer} 
            onPress={pickImage}
            activeOpacity={0.8}
          >
            <View style={[styles.uploadCircle, image ? styles.uploadCircleFilled : null]}>
              {image ? (
                <Image source={{ uri: image }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.placeholderContent}>
                  <ImagePlus size={48} color="#64748B" />
                  <Text style={styles.uploadText}>Tap to upload</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {image && (
            <TouchableOpacity 
              style={styles.changeButton}
              onPress={pickImage}
              activeOpacity={0.7}
            >
              <Text style={styles.changeButtonText}>Change photo</Text>
            </TouchableOpacity>
          )}
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

            {image ? (
              <TouchableOpacity 
                style={styles.nextButton}
                activeOpacity={0.8}
                onPress={handleNext}
              >
                <Text style={styles.nextButtonText}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.skipButton}
                activeOpacity={0.8}
                onPress={handleSkip}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            )}
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
  mainContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  topIconContainer: {
    marginBottom: 24,
    opacity: 0.8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
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
  uploadContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  uploadCircleFilled: {
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderColor: '#4ADE80',
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  uploadText: {
    color: '#64748B',
    fontSize: 14,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 100,
  },
  changeButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeButtonText: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '600' as const,
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
    flex: 1,
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
