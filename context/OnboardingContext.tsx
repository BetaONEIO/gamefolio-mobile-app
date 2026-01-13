import createContextHook from '@nkzw/create-context-hook';
import { useState } from 'react';

export interface OnboardingData {
  username: string | null;
  userType: string | null;
  ageRange: string | null;
  selectedGames: string[];
  avatarUrl: string | null;
  walletAddress: string | null;
  needsUsername: boolean;
}

export const [OnboardingProvider, useOnboarding] = createContextHook(() => {
  const [data, setData] = useState<OnboardingData>({
    username: null,
    userType: null,
    ageRange: null,
    selectedGames: [],
    avatarUrl: null,
    walletAddress: null,
    needsUsername: false,
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

  const setSelectedGames = (games: string[]) => {
    console.log('[Onboarding] Setting selected games:', games);
    setData(prev => ({ ...prev, selectedGames: games }));
  };

  const setAvatarUrl = (url: string | null) => {
    console.log('[Onboarding] Setting avatar URL:', url);
    setData(prev => ({ ...prev, avatarUrl: url }));
  };

  const setWalletAddress = (address: string | null) => {
    console.log('[Onboarding] Setting wallet address:', address);
    setData(prev => ({ ...prev, walletAddress: address }));
  };

  const setNeedsUsername = (needs: boolean) => {
    console.log('[Onboarding] Setting needs username:', needs);
    setData(prev => ({ ...prev, needsUsername: needs }));
  };

  const resetOnboarding = () => {
    console.log('[Onboarding] Resetting onboarding data');
    setData({
      username: null,
      userType: null,
      ageRange: null,
      selectedGames: [],
      avatarUrl: null,
      walletAddress: null,
      needsUsername: false,
    });
  };

  return {
    data,
    setUsername,
    setUserType,
    setAgeRange,
    setSelectedGames,
    setAvatarUrl,
    setWalletAddress,
    setNeedsUsername,
    resetOnboarding,
  };
});
