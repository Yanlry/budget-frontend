import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppButton } from '../components/AppButton';
import { InputField } from '../components/InputField';
import { Screen } from '../components/Screen';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { AuthStackParamList } from '../navigation/types';

export function RegisterScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParamList, 'Register'>) {
  const { registerWithEmail } = useAuth();
  const { theme } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await registerWithEmail({ email, password });
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyDisplay,
                },
              ]}
            >
              Creer ton espace
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
              En quelques secondes, tu obtiens une projection claire de ton annee.
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
              Juste apres, on configure tes revenus et depenses recurrentes.
            </Text>
          </View>

          <View style={styles.form}>
            <InputField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <InputField
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <InputField
              label="Confirmer le mot de passe"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
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

            <AppButton
              title="Creer mon compte"
              onPress={() => void submit()}
              loading={loading}
            />

            <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkWrap}>
              <Text
                style={[
                  styles.link,
                  {
                    color: theme.colors.primary,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                J ai deja un compte
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 14,
  },
  header: {
    gap: 6,
  },
  title: {
    fontSize: 30,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
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
