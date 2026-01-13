import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Image,
  Pressable,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, MessageCircle, Gamepad2, Heart, Flame, Zap, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

interface UserProfilePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    bannerUrl?: string;
    isOnline?: boolean;
    level?: number;
    verified?: boolean;
    bio?: string;
    stats?: {
      clips: number;
      followers: number;
      following: number;
    };
    engagement?: {
      likes: number;
      fires: number;
      streak: number;
    };
    favoriteGames?: string[];
  };
}

export default function UserProfilePreviewModal({
  visible,
  onClose,
  user,
}: UserProfilePreviewModalProps) {
  const router = useRouter();

  const handleViewProfile = () => {
    onClose();
    router.push({
      pathname: '/user/[id]' as any,
      params: { id: user.username },
    });
  };

  const handleMessage = () => {
    onClose();
    router.push({
      pathname: '/conversation/[id]' as any,
      params: { id: user.id, username: user.username },
    });
  };

  const stats = user.stats || { clips: 0, followers: 0, following: 0 };
  const engagement = user.engagement || { likes: 0, fires: 0, streak: 0 };
  const favoriteGames = user.favoriteGames || ['Fortnite', 'Call of Duty', 'Apex Legends'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalContent}>
            {user.bannerUrl ? (
              <Image source={{ uri: user.bannerUrl }} style={styles.bannerImage} />
            ) : (
              <LinearGradient
                colors={['#4ADE80', '#22C55E', '#16A34A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerGradient}
              />
            )}
            <View style={styles.bannerOverlay} />
            
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={20} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.contentContainer}>
            <View style={styles.header}>
              <View style={styles.avatarContainer}>
                <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                {user.isOnline && <View style={styles.onlineIndicator} />}
                {user.level && (
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelText}>{user.level}</Text>
                  </View>
                )}
              </View>

              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.displayName} numberOfLines={1}>
                    {user.displayName}
                  </Text>
                  {user.verified && (
                    <View style={styles.verifiedBadge}>
                      <Check size={8} color="#FFF" strokeWidth={4} />
                    </View>
                  )}
                </View>
                <Text style={styles.username}>@{user.username}</Text>
                {user.isOnline && (
                  <TouchableOpacity 
                    style={styles.statusRow}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      handleMessage();
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>Online</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.clips}</Text>
                <Text style={styles.statLabel}>Clips</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.followers}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.following}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
            </View>

            <View style={styles.engagementRow}>
              <View style={styles.engagementItem}>
                <Heart size={14} color="#EF4444" fill="#EF4444" />
                <Text style={styles.engagementText}>{engagement.likes}</Text>
              </View>
              <View style={styles.engagementItem}>
                <Flame size={14} color="#F97316" fill="#F97316" />
                <Text style={styles.engagementText}>{engagement.fires}</Text>
              </View>
              <View style={styles.engagementItem}>
                <Zap size={14} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.engagementText}>{engagement.streak} streak</Text>
              </View>
            </View>

            {user.bio && (
              <Text style={styles.bio} numberOfLines={2}>
                {user.bio}
              </Text>
            )}

            <View style={styles.gamesSection}>
              <View style={styles.gamesSectionHeader}>
                <Gamepad2 size={14} color="#4ADE80" />
                <Text style={styles.gamesSectionTitle}>Favorite Games</Text>
              </View>
              <View style={styles.gamesRow}>
                {favoriteGames.slice(0, 3).map((game, index) => (
                  <View key={index} style={styles.gameTag}>
                    <Text style={styles.gameTagText}>{game}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.viewProfileButton}
                onPress={handleViewProfile}
                activeOpacity={0.8}
              >
                <Text style={styles.viewProfileButtonText}>View Gamefolio</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.messageButton}
                onPress={handleMessage}
                activeOpacity={0.8}
              >
                <MessageCircle size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: Math.min(360, screenWidth - 48),
  },
  modalContent: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  bannerImage: {
    width: '100%',
    height: 80,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bannerGradient: {
    width: '100%',
    height: 80,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bannerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  contentContainer: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#334155',
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#1E293B',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    backgroundColor: '#F59E0B',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  levelText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginRight: 6,
  },
  verifiedBadge: {
    backgroundColor: '#3B82F6',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#22C55E',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#334155',
  },
  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  engagementText: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  bio: {
    fontSize: 14,
    color: '#E2E8F0',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  gamesSection: {
    marginBottom: 20,
  },
  gamesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  gamesSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gamesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  gameTag: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)',
  },
  gameTagText: {
    fontSize: 12,
    color: '#4ADE80',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  viewProfileButton: {
    flex: 1,
    backgroundColor: '#4ADE80',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewProfileButtonText: {
    color: '#002E15',
    fontSize: 15,
    fontWeight: 'bold',
  },
  messageButton: {
    width: 52,
    height: 52,
    backgroundColor: '#334155',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#475569',
  },
});
