import React, { useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Modal, 
  Pressable, 
  TouchableOpacity, 
  FlatList, 
  Animated,
  Platform,
  Image
} from 'react-native';
import { BlurView } from 'expo-blur';
import { UserPlus, X, Heart, Flame, MessagesSquare, MessageSquare, AtSign } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useNotifications } from '@/context/NotificationsContext';
import { Notification } from '@/lib/api';

interface NotificationDropdownProps {
  visible: boolean;
  onClose: () => void;
  topOffset: number;
  onOpen?: () => void;
}

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

function getNotificationTitle(type: Notification['type']): string {
  switch (type) {
    case 'like': return 'New Like';
    case 'flame':
    case 'fire': return 'New Flame';
    case 'comment':
    case 'reply': return 'New Comment';
    case 'follow':
    case 'follower': return 'New Follower';
    case 'message': return 'New Message';
    case 'mention':
    case 'clip_mention':
    case 'comment_mention': return 'Mention';
    case 'upload': return 'New Upload';
    default: return 'Notification';
  }
}

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'message': return <MessagesSquare size={20} color="#4ADE80" />;
    case 'follow':
    case 'follower': return <UserPlus size={20} color="#4ADE80" />;
    case 'like': return <Heart size={20} color="#EF4444" />;
    case 'flame':
    case 'fire': return <Flame size={20} color="#F97316" />;
    case 'comment':
    case 'reply': return <MessageSquare size={20} color="#4ADE80" />;
    case 'mention':
    case 'clip_mention':
    case 'comment_mention': return <AtSign size={20} color="#818CF8" />;
    case 'upload': return <Heart size={20} color="#4ADE80" />;
    default: return <Heart size={20} color="#4ADE80" />;
  }
}

export default function NotificationDropdown({ visible, onClose, topOffset, onOpen }: NotificationDropdownProps) {
  const { notifications, isUnavailable, markAllRead, clearAll, removeNotification, markRead } = useNotifications();
  const router = useRouter();

  React.useEffect(() => {
    if (visible && onOpen) {
      onOpen();
    }
  }, [visible, onOpen]);
  
  const [contentHeight, setContentHeight] = React.useState(1);
  const [visibleHeight, setVisibleHeight] = React.useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  const indicatorSize = visibleHeight > 0 && contentHeight > 0 
    ? (visibleHeight / contentHeight) * visibleHeight 
    : 0;
    
  const indicatorPosition = scrollY.interpolate({
    inputRange: [0, Math.max(1, contentHeight - visibleHeight)],
    outputRange: [0, Math.max(0, visibleHeight - indicatorSize)],
    extrapolate: 'clamp',
  });

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.isRead) {
      markRead(notification.id);
    }

    onClose();

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
          router.push(`/user/${notification.fromUser?.id || notification.fromUserId}`);
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
          router.push(`/clip/${notification.clipId}`);
        } else if (notification.screenshotId) {
          router.push(`/screenshot/${notification.screenshotId}`);
        }
        break;

      case 'upload':
        if (notification.fromUser?.id || notification.fromUserId) {
          router.push(`/user/${notification.fromUser?.id || notification.fromUserId}`);
        }
        break;
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={styles.itemContainer}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconColumn}>
        {getNotificationIcon(item.type)}
      </View>
      
      <View style={styles.contentColumn}>
        <View style={styles.headerRow}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              {item.fromUser?.avatarUrl ? (
                <Image 
                  source={{ uri: item.fromUser.avatarUrl }} 
                  style={styles.avatarImage} 
                />
              ) : (
                <Text style={styles.avatarText}>
                  {(item.fromUser?.username || '?')[0].toUpperCase()}
                </Text>
              )}
            </View>
            <Text style={styles.title}>{item.title || getNotificationTitle(item.type)}</Text>
          </View>
          <View style={styles.actionsRow}>
            {!item.isRead ? <View style={styles.unreadDot} /> : null}
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                removeNotification(item.id);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.dismissButton}
            >
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.description} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={styles.time}>{getTimeAgo(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        {Platform.OS !== 'web' ? (
          <BlurView 
            intensity={80} 
            tint="dark" 
            style={StyleSheet.absoluteFill}
          >
            <View style={styles.darkOverlay} />
          </BlurView>
        ) : (
          <View style={styles.webBlurFallback} />
        )}
        
        <Pressable style={[styles.dropdown, { top: topOffset }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => { onClose(); router.push('/(drawer)/notifications' as any); }}>
                <Text style={styles.actionTextBlue}>See All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={markAllRead}>
                <Text style={styles.actionTextGreen}>Mark Read</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={clearAll}>
                <Text style={styles.actionTextRed}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.contentContainer}>
            <View style={{ flex: 1 }}>
              <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={item => item.id.toString()}
                showsVerticalScrollIndicator={false}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                  { useNativeDriver: false }
                )}
                onContentSizeChange={(_, height) => setContentHeight(height)}
                onLayout={(e) => setVisibleHeight(e.nativeEvent.layout.height)}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                      {isUnavailable ? 'Notifications unavailable' : 'No notifications'}
                    </Text>
                    {isUnavailable ? (
                      <Text style={styles.emptySubText}>Please sign out and sign back in</Text>
                    ) : null}
                  </View>
                }
              />
            </View>
            
            {notifications.length > 0 && contentHeight > visibleHeight ? (
              <View style={styles.scrollbarTrack}>
                <Animated.View 
                  style={[
                    styles.scrollbarThumb,
                    {
                      height: indicatorSize,
                      transform: [{ translateY: indicatorPosition }]
                    }
                  ]} 
                />
              </View>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  webBlurFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 20, 0.95)',
    backdropFilter: 'blur(30px)',
  },
  dropdown: {
    position: 'absolute',
    right: 20,
    width: 340,
    maxHeight: 500,
    backgroundColor: '#131F2A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#131F2A',
    gap: 12,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 14,
    flexShrink: 0,
  },
  actionTextBlue: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  actionTextGreen: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600',
  },
  actionTextRed: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  contentContainer: {
    height: 400,
    flexDirection: 'row',
  },
  listContent: {
    paddingBottom: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  iconColumn: {
    marginRight: 14,
    paddingTop: 2,
  },
  contentColumn: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  avatarText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#4ADE80',
  },
  dismissButton: {
    padding: 2,
  },
  description: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 20,
  },
  time: {
    color: '#64748B',
    fontSize: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
  emptySubText: {
    color: '#475569',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  scrollbarTrack: {
    width: 6,
    backgroundColor: 'transparent',
    height: '100%',
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  scrollbarThumb: {
    width: 6,
    backgroundColor: '#4ADE80',
    borderRadius: 3,
  },
});
