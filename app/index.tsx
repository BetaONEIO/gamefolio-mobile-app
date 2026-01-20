import React, { useState, useEffect } from 'react';
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
import { api, APIError } from '@/lib/api';
import CustomAlert from '@/components/CustomAlert';
import BirthdayModal from '@/components/BirthdayModal';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import { Env } from '@/constants/Env';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

// Use mobile Discord client ID if available, fallback to web client ID
const DISCORD_CLIENT_ID = Env.DISCORD_MOBILE_CLIENT_ID || Env.DISCORD_CLIENT_ID;

// Use AuthSession.makeRedirectUri for proper redirect URI generation
const getDiscordRedirectUri = (): string => {
  const isExpoGo = Constants.appOwnership === 'expo';
  
  if (isExpoGo) {
    // For Expo Go, use the Expo auth proxy with useProxy
    const proxyUri = AuthSession.makeRedirectUri({
      scheme: 'rork-app',
      path: 'auth/discord/callback',
      preferLocalhost: false,
    });
    console.log('[Discord OAuth] Generated proxy redirect URI:', proxyUri);
    return proxyUri;
  }
  
  // For standalone/production builds, use the custom scheme
  const nativeRedirectUri = AuthSession.makeRedirectUri({
    scheme: 'rork-app',
    path: 'auth/discord/callback',
  });
  console.log('[Discord OAuth] Running standalone, using native scheme:', nativeRedirectUri);
  return nativeRedirectUri;
};

const DISCORD_REDIRECT_URI = getDiscordRedirectUri();

// Log the exact redirect URI for Discord configuration
console.log('[Discord OAuth] ==========================================');
console.log('[Discord OAuth] ADD THIS REDIRECT URI TO DISCORD:');
console.log('[Discord OAuth]', DISCORD_REDIRECT_URI);
console.log('[Discord OAuth] ==========================================');

