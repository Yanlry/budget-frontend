import { Feather } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { changePassword, updateMe } from '../api/auth';
import { deleteTransaction, fetchTransactions } from '../api/transactions';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { InputField } from '../components/InputField';
import { Screen } from '../components/Screen';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../hooks/useAuth';
import { useAppTheme } from '../hooks/useAppTheme';
import { Account } from '../types/api';
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
  wallety_classic: require('../../assets/theme/classique.png'),
  ocean_breeze: require('../../assets/theme/ocean.png'),
  midnight_ocean: require('../../assets/theme/ocean-nuit.png'),
  sunset_clay: require('../../assets/theme/coucher-sable.png'),
  graphite_steel: require('../../assets/theme/graphite.png'),
};

export function SettingsScreen() {
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
  const [accountName, setAccountName] = useState(user?.name ?? '');
  const [savingAccountName, setSavingAccountName] = useState(false);
  const [accountNameError, setAccountNameError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const themeSlideWidth = Math.max(180, Math.round((windowWidth - 68) * 0.75));
  const themePreviewHeight = Math.max(210, Math.round(themeSlideWidth * 1.25));
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
    setAccountName(user?.name ?? '');
  }, [user?.name]);

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

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setAccountError(null);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingAccount(null);
    setEditingAccountError(null);
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

  const saveAccountName = () => {
    const trimmedName = accountName.trim();

    if (!trimmedName) {
      setAccountNameError('Le nom ne peut pas etre vide.');
      return;
    }

    setSavingAccountName(true);
    setAccountNameError(null);

    void (async () => {
      try {
        await updateMe({
          name: trimmedName,
        });
        await refreshUser();
        Alert.alert('Nom mis a jour', 'Ton nom de compte a ete enregistre.');
      } catch (error) {
        setAccountNameError((error as Error).message);
      } finally {
        setSavingAccountName(false);
      }
    })();
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

          <View style={styles.row}>
            <Feather name="mail" size={14} color={theme.colors.textMuted} />
            <Text
              style={[
                styles.rowText,
                {
                  color: theme.colors.textMuted,
                  fontFamily: theme.typography.familyRegular,
                },
              ]}
            >
              {user?.email ?? '-'}
            </Text>
          </View>

          <Text
            style={[
              styles.accountSectionTitle,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Modifier le nom
          </Text>
          <Text
            style={[
              styles.accountSectionDescription,
              {
                color: theme.colors.textMuted,
                fontFamily: theme.typography.familyRegular,
              },
            ]}
          >
            Mets a jour le nom visible sur ton compte.
          </Text>
          <InputField
            label="Nom"
            value={accountName}
            onChangeText={(text) => {
              setAccountNameError(null);
              setAccountName(text);
            }}
            placeholder="Ex: Yann"
          />
          {accountNameError ? (
            <Text
              style={[
                styles.inlineError,
                {
                  color: theme.colors.danger,
                  fontFamily: theme.typography.familyMedium,
                },
              ]}
            >
              {accountNameError}
            </Text>
          ) : null}
          <AppButton
            title={savingAccountName ? 'Enregistrement...' : 'Enregistrer mon nom'}
            onPress={saveAccountName}
            disabled={savingAccountName}
          />

          <View
            style={[
              styles.accountDivider,
              {
                borderBottomColor: theme.colors.border,
              },
            ]}
          />

          <Text
            style={[
              styles.accountSectionTitle,
              {
                color: theme.colors.text,
                fontFamily: theme.typography.familyBold,
              },
            ]}
          >
            Changer le mot de passe
          </Text>
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
          />
        </Card>

        <AppButton
          title="Supprimer toutes mes transactions"
          variant="secondary"
          onPress={clearAllTransactions}
        />
        <AppButton
          title="Se deconnecter"
          variant="secondary"
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
          <Pressable style={styles.dismissOverlay} onPress={closeCreateModal} />
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
          <Pressable style={styles.dismissOverlay} onPress={closeEditModal} />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  rowText: {
    fontSize: 13,
  },
  accountSectionTitle: {
    marginTop: 14,
    fontSize: 14,
  },
  accountSectionDescription: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  accountDivider: {
    marginTop: 14,
    marginBottom: 2,
    borderBottomWidth: 1,
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
