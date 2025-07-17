/**
 * Fyers Broker Types
 * Type definitions specific to Fyers broker
 */

export interface FyersCredentials {
  appId: string;
  clientId: string;
  secretKey: string;
  redirectUri: string;
  authCode?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface FyersLoginResponse {
  success: boolean;
  message: string;
  authUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  data?: any;
}

export interface FyersOrderRequest {
  symbol: string;
  qty: number;
  type: number;
  side: number;
  productType: string;
  limitPrice?: number;
  stopPrice?: number;
  validity: string;
  disclosedQty?: number;
  offlineOrder?: boolean;
}

export interface FyersOrderResponse {
  s: string;
  code: number;
  message: string;
  id?: string;
}

export interface FyersQuoteResponse {
  s: string;
  d?: {
    symbol: string;
    lp: number;
    open_price: number;
    high_price: number;
    low_price: number;
    prev_close_price: number;
    volume: number;
  };
}

export interface FyersPositionResponse {
  s: string;
  netPositions?: Array<{
    symbol: string;
    qty: number;
    avgPrice: number;
    pnl: number;
    side: number;
  }>;
}

// Note: Core types are exported from @copytrade/unified-broker
