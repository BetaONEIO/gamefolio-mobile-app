import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { Flame, User, Settings, Shield, LogOut, TrendingUp, Crown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import ProBadge from '@/components/ProBadge';


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
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName}>{user?.displayName || user?.username || 'User'}</Text>
                    {isPro && <ProBadge size="small" />}
                    <View style={styles.streakBadge}>
                      <Flame size={11} color="#FF5722" fill="#FF5722" />
                      <Text style={styles.streakNumber}>{user?.currentStreak || 0}</Text>
                    </View>
                  </View>
                  <Text style={styles.userHandle}>@{user?.username || 'user'}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* View Profile */}
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  router.push('/(drawer)/(tabs)/profile');
                }}
              >
                <User size={20} color="#FFF" />
                <Text style={styles.menuText}>View Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  onOpenLevelTracker?.();
                }}
              >
                <TrendingUp size={20} color="#FFF" />
                <Text style={styles.menuText}>Level Tracker</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Settings Section */}
              <Text style={styles.sectionTitle}>Settings</Text>
              
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/account-settings', params: { tab: 'platforms' } });
                }}
              >
                <Settings size={20} color="#FFF" />
                <Text style={styles.menuText}>Account Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => {
                  onClose();
                  router.push({ pathname: '/profile-appearance', params: { tab: 'profile' } });
                }}
              >
                <User size={20} color="#FFF" />
                <Text style={styles.menuText}>Profile & Appearance</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Go Pro / Pro Status */}
              {!isPro && (
                <TouchableOpacity 
                  style={styles.proMenuItem}
                  onPress={() => {
                    onClose();
                    router.push('/(drawer)/(tabs)/profile');
                  }}
                >
                  <Crown size={20} color="#10B981" />
                  <Text style={styles.proMenuText}>Upgrade to Pro</Text>
                </TouchableOpacity>
              )}

              {/* Admin Panel */}
              <TouchableOpacity style={styles.menuItem} onPress={onClose}>
                <Shield size={20} color="#FFF" />
                <Text style={styles.menuText}>Admin Panel</Text>
              </TouchableOpacity>

              {/* Logout */}
              <TouchableOpacity style={styles.menuItem} onPress={() => {
                onClose();
                logout();
                router.replace('/');
              }}>
                <LogOut size={20} color="#EF4444" />
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
    right: 20,
    width: 280,
    backgroundColor: '#131F2A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingVertical: 8,
    // Shadow for depth
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
  },
  header: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  userInfo: {
    gap: 2,
    width: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A0D0A',
    borderWidth: 1,
    borderColor: '#FF5722',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 3,
  },
  streakNumber: {
    color: '#FF5722',
    fontSize: 11,
    fontWeight: 'bold',
  },
  userHandle: {
    color: '#94A3B8',
    fontSize: 14,
  },

  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
  },
  sectionTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  logoutText: {
    color: '#EF4444',
  },
  proMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    marginHorizontal: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
  proMenuText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '600' as const,
  },
});
