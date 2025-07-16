import type { OrderResultSummary, OrderResult } from '../components/OrderResultDisplay';
import { getUserFriendlyError } from './errorMessages';

// Transform broker service response to OrderResultDisplay format
export function transformBrokerResponseToOrderResult(
  brokerResponse: any,
  orderRequest: {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
    price?: number;
    triggerPrice?: number;
    exchange?: string;
    productType?: string;
  }
): OrderResultSummary {
  const {
    symbol,
    action,
    quantity,
    orderType,
    price,
    triggerPrice,
    exchange = 'NSE',
    productType = 'CNC'
  } = orderRequest;

  // Handle the new multi-account order response format
  if (brokerResponse.data?.summary) {
    const { summary, successfulOrders, failedOrders } = brokerResponse.data;
    
    const successfulResults: OrderResult[] = successfulOrders.map((order: any) => ({
      accountId: order.accountId,
      brokerName: order.brokerName,
      brokerDisplayName: order.accountDisplayName || order.brokerName,
      success: true,
      orderId: order.orderId,
      brokerOrderId: order.orderId,
      message: order.message || 'Order placed successfully'
    }));

    const failedResults: OrderResult[] = failedOrders.map((order: any) => {
      const friendlyError = getUserFriendlyError(order.error, 'trading');
      return {
        accountId: order.accountId,
        brokerName: order.brokerName,
        brokerDisplayName: order.accountDisplayName || order.brokerName,
        success: false,
        error: order.error,
        errorType: order.errorType,
        message: friendlyError.message,
        suggestion: friendlyError.suggestion,
        retryable: friendlyError.retryable
      };
    });

    return {
      symbol,
      action,
      quantity,
      orderType,
      price,
      triggerPrice,
      exchange,
      productType,
      totalAccounts: summary.totalAccounts,
      successfulAccounts: summary.successCount,
      failedAccounts: summary.failureCount,
      results: [...successfulResults, ...failedResults],
      timestamp: new Date(brokerResponse.data.timestamp || Date.now())
    };
  }

  // Handle legacy single order response or error
  const isSuccess = brokerResponse.success;
  const totalAccounts = 1;
  const successfulAccounts = isSuccess ? 1 : 0;
  const failedAccounts = isSuccess ? 0 : 1;

  const results: OrderResult[] = [{
    accountId: 'unknown',
    brokerName: 'Unknown',
    brokerDisplayName: 'Unknown Broker',
    success: isSuccess,
    orderId: isSuccess ? brokerResponse.data?.orderId : undefined,
    brokerOrderId: isSuccess ? brokerResponse.data?.orderId : undefined,
    error: isSuccess ? undefined : brokerResponse.message,
    message: isSuccess ? 'Order placed successfully' : brokerResponse.message,
    suggestion: isSuccess ? undefined : getUserFriendlyError(brokerResponse.message, 'trading').suggestion,
    retryable: isSuccess ? undefined : getUserFriendlyError(brokerResponse.message, 'trading').retryable
  }];

  return {
    symbol,
    action,
    quantity,
    orderType,
    price,
    triggerPrice,
    exchange,
    productType,
    totalAccounts,
    successfulAccounts,
    failedAccounts,
    results,
    timestamp: new Date()
  };
}

// Transform individual order results for retry functionality
export function transformOrderResultsForRetry(
  failedResults: OrderResult[],
  originalRequest: {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
    price?: number;
    triggerPrice?: number;
    exchange?: string;
    productType?: string;
  }
) {
  return {
    ...originalRequest,
    selectedAccounts: failedResults.map(result => result.accountId)
  };
}

// Get common error patterns for better error classification
export function getCommonTradingErrors(): Record<string, { suggestion: string; retryable: boolean }> {
  return {
    'insufficient_funds': {
      suggestion: 'Add funds to your account or reduce the order quantity.',
      retryable: false
    },
    'margin_shortfall': {
      suggestion: 'Increase your margin or reduce the order size.',
      retryable: false
    },
    'circuit_limit': {
      suggestion: 'The stock has hit a circuit limit. Try again when the limit is lifted.',
      retryable: true
    },
    'position_limit': {
      suggestion: 'You have reached the position limit for this stock. Close some positions first.',
      retryable: false
    },
    'market_closed': {
      suggestion: 'Place the order during market hours (9:15 AM - 3:30 PM on weekdays).',
      retryable: true
    },
    'invalid_price': {
      suggestion: 'Check the price range for this stock and enter a valid price.',
      retryable: false
    },
    'rms_rejection': {
      suggestion: 'Your order was rejected by risk management. Contact your broker for details.',
      retryable: false
    },
    'broker_connection': {
      suggestion: 'Check your broker connection and try again.',
      retryable: true
    },
    'session_expired': {
      suggestion: 'Your broker session has expired. Please reactivate your account.',
      retryable: false
    }
  };
}