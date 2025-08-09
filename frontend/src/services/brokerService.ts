import api from './api';

// Define interfaces for better type safety
interface Order {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: string;
  price?: number;
  status: string;
  exchange: string;
  brokerName: string;
  createdAt: string;
}

interface Position {
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface Quote {
  symbol: string;
  exchange: string;
  ltp: number;
  change: number;
  changePercent: number;
}

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
    // Minimal OAuth flow fields when required
    authUrl?: string;
    requiresAuthCode?: boolean;
    accountStatus?: 'PROCEED_TO_OAUTH' | 'ACTIVE' | 'INACTIVE';
    authenticationStep?: 'OAUTH_REQUIRED' | 'DIRECT_AUTH';
    stateToken?: string;

    // Direct auth (Shoonya) success fields (optional)
    brokerName?: string;
    accountId?: string;
    userName?: string;
    email?: string;
    brokerDisplayName?: string;
    exchanges?: string[];
    products?: string[];
    accessToken?: string;
  };
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// REMOVED: Single-account order interface - use PlaceMultiAccountOrderRequest instead

export interface PlaceMultiAccountOrderRequest {
  selectedAccounts: string[]; // Array of account IDs
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
  async validateFyersAuthCode(authCode: string, credentials: FyersCredentials): Promise<BrokerConnectionResponse> {
    const response = await api.post<BrokerConnectionResponse>('/broker/validate-fyers-auth', {
      authCode,
      credentials,
    });
    return response.data;
  },

  async connectBroker(brokerName: string, credentials: ShoonyaCredentials | FyersCredentials): Promise<BrokerConnectionResponse> {
    try {
      const response = await api.post<BrokerConnectionResponse>('/broker/connect', {
        brokerName,
        credentials,
      });
      return response.data;
    } catch (error: any) {
      console.error('🚨 Connect broker error:', error);

      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: BrokerConnectionResponse } };
        if (axiosError.response?.data) {
          return axiosError.response.data;
        }
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async disconnectBroker(brokerName: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post('/broker/disconnect', {
        brokerName,
      });
      return response.data as { success: boolean; message: string; };
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

  // REMOVED: Single-account order placement - use placeMultiAccountOrder instead

  async placeMultiAccountOrder(orderData: PlaceMultiAccountOrderRequest): Promise<{
    success: boolean;
    message: string;
    data?: {
      summary: {
        totalAccounts: number;
        successCount: number;
        failureCount: number;
        symbol: string;
        action: string;
        quantity: number;
        orderType: string;
      };
      successfulOrders: Array<{
        accountId: string;
        brokerName: string;
        accountDisplayName: string;
        orderId: string;
        message: string;
      }>;
      failedOrders: Array<{
        accountId: string;
        brokerName: string;
        accountDisplayName: string;
        error: string;
        errorType: string;
      }>;
      timestamp: string;
    };
  }> {
    try {
      const response = await api.post('/broker/place-multi-account-order', orderData);
      return response.data as any;
    } catch (error: any) {
      console.error('🚨 Place multi-account order error:', error);
      
      if (error.response?.data) {
        return error.response.data;
      }
      
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async getOrderBook(brokerName: string): Promise<{ success: boolean; data?: Order[]; message?: string }> {
    try {
      const response = await api.get(`/broker/orders/${brokerName}`);
      return response.data as { success: boolean; data?: Order[]; message?: string };
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

      // Return standardized error format for network errors
      return {
        success: false,
        error: {
          message: 'Network error. Please check your connection and try again.',
          code: 'NETWORK_ERROR',
          retryable: true
        },
        timestamp: new Date().toISOString()
      };
    }
  },

  async getPositions(brokerName: string): Promise<{ success: boolean; data?: Position[]; message?: string }> {
    try {
      const response = await api.get(`/broker/positions/${brokerName}`);
      return response.data as { success: boolean; data?: Position[]; message?: string };
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



  async getQuotes(brokerName: string, exchange: string, token: string): Promise<{ success: boolean; data?: Quote; message?: string }> {
    try {
      const response = await api.get(`/broker/quotes/${brokerName}/${exchange}/${token}`);
      return response.data as { success: boolean; data?: Quote; message?: string };
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
      accountIds?: string[]; // Array of account IDs to filter by
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
        if (filters.accountIds && filters.accountIds.length > 0) {
          params.append('accountIds', filters.accountIds.join(','));
        }
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.action) params.append('action', filters.action);
        if (filters.search) params.append('search', filters.search);
      }

      const response = await api.get(`/broker/order-history?${params.toString()}`);
      return response.data as {
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
      };
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
      return response.data as {
        success: boolean;
        data?: {
          suggestions: Array<{
            value: string;
            type: 'symbol' | 'order_id' | 'broker_order_id';
          }>;
          searchTerm: string;
        };
        message?: string;
      };
    } catch (error: any) {
      console.error('🚨 Get search suggestions error:', error);
      return {
        success: false,
        message: 'Failed to fetch search suggestions. Please try again.',
      };
    }
  },

  async refreshAllOrderStatus(): Promise<{
    success: boolean;
    message: string;
    data?: {
      totalOrders: number;
      updatedOrders: number;
      errors: string[];
    };
  }> {
    try {
      const response = await api.post('/broker/refresh-all-order-status');
      return response.data as { success: boolean; message: string; data?: { totalOrders: number; updatedOrders: number; errors: string[]; } | undefined; };
    } catch (error: any) {
      console.error('🚨 Refresh all order status error:', error);
      
      if (error.response?.data) {
        return error.response.data;
      }
      
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.'
      };
    }
  },

  async refreshOrderStatus(orderId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      orderId: string;
      oldStatus: string;
      newStatus: string;
      updated: boolean;
    };
  }> {
    try {
      const response = await api.post(`/broker/refresh-order-status/${orderId}`);
      return response.data as { success: boolean; message: string; data?: { orderId: string; oldStatus: string; newStatus: string; updated: boolean; } | undefined; };
    } catch (error: any) {
      console.error('🚨 Refresh order status error:', error);
      
      if (error.response?.data) {
        return error.response.data;
      }
      
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.'
      };
    }
  },

