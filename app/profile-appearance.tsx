import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, Image, ActivityIndicator } from 'react-native';
import ThemedScrollView from '@/components/ThemedScrollView';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User as UserIcon, Palette, Image as ImageIcon, Camera, Save, Check } from 'lucide-react-native';

import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import ConfirmationModal from '@/components/ConfirmationModal';
import ImageEditorModal from '@/components/ImageEditorModal';
import ProfilePictureModal from '@/components/ProfilePictureModal';
import ProfileBorderModal, { AvatarBorder } from '@/components/ProfileBorderModal';
import CustomAlert from '@/components/CustomAlert';
import AppearanceStudioModal from '@/components/AppearanceStudioModal';
import { SELECTABLE_PROFILE_THEMES, type ProfileThemeName } from '@/constants/themes';

type TabType = 'profile';

const QUICK_THEMES = [
  { id: 'basic', name: 'Basic', accentColor: '#4ADE80', backgroundColor: '#0B2232' },
  { id: 'purple_night', name: 'Purple Night', accentColor: '#A855F7', backgroundColor: '#1E1B4B' },
  { id: 'golden_yellow', name: 'Golden Yellow', accentColor: '#FACC15', backgroundColor: '#713F12' },
  { id: 'rose_gold', name: 'Rose Gold', accentColor: '#F472B6', backgroundColor: '#4C1D4D' },
  { id: 'sunset_orange', name: 'Sunset Orange', accentColor: '#FB7185', backgroundColor: '#431407' },
  { id: 'arctic_blue', name: 'Arctic Blue', accentColor: '#38BDF8', backgroundColor: '#0C4A6E' },
  { id: 'midnight_black', name: 'Midnight Black', accentColor: '#FFFFFF', backgroundColor: '#000000' },
  { id: 'white', name: 'White', accentColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  { id: 'baby_pink', name: 'Baby Pink', accentColor: '#F9A8D4', backgroundColor: '#E0218A' },
];



export default function ProfileAppearance() {
  const navigation = useNavigation();
  const { tab } = useLocalSearchParams<{ tab: string }>();
  const { user, updateUser, getAccessToken } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const isSavingRef = useRef(false);



  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [pendingAction, setPendingAction] = useState<any>(null);

  const [editingType, setEditingType] = useState<'avatar' | 'banner'>('avatar');

  // Image Editor State
  const [editorVisible, setEditorVisible] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);
  const [tempImageDimensions, setTempImageDimensions] = useState<{ width: number; height: number } | undefined>(undefined);

  // Store original image for re-editing
  const [originalAvatarUri, setOriginalAvatarUri] = useState<string | null>(null);
  const [originalAvatarDimensions, setOriginalAvatarDimensions] = useState<{ width: number; height: number } | undefined>(undefined);
  const [originalAvatarScale, setOriginalAvatarScale] = useState<number>(1);
  const [originalAvatarPan, setOriginalAvatarPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  

  // Profile Picture View State
  const [viewProfileVisible, setViewProfileVisible] = useState(false);

  // Border Selection State
  const [borderModalVisible, setBorderModalVisible] = useState(false);
  const [selectedBorder, setSelectedBorder] = useState<AvatarBorder | null>(null);

  // Profile Picture Tab State
  const [profilePictureTab, setProfilePictureTab] = useState<'uploaded' | 'nft'>('uploaded');
  
  // Appearance Studio Modal State
  const [appearanceStudioVisible, setAppearanceStudioVisible] = useState(false);

  // Save State
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Custom Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'success' | 'info'>('error');

  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  useEffect(() => {
    if (tab && tab === 'profile') {
      setActiveTab(tab as TabType);
    } else if (tab === 'appearance' || tab === 'banner') {
      setAppearanceStudioVisible(true);
    }
  }, [tab]);

  // Profile Form State
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatarUrl || null);
  const [banner, setBanner] = useState(user?.bannerUrl || null);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('basic');
  const [selectedProfileTheme, setSelectedProfileTheme] = useState<ProfileThemeName | null>(
    (user?.profileTheme as ProfileThemeName) || null
  );

  // Calculate isDirty
  const currentTheme = QUICK_THEMES.find(t => t.id === selectedThemeId);
  const isThemeDirty = currentTheme && user && (
    currentTheme.accentColor !== (user.accentColor || QUICK_THEMES[0].accentColor) || 
    currentTheme.backgroundColor !== (user.backgroundColor || QUICK_THEMES[0].backgroundColor)
  );

  const { data: avatarBordersData } = useQuery({
    queryKey: ['/api/profile-borders'],
    queryFn: async () => {
      const token = await getAccessToken();
      return api.profileBorders.getAll(token ?? undefined);
    },
  });
  const currentUserBorderId = avatarBordersData?.selectedBorderId || null;
  const isBorderDirty = selectedBorder?.id !== currentUserBorderId;

  console.log('[ProfileAppearance] Border state:', {
    selectedBorderId: selectedBorder?.id || null,
    currentUserBorderId,
    isBorderDirty,
  });

  const isProfileThemeDirty = selectedProfileTheme !== ((user?.profileTheme as ProfileThemeName) || null);

  const isDirty = 
    (displayName !== (user?.displayName || '')) ||
    (bio !== (user?.bio || '')) ||
    (avatar !== (user?.avatarUrl || null)) ||
    (banner !== (user?.bannerUrl || null)) ||
    !!isThemeDirty ||
    isBorderDirty ||
    isProfileThemeDirty;

  console.log('[ProfileAppearance] isDirty:', isDirty, 'activeTab:', activeTab);

  // Reset isSaved when changes are made
  useEffect(() => {
    if (isDirty) {
      setIsSaved(false);
    }
  }, [isDirty]);

  // Handle navigation blocking
  useEffect(() => {
    const beforeRemoveListener = navigation.addListener('beforeRemove', (e) => {
      // Allow navigation if:
      // 1. No changes made (!isDirty)
      // 2. Currently saving (isSavingRef.current)
      // 3. Changes were just saved (isSaved) - though isDirty should be false then too, but for safety
      if (!isDirty || isSavingRef.current || isSaved) {
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      // Prompt the user before leaving the screen
      setPendingAction(e.data.action);
      setModalVisible(true);
    });

    return beforeRemoveListener;
  }, [navigation, isDirty, isSaved]);

  const handleConfirmLeave = () => {
    setModalVisible(false);
    if (pendingAction) {
      navigation.dispatch(pendingAction);
    }
  };

  const handleCancelLeave = () => {
    setModalVisible(false);
    setPendingAction(null);
  };
  
  // Update state when user loads (only if not dirty)
  useEffect(() => {
    if (user && !isDirty) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setAvatar(user.avatarUrl || null);
      setBanner(user.bannerUrl || null);
      
      const theme = QUICK_THEMES.find(t => t.accentColor === user.accentColor && t.backgroundColor === user.backgroundColor);
      setSelectedThemeId(theme ? theme.id : 'basic');
      setSelectedProfileTheme((user.profileTheme as ProfileThemeName) || null);
      
      if (avatarBordersData?.selectedBorderId) {
        const border = avatarBordersData.borders.find((b: AvatarBorder) => b.id === avatarBordersData.selectedBorderId);
        setSelectedBorder(border || null);
      } else {
        setSelectedBorder(null);
      }
    }
  }, [user, isDirty, avatarBordersData]);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false, // We use our own editor
        quality: 1,
      });

      if (!result.canceled) {
        setTempImageUri(result.assets[0].uri);
        setTempImageDimensions({ 
          width: result.assets[0].width, 
          height: result.assets[0].height 
        });
        setEditingType('avatar');
        setEditorVisible(true);
      }
    } catch (error) {
      showAlert('Error', 'Failed to pick image', 'error');
      console.error(error);
    }
  };

  const handleEditorSave = (uri: string, data: { scale: number; pan: { x: number; y: number } }) => {
    if (editingType === 'avatar') {
      setAvatar(uri);
      
      // Store original image details for re-editing
      if (tempImageUri) {
        setOriginalAvatarUri(tempImageUri);
        setOriginalAvatarDimensions(tempImageDimensions);
        setOriginalAvatarScale(data.scale);
        setOriginalAvatarPan(data.pan);
      }
    } else {
      setBanner(uri);
    }
    
    setEditorVisible(false);
    setTempImageUri(null);
    setTempImageDimensions(undefined);
  };

  const handleEditorClose = () => {
    setEditorVisible(false);
    setTempImageUri(null);
    setTempImageDimensions(undefined);
  };

  

  const handleSave = async () => {
    console.log('[ProfileAppearance] handleSave called');
    console.log('[ProfileAppearance] user:', user);
    console.log('[ProfileAppearance] user exists:', !!user);
    console.log('[ProfileAppearance] user id:', user?.id);
    console.log('[ProfileAppearance] user username:', user?.username);
    
    if (!user) {
      console.error('[ProfileAppearance] No user found - showing alert');
      showAlert('Error', 'You must be logged in to save changes', 'error');
      return;
    }

    try {
      isSavingRef.current = true;
      setIsSaving(true);

      console.log('[ProfileAppearance] Getting access token...');
      let token = await getAccessToken();
      console.log('[ProfileAppearance] Access token received:', !!token);
      console.log('[ProfileAppearance] Token length:', token?.length);
      
      if (!token) {
        console.error('[ProfileAppearance] No token received, checking authTokens...');
        console.error('[ProfileAppearance] This might be a dev account or token refresh issue');
        showAlert('Error', 'Session expired. Please log out and log in again.', 'error');
        return;
      }
      
      const theme = QUICK_THEMES.find(t => t.id === selectedThemeId);

      console.log('[Profile] Saving profile:', { displayName, bio, avatar, banner, theme });
      
      const updateData = {
        displayName,
        bio,
        avatarUrl: avatar || undefined,
        bannerUrl: banner || undefined,
        accentColor: theme?.accentColor,
        backgroundColor: theme?.backgroundColor,
        profileBorderId: selectedBorder?.id || null,
        profileTheme: selectedProfileTheme || undefined,
      };

      console.log('[Profile] Sending update via REST API:', updateData);
      const response = await api.users.updateProfile(user?.id || 0, updateData, token);
      
      console.log('[Profile] Update successful:', response);
      
      if (response && response.user) {
        updateUser(response.user);
        setIsSaved(true);
      } else {
        setIsSaved(true);
      }
      
    } catch (error: any) {
      console.error('[Profile] Failed to update profile:', error);
      showAlert('Error', error?.message || 'Failed to save changes', 'error');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleSaveProfile = handleSave;

  const renderSaveButton = (onPress: () => void) => {
    if (!isDirty && !isSaving) return null;

    return (
    <View style={styles.footer}>
      <TouchableOpacity 
        style={[styles.saveButton, (isDirty || isSaving) ? styles.saveButtonActive : styles.saveButtonInactive]} 
        onPress={onPress}
        disabled={!isDirty || isSaving}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color="#FFF" style={{ marginRight: 8 }} />
        ) : isSaved ? (
          <Check size={16} color="#FFF" style={{ marginRight: 8 }} />
        ) : (
          <Save size={16} color={isDirty ? "#FFF" : "#94A3B8"} style={{ marginRight: 8 }} />
        )}
        <Text style={[styles.saveButtonText, !isDirty && !isSaving && { color: '#94A3B8' }]}>
          {isSaving ? 'Saving...' : isSaved ? 'Changes Saved' : 'Save Changes'}
        </Text>
      </TouchableOpacity>
    </View>
  );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <AppHeader showBackButton={true} />
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
          <View style={styles.titleContainer}>
            <Text style={styles.pageTitle}>Profile & Appearance</Text>
          </View>

          <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'profile' && styles.activeTab]} 
              onPress={() => setActiveTab('profile')}
            >
              <UserIcon size={18} color={activeTab === 'profile' ? '#FFF' : '#94A3B8'} />
              <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.tab} 
              onPress={() => setAppearanceStudioVisible(true)}
            >
              <Palette size={18} color="#94A3B8" />
              <Text style={styles.tabText}>Appearance</Text>
            </TouchableOpacity>


          </ScrollView>
        </View>

        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
        >
          <ThemedScrollView 
            style={styles.content} 
            contentContainerStyle={styles.scrollContent}
          >
            {activeTab === 'profile' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Profile Information</Text>
                
                <Text style={styles.inputLabel}>Profile Picture</Text>
                <Text style={styles.inputHelper}>Upload a profile picture that represents you. Recommended size: 400x400 pixels or larger.</Text>
                
                <View style={styles.profilePictureTabs}>
                  <TouchableOpacity 
                    style={[styles.profileTab, profilePictureTab === 'uploaded' && styles.profileTabActive]} 
                    onPress={() => setProfilePictureTab('uploaded')}
                  >
                    <Text style={[styles.profileTabText, profilePictureTab === 'uploaded' && styles.profileTabTextActive]}>Uploaded</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.profileTab, profilePictureTab === 'nft' && styles.profileTabActive]} 
                    onPress={() => setProfilePictureTab('nft')}
                  >
                    <Text style={[styles.profileTabText, profilePictureTab === 'nft' && styles.profileTabTextActive]}>NFT</Text>
                  </TouchableOpacity>
                </View>

                {profilePictureTab === 'uploaded' && (
                <View style={styles.avatarSection}>
                  <View style={styles.currentAvatarContainer}>
                    <TouchableOpacity 
                      onPress={() => {
                        if (originalAvatarUri) {
                          setTempImageUri(originalAvatarUri);
                          setTempImageDimensions(originalAvatarDimensions);
                          setEditorVisible(true);
                        } else if (avatar) {
                          setViewProfileVisible(true);
                        }
                      }}
                      disabled={!avatar}
                    >
                      <Image 
                        source={avatar ? { uri: avatar } : require('../assets/images/icon.png')} 
                        style={styles.currentAvatar} 
                      />
                    </TouchableOpacity>
                    <Text style={styles.currentLabel}>Current</Text>
                  </View>
                  
                  <View style={styles.uploadContainer}>
                    <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
                      <Camera size={18} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.uploadButtonText}>Upload Picture</Text>
                    </TouchableOpacity>
                    <View style={styles.uploadRequirements}>
                      <Text style={styles.requirementItem}>• Recommended: 400x400 pixels</Text>
                      <Text style={styles.requirementItem}>• Max size: 5MB</Text>
                      <Text style={styles.requirementItem}>• JPG, PNG, GIF</Text>
                    </View>
                  </View>
                </View>
                )}

                {profilePictureTab === 'nft' && (
                <View style={styles.nftSection}>
                  <Text style={styles.nftSectionTitle}>NFT Profile Pictures</Text>
                  <Text style={styles.nftHelper}>Select an NFT from your wallet to use as your profile picture.</Text>
                  
                  <View style={styles.nftGrid}>
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                      <TouchableOpacity key={item} style={styles.nftItem}>
                        <View style={styles.nftPlaceholder}>
                          <ImageIcon size={24} color="#334155" />
                        </View>
                        <Text style={styles.nftLabel}>NFT #{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  
                  <View style={styles.nftEmptyState}>
                    <Text style={styles.nftEmptyText}>No NFTs connected yet</Text>
                    <Text style={styles.nftEmptySubtext}>Connect your wallet to display your NFT collection</Text>
                  </View>
                </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Display Name</Text>
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Enter display name"
                    placeholderTextColor="#64748B"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Bio</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Tell us about yourself"
                    placeholderTextColor="#64748B"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Profile Page Theme</Text>
                  <Text style={styles.inputHelper}>Choose a design theme for your public profile page.</Text>
                  <View style={styles.profileThemesRow}>
                    {SELECTABLE_PROFILE_THEMES.map((t) => {
                      const isActive = selectedProfileTheme === t.id;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.profileThemeCard, isActive && styles.profileThemeCardActive]}
                          onPress={() => setSelectedProfileTheme(isActive ? null : t.id)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.profileThemeSwatch, { backgroundColor: t.bg }]}>
                            <View style={[styles.profileThemeAccentDot, { backgroundColor: t.preview[1] }]} />
                            <View style={[styles.profileThemeAccentDot, { backgroundColor: t.preview[2], marginLeft: 6 }]} />
                          </View>
                          <Text style={[styles.profileThemeLabel, isActive && styles.profileThemeLabelActive]}>{t.name}</Text>
                          {isActive && (
                            <View style={styles.profileThemeCheck}>
                              <Check size={12} color="#FFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {renderSaveButton(handleSaveProfile)}
              </View>
            )}


          </ThemedScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </View>
      
      <ConfirmationModal
        visible={modalVisible}
        title="Unsaved Changes"
        message="Changes haven't been made. Do you want to continue or return?"
        onCancel={handleCancelLeave}
        onConfirm={handleConfirmLeave}
        cancelText="Return"
        confirmText="Continue"
      />

      <ImageEditorModal
        visible={editorVisible}
        imageUri={tempImageUri}
        onClose={handleEditorClose}
        onSave={handleEditorSave}
        maskType={editingType === 'avatar' ? 'circle' : 'rect'}
        aspectRatio={editingType === 'avatar' ? 1 : 3} // 3:1 for banner
        initialDimensions={tempImageDimensions}
        initialScale={tempImageUri === originalAvatarUri ? originalAvatarScale : 1}
        initialPan={tempImageUri === originalAvatarUri ? originalAvatarPan : { x: 0, y: 0 }}
      />

      <ProfilePictureModal
        visible={viewProfileVisible}
        onClose={() => setViewProfileVisible(false)}
        imageUrl={avatar || ''}
        username={displayName || user?.username || 'User'}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
        type={alertType}
      />

      <ProfileBorderModal
        visible={borderModalVisible}
        onClose={() => setBorderModalVisible(false)}
        onSelect={(border) => {
          console.log('[ProfileAppearance] Border selected:', border?.id || 'none');
          setSelectedBorder(border);
        }}
        currentBorderId={selectedBorder?.id || null}
        previewImageUrl={avatar || undefined}
      />

      <AppearanceStudioModal
        visible={appearanceStudioVisible}
        onClose={() => setAppearanceStudioVisible(false)}
        onSaved={() => {
          setAppearanceStudioVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
  },
  saveButtonActive: {
    backgroundColor: '#22C55E', // Green when active
  },
  saveButtonInactive: {
    backgroundColor: '#1E293B', // Darker/Grey when inactive
    opacity: 0.7,
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  pageTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  tabsContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 20,
  },
  tabsContent: {
    paddingHorizontal: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 8,
  },
  activeTab: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#161F2E',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 24,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  inputLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  inputHelper: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 16,
  },
  avatarSection: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  currentAvatarContainer: {
    alignItems: 'center',
    gap: 8,
  },
  currentAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
    resizeMode: 'cover',
  },
  currentLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  uploadContainer: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 200,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  uploadRequirements: {
    gap: 4,
  },
  requirementItem: {
    color: '#94A3B8',
    fontSize: 12,
  },
  inputGroup: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#0F1520',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
  },
  footer: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  saveButton: {
    backgroundColor: '#475569',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    flexDirection: 'row',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  placeholderText: {
    color: '#64748B',
    fontSize: 16,
    fontStyle: 'italic',
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
    justifyContent: 'space-between',
  },
  themeOption: {
    width: '31%',
    alignItems: 'center',
    marginBottom: 16,
  },
  themeOptionSelected: {
    // Optional highlight logic, maybe border around the preview
  },
  themePreview: {
    width: '100%',
    aspectRatio: 1.6, // rough card shape
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  themeAccent: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  themeName: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  themeNameSelected: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  previewContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
  previewCard: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewBanner: {
    height: 60,
    width: '100%',
    backgroundColor: '#334155',
  },
  previewBannerImage: {
    width: '100%',
    height: '100%',
  },
  previewBannerPlaceholder: {
    width: '100%',
    height: '100%',
  },
  previewContent: {
    paddingHorizontal: 16,
    position: 'relative',
  },
  previewAvatarContainer: {
    marginTop: -20,
    marginBottom: 8,
  },
  previewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  previewAvatarImage: {
    width: '100%',
    height: '100%',
  },
  previewInfo: {
    marginBottom: 12,
  },
  previewLine: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  previewButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  previewButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  borderSection: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 32,
    flexWrap: 'wrap',
  },
  currentBorderContainer: {
    alignItems: 'center',
    gap: 8,
  },
  borderPreviewContainer: {
    padding: 12,
    backgroundColor: '#0F1520',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  borderPreviewCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  borderPreviewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  borderPreviewPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#334155',
  },
  borderOverlayImage: {
    width: 106,
    height: 106,
    position: 'absolute',
    zIndex: 1,
  },
  profilePictureTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  profileTab: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  profileTabActive: {
    borderBottomColor: '#3B82F6',
  },
  profileTabText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  profileTabTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  nftSection: {
    marginBottom: 32,
  },
  nftSectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  nftHelper: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 16,
  },
  nftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  nftItem: {
    width: '30%',
    alignItems: 'center',
  },
  nftPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0F1520',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  nftLabel: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
  },
  nftEmptyState: {
    padding: 20,
    backgroundColor: '#0F1520',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  nftEmptyText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  nftEmptySubtext: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  profileThemesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  profileThemeCard: {
    width: 100,
    alignItems: 'center',
    borderRadius: 10,
    padding: 8,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#0F1520',
    position: 'relative',
  },
  profileThemeCardActive: {
    borderColor: '#f472b6',
    backgroundColor: '#1a0e1a',
  },
  profileThemeSwatch: {
    width: '100%',
    height: 52,
    borderRadius: 7,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileThemeAccentDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  profileThemeLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  profileThemeLabelActive: {
    color: '#f472b6',
    fontWeight: '700',
  },
  profileThemeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f472b6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  });