console.log('[Discord OAuth] Using client ID:', DISCORD_CLIENT_ID);
console.log('[Discord OAuth] Redirect URI:', DISCORD_REDIRECT_URI);



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
  const [isLogin, setIsLogin] = useState(true);
  const [referralCode, setReferralCode] = useState<string | null>(null);
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

  const discovery = {
    authorizationEndpoint: 'https://discord.com/api/oauth2/authorize',
    tokenEndpoint: 'https://discord.com/api/oauth2/token',
    revocationEndpoint: 'https://discord.com/api/oauth2/token/revoke',
  };

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: DISCORD_CLIENT_ID,
      scopes: ['identify', 'email'],
      redirectUri: DISCORD_REDIRECT_URI,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: false,
    },
    discovery
  );

  useEffect(() => {
    const handleDiscordAuth = async () => {
      if (response?.type === 'success' && response.params.code) {
        setIsDiscordLoading(true);
        try {
          console.log('[Discord OAuth] Got authorization code, exchanging for tokens...');
          console.log('[Discord OAuth] Redirect URI used:', DISCORD_REDIRECT_URI);
          
          const backendUrl = Env.BACKEND_URL || '';
          const tokenResponse = await fetch(`${backendUrl}/api/oauth/discord/callback`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: response.params.code,
              redirectUri: DISCORD_REDIRECT_URI,
            }),
          });

          if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to exchange code for tokens');
          }

          const data = await tokenResponse.json();
          
          if (data.accessToken && data.refreshToken && data.user) {
            await loginUser(data.user, data.accessToken, data.refreshToken, data.expiresIn || 7 * 24 * 60 * 60);
            router.replace('/(drawer)/(tabs)/home');
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error: any) {
          console.error('[Discord OAuth] Error:', error);
          showAlert('Discord Login Failed', error.message || 'Failed to authenticate with Discord');
        } finally {
          setIsDiscordLoading(false);
        }
      } else if (response?.type === 'error') {
        console.error('[Discord OAuth] Error response:', response.error);
        showAlert('Discord Login Failed', response.error?.message || 'Authentication was cancelled or failed');
      }
    };

    handleDiscordAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };



  useEffect(() => {
    if (params.ref) {
      const refCode = Array.isArray(params.ref) ? params.ref[0] : params.ref;
      setReferralCode(refCode);
      setIsLogin(false);
      console.log('[Login] Referral code detected:', refCode);
    }
  }, [params.ref]);

  useEffect(() => {
    if (!authLoading) {
      console.log('[Login] Auth loaded');
      console.log('[Login] isAuthenticated:', isAuthenticated);
      console.log('[Login] user:', user?.username || 'null');
      if (isAuthenticated && user) {
        console.log('[Login] User already authenticated, redirecting...');
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
        
        console.log('[Login] Success:', result.user.username);
        
        if (!result.user.emailVerified) {
          showAlert('Email Verification Required', 'Please verify your email before continuing.', 'error');
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
          dateOfBirth: birthday.toISOString(),
          referralCode: referralCode || undefined,
        });

        console.log('[Register] Success:', result.user.username);
        showAlert('Success', 'Account created! Please log in.', 'success');
        setIsLogin(true);
        setPassword('');
        setConfirmPassword('');
      } catch (error) {
        console.error('[Register] Error:', error);
        if (error instanceof APIError) {
          showAlert('Registration Failed', error.message);
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
              style={[styles.socialButton, styles.googleButton]}
              onPress={async () => {
                try {
                  const redirectUri = Linking.createURL('/oauth-callback');
                  const backendUrl = Env.BACKEND_URL || '';
                  const authUrl = `${backendUrl}/api/oauth/google?redirect_uri=${encodeURIComponent(redirectUri)}`;
                  console.log('[OAuth] Opening Google auth:', authUrl);
                  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
                  
                  if (result.type === 'success' && result.url) {
                    const url = new URL(result.url);
                    const token = url.searchParams.get('token');
                    const refreshToken = url.searchParams.get('refresh_token');
                    const userData = url.searchParams.get('user');
                    
                    if (token && refreshToken && userData) {
                      const user = JSON.parse(decodeURIComponent(userData));
                      await loginUser(user, token, refreshToken, 7 * 24 * 60 * 60);
                      router.replace('/(drawer)/(tabs)/home');
                    } else {
                      showAlert('Error', 'Failed to authenticate with Google');
                    }
                  }
                } catch (error) {
                  console.error('[OAuth] Google error:', error);
                  showAlert('Error', 'Failed to connect to Google');
                }
              }}
              activeOpacity={0.8}
            >
              <GoogleIcon />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Discord Login Button */}
            <TouchableOpacity 
              style={[styles.socialButton, styles.discordButton, (!request || isDiscordLoading) && styles.mainButtonDisabled]}
              onPress={() => {
                console.log('[Discord OAuth] Starting auth flow...');
                console.log('[Discord OAuth] Redirect URI:', DISCORD_REDIRECT_URI);
                promptAsync();
              }}
              activeOpacity={0.8}
              disabled={!request || isDiscordLoading}
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

            {/* Developer Bypass Button */}
            <TouchableOpacity 
              style={[styles.socialButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155', marginTop: 8 }]}
              onPress={async () => {
                 const mockUser = {
                  id: 999,
                  username: 'GuestDev',
                  displayName: 'Guest Developer',
                  email: 'guest@dev.local',
                  emailVerified: true,
                  role: 'user',
                  totalXP: 1000,
                  level: 5,
                  currentStreak: 3,
                  longestStreak: 10,
                  avatarUrl: null,
                  bannerUrl: null,
                  bio: 'Just a guest developer passing through.',
                  messagingEnabled: true,
                  isPrivate: false,
                  userType: 'Casual',
                  gfTokenBalance: 500
                };
                
                await loginUser(
                  mockUser, 
                  'mock-access-token', 
                  'mock-refresh-token', 
                  3600
                );
                router.replace('/(drawer)/(tabs)/home');
              }}
            >
              <Lock size={20} color="#94A3B8" style={{ marginRight: 10 }} />
              <Text style={[styles.socialButtonText, { color: '#94A3B8' }]}>Developer Bypass (No Auth)</Text>
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
    paddingTop: 80,
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
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  googleButtonText: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  discordButton: {
    backgroundColor: '#5865F2',
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
