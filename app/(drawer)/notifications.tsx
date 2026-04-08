import React, { useCallback } from 'react';
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
import { Bell, Heart, Flame, MessageSquare, UserPlus, AtSign, Upload, X, CheckCheck, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useNotifications } from '@/context/NotificationsContext';
import { Notification } from '@/lib/api';
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

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'like': return { icon: Heart, color: '#EF4444', bg: 'rgba(239,68,68,0.15)' };
    case 'flame':
    case 'fire': return { icon: Flame, color: '#F97316', bg: 'rgba(249,115,22,0.15)' };
    case 'comment':
    case 'reply': return { icon: MessageSquare, color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' };
    case 'follow':
    case 'follower': return { icon: UserPlus, color: '#818CF8', bg: 'rgba(129,140,248,0.15)' };
    case 'follow_request': return { icon: UserPlus, color: '#FBBF24', bg: 'rgba(251,191,36,0.15)' };
    case 'message': return { icon: MessageSquare, color: '#38BDF8', bg: 'rgba(56,189,248,0.15)' };
    case 'mention':
    case 'clip_mention':
    case 'comment_mention': return { icon: AtSign, color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' };
    case 'upload': return { icon: Upload, color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' };
    default: return { icon: Bell, color: '#4ADE80', bg: 'rgba(74,222,128,0.15)' };
  }
}

function getNotificationTitle(type: Notification['type']): string {
  switch (type) {
    case 'like': return 'New Like';
    case 'flame':
    case 'fire': return 'New Flame';
    case 'comment':
    case 'reply': return 'New Comment';
    case 'follow':
    case 'follower': return 'New Follower';
    case 'follow_request': return 'Follow Request';
    case 'message': return 'New Message';
    case 'mention':
    case 'clip_mention':
    case 'comment_mention': return 'Mention';
    case 'upload': return 'New Upload';
    default: return 'Notification';
  }
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const router = useRouter();
  const {
    notifications,
    isUnavailable,
    isLoading,
    markAllRead,
    clearAll,
    removeNotification,
    markRead,
    fetchNotifications,
  } = useNotifications();

  const handleNotificationPress = useCallback((notification: Notification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!notification.isRead) {
      markRead(notification.id);
    }

    if (notification.type === 'follow_request') {
      router.push('/(drawer)/follow-requests' as any);
      return;
    }

    if (notification.actionUrl) {
      router.push(notification.actionUrl as any);
      return;
    }

    switch (notification.type) {
      case 'message':
        router.push('/(drawer)/messages');
        break;
      case 'follow':
      case 'follower':
        if (notification.fromUser?.id || notification.fromUserId) {
          router.push(`/user/${notification.fromUser?.id || notification.fromUserId}` as any);
        }
        break;
      case 'like':
      case 'flame':
      case 'fire':
      case 'comment':
      case 'reply':
      case 'mention':
      case 'clip_mention':
      case 'comment_mention':
        if (notification.clipId) {
          router.push(`/clip/${notification.clipId}` as any);
        } else if (notification.screenshotId) {
          router.push(`/screenshot/${notification.screenshotId}` as any);
        }
        break;
      case 'upload':
        if (notification.fromUser?.id || notification.fromUserId) {
          router.push(`/user/${notification.fromUser?.id || notification.fromUserId}` as any);
        }
        break;
    }
  }, [markRead, router]);

  const handleMarkAllRead = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    markAllRead();
  }, [markAllRead]);

  const handleClearAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearAll();
  }, [clearAll]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const renderItem = useCallback(({ item }: { item: Notification }) => {
    const { icon: IconComponent, color, bg } = getNotificationIcon(item.type);

    return (
      <TouchableOpacity
        style={[styles.item, !item.isRead && styles.itemUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
        testID={`notification-item-${item.id}`}
      >
        {!item.isRead && <View style={styles.unreadBar} />}

        <View style={[styles.iconWrap, { backgroundColor: bg }]}>
          <IconComponent size={20} color={color} />
        </View>

        <View style={styles.itemBody}>
          <View style={styles.itemTop}>
            {item.fromUser?.avatarUrl ? (
              <Image source={{ uri: item.fromUser.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>
                  {(item.fromUser?.username || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.itemMeta}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title || getNotificationTitle(item.type)}
              </Text>
              <Text style={styles.itemTime}>{getTimeAgo(item.createdAt)}</Text>
            </View>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                removeNotification(item.id);
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID={`dismiss-notification-${item.id}`}
            >
              <X size={15} color="#475569" />
            </TouchableOpacity>
          </View>
          <Text style={styles.itemMessage} numberOfLines={2}>
            {item.message}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleNotificationPress, removeNotification]);

  const ListEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Bell size={36} color="#334155" />
      </View>
      <Text style={styles.emptyTitle}>
        {isUnavailable ? 'Notifications unavailable' : 'All caught up'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {isUnavailable
          ? 'Please sign out and sign back in'
          : 'New likes, comments and follows will appear here'}
      </Text>
    </View>
  ), [isUnavailable]);

  return (
    <View style={styles.container}>
      <AppHeader showBackButton />

      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Text style={styles.screenTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        {notifications.length > 0 ? (
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleMarkAllRead}
              testID="button-mark-all-read"
            >
              <CheckCheck size={14} color="#4ADE80" />
              <Text style={styles.actionBtnTextGreen}>Mark read</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleClearAll}
              testID="button-clear-all"
            >
              <Trash2 size={14} color="#EF4444" />
              <Text style={styles.actionBtnTextRed}>Clear all</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        ListEmptyComponent={ListEmpty}
        onRefresh={fetchNotifications}
        refreshing={isLoading}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight, paddingBottom: insets.bottom + 16 },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C1821',
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
    backgroundColor: '#4ADE80',
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  actionBtnTextGreen: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnTextRed: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    flexGrow: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  itemUnread: {
    backgroundColor: 'rgba(74,222,128,0.04)',
  },
  unreadBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#4ADE80',
    borderRadius: 2,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemBody: {
    flex: 1,
    gap: 6,
  },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#4ADE80',
    fontSize: 11,
    fontWeight: '700',
  },
  itemMeta: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  itemTime: {
    color: '#64748B',
    fontSize: 11,
  },
  dismissBtn: {
    padding: 2,
  },
  itemMessage: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
  },
  separator: {
    height: 1,
    backgroundColor: '#1E293B',
    marginLeft: 76,
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
