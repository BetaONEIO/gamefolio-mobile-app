import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, ChevronLeft, Mail } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, APIError } from '@/lib/api';
import CustomAlert from '@/components/CustomAlert';

export default function ResetPasswordCodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [canResend, setCanResend] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const CODE_LENGTH = 6;

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

  const userEmail = (params.email as string) || '';

  useEffect(() => {
    if (cooldownTime === 0) {
      setCanResend(true);
      return;
    }

    setCanResend(false);
    const intervalId = setInterval(() => {
      setCooldownTime(t => t - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [cooldownTime]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  const handleResend = async () => {
    if (!canResend || isResending || !userEmail) return;

    setIsResending(true);
    setError(false);
    setErrorMessage('');

    try {
      const result = await api.auth.forgotPassword(userEmail);
      console.log('[ResetCode] Resend result:', result);

      showAlert('Code Sent', 'A new password reset code has been sent to your email.', 'success');
      setCooldownTime(60);
    } catch (err) {
      console.error('[ResetCode] Resend error:', err);
      if (err instanceof APIError) {
        showAlert('Error', err.message);
      } else {
        showAlert('Error', 'Failed to resend password reset code. Please try again.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH || isVerifying || !userEmail) return;

    setIsVerifying(true);
    setError(false);
    setErrorMessage('');

    try {
      const result = await api.auth.verifyResetCode(userEmail, code);
      console.log('[ResetCode] Verification result:', result);

      if (result.verified) {
        console.log('[ResetCode] ✅ Code verified, navigating to password reset...');
        setIsVerifying(false);
        router.push({
          pathname: '/reset-password',
          params: { email: userEmail, code }
        });
        return;
      }
    } catch (err) {
      console.error('[ResetCode] Error:', err);
      setError(true);

      if (err instanceof APIError) {
        setErrorMessage(err.message || 'Invalid or expired code');
      } else {
        setErrorMessage('Invalid or expired code');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const colors = {
    background: '#131F2A',
    primary: '#4ADE80',
    inputBg: 'rgba(30, 41, 59, 0.5)',
    text: '#FFFFFF',
    textDim: '#94A3B8',
    buttonText: '#002E15',
    inputBorder: 'rgba(255,255,255,0.1)',
    inputBorderActive: '#4ADE80',
    errorInputBg: '#3F151B',
    errorInputBorder: '#EF4444',
    errorText: '#FF6B6B',
  };

  const handleOnPress = () => {
    inputRef.current?.focus();
  };

  if (!userEmail) {
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

        <View style={styles.scrollContent}>
          <Text style={styles.title}>Error</Text>
          <Text style={styles.subtitle}>Email address not found. Please try again.</Text>
          <TouchableOpacity
            style={styles.mainButton}
            activeOpacity={0.8}
            onPress={() => router.back()}
          >
            <Text style={styles.mainButtonText}>Back</Text>
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
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/forgot-password');
            }
          }}
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
            <Text style={styles.title}>Enter Reset Code</Text>
            <Text style={styles.subtitle}>
              We've sent a 6-digit code to
            </Text>
            {userEmail && (
              <View style={styles.emailContainer}>
                <Mail size={16} color={colors.primary} />
                <Text style={styles.emailText}>{userEmail}</Text>
              </View>
            )}
            <Text style={[styles.subtitle, { marginTop: 8 }]}>
              Check your spam folder if you can't find it
            </Text>
          </View>

          <View style={styles.inputSection}>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(text) => {
                setError(false);
                setErrorMessage('');
                const cleaned = text.replace(/[^0-9]/g, '');
                if (cleaned.length <= CODE_LENGTH) {
                  setCode(cleaned);
                }
              }}
              style={styles.hiddenInput}
              keyboardType="number-pad"
              returnKeyType="done"
              textContentType="oneTimeCode"
              maxLength={CODE_LENGTH}
              autoFocus
            />

            <Pressable style={styles.codeContainer} onPress={handleOnPress}>
              {Array.from({ length: CODE_LENGTH }).map((_, index) => {
                const isActive = index === code.length;
                const isFilled = index < code.length;

                return (
                  <View
                    key={index}
                    style={[
                      styles.codeBox,
                      {
                        borderColor: error
                          ? colors.errorInputBorder
                          : isActive || isFilled ? colors.primary : colors.inputBorder,
                        backgroundColor: error
                          ? colors.errorInputBg
                          : colors.inputBg
                      }
                    ]}
                  >
                    <Text style={styles.codeText}>
                      {code[index] || ''}
                    </Text>
                  </View>
                );
              })}
            </Pressable>

            {error && errorMessage && (
              <Text style={[styles.errorText, { color: colors.errorText }]}>
                {errorMessage}
              </Text>
            )}

            <View style={styles.timerContainer}>
              {!canResend && (
                <Text style={styles.timerText}>
                  Resend available in {formatTime(cooldownTime)}
                </Text>
              )}
              <TouchableOpacity
                onPress={handleResend}
                disabled={!canResend || isResending}
                style={[styles.resendButton, (!canResend || isResending) && styles.resendButtonDisabled]}
              >
                {isResending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.resendText, { color: canResend ? colors.primary : colors.textDim }]}>
                    Resend Code
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.mainButton,
                (code.length !== CODE_LENGTH || isVerifying) && styles.mainButtonDisabled
              ]}
              activeOpacity={0.8}
              onPress={handleVerify}
              disabled={code.length !== CODE_LENGTH || isVerifying}
            >
              {isVerifying ? (
                <ActivityIndicator size="small" color={colors.buttonText} />
              ) : (
                <>
                  <Text style={styles.mainButtonText}>Continue</Text>
                  <ArrowRight size={24} color={colors.buttonText} strokeWidth={2.5} />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    paddingTop: 20,
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
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '90%',
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  emailText: {
    fontSize: 15,
    color: '#4ADE80',
    fontWeight: '600',
  },
  inputSection: {
    width: '100%',
    alignItems: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    width: '100%',
  },
  codeBox: {
    width: 48,
    height: 58,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  timerText: {
    fontSize: 14,
    color: '#94A3B8',
    fontVariant: ['tabular-nums'],
  },
  resendButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resendButtonDisabled: {
    opacity: 0.6,
  },
  resendText: {
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  mainButton: {
    flexDirection: 'row',
    backgroundColor: '#4ADE80',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  mainButtonDisabled: {
    opacity: 0.5,
  },
  mainButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#002E15',
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
});
