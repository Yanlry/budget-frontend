import { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

export function Screen({ children }: { children: ReactNode }) {
  const { theme } = useAppTheme();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <StatusBar
        barStyle={theme.resolvedMode === 'dark' ? 'light-content' : 'dark-content'}
      />
      <View style={styles.textureLayer} pointerEvents="none">
        <LinearGradient
          colors={[theme.colors.background, theme.colors.backgroundAlt]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.orbTop, { backgroundColor: theme.colors.textureA }]} />
        <View style={[styles.orbBottom, { backgroundColor: theme.colors.textureB }]} />
      </View>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  textureLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orbTop: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 220,
    top: -90,
    right: -70,
  },
  orbBottom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 260,
    bottom: -140,
    left: -130,
  },
});
