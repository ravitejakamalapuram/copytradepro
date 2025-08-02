/**
 * Broker Error Logging Service
 * Integrates error logging with broker operations
 */

import { ErrorLoggingService } from './errorLoggingService';
import { traceIdService } from './traceIdService';
import TraceContext from '../utils/traceContext';
import { logger } from '../utils/logger';

export interface BrokerOperationContext {
  userId: string;
  brokerName: string;
  accountId: string;
  operation: string;
  orderDetails?: {
    symbol?: string;
    quantity?: number;
    price?: number;
    orderType?: string;
    side?: 'BUY' | 'SELL';
    orderId?: string;
  };
  marketConditions?: {
    marketStatus?: string;
    timestamp?: Date;
    volatility?: number;
  };
  accountInfo?: {
    balance?: number;
    marginAvailable?: number;
    positions?: number;
  };
  requestDetails?: {
    url?: string;
    method?: string;
    requestId?: string;
    duration?: number;
    retryCount?: number;
  };
  traceId?: string;
}

export interface BrokerErrorClassification {
  category: 'AUTHENTICATION' | 'AUTHORIZATION' | 'INSUFFICIENT_FUNDS' | 'MARKET_CLOSED' | 
           'INVALID_SYMBOL' | 'ORDER_REJECTED' | 'NETWORK_ERROR' | 'RATE_LIMIT' | 
           'BROKER_MAINTENANCE' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isRetryable: boolean;
  requiresUserAction: boolean;
  affectsTrading: boolean;
  suggestedRecovery: string[];
}

export class BrokerErrorLoggingService {
  private static instance: BrokerErrorLoggingService;
  private errorLoggingService: ErrorLoggingService;

  private constructor() {
    this.errorLoggingService = ErrorLoggingService.getInstance();
  }

  public static getInstance(): BrokerErrorLoggingService {
    if (!BrokerErrorLoggingService.instance) {
      BrokerErrorLoggingService.instance = new BrokerErrorLoggingService();
    }
    return BrokerErrorLoggingService.instance;
  }

  /**
   * Log broker operation error with comprehensive context
   */
  public async logBrokerError(
    message: string,
    error: any,
    context: BrokerOperationContext
  ): Promise<string> {
    const classification = this.classifyBrokerError(error, context);
    const traceId = context.traceId || TraceContext.getTraceId() || traceIdService.generateTraceId();

    // Enhanced error message with broker context
    const enhancedMessage = `[${context.brokerName}] ${context.operation}: ${message}`;

    // Create comprehensive error context
    const errorContext = {
      traceId,
      component: 'BROKER_CONTROLLER',
      operation: context.operation,
      source: 'API' as const,
      level: this.mapSeverityToLevel(classification.severity),
      errorType: `BROKER_${classification.category}`,
      userId: context.userId,
      brokerName: context.brokerName,
      accountId: context.accountId,
      url: context.requestDetails?.url,
      method: context.requestDetails?.method,
      statusCode: this.extractStatusCode(error),
      duration: context.requestDetails?.duration,
      retryCount: context.requestDetails?.retryCount || 0,
      requestId: context.requestDetails?.requestId
    };

    // Log the error with enhanced context
    const errorId = await this.errorLoggingService.logError(
      enhancedMessage,
      error,
      errorContext
    );

    // Log additional broker-specific context
    logger.error(`Broker operation failed: ${context.operation}`, {
      errorId,
      traceId,
      brokerName: context.brokerName,
      accountId: context.accountId,
      classification: classification.category,
      severity: classification.severity,
      isRetryable: classification.isRetryable,
      requiresUserAction: classification.requiresUserAction,
      affectsTrading: classification.affectsTrading,
      orderDetails: context.orderDetails,
      marketConditions: context.marketConditions,
      accountInfo: context.accountInfo,
      suggestedRecovery: classification.suggestedRecovery
    });

    return errorId;
  }

  /**
   * Log successful broker operation for analytics
   */
  public async logBrokerSuccess(
    message: string,
    context: BrokerOperationContext
  ): Promise<string> {
    const traceId = context.traceId || TraceContext.getTraceId() || traceIdService.generateTraceId();

    const successMessage = `[${context.brokerName}] ${context.operation}: ${message}`;

    return await this.errorLoggingService.logInfo(
      successMessage,
      {
        traceId,
        component: 'BROKER_CONTROLLER',
        operation: context.operation,
        source: 'API' as const,
        userId: context.userId,
        brokerName: context.brokerName
      }
    );
  }

