import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  Image, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  Share as RNShare,
  Alert,
  ActivityIndicator
} from 'react-native';
import { X as XIcon, Play, Copy, Share2, Send, Check, Trash2 } from 'lucide-react-native';

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

interface ShareClipModalProps {
  visible: boolean;
  onClose: () => void;
  isOwnClip?: boolean;
  contentType?: 'clip' | 'reel' | 'screenshot';
  clip: {
    title: string;
    thumbnail?: string;
    thumbnailUrl?: string;
    videoPlaceholder?: string;
    imageUrl?: string;
    id: string | number;
    user?: {
      handle?: string;
      username?: string;
    };
  };
  onDeleted?: () => void;
}

export default function ShareClipModal({ visible, onClose, isOwnClip = false, contentType = 'clip', clip, onDeleted }: ShareClipModalProps) {
  const [username, setUsername] = useState('');
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  
  const handle = (clip.user?.handle || clip.user?.username || 'user').replace('@', '');
  const clipUrl = `https://app.gamefolio.com/@${handle}/clip/${clip.id}`;

  const { data: ownerProfile } = useQuery({
    queryKey: ['/api/users', handle, 'profile'],
    queryFn: async () => {
      if (!handle || handle === 'user') return null;
      const token = await getAccessToken();
      return api.users.getProfile(handle, token ?? undefined);
    },
    enabled: !!handle && handle !== 'user' && visible,
    staleTime: 5 * 60 * 1000,
  });

  const ownerUser = ownerProfile?.user;
  const themeAccent = ownerUser?.accentColor || '#4ADE80';
  const themeBg = ownerUser?.backgroundColor || '#0B2232';
  const accentIsLight = ['#FFF', '#FFFFFF', '#FACC15', '#FDE68A', '#fffaec', '#f0f0f2', '#fce7f3'].some(
    (c) => themeAccent.toLowerCase().startsWith(c.toLowerCase().slice(0, 4))
  );
  const accentIconColor = accentIsLight ? '#000' : '#FFF';

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(clipUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    try {
      await RNShare.share({
        message: `Check out this clip: ${clipUrl}`,
        url: clipUrl, // iOS
        title: clip.title, // Android
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleGamefolioShare = () => {
    console.log(`Sharing to Gamefolio user: ${username}`);
    setUsername('');
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      
      console.log(`[Delete] Deleting ${contentType}:`, clip.id);
      
      if (contentType === 'screenshot') {
        return api.screenshots.delete(String(clip.id), token);
      } else {
        return api.clips.delete(String(clip.id), token);
      }
    },
    onSuccess: () => {
      console.log(`[Delete] ${contentType} deleted successfully`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      queryClient.invalidateQueries({ queryKey: ['clips'] });
      queryClient.invalidateQueries({ queryKey: ['reels'] });
      queryClient.invalidateQueries({ queryKey: ['screenshots'] });
      queryClient.invalidateQueries({ queryKey: ['clip', String(clip.id)] });
      
      setShowDeleteConfirm(false);
      onClose();
      onDeleted?.();
      
      router.back();
    },
    onError: (error: any) => {
      console.error(`[Delete] Error:`, error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Delete Failed',
        error.message || `Failed to delete ${contentType}. Please try again.`
      );
    },
  });

  const handleDeletePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteMutation.mutate();
  };

  const handleCancelDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowDeleteConfirm(false);
  };

  // Determine image source - prioritize thumbnail from clip
  const imageSource = clip.thumbnail 
    ? { uri: clip.thumbnail }
    : clip.thumbnailUrl
      ? { uri: clip.thumbnailUrl }
      : clip.imageUrl
        ? { uri: clip.imageUrl }
        : clip.videoPlaceholder 
          ? { uri: clip.videoPlaceholder }
          : { uri: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2670&auto=format&fit=crop' };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={onClose} 
        />
        
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <Share2 size={20} color="#FFF" style={styles.titleIcon} />
              <Text style={styles.title}>
                {contentType === 'reel' 
                  ? 'Share this reel' 
                  : isOwnClip ? 'Share your clip' : 'Share clip'
                }
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <XIcon size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Clip Preview */}
          <View style={styles.previewContainer}>
            <Image source={imageSource} style={styles.previewImage} />
            <LinearGradient
              colors={[`${themeBg}00`, `${themeBg}99`]}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.playButtonContainer}>
              <View style={[styles.playButton, { backgroundColor: themeAccent }]}>
                <Play size={24} color={accentIconColor} fill={accentIconColor} style={{ marginLeft: 4 }} />
              </View>
            </View>
          </View>

          {/* Share on Gamefolio Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Share on Gamefolio</Text>
            <View style={styles.gamefolioRow}>
              <View style={styles.inputWrapper}>
                <Text style={styles.atSymbol}>@</Text>
                <TextInput
                  style={styles.usernameInput}
                  placeholder="username tag"
                  placeholderTextColor="#64748B"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>
              <TouchableOpacity 
                style={[styles.gfShareButton, { backgroundColor: username ? themeAccent : undefined }, !username && styles.disabledButton]} 
                onPress={handleGamefolioShare}
                disabled={!username}
              >
                <Send size={18} color={username ? accentIconColor : "#64748B"} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Share Link Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Share Link</Text>
            <View style={styles.linkRow}>
              <TextInput
                style={styles.linkInput}
                value={clipUrl}
                editable={false}
                selectTextOnFocus={false}
              />
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.copyButton} onPress={copyToClipboard}>
                  {copied ? (
                    <Check size={18} color="#4ADE80" />
                  ) : (
                    <Copy size={18} color="#94A3B8" />
                  )}
                  <Text style={[styles.buttonText, copied && { color: '#4ADE80' }]}>
                    {copied ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareButton} onPress={shareNative}>
                  <Share2 size={18} color="#FFF" />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Delete Section - Only for own content */}
          {isOwnClip && (
            <View style={styles.deleteSection}>
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={handleDeletePress}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text style={styles.deleteButtonText}>
                  Delete {contentType === 'screenshot' ? 'Screenshot' : contentType === 'reel' ? 'Reel' : 'Clip'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Delete Confirmation Modal */}
        <Modal
          visible={showDeleteConfirm}
          transparent
          animationType="fade"
          onRequestClose={handleCancelDelete}
        >
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmContainer}>
              <View style={styles.confirmIconContainer}>
                <Trash2 size={32} color="#EF4444" />
              </View>
              <Text style={styles.confirmTitle}>Delete {contentType === 'screenshot' ? 'Screenshot' : contentType === 'reel' ? 'Reel' : 'Clip'}?</Text>
              <Text style={styles.confirmText}>
                This action cannot be undone. This will permanently delete your {contentType === 'screenshot' ? 'screenshot' : contentType === 'reel' ? 'reel' : 'clip'} and all associated comments and likes.
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity 
                  style={styles.cancelButton} 
                  onPress={handleCancelDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.confirmDeleteButton} 
                  onPress={handleConfirmDelete}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 500,
    backgroundColor: '#131F2A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleIcon: {
    transform: [{ rotate: '-45deg' }], // Slight rotation for effect if needed
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  previewContainer: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
    position: 'relative',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    opacity: 0.8,
  },
  playButtonContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  linkRow: {
    flexDirection: 'column',
    gap: 12,
  },
  linkInput: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    color: '#94A3B8',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  copyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  buttonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6', // Blue as in screenshot
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  gamefolioRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
  },
  atSymbol: {
    color: '#64748B',
    fontSize: 14,
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    paddingVertical: 12,
  },
  gfShareButton: {
    width: 48,
    backgroundColor: '#4ADE80',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: '#334155',
  },

  deleteSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  deleteButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 24,
  },
  confirmContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center' as const,
  },
  confirmIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  confirmTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 8,
  },
  confirmText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row' as const,
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center' as const,
  },
  cancelButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center' as const,
  },
  confirmDeleteText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
