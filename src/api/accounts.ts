import { Account } from '../types/api';
import { apiClient } from './client';

export async function fetchAccounts() {
  const { data } = await apiClient.get<Account[]>('/accounts');
  return data;
}

export async function createAccount(payload: {
  name: string;
  icon?: string;
  color?: string;
  currentBalance?: number;
}) {
  const { data } = await apiClient.post<Account>('/accounts', payload);
  return data;
}

export async function updateAccount(
  id: string,
  payload: Partial<{
    name: string;
    icon: string;
    color: string;
    currentBalance: number;
  }>,
) {
  const { data } = await apiClient.patch<Account>(`/accounts/${id}`, payload);
  return data;
}

export async function deleteAccount(id: string) {
  const { data } = await apiClient.delete<{
    success: boolean;
    movedToAccountId: string;
  }>(`/accounts/${id}`);
  return data;
}
