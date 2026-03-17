export type ProfileThemeName = 'default' | 'zombie';

export interface ProfileThemeTokens {
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
  statsTopGradient: readonly [string, string, ...string[]];
  statLabels: [string, string, string];
  memberSinceColor: string;
  muted: string;
  verifiedBg: string;
  verifiedText: string;
  verifiedLabel: string;
  bioBorderColor: string;
  bioBg: string;
  followBtnBg: string;
  followBtnTextColor: string;
  iconBtnBg: string;
  iconBtnBorder: string;
  tabActiveBg: string;
  tabActiveBorder: string;
  tabActiveText: string;
  avatarBorderColor: string;
  shadowColor: string;
  statusText: string;
  playCircleBg: string;
  dividerColor: string;
  followingBarBorder: string;
  followingLabelColor: string;
}

const DEFAULT_THEME: ProfileThemeTokens = {
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
  statsTopGradient: ['#00bba7', '#000'],
  statLabels: ['Uploads', 'Followers', 'Following'],
  memberSinceColor: '#00d5be',
  muted: '#62748e',
  verifiedBg: '#3B82F6',
  verifiedText: '#FFFFFF',
  verifiedLabel: '',
  bioBorderColor: '#00bba7',
  bioBg: '#00bba70d',
  followBtnBg: '#4ADE80',
  followBtnTextColor: '#022c22',
  iconBtnBg: '#00bba71a',
  iconBtnBorder: '#00bba766',
  tabActiveBg: '#4ADE8020',
  tabActiveBorder: '#4ADE8060',
  tabActiveText: '#4ADE80',
  avatarBorderColor: '#4ADE80',
  shadowColor: '#4ADE80',
  statusText: '',
  playCircleBg: '#00bc7d',
  dividerColor: '#00bba733',
  followingBarBorder: '#00bba733',
  followingLabelColor: '#00d5be',
};

const ZOMBIE_THEME: ProfileThemeTokens = {
  bg: '#0a0c0a',
  navBg: 'rgba(10,12,10,0.95)',
  navBorderColor: '#35530e4d',
  accent: '#9ae600',
  accentGlow: '#84cc1626',
  accentDark: '#3c6300',
  accentMuted: '#7ccf0033',
  accentFaint: '#7ccf000d',
  cardBg: '#1a1d1a',
  cardBorder: '#7ccf004d',
  statsTopGradient: ['#84cc16', '#000'],
  statLabels: ['Bio-Data', 'Survivors', 'Tracking'],
  memberSinceColor: '#9ae600',
  muted: '#62748e',
  verifiedBg: '#7ccf00',
  verifiedText: '#3c6300',
  verifiedLabel: 'Bio-Signature Verified',
  bioBorderColor: '#7ccf00',
  bioBg: '#7ccf000d',
  followBtnBg: '#9ae600',
  followBtnTextColor: '#3c6300',
  iconBtnBg: '#7ccf001a',
  iconBtnBorder: '#7ccf004d',
  tabActiveBg: '#9ae60020',
  tabActiveBorder: '#9ae60060',
  tabActiveText: '#9ae600',
  avatarBorderColor: '#9ae600',
  shadowColor: '#84cc16',
  statusText: 'System: Online',
  playCircleBg: '#7ccf00',
  dividerColor: '#7ccf0033',
  followingBarBorder: '#7ccf0033',
  followingLabelColor: '#9ae600',
};

export const PROFILE_THEMES: Record<ProfileThemeName, ProfileThemeTokens> = {
  default: DEFAULT_THEME,
  zombie: ZOMBIE_THEME,
};

export function getProfileTheme(themeName?: string | null): ProfileThemeTokens {
  if (themeName === 'zombie') return ZOMBIE_THEME;
  return DEFAULT_THEME;
}
