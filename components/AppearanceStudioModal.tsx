import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  User,
  Palette,
  Image as ImageIcon,
  Crown,
  Award,
  Sparkles,
  Camera,
  Save,
  Check,
  ChevronRight,
  Wallet,
  Type,
  Shield,
  Zap,
  Star,
  Flame,
  Heart,
  Rocket,
  Skull,
  Target,
  Hexagon,
  Atom,
  Infinity,
  Gem,
  Swords,
  Medal,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { trpc } from '@/lib/trpc';
import {
  TetrisTheme,
  PacmanTheme,
  MatrixTheme,
  RetroArcadeTheme,
  SpaceInvadersTheme,
  PixelStarsTheme,
  NeonCityTheme,
  SnakeTheme,
  BreakoutTheme,
  GalaxianTheme,
  CyberpunkGridTheme,
  PongTheme,
} from '@/components/AnimatedThemes';
import ImageEditorModal from '@/components/ImageEditorModal';
import ProfileBorderModal, { AvatarBorder } from '@/components/ProfileBorderModal';
import CustomAlert from '@/components/CustomAlert';
import StyledUsername, { FONT_STYLES, EFFECT_STYLES, TextStyleConfig } from '@/components/StyledUsername';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type SectionType = 'overview' | 'profile' | 'banner' | 'themes' | 'border' | 'badges' | 'nfts' | 'textstyle' | 'displayname';

interface AppearanceStudioModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const QUICK_THEMES = [
  { id: 'basic', name: 'Basic', accentColor: '#4ADE80', backgroundColor: '#0F1520' },
  { id: 'purple_night', name: 'Purple Night', accentColor: '#A855F7', backgroundColor: '#1E1B4B' },
  { id: 'golden_yellow', name: 'Golden Yellow', accentColor: '#FACC15', backgroundColor: '#451A03' },
  { id: 'rose_gold', name: 'Rose Gold', accentColor: '#F472B6', backgroundColor: '#4C0519' },
  { id: 'sunset_orange', name: 'Sunset Orange', accentColor: '#FB923C', backgroundColor: '#431407' },
  { id: 'arctic_blue', name: 'Arctic Blue', accentColor: '#38BDF8', backgroundColor: '#0C4A6E' },
  { id: 'midnight_black', name: 'Midnight Black', accentColor: '#FFFFFF', backgroundColor: '#000000' },
  { id: 'white', name: 'White', accentColor: '#FFFFFF', backgroundColor: '#FFFFFF' },
  { id: 'baby_pink', name: 'Baby Pink', accentColor: '#F9A8D4', backgroundColor: '#E0218A' },
];

const PREMIUM_THEMES = [
  { id: 'tetris', name: 'Tetris', type: 'tetris' },
  { id: 'pacman', name: 'Pac-Man', type: 'pacman' },
  { id: 'matrix', name: 'Matrix Rain', type: 'matrix' },
  { id: 'retro_arcade', name: 'Retro Arcade', type: 'retro_arcade' },
  { id: 'space_invaders', name: 'Space Invaders', type: 'space_invaders' },
  { id: 'pixel_stars', name: 'Pixel Stars', type: 'pixel_stars' },
  { id: 'neon_city', name: 'Neon City', type: 'neon_city' },
  { id: 'snake', name: 'Snake Game', type: 'snake' },
  { id: 'breakout', name: 'Breakout', type: 'breakout' },
  { id: 'galaxian', name: 'Galaxian', type: 'galaxian' },
  { id: 'cyberpunk_grid', name: 'Cyberpunk Grid', type: 'cyberpunk_grid' },
  { id: 'pong', name: 'Pong', type: 'pong' },
];

const VERIFICATION_BADGES = [
  { id: 'none', name: 'None', icon: 'none', color: '#64748B', unlocked: true },
  { id: 'pro', name: 'Gamefolio Pro', icon: 'check', color: '#4ADE80', unlocked: true },
  { id: 'verified_blue', name: 'Verified Blue', icon: 'check', color: '#3B82F6', unlocked: false },
  { id: 'gold_star', name: 'Gold Star', icon: 'star', color: '#FFD700', unlocked: false },
  { id: 'diamond', name: 'Diamond', icon: 'diamond', color: '#60A5FA', unlocked: false },
  { id: 'fire', name: 'Fire', icon: 'flame', color: '#F97316', unlocked: false },
  { id: 'lightning', name: 'Lightning', icon: 'zap', color: '#FACC15', unlocked: false },
  { id: 'crown_gold', name: 'Gold Crown', icon: 'crown', color: '#FFD700', unlocked: false },
  { id: 'crown_purple', name: 'Purple Crown', icon: 'crown', color: '#A855F7', unlocked: false },
  { id: 'shield', name: 'Shield', icon: 'shield', color: '#10B981', unlocked: false },
  { id: 'trophy', name: 'Trophy', icon: 'award', color: '#F59E0B', unlocked: false },
  { id: 'gem', name: 'Gem', icon: 'gem', color: '#EC4899', unlocked: false },
  { id: 'heart', name: 'Heart', icon: 'heart', color: '#EF4444', unlocked: false },
  { id: 'rocket', name: 'Rocket', icon: 'rocket', color: '#8B5CF6', unlocked: false },
  { id: 'sword', name: 'Sword', icon: 'sword', color: '#6B7280', unlocked: false },
  { id: 'skull', name: 'Skull', icon: 'skull', color: '#EF4444', unlocked: false },
  { id: 'target', name: 'Target', icon: 'target', color: '#EF4444', unlocked: false },
  { id: 'medal', name: 'Medal', icon: 'medal', color: '#F59E0B', unlocked: false },
  { id: 'star_rainbow', name: 'Rainbow Star', icon: 'star', color: '#EC4899', unlocked: false },
  { id: 'hexagon', name: 'Hexagon', icon: 'hexagon', color: '#06B6D4', unlocked: false },
  { id: 'atom', name: 'Atom', icon: 'atom', color: '#8B5CF6', unlocked: false },
  { id: 'infinity', name: 'Infinity', icon: 'infinity', color: '#3B82F6', unlocked: false },
];

const SAMPLE_BANNERS = [
  { id: 'gradient_sunset', name: 'Sunset', colors: ['#FF6B6B', '#FFD93D'], type: 'gradient' as const },
  { id: 'gradient_ocean', name: 'Ocean', colors: ['#667EEA', '#764BA2'], type: 'gradient' as const },
  { id: 'gradient_forest', name: 'Forest', colors: ['#11998E', '#38EF7D'], type: 'gradient' as const },
  { id: 'gradient_fire', name: 'Fire', colors: ['#F2994A', '#F2C94C'], type: 'gradient' as const },
  { id: 'gradient_purple', name: 'Purple Haze', colors: ['#A770EF', '#CF8BF3', '#FDB99B'], type: 'gradient' as const },
  { id: 'gradient_pink', name: 'Pink Dream', colors: ['#FF9A9E', '#FAD0C4'], type: 'gradient' as const },
  { id: 'gradient_mint', name: 'Mint', colors: ['#A8EDEA', '#FED6E3'], type: 'gradient' as const },
  { id: 'gradient_peach', name: 'Peach', colors: ['#FFECD2', '#FCB69F'], type: 'gradient' as const },
  { id: 'gradient_blue', name: 'Blue Sky', colors: ['#00C9FF', '#92FE9D'], type: 'gradient' as const },
  { id: 'gradient_dark', name: 'Dark Matter', colors: ['#000428', '#004E92'], type: 'gradient' as const },
  { id: 'gradient_cosmic', name: 'Cosmic', colors: ['#8E2DE2', '#4A00E0'], type: 'gradient' as const },
  { id: 'gradient_cherry', name: 'Cherry', colors: ['#EB3349', '#F45C43'], type: 'gradient' as const },
  { id: 'gradient_lemon', name: 'Lemon', colors: ['#F4D03F', '#16A085'], type: 'gradient' as const },
  { id: 'gradient_neon', name: 'Neon', colors: ['#00F260', '#0575E6'], type: 'gradient' as const },
  { id: 'gradient_royal', name: 'Royal', colors: ['#141E30', '#243B55'], type: 'gradient' as const },
  { id: 'gradient_candy', name: 'Candy', colors: ['#FC466B', '#3F5EFB'], type: 'gradient' as const },
  { id: 'gradient_emerald', name: 'Emerald', colors: ['#56AB2F', '#A8E063'], type: 'gradient' as const },
  { id: 'gradient_crimson', name: 'Crimson', colors: ['#C33764', '#1D2671'], type: 'gradient' as const },
  { id: 'gradient_gold', name: 'Gold', colors: ['#FFD700', '#FFA500'], type: 'gradient' as const },
  { id: 'gradient_arctic', name: 'Arctic', colors: ['#00D2FF', '#3A7BD5'], type: 'gradient' as const },
];

