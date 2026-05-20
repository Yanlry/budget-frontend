import { MonthProjection, YearProjection } from '../types/api';
import { apiClient } from './client';

export async function fetchYearProjection(year?: number, accountId?: string) {
  const { data } = await apiClient.get<YearProjection>('/projections/year', {
    params: { year, accountId },
  });
  return data;
}

export async function fetchMonthProjection(params?: {
  year?: number;
  month?: number;
  accountId?: string;
}) {
  const { data } = await apiClient.get<MonthProjection>('/projections/month', {
    params,
  });
  return data;
}
