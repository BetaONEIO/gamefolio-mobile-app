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
import { X as XIcon, Copy, Check, Heart, Flame, Zap, Gamepad2, Monitor, QrCode } from 'lucide-react-native';
import { FontAwesome5 } from '@expo/vector-icons';
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
    uploads: number;
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
  const [showQRCode, setShowQRCode] = useState(false);
  
  const profileUrl = `https://app.gamefolio.com/@${profile.username}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(profileUrl)}&bgcolor=0F1520&color=FFFFFF`;

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
              <View style={styles.bannerSection}>
                {profile.bannerUrl ? (
                  <Image 
                    source={{ uri: profile.bannerUrl }} 
                    style={styles.cardBannerImage} 
                  />
                ) : (
                  <LinearGradient
                    colors={['#1E293B', '#334155']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.cardBannerFallback}
                  />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(30,41,59,0.8)', '#1E293B']}
                  locations={[0, 0.6, 1]}
                  style={styles.bannerOverlay}
                />
              </View>
              
              <View style={styles.avatarContainer}>
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
                  <Text style={styles.displayName} numberOfLines={1}>{profile.displayName}</Text>
                  {profile.verified && (
                    <View style={styles.verifiedBadge}>
                      <Check size={8} color="#FFF" strokeWidth={4} />
                    </View>
                  )}
                </View>
                <Text style={styles.username}>@{profile.username}</Text>
                
                <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
                
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{profile.stats.uploads}</Text>
                    <Text style={styles.statLabel}>Uploads</Text>
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
                
                {topGames.length > 0 && (
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
                )}
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
              <Text style={styles.sectionTitle}>Share Profile</Text>
              <TouchableOpacity 
                style={styles.shareInAppButton}
                onPress={shareNative}
              >
                <FontAwesome5 name="share" size={16} color="#FFF" />
                <Text style={styles.shareInAppText}>Share Gamefolio Link</Text>
              </TouchableOpacity>
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
              <Text style={styles.sectionTitle}>QR Code</Text>
              <TouchableOpacity 
                style={styles.qrCodeToggle}
                onPress={() => setShowQRCode(!showQRCode)}
              >
                <View style={styles.qrCodeToggleContent}>
                  <QrCode size={20} color="#4ADE80" />
                  <Text style={styles.qrCodeToggleText}>
                    {showQRCode ? 'Hide QR Code' : 'Show QR Code'}
                  </Text>
                </View>
              </TouchableOpacity>
              
              {showQRCode && (
                <View style={styles.qrCodeContainer}>
                  <View style={styles.qrCodeWrapper}>
                    <Image 
                      source={{ uri: qrCodeUrl }} 
                      style={styles.qrCodeImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.qrCodeHint}>Scan to view profile</Text>
                </View>
              )}
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
  },
  bannerSection: {
    height: 100,
    width: '100%',
    position: 'relative',
  },
  cardBannerImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  cardBannerFallback: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  avatarContainer: {
    alignItems: 'center',
    marginTop: -45,
    zIndex: 10,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1E293B',
    borderWidth: 3,
    borderColor: '#1E293B',
  },
  avatarRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#4ADE80',
  },
  userInfo: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 2,
  },
  displayName: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    maxWidth: '80%',
  },
  username: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  verifiedBadge: {
    backgroundColor: '#3B82F6',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bio: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  gamesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  gameItem: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  gameImage: {
    width: 36,
    height: 48,
    backgroundColor: '#1E293B',
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
  shareInAppButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4ADE80',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  shareInAppText: {
    color: '#0F1520',
    fontSize: 15,
    fontWeight: '600',
  },
  qrCodeToggle: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  qrCodeToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  qrCodeToggleText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '600',
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  qrCodeWrapper: {
    backgroundColor: '#0F1520',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  qrCodeImage: {
    width: 200,
    height: 200,
  },
  qrCodeHint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 12,
  },
});
