import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as AppleAuthentication from 'expo-apple-authentication';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
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

function isEmailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function LoginScreen({
  navigation,
}: NativeStackScreenProps<AuthStackParamList, 'Login'>) {
  const { loginWithApple, loginWithEmail } = useAuth();
  const { theme } = useAppTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailTrimmed = email.trim();
  const isSubmitting = loading || appleLoading;
  const canSubmit = isEmailValid(emailTrimmed) && password.length >= 6 && !isSubmitting;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(10)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(16)).current;
  const toneBarOpacity = useRef(new Animated.Value(0)).current;
  const toneBarScaleX = useRef(new Animated.Value(0.92)).current;
  const submitScale = useRef(new Animated.Value(0.98)).current;

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
        Animated.timing(toneBarOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(toneBarScaleX, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(submitScale, {
          toValue: 1,
          damping: 16,
          stiffness: 220,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [
    cardOpacity,
    cardTranslateY,
    headerOpacity,
    headerTranslateY,
    submitScale,
    toneBarOpacity,
    toneBarScaleX,
  ]);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setAppleAvailable(false);
      return;
    }

    let isMounted = true;

    const checkAppleAuthAvailability = async () => {
      try {
        const available = await AppleAuthentication.isAvailableAsync();
        if (isMounted) {
          setAppleAvailable(available);
        }
      } catch (_error) {
        if (isMounted) {
          setAppleAvailable(false);
        }
      }
    };

    void checkAppleAuthAvailability();

    return () => {
      isMounted = false;
    };
  }, []);

  const submit = async () => {
    if (!canSubmit) {
      setError('Renseigne un email valide et un mot de passe (6 caracteres minimum).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loginWithEmail(emailTrimmed, password);
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const submitApple = async () => {
    if (Platform.OS !== 'ios' || !appleAvailable || isSubmitting) {
      return;
    }

    setAppleLoading(true);
    setError(null);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Impossible de recuperer le token Apple.');
      }

      const firstName = credential.fullName?.givenName?.trim();
      const lastName = credential.fullName?.familyName?.trim();
      const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

      await loginWithApple({
        identityToken: credential.identityToken,
        email: credential.email ?? undefined,
        fullName: fullName || undefined,
      });
    } catch (submitError) {
      const code = (submitError as { code?: string }).code;
      if (code === 'ERR_REQUEST_CANCELED') {
        return;
      }

      setError((submitError as Error).message || 'Connexion Apple indisponible.');
    } finally {
      setAppleLoading(false);
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
          <Animated.View
            style={[
              styles.header,
              {
                opacity: headerOpacity,
                transform: [{ translateY: headerTranslateY }],
              },
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
              SimplyRich
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
              Connexion
            </Text>
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
            <Animated.View
              style={[
                styles.formToneBarMotion,
                {
                  opacity: toneBarOpacity,
                  transform: [{ scaleX: toneBarScaleX }],
                },
              ]}
            >
              <LinearGradient
                colors={[theme.colors.surfaceSoft, theme.colors.elevated]}
                style={[styles.formToneBar, { borderColor: theme.colors.border }]}
              />
            </Animated.View>

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
                placeholder="Ton mot de passe"
              />

              {error ? (
                <View
                  style={[
                    styles.errorWrap,
                    {
                      borderColor: theme.colors.dangerSoft,
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

              <Animated.View
                style={[
                  styles.submitButtonMotion,
                  {
                    transform: [{ scale: submitScale }],
                  },
                ]}
              >
                <AppButton
                  title="Se connecter"
                  onPress={() => void submit()}
                  loading={loading}
                  disabled={!canSubmit}
                  style={styles.submitButton}
                />
              </Animated.View>

              {appleAvailable ? (
                <View style={styles.appleSection}>
                  <View style={styles.separatorRow}>
                    <View
                      style={[
                        styles.separatorLine,
                        { backgroundColor: theme.colors.border },
                      ]}
                    />
                    <Text
                      style={[
                        styles.separatorLabel,
                        {
                          color: theme.colors.textMuted,
                          fontFamily: theme.typography.familyMedium,
                        },
                      ]}
                    >
                      ou
                    </Text>
                    <View
                      style={[
                        styles.separatorLine,
                        { backgroundColor: theme.colors.border },
                      ]}
                    />
                  </View>

                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={
                      AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                    }
                    buttonStyle={
                      theme.resolvedMode === 'dark'
                        ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                        : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                    }
                    cornerRadius={14}
                    style={[
                      styles.appleButton,
                      isSubmitting ? styles.appleButtonDisabled : null,
                    ]}
                    onPress={() => void submitApple()}
                  />

                  <Text
                    style={[
                      styles.appleHint,
                      {
                        color: theme.colors.textMuted,
                        fontFamily: theme.typography.familyRegular,
                      },
                    ]}
                  >
                    Apple te laisse choisir de partager ou masquer ton email via
                    Relais prive.
                  </Text>
                </View>
              ) : null}
            </View>

            <Pressable
              onPress={() => navigation.navigate('Register')}
              style={styles.linkWrap}
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
                Nouveau sur SimplyRich ?
              </Text>
              <Text
                style={[
                  styles.link,
                  {
                    color: theme.colors.primary,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                Creer un compte
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
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 34,
    gap: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 4,
    gap: 2,
  },
  brand: {
    fontSize: 27,
  },
  title: {
    fontSize: 30,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 14,
  },
  formToneBarMotion: {
    width: '100%',
  },
  formToneBar: {
    height: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  form: {
    gap: 14,
  },
  errorWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  error: {
    fontSize: 13,
  },
  submitButton: {
    marginTop: 2,
  },
  submitButtonMotion: {
    width: '100%',
  },
  appleSection: {
    gap: 10,
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  separatorLine: {
    height: 1,
    flex: 1,
  },
  separatorLabel: {
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  appleButtonDisabled: {
    opacity: 0.55,
  },
  appleHint: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  linkWrap: {
    minHeight: 36,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  linkPrefix: {
    fontSize: 12,
  },
  link: {
    fontSize: 12,
  },
});
