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
import { Lock, Eye, EyeOff, ArrowRight, User as UserIcon, AlertCircle, CheckCircle, Calendar, LogOut } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useDailyStreak } from '@/context/DailyStreakContext';
import { api, APIError } from '@/lib/api';
import { useDebounce } from '@/hooks/useDebounce';
import { isUsernameAppropriate } from '@/lib/profanity-filter';
import CustomAlert from '@/components/CustomAlert';
import BirthdayModal from '@/components/BirthdayModal';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { Env } from '@/constants/Env';

WebBrowser.maybeCompleteAuthSession();

const IS_NATIVE = Platform.OS !== 'web';

const GOOGLE_CLIENT_ID = IS_NATIVE ? (Platform.select({
  ios: Env.GOOGLE_IOS_CLIENT_ID,
  android: Env.GOOGLE_ANDROID_CLIENT_ID,
  default: Env.GOOGLE_CLIENT_ID,
}) || 'placeholder') : 'placeholder';

const GOOGLE_REDIRECT_URI = IS_NATIVE ? (Platform.OS === 'ios' 
  ? `com.googleusercontent.apps.203672150024-jiibs6emo1qkqmusjsfr8qnus8ut0raa:/oauth2redirect/google`
  : 'rork-app://auth/google/callback') : 'https://placeholder.com';

if (IS_NATIVE) {
  console.log('[OAuth] Google Client ID:', GOOGLE_CLIENT_ID);
  console.log('[OAuth] Google Redirect URI:', GOOGLE_REDIRECT_URI);
}



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

