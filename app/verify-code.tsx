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
  Pressable
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, ChevronLeft } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyCodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const inputRef = useRef<TextInput>(null);
  const CODE_LENGTH = 6;

  // Timer logic
  useEffect(() => {
    if (timeLeft === 0) return;
    const intervalId = setInterval(() => {
      setTimeLeft(t => t - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleResend = () => {
    setTimeLeft(20);
    // Logic to resend code would go here
  };

  const colors = {
    background: '#0F1520',
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      
      {/* Header with Back Button */}
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
          {/* Logo Section */}
          <View style={styles.logoContainer}>
            <Image 
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bpo9i1ux8et2igcgnomrk" }}
              style={{ width: 80, height: 80 }}
              contentFit="contain"
            />
          </View>

          {/* Text Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.subtitle}>
              Make sure to check your spam if you couldn&apos;t find it
            </Text>
          </View>

          {/* Code Input Section */}
          <View style={styles.inputSection}>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(text) => {
                setError(false);
                // Only allow numbers and limit length
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

            {error && (
              <Text style={[styles.errorText, { color: colors.errorText }]}>
                Wrong Code. Try Again!
              </Text>
            )}

            {/* Timer and Resend */}
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              <TouchableOpacity onPress={handleResend} disabled={timeLeft > 0}>
                <Text style={[styles.resendText, { opacity: timeLeft > 0 ? 0.5 : 1 }]}>
                  Resend Code
                </Text>
              </TouchableOpacity>
            </View>

            {/* Reset Password Button */}
            <TouchableOpacity 
              style={styles.mainButton}
              activeOpacity={0.8}
              onPress={() => {
                // Handle verification logic
                console.log('Verify code:', code);
                if (code !== '123456') {
                  setError(true);
                } else {
                  router.push('/reset-password');
                }
              }}
            >
              <Text style={styles.mainButtonText}>Reset Password</Text>
              <ArrowRight size={24} color="#002E15" strokeWidth={2.5} />
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    marginBottom: 32,
    width: '100%',
  },
  codeBox: {
    width: 45,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  timerText: {
    fontSize: 14,
    color: '#94A3B8',
    fontVariant: ['tabular-nums'],
  },
  resendText: {
    fontSize: 14,
    color: '#94A3B8',
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
