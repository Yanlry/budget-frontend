import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { InputField } from '../components/InputField';
import { Screen } from '../components/Screen';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { AuthStackParamList } from '../navigation/types';

export function LoginScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParamList, 'Login'>) {
  const { loginWithEmail } = useAuth();
  const { theme } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setError(null);

    try {
      await loginWithEmail(email, password);
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={[theme.colors.soft, theme.colors.surfaceSoft, theme.colors.backgroundAlt]}
          style={[
            styles.hero,
            {
              borderColor: theme.colors.border,
              shadowColor: theme.colors.shadow,
            },
            theme.shadows.card,
          ]}
        >
          <Text
            style={[
              styles.brand,
              {
                color: theme.colors.primary,
                fontFamily: theme.typography.familyDisplay,
              },
            ]}
          >
            Wallety
          </Text>
          <Text
            style={[
              styles.title,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Bon retour.
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color: theme.colors.textMuted,
                fontFamily: theme.typography.familyRegular,
              },
            ]}
          >
            Ouvre ton tableau de bord et vois tout de suite ce qu il te reste.
          </Text>
        </LinearGradient>

        <View style={styles.form}>
          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="ton@email.com"
          />
          <InputField
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Ton mot de passe"
          />

          {error ? (
            <Text
              style={[
                styles.error,
                {
                  color: theme.colors.danger,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              {error}
            </Text>
          ) : null}

          <AppButton title="Se connecter" onPress={() => void submit()} loading={loading} />

          <Pressable onPress={() => navigation.navigate('Register')} style={styles.linkWrap}>
            <Text
              style={[
                styles.link,
                {
                  color: theme.colors.primary,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              Creer un compte
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  hero: {
    marginTop: 14,
    marginHorizontal: 14,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 5,
  },
  brand: {
    fontSize: 28,
  },
  title: {
    fontSize: 26,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    padding: 20,
    gap: 14,
  },
  error: {
    fontSize: 13,
  },
  linkWrap: {
    marginTop: 2,
    alignItems: 'center',
  },
  link: {
    fontSize: 14,
  },
});
