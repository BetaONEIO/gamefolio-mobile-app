import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Cake, PartyPopper, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface BirthdayBannerProps {
  displayName: string;
  isOwnProfile?: boolean;
}

export function isBirthdayToday(birthday: string | null | undefined): boolean {
  if (!birthday) return false;
  
  try {
    const birthDate = new Date(birthday);
    const today = new Date();
    
    return (
      birthDate.getMonth() === today.getMonth() &&
      birthDate.getDate() === today.getDate()
    );
  } catch {
    return false;
  }
}

export default function BirthdayBanner({ displayName, isOwnProfile = false }: BirthdayBannerProps) {
  const sparkleAnim1 = useRef(new Animated.Value(0)).current;
  const sparkleAnim2 = useRef(new Animated.Value(0)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim1, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim1, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(sparkleAnim2, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim2, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: -4,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(bounceAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const sparkleOpacity1 = sparkleAnim1.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  const sparkleOpacity2 = sparkleAnim2.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  const message = isOwnProfile 
    ? "Happy Birthday! Have an amazing day!" 
    : `It's ${displayName}'s Birthday!`;

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <LinearGradient
        colors={['#FF6B9D', '#C44569', '#FF6B9D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.confettiContainer}>
          <Animated.View style={[styles.sparkleLeft, { opacity: sparkleOpacity1 }]}>
            <Sparkles size={16} color="#FFD700" />
          </Animated.View>
          <Animated.View style={[styles.sparkleRight, { opacity: sparkleOpacity2 }]}>
            <Sparkles size={16} color="#FFD700" />
          </Animated.View>
        </View>

        <View style={styles.content}>
          <Animated.View style={[styles.iconContainer, { transform: [{ translateY: bounceAnim }] }]}>
            <Cake size={24} color="#FFF" />
          </Animated.View>
          
          <View style={styles.textContainer}>
            <Text style={styles.title}>{message}</Text>
            {isOwnProfile && (
              <Text style={styles.subtitle}>Wishing you all the best!</Text>
            )}
          </View>

          <View style={styles.partyIcon}>
            <PartyPopper size={20} color="#FFD700" />
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    position: 'relative',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sparkleLeft: {
    position: 'absolute',
    top: 8,
    left: 12,
  },
  sparkleRight: {
    position: 'absolute',
    top: 8,
    right: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '500' as const,
    marginTop: 2,
  },
  partyIcon: {
    marginLeft: 4,
  },
});
