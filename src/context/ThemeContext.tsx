import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { colors } from '../theme/colors';
import {
  ALLOWED_THEME_MODES,
  AppTheme,
  buildTheme,
  ResolvedThemeMode,
  ThemeMode,
} from '../theme/theme';

const THEME_MODE_KEY = 'budget_app_theme_mode';
const DEFAULT_THEME_MODE: ThemeMode = 'wallety_classic';
const ALLOWED_THEME_MODE_SET = new Set<string>(ALLOWED_THEME_MODES);

function normalizeThemeMode(rawValue: string): ThemeMode {
  if (ALLOWED_THEME_MODE_SET.has(rawValue)) {
    return rawValue as ThemeMode;
  }

  // Legacy migration from old themes and old light/dark/system setup.
  const legacyMap: Record<string, ThemeMode> = {
    light: 'wallety_classic',
    system: 'wallety_classic',
    dark: 'midnight_ocean',
    wallety_night: 'midnight_ocean',
    forest_mint: 'ocean_breeze',
    pine_nocturne: 'midnight_ocean',
    ember_night: 'graphite_steel',
    rose_dawn: 'sunset_clay',
  };

  return legacyMap[rawValue] ?? DEFAULT_THEME_MODE;
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  theme: AppTheme;
  setMode: (mode: ThemeMode) => Promise<void>;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);

  useEffect(() => {
    AsyncStorage.getItem(THEME_MODE_KEY)
      .then((value) => {
        if (!value) {
          return;
        }

        if (value in colors) {
          const normalized = normalizeThemeMode(value);
          setModeState(normalized);
          void AsyncStorage.setItem(THEME_MODE_KEY, normalized);
        }
      })
      .catch(() => {
        // Ignore storage read failures.
      });
  }, []);

  const theme = useMemo(() => buildTheme(mode), [mode]);
  const resolvedMode: ResolvedThemeMode = theme.resolvedMode;

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    await AsyncStorage.setItem(THEME_MODE_KEY, nextMode);
  }, []);

  const value = useMemo(
    () => ({
      mode,
      resolvedMode,
      theme,
      setMode,
    }),
    [mode, resolvedMode, setMode, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
