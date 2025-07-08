/**
 * Broker Utility Functions
 * Common utilities for broker operations
 */

import { OrderRequest, OrderStatus, Quote, Position } from '../interfaces/IBrokerService';

/**
 * Validate order request parameters
 */
export function validateOrderRequest(orderRequest: OrderRequest): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required fields validation
  if (!orderRequest.symbol || orderRequest.symbol.trim() === '') {
    errors.push('Symbol is required');
  }

  if (!orderRequest.action || !['BUY', 'SELL'].includes(orderRequest.action)) {
    errors.push('Action must be BUY or SELL');
  }

  if (!orderRequest.quantity || orderRequest.quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }

  if (!orderRequest.orderType || !['MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET'].includes(orderRequest.orderType)) {
    errors.push('Invalid order type');
  }

  if (orderRequest.orderType === 'LIMIT' && (!orderRequest.price || orderRequest.price <= 0)) {
    errors.push('Price is required for LIMIT orders');
  }

  if (!orderRequest.exchange || orderRequest.exchange.trim() === '') {
    errors.push('Exchange is required');
  }

  if (!orderRequest.productType || orderRequest.productType.trim() === '') {
    errors.push('Product type is required');
  }

  if (!orderRequest.validity || !['DAY', 'IOC', 'GTD'].includes(orderRequest.validity)) {
    errors.push('Invalid validity type');
  }

  if (!orderRequest.accountId || orderRequest.accountId.trim() === '') {
    errors.push('Account ID is required');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Format symbol for different exchanges
 */
export function formatSymbolForExchange(symbol: string, exchange: string): string {
  const normalizedSymbol = symbol.toUpperCase().trim();
  const normalizedExchange = exchange.toUpperCase().trim();

  switch (normalizedExchange) {
    case 'NSE':
      return normalizedSymbol.includes('-EQ') ? normalizedSymbol : `${normalizedSymbol}-EQ`;
    case 'BSE':
      return normalizedSymbol.replace('-EQ', ''); // BSE doesn't use -EQ suffix
    case 'NFO':
    case 'BFO':
      return normalizedSymbol; // Futures and options keep original format
    default:
      return normalizedSymbol;
  }
}

/**
 * Parse order status to standardized format
 */
export function standardizeOrderStatus(status: string): 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIAL' {
  const normalizedStatus = status.toUpperCase().trim();

  // Map various broker-specific statuses to standard ones
  const statusMap: Record<string, 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIAL'> = {
    // Common statuses
    'PENDING': 'PENDING',
    'OPEN': 'PENDING',
    'NEW': 'PENDING',
    'SUBMITTED': 'PENDING',
    'ACCEPTED': 'PENDING',
    'COMPLETE': 'EXECUTED',
    'FILLED': 'EXECUTED',
    'EXECUTED': 'EXECUTED',
    'CANCELLED': 'CANCELLED',
    'CANCELED': 'CANCELLED',
    'REJECTED': 'REJECTED',
    'PARTIAL': 'PARTIAL',
    'PARTIALLY_FILLED': 'PARTIAL',
    
    // Broker-specific mappings
    'TRIGGER_PENDING': 'PENDING',
    'MODIFY_PENDING': 'PENDING',
    'CANCEL_PENDING': 'PENDING'
  };

  return statusMap[normalizedStatus] || 'PENDING';
}

/**
 * Calculate order value
 */
export function calculateOrderValue(orderRequest: OrderRequest): number {
  const price = orderRequest.price || 0;
  const quantity = orderRequest.quantity || 0;
  return price * quantity;
}

/**
 * Calculate position P&L
 */
export function calculatePositionPnL(position: Position): number {
  const avgPrice = position.averagePrice || 0;
  const currentPrice = position.currentPrice || avgPrice;
  const quantity = position.quantity || 0;
  
  return (currentPrice - avgPrice) * quantity;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Validate broker credentials
 */
export function validateCredentials(credentials: any, requiredFields: string[]): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (!credentials[field] || credentials[field].toString().trim() === '') {
      missingFields.push(field);
    }
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Generate unique order reference
 */
export function generateOrderReference(prefix: string = 'ORD'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Check if market is open (basic implementation)
 */
export function isMarketOpen(exchange: string = 'NSE'): boolean {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Weekend check
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Basic time check (9:15 AM to 3:30 PM IST)
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 100 + minutes;
  
  const marketOpen = 915; // 9:15 AM
  const marketClose = 1530; // 3:30 PM
  
  return currentTime >= marketOpen && currentTime <= marketClose;
}

/**
 * Retry mechanism for broker operations
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  
  throw lastError!;
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private calls: number[] = [];
  
  constructor(
    private maxCalls: number,
    private windowMs: number
  ) {}
  
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Remove old calls outside the window
    this.calls = this.calls.filter(callTime => now - callTime < this.windowMs);
    
    if (this.calls.length >= this.maxCalls) {
      const oldestCall = Math.min(...this.calls);
      const waitTime = this.windowMs - (now - oldestCall);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.calls.push(now);
  }
}
