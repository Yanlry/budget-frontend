import { useContext } from 'react';
import { AccountsContext } from '../context/AccountsContext';

export function useAccounts() {
  const context = useContext(AccountsContext);

  if (!context) {
    throw new Error('useAccounts must be used inside AccountsProvider');
  }

  return context;
}

