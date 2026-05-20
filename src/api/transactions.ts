import { CreateTransactionPayload, Transaction } from '../types/api';
import { apiClient } from './client';

export async function fetchTransactions(params?: {
  month?: number;
  year?: number;
  type?: 'INCOME' | 'EXPENSE';
  includeFutureOnly?: boolean;
  accountId?: string;
}) {
  const { data } = await apiClient.get<Transaction[]>('/transactions', { params });
  return data;
}

export async function createTransaction(payload: CreateTransactionPayload) {
  const { data } = await apiClient.post<Transaction>('/transactions', payload);
  return data;
}

export async function updateTransaction(
  id: string,
  payload: Partial<CreateTransactionPayload>,
) {
  const { data } = await apiClient.patch<Transaction>(`/transactions/${id}`, payload);
  return data;
}

export async function deleteTransaction(id: string) {
  const { data } = await apiClient.delete<{ success: boolean }>(`/transactions/${id}`);
  return data;
}
