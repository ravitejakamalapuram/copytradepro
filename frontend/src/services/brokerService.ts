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
      
      if (error.response?.data) {
        return error.response.data;
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

  async getOrderBook(brokerName: string): Promise<any> {
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

  async getPositions(brokerName: string): Promise<any> {
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

  async searchSymbol(brokerName: string, exchange: string, symbol: string): Promise<any> {
    try {
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
};
