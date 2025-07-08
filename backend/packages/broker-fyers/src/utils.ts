/**
 * Fyers Broker Utilities
 * Utility functions specific to Fyers broker
 */

import { FyersCredentials } from './types';

/**
 * Validate Fyers credentials
 */
export function validateFyersCredentials(credentials: FyersCredentials): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!credentials.appId || credentials.appId.trim() === '') {
    errors.push('App ID is required');
  }
  
  if (!credentials.clientId || credentials.clientId.trim() === '') {
    errors.push('Client ID is required');
  }
  
  if (!credentials.secretKey || credentials.secretKey.trim() === '') {
    errors.push('Secret key is required');
  }
  
  if (!credentials.redirectUri || credentials.redirectUri.trim() === '') {
    errors.push('Redirect URI is required');
  }
  
  // Validate redirect URI format
  try {
    new URL(credentials.redirectUri);
  } catch (error) {
    errors.push('Redirect URI must be a valid URL');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate Fyers OAuth authorization URL
 */
export function generateFyersAuthUrl(appId: string, redirectUri: string, state?: string): string {
  const baseUrl = 'https://api.fyers.in/api/v2/generate-authcode';
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state || `fyers_auth_${Date.now()}`
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate Fyers API endpoints
 */
export function getFyersEndpoints() {
  const baseUrl = 'https://api.fyers.in/api/v2/';
  
  return {
    generateAuthCode: 'https://api.fyers.in/api/v2/generate-authcode',
    validateAuthCode: `${baseUrl}validate-authcode`,
    validateRefreshToken: `${baseUrl}validate-refresh-token`,
    profile: `${baseUrl}profile`,
    funds: `${baseUrl}funds`,
    holdings: `${baseUrl}holdings`,
    positions: `${baseUrl}positions`,
    orders: `${baseUrl}orders`,
    trades: `${baseUrl}trades`,
    placeOrder: `${baseUrl}orders`,
    modifyOrder: `${baseUrl}orders`,
    cancelOrder: `${baseUrl}orders`,
    quotes: `${baseUrl}quotes`,
    depth: `${baseUrl}depth`,
    history: `${baseUrl}history`,
    search: `${baseUrl}search`,
    optionChain: `${baseUrl}optionchain`
  };
}

/**
 * Format Fyers error messages
 */
export function formatFyersError(response: any): string {
  if (response.message) {
    return response.message;
  }
  
  if (response.s === 'error') {
    return response.message || 'Operation failed';
  }
  
  if (response.error) {
    return response.error;
  }
  
  return 'Unknown error occurred';
}

/**
 * Check if Fyers response is successful
 */
export function isFyersResponseSuccess(response: any): boolean {
  return response && response.s === 'ok';
}

/**
 * Parse Fyers timestamp
 */
export function parseFyersTimestamp(timestamp: number): Date {
  // Fyers timestamps are typically Unix timestamps
  return new Date(timestamp * 1000);
}

/**
 * Format date for Fyers API
 */
export function formatDateForFyers(date: Date): string {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

/**
 * Get Fyers exchange codes
 */
export function getFyersExchangeCodes() {
  return {
    'NSE': 'NSE',
    'BSE': 'BSE',
    'NFO': 'NFO',
    'BFO': 'BFO',
    'MCX': 'MCX'
  };
}

/**
 * Get Fyers product type codes
 */
export function getFyersProductCodes() {
  return {
    'CNC': 'CNC',
    'MIS': 'INTRADAY',
    'NRML': 'MARGIN',
    'BO': 'BO'
  };
}

/**
 * Get Fyers order type codes
 */
export function getFyersOrderTypeCodes() {
  return {
    'MARKET': 2,
    'LIMIT': 1,
    'SL-LIMIT': 3,
    'SL-MARKET': 4
  };
}

/**
 * Get Fyers validity codes
 */
export function getFyersValidityCodes() {
  return {
    'DAY': 'DAY',
    'IOC': 'IOC',
    'GTD': 'GTD'
  };
}

/**
 * Parse authorization code from redirect URL
 */
export function parseAuthCodeFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('auth_code');
  } catch (error) {
    return null;
  }
}

/**
 * Check if Fyers access token is expired
 */
export function isFyersTokenExpired(tokenTimestamp: number, expiryHours: number = 24): boolean {
  const now = Date.now();
  const expiryTime = tokenTimestamp + (expiryHours * 60 * 60 * 1000);
  return now >= expiryTime;
}

/**
 * Generate Fyers request headers
 */
export function getFyersHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  if (accessToken) {
    headers['Authorization'] = `${accessToken}`;
  }
  
  return headers;
}

/**
 * Parse Fyers order status
 */
export function parseFyersOrderStatus(status: number): 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIAL' {
  const statusMap: Record<number, 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIAL'> = {
    1: 'PENDING',    // Pending
    2: 'EXECUTED',   // Filled
    3: 'CANCELLED',  // Cancelled
    4: 'REJECTED',   // Rejected
    5: 'PENDING',    // Partially filled (treating as pending)
    6: 'PARTIAL'     // Partially filled
  };
  
  return statusMap[status] || 'PENDING';
}

/**
 * Format Fyers symbol
 */
export function formatFyersSymbol(symbol: string, exchange: string): string {
  return `${exchange}:${symbol}`;
}

/**
 * Validate Fyers symbol format
 */
export function validateFyersSymbol(symbol: string): boolean {
  // Fyers symbols should be in format EXCHANGE:SYMBOL
  const parts = symbol.split(':');
  return parts.length === 2 && parts[0].length > 0 && parts[1].length > 0;
}

/**
 * Extract exchange and symbol from Fyers symbol
 */
export function parseFyersSymbol(fyersSymbol: string): { exchange: string; symbol: string } | null {
  const parts = fyersSymbol.split(':');
  if (parts.length !== 2) {
    return null;
  }
  
  return {
    exchange: parts[0],
    symbol: parts[1]
  };
}
