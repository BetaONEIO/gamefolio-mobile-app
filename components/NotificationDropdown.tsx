import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  Modal, 
  TouchableWithoutFeedback, 
  TouchableOpacity, 
  FlatList, 
  Animated,
  Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { UserPlus, X, Heart, Flame, MessagesSquare, MessageSquare } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface Notification {
  id: string;
  type: 'message' | 'follower' | 'like' | 'flame' | 'comment';
  user: {
    id?: string;
    name: string;
    avatar?: string;
    initial?: string;
  };
  title: string;
  description: string;
  time: string;
  isRead: boolean;
  contentId?: string;
  contentType?: 'clip' | 'screenshot';
  conversationId?: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'message',
    user: { id: 'user1', name: 'names21080', initial: 'N' },
    title: 'New Message',
    description: 'names21080 sent you a message: "Never mind I..."',
    time: '4d ago',
    isRead: false,
    conversationId: 'conv1',
  },
  {
    id: '2',
    type: 'flame',
    user: { id: 'user1', name: 'names21080', initial: 'N' },
    title: 'New Flame',
    description: 'names21080 reacted with a flame to your post',
    time: '4d ago',
    isRead: false,
    contentId: 'clip1',
    contentType: 'clip',
  },
  {
    id: '3',
    type: 'follower',
    user: { id: 'user1', name: 'names21080', initial: 'N' },
    title: 'New Follower',
    description: 'names21080 started following you',
    time: '4d ago',
    isRead: false,
  },
  {
    id: '4',
    type: 'like',
    user: { id: 'user2', name: 'user123', initial: 'U' },
    title: 'New Like',
    description: 'user123 liked your post',
    time: '5d ago',
    isRead: true,
    contentId: 'clip2',
    contentType: 'clip',
  },
  {
    id: '5',
    type: 'comment',
    user: { id: 'user3', name: 'admin', initial: 'A' },
    title: 'New Comment',
    description: 'admin commented on your post: "Great work!"',
    time: '1w ago',
    isRead: true,
    contentId: 'clip3',
    contentType: 'clip',
  },
];

interface NotificationDropdownProps {
  visible: boolean;
  onClose: () => void;
  topOffset: number;
  onOpen?: () => void;
}

export default function NotificationDropdown({ visible, onClose, topOffset, onOpen }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const router = useRouter();

  React.useEffect(() => {
    if (visible && onOpen) {
      onOpen();
    }
  }, [visible, onOpen]);
  
  // Custom scrollbar state
  const [contentHeight, setContentHeight] = useState(1);
  const [visibleHeight, setVisibleHeight] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  const indicatorSize = visibleHeight > 0 && contentHeight > 0 
    ? (visibleHeight / contentHeight) * visibleHeight 
    : 0;
    
  const indicatorPosition = scrollY.interpolate({
    inputRange: [0, Math.max(1, contentHeight - visibleHeight)],
    outputRange: [0, Math.max(0, visibleHeight - indicatorSize)],
    extrapolate: 'clamp',
  });

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificationPress = (notification: Notification) => {
    console.log('Notification clicked:', notification);
    
    if (!notification.isRead) {
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
      );
    }

    onClose();

    switch (notification.type) {
      case 'message':
        if (notification.conversationId) {
          router.push(`/conversation/${notification.conversationId}`);
        } else {
          router.push('/(drawer)/messages');
        }
        break;

      case 'follower':
        if (notification.user.id) {
          router.push(`/user/${notification.user.id}`);
        }
        break;

      case 'like':
      case 'flame':
      case 'comment':
        if (notification.contentId && notification.contentType === 'clip') {
          router.push(`/clip/${notification.contentId}`);
        }
        break;

      default:
        console.log('Unknown notification type:', notification.type);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={styles.itemContainer}
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.iconColumn}>
        {item.type === 'message' && <MessagesSquare size={20} color="#4ADE80" />}
        {item.type === 'follower' && <UserPlus size={20} color="#4ADE80" />}
        {item.type === 'like' && <Heart size={20} color="#EF4444" />}
        {item.type === 'flame' && <Flame size={20} color="#F97316" />}
        {item.type === 'comment' && <MessageSquare size={20} color="#4ADE80" />}
      </View>
      
      <View style={styles.contentColumn}>
        <View style={styles.headerRow}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.user.initial}</Text>
            </View>
            <Text style={styles.title}>{item.title}</Text>
          </View>
          <View style={styles.actionsRow}>
            {!item.isRead && <View style={styles.unreadDot} />}
            <TouchableOpacity 
              onPress={(e) => {
                e.stopPropagation();
                removeNotification(item.id);
              }}
            >
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
        
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <Text style={styles.time}>{item.time}</Text>
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
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
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
          
          <TouchableWithoutFeedback>
            <View style={[styles.dropdown, { top: topOffset }]}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={styles.headerActions}>
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
                    keyExtractor={item => item.id}
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
                        <Text style={styles.emptyText}>No notifications</Text>
                      </View>
                    }
                  />
                </View>
                
                {/* Custom Scrollbar */}
                {notifications.length > 0 && contentHeight > visibleHeight && (
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
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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
    width: 320,
    maxHeight: 400,
    backgroundColor: '#0F1520',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    // Shadow
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.30,
    shadowRadius: 4.65,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F1520',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionTextGreen: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },
  actionTextRed: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '600',
  },
  contentContainer: {
    height: 300, // Fixed height for scrolling
    flexDirection: 'row',
  },
  listContent: {
    paddingBottom: 16,
  },
  itemContainer: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  iconColumn: {
    marginRight: 12,
    paddingTop: 2,
  },
  contentColumn: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  avatarText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: 'bold',
  },
  title: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  description: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 18,
  },
  time: {
    color: '#64748B',
    fontSize: 11,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
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
