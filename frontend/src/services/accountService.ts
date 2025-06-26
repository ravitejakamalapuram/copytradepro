import { api } from './api';

export interface ConnectedAccount {
  id: string;
  brokerName: string;
  accountId: string;
  userId: string;
  userName: string;
  email: string;
  brokerDisplayName: string;
  exchanges: string[];
  products: string[];
  isActive: boolean;
  createdAt: Date;
  accessToken?: string;
  // Fyers specific
  authUrl?: string;
  requiresAuthCode?: boolean;
}

export interface AccountResponse {
  success: boolean;
  message: string;
  data?: ConnectedAccount;
  accounts?: ConnectedAccount[];
}

export const accountService = {
  // Get all connected accounts for the current user
  async getConnectedAccounts(): Promise<ConnectedAccount[]> {
    try {
      const response = await api.get<AccountResponse>('/broker/accounts');
      return response.data.accounts || [];
    } catch (error) {
      console.error('Failed to get connected accounts:', error);
      return [];
    }
  },

  // Save a connected account
  async saveConnectedAccount(account: Omit<ConnectedAccount, 'id' | 'createdAt'>): Promise<ConnectedAccount | null> {
    try {
      const response = await api.post<AccountResponse>('/broker/accounts', account);
      return response.data.data || null;
    } catch (error) {
      console.error('Failed to save connected account:', error);
      return null;
    }
  },

  // Remove a connected account
  async removeConnectedAccount(accountId: string): Promise<boolean> {
    try {
      const response = await api.delete<AccountResponse>(`/broker/accounts/${accountId}`);
      return response.data.success;
    } catch (error) {
      console.error('Failed to remove connected account:', error);
      return false;
    }
  },

  // Update account status
  async updateAccountStatus(accountId: string, isActive: boolean): Promise<boolean> {
    try {
      const response = await api.patch<AccountResponse>(`/broker/accounts/${accountId}`, { isActive });
      return response.data.success;
    } catch (error) {
      console.error('Failed to update account status:', error);
      return false;
    }
  },

  // Local storage helpers for temporary storage during auth flow
  saveTemporaryAccount(account: Partial<ConnectedAccount>): void {
    localStorage.setItem('temp_account', JSON.stringify(account));
  },

  getTemporaryAccount(): Partial<ConnectedAccount> | null {
    const temp = localStorage.getItem('temp_account');
    return temp ? JSON.parse(temp) : null;
  },

  clearTemporaryAccount(): void {
    localStorage.removeItem('temp_account');
  },

  // Create account from broker response
  createAccountFromBrokerResponse(brokerName: string, brokerResponse: any, credentials: any): ConnectedAccount {
    const baseAccount = {
      id: Date.now().toString(),
      brokerName,
      isActive: true,
      createdAt: new Date(),
      exchanges: [],
      products: [],
    };

    if (brokerName === 'fyers') {
      return {
        ...baseAccount,
        accountId: brokerResponse.accessToken || 'fyers-account',
        userId: 'fyers-user',
        userName: 'Fyers User',
        email: '',
        brokerDisplayName: 'Fyers',
        accessToken: brokerResponse.accessToken,
      };
    } else if (brokerName === 'shoonya') {
      return {
        ...baseAccount,
        accountId: brokerResponse.accountId || brokerResponse.userId,
        userId: brokerResponse.userId,
        userName: brokerResponse.userName || brokerResponse.userId,
        email: brokerResponse.email || '',
        brokerDisplayName: 'Shoonya',
        exchanges: brokerResponse.exchanges || [],
        products: brokerResponse.products || [],
      };
    }

    // Default fallback
    return {
      ...baseAccount,
      accountId: 'unknown-account',
      userId: 'unknown-user',
      userName: 'Unknown User',
      email: '',
      brokerDisplayName: brokerName,
    };
  }
};
