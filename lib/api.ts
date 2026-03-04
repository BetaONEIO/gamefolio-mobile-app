import { Env } from '@/constants/Env';
import { signUrl } from '@/lib/image-utils';

const API_BASE_URL = Env.BACKEND_URL;

const SIGNABLE_FIELDS = new Set([
  'avatarUrl', 'bannerUrl', 'videoUrl', 'thumbnailUrl', 'imageUrl',
  'avatar_url', 'banner_url', 'video_url', 'thumbnail_url', 'image_url',
]);

async function signSupabaseUrls(data: any, depth = 0): Promise<any> {
  if (depth > 5 || data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return Promise.all(data.map(item => signSupabaseUrls(item, depth + 1)));
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    const result: any = {};
    await Promise.all(entries.map(async ([key, value]) => {
      if (SIGNABLE_FIELDS.has(key) && typeof value === 'string' && value.includes('supabase.co/storage')) {
        result[key] = await signUrl(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = await signSupabaseUrls(value, depth + 1);
      } else {
        result[key] = value;
      }
    }));
    return result;
  }

  return data;
}

export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }
}

interface FetchOptions extends RequestInit {
  token?: string;
  skipRetry?: boolean;
  useCookieAuth?: boolean;
  retryOn401?: boolean;
  acceptHtml?: boolean;
  htmlFallback?: unknown;
}

export const setAuthCallbacks = (
  refreshCallback: () => Promise<string | null>,
  logoutCallback: () => void
) => {
  // Callbacks registered for future use
};

async function apiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { token, skipRetry, useCookieAuth, acceptHtml, htmlFallback, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (fetchOptions.headers) {
    Object.entries(fetchOptions.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log('[API] 🔑 Authorization header set');
    console.log('[API] 🔑 Full token:', token);
    console.log('[API] 🔑 Token length:', token.length, 'chars');
    
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        console.log('[API] 🔑 Token payload:', payload);
        console.log('[API] 🔑 Token exp:', payload.exp ? new Date(payload.exp * 1000).toISOString() : 'N/A');
        console.log('[API] 🔑 Token iat:', payload.iat ? new Date(payload.iat * 1000).toISOString() : 'N/A');
      }
    } catch {
      console.log('[API] ⚠️ Could not decode token payload');
    }
  } else {
    console.log('[API] ⚠️ No token provided for this request');
  }

  const baseUrl = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  
  if (!baseUrl) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ CRITICAL: Cannot make API request');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[API] No backend URL configured');
    console.error('[API] Please set EXPO_PUBLIC_BACKEND_URL environment variable');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    throw new APIError('Backend URL is not configured. Please set EXPO_PUBLIC_BACKEND_URL.');
  }

  const url = `${baseUrl}${endpoint}`;
  console.log(`[API] 🔵 ${fetchOptions.method || 'GET'} ${url}`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    console.log('[API] 📡 Starting fetch request...');
    console.log('[API] 📍 Full URL:', url);
    console.log('[API] 🔧 Headers:', JSON.stringify(headers, null, 2));
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
      ...(useCookieAuth ? { credentials: 'include' as RequestCredentials } : {}),
    });
    
    clearTimeout(timeoutId);
    console.log('[API] ✅ Fetch completed successfully');

    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('text/html')) {
      const htmlText = await response.text();
      console.log('[API] ℹ️ Received HTML response from:', url);
      console.log('[API] Status:', response.status);
      
      // If acceptHtml is enabled, return the fallback or try to parse HTML
      if (acceptHtml) {
        console.log('[API] ✅ HTML response accepted, using fallback or parsing');
        
        // If a fallback is provided, use it
        if (htmlFallback !== undefined) {
          return htmlFallback as T;
        }
        
        // Try to extract JSON from HTML if embedded (some backends embed JSON in script tags)
        const jsonMatch = htmlText.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i);
        if (jsonMatch && jsonMatch[1]) {
          try {
            const embeddedJson = JSON.parse(jsonMatch[1].trim());
            console.log('[API] ✅ Extracted embedded JSON from HTML');
            return embeddedJson as T;
          } catch {
            console.log('[API] ⚠️ Could not parse embedded JSON');
          }
        }
        
        // Return the HTML as a string wrapped in an object
        return { html: htmlText, isHtmlResponse: true } as unknown as T;
      }
      
      console.warn('[API] ⚠️ API returned HTML instead of JSON');
      console.warn('[API] HTML preview:', htmlText.substring(0, 200));
      throw new APIError(
        'Server returned HTML instead of JSON. Please verify EXPO_PUBLIC_BACKEND_URL is set correctly and points to your backend server.',
        response.status,
        { html: htmlText.substring(0, 500), url, baseUrl }
      );
    }
    
    console.log(`[API] ✅ Response status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 401) {
        // For refresh token endpoint, just log a simple message (this is expected when session expires)
        if (endpoint === '/api/auth/token/refresh') {
          console.log('[API] Session expired - user needs to log in again');
        } else {
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.error('[API] ❌ 401 Unauthorized');
          console.error('[API] Endpoint:', endpoint);
          console.error('[API] Full URL:', url);
          console.error('[API] Backend URL:', baseUrl);
          console.error('[API] Token provided:', !!token);
          if (token) {
            try {
              const parts = token.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                const now = Math.floor(Date.now() / 1000);
                const exp = payload.exp;
                if (exp) {
                  console.error('[API] Token expired:', exp < now);
                  console.error('[API] Token expires at:', new Date(exp * 1000).toISOString());
                }
              }
            } catch {
              console.error('[API] Could not decode token');
            }
          }
          console.error('[API]');
          console.error('[API] Please log out and log in again to get a fresh token');
          console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        }
      }

      let errorMessage = `Request failed with status ${response.status}`;
      let errorData: unknown;

      try {
        errorData = await response.json();
        if (errorData && typeof errorData === 'object' && 'message' in errorData) {
          errorMessage = (errorData as { message: string }).message;
        }
      } catch {
        errorMessage = await response.text();
      }

      throw new APIError(errorMessage, response.status, errorData);
    }

    const data = await response.json();
    const signedData = await signSupabaseUrls(data);
    return signedData as T;
  } catch (error: any) {
    if (error instanceof APIError) {
      throw error;
    }
    
    if (error?.name === 'AbortError') {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('⏱️  REQUEST TIMEOUT');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('[API] Request timed out after 30 seconds');
      console.error('[API] Endpoint:', endpoint);
      console.error('[API] Full URL:', url);
      console.error('[API] Backend URL:', baseUrl);
      console.error('[API]');
      console.error('[API] This usually means:');
      console.error('[API] 1. The backend server is slow or unresponsive');
      console.error('[API] 2. Network connectivity issues');
      console.error('[API] 3. The backend might be down');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      throw new APIError('Request timed out. The server is taking too long to respond. Please try again later.', undefined, error);
    }

    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ NETWORK ERROR - FAILED TO FETCH');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('[API] Endpoint:', endpoint);
    console.error('[API] Full URL:', url);
    console.error('[API] Backend URL:', baseUrl);
    console.error('[API] Error type:', error?.constructor?.name || 'Unknown');
    console.error('[API] Error message:', error?.message || 'No message');
    console.error('[API]');
    console.error('[API] This usually means:');
    console.error('[API] 1. CORS: Backend is blocking requests from this domain');
    console.error('[API] 2. Backend server is offline or unreachable');
    console.error('[API] 3. Network connectivity issues');
    console.error('[API] 4. DNS resolution failure');
    console.error('[API] 5. SSL/TLS certificate issues');
    console.error('[API]');
    console.error('[API] Troubleshooting steps:');
    console.error('[API] - Check if', baseUrl, 'is accessible in a browser');
    console.error('[API] - Verify EXPO_PUBLIC_BACKEND_URL is set correctly');
    console.error('[API] - Check if backend has CORS enabled for this domain');
    console.error('[API] - Try the Developer Bypass button to test without API');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const isCorsError = error?.message?.toLowerCase().includes('cors') || 
                       error?.message?.toLowerCase().includes('network') ||
                       error?.message === 'Failed to fetch';
    
    if (isCorsError) {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
      console.error('[API] 🔧 CORS FIX: Add this to your backend CORS config:');
      console.error(`[API] Access-Control-Allow-Origin: ${currentOrigin}`);
      console.error('[API] Or configure your backend to allow requests from:', currentOrigin);
      
      throw new APIError(
        `CORS Error: Your backend at ${baseUrl} is blocking requests from ${currentOrigin}. Please add "${currentOrigin}" to your backend's CORS allowed origins, or use the "Developer Bypass" button.`,
        undefined,
        { error, origin: currentOrigin, backend: baseUrl }
      );
    }
    
    throw new APIError(
      'Failed to connect to the server. Please check your internet connection or try the Developer Bypass option.',
      undefined,
      error
    );
  }
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  displayName: string;
  email: string;
  password: string;
}

