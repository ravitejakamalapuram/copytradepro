import api from './api';
import { AuthenticationStep } from '@copytrade/shared-types';

export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'PROCEED_TO_OAUTH';

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
  isActive: boolean; // Computed field for backward compatibility
  accountStatus: AccountStatus; // New authentication status
  tokenExpiryTime: string | null; // ISO string or null for infinity (Shoonya)
  createdAt: Date | string;
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

  // Activate account (re-authenticate)
  async activateAccount(accountId: string): Promise<{
    success: boolean;
    authStep?: AuthenticationStep;
    authUrl?: string;
    message?: string;
    error?: string;
  }> {
    try {
      const response = await api.post(`/broker/accounts/${accountId}/activate`);

      if (response.data.success) {
        return {
          success: true,
          message: response.data.message
        };
      } else {
        // Check if OAuth URL is provided
        if (response.data.authUrl) {
          return {
            success: false,
            authStep: AuthenticationStep.OAUTH_REQUIRED,
            authUrl: response.data.authUrl,
            message: response.data.message
          };
        }

        return {
          success: false,
          message: response.data.message,
          error: response.data.error?.code
        };
      }
    } catch (error: any) {
      console.error('Failed to activate account:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to activate account',
        error: error.response?.data?.error?.code || 'NETWORK_ERROR'
      };
    }
  },

  // Deactivate account (logout)
  async deactivateAccount(accountId: string): Promise<boolean> {
    try {
      const response = await api.post<AccountResponse>(`/broker/accounts/${accountId}/deactivate`);
      return response.data.success;
    } catch (error) {
      console.error('Failed to deactivate account:', error);
      return false;
    }
  },

  // Check session status for an account
  async checkAccountSessionStatus(accountId: string): Promise<{
    success: boolean;
    data?: {
      accountId: number;
      brokerName: string;
      isActive: boolean;
      sessionInfo: {
        lastChecked: string;
        status: 'active' | 'inactive' | 'expired' | 'error';
        message: string;
      };
    };
    message?: string;
  }> {
    try {
      const response = await api.get(`/broker/accounts/${accountId}/status`);
      return response.data as {
        success: boolean;
        data?: {
          accountId: number;
          brokerName: string;
          isActive: boolean;
          sessionInfo: {
            lastChecked: string;
            status: 'active' | 'inactive' | 'expired' | 'error';
            message: string;
          };
        };
        message?: string;
      };
    } catch (error) {
      console.error('Failed to check account session status:', error);
      return {
        success: false,
        message: 'Failed to check session status',
      };
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

  // Get available/initialized brokers from backend
  async getAvailableBrokers(): Promise<string[]> {
    try {
      const response = await api.get<{
        success: boolean;
        data: {
          brokers: string[];
          count: number;
        };
      }>('/broker/available');

      if (response.data.success) {
        return response.data.data.brokers;
      } else {
        console.error('Failed to get available brokers:', response.data);
        return [];
      }
    } catch (error) {
      console.error('Failed to fetch available brokers:', error);
      return [];
    }
  },

  // Create account from broker response
  createAccountFromBrokerResponse(brokerName: string, brokerResponse: any, _credentials: any): ConnectedAccount {
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
        accountStatus: 'PROCEED_TO_OAUTH' as AccountStatus,
        tokenExpiryTime: null,
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
        accountStatus: 'ACTIVE' as AccountStatus,
        tokenExpiryTime: null,
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
      accountStatus: 'INACTIVE' as AccountStatus,
      tokenExpiryTime: null,
    };
  }
};
