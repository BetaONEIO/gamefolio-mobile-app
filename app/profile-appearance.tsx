import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, Image, ActivityIndicator, Switch } from 'react-native';
import ThemedScrollView from '@/components/ThemedScrollView';
import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User as UserIcon, Palette, Image as ImageIcon, Camera, Save, Check, Link } from 'lucide-react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
import { SELECTABLE_PROFILE_THEMES, type ProfileThemeName } from '@/constants/themes';

type TabType = 'profile' | 'platform' | 'appearance';

const USER_TYPE_OPTIONS = [
  { id: 'streamer', label: 'Streamer', description: 'I stream games live', icon: 'video' as const, color: '#A855F7' },
  { id: 'gamer', label: 'Gamer', description: 'I love playing games', icon: 'gamepad-variant' as const, color: '#22C55E' },
  { id: 'professional_gamer', label: 'Pro Gamer', description: 'I compete in esports', icon: 'trophy' as const, color: '#EAB308' },
  { id: 'content_creator', label: 'Creator', description: 'I create gaming content', icon: 'upload' as const, color: '#3B82F6' },
  { id: 'indie_developer', label: 'Indie Dev', description: 'I develop games', icon: 'code-tags' as const, color: '#06B6D4' },
  { id: 'viewer', label: 'Viewer', description: 'I watch gaming content', icon: 'eye' as const, color: '#94A3B8' },
  { id: 'filthy_casual', label: 'Casual', description: 'I play when I can', icon: 'coffee' as const, color: '#F97316' },
  { id: 'doom_scroller', label: 'Doom Scroller', description: 'I watch clips all day', icon: 'format-list-bulleted' as const, color: '#EF4444' },
];

