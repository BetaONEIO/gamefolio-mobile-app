import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, api } from '@/lib/api';

export interface TwitchGame {
  id: string;
  name: string;
  box_art_url: string;
}

const STORAGE_KEY = 'user_favorite_games';
const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';


export const [UserProvider, useUser] = createContextHook(() => {
  const [favoriteGames, setFavoriteGames] = useState<TwitchGame[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    const loadData = async () => {
      try {
        const [storedGames, storedToken, storedUser] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(USER_DATA_KEY),
        ]);

        if (storedGames) {
          setFavoriteGames(JSON.parse(storedGames));
        }
        if (storedToken) {
          setAuthToken(storedToken);
          // Restore cached user immediately for fast UI, then refresh from server
          if (storedUser) {
            setUser(JSON.parse(storedUser));
          }
          // Always re-fetch from server to get fresh signed URLs (private bucket)
          try {
            const freshData = await api.auth.getUser(storedToken);
            if (freshData?.user) {
              setUser(freshData.user);
              await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(freshData.user));
            }
          } catch (refreshError) {
            console.warn('[UserContext] Could not refresh user from server:', refreshError);
          }
        } else if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Save to storage whenever favorites change
  const saveFavorites = async (games: TwitchGame[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(games));
    } catch (error) {
      console.error('Failed to save favorite games:', error);
    }
  };

  const toggleFavoriteGame = useCallback((game: TwitchGame) => {
    setFavoriteGames(prev => {
      const isSelected = prev.some(g => g.id === game.id);
      let newGames;
      if (isSelected) {
        newGames = prev.filter(g => g.id !== game.id);
      } else {
        // You might want to enforce the limit here or in the UI. 
        // For context, we just allow adding, UI handles limits/alerts.
        newGames = [...prev, game];
      }
      saveFavorites(newGames);
      return newGames;
    });
  }, []);

  const isFavorite = useCallback((gameId: string) => {
    return favoriteGames.some(g => g.id === gameId);
  }, [favoriteGames]);

  const login = useCallback(async (userData: User, token: string) => {
    console.log('[UserContext] Logging in user:', userData.username);
    setUser(userData);
    setAuthToken(token);
    try {
      await Promise.all([
        AsyncStorage.setItem(AUTH_TOKEN_KEY, token),
        AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData)),
      ]);
    } catch (error) {
      console.error('Failed to save auth data:', error);
    }
  }, []);

  const logout = useCallback(async () => {
    console.log('[UserContext] Logging out user');
    setUser(null);
    setAuthToken(null);
    try {
      await Promise.all([
        AsyncStorage.removeItem(AUTH_TOKEN_KEY),
        AsyncStorage.removeItem(USER_DATA_KEY),
      ]);
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    
    try {
      await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
      
      const token = authToken;
      if (token) {
        const response = await api.users.updateProfile(user.id, {
          displayName: updates.displayName,
          bio: updates.bio || undefined,
          avatarUrl: updates.avatarUrl || undefined,
          bannerUrl: updates.bannerUrl || undefined,
          accentColor: updates.accentColor || undefined,
          backgroundColor: updates.backgroundColor || undefined,
        }, token);

        if (response.user) {
          setUser(response.user as User);
          await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(response.user));
        }
      }
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  }, [user, authToken]);

  return {
    user,
    authToken,
    isAuthenticated: !!user && !!authToken,
    login,
    logout,
    updateUser,
    favoriteGames,
    setFavoriteGames: (games: TwitchGame[]) => {
      setFavoriteGames(games);
      saveFavorites(games);
    },
    toggleFavoriteGame,
    isFavorite,
    isLoading
  };
});
