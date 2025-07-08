/**
 * Fyers Broker Helper Functions
 * Utility functions specific to Fyers broker integration
 */

import { OrderRequest } from '../../interfaces/IBrokerService';
import { FyersOrderRequest } from './types';

/**
 * Transform unified order request to Fyers format
 */
export function transformOrderRequest(orderRequest: OrderRequest): FyersOrderRequest {
  return {
    symbol: formatSymbol(orderRequest.symbol, orderRequest.exchange),
    qty: orderRequest.quantity,
    type: mapOrderType(orderRequest.orderType),
    side: mapOrderSide(orderRequest.action),
    productType: mapProductType(orderRequest.productType),
    limitPrice: orderRequest.price || 0,
    stopPrice: (orderRequest as any).stopPrice || 0,
    validity: mapValidity(orderRequest.validity),
    disclosedQty: 0,
    offlineOrder: false
  };
}

/**
 * Format symbol for Fyers API
 */
export function formatSymbol(symbol: string, exchange: string): string {
  return `${exchange}:${symbol}`;
}

/**
 * Map unified order type to Fyers order type
 */
export function mapOrderType(orderType: string): number {
  const mapping: Record<string, number> = {
    'MARKET': 2,
    'LIMIT': 1,
    'SL-LIMIT': 3,
    'SL-MARKET': 4
  };
  return mapping[orderType] || 1;
}

/**
 * Map unified order action to Fyers side
 */
export function mapOrderSide(action: string): number {
  return action === 'BUY' ? 1 : -1;
}

/**
 * Map unified product type to Fyers product type
 */
export function mapProductType(productType: string): string {
  const mapping: Record<string, string> = {
    'CNC': 'CNC',
    'MIS': 'INTRADAY',
    'NRML': 'MARGIN',
    'BO': 'BO'
  };
  return mapping[productType] || 'CNC';
}

/**
 * Map unified validity to Fyers validity
 */
export function mapValidity(validity: string): string {
  const mapping: Record<string, string> = {
    'DAY': 'DAY',
    'IOC': 'IOC',
    'GTD': 'GTD'
  };
  return mapping[validity] || 'DAY';
}

/**
 * Parse Fyers order status to unified format
 */
export function parseOrderStatus(fyersStatus: number): string {
  const mapping: Record<number, string> = {
    1: 'PENDING',
    2: 'EXECUTED',
    3: 'CANCELLED',
    4: 'REJECTED',
    5: 'PENDING'
  };
  return mapping[fyersStatus] || 'PENDING';
}

/**
 * Validate Fyers credentials
 */
export function validateCredentials(credentials: any): boolean {
  const required = ['appId', 'secretKey', 'redirectUri'];
  return required.every(field => credentials[field] && credentials[field].trim() !== '');
}

/**
 * Generate Fyers auth URL
 */
export function generateAuthUrl(appId: string, redirectUri: string): string {
  const baseUrl = 'https://api.fyers.in/api/v2/generate-authcode';
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: 'sample_state'
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Format error message from Fyers response
 */
export function formatErrorMessage(response: any): string {
  if (response.message) {
    return response.message;
  }
  if (response.s === 'error') {
    return 'Operation failed';
  }
  return 'Unknown error occurred';
}
