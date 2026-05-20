import { Category } from '../types/api';
import { apiClient } from './client';

export async function fetchCategories() {
  const { data } = await apiClient.get<Category[]>('/categories');
  return data;
}

export async function createCategory(payload: {
  name: string;
  type?: 'INCOME' | 'EXPENSE';
  color?: string;
  icon?: string;
}) {
  const { data } = await apiClient.post<Category>('/categories', payload);
  return data;
}
