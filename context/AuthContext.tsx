import createContextHook from '@nkzw/create-context-hook';
import React, { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api, setAuthCallbacks, User, GamefolioTokens, mapRawUser } from '@/lib/api';
import { setTRPCAuthToken } from '@/lib/trpc';
import { setGamefolioTokens, clearGamefolioTokens } from '@/lib/gamefolio-api';

export interface StreakInfo {
  currentStreak: number;
  bonusAwarded: number;
  message: string;
  isNewMilestone: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  issuedAt: number;
}

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRES_KEY = 'token_expires_in';
const TOKEN_ISSUED_KEY = 'token_issued_at';
const USER_DATA_KEY = 'user_data';
const GAMEFOLIO_ACCESS_TOKEN_KEY = 'gamefolio_access_token';
const GAMEFOLIO_REFRESH_TOKEN_KEY = 'gamefolio_refresh_token';
const GAMEFOLIO_EXPIRES_KEY = 'gamefolio_expires_in';
const GAMEFOLIO_ISSUED_KEY = 'gamefolio_issued_at';

const secureStorage = {
  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [authTokens, setAuthTokens] = useState<AuthTokens | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const mountedRef = React.useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const saveTokens = async (tokens: AuthTokens) => {
    try {
      await Promise.all([
        secureStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken),
        secureStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken),
        secureStorage.setItem(TOKEN_EXPIRES_KEY, tokens.expiresIn.toString()),
        secureStorage.setItem(TOKEN_ISSUED_KEY, tokens.issuedAt.toString()),
      ]);
      console.log('[Auth] Tokens saved securely');
    } catch (error) {
      console.error('[Auth] Failed to save tokens:', error);
      throw error;
    }
  };

  const loadTokens = async (): Promise<AuthTokens | null> => {
    try {
      const [accessToken, refreshToken, expiresIn, issuedAt] = await Promise.all([
        secureStorage.getItem(ACCESS_TOKEN_KEY),
        secureStorage.getItem(REFRESH_TOKEN_KEY),
        secureStorage.getItem(TOKEN_EXPIRES_KEY),
        secureStorage.getItem(TOKEN_ISSUED_KEY),
      ]);

      if (!accessToken || !refreshToken || !expiresIn || !issuedAt) {
        return null;
      }

      return {
        accessToken,
        refreshToken,
        expiresIn: parseInt(expiresIn, 10),
        issuedAt: parseInt(issuedAt, 10),
      };
    } catch (error) {
      console.error('[Auth] Failed to load tokens:', error);
      return null;
    }
  };

  const clearTokens = async () => {
    try {
      await Promise.all([
        secureStorage.removeItem(ACCESS_TOKEN_KEY),
        secureStorage.removeItem(REFRESH_TOKEN_KEY),
        secureStorage.removeItem(TOKEN_EXPIRES_KEY),
        secureStorage.removeItem(TOKEN_ISSUED_KEY),
        secureStorage.removeItem(USER_DATA_KEY),
      ]);
      console.log('[Auth] Tokens cleared');
    } catch (error) {
      console.error('[Auth] Failed to clear tokens:', error);
    }
  };

  const isTokenExpired = (tokens: AuthTokens): boolean => {
    const now = Date.now();
    const expiresAt = tokens.issuedAt + tokens.expiresIn * 1000;
    const timeUntilExpiry = expiresAt - now;
    return timeUntilExpiry < 60000;
  };

  const shouldRefreshToken = (tokens: AuthTokens): boolean => {
    const now = Date.now();
    const expiresAt = tokens.issuedAt + tokens.expiresIn * 1000;
    const timeUntilExpiry = expiresAt - now;
    const oneDayInMs = 24 * 60 * 60 * 1000;
    return timeUntilExpiry < oneDayInMs;
  };

  const refreshAccessToken = useCallback(async (): Promise<AuthTokens | null> => {
    if (isRefreshing) return null;
    
    const currentTokens = authTokens;
    if (!currentTokens) {
      console.log('[Auth] No tokens available to refresh');
      return null;
    }

    setIsRefreshing(true);
    try {
      console.log('[Auth] Refreshing access token...');
      
      const data = await api.auth.refreshToken({
        refreshToken: currentTokens.refreshToken,
      });
      
      const newTokens: AuthTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
        issuedAt: Date.now(),
      };

      await saveTokens(newTokens);
      if (mountedRef.current) {
        setAuthTokens(newTokens);
      }
      
      // Also update Gamefolio tokens for uploads
      console.log('[Auth] Syncing refreshed tokens with Gamefolio API module');
      setGamefolioTokens(newTokens.accessToken, newTokens.refreshToken, newTokens.expiresIn, newTokens.issuedAt);
      await Promise.all([
        secureStorage.setItem(GAMEFOLIO_ACCESS_TOKEN_KEY, newTokens.accessToken),
        secureStorage.setItem(GAMEFOLIO_REFRESH_TOKEN_KEY, newTokens.refreshToken),
        secureStorage.setItem(GAMEFOLIO_EXPIRES_KEY, newTokens.expiresIn.toString()),
        secureStorage.setItem(GAMEFOLIO_ISSUED_KEY, newTokens.issuedAt.toString()),
      ]);
      
      if (data.user && mountedRef.current) {
        const mappedUser = mapRawUser(data.user);
        setUser(mappedUser);
        await secureStorage.setItem(USER_DATA_KEY, JSON.stringify(mappedUser));
      }

      console.log('[Auth] Token refreshed successfully');
      return newTokens;
    } catch {
      // Session expired - this is expected behavior, not an error
      console.log('[Auth] Session expired, please log in again');
      await clearTokens();
      if (mountedRef.current) {
        setUser(null);
        setAuthTokens(null);
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [isRefreshing, authTokens]);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const [tokens, userData] = await Promise.all([
          loadTokens(),
          secureStorage.getItem(USER_DATA_KEY),
        ]);

        if (cancelled || !mountedRef.current) return;

        if (tokens && userData) {
          if (isTokenExpired(tokens)) {
            console.log('[Auth] Token expired, attempting refresh...');
            try {
              const data = await api.auth.refreshToken({
                refreshToken: tokens.refreshToken,
              });
              
              if (cancelled || !mountedRef.current) return;
              
              const newTokens: AuthTokens = {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                expiresIn: data.expiresIn,
                issuedAt: Date.now(),
              };

              await saveTokens(newTokens);
              if (mountedRef.current) {
                setAuthTokens(newTokens);
                // Sync tokens with Gamefolio API module
                setGamefolioTokens(newTokens.accessToken, newTokens.refreshToken, newTokens.expiresIn, Date.now());
              
                if (data.user) {
                  const mappedUser = mapRawUser(data.user);
                  console.log('[Auth] Token refresh user mapped - Level:', mappedUser.level, 'XP:', mappedUser.totalXP);
                  setUser(mappedUser);
                  await secureStorage.setItem(USER_DATA_KEY, JSON.stringify(mappedUser));
                } else {
                  const cachedUser = JSON.parse(userData);
                  const mappedCached = mapRawUser(cachedUser);
                  setUser(mappedCached);
                }
              }
            } catch {
              // Token refresh failed - this is expected for expired sessions
              // Just clear tokens and let user log in again
              console.log('[Auth] Session expired, clearing tokens');
              await clearTokens();
              if (!cancelled && mountedRef.current) {
                setUser(null);
                setAuthTokens(null);
                setIsLoading(false);
              }
              return;
            }
          } else {
            if (mountedRef.current) {
              const cachedUser = mapRawUser(JSON.parse(userData));
              console.log('[Auth] Cached user mapped - Level:', cachedUser.level, 'XP:', cachedUser.totalXP);
              setAuthTokens(tokens);
              setUser(cachedUser);

              // Fetch fresh user data from backend to keep level/XP/etc current
              try {
                const freshData = await api.auth.getUser(tokens.accessToken);
                if (!cancelled && mountedRef.current && freshData.user) {
                  console.log('[Auth] Refreshed user data from backend - Level:', freshData.user.level, 'XP:', freshData.user.totalXP);
                  setUser(freshData.user);
                  await secureStorage.setItem(USER_DATA_KEY, JSON.stringify(freshData.user));
                }
              } catch (e) {
                console.log('[Auth] Could not refresh user data, using cached:', e);
              }

              // Load and sync tokens for uploads - use stored Gamefolio tokens or fall back to main tokens
              const [gfAccessToken, gfRefreshToken, gfExpiresIn, gfIssuedAt] = await Promise.all([
                secureStorage.getItem(GAMEFOLIO_ACCESS_TOKEN_KEY),
                secureStorage.getItem(GAMEFOLIO_REFRESH_TOKEN_KEY),
                secureStorage.getItem(GAMEFOLIO_EXPIRES_KEY),
                secureStorage.getItem(GAMEFOLIO_ISSUED_KEY),
              ]);
              if (gfAccessToken && gfRefreshToken && gfExpiresIn && gfIssuedAt) {
                const issuedAtNum = parseInt(gfIssuedAt, 10);
                const expiresInNum = parseInt(gfExpiresIn, 10);
                const expiryTime = issuedAtNum + (expiresInNum * 1000);
                const now = Date.now();
                
                // Check if token is expired or about to expire (within 5 minutes)
                if (expiryTime > now + 300000) {
                  console.log('[Auth] Loaded upload tokens from storage (valid)');
                  setGamefolioTokens(gfAccessToken, gfRefreshToken, expiresInNum, issuedAtNum);
                } else {
                  // Token expired or expiring soon, use main tokens instead
                  console.log('[Auth] Stored upload tokens expired, using main accessToken');
                  setGamefolioTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
                }
              } else {
                // Fall back to main tokens for uploads (they use the same JWT authentication)
                console.log('[Auth] Using main accessToken for uploads');
                setGamefolioTokens(tokens.accessToken, tokens.refreshToken, tokens.expiresIn);
              }
            }
          }
        }
      } catch {
        console.log('[Auth] Init error, clearing session');
        await clearTokens();
      } finally {
        if (!cancelled && mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    initAuth();
    
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authTokens) return;

    const checkTokenExpiry = setInterval(() => {
      if (shouldRefreshToken(authTokens)) {
        console.log('[Auth] Token needs refresh');
        refreshAccessToken();
      }
    }, 60000);

    return () => clearInterval(checkTokenExpiry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authTokens]);

  const login = useCallback(async (
    userData: User, 
    accessToken: string, 
    refreshToken: string, 
    expiresIn: number, 
    streakInfo?: StreakInfo,
    gamefolioTokens?: GamefolioTokens | null
  ) => {
    console.log('[Auth] Logging in user:', userData.username);
    
    const tokens: AuthTokens = {
      accessToken,
      refreshToken,
      expiresIn,
      issuedAt: Date.now(),
    };

    await saveTokens(tokens);
    await secureStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
    
    setUser(userData);
    setAuthTokens(tokens);
    
    // Use gamefolioTokens for uploads if provided, otherwise fall back to main accessToken
    // The Gamefolio API accepts the same JWT tokens for authentication
    const uploadAccessToken = gamefolioTokens?.accessToken || accessToken;
    const uploadRefreshToken = gamefolioTokens?.refreshToken || refreshToken;
    const uploadExpiresIn = gamefolioTokens?.expiresIn || expiresIn;
    
    console.log('[Auth] Setting upload tokens (using', gamefolioTokens?.accessToken ? 'gamefolioTokens' : 'main accessToken', ')');
    await Promise.all([
      secureStorage.setItem(GAMEFOLIO_ACCESS_TOKEN_KEY, uploadAccessToken),
      secureStorage.setItem(GAMEFOLIO_REFRESH_TOKEN_KEY, uploadRefreshToken),
      secureStorage.setItem(GAMEFOLIO_EXPIRES_KEY, uploadExpiresIn.toString()),
      secureStorage.setItem(GAMEFOLIO_ISSUED_KEY, Date.now().toString()),
    ]);
    setGamefolioTokens(uploadAccessToken, uploadRefreshToken, uploadExpiresIn);
    console.log('[Auth] Upload tokens saved successfully');

    if (streakInfo && streakInfo.bonusAwarded > 0) {
      console.log('[Auth] Streak bonus:', streakInfo.message);
    }
  }, []);

  const logout = useCallback(async () => {
    console.log('[Auth] 🔴 FORCE LOGOUT - Clearing all authentication data');
    console.log('[Auth] 🔴 This will remove all tokens and user data');
    
    try {
      const currentTokens = authTokens;
      if (currentTokens?.accessToken && currentTokens.accessToken !== 'mock-access-token') {
        console.log('[Auth] Calling backend logout endpoint...');
        try {
          await api.auth.logout(currentTokens.accessToken);
          console.log('[Auth] Backend logout successful');
        } catch (error: any) {
          console.log('[Auth] Backend logout failed (this is OK):', error.message);
        }
      }
    } catch (error) {
      console.log('[Auth] Error during logout cleanup:', error);
    }
    
    console.log('[Auth] 🔴 Clearing React state...');
    setUser(null);
    setAuthTokens(null);
    
    console.log('[Auth] 🔴 Clearing secure storage...');
    await clearTokens();
    
    // Clear Gamefolio tokens as well
    console.log('[Auth] 🔴 Clearing Gamefolio tokens...');
    clearGamefolioTokens();
    await Promise.all([
      secureStorage.removeItem(GAMEFOLIO_ACCESS_TOKEN_KEY),
      secureStorage.removeItem(GAMEFOLIO_REFRESH_TOKEN_KEY),
      secureStorage.removeItem(GAMEFOLIO_EXPIRES_KEY),
      secureStorage.removeItem(GAMEFOLIO_ISSUED_KEY),
    ]);
    
    console.log('[Auth] ✅ Logout completed successfully');
    console.log('[Auth] ✅ All authentication data has been cleared');
  }, [authTokens]);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;

    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    await secureStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
  }, [user]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    console.log('[Auth] getAccessToken called');
    if (!authTokens) {
      console.log('[Auth] No authTokens available');
      return null;
    }

    console.log('[Auth] Current token age:', (Date.now() - authTokens.issuedAt) / 1000, 'seconds');
    console.log('[Auth] Token expires in:', authTokens.expiresIn, 'seconds');
    
    if (isTokenExpired(authTokens)) {
      console.log('[Auth] Token is EXPIRED, refreshing...');
      const newTokens = await refreshAccessToken();
      if (!newTokens) {
        console.error('[Auth] Token refresh failed, user needs to re-login');
        return null;
      }
      return newTokens.accessToken;
    }

    if (shouldRefreshToken(authTokens)) {
      console.log('[Auth] Token should be refreshed soon, refreshing now...');
      const newTokens = await refreshAccessToken();
      if (newTokens) {
        return newTokens.accessToken;
      }
      console.warn('[Auth] Token refresh failed, using existing token');
    }

    console.log('[Auth] Using existing valid token');
    return authTokens.accessToken;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authTokens]);

  useEffect(() => {
    const tokenGetter = async () => {
      if (!authTokens) return null;
      try {
        if (shouldRefreshToken(authTokens)) {
          const tokens = await refreshAccessToken();
          return tokens?.accessToken || null;
        }
        return authTokens.accessToken;
      } catch {
        console.log('[Auth] Token getter failed, user may need to re-login');
        return null;
      }
    };
    
    setAuthCallbacks(
      tokenGetter,
      () => {
        if (mountedRef.current) {
          logout();
        }
      }
    );
    
    setTRPCAuthToken(async () => {
      return await getAccessToken();
    });
  }, [authTokens, refreshAccessToken, logout, getAccessToken]);

  return {
    user,
    authTokens,
    isAuthenticated: !!user && !!authTokens,
    isLoading,
    isRefreshing,
    login,
    logout,
    updateUser,
    getAccessToken,
    refreshAccessToken,
  };
});
