import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Search, UserPlus } from 'lucide-react-native';
import { api, User } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery } from '@tanstack/react-query';

interface NewConversationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectUser: (user: User) => void;
}

export default function NewConversationModal({
  visible,
  onClose,
  onSelectUser,
}: NewConversationModalProps) {
  const { getAccessToken } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchUsersQuery = useQuery({
    queryKey: ['users', 'search', debouncedQuery],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('No authentication token');
      const result = await api.search.users(debouncedQuery, token);
      return result.users;
    },
    enabled: debouncedQuery.length >= 1,
  });

  const handleSelectUser = useCallback((user: User) => {
    console.log('[NewConversation] Selected user:', user.username);
    onSelectUser(user);
    setSearchQuery('');
  }, [onSelectUser]);

  const handleClose = useCallback(() => {
    setSearchQuery('');
    onClose();
  }, [onClose]);

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleSelectUser(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        <Image
          source={{ uri: item.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' }}
          style={styles.avatar}
        />
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>{item.displayName}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
      <UserPlus size={20} color="#4ADE80" />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>New Conversation</Text>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color="#64748B" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
          </View>

          {searchUsersQuery.isLoading && debouncedQuery.length >= 1 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#4ADE80" />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          )}

          {!searchUsersQuery.isLoading && debouncedQuery.length < 1 && (
            <View style={styles.emptyState}>
              <Search size={48} color="#334155" />
              <Text style={styles.emptyTitle}>Search for users</Text>
              <Text style={styles.emptySubtitle}>
                Type a username to start a new conversation
              </Text>
            </View>
          )}

          {!searchUsersQuery.isLoading && debouncedQuery.length >= 1 && (
            <FlatList
              data={searchUsersQuery.data || []}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.noResultsText}>No users found</Text>
                </View>
              }
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
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
    paddingBottom: 40,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 16,
    backgroundColor: '#1E293B',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#334155',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#94A3B8',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#64748B',
  },
});
