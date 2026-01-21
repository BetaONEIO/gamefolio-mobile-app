import createContextHook from '@nkzw/create-context-hook';
import { useState } from 'react';

export interface OnboardingGame {
  twitchId: string;
  name: string;
  boxArtUrl: string;
}

export interface OnboardingData {
  username: string | null;
  userType: string | null;
  ageRange: string | null;
  selectedGames: OnboardingGame[];
  avatarUrl: string | null;
  avatarLocalUri: string | null;
  walletAddress: string | null;
  needsUsername: boolean;
  createWallet: boolean;
}

export const [OnboardingProvider, useOnboarding] = createContextHook(() => {
  const [data, setData] = useState<OnboardingData>({
    username: null,
    userType: null,
    ageRange: null,
    selectedGames: [],
    avatarUrl: null,
    avatarLocalUri: null,
    walletAddress: null,
    needsUsername: false,
    createWallet: false,
  });

  const setUsername = (username: string | null) => {
    console.log('[Onboarding] Setting username:', username);
    setData(prev => ({ ...prev, username }));
  };

  const setUserType = (type: string | null) => {
    console.log('[Onboarding] Setting user type:', type);
    setData(prev => ({ ...prev, userType: type }));
  };

  const setAgeRange = (range: string) => {
    console.log('[Onboarding] Setting age range:', range);
    setData(prev => ({ ...prev, ageRange: range }));
  };

  const setSelectedGames = (games: OnboardingGame[]) => {
    console.log('[Onboarding] Setting selected games:', games.length);
    setData(prev => ({ ...prev, selectedGames: games }));
  };

  const addSelectedGame = (game: OnboardingGame) => {
    console.log('[Onboarding] Adding game:', game.name);
    setData(prev => {
      if (prev.selectedGames.some(g => g.twitchId === game.twitchId)) {
        return prev;
      }
      return { ...prev, selectedGames: [...prev.selectedGames, game] };
    });
  };

  const removeSelectedGame = (twitchId: string) => {
    console.log('[Onboarding] Removing game:', twitchId);
    setData(prev => ({
      ...prev,
      selectedGames: prev.selectedGames.filter(g => g.twitchId !== twitchId)
    }));
  };

  const setAvatarUrl = (url: string | null) => {
    console.log('[Onboarding] Setting avatar URL:', url);
    setData(prev => ({ ...prev, avatarUrl: url }));
  };

  const setAvatarLocalUri = (uri: string | null) => {
    console.log('[Onboarding] Setting avatar local URI:', uri ? 'set' : 'null');
    setData(prev => ({ ...prev, avatarLocalUri: uri }));
  };

  const setWalletAddress = (address: string | null) => {
    console.log('[Onboarding] Setting wallet address:', address);
    setData(prev => ({ ...prev, walletAddress: address }));
  };

  const setNeedsUsername = (needs: boolean) => {
    console.log('[Onboarding] Setting needs username:', needs);
    setData(prev => ({ ...prev, needsUsername: needs }));
  };

  const setCreateWallet = (create: boolean) => {
    console.log('[Onboarding] Setting create wallet:', create);
    setData(prev => ({ ...prev, createWallet: create }));
  };

  const resetOnboarding = () => {
    console.log('[Onboarding] Resetting onboarding data');
    setData({
      username: null,
      userType: null,
      ageRange: null,
      selectedGames: [],
      avatarUrl: null,
      avatarLocalUri: null,
      walletAddress: null,
      needsUsername: false,
      createWallet: false,
    });
  };

  return {
    data,
    setUsername,
    setUserType,
    setAgeRange,
    setSelectedGames,
    addSelectedGame,
    removeSelectedGame,
    setAvatarUrl,
    setAvatarLocalUri,
    setWalletAddress,
    setNeedsUsername,
    setCreateWallet,
    resetOnboarding,
  };
});
