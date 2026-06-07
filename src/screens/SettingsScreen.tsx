import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ImageSourcePropType,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  createBankLinkToken,
  disconnectBankConnection,
  fetchBankConnections,
  fetchBankRecurringAnalysis,
  finalizeBankLinkToken,
  syncBankConnection,
} from '../api/banking';
import { changePassword, deleteMyAccount, exportMyData } from '../api/auth';
import { deleteTransaction, fetchTransactions } from '../api/transactions';
import { InputField } from '../components/InputField';
import { Screen } from '../components/Screen';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { RootStackParamList } from '../navigation/types';
import { Account, BankConnection, BankRecurringAnalysis } from '../types/api';
import { THEME_OPTIONS, ThemeMode } from '../theme/theme';
import {
  ACCOUNT_COLOR_OPTIONS,
  ACCOUNT_ICON_OPTIONS,
  resolveAccountVisual,
  withOpacity,
} from '../utils/accountPresets';
import { formatCurrency } from '../utils/format';

function getAccountTypeLabel(type: Account['type']) {
  if (type === 'BANK') {
    return 'Banque';
  }
  if (type === 'PRECIOUS_METALS') {
    return 'Metaux precieux';
  }
  return 'Crypto';
}

function getDefaultVisualForType() {
  return resolveAccountVisual({
    type: 'BANK',
    icon: null,
    color: null,
  });
}

interface ThemePreviewItem {
  label: string;
  value: ThemeMode;
  image: ImageSourcePropType;
}

const THEME_PREVIEW_BY_MODE: Record<ThemeMode, ImageSourcePropType> = {
  neutral_gray: require('../../assets/theme/neutre.png'),
  wallety_classic: require('../../assets/theme/classique.png'),
  ocean_breeze: require('../../assets/theme/ocean.png'),
  midnight_ocean: require('../../assets/theme/ocean-nuit.png'),
  sunset_clay: require('../../assets/theme/coucher-sable.png'),
  graphite_steel: require('../../assets/theme/graphite.png'),
};

const SUPPORT_EMAIL =
  process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() ||
  'support@simply-rich.com';

function parseSignedAmount(raw: string) {
  const normalized = raw
    .trim()
    .replace(',', '.')
    .replace('−', '-')
    .replace(/[^\d.-]/g, '');
  const sign = normalized.startsWith('-') ? '-' : '';
  const numeric = normalized
    .replace(/-/g, '')
    .replace(/(\..*)\./g, '$1');

  if (!numeric || numeric === '.') {
    return Number.NaN;
  }

  return Number(`${sign}${numeric}`);
}

