import { ThemeMode } from '../theme/theme';

export type TransactionType = 'INCOME' | 'EXPENSE';
export type Frequency = 'ONCE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type RecurringFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type AccountType = 'BANK' | 'PRECIOUS_METALS' | 'CRYPTO';
export type BankProvider = 'PLAID';
export type BankConnectionStatus = 'ACTIVE' | 'NEEDS_REAUTH' | 'DISCONNECTED';

export interface User {
  id: string;
  email: string;
  name: string | null;
  currentBalance: number;
  goalAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  type: TransactionType | null;
  color: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string | null;
  title: string;
  amount: number;
  type: TransactionType;
  frequency: Frequency;
  recurrenceIntervalDays: number | null;
  date: string;
  endDate: string | null;
  categoryId: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  category: Category | null;
  account: Account | null;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  icon: string | null;
  color: string | null;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface RegisterPayload {
  email: string;
  password: string;
  currentBalance?: number;
  goalAmount?: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginApplePayload {
  identityToken: string;
  email?: string;
  fullName?: string;
}

export interface UpdateMePayload {
  currentBalance?: number;
  goalAmount?: number;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface RegisterPushTokenPayload {
  token: string;
}

export interface ExportMyDataResponse {
  generatedAt: string;
  data: unknown;
}

export interface CreateTransactionPayload {
  title: string;
  amount: number;
  type: TransactionType;
  frequency: Frequency;
  recurrenceIntervalDays?: number;
  date: string;
  endDate?: string | null;
  categoryId?: string;
  accountId?: string;
  note?: string;
  source?: 'MANUAL' | 'RECURRING_APPLY';
}

export interface YearProjectionMonth {
  year: number;
  month: number;
  label: string;
  startingBalance: number;
  expectedIncome: number;
  expectedExpenses: number;
  endingBalance: number;
}

export interface YearProjection {
  year: number;
  currentBalance: number;
  estimatedYearEndBalance: number;
  months: YearProjectionMonth[];
  summary: string;
  fixedExpenseRatio: number | null;
  yearlyPotentialSavings: number;
}

export interface MonthProjection {
  year: number;
  month: number;
  label: string;
  startingBalance: number;
  expectedIncome: number;
  expectedExpenses: number;
  endingBalance: number;
  summary: string;
}

export interface OnboardingDraft {
  currentBalance: number;
  goalAmount: number;
  recurringIncomes: Array<{
    title: string;
    amount: number;
    nextDate: string;
    frequency: RecurringFrequency;
  }>;
  recurringExpenses: Array<{
    title: string;
    amount: number;
    nextDate: string;
    frequency: RecurringFrequency;
  }>;
}

export interface ThemePreference {
  mode: ThemeMode;
}

export interface LabelSuggestion {
  id: string;
  label: string;
  type: 'expense' | 'income';
  category?: string;
  score: number;
}

export interface BankConnection {
  id: string;
  provider: BankProvider;
  status: BankConnectionStatus;
  institutionId: string | null;
  institutionName: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BankConnectionsResponse {
  providerConfigured: boolean;
  items: BankConnection[];
}

export interface BankLinkTokenResponse {
  linkToken: string;
  hostedLinkUrl: string | null;
  expiration: string;
  requestId: string;
  daysRequested: number;
  countryCodes: string[];
  hostedLink: boolean;
}

export interface SyncBankConnectionResponse {
  connectionId: string;
  added: number;
  modified: number;
  removed: number;
  recurringDetected: number;
  recurringUpdated: number;
  recurringCreated: number;
  recurringDisabled: number;
  lastCursor: string;
}

export interface ExchangeBankPublicTokenResponse {
  connection: BankConnection;
  sync: SyncBankConnectionResponse | null;
}

export interface FinalizeBankLinkTokenResponse {
  status: string;
  completed: boolean;
  connection?: BankConnection;
  sync?: SyncBankConnectionResponse | null;
}

export interface BankRecurringStream {
  id: string;
  connectionId: string;
  institutionName: string | null;
  title: string;
  amount: number;
  type: TransactionType;
  frequency: Frequency;
  recurrenceIntervalDays: number | null;
  nextDate: string;
  lastDetectedAt: string;
  monthlyEstimate: number;
}

export interface BankRecurringAnalysis {
  streamCount: number;
  streams: BankRecurringStream[];
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  monthlyNet: number;
}
