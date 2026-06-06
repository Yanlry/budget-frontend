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
  Linking,
  Modal,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
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
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
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
import { formatCurrency, parseAmount } from '../utils/format';

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
  'support@simplyrich.app';

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
  const themeSlideWidth = Math.max(180, Math.round((windowWidth - 68) * 0.75));
  const themePreviewHeight = Math.max(210, Math.round(themeSlideWidth * 1.25));
  const appVersion = Constants.expoConfig?.version ?? 'n/a';
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
    const parsedBalance = parseAmount(editAccountBalance);

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
      "Bonjour,\n\nJ ai besoin d aide concernant mon compte SimplyRich.\n\nMerci.",
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
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text,
              fontFamily: theme.typography.familyDisplay,
            },
          ]}
        >
          Reglages
        </Text>
{/* 
        <Card>
          <Text
            style={[
              styles.blockTitle,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Connexion bancaire
          </Text>
          <Text
            style={[
              styles.blockDescriptionCompact,
              {
                color: theme.colors.textMuted,
                fontFamily: theme.typography.familyRegular,
                marginBottom: 10,
              },
            ]}
          >
            Connecte ta banque pour importer automatiquement tes revenus et depenses
            recurrentes.
          </Text>

          {!bankingConfigured ? (
            <Text
              style={[
                styles.inlineError,
                {
                  color: theme.colors.danger,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              Plaid n est pas configure sur le backend.
            </Text>
          ) : null}

          {loadingBanking ? (
            <Text
              style={[
                styles.rowText,
                {
                  color: theme.colors.textMuted,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              Chargement des connexions...
            </Text>
          ) : bankConnections.length === 0 ? (
            <Text
              style={[
                styles.rowText,
                {
                  color: theme.colors.textMuted,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              Aucun compte bancaire connecte.
            </Text>
          ) : (
            <View style={styles.bankConnectionsList}>
              {bankConnections.map((connection) => (
                <View
                  key={connection.id}
                  style={[
                    styles.bankConnectionRow,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.soft,
                    },
                  ]}
                >
                  <View style={styles.bankConnectionMain}>
                    <Text
                      style={[
                        styles.bankConnectionName,
                        {
                          color: theme.colors.text,
                          fontFamily: theme.typography.familyBold,
                        },
                      ]}
                    >
                      {connection.institutionName ?? 'Institution bancaire'}
                    </Text>
                    <Text
                      style={[
                        styles.bankConnectionMeta,
                        {
                          color: theme.colors.textMuted,
                          fontFamily: theme.typography.familyRegular,
                        },
                      ]}
                    >
                      {getBankConnectionStatusLabel(connection.status)}
                      {connection.lastSyncedAt
                        ? ` • Sync ${new Date(connection.lastSyncedAt).toLocaleDateString('fr-FR')}`
                        : ''}
                    </Text>
                  </View>

                  <View style={styles.bankConnectionActions}>
                    <Pressable
                      disabled={bankingBusy}
                      onPress={() => refreshSingleConnection(connection.id)}
                      style={[
                        styles.bankActionButton,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.elevated,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.bankActionText,
                          {
                            color: theme.colors.primary,
                            fontFamily: theme.typography.familyMedium,
                          },
                        ]}
                      >
                        Sync
                      </Text>
                    </Pressable>
                    <Pressable
                      disabled={bankingBusy}
                      onPress={() => promptDisconnectBank(connection)}
                      style={[
                        styles.bankActionButton,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: theme.colors.elevated,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.bankActionText,
                          {
                            color: theme.colors.danger,
                            fontFamily: theme.typography.familyMedium,
                          },
                        ]}
                      >
                        Retirer
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          {bankingRecurringAnalysis ? (
            <View
              style={[
                styles.bankSummary,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.soft,
                },
              ]}
            >
              <Text
                style={[
                  styles.bankSummaryText,
                  {
                    color: theme.colors.text,
                    fontFamily: theme.typography.familyMedium,
                  },
                ]}
              >
                Routines detectees: {bankingRecurringAnalysis.streamCount}
              </Text>
              <Text
                style={[
                  styles.bankSummaryText,
                  {
                    color: theme.colors.textMuted,
                    fontFamily: theme.typography.familyRegular,
                  },
                ]}
              >
                Net mensuel estime: {formatCurrency(bankingRecurringAnalysis.monthlyNet)}
              </Text>
            </View>
          ) : null}

          {bankingError ? (
            <Text
              style={[
                styles.inlineError,
                {
                  color: theme.colors.danger,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              {bankingError}
            </Text>
          ) : null}

          <AppButton
            title={bankingBusy ? 'Traitement...' : 'Connecter ma banque'}
            onPress={connectBankAccount}
            disabled={bankingBusy || !bankingConfigured}
          />
          {pendingLinkToken ? (
            <AppButton
              title="J ai termine sur Plaid"
              variant="secondary"
              onPress={() => finalizeHostedLink(pendingLinkToken)}
              disabled={bankingBusy}
            />
          ) : null}
        </Card> */}

        <Card>
          <View style={styles.accountsHeader}>
            <View style={styles.accountsHeaderText}>
              <Text
                style={[
                  styles.blockTitle,
                  {
                    color: theme.colors.text,
                    fontFamily: theme.typography.familyBold,
                  },
                ]}
              >
                Livres de compte
              </Text>
              <Text
                style={[
                  styles.blockDescriptionCompact,
                  {
                    color: theme.colors.textMuted,
                    fontFamily: theme.typography.familyRegular,
                  },
                ]}
              >
                Ajoute, personnalise ou supprime tes livres en quelques secondes.
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setAccountError(null);
                setShowCreateModal(true);
              }}
              style={[
                styles.addAccountButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.soft,
                },
              ]}
            >
              <Feather name="plus" size={16} color={theme.colors.primary} />
            </Pressable>
          </View>

          <View style={styles.accountsList}>
            {accounts.map((account) => {
              const visual = resolveAccountVisual(account);

              return (
                <View
                  key={account.id}
                  style={[
                    styles.accountRow,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.soft,
                    },
                  ]}
                >
                  <View style={styles.accountRowLeft}>
                    <View
                      style={[
                        styles.accountIconWrap,
                        {
                          borderColor: visual.color,
                          backgroundColor: withOpacity(visual.color, 0.16),
                        },
                      ]}
                    >
                      <Feather
                        name={visual.icon as never}
                        size={15}
                        color={visual.color}
                      />
                    </View>
                    <View style={styles.accountTextBlock}>
                      <Text
                        style={[
                          styles.accountName,
                          {
                            color: theme.colors.text,
                            fontFamily: theme.typography.familyBold,
                          },
                        ]}
                      >
                        {account.name}
                      </Text>
                      <Text
                        style={[
                          styles.accountType,
                          {
                            color: theme.colors.textMuted,
                            fontFamily: theme.typography.familyRegular,
                          },
                        ]}
                      >
                        {getAccountTypeLabel(account.type)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.accountRowRight}>
                    <Text
                      style={[
                        styles.accountBalance,
                        {
                          color:
                            account.currentBalance >= 0
                              ? theme.colors.success
                              : theme.colors.danger,
                          fontFamily: theme.typography.familyBold,
                        },
                      ]}
                    >
                      {formatCurrency(account.currentBalance)}
                    </Text>
                    <View style={styles.accountActionsRow}>
                      <Pressable
                        onPress={() => openEditAccountModal(account)}
                        style={[
                          styles.editAccountButton,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.elevated,
                          },
                        ]}
                      >
                        <Feather
                          name="edit-2"
                          size={13}
                          color={theme.colors.primary}
                        />
                      </Pressable>
                      <Pressable
                        disabled={deletingAccountId === account.id}
                        onPress={() => promptDeleteAccount(account.id, account.name)}
                        style={[
                          styles.deleteAccountButton,
                          {
                            borderColor: theme.colors.border,
                            backgroundColor: theme.colors.elevated,
                          },
                        ]}
                      >
                        <Feather
                          name="trash-2"
                          size={13}
                          color={theme.colors.danger}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        <Card>
          <Text
            style={[
              styles.blockTitle,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.familyBold,
                marginBottom:20,
              },
            ]}
          >
            Style visuel
          </Text>
          <FlatList
            ref={themePreviewListRef}
            data={themePreviewItems}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.value}
            style={[
              styles.themeCarousel,
              {
                width: themeSlideWidth,
              },
            ]}
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
                <View
                  style={[
                    styles.themeSlide,
                    {
                      width: themeSlideWidth,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.themeSlideFrame,
                      {
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                        backgroundColor: theme.colors.elevated,
                      },
                    ]}
                  >
                    <Image
                      source={item.image}
                      style={[
                        styles.themePreviewImage,
                        {
                          height: themePreviewHeight,
                        },
                      ]}
                      resizeMode="cover"
                    />
                  </View>
                  <Text
                    style={[
                      styles.themeSlideLabel,
                      {
                        color: selected ? theme.colors.primary : theme.colors.text,
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
                      backgroundColor: selected
                        ? theme.colors.primary
                        : theme.colors.border,
                    },
                  ]}
                />
              );
            })}
          </View>
        </Card>

        <Card>
          <View style={styles.accountCardStack}>
            <Text
              style={[
                styles.blockTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              Compte
            </Text>

            <View
              style={[
                styles.accountIdentityPanel,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.soft,
                },
              ]}
            >
              <View
                style={[
                  styles.accountIdentityIconWrap,
                  {
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.primarySoft,
                  },
                ]}
              >
                <Feather name="mail" size={14} color={theme.colors.primary} />
              </View>
              <View style={styles.accountIdentityTextWrap}>
                <Text
                  style={[
                    styles.accountIdentityLabel,
                    {
                      color: theme.colors.textMuted,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  Adresse email
                </Text>
                <Text
                  style={[
                    styles.accountIdentityValue,
                    {
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  {user?.email ?? '-'}
                </Text>
              </View>
            </View>

            <View style={styles.accountPasswordForm}>
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
                label="Confirmation du nouveau mot de passe"
                value={confirmPassword}
                onChangeText={(text) => {
                  setPasswordError(null);
                  setConfirmPassword(text);
                }}
                placeholder="Ressaisis le nouveau mot de passe"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

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

            <AppButton
              title={savingPassword ? 'Mise a jour...' : 'Changer mon mot de passe'}
              onPress={savePassword}
              disabled={savingPassword}
              variant="secondary"
              flat
              style={styles.accountActionButtonSecondary}
              labelStyle={styles.accountActionButtonLabel}
            />
          </View>
        </Card>

        <Card>
          <View style={styles.complianceStack}>
            <Text
              style={[
                styles.blockTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyBold,
                },
              ]}
            >
              Conformite et assistance
            </Text>

            <Pressable
              onPress={() => navigation.navigate('PrivacyPolicy')}
              style={[
                styles.complianceRow,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.soft,
                },
              ]}
            >
              <View style={styles.complianceTextWrap}>
                <Text
                  style={[
                    styles.complianceTitle,
                    {
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Politique de confidentialite
                </Text>
                <Text
                  style={[
                    styles.complianceSubtitle,
                    {
                      color: theme.colors.textMuted,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  Comment tes donnees sont utilisees
                </Text>
              </View>
              <Feather name="chevron-right" size={15} color={theme.colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('TermsOfUse')}
              style={[
                styles.complianceRow,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.soft,
                },
              ]}
            >
              <View style={styles.complianceTextWrap}>
                <Text
                  style={[
                    styles.complianceTitle,
                    {
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Conditions d utilisation
                </Text>
                <Text
                  style={[
                    styles.complianceSubtitle,
                    {
                      color: theme.colors.textMuted,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  Regles et modalites du service
                </Text>
              </View>
              <Feather name="chevron-right" size={15} color={theme.colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={contactSupport}
              style={[
                styles.complianceRow,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.soft,
                },
              ]}
            >
              <View style={styles.complianceTextWrap}>
                <Text
                  style={[
                    styles.complianceTitle,
                    {
                      color: theme.colors.text,
                      fontFamily: theme.typography.familyMedium,
                    },
                  ]}
                >
                  Contacter le support
                </Text>
                <Text
                  style={[
                    styles.complianceSubtitle,
                    {
                      color: theme.colors.textMuted,
                      fontFamily: theme.typography.familyRegular,
                    },
                  ]}
                >
                  {SUPPORT_EMAIL}
                </Text>
              </View>
              <Feather name="mail" size={14} color={theme.colors.textMuted} />
            </Pressable>

            <AppButton
              title={exportingData ? 'Export en cours...' : 'Exporter mes donnees'}
              variant="secondary"
              flat
              onPress={exportPersonalData}
              disabled={exportingData}
              style={styles.complianceActionButton}
            />
            <AppButton
              title={deletingAccount ? 'Suppression...' : 'Supprimer mon compte'}
              variant="danger"
              flat
              onPress={confirmDeleteMyAccount}
              disabled={deletingAccount}
              style={styles.deleteProfileButton}
            />
            <Text
              style={[
                styles.complianceVersion,
                {
                  color: theme.colors.textMuted,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              Version {appVersion}
            </Text>
          </View>
        </Card>

        <AppButton
          title="Supprimer toutes mes transactions"
          variant="secondary"
          onPress={clearAllTransactions}
        />
        <AppButton
          title="Se deconnecter"
          variant="secondary"
          flat
          style={[
            styles.logoutButton,
            {
              borderColor: withOpacity(theme.colors.danger, 0.35),
              backgroundColor: theme.colors.dangerSoft,
            },
          ]}
          labelStyle={[
            styles.logoutButtonLabel,
            {
              color: theme.colors.danger,
            },
          ]}
          onPress={() => void logout()}
        />
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
                backgroundColor: theme.colors.elevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyDisplay,
                },
              ]}
            >
              Nouveau livre
            </Text>

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

            <AppButton
              title={savingAccount ? 'Creation...' : 'Ajouter'}
              onPress={createNewAccount}
              disabled={savingAccount}
            />
            <AppButton
              title="Annuler"
              variant="secondary"
              onPress={closeCreateModal}
            />
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
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.elevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.modalTitle,
                {
                  color: theme.colors.text,
                  fontFamily: theme.typography.familyDisplay,
                },
              ]}
            >
              Modifier le livre
            </Text>

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
              placeholder="Ex: 2140.50"
              keyboardType="decimal-pad"
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

            <AppButton
              title={savingEditedAccount ? 'Enregistrement...' : 'Enregistrer'}
              onPress={saveEditedAccount}
              disabled={savingEditedAccount}
            />
            <AppButton
              title="Annuler"
              variant="secondary"
              onPress={closeEditModal}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 14,
    paddingBottom: 136,
  },
  title: {
    fontSize: 30,
    marginTop: 6,
  },
  blockTitle: {
    fontSize: 16,
  },
  blockDescription: {
    fontSize: 13,
    marginTop: 5,
    marginBottom: 10,
    lineHeight: 20,
  },
  blockDescriptionCompact: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  inlineError: {
    marginTop: 8,
    fontSize: 12,
  },
  themeSwipeHint: {
    fontSize: 12,
    marginBottom: 8,
  },
  themeCarousel: {
    alignSelf: 'center',
  },
  themeSlide: {
    paddingHorizontal: 4,
    gap: 8,
  },
  themeSlideFrame: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 6,
  },
  themePreviewImage: {
    width: '100%',
    borderRadius: 14,
  },
  themeSlideLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  themeDotsRow: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  themeDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  bankConnectionsList: {
    gap: 8,
    marginBottom: 10,
  },
  bankConnectionRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
  },
  bankConnectionMain: {
    gap: 2,
  },
  bankConnectionName: {
    fontSize: 14,
  },
  bankConnectionMeta: {
    fontSize: 12,
  },
  bankConnectionActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bankActionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bankActionText: {
    fontSize: 12,
  },
  bankSummary: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
    marginBottom: 10,
  },
  bankSummaryText: {
    fontSize: 12,
  },
  accountsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  accountsHeaderText: {
    flex: 1,
    paddingRight: 10,
  },
  addAccountButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountsList: {
    marginTop: 10,
    gap: 8,
  },
  accountRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  accountIconWrap: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTextBlock: {
    flex: 1,
    gap: 2,
  },
  accountName: {
    fontSize: 14,
  },
  accountType: {
    fontSize: 12,
  },
  accountRowRight: {
    alignItems: 'flex-end',
    gap: 5,
  },
  accountActionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  accountBalance: {
    fontSize: 14,
  },
  editAccountButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCardStack: {
    gap: 12,
  },
  accountIdentityPanel: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountIdentityIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountIdentityTextWrap: {
    flex: 1,
    gap: 1,
  },
  accountIdentityLabel: {
    fontSize: 11,
  },
  accountIdentityValue: {
    fontSize: 14,
  },
  accountSecurityHeader: {
    gap: 3,
  },
  accountSecurityTitle: {
    fontSize: 14,
  },
  accountSecurityHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  accountPasswordForm: {
    gap: 10,
  },
  rowText: {
    fontSize: 13,
  },
  accountActionButtonSecondary: {
    marginTop: 2,
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  accountActionButtonLabel: {
    fontSize: 14,
    letterSpacing: 0.15,
  },
  complianceStack: {
    gap: 10,
  },
  complianceRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  complianceTextWrap: {
    flex: 1,
    gap: 2,
  },
  complianceTitle: {
    fontSize: 13,
  },
  complianceSubtitle: {
    fontSize: 12,
  },
  complianceActionButton: {
    marginTop: 2,
    minHeight: 46,
    borderRadius: 12,
  },
  deleteProfileButton: {
    minHeight: 46,
    borderRadius: 12,
  },
  complianceVersion: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 2,
  },
  logoutButton: {
    minHeight: 48,
    borderRadius: 12,
  },
  logoutButtonLabel: {
    fontSize: 14,
    letterSpacing: 0.15,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 10,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 22,
  },
  modalSectionTitle: {
    fontSize: 13,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconChoice: {
    width: 38,
    height: 38,
    borderWidth: 1,
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
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountError: {
    fontSize: 12,
  },
});
