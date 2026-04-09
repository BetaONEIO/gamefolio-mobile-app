import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Send,
  MoreVertical,
  Trash2,
  Ban,
  Image as ImageIcon,
  Smile,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Message } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const formatMessageTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function ConversationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, getAccessToken } = useAuth();
  const params = useLocalSearchParams<{ 
    id: string; 
    username?: string;
    displayName?: string;
    avatarUrl?: string;
    isNew?: string;
  }>();
  
  const recipientId = parseInt(params.id, 10);
  const isNewConversation = params.isNew === 'true';
  
  const [inputText, setInputText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'block' | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const flatListRef = useRef<FlatList>(null);

  const otherUser = {
    id: recipientId,
    username: params.username || 'User',
    displayName: params.displayName || params.username || 'User',
    avatarUrl: params.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
    isOnline: true,
  };

  const messagesQuery = useQuery({
    queryKey: ['messages', recipientId],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      return api.messages.getMessages(recipientId, token);
    },
    enabled: isAuthenticated && !isNaN(recipientId) && !isNewConversation,
    refetchInterval: 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: { receiverId: number; content: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      return api.messages.send(data, token);
    },
    onSuccess: (newMessage) => {
      console.log('[Conversation] Message sent successfully:', newMessage.id);
      setLocalMessages((prev) => [...prev, newMessage]);
      queryClient.invalidateQueries({ queryKey: ['messages', recipientId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    onError: (error) => {
      console.error('[Conversation] Failed to send message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    },
  });

  const startConversationMutation = useMutation({
    mutationFn: async (data: { username: string; content: string }) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      return api.messages.startConversation(data, token);
    },
    onSuccess: (result) => {
      console.log('[Conversation] New conversation started:', result.conversation.id);
      setLocalMessages((prev) => [...prev, result.message]);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    onError: (error) => {
      console.error('[Conversation] Failed to start conversation:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      return api.messages.deleteMessage(messageId, token);
    },
    onSuccess: (result) => {
      console.log('[Conversation] Message deleted:', result.messageId);
      setLocalMessages((prev) => prev.filter((m) => m.id !== result.messageId));
      queryClient.invalidateQueries({ queryKey: ['messages', recipientId] });
    },
    onError: (error) => {
      console.error('[Conversation] Failed to delete message:', error);
      Alert.alert('Error', 'Failed to delete message.');
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (userId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      return api.messages.deleteConversation(userId, token);
    },
    onSuccess: () => {
      console.log('[Conversation] Conversation deleted');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      router.back();
    },
    onError: (error) => {
      console.error('[Conversation] Failed to delete conversation:', error);
      Alert.alert('Error', 'Failed to delete conversation.');
    },
  });

  const blockStatusQuery = useQuery({
    queryKey: ['blockStatus', recipientId],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      return api.blocking.getBlockStatus(recipientId, token);
    },
    enabled: isAuthenticated && !isNaN(recipientId),
  });

  const iBlockedThem = blockStatusQuery.data?.iBlockedThem ?? false;
  const theyBlockedMe = blockStatusQuery.data?.theyBlockedMe ?? false;
  const isBlocked = iBlockedThem || theyBlockedMe;

  const blockUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      return api.blocking.block(userId, token);
    },
    onSuccess: () => {
      console.log('[Conversation] User blocked');
      queryClient.invalidateQueries({ queryKey: ['blockStatus', recipientId] });
    },
    onError: (error) => {
      console.error('[Conversation] Failed to block user:', error);
      Alert.alert('Error', 'Failed to block user.');
    },
  });

  const unblockUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      return api.blocking.unblock(userId, token);
    },
    onSuccess: () => {
      console.log('[Conversation] User unblocked');
      queryClient.invalidateQueries({ queryKey: ['blockStatus', recipientId] });
    },
    onError: (error) => {
      console.error('[Conversation] Failed to unblock user:', error);
      Alert.alert('Error', 'Failed to unblock user.');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (userId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      return api.messages.markRead(userId, token);
    },
  });

  useEffect(() => {
    if (messagesQuery.data) {
      setLocalMessages(messagesQuery.data);
    }
  }, [messagesQuery.data]);

  useEffect(() => {
    if (isAuthenticated && !isNaN(recipientId)) {
      markReadMutation.mutate(recipientId);
    }
  }, [recipientId, isAuthenticated]);

  useEffect(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, []);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    
    const content = inputText.trim();
    setInputText('');

    if (isNewConversation && localMessages.length === 0) {
      startConversationMutation.mutate({
        username: otherUser.username,
        content,
      });
    } else {
      sendMessageMutation.mutate({
        receiverId: recipientId,
        content,
      });
    }
  }, [inputText, isNewConversation, localMessages.length, otherUser.username, recipientId]);

  const handleDeleteMessage = useCallback((messageId: number) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteMessageMutation.mutate(messageId),
        },
      ]
    );
  }, []);

  const handleDeleteConversation = useCallback(() => {
    setConfirmAction('delete');
  }, []);

  const handleBlockUser = useCallback(() => {
    setConfirmAction('block');
  }, []);

  const handleUnblockUser = useCallback(() => {
    unblockUserMutation.mutate(recipientId);
    setShowOptions(false);
  }, [recipientId]);

  const handleConfirm = useCallback(() => {
    if (confirmAction === 'delete') {
      deleteConversationMutation.mutate(recipientId);
    } else if (confirmAction === 'block') {
      blockUserMutation.mutate(recipientId);
    }
    setConfirmAction(null);
    setShowOptions(false);
  }, [confirmAction, recipientId]);

  const handleCancelConfirm = useCallback(() => {
    setConfirmAction(null);
  }, []);

  const handleAvatarPress = useCallback(() => {
    console.log('[Conversation] Avatar pressed for user:', otherUser.username);
    router.push({ pathname: '/user/[id]', params: { id: otherUser.username } });
  }, [otherUser.username, recipientId, router]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isCurrentUser = user ? item.senderId === user.id : false;
    const showAvatar =
      !isCurrentUser &&
      (index === 0 || localMessages[index - 1].senderId !== item.senderId);

    return (
      <TouchableOpacity
        style={[
          styles.messageRow,
          isCurrentUser ? styles.messageRowRight : styles.messageRowLeft,
        ]}
        onLongPress={() => isCurrentUser && handleDeleteMessage(item.id)}
        delayLongPress={500}
        activeOpacity={0.8}
      >
        {!isCurrentUser && (
          <TouchableOpacity 
            style={styles.avatarSpace}
            onPress={showAvatar ? handleAvatarPress : undefined}
            activeOpacity={showAvatar ? 0.8 : 1}
            disabled={!showAvatar}
          >
            {showAvatar && (
              <Image source={{ uri: otherUser.avatarUrl }} style={styles.messageAvatar} />
            )}
          </TouchableOpacity>
        )}
        <View
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isCurrentUser ? styles.messageTextSent : styles.messageTextReceived,
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isCurrentUser ? styles.messageTimeSent : styles.messageTimeReceived,
            ]}
          >
            {formatMessageTime(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const isSending = sendMessageMutation.isPending || startConversationMutation.isPending;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#131F2A', '#061021']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.canGoBack() ? router.back() : router.push('/(drawer)/messages')}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.userInfo}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={handleAvatarPress}
            activeOpacity={0.8}
          >
            <Image source={{ uri: otherUser.avatarUrl }} style={styles.headerAvatar} />
            {otherUser.isOnline && <View style={styles.onlineIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.userTextInfo}
            onPress={handleAvatarPress}
            activeOpacity={0.8}
          >
            <Text style={styles.headerUsername}>{otherUser.displayName}</Text>
            <Text style={styles.headerStatus}>
              {otherUser.isOnline ? 'Online' : 'Offline'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => { setShowOptions(prev => !prev); setConfirmAction(null); }}
          >
            <MoreVertical size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {showOptions && (
          <View style={[styles.optionsMenu, { top: insets.top + 56 }]}>
            {confirmAction === null ? (
              <>
                <TouchableOpacity style={styles.optionItem} onPress={handleDeleteConversation}>
                  <Trash2 size={18} color="#EF4444" />
                  <Text style={styles.optionTextDanger}>Delete Conversation</Text>
                </TouchableOpacity>
                {iBlockedThem ? (
                  <TouchableOpacity style={styles.optionItem} onPress={handleUnblockUser}>
                    <Ban size={18} color="#4ADE80" />
                    <Text style={[styles.optionTextDanger, { color: '#4ADE80' }]}>Unblock User</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.optionItem} onPress={handleBlockUser}>
                    <Ban size={18} color="#EF4444" />
                    <Text style={styles.optionTextDanger}>Block User</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.confirmPanel}>
                <Text style={styles.confirmText}>
                  {confirmAction === 'block'
                    ? `Block ${otherUser.displayName}?`
                    : 'Delete this conversation?'}
                </Text>
                <View style={styles.confirmButtons}>
                  <TouchableOpacity style={styles.confirmCancelBtn} onPress={handleCancelConfirm}>
                    <Text style={styles.confirmCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmDangerBtn} onPress={handleConfirm}>
                    <Text style={styles.confirmDangerText}>
                      {confirmAction === 'block' ? 'Block' : 'Delete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {messagesQuery.isLoading && !isNewConversation ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4ADE80" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={localMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyMessages}>
                <Text style={styles.emptyMessagesText}>
                  {isNewConversation 
                    ? `Start a conversation with ${otherUser.displayName}`
                    : 'No messages yet'}
                </Text>
              </View>
            }
          />
        )}

        {isBlocked ? (
          <View style={[styles.blockedBanner, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {iBlockedThem ? (
              <>
                <Ban size={20} color="#F59E0B" style={{ marginBottom: 6 }} />
                <Text style={styles.blockedBannerText}>
                  You have blocked {otherUser.displayName}. Unblock them to send messages.
                </Text>
                <TouchableOpacity
                  style={styles.unblockButton}
                  onPress={() => unblockUserMutation.mutate(recipientId)}
                  disabled={unblockUserMutation.isPending}
                >
                  {unblockUserMutation.isPending ? (
                    <ActivityIndicator size="small" color="#002E15" />
                  ) : (
                    <Text style={styles.unblockButtonText}>Unblock</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ban size={20} color="#EF4444" style={{ marginBottom: 6 }} />
                <Text style={styles.blockedBannerText}>
                  You cannot send messages to this user.
                </Text>
              </>
            )}
          </View>
        ) : (
          <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.inputWrapper}>
              <TouchableOpacity style={styles.inputAction}>
                <Smile size={24} color="#64748B" />
              </TouchableOpacity>
              <TextInput
                style={styles.textInput}
                placeholder="Type a message..."
                placeholderTextColor="#64748B"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                editable={!isSending}
              />
              <TouchableOpacity style={styles.inputAction}>
                <ImageIcon size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color="#002E15" />
              ) : (
                <Send size={20} color={inputText.trim() ? '#002E15' : '#64748B'} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {showOptions && (
        <TouchableOpacity 
          style={styles.optionsOverlay} 
          onPress={() => { setShowOptions(false); setConfirmAction(null); }}
          activeOpacity={1}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131F2A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    zIndex: 10,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#334155',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#131F2A',
  },
  userTextInfo: {
    flex: 1,
  },
  headerUsername: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
  },
  headerStatus: {
    fontSize: 13,
    color: '#22C55E',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionButton: {
    padding: 8,
  },
  optionsMenu: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#334155',
    zIndex: 100,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    borderRadius: 8,
  },
  optionTextDanger: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500' as const,
  },
  confirmPanel: {
    padding: 4,
    minWidth: 200,
  },
  confirmText: {
    fontSize: 14,
    color: '#F1F5F9',
    fontWeight: '600' as const,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  confirmButtons: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center' as const,
  },
  confirmCancelText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  confirmDangerBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center' as const,
  },
  confirmDangerText: {
    fontSize: 13,
    color: '#FFF',
    fontWeight: '600' as const,
  },
  optionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  keyboardView: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  avatarSpace: {
    width: 32,
    marginRight: 8,
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#334155',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  messageBubbleSent: {
    backgroundColor: '#4ADE80',
    borderBottomRightRadius: 6,
  },
  messageBubbleReceived: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextSent: {
    color: '#002E15',
  },
  messageTextReceived: {
    color: '#FFF',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeSent: {
    color: 'rgba(0, 46, 21, 0.6)',
    textAlign: 'right' as const,
  },
  messageTimeReceived: {
    color: '#64748B',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 4,
  },
  inputAction: {
    padding: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    color: '#FFF',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4ADE80',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#1E293B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyMessagesText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center' as const,
  },
  blockedBanner: {
    alignItems: 'center' as const,
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  blockedBannerText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 12,
  },
  unblockButton: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#4ADE80',
    minWidth: 100,
    alignItems: 'center' as const,
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#002E15',
  },
});
