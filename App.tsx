import 'react-native-gesture-handler';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  SpaceGrotesk_700Bold,
  useFonts,
} from '@expo-google-fonts/space-grotesk';
import { AccountsProvider } from './src/context/AccountsContext';
import { AuthProvider } from './src/context/AuthContext';
import { GoalProvider } from './src/context/GoalContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
    SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <GoalProvider>
          <AccountsProvider>
            <AppNavigator />
          </AccountsProvider>
        </GoalProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
