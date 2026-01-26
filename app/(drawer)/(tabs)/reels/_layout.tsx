import { Stack } from 'expo-router';

export default function ReelsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="latest" />
    </Stack>
  );
}
