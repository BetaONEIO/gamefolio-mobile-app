import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import ThemedScrollView from '@/components/ThemedScrollView';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Gamepad2, Check, User, Ticket } from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useMutation } from '@tanstack/react-query';
import UserTypeBadge, { USER_TYPES } from '@/components/UserTypeBadge';
import RedeemCodeModal from '@/components/RedeemCodeModal';

type TabType = 'platforms' | 'security' | 'profile';

export default function AccountSettings() {
  const { tab } = useLocalSearchParams<{ tab: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const { user, updateUser, getAccessToken } = useAuth();
  const [showUserType, setShowUserType] = useState(user?.showUserType !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.users.updateProfile(user?.id ?? 0, data, token);
    },
  });

  useEffect(() => {
    if (tab && ['platforms', 'security', 'profile'].includes(tab)) {
      setActiveTab(tab as TabType);
    }
  }, [tab]);

  useEffect(() => {
    setShowUserType(user?.showUserType !== false);
  }, [user?.showUserType]);

  // Security/Privacy State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isTwoFactorEnabled, setIsTwoFactorEnabled] = useState(false);

  // Platform State (from previous implementation)
  const [steamId, setSteamId] = useState('');
  const [xboxGamertag, setXboxGamertag] = useState('');
  const [psnId, setPsnId] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [epicId, setEpicId] = useState('');
  const [nintendoId, setNintendoId] = useState('');
  const [xId, setXId] = useState('');
  const [youtubeId, setYoutubeId] = useState('');

  // Validation checks for Password
  const hasMinLength = newPassword.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecialChar = /[!@#$%^&*]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && newPassword !== '';

  const renderRequirement = (met: boolean, text: string) => (
    <View style={styles.requirementRow}>
      <Check size={16} color={met ? "#4ADE80" : "#64748B"} />
      <Text style={[styles.requirementText, met && styles.requirementTextMet]}>{text}</Text>
    </View>
  );

  const handleUpdatePassword = () => {
    console.log('Update password');
  };

  const handleDeleteAccount = () => {
    console.log('Delete account');
  };

  const handleToggleShowUserType = async () => {
    const newValue = !showUserType;
    setShowUserType(newValue);
    setIsSaving(true);
    try {
      await updateProfileMutation.mutateAsync({ showUserType: newValue } as Record<string, unknown>);
      if (updateUser) {
        await updateUser({ showUserType: newValue });
      }
      console.log('[AccountSettings] Updated showUserType to:', newValue);
    } catch (error) {
      console.error('[AccountSettings] Failed to update showUserType:', error);
      setShowUserType(!newValue);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSavePlatforms = () => {
    console.log('Saving platforms');
    // Save logic here
  };

  const renderPlatformInput = (platform: any) => (
    <View key={platform.id} style={styles.platformItem}>
      <View style={styles.platformHeader}>
        {platform.iconLibrary === 'FontAwesome6' ? (
          <FontAwesome6 name={platform.icon} size={24} color={platform.iconColor} style={styles.platformIcon} />
        ) : (
          <MaterialCommunityIcons name={platform.icon} size={24} color={platform.iconColor} style={styles.platformIcon} />
        )}
        <Text style={styles.platformName}>{platform.name}</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder={platform.placeholder}
        placeholderTextColor="#64748B"
        value={platform.value}
        onChangeText={platform.onChange}
      />
      <Text style={styles.helperText}>{platform.helperText}</Text>
    </View>
  );

  const platformsList = [
    { id: 'steam', name: 'Steam', icon: 'steam', iconColor: '#66c0f4', placeholder: 'Enter your Steam username', helperText: 'Your Steam profile username', value: steamId, onChange: setSteamId },
    { id: 'xbox', name: 'Xbox', icon: 'microsoft-xbox', iconColor: '#107C10', placeholder: 'Enter your Xbox gamertag', helperText: 'Your Xbox Live gamertag', value: xboxGamertag, onChange: setXboxGamertag },
    { id: 'playstation', name: 'PlayStation', icon: 'sony-playstation', iconColor: '#00439C', placeholder: 'Enter your PlayStation ID', helperText: 'Your PlayStation Network ID', value: psnId, onChange: setPsnId },
    { id: 'discord', name: 'Discord', icon: 'discord', iconColor: '#5865F2', placeholder: 'Enter your Discord username', helperText: 'Your Discord username', value: discordId, onChange: setDiscordId },
    { id: 'epic', name: 'Epic Games', icon: 'alpha-e-box', iconColor: '#343434', placeholder: 'Enter your Epic Games username', helperText: 'Your Epic Games Store username', value: epicId, onChange: setEpicId },
    { id: 'nintendo', name: 'Nintendo', icon: 'nintendo-switch', iconColor: '#E60012', placeholder: 'Enter your Nintendo username', helperText: 'Your Nintendo Switch username', value: nintendoId, onChange: setNintendoId },
  ];

  const socialMediaList = [
    { id: 'x', name: 'X', icon: 'x-twitter', iconColor: '#000000', placeholder: 'Enter your X username', helperText: 'Your X username', value: xId, onChange: setXId, iconLibrary: 'FontAwesome6' },
    { id: 'youtube', name: 'YouTube', icon: 'youtube', iconColor: '#FF0000', placeholder: 'Enter your YouTube username', helperText: 'Your YouTube channel username', value: youtubeId, onChange: setYoutubeId },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <AppHeader showBackButton={true} />
        <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
          <View style={styles.titleContainer}>
            <Text style={styles.pageTitle}>Account Settings</Text>
          </View>

          <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'profile' && styles.activeTab]} 
              onPress={() => setActiveTab('profile')}
            >
              <User size={18} color={activeTab === 'profile' ? '#FFF' : '#94A3B8'} />
              <Text style={[styles.tabText, activeTab === 'profile' && styles.activeTabText]}>Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tab, activeTab === 'platforms' && styles.activeTab]} 
              onPress={() => setActiveTab('platforms')}
            >
              <Gamepad2 size={18} color={activeTab === 'platforms' ? '#FFF' : '#94A3B8'} />
              <Text style={[styles.tabText, activeTab === 'platforms' && styles.activeTabText]}>Platforms</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.tab, activeTab === 'security' && styles.activeTab]} 
              onPress={() => setActiveTab('security')}
            >
              <Shield size={18} color={activeTab === 'security' ? '#FFF' : '#94A3B8'} />
              <Text style={[styles.tabText, activeTab === 'security' && styles.activeTabText]}>Security</Text>
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
            {activeTab === 'security' && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Security Settings</Text>
                  <Text style={styles.cardSubtitle}>Update your password and manage account security.</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Current Password</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    placeholder="........"
                    placeholderTextColor="#64748B"
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    placeholder="Create a new password"
                    placeholderTextColor="#64748B"
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <View style={styles.requirementsContainer}>
                    {renderRequirement(hasMinLength, "At least 8 characters")}
                    {renderRequirement(hasUppercase, "One uppercase letter")}
                    {renderRequirement(hasNumber, "One number")}
                    {renderRequirement(hasSpecialChar, "One special character (!@#$%^&*)")}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Confirm Password</Text>
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    placeholder="Confirm your password"
                    placeholderTextColor="#64748B"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <View style={styles.requirementsContainer}>
                     {renderRequirement(passwordsMatch, "Passwords match")}
                  </View>
                </View>

                <View style={styles.twoFactorContainer}>
                    <View style={styles.twoFactorTextContainer}>
                        <Text style={styles.twoFactorTitle}>Two-Factor Authentication</Text>
                        <Text style={styles.twoFactorSubtitle}>Add an extra layer of security to your account.</Text>
                    </View>
                    <TouchableOpacity 
                        style={[styles.toggleSwitch, isTwoFactorEnabled && styles.toggleSwitchActive]}
                        onPress={() => setIsTwoFactorEnabled(!isTwoFactorEnabled)}
                    >
                        <View style={[styles.toggleThumb, isTwoFactorEnabled && styles.toggleThumbActive]} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.changePasswordButton} onPress={handleUpdatePassword}>
                  <Text style={styles.changePasswordButtonText}>Change Password</Text>
                </TouchableOpacity>

                <View style={styles.divider} />

                <Text style={styles.dangerTitle}>Delete Account</Text>
                <Text style={styles.dangerSubtitle}>Permanently delete your account and all associated data. This action cannot be undone.</Text>

                <View style={styles.warningBox}>
                  <View style={styles.warningHeader}>
                    <MaterialCommunityIcons name="alert-outline" size={20} color="#EF4444" />
                    <Text style={styles.warningTitle}>Warning</Text>
                  </View>
                  <Text style={styles.warningText}>Account deletion will permanently remove:</Text>
                  <View style={styles.bulletList}>
                    <Text style={styles.bulletItem}>• Your profile and all personal information</Text>
                    <Text style={styles.bulletItem}>• All uploaded clips, screenshots, and media</Text>
                    <Text style={styles.bulletItem}>• Messages, follows, and social connections</Text>
                    <Text style={styles.bulletItem}>• Achievement badges and leaderboard entries</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FFF" style={{marginRight: 8}} />
                  <Text style={styles.deleteButtonText}>Delete Account</Text>
                </TouchableOpacity>
              </View>
            )}

            {activeTab === 'profile' && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Profile Display</Text>
                  <Text style={styles.cardSubtitle}>Control what information is visible on your profile.</Text>
                </View>

                <View style={styles.userTypeSection}>
                  <Text style={styles.sectionHeader}>User Type Badge</Text>
                  
                  {user?.userType && USER_TYPES[user.userType] && (
                    <View style={styles.currentBadgePreview}>
                      <Text style={styles.previewLabel}>Current Badge:</Text>
                      <UserTypeBadge 
                        userType={user.userType} 
                        showUserType={true}
                        size="medium"
                      />
                    </View>
                  )}

                  {!user?.userType && (
                    <View style={styles.noBadgeContainer}>
                      <Text style={styles.noBadgeText}>No user type set. Complete onboarding to set your user type.</Text>
                    </View>
                  )}

                  <View style={styles.toggleContainer}>
                    <View style={styles.toggleTextContainer}>
                      <Text style={styles.toggleTitle}>Show User Type Badge</Text>
                      <Text style={styles.toggleSubtitle}>
                        Display your user type badge next to your name on your profile.
                      </Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.toggleSwitch, showUserType && styles.toggleSwitchActive]}
                      onPress={handleToggleShowUserType}
                      disabled={isSaving || !user?.userType}
                    >
                      <View style={[styles.toggleThumb, showUserType && styles.toggleThumbActive]} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.redeemSection}>
                  <Text style={styles.sectionHeader}>Redeem Code</Text>
                  <Text style={styles.redeemDescription}>
                    Have a promotional code? Redeem it here to unlock exclusive rewards, badges, and items.
                  </Text>
                  <TouchableOpacity 
                    style={styles.redeemButton}
                    onPress={() => setShowRedeemModal(true)}
                  >
                    <Ticket size={18} color="#FFF" />
                    <Text style={styles.redeemButtonText}>Redeem a Code</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'platforms' && (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Platform Connections</Text>
                  <Text style={styles.cardSubtitle}>Connect your gaming accounts and social media profiles.</Text>
                </View>

                <Text style={styles.sectionHeader}>Gaming Platforms</Text>
                <View style={styles.platformsGrid}>
                  {platformsList.map(renderPlatformInput)}
                </View>

                <Text style={[styles.sectionHeader, { marginTop: 24 }]}>Social Media</Text>
                <View style={styles.platformsGrid}>
                  {socialMediaList.map(renderPlatformInput)}
                </View>

                <TouchableOpacity style={styles.saveButton} onPress={handleSavePlatforms}>
                  <Text style={styles.saveButtonText}>Save Platform Connections</Text>
                </TouchableOpacity>
              </View>
            )}
          </ThemedScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </View>
      <RedeemCodeModal 
        visible={showRedeemModal} 
        onClose={() => setShowRedeemModal(false)} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
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
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
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
  saveButton: {
    backgroundColor: '#475569',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  cardHeader: { marginBottom: 24 },
  cardTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  cardSubtitle: { color: '#94A3B8', fontSize: 14 },
  sectionHeader: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 16 },
  platformsGrid: { gap: 16 },
  platformItem: { marginBottom: 8 },
  platformHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  platformIcon: { width: 24, textAlign: 'center' },
  platformName: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  helperText: { color: '#64748B', fontSize: 12, marginTop: 6 },
  
  // Profile styles
  userTypeSection: { marginBottom: 24 },
  currentBadgePreview: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    marginBottom: 20,
    backgroundColor: '#0F1520',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewLabel: { color: '#94A3B8', fontSize: 14 },
  noBadgeContainer: {
    backgroundColor: '#0F1520',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  noBadgeText: { color: '#64748B', fontSize: 14 },
  toggleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 8,
    backgroundColor: '#0F1520',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleTextContainer: { flex: 1, paddingRight: 16 },
  toggleTitle: { color: '#FFF', fontSize: 16, fontWeight: '600' as const, marginBottom: 4 },
  toggleSubtitle: { color: '#94A3B8', fontSize: 12 },

  // Security styles
  requirementsContainer: { marginTop: 8, gap: 4 },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requirementText: { color: '#64748B', fontSize: 12 },
  requirementTextMet: { color: '#94A3B8' },
  twoFactorContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingVertical: 8 },
  twoFactorTextContainer: { flex: 1, paddingRight: 16 },
  twoFactorTitle: { color: '#FFF', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  twoFactorSubtitle: { color: '#94A3B8', fontSize: 12 },
  toggleSwitch: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#334155', padding: 2 },
  toggleSwitchActive: { backgroundColor: '#398457' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  toggleThumbActive: { alignSelf: 'flex-end' },
  changePasswordButton: { backgroundColor: '#398457', paddingVertical: 12, borderRadius: 6, alignItems: 'center', marginTop: 12 },
  changePasswordButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#1E293B', marginVertical: 32 },
  dangerTitle: { color: '#EF4444', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  dangerSubtitle: { color: '#94A3B8', fontSize: 14, marginBottom: 20 },
  warningBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: 16, marginBottom: 24 },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  warningTitle: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  warningText: { color: '#EF4444', fontSize: 14, marginBottom: 8 },
  bulletList: { paddingLeft: 4, gap: 4 },
  bulletItem: { color: '#EF4444', fontSize: 14 },
  deleteButton: { backgroundColor: '#EF4444', flexDirection: 'row', paddingVertical: 12, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  deleteButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  redeemSection: { marginTop: 8 },
  redeemDescription: { color: '#94A3B8', fontSize: 14, marginBottom: 16 },
  redeemButton: { 
    backgroundColor: '#3B82F6', 
    flexDirection: 'row', 
    paddingVertical: 12, 
    paddingHorizontal: 20,
    borderRadius: 6, 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8,
  },
  redeemButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
});
