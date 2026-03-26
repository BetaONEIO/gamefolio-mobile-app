import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

export const useCyberpunkPulse = () => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 4000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => {
    // Pulse shadow opacity between 0.3 and 0.8
    const shadowOpacity = interpolate(
      progress.value,
      [0, 0.5, 1],
      [0.3, 0.8, 0.3],
      Extrapolate.CLAMP
    );

    // Pulse elevation between 8 and 16
    const elevation = interpolate(
      progress.value,
      [0, 0.5, 1],
      [8, 16, 8],
      Extrapolate.CLAMP
    );

    return {
      shadowOpacity,
      elevation,
    };
  });

  return animatedStyle;
};
