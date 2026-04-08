import React, { useState, useRef, useEffect } from 'react';
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
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { X as XIcon, Play, Copy, Share2, Send, Check, Trash2 } from 'lucide-react-native';

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

interface UserSuggestion {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

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
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserSuggestion | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  useEffect(() => {
    if (!visible) {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedUser(null);
      setUsername('');
    }
  }, [visible]);

  const handleUsernameChange = (text: string) => {
    setUsername(text);
    setSelectedUser(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const token = await getAccessToken();
        const result = await api.users.search(trimmed, token ?? undefined);
        const users: UserSuggestion[] = Array.isArray(result)
          ? result
          : (result as any).users ?? [];
        setSuggestions(users);
        setShowSuggestions(users.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleSelectUser = (user: UserSuggestion) => {
    setSelectedUser(user);
    setUsername(user.username);
    setSuggestions([]);
    setShowSuggestions(false);
    Haptics.selectionAsync();
  };

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(clipUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareNative = async () => {
    try {
      await RNShare.share({
        message: `Check out this clip: ${clipUrl}`,
        url: clipUrl,
        title: clip.title,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleGamefolioShare = () => {
    console.log(`Sharing to Gamefolio user: ${username}`);
    setUsername('');
    setSelectedUser(null);
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      
      if (contentType === 'screenshot') {
        return api.screenshots.delete(String(clip.id), token);
      } else {
        return api.clips.delete(String(clip.id), token);
      }
    },
    onSuccess: () => {
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
          onPress={() => {
            setShowSuggestions(false);
            onClose();
          }} 
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
            <View style={styles.gamefolioColumn}>
              <View style={styles.gamefolioRow}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.atSymbol}>@</Text>
                  <TextInput
                    style={styles.usernameInput}
                    placeholder="tag a user"
                    placeholderTextColor="#64748B"
                    value={username}
                    onChangeText={handleUsernameChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {searchLoading && (
                    <ActivityIndicator size="small" color="#64748B" style={{ marginRight: 8 }} />
                  )}
                </View>
                <TouchableOpacity 
                  style={[
                    styles.gfShareButton,
                    { backgroundColor: username ? themeAccent : undefined },
                    !username && styles.disabledButton,
                  ]} 
                  onPress={handleGamefolioShare}
                  disabled={!username}
                >
                  <Send size={18} color={username ? accentIconColor : "#64748B"} />
                </TouchableOpacity>
              </View>

              {/* User suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {suggestions.slice(0, 5).map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={styles.suggestionRow}
                      onPress={() => handleSelectUser(user)}
                      activeOpacity={0.7}
                    >
                      {user.avatarUrl ? (
                        <Image source={{ uri: user.avatarUrl }} style={styles.suggestionAvatar} />
                      ) : (
                        <View style={styles.suggestionAvatarPlaceholder}>
                          <Text style={styles.suggestionAvatarInitial}>
                            {(user.displayName || user.username || '?')[0].toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionDisplayName} numberOfLines={1}>
                          {user.displayName || user.username}
                        </Text>
                        <Text style={styles.suggestionUsername} numberOfLines={1}>
                          @{user.username}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
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
    shadowOffset: { width: 0, height: 2 },
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
    transform: [{ rotate: '-45deg' }],
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
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 10,
    gap: 8,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  gamefolioColumn: {
    flexDirection: 'column',
    gap: 0,
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
  suggestionsContainer: {
    marginTop: 4,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0F1F2E',
  },
  suggestionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
  },
  suggestionAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionAvatarInitial: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionDisplayName: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionUsername: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 1,
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
