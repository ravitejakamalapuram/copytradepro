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
    databaseAccountId?: string; // Database account ID for OAuth completion
  };
  errors?: Array<{
    field: string;
    message: string;
  }>;
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

  async placeOrder(orderData: PlaceOrderRequest): Promise<OrderResponse> {
    try {
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

  async getOrderBook(brokerName: string): Promise<{ success: boolean; data?: Order[]; message?: string }> {
    try {
      const response = await api.get(`/broker/orders/${brokerName}`);
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

  async getPositions(brokerName: string): Promise<{ success: boolean; data?: Position[]; message?: string }> {
    try {
      const response = await api.get(`/broker/positions/${brokerName}`);
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



  async getQuotes(brokerName: string, exchange: string, token: string): Promise<{ success: boolean; data?: Quote; message?: string }> {
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
