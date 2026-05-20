import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used inside ThemeProvider');
  }

  return context;
}