export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  emailVerified: boolean;
  role: string;
  totalXP: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  messagingEnabled: boolean;
  isPrivate: boolean;
  userType?: string;
  showUserType?: boolean;
  ageRange?: string;
  gfTokenBalance?: number;
  accentColor?: string;
  backgroundColor?: string;
  displayNameColor?: string;
  isOnline?: boolean;
  lastActive?: string | null;
  isPro?: boolean;
  birthday?: string | null;
  birthdayLastUpdated?: string | null;
  _count?: {
    followers: number;
    following: number;
    clips: number;
  };
}

export interface GamefolioTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  streakInfo?: {
    currentStreak: number;
    bonusAwarded: number;
    message: string;
    isNewMilestone: boolean;
  };
  gamefolioTokens?: GamefolioTokens | null;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface UserBasic {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface Game {
  id: number;
  name: string;
  imageUrl: string;
  twitchId?: string;
}

export interface TwitchGame {
  id: string;
  name: string;
  boxArt: string;
  icon?: string;
  category?: string;
  players?: number;
}

export interface TaggedUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface Clip {
  id: number;
  userId: number;
  gameId: number;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  videoType: "clip" | "reel";
  duration: number;
  views: number;
  shareCode: string;
  ageRestricted: boolean;
  createdAt: string;
  user: UserBasic;
  game: Game;
  isLiked?: boolean;
  isFired?: boolean;
  taggedUsers?: TaggedUser[];
  _count: {
    likes: number;
    comments: number;
    fires?: number;
  };
}

export interface Reaction {
  id: number;
  clipId?: number;
  screenshotId?: number;
  userId: number;
  emoji: string;
  positionX: number;
  positionY: number;
  createdAt: string;
}

export interface Comment {
  id: number;
  clipId?: number;
  screenshotId?: number;
  userId: number;
  content: string;
  createdAt: string;
  likeCount?: number;
  isLiked?: boolean;
  user: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface Screenshot {
  id: number;
  userId: number;
  gameId: number;
  title: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  shareCode: string;
  views: number;
  ageRestricted: boolean;
  createdAt: string;
  _count: {
    likes: number;
    comments: number;
    fires?: number;
  };
  user?: UserBasic;
  game?: Game;
  isLiked?: boolean;
  isFired?: boolean;
}

export interface Notification {
  id: number;
  userId: number;
  type: "like" | "comment" | "follow" | "mention";
  message: string;
  read: boolean;
  createdAt: string;
  relatedUser: {
    id: number;
    username: string;
    avatarUrl: string;
  };
}

export interface Message {
  id: number;
  content: string;
  senderId: number;
  receiverId: number;
  createdAt: string;
  isRead: boolean;
}

export interface Conversation {
  id: number;
  recipientId: number;
  recipient: {
    id: number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  lastMessage: {
    id: number;
    content: string;
    senderId: number;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

export const api = {
  auth: {
    login: (data: LoginRequest) =>
      apiFetch<AuthResponse>('/api/auth/token/login', {
        method: 'POST',
        body: JSON.stringify(data),
        useCookieAuth: true,
      }),

    register: async (data: RegisterRequest) => {
      const baseUrl = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      
      if (!baseUrl) {
        console.error('[API] ❌ No backend URL configured for registration');
        throw new APIError('Backend URL is not configured. Please set EXPO_PUBLIC_BACKEND_URL.');
      }
      
      const url = `${baseUrl}/api/register`;
      console.log('[API] 🔵 Register request to:', url);
      console.log('[API] 🔵 Backend URL:', baseUrl);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: data.username.toLowerCase(),
          email: data.email.toLowerCase(),
          password: data.password,
          displayName: data.displayName || data.username,
        }),
      });

      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('⚠️  REGISTER API RETURNED HTML INSTEAD OF JSON');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('[API] URL:', url);
        console.error('[API] Status:', response.status);
        console.error('[API] Content-Type:', contentType);
        console.error('[API] Backend URL:', baseUrl);
        console.error('[API] HTML preview:', htmlText.substring(0, 200));
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        throw new APIError(
          'Server returned HTML instead of JSON. The registration endpoint may not exist or EXPO_PUBLIC_BACKEND_URL is not set correctly.',
          response.status,
          { html: htmlText.substring(0, 500), url, baseUrl }
        );
      }

      let responseData;
      try {
        const rawData = await response.json();
        responseData = await signSupabaseUrls(rawData);
      } catch (parseError) {
        console.error('[API] ❌ Failed to parse response as JSON:', parseError);
        throw new APIError('Invalid response from server - not valid JSON', response.status);
      }
      console.log('[API] Register response status:', response.status);
      console.log('[API] Register response data:', JSON.stringify(responseData, null, 2));

      if (response.status === 201 || response.status === 200) {
        console.log('[API] ✅ Registration successful');
        
        // Handle different response structures from external backend
        let user: User;
        let accessToken: string;
        let refreshToken: string;
        let expiresIn: number;
        
        // Check if user is nested or at root level
        if (responseData.user) {
          user = responseData.user;
        } else if (responseData.id && responseData.username) {
          // User data is at root level
          user = {
            id: responseData.id,
            username: responseData.username,
            displayName: responseData.displayName || responseData.display_name || responseData.username,
            email: responseData.email || null,
            emailVerified: responseData.emailVerified || responseData.email_verified || false,
            role: responseData.role || 'user',
            totalXP: responseData.totalXP || responseData.total_xp || 0,
            level: responseData.level || 1,
            currentStreak: responseData.currentStreak || responseData.current_streak || 0,
            longestStreak: responseData.longestStreak || responseData.longest_streak || 0,
            avatarUrl: responseData.avatarUrl || responseData.avatar_url || null,
            bannerUrl: responseData.bannerUrl || responseData.banner_url || null,
            bio: responseData.bio || null,
            messagingEnabled: responseData.messagingEnabled ?? responseData.messaging_enabled ?? true,
            isPrivate: responseData.isPrivate ?? responseData.is_private ?? false,
            userType: responseData.userType || responseData.user_type,
            gfTokenBalance: responseData.gfTokenBalance || responseData.gf_token_balance || 0,
          };
        } else {
          console.error('[API] ❌ Invalid register response structure:', responseData);
          throw new APIError('Invalid response from server: missing user data', response.status, responseData);
        }
        
        // Extract tokens
        accessToken = responseData.accessToken || responseData.access_token || responseData.token || '';
        refreshToken = responseData.refreshToken || responseData.refresh_token || '';
        expiresIn = responseData.expiresIn || responseData.expires_in || 3600;
        
        if (!accessToken) {
          console.warn('[API] ⚠️ No access token in register response');
        }
        
        const result: AuthResponse = {
          user,
          accessToken,
          refreshToken,
          expiresIn,
          streakInfo: responseData.streakInfo || responseData.streak_info,
          gamefolioTokens: responseData.gamefolioTokens || responseData.gamefolio_tokens,
        };
        
        console.log('[API] ✅ Parsed user:', result.user.username);
        return result;
      }

      if (response.status === 400) {
        const errorMessage = responseData.message || responseData.error || 'Registration failed';
        console.log('[API] ❌ Registration error:', errorMessage);
        throw new APIError(errorMessage, 400, responseData);
      }

      throw new APIError(
        responseData.message || 'Registration failed',
        response.status,
        responseData
      );
    },

    refreshToken: (data: RefreshTokenRequest) =>
      apiFetch<RefreshTokenResponse>('/api/auth/token/refresh', {
        method: 'POST',
        body: JSON.stringify(data),
        skipRetry: true,
        useCookieAuth: true,
      }),

    logout: async (token: string) => {
      try {
        return await apiFetch<{ message: string }>('/api/auth/token/logout', {
          method: 'POST',
          token,
        });
      } catch (error: any) {
        if (error.message?.includes('HTML instead of JSON')) {
          console.log('[API] Logout endpoint not available, clearing local session only');
          return { message: 'Logged out locally' };
        }
        throw error;
      }
    },

    checkUsername: async (username: string): Promise<{ available: boolean; message?: string }> => {
      console.log('[API] 🔵 Checking username availability:', username);
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/check-username?username=${encodeURIComponent(username)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        const data = await response.json();
        console.log('[API] Username check response:', data);
        return data;
      } catch (error) {
        console.error('[API] Username check error:', error);
        return { available: false, message: 'Unable to check username' };
      }
    },

    verifyCode: async (email: string, code: string): Promise<{ success: boolean; message?: string; user?: User }> => {
      console.log('[API] 🔵 Verifying code for:', email);
      const response = await fetch(`${API_BASE_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      });
      
      const data = await response.json();
      console.log('[API] Verify code response:', response.status, data);
      
      if (response.status === 401) {
        throw new APIError('Session expired', 401, data);
      }
      
      if (!response.ok) {
        throw new APIError(data.message || 'Invalid or expired verification code', response.status, data);
      }
      
      return { success: true, message: data.message, user: data.user };
    },

    resendVerification: async (email: string): Promise<{ success: boolean; message?: string; retryAfterSeconds?: number }> => {
      console.log('[API] 🔵 Resending verification code to:', email);
      const response = await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      console.log('[API] Resend verification response:', response.status, data);
      
      if (response.status === 401) {
        throw new APIError('Session expired', 401, data);
      }
      
      if (response.status === 429) {
        return { success: false, message: data.message, retryAfterSeconds: data.retryAfterSeconds };
      }
      
      if (!response.ok) {
        throw new APIError(data.message || 'Failed to resend code', response.status, data);
      }
      
      return { success: true, message: data.message || 'New code sent' };
    },

    getUser: (token: string) =>
      apiFetch<{ user: User }>('/api/user', {
        method: 'GET',
        token,
      }),

    googleLogin: (data: {
      email: string;
      displayName: string;
      photoURL: string | null;
      uid: string;
    }) =>
      apiFetch<AuthResponse & { needsOnboarding?: boolean }>('/api/auth/token/google', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    discordLogin: (data: {
      id: string;
      username: string;
      discriminator: string;
      email: string | null;
      avatar: string | null;
    }) =>
      apiFetch<AuthResponse & { needsOnboarding?: boolean }>('/api/auth/token/discord', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    // Mobile OAuth flow - Discord
    discordMobileInit: async () => {
      console.log('[API] 🔵 Initializing Discord mobile OAuth...');
      return apiFetch<{ authUrl: string }>('/api/auth/mobile/discord/init', {
        method: 'GET',
      });
    },

    // Mobile OAuth flow - Exchange code for tokens
    mobileExchange: async (code: string) => {
      console.log('[API] 🔵 Exchanging OAuth code for tokens...');
      return apiFetch<AuthResponse & { needsOnboarding?: boolean }>('/api/auth/mobile/exchange', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
    },

    // Mobile Google login (after Firebase auth)
    googleMobileLogin: (data: {
      email: string;
      displayName: string;
      photoURL: string | null;
      uid: string;
    }) => {
      console.log('[API] 🔵 Google mobile login...');
      return apiFetch<AuthResponse & { needsOnboarding?: boolean }>('/api/auth/mobile/google', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    forgotPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
      console.log('[API] 🔵 Requesting password reset for:', email);
      const baseUrl = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      
      const response = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      console.log('[API] Forgot password response:', response.status, data);
      
      if (!response.ok && response.status !== 200) {
        throw new APIError(data.message || 'Failed to send password reset email', response.status, data);
      }
      
      return { success: true, message: data.message || 'Password reset email sent' };
    },

    resetPassword: async (token: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
      console.log('[API] 🔵 Resetting password with token');
      const baseUrl = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
      
      const response = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });
      
      const data = await response.json();
      console.log('[API] Reset password response:', response.status, data);
      
      if (!response.ok) {
        throw new APIError(data.message || 'Failed to reset password', response.status, data);
      }
      
      return { success: true, message: data.message || 'Password reset successfully' };
    },
  },

  clips: {
    getFeed: (token?: string, params?: { page?: number; limit?: number; gameId?: number; userId?: number }) => {
      const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
      return apiFetch<Clip[]>(`/api/clips${queryString}`, {
        method: 'GET',
        token,
      });
    },

    getLatest: (token?: string) =>
      apiFetch<Clip[]>('/api/clips/latest', {
        method: 'GET',
        token,
      }),

    getTrending: (token?: string, period: "recent" | "1w" | "1m" | "ever" = "ever") =>
      apiFetch<Clip[]>(`/api/clips/trending?period=${period}`, {
        method: 'GET',
        token,
      }),

    getClip: (id: string, token?: string) =>
      apiFetch<Clip>(`/api/clips/${id}`, {
        method: 'GET',
        token,
      }),

    createClip: (data: unknown, token: string) =>
      apiFetch<{ clip: Clip }>('/api/clips', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      }),

    getLikeStatus: async (id: string, token: string) => {
      console.log('[Clips API] 🔵 Checking like status for clip:', id);
      return apiFetch<{ hasLiked: boolean }>(`/api/clips/${id}/likes/status`, {
        method: 'GET',
        token,
      });
    },

    like: async (id: string, token: string) => {
      console.log('[Clips API] 🔵 Toggling like for clip:', id);
      const response = await apiFetch<{ message: string; liked: boolean; like?: unknown; count: number }>(`/api/clips/${id}/likes`, {
        method: 'POST',
        token,
      });
      return { liked: response.liked, likeCount: response.count };
    },

    unlike: async (id: string, token: string) => {
      console.log('[Clips API] 🔵 Unliking clip:', id);
      const response = await apiFetch<{ message: string; liked: boolean }>(`/api/clips/${id}/likes`, {
        method: 'DELETE',
        token,
      });
      return { liked: response.liked };
    },

    getReactions: async (id: string, token?: string) => {
      console.log('[Clips API] 🔵 Getting reactions for clip:', id);
      return apiFetch<Reaction[]>(`/api/clips/${id}/reactions`, {
        method: 'GET',
        token,
      });
    },

    fire: async (id: string, token: string, emoji: string = '🔥') => {
      console.log('[Clips API] 🔵 Adding fire reaction to clip:', id);
      const response = await apiFetch<Reaction>(`/api/clips/${id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
        token,
      });
      return { fired: true, fireCount: 1, reaction: response };
    },

    toggleFire: async (id: string, token: string): Promise<{ fired: boolean; fireCount: number; reactionId?: number }> => {
      console.log('[Clips API] 🔵 toggleFire - clipId:', id);
      
      // Single toggle endpoint - backend automatically detects if user already fired and toggles
      const response = await apiFetch<{
        id?: number;
        clipId?: number;
        userId?: number;
        emoji?: string;
        reacted: boolean;
        count: number;
        message?: string;
        removedReactionId?: number;
      }>(`/api/clips/${id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji: '🔥' }),
        token,
      });
      
      console.log('[Clips API] ✅ toggleFire response:', JSON.stringify(response));
      console.log('[Clips API] ✅ reacted:', response.reacted, 'count:', response.count);
      
      return {
        fired: response.reacted,
        fireCount: response.count,
        reactionId: response.reacted ? response.id : undefined,
      };
    },

    deleteReaction: async (clipId: string, reactionId: number, token: string) => {
      console.log('[Clips API] 🔵 Deleting reaction:', reactionId, 'from clip:', clipId);
      return apiFetch<{ message: string }>(`/api/reactions/${reactionId}`, {
        method: 'DELETE',
        token,
      });
    },

    likeClip: async (id: string, token: string) => {
      console.log('[Clips API] 🔵 Toggling like for clip:', id);
      const response = await apiFetch<{ message: string; liked: boolean; like?: unknown; count: number }>(`/api/clips/${id}/likes`, {
        method: 'POST',
        token,
      });
      return { liked: response.liked, likeCount: response.count };
    },

    getComments: (id: string, token?: string) =>
      apiFetch<Comment[]>(`/api/clips/${id}/comments`, {
        method: 'GET',
        token,
      }),

    addComment: async (id: string, data: { content: string }, token: string) => {
      console.log('[Clips API] 🔵 Adding comment to clip:', id);
      const response = await apiFetch<Comment>(`/api/clips/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      });
      return { comment: response };
    },

    deleteComment: async (clipId: string, commentId: number, token: string) => {
      console.log('[Clips API] 🔵 Deleting comment:', commentId);
      return apiFetch<{ message: string }>(`/api/clips/${clipId}/comments/${commentId}`, {
        method: 'DELETE',
        token,
      });
    },

    delete: (id: string, token: string) =>
      apiFetch<{ success: boolean; message: string }>(`/api/clips/${id}`, {
        method: 'DELETE',
        token,
      }),

    getByHashtag: (hashtag: string, token?: string) =>
      apiFetch<Clip[]>(`/api/clips/hashtag/${encodeURIComponent(hashtag)}`, {
        method: 'GET',
        token,
      }),
  },

  reels: {
    getLatest: (token?: string) =>
      apiFetch<Clip[]>('/api/reels/latest', {
        method: 'GET',
        token,
      }),

    getTrending: (token?: string) =>
      apiFetch<Clip[]>('/api/reels/trending', {
        method: 'GET',
        token,
      }),
  },

  screenshots: {
    getUserScreenshots: (userId: number, token?: string) =>
      apiFetch<Screenshot[]>(`/api/users/${userId}/screenshots`, {
        method: 'GET',
        token,
      }),

    delete: (id: string, token: string) =>
      apiFetch<{ success: boolean; message: string }>(`/api/screenshots/${id}`, {
        method: 'DELETE',
        token,
        useCookieAuth: true,
      }),

    getLikeStatus: async (id: string, token: string) => {
      console.log('[Screenshots API] 🔵 Checking like status for screenshot:', id);
      return apiFetch<{ hasLiked: boolean }>(`/api/screenshots/${id}/likes/status`, {
        method: 'GET',
        token,
        useCookieAuth: true,
      });
    },

    like: async (id: string, token: string) => {
      console.log('[Screenshots API] 🔵 Toggling like for screenshot:', id);
      const response = await apiFetch<{ message: string; liked: boolean; like?: unknown; count: number }>(`/api/screenshots/${id}/likes`, {
        method: 'POST',
        token,
        useCookieAuth: true,
      });
      return { liked: response.liked, likeCount: response.count };
    },

    unlike: async (id: string, token: string) => {
      console.log('[Screenshots API] 🔵 Unliking screenshot:', id);
      const response = await apiFetch<{ message: string; liked: boolean }>(`/api/screenshots/${id}/likes`, {
        method: 'DELETE',
        token,
        useCookieAuth: true,
      });
      return { liked: response.liked };
    },

    getReactions: async (id: string, token?: string) => {
      console.log('[Screenshots API] 🔵 Getting reactions for screenshot:', id);
      return apiFetch<Reaction[]>(`/api/screenshots/${id}/reactions`, {
        method: 'GET',
        token,
        useCookieAuth: true,
      });
    },

    fire: async (id: string, token: string, emoji: string = '🔥') => {
      console.log('[Screenshots API] 🔵 Adding fire reaction to screenshot:', id);
      const response = await apiFetch<Reaction>(`/api/screenshots/${id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
        token,
        useCookieAuth: true,
      });
      return { fired: true, fireCount: 1, reaction: response };
    },

    toggleFire: async (id: string, token: string, currentUserId: number, isFired: boolean) => {
      console.log('[Screenshots API] 🔵 Toggling fire for screenshot:', id, 'currently fired:', isFired);
      
      if (isFired) {
        // Fire reactions cannot be removed - the Gamefolio backend doesn't support DELETE for reactions
        // Once fired, always fired - just return current state
        console.log('[Screenshots API] ⚠️ User already fired this screenshot - fires cannot be removed');
        return { fired: true, fireCount: 0 };
      } else {
        // Add new reaction - POST always creates a new reaction (no toggle behavior)
        try {
          await apiFetch<Reaction>(`/api/screenshots/${id}/reactions`, {
            method: 'POST',
            body: JSON.stringify({ emoji: '🔥' }),
            token,
            useCookieAuth: true,
          });
        } catch (addError) {
          console.error('[Screenshots API] ❌ Error adding reaction:', addError);
          if (addError instanceof APIError && addError.status === 401) {
            throw addError;
          }
          return { fired: false, fireCount: 0 };
        }
        // Refetch to get accurate count
        try {
          const updatedReactions = await apiFetch<Reaction[]>(`/api/screenshots/${id}/reactions`, {
            method: 'GET',
            token,
            useCookieAuth: true,
          });
          const updatedFireCount = updatedReactions.filter(r => r.emoji === '🔥').length;
          return { fired: true, fireCount: updatedFireCount };
        } catch (refetchError) {
          console.error('[Screenshots API] ⚠️ Error refetching after add:', refetchError);
          return { fired: true, fireCount: 1 };
        }
      }
    },

    getComments: (id: string, token?: string) =>
      apiFetch<Comment[]>(`/api/screenshots/${id}/comments`, {
        method: 'GET',
        token,
        useCookieAuth: true,
      }),

    addComment: async (id: string, data: { content: string }, token: string) => {
      console.log('[Screenshots API] 🔵 Adding comment to screenshot:', id);
      const response = await apiFetch<Comment>(`/api/screenshots/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify(data),
        token,
        useCookieAuth: true,
      });
      return { comment: response };
    },

    deleteComment: async (screenshotId: string, commentId: number, token: string) => {
      console.log('[Screenshots API] 🔵 Deleting comment:', commentId);
      return apiFetch<{ message: string }>(`/api/screenshots/${screenshotId}/comments/${commentId}`, {
        method: 'DELETE',
        token,
        useCookieAuth: true,
      });
    },

    getTrending: async (params?: { period?: 'recent' | '1w' | '1m' | 'ever'; limit?: number; gameId?: number }, token?: string) => {
      const queryParams = new URLSearchParams();
      if (params?.period) queryParams.append('period', params.period);
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.gameId) queryParams.append('gameId', params.gameId.toString());
      
      const queryString = queryParams.toString();
      const url = queryString ? `/api/trending/screenshots?${queryString}` : '/api/trending/screenshots';
      
      console.log('[Screenshots API] 🔵 Fetching trending screenshots:', url);
      
      interface APIScreenshot {
        id: number;
        imageUrl: string;
        caption?: string;
        title?: string;
        description?: string;
        userId: number;
        gameId: number;
        views?: number;
        shareCode?: string;
        ageRestricted?: boolean;
        createdAt?: string;
        thumbnailUrl?: string;
        user?: {
          id: number;
          username: string;
          displayName?: string;
          avatarUrl?: string;
        };
        game?: {
          id: number;
          name: string;
          imageUrl?: string;
        };
        likesCount?: number;
        reactionsCount?: number;
        commentsCount?: number;
        _count?: {
          likes: number;
          comments: number;
          fires?: number;
        };
        isLiked?: boolean;
        isFired?: boolean;
      }
      
      const response = await apiFetch<APIScreenshot[]>(url, {
        method: 'GET',
        token,
      });
      
      console.log('[Screenshots API] 🔵 Raw API response:', response?.length || 0, 'screenshots');
      
      const transformedScreenshots: Screenshot[] = response.map((item) => ({
        id: item.id,
        userId: item.userId,
        gameId: item.gameId,
        title: item.title || item.caption || 'Screenshot',
        description: item.description || item.caption || '',
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl || item.imageUrl,
        shareCode: item.shareCode || `ss${item.id}`,
        views: item.views || 0,
        ageRestricted: item.ageRestricted || false,
        createdAt: item.createdAt || new Date().toISOString(),
        user: item.user ? {
          id: item.user.id,
          username: item.user.username,
          displayName: item.user.displayName || item.user.username,
          avatarUrl: item.user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
        } : undefined,
        game: item.game ? {
          id: item.game.id,
          name: item.game.name,
          imageUrl: item.game.imageUrl || '',
        } : undefined,
        _count: item._count || {
          likes: item.likesCount || 0,
          comments: item.commentsCount || 0,
          fires: item.reactionsCount || 0,
        },
        isLiked: item.isLiked,
        isFired: item.isFired,
      }));
      
      console.log('[Screenshots API] ✅ Transformed', transformedScreenshots.length, 'screenshots');
      return transformedScreenshots;
    },
  },

  users: {
    search: async (query: string, token?: string) => {
      console.log('[Users API] 🔵 Searching users:', query);
      return apiFetch<{
        users: {
          id: number;
          username: string;
          displayName: string;
          avatarUrl: string | null;
          level?: number;
          totalXP?: number;
        }[];
      }>(`/api/users/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        token,
      });
    },

    getFeatured: async (token?: string) => {
      console.log('[Users API] 🔵 Fetching featured users...');
      return apiFetch<{
        id: number;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        level?: number;
        totalXP?: number;
        bio?: string;
      }[]>('/api/users/featured', {
        method: 'GET',
        token,
      });
    },

    getLevelProgress: async (userId: number, token?: string) => {
      console.log(`[Users API] 🔵 Fetching level progress for user ${userId}...`);
      return apiFetch<{
        level: number;
        currentXP: number;
        currentPoints: number;
        pointsForCurrentLevel: number;
        pointsForNextLevel: number;
        pointsRemaining: number;
        progressPercent: number;
      }>(`/api/user/${userId}/level-progress`, {
        method: 'GET',
        token,
      });
    },

    getProfile: async (username: string, token?: string) => {
      interface ProfileAPIResponse {
        user?: User & {
          clipsCount?: number;
          followersCount?: number;
          followingCount?: number;
        };
        id?: number;
        username?: string;
        displayName?: string;
        clipsCount?: number;
        followersCount?: number;
        followingCount?: number;
      }
      
      const response = await apiFetch<ProfileAPIResponse>(`/api/users/${username}`, {
        method: 'GET',
        token,
      });
      
      console.log('[Users API] Raw profile response:', JSON.stringify(response, null, 2));
      
      // Handle both wrapped and unwrapped response formats
      let user: User & { clipsCount?: number; followersCount?: number; followingCount?: number };
      
      if (response.user) {
        // Response has user wrapper: { user: { ... } }
        user = response.user;
      } else if (response.id || response.username) {
        // Response is the user object directly: { id, username, ... }
        user = response as unknown as User & { clipsCount?: number; followersCount?: number; followingCount?: number };
      } else {
        console.error('[Users API] Invalid profile response structure');
        throw new Error('Invalid profile response');
      }
      
      // Map flat count fields to _count structure if present
      if (!user._count) {
        user._count = {
          clips: user.clipsCount ?? 0,
          followers: user.followersCount ?? 0,
          following: user.followingCount ?? 0,
        };
      }
      
      // Also check for snake_case variants
      if (user._count.clips === 0 && user._count.followers === 0 && user._count.following === 0) {
        const anyUser = user as any;
        user._count = {
          clips: anyUser.clips_count ?? anyUser.clipsCount ?? anyUser.clipCount ?? 0,
          followers: anyUser.followers_count ?? anyUser.followersCount ?? anyUser.followerCount ?? 0,
          following: anyUser.following_count ?? anyUser.followingCount ?? 0,
        };
      }
      
      console.log('[Users API] Profile stats extracted:', {
        clips: user._count.clips,
        followers: user._count.followers,
        following: user._count.following,
        rawClipsCount: (user as any).clipsCount,
        rawFollowersCount: (user as any).followersCount,
        rawFollowingCount: (user as any).followingCount,
      });
      
      return { user };
    },

    updateProfile: (id: number, data: unknown, token: string) =>
      apiFetch<{ user: User }>(`/api/user`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        token,
      }),

    getUserClips: (username: string, token?: string) =>
      apiFetch<Clip[]>(`/api/users/${username}/clips`, {
        method: 'GET',
        token,
      }),
    
    // Note: getFavorites should use tRPC (users.getFavorites) instead of REST
    // This REST endpoint may not exist on production
    getFavorites: (username: string, token?: string) =>
      apiFetch<Game[]>(`/api/users/${username}/games/favorites`, {
        method: 'GET',
        token,
      }),
  },

  games: {
    getAll: (token?: string) =>
      apiFetch<Game[]>('/api/games', {
        method: 'GET',
        token,
      }),

    getGame: (id: number | string, token?: string) =>
      apiFetch<Game>(`/api/games/${id}`, {
        method: 'GET',
        token,
      }),

    getGameClips: (id: number | string, token?: string) =>
      apiFetch<Clip[]>(`/api/games/${id}/clips`, {
        method: 'GET',
        token,
      }),

    getTrending: (token?: string) =>
      apiFetch<Game[]>('/api/games/trending', {
        method: 'GET',
        token,
      }),
    
    getTopGames: (limit: number = 30, token?: string, cursor?: string) =>
      apiFetch<{ games: TwitchGame[]; nextCursor?: string }>(`/api/twitch/games/top?limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`, {
        method: 'GET',
        token,
      }),
    
    searchGames: (query: string, limit: number = 10, token?: string) => {
      const trimmedQuery = query?.trim();
      if (!trimmedQuery || trimmedQuery.length === 0) {
        console.log('[API] Skipping searchGames - empty query');
        return Promise.resolve({ games: [] as TwitchGame[] });
      }
      return apiFetch<{ games: TwitchGame[] }>(`/api/twitch/games/search?query=${encodeURIComponent(trimmedQuery)}&limit=${limit}`, {
        method: 'GET',
        token,
      });
    },
  },

  messages: {
    getConversations: async (token: string) => {
      console.log('[Messages API] 🔵 Fetching conversations via REST (JWT auth)...');
      
      const response = await apiFetch<Conversation[]>('/api/messages/conversations', {
        method: 'GET',
        token,
      });
      return response;
    },

    getMessages: async (userId: number, token: string) => {
      console.log(`[Messages API] 🔵 Fetching messages with user ${userId} via REST (JWT auth)...`);
      const response = await apiFetch<Message[]>(`/api/messages/${userId}`, {
        method: 'GET',
        token,
      });
      return response;
    },

    send: async (data: { receiverId: number; content: string }, token: string) => {
      console.log(`[Messages API] 🔵 Sending message to user ${data.receiverId} via REST (JWT auth)...`);
      const response = await apiFetch<Message>('/api/messages', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      });
      return response;
    },

    startConversation: async (data: { username: string; content: string }, token: string) => {
      console.log(`[Messages API] 🔵 Starting conversation with ${data.username} via REST (JWT auth)...`);
      const response = await apiFetch<{ conversation: Conversation; message: Message }>('/api/messages/start', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      });
      return response;
    },

    deleteMessage: async (messageId: number, token: string) => {
      console.log(`[Messages API] 🔵 Deleting message ${messageId} via REST (JWT auth)...`);
      const response = await apiFetch<{ success: boolean }>(`/api/messages/${messageId}`, {
        method: 'DELETE',
        token,
      });
      return { messageId, ...response };
    },

    deleteConversation: async (userId: number, token: string) => {
      console.log(`[Messages API] 🔵 Deleting conversation with user ${userId} via REST (JWT auth)...`);
      const response = await apiFetch<{ success: boolean }>(`/api/messages/conversation/${userId}`, {
        method: 'DELETE',
        token,
      });
      return response;
    },

    markRead: async (userId: number, token: string) => {
      console.log(`[Messages API] 🔵 Marking messages as read for user ${userId} via REST (JWT auth)...`);
      const response = await apiFetch<{ success: boolean }>(`/api/messages/${userId}/read`, {
        method: 'POST',
        token,
      });
      return response;
    },
  },

  search: {
    users: (query: string, token: string) => {
      console.log(`[Search API] 🔵 Searching users: ${query} via REST (JWT auth)...`);
      return apiFetch<{ users: User[] }>(`/api/users/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        token,
      });
    },

    search: (query: string, token?: string) => {
      console.log(`[Search API] 🔵 Searching all: ${query} via REST...`);
      return apiFetch<{
        games?: TwitchGame[];
        users?: User[];
        hashtags?: { id: string; name: string; count: number }[];
        clips?: Clip[];
        reels?: Clip[];
        screenshots?: Screenshot[];
      }>(`/api/search?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        token,
      });
    },
  },

  tags: {
    getTrending: (token?: string) => {
      console.log('[Tags API] 🔵 Fetching trending tags...');
      return apiFetch<string[]>('/api/tags/trending', {
        method: 'GET',
        token,
      });
    },
  },

  blocking: {
    block: async (userId: number, token: string) => {
      console.log(`[Blocking API] 🔵 Blocking user ${userId}...`);
      return apiFetch<{ success: boolean }>('/api/users/block', {
        method: 'POST',
        body: JSON.stringify({ userId }),
        token,
      });
    },

    unblock: async (userId: number, token: string) => {
      console.log(`[Blocking API] 🔵 Unblocking user ${userId}...`);
      return apiFetch<{ success: boolean }>('/api/users/unblock', {
        method: 'POST',
        body: JSON.stringify({ userId }),
        token,
      });
    },

    getBlocked: async (token: string) => {
      console.log('[Blocking API] 🔵 Fetching blocked users...');
      return apiFetch<{ blockedUsers: User[] }>('/api/users/blocked', {
        method: 'GET',
        token,
      });
    },
  },

  lootbox: {
    getStatus: async (token: string) => {
      console.log('[Lootbox API] 🔵 Checking lootbox status...');
      return apiFetch<{
        canOpen: boolean;
        lastOpenedAt: string | null;
        nextOpenAt: string | null;
      }>('/api/lootbox/status', {
        method: 'GET',
        token,
      });
    },

    open: async (token: string) => {
      console.log('[Lootbox API] 🔵 Opening lootbox...');
      return apiFetch<{
        reward: {
          id: number;
          name: string;
          imageUrl: string | null;
          assetType: 'xp_reward' | 'gf_tokens' | 'avatar_border';
          rarity: 'common' | 'rare' | 'epic' | 'legendary';
          rewardValue: number;
        };
        isDuplicate: boolean;
        consumed: boolean;
        message: string;
      }>('/api/lootbox/open', {
        method: 'POST',
        token,
      });
    },

    getAvailableRewards: async (token: string) => {
      console.log('[Lootbox API] 🔵 Fetching available rewards...');
      return apiFetch<{
        id: number;
        name: string;
        imageUrl: string | null;
        assetType: 'xp_reward' | 'gf_tokens' | 'avatar_border';
        rarity: 'common' | 'rare' | 'epic' | 'legendary';
        rewardValue: number;
      }[]>('/api/lootbox/available-rewards', {
        method: 'GET',
        token,
      });
    },
  },

  leaderboard: {
    getLeaderboard: async (period: '1w' | '1m' | 'ever' = '1m', token?: string) => {
      console.log(`[Leaderboard API] 🔵 Fetching ${period} leaderboard...`);
      try {
        let endpoint = '/api/leaderboard?limit=10';
        if (period === '1w') {
          endpoint = '/api/leaderboard/weekly/current?limit=10';
        } else if (period === '1m') {
          endpoint = '/api/leaderboard/monthly/current?limit=10';
        }
        
        console.log(`[Leaderboard API] 🔵 Using endpoint: ${endpoint}`);
        
        interface LeaderboardAPIResponse {
          userId: number;
          uploadsCount: number;
          likesGivenCount: number;
          commentsCount: number;
          firesGivenCount: number;
          viewsCount: number;
          totalPoints: number;
          rank: number;
          user: {
            id: number;
            username: string;
            displayName: string;
            avatarUrl: string | null;
          };
        }
        
        const response = await apiFetch<LeaderboardAPIResponse[]>(endpoint, {
          method: 'GET',
          token,
        });
        
        console.log(`[Leaderboard API] ✅ Received ${response.length} users, transforming...`);
        
        return response.map((item, index) => ({
          id: item.user?.id ?? item.userId,
          username: item.user?.username ?? 'unknown',
          displayName: item.user?.displayName ?? item.user?.username ?? 'Unknown',
          avatarUrl: item.user?.avatarUrl ?? null,
          points: item.totalPoints ?? 0,
          rank: item.rank ?? index + 1,
          stats: {
            clips: item.uploadsCount ?? 0,
            likes: item.likesGivenCount ?? 0,
            comments: item.commentsCount ?? 0,
            fires: item.firesGivenCount ?? 0,
          },
        }));
      } catch (error) {
        console.log('[Leaderboard API] ⚠️ Leaderboard endpoint error:', error);
        return [];
      }
    },

    getXPLeaderboard: async (limit: number = 10, token?: string) => {
      console.log('[Leaderboard API] 🔵 Fetching XP leaderboard...');
      try {
        interface XPLeaderboardResponse {
          id: number;
          username: string;
          displayName: string;
          avatarUrl: string | null;
          totalXP: number;
          level: number;
          rank?: number;
        }
        
        const response = await apiFetch<XPLeaderboardResponse[]>(`/api/xp/leaderboard?limit=${limit}`, {
          method: 'GET',
          token,
        });
        
        console.log(`[Leaderboard API] ✅ Received ${response.length} XP leaderboard entries`);
        return response;
      } catch (error) {
        console.log('[Leaderboard API] ⚠️ XP leaderboard endpoint error:', error);
        return [];
      }
    },
  },

  rewards: {
    getAll: async (filters?: { rarity?: string; type?: string; active?: boolean }) => {
      console.log('[Rewards API] 🔵 Fetching all rewards...');
      const params = new URLSearchParams();
      if (filters?.rarity) params.append('rarity', filters.rarity);
      if (filters?.type) params.append('type', filters.type);
      if (filters?.active !== undefined) params.append('active', String(filters.active));
      
      const queryString = params.toString();
      const url = queryString ? `/api/rewards?${queryString}` : '/api/rewards';
      
      return apiFetch<{
        rewards: {
          id: number;
          name: string;
          description: string | null;
          type: string;
          rarity: 'common' | 'rare' | 'epic' | 'legendary';
          imageUrl: string | null;
          value: number | null;
          isActive: boolean;
          createdAt: string;
        }[];
      }>(url, { method: 'GET' });
    },

    getUserRewards: async (token: string) => {
      console.log('[Rewards API] 🔵 Fetching user rewards...');
      return apiFetch<{
        rewards: {
          id: number;
          claimedAt: string;
          quantity: number;
          reward: {
            id: number;
            name: string;
            description: string | null;
            type: string;
            rarity: 'common' | 'rare' | 'epic' | 'legendary';
            imageUrl: string | null;
            value: number | null;
          } | null;
        }[];
        stats: {
          totalItems: number;
          legendaryCount: number;
          epicCount: number;
          rareCount: number;
          commonCount: number;
        } | null;
      }>('/api/user/rewards', {
        method: 'GET',
        token,
      });
    },

    addReward: async (token: string, reward: {
      name: string;
      description?: string;
      type: string;
      rarity: 'common' | 'rare' | 'epic' | 'legendary';
      imageUrl?: string;
      value?: number;
      isActive?: boolean;
    }) => {
      console.log('[Rewards API] 🔵 Adding new reward:', reward.name);
      return apiFetch<{
        success: boolean;
        reward: {
          id: number;
          name: string;
          description: string | null;
          type: string;
          rarity: 'common' | 'rare' | 'epic' | 'legendary';
          imageUrl: string | null;
          value: number | null;
          isActive: boolean;
          createdAt: string;
        };
      }>('/api/rewards', {
        method: 'POST',
        body: JSON.stringify(reward),
        token,
      });
    },
  },

  subscription: {
    sync: async (token: string, data: { isPro: boolean; subscriptionType: 'yearly' | 'monthly' | null }) => {
      console.log('[Subscription API] 🔵 Syncing subscription status to backend...');
      return apiFetch<{ success: boolean; user: User }>('/api/subscription/sync', {
        method: 'POST',
        body: JSON.stringify(data),
        token,
      });
    },

    getStatus: async (token: string) => {
      console.log('[Subscription API] 🔵 Fetching subscription status...');
      return apiFetch<{
        isPro: boolean;
        proSubscriptionType: 'yearly' | 'monthly' | null;
        proSubscriptionStartDate: string | null;
        proSubscriptionEndDate: string | null;
      }>('/api/subscription/status', {
        method: 'GET',
        token,
        acceptHtml: true,
        htmlFallback: {
          isPro: false,
          proSubscriptionType: null,
          proSubscriptionStartDate: null,
          proSubscriptionEndDate: null,
        },
      });
    },
  },

  wallet: {
    getStatus: async (token: string) => {
      console.log('[Wallet API] 🔵 Fetching wallet status...');
      return apiFetch<{
        address: string;
        network: string;
        balance?: string;
        ready: boolean;
      }>('/api/me/wallet', {
        method: 'GET',
        token,
        acceptHtml: true,
        htmlFallback: null,
      });
    },
  },

  comments: {
    likeClipComment: async (commentId: number, token: string) => {
      console.log('[Comments API] 🔵 Liking clip comment:', commentId);
      return apiFetch<{ liked: true; likeCount: number }>(`/api/comments/${commentId}/like`, {
        method: 'POST',
        token,
      });
    },

    unlikeClipComment: async (commentId: number, token: string) => {
      console.log('[Comments API] 🔵 Unliking clip comment:', commentId);
      return apiFetch<{ liked: false; likeCount: number }>(`/api/comments/${commentId}/like`, {
        method: 'DELETE',
        token,
      });
    },

    getClipCommentLikeStatus: async (commentId: number, token?: string) => {
      console.log('[Comments API] 🔵 Getting clip comment like status:', commentId);
      return apiFetch<{ hasLiked: boolean; likeCount: number }>(`/api/comments/${commentId}/like`, {
        method: 'GET',
        token,
      });
    },

    likeScreenshotComment: async (commentId: number, token: string) => {
      console.log('[Comments API] 🔵 Liking screenshot comment:', commentId);
      return apiFetch<{ liked: true; likeCount: number }>(`/api/screenshot-comments/${commentId}/like`, {
        method: 'POST',
        token,
      });
    },

    unlikeScreenshotComment: async (commentId: number, token: string) => {
      console.log('[Comments API] 🔵 Unliking screenshot comment:', commentId);
      return apiFetch<{ liked: false; likeCount: number }>(`/api/screenshot-comments/${commentId}/like`, {
        method: 'DELETE',
        token,
      });
    },

    getScreenshotCommentLikeStatus: async (commentId: number, token?: string) => {
      console.log('[Comments API] 🔵 Getting screenshot comment like status:', commentId);
      return apiFetch<{ hasLiked: boolean; likeCount: number }>(`/api/screenshot-comments/${commentId}/like`, {
        method: 'GET',
        token,
      });
    },
  },
};
