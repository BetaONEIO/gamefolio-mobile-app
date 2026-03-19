import { useAuth } from '@/context/AuthContext';
import { useUser } from '@/context/UserContext';
import { useRevenueCat } from '@/context/RevenueCatContext';
import { api, getEffectiveAvatarUrl } from '@/lib/api';
import { DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import { useQuery } from '@tanstack/react-query';
import { useRouter, usePathname } from 'expo-router';
import { 
  X, 
  Flame, 
  Trophy, 
  MessageSquare, 
  User, 
  LogOut,
  Home,
  Leaf,
  ShoppingBag,
  Wallet,
  Layers,
  Settings,
  Plus,
  Crown,
  ArrowRight,
  Check
} from 'lucide-react-native';
import React, { useState, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image, Animated, LayoutChangeEvent, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AddGamesModal from '@/components/AddGamesModal';
import PaywallModal from '@/components/PaywallModal';
import ProBadge from '@/components/ProBadge';



type NavItemProps = {
  icon: React.ElementType;
  label: string;
  onPress: () => void;
  isActive?: boolean;
};

  const NavItem = ({ icon: Icon, label, onPress, isActive }: NavItemProps) => {
    const [isHovered, setIsHovered] = useState(false);
    
    return (
      <Pressable 
        style={[
          styles.navItem, 
          isActive && styles.navItemActive,
          isHovered && styles.navItemHovered
        ]} 
        onPress={onPress}
        onHoverIn={() => setIsHovered(true)}
        onHoverOut={() => setIsHovered(false)}
      >
        <View style={styles.navItemContent}>
          <Icon size={24} color="#4ADE80" strokeWidth={2} />
          <Text style={[styles.navItemLabel, isActive && styles.navItemLabelActive]}>
            {label}
          </Text>
        </View>
      </Pressable>
    );
  };

export default function CustomDrawerContent(props: DrawerContentComponentProps) {
  const { user, logout: authLogout, getAccessToken } = useAuth();
  const { favoriteGames, logout: userLogout } = useUser();
  const { isPro, logoutFromRevenueCat } = useRevenueCat();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const { data: selfProfile } = useQuery({
    queryKey: ['/api/users', user?.username, 'profile'],
    queryFn: async () => {
      if (!user?.username) return null;
      const token = await getAccessToken();
      return api.users.getProfile(user.username, token ?? undefined);
    },
    enabled: !!user?.username,
    staleTime: 5 * 60 * 1000,
  });

  const [contentHeight, setContentHeight] = useState(0);
  const [visibleHeight, setVisibleHeight] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showGamesModal, setShowGamesModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  const navigate = (path: string) => {
    router.push(path as any);
    props.navigation.closeDrawer();
  };

  const indicatorSize = visibleHeight > 0 && contentHeight > 0 && contentHeight > visibleHeight
    ? (visibleHeight / contentHeight) * visibleHeight
    : 0;
    
  const difference = visibleHeight > indicatorSize ? visibleHeight - indicatorSize : 1;
  
  const scrollRange = contentHeight > visibleHeight ? contentHeight - visibleHeight : 1;
  
  const scrollIndicatorPosition = Animated.multiply(
    scrollY,
    visibleHeight / (contentHeight || 1)
  ).interpolate({
    inputRange: [0, scrollRange],
    outputRange: [0, difference],
    extrapolate: 'clamp'
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
        <View style={{ width: 40 }} />
        <TouchableOpacity onPress={() => props.navigation.closeDrawer()} style={styles.closeButton}>
          <X size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* User Profile Section - At Top */}
      <View style={styles.topUserSection}>
        <TouchableOpacity 
          style={styles.userProfile}
          onPress={() => navigate('/(drawer)/(tabs)/profile')}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: getEffectiveAvatarUrl(selfProfile?.user) || getEffectiveAvatarUrl(user) || 'https://images.unsplash.com/photo-1642436855380-00dccba82294?w=400&auto=format&fit=crop&q=60' }}
              style={styles.avatar}
            />
          </View>
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName}>{user?.displayName || user?.username || 'User'}</Text>
              {isPro && <ProBadge size="small" style={styles.proBadge} />}
            </View>
            <Text style={styles.userHandle}>@{user?.username || 'user'}</Text>
          </View>
        </TouchableOpacity>

        {/* Level Progress Bar */}
        {(() => {
          const level = user?.level || 1;
          const totalXP = user?.totalXP || 0;
          const xpAtCurrentLevel = (level - 1) * 1000;
          const xpForNextLevel = 1000;
          const xpInLevel = Math.max(0, totalXP - xpAtCurrentLevel);
          const progressPercent = Math.min((xpInLevel / xpForNextLevel) * 100, 100);

          return (
            <View style={styles.levelContainer}>
              <View style={styles.levelHeader}>
                <Text style={styles.levelText}>Level {level}</Text>
                <Text style={styles.xpText}>{Math.round(xpInLevel)} / {Math.round(xpForNextLevel)} XP</Text>
              </View>
              <View style={styles.levelBarBackground}>
                <View 
                  style={[
                    styles.levelBarFill, 
                    { width: `${progressPercent}%` }
                  ]} 
                />
              </View>
            </View>
          );
        })()}

        {/* Pro Button or Pro Status */}
        {isPro ? (
          <TouchableOpacity 
            style={styles.proStatusContainer}
            onPress={() => navigate('/manage-subscription')}
            activeOpacity={0.8}
          >
            <View style={styles.proStatusBadge}>
              <Crown size={16} color="#10B981" strokeWidth={2.5} />
              <Text style={styles.proStatusText}>Pro Member</Text>
              <Check size={14} color="#10B981" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.proButton}
            onPress={() => setShowPaywallModal(true)}
            activeOpacity={0.8}
          >
            <Crown size={18} color="#A3E635" strokeWidth={2.5} />
            <Text style={styles.proButtonText}>Upgrade to Pro</Text>
            <ArrowRight size={16} color="#A3E635" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.divider} />

      <View style={{ flex: 1, position: 'relative' }}>
        <DrawerContentScrollView 
          {...props} 
          contentContainerStyle={styles.scrollContent}
          onLayout={(e: LayoutChangeEvent) => setVisibleHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(w: number, h: number) => setContentHeight(h)}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          
        {/* Main Navigation */}
        <View style={styles.section}>
          <NavItem 
            icon={Home}
            label="Home"
            onPress={() => navigate('/(drawer)/(tabs)/home')}
            isActive={pathname.includes('/home')}
          />
          <NavItem 
            icon={Leaf}
            label="Explore"
            onPress={() => navigate('/(drawer)/(tabs)/explore')}
            isActive={pathname.includes('/explore')}
          />
          <NavItem 
            icon={Flame}
            label="Trending"
            onPress={() => navigate('/(drawer)/(tabs)/trending')}
            isActive={pathname.includes('trending')}
          />
          <NavItem 
            icon={Trophy}
            label="Leaderboard"
            onPress={() => navigate('/(drawer)/(tabs)/leaderboard')}
            isActive={pathname.includes('leaderboard')}
          />
          <NavItem 
            icon={ShoppingBag}
            label="Store"
            onPress={() => navigate('/(drawer)/store')}
            isActive={pathname.includes('store')}
          />
          <NavItem 
            icon={Wallet}
            label="Wallet"
            onPress={() => navigate('/(drawer)/crypto/dashboard')}
            isActive={pathname.includes('crypto')}
          />
          <NavItem 
            icon={Layers}
            label="Collections"
            onPress={() => navigate('/(drawer)/collections')}
            isActive={pathname.includes('collections')}
          />
          <NavItem 
            icon={MessageSquare}
            label="Messages"
            onPress={() => navigate('/(drawer)/messages')} 
            isActive={pathname.includes('messages')} 
          />
          <NavItem 
            icon={User}
            label="My Gamefolio"
            onPress={() => navigate('/(drawer)/(tabs)/profile')}
            isActive={pathname.includes('profile')}
          />
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeaderText}>SETTINGS</Text>
          <NavItem 
            icon={Settings}
            label="Account Settings"
            onPress={() => navigate('/account-settings')}
            isActive={pathname.includes('account-settings')}
          />
          <NavItem 
            icon={User}
            label="Profile & Appearance"
            onPress={() => navigate('/profile-appearance')}
            isActive={pathname.includes('profile-appearance')}
          />
        </View>

        {/* Your Games Section */}
        <View style={styles.section}>
          <View style={styles.gamesHeaderRow}>
            <Text style={styles.sectionHeaderText}>YOUR GAMES</Text>
            <TouchableOpacity 
              style={styles.addGameButton}
              onPress={() => setShowGamesModal(true)}
            >
              <Plus size={16} color="#4ADE80" />
            </TouchableOpacity>
          </View>
          {favoriteGames.length > 0 ? (
            favoriteGames.map((game) => (
              <TouchableOpacity 
                key={game.id} 
                style={styles.gameItem}
                onPress={() => {}}
              >
                <Image 
                  source={{ uri: game.box_art_url.replace('{width}', '52').replace('{height}', '72') }}
                  style={styles.gameBoxArt}
                />
                <Text style={styles.gameName} numberOfLines={1}>{game.name}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <TouchableOpacity 
              style={styles.addGamesPrompt}
              onPress={() => setShowGamesModal(true)}
            >
              <Text style={styles.addGamesText}>Add your favorite games</Text>
            </TouchableOpacity>
          )}
        </View>

      </DrawerContentScrollView>
      
      {/* Custom Scrollbar */}
      {contentHeight > visibleHeight && (
        <View style={styles.scrollbarTrack}>
          <Animated.View 
            style={[
              styles.scrollbarThumb,
              {
                height: indicatorSize,
                transform: [{ translateY: scrollIndicatorPosition }]
              }
            ]}
          />
        </View>
      )}
      </View>

      {/* Logout Button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity style={styles.logoutButton} onPress={async () => {
          props.navigation.closeDrawer();
          await logoutFromRevenueCat();
          await authLogout();
          await userLogout();
          router.replace('/');
        }}>
            <LogOut size={20} color="#002E15" style={{ marginRight: 8 }} />
            <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <AddGamesModal 
        visible={showGamesModal} 
        onClose={() => setShowGamesModal(false)} 
      />

      <PaywallModal
        visible={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    width: '100%',
  },
  proButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4ADE80',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  proButtonText: {
    color: '#A3E635',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  topUserSection: {
    paddingTop: 8,
  },
  bottomSection: {
    paddingBottom: 8,
  },
  closeButton: {
    padding: 8,
  },
  scrollContent: {
    paddingTop: 10,
  },
  section: {
    marginBottom: 24,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 4,
    paddingHorizontal: 12, 
    height: 48,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#152C24', 
  },
  navItemHovered: {
    backgroundColor: '#152C24',
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navItemLabel: {
    color: '#FFF',
    fontSize: 16,
    marginLeft: 16,
    fontWeight: '500',
  },
  navItemLabelActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  scrollbarTrack: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollbarThumb: {
    width: 4,
    backgroundColor: '#4ADE80',
    borderRadius: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  logoutButton: {
    backgroundColor: '#4ADE80',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16, // Taller button
    borderRadius: 8,
    shadowColor: '#4ADE80',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutText: {
    color: '#002E15',
    fontWeight: 'bold',
    fontSize: 16,
  },
  sectionHeaderText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 8,
    marginTop: 0,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4ADE80',
    overflow: 'hidden',
    marginRight: 12,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  userInfo: {
    justifyContent: 'center',
  },
  userName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userHandle: {
    color: '#64748B',
    fontSize: 14,
  },
  levelContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelText: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '600',
  },
  xpText: {
    color: '#64748B',
    fontSize: 12,
  },
  levelBarBackground: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  levelBarFill: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: 3,
  },
  gamesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  addGameButton: {
    padding: 4,
  },
  gameItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  gameBoxArt: {
    width: 32,
    height: 44,
    borderRadius: 4,
    backgroundColor: '#1E293B',
  },
  gameName: {
    color: '#FFF',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  addGamesPrompt: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  addGamesText: {
    color: '#64748B',
    fontSize: 14,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  proBadge: {
    marginLeft: 6,
  },
  proStatusContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  proStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  proStatusText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '600' as const,
    flex: 1,
  },
});
