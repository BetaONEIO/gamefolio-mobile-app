import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Flame, User, Settings, Shield, LogOut, Trophy, Star, UserCog } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { getEffectiveAvatarUrl } from '@/lib/api';


interface ProfileDropdownProps {
  visible: boolean;
  onClose: () => void;
  topOffset: number;
  onOpenLevelTracker?: () => void;
}

export default function ProfileDropdown({ visible, onClose, topOffset, onOpenLevelTracker }: ProfileDropdownProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isPro } = useRevenueCat();

  const avatarUri = getEffectiveAvatarUrl(user) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop';

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.dropdown, { top: topOffset }]}>

              {/* Header Section */}
              <View style={styles.header}>
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                <View style={styles.userInfo}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {user?.displayName || user?.username || 'User'}
                  </Text>
                  <Text style={styles.userSubtitle} numberOfLines={1}>
                    {(user as any)?.userType || (user as any)?.title || 'Gamer'}
                  </Text>
                  <Text style={styles.userHandle}>@{user?.username || 'user'}</Text>
                </View>
                <View style={styles.streakBadge}>
                  <Flame size={13} color="#FF6B35" fill="#FF6B35" />
                  <Text style={styles.streakNumber}>{user?.currentStreak || 0}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* View Gamefolio */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  router.push('/(drawer)/(tabs)/profile');
                }}
              >
                <User size={20} color="#94A3B8" strokeWidth={1.5} />
                <Text style={styles.menuText}>View Gamefolio</Text>
              </TouchableOpacity>

              {/* Level Tracker */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenLevelTracker?.();
                }}
              >
                <Trophy size={20} color="#94A3B8" strokeWidth={1.5} />
                <Text style={styles.menuText}>Level Tracker</Text>
              </TouchableOpacity>

              {/* Go Pro */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  router.push('/(drawer)/(tabs)/profile');
                }}
              >
                <Star size={20} color="#FACC15" fill={isPro ? '#FACC15' : 'transparent'} strokeWidth={1.5} />
                <Text style={styles.menuText}>Go Pro</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Settings section */}
              <Text style={styles.sectionTitle}>Settings</Text>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/account-settings', params: { tab: 'platforms' } });
                }}
              >
                <Settings size={20} color="#94A3B8" strokeWidth={1.5} />
                <Text style={styles.menuText}>Account Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/profile-appearance', params: { tab: 'profile' } });
                }}
              >
                <UserCog size={20} color="#94A3B8" strokeWidth={1.5} />
                <Text style={styles.menuText}>Profile & Appearance</Text>
              </TouchableOpacity>

              {/* Admin Panel */}
              <TouchableOpacity style={styles.menuItem} onPress={onClose}>
                <Shield size={20} color="#94A3B8" strokeWidth={1.5} />
                <Text style={styles.menuText}>Admin Panel</Text>
              </TouchableOpacity>

              {/* Logout */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  logout();
                  router.replace('/');
                }}
              >
                <LogOut size={20} color="#EF4444" strokeWidth={1.5} />
                <Text style={[styles.menuText, styles.logoutText]}>Logout</Text>
              </TouchableOpacity>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdown: {
    position: 'absolute',
    right: 12,
    width: 300,
    backgroundColor: '#1A2535',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#253347',
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  userSubtitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
  },
  userHandle: {
    color: '#94A3B8',
    fontSize: 13,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A1206',
    borderWidth: 1,
    borderColor: '#FF6B35',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  streakNumber: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E2D3C',
    marginVertical: 2,
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 14,
  },
  menuText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '500',
  },
  logoutText: {
    color: '#EF4444',
  },
});
