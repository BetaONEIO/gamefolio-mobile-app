import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';

export interface FontStyle {
  id: string;
  name: string;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  italic?: boolean;
}

export interface EffectStyle {
  id: string;
  name: string;
  category: 'gradient' | 'gaming' | 'classic' | 'special' | 'none';
  gradientColors?: string[];
  gradientLocations?: number[];
  gradientStart?: { x: number; y: number };
  gradientEnd?: { x: number; y: number };
  textShadow?: {
    color: string;
    offset: { width: number; height: number };
    radius: number;
  };
  defaultColor?: string;
}

export const FONT_STYLES: FontStyle[] = [
  { id: 'default', name: 'Default', fontWeight: 'bold' },
  { id: 'serif', name: 'Serif', fontFamily: 'serif', fontWeight: 'bold' },
  { id: 'sans', name: 'Sans Serif', fontFamily: 'sans-serif', fontWeight: 'bold' },
  { id: 'mono', name: 'Monospace', fontFamily: 'monospace', fontWeight: 'bold' },
  { id: 'times', name: 'Times', fontFamily: 'Times New Roman', fontWeight: 'bold' },
  { id: 'georgia', name: 'Georgia', fontFamily: 'Georgia', fontWeight: 'bold' },
  { id: 'courier', name: 'Courier', fontFamily: 'Courier', fontWeight: 'bold' },
  { id: 'helvetica', name: 'Helvetica', fontFamily: 'Helvetica', fontWeight: 'bold' },
  { id: 'arial', name: 'Arial', fontFamily: 'Arial', fontWeight: 'bold' },
  { id: 'verdana', name: 'Verdana', fontFamily: 'Verdana', fontWeight: 'bold' },
  { id: 'tahoma', name: 'Tahoma', fontFamily: 'Tahoma', fontWeight: 'bold' },
  { id: 'trebuchet', name: 'Trebuchet', fontFamily: 'Trebuchet MS', fontWeight: 'bold' },
  { id: 'impact', name: 'Impact', fontFamily: 'Impact', fontWeight: 'bold', textTransform: 'uppercase' },
  { id: 'palatino', name: 'Palatino', fontFamily: 'Palatino', fontWeight: 'bold' },
  { id: 'garamond', name: 'Garamond', fontFamily: 'Garamond', fontWeight: 'bold' },
  { id: 'bookman', name: 'Bookman', fontFamily: 'Bookman', fontWeight: 'bold' },
  { id: 'avantgarde', name: 'Avant Garde', fontFamily: 'Avant Garde', fontWeight: 'bold', letterSpacing: 2 },
  { id: 'optima', name: 'Optima', fontFamily: 'Optima', fontWeight: 'bold' },
  { id: 'futura', name: 'Futura', fontFamily: 'Futura', fontWeight: 'bold' },
  { id: 'gill', name: 'Gill Sans', fontFamily: 'Gill Sans', fontWeight: 'bold' },
  { id: 'century', name: 'Century', fontFamily: 'Century Gothic', fontWeight: 'bold' },
  { id: 'didot', name: 'Didot', fontFamily: 'Didot', fontWeight: 'bold', italic: true },
  { id: 'baskerville', name: 'Baskerville', fontFamily: 'Baskerville', fontWeight: 'bold' },
  { id: 'cochin', name: 'Cochin', fontFamily: 'Cochin', fontWeight: 'bold' },
  { id: 'copperplate', name: 'Copperplate', fontFamily: 'Copperplate', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  { id: 'papyrus', name: 'Papyrus', fontFamily: 'Papyrus', fontWeight: 'bold' },
  { id: 'marker', name: 'Marker Felt', fontFamily: 'Marker Felt', fontWeight: 'bold' },
  { id: 'chalkboard', name: 'Chalkboard', fontFamily: 'Chalkboard SE', fontWeight: 'bold' },
  { id: 'snell', name: 'Snell', fontFamily: 'Snell Roundhand', fontWeight: 'bold', italic: true },
  { id: 'american', name: 'American', fontFamily: 'American Typewriter', fontWeight: 'bold' },
  { id: 'noteworthy', name: 'Noteworthy', fontFamily: 'Noteworthy', fontWeight: 'bold' },
];

export const EFFECT_STYLES: EffectStyle[] = [
  { id: 'none', name: 'None', category: 'none' },
  {
    id: 'rainbow',
    name: 'Rainbow',
    category: 'gradient',
    gradientColors: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
  },
  {
    id: 'fire',
    name: 'Fire',
    category: 'gradient',
    gradientColors: ['#FF4500', '#FF6B00', '#FFD700', '#FF4500'],
    gradientStart: { x: 0, y: 1 },
    gradientEnd: { x: 0, y: 0 },
    textShadow: { color: '#FF4500', offset: { width: 0, height: 2 }, radius: 8 },
  },
  {
    id: 'ice',
    name: 'Ice',
    category: 'gradient',
    gradientColors: ['#00FFFF', '#87CEEB', '#E0FFFF', '#00BFFF'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 1 },
    textShadow: { color: '#00FFFF', offset: { width: 0, height: 1 }, radius: 6 },
  },
  {
    id: 'neon_pink',
    name: 'Neon Pink',
    category: 'gradient',
    gradientColors: ['#FF00FF', '#FF69B4', '#FF1493'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
    textShadow: { color: '#FF00FF', offset: { width: 0, height: 0 }, radius: 15 },
  },
  {
    id: 'neon_green',
    name: 'Neon Green',
    category: 'gradient',
    gradientColors: ['#39FF14', '#00FF00', '#7FFF00'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
    textShadow: { color: '#39FF14', offset: { width: 0, height: 0 }, radius: 15 },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    category: 'gradient',
    gradientColors: ['#0077B6', '#00B4D8', '#90E0EF', '#CAF0F8'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 1 },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    category: 'gradient',
    gradientColors: ['#FF512F', '#F09819', '#FF5E62'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
  },
  {
    id: 'purple_haze',
    name: 'Purple Haze',
    category: 'gradient',
    gradientColors: ['#7F00FF', '#E100FF', '#7F00FF'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
    textShadow: { color: '#7F00FF', offset: { width: 0, height: 2 }, radius: 10 },
  },
  {
    id: 'gold',
    name: 'Gold',
    category: 'gradient',
    gradientColors: ['#BF953F', '#FCF6BA', '#B38728', '#FBF5B7', '#AA771C'],
    gradientLocations: [0, 0.25, 0.5, 0.75, 1],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 1 },
  },
  {
    id: 'silver',
    name: 'Silver',
    category: 'gradient',
    gradientColors: ['#C0C0C0', '#E8E8E8', '#A8A8A8', '#D8D8D8'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 1 },
  },

  {
    id: 'runescape_flash1',
    name: 'RS Flash',
    category: 'gaming',
    gradientColors: ['#FF0000', '#FFFF00'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
    textShadow: { color: '#000000', offset: { width: 1, height: 1 }, radius: 0 },
  },
  {
    id: 'runescape_glow1',
    name: 'RS Glow',
    category: 'gaming',
    gradientColors: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
    textShadow: { color: '#000000', offset: { width: 1, height: 1 }, radius: 0 },
  },

  {
    id: 'fortnite',
    name: 'Fortnite',
    category: 'gaming',
    gradientColors: ['#FFD700', '#FFA500'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 0, y: 1 },
  },
  {
    id: 'powerpoint_blue',
    name: 'PowerPoint',
    category: 'classic',
    gradientColors: ['#1E3A8A', '#3B82F6', '#60A5FA'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 0, y: 1 },
    textShadow: { color: '#1E3A8A', offset: { width: 2, height: 2 }, radius: 4 },
  },
  {
    id: 'wordart_rainbow',
    name: 'WordArt',
    category: 'classic',
    gradientColors: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8B00FF'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
    textShadow: { color: '#000000', offset: { width: 2, height: 2 }, radius: 2 },
  },
  {
    id: 'wordart_metallic',
    name: 'Chrome',
    category: 'classic',
    gradientColors: ['#757575', '#D4D4D4', '#757575', '#D4D4D4', '#757575'],
    gradientLocations: [0, 0.25, 0.5, 0.75, 1],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 0, y: 1 },
    textShadow: { color: '#000000', offset: { width: 1, height: 2 }, radius: 3 },
  },
  {
    id: 'retro_80s',
    name: 'Retro 80s',
    category: 'classic',
    gradientColors: ['#FF00FF', '#00FFFF'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
    textShadow: { color: '#FF00FF', offset: { width: 3, height: 3 }, radius: 0 },
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    category: 'classic',
    gradientColors: ['#FF6AD5', '#C774E8', '#AD8CFF', '#8795E8', '#94D0FF'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
  },
  {
    id: 'glitch',
    name: 'Glitch',
    category: 'special',
    gradientColors: ['#FF0000', '#00FF00', '#0000FF'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
    textShadow: { color: '#FF0000', offset: { width: -2, height: 0 }, radius: 0 },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    category: 'special',
    gradientColors: ['#FCEE0A', '#F9E400'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 0 },
    textShadow: { color: '#00D4FF', offset: { width: 2, height: 2 }, radius: 0 },
  },
  {
    id: 'matrix',
    name: 'Matrix',
    category: 'special',
    defaultColor: '#00FF00',
    textShadow: { color: '#00FF00', offset: { width: 0, height: 0 }, radius: 10 },
  },
  {
    id: 'blood',
    name: 'Blood',
    category: 'special',
    gradientColors: ['#8B0000', '#DC143C', '#8B0000'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 0, y: 1 },
    textShadow: { color: '#000000', offset: { width: 1, height: 2 }, radius: 3 },
  },
  {
    id: 'toxic',
    name: 'Toxic',
    category: 'special',
    gradientColors: ['#ADFF2F', '#32CD32', '#006400'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 0, y: 1 },
    textShadow: { color: '#ADFF2F', offset: { width: 0, height: 0 }, radius: 8 },
  },
  {
    id: 'holographic',
    name: 'Holographic',
    category: 'special',
    gradientColors: ['#FF69B4', '#87CEEB', '#98FB98', '#DDA0DD', '#87CEEB'],
    gradientLocations: [0, 0.25, 0.5, 0.75, 1],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 1 },
  },
  {
    id: 'neon_glow',
    name: 'Neon Glow',
    category: 'special',
    defaultColor: '#00FFFF',
    textShadow: { color: '#00FFFF', offset: { width: 0, height: 0 }, radius: 20 },
  },
  {
    id: 'shadow_drop',
    name: 'Shadow Drop',
    category: 'special',
    defaultColor: '#FFFFFF',
    textShadow: { color: '#000000', offset: { width: 4, height: 4 }, radius: 0 },
  },
  {
    id: 'outline',
    name: 'Outline',
    category: 'special',
    defaultColor: '#FFFFFF',
    textShadow: { color: '#000000', offset: { width: 0, height: 0 }, radius: 0 },
  },
  {
    id: 'soft_shadow',
    name: 'Soft Shadow',
    category: 'special',
    defaultColor: '#FFFFFF',
    textShadow: { color: 'rgba(0, 0, 0, 0.5)', offset: { width: 2, height: 2 }, radius: 10 },
  },
  {
    id: 'long_shadow',
    name: 'Long Shadow',
    category: 'special',
    defaultColor: '#FFFFFF',
    textShadow: { color: 'rgba(0, 0, 0, 0.6)', offset: { width: 8, height: 8 }, radius: 0 },
  },
  {
    id: 'inner_shadow',
    name: 'Inner Shadow',
    category: 'special',
    defaultColor: '#CCCCCC',
    textShadow: { color: '#000000', offset: { width: -1, height: -1 }, radius: 2 },
  },
  {
    id: 'embossed',
    name: 'Embossed',
    category: 'special',
    defaultColor: '#DDDDDD',
    textShadow: { color: '#FFFFFF', offset: { width: 1, height: 1 }, radius: 0 },
  },
  {
    id: 'debossed',
    name: 'Debossed',
    category: 'special',
    defaultColor: '#AAAAAA',
    textShadow: { color: '#000000', offset: { width: 1, height: 1 }, radius: 1 },
  },
  {
    id: 'bevel',
    name: 'Bevel',
    category: 'special',
    defaultColor: '#FFFFFF',
    textShadow: { color: '#FFFFFF', offset: { width: -1, height: -1 }, radius: 0 },
  },
  {
    id: 'extruded',
    name: 'Extruded (3D)',
    category: 'special',
    defaultColor: '#FFFFFF',
    textShadow: { color: '#000000', offset: { width: 3, height: 3 }, radius: 0 },
  },
  {
    id: 'layered_depth',
    name: 'Layered Depth',
    category: 'special',
    defaultColor: '#FFFFFF',
    textShadow: { color: 'rgba(0, 0, 0, 0.3)', offset: { width: 1, height: 1 }, radius: 2 },
  },
  {
    id: 'floating',
    name: 'Floating',
    category: 'special',
    defaultColor: '#FFFFFF',
    textShadow: { color: 'rgba(0, 0, 0, 0.4)', offset: { width: 0, height: 6 }, radius: 12 },
  },
  {
    id: 'glass',
    name: 'Glass',
    category: 'special',
    defaultColor: 'rgba(255, 255, 255, 0.3)',
    textShadow: { color: 'rgba(255, 255, 255, 0.5)', offset: { width: 0, height: 1 }, radius: 3 },
  },
  {
    id: 'frosted',
    name: 'Frosted',
    category: 'special',
    defaultColor: 'rgba(255, 255, 255, 0.7)',
    textShadow: { color: 'rgba(255, 255, 255, 0.3)', offset: { width: 0, height: 0 }, radius: 8 },
  },
  {
    id: 'inner_highlight',
    name: 'Inner Highlight',
    category: 'special',
    defaultColor: '#EEEEEE',
    textShadow: { color: '#FFFFFF', offset: { width: 0, height: -1 }, radius: 2 },
  },
  {
    id: 'isometric',
    name: 'Isometric',
    category: 'special',
    defaultColor: '#FFFFFF',
    textShadow: { color: 'rgba(0, 0, 0, 0.5)', offset: { width: 4, height: -4 }, radius: 0 },
  },
  {
    id: 'inverted',
    name: 'Inverted',
    category: 'special',
    defaultColor: '#000000',
  },
  {
    id: 'text_bg_block',
    name: 'Background Block',
    category: 'special',
    defaultColor: '#FFFFFF',
  },
  {
    id: 'metallic',
    name: 'Metallic',
    category: 'gradient',
    gradientColors: ['#808080', '#C0C0C0', '#808080', '#E8E8E8', '#808080'],
    gradientLocations: [0, 0.25, 0.5, 0.75, 1],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 1 },
    textShadow: { color: 'rgba(255, 255, 255, 0.5)', offset: { width: 0, height: 1 }, radius: 2 },
  },
  {
    id: 'neon',
    name: 'Neon',
    category: 'special',
    defaultColor: '#00FFFF',
    textShadow: { color: '#00FFFF', offset: { width: 0, height: 0 }, radius: 25 },
  },
  {
    id: 'stroke',
    name: 'Stroke',
    category: 'special',
    defaultColor: '#FFFFFF',
    textShadow: { color: '#000000', offset: { width: 0, height: 0 }, radius: 1 },
  },
  {
    id: 'copper',
    name: 'Copper',
    category: 'gradient',
    gradientColors: ['#B87333', '#DA8A67', '#C87533', '#D4A574'],
    gradientLocations: [0, 0.33, 0.66, 1],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 1 },
  },
  {
    id: 'bronze',
    name: 'Bronze',
    category: 'gradient',
    gradientColors: ['#804A00', '#CD7F32', '#A0522D', '#CD853F'],
    gradientLocations: [0, 0.33, 0.66, 1],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 1 },
  },
  {
    id: 'platinum',
    name: 'Platinum',
    category: 'gradient',
    gradientColors: ['#E5E4E2', '#F5F5F5', '#D3D3D3', '#E8E8E8'],
    gradientStart: { x: 0, y: 0 },
    gradientEnd: { x: 1, y: 1 },
  },
];

export interface TextStyle {
  id: string;
  name: string;
  category: 'gradient' | 'classic' | 'gaming' | 'special' | 'fonts';
  gradientColors?: string[];
  gradientLocations?: number[];
  gradientStart?: { x: number; y: number };
  gradientEnd?: { x: number; y: number };
  textColor?: string;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textShadow?: {
    color: string;
    offset: { width: number; height: number };
    radius: number;
  };
  strokeColor?: string;
  strokeWidth?: number;
  italic?: boolean;
  fontFamily?: string;
}

export const TEXT_STYLES: TextStyle[] = [
  { id: 'default', name: 'Default', category: 'classic', textColor: '#FFFFFF', fontWeight: 'bold' },
  ...FONT_STYLES.filter(f => f.id !== 'default').map(f => ({
    id: `font_${f.id}`,
    name: f.name,
    category: 'fonts' as const,
    textColor: '#FFFFFF',
    fontWeight: f.fontWeight,
    fontFamily: f.fontFamily,
    letterSpacing: f.letterSpacing,
    textTransform: f.textTransform,
    italic: f.italic,
  })),
  ...EFFECT_STYLES.filter(e => e.id !== 'none').map(e => ({
    id: e.id,
    name: e.name,
    category: e.category === 'none' ? 'classic' as const : e.category,
    gradientColors: e.gradientColors,
    gradientLocations: e.gradientLocations,
    gradientStart: e.gradientStart,
    gradientEnd: e.gradientEnd,
    textColor: e.defaultColor,
    textShadow: e.textShadow,
    fontWeight: 'bold' as const,
  })),
];

export interface TextStyleConfig {
  fontId: string;
  effectId: string;
  customColor: string;
}

interface StyledUsernameProps {
  username: string;
  textStyleId?: string;
  textStyle?: TextStyle;
  textStyleConfig?: TextStyleConfig;
  fontSize?: number;
  style?: any;
}

export default function StyledUsername({ 
  username, 
  textStyleId = 'default',
  textStyle: customTextStyle,
  textStyleConfig,
  fontSize = 26,
  style,
}: StyledUsernameProps) {
  let fontConfig: FontStyle = FONT_STYLES[0];
  let effectConfig: EffectStyle = EFFECT_STYLES[0];
  let textColor = '#FFFFFF';

  if (textStyleConfig) {
    fontConfig = FONT_STYLES.find(f => f.id === textStyleConfig.fontId) || FONT_STYLES[0];
    effectConfig = EFFECT_STYLES.find(e => e.id === textStyleConfig.effectId) || EFFECT_STYLES[0];
    textColor = textStyleConfig.customColor || '#FFFFFF';
  } else if (customTextStyle) {
    fontConfig = {
      id: 'custom',
      name: 'Custom',
      fontFamily: customTextStyle.fontFamily,
      fontWeight: customTextStyle.fontWeight,
      letterSpacing: customTextStyle.letterSpacing,
      textTransform: customTextStyle.textTransform,
      italic: customTextStyle.italic,
    };
    effectConfig = {
      id: 'custom',
      name: 'Custom',
      category: customTextStyle.category === 'fonts' ? 'none' : customTextStyle.category,
      gradientColors: customTextStyle.gradientColors,
      gradientLocations: customTextStyle.gradientLocations,
      gradientStart: customTextStyle.gradientStart,
      gradientEnd: customTextStyle.gradientEnd,
      textShadow: customTextStyle.textShadow,
      defaultColor: customTextStyle.textColor,
    };
    textColor = customTextStyle.textColor || '#FFFFFF';
  } else {
    const legacyStyle = TEXT_STYLES.find(s => s.id === textStyleId) || TEXT_STYLES[0];
    fontConfig = {
      id: legacyStyle.id,
      name: legacyStyle.name,
      fontFamily: legacyStyle.fontFamily,
      fontWeight: legacyStyle.fontWeight,
      letterSpacing: legacyStyle.letterSpacing,
      textTransform: legacyStyle.textTransform,
      italic: legacyStyle.italic,
    };
    effectConfig = {
      id: legacyStyle.id,
      name: legacyStyle.name,
      category: legacyStyle.category === 'fonts' ? 'none' : legacyStyle.category,
      gradientColors: legacyStyle.gradientColors,
      gradientLocations: legacyStyle.gradientLocations,
      gradientStart: legacyStyle.gradientStart,
      gradientEnd: legacyStyle.gradientEnd,
      textShadow: legacyStyle.textShadow,
      defaultColor: legacyStyle.textColor,
    };
    textColor = legacyStyle.textColor || '#FFFFFF';
  }

  const baseTextStyle = {
    fontSize,
    fontWeight: fontConfig.fontWeight || ('bold' as const),
    letterSpacing: fontConfig.letterSpacing,
    textTransform: fontConfig.textTransform,
    fontStyle: fontConfig.italic ? ('italic' as const) : ('normal' as const),
    fontFamily: fontConfig.fontFamily,
    ...(effectConfig.textShadow && {
      textShadowColor: effectConfig.textShadow.color,
      textShadowOffset: effectConfig.textShadow.offset,
      textShadowRadius: effectConfig.textShadow.radius,
    }),
  };

  if (effectConfig.gradientColors && effectConfig.gradientColors.length > 0) {
    return (
      <MaskedView
        style={[styles.container, style]}
        maskElement={
          <Text style={[styles.text, baseTextStyle]}>
            {username}
          </Text>
        }
      >
        <LinearGradient
          colors={effectConfig.gradientColors as [string, string, ...string[]]}
          locations={effectConfig.gradientLocations as [number, number, ...number[]] | undefined}
          start={effectConfig.gradientStart || { x: 0, y: 0 }}
          end={effectConfig.gradientEnd || { x: 1, y: 0 }}
          style={styles.gradient}
        >
          <Text style={[styles.text, baseTextStyle, { opacity: 0 }]}>
            {username}
          </Text>
        </LinearGradient>
      </MaskedView>
    );
  }

  const finalColor = effectConfig.defaultColor || textColor;

  return (
    <Text 
      style={[
        styles.text, 
        baseTextStyle, 
        { color: finalColor },
        style,
      ]}
    >
      {username}
    </Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  text: {
    color: '#FFFFFF',
  },
  gradient: {
    flex: 1,
  },
});
