export type ProfileThemeName = 'default' | 'none' | 'zombie' | 'pink';

export interface ProfileThemeTokens {
  isLight: boolean;

  bg: string;
  navBg: string;
  navBorderColor: string;

  accent: string;
  accentGlow: string;
  accentDark: string;
  accentMuted: string;
  accentFaint: string;

  cardBg: string;
  cardBorder: string;
  cardBorderRadius: number;

  statsTopGradient: readonly [string, string, ...string[]];
  statLabels: [string, string, string];
  hasStatsGradientBar: boolean;
  statsCardIncludesBio: boolean;
  statAlign: 'center' | 'flex-start';
  statNumberFontSize: number;
  statLabelPill: boolean;
  hasDripEffect: boolean;

  textPrimary: string;
  textHandle: string;
  statNumberColor: string;
  bioTextColor: string;

  memberSinceColor: string;
  muted: string;

  verifiedBg: string;
  verifiedText: string;
  verifiedLabel: string;
  verifiedBorderColor: string;

  bioBorderColor: string;
  bioBg: string;

  followBtnBg: string;
  followBtnTextColor: string;
  followBtnGradient: readonly [string, string, ...string[]] | null;

  iconBtnBg: string;
  iconBtnBorder: string;

  tabActiveBg: string;
  tabActiveBorder: string;
  tabActiveText: string;
  tabInactiveBg: string;
  tabInactiveBorder: string;

  avatarBorderColor: string;
  avatarBorderWidth: number;
  shadowColor: string;

  statusText: string;
  playCircleBg: string;
  dividerColor: string;
  followingBarBorder: string;
  followingLabelColor: string;

  nametagGradient: readonly [string, string, ...string[]];
  collectionGradient: readonly [string, string, ...string[]];

  displayNameSize: number;
  displayNameUppercase: boolean;
}

const DEFAULT_THEME: ProfileThemeTokens = {
  isLight: false,
  bg: '#020b12',
  navBg: '#020b12',
  navBorderColor: '#1d293d',
  accent: '#4ADE80',
  accentGlow: '#4ADE8026',
  accentDark: '#022c22',
  accentMuted: '#4ADE8033',
  accentFaint: '#4ADE800d',
  cardBg: '#022f2e0d',
  cardBorder: '#00bba733',
  cardBorderRadius: 16,
  statsTopGradient: ['#00bba7', '#000'],
  statLabels: ['Uploads', 'Followers', 'Following'],
  hasStatsGradientBar: true,
  statsCardIncludesBio: false,
  statAlign: 'center',
  statNumberFontSize: 20,
  statLabelPill: false,
  hasDripEffect: false,
  textPrimary: '#FFFFFF',
  textHandle: '#62748e',
  statNumberColor: '#FFFFFF',
  bioTextColor: '#cad5e2',
  memberSinceColor: '#00d5be',
  muted: '#62748e',
  verifiedBg: '#3B82F6',
  verifiedText: '#FFFFFF',
  verifiedLabel: '',
  verifiedBorderColor: 'transparent',
  bioBorderColor: '#00bba7',
  bioBg: '#00bba70d',
  followBtnBg: '#4ADE80',
  followBtnTextColor: '#022c22',
  followBtnGradient: null,
  iconBtnBg: '#00bba71a',
  iconBtnBorder: '#00bba766',
  tabActiveBg: '#4ADE8020',
  tabActiveBorder: '#4ADE8060',
  tabActiveText: '#4ADE80',
  tabInactiveBg: '#0f1a2b',
  tabInactiveBorder: '#1d293d',
  avatarBorderColor: '#4ADE80',
  avatarBorderWidth: 2.5,
  shadowColor: '#4ADE80',
  statusText: '',
  playCircleBg: '#00bc7d',
  dividerColor: '#00bba733',
  followingBarBorder: '#00bba733',
  followingLabelColor: '#00d5be',
  nametagGradient: ['#0f172b', '#441306', '#0f172b'],
  collectionGradient: ['#5ee9b5', '#fff085', '#ffb86a'],
  displayNameSize: 22,
  displayNameUppercase: true,
};

const ZOMBIE_THEME: ProfileThemeTokens = {
  isLight: false,
  bg: '#0a0c0a',
  navBg: 'rgba(10,12,10,0.95)',
  navBorderColor: '#35530e4d',
  accent: '#9ae600',
  accentGlow: '#84cc1626',
  accentDark: '#1a2e00',
  accentMuted: '#7ccf0033',
  accentFaint: '#7ccf000d',
  cardBg: '#111411',
  cardBorder: '#9ae600',
  cardBorderRadius: 12,
  statsTopGradient: ['#84cc16', '#000'],
  statLabels: ['Bio-Data', 'Survivors', 'Tracking'],
  hasStatsGradientBar: false,
  statsCardIncludesBio: false,
  statAlign: 'flex-start',
  statNumberFontSize: 28,
  statLabelPill: true,
  hasDripEffect: true,
  textPrimary: '#FFFFFF',
  textHandle: '#62748e',
  statNumberColor: '#9ae600',
  bioTextColor: '#9ae600cc',
  memberSinceColor: '#9ae600',
  muted: '#62748e',
  verifiedBg: '#7ccf00',
  verifiedText: '#3c6300',
  verifiedLabel: 'Bio-Signature Verified',
  verifiedBorderColor: 'transparent',
  bioBorderColor: '#7ccf00',
  bioBg: '#7ccf000d',
  followBtnBg: '#9ae600',
  followBtnTextColor: '#1a2e00',
  followBtnGradient: null,
  iconBtnBg: '#7ccf001a',
  iconBtnBorder: '#7ccf004d',
  tabActiveBg: '#9ae60020',
  tabActiveBorder: '#9ae60060',
  tabActiveText: '#9ae600',
  tabInactiveBg: '#0f1a2b',
  tabInactiveBorder: '#1d293d',
  avatarBorderColor: '#9ae600',
  avatarBorderWidth: 3,
  shadowColor: '#9ae600',
  statusText: 'System: Online',
  playCircleBg: '#7ccf00',
  dividerColor: '#7ccf0033',
  followingBarBorder: '#7ccf0033',
  followingLabelColor: '#9ae600',
  nametagGradient: ['#0f172b', '#441306', '#0f172b'],
  collectionGradient: ['#5ee9b5', '#fff085', '#ffb86a'],
  displayNameSize: 22,
  displayNameUppercase: true,
};

