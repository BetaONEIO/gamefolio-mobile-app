import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck, UserX, Users } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { api, FollowRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import AppHeader from '@/components/AppHeader';

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function FollowRequestsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const router = useRouter();
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  const { data: requests = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/follow-requests'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return [];
      return api.followRequests.getPending(token);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      await api.followRequests.approve(requestId, token);
    },
    onMutate: (requestId) => {
      setProcessingIds(prev => new Set(prev).add(requestId));
    },
    onSuccess: (_, requestId) => {
      queryClient.setQueryData<FollowRequest[]>(['/api/follow-requests'], (old = []) =>
        old.filter(r => r.id !== requestId)
      );
    },
    onSettled: (_, __, requestId) => {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');
      await api.followRequests.reject(requestId, token);
    },
    onMutate: (requestId) => {
      setProcessingIds(prev => new Set(prev).add(requestId));
    },
    onSuccess: (_, requestId) => {
      queryClient.setQueryData<FollowRequest[]>(['/api/follow-requests'], (old = []) =>
        old.filter(r => r.id !== requestId)
      );
    },
    onSettled: (_, __, requestId) => {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    },
  });

  const handleApprove = useCallback((request: FollowRequest) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    approveMutation.mutate(request.id);
  }, [approveMutation]);

  const handleReject = useCallback((request: FollowRequest) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    rejectMutation.mutate(request.id);
  }, [rejectMutation]);

  const handleViewProfile = useCallback((userId: number) => {
    router.push(`/user/${userId}` as any);
  }, [router]);

  const renderItem = useCallback(({ item }: { item: FollowRequest }) => {
    const isProcessing = processingIds.has(item.id);
    const user = item.requester;

    return (
      <View style={styles.item} testID={`follow-request-${item.id}`}>
        <TouchableOpacity
          style={styles.userRow}
          onPress={() => user?.id && handleViewProfile(user.id)}
          activeOpacity={0.7}
        >
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>
                {(user?.username || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={styles.displayName} numberOfLines={1}>
              {user?.displayName || user?.username || 'Unknown'}
            </Text>
            <Text style={styles.username} numberOfLines={1}>
              @{user?.username || 'unknown'}
            </Text>
            <Text style={styles.timeAgo}>{getTimeAgo(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="#4ADE80" style={styles.spinner} />
          ) : (
            <>
              <TouchableOpacity
                style={styles.approveBtn}
                onPress={() => handleApprove(item)}
                activeOpacity={0.8}
                testID={`approve-request-${item.id}`}
              >
                <UserCheck size={16} color="#000" />
                <Text style={styles.approveBtnText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => handleReject(item)}
                activeOpacity={0.8}
                testID={`reject-request-${item.id}`}
              >
                <UserX size={16} color="#EF4444" />
                <Text style={styles.rejectBtnText}>Decline</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  }, [processingIds, handleApprove, handleReject, handleViewProfile]);

  const ListEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Users size={36} color="#334155" />
      </View>
      <Text style={styles.emptyTitle}>No pending requests</Text>
      <Text style={styles.emptySubtitle}>
        Follow requests from other users will appear here
      </Text>
    </View>
  ), []);

  return (
    <View style={styles.container}>
      <AppHeader showBackButton />

      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>Follow Requests</Text>
          {requests.length > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ADE80" />
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderItem}
          keyExtractor={item => item.id.toString()}
          ListEmptyComponent={ListEmpty}
          onRefresh={refetch}
          refreshing={false}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: headerHeight, paddingBottom: insets.bottom + 16 },
          ]}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080E17',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#FBBF24',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  item: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2D3F55',
  },
  avatarLetter: {
    color: '#4ADE80',
    fontSize: 20,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  username: {
    color: '#64748B',
    fontSize: 13,
  },
  timeAgo: {
    color: '#475569',
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingLeft: 66,
  },
  spinner: {
    flex: 1,
    justifyContent: 'center',
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4ADE80',
    borderRadius: 10,
    paddingVertical: 10,
  },
  approveBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '700',
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  rejectBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