const BACKGROUND_IMAGES = [
  { id: 'none', name: 'None', url: null },
  { id: 'red_gradient', name: 'Red Gradient', url: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/1t9b8zgw24bk9gmeghgni' },
  { id: 'blue_gradient', name: 'Blue Gradient', url: 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=800&q=80' },
  { id: 'purple_gradient', name: 'Purple Gradient', url: 'https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=800&q=80' },
  { id: 'green_gradient', name: 'Green Gradient', url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=800&q=80' },
  { id: 'orange_gradient', name: 'Orange Gradient', url: 'https://images.unsplash.com/photo-1557682260-96773eb01377?w=800&q=80' },
  { id: 'pink_gradient', name: 'Pink Gradient', url: 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=800&q=80' },
  { id: 'teal_gradient', name: 'Teal Gradient', url: 'https://images.unsplash.com/photo-1557682233-43e671455eaa?w=800&q=80' },
  { id: 'dark_space', name: 'Dark Space', url: 'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=800&q=80' },
  { id: 'nebula', name: 'Nebula', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=800&q=80' },
  { id: 'galaxy', name: 'Galaxy', url: 'https://images.unsplash.com/photo-1502134249126-9f3755a50d78?w=800&q=80' },
  { id: 'aurora', name: 'Aurora', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=800&q=80' },
  { id: 'abstract_1', name: 'Abstract 1', url: 'https://images.unsplash.com/photo-1550859492-d5da9d8e45f3?w=800&q=80' },
  { id: 'abstract_2', name: 'Abstract 2', url: 'https://images.unsplash.com/photo-1550537687-c91072c4792d?w=800&q=80' },
  { id: 'abstract_3', name: 'Abstract 3', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80' },
  { id: 'cyberpunk', name: 'Cyberpunk', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80' },
  { id: 'neon_lights', name: 'Neon Lights', url: 'https://images.unsplash.com/photo-1496096265110-f83ad7f96608?w=800&q=80' },
  { id: 'geometric', name: 'Geometric', url: 'https://images.unsplash.com/photo-1551269901-5c5e14c25df7?w=800&q=80' },
  { id: 'particles', name: 'Particles', url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80' },
  { id: 'waves', name: 'Waves', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80' },
  { id: 'marble', name: 'Marble', url: 'https://images.unsplash.com/photo-1511149755252-35875b273fd6?w=800&q=80' },
  { id: 'bokeh', name: 'Bokeh', url: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&q=80' },
];

const SAMPLE_BORDERS: AvatarBorder[] = [
  { id: 10001, name: 'Default', imageUrl: 'https://i.imgur.com/placeholder1.png', rarity: 'common', unlocked: true },
  { id: 10002, name: 'Cloud Border', imageUrl: 'https://i.imgur.com/placeholder2.png', rarity: 'rare', unlocked: false },
  { id: 10003, name: 'Fire Ring', imageUrl: 'https://i.imgur.com/placeholder3.png', rarity: 'epic', unlocked: false },
  { id: 10004, name: 'Ice Frame', imageUrl: 'https://i.imgur.com/placeholder4.png', rarity: 'rare', unlocked: false },
  { id: 10005, name: 'Lightning', imageUrl: 'https://i.imgur.com/placeholder5.png', rarity: 'epic', unlocked: false },
  { id: 10006, name: 'Golden Glow', imageUrl: 'https://i.imgur.com/placeholder6.png', rarity: 'legendary', unlocked: false },
  { id: 10007, name: 'Neon Pulse', imageUrl: 'https://i.imgur.com/placeholder7.png', rarity: 'epic', unlocked: false },
  { id: 10008, name: 'Crystal', imageUrl: 'https://i.imgur.com/placeholder8.png', rarity: 'rare', unlocked: false },
  { id: 10009, name: 'Shadow Edge', imageUrl: 'https://i.imgur.com/placeholder9.png', rarity: 'common', unlocked: false },
  { id: 10010, name: 'Rainbow Arc', imageUrl: 'https://i.imgur.com/placeholder10.png', rarity: 'legendary', unlocked: false },
  { id: 10011, name: 'Hex Frame', imageUrl: 'https://i.imgur.com/placeholder11.png', rarity: 'rare', unlocked: false },
  { id: 10012, name: 'Pixel Border', imageUrl: 'https://i.imgur.com/placeholder12.png', rarity: 'common', unlocked: false },
  { id: 10013, name: 'Star Halo', imageUrl: 'https://i.imgur.com/placeholder13.png', rarity: 'epic', unlocked: false },
  { id: 10014, name: 'Flame Circle', imageUrl: 'https://i.imgur.com/placeholder14.png', rarity: 'legendary', unlocked: false },
  { id: 10015, name: 'Cyber Ring', imageUrl: 'https://i.imgur.com/placeholder15.png', rarity: 'epic', unlocked: false },
  { id: 10016, name: 'Galaxy Swirl', imageUrl: 'https://i.imgur.com/placeholder16.png', rarity: 'legendary', unlocked: false },
  { id: 10017, name: 'Jade Frame', imageUrl: 'https://i.imgur.com/placeholder17.png', rarity: 'rare', unlocked: false },
  { id: 10018, name: 'Atomic Glow', imageUrl: 'https://i.imgur.com/placeholder18.png', rarity: 'epic', unlocked: false },
  { id: 10019, name: 'Diamond Edge', imageUrl: 'https://i.imgur.com/placeholder19.png', rarity: 'legendary', unlocked: false },
  { id: 10020, name: 'Poison Ivy', imageUrl: 'https://i.imgur.com/placeholder20.png', rarity: 'rare', unlocked: false },
  { id: 10021, name: 'Storm Border', imageUrl: 'https://i.imgur.com/placeholder21.png', rarity: 'epic', unlocked: false },
  { id: 10022, name: 'Rose Gold', imageUrl: 'https://i.imgur.com/placeholder22.png', rarity: 'legendary', unlocked: false },
];

const MENU_ITEMS: { id: SectionType; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'overview', label: 'Overview', icon: <Sparkles size={20} color="#FFF" />, color: '#4ADE80' },
  { id: 'profile', label: 'Profile Picture', icon: <User size={20} color="#FFF" />, color: '#3B82F6' },
  { id: 'banner', label: 'Banner', icon: <ImageIcon size={20} color="#FFF" />, color: '#8B5CF6' },
  { id: 'themes', label: 'Themes', icon: <Palette size={20} color="#FFF" />, color: '#F472B6' },
  { id: 'textstyle', label: 'Text Style', icon: <Type size={20} color="#FFF" />, color: '#EF4444' },
  { id: 'badges', label: 'Badges & Ticks', icon: <Award size={20} color="#FFF" />, color: '#FB923C' },
  { id: 'nfts', label: 'NFT Gallery', icon: <Wallet size={20} color="#FFF" />, color: '#06B6D4' },
];

function AnimatedThemePreview({ theme }: { theme: typeof PREMIUM_THEMES[0] }) {
  const renderAnimation = () => {
    switch (theme.type) {
      case 'tetris': return <TetrisTheme />;
      case 'pacman': return <PacmanTheme />;
      case 'matrix': return <MatrixTheme />;
      case 'retro_arcade': return <RetroArcadeTheme />;
      case 'space_invaders': return <SpaceInvadersTheme />;
      case 'pixel_stars': return <PixelStarsTheme />;
      case 'neon_city': return <NeonCityTheme />;
      case 'snake': return <SnakeTheme />;
      case 'breakout': return <BreakoutTheme />;
      case 'galaxian': return <GalaxianTheme />;
      case 'cyberpunk_grid': return <CyberpunkGridTheme />;
      case 'pong': return <PongTheme />;
      default: return null;
    }
  };

  return (
    <View style={styles.animatedThemePreview}>
      {renderAnimation()}
    </View>
  );
}

export default function AppearanceStudioModal({ visible, onClose, onSaved }: AppearanceStudioModalProps) {
  const { user, updateUser, getAccessToken } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionType>('overview');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatarUrl || null);
  const [banner, setBanner] = useState(user?.bannerUrl || null);
  const [selectedThemeId, setSelectedThemeId] = useState<string>('basic');
  const [selectedBorder, setSelectedBorder] = useState<AvatarBorder | null>(null);
  const [displayNameColor, setDisplayNameColor] = useState<string>('#FFFFFF');
  const [selectedTextStyleId, setSelectedTextStyleId] = useState<string>('default');
  
  const [selectedFontId, setSelectedFontId] = useState<string>('default');
  const [selectedEffectId, setSelectedEffectId] = useState<string>('none');
  const [textCustomColor, setTextCustomColor] = useState<string>('#FFFFFF');
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const menuScrollViewRef = React.useRef<ScrollView>(null);
  const mainScrollViewRef = React.useRef<ScrollView>(null);
  const [textStyleTab, setTextStyleTab] = useState<'font' | 'effect' | 'color'>('font');
  const [selectedVerificationBadge, setSelectedVerificationBadge] = useState<string>('none');
  const [selectedBackgroundImage, setSelectedBackgroundImage] = useState<string | null>(null);
  

  const [editorVisible, setEditorVisible] = useState(false);
  const [tempImageUri, setTempImageUri] = useState<string | null>(null);
  const [tempImageDimensions, setTempImageDimensions] = useState<{ width: number; height: number } | undefined>();
  const [editingType, setEditingType] = useState<'avatar' | 'banner'>('avatar');

  const [borderModalVisible, setBorderModalVisible] = useState(false);
  const [profilePictureTab, setProfilePictureTab] = useState<'uploaded' | 'nft' | 'border'>('uploaded');
  const [bannerTab, setBannerTab] = useState<'uploaded' | 'store'>('uploaded');
  const [selectedSampleBannerId, setSelectedSampleBannerId] = useState<string | null>(null);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState<'error' | 'success' | 'info'>('error');

  const { data: avatarBordersData } = trpc.user.getAvatarBorders.useQuery();

  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
  };

  useEffect(() => {
    if (user && visible) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setAvatar(user.avatarUrl || null);
      setBanner(user.bannerUrl || null);

      const theme = QUICK_THEMES.find(t => t.accentColor === user.accentColor && t.backgroundColor === user.backgroundColor);
      setSelectedThemeId(theme ? theme.id : 'basic');

      if (avatarBordersData?.selectedBorderId) {
        const border = avatarBordersData.borders.find((b: AvatarBorder) => b.id === avatarBordersData.selectedBorderId);
        setSelectedBorder(border || null);
      }

      setDisplayNameColor(user.displayNameColor || '#FFFFFF');
      setSelectedTextStyleId((user as any).textStyleId || 'default');
      
      const savedFontId = (user as any).textFontId || 'default';
      const savedEffectId = (user as any).textEffectId || 'none';
      const savedTextColor = (user as any).textCustomColor || '#FFFFFF';
      setSelectedFontId(savedFontId);
      setSelectedEffectId(savedEffectId);
      setTextCustomColor(savedTextColor);
      
      const savedVerificationBadge = (user as any).verificationBadgeId || 'none';
      setSelectedVerificationBadge(savedVerificationBadge);
      
      const savedBackgroundImage = (user as any).backgroundImageUrl || null;
      setSelectedBackgroundImage(savedBackgroundImage);
    }
  }, [user, visible, avatarBordersData]);

  useEffect(() => {
    if (activeSection !== 'overview') {
      mainScrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, [activeSection]);



  const currentTheme = QUICK_THEMES.find(t => t.id === selectedThemeId);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return '#94A3B8';
      case 'rare': return '#3B82F6';
      case 'epic': return '#A855F7';
      case 'legendary': return '#FFD700';
      default: return '#94A3B8';
    }
  };

  const isDirty =
    (displayName !== (user?.displayName || '')) ||
    (bio !== (user?.bio || '')) ||
    (avatar !== (user?.avatarUrl || null)) ||
    (banner !== (user?.bannerUrl || null)) ||
    (currentTheme && (currentTheme.accentColor !== (user?.accentColor || QUICK_THEMES[0].accentColor) ||
      currentTheme.backgroundColor !== (user?.backgroundColor || QUICK_THEMES[0].backgroundColor))) ||
    (selectedBorder?.id !== avatarBordersData?.selectedBorderId) ||
    (displayNameColor !== (user?.displayNameColor || '#FFFFFF')) ||
    (selectedTextStyleId !== ((user as any)?.textStyleId || 'default')) ||
    (selectedFontId !== ((user as any)?.textFontId || 'default')) ||
    (selectedEffectId !== ((user as any)?.textEffectId || 'none')) ||
    (textCustomColor !== ((user as any)?.textCustomColor || '#FFFFFF')) ||
    (selectedVerificationBadge !== ((user as any)?.verificationBadgeId || 'none')) ||
    (selectedBackgroundImage !== ((user as any)?.backgroundImageUrl || null));

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled) {
        setTempImageUri(result.assets[0].uri);
        setTempImageDimensions({
          width: result.assets[0].width,
          height: result.assets[0].height,
        });
        setEditingType('avatar');
        setEditorVisible(true);
      }
    } catch (error) {
      showAlert('Error', 'Failed to pick image', 'error');
      console.error(error);
    }
  };

  const pickBanner = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled) {
        const assetUri = result.assets[0].uri;
        const isGif = assetUri.toLowerCase().endsWith('.gif');

        if (isGif && !user?.isPro) {
          showAlert(
            'Gamefolio Pro Required',
            'GIF banners are exclusive to Gamefolio Pro users.',
            'info'
          );
          return;
        }

        if (isGif) {
          setBanner(assetUri);
        } else {
          setTempImageUri(assetUri);
          setTempImageDimensions({
            width: result.assets[0].width,
            height: result.assets[0].height,
          });
          setEditingType('banner');
          setEditorVisible(true);
        }
      }
    } catch (error) {
      showAlert('Error', 'Failed to pick banner', 'error');
      console.error(error);
    }
  };

  const handleEditorSave = (uri: string) => {
    if (editingType === 'avatar') {
      setAvatar(uri);
    } else {
      setBanner(uri);
    }
    setEditorVisible(false);
    setTempImageUri(null);
    setTempImageDimensions(undefined);
  };

  const handleSave = async () => {
    if (!user) {
      showAlert('Error', 'You must be logged in to save changes', 'error');
      return;
    }

    try {
      setIsSaving(true);
      const token = await getAccessToken();
      if (!token) {
        showAlert('Error', 'Session expired. Please log in again.', 'error');
        return;
      }

      const theme = QUICK_THEMES.find(t => t.id === selectedThemeId);

      const updateData = {
        displayName,
        bio,
        avatarUrl: avatar || undefined,
        bannerUrl: banner || undefined,
        accentColor: theme?.accentColor,
        backgroundColor: theme?.backgroundColor,
        displayNameColor,
        textStyleId: selectedTextStyleId,
        textFontId: selectedFontId,
        textEffectId: selectedEffectId,
        textCustomColor: textCustomColor,
        profileBorderId: selectedBorder?.id || null,
        verificationBadgeId: selectedVerificationBadge,
        backgroundImageUrl: selectedBackgroundImage || undefined,
      };

      const response = await api.users.updateProfile(user?.id || 0, updateData, token);

      if (response && response.user) {
        updateUser(response.user);
        setIsSaved(true);
        onSaved?.();
        setTimeout(() => setIsSaved(false), 2000);
      }
    } catch (error: any) {
      console.error('[AppearanceStudio] Failed to save:', error);
      showAlert('Error', error?.message || 'Failed to save changes', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const renderOverview = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>Profile Studio</Text>
      <Text style={styles.sectionSubtitle}>Customize your Gamefolio presence</Text>

      <View style={styles.previewCard}>
        <View style={[styles.previewBanner, { backgroundColor: currentTheme?.backgroundColor || '#0F1520' }]}>
          {banner ? (
            <Image source={{ uri: banner }} style={styles.previewBannerImage} />
          ) : (
            <LinearGradient
              colors={['#334155', '#1E293B']}
              style={styles.previewBannerPlaceholder}
            />
          )}
        </View>
        <View style={[styles.previewContent, { backgroundColor: currentTheme?.backgroundColor || '#0F1520' }]}>
          <View style={styles.previewAvatarWrapper}>
            <View style={[styles.previewAvatar, { borderColor: currentTheme?.backgroundColor || '#0F1520' }]}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.previewAvatarImage} />
              ) : (
                <View style={styles.previewAvatarPlaceholder}>
                  <User size={24} color="#64748B" />
                </View>
              )}
            </View>
            {selectedBorder?.imageUrl && (
              <Image source={{ uri: selectedBorder.imageUrl }} style={styles.previewBorderOverlay} />
            )}
          </View>
          <Text style={[styles.previewName, { color: displayNameColor }]}>{displayName || user?.username || 'Your Name'}</Text>
          <Text style={styles.previewHandle}>@{user?.username || 'username'}</Text>
          <TouchableOpacity style={[styles.previewButton, { backgroundColor: currentTheme?.accentColor || '#4ADE80' }]}>
            <Text style={[styles.previewButtonText, { color: currentTheme?.accentColor === '#FFFFFF' ? '#000' : '#FFF' }]}>
              Follow
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.quickActionsTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          {MENU_ITEMS.slice(1, 5).map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.quickActionItem, { borderColor: item.color }]}
              onPress={() => setActiveSection(item.id)}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: item.color }]}>
                {item.icon}
              </View>
              <Text style={styles.quickActionLabel}>{item.label}</Text>
              <ChevronRight size={16} color="#64748B" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderProfilePicture = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>Profile Picture</Text>
      <Text style={styles.sectionSubtitle}>Upload or select from your NFTs</Text>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, profilePictureTab === 'uploaded' && styles.tabButtonActive]}
          onPress={() => setProfilePictureTab('uploaded')}
        >
          <ImageIcon size={16} color={profilePictureTab === 'uploaded' ? '#FFF' : '#94A3B8'} />
          <Text style={[styles.tabButtonText, profilePictureTab === 'uploaded' && styles.tabButtonTextActive]}>
            Image
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, profilePictureTab === 'nft' && styles.tabButtonActive]}
          onPress={() => setProfilePictureTab('nft')}
        >
          <Wallet size={16} color={profilePictureTab === 'nft' ? '#FFF' : '#94A3B8'} />
          <Text style={[styles.tabButtonText, profilePictureTab === 'nft' && styles.tabButtonTextActive]}>
            NFT
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, profilePictureTab === 'border' && styles.tabButtonActive]}
          onPress={() => setProfilePictureTab('border')}
        >
          <Crown size={16} color={profilePictureTab === 'border' ? '#FFF' : '#94A3B8'} />
          <Text style={[styles.tabButtonText, profilePictureTab === 'border' && styles.tabButtonTextActive]}>
            Border
          </Text>
        </TouchableOpacity>
      </View>

      {profilePictureTab === 'uploaded' && (
        <View style={styles.profileImageSection}>
          <View style={styles.largeAvatarContainer}>
            {selectedBorder?.imageUrl && (
              <Image source={{ uri: selectedBorder.imageUrl }} style={styles.largeAvatarBorder} />
            )}
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.largeAvatar} />
            ) : (
              <View style={styles.largeAvatarPlaceholder}>
                <User size={64} color="#64748B" />
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.profileImageActionButton, avatar ? styles.removeButton : styles.uploadButtonPrimary]}
            onPress={avatar ? () => setAvatar(null) : pickImage}
          >
            {avatar ? (
              <>
                <X size={18} color="#FFF" />
                <Text style={styles.profileImageActionText}>Remove</Text>
              </>
            ) : (
              <>
                <Camera size={18} color="#FFF" />
                <Text style={styles.profileImageActionText}>Upload</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={styles.uploadHintsCentered}>
            <Text style={styles.hintTextCentered}>Recommended: 400x400px</Text>
            <Text style={styles.hintTextCentered}>Max size: 5MB • JPG, PNG, GIF</Text>
          </View>
        </View>
      )}

      {profilePictureTab === 'border' && (() => {
        const allBordersForProfile = [...(avatarBordersData?.borders || []), ...SAMPLE_BORDERS];
        const uniqueBordersForProfile = allBordersForProfile.filter((border, index, self) => 
          index === self.findIndex((b) => b.id === border.id)
        );

        return (
          <View style={styles.profileBorderSection}>
            <View style={styles.borderPreviewLarge}>
              <View style={styles.largeAvatarContainer}>
                {selectedBorder?.imageUrl && (
                  <Image source={{ uri: selectedBorder.imageUrl }} style={styles.largeAvatarBorder} />
                )}
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.largeAvatar} />
                ) : (
                  <View style={styles.largeAvatarPlaceholder}>
                    <User size={64} color="#64748B" />
                  </View>
                )}
              </View>
              <View style={styles.borderInfoCentered}>
                <Text style={styles.borderInfoLabel}>Current Border</Text>
                <Text style={styles.borderInfoValue}>
                  {selectedBorder?.name || 'None'}
                </Text>
                {selectedBorder && (
                  <View style={[styles.miniBorderRarityBadge, { backgroundColor: getRarityColor(selectedBorder.rarity), alignSelf: 'center' }]}>
                    <Text style={styles.miniBorderRarityText}>{selectedBorder.rarity.toUpperCase()}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.borderSectionHeader}>
              <Crown size={20} color="#FFD700" />
              <Text style={styles.borderSectionTitle}>Border Style</Text>
            </View>
            <Text style={styles.borderSectionSubtitle}>Choose a border for your profile picture</Text>

            <View style={styles.borderStylesGrid}>
              {uniqueBordersForProfile.map((border: AvatarBorder) => (
              <TouchableOpacity
                key={border.id}
                style={[
                  styles.borderStyleItem,
                  selectedBorder?.id === border.id && styles.borderStyleItemActive,
                ]}
                onPress={() => setSelectedBorder(border)}
              >
                <View style={styles.borderStylePreview}>
                  {border.imageUrl && (
                    <Image source={{ uri: border.imageUrl }} style={styles.borderStyleOverlay} />
                  )}
                  <View style={styles.borderStyleInner}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.borderStyleAvatar} />
                    ) : (
                      <View style={styles.borderStyleAvatarPlaceholder}>
                        <User size={16} color="#64748B" />
                      </View>
                    )}
                  </View>
                  {selectedBorder?.id === border.id && (
                    <View style={styles.borderSelectedBadge}>
                      <Check size={12} color="#FFF" />
                    </View>
                  )}
                </View>
                <Text style={styles.borderStyleName}>{border.name}</Text>
                <View style={[styles.borderStyleRarity, { backgroundColor: getRarityColor(border.rarity) }]}>
                  <Text style={styles.borderStyleRarityText}>{border.rarity.toUpperCase()}</Text>
                </View>
              </TouchableOpacity>
              ))}
            </View>

            <View style={styles.borderFeaturesList}>
              <View style={styles.borderFeatureItem}>
                <Shield size={14} color="#94A3B8" />
                <Text style={styles.borderFeatureText}>Unlock more borders through gameplay</Text>
              </View>
              <View style={styles.borderFeatureItem}>
                <Sparkles size={14} color="#94A3B8" />
                <Text style={styles.borderFeatureText}>Available in Common, Rare, Epic & Legendary</Text>
              </View>
              <View style={styles.borderFeatureItem}>
                <Crown size={14} color="#94A3B8" />
                <Text style={styles.borderFeatureText}>Premium borders coming soon</Text>
              </View>
            </View>
          </View>
        );
      })()}

      {profilePictureTab === 'nft' && (
        <View style={styles.nftProfileSection}>
          <View style={styles.largeNftContainer}>
            <View style={styles.largeNftPlaceholder}>
              <Wallet size={64} color="#334155" />
            </View>
          </View>
          <View style={styles.nftDetailsCard}>
            <View style={styles.nftDetailRow}>
              <Text style={styles.nftDetailLabel}>Name</Text>
              <Text style={styles.nftDetailValue}>No NFT Selected</Text>
            </View>
            <View style={styles.nftDetailRow}>
              <Text style={styles.nftDetailLabel}>Rarity</Text>
              <View style={styles.nftRarityBadge}>
                <Text style={styles.nftRarityText}>—</Text>
              </View>
            </View>
            <View style={styles.nftDetailRow}>
              <Text style={styles.nftDetailLabel}>Collection</Text>
              <Text style={styles.nftDetailValue}>—</Text>
            </View>
          </View>
          <View style={styles.emptyNftStateCompact}>
            <Wallet size={24} color="#64748B" />
            <Text style={styles.emptyNftTitleSmall}>No NFTs Connected</Text>
            <Text style={styles.emptyNftSubtitleSmall}>Connect your wallet to use NFTs</Text>
            <TouchableOpacity style={styles.connectWalletButtonSmall}>
              <Wallet size={16} color="#FFF" />
              <Text style={styles.connectWalletTextSmall}>Connect Wallet</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  const renderBanner = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>Profile Banner</Text>
      <Text style={styles.sectionSubtitle}>Customize your profile header</Text>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabButton, bannerTab === 'uploaded' && styles.tabButtonActive]}
          onPress={() => setBannerTab('uploaded')}
        >
          <Camera size={16} color={bannerTab === 'uploaded' ? '#FFF' : '#94A3B8'} />
          <Text style={[styles.tabButtonText, bannerTab === 'uploaded' && styles.tabButtonTextActive]}>
            Uploaded
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, bannerTab === 'store' && styles.tabButtonActive]}
          onPress={() => setBannerTab('store')}
        >
          <Sparkles size={16} color={bannerTab === 'store' ? '#FFF' : '#94A3B8'} />
          <Text style={[styles.tabButtonText, bannerTab === 'store' && styles.tabButtonTextActive]}>
            Store
          </Text>
        </TouchableOpacity>
      </View>

      {bannerTab === 'uploaded' && (
        <View style={styles.bannerUploadSection}>
          <View style={styles.currentBannerContainer}>
            {banner ? (
              <Image source={{ uri: banner }} style={styles.currentBanner} />
            ) : selectedSampleBannerId ? (
              <LinearGradient
                colors={(SAMPLE_BANNERS.find(b => b.id === selectedSampleBannerId)?.colors || ['#334155', '#1E293B']) as [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.currentBanner}
              />
            ) : (
              <View style={styles.currentBannerPlaceholder}>
                <ImageIcon size={40} color="#334155" />
              </View>
            )}
            <Text style={styles.currentLabel}>Current Banner</Text>
          </View>
          <TouchableOpacity style={styles.uploadButton} onPress={pickBanner}>
            <Camera size={18} color="#FFF" />
            <Text style={styles.uploadButtonText}>Upload Banner</Text>
          </TouchableOpacity>
          <View style={styles.uploadHints}>
            <Text style={styles.hintText}>• Recommended: 1500x500px</Text>
            <Text style={styles.hintText}>• Max size: 10MB</Text>
            {user?.isPro && (
              <View style={styles.proBadge}>
                <Crown size={12} color="#FFD700" />
                <Text style={styles.proBadgeText}>GIF support enabled</Text>
              </View>
            )}
          </View>

          <View style={styles.sampleBannersSection}>
            <Text style={styles.sampleBannersTitle}>Sample Banners</Text>
            <Text style={styles.sampleBannersSubtitle}>Choose from gradient presets</Text>
            <View style={styles.sampleBannersGrid}>
              {SAMPLE_BANNERS.map((sampleBanner) => (
                <TouchableOpacity
                  key={sampleBanner.id}
                  style={[
                    styles.sampleBannerItem,
                    selectedSampleBannerId === sampleBanner.id && styles.sampleBannerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedSampleBannerId(sampleBanner.id);
                    setBanner(null);
                  }}
                >
                  <LinearGradient
                    colors={sampleBanner.colors as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.sampleBannerPreview}
                  >
                    {selectedSampleBannerId === sampleBanner.id && (
                      <View style={styles.sampleBannerCheckmark}>
                        <Check size={12} color="#FFF" />
                      </View>
                    )}
                  </LinearGradient>
                  <Text
                    style={[
                      styles.sampleBannerName,
                      selectedSampleBannerId === sampleBanner.id && styles.sampleBannerNameSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {sampleBanner.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {bannerTab === 'store' && (
        <View style={styles.storeBannerSection}>
          {[1, 2, 3].map((item) => (
            <TouchableOpacity key={item} style={styles.storeBannerItem}>
              <View style={styles.storeBannerPreview}>
                <ImageIcon size={24} color="#334155" />
              </View>
              <View style={styles.storeBannerInfo}>
                <Text style={styles.storeBannerName}>Premium Banner #{item}</Text>
                <View style={styles.storeBannerPrice}>
                  <Text style={styles.storeBannerPriceText}>500</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          <View style={styles.emptyNftState}>
            <Text style={styles.emptyNftTitle}>Store Coming Soon</Text>
            <Text style={styles.emptyNftSubtitle}>Premium banners will be available for purchase</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderThemes = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>Profile Theme</Text>
      <Text style={styles.sectionSubtitle}>Choose your profile color scheme</Text>

      <Text style={styles.subsectionTitle}>Quick Themes</Text>
      <View style={styles.themesGrid}>
        {QUICK_THEMES.map((theme) => (
          <TouchableOpacity
            key={theme.id}
            style={styles.themeItem}
            onPress={() => setSelectedThemeId(theme.id)}
          >
            <View style={[
              styles.themePreview,
              { backgroundColor: theme.backgroundColor },
              selectedThemeId === theme.id && styles.themePreviewSelected
            ]}>
              <View style={[styles.themeAccent, { backgroundColor: theme.accentColor }]} />
              {selectedThemeId === theme.id && (
                <View style={styles.themeCheckmark}>
                  <Check size={12} color="#FFF" />
                </View>
              )}
            </View>
            <Text style={[styles.themeName, selectedThemeId === theme.id && styles.themeNameSelected]}>
              {theme.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.premiumSection}>
        <View style={styles.premiumHeader}>
          <Crown size={20} color="#FFD700" />
          <Text style={styles.premiumTitle}>Premium Themes</Text>
        </View>
        <Text style={styles.premiumSubtitle}>Animated themes with stunning effects</Text>

        <View style={styles.premiumThemesGrid}>
          {PREMIUM_THEMES.map((theme) => (
            <TouchableOpacity key={theme.id} style={styles.premiumThemeItem}>
              <View style={styles.premiumThemePreview}>
                <AnimatedThemePreview theme={theme} />
                <View style={styles.premiumBadge}>
                  <Crown size={10} color="#FFD700" />
                </View>
              </View>
              <Text style={styles.premiumThemeName}>{theme.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.backgroundImageSection}>
        <View style={styles.backgroundImageHeader}>
          <ImageIcon size={20} color="#3B82F6" />
          <Text style={styles.backgroundImageTitle}>Background Images</Text>
        </View>
        <Text style={styles.backgroundImageSubtitle}>Choose a background image that will appear behind your profile content</Text>

        <View style={styles.backgroundImagesGrid}>
          {BACKGROUND_IMAGES.map((bg) => (
            <TouchableOpacity
              key={bg.id}
              style={[
                styles.backgroundImageItem,
                selectedBackgroundImage === bg.url && styles.backgroundImageItemSelected,
              ]}
              onPress={() => setSelectedBackgroundImage(bg.url)}
            >
              <View style={styles.backgroundImagePreview}>
                {bg.url ? (
                  <Image source={{ uri: bg.url }} style={styles.backgroundImagePreviewImage} />
                ) : (
                  <View style={styles.backgroundImagePreviewNone}>
                    <X size={24} color="#64748B" />
                  </View>
                )}
                {selectedBackgroundImage === bg.url && (
                  <View style={styles.backgroundImageCheckmark}>
                    <Check size={12} color="#FFF" />
                  </View>
                )}
              </View>
              <Text style={[styles.backgroundImageName, selectedBackgroundImage === bg.url && styles.backgroundImageNameSelected]} numberOfLines={1}>
                {bg.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.backgroundImageHints}>
          <View style={styles.hintRow}>
            <ImageIcon size={14} color="#94A3B8" />
            <Text style={styles.hintText}>Background appears behind all content on your profile</Text>
          </View>
          <View style={styles.hintRow}>
            <Sparkles size={14} color="#94A3B8" />
            <Text style={styles.hintText}>Select &quot;None&quot; to use solid background color</Text>
          </View>
          <View style={styles.hintRow}>
            <Crown size={14} color="#94A3B8" />
            <Text style={styles.hintText}>More premium backgrounds coming soon</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderBorder = () => {
    const allBorders = [...(avatarBordersData?.borders || []), ...SAMPLE_BORDERS];
    const uniqueBorders = allBorders.filter((border, index, self) => 
      index === self.findIndex((b) => b.id === border.id)
    );

    return (
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Profile Picture Border</Text>
        <Text style={styles.sectionSubtitle}>Choose a border style for your avatar</Text>

        <View style={styles.borderPreviewSection}>
          <View style={styles.borderPreviewContainer}>
            <View style={styles.borderPreviewCircle}>
              {selectedBorder?.imageUrl && (
                <Image source={{ uri: selectedBorder.imageUrl }} style={styles.borderOverlayImage} />
              )}
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.borderPreviewImage} />
              ) : (
                <View style={styles.borderPreviewPlaceholder}>
                  <User size={32} color="#64748B" />
                </View>
              )}
            </View>
          </View>
          <View style={styles.currentBorderInfo}>
            <Text style={styles.currentLabel}>Current Border</Text>
            <Text style={styles.currentBorderName}>{selectedBorder?.name || 'None'}</Text>
            {selectedBorder && (
              <View style={[styles.currentBorderRarity, { backgroundColor: getRarityColor(selectedBorder.rarity) }]}>
                <Text style={styles.currentBorderRarityText}>{selectedBorder.rarity.toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.borderSelectionSection}>
          <Text style={styles.subsectionTitle}>Border Styles</Text>
          <Text style={styles.badgeSectionDesc}>Select a border style for your profile picture</Text>
          
          <View style={styles.borderItemsGrid}>
            {uniqueBorders.map((border: AvatarBorder) => (
              <TouchableOpacity
                key={border.id}
                style={[
                  styles.borderItemCard,
                  selectedBorder?.id === border.id && styles.borderItemCardSelected,
                  !border.unlocked && styles.borderItemCardLocked,
                ]}
                onPress={() => {
                  if (border.unlocked) {
                    setSelectedBorder(border);
                  }
                }}
                disabled={!border.unlocked}
              >
                <View style={[
                  styles.borderItemIconContainer,
                  { borderColor: border.unlocked ? getRarityColor(border.rarity) : '#334155' }
                ]}>
                  {border.imageUrl && (
                    <Image source={{ uri: border.imageUrl }} style={styles.borderItemOverlay} />
                  )}
                  <View style={styles.borderItemInner}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.borderItemAvatar} />
                    ) : (
                      <View style={styles.borderItemAvatarPlaceholder}>
                        <User size={12} color="#64748B" />
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[
                  styles.borderItemName,
                  !border.unlocked && styles.borderItemNameLocked
                ]} numberOfLines={1}>
                  {border.name}
                </Text>
                <View style={[styles.borderItemRarity, { backgroundColor: getRarityColor(border.rarity) }]}>
                  <Text style={styles.borderItemRarityText}>{border.rarity.charAt(0).toUpperCase()}</Text>
                </View>
                {selectedBorder?.id === border.id && border.unlocked && (
                  <View style={styles.borderItemCheck}>
                    <Check size={10} color="#22C55E" />
                  </View>
                )}
                {!border.unlocked && (
                  <View style={styles.borderItemLock}>
                    <Shield size={10} color="#64748B" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.borderHints}>
          <View style={styles.hintRow}>
            <Shield size={14} color="#94A3B8" />
            <Text style={styles.hintText}>Unlock borders through lootboxes and store</Text>
          </View>
          <View style={styles.hintRow}>
            <Zap size={14} color="#94A3B8" />
            <Text style={styles.hintText}>Common, Rare, Epic & Legendary borders available</Text>
          </View>
          <View style={styles.hintRow}>
            <Crown size={14} color="#94A3B8" />
            <Text style={styles.hintText}>Locked borders shown as preview</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderVerificationBadgeIcon = (badge: typeof VERIFICATION_BADGES[0], size: number = 16) => {
    if (badge.icon === 'none') return null;
    
    const iconProps = { size, color: '#FFF' };
    
    switch (badge.icon) {
      case 'check': return <Check {...iconProps} strokeWidth={3} />;
      case 'star': return <Star {...iconProps} fill="#FFF" />;
      case 'crown': return <Crown {...iconProps} />;
      case 'shield': return <Shield {...iconProps} />;
      case 'zap': return <Zap {...iconProps} fill="#FFF" />;
      case 'award': return <Award {...iconProps} />;
      case 'flame': return <Flame {...iconProps} fill="#FFF" />;
      case 'diamond': return <Gem {...iconProps} />;
      case 'gem': return <Gem {...iconProps} fill="#FFF" />;
      case 'heart': return <Heart {...iconProps} fill="#FFF" />;
      case 'rocket': return <Rocket {...iconProps} />;
      case 'sword': return <Swords {...iconProps} />;
      case 'skull': return <Skull {...iconProps} />;
      case 'target': return <Target {...iconProps} />;
      case 'medal': return <Medal {...iconProps} />;
      case 'hexagon': return <Hexagon {...iconProps} />;
      case 'atom': return <Atom {...iconProps} />;
      case 'infinity': return <Infinity {...iconProps} strokeWidth={3} />;
      default: return <Check {...iconProps} />;
    }
  };

  const renderBadges = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>Badges & Verification</Text>
      <Text style={styles.sectionSubtitle}>Showcase your achievements and status</Text>

      <View style={styles.badgeSection}>
        <Text style={styles.subsectionTitle}>Verification Style</Text>
        <Text style={styles.badgeSectionDesc}>Select a verification badge to display next to your username</Text>
        
        <View style={styles.verificationPreviewCard}>
          <Text style={styles.verificationPreviewLabel}>Preview</Text>
          <View style={styles.verificationPreviewContent}>
            <Text style={styles.verificationPreviewName}>{displayName || user?.username || 'Username'}</Text>
            {selectedVerificationBadge !== 'none' && (
              <View style={[
                styles.verificationPreviewBadge,
                { backgroundColor: VERIFICATION_BADGES.find(b => b.id === selectedVerificationBadge)?.color || '#4ADE80' }
              ]}>
                {renderVerificationBadgeIcon(
                  VERIFICATION_BADGES.find(b => b.id === selectedVerificationBadge) || VERIFICATION_BADGES[0],
                  14
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.verificationBadgesGrid}>
          {VERIFICATION_BADGES.map((badge) => (
            <TouchableOpacity
              key={badge.id}
              style={[
                styles.verificationBadgeItem,
                selectedVerificationBadge === badge.id && styles.verificationBadgeItemSelected,
                !badge.unlocked && styles.verificationBadgeItemLocked,
              ]}
              onPress={() => {
                if (badge.unlocked) {
                  setSelectedVerificationBadge(badge.id);
                }
              }}
              disabled={!badge.unlocked}
            >
              <View style={[
                styles.verificationBadgeIconContainer,
                { backgroundColor: badge.unlocked ? badge.color : '#334155' }
              ]}>
                {badge.id !== 'none' ? renderVerificationBadgeIcon(badge, 20) : (
                  <X size={20} color="#FFF" />
                )}
              </View>
              <Text style={[
                styles.verificationBadgeName,
                !badge.unlocked && styles.verificationBadgeNameLocked
              ]} numberOfLines={1}>
                {badge.name}
              </Text>
              {selectedVerificationBadge === badge.id && badge.unlocked && (
                <View style={styles.verificationBadgeCheck}>
                  <Check size={12} color="#22C55E" />
                </View>
              )}
              {!badge.unlocked && (
                <View style={styles.verificationBadgeLock}>
                  <Shield size={10} color="#64748B" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.verificationHints}>
          <View style={styles.hintRow}>
            <Crown size={14} color="#94A3B8" />
            <Text style={styles.hintText}>Gamefolio Pro badge available to all Pro members</Text>
          </View>
          <View style={styles.hintRow}>
            <Shield size={14} color="#94A3B8" />
            <Text style={styles.hintText}>Unlock more badges through achievements and purchases</Text>
          </View>
          <View style={styles.hintRow}>
            <Sparkles size={14} color="#94A3B8" />
            <Text style={styles.hintText}>Premium badges coming soon to the store</Text>
          </View>
        </View>
      </View>

      <View style={styles.badgeSection}>
        <Text style={styles.subsectionTitle}>Account Status</Text>
        <View style={styles.badgeGrid}>
          <View style={styles.badgeItem}>
            <View style={[styles.badgeIcon, { backgroundColor: '#3B82F6' }]}>
              <Check size={16} color="#FFF" strokeWidth={3} />
            </View>
            <View style={styles.badgeInfo}>
              <Text style={styles.badgeName}>Verified</Text>
              <Text style={styles.badgeDesc}>Email verified account</Text>
            </View>
            {user?.emailVerified && <Check size={18} color="#22C55E" />}
          </View>
          <View style={styles.badgeItem}>
            <View style={[styles.badgeIcon, { backgroundColor: '#FFD700' }]}>
              <Crown size={16} color="#FFF" />
            </View>
            <View style={styles.badgeInfo}>
              <Text style={styles.badgeName}>Pro Member</Text>
              <Text style={styles.badgeDesc}>Gamefolio Pro subscriber</Text>
            </View>
            {user?.isPro && <Check size={18} color="#22C55E" />}
          </View>
        </View>
      </View>

      <View style={styles.badgeSection}>
        <Text style={styles.subsectionTitle}>Achievement Badges</Text>
        <View style={styles.emptyNftState}>
          <Award size={32} color="#64748B" />
          <Text style={styles.emptyNftTitle}>Coming Soon</Text>
          <Text style={styles.emptyNftSubtitle}>Earn badges by completing achievements</Text>
        </View>
      </View>
    </View>
  );

  const renderNFTs = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>NFT Gallery</Text>
      <Text style={styles.sectionSubtitle}>View and manage your NFT collection</Text>

      <View style={styles.nftGallerySection}>
        <View style={styles.emptyNftState}>
          <Wallet size={40} color="#64748B" />
          <Text style={styles.emptyNftTitle}>No NFTs Connected</Text>
          <Text style={styles.emptyNftSubtitle}>Connect your wallet to view and display your NFT collection</Text>
          <TouchableOpacity style={styles.connectWalletButton}>
            <Wallet size={18} color="#FFF" />
            <Text style={styles.connectWalletText}>Connect Wallet</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderDisplayName = () => (
    <View style={styles.sectionContent}>
      <Text style={styles.sectionTitle}>Display Name Color</Text>
      <Text style={styles.sectionSubtitle}>Customize your display name color</Text>

      <View style={styles.displayNamePreview}>
        <View style={styles.displayNamePreviewCard}>
          <Text style={[styles.displayNamePreviewText, { color: displayNameColor }]}>
            {displayName || user?.username || 'Your Name'}
          </Text>
        </View>
      </View>

      <View style={styles.colorInputSection}>
        <Text style={styles.colorInputLabel}>Hex Color</Text>
        <View style={styles.colorInputRow}>
          <View style={[styles.colorPreview, { backgroundColor: displayNameColor }]} />
          <TextInput
            style={styles.colorInput}
            value={displayNameColor}
            onChangeText={(text) => {
              const cleaned = text.startsWith('#') ? text : `#${text}`;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(cleaned)) {
                setDisplayNameColor(cleaned);
              }
            }}
            placeholder="#FFFFFF"
            placeholderTextColor="#64748B"
            maxLength={7}
            autoCapitalize="characters"
          />
        </View>
      </View>

      <View style={styles.colorPresetsSection}>
        <Text style={styles.colorPresetsTitle}>Popular Colors</Text>
        <View style={styles.colorPresetsGrid}>
          {[
            { name: 'White', color: '#FFFFFF' },
            { name: 'Red', color: '#EF4444' },
            { name: 'Orange', color: '#F97316' },
            { name: 'Yellow', color: '#EAB308' },
            { name: 'Green', color: '#22C55E' },
            { name: 'Blue', color: '#3B82F6' },
            { name: 'Purple', color: '#A855F7' },
            { name: 'Pink', color: '#EC4899' },
            { name: 'Gold', color: '#FFD700' },
            { name: 'Silver', color: '#C0C0C0' },
            { name: 'Cyan', color: '#06B6D4' },
            { name: 'Lime', color: '#84CC16' },
          ].map((preset) => (
            <TouchableOpacity
              key={preset.color}
              style={[
                styles.colorPresetItem,
                displayNameColor === preset.color && styles.colorPresetItemActive,
              ]}
              onPress={() => setDisplayNameColor(preset.color)}
            >
              <View style={[styles.colorPresetCircle, { backgroundColor: preset.color }]} />
              <Text style={styles.colorPresetName}>{preset.name}</Text>
              {displayNameColor === preset.color && (
                <View style={styles.colorPresetCheck}>
                  <Check size={12} color="#22C55E" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.displayNameHints}>
        <View style={styles.hintRow}>
          <Palette size={14} color="#94A3B8" />
          <Text style={styles.hintText}>Enter any hex color code (e.g., #FF5733)</Text>
        </View>
        <View style={styles.hintRow}>
          <Sparkles size={14} color="#94A3B8" />
          <Text style={styles.hintText}>Choose from popular presets or create your own</Text>
        </View>
        <View style={styles.hintRow}>
          <Type size={14} color="#94A3B8" />
          <Text style={styles.hintText}>Color applies to your display name across Gamefolio</Text>
        </View>
      </View>
    </View>
  );

  const textStyleConfig: TextStyleConfig = {
    fontId: selectedFontId,
    effectId: selectedEffectId,
    customColor: textCustomColor,
  };

  const COLOR_WHEEL_COLORS = [
    '#FFFFFF', '#FF0000', '#FF4500', '#FF6B00', '#FFA500', '#FFD700', '#FFFF00',
    '#ADFF2F', '#7FFF00', '#00FF00', '#00FA9A', '#00FFFF', '#00BFFF', '#1E90FF',
    '#0000FF', '#4B0082', '#8B00FF', '#9400D3', '#FF00FF', '#FF1493', '#FF69B4',
    '#C0C0C0', '#808080', '#000000',
  ];

  const GRADIENT_COLOR_SWATCHES = [
    { id: 'rainbow', name: 'Rainbow', colors: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF'] },
    { id: 'fire', name: 'Fire', colors: ['#FF4500', '#FF6B00', '#FFD700'] },
    { id: 'ice', name: 'Ice', colors: ['#00FFFF', '#87CEEB', '#E0FFFF'] },
    { id: 'sunset', name: 'Sunset', colors: ['#FF512F', '#F09819', '#FF5E62'] },
    { id: 'ocean', name: 'Ocean', colors: ['#0077B6', '#00B4D8', '#90E0EF'] },
    { id: 'purple_haze', name: 'Purple', colors: ['#7F00FF', '#E100FF', '#7F00FF'] },
    { id: 'neon_pink', name: 'Neon Pink', colors: ['#FF00FF', '#FF69B4', '#FF1493'] },
    { id: 'neon_green', name: 'Neon Green', colors: ['#39FF14', '#00FF00', '#7FFF00'] },
    { id: 'gold', name: 'Gold', colors: ['#BF953F', '#FCF6BA', '#B38728'] },
    { id: 'silver', name: 'Silver', colors: ['#C0C0C0', '#E8E8E8', '#A8A8A8'] },
    { id: 'cyberpunk', name: 'Cyberpunk', colors: ['#FCEE0A', '#00D4FF'] },
    { id: 'vaporwave', name: 'Vaporwave', colors: ['#FF6AD5', '#C774E8', '#94D0FF'] },
  ];

  const isColorChanged = textCustomColor !== '#FFFFFF';

  const selectedEffect = EFFECT_STYLES.find(e => e.id === selectedEffectId);
  const effectHasBuiltInColor = selectedEffect && selectedEffect.id !== 'none' && (selectedEffect.gradientColors || (selectedEffect.defaultColor && selectedEffect.defaultColor !== '#FFFFFF'));
  const shouldDisableColorPicker = !!effectHasBuiltInColor;

  const renderTextStyle = () => {
    const allEffects = EFFECT_STYLES;

    return (
      <View style={styles.sectionContent}>
        <Text style={styles.sectionTitle}>Text Style</Text>
        <Text style={styles.sectionSubtitle}>Customize your username appearance</Text>

        <View style={styles.textStylePreviewCard}>
          <Text style={styles.textStylePreviewLabel}>Preview</Text>
          <View style={styles.textStylePreviewInner}>
            <StyledUsername 
              username={displayName || user?.username || 'Username'} 
              textStyleConfig={textStyleConfig}
              fontSize={32}
            />
          </View>
        </View>

        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabButton, textStyleTab === 'font' && styles.tabButtonActive]}
            onPress={() => setTextStyleTab('font')}
          >
            <Type size={16} color={textStyleTab === 'font' ? '#FFF' : '#94A3B8'} />
            <Text style={[styles.tabButtonText, textStyleTab === 'font' && styles.tabButtonTextActive]}>
              Font
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, textStyleTab === 'effect' && styles.tabButtonActive]}
            onPress={() => setTextStyleTab('effect')}
          >
            <Sparkles size={16} color={textStyleTab === 'effect' ? '#FFF' : '#94A3B8'} />
            <Text style={[styles.tabButtonText, textStyleTab === 'effect' && styles.tabButtonTextActive]}>
              Effect
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, textStyleTab === 'color' && styles.tabButtonActive]}
            onPress={() => setTextStyleTab('color')}
          >
            <Palette size={16} color={textStyleTab === 'color' ? '#FFF' : '#94A3B8'} />
            <Text style={[styles.tabButtonText, textStyleTab === 'color' && styles.tabButtonTextActive]}>
              Color
            </Text>
          </TouchableOpacity>
        </View>

        {textStyleTab === 'font' && (
          <View style={styles.textStyleStepContent}>
            <Text style={styles.stepSubtitle}>Select the font style for your username</Text>

            <View style={styles.textStylesGrid}>
              {FONT_STYLES.map((font) => (
                <TouchableOpacity
                  key={font.id}
                  style={[
                    styles.textStyleItem,
                    selectedFontId === font.id && styles.textStyleItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedFontId(font.id);
                  }}
                >
                  <View style={styles.textStyleItemPreview}>
                    <Text style={[
                      styles.fontPreviewText,
                      {
                        fontFamily: font.fontFamily,
                        fontWeight: font.fontWeight,
                        fontStyle: font.italic ? 'italic' : 'normal',
                        letterSpacing: font.letterSpacing,
                        textTransform: font.textTransform,
                      },
                    ]}>
                      Abc
                    </Text>
                  </View>
                  <Text style={styles.textStyleItemName} numberOfLines={1}>{font.name}</Text>
                  {selectedFontId === font.id && (
                    <View style={styles.textStyleSelectedBadge}>
                      <Check size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {textStyleTab === 'effect' && (
          <View style={styles.textStyleStepContent}>
            <Text style={styles.stepSubtitle}>Add visual effects to your username</Text>

            <View style={styles.textStylesGrid}>
              {allEffects.map((effect) => (
                <TouchableOpacity
                  key={effect.id}
                  style={[
                    styles.textStyleItem,
                    selectedEffectId === effect.id && styles.textStyleItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedEffectId(effect.id);
                  }}
                >
                  <View style={styles.textStyleItemPreview}>
                    <StyledUsername 
                      username="Abc" 
                      textStyleConfig={{
                        fontId: selectedFontId,
                        effectId: effect.id,
                        customColor: effect.id === 'none' ? '#FFFFFF' : textCustomColor,
                      }}
                      fontSize={18}
                    />
                  </View>
                  <Text style={styles.textStyleItemName} numberOfLines={1}>{effect.id === 'none' ? 'No Effect' : effect.name}</Text>
                  {selectedEffectId === effect.id && (
                    <View style={styles.textStyleSelectedBadge}>
                      <Check size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {textStyleTab === 'color' && (
          <View style={styles.textStyleStepContent}>
            <Text style={styles.stepSubtitle}>Pick a solid or gradient color for your username</Text>

            {shouldDisableColorPicker && (
              <View style={styles.colorDisabledNotice}>
                <Text style={styles.colorDisabledNoticeText}>
                  Color selection is disabled because the selected effect has a built-in color scheme.
                </Text>
              </View>
            )}

            <Text style={[styles.colorSectionLabel, shouldDisableColorPicker && styles.colorSectionLabelDisabled]}>Solid Colors</Text>
            <View style={[styles.colorWheelContainer, shouldDisableColorPicker && styles.colorWheelContainerDisabled]}>
              <View style={styles.colorWheelGrid}>
                {COLOR_WHEEL_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorWheelItem,
                      { backgroundColor: color },
                      textCustomColor === color && styles.colorWheelItemSelected,
                    ]}
                    onPress={() => !shouldDisableColorPicker && setTextCustomColor(color)}
                    disabled={shouldDisableColorPicker}
                  >
                    {textCustomColor === color && (
                      <Check size={16} color={color === '#FFFFFF' || color === '#FFFF00' || color === '#FFD700' ? '#000' : '#FFF'} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={[styles.colorSectionLabel, shouldDisableColorPicker && styles.colorSectionLabelDisabled]}>Gradient Colors</Text>
            <View style={[styles.gradientSwatchesContainer, shouldDisableColorPicker && styles.colorWheelContainerDisabled]}>
              {GRADIENT_COLOR_SWATCHES.map((swatch) => (
                <TouchableOpacity
                  key={swatch.id}
                  style={[
                    styles.gradientSwatchItem,
                    selectedEffectId === swatch.id && styles.gradientSwatchItemSelected,
                  ]}
                  onPress={() => {
                    if (!shouldDisableColorPicker) {
                      const effect = EFFECT_STYLES.find(e => e.id === swatch.id);
                      if (effect) {
                        setSelectedEffectId(swatch.id);
                      }
                    }
                  }}
                  disabled={shouldDisableColorPicker}
                >
                  <LinearGradient
                    colors={swatch.colors as [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradientSwatchPreview}
                  />
                  <Text style={styles.gradientSwatchName}>{swatch.name}</Text>
                  {selectedEffectId === swatch.id && (
                    <View style={styles.gradientSwatchCheck}>
                      <Check size={10} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.textStyleActions}>
              <TouchableOpacity
                style={[
                  styles.stepResetButton,
                  (!isColorChanged && selectedEffectId === 'none') && styles.stepResetButtonDisabled,
                ]}
                onPress={() => {
                  setTextCustomColor('#FFFFFF');
                  setSelectedEffectId('none');
                }}
                disabled={!isColorChanged && selectedEffectId === 'none'}
              >
                <Text style={[
                  styles.stepResetButtonText,
                  !isColorChanged && selectedEffectId === 'none' && styles.stepResetButtonTextDisabled,
                ]}>Reset Style</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.textStyleHints}>
          <View style={styles.hintRow}>
            <Sparkles size={14} color="#94A3B8" />
            <Text style={styles.hintText}>Combine fonts, effects, and colors for unique styles</Text>
          </View>
          <View style={styles.hintRow}>
            <Type size={14} color="#94A3B8" />
            <Text style={styles.hintText}>Style applies to your display name across Gamefolio</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'overview': return renderOverview();
      case 'profile': return renderProfilePicture();
      case 'banner': return renderBanner();
      case 'themes': return renderThemes();
      case 'border': return renderBorder();
      case 'displayname': return renderDisplayName();
      case 'badges': return renderBadges();
      case 'nfts': return renderNFTs();
      case 'textstyle': return renderTextStyle();
      default: return renderOverview();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <LinearGradient
          colors={['#0F1520', '#1A1F2E', '#0F1520']}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Sparkles size={24} color="#4ADE80" />
              <Text style={styles.headerTitle}>Appearance Studio</Text>
            </View>
            <View style={styles.headerRight}>
              {isDirty && (
                <TouchableOpacity
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : isSaved ? (
                    <Check size={18} color="#FFF" />
                  ) : (
                    <Save size={18} color="#FFF" />
                  )}
                  <Text style={styles.saveButtonText}>
                    {isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.menuScrollContainer}>
              <ScrollView
                ref={menuScrollViewRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.menuScroll}
                contentContainerStyle={styles.menuContent}
                onScroll={(event) => {
                  const scrollX = event.nativeEvent.contentOffset.x;
                  const contentWidth = event.nativeEvent.contentSize.width;
                  const layoutWidth = event.nativeEvent.layoutMeasurement.width;
                  
                  setShowLeftArrow(scrollX > 10);
                  setShowRightArrow(scrollX < contentWidth - layoutWidth - 10);
                }}
                scrollEventThrottle={16}
              >
              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.menuItem, activeSection === item.id && styles.menuItemActive]}
                  onPress={() => setActiveSection(item.id)}
                >
                  <View style={[styles.menuIcon, { backgroundColor: activeSection === item.id ? item.color : '#1E293B' }]}>
                    {item.icon}
                  </View>
                  <Text style={[styles.menuLabel, activeSection === item.id && { color: item.color }]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
              </ScrollView>
              {showLeftArrow && (
                <View style={styles.scrollArrowLeft}>
                  <View style={styles.scrollArrowBackground}>
                    <ChevronRight size={20} color="#FFF" style={{ transform: [{ rotate: '180deg' }] }} />
                  </View>
                </View>
              )}
              {showRightArrow && (
                <View style={styles.scrollArrowRight}>
                  <View style={styles.scrollArrowBackground}>
                    <ChevronRight size={20} color="#FFF" />
                  </View>
                </View>
              )}
            </View>

            <ScrollView ref={mainScrollViewRef} style={styles.mainContent} showsVerticalScrollIndicator={false}>
              {renderContent()}
              <View style={styles.bottomPadding} />
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>

      <ImageEditorModal
        visible={editorVisible}
        imageUri={tempImageUri}
        onClose={() => {
          setEditorVisible(false);
          setTempImageUri(null);
          setTempImageDimensions(undefined);
        }}
        onSave={handleEditorSave}
        maskType={editingType === 'avatar' ? 'circle' : 'rect'}
        aspectRatio={editingType === 'avatar' ? 1 : 3}
        initialDimensions={tempImageDimensions}
      />

      <ProfileBorderModal
        visible={borderModalVisible}
        onClose={() => setBorderModalVisible(false)}
        onSelect={(border) => setSelectedBorder(border)}
        currentBorderId={selectedBorder?.id || null}
        previewImageUrl={avatar || undefined}
      />

      <CustomAlert
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
        type={alertType}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1520',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  body: {
    flex: 1,
  },
  menuScrollContainer: {
    position: 'relative',
    maxHeight: 90,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  menuScroll: {
    flex: 1,
  },
  menuContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  menuItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 80,
  },
  menuItemActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  menuLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    textAlign: 'center',
  },
  mainContent: {
    flex: 1,
  },
  sectionContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 24,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
    marginTop: 8,
  },
  previewCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewBanner: {
    height: 80,
    width: '100%',
  },
  previewBannerImage: {
    width: '100%',
    height: '100%',
  },
  previewBannerPlaceholder: {
    width: '100%',
    height: '100%',
  },
  previewContent: {
    padding: 16,
    paddingTop: 0,
    alignItems: 'center',
  },
  previewAvatarWrapper: {
    marginTop: -30,
    position: 'relative',
  },
  previewAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
  },
  previewAvatarImage: {
    width: '100%',
    height: '100%',
  },
  previewAvatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
  },
  previewBorderOverlay: {
    position: 'absolute',
    width: 66,
    height: 66,
    top: -3,
    left: -3,
  },
  previewName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
    marginTop: 8,
  },
  previewHandle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 12,
  },
  previewButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  previewButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quickActions: {
    marginTop: 8,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  quickActionsGrid: {
    gap: 8,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    flex: 1,
    fontSize: 15,
    color: '#FFF',
    fontWeight: '500',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: '#3B82F6',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#FFF',
  },
  uploadSection: {
    flexDirection: 'row',
    gap: 20,
    flexWrap: 'wrap',
  },
  currentImageContainer: {
    alignItems: 'center',
  },
  currentAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1E293B',
  },
  currentLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
  },
  uploadActions: {
    flex: 1,
    minWidth: 200,
    justifyContent: 'center',
  },
  profileImageSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  largeAvatarContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 3,
    borderColor: '#334155',
    marginBottom: 24,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarBorder: {
    position: 'absolute',
    width: 206,
    height: 206,
    zIndex: 1,
  },
  largeAvatar: {
    width: '100%',
    height: '100%',
  },
  largeAvatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  profileImageActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  uploadButtonPrimary: {
    backgroundColor: '#3B82F6',
  },
  removeButton: {
    backgroundColor: '#EF4444',
  },
  profileImageActionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  uploadHintsCentered: {
    alignItems: 'center',
    gap: 4,
  },
  hintTextCentered: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  nftProfileSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  largeNftContainer: {
    width: 200,
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    marginBottom: 20,
  },
  largeNftPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  nftDetailsCard: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  nftDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  nftDetailLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  nftDetailValue: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
  },
  nftRarityBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nftRarityText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  emptyNftStateCompact: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    width: '100%',
  },
  emptyNftTitleSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 8,
  },
  emptyNftSubtitleSmall: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  connectWalletButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  connectWalletTextSmall: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
    marginBottom: 12,
  },
  uploadButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  uploadHints: {
    gap: 4,
  },
  hintText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  nftSection: {
    flex: 1,
  },
  nftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  nftItem: {
    width: (SCREEN_WIDTH - 80) / 3,
    aspectRatio: 1,
  },
  nftPlaceholder: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyNftState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyNftTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginTop: 12,
  },
  emptyNftSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  connectWalletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  connectWalletText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerUploadSection: {
    gap: 16,
  },
  currentBannerContainer: {
    gap: 8,
  },
  currentBanner: {
    width: '100%',
    height: 120,
    borderRadius: 12,
  },
  currentBannerPlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  proBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  storeBannerSection: {
    gap: 12,
  },
  storeBannerItem: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  storeBannerPreview: {
    height: 80,
    backgroundColor: '#0F1520',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeBannerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  storeBannerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  storeBannerPrice: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  storeBannerPriceText: {
    color: '#0F1520',
    fontSize: 12,
    fontWeight: 'bold',
  },
  themesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  themeItem: {
    width: (SCREEN_WIDTH - 80) / 3,
    alignItems: 'center',
  },
  themePreview: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  themePreviewSelected: {
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  themeAccent: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  themeCheckmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#22C55E',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeName: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  themeNameSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  premiumSection: {
    marginTop: 8,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  premiumSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  premiumThemesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  premiumThemeItem: {
    width: (SCREEN_WIDTH - 80) / 3,
    alignItems: 'center',
  },
  premiumThemePreview: {
    width: '100%',
    aspectRatio: 1.5,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  animatedThemePreview: {
    flex: 1,
    overflow: 'hidden',
  },
  premiumBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 4,
    borderRadius: 8,
  },
  premiumThemeName: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  borderPreviewSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  borderPreviewContainer: {
    padding: 16,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  borderPreviewCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#0F1520',
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderOverlayImage: {
    width: 126,
    height: 126,
    position: 'absolute',
    zIndex: 1,
  },
  borderPreviewImage: {
    width: '100%',
    height: '100%',
  },
  borderPreviewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chooseBorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    marginBottom: 20,
  },
  chooseBorderButtonText: {
    color: '#FFD700',
    fontSize: 15,
    fontWeight: '600',
  },
  borderHints: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  badgeSection: {
    marginBottom: 24,
  },
  badgeGrid: {
    gap: 12,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  badgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeInfo: {
    flex: 1,
  },
  badgeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  badgeDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  nftGallerySection: {
    marginTop: 8,
  },
  fontSection: {
    marginTop: 8,
  },
  bottomPadding: {
    height: 40,
  },
  borderSectionDivider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 24,
    marginHorizontal: 20,
  },
  profileBorderSection: {
    paddingTop: 10,
  },
  borderPreviewLarge: {
    alignItems: 'center',
    marginBottom: 24,
  },
  borderInfoCentered: {
    alignItems: 'center',
    marginTop: 16,
  },
  borderStylesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  borderStyleItem: {
    width: (SCREEN_WIDTH - 80) / 3,
    alignItems: 'center',
  },
  borderStyleItemActive: {
    opacity: 1,
  },
  borderStylePreview: {
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
    overflow: 'hidden',
  },
  borderStyleOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  borderStyleInner: {
    width: '70%',
    height: '70%',
    borderRadius: 100,
    overflow: 'hidden',
    backgroundColor: '#0F1520',
  },
  borderStyleAvatar: {
    width: '100%',
    height: '100%',
  },
  borderStyleAvatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
  },
  borderSelectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#22C55E',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  borderStyleName: {
    fontSize: 11,
    color: '#FFF',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  borderStyleRarity: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  borderStyleRarityText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  borderSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  borderSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  borderSectionSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  currentBorderPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  miniAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1520',
  },
  miniBorderOverlay: {
    position: 'absolute',
    width: 86,
    height: 86,
    zIndex: 1,
  },
  miniAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  miniAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  borderInfo: {
    flex: 1,
  },
  borderInfoLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  borderInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 6,
  },
  miniBorderRarityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  miniBorderRarityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  selectBorderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
    marginBottom: 16,
  },
  selectBorderButtonText: {
    color: '#FFD700',
    fontSize: 15,
    fontWeight: '600',
  },
  borderFeaturesList: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  borderFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  borderFeatureText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  displayNamePreview: {
    alignItems: 'center',
    marginBottom: 24,
  },
  displayNamePreviewCard: {
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 200,
    alignItems: 'center',
  },
  displayNamePreviewText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  colorInputSection: {
    marginBottom: 24,
  },
  colorInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 8,
  },
  colorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorPreview: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#334155',
  },
  colorInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
  },
  colorPresetsSection: {
    marginBottom: 24,
  },
  colorPresetsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
  },
  colorPresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorPresetItem: {
    width: (SCREEN_WIDTH - 80) / 4,
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  colorPresetItemActive: {
    borderColor: '#22C55E',
    borderWidth: 2,
  },
  colorPresetCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#334155',
  },
  colorPresetName: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  colorPresetCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 2,
  },
  displayNameHints: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  textStylePreviewCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  textStylePreviewLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  textStylePreviewInner: {
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textStyleCategoryTabs: {
    marginBottom: 20,
  },
  categoryTabsContent: {
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  categoryTabActive: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  categoryTabTextActive: {
    color: '#FFF',
  },
  textStylesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  textStyleItem: {
    width: (SCREEN_WIDTH - 80) / 3,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
  },
  textStyleItemSelected: {
    borderColor: '#22C55E',
  },
  textStyleItemPreview: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  textStyleItemName: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
  },
  textStyleSelectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#22C55E',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStyleHints: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  textStyleSectionDivider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 24,
  },
  textStyleActions: {
    alignItems: 'center',
    marginTop: 20,
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  stepIndicator: {
    alignItems: 'center',
    opacity: 0.6,
  },
  stepIndicatorActive: {
    opacity: 1,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepNumberActive: {
    backgroundColor: '#EF4444',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#94A3B8',
  },
  stepNumberTextActive: {
    color: '#FFF',
  },
  stepLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  stepLabelActive: {
    color: '#FFF',
  },
  stepConnector: {
    width: 40,
    height: 2,
    backgroundColor: '#334155',
    marginHorizontal: 8,
    marginBottom: 20,
  },
  textStyleStepContent: {
    marginBottom: 10,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  stepNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  stepNavigationTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  stepNavSpacer: {
    flex: 1,
  },
  stepNextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 6,
  },
  stepNextButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  stepBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepBackButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
    flex: 1,
    justifyContent: 'center',
  },
  stepNextButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  stepBackButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  stepSkipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepSkipButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  stepResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  stepResetButtonDisabled: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  stepResetButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  stepResetButtonTextDisabled: {
    color: '#64748B',
  },
  stepSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  stepSaveButtonDisabled: {
    opacity: 0.5,
  },
  stepSaveButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  colorDisabledNotice: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  colorDisabledNoticeText: {
    color: '#FCA5A5',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  colorSectionLabelDisabled: {
    opacity: 0.4,
  },
  colorWheelContainerDisabled: {
    opacity: 0.3,
    pointerEvents: 'none',
  },
  stepIndicatorContainerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  stepIndicatorContainerBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 10,
  },
  colorSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 12,
    marginTop: 8,
  },
  gradientSwatchesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  gradientSwatchItem: {
    width: (SCREEN_WIDTH - 80) / 4,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
  },
  gradientSwatchItemSelected: {
    borderColor: '#22C55E',
  },
  gradientSwatchPreview: {
    width: '100%',
    height: 24,
    borderRadius: 6,
    marginBottom: 6,
  },
  gradientSwatchName: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },
  gradientSwatchCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#22C55E',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontPreviewText: {
    fontSize: 20,
    color: '#FFF',
  },
  colorWheelContainer: {
    marginBottom: 20,
  },
  colorWheelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  colorWheelItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#334155',
  },
  colorWheelItemSelected: {
    borderColor: '#FFF',
    borderWidth: 3,
  },
  scrollArrowLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingLeft: 8,
    pointerEvents: 'none',
  },
  scrollArrowRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingRight: 8,
    pointerEvents: 'none',
  },
  scrollArrowBackground: {
    backgroundColor: 'rgba(15, 21, 32, 0.9)',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeSectionDesc: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  verificationPreviewCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  verificationPreviewLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  verificationPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verificationPreviewName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  verificationPreviewBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationBadgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  verificationBadgeItem: {
    width: (SCREEN_WIDTH - 80) / 4,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
  },
  verificationBadgeItemSelected: {
    borderColor: '#22C55E',
  },
  verificationBadgeItemLocked: {
    opacity: 0.5,
  },
  verificationBadgeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  verificationBadgeName: {
    fontSize: 10,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  verificationBadgeNameLocked: {
    color: '#64748B',
  },
  verificationBadgeCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 2,
  },
  verificationBadgeLock: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 2,
  },
  verificationHints: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  backgroundImageSection: {
    marginTop: 24,
  },
  backgroundImageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  backgroundImageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  backgroundImageSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  backgroundImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  backgroundImageItem: {
    width: (SCREEN_WIDTH - 80) / 3,
    alignItems: 'center',
  },
  backgroundImageItemSelected: {
    opacity: 1,
  },
  backgroundImagePreview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
    backgroundColor: '#1E293B',
  },
  backgroundImagePreviewImage: {
    width: '100%',
    height: '100%',
  },
  backgroundImagePreviewNone: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1520',
  },
  backgroundImageCheckmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#22C55E',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundImageName: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  backgroundImageNameSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  backgroundImageHints: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  borderSelectionSection: {
    marginTop: 24,
  },
  borderItemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  borderItemCard: {
    width: (SCREEN_WIDTH - 80) / 4,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
  },
  borderItemCardSelected: {
    borderColor: '#22C55E',
  },
  borderItemCardLocked: {
    opacity: 0.5,
  },
  borderItemIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 8,
    position: 'relative',
    backgroundColor: '#0F1520',
  },
  borderItemOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  borderItemInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#334155',
  },
  borderItemAvatar: {
    width: '100%',
    height: '100%',
  },
  borderItemAvatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
  },
  borderItemName: {
    fontSize: 10,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  borderItemNameLocked: {
    color: '#64748B',
  },
  borderItemCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 2,
  },
  borderItemLock: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 2,
  },
  borderItemRarity: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  borderItemRarityText: {
    fontSize: 8,
    fontWeight: 'bold' as const,
    color: '#FFF',
    letterSpacing: 0.5,
  },
  currentBorderInfo: {
    alignItems: 'center',
    marginTop: 16,
  },
  currentBorderName: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: '#FFF',
    marginTop: 8,
  },
  currentBorderRarity: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  currentBorderRarityText: {
    fontSize: 11,
    fontWeight: 'bold' as const,
    color: '#FFF',
    letterSpacing: 1,
  },
  sampleBannersSection: {
    marginTop: 24,
  },
  sampleBannersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  sampleBannersSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  sampleBannersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sampleBannerItem: {
    width: (SCREEN_WIDTH - 80) / 4,
    alignItems: 'center',
  },
  sampleBannerItemSelected: {
    opacity: 1,
  },
  sampleBannerPreview: {
    width: '100%',
    height: 60,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#334155',
    position: 'relative',
    overflow: 'hidden',
  },
  sampleBannerCheckmark: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#22C55E',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleBannerName: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
  },
  sampleBannerNameSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
});
