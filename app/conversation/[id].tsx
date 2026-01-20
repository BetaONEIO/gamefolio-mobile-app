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
import UserProfilePreviewModal from '@/components/UserProfilePreviewModal';
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
  const [isProfilePreviewVisible, setIsProfilePreviewVisible] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
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

  const blockUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      return api.blocking.block(userId, token);
    },
    onSuccess: () => {
      console.log('[Conversation] User blocked');
      Alert.alert('User Blocked', `You have blocked ${otherUser.displayName}`);
      router.back();
    },
    onError: (error) => {
      console.error('[Conversation] Failed to block user:', error);
      Alert.alert('Error', 'Failed to block user.');
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
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this entire conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deleteConversationMutation.mutate(recipientId),
        },
      ]
    );
    setShowOptions(false);
  }, [recipientId]);

  const handleBlockUser = useCallback(() => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${otherUser.displayName}? You won't be able to message each other.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Block', 
          style: 'destructive',
          onPress: () => blockUserMutation.mutate(recipientId),
        },
      ]
    );
    setShowOptions(false);
  }, [recipientId, otherUser.displayName]);

  const handleAvatarPress = useCallback(() => {
    console.log('[Conversation] Avatar pressed for user:', otherUser.username);
    setIsProfilePreviewVisible(true);
  }, [otherUser.username]);

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
        colors={['#0F1520', '#020617']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
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
            onPress={() => setShowOptions(!showOptions)}
          >
            <MoreVertical size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {showOptions && (
          <View style={[styles.optionsMenu, { top: insets.top + 56 }]}>
            <TouchableOpacity style={styles.optionItem} onPress={handleDeleteConversation}>
              <Trash2 size={18} color="#EF4444" />
              <Text style={styles.optionTextDanger}>Delete Conversation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.optionItem} onPress={handleBlockUser}>
              <Ban size={18} color="#EF4444" />
              <Text style={styles.optionTextDanger}>Block User</Text>
            </TouchableOpacity>
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
      </KeyboardAvoidingView>

      {showOptions && (
        <TouchableOpacity 
          style={styles.optionsOverlay} 
          onPress={() => setShowOptions(false)}
          activeOpacity={1}
        />
      )}

      <UserProfilePreviewModal
        visible={isProfilePreviewVisible}
        onClose={() => {
          console.log('[Conversation] Closing profile preview modal');
          setIsProfilePreviewVisible(false);
        }}
        user={{
          id: otherUser.id.toString(),
          username: otherUser.username,
          displayName: otherUser.displayName,
          avatarUrl: otherUser.avatarUrl,
          bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=300&fit=crop',
          isOnline: otherUser.isOnline,
          level: 25,
          verified: true,
          bio: 'Gaming enthusiast | Content creator',
          stats: {
            clips: 42,
            followers: 1250,
            following: 380,
          },
          engagement: {
            likes: 5400,
            fires: 2100,
            streak: 14,
          },
          favoriteGames: ['Fortnite', 'Call of Duty', 'Apex Legends'],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
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
    borderColor: '#0F1520',
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
});
