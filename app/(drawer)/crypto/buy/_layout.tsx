import { Stack } from 'expo-router';

export default function BuyLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#0F1520' },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="return" />
    </Stack>
  );
}
