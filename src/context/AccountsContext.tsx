import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { createAccount, deleteAccount, fetchAccounts, updateAccount } from '../api/accounts';
import { useAuth } from '../hooks/useAuth';
import { Account } from '../types/api';

const DEFAULT_SCOPE = 'all';
const ACCOUNT_SCOPE_KEY_PREFIX = 'budget_app_account_scope_v1_';

function buildScopeStorageKey(userId: string) {
  return `${ACCOUNT_SCOPE_KEY_PREFIX}${userId}`;
}

type AccountScopeId = string | 'all';

interface AccountsContextValue {
  accounts: Account[];
  selectedAccountId: AccountScopeId;
  selectedAccount: Account | null;
  selectedScopeLabel: string;
  isLoading: boolean;
  refreshAccounts: () => Promise<void>;
  selectAccount: (accountId: AccountScopeId) => Promise<void>;
  createAccountBook: (payload: {
    name: string;
    icon?: string;
    color?: string;
    currentBalance?: number;
  }) => Promise<Account>;
  updateAccountBook: (
    accountId: string,
    payload: Partial<{
      name: string;
      icon: string;
      color: string;
      currentBalance: number;
    }>,
  ) => Promise<Account>;
  deleteAccountBook: (accountId: string) => Promise<void>;
}

export const AccountsContext = createContext<AccountsContextValue | null>(null);

export function AccountsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<AccountScopeId>(DEFAULT_SCOPE);
  const [isLoading, setIsLoading] = useState(true);

  const refreshAccounts = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setAccounts([]);
      setSelectedAccountId(DEFAULT_SCOPE);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const storageKey = buildScopeStorageKey(user.id);
      const [list, storedScope] = await Promise.all([
        fetchAccounts(),
        AsyncStorage.getItem(storageKey),
      ]);

      setAccounts(list);
      const nextScope =
        storedScope === DEFAULT_SCOPE ||
        (storedScope && list.some((account) => account.id === storedScope))
          ? (storedScope as AccountScopeId)
          : DEFAULT_SCOPE;
      setSelectedAccountId(nextScope ?? DEFAULT_SCOPE);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    void refreshAccounts();
  }, [refreshAccounts]);

  const selectAccount = useCallback(
    async (accountId: AccountScopeId) => {
      const nextScope =
        accountId === DEFAULT_SCOPE || accounts.some((account) => account.id === accountId)
          ? accountId
          : DEFAULT_SCOPE;
      setSelectedAccountId(nextScope);

      if (user?.id) {
        await AsyncStorage.setItem(buildScopeStorageKey(user.id), nextScope);
      }
    },
    [accounts, user?.id],
  );

  const createAccountBook = useCallback(
    async (payload: {
      name: string;
      icon?: string;
      color?: string;
      currentBalance?: number;
    }) => {
      const created = await createAccount(payload);
      setAccounts((previous) => [...previous, created]);
      return created;
    },
    [],
  );

  const updateAccountBook = useCallback(
    async (
      accountId: string,
      payload: Partial<{
        name: string;
        icon: string;
        color: string;
        currentBalance: number;
      }>,
    ) => {
      const updated = await updateAccount(accountId, payload);
      setAccounts((previous) =>
        previous.map((account) => (account.id === updated.id ? updated : account)),
      );
      return updated;
    },
    [],
  );

  const deleteAccountBook = useCallback(
    async (accountId: string) => {
      const result = await deleteAccount(accountId);

      setAccounts((previous) =>
        previous.filter((account) => account.id !== accountId),
      );

      if (selectedAccountId === accountId) {
        setSelectedAccountId(result.movedToAccountId ?? DEFAULT_SCOPE);

        if (user?.id) {
          await AsyncStorage.setItem(
            buildScopeStorageKey(user.id),
            result.movedToAccountId ?? DEFAULT_SCOPE,
          );
        }
      }
    },
    [selectedAccountId, user?.id],
  );

  const selectedAccount = useMemo(
    () =>
      selectedAccountId === DEFAULT_SCOPE
        ? null
        : accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const selectedScopeLabel = selectedAccount ? selectedAccount.name : 'Tous les comptes';

  const value = useMemo(
    () => ({
      accounts,
      selectedAccountId,
      selectedAccount,
      selectedScopeLabel,
      isLoading,
      refreshAccounts,
      selectAccount,
      createAccountBook,
      updateAccountBook,
      deleteAccountBook,
    }),
    [
      accounts,
      selectedAccount,
      selectedAccountId,
      selectedScopeLabel,
      isLoading,
      refreshAccounts,
      selectAccount,
      createAccountBook,
      updateAccountBook,
      deleteAccountBook,
    ],
  );

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>;
}
