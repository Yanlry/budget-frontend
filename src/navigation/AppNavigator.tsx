import {
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationDefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingView } from '../components/LoadingView';
import { Screen } from '../components/Screen';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { AddTransactionScreen } from '../screens/AddTransactionScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { TermsOfUseScreen } from '../screens/TermsOfUseScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainTabsNavigator } from './MainTabsNavigator';
import { RootStackParamList } from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { isInitializing, onboardingCompleted, isAuthenticated } = useAuth();
  const { theme, resolvedMode } = useAppTheme();

  const navigationTheme =
    resolvedMode === 'dark'
      ? {
          ...NavigationDarkTheme,
          colors: {
            ...NavigationDarkTheme.colors,
            background: theme.colors.background,
            card: theme.colors.card,
            border: theme.colors.border,
            text: theme.colors.text,
            primary: theme.colors.primary,
          },
        }
      : {
          ...NavigationDefaultTheme,
          colors: {
            ...NavigationDefaultTheme.colors,
            background: theme.colors.background,
            card: theme.colors.card,
            border: theme.colors.border,
            text: theme.colors.text,
            primary: theme.colors.primary,
          },
        };

  if (isInitializing) {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : !onboardingCompleted ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <RootStack.Screen name="MainTabs" component={MainTabsNavigator} />
            <RootStack.Screen
              name="PrivacyPolicy"
              component={PrivacyPolicyScreen}
              options={{
                headerShown: false,
              }}
            />
            <RootStack.Screen
              name="TermsOfUse"
              component={TermsOfUseScreen}
              options={{
                headerShown: false,
              }}
            />
            <RootStack.Screen
              name="AddTransaction"
              component={AddTransactionScreen}
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
