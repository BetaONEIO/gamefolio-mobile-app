import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const segments = useSegments();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isLoading) {
      console.log('[AuthGuard] Auth is loading...');
      return;
    }

    const checkAuthState = () => {
      console.log('[AuthGuard] Checking auth state...');
      console.log('[AuthGuard] isAuthenticated:', isAuthenticated);
      console.log('[AuthGuard] user:', user?.username || 'null');
      console.log('[AuthGuard] emailVerified:', user?.emailVerified);
      console.log('[AuthGuard] userType:', user?.userType);

      console.log('[AuthGuard] Current segments:', segments);

      if (!isAuthenticated || !user) {
        console.log('[AuthGuard] Not authenticated, redirecting to login...');
        router.replace('/');
        return;
      }

      if (!user.emailVerified) {
        console.log('[AuthGuard] Email not verified, redirecting to verify-code...');
        router.replace({
          pathname: '/verify-code',
          params: { email: user.email || '' }
        });
        return;
      }

      const needsOnboarding = !user.userType;
      if (needsOnboarding) {
        console.log('[AuthGuard] Onboarding incomplete (missing userType), redirecting to onboarding...');
        router.replace('/onboarding');
        return;
      }

      console.log('[AuthGuard] User is fully authenticated and onboarded');
      setIsChecking(false);
    };

    checkAuthState();
  }, [isLoading, isAuthenticated, user, router, segments]);

  if (isLoading || isChecking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ADE80" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#131F2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
