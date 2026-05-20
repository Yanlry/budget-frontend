import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { formatInputDate } from '../utils/format';

const GOAL_STORAGE_KEY_PREFIX = 'budget_app_goal_v1_';
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface SavingsGoal {
  title: string;
  targetAmount: number;
  targetDate: string;
  accountId: string | 'all';
  updatedAt: string;
}

interface GoalContextValue {
  goal: SavingsGoal | null;
  isLoading: boolean;
  saveGoal: (payload: {
    title: string;
    targetAmount: number;
    targetDate: string;
    accountId: string | 'all';
  }) => Promise<void>;
  clearGoal: () => Promise<void>;
  refreshGoal: () => Promise<void>;
}

export const GoalContext = createContext<GoalContextValue | null>(null);

function buildStorageKey(userId: string) {
  return `${GOAL_STORAGE_KEY_PREFIX}${userId}`;
}

function parseSavedGoal(raw: string | null): SavingsGoal | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SavingsGoal> | null;
    if (!parsed) {
      return null;
    }

    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    const targetAmount = Number(parsed.targetAmount);
    const targetDate = typeof parsed.targetDate === 'string' ? parsed.targetDate : '';
    const accountId =
      typeof parsed.accountId === 'string' && parsed.accountId.trim().length
        ? parsed.accountId
        : 'all';
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString();

    if (!title || !DATE_INPUT_PATTERN.test(targetDate) || !Number.isFinite(targetAmount) || targetAmount <= 0) {
      return null;
    }

    return {
      title,
      targetAmount,
      targetDate,
      accountId,
      updatedAt,
    };
  } catch (error) {
    console.error('Impossible de parser l objectif local:', error);
    return null;
  }
}

export function GoalProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [goal, setGoal] = useState<SavingsGoal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshGoal = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setGoal(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const storageKey = buildStorageKey(user.id);
      const saved = await AsyncStorage.getItem(storageKey);
      const parsed = parseSavedGoal(saved);

      if (parsed) {
        setGoal(parsed);
        return;
      }

      if (user.goalAmount != null && user.goalAmount > 0) {
        const defaultGoal: SavingsGoal = {
          title: "Objectif de fin d'annee",
          targetAmount: user.goalAmount,
          targetDate: formatInputDate(new Date(new Date().getFullYear(), 11, 31)),
          accountId: 'all',
          updatedAt: new Date().toISOString(),
        };
        setGoal(defaultGoal);
        return;
      }

      setGoal(null);
    } catch (error) {
      console.error('Impossible de charger l objectif local:', error);
      setGoal(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.goalAmount, user?.id]);

  useEffect(() => {
    void refreshGoal();
  }, [refreshGoal]);

  const saveGoal = useCallback(
    async (payload: {
      title: string;
      targetAmount: number;
      targetDate: string;
      accountId: string | 'all';
    }) => {
      if (!isAuthenticated || !user?.id) {
        return;
      }

      const normalizedTitle = payload.title.trim() || 'Mon objectif';
      const normalizedAmount = Number(payload.targetAmount);
      const normalizedDate = payload.targetDate.trim();
      const normalizedAccountId =
        typeof payload.accountId === 'string' && payload.accountId.trim().length
          ? payload.accountId
          : 'all';

      if (
        !Number.isFinite(normalizedAmount) ||
        normalizedAmount <= 0 ||
        !DATE_INPUT_PATTERN.test(normalizedDate)
      ) {
        return;
      }

      const nextGoal: SavingsGoal = {
        title: normalizedTitle,
        targetAmount: normalizedAmount,
        targetDate: normalizedDate,
        accountId: normalizedAccountId,
        updatedAt: new Date().toISOString(),
      };

      setGoal(nextGoal);
      try {
        await AsyncStorage.setItem(buildStorageKey(user.id), JSON.stringify(nextGoal));
      } catch (error) {
        console.error('Impossible de sauvegarder l objectif local:', error);
      }
    },
    [isAuthenticated, user?.id],
  );

  const clearGoal = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setGoal(null);
      return;
    }

    setGoal(null);
    try {
      await AsyncStorage.removeItem(buildStorageKey(user.id));
    } catch (error) {
      console.error('Impossible de supprimer l objectif local:', error);
    }
  }, [isAuthenticated, user?.id]);

  const value = useMemo(
    () => ({
      goal,
      isLoading,
      saveGoal,
      clearGoal,
      refreshGoal,
    }),
    [clearGoal, goal, isLoading, refreshGoal, saveGoal],
  );

  return <GoalContext.Provider value={value}>{children}</GoalContext.Provider>;
}
