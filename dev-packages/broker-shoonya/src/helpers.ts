/**
 * Shoonya Broker Helper Functions
 * Utility functions specific to Shoonya broker integration
 */

import { OrderRequest } from '@copytrade/unified-broker';
import { ShoonyaOrderRequest } from './types';

/**
 * Transform unified order request to Shoonya format
 */
export function transformOrderRequest(orderRequest: OrderRequest, accountId: string): ShoonyaOrderRequest {
  return {
    uid: accountId,
    actid: accountId,
    exch: orderRequest.exchange,
    tsym: formatSymbol(orderRequest.symbol, orderRequest.exchange),
    qty: orderRequest.quantity.toString(),
    prc: orderRequest.price?.toString() || '0',
    prd: mapProductType(orderRequest.productType),
    trantype: orderRequest.action,
    prctyp: mapOrderType(orderRequest.orderType),
    ret: mapValidity(orderRequest.validity),
    ordersource: 'API',
    remarks: orderRequest.remarks || ''
  };
}

/**
 * Format symbol for Shoonya API
 */
export function formatSymbol(symbol: string, exchange: string): string {
  if (exchange === 'NSE') {
    return `${symbol}-EQ`;
  } else if (exchange === 'BSE') {
    return symbol;
  }
  return symbol;
}

/**
 * Map unified product type to Shoonya product type
 */
export function mapProductType(productType: string): string {
  const mapping: Record<string, string> = {
    'CNC': 'C',
    'MIS': 'I',
    'NRML': 'M',
    'BO': 'B'
  };
  return mapping[productType] || 'C';
}

/**
 * Map unified order type to Shoonya order type
 */
export function mapOrderType(orderType: string): string {
  const mapping: Record<string, string> = {
    'MARKET': 'MKT',
    'LIMIT': 'LMT',
    'SL-LIMIT': 'SL-LMT',
    'SL-MARKET': 'SL-MKT'
  };
  return mapping[orderType] || 'LMT';
}

/**
 * Map unified validity to Shoonya validity
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
 * Parse Shoonya order status to unified format
 */
export function parseOrderStatus(shoonyaStatus: string): string {
  const mapping: Record<string, string> = {
    'PENDING': 'PENDING',
    'OPEN': 'PENDING',
    'COMPLETE': 'EXECUTED',
    'REJECTED': 'REJECTED',
    'CANCELLED': 'CANCELLED'
  };
  return mapping[shoonyaStatus] || 'PENDING';
}

/**
 * Validate Shoonya credentials
 */
export function validateCredentials(credentials: any): boolean {
  const required = ['userId', 'password', 'vendorCode', 'apiKey', 'imei'];
  return required.every(field => credentials[field] && credentials[field].trim() !== '');
}

/**
 * Generate TOTP if totpKey is provided
 */
export function generateTOTP(totpKey?: string): string | undefined {
  if (!totpKey) return undefined;
  
  // This would integrate with a TOTP library
  // For now, return undefined to use manual OTP
  return undefined;
}

/**
 * Format error message from Shoonya response
 */
export function formatErrorMessage(response: any): string {
  if (response.emsg) {
    return response.emsg;
  }
  if (response.stat === 'Not_Ok') {
    return 'Operation failed';
  }
  return 'Unknown error occurred';
}
