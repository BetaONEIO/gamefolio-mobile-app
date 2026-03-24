import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, Modal, Image, ActivityIndicator } from 'react-native';
import ThemedScrollView from '@/components/ThemedScrollView';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Check, User, Ticket, Lock, Globe, X, QrCode, KeyRound, CheckCircle2 } from 'lucide-react-native';
import AppHeader from '@/components/AppHeader';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useMutation, useQuery } from '@tanstack/react-query';
import UserTypeBadge, { USER_TYPES } from '@/components/UserTypeBadge';
import RedeemCodeModal from '@/components/RedeemCodeModal';

type TabType = 'security' | 'profile';

export default function AccountSettings() {
  const { tab } = useLocalSearchParams<{ tab: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const { user, updateUser, getAccessToken } = useAuth();
  const [showUserType, setShowUserType] = useState(user?.showUserType !== false);
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate ?? false);
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
    if (tab && ['security', 'profile'].includes(tab)) {
      setActiveTab(tab as TabType);
    }
  }, [tab]);

  useEffect(() => {
    setShowUserType(user?.showUserType !== false);
  }, [user?.showUserType]);

  useEffect(() => {
    setIsPrivate(user?.isPrivate ?? false);
  }, [user?.isPrivate]);

  // Security/Privacy State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 2FA State
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [twoFAStep, setTwoFAStep] = useState<'setup' | 'verify' | 'disable' | 'success'>('setup');
  const [twoFAQrCode, setTwoFAQrCode] = useState('');
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFAPassword, setTwoFAPassword] = useState('');
  const [twoFAError, setTwoFAError] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);

  const { data: twoFAStatus, refetch: refetch2FA } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { enabled: false };
      try {
        return await api.twoFactor.getStatus(token);
      } catch {
        return { enabled: false };
      }
    },
    staleTime: 30 * 1000,
  });

  const isTwoFactorEnabled = twoFAStatus?.enabled ?? false;

  const handle2FAToggle = async () => {
    setTwoFAError('');
    setTwoFACode('');
    setTwoFAPassword('');
    if (!isTwoFactorEnabled) {
      setTwoFALoading(true);
      setShow2FAModal(true);
      setTwoFAStep('setup');
      try {
        const token = await getAccessToken();
        if (!token) throw new Error('Not authenticated');
        const data = await api.twoFactor.setup(token);
        setTwoFAQrCode(data.qrCode);
        setTwoFASecret(data.secret);
        setTwoFAStep('verify');
      } catch (e: any) {
        setTwoFAError(e?.message || 'Failed to start 2FA setup');
      } finally {
        setTwoFALoading(false);
      }
    } else {
      setShow2FAModal(true);
      setTwoFAStep('disable');
    }
  };

  const handle2FAEnable = async () => {
    if (twoFACode.length < 6) { setTwoFAError('Enter the 6-digit code'); return; }
    setTwoFALoading(true);
    setTwoFAError('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      await api.twoFactor.enable(twoFACode, token);
      await refetch2FA();
      setTwoFAStep('success');
    } catch (e: any) {
      setTwoFAError(e?.message || 'Invalid code. Please try again.');
    } finally {
      setTwoFALoading(false);
    }
  };

  const handle2FADisable = async () => {
    if (!twoFAPassword) { setTwoFAError('Enter your password'); return; }
    if (!twoFACode) { setTwoFAError('Enter the 6-digit authenticator code'); return; }
    setTwoFALoading(true);
    setTwoFAError('');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      await api.twoFactor.disable(twoFAPassword, twoFACode, token);
      await refetch2FA();
      setShow2FAModal(false);
    } catch (e: any) {
      setTwoFAError(e?.message || 'Failed to disable 2FA');
    } finally {
      setTwoFALoading(false);
    }
  };

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

  const handleTogglePrivacy = async () => {
    const newValue = !isPrivate;
    setIsPrivate(newValue);
    setIsSaving(true);
    try {
      await updateProfileMutation.mutateAsync({ isPrivate: newValue } as Record<string, unknown>);
      if (updateUser) {
        await updateUser({ isPrivate: newValue });
      }
      console.log('[AccountSettings] Updated isPrivate to:', newValue);
    } catch (error) {
      console.error('[AccountSettings] Failed to update isPrivate:', error);
      setIsPrivate(!newValue);
    } finally {
      setIsSaving(false);
    }
  };
  
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
                        <Text style={styles.twoFactorSubtitle}>
                          {isTwoFactorEnabled ? 'Enabled - your account is protected.' : 'Add an extra layer of security to your account.'}
                        </Text>
                    </View>
                    <TouchableOpacity 
                        style={[styles.toggleSwitch, isTwoFactorEnabled && styles.toggleSwitchActive]}
                        onPress={handle2FAToggle}
                    >
                        <View style={[styles.toggleThumb, isTwoFactorEnabled && styles.toggleThumbActive]} />
                    </TouchableOpacity>
                </View>

                <Modal visible={show2FAModal} transparent animationType="slide" onRequestClose={() => setShow2FAModal(false)}>
                  <View style={styles.modalOverlay}>
                    <View style={styles.twoFAModal}>
                      <TouchableOpacity style={styles.twoFACloseBtn} onPress={() => setShow2FAModal(false)}>
                        <X size={20} color="#94A3B8" />
                      </TouchableOpacity>

                      {twoFAStep === 'setup' && (
                        <View style={styles.twoFAContent}>
                          <ActivityIndicator color="#4ADE80" size="large" />
                          <Text style={styles.twoFATitle}>Setting up 2FA...</Text>
                        </View>
                      )}

                      {twoFAStep === 'verify' && (
                        <View style={styles.twoFAContent}>
                          <View style={styles.twoFAIconCircle}>
                            <QrCode size={28} color="#4ADE80" />
                          </View>
                          <Text style={styles.twoFATitle}>Scan QR Code</Text>
                          <Text style={styles.twoFASubtitle}>Scan with your authenticator app (Google Authenticator, Authy, etc.)</Text>
                          {twoFAQrCode ? (
                            <Image source={{ uri: twoFAQrCode }} style={styles.qrImage} resizeMode="contain" />
                          ) : null}
                          <View style={styles.secretBox}>
                            <KeyRound size={14} color="#64748B" />
                            <Text style={styles.secretLabel}>Manual entry key:</Text>
                            <Text style={styles.secretText} selectable>{twoFASecret}</Text>
                          </View>
                          <Text style={styles.twoFAInputLabel}>Enter verification code</Text>
                          <TextInput
                            style={styles.twoFAInput}
                            value={twoFACode}
                            onChangeText={setTwoFACode}
                            placeholder="6-digit code"
                            placeholderTextColor="#475569"
                            keyboardType="number-pad"
                            maxLength={6}
                            autoFocus
                          />
                          {twoFAError ? <Text style={styles.twoFAError}>{twoFAError}</Text> : null}
                          <TouchableOpacity
                            style={[styles.twoFABtn, twoFALoading && { opacity: 0.6 }]}
                            onPress={handle2FAEnable}
                            disabled={twoFALoading}
                          >
                            {twoFALoading ? <ActivityIndicator color="#002E15" size="small" /> : <Text style={styles.twoFABtnText}>Enable 2FA</Text>}
                          </TouchableOpacity>
                        </View>
                      )}

                      {twoFAStep === 'success' && (
                        <View style={styles.twoFAContent}>
                          <View style={[styles.twoFAIconCircle, { backgroundColor: '#0D2016' }]}>
                            <CheckCircle2 size={28} color="#4ADE80" />
                          </View>
                          <Text style={styles.twoFATitle}>2FA Enabled!</Text>
                          <Text style={styles.twoFASubtitle}>Your account is now protected with two-factor authentication.</Text>
                          <TouchableOpacity style={styles.twoFABtn} onPress={() => setShow2FAModal(false)}>
                            <Text style={styles.twoFABtnText}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {twoFAStep === 'disable' && (
                        <View style={styles.twoFAContent}>
                          <View style={[styles.twoFAIconCircle, { backgroundColor: '#1A0A0A' }]}>
                            <Shield size={28} color="#EF4444" />
                          </View>
                          <Text style={styles.twoFATitle}>Disable 2FA</Text>
                          <Text style={styles.twoFASubtitle}>Enter your password and current authenticator code to disable two-factor authentication.</Text>
                          <Text style={styles.twoFAInputLabel}>Password</Text>
                          <TextInput
                            style={styles.twoFAInput}
                            value={twoFAPassword}
                            onChangeText={setTwoFAPassword}
                            placeholder="Your account password"
                            placeholderTextColor="#475569"
                            secureTextEntry
                          />
                          <Text style={styles.twoFAInputLabel}>Authenticator code</Text>
                          <TextInput
                            style={styles.twoFAInput}
                            value={twoFACode}
                            onChangeText={setTwoFACode}
                            placeholder="6-digit code"
                            placeholderTextColor="#475569"
                            keyboardType="number-pad"
                            maxLength={6}
                          />
                          {twoFAError ? <Text style={styles.twoFAError}>{twoFAError}</Text> : null}
                          <TouchableOpacity
                            style={[styles.twoFABtn, { backgroundColor: '#EF4444' }, twoFALoading && { opacity: 0.6 }]}
                            onPress={handle2FADisable}
                            disabled={twoFALoading}
                          >
                            {twoFALoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.twoFABtnText, { color: '#FFFFFF' }]}>Disable 2FA</Text>}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                </Modal>

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

                <View style={styles.privacySection}>
                  <Text style={styles.sectionHeader}>Account Privacy</Text>
                  <View style={styles.privacyIconRow}>
                    {isPrivate ? (
                      <Lock size={32} color="#4ADE80" />
                    ) : (
                      <Globe size={32} color="#64748B" />
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.privacyTitle}>{isPrivate ? 'Private Account' : 'Public Account'}</Text>
                      <Text style={styles.privacyDescription}>
                        {isPrivate
                          ? 'Only approved followers can see your content and profile.'
                          : 'Anyone can see your profile and content.'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.toggleContainer}>
                    <View style={styles.toggleTextContainer}>
                      <Text style={styles.toggleTitle}>Private Account</Text>
                      <Text style={styles.toggleSubtitle}>
                        When on, new followers must request to follow you before seeing your content.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.toggleSwitch, isPrivate && styles.toggleSwitchActive]}
                      onPress={handleTogglePrivacy}
                      disabled={isSaving}
                    >
                      <View style={[styles.toggleThumb, isPrivate && styles.toggleThumbActive]} />
                    </TouchableOpacity>
                  </View>
                </View>

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
    backgroundColor: '#131F2A',
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
    backgroundColor: '#131F2A',
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
    backgroundColor: '#131F2A',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewLabel: { color: '#94A3B8', fontSize: 14 },
  noBadgeContainer: {
    backgroundColor: '#131F2A',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  noBadgeText: { color: '#64748B', fontSize: 14 },
  privacySection: { marginTop: 24 },
  privacyIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131F2A',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  privacyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' as const, marginBottom: 4 },
  privacyDescription: { color: '#94A3B8', fontSize: 13, lineHeight: 18 },
  toggleContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingVertical: 8,
    backgroundColor: '#131F2A',
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  twoFAModal: {
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 24,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: '#1E293B',
  },
  twoFACloseBtn: { alignSelf: 'flex-end', padding: 8, marginBottom: 8 },
  twoFAContent: { alignItems: 'center', gap: 12 },
  twoFAIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0D2016',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  twoFATitle: { fontSize: 20, fontWeight: '700' as const, color: '#FFFFFF', textAlign: 'center' },
  twoFASubtitle: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },
  qrImage: { width: 200, height: 200, backgroundColor: '#FFFFFF', borderRadius: 12 },
  secretBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexWrap: 'wrap' as const,
    width: '100%',
  },
  secretLabel: { fontSize: 12, color: '#64748B' },
  secretText: { fontSize: 12, color: '#4ADE80', fontFamily: 'monospace', flex: 1, flexWrap: 'wrap' as const },
  twoFAInputLabel: { fontSize: 13, color: '#94A3B8', alignSelf: 'flex-start' as const },
  twoFAInput: {
    width: '100%',
    backgroundColor: '#1E2D3C',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 4,
    textAlign: 'center' as const,
  },
  twoFAError: { fontSize: 13, color: '#EF4444', textAlign: 'center' },
  twoFABtn: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center' as const,
    width: '100%',
    marginTop: 4,
  },
  twoFABtnText: { fontSize: 16, fontWeight: '700' as const, color: '#002E15' },
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
