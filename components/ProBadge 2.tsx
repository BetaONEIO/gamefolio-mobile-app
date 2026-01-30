import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Crown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ProBadgeProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  onPress?: () => void;
  style?: object;
}

export default function ProBadge({ 
  size = 'small', 
  showText = true, 
  onPress,
  style 
}: ProBadgeProps) {
  const dimensions = {
    small: { height: 18, iconSize: 10, fontSize: 9, paddingH: 6 },
    medium: { height: 24, iconSize: 14, fontSize: 11, paddingH: 8 },
    large: { height: 32, iconSize: 18, fontSize: 14, paddingH: 12 },
  };

  const { height, iconSize, fontSize, paddingH } = dimensions[size];

  const BadgeContent = () => (
    <LinearGradient
      colors={['#10B981', '#059669']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.badge,
        { 
          height, 
          paddingHorizontal: paddingH,
          borderRadius: height / 2,
        },
        style,
      ]}
    >
      <Crown size={iconSize} color="#fff" strokeWidth={2.5} />
      {showText && (
        <Text style={[styles.text, { fontSize, marginLeft: iconSize * 0.3 }]}>
          PRO
        </Text>
      )}
    </LinearGradient>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <BadgeContent />
      </TouchableOpacity>
    );
  }

  return <BadgeContent />;
}

export function GoProButton({ onPress, style }: { onPress: () => void; style?: object }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={style}>
      <LinearGradient
        colors={['#10B981', '#059669']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.goProButton}
      >
        <Crown size={14} color="#fff" strokeWidth={2.5} />
        <Text style={styles.goProText}>Go Pro</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  goProButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  goProText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600' as const,
  },
});