  /**
   * Log broker warning (e.g., rate limiting, degraded performance)
   */
  public async logBrokerWarning(
    message: string,
    context: BrokerOperationContext
  ): Promise<string> {
    const traceId = context.traceId || TraceContext.getTraceId() || traceIdService.generateTraceId();

    const warningMessage = `[${context.brokerName}] ${context.operation}: ${message}`;

    return await this.errorLoggingService.logWarning(
      warningMessage,
      {
        traceId,
        component: 'BROKER_CONTROLLER',
        operation: context.operation,
        source: 'API' as const,
        userId: context.userId,
        brokerName: context.brokerName
      }
    );
  }

  /**
   * Classify broker errors for better handling and recovery
   */
  private classifyBrokerError(error: any, context: BrokerOperationContext): BrokerErrorClassification {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || error?.status || '';

    // Authentication errors
    if (errorMessage.includes('unauthorized') || errorMessage.includes('invalid token') || 
        errorMessage.includes('authentication') || errorCode === 401) {
      return {
        category: 'AUTHENTICATION',
        severity: 'HIGH',
        isRetryable: false,
        requiresUserAction: true,
        affectsTrading: true,
        suggestedRecovery: [
          'Re-authenticate with broker',
          'Check token expiration',
          'Verify credentials'
        ]
      };
    }

    // Authorization errors
    if (errorMessage.includes('forbidden') || errorMessage.includes('access denied') || 
        errorCode === 403) {
      return {
        category: 'AUTHORIZATION',
        severity: 'HIGH',
        isRetryable: false,
        requiresUserAction: true,
        affectsTrading: true,
        suggestedRecovery: [
          'Check account permissions',
          'Verify trading authorization',
          'Contact broker support'
        ]
      };
    }

    // Insufficient funds
    if (errorMessage.includes('insufficient') || errorMessage.includes('balance') ||
        errorMessage.includes('margin')) {
      return {
        category: 'INSUFFICIENT_FUNDS',
        severity: 'MEDIUM',
        isRetryable: false,
        requiresUserAction: true,
        affectsTrading: true,
        suggestedRecovery: [
          'Check account balance',
          'Add funds to account',
          'Reduce order quantity'
        ]
      };
    }

    // Market closed
    if (errorMessage.includes('market closed') || errorMessage.includes('trading hours') ||
        errorMessage.includes('session')) {
      return {
        category: 'MARKET_CLOSED',
        severity: 'LOW',
        isRetryable: true,
        requiresUserAction: false,
        affectsTrading: true,
        suggestedRecovery: [
          'Wait for market to open',
          'Check trading hours',
          'Schedule order for next session'
        ]
      };
    }

    // Invalid symbol
    if (errorMessage.includes('invalid symbol') || errorMessage.includes('symbol not found') ||
        errorMessage.includes('instrument')) {
      return {
        category: 'INVALID_SYMBOL',
        severity: 'MEDIUM',
        isRetryable: false,
        requiresUserAction: true,
        affectsTrading: true,
        suggestedRecovery: [
          'Verify symbol format',
          'Check symbol availability',
          'Use symbol search'
        ]
      };
    }

    // Order rejected
    if (errorMessage.includes('rejected') || errorMessage.includes('invalid order') ||
        errorMessage.includes('order failed')) {
      return {
        category: 'ORDER_REJECTED',
        severity: 'MEDIUM',
        isRetryable: false,
        requiresUserAction: true,
        affectsTrading: true,
        suggestedRecovery: [
          'Check order parameters',
          'Verify price limits',
          'Review order type'
        ]
      };
    }

    // Network errors
    if (errorMessage.includes('network') || errorMessage.includes('timeout') ||
        errorMessage.includes('connection') || errorCode === 'ECONNRESET' || 
        errorCode === 'ETIMEDOUT') {
      return {
        category: 'NETWORK_ERROR',
        severity: 'MEDIUM',
        isRetryable: true,
        requiresUserAction: false,
        affectsTrading: true,
        suggestedRecovery: [
          'Retry operation',
          'Check network connectivity',
          'Implement exponential backoff'
        ]
      };
    }

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests') ||
        errorCode === 429) {
      return {
        category: 'RATE_LIMIT',
        severity: 'LOW',
        isRetryable: true,
        requiresUserAction: false,
        affectsTrading: false,
        suggestedRecovery: [
          'Implement rate limiting',
          'Add delay between requests',
          'Use request queuing'
        ]
      };
    }

