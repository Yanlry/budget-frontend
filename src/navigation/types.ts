import type { Transaction } from '../types/api';

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  MainTabs: undefined;
  AddTransaction: {
    transaction?: Transaction;
  } | undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Transactions: undefined;
  Projection: undefined;
  Settings: undefined;
};