const QUICK_THEMES = [
  { id: 'basic', name: 'Basic', accentColor: '#4ADE80', primaryColor: '#02172C', backgroundColor: '#0B2232' },
  { id: 'purple_night', name: 'Purple Night', accentColor: '#A855F7', primaryColor: '#13103A', backgroundColor: '#1E1B4B' },
  { id: 'golden_yellow', name: 'Golden Yellow', accentColor: '#FACC15', primaryColor: '#4A2800', backgroundColor: '#713F12' },
  { id: 'rose_gold', name: 'Rose Gold', accentColor: '#F472B6', primaryColor: '#32112D', backgroundColor: '#4C1D4D' },
  { id: 'sunset_orange', name: 'Sunset Orange', accentColor: '#FB7185', primaryColor: '#2A0C03', backgroundColor: '#431407' },
  { id: 'arctic_blue', name: 'Arctic Blue', accentColor: '#38BDF8', primaryColor: '#062B45', backgroundColor: '#0C4A6E' },
  { id: 'midnight_black', name: 'Midnight Black', accentColor: '#FFFFFF', primaryColor: '#111111', backgroundColor: '#000000' },
  { id: 'white', name: 'White', accentColor: '#CCCCCC', primaryColor: '#E8E8E8', backgroundColor: '#FFFFFF' },
  { id: 'baby_pink', name: 'Baby Pink', accentColor: '#F9A8D4', primaryColor: '#8A1250', backgroundColor: '#E0218A' },
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
  
  // User Type State
  const [userType, setUserType] = useState<string>(user?.userType || '');
  const [showUserType, setShowUserType] = useState<boolean>(user?.showUserType !== false);

  // Platform Connection State
  const [steamUsername, setSteamUsername] = useState(user?.steamUsername || '');
  const [xboxUsername, setXboxUsername] = useState(user?.xboxUsername || '');
  const [playstationUsername, setPlaystationUsername] = useState(user?.playstationUsername || '');
  const [discordUsername, setDiscordUsername] = useState(user?.discordUsername || '');
  const [epicUsername, setEpicUsername] = useState(user?.epicUsername || '');
  const [nintendoUsername, setNintendoUsername] = useState(user?.nintendoUsername || '');

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
    if (tab === 'profile' || tab === 'platform' || tab === 'appearance') {
      setActiveTab(tab as TabType);
    }
  }, [tab]);

  // Profile Form State
  const [username, setUsername] = useState(user?.username || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatarUrl || null);
  const [banner, setBanner] = useState(user?.bannerUrl || null);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('basic');
  const [selectedProfileTheme, setSelectedProfileTheme] = useState<ProfileThemeName | null>(
    (user?.profileTheme as ProfileThemeName) || null
  );

  // Appearance color state (Appearance tab)
  const [accentColor, setAccentColor] = useState(user?.accentColor || '#4ADE80');
  const [primaryColor, setPrimaryColor] = useState(user?.primaryColor || '#02172C');
  const [backgroundColor, setBackgroundColor] = useState(user?.backgroundColor || '#0B2232');
  const [avatarBorderColor, setAvatarBorderColor] = useState(user?.avatarBorderColor || user?.accentColor || '#4ADE80');

  // Calculate isDirty

  const { data: avatarBordersData } = useQuery({
    queryKey: ['/api/profile-borders'],
    queryFn: async () => {
      const token = await getAccessToken();
      return api.profileBorders.getAll(token ?? undefined);
    },
  });
  const currentUserBorderId = avatarBordersData?.selectedBorderId ?? null;
  const isBorderDirty = (selectedBorder?.id ?? null) !== currentUserBorderId;

  console.log('[ProfileAppearance] Border state:', {
    selectedBorderId: selectedBorder?.id || null,
    currentUserBorderId,
    isBorderDirty,
  });

  const isProfileThemeDirty = selectedProfileTheme !== ((user?.profileTheme as ProfileThemeName) || null);

  const isDirty = 
    (username !== (user?.username || '')) ||
    (displayName !== (user?.displayName || '')) ||
    (bio !== (user?.bio || '')) ||
    (avatar !== (user?.avatarUrl || null)) ||
    (banner !== (user?.bannerUrl || null)) ||
    isBorderDirty ||
    isProfileThemeDirty ||
    (accentColor !== (user?.accentColor || '#4ADE80')) ||
    (primaryColor !== (user?.primaryColor || '#02172C')) ||
    (backgroundColor !== (user?.backgroundColor || '#0B2232')) ||
    (avatarBorderColor !== (user?.avatarBorderColor || user?.accentColor || '#4ADE80')) ||
    (userType !== (user?.userType || '')) ||
    (showUserType !== (user?.showUserType !== false)) ||
    (steamUsername !== (user?.steamUsername || '')) ||
    (xboxUsername !== (user?.xboxUsername || '')) ||
    (playstationUsername !== (user?.playstationUsername || '')) ||
    (discordUsername !== (user?.discordUsername || '')) ||
    (epicUsername !== (user?.epicUsername || '')) ||
    (nintendoUsername !== (user?.nintendoUsername || ''));

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
      setUsername(user.username || '');
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setAvatar(user.avatarUrl || null);
      setBanner(user.bannerUrl || null);
      setUserType(user.userType || '');
      setShowUserType(user.showUserType !== false);
      setSteamUsername(user.steamUsername || '');
      setXboxUsername(user.xboxUsername || '');
      setPlaystationUsername(user.playstationUsername || '');
      setDiscordUsername(user.discordUsername || '');
      setEpicUsername(user.epicUsername || '');
      setNintendoUsername(user.nintendoUsername || '');
      
      const newAccent = user.accentColor || '#4ADE80';
      const newPrimary = user.primaryColor || '#02172C';
      const newBg = user.backgroundColor || '#0B2232';
      const newBorderColor = user.avatarBorderColor || user.accentColor || '#4ADE80';
      setAccentColor(newAccent);
      setPrimaryColor(newPrimary);
      setBackgroundColor(newBg);
      setAvatarBorderColor(newBorderColor);

      const theme = QUICK_THEMES.find(t =>
        t.accentColor === newAccent &&
        t.backgroundColor === newBg &&
        t.primaryColor === newPrimary
      );
      setSelectedThemeId(theme ? theme.id : '');
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
    if (!user) {
      showAlert('Error', 'You must be logged in to save changes', 'error');
      return;
    }

    if (usernameError || !username || username.trim().length === 0) {
      showAlert('Error', usernameError || 'Username is required', 'error');
      return;
    }

    try {
      isSavingRef.current = true;
      setIsSaving(true);

      let token = await getAccessToken();
      
      if (!token) {
        showAlert('Error', 'Session expired. Please log out and log in again.', 'error');
        return;
      }
      
      const updateData = {
        username: username || undefined,
        displayName,
        bio,
        avatarUrl: avatar || undefined,
        bannerUrl: banner || undefined,
        accentColor,
        primaryColor,
        backgroundColor,
        avatarBorderColor,
        profileBorderId: selectedBorder?.id || null,
        profileTheme: selectedProfileTheme || undefined,
        userType: userType || null,
        showUserType,
        steamUsername: steamUsername || null,
        xboxUsername: xboxUsername || null,
        playstationUsername: playstationUsername || null,
        discordUsername: discordUsername || null,
        epicUsername: epicUsername || null,
        nintendoUsername: nintendoUsername || null,
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

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    if (value.length === 0) {
      setUsernameError('Username is required');
    } else if (!/^[a-zA-Z]/.test(value)) {
      setUsernameError('Username must start with a letter');
    } else if (value.length < 3) {
      setUsernameError('Username must be at least 3 characters');
    } else if (value.length > 20) {
      setUsernameError('Username must be 20 characters or fewer');
    } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      setUsernameError('Only letters, numbers, and underscores are allowed');
    } else {
      setUsernameError(null);
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
              style={[styles.tab, activeTab === 'platform' && styles.activeTab]} 
              onPress={() => setActiveTab('platform')}
            >
              <Link size={18} color={activeTab === 'platform' ? '#FFF' : '#94A3B8'} />
              <Text style={[styles.tabText, activeTab === 'platform' && styles.activeTabText]}>Platforms</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'appearance' && styles.activeTab]}
              onPress={() => setActiveTab('appearance')}
            >
              <Palette size={18} color={activeTab === 'appearance' ? '#FFF' : '#94A3B8'} />
              <Text style={[styles.tabText, activeTab === 'appearance' && styles.activeTabText]}>Appearance</Text>
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
                  <Text style={styles.inputLabel}>Username</Text>
                  <TextInput
                    style={[styles.input, usernameError ? styles.inputError : null]}
                    value={username}
                    onChangeText={handleUsernameChange}
                    placeholder="Enter username"
                    placeholderTextColor="#64748B"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {usernameError ? (
                    <Text style={styles.inputErrorText}>{usernameError}</Text>
                  ) : (
                    <Text style={styles.inputHelper}>3–20 characters. Letters, numbers, and underscores only.</Text>
                  )}
                </View>

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
                  <Text style={styles.inputLabel}>Gamer Type</Text>
                  <Text style={styles.inputHelper}>Select what best describes you as a gamer.</Text>
                  <View style={styles.userTypeGrid}>
                    {USER_TYPE_OPTIONS.map((option) => {
                      const isSelected = userType === option.id;
                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[styles.userTypeCard, isSelected && { borderColor: option.color, backgroundColor: `${option.color}18` }]}
                          onPress={() => setUserType(isSelected ? '' : option.id)}
                          activeOpacity={0.8}
                        >
                          <MaterialCommunityIcons name={option.icon} size={22} color={isSelected ? option.color : '#64748B'} />
                          <Text style={[styles.userTypeLabel, isSelected && { color: option.color }]}>{option.label}</Text>
                          <Text style={styles.userTypeDesc}>{option.description}</Text>
                          {isSelected && (
                            <View style={[styles.userTypeCheck, { backgroundColor: option.color }]}>
                              <Check size={10} color="#FFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {userType !== '' && (
                    <View style={styles.showUserTypeRow}>
                      <View style={styles.showUserTypeLeft}>
                        <Text style={styles.showUserTypeLabel}>Show gamer type on profile</Text>
                        <Text style={styles.showUserTypeDesc}>Display your gamer type badge publicly</Text>
                      </View>
                      <Switch
                        value={showUserType}
                        onValueChange={setShowUserType}
                        trackColor={{ false: '#1E293B', true: '#22C55E' }}
                        thumbColor="#FFF"
                      />
                    </View>
                  )}
                </View>

                {renderSaveButton(handleSaveProfile)}
              </View>
            )}

            {activeTab === 'platform' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Platform Connections</Text>
                <Text style={styles.inputHelper}>Connect your gaming accounts to display them on your profile.</Text>

                {[
                  { key: 'steam', label: 'Steam', icon: 'steam', value: steamUsername, setter: setSteamUsername, placeholder: 'Steam username', color: '#1B2838' },
                  { key: 'xbox', label: 'Xbox', icon: 'microsoft-xbox', value: xboxUsername, setter: setXboxUsername, placeholder: 'Xbox gamertag', color: '#107C10' },
                  { key: 'playstation', label: 'PlayStation', icon: 'sony-playstation', value: playstationUsername, setter: setPlaystationUsername, placeholder: 'PSN username', color: '#003087' },
                  { key: 'discord', label: 'Discord', icon: 'discord', value: discordUsername, setter: setDiscordUsername, placeholder: 'Discord username', color: '#5865F2' },
                  { key: 'epic', label: 'Epic Games', icon: 'controller-classic', value: epicUsername, setter: setEpicUsername, placeholder: 'Epic display name', color: '#313131' },
                  { key: 'nintendo', label: 'Nintendo Switch', icon: 'nintendo-switch', value: nintendoUsername, setter: setNintendoUsername, placeholder: 'Nintendo friend code', color: '#E4000F' },
                ].map((platform) => (
                  <View key={platform.key} style={styles.platformRow}>
                    <View style={[styles.platformIcon, { backgroundColor: platform.color + '22' }]}>
                      <MaterialCommunityIcons name={platform.icon as any} size={22} color={platform.color === '#000000' ? '#FFF' : platform.color} />
                    </View>
                    <View style={styles.platformInputWrapper}>
                      <Text style={styles.platformLabel}>{platform.label}</Text>
                      <TextInput
                        style={styles.platformInput}
                        value={platform.value}
                        onChangeText={platform.setter}
                        placeholder={platform.placeholder}
                        placeholderTextColor="#64748B"
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </View>
                ))}

                {renderSaveButton(handleSaveProfile)}
              </View>
            )}

            {activeTab === 'appearance' && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Appearance Settings</Text>
                <Text style={styles.inputHelper}>Customize how your profile looks with colors and themes.</Text>

                <Text style={styles.inputLabel}>Quick Themes</Text>
                <Text style={styles.inputHelper}>Pick a preset theme to set all colors at once.</Text>
                <View style={styles.themesGrid}>
                  {QUICK_THEMES.map((t) => {
                    const isSelected = selectedThemeId === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.themeOption, isSelected && styles.themeOptionSelected]}
                        onPress={() => {
                          setSelectedThemeId(t.id);
                          setAccentColor(t.accentColor);
                          setPrimaryColor(t.primaryColor);
                          setBackgroundColor(t.backgroundColor);
                          setAvatarBorderColor(t.accentColor);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.themePreview, { backgroundColor: t.backgroundColor, borderColor: isSelected ? t.accentColor : '#334155', borderWidth: isSelected ? 2 : 1 }]}>
                          <View style={[styles.themeAccent, { backgroundColor: t.accentColor }]} />
                        </View>
                        <Text style={[styles.themeName, isSelected && styles.themeNameSelected]}>{t.name}</Text>
                        {isSelected && (
                          <View style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: t.accentColor, alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={10} color="#000" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Accent Color</Text>
                  <Text style={styles.inputHelper}>Highlights, buttons, and interactive elements.</Text>
                  <View style={styles.colorRow}>
                    <View style={[styles.colorSwatch, { backgroundColor: accentColor }]} />
                    <TextInput
                      style={[styles.input, styles.colorInput]}
                      value={accentColor}
                      onChangeText={(v) => {
                        setAccentColor(v);
                        setSelectedThemeId('');
                      }}
                      placeholder="#4ADE80"
                      placeholderTextColor="#64748B"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={7}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Primary Color</Text>
                  <Text style={styles.inputHelper}>Background elements and cards on your profile.</Text>
                  <View style={styles.colorRow}>
                    <View style={[styles.colorSwatch, { backgroundColor: primaryColor }]} />
                    <TextInput
                      style={[styles.input, styles.colorInput]}
                      value={primaryColor}
                      onChangeText={(v) => {
                        setPrimaryColor(v);
                        setSelectedThemeId('');
                      }}
                      placeholder="#02172C"
                      placeholderTextColor="#64748B"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={7}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Avatar Border Color</Text>
                  <Text style={styles.inputHelper}>The border around your profile picture.</Text>
                  <View style={styles.colorRow}>
                    <View style={[styles.colorSwatch, { backgroundColor: avatarBorderColor }]} />
                    <TextInput
                      style={[styles.input, styles.colorInput]}
                      value={avatarBorderColor}
                      onChangeText={(v) => {
                        setAvatarBorderColor(v);
                        setSelectedThemeId('');
                      }}
                      placeholder="#4ADE80"
                      placeholderTextColor="#64748B"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={7}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Profile Picture Border</Text>
                  <Text style={styles.inputHelper}>Select a border to customize the frame around your profile picture.</Text>
                  <TouchableOpacity
                    style={styles.borderButton}
                    onPress={() => setBorderModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    {selectedBorder ? (
                      <Image source={{ uri: selectedBorder.imageUrl }} style={styles.borderPreviewImage} />
                    ) : (
                      <View style={styles.borderNone}>
                        <Text style={styles.borderNoneText}>No border selected</Text>
                      </View>
                    )}
                    <View style={styles.borderButtonRight}>
                      <Text style={styles.borderButtonLabel}>{selectedBorder ? selectedBorder.name : 'Choose Border'}</Text>
                      <Text style={styles.borderButtonHint}>Tap to browse unlocked borders</Text>
                    </View>
                  </TouchableOpacity>
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

    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131F2A',
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
    backgroundColor: '#131F2A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputErrorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
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
  borderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131F2A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 12,
    gap: 14,
  },
  borderPreviewImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  borderNone: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  borderNoneText: {
    color: '#64748B',
    fontSize: 9,
    textAlign: 'center',
  },
  borderButtonRight: {
    flex: 1,
  },
  borderButtonLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  borderButtonHint: {
    color: '#64748B',
    fontSize: 12,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    flexShrink: 0,
  },
  colorInput: {
    flex: 1,
    marginBottom: 0,
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
    backgroundColor: '#131F2A',
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
    backgroundColor: '#131F2A',
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
    backgroundColor: '#131F2A',
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
    backgroundColor: '#131F2A',
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
  userTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  userTypeCard: {
    width: '47%',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    backgroundColor: '#131F2A',
    position: 'relative',
    gap: 4,
  },
  userTypeLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  userTypeDesc: {
    color: '#64748B',
    fontSize: 11,
  },
  userTypeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showUserTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#131F2A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 14,
    marginTop: 4,
  },
  showUserTypeLeft: {
    flex: 1,
    marginRight: 12,
  },
  showUserTypeLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  showUserTypeDesc: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  platformIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  platformInputWrapper: {
    flex: 1,
  },
  platformLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  platformInput: {
    backgroundColor: '#131F2A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFF',
    fontSize: 14,
  },
  });
