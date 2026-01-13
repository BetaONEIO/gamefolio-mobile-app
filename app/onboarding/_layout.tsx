import { Stack } from 'expo-router';
import React from 'react';
import { OnboardingProvider } from '@/context/OnboardingContext';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack 
        screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 300,
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="username" />
        <Stack.Screen name="games" />
        <Stack.Screen name="avatar" />
        <Stack.Screen name="user-type" />
        <Stack.Screen name="age" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="complete" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </OnboardingProvider>
  );
}
