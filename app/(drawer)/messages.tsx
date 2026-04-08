import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MessageSquare, Search, UserPlus, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AppHeader from '@/components/AppHeader';
import NewConversationModal from '@/components/NewConversationModal';
import { api, Conversation } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const formatTimestamp = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins} m`;
  if (diffHours < 24) return `${diffHours} h`;
  if (diffDays === 1) return '1 day';
  if (diffDays < 7) return `${diffDays} days`;
  return date.toLocaleDateString();
};

export default function MessagesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, logout, getAccessToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewConversationModalVisible, setIsNewConversationModalVisible] = useState(false);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', user?.id, user?.username],
    queryFn: async () => {
      console.log('[Messages] 🔵 Fetching conversations (JWT auth)...');
      console.log('[Messages] 🔵 User:', user?.username);
      console.log('[Messages] 🔵 User ID:', user?.id);
      
      const token = await getAccessToken();
      if (!token) {
        console.error('[Messages] ❌ No access token available');
        throw new Error('AUTH_TOKEN_REQUIRED');
      }
      
      try {
        const result = await api.messages.getConversations(token);
        console.log('[Messages] ✅ Successfully fetched', result.length, 'conversations');
        console.log('[Messages] 📦 Raw response:', JSON.stringify(result, null, 2));
        if (result.length > 0) {
          console.log('[Messages] 📦 First conversation structure:', Object.keys(result[0]));
          console.log('[Messages] 📦 First conversation recipient:', result[0].recipient);
          console.log('[Messages] 📦 First conversation recipientId:', result[0].recipientId);
        }
        return result;
      } catch (error: any) {
        console.error('[Messages] ❌ API call failed:', error.message);
        console.error('[Messages] ❌ Error status:', error.status);
        
        if (error.status === 401) {
          console.error('[Messages] ❌ 401 Unauthorized - JWT token not valid');
          throw new Error('AUTH_TOKEN_INVALID');
        }
        throw error;
      }
    },
    enabled: isAuthenticated && !!user,
    refetchInterval: 10000,
    retry: false,
    staleTime: 5000,
  });

  const conversations = conversationsQuery.data || [];

  console.log('[Messages] 🔍 Filtering conversations, total:', conversations.length);
  const filteredConversations = conversations
    .map((conv, index) => {
      console.log(`[Messages] 🔍 Conv ${index}:`, JSON.stringify(conv, null, 2));
      
      // Create a normalized conversation object
      const normalized: any = { ...conv };
      
      // Ensure id exists
      if (!normalized.id) {
        console.log(`[Messages] ⚠️ Conv ${index} has no id, using recipientId or index`);
        normalized.id = normalized.recipientId || normalized.recipient_id || `temp-${index}`;
      }
      
      // Normalize recipient
      if (!normalized.recipient) {
        console.log(`[Messages] ⚠️ Conv ${index} has no recipient property, checking for other_user...`);
        const otherUser = normalized.other_user || normalized.otherUser || normalized.user;
        if (otherUser) {
          console.log(`[Messages] ✅ Found other_user for conv ${index}:`, otherUser);
          normalized.recipient = {
            id: otherUser.id,
            username: otherUser.username,
            displayName: otherUser.display_name || otherUser.displayName || otherUser.username,
            avatarUrl: otherUser.avatar_url || otherUser.avatarUrl || null,
          };
          normalized.recipientId = otherUser.id;
        } else {
          console.log(`[Messages] ❌ Conv ${index} has no recipient or other_user, skipping`);
          return null;
        }
      }
      
      // Normalize lastMessage
      if (!normalized.lastMessage && normalized.last_message) {
        normalized.lastMessage = {
          id: normalized.last_message.id,
          content: normalized.last_message.content,
          senderId: normalized.last_message.sender_id || normalized.last_message.senderId,
          createdAt: normalized.last_message.created_at || normalized.last_message.createdAt,
        };
      }
      
      // Normalize unreadCount
      if (typeof normalized.unreadCount !== 'number') {
        normalized.unreadCount = normalized.unread_count || 0;
      }
      
      return normalized as Conversation;
    })
    .filter((conv): conv is Conversation => {
      if (!conv) return false;
      
      const username = conv.recipient?.username?.toLowerCase() || '';
      const displayName = conv.recipient?.displayName?.toLowerCase() || '';
      const messageContent = conv.lastMessage?.content?.toLowerCase() || '';
      const query = searchQuery.toLowerCase();
      return username.includes(query) || displayName.includes(query) || messageContent.includes(query);
    });
  console.log('[Messages] 🔍 Filtered conversations:', filteredConversations.length);

  const handleConversationPress = useCallback((conversation: Conversation) => {
    if (!conversation.recipient) {
      console.error('[Messages] Cannot open conversation - recipient is undefined');
      return;
    }
    console.log('[Messages] Opening conversation with user:', conversation.recipientId);
    router.push({
      pathname: '/conversation/[id]' as const,
      params: { 
        id: conversation.recipientId.toString(), 
        username: conversation.recipient.username || '',
        displayName: conversation.recipient.displayName || conversation.recipient.username || 'Unknown',
        avatarUrl: conversation.recipient.avatarUrl || '',
      },
    });
  }, [router]);

  const handleNewMessage = useCallback(() => {
    console.log('[Messages] Opening new conversation modal');
    setIsNewConversationModalVisible(true);
  }, []);

  const handleSelectUser = useCallback((selectedUser: { id: number; username: string; displayName: string; avatarUrl: string | null }) => {
    console.log('[Messages] Selected user for new conversation:', selectedUser.username);
    setIsNewConversationModalVisible(false);
    router.push({
      pathname: '/conversation/[id]' as const,
      params: { 
        id: selectedUser.id.toString(), 
        username: selectedUser.username,
        displayName: selectedUser.displayName,
        avatarUrl: selectedUser.avatarUrl || '',
        isNew: 'true',
      },
    });
  }, [router]);

  const handleRefresh = useCallback(() => {
    console.log('[Messages] Refreshing conversations');
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }, [queryClient]);

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    if (!item.recipient) return null;
    
    return (
      <TouchableOpacity
        style={[
          styles.conversationItem,
          item.unreadCount > 0 && styles.conversationItemUnread,
        ]}
        onPress={() => handleConversationPress(item)}
        activeOpacity={0.7}
      >
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.recipient.username } })}
          activeOpacity={0.8}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          <Image 
            source={{ uri: item.recipient.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' }} 
            style={styles.avatar} 
          />
        </TouchableOpacity>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.username} numberOfLines={1}>
              {item.recipient.displayName || item.recipient.username || 'Unknown'}
            </Text>
            {item.lastMessage && (
              <Text style={styles.timestamp}>
                {formatTimestamp(item.lastMessage.createdAt)}
              </Text>
            )}
          </View>
          <View style={styles.conversationFooter}>
            <Text
              style={[
                styles.lastMessage,
                item.unreadCount > 0 && styles.lastMessageUnread,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage?.content || 'Start a conversation'}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {item.unreadCount > 9 ? '9+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MessageSquare size={64} color="#334155" />
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptySubtitle}>
        Start a conversation with other gamers!
      </Text>
      <TouchableOpacity style={styles.startButton} onPress={handleNewMessage}>
        <UserPlus size={20} color="#002E15" />
        <Text style={styles.startButtonText}>Start a Conversation</Text>
      </TouchableOpacity>
    </View>
  );

  const renderNotAuthenticated = () => (
    <View style={styles.emptyState}>
      <MessageSquare size={64} color="#334155" />
      <Text style={styles.emptyTitle}>Sign in to view messages</Text>
      <Text style={styles.emptySubtitle}>
        Create an account or sign in to start messaging
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <LinearGradient
        colors={['#131F2A', '#061021']}
        style={StyleSheet.absoluteFill}
      />

      <AppHeader showBackButton />

      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <MessageSquare size={24} color="#4ADE80" />
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <TouchableOpacity style={styles.newButton} onPress={handleNewMessage}>
          <UserPlus size={18} color="#FFF" />
          <Text style={styles.newButtonText}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#64748B" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search conversations..."
          placeholderTextColor="#64748B"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {!isAuthenticated ? (
        renderNotAuthenticated()
      ) : conversationsQuery.isError ? (
        <View style={styles.emptyState}>
          <MessageSquare size={64} color="#EF4444" />
          <Text style={styles.emptyTitle}>Authentication Error</Text>
          <Text style={styles.emptySubtitle}>
            {conversationsQuery.error?.message === 'AUTH_TOKEN_REQUIRED' || conversationsQuery.error?.message === 'AUTH_TOKEN_INVALID'
              ? 'Your session has expired. Please log out and log in again.'
              : 'Authentication failed. Please try logging out and back in.'}
          </Text>
          <View style={styles.errorInfo}>
            <Text style={styles.errorInfoText}>Backend URL:</Text>
            <Text style={styles.errorInfoValue}>{process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app.gamefolio.com'}</Text>
            <Text style={styles.errorInfoText}>User ID: {user?.id}</Text>
            <Text style={styles.errorInfoText}>Username: {user?.username}</Text>
          </View>
          <TouchableOpacity 
            style={styles.errorButton} 
            onPress={async () => {
              console.log('[Messages] Logging out due to session error');
              await logout();
              router.replace('/index' as any);
            }}
          >
            <LogOut size={20} color="#FFF" />
            <Text style={styles.errorButtonText}>Log Out & Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : conversationsQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => (item.id?.toString() || `conv-${item.recipientId || Math.random()}`)}
          contentContainerStyle={[
            styles.listContent,
            filteredConversations.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={conversationsQuery.isFetching && !conversationsQuery.isLoading}
              onRefresh={handleRefresh}
              tintColor="#4ADE80"
              colors={['#4ADE80']}
            />
          }
        />
      )}

      <NewConversationModal
        visible={isNewConversationModalVisible}
        onClose={() => setIsNewConversationModalVisible(false)}
        onSelectUser={handleSelectUser}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131F2A',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#FFF',
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#22C55E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  newButtonText: {
    color: '#FFF',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchIcon: {
    marginLeft: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    color: '#FFF',
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 12,
  },
  listContentEmpty: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  conversationItemUnread: {
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#334155',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  username: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFF',
    flex: 1,
    marginRight: 12,
  },
  timestamp: {
    fontSize: 13,
    color: '#64748B',
  },
  conversationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#94A3B8',
    flex: 1,
    marginRight: 12,
  },
  lastMessageUnread: {
    color: '#CBD5E1',
    fontWeight: '500' as const,
  },
  unreadBadge: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: 'bold' as const,
    color: '#002E15',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: '#FFF',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#4ADE80',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#002E15',
    fontWeight: 'bold' as const,
    fontSize: 16,
  },
  errorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#FFF',
    fontWeight: 'bold' as const,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
  },
  errorInfo: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginVertical: 16,
    width: '100%',
    maxWidth: 400,
  },
  errorInfoText: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  errorInfoValue: {
    fontSize: 13,
    color: '#4ADE80',
    fontWeight: '600' as const,
    marginBottom: 8,
  },
});
