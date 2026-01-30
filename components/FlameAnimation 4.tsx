import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Flame } from 'lucide-react-native';

interface FlameAnimationProps {
  isActive: boolean;
  size?: number;
}

const FlameAnimation: React.FC<FlameAnimationProps> = ({ isActive, size = 28 }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacity1 = useRef(new Animated.Value(0)).current;
  const opacity2 = useRef(new Animated.Value(0)).current;
  const opacity3 = useRef(new Animated.Value(0)).current;
  const translateY1 = useRef(new Animated.Value(0)).current;
  const translateY2 = useRef(new Animated.Value(0)).current;
  const translateY3 = useRef(new Animated.Value(0)).current;



  useEffect(() => {
    if (isActive) {
      const animations = [
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.5,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.stagger(100, [
          Animated.parallel([
            Animated.timing(opacity1, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(translateY1, {
              toValue: -60,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(opacity2, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(translateY2, {
              toValue: -70,
              duration: 900,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(opacity3, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(translateY3, {
              toValue: -55,
              duration: 750,
              useNativeDriver: true,
            }),
          ]),
        ]),
      ];

      Animated.parallel(animations).start(() => {
        opacity1.setValue(0);
        opacity2.setValue(0);
        opacity3.setValue(0);
        translateY1.setValue(0);
        translateY2.setValue(0);
        translateY3.setValue(0);
      });
    }
  }, [isActive, scaleAnim, rotateAnim, opacity1, opacity2, opacity3, translateY1, translateY2, translateY3]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '15deg'],
  });

  const fadeOut1 = opacity1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });

  const fadeOut2 = opacity2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });

  const fadeOut3 = opacity3.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 1, 0],
  });

  return (
    <View style={styles.container}>
        <Animated.View
          style={[
            styles.flameParticle,
            {
              opacity: fadeOut1,
              transform: [{ translateY: translateY1 }, { translateX: -15 }],
            },
          ]}
        >
          <Flame size={size * 0.6} color="#FF6B2C" fill="#FF6B2C" />
        </Animated.View>

        <Animated.View
          style={[
            styles.flameParticle,
            {
              opacity: fadeOut2,
              transform: [{ translateY: translateY2 }, { translateX: 0 }],
            },
          ]}
        >
          <Flame size={size * 0.7} color="#FF8C42" fill="#FF8C42" />
        </Animated.View>

        <Animated.View
          style={[
            styles.flameParticle,
            {
              opacity: fadeOut3,
              transform: [{ translateY: translateY3 }, { translateX: 15 }],
            },
          ]}
        >
          <Flame size={size * 0.5} color="#FFB366" fill="#FFB366" />
        </Animated.View>

        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }, { rotate: rotation }],
          }}
        >
          <Flame size={size} color="#FF6B2C" fill="#FF6B2C" />
        </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameParticle: {
    position: 'absolute',
  },
});

export default FlameAnimation;
