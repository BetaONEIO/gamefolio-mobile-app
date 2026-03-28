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
import { Camera } from 'lucide-react-native';
import OnboardingProgress, { OnboardingStep } from '@/components/OnboardingProgress';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/context/OnboardingContext';

export default function OnboardingAvatarScreen() {
  const router = useRouter();
  const { setAvatarUrl, setAvatarLocalUri } = useOnboarding();
  const [image, setImage] = useState<string | null>(null);

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
    { label: 'Avatar', status: 'active', route: '/onboarding/avatar' },
    { label: 'User Type', status: 'pending', route: '/onboarding/user-type' },
    { label: 'Wallet', status: 'pending', route: '/onboarding/wallet' },
    { label: 'Complete', status: 'pending', route: '/onboarding/complete' },
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
      const uri = result.assets[0].uri;
      setImage(uri);
      setAvatarUrl(uri);
      setAvatarLocalUri(uri);
    }
  };

  const handleNext = () => {
    router.push('/onboarding/user-type' as any);
  };



  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <OnboardingProgress steps={steps} currentIndex={2} />

        <View style={styles.mainContent}>
          <Text style={styles.cameraEmoji}>📷</Text>

          <Text style={styles.title}>Upload your profile picture</Text>
          <Text style={styles.optionalText}>(Optional)</Text>

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
                  <Camera size={56} color="#4B5563" />
                </View>
              )}
            </View>
          </TouchableOpacity>

          {image ? (
            <TouchableOpacity 
              style={styles.changeButton}
              onPress={pickImage}
              activeOpacity={0.7}
            >
              <Text style={styles.changeButtonText}>Change photo</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.skipButton}
              onPress={handleNext}
              activeOpacity={0.7}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={() => router.navigate('/onboarding/games')}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.nextButton}
              activeOpacity={0.8}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>Next</Text>
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
  
  mainContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  cameraEmoji: {
    fontSize: 48,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  optionalText: {
    color: '#94A3B8',
    fontSize: 16,
    marginBottom: 40,
  },
  uploadContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#374151',
    borderStyle: 'dotted',
  },
  uploadCircleFilled: {
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderColor: '#4ADE80',
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
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
  skipButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500' as const,
    textDecorationLine: 'underline' as const,
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
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#002E15',
  },
});
