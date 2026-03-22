import { Stack } from 'expo-router';

export default function BuyLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#131F2A' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="return" />
    </Stack>
  );
}
