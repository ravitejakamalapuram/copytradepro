// Common broker credential types - matching actual service interfaces
export interface ShoonyaCredentials {
  userId: string;
  password: string;
  vendorCode: string;
  apiKey: string;
  imei: string;
  totpKey: string;
  apiSecret: string;
  totpSecret?: string;
}

export interface FyersCredentials {
  clientId: string;
  secretKey: string;
  appId?: string;
  secretId?: string;
  redirectUri?: string;
  authCode?: string;
  accessToken?: string;
  refreshToken?: string;
}

// Union type for all broker credentials
export type BrokerCredentials = ShoonyaCredentials | FyersCredentials;

// Common broker response types
export interface BrokerLoginResponse {
  success: boolean;
  message: string;
  data?: any;
  authUrl?: string;
}

export interface BrokerOrderResponse {
  success: boolean;
  message: string;
  data?: {
    orderId?: string;
    brokerOrderId?: string;
    status?: string;
  };
}

export interface BrokerQuoteResponse {
  success: boolean;
  message: string;
  data?: {
    symbol: string;
    ltp: number;
    change: number;
    changePercent: number;
    volume: number;
    high: number;
    low: number;
    open: number;
    close: number;
  };
}

export interface BrokerPositionResponse {
  success: boolean;
  message: string;
  data?: Array<{
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    pnl: number;
    exchange: string;
    productType: string;
  }>;
}

export interface BrokerOrderHistoryResponse {
  success: boolean;
  message: string;
  data?: Array<{
    orderId: string;
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    status: string;
    timestamp: string;
  }>;
}
