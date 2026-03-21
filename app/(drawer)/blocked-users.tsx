import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { UserX, UserCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, User } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';

export default function BlockedUsersScreen() {
  const { getAccessToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [unblockingId, setUnblockingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return { blockedUsers: [] as User[] };
      return api.blocking.getBlocked(token);
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async (userId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      return api.blocking.unblock(userId, token);
    },
    onMutate: (userId) => setUnblockingId(userId),
    onSettled: () => {
      setUnblockingId(null);
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
    },
  });

  const blockedUsers = data?.blockedUsers || [];

  const renderItem = ({ item }: { item: User }) => (
    <View style={styles.userRow}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id.toString() } })}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' }}
          style={styles.avatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.displayName}>{item.displayName || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.unblockBtn}
        onPress={() => unblockMutation.mutate(item.id)}
        disabled={unblockingId === item.id}
      >
        {unblockingId === item.id ? (
          <ActivityIndicator size="small" color="#4ADE80" />
        ) : (
          <>
            <UserCheck size={14} color="#4ADE80" />
            <Text style={styles.unblockText}>Unblock</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0F1520', '#020617']} style={StyleSheet.absoluteFill} />
      <AppHeader />
      <View style={styles.header}>
        <Text style={styles.title}>Blocked Users</Text>
        <Text style={styles.subtitle}>
          {blockedUsers.length > 0
            ? `You have blocked ${blockedUsers.length} user${blockedUsers.length !== 1 ? 's' : ''}`
            : 'Manage users you have blocked'}
        </Text>
      </View>
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#4ADE80" size="large" />
          <Text style={styles.loadingText}>Loading blocked users...</Text>
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIcon}>
            <UserX size={40} color="#4ADE80" />
          </View>
          <Text style={styles.emptyTitle}>No blocked users</Text>
          <Text style={styles.emptyMessage}>
            Users you block will appear here. You can block someone from their profile page.
          </Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
    gap: 16,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 15,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2332',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2D3748',
  },
  userDetails: {
    flex: 1,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  username: {
    fontSize: 13,
    color: '#64748B',
  },
  unblockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(74,222,128,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
    minWidth: 90,
    justifyContent: 'center',
  },
  unblockText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#4ADE80',
  },
});
