import {
  BankConnectionsResponse,
  BankLinkTokenResponse,
  BankRecurringAnalysis,
  ExchangeBankPublicTokenResponse,
  FinalizeBankLinkTokenResponse,
  SyncBankConnectionResponse,
} from '../types/api';
import { apiClient } from './client';

export async function fetchBankConnections() {
  const { data } = await apiClient.get<BankConnectionsResponse>('/banking/connections');
  return data;
}

export async function createBankLinkToken(daysRequested?: number, hostedLink = false) {
  const { data } = await apiClient.post<BankLinkTokenResponse>('/banking/link-token', {
    daysRequested,
    hostedLink,
  });
  return data;
}

export async function exchangeBankPublicToken(publicToken: string, syncNow = true) {
  const { data } = await apiClient.post<ExchangeBankPublicTokenResponse>(
    '/banking/exchange-public-token',
    {
      publicToken,
      syncNow,
    },
  );
  return data;
}

export async function finalizeBankLinkToken(linkToken: string, syncNow = true) {
  const { data } = await apiClient.post<FinalizeBankLinkTokenResponse>(
    '/banking/finalize-link-token',
    {
      linkToken,
      syncNow,
    },
  );
  return data;
}

export async function syncBankConnection(connectionId: string) {
  const { data } = await apiClient.post<SyncBankConnectionResponse>(
    `/banking/connections/${connectionId}/sync`,
  );
  return data;
}

export async function fetchBankRecurringAnalysis() {
  const { data } = await apiClient.get<BankRecurringAnalysis>('/banking/recurring-analysis');
  return data;
}

export async function disconnectBankConnection(connectionId: string) {
  const { data } = await apiClient.delete<{ success: boolean }>(
    `/banking/connections/${connectionId}`,
  );
  return data;
}
