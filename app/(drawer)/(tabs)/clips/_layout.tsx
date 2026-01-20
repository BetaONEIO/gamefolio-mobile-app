import { Stack } from 'expo-router';

export default function ClipsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="latest" />
    </Stack>
  );
}
