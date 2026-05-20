import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { login, me, register, updateMe } from '../api/auth';
import { createTransaction } from '../api/transactions';
import { getErrorMessage, setAccessToken } from '../api/client';
import { OnboardingDraft, RecurringFrequency, User } from '../types/api';
import { formatInputDate } from '../utils/format';

const TOKEN_KEY = 'budget_app_token';
const ONBOARDING_DONE_USER_KEY = 'budget_app_onboarding_done_user_v3';
const ONBOARDING_PENDING_USER_KEY = 'budget_app_onboarding_pending_user_v1';
const ONBOARDING_DRAFT_KEY = 'budget_app_onboarding_draft_v2';
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RECURRING_FREQUENCIES: RecurringFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

function toSafeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toSafeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function isValidDateInput(value: string) {
  if (!DATE_INPUT_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function toRecurringFrequency(value: unknown): RecurringFrequency {
  if (typeof value === 'string' && RECURRING_FREQUENCIES.includes(value as RecurringFrequency)) {
    return value as RecurringFrequency;
  }

  return 'MONTHLY';
}

function toRecurringItems(
  candidate: unknown,
  fallbackTitle: string,
  today: string,
) {
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.reduce<OnboardingDraft['recurringIncomes']>((acc, item, index) => {
    if (!item || typeof item !== 'object') {
      return acc;
    }

    const source = item as Record<string, unknown>;
    const amount = toSafeNumber(source.amount);

    if (amount <= 0) {
      return acc;
    }

    const title = toSafeString(source.title).trim() || `${fallbackTitle} ${index + 1}`;
    const nextDateCandidate = toSafeString(source.nextDate);

    acc.push({
      title,
      amount,
      nextDate: isValidDateInput(nextDateCandidate) ? nextDateCandidate : today,
      frequency: toRecurringFrequency(source.frequency),
    });

    return acc;
  }, []);
}

function parseOnboardingDraft(raw: unknown): OnboardingDraft | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const today = formatInputDate(new Date());
  const currentBalance = toSafeNumber(source.currentBalance);
  const goalAmount = toSafeNumber(source.goalAmount);

  if (Array.isArray(source.recurringIncomes) || Array.isArray(source.recurringExpenses)) {
    return {
      currentBalance,
      goalAmount,
      recurringIncomes: toRecurringItems(source.recurringIncomes, 'Revenu', today),
      recurringExpenses: toRecurringItems(source.recurringExpenses, 'Depense', today),
    };
  }

  if (
    'recurringIncomeAmount' in source ||
    'recurringIncomeTitle' in source ||
    'recurringExpenseAmount' in source ||
    'recurringExpenseTitle' in source
  ) {
    const recurringIncomes: OnboardingDraft['recurringIncomes'] = [];
    const recurringExpenses: OnboardingDraft['recurringExpenses'] = [];

    const recurringIncomeAmount = toSafeNumber(source.recurringIncomeAmount);
    if (recurringIncomeAmount > 0) {
      recurringIncomes.push({
        title: toSafeString(source.recurringIncomeTitle).trim() || 'Revenu principal',
        amount: recurringIncomeAmount,
        nextDate: isValidDateInput(toSafeString(source.recurringIncomeNextDate))
          ? toSafeString(source.recurringIncomeNextDate)
          : today,
        frequency: 'MONTHLY',
      });
    }

    const recurringExpenseAmount = toSafeNumber(source.recurringExpenseAmount);
    if (recurringExpenseAmount > 0) {
      recurringExpenses.push({
        title: toSafeString(source.recurringExpenseTitle).trim() || 'Depense fixe',
        amount: recurringExpenseAmount,
        nextDate: isValidDateInput(toSafeString(source.recurringExpenseNextDate))
          ? toSafeString(source.recurringExpenseNextDate)
          : today,
        frequency: 'MONTHLY',
      });
    }

    return {
      currentBalance,
      goalAmount,
      recurringIncomes,
      recurringExpenses,
    };
  }

  const recurringIncomes: OnboardingDraft['recurringIncomes'] = [];
  const recurringExpenses: OnboardingDraft['recurringExpenses'] = [];

  const monthlyIncome = toSafeNumber(source.monthlyIncome);
  if (monthlyIncome > 0) {
    recurringIncomes.push({
      title: 'Revenu principal',
      amount: monthlyIncome,
      nextDate: today,
      frequency: 'MONTHLY',
    });
  }

  const mainChargeAmount = toSafeNumber(source.mainChargeAmount);
  if (mainChargeAmount > 0) {
    recurringExpenses.push({
      title: toSafeString(source.mainChargeTitle).trim() || 'Depense fixe',
      amount: mainChargeAmount,
      nextDate: today,
      frequency: 'MONTHLY',
    });
  }

  return {
    currentBalance,
    goalAmount,
    recurringIncomes,
    recurringExpenses,
  };
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
  onboardingDraft: OnboardingDraft | null;
  completeOnboarding: (draft: OnboardingDraft) => Promise<void>;
  skipOnboarding: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (input: {
    email: string;
    password: string;
    name?: string;
  }) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [onboardingDraft, setOnboardingDraft] = useState<OnboardingDraft | null>(null);

  const initialize = useCallback(async () => {
    try {
      const [storedToken, onboardingDoneUserId, onboardingPendingUserId, draftRaw] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        AsyncStorage.getItem(ONBOARDING_DONE_USER_KEY),
        AsyncStorage.getItem(ONBOARDING_PENDING_USER_KEY),
        AsyncStorage.getItem(ONBOARDING_DRAFT_KEY),
      ]);

      if (draftRaw) {
        const parsedDraft = parseOnboardingDraft(JSON.parse(draftRaw));
        setOnboardingDraft(parsedDraft);
      } else {
        setOnboardingDraft(null);
      }

      if (!storedToken) {
        setOnboardingCompleted(false);
        return;
      }

      setToken(storedToken);
      setAccessToken(storedToken);

      const profile = await me();
      setUser(profile);
      const shouldShowOnboarding = onboardingPendingUserId === profile.id;
      setOnboardingCompleted(!shouldShowOnboarding);

      if (!shouldShowOnboarding && onboardingDoneUserId !== profile.id) {
        await AsyncStorage.setItem(ONBOARDING_DONE_USER_KEY, profile.id);
      }
    } catch (_error) {
      setAccessToken(null);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      setToken(null);
      setUser(null);
      setOnboardingCompleted(false);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const persistSession = useCallback(async (nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    setAccessToken(nextToken);
    await SecureStore.setItemAsync(TOKEN_KEY, nextToken);
  }, []);

  const bootstrapTransactions = useCallback(async (draft: OnboardingDraft | null) => {
    if (!draft) {
      return;
    }

    const today = formatInputDate(new Date());
    for (const income of draft.recurringIncomes) {
      if (income.amount <= 0) {
        continue;
      }

      await createTransaction({
        title: income.title.trim() || 'Revenu principal',
        amount: income.amount,
        type: 'INCOME',
        frequency: income.frequency,
        date: isValidDateInput(income.nextDate) ? income.nextDate : today,
        note: 'Initialise depuis onboarding',
      });
    }

    for (const expense of draft.recurringExpenses) {
      if (expense.amount <= 0) {
        continue;
      }

      await createTransaction({
        title: expense.title.trim() || 'Depense fixe principale',
        amount: expense.amount,
        type: 'EXPENSE',
        frequency: expense.frequency,
        date: isValidDateInput(expense.nextDate) ? expense.nextDate : today,
        note: 'Initialise depuis onboarding',
      });
    }
  }, []);

  const completeOnboarding = useCallback(async (draft: OnboardingDraft) => {
    try {
      setOnboardingDraft(draft);
      let onboardingDoneUserId = user?.id ?? '';

      if (token) {
        await updateMe({
          currentBalance: draft.currentBalance,
          goalAmount: draft.goalAmount > 0 ? draft.goalAmount : undefined,
        });
        await bootstrapTransactions(draft);
        const refreshed = await me();
        setUser(refreshed);
        onboardingDoneUserId = refreshed.id;
      }

      await AsyncStorage.multiSet([
        [ONBOARDING_DONE_USER_KEY, onboardingDoneUserId],
        [ONBOARDING_DRAFT_KEY, JSON.stringify(draft)],
      ]);
      await AsyncStorage.removeItem(ONBOARDING_PENDING_USER_KEY);
      setOnboardingCompleted(true);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }, [bootstrapTransactions, token, user?.id]);

  const skipOnboarding = useCallback(async () => {
    setOnboardingDraft(null);
    await AsyncStorage.setItem(ONBOARDING_DONE_USER_KEY, user?.id ?? '');
    await AsyncStorage.removeItem(ONBOARDING_PENDING_USER_KEY);
    await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
    setOnboardingCompleted(true);
  }, [user?.id]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    try {
      const response = await login({ email, password });
      await persistSession(response.accessToken, response.user);
      const [onboardingDoneUserId, onboardingPendingUserId] = await Promise.all([
        AsyncStorage.getItem(ONBOARDING_DONE_USER_KEY),
        AsyncStorage.getItem(ONBOARDING_PENDING_USER_KEY),
      ]);
      const shouldShowOnboarding = onboardingPendingUserId === response.user.id;
      setOnboardingCompleted(!shouldShowOnboarding);

      if (!shouldShowOnboarding && onboardingDoneUserId !== response.user.id) {
        await AsyncStorage.setItem(ONBOARDING_DONE_USER_KEY, response.user.id);
      }
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }, [persistSession]);

  const registerWithEmail = useCallback(
    async (input: { email: string; password: string; name?: string }) => {
      try {
        const response = await register({
          email: input.email,
          password: input.password,
          name: input.name,
        });

        await persistSession(response.accessToken, response.user);
        setOnboardingDraft(null);
        setOnboardingCompleted(false);
        await AsyncStorage.setItem(ONBOARDING_PENDING_USER_KEY, response.user.id);
        await AsyncStorage.removeItem(ONBOARDING_DRAFT_KEY);
      } catch (error) {
        throw new Error(getErrorMessage(error));
      }
    },
    [persistSession],
  );

  const refreshUser = useCallback(async () => {
    if (!token) {
      return;
    }

    const profile = await me();
    setUser(profile);
  }, [token]);

  const logout = useCallback(async () => {
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setOnboardingDraft(null);
    setOnboardingCompleted(false);
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isInitializing,
      isAuthenticated: Boolean(token),
      onboardingCompleted,
      onboardingDraft,
      completeOnboarding,
      skipOnboarding,
      loginWithEmail,
      registerWithEmail,
      refreshUser,
      logout,
    }),
    [
      user,
      token,
      isInitializing,
      onboardingCompleted,
      onboardingDraft,
      completeOnboarding,
      skipOnboarding,
      loginWithEmail,
      registerWithEmail,
      refreshUser,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