function getBankConnectionStatusLabel(status: BankConnection['status']) {
  if (status === 'ACTIVE') {
    return 'Active';
  }
  if (status === 'NEEDS_REAUTH') {
    return 'Reconnexion requise';
  }
  return 'Deconnectee';
}

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { theme, mode, setMode } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const { user, logout, refreshUser } = useAuth();
  const {
    accounts,
    createAccountBook,
    updateAccountBook,
    deleteAccountBook,
    refreshAccounts,
  } = useAccounts();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountIcon, setNewAccountIcon] = useState(
    getDefaultVisualForType().icon,
  );
  const [newAccountColor, setNewAccountColor] = useState(
    getDefaultVisualForType().color,
  );
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(
    null,
  );

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editAccountName, setEditAccountName] = useState('');
  const [editAccountIcon, setEditAccountIcon] = useState(
    getDefaultVisualForType().icon,
  );
  const [editAccountColor, setEditAccountColor] = useState(
    getDefaultVisualForType().color,
  );
  const [editAccountBalance, setEditAccountBalance] = useState('');
  const [editingAccountError, setEditingAccountError] = useState<string | null>(
    null,
  );
  const [savingEditedAccount, setSavingEditedAccount] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [bankingConfigured, setBankingConfigured] = useState(false);
  const [bankConnections, setBankConnections] = useState<BankConnection[]>([]);
  const [bankingRecurringAnalysis, setBankingRecurringAnalysis] =
    useState<BankRecurringAnalysis | null>(null);
  const [loadingBanking, setLoadingBanking] = useState(true);
  const [bankingBusy, setBankingBusy] = useState(false);
  const [bankingError, setBankingError] = useState<string | null>(null);
  const [pendingLinkToken, setPendingLinkToken] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const themeSlideWidth = Math.max(128, Math.round((windowWidth - 72) * 0.48));
  const themePreviewHeight = Math.max(128, Math.round(themeSlideWidth * 1.04));
  const appVersion = Constants.expoConfig?.version ?? 'n/a';
  const isDarkSettings = theme.resolvedMode === 'dark';
  const settingsBackground = isDarkSettings ? theme.colors.background : '#F2F2F7';
  const groupedSurface = isDarkSettings ? theme.colors.elevated : '#FFFFFF';
  const groupedMutedSurface = isDarkSettings ? theme.colors.soft : '#F7F7FA';
  const groupedSeparator = isDarkSettings ? theme.colors.border : '#D7D7DC';
  const rowTextColor = isDarkSettings ? theme.colors.text : '#050507';
  const rowMutedColor = isDarkSettings ? theme.colors.textMuted : '#777982';
  const chevronColor = isDarkSettings ? theme.colors.textMuted : '#B7B7BD';
  const primaryAccent = '#00A889';
  const premiumDarkGreen = '#08775F';
  const primaryAccount = accounts[0] ?? null;
  const primaryVisual = primaryAccount
    ? resolveAccountVisual(primaryAccount)
    : getDefaultVisualForType();
  const themePreviewItems = useMemo<ThemePreviewItem[]>(
    () =>
      THEME_OPTIONS.map((option) => ({
        ...option,
        image: THEME_PREVIEW_BY_MODE[option.value],
      })),
    [],
  );
  const [themePreviewIndex, setThemePreviewIndex] = useState(() => {
    const index = themePreviewItems.findIndex((item) => item.value === mode);
    return index >= 0 ? index : 0;
  });
  const themePreviewListRef = useRef<FlatList<ThemePreviewItem> | null>(null);

  const applyThemeFromSwipeIndex = useCallback(
    (index: number) => {
      const safeIndex = Math.max(0, Math.min(index, themePreviewItems.length - 1));
      const selected = themePreviewItems[safeIndex];
      setThemePreviewIndex(safeIndex);

      if (selected && selected.value !== mode) {
        void setMode(selected.value);
      }
    },
    [mode, setMode, themePreviewItems],
  );

  useEffect(() => {
    void refreshAccounts().catch(() => undefined);
  }, [refreshAccounts]);

  useEffect(() => {
    const onShow = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const onHide = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  useEffect(() => {
    const nextIndex = themePreviewItems.findIndex((item) => item.value === mode);
    if (nextIndex < 0) {
      return;
    }

    setThemePreviewIndex(nextIndex);
    themePreviewListRef.current?.scrollToIndex({
      index: nextIndex,
      animated: true,
    });
  }, [mode, themePreviewItems]);

  const refreshBanking = useCallback(async () => {
    try {
      setBankingError(null);
      const [connectionsResponse, recurringResponse] = await Promise.all([
        fetchBankConnections(),
        fetchBankRecurringAnalysis().catch(() => null),
      ]);

      setBankingConfigured(connectionsResponse.providerConfigured);
      setBankConnections(connectionsResponse.items);
      setBankingRecurringAnalysis(recurringResponse);
    } catch (error) {
      setBankingError((error as Error).message);
    } finally {
      setLoadingBanking(false);
    }
  }, []);

  useEffect(() => {
    void refreshBanking();
  }, [refreshBanking]);

  const finalizeHostedLink = useCallback(
    (linkToken: string) => {
      setBankingBusy(true);
      setBankingError(null);
      setPendingLinkToken(linkToken);

      void (async () => {
        try {
          const result = await finalizeBankLinkToken(linkToken, true);
          if (!result.completed) {
            Alert.alert(
              'Connexion en attente',
              'La session bancaire n est pas encore terminee. Reviens apres avoir valide sur la page Plaid.',
            );
            return;
          }

          await Promise.all([
            refreshBanking(),
            refreshUser(),
            refreshAccounts().catch(() => undefined),
          ]);

          const sync = result.sync;
          Alert.alert(
            'Compte bancaire connecte',
            sync
              ? `Transactions ajoutees: ${sync.added}. Routines detectees: ${sync.recurringDetected}.`
              : 'Connexion enregistree avec succes.',
          );
          setPendingLinkToken(null);
        } catch (error) {
          setBankingError((error as Error).message);
          Alert.alert('Connexion impossible', (error as Error).message);
        } finally {
          setBankingBusy(false);
        }
      })();
    },
    [refreshAccounts, refreshBanking, refreshUser],
  );

  const connectBankAccount = useCallback(() => {
    setBankingBusy(true);
    setBankingError(null);

    void (async () => {
      try {
        const linkSession = await createBankLinkToken(365, true);
        setPendingLinkToken(linkSession.linkToken);

        if (!linkSession.hostedLinkUrl) {
          throw new Error(
            'Hosted Link indisponible. Active PLAID_ENABLE_HOSTED_LINK=true dans le backend.',
          );
        }

        await Linking.openURL(linkSession.hostedLinkUrl);

        Alert.alert(
          'Finaliser la connexion',
          'Apres avoir termine sur la page Plaid, appuie sur "J ai termine".',
          [
            { text: 'Plus tard', style: 'cancel' },
            {
              text: "J ai termine",
              onPress: () => finalizeHostedLink(linkSession.linkToken),
            },
          ],
        );
      } catch (error) {
        setBankingError((error as Error).message);
        Alert.alert('Impossible de lancer Plaid', (error as Error).message);
      } finally {
        setBankingBusy(false);
      }
    })();
  }, [finalizeHostedLink]);

  const refreshSingleConnection = useCallback(
    (connectionId: string) => {
      setBankingBusy(true);
      setBankingError(null);

      void (async () => {
        try {
          const result = await syncBankConnection(connectionId);
          await Promise.all([
            refreshBanking(),
            refreshAccounts().catch(() => undefined),
          ]);
          Alert.alert(
            'Synchronisation terminee',
            `Ajoutees: ${result.added}, modifiees: ${result.modified}, routines detectees: ${result.recurringDetected}.`,
          );
        } catch (error) {
          setBankingError((error as Error).message);
          Alert.alert('Echec de sync', (error as Error).message);
        } finally {
          setBankingBusy(false);
        }
      })();
    },
    [refreshAccounts, refreshBanking],
  );

  const promptDisconnectBank = useCallback(
    (connection: BankConnection) => {
      Alert.alert(
        'Deconnecter la banque ?',
        `${connection.institutionName ?? 'Cette connexion'} sera retiree et ses routines auto seront supprimees.`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Deconnecter',
            style: 'destructive',
            onPress: () => {
              setBankingBusy(true);
              setBankingError(null);
              void (async () => {
                try {
                  await disconnectBankConnection(connection.id);
                  await Promise.all([
                    refreshBanking(),
                    refreshAccounts().catch(() => undefined),
                  ]);
                } catch (error) {
                  setBankingError((error as Error).message);
                  Alert.alert('Echec de deconnexion', (error as Error).message);
                } finally {
                  setBankingBusy(false);
                }
              })();
            },
          },
        ],
      );
    },
    [refreshAccounts, refreshBanking],
  );

  const closeCreateModal = () => {
    Keyboard.dismiss();
    setShowCreateModal(false);
    setAccountError(null);
  };

  const closeEditModal = () => {
    Keyboard.dismiss();
    setShowEditModal(false);
    setEditingAccount(null);
    setEditingAccountError(null);
  };

  const handleCreateOverlayPress = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
      return;
    }

    closeCreateModal();
  };

  const handleEditOverlayPress = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
      return;
    }

    closeEditModal();
  };

  const clearAllTransactions = () => {
    Alert.alert(
      'Supprimer toutes les transactions ?',
      'Cette action va effacer tous tes revenus et depenses. Elle est irreversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                const all = await fetchTransactions();
                await Promise.all(
                  all.map((transaction) => deleteTransaction(transaction.id)),
                );
                await Promise.all([
                  refreshUser(),
                  refreshAccounts().catch(() => undefined),
                ]);
                Alert.alert(
                  'Nettoyage termine',
                  'Tes transactions ont bien ete supprimees.',
                );
              } catch (error) {
                Alert.alert(
                  'Echec du nettoyage',
                  (error as Error).message ||
                    'Impossible de supprimer toutes les transactions.',
                );
              }
            })();
          },
        },
      ],
    );
  };

  const createNewAccount = () => {
    const name = newAccountName.trim();
    if (!name) {
      setAccountError('Le nom du compte est requis.');
      return;
    }

    setSavingAccount(true);
    setAccountError(null);

    void (async () => {
      try {
        await createAccountBook({
          name,
          icon: newAccountIcon,
          color: newAccountColor,
          currentBalance: 0,
        });
        await refreshAccounts();
        const defaultBankVisual = getDefaultVisualForType();
        setNewAccountName('');
        setNewAccountIcon(defaultBankVisual.icon);
        setNewAccountColor(defaultBankVisual.color);
        closeCreateModal();
      } catch (error) {
        setAccountError((error as Error).message);
      } finally {
        setSavingAccount(false);
      }
    })();
  };

  const openEditAccountModal = (account: Account) => {
    const visual = resolveAccountVisual(account);
    setEditingAccount(account);
    setEditAccountName(account.name);
    setEditAccountIcon(visual.icon);
    setEditAccountColor(visual.color);
    setEditAccountBalance(account.currentBalance.toFixed(2));
    setEditingAccountError(null);
    setShowEditModal(true);
  };

  const saveEditedAccount = () => {
    if (!editingAccount) {
      return;
    }

    const name = editAccountName.trim();
    const parsedBalance = parseSignedAmount(editAccountBalance);

    if (!name) {
      setEditingAccountError('Le nom du livre est requis.');
      return;
    }

    if (!Number.isFinite(parsedBalance)) {
      setEditingAccountError('Saisis un solde valide.');
      return;
    }

    setSavingEditedAccount(true);
    setEditingAccountError(null);

    void (async () => {
      try {
        await updateAccountBook(editingAccount.id, {
          name,
          icon: editAccountIcon,
          color: editAccountColor,
          currentBalance: parsedBalance,
        });
        await Promise.all([refreshAccounts(), refreshUser()]);
        closeEditModal();
      } catch (error) {
        setEditingAccountError((error as Error).message);
      } finally {
        setSavingEditedAccount(false);
      }
    })();
  };

  const promptDeleteAccount = (accountId: string, accountName: string) => {
    Alert.alert(
      'Supprimer ce livre ?',
      `${accountName} sera retire. Ses mouvements seront transferes vers un autre compte.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            setDeletingAccountId(accountId);
            void (async () => {
              try {
                await deleteAccountBook(accountId);
                await refreshAccounts();
              } catch (error) {
                Alert.alert('Suppression impossible', (error as Error).message);
              } finally {
                setDeletingAccountId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const savePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Remplis tous les champs mot de passe.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setSavingPassword(true);
    setPasswordError(null);

    void (async () => {
      try {
        await changePassword({
          currentPassword,
          newPassword,
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert('Mot de passe modifie', 'Ton mot de passe a bien ete mis a jour.');
      } catch (error) {
        setPasswordError((error as Error).message);
      } finally {
        setSavingPassword(false);
      }
    })();
  };

  const contactSupport = useCallback(() => {
    const subject = encodeURIComponent('Support SimplyRich');
    const body = encodeURIComponent(
      "Bonjour,\n\nJ ai besoin d aide concernant mon compte SimplyRich.\n\n\n\nRaison de ma demande : \n\n\n\nMerci.",
    );
    const mailtoUrl = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    void Linking.openURL(mailtoUrl).catch(() => {
      Alert.alert(
        'Email indisponible',
        `Aucun client email n a repondu. Contacte-nous sur ${SUPPORT_EMAIL}.`,
      );
    });
  }, []);

  const exportPersonalData = useCallback(() => {
    if (exportingData) {
      return;
    }

    setExportingData(true);
    void (async () => {
      try {
        const payload = await exportMyData();
        await Share.share({
          title: 'Export donnees SimplyRich',
          message: JSON.stringify(payload, null, 2),
        });
      } catch (error) {
        Alert.alert('Export impossible', (error as Error).message);
      } finally {
        setExportingData(false);
      }
    })();
  }, [exportingData]);

  const deleteAccountNow = useCallback(() => {
    if (deletingAccount) {
      return;
    }

    setDeletingAccount(true);
    void (async () => {
      try {
        await deleteMyAccount();
        await logout();
        Alert.alert(
          'Compte supprime',
          'Ton compte et tes donnees associees ont ete supprimes.',
        );
      } catch (error) {
        Alert.alert('Suppression impossible', (error as Error).message);
      } finally {
        setDeletingAccount(false);
      }
    })();
  }, [deletingAccount, logout]);

  const confirmDeleteMyAccount = useCallback(() => {
    Alert.alert(
      'Supprimer mon compte ?',
      'Cette action supprime definitivement ton compte, tes livres et tes transactions.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmation finale',
              'Cette suppression est irreversible.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Supprimer definitivement',
                  style: 'destructive',
                  onPress: () => deleteAccountNow(),
                },
              ],
            );
          },
        },
      ],
    );
  }, [deleteAccountNow]);

  return (
    <Screen>
      <ScrollView
        style={[styles.settingsRoot, { backgroundColor: settingsBackground }]}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.largeTitle,
            {
              color: rowTextColor,
              fontFamily: theme.typography.familyDisplay,
            },
          ]}
        >
          Reglages
        </Text>

        <View
          style={[
            styles.primaryAccountGroup,
            {
              backgroundColor: groupedSurface,
              shadowColor: theme.colors.shadow,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              if (primaryAccount) {
                openEditAccountModal(primaryAccount);
                return;
              }

              setAccountError(null);
              setShowCreateModal(true);
            }}
            style={styles.primaryAccountRow}
          >
            <View
              style={[
                styles.primaryAccountIcon,
                {
                  backgroundColor: withOpacity(primaryVisual.color, 0.18),
                },
              ]}
            >
              <Feather
                name={primaryVisual.icon as never}
                size={25}
                color={primaryVisual.color}
              />
            </View>
            <View style={styles.primaryAccountTextBlock}>
              <Text
                numberOfLines={1}
                style={[
                  styles.primaryAccountTitle,
                  {
                    color: rowTextColor,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                {primaryAccount?.name ?? 'Compte courant'}
              </Text>
              <Text
                style={[
                  styles.primaryAccountSubtitle,
                  {
                    color: rowMutedColor,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                {primaryAccount
                  ? `${getAccountTypeLabel(primaryAccount.type)} - ${formatCurrency(primaryAccount.currentBalance)}`
                  : 'Ajoute ton premier livre de compte'}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={chevronColor} />
          </Pressable>

          <View style={[styles.fullDivider, { backgroundColor: groupedSeparator }]} />

          <Pressable
            onPress={() => {
              setAccountError(null);
              setShowCreateModal(true);
            }}
            style={styles.primaryActionRow}
          >
            <Text
              style={[
                styles.primaryActionLabel,
                {
                  color: primaryAccent,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              Ajouter un livre de compte
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionBlock}>
          <Text
            style={[
              styles.sectionHeading,
              {
                color: rowTextColor,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Apparence
          </Text>
          <View
            style={[
              styles.iosGroup,
              {
                backgroundColor: groupedSurface,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <View style={styles.themeHeaderRow}>
              <View style={[styles.iosIcon, { backgroundColor: '#1B9AF7' }]}>
                <Feather name="sliders" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.iosRowTextBlock}>
                <Text
                  style={[
                    styles.iosRowTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Theme visuel
                </Text>
                <Text
                  style={[
                    styles.iosRowSubtitle,
                    {
                      color: rowMutedColor,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  Glisse pour changer d'ambiance.
                </Text>
              </View>
            </View>
            <FlatList
              ref={themePreviewListRef}
              data={themePreviewItems}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.value}
              style={[styles.themeCarousel, { width: themeSlideWidth }]}
              onMomentumScrollEnd={(event) => {
                const width = event.nativeEvent.layoutMeasurement.width;
                if (!width) {
                  return;
                }

                const index = Math.round(event.nativeEvent.contentOffset.x / width);
                applyThemeFromSwipeIndex(index);
              }}
              onScrollToIndexFailed={({ index }) => {
                setTimeout(() => {
                  themePreviewListRef.current?.scrollToIndex({
                    index,
                    animated: true,
                  });
                }, 120);
              }}
              renderItem={({ item, index }) => {
                const selected = index === themePreviewIndex;

                return (
                  <View style={[styles.themeSlide, { width: themeSlideWidth }]}>
                    <View
                      style={[
                        styles.themeSlideFrame,
                        {
                          borderColor: selected
                            ? primaryAccent
                            : groupedSeparator,
                          backgroundColor: groupedMutedSurface,
                        },
                      ]}
                    >
                      <Image
                        source={item.image}
                        style={[styles.themePreviewImage, { height: themePreviewHeight }]}
                        resizeMode="cover"
                      />
                    </View>
                    <Text
                      style={[
                        styles.themeSlideLabel,
                        {
                          color: selected ? primaryAccent : rowTextColor,
                          fontFamily: selected
                            ? theme.typography.familyBold
                            : theme.typography.familyMedium,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </View>
                );
              }}
            />
            <View style={styles.themeDotsRow}>
              {themePreviewItems.map((item, index) => {
                const selected = index === themePreviewIndex;
                return (
                  <View
                    key={item.value}
                    style={[
                      styles.themeDot,
                      {
                        backgroundColor: selected ? primaryAccent : groupedSeparator,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text
            style={[
              styles.sectionHeading,
              {
                color: rowTextColor,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Compte
          </Text>
          <View
            style={[
              styles.iosGroup,
              {
                backgroundColor: groupedSurface,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <View style={styles.iosRowStatic}>
              <View style={[styles.iosIcon, { backgroundColor: '#1B9AF7' }]}>
                <Feather name="mail" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.iosRowTextBlock}>
                <Text
                  style={[
                    styles.iosRowTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Adresse email
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.iosRowSubtitle,
                    {
                      color: rowMutedColor,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  {user?.email ?? '-'}
                </Text>
              </View>
            </View>
            <View style={[styles.groupDivider, { backgroundColor: groupedSeparator }]} />
            <View style={styles.passwordPanel}>
              <InputField
                label="Mot de passe actuel"
                value={currentPassword}
                onChangeText={(text) => {
                  setPasswordError(null);
                  setCurrentPassword(text);
                }}
                placeholder="********"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <InputField
                label="Nouveau mot de passe"
                value={newPassword}
                onChangeText={(text) => {
                  setPasswordError(null);
                  setNewPassword(text);
                }}
                placeholder="Au moins 8 caracteres"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <InputField
                label="Confirmation"
                value={confirmPassword}
                onChangeText={(text) => {
                  setPasswordError(null);
                  setConfirmPassword(text);
                }}
                placeholder="Ressaisis le mot de passe"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              {passwordError ? (
                <Text
                  style={[
                    styles.inlineError,
                    {
                      color: theme.colors.danger,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  {passwordError}
                </Text>
              ) : null}
              <Pressable
                disabled={savingPassword}
                onPress={savePassword}
                style={[
                  styles.passwordAction,
                  { backgroundColor: primaryAccent },
                  savingPassword ? styles.disabledButton : null,
                ]}
              >
                <Text
                  style={[
                    styles.passwordActionText,
                    { fontFamily: theme.typography.familyBold },
                  ]}
                >
                  {savingPassword ? 'Mise a jour...' : 'Changer mon mot de passe'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text
            style={[
              styles.sectionHeading,
              {
                color: rowTextColor,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Confidentialite
          </Text>
          <View
            style={[
              styles.iosGroup,
              {
                backgroundColor: groupedSurface,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <Pressable
              onPress={() => navigation.navigate('PrivacyPolicy')}
              style={styles.iosRow}
            >
              <View style={[styles.iosIcon, { backgroundColor: '#1B9AF7' }]}>
                <Feather name="shield" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.iosRowTextBlock}>
                <Text
                  style={[
                    styles.iosRowTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Politique de confidentialite
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={chevronColor} />
            </Pressable>
            <View style={[styles.groupDivider, { backgroundColor: groupedSeparator }]} />
            <Pressable
              onPress={() => navigation.navigate('TermsOfUse')}
              style={styles.iosRow}
            >
              <View style={[styles.iosIcon, { backgroundColor: '#1B9AF7' }]}>
                <Feather name="file-text" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.iosRowTextBlock}>
                <Text
                  style={[
                    styles.iosRowTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Conditions d'utilisation
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={chevronColor} />
            </Pressable>
            <View style={[styles.groupDivider, { backgroundColor: groupedSeparator }]} />
            <Pressable onPress={exportPersonalData} style={styles.iosRow}>
              <View style={[styles.iosIcon, { backgroundColor: '#1B9AF7' }]}>
                <Feather name="download" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.iosRowTextBlock}>
                <Text
                  style={[
                    styles.iosRowTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  {exportingData ? 'Export en cours...' : 'Exporter mes donnees'}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={chevronColor} />
            </Pressable>
            <View style={[styles.groupDivider, { backgroundColor: groupedSeparator }]} />
            <Pressable onPress={contactSupport} style={styles.iosRow}>
              <View style={[styles.iosIcon, { backgroundColor: primaryAccent }]}>
                <Feather name="message-circle" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.iosRowTextBlock}>
                <Text
                  style={[
                    styles.iosRowTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Support
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.iosRowSubtitle,
                    {
                      color: rowMutedColor,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  {SUPPORT_EMAIL}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={chevronColor} />
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <Text
            style={[
              styles.sectionHeading,
              {
                color: rowTextColor,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Zone sensible
          </Text>
          <View
            style={[
              styles.iosGroup,
              {
                backgroundColor: groupedSurface,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <Pressable onPress={clearAllTransactions} style={styles.iosRow}>
              <View style={[styles.iosIcon, { backgroundColor: '#F59E0B' }]}>
                <Feather name="refresh-cw" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.iosRowTextBlock}>
                <Text
                  style={[
                    styles.iosRowTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Supprimer les transactions
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={chevronColor} />
            </Pressable>
            <View style={[styles.groupDivider, { backgroundColor: groupedSeparator }]} />
            <Pressable
              disabled={deletingAccount}
              onPress={confirmDeleteMyAccount}
              style={styles.iosRow}
            >
              <View style={[styles.iosIcon, { backgroundColor: theme.colors.danger }]}>
                <Feather name="user-x" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.iosRowTextBlock}>
                <Text
                  style={[
                    styles.iosRowTitle,
                    {
                      color: theme.colors.danger,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  {deletingAccount ? 'Suppression...' : 'Supprimer mon compte'}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={chevronColor} />
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => void logout()}
          style={[
            styles.logoutPill,
            {
              backgroundColor: withOpacity(theme.colors.danger, isDarkSettings ? 0.18 : 0.12),
              borderColor: withOpacity(theme.colors.danger, 0.22),
            },
          ]}
        >
          <Text
            style={[
              styles.logoutPillText,
              {
                color: theme.colors.danger,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Se deconnecter
          </Text>
        </Pressable>
      </ScrollView>

      <Modal transparent animationType="fade" visible={showCreateModal}>
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: theme.colors.overlay },
          ]}
        >
          <Pressable
            style={styles.dismissOverlay}
            onPress={handleCreateOverlayPress}
          />
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: groupedSurface,
                shadowColor: theme.colors.shadow,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: primaryAccent }]}>
                <Feather name="plus" size={17} color="#FFFFFF" />
              </View>
              <View style={styles.modalHeaderText}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Nouveau livre
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      color: rowMutedColor,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  Nom, icone et couleur.
                </Text>
              </View>
            </View>

            <InputField
              label="Nom du livre"
              value={newAccountName}
              onChangeText={(text) => {
                setAccountError(null);
                setNewAccountName(text);
              }}
              placeholder="Ex: CIC, Boursobank..."
            />

            <Text
              style={[
                styles.modalSectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              Choisis une icone
            </Text>
            <View style={styles.iconGrid}>
              {ACCOUNT_ICON_OPTIONS.map((icon) => {
                const selected = icon === newAccountIcon;
                return (
                  <Pressable
                    key={icon}
                    onPress={() => {
                      setAccountError(null);
                      setNewAccountIcon(icon);
                    }}
                    style={[
                      styles.iconChoice,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected
                          ? theme.colors.primarySoft
                          : theme.colors.soft,
                      },
                    ]}
                  >
                    <Feather
                      name={icon as never}
                      size={16}
                      color={selected ? theme.colors.primary : theme.colors.text}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={[
                styles.modalSectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              Choisis une couleur
            </Text>
            <View style={styles.colorGrid}>
              {ACCOUNT_COLOR_OPTIONS.map((color) => {
                const selected = color === newAccountColor;
                return (
                  <Pressable
                    key={color}
                    onPress={() => {
                      setAccountError(null);
                      setNewAccountColor(color);
                    }}
                    style={[
                      styles.colorChoice,
                      {
                        borderColor: selected ? theme.colors.text : theme.colors.border,
                        backgroundColor: color,
                      },
                    ]}
                  >
                    {selected ? (
                      <Feather name="check" size={14} color={theme.colors.elevated} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {accountError ? (
              <Text
                style={[
                  styles.accountError,
                  {
                    color: theme.colors.danger,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                {accountError}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeCreateModal}
                style={[styles.modalSecondaryButton, { backgroundColor: groupedMutedSurface }]}
              >
                <Text
                  style={[
                    styles.modalSecondaryButtonText,
                    {
                      color: rowMutedColor,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                onPress={createNewAccount}
                disabled={savingAccount}
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: primaryAccent },
                  savingAccount ? styles.disabledButton : null,
                ]}
              >
                <Text
                  style={[
                    styles.modalPrimaryButtonText,
                    { fontFamily: theme.typography.familyBold },
                  ]}
                >
                  {savingAccount ? 'Creation...' : 'Ajouter'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent animationType="fade" visible={showEditModal}>
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: theme.colors.overlay },
          ]}
        >
          <Pressable
            style={styles.dismissOverlay}
            onPress={handleEditOverlayPress}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardAvoider}
            pointerEvents="box-none"
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View
                style={[
                  styles.modalCard,
                  {
                    backgroundColor: groupedSurface,
                    shadowColor: theme.colors.shadow,
                  },
                ]}
              >
            <View style={styles.modalHeader}>
              <View style={[styles.modalHeaderIcon, { backgroundColor: primaryAccent }]}>
                <Feather name="edit-2" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.modalHeaderText}>
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: rowTextColor,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Modifier le livre
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    {
                      color: rowMutedColor,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  Solde, couleur et apparence.
                </Text>
              </View>
            </View>

            <InputField
              label="Nom du livre"
              value={editAccountName}
              onChangeText={(text) => {
                setEditingAccountError(null);
                setEditAccountName(text);
              }}
              placeholder="Ex: Boursobank principal"
            />
            <InputField
              label="Solde actuel"
              value={editAccountBalance}
              onChangeText={(text) => {
                setEditingAccountError(null);
                setEditAccountBalance(text);
              }}
              placeholder="Ex: -320.50"
              keyboardType="numbers-and-punctuation"
            />

            <Text
              style={[
                styles.modalSectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              Choisis une icone
            </Text>
            <View style={styles.iconGrid}>
              {ACCOUNT_ICON_OPTIONS.map((icon) => {
                const selected = icon === editAccountIcon;
                return (
                  <Pressable
                    key={icon}
                    onPress={() => {
                      Keyboard.dismiss();
                      setEditingAccountError(null);
                      setEditAccountIcon(icon);
                    }}
                    style={[
                      styles.iconChoice,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: selected
                          ? theme.colors.primarySoft
                          : theme.colors.soft,
                      },
                    ]}
                  >
                    <Feather
                      name={icon as never}
                      size={16}
                      color={selected ? theme.colors.primary : theme.colors.text}
                    />
                  </Pressable>
                );
              })}
            </View>

            <Text
              style={[
                styles.modalSectionTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              Choisis une couleur
            </Text>
            <View style={styles.colorGrid}>
              {ACCOUNT_COLOR_OPTIONS.map((color) => {
                const selected = color === editAccountColor;
                return (
                  <Pressable
                    key={color}
                    onPress={() => {
                      Keyboard.dismiss();
                      setEditingAccountError(null);
                      setEditAccountColor(color);
                    }}
                    style={[
                      styles.colorChoice,
                      {
                        borderColor: selected ? theme.colors.text : theme.colors.border,
                        backgroundColor: color,
                      },
                    ]}
                  >
                    {selected ? (
                      <Feather name="check" size={14} color={theme.colors.elevated} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            {editingAccountError ? (
              <Text
                style={[
                  styles.accountError,
                  {
                    color: theme.colors.danger,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                {editingAccountError}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                onPress={closeEditModal}
                style={[styles.modalSecondaryButton, { backgroundColor: groupedMutedSurface }]}
              >
                <Text
                  style={[
                    styles.modalSecondaryButtonText,
                    {
                      color: rowMutedColor,
                      fontFamily: theme.typography.familyBold,
                    },
                  ]}
                >
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                onPress={saveEditedAccount}
                disabled={savingEditedAccount}
                style={[
                  styles.modalPrimaryButton,
                  { backgroundColor: primaryAccent },
                  savingEditedAccount ? styles.disabledButton : null,
                ]}
              >
                <Text
                  style={[
                    styles.modalPrimaryButtonText,
                    { fontFamily: theme.typography.familyBold },
                  ]}
                >
                  {savingEditedAccount ? 'Enregistrement...' : 'Enregistrer'}
                </Text>
              </Pressable>
            </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  settingsRoot: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 28,
    gap: 16,
    paddingBottom: 152,
  },
  largeTitle: {
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1.1,
    marginTop: 8,
    marginBottom: 4,
  },
  primaryAccountGroup: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 26,
    elevation: 4,
  },
  primaryAccountRow: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  primaryAccountIcon: {
    width: 58,
    height: 58,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAccountTextBlock: {
    flex: 1,
    gap: 4,
  },
  primaryAccountTitle: {
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.4,
  },
  primaryAccountSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  fullDivider: {
    height: StyleSheet.hairlineWidth,
  },
  primaryActionRow: {
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  primaryActionLabel: {
    fontSize: 16,
    letterSpacing: -0.15,
  },
  premiumPanel: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#06997F',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.13,
    shadowRadius: 30,
    elevation: 5,
  },
  premiumContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 9,
  },
  premiumTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.7,
  },
  premiumDescription: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 320,
  },
  premiumMetricsRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  premiumMetric: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  premiumMetricValue: {
    color: 'rgba(255,255,255,0.94)',
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.4,
  },
  premiumMetricLabel: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 11,
    lineHeight: 14,
  },
  premiumFooter: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  premiumFooterText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  premiumFooterButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  premiumFooterButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0.1,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeading: {
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.7,
    paddingHorizontal: 4,
  },
  iosGroup: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 3,
  },
  iosRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  iosRowStatic: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iosRowWithAction: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iosRowPressArea: {
    flex: 1,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingVertical: 9,
  },
  iosIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosRowTextBlock: {
    flex: 1,
    gap: 2,
  },
  iosRowTitle: {
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.35,
  },
  iosRowSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  rowDeleteButton: {
    width: 46,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  themeHeaderRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  themeCarousel: {
    alignSelf: 'center',
    marginTop: 4,
  },
  themeSlide: {
    paddingHorizontal: 5,
    gap: 8,
  },
  themeSlideFrame: {
    borderWidth: 1,
    borderRadius: 13,
    padding: 5,
  },
  themePreviewImage: {
    width: '100%',
    borderRadius: 13,
  },
  themeSlideLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  themeDotsRow: {
    paddingTop: 2,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  themeDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  passwordPanel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 9,
  },
  passwordAction: {
    minHeight: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  passwordActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 0.05,
  },
  disabledButton: {
    opacity: 0.58,
  },
  inlineError: {
    marginTop: 2,
    fontSize: 12,
  },
  logoutPill: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  logoutPillText: {
    fontSize: 14,
    letterSpacing: 0.05,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalKeyboardAvoider: {
    width: '100%',
  },
  modalCard: {
    borderRadius: 26,
    padding: 16,
    gap: 12,
    maxHeight: '90%',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 34,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderText: {
    flex: 1,
    gap: 1,
  },
  modalTitle: {
    fontSize: 18,
    lineHeight: 23,
    letterSpacing: -0.35,
  },
  modalSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  modalSectionTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconChoice: {
    width: 36,
    height: 36,
    borderWidth: 0,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorChoice: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryButtonText: {
    fontSize: 14,
  },
  modalPrimaryButton: {
    flex: 1.2,
    minHeight: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  accountError: {
    fontSize: 12,
  },
});