  async cancelOrder(orderId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      orderId: number;
      brokerOrderId: string;
      symbol: string;
      status: string;
      timestamp: string;
    };
  }> {
    try {
      const response = await api.post(`/broker/cancel-order/${orderId}`);
      return response.data as { success: boolean; message: string; data?: { orderId: number; brokerOrderId: string; symbol: string; status: string; timestamp: string; } | undefined; };
    } catch (error: any) {
      console.error('🚨 Cancel order error:', error);
      
      if (error.response?.data) {
        return error.response.data;
      }
      
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async modifyOrder(orderId: string, modifications: {
    quantity?: number;
    price?: number;
    triggerPrice?: number;
    orderType?: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  }): Promise<{
    success: boolean;
    message: string;
    data?: {
      orderId: number;
      brokerOrderId: string;
      symbol: string;
      modifications: any;
      timestamp: string;
    };
  }> {
    try {
      const response = await api.put(`/broker/modify-order/${orderId}`, modifications);
      return response.data as { success: boolean; message: string; data?: { orderId: number; brokerOrderId: string; symbol: string; modifications: any; timestamp: string; } | undefined; };
    } catch (error: any) {
      console.error('🚨 Modify order error:', error);
      
      if (error.response?.data) {
        return error.response.data;
      }
      
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async retryOrder(orderId: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const response = await api.post(`/broker/retry-order/${orderId}`);
      return response.data as { success: boolean; message: string; data?: any; };
    } catch (error: any) {
      console.error('Failed to retry order:', error);

      if (error.response?.data) {
        return {
          success: false,
          message: error.response.data.message || 'Failed to retry order',
        };
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async deleteOrder(orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/broker/delete-order/${orderId}`);
      return response.data as { success: boolean; message: string; };
    } catch (error: any) {
      console.error('Failed to delete order:', error);

      if (error.response?.data) {
        return {
          success: false,
          message: error.response.data.message || 'Failed to delete order',
        };
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },


};
