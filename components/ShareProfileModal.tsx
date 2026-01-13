import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Image, 
  Share as RNShare,
  ScrollView
} from 'react-native';
import { X as XIcon, Copy, Check, Heart, Flame, Zap, Gamepad2, Monitor } from 'lucide-react-native';
import { FontAwesome5, FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import LevelBadge from './LevelBadge';

interface Platform {
  name: string;
  type: 'xbox' | 'ps' | 'pc';
  color: string;
}

interface Game {
  id: number;
  name: string;
  imageUrl: string;
}

interface ProfileData {
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string;
  bannerUrl?: string;
  borderColor?: string;
  level: number;
  totalXP: number;
  verified: boolean;
  stats: {
    clips: number;
    followers: number;
    following: number;
  };
  engagement: {
    likes: number;
    fires: number;
    streak: number;
  };
  platforms?: Platform[];
  userType?: string;
  badges?: string[];
  games?: Game[];
}

interface ShareProfileModalProps {
  visible: boolean;
  onClose: () => void;
  profile: ProfileData;
}

export default function ShareProfileModal({ visible, onClose, profile }: ShareProfileModalProps) {
  const [copied, setCopied] = useState(false);
  
  const profileUrl = `https://app.gamefolio.com/@${profile.username}`;

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    try {
      await RNShare.share({
        message: `Check out ${profile.displayName}'s Gamefolio profile: ${profileUrl}`,
        url: profileUrl,
        title: `${profile.displayName} on Gamefolio`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const topGames = profile.games?.slice(0, 3) || [];

  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) {
      return url.replace('{width}', '40').replace('{height}', '53');
    }
    return url;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <BlurView intensity={100} style={StyleSheet.absoluteFill} tint="dark">
          <TouchableOpacity 
            style={styles.backdrop} 
            activeOpacity={1} 
            onPress={onClose} 
          />
        </BlurView>
        
        <View style={styles.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <XIcon size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <View style={styles.profileCard}>
              {profile.bannerUrl ? (
                <>
                  <Image 
                    source={{ uri: profile.bannerUrl }} 
                    style={styles.cardBannerImage} 
                  />
                  <LinearGradient
                    colors={['rgba(0,0,0,0.3)', 'rgba(15,21,32,0.95)', '#0F1520']}
                    locations={[0, 0.5, 1]}
                    style={styles.cardGradient}
                  />
                </>
              ) : (
                <LinearGradient
                  colors={['#1E293B', '#0F1520']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardGradient}
                />
              )}
              
              <View style={styles.cardHeader}>
                <View style={styles.avatarSection}>
                  <View style={styles.avatarWrapper}>
                    <Image 
                      source={{ uri: profile.avatarUrl }} 
                      style={styles.avatar} 
                    />
                    <View style={[styles.avatarRing, profile.borderColor ? { borderColor: profile.borderColor } : undefined]} />
                  </View>
                </View>
                
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.displayName}>{profile.displayName}</Text>
                    <Text style={styles.username}>@{profile.username}</Text>
                    {profile.verified && (
                      <View style={styles.verifiedBadge}>
                        <Check size={8} color="#FFF" strokeWidth={4} />
                      </View>
                    )}
                  </View>
                  
                  <Text style={styles.bio} numberOfLines={1}>{profile.bio}</Text>
                  
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{profile.stats.clips}</Text>
                      <Text style={styles.statLabel}>Clips</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{profile.stats.followers}</Text>
                      <Text style={styles.statLabel}>Followers</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{profile.stats.following}</Text>
                      <Text style={styles.statLabel}>Following</Text>
                    </View>
                  </View>
                  
                  {topGames.length > 0 ? (
                    <View style={styles.gamesRow}>
                      {topGames.map((game, index) => (
                        <View key={game.id || index} style={styles.gameItem}>
                          <Image 
                            source={{ uri: getImageUrl(game.imageUrl) }} 
                            style={styles.gameImage} 
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noGamesText}>No games added yet</Text>
                  )}
                </View>
              </View>
              
              <View style={styles.cardDivider} />
              
              <View style={styles.engagementSection}>
                <View style={styles.engagementItem}>
                  <Heart size={16} color="#EF4444" fill="#EF4444" />
                  <Text style={styles.engagementValue}>{profile.engagement.likes}</Text>
                  <Text style={styles.engagementLabel}>Likes</Text>
                </View>
                <View style={styles.engagementItem}>
                  <Flame size={16} color="#F97316" fill="#F97316" />
                  <Text style={styles.engagementValue}>{profile.engagement.fires}</Text>
                  <Text style={styles.engagementLabel}>Fires</Text>
                </View>
                <View style={styles.engagementItem}>
                  <Zap size={16} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.engagementValue}>{profile.engagement.streak}</Text>
                  <Text style={styles.engagementLabel}>Streak</Text>
                </View>
                <View style={styles.levelContainer}>
                  <LevelBadge level={profile.level} currentXP={profile.totalXP} size={44} thickness={3} />
                </View>
              </View>

              {profile.platforms && profile.platforms.length > 0 && (
                <View style={styles.platformsSection}>
                  {profile.platforms.map((platform, index) => (
                    <View key={index} style={[styles.platformTag, { backgroundColor: platform.color }]}>
                      {platform.type === 'xbox' && <Gamepad2 size={12} color="#FFF" />}
                      {platform.type === 'ps' && <Gamepad2 size={12} color="#FFF" />}
                      {platform.type === 'pc' && <Monitor size={12} color="#FFF" />}
                      <Text style={styles.platformText}>{platform.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Profile Link</Text>
              <View style={styles.linkContainer}>
                <View style={styles.linkInput}>
                  <Text style={styles.linkText} numberOfLines={1}>{profileUrl}</Text>
                </View>
                <TouchableOpacity 
                  style={[styles.copyButton, copied && styles.copiedButton]} 
                  onPress={copyToClipboard}
                >
                  {copied ? (
                    <Check size={16} color="#4ADE80" />
                  ) : (
                    <Copy size={16} color="#4ADE80" />
                  )}
                  <Text style={styles.copyButtonText}>
                    {copied ? 'Copied!' : 'Copy Link'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Share on Social Media</Text>
              <View style={styles.socialGrid}>
                <TouchableOpacity style={styles.socialButton} onPress={shareNative}>
                  <FontAwesome6 name="x-twitter" size={20} color="#FFF" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.socialButton} onPress={shareNative}>
                  <FontAwesome5 name="facebook-f" size={20} color="#1877F2" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.socialButton} onPress={shareNative}>
                  <FontAwesome5 name="linkedin-in" size={20} color="#0A66C2" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.socialButton} onPress={shareNative}>
                  <FontAwesome5 name="whatsapp" size={20} color="#25D366" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.socialButton} onPress={shareNative}>
                  <FontAwesome5 name="telegram-plane" size={20} color="#0088CC" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.socialButton} onPress={shareNative}>
                  <FontAwesome5 name="reddit-alien" size={20} color="#FF4500" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.socialButton} onPress={shareNative}>
                  <FontAwesome5 name="discord" size={20} color="#5865F2" />
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.socialButton} onPress={shareNative}>
                  <FontAwesome5 name="envelope" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContainer: {
    width: '92%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: '#0F1520',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 12,
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },

  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  profileCard: {
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 400,
  },
  cardBannerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    width: '100%',
    resizeMode: 'cover',
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
    marginTop: 120,
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1E293B',
  },
  avatarRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: '#4ADE80',
  },
  userInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  displayName: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  username: {
    color: '#94A3B8',
    fontSize: 14,
  },
  verifiedBadge: {
    backgroundColor: '#3B82F6',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bio: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  gamesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gameItem: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  gameImage: {
    width: 32,
    height: 42,
    backgroundColor: '#1E293B',
  },
  noGamesText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginHorizontal: 16,
  },
  engagementSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 14,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  engagementValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  engagementLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  levelContainer: {
    marginLeft: 8,
  },
  platformsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  platformTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    gap: 4,
  },
  platformText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 12,
  },
  linkContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  linkInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
  },
  linkText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4ADE80',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  copiedButton: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  copyButtonText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '500',
  },
  socialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  socialButton: {
    width: 48,
    height: 48,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
});
