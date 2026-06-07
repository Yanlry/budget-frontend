import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
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

const LOGO_SOURCE = require('../../assets/logo.png');
const BRAND_GREEN = '#0D6F4F';
const BRAND_GOLD = '#C9A24D';

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
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(10)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(16)).current;
  const isDark = theme.resolvedMode === 'dark';
  const logoSurface = isDark ? theme.colors.surface : '#FFFFFF';
  const logoGlow = isDark ? 'rgba(201, 162, 77, 0.16)' : 'rgba(201, 162, 77, 0.12)';

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(headerTranslateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(cardTranslateY, {
          toValue: 0,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [cardOpacity, cardTranslateY, headerOpacity, headerTranslateY]);

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
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.hero,
              {
                opacity: headerOpacity,
                transform: [{ translateY: headerTranslateY }],
              },
            ]}
          >
              <Image source={LOGO_SOURCE} style={styles.logo} resizeMode="contain" />
          </Animated.View>

          <Animated.View
            style={[
              styles.formCard,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.elevated,
                shadowColor: theme.colors.shadow,
                opacity: cardOpacity,
                transform: [{ translateY: cardTranslateY }],
              },
              theme.shadows.card,
            ]}
          >
            <View style={styles.cardHeader}>
              <Text
                style={[
                  styles.title,
                  {
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                <Text style={{ color: BRAND_GREEN }}>Simply</Text>
                <Text style={{ color: BRAND_GOLD }}>Rich</Text>
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
               Visualisez votre futur capital
              </Text>
            </View>

            <View style={styles.form}>
              <InputField
                label="Email"
                value={email}
                onChangeText={(value) => {
                  setError(null);
                  setEmail(value);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="ton@email.com"
              />
              <InputField
                label="Mot de passe"
                value={password}
                onChangeText={(value) => {
                  setError(null);
                  setPassword(value);
                }}
                secureTextEntry
                placeholder="Minimum 6 caracteres"
              />
              <InputField
                label="Confirmation"
                value={confirmPassword}
                onChangeText={(value) => {
                  setError(null);
                  setConfirmPassword(value);
                }}
                secureTextEntry
                placeholder="Confirme ton mot de passe"
              />

              {error ? (
                <View
                  style={[
                    styles.errorWrap,
                    {
                      backgroundColor: theme.colors.dangerSoft,
                    },
                  ]}
                >
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
                </View>
              ) : null}

              <AppButton
                title="Creer mon compte"
                onPress={() => void submit()}
                loading={loading}
                style={styles.submitButton}
              />
            </View>

            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={({ pressed }) => [
                styles.linkWrap,
                { opacity: pressed ? 0.68 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.linkPrefix,
                  {
                    color: theme.colors.textMuted,
                    fontFamily: theme.typography.familyRegular,
                  },
                ]}
              >
                Deja inscrit ?
              </Text>
              <Text
                style={[
                  styles.link,
                  {
                    color: BRAND_GOLD,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                Connexion
              </Text>
            </Pressable>
          </Animated.View>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 34,
    gap: 18,
  },
  hero: {
    alignItems: 'center',
    gap: 8,
  },
  logoFrame: {
    width: 88,
    height: 88,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoGlow: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
  },
  logo: {
    width: 152,
    height: 152,
  },
  brand: {
    marginTop: 4,
    fontSize: 24,
    letterSpacing: -0.4,
  },
  heroCaption: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 16,
    gap: 16,
  },
  cardHeader: {
    alignItems:"center",
    gap: 5,
    marginBottom:20
  },
  title: {
    fontSize: 34,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  form: {
    gap: 13,
  },
  errorWrap: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 17,
    marginTop: 2,
  },
  linkWrap: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  linkPrefix: {
    fontSize: 12,
  },
  link: {
    fontSize: 12,
  },
});
