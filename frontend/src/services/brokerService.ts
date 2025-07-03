import api from './api';

export interface ShoonyaCredentials {
  userId: string;
  password: string;
  totpKey: string;  // Changed from twoFA to totpKey
  vendorCode: string;
  apiSecret: string;
  imei: string;
}

export interface FyersCredentials {
  clientId: string;
  secretKey: string;
  redirectUri: string;
  totpKey?: string;
}

export interface BrokerConnectionResponse {
  success: boolean;
  message: string;
  data?: {
    brokerName: string;
    userId?: string;
    accountId?: string;
    userName?: string;
    email?: string;
    brokerDisplayName?: string;
    lastAccessTime?: string;
    exchanges?: string[];
    products?: string[];
    // Fyers specific fields
    authUrl?: string;
    accessToken?: string;
    requiresAuthCode?: boolean;
    requiresAuth?: boolean;
    requiresReauth?: boolean;
  };
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface ConnectedAccount {
  id: string;
  broker_name: string;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: string[];
  products: string[];
  created_at: string;
  updated_at: string;
}

export interface AccountStatusResponse {
  success: boolean;
  message: string;
  data?: {
    accountId: string;
    brokerName: string;
    isActive: boolean;
    sessionInfo?: {
      lastChecked: string;
      status: 'active' | 'expired' | 'unknown';
      message: string;
    };
  };
}

export interface PlaceOrderRequest {
  brokerName: string;
  accountId: string; // ID of the specific broker account to use
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  price?: number;
  triggerPrice?: number;
  exchange?: string;
  productType?: string;
  remarks?: string;
}

export interface OrderResponse {
  success: boolean;
  message: string;
  data?: {
    orderId: string;
    brokerName: string;
    symbol: string;
    action: string;
    quantity: number;
    orderType: string;
    price?: number;
    triggerPrice?: number;
    exchange: string;
    status: string;
    timestamp: string;
  };
}

export const brokerService = {
  // Fyers-specific authentication methods
  async validateFyersAuthCode(authCode: string, credentials: FyersCredentials): Promise<BrokerConnectionResponse> {
    try {
      console.log('🔐 Validating Fyers auth code...');
      const response = await api.post<BrokerConnectionResponse>('/broker/validate-fyers-auth', {
        authCode,
        credentials,
      });
      return response.data;
    } catch (error: any) {
      console.error('🚨 Validate Fyers auth code error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async connectBroker(brokerName: string, credentials: ShoonyaCredentials | FyersCredentials): Promise<BrokerConnectionResponse> {
    try {
      console.log(`🔗 Connecting to ${brokerName} broker...`);
      const response = await api.post<BrokerConnectionResponse>('/broker/connect', {
        brokerName,
        credentials,
      });
      return response.data;
    } catch (error: any) {
      console.error('🚨 Connect broker error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  // Account management methods
  async getConnectedAccounts(): Promise<{ success: boolean; data?: ConnectedAccount[]; message?: string }> {
    try {
      const response = await api.get('/broker/accounts');
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get connected accounts error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async checkAccountStatus(accountId: string): Promise<AccountStatusResponse> {
    try {
      const response = await api.get(`/broker/accounts/${accountId}/status`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Check account status error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async activateAccount(accountId: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(`🔄 Activating account ${accountId}...`);
      const response = await api.post(`/broker/accounts/${accountId}/activate`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Activate account error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async deactivateAccount(accountId: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(`🔄 Deactivating account ${accountId}...`);
      const response = await api.post(`/broker/accounts/${accountId}/deactivate`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Deactivate account error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async removeAccount(accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🗑️ Removing account ${accountId}...`);
      const response = await api.delete(`/broker/accounts/${accountId}`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Remove account error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async disconnectBroker(brokerName: string, accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔌 Disconnecting from ${brokerName} account ${accountId}...`);
      const response = await api.post('/broker/disconnect', {
        brokerName,
        accountId,
      });
      return response.data;
    } catch (error: any) {
      console.error('🚨 Disconnect broker error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  // Trading methods

  async placeOrder(orderData: PlaceOrderRequest): Promise<OrderResponse> {
    try {
      console.log(`📝 Placing ${orderData.action} order for ${orderData.symbol} via ${orderData.brokerName}...`);
      const response = await api.post<OrderResponse>('/broker/place-order', orderData);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Place order error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async getOrderBook(brokerName: string, accountId?: string): Promise<any> {
    try {
      console.log(`📊 Fetching order book for ${brokerName}${accountId ? ` account ${accountId}` : ''}...`);
      const url = accountId ? `/broker/orders/${brokerName}?accountId=${accountId}` : `/broker/orders/${brokerName}`;
      const response = await api.get(url);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get order book error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async checkOrderStatus(orderId: string): Promise<any> {
    try {
      const response = await api.post('/broker/check-order-status', {
        orderId
      });
      return response.data;
    } catch (error: any) {
      console.error('🚨 Check order status error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async getPositions(brokerName: string, accountId?: string): Promise<any> {
    try {
      console.log(`📊 Fetching positions for ${brokerName}${accountId ? ` account ${accountId}` : ''}...`);
      const url = accountId ? `/broker/positions/${brokerName}?accountId=${accountId}` : `/broker/positions/${brokerName}`;
      const response = await api.get(url);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get positions error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  // Symbol search method
  async searchSymbol(brokerName: string, exchange: string, symbol: string): Promise<any> {
    try {
      console.log(`🔍 Searching for ${symbol} on ${exchange} via ${brokerName}...`);
      const response = await api.get(`/broker/search/${brokerName}/${exchange}/${symbol}`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Search symbol error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },



  async getQuotes(brokerName: string, exchange: string, token: string): Promise<any> {
    try {
      const response = await api.get(`/broker/quotes/${brokerName}/${exchange}/${token}`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get quotes error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async getOrderHistory(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      status?: string;
      symbol?: string;
      brokerName?: string;
      startDate?: string;
      endDate?: string;
      action?: 'BUY' | 'SELL';
      search?: string;
    }
  ): Promise<{
    success: boolean;
    data?: {
      orders: Array<{
        id: number;
        broker_name: string;
        broker_order_id: string;
        symbol: string;
        action: 'BUY' | 'SELL';
        quantity: number;
        price: number;
        order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
        status: string;
        exchange: string;
        executed_at: string;
        created_at: string;
      }>;
      totalCount: number;
      limit: number;
      offset: number;
      filters?: any;
    };
    message?: string;
  }> {
    try {
      // Build query parameters
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      // Add filters if provided
      if (filters) {
        if (filters.status) params.append('status', filters.status);
        if (filters.symbol) params.append('symbol', filters.symbol);
        if (filters.brokerName) params.append('brokerName', filters.brokerName);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.action) params.append('action', filters.action);
        if (filters.search) params.append('search', filters.search);
      }

      const response = await api.get(`/broker/order-history?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get order history error:', error);
      return {
        success: false,
        message: 'Failed to fetch order history. Please try again.',
      };
    }
  },

  async getOrderSearchSuggestions(searchTerm: string, limit: number = 10): Promise<{
    success: boolean;
    data?: {
      suggestions: Array<{
        value: string;
        type: 'symbol' | 'order_id' | 'broker_order_id';
      }>;
      searchTerm: string;
    };
    message?: string;
  }> {
    try {
      const params = new URLSearchParams({
        q: searchTerm,
        limit: limit.toString(),
      });

      const response = await api.get(`/broker/order-search-suggestions?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get search suggestions error:', error);
      return {
        success: false,
        message: 'Failed to fetch search suggestions. Please try again.',
      };
    }
  },
};
