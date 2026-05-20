import { Feather } from '@expo/vector-icons';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProjectionScreen } from '../screens/ProjectionScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const iconByRoute: Record<keyof MainTabParamList, keyof typeof Feather.glyphMap> = {
  Dashboard: 'home',
  Transactions: 'repeat',
  Projection: 'trending-up',
  Settings: 'sliders',
};

const titleByRoute: Record<keyof MainTabParamList, string> = {
  Dashboard: 'Apercu',
  Transactions: 'Mouvements',
  Projection: 'Projection',
  Settings: 'Reglages',
};

function WalletyTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { theme } = useAppTheme();

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.elevated,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.shadow,
          },
          theme.shadows.soft,
        ]}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const routeName = route.name as keyof MainTabParamList;
          const iconName = iconByRoute[routeName];
          const label = titleByRoute[routeName];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel}
              testID={descriptors[route.key]?.options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [
                styles.item,
                index === 1 && styles.itemBeforeCenter,
                index === 2 && styles.itemAfterCenter,
                isFocused && { backgroundColor: theme.colors.primarySoft },
                pressed && !isFocused && { opacity: 0.82 },
              ]}
            >
              <Feather
                name={iconName}
                size={22}
                color={isFocused ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.label,
                  {
                    color: isFocused ? theme.colors.primary : theme.colors.textMuted,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter un mouvement"
        onPress={() => navigation.getParent()?.navigate('AddTransaction' as never)}
        style={({ pressed }) => [
          styles.addButton,
          {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.elevated,
            shadowColor: theme.colors.shadow,
          },
          theme.shadows.soft,
          pressed && styles.addButtonPressed,
        ]}
      >
        <Feather name="plus" size={28} color={theme.colors.onPrimary} />
      </Pressable>
    </View>
  );
}

export function MainTabsNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <WalletyTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        title: titleByRoute[route.name as keyof MainTabParamList],
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Transactions" component={TransactionsScreen} />
      <Tab.Screen name="Projection" component={ProjectionScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  container: {
    height: 78,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  itemBeforeCenter: {
    marginRight: 26,
  },
  itemAfterCenter: {
    marginLeft: 26,
  },
  label: {
    fontSize: 11,
  },
  addButton: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 20,
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
});
