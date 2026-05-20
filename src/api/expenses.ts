import { LabelSuggestion } from '../types/api';
import { apiClient } from './client';

type SuggestionType = 'expense' | 'income';

export async function fetchLabelSuggestions(
  query: string,
  type: SuggestionType,
) {
  const { data } = await apiClient.get<LabelSuggestion[]>(
    '/api/expenses/label-suggestions',
    {
      params: {
        query,
        type,
      },
    },
  );

  if (!Array.isArray(data)) {
    return [];
  }

  return data.slice(0, 5);
}
