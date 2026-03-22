import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Mail, ArrowRight, ChevronLeft, CheckCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, APIError } from '@/lib/api';
import CustomAlert from '@/components/CustomAlert';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'error' | 'success';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'error',
  });

  const colors = {
    background: '#131F2A',
    primary: '#4ADE80',
    inputBg: 'rgba(30, 41, 59, 0.5)',
    text: '#FFFFFF',
    textDim: '#94A3B8',
    buttonText: '#002E15',
  };

  const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      showAlert('Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email.trim())) {
      showAlert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    console.log('[ForgotPassword] Requesting password reset for:', email);

    try {
      const result = await api.auth.forgotPassword(email.trim().toLowerCase());
      console.log('[ForgotPassword] Success:', result);
      setEmailSent(true);
    } catch (error) {
      console.error('[ForgotPassword] Error:', error);
      if (error instanceof APIError) {
        showAlert('Error', error.message);
      } else {
        showAlert('Error', 'Failed to send password reset email. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()} 
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <CheckCircle size={64} color={colors.primary} />
          </View>
          
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successSubtitle}>
            We&apos;ve sent a password reset link to
          </Text>
          <View style={styles.emailBadge}>
            <Mail size={16} color={colors.primary} />
            <Text style={styles.emailBadgeText}>{email}</Text>
          </View>
          <Text style={styles.successNote}>
            Click the link in the email to reset your password. If you don&apos;t see it, check your spam folder.
          </Text>

          <TouchableOpacity 
            style={styles.mainButton}
            activeOpacity={0.8}
            onPress={() => router.back()}
          >
            <Text style={styles.mainButtonText}>Back to Login</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.resendButton}
            activeOpacity={0.7}
            onPress={() => {
              setEmailSent(false);
            }}
          >
            <Text style={styles.resendButtonText}>Didn&apos;t receive the email? Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoContainer}>
            <Image 
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bpo9i1ux8et2igcgnomrk" }}
              style={{ width: 80, height: 80 }}
              contentFit="contain"
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>Forgot password?</Text>
            <Text style={styles.subtitle}>
              Enter your email and we&apos;ll send you a link to reset your password
            </Text>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.inputWrapper}>
              <View style={styles.inputContainer}>
                <Mail size={20} color={colors.textDim} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={colors.textDim}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!isLoading}
                />
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.mainButton, isLoading && styles.mainButtonDisabled]}
              activeOpacity={0.8}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <>
                  <Text style={styles.mainButtonText}>Send Reset Link</Text>
                  <ArrowRight size={24} color="#002E15" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={hideAlert}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 40, 
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    height: '100%',
  },
  mainButton: {
    flexDirection: 'row',
    backgroundColor: '#4ADE80',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  mainButtonDisabled: {
    opacity: 0.6,
  },
  mainButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#002E15',
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 12,
  },
  emailBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  emailBadgeText: {
    fontSize: 15,
    color: '#4ADE80',
    fontWeight: '600',
  },
  successNote: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    maxWidth: '90%',
  },
  resendButton: {
    marginTop: 16,
    paddingVertical: 12,
  },
  resendButtonText: {
    fontSize: 14,
    color: '#4ADE80',
    textDecorationLine: 'underline',
  },
});