    // Broker maintenance
    if (errorMessage.includes('maintenance') || errorMessage.includes('service unavailable') ||
        errorCode === 503) {
      return {
        category: 'BROKER_MAINTENANCE',
        severity: 'HIGH',
        isRetryable: true,
        requiresUserAction: false,
        affectsTrading: true,
        suggestedRecovery: [
          'Wait for maintenance to complete',
          'Check broker status page',
          'Use alternative broker if available'
        ]
      };
    }

    // Default classification for unknown errors
    return {
      category: 'UNKNOWN',
      severity: 'MEDIUM',
      isRetryable: true,
      requiresUserAction: false,
      affectsTrading: true,
      suggestedRecovery: [
        'Review error details',
        'Check broker documentation',
        'Contact support if persistent'
      ]
    };
  }

  /**
   * Map error severity to log level
   */
  private mapSeverityToLevel(severity: string): 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'ERROR';
      case 'MEDIUM':
        return 'WARN';
      case 'LOW':
        return 'INFO';
      default:
        return 'ERROR';
    }
  }

  /**
   * Extract HTTP status code from error
   */
  private extractStatusCode(error: any): number | undefined {
    if (error?.response?.status) {
      return error.response.status;
    }
    if (error?.status) {
      return error.status;
    }
    if (error?.code === 401) return 401;
    if (error?.code === 403) return 403;
    if (error?.code === 429) return 429;
    if (error?.code === 503) return 503;
    return undefined;
  }

  /**
   * Create broker operation context from request
   */
  public createBrokerContext(
    userId: string,
    brokerName: string,
    accountId: string,
    operation: string,
    additionalContext?: Partial<BrokerOperationContext>
  ): BrokerOperationContext {
    return {
      userId,
      brokerName,
      accountId,
      operation,
      traceId: TraceContext.getTraceId() || traceIdService.generateTraceId(),
      ...additionalContext
    };
  }

  /**
   * Get broker error analytics
   */
  public async getBrokerErrorAnalytics(
    brokerName?: string,
    timeWindow: number = 86400000
  ): Promise<{
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsByBroker: Record<string, number>;
    criticalErrors: number;
    retryableErrors: number;
    userActionRequired: number;
    tradingImpactErrors: number;
  }> {
    try {
      const analytics = await this.errorLoggingService.getErrorAnalytics(timeWindow);
      
      // Filter broker-specific errors
      const brokerErrors = brokerName 
        ? Object.entries(analytics.errorsByBroker).filter(([name]) => name === brokerName)
        : Object.entries(analytics.errorsByBroker);

      const totalBrokerErrors = brokerErrors.reduce((sum, [, count]) => sum + count, 0);

      return {
        totalErrors: brokerName ? totalBrokerErrors : analytics.totalErrors,
        errorsByCategory: analytics.errorsByCategory,
        errorsByBroker: analytics.errorsByBroker,
        criticalErrors: analytics.criticalErrors,
        retryableErrors: 0, // Would need to be calculated from error details
        userActionRequired: 0, // Would need to be calculated from error details
        tradingImpactErrors: 0 // Would need to be calculated from error details
      };
    } catch (error) {
      logger.error('Failed to get broker error analytics', {
        component: 'BROKER_ERROR_LOGGING_SERVICE',
        operation: 'GET_BROKER_ERROR_ANALYTICS',
        brokerName
      }, error);

      return {
        totalErrors: 0,
        errorsByCategory: {},
        errorsByBroker: {},
        criticalErrors: 0,
        retryableErrors: 0,
        userActionRequired: 0,
        tradingImpactErrors: 0
      };
    }
  }
}

// Export singleton instance
export const brokerErrorLoggingService = BrokerErrorLoggingService.getInstance();