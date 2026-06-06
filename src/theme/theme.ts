import { colors, ThemeColors } from './colors';

export const ALLOWED_THEME_MODES = [
  'neutral_gray',
  'wallety_classic',
  'ocean_breeze',
  'midnight_ocean',
  'sunset_clay',
  'graphite_steel',
] as const;

export type ThemeMode = (typeof ALLOWED_THEME_MODES)[number];
export type ResolvedThemeMode = 'light' | 'dark';

export const THEME_OPTIONS: Array<{ label: string; value: ThemeMode }> = [
  { label: 'Neutre Gris', value: 'neutral_gray' },
  { label: 'Classique', value: 'wallety_classic' },
  { label: 'Ocean', value: 'ocean_breeze' },
  { label: 'Ocean Nuit', value: 'midnight_ocean' },
  { label: 'Coucher Sable', value: 'sunset_clay' },
  { label: 'Graphite Acier', value: 'graphite_steel' },
];

export const THEME_RESOLVED_MODE: Record<ThemeMode, ResolvedThemeMode> = {
  neutral_gray: 'light',
  wallety_classic: 'light',
  ocean_breeze: 'light',
  midnight_ocean: 'dark',
  sunset_clay: 'light',
  graphite_steel: 'dark',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
};

export const typography = {
  familyRegular: 'Manrope_400Regular',
  familyMedium: 'Manrope_500Medium',
  familyBold: 'Manrope_700Bold',
  familyDisplay: 'SpaceGrotesk_700Bold',
  sizeXs: 12,
  sizeSm: 14,
  sizeMd: 16,
  sizeLg: 20,
  sizeXl: 28,
  sizeDisplay: 34,
};

export const shadows = {
  soft: {
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 26,
    elevation: 8,
  },
  card: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  lift: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 2,
  },
};

export interface AppTheme {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  shadows: typeof shadows;
}

export function buildTheme(mode: ThemeMode): AppTheme {
  const resolvedMode = THEME_RESOLVED_MODE[mode];
  return {
    mode,
    resolvedMode,
    colors: colors[mode],
    spacing,
    radius,
    typography,
    shadows,
  };
}