const PINK_THEME: ProfileThemeTokens = {
  isLight: true,
  bg: '#fce7f3',
  navBg: 'rgba(255,255,255,0.6)',
  navBorderColor: '#ffccd3',
  accent: '#ff2056',
  accentGlow: '#ff205633',
  accentDark: '#fff',
  accentMuted: 'rgba(255,200,200,0.5)',
  accentFaint: 'rgba(255,255,255,0.4)',
  cardBg: 'rgba(255,255,255,0.4)',
  cardBorder: 'rgba(255,255,255,0.8)',
  cardBorderRadius: 24,
  statsTopGradient: ['#ff637e', '#f6339a'],
  statLabels: ['Uploads', 'Followers', 'Following'],
  hasStatsGradientBar: false,
  statsCardIncludesBio: false,
  statAlign: 'flex-start',
  statNumberFontSize: 18,
  statLabelPill: false,
  hasDripEffect: false,
  textPrimary: '#1d293d',
  textHandle: '#62748e',
  statNumberColor: '#1d293d',
  bioTextColor: '#45556c',
  memberSinceColor: '#ff637e',
  muted: '#90a1b9',
  verifiedBg: 'rgba(255,255,255,0.6)',
  verifiedText: '#ff2056',
  verifiedLabel: 'Verified Streamer',
  verifiedBorderColor: '#fda5d5',
  bioBorderColor: '#fda5d5',
  bioBg: 'rgba(255,255,255,0.3)',
  followBtnBg: '#ff2056',
  followBtnTextColor: '#fff',
  followBtnGradient: ['#ff637e', '#f6339a'],
  iconBtnBg: 'rgba(255,255,255,0.4)',
  iconBtnBorder: '#fda5d5',
  tabActiveBg: 'rgba(255,32,86,0.08)',
  tabActiveBorder: '#ff637e60',
  tabActiveText: '#ff2056',
  tabInactiveBg: 'rgba(255,255,255,0.3)',
  tabInactiveBorder: 'rgba(255,200,210,0.4)',
  avatarBorderColor: '#fff',
  avatarBorderWidth: 3,
  shadowColor: '#fda5d5',
  statusText: '',
  playCircleBg: '#ff2056',
  dividerColor: '#ffccd3',
  followingBarBorder: '#ffccd3',
  followingLabelColor: '#ff637e',
  nametagGradient: ['#ff637e', '#fb64b6', '#ff637e'],
  collectionGradient: ['#ff637e', '#f6339a'],
  displayNameSize: 20,
  displayNameUppercase: false,
};

export const PROFILE_THEMES: Record<ProfileThemeName, ProfileThemeTokens> = {
  default: DEFAULT_THEME,
  none: DEFAULT_THEME,
  zombie: ZOMBIE_THEME,
  pink: PINK_THEME,
};

export const SELECTABLE_PROFILE_THEMES: {
  id: ProfileThemeName;
  name: string;
  description: string;
  bg: string;
  accent: string;
  preview: string[];
}[] = [
  {
    id: 'none',
    name: 'None',
    description: 'Default Gamefolio profile look',
    bg: '#020b12',
    accent: '#4ADE80',
    preview: ['#020b12', '#4ADE80', '#00bba7'],
  },
  {
    id: 'zombie',
    name: 'Zombie',
    description: 'Zombie apocalypse terminal aesthetic',
    bg: '#0a0c0a',
    accent: '#9ae600',
    preview: ['#0a0c0a', '#9ae600', '#7ccf00'],
  },
  {
    id: 'pink',
    name: 'Pink',
    description: 'Rose glass aesthetic with light, frosted card design',
    bg: '#fce7f3',
    accent: '#ff2056',
    preview: ['#fce7f3', '#ff637e', '#fb64b6'],
  },
];

export function getProfileTheme(themeName?: string | null): ProfileThemeTokens {
  if (themeName === 'zombie') return ZOMBIE_THEME;
  if (themeName === 'pink') return PINK_THEME;
  if (themeName === 'none' || themeName === 'default' || !themeName) return DEFAULT_THEME;
  return DEFAULT_THEME;
}