const AUTH_CALLBACK_URL = 'rork-app://auth/callback';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { login: loginUser, isLoading: authLoading, isAuthenticated, user, logout: logoutUser } = useAuth();
  const { showStreak } = useDailyStreak();
  const [isLogin, setIsLogin] = useState(true);
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
  const [isDiscordLoading, setIsDiscordLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<{
    checking: boolean;
    available: boolean | null;
    message: string;
  }>({ checking: false, available: null, message: '' });
  
  const debouncedUsername = useDebounce(username, 300);
  const isProcessingOAuthRef = useRef(false);

  // Google OAuth discovery
  const googleDiscovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  };

  // Google auth request
  const [googleRequest, googleResponse, promptGoogleAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['openid', 'profile', 'email'],
      redirectUri: GOOGLE_REDIRECT_URI,
      responseType: AuthSession.ResponseType.Token,
    },
    googleDiscovery
  );

  // Handle Discord OAuth callback from deep link
  const handleDiscordCallback = useCallback(async (code: string) => {
    if (isProcessingOAuthRef.current) {
      console.log('[Discord OAuth] Already processing, skipping...');
      return;
    }
    
    isProcessingOAuthRef.current = true;
    setIsDiscordLoading(true);
    
    try {
      console.log('[Discord OAuth] Exchanging code for tokens...');
      const data = await api.auth.mobileExchange(code);
      
      console.log('[Discord OAuth] Got user:', data.user.username);
      await loginUser(data.user, data.accessToken, data.refreshToken, data.expiresIn || 7 * 24 * 60 * 60);
      
      const needsOnboarding = data.needsOnboarding || 
        !data.user.userType || 
        !data.user.ageRange || 
        (data.user.username && data.user.username.startsWith('temp_'));
      
      if (needsOnboarding) {
        console.log('[Discord OAuth] User needs onboarding, redirecting...');
        router.replace('/onboarding');
      } else {
        console.log('[Discord OAuth] Login complete, redirecting to home...');
        router.replace('/(drawer)/(tabs)/home');
      }
    } catch (error: any) {
      console.error('[Discord OAuth] Error:', error);
      showAlert('Discord Login Failed', error.message || 'Failed to authenticate with Discord');
    } finally {
      setIsDiscordLoading(false);
      isProcessingOAuthRef.current = false;
    }
  }, [loginUser, router]);

  // Listen for deep link callbacks
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      console.log('[Deep Link] Received URL:', event.url);
      
      try {
        const url = new URL(event.url);
        const code = url.searchParams.get('code');
        
        if (code && event.url.includes('auth/callback')) {
          console.log('[Deep Link] Got OAuth code, processing...');
          handleDiscordCallback(code);
        }
      } catch (e) {
        console.error('[Deep Link] Error parsing URL:', e);
      }
    };

    // Check if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('[Deep Link] Initial URL:', url);
        handleDeepLink({ url });
      }
    });

    // Listen for deep links while app is open
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      subscription.remove();
    };
  }, [handleDiscordCallback]);

  // Handle Google OAuth response
  useEffect(() => {
    const handleGoogleAuth = async () => {
      if (googleResponse?.type === 'success' && googleResponse.params.access_token) {
        setIsGoogleLoading(true);
        try {
          console.log('[Google OAuth] Got access token, fetching user info...');
          
          const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
              Authorization: `Bearer ${googleResponse.params.access_token}`,
            },
          });

          if (!userResponse.ok) {
            throw new Error('Failed to fetch Google user info');
          }

          const googleUser = await userResponse.json();
          console.log('[Google OAuth] Got user info:', googleUser.email);

          // Send to mobile backend endpoint
          const data = await api.auth.googleMobileLogin({
            email: googleUser.email,
            displayName: googleUser.name || googleUser.email.split('@')[0],
            photoURL: googleUser.picture || null,
            uid: googleUser.id,
          });
          
          await loginUser(data.user, data.accessToken, data.refreshToken, data.expiresIn || 7 * 24 * 60 * 60);
          
          const needsOnboarding = data.needsOnboarding || 
            !data.user.userType || 
            !data.user.ageRange || 
            (data.user.username && data.user.username.startsWith('temp_'));
          
          if (needsOnboarding) {
            console.log('[Google OAuth] User needs onboarding, redirecting...');
            router.replace('/onboarding');
          } else {
            console.log('[Google OAuth] Login complete, redirecting to home...');
            router.replace('/(drawer)/(tabs)/home');
          }
        } catch (error: any) {
          console.error('[Google OAuth] Error:', error);
          showAlert('Google Login Failed', error.message || 'Failed to authenticate with Google');
        } finally {
          setIsGoogleLoading(false);
        }
      } else if (googleResponse?.type === 'error') {
        console.error('[Google OAuth] Error response:', googleResponse.error);
        showAlert('Google Login Failed', googleResponse.error?.message || 'Authentication was cancelled or failed');
      }
    };

    handleGoogleAuth();
  }, [googleResponse, loginUser, router]);

  // Discord OAuth - Backend initiated flow
  const handleDiscordLogin = async () => {
    if (!IS_NATIVE) {
      showAlert('Mobile Only', 'Discord login is only available on the mobile app');
      return;
    }
    
    setIsDiscordLoading(true);
    try {
      console.log('[Discord OAuth] Getting auth URL from backend...');
      const { authUrl } = await api.auth.discordMobileInit();
      
      console.log('[Discord OAuth] Opening browser with auth URL...');
      console.log('[Discord OAuth] Auth URL:', authUrl);
      
      // Open browser for OAuth - it will redirect back to rork-app://auth/callback
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        AUTH_CALLBACK_URL,
        { showInRecents: true }
      );
      
      console.log('[Discord OAuth] Browser result:', result.type);
      
      if (result.type === 'success' && result.url) {
        // Extract code from callback URL
        const url = new URL(result.url);
        const code = url.searchParams.get('code');
        
        if (code) {
          await handleDiscordCallback(code);
        } else {
          console.error('[Discord OAuth] No code in callback URL');
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

  const colors = {
    background: '#0F1520', // Deep dark blue/black
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

          {/* Toggle Switch */}
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

          {/* Form Section */}
          <View style={styles.formContainer}>
            

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
              style={[styles.socialButton, styles.googleButton, (IS_NATIVE && (!googleRequest || isGoogleLoading)) && styles.mainButtonDisabled]}
              onPress={() => {
                if (!IS_NATIVE) {
                  showAlert('Mobile Only', 'Google login is only available on the mobile app');
                  return;
                }
                console.log('[Google OAuth] Starting auth flow...');
                promptGoogleAsync();
              }}
              activeOpacity={0.8}
              disabled={IS_NATIVE && (!googleRequest || isGoogleLoading)}
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
