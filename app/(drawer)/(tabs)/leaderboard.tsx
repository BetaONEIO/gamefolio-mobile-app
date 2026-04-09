import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Trophy, Heart, MessageSquare, Flame, Upload, Star, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, TouchableOpacity, ScrollView, Modal, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';


type TimePeriod = '1w' | '1m' | 'ever';

interface UserStats {
  clips: number;
  likes: number;
  comments: number;
  fires: number;
}

interface LeaderboardUser {
  id: number;
  displayName: string;
  username: string;
  points: number;
  rank: number;
  avatarUrl: string | null;
  stats: UserStats;
}

interface HistoricWinner {
  id: number;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  period: string;
  points: number;
  stats: UserStats;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const { authTokens } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('1m');
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | HistoricWinner | null>(null);
  const [showStatsModal, setShowStatsModal] = useState(false);
  
  const accessToken = authTokens?.accessToken;
  
  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', selectedPeriod, accessToken],
    queryFn: () => api.leaderboard.getLeaderboard(selectedPeriod, accessToken || undefined),
    staleTime: 30000,
  });
  
  const users: LeaderboardUser[] = leaderboardQuery.data || [];

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.4)' };
    if (rank === 2) return { bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.3)' };
    if (rank === 3) return { bg: 'rgba(180, 83, 9, 0.15)', border: 'rgba(180, 83, 9, 0.4)' };
    return { bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' };
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={18} color="#FACC15" fill="#FACC15" />;
    if (rank === 2) return <Crown size={18} color="#94A3B8" fill="#94A3B8" />;
    if (rank === 3) return <Crown size={18} color="#B45309" fill="#B45309" />;
    return <Text style={styles.rankNumber}>#{rank}</Text>;
  };

  const getPointsBadgeStyle = (points: number) => {
    if (points >= 100) return { bg: '#4ADE80', text: '#002E15' };
    if (points >= 50) return { bg: '#3B82F6', text: '#FFF' };
    if (points >= 20) return { bg: '#4ADE80', text: '#002E15' };
    if (points > 0) return { bg: '#6366F1', text: '#FFF' };
    return { bg: '#334155', text: '#9CA3AF' };
  };

  const getPeriodTitle = () => {
    if (selectedPeriod === '1w') return "This Week's Top Contributors";
    if (selectedPeriod === '1m') return "This Month's Top Contributors";
    return "All Time Top Contributors";
  };

  const handleUserPress = (user: LeaderboardUser | HistoricWinner) => {
    setSelectedUser(user);
    setShowStatsModal(true);
  };

  const handleViewProfile = () => {
    if (selectedUser) {
      setShowStatsModal(false);
      router.push(`/user/${selectedUser.username}`);
    }
  };

  const isLoading = leaderboardQuery.isLoading;
  const isError = leaderboardQuery.isError;

  const renderUserRow = (user: LeaderboardUser, index: number) => {
    const rankStyle = getRankStyle(user.rank);
    const badgeStyle = getPointsBadgeStyle(user.points);
    const uniqueKey = user.id ? `user-${user.id}` : `user-rank-${user.rank}-idx-${index}`;

    return (
      <TouchableOpacity 
        key={uniqueKey}
        style={[
          styles.userRow, 
          { 
            backgroundColor: rankStyle.bg, 
            borderColor: rankStyle.border 
          }
        ]}
        onPress={() => handleUserPress(user)}
        activeOpacity={0.7}
      >
        <View style={styles.rankContainer}>
          {getRankIcon(user.rank)}
        </View>
        
        <Image source={{ uri: user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' }} style={styles.avatar} />
        
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.displayName}</Text>
          <Text style={styles.userHandle}>@{user.username}</Text>
        </View>
        
        <View style={[styles.pointsBadge, { backgroundColor: badgeStyle.bg }]}>
          <Text style={[styles.pointsText, { color: badgeStyle.text }]}>{user.points}</Text>
        </View>
      </TouchableOpacity>
    );
  };



  const renderStatsModal = () => {
    if (!selectedUser) return null;

    const isLeaderboardUser = 'rank' in selectedUser;
    const rank = isLeaderboardUser ? selectedUser.rank : 0;
    const badgeStyle = getPointsBadgeStyle(selectedUser.points);

    return (
      <Modal
        visible={showStatsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatsModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowStatsModal(false)}
        >
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowStatsModal(false)}
            >
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>

            <View style={styles.modalHeader}>
              <View style={styles.modalAvatarContainer}>
                <Image source={{ uri: selectedUser.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' }} style={styles.modalAvatar} />
                {isLeaderboardUser && rank <= 3 && (
                  <View style={[
                    styles.modalRankBadge,
                    { backgroundColor: rank === 1 ? '#FACC15' : rank === 2 ? '#94A3B8' : '#B45309' }
                  ]}>
                    <Crown size={12} color="#000" fill="#000" />
                  </View>
                )}
              </View>
              
              <Text style={styles.modalUserName}>{selectedUser.displayName}</Text>
              <Text style={styles.modalUserHandle}>@{selectedUser.username}</Text>
              
              <View style={[styles.modalPointsBadge, { backgroundColor: badgeStyle.bg }]}>
                <Text style={[styles.modalPointsText, { color: badgeStyle.text }]}>
                  {selectedUser.points} points
                </Text>
              </View>
            </View>

            <View style={styles.modalStatsGrid}>
              <View style={styles.modalStatCard}>
                <View style={[styles.modalStatIcon, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                  <Upload size={20} color="#4ADE80" />
                </View>
                <Text style={styles.modalStatValue}>{selectedUser.stats.clips}</Text>
                <Text style={styles.modalStatLabel}>Uploads</Text>
              </View>
              
              <View style={styles.modalStatCard}>
                <View style={[styles.modalStatIcon, { backgroundColor: 'rgba(248, 113, 113, 0.15)' }]}>
                  <Heart size={20} color="#F87171" />
                </View>
                <Text style={styles.modalStatValue}>{selectedUser.stats.likes}</Text>
                <Text style={styles.modalStatLabel}>Likes</Text>
              </View>
              
              <View style={styles.modalStatCard}>
                <View style={[styles.modalStatIcon, { backgroundColor: 'rgba(96, 165, 250, 0.15)' }]}>
                  <MessageSquare size={20} color="#60A5FA" />
                </View>
                <Text style={styles.modalStatValue}>{selectedUser.stats.comments}</Text>
                <Text style={styles.modalStatLabel}>Comments</Text>
              </View>
              
              <View style={styles.modalStatCard}>
                <View style={[styles.modalStatIcon, { backgroundColor: 'rgba(251, 146, 60, 0.15)' }]}>
                  <Flame size={20} color="#FB923C" />
                </View>
                <Text style={styles.modalStatValue}>{selectedUser.stats.fires}</Text>
                <Text style={styles.modalStatLabel}>Fires</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.modalViewProfileButton}
              onPress={handleViewProfile}
            >
              <Text style={styles.modalViewProfileText}>View Gamefolio</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#021B1F', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      
      <AppHeader />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.trophyContainer}>
            <Trophy size={40} color="#FACC15" fill="#FACC15" />
          </View>
          <Text style={styles.title}>Community Leaderboard</Text>
          <Text style={styles.subtitle}>Top gamers ranked by community engagement and content contribution!</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedPeriod === '1w' && styles.tabActive]}
            onPress={() => setSelectedPeriod('1w')}
          >
            <Text style={[styles.tabText, selectedPeriod === '1w' && styles.tabTextActive]}>1W</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedPeriod === '1m' && styles.tabActive]}
            onPress={() => setSelectedPeriod('1m')}
          >
            <Text style={[styles.tabText, selectedPeriod === '1m' && styles.tabTextActive]}>1M</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedPeriod === 'ever' && styles.tabActive]}
            onPress={() => setSelectedPeriod('ever')}
          >
            <Text style={[styles.tabText, selectedPeriod === 'ever' && styles.tabTextActive]}>Ever</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Star size={18} color="#FACC15" />
            <Text style={styles.sectionTitle}>{getPeriodTitle()}</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Tap a user to see their stats breakdown
          </Text>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4ADE80" />
              <Text style={styles.loadingText}>Loading leaderboard...</Text>
            </View>
          ) : isError ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Failed to load leaderboard</Text>
              <Text style={styles.errorSubtext}>Please try again later</Text>
            </View>
          ) : (
            <View style={styles.listHeader}>
            <View style={styles.listHeaderRank}>
              <Text style={styles.listHeaderText}>Rank</Text>
            </View>
            <View style={styles.listHeaderUser}>
              <Text style={styles.listHeaderText}>User</Text>
            </View>
            <View style={styles.listHeaderPoints}>
              <Text style={styles.listHeaderText}>Points</Text>
            </View>
            </View>
          )}
          
          {!isLoading && !isError && (
            users.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Trophy size={40} color="#64748B" />
                <Text style={styles.emptyText}>No users found</Text>
              </View>
            ) : (
              <View style={styles.usersList}>
                {users.map((user, index) => renderUserRow(user, index))}
              </View>
            )
          )}
        </View>

        <View style={styles.howItWorksSection}>
          <Text style={styles.howItWorksTitle}>How Rankings Work</Text>
          
          <View style={styles.pointsGrid}>
            <View style={styles.pointsCard}>
              <Upload size={24} color="#4ADE80" />
              <Text style={styles.pointsValue}>+10 points</Text>
              <Text style={styles.pointsLabel}>Clips Uploaded</Text>
              <Text style={styles.pointsDesc}>Share your gaming moments</Text>
            </View>
            
            <View style={styles.pointsCard}>
              <Heart size={24} color="#F87171" />
              <Text style={[styles.pointsValue, { color: '#F87171' }]}>+2 points</Text>
              <Text style={styles.pointsLabel}>Likes Given</Text>
              <Text style={styles.pointsDesc}>Appreciate others content</Text>
            </View>
            
            <View style={styles.pointsCard}>
              <MessageSquare size={24} color="#60A5FA" />
              <Text style={[styles.pointsValue, { color: '#60A5FA' }]}>+5 points</Text>
              <Text style={styles.pointsLabel}>Comments Made</Text>
              <Text style={styles.pointsDesc}>Engage with the community</Text>
            </View>
            
            <View style={styles.pointsCard}>
              <Flame size={24} color="#FB923C" />
              <Text style={[styles.pointsValue, { color: '#FB923C' }]}>+3 points</Text>
              <Text style={styles.pointsLabel}>Fire Reactions</Text>
              <Text style={styles.pointsDesc}>Fire up amazing content</Text>
            </View>
          </View>
        </View>

        <View style={styles.ctaSection}>
          <LinearGradient
            colors={['rgba(74, 222, 128, 0.1)', 'rgba(74, 222, 128, 0.05)']}
            style={styles.ctaGradient}
          >
            <Trophy size={40} color="#FACC15" fill="#FACC15" />
            <Text style={styles.ctaTitle}>Ready to Climb the Rankings?</Text>
            <Text style={styles.ctaSubtitle}>
              Start uploading clips, engaging with content, and building your gaming reputation!
            </Text>
            <View style={styles.ctaButtons}>
              <TouchableOpacity style={styles.ctaPrimaryButton}>
                <Text style={styles.ctaPrimaryText}>Upload</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaSecondaryButton}
                onPress={() => router.push('/(drawer)/(tabs)/trending')}
              >
                <Text style={styles.ctaSecondaryText}>Explore Content</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </ScrollView>

      {renderStatsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },
  trophyContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(250, 204, 21, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(250, 204, 21, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center' as const,
    maxWidth: 320,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#4ADE80',
  },
  tabText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600' as const,
  },
  tabTextActive: {
    color: '#FFF',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.3)',
  },
  listHeaderRank: {
    width: 42,
  },
  listHeaderUser: {
    flex: 1,
    marginLeft: 52,
  },
  listHeaderPoints: {
    minWidth: 50,
    alignItems: 'center',
  },
  listHeaderText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  usersList: {
    gap: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  rankContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: '#64748B',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#334155',
  },
  userInfo: {
    flex: 1,
    minWidth: 80,
  },
  userName: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  userHandle: {
    fontSize: 12,
    color: '#64748B',
  },
  pointsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 12,
    fontWeight: 'bold' as const,
  },
  historicSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.3)',
    marginHorizontal: 20,
  },
  historicTitle: {
    fontSize: 22,
    fontWeight: 'bold' as const,
    color: '#FFF',
    marginBottom: 4,
  },
  historicSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  historicList: {
    gap: 10,
  },
  historicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  historicRankContainer: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  historicAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#334155',
  },
  historicInfo: {
    flex: 1,
    minWidth: 80,
  },
  historicName: {
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  historicPeriod: {
    fontSize: 11,
    color: '#64748B',
  },
  howItWorksSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  howItWorksTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  pointsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  pointsCard: {
    width: '47%',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  pointsValue: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#4ADE80',
    marginTop: 10,
  },
  pointsLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFF',
    marginTop: 4,
  },
  pointsDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center' as const,
  },
  ctaSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaGradient: {
    padding: 24,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
    marginTop: 16,
    textAlign: 'center' as const,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center' as const,
    marginTop: 8,
    maxWidth: 300,
  },
  ctaButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  ctaPrimaryButton: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  ctaPrimaryText: {
    color: '#002E15',
    fontSize: 14,
    fontWeight: 'bold' as const,
  },
  ctaSecondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaSecondaryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalAvatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  modalAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#334155',
  },
  modalRankBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  modalUserName: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
    marginBottom: 4,
  },
  modalUserHandle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  modalPointsBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalPointsText: {
    fontSize: 14,
    fontWeight: 'bold' as const,
  },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  modalStatCard: {
    width: '47%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  modalStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalStatValue: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalViewProfileButton: {
    backgroundColor: '#4ADE80',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalViewProfileText: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#002E15',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#F87171',
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
});
