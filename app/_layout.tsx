import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { UserProvider } from "@/context/UserContext";
import { LootboxCollectionProvider } from "@/context/LootboxCollectionContext";
import { RevenueCatProvider } from "@/context/RevenueCatContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { DailyStreakProvider } from "@/context/DailyStreakContext";
import DailyStreakOverlay from "@/components/DailyStreakOverlay";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { usePushNotifications } from "@/hooks/usePushNotifications";


// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch((e) => {
  console.warn('Error preventing splash screen auto hide:', e);
});

const queryClient = new QueryClient();

function AppContent() {
  useOnlineStatus();
  const { isAuthenticated } = useAuth();
  usePushNotifications(isAuthenticated);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0F1520' }}>
      <StatusBar style="light" />
      <DailyStreakOverlay />
      <Stack screenOptions={{ 
        headerBackTitle: "Back", 
        headerShown: false,
        animation: 'slide_from_right',
        animationDuration: 250,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}>
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(drawer)" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="verify-code" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="account-settings" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="profile-appearance" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="manage-subscription" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="user/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="clip/[id]" options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  useEffect(() => {
    console.log("RootLayout mounted");
    // Hide the native splash screen immediately as we have our own splash/onboarding screen
    const hideSplash = async () => {
      try {
        await SplashScreen.hideAsync();
        console.log("Splash screen hidden");
      } catch (e) {
        console.warn("Error hiding splash screen:", e);
      }
    };
    
    hideSplash();
    
    // Safety timeout in case the promise hangs or something goes wrong
    const timeout = setTimeout(hideSplash, 1000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RevenueCatProvider>
          <NotificationsProvider>
            <DailyStreakProvider>
              <UserProvider>
                <LootboxCollectionProvider>
                  <AppContent />
                </LootboxCollectionProvider>
              </UserProvider>
            </DailyStreakProvider>
          </NotificationsProvider>
        </RevenueCatProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
