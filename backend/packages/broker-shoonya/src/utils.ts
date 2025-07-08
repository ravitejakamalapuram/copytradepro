/**
 * Shoonya Broker Utilities
 * Utility functions specific to Shoonya broker
 */

import { ShoonyaCredentials } from './types';

/**
 * Validate Shoonya credentials
 */
export function validateShoonyaCredentials(credentials: ShoonyaCredentials): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!credentials.userId || credentials.userId.trim() === '') {
    errors.push('User ID is required');
  }
  
  if (!credentials.password || credentials.password.trim() === '') {
    errors.push('Password is required');
  }
  
  if (!credentials.vendorCode || credentials.vendorCode.trim() === '') {
    errors.push('Vendor code is required');
  }
  
  if (!credentials.apiSecret || credentials.apiSecret.trim() === '') {
    errors.push('API secret is required');
  }
  
  if (!credentials.imei || credentials.imei.trim() === '') {
    errors.push('IMEI is required');
  }
  
  if (!credentials.totpKey || credentials.totpKey.trim() === '') {
    errors.push('TOTP key is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate Shoonya API endpoints
 */
export function getShoonyaEndpoints() {
  const baseUrl = 'https://api.shoonya.com/NorenWClientTP/';
  
  return {
    login: `${baseUrl}QuickAuth`,
    logout: `${baseUrl}Logout`,
    placeOrder: `${baseUrl}PlaceOrder`,
    modifyOrder: `${baseUrl}ModifyOrder`,
    cancelOrder: `${baseUrl}CancelOrder`,
    orderBook: `${baseUrl}OrderBook`,
    tradeBook: `${baseUrl}TradeBook`,
    positions: `${baseUrl}PositionBook`,
    holdings: `${baseUrl}Holdings`,
    limits: `${baseUrl}Limits`,
    getQuotes: `${baseUrl}GetQuotes`,
    searchScrips: `${baseUrl}SearchScrips`,
    getSecurityInfo: `${baseUrl}GetSecurityInfo`,
    getOptionChain: `${baseUrl}GetOptionChain`,
    getTimePriceSeries: `${baseUrl}TPSeries`,
    subscribe: `${baseUrl}Subscribe`,
    unsubscribe: `${baseUrl}Unsubscribe`
  };
}

/**
 * Format Shoonya error messages
 */
export function formatShoonyaError(response: any): string {
  if (response.emsg) {
    return response.emsg;
  }
  
  if (response.stat === 'Not_Ok') {
    return 'Operation failed';
  }
  
  if (response.error) {
    return response.error;
  }
  
  return 'Unknown error occurred';
}

/**
 * Check if Shoonya response is successful
 */
export function isShoonyaResponseSuccess(response: any): boolean {
  return response && response.stat === 'Ok';
}

/**
 * Parse Shoonya timestamp
 */
export function parseShoonyaTimestamp(timestamp: string): Date {
  // Shoonya timestamps are typically in DD-MM-YYYY HH:mm:ss format
  const [datePart, timePart] = timestamp.split(' ');
  const [day, month, year] = datePart.split('-');
  const [hours, minutes, seconds] = timePart.split(':');
  
  return new Date(
    parseInt(year),
    parseInt(month) - 1, // Month is 0-indexed
    parseInt(day),
    parseInt(hours),
    parseInt(minutes),
    parseInt(seconds)
  );
}

/**
 * Format date for Shoonya API
 */
export function formatDateForShoonya(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}-${month}-${year}`;
}

/**
 * Get Shoonya exchange codes
 */
export function getShoonyaExchangeCodes() {
  return {
    'NSE': 'NSE',
    'BSE': 'BSE',
    'NFO': 'NFO',
    'BFO': 'BFO',
    'MCX': 'MCX',
    'CDS': 'CDS'
  };
}

/**
 * Get Shoonya product type codes
 */
export function getShoonyaProductCodes() {
  return {
    'CNC': 'C',    // Cash and Carry
    'MIS': 'I',    // Margin Intraday Square-off
    'NRML': 'M',   // Normal
    'BO': 'B'      // Bracket Order
  };
}

/**
 * Get Shoonya order type codes
 */
export function getShoonyaOrderTypeCodes() {
  return {
    'MARKET': 'MKT',
    'LIMIT': 'LMT',
    'SL-LIMIT': 'SL-LMT',
    'SL-MARKET': 'SL-MKT'
  };
}

/**
 * Get Shoonya validity codes
 */
export function getShoonyaValidityCodes() {
  return {
    'DAY': 'DAY',
    'IOC': 'IOC',
    'GTD': 'GTD'
  };
}

/**
 * Calculate Shoonya API checksum
 */
export function calculateShoonyaChecksum(data: string, apiSecret: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(data + apiSecret).digest('hex');
}

/**
 * Prepare Shoonya request payload
 */
export function prepareShoonyaPayload(data: any, apiSecret: string): string {
  const jsonData = JSON.stringify(data);
  const checksum = calculateShoonyaChecksum(jsonData, apiSecret);
  
  return JSON.stringify({
    ...data,
    checksum
  });
}

/**
 * Parse Shoonya order status
 */
export function parseShoonyaOrderStatus(status: string): 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIAL' {
  const statusMap: Record<string, 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIAL'> = {
    'PENDING': 'PENDING',
    'OPEN': 'PENDING',
    'TRIGGER_PENDING': 'PENDING',
    'COMPLETE': 'EXECUTED',
    'CANCELLED': 'CANCELLED',
    'REJECTED': 'REJECTED',
    'PARTIAL': 'PARTIAL'
  };
  
  return statusMap[status.toUpperCase()] || 'PENDING';
}
