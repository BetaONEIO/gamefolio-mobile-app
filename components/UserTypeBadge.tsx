import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { 
  Video, 
  Gamepad2, 
  Trophy, 
  Upload, 
  Code, 
  Eye, 
  Coffee, 
  Scroll,
  LucideIcon
} from 'lucide-react-native';

export interface UserTypeConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const USER_TYPES: Record<string, UserTypeConfig> = {
  streamer: {
    id: 'streamer',
    title: 'Streamer',
    icon: Video,
    color: '#A855F7',
    bgColor: 'rgba(168, 85, 247, 0.15)',
  },
  gamer: {
    id: 'gamer',
    title: 'Gamer',
    icon: Gamepad2,
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.15)',
  },
  professional_gamer: {
    id: 'professional_gamer',
    title: 'Pro Gamer',
    icon: Trophy,
    color: '#EAB308',
    bgColor: 'rgba(234, 179, 8, 0.15)',
  },
  content_creator: {
    id: 'content_creator',
    title: 'Creator',
    icon: Upload,
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
  },
  indie_developer: {
    id: 'indie_developer',
    title: 'Indie Dev',
    icon: Code,
    color: '#06B6D4',
    bgColor: 'rgba(6, 182, 212, 0.15)',
  },
  viewer: {
    id: 'viewer',
    title: 'Viewer',
    icon: Eye,
    color: '#6B7280',
    bgColor: 'rgba(107, 114, 128, 0.15)',
  },
  filthy_casual: {
    id: 'filthy_casual',
    title: 'Casual',
    icon: Coffee,
    color: '#F97316',
    bgColor: 'rgba(249, 115, 22, 0.15)',
  },
  doom_scroller: {
    id: 'doom_scroller',
    title: 'Doom Scroller',
    icon: Scroll,
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
};

interface UserTypeBadgeProps {
  userType?: string;
  showUserType?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function UserTypeBadge({ 
  userType, 
  showUserType = true,
  size = 'small' 
}: UserTypeBadgeProps) {
  if (!userType || !showUserType) {
    return null;
  }

  const typeConfig = USER_TYPES[userType];
  if (!typeConfig) {
    return null;
  }

  const Icon = typeConfig.icon;
  
  const iconSize = size === 'small' ? 10 : size === 'medium' ? 12 : 14;
  const fontSize = size === 'small' ? 10 : size === 'medium' ? 11 : 13;
  const paddingVertical = size === 'small' ? 3 : size === 'medium' ? 4 : 6;
  const paddingHorizontal = size === 'small' ? 6 : size === 'medium' ? 8 : 10;

  return (
    <View 
      style={[
        styles.badge, 
        { 
          backgroundColor: typeConfig.bgColor,
          borderColor: typeConfig.color,
          paddingVertical,
          paddingHorizontal,
        }
      ]}
    >
      <Icon size={iconSize} color={typeConfig.color} />
      <Text style={[styles.badgeText, { color: typeConfig.color, fontSize }]}>
        {typeConfig.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  badgeText: {
    fontWeight: '600' as const,
  },
});
