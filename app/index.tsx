import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Image } from 'expo-image';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Lock, Eye, EyeOff, ArrowRight, User as UserIcon, AlertCircle, CheckCircle, Calendar, LogOut, Shield } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useDailyStreak } from '@/context/DailyStreakContext';
import { api, APIError } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { isUsernameAppropriate } from '@/lib/profanity-filter';
import CustomAlert from '@/components/CustomAlert';
import BirthdayModal from '@/components/BirthdayModal';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const IS_NATIVE = Platform.OS !== 'web';

const AUTH_CALLBACK_URL = 'rork-app://auth/callback';

const DiscordIcon = () => (
  <Image
    source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/l21j0f0i00etp3mwj2la4' }}
    style={{ width: 20, height: 20, marginRight: 10 }}
    contentFit="contain"
  />
);

const GoogleIcon = () => (
  <Image
    source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/czhxg76zoiqxnvz55x8bj' }}
    style={{ width: 24, height: 24, marginRight: 10 }}
    contentFit="contain"
  />
);

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { login: loginUser, isLoading: authLoading, isAuthenticated, user, logout: logoutUser } = useAuth();
  const { showStreak } = useDailyStreak();
  const [isLogin, setIsLogin] = useState(true);
  const [twoFAPending, setTwoFAPending] = useState(false);
  const [twoFAUserId, setTwoFAUserId] = useState<number | null>(null);
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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
  const [referralCode, setReferralCode] = useState('');
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });
  
  const debouncedUsername = useDebounce(username, 300);
  const isProcessingOAuthRef = useRef(false);

  // Shared OAuth callback handler - used by both Google and Discord
  const handleOAuthCallback = useCallback(async (code: string, provider: 'google' | 'discord') => {
    if (isProcessingOAuthRef.current) {
      console.log(`[${provider} OAuth] Already processing, skipping...`);
      return;
    }

    isProcessingOAuthRef.current = true;
    if (provider === 'discord') {
      setIsDiscordLoading(true);
    } else {
      setIsGoogleLoading(true);
    }

    try {
      console.log(`[${provider} OAuth] Exchanging auth code for tokens...`);
      const data = await api.auth.mobileExchange(code);

      console.log(`[${provider} OAuth] Got user:`, data.user.username);
      await loginUser(data.user, data.accessToken, data.refreshToken, data.expiresIn || 7 * 24 * 60 * 60);

      const needsOnboarding = data.needsOnboarding ||
        !data.user.userType ||
        !data.user.ageRange ||
        (data.user.username && data.user.username.startsWith('temp_'));

      if (needsOnboarding) {
        console.log(`[${provider} OAuth] User needs onboarding, redirecting...`);
        router.replace('/onboarding');
      } else {
        console.log(`[${provider} OAuth] Login complete, redirecting to home...`);
        router.replace('/(drawer)/(tabs)/home');
      }
    } catch (error: any) {
      console.error(`[${provider} OAuth] Error:`, error);
      const providerName = provider === 'google' ? 'Google' : 'Discord';
      showAlert(`${providerName} Login Failed`, error.message || `Failed to authenticate with ${providerName}`);
    } finally {
      setIsDiscordLoading(false);
      setIsGoogleLoading(false);
      isProcessingOAuthRef.current = false;
    }
  }, [loginUser, router]);

  // Listen for deep link callbacks (handles both Google and Discord OAuth)
  // Only processes rork-app:// scheme URLs to avoid triggering on regular web navigation
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      if (!event.url.startsWith('rork-app://')) return;
      console.log('[Deep Link] Received OAuth URL:', event.url);

      try {
        const url = new URL(event.url);
        const code = url.searchParams.get('code');
        const errorMsg = url.searchParams.get('message');

        if (event.url.includes('auth/error') && errorMsg) {
          console.error('[Deep Link] OAuth error:', errorMsg);
          showAlert('Login Failed', decodeURIComponent(errorMsg));
          return;
        }

        if (code && event.url.includes('auth/callback')) {
          console.log('[Deep Link] Got OAuth auth code, processing...');
          const provider = isGoogleLoading ? 'google' : 'discord';
          handleOAuthCallback(code, provider);
        }
      } catch (e) {
        console.error('[Deep Link] Error parsing URL:', e);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url && url.startsWith('rork-app://')) {
        console.log('[Deep Link] Initial OAuth URL:', url);
        handleDeepLink({ url });
      }
    });

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => {
      subscription.remove();
    };
  }, [handleOAuthCallback, isGoogleLoading]);

  // Handle web OAuth return — detects ?code= and ?provider= in URL after redirect back
  useEffect(() => {
    if (typeof window === 'undefined' || Platform.OS !== 'web') return;
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      const provider = url.searchParams.get('provider') as 'google' | 'discord' | null;
      const authError = url.searchParams.get('auth_error');

      if (authError) {
        window.history.replaceState({}, '', window.location.pathname);
        showAlert('Login Failed', decodeURIComponent(authError));
        return;
      }

      if (code && provider) {
        window.history.replaceState({}, '', window.location.pathname);
        if (provider === 'google') setIsGoogleLoading(true);
        else setIsDiscordLoading(true);
        handleOAuthCallback(code, provider);
      }
    } catch (e) {
      console.error('[Web OAuth] Error parsing URL for OAuth callback:', e);
    }
  }, [handleOAuthCallback]);

  // Google OAuth - Backend initiated flow (same as Discord)
  const handleGoogleLogin = async () => {
    if (!IS_NATIVE) {
      setIsGoogleLoading(true);
      try {
        const returnTo = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
        const { authUrl } = await api.auth.googleWebInit(returnTo);
        window.location.href = authUrl;
      } catch (error: any) {
        console.error('[Google OAuth] Web init error:', error);
        showAlert('Google Login Failed', error.message || 'Failed to start Google login');
        setIsGoogleLoading(false);
      }
      return;
    }

    setIsGoogleLoading(true);
    try {
      console.log('[Google OAuth] Getting auth URL from backend...');
      const { authUrl } = await api.auth.googleMobileInit();

      console.log('[Google OAuth] Opening browser with auth URL...');

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        AUTH_CALLBACK_URL,
        { showInRecents: true }
      );

      console.log('[Google OAuth] Browser result:', result.type);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const errorMsg = url.searchParams.get('message');

        if (errorMsg) {
          showAlert('Google Login Failed', decodeURIComponent(errorMsg));
        } else if (code) {
          await handleOAuthCallback(code, 'google');
        } else {
          showAlert('Google Login Failed', 'No authorization code received');
        }
      } else if (result.type === 'cancel') {
        console.log('[Google OAuth] User cancelled');
      }
    } catch (error: any) {
      console.error('[Google OAuth] Error:', error);
      showAlert('Google Login Failed', error.message || 'Failed to start Google login');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Discord OAuth - Backend initiated flow
  const handleDiscordLogin = async () => {
    if (!IS_NATIVE) {
      setIsDiscordLoading(true);
      try {
        const returnTo = typeof window !== 'undefined' ? window.location.href.split('?')[0] : '';
        const { authUrl } = await api.auth.discordWebInit(returnTo);
        window.location.href = authUrl;
      } catch (error: any) {
        console.error('[Discord OAuth] Web init error:', error);
        showAlert('Discord Login Failed', error.message || 'Failed to start Discord login');
        setIsDiscordLoading(false);
      }
      return;
    }

    setIsDiscordLoading(true);
    try {
      console.log('[Discord OAuth] Getting auth URL from backend...');
      const { authUrl } = await api.auth.discordMobileInit();

      console.log('[Discord OAuth] Opening browser with auth URL...');

      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        AUTH_CALLBACK_URL,
        { showInRecents: true }
      );

      console.log('[Discord OAuth] Browser result:', result.type);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        const errorMsg = url.searchParams.get('message');

        if (errorMsg) {
          showAlert('Discord Login Failed', decodeURIComponent(errorMsg));
        } else if (code) {
          await handleOAuthCallback(code, 'discord');
        } else {
          showAlert('Discord Login Failed', 'No authorization code received');
        }
      } else if (result.type === 'cancel') {
        console.log('[Discord OAuth] User cancelled');
      }
    } catch (error: any) {
      console.error('[Discord OAuth] Error:', error);
      showAlert('Discord Login Failed', error.message || 'Failed to start Discord login');
    } finally {
      setIsDiscordLoading(false);
    }
  };

  const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };



  useEffect(() => {
    if (params.ref) {
      setIsLogin(false);
      setReferralCode(String(params.ref));
      console.log('[Login] Referral code detected:', params.ref);
    }
  }, [params.ref]);

  useEffect(() => {
    const checkUsername = async () => {
      if (isLogin || !debouncedUsername || debouncedUsername.length < 3) {
        setUsernameAvailability({ checking: false, available: null, message: '' });
        return;
      }
      
      if (!isUsernameValid(debouncedUsername)) {
        setUsernameAvailability({ checking: false, available: null, message: '' });
        return;
      }
      
      setUsernameAvailability(prev => ({ ...prev, checking: true }));
      
      try {
        const result = await api.auth.checkUsername(debouncedUsername.toLowerCase());
        console.log('[Username Check] Result:', result);
        setUsernameAvailability({
          checking: false,
          available: result.available,
          message: result.available ? 'Username available' : (result.message || 'Username taken'),
        });
      } catch (error) {
        console.error('[Username Check] Error:', error);
        setUsernameAvailability({ checking: false, available: null, message: '' });
      }
    };
    
    checkUsername();
  }, [debouncedUsername, isLogin]);

  useEffect(() => {
    if (!authLoading) {
      console.log('[Login] Auth loaded');
      console.log('[Login] isAuthenticated:', isAuthenticated);
      console.log('[Login] user:', user?.username || 'null');
      console.log('[Login] emailVerified:', user?.emailVerified);
      if (isAuthenticated && user) {
        // Check if email is verified first
        if (!user.emailVerified) {
          console.log('[Login] Email not verified, redirecting to verify-code...');
          router.replace({
            pathname: '/verify-code',
            params: { email: user.email || '' }
          });
          return;
        }
        
        // Check if onboarding is needed
        const needsOnboarding = !user.userType;
        if (needsOnboarding) {
          console.log('[Login] Onboarding incomplete, redirecting to onboarding...');
          router.replace('/onboarding');
          return;
        }
        
        console.log('[Login] User already authenticated, redirecting to home...');
        router.replace('/(drawer)/(tabs)/home');
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  const handleForceLogout = async () => {
    console.log('[Login] 🔴 Force logout triggered by user');
    await logoutUser();
    setUsername('');
    setPassword('');
    showAlert('Logged Out', 'All authentication data has been cleared. You can now log in with fresh credentials.', 'success');
  };


  // Validation helpers
  const isUsernameValid = (name: string) => /^[a-zA-Z0-9_]{3,20}$/.test(name);
  const isEmailValid = (mail: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);
  
  const getUsernameValidation = (name: string) => {
    if (!name || name.length < 3) return { valid: false, message: '' };
    const appropriateCheck = isUsernameAppropriate(name);
    return appropriateCheck;
  };
  
  const usernameValidation = getUsernameValidation(username);
  
  const getPasswordStrength = (pass: string) => ({
    length: pass.length >= 8,
    uppercase: /[A-Z]/.test(pass),
    number: /[0-9]/.test(pass),
    special: /[!@#$%^&*]/.test(pass),
  });

  const passwordStrength = getPasswordStrength(password);
  const isPasswordValid = Object.values(passwordStrength).every(Boolean);
  const isConfirmPasswordValid = confirmPassword === password && confirmPassword.length > 0;

  const handleAuth = async () => {
    if (isLoading) return;

    if (isLogin) {
      if (!username) {
        showAlert('Error', 'Please enter username/email');
        return;
      }

      if (!password && username !== 'admin' && username !== 'demo') {
        showAlert('Error', 'Please enter password');
        return;
      }

      setIsLoading(true);
      try {
        const result = await api.auth.login({
          username,
          password,
        });

        if (result.requires2FA) {
          setTwoFAUserId(result.userId);
          setTwoFAPending(true);
          return;
        }

        await loginUser(
          result.user, 
          result.accessToken, 
          result.refreshToken, 
          result.expiresIn,
          result.streakInfo,
          result.gamefolioTokens
        );

        if (result.streakInfo && result.streakInfo.bonusAwarded > 0) {
          showStreak(result.streakInfo);
        }
        
        console.log('[Login] Success:', result.user.username);
        
        if (!result.user.emailVerified) {
          console.log('[Login] Email not verified, redirecting to verify-code...');
          router.replace({
            pathname: '/verify-code',
            params: { email: result.user.email || '' }
          });
          return;
        }
        
        const needsOnboarding = !result.user.userType;
        if (needsOnboarding) {
          console.log('[Login] Onboarding incomplete, redirecting to onboarding...');
          router.replace('/onboarding');
          return;
        }
        
        router.replace('/(drawer)/(tabs)/home');
      } catch (error) {
        console.error('[Login] Error:', error);
        if (error instanceof APIError) {
          showAlert('Login Failed', error.message);
        } else {
          showAlert('Login Failed', 'Invalid credentials');
        }
      } finally {
        setIsLoading(false);
      }
    } else {
      // Sign Up Validation
      if (!isUsernameValid(username)) {
        showAlert('Error', 'Invalid username format');
        return;
      }
      if (!usernameValidation.valid) {
        showAlert('Error', usernameValidation.message || 'Invalid username');
        return;
      }
      if (!isEmailValid(email)) {
        showAlert('Error', 'Invalid email format');
        return;
      }
      if (!birthday) {
        showAlert('Error', 'Please select your date of birth');
        return;
      }
      if (!isPasswordValid) {
        showAlert('Error', 'Please meet all password requirements');
        return;
      }
      if (!isConfirmPasswordValid) {
        showAlert('Error', 'Passwords do not match');
        return;
      }

      setIsLoading(true);
      try {
        const result = await api.auth.register({
          username,
          displayName: username,
          email,
          password,
          referralCode: referralCode.trim() || undefined,
        });

        console.log('[Register] Success:', result.user.username);
        
        // Store the user session
        await loginUser(
          result.user,
          result.accessToken,
          result.refreshToken,
          result.expiresIn,
          result.streakInfo,
          result.gamefolioTokens
        );
        
        // Navigate to email verification screen
        router.push({
          pathname: '/verify-code',
          params: { email: email }
        });
      } catch (error) {
        console.error('[Register] Error:', error);
        if (error instanceof APIError) {
          const errorMessage = error.message.toLowerCase();
          if (errorMessage.includes('username already taken') || errorMessage.includes('username')) {
            showAlert('Username Taken', 'This username is already in use. Please choose a different one.');
          } else if (errorMessage.includes('email') && (errorMessage.includes('registered') || errorMessage.includes('already'))) {
            showAlert('Email Already Registered', 'This email address is already registered. Please use a different email or try logging in.');
          } else {
            showAlert('Registration Failed', error.message);
          }
        } else {
          showAlert('Registration Failed', 'Failed to create account');
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleTwoFAVerify = async () => {
    if (!twoFACode || twoFACode.length < 6) {
      setTwoFAError('Enter the 6-digit code from your authenticator app');
      return;
    }
    if (!twoFAUserId) return;
    setIsLoading(true);
    setTwoFAError('');
    try {
      const result = await api.twoFactor.verifyLogin(twoFAUserId, twoFACode);
      await loginUser(result.user, result.accessToken, result.refreshToken, result.expiresIn, result.streakInfo, result.gamefolioTokens);
      if (result.streakInfo && result.streakInfo.bonusAwarded > 0) showStreak(result.streakInfo);
      if (!result.user.emailVerified) {
        router.replace({ pathname: '/verify-code', params: { email: result.user.email || '' } });
        return;
      }
      if (!result.user.userType) {
        router.replace('/onboarding');
        return;
      }
      router.replace('/(drawer)/(tabs)/home');
    } catch (error) {
      setTwoFAError(error instanceof Error ? error.message : 'Invalid code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const colors = {
    background: '#131F2A', // Deep dark blue/black
    primary: '#4ADE80',    // Bright green
    secondary: '#1E293B',  // Input background
    text: '#FFFFFF',
    textDim: '#94A3B8',
    error: '#EF4444',
    discord: '#5865F2',
    google: '#1E293B',     // Google button background (dark)
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Force Logout Button (if authenticated) */}
          {isAuthenticated && user && (
            <View style={styles.logoutBanner}>
              <Text style={styles.logoutBannerText}>
                Logged in as {user.username}
              </Text>
              <TouchableOpacity 
                style={styles.logoutButton}
                onPress={handleForceLogout}
              >
                <LogOut size={16} color="#FFF" />
                <Text style={styles.logoutButtonText}>Clear & Logout</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Logo Section */}
          <View style={styles.logoContainer}>
            {/* Using the same logo as splash screen or similar placeholder */}
            <Image 
              source={{ uri: "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/bpo9i1ux8et2igcgnomrk" }}
              style={{ width: 80, height: 80 }}
              contentFit="contain"
            />
          </View>

          {/* 2FA Verification Step */}
          {twoFAPending && (
            <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <Shield size={28} color={colors.primary} />
                </View>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 }}>Two-Factor Authentication</Text>
                <Text style={{ color: colors.textDim, fontSize: 14, textAlign: 'center' }}>Enter the 6-digit code from your authenticator app to continue.</Text>
              </View>
              <TextInput
                style={{ backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#FFF', fontSize: 24, letterSpacing: 8, textAlign: 'center', borderWidth: 1, borderColor: twoFAError ? colors.error : '#2D3F55', marginBottom: 12 }}
                placeholder="000000"
                placeholderTextColor="#4A5568"
                value={twoFACode}
                onChangeText={(t) => { setTwoFACode(t.replace(/[^0-9]/g, '').slice(0, 6)); setTwoFAError(''); }}
                keyboardType="number-pad"
                maxLength={6}
                testID="input-2fa-code"
              />
              {twoFAError ? <Text style={{ color: colors.error, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>{twoFAError}</Text> : null}
              <TouchableOpacity
                style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12, opacity: isLoading ? 0.7 : 1 }}
                onPress={handleTwoFAVerify}
                disabled={isLoading}
                testID="button-verify-2fa"
              >
                <Text style={{ color: '#131F2A', fontSize: 16, fontWeight: '700' }}>{isLoading ? 'Verifying...' : 'Verify'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setTwoFAPending(false); setTwoFAUserId(null); setTwoFACode(''); setTwoFAError(''); }} style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ color: colors.textDim, fontSize: 14 }}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Toggle Switch */}
          {!twoFAPending && (
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
              onPress={() => setIsLogin(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>Log in</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
              onPress={() => setIsLogin(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>Sign up</Text>
            </TouchableOpacity>
          </View>
          )}

          {/* Form Section */}
          {!twoFAPending && <View style={styles.formContainer}>
            

            {isLogin ? (
              // Login Form
              <>
                <View style={styles.inputWrapper}>
                  <View style={styles.inputContainer}>
                    <UserIcon size={20} color={colors.textDim} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Username"
                      placeholderTextColor={colors.textDim}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      editable={!isLoading}
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <View style={styles.inputContainer}>
                    <Lock size={20} color={colors.textDim} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Password"
                      placeholderTextColor={colors.textDim}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      editable={!isLoading}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <EyeOff size={20} color={colors.textDim} />
                      ) : (
                        <Eye size={20} color={colors.textDim} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.forgotPassword} onPress={() => router.push('/forgot-password')}>
                  <Text style={styles.forgotPasswordText}>Forgot password</Text>
                </TouchableOpacity>
              </>
            ) : (
              // Sign Up Form
              <>
                {/* Username */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Username</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { paddingLeft: 0 }]}
                      placeholder="Enter username"
                      placeholderTextColor={colors.textDim}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      editable={!isLoading}
                    />
                  </View>
                  {username.length > 0 && !isUsernameValid(username) && (
                    <View style={[styles.validationBox, styles.validationWarning]}>
                      <AlertCircle size={16} color="#EAB308" />
                      <Text style={[styles.validationText, { color: '#EAB308' }]}>
                        Username must be 3-20 characters, letters/numbers/underscores only
                      </Text>
                    </View>
                  )}
                  {username.length >= 3 && isUsernameValid(username) && !usernameValidation.valid && (
                    <View style={[styles.validationBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                      <AlertCircle size={16} color="#EF4444" />
                      <Text style={[styles.validationText, { color: '#EF4444' }]}>
                        {usernameValidation.message}
                      </Text>
                    </View>
                  )}
                  {username.length >= 3 && isUsernameValid(username) && usernameAvailability.checking && (
                    <View style={[styles.validationBox, { backgroundColor: 'rgba(148, 163, 184, 0.1)', borderColor: 'rgba(148, 163, 184, 0.2)' }]}>
                      <ActivityIndicator size="small" color="#94A3B8" />
                      <Text style={[styles.validationText, { color: '#94A3B8' }]}>
                        Checking availability...
                      </Text>
                    </View>
                  )}
                  {username.length >= 3 && isUsernameValid(username) && !usernameAvailability.checking && usernameAvailability.available === true && (
                    <View style={[styles.validationBox, styles.validationSuccess]}>
                      <CheckCircle size={16} color="#4ADE80" />
                      <Text style={[styles.validationText, { color: '#4ADE80' }]}>
                        {usernameAvailability.message}
                      </Text>
                    </View>
                  )}
                  {username.length >= 3 && isUsernameValid(username) && !usernameAvailability.checking && usernameAvailability.available === false && (
                    <View style={[styles.validationBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }]}>
                      <AlertCircle size={16} color="#EF4444" />
                      <Text style={[styles.validationText, { color: '#EF4444' }]}>
                        {usernameAvailability.message}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Email */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { paddingLeft: 0 }]}
                      placeholder="name@example.com"
                      placeholderTextColor={colors.textDim}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!isLoading}
                    />
                  </View>
                  {email.length > 0 && isEmailValid(email) && (
                    <View style={[styles.validationBox, styles.validationSuccess]}>
                      <CheckCircle size={16} color="#4ADE80" />
                      <Text style={[styles.validationText, { color: '#4ADE80' }]}>
                        Valid email format
                      </Text>
                    </View>
                  )}
                </View>

                {/* Date of Birth */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Date of Birth</Text>
                  <TouchableOpacity 
                    onPress={() => setShowBirthdayModal(true)} 
                    activeOpacity={0.8}
                  >
                    <View style={styles.inputContainer}>
                      <TextInput
                        style={[styles.input, { paddingLeft: 0 }]}
                        placeholder="MM/DD/YYYY"
                        placeholderTextColor={colors.textDim}
                        value={birthday ? birthday.toLocaleDateString() : ''}
                        editable={false}
                        pointerEvents="none"
                      />
                      <Calendar size={20} color={colors.textDim} />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Password */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { paddingLeft: 0 }]}
                      placeholder="Create a password"
                      placeholderTextColor={colors.textDim}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                      editable={!isLoading}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                      {showPassword ? (
                        <EyeOff size={20} color={colors.textDim} />
                      ) : (
                        <Eye size={20} color={colors.textDim} />
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={styles.passwordRulesContainer}>
                    <View style={styles.ruleItem}>
                      <View style={[styles.radioCircle, passwordStrength.length && styles.radioCircleSelected]} />
                      <Text style={[styles.ruleText, passwordStrength.length && styles.ruleTextValid]}>
                        At least 8 characters
                      </Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <View style={[styles.radioCircle, passwordStrength.uppercase && styles.radioCircleSelected]} />
                      <Text style={[styles.ruleText, passwordStrength.uppercase && styles.ruleTextValid]}>
                        One uppercase letter
                      </Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <View style={[styles.radioCircle, passwordStrength.number && styles.radioCircleSelected]} />
                      <Text style={[styles.ruleText, passwordStrength.number && styles.ruleTextValid]}>
                        One number
                      </Text>
                    </View>
                    <View style={styles.ruleItem}>
                      <View style={[styles.radioCircle, passwordStrength.special && styles.radioCircleSelected]} />
                      <Text style={[styles.ruleText, passwordStrength.special && styles.ruleTextValid]}>
                        One special character (!@#$%^&*)
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { paddingLeft: 0 }]}
                      placeholder="Confirm your password"
                      placeholderTextColor={colors.textDim}
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      editable={!isLoading}
                    />
                  </View>
                </View>

                {/* Referral Code (optional) */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.label}>Referral Code (optional)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, { paddingLeft: 0 }]}
                      placeholder="Enter a friend's referral code"
                      placeholderTextColor={colors.textDim}
                      value={referralCode}
                      onChangeText={setReferralCode}
                      autoCapitalize="none"
                      editable={!isLoading}
                    />
                  </View>
                  <Text style={styles.referralHint}>
                    Have a friend's code? Enter it to earn 250 XP each!
                  </Text>
                </View>

                {/* Terms */}
                <Text style={styles.termsText}>
                  By creating an account, you agree to our{' '}
                  <Text style={styles.linkText}>Terms and Conditions</Text> and{' '}
                  <Text style={styles.linkText}>Privacy Policy</Text>
                </Text>
              </>
            )}

            {/* Main Action Button */}
            <TouchableOpacity 
              style={[styles.mainButton, isLoading && styles.mainButtonDisabled]}
              activeOpacity={0.8}
              onPress={handleAuth}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#002E15" />
              ) : (
                <>
                  <Text style={styles.mainButtonText}>
                    {isLogin ? 'Log in' : 'Create Account'}
                  </Text>
                  {!isLogin ? null : <ArrowRight size={24} color="#002E15" strokeWidth={2.5} />}
                </>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Login Button */}
            <TouchableOpacity
              style={[styles.socialButton, styles.googleButton, isGoogleLoading && styles.mainButtonDisabled]}
              onPress={handleGoogleLogin}
              activeOpacity={0.8}
              disabled={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator size="small" color="#1F2937" />
              ) : (
                <>
                  <GoogleIcon />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Discord Login Button */}
            <TouchableOpacity 
              style={[styles.socialButton, styles.discordButton, isDiscordLoading && styles.mainButtonDisabled]}
              onPress={handleDiscordLogin}
              activeOpacity={0.8}
              disabled={isDiscordLoading}
            >
              {isDiscordLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <DiscordIcon />
                  <Text style={styles.socialButtonText}>Continue with Discord</Text>
                </>
              )}
            </TouchableOpacity>


          </View>}
        </ScrollView>
      </KeyboardAvoidingView>
      
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={hideAlert}
      />

      <BirthdayModal
        visible={showBirthdayModal}
        onClose={() => setShowBirthdayModal(false)}
        onContinue={(date) => {
          setBirthday(date);
          setShowBirthdayModal(false);
        }}
        initialDate={birthday}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderRadius: 16,
    padding: 4,
    marginBottom: 32,
    alignSelf: 'center',
    width: 240,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  toggleButtonActive: {
    backgroundColor: '#4ADE80',
  },
  toggleText: {
    color: '#94A3B8',
    fontWeight: '600',
    fontSize: 15,
  },
  toggleTextActive: {
    color: '#002E15',
    fontWeight: '700',
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // slightly transparent dark
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  mainButton: {
    flexDirection: 'row',
    backgroundColor: '#4ADE80',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  mainButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#002E15',
  },
  mainButtonDisabled: {
    opacity: 0.6,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748B',
    paddingHorizontal: 16,
    fontSize: 14,
    fontWeight: '500',
  },

  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 28,
    marginBottom: 12,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  discordButton: {
    backgroundColor: '#7289DA',
    shadowColor: '#7289DA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  socialButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 8,
    fontWeight: '500',
    marginLeft: 4,
  },
  validationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
  },
  validationWarning: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderColor: 'rgba(234, 179, 8, 0.2)',
  },
  validationSuccess: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  validationText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  passwordRulesContainer: {
    marginTop: 12,
    gap: 8,
    paddingLeft: 4,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ruleText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  ruleTextValid: {
    color: '#4ADE80',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    backgroundColor: 'transparent',
  },
  radioCircleSelected: {
    borderColor: '#4ADE80',
    backgroundColor: '#4ADE80',
  },
  referralHint: {
    color: '#4ADE80',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  termsText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  linkText: {
    color: '#4ADE80',
  },
  logoutBanner: {
    backgroundColor: '#FFA500',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutBannerText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
