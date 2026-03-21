import { Stack } from 'expo-router';

export default function ScreenshotsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="latest" />
    </Stack>
  );
}
