import React, { createContext, useContext, type ReactNode } from 'react';
import { useAccountStatus } from '../hooks/useAccountStatus';
import type { ConnectedAccount } from '../services/accountService';

interface AccountStatusContextType {
  // State
  accounts: ConnectedAccount[];
  loading: boolean;
  error: string | null;
  connected: boolean;
  lastUpdate: Date | null;
  
  // Operations
  activateAccount: (accountId: string) => Promise<any>;
  deactivateAccount: (accountId: string) => Promise<boolean>;
  removeAccount: (accountId: string) => Promise<boolean>;
  checkAccountStatus: (accountId: string) => Promise<any>;
  refreshAccounts: () => Promise<void>;
  
  // WebSocket subscriptions
  subscribeToAccountUpdates: (accountId: string) => void;
  unsubscribeFromAccountUpdates: (accountId: string) => void;
  
  // Utilities
  getAccount: (accountId: string) => ConnectedAccount | null;
  getAccountsByBroker: (brokerName: string) => ConnectedAccount[];
  getActiveAccounts: () => ConnectedAccount[];
  isOperationInProgress: (accountId: string) => boolean;
  
  // Stats
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
}

const AccountStatusContext = createContext<AccountStatusContextType | undefined>(undefined);

interface AccountStatusProviderProps {
  children: ReactNode;
}

export const AccountStatusProvider: React.FC<AccountStatusProviderProps> = ({ children }) => {
  const accountStatus = useAccountStatus();

  return (
    <AccountStatusContext.Provider value={accountStatus}>
      {children}
    </AccountStatusContext.Provider>
  );
};

export const useAccountStatusContext = (): AccountStatusContextType => {
  const context = useContext(AccountStatusContext);
  if (context === undefined) {
    throw new Error('useAccountStatusContext must be used within an AccountStatusProvider');
  }
  return context;
};

export default AccountStatusContext;