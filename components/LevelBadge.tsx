import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LevelBadgeProps {
  level: number;
  currentXP?: number; // Total XP accumulated
  size?: number;
  thickness?: number;
}

export default function LevelBadge({ 
  level, 
  currentXP = 0, 
  size = 40, 
  thickness = 4 
}: LevelBadgeProps) {
  const center = size / 2;
  const innerSize = size - thickness * 4;

  // Create octagonal path for the badge
  const createOctagonPath = (s: number) => {
    const offset = s * 0.3;
    return `
      M ${center - s/2 + offset} ${center - s/2}
      L ${center + s/2 - offset} ${center - s/2}
      L ${center + s/2} ${center - s/2 + offset}
      L ${center + s/2} ${center + s/2 - offset}
      L ${center + s/2 - offset} ${center + s/2}
      L ${center - s/2 + offset} ${center + s/2}
      L ${center - s/2} ${center + s/2 - offset}
      L ${center - s/2} ${center - s/2 + offset}
      Z
    `;
  };

  const octagonPath = createOctagonPath(innerSize);
  const octagonBorderPath = createOctagonPath(innerSize + thickness * 2);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="darkBg" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#1E2D3C" stopOpacity="1" />
            <Stop offset="100%" stopColor="#131F2A" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="greenGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#22C55E" stopOpacity="0.3" />
            <Stop offset="100%" stopColor="#22C55E" stopOpacity="0.1" />
          </LinearGradient>
        </Defs>
        
        {/* Outer border with glow */}
        <Path
          d={octagonBorderPath}
          fill="url(#greenGlow)"
        />
        
        {/* Inner dark background */}
        <Path
          d={octagonPath}
          fill="url(#darkBg)"
          stroke="#22C55E"
          strokeWidth={thickness / 2}
        />
      </Svg>
      
      {/* Level Number */}
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.textContainer}>
          <Text style={[styles.levelText, { fontSize: size * 0.5 }]}>{level}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  textContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: {
    fontWeight: 'bold' as const,
    color: '#FFF',
    textAlign: 'center' as const,
  }
});
