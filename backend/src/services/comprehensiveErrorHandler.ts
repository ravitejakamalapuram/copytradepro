/**
 * Comprehensive Error Handler for Shoonya Order Status Operations
 * Implements proper error categorization, user-friendly messages, retry logic, and rate limiting
 */

import { ErrorType, ErrorSeverity, ErrorClassification, ErrorContext, EnhancedError, RetryConfig } from '../types/errorTypes';
import { logger } from '../utils/logger';

export interface OrderStatusError {
  id: string;
  timestamp: Date;
  operation: 'getOrderStatus' | 'placeOrder' | 'cancelOrder' | 'modifyOrder';
  brokerName: string;
  accountId?: string;
  orderId?: string;
  userId?: string;
  originalError: any;
  classification: ErrorClassification;
  retryCount: number;
  resolved: boolean;
}

export interface RateLimitInfo {
  userId: string;
  brokerName: string;
  operation: string;
  requestCount: number;
  windowStart: Date;
  windowDuration: number; // milliseconds
  maxRequests: number;
  isBlocked: boolean;
  resetTime?: Date;
}

export class ComprehensiveErrorHandler {
  private errorHistory: Map<string, OrderStatusError> = new Map();
  private rateLimitTracking: Map<string, RateLimitInfo> = new Map();
  
  // Rate limiting configuration per broker and operation
  private rateLimits = {
    shoonya: {
      getOrderStatus: { maxRequests: 60, windowMs: 60000 }, // 60 requests per minute
      placeOrder: { maxRequests: 30, windowMs: 60000 },     // 30 requests per minute
      cancelOrder: { maxRequests: 20, windowMs: 60000 },    // 20 requests per minute
      modifyOrder: { maxRequests: 20, windowMs: 60000 }     // 20 requests per minute
    },
    fyers: {
      getOrderStatus: { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
      placeOrder: { maxRequests: 50, windowMs: 60000 },      // 50 requests per minute
      cancelOrder: { maxRequests: 30, windowMs: 60000 },     // 30 requests per minute
      modifyOrder: { maxRequests: 30, windowMs: 60000 }      // 30 requests per minute
    }
  };

  // Retry configuration
  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,      // 1 second
    maxDelay: 30000,      // 30 seconds
    backoffMultiplier: 2,
    retryableErrorTypes: ['network', 'system', 'broker']
  };

  /**
   * Categorize errors for different failure scenarios
   */
  categorizeError(error: any, context: ErrorContext): ErrorClassification {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || error?.status || '';
    
    // Session and authentication errors
    if (this.isSessionError(errorMessage, errorCode)) {
      return {
        type: 'authentication',
        severity: 'high',
        retryable: false,
        userMessage: 'Your session has expired. Please reconnect your account.',
        technicalDetails: `Authentication error: ${error?.message || 'Session expired'}`,
        suggestedActions: [
          'Click the "Reconnect Account" button',
          'Re-enter your broker credentials',
          'Ensure your broker account is active'
        ]
      };
    }

    // Network and connection errors
    if (this.isNetworkError(errorMessage, errorCode)) {
      return {
        type: 'network',
        severity: 'medium',
        retryable: true,
        userMessage: 'Network connection issue. Please check your internet connection and try again.',
        technicalDetails: `Network error: ${error?.message || 'Connection failed'}`,
        suggestedActions: [
          'Check your internet connection',
          'Try again in a few moments',
          'Contact support if the issue persists'
        ],
        retryDelay: 2000,
        maxRetries: 3
      };
    }

    // Rate limiting errors
    if (this.isRateLimitError(errorMessage, errorCode)) {
      return {
        type: 'broker',
        severity: 'medium',
        retryable: true,
        userMessage: 'Too many requests. Please wait a moment and try again.',
        technicalDetails: `Rate limit exceeded: ${error?.message || 'Too many requests'}`,
        suggestedActions: [
          'Wait for 30 seconds before trying again',
          'Reduce the frequency of your requests',
          'Consider using bulk operations where available'
        ],
        retryDelay: 30000,
        maxRetries: 2
      };
    }

    // Order not found errors
    if (this.isOrderNotFoundError(errorMessage, errorCode)) {
      return {
        type: 'validation',
        severity: 'low',
        retryable: false,
        userMessage: 'Order not found. Please verify the order number and try again.',
        technicalDetails: `Order not found: ${error?.message || 'Invalid order ID'}`,
        suggestedActions: [
          'Check the order number is correct',
          'Refresh your order list',
          'The order may have been cancelled or executed'
        ]
      };
    }

    // Server and broker errors
    if (this.isServerError(errorMessage, errorCode)) {
      return {
        type: 'broker',
        severity: 'high',
        retryable: true,
        userMessage: 'Broker server is experiencing issues. Please try again later.',
        technicalDetails: `Server error: ${error?.message || 'Internal server error'}`,
        suggestedActions: [
          'Try again in a few minutes',
          'Check broker status page',
          'Contact broker support if issue persists'
        ],
        retryDelay: 5000,
        maxRetries: 2
      };
    }

    // Validation and parameter errors
    if (this.isValidationError(errorMessage, errorCode)) {
      return {
        type: 'validation',
        severity: 'medium',
        retryable: false,
        userMessage: 'Invalid request parameters. Please check the order details and try again.',
        technicalDetails: `Validation error: ${error?.message || 'Invalid parameters'}`,
        suggestedActions: [
          'Check all required fields are filled',
          'Verify order parameters are correct',
          'Ensure account has sufficient permissions'
        ]
      };
    }

    // Default classification for unknown errors
    return {
      type: 'system',
      severity: 'medium',
      retryable: false,
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      technicalDetails: `Unknown error: ${error?.message || 'Unclassified error'}`,
      suggestedActions: [
        'Try the operation again',
        'Refresh the page',
        'Contact support with error details'
      ]
    };
  }

  /**
   * Check if error is session/authentication related
   */
  private isSessionError(message: string, code: any): boolean {
    const sessionKeywords = [
      'session expired', 'invalid session', 'authentication failed',
      'token expired', 'token invalid', 'unauthorized', 'login required',
      'invalid credentials', 'access denied', 'forbidden'
    ];
    
    const sessionCodes = [401, 403, 'UNAUTHORIZED', 'FORBIDDEN', 'TOKEN_EXPIRED'];
    
    return sessionKeywords.some(keyword => message.includes(keyword)) ||
           sessionCodes.includes(code);
  }

  /**
   * Check if error is network/connection related
   */
  private isNetworkError(message: string, code: any): boolean {
    const networkKeywords = [
      'network', 'timeout', 'connection', 'socket', 'econnreset',
      'enotfound', 'etimedout', 'econnrefused', 'dns', 'unreachable'
    ];
    
    const networkCodes = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];
    
    return networkKeywords.some(keyword => message.includes(keyword)) ||
           networkCodes.includes(code);
  }

  /**
   * Check if error is rate limiting related
   */
  private isRateLimitError(message: string, code: any): boolean {
    const rateLimitKeywords = [
      'rate limit', 'too many requests', 'quota exceeded',
      'throttled', 'limit exceeded', 'request limit'
    ];
    
    const rateLimitCodes = [429, 'TOO_MANY_REQUESTS', 'RATE_LIMITED'];
    
    return rateLimitKeywords.some(keyword => message.includes(keyword)) ||
           rateLimitCodes.includes(code);
  }

  /**
   * Check if error is order not found related
   */
  private isOrderNotFoundError(message: string, code: any): boolean {
    const orderNotFoundKeywords = [
      'order not found', 'invalid order', 'order does not exist',
      'norenordno', 'order id not found', 'invalid order id'
    ];
    
    const orderNotFoundCodes = [404, 'NOT_FOUND', 'ORDER_NOT_FOUND'];
    
    return orderNotFoundKeywords.some(keyword => message.includes(keyword)) ||
           orderNotFoundCodes.includes(code);
  }

  /**
   * Check if error is server/broker related
   */
  private isServerError(message: string, code: any): boolean {
    const serverKeywords = [
      'server error', 'internal error', 'service unavailable',
      'server unavailable', 'maintenance', 'temporarily unavailable'
    ];
    
    const serverCodes = [500, 502, 503, 504, 'INTERNAL_ERROR', 'SERVICE_UNAVAILABLE'];
    
    return serverKeywords.some(keyword => message.includes(keyword)) ||
           serverCodes.includes(code);
  }

  /**
   * Check if error is validation related
   */
  private isValidationError(message: string, code: any): boolean {
    const validationKeywords = [
      'validation', 'invalid parameter', 'missing parameter',
      'bad request', 'invalid input', 'parameter error'
    ];
    
    const validationCodes = [400, 'BAD_REQUEST', 'VALIDATION_ERROR'];
    
    return validationKeywords.some(keyword => message.includes(keyword)) ||
           validationCodes.includes(code);
  }

  /**
   * Check rate limiting for user and operation
   */
  checkRateLimit(userId: string, brokerName: string, operation: string): {
    allowed: boolean;
    rateLimitInfo?: RateLimitInfo;
    waitTime?: number;
  } {
    const key = `${userId}:${brokerName}:${operation}`;
    const now = new Date();
    
    // Get rate limit configuration for this broker and operation
    const brokerLimits = this.rateLimits[brokerName as keyof typeof this.rateLimits];
    if (!brokerLimits) {
      // No rate limiting configured for this broker
      return { allowed: true };
    }
    
    const operationLimit = brokerLimits[operation as keyof typeof brokerLimits];
    if (!operationLimit) {
      // No rate limiting configured for this operation
      return { allowed: true };
    }
    
    let rateLimitInfo = this.rateLimitTracking.get(key);
    
    // Initialize or reset rate limit window if needed
    if (!rateLimitInfo || (now.getTime() - rateLimitInfo.windowStart.getTime()) >= rateLimitInfo.windowDuration) {
      rateLimitInfo = {
        userId,
        brokerName,
        operation,
        requestCount: 0,
        windowStart: now,
        windowDuration: operationLimit.windowMs,
        maxRequests: operationLimit.maxRequests,
        isBlocked: false
      };
    }
    
    // Check if rate limit is exceeded
    if (rateLimitInfo.requestCount >= rateLimitInfo.maxRequests) {
      const windowEnd = new Date(rateLimitInfo.windowStart.getTime() + rateLimitInfo.windowDuration);
      const waitTime = Math.max(0, windowEnd.getTime() - now.getTime());
      
      rateLimitInfo.isBlocked = true;
      rateLimitInfo.resetTime = windowEnd;
      this.rateLimitTracking.set(key, rateLimitInfo);
      
      logger.warn(`Rate limit exceeded for ${key}. Wait time: ${waitTime}ms`);
      
      return {
        allowed: false,
        rateLimitInfo,
        waitTime
      };
    }
    
    // Increment request count and allow request
    rateLimitInfo.requestCount++;
    rateLimitInfo.isBlocked = false;
    this.rateLimitTracking.set(key, rateLimitInfo);
    
    return { allowed: true, rateLimitInfo };
  }

  /**
   * Implement retry logic with exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig };
    let lastError: any;
    
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        // Check rate limiting before each attempt
        if (context.brokerName && context.operation) {
          const rateLimitCheck = this.checkRateLimit(
            context.userId || 'unknown',
            context.brokerName,
            context.operation
          );
          
          if (!rateLimitCheck.allowed) {
            const waitTime = rateLimitCheck.waitTime || 0;
            logger.warn(`Rate limited, waiting ${waitTime}ms before retry`);
            
            if (waitTime > 0) {
              await this.delay(waitTime);
            }
          }
        }
        
        // Execute the operation
        const result = await operation();
        
        // Log successful retry if this wasn't the first attempt
        if (attempt > 0) {
          logger.info(`Operation succeeded on attempt ${attempt + 1}/${config.maxRetries + 1}`);
        }
        
        return result;
        
      } catch (error: any) {
        lastError = error;
        
        // Categorize the error
        const classification = this.categorizeError(error, context);
        
        // Log the error with context
        logger.error(`Operation failed on attempt ${attempt + 1}/${config.maxRetries + 1}:`, {
          error: error.message,
          type: classification.type,
          retryable: classification.retryable,
          context
        });
        
        // Check if error is retryable and we have attempts left
        if (!classification.retryable || attempt >= config.maxRetries) {
          // Create enhanced error for non-retryable errors or max retries exceeded
          const enhancedError = this.createEnhancedError(error, context, classification, attempt);
          this.logError(enhancedError);
          throw error;
        }
        
        // Calculate delay for next retry with exponential backoff
        const delay = Math.min(
          classification.retryDelay || config.baseDelay * Math.pow(config.backoffMultiplier, attempt),
          config.maxDelay
        );
        
        logger.info(`Retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries + 1})`);
        await this.delay(delay);
      }
    }
    
    // This should never be reached, but just in case
    throw lastError;
  }

  /**
   * Create enhanced error object with full context
   */
  private createEnhancedError(
    originalError: any,
    context: ErrorContext,
    classification: ErrorClassification,
    retryCount: number
  ): EnhancedError {
    return {
      id: this.generateErrorId(),
      timestamp: new Date(),
      type: classification.type,
      severity: classification.severity,
      context,
      originalError,
      userMessage: classification.userMessage,
      technicalMessage: classification.technicalDetails,
      stackTrace: originalError?.stack,
      retryCount,
      resolved: false,
      classification
    };
  }

  /**
   * Log error with proper categorization and context
   */
  private logError(error: EnhancedError): void {
    const logData = {
      errorId: error.id,
      type: error.type,
      severity: error.severity,
      operation: error.context.operation,
      brokerName: error.context.brokerName,
      userId: error.context.userId,
      accountId: error.context.accountId,
      retryCount: error.retryCount,
      userMessage: error.userMessage,
      technicalMessage: error.technicalMessage
    };
    
    // Log based on severity
    switch (error.severity) {
      case 'critical':
        logger.error('CRITICAL ERROR:', logData);
        break;
      case 'high':
        logger.error('HIGH SEVERITY ERROR:', logData);
        break;
      case 'medium':
        logger.warn('MEDIUM SEVERITY ERROR:', logData);
        break;
      case 'low':
        logger.info('LOW SEVERITY ERROR:', logData);
        break;
    }
    
    // Store error for analysis
    this.errorHistory.set(error.id, {
      id: error.id,
      timestamp: error.timestamp,
      operation: error.context.operation as any,
      brokerName: error.context.brokerName || 'unknown',
      accountId: error.context.accountId || 'unknown',
      orderId: (error.context as any).orderId || 'unknown',
      userId: error.context.userId || 'unknown',
      originalError: error.originalError,
      classification: error.classification,
      retryCount: error.retryCount,
      resolved: error.resolved
    });
  }

  /**
   * Get user-friendly error message
   */
  getUserFriendlyMessage(error: any, context: ErrorContext): string {
    const classification = this.categorizeError(error, context);
    return classification.userMessage;
  }

  /**
   * Get suggested actions for error resolution
   */
  getSuggestedActions(error: any, context: ErrorContext): string[] {
    const classification = this.categorizeError(error, context);
    return classification.suggestedActions;
  }

  /**
   * Check if error is retryable
   */
  isRetryable(error: any, context: ErrorContext): boolean {
    const classification = this.categorizeError(error, context);
    return classification.retryable;
  }

  /**
   * Get retry delay for error
   */
  getRetryDelay(error: any, context: ErrorContext, attempt: number): number {
    const classification = this.categorizeError(error, context);
    
    if (classification.retryDelay) {
      return classification.retryDelay;
    }
    
    // Use exponential backoff
    return Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelay
    );
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStatistics(timeWindow?: number): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    errorsByBroker: Record<string, number>;
    retryableErrors: number;
    resolvedErrors: number;
  } {
    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;
    
    const relevantErrors = Array.from(this.errorHistory.values())
      .filter(error => error.timestamp.getTime() >= windowStart);
    
    const stats = {
      totalErrors: relevantErrors.length,
      errorsByType: {} as Record<ErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      errorsByBroker: {} as Record<string, number>,
      retryableErrors: 0,
      resolvedErrors: 0
    };
    
    relevantErrors.forEach(error => {
      // Count by type
      stats.errorsByType[error.classification.type] = 
        (stats.errorsByType[error.classification.type] || 0) + 1;
      
      // Count by severity
      stats.errorsBySeverity[error.classification.severity] = 
        (stats.errorsBySeverity[error.classification.severity] || 0) + 1;
      
      // Count by broker
      stats.errorsByBroker[error.brokerName] = 
        (stats.errorsByBroker[error.brokerName] || 0) + 1;
      
      // Count retryable and resolved
      if (error.classification.retryable) stats.retryableErrors++;
      if (error.resolved) stats.resolvedErrors++;
    });
    
    return stats;
  }

  /**
   * Clear old error history to prevent memory leaks
   */
  cleanupErrorHistory(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    
    for (const [id, error] of this.errorHistory.entries()) {
      if (error.timestamp.getTime() < cutoff) {
        this.errorHistory.delete(id);
      }
    }
    
    logger.info(`Cleaned up error history, ${this.errorHistory.size} errors remaining`);
  }

  /**
   * Clear old rate limit tracking to prevent memory leaks
   */
  cleanupRateLimitTracking(): void {
    const now = Date.now();
    
    for (const [key, info] of this.rateLimitTracking.entries()) {
      const windowEnd = info.windowStart.getTime() + info.windowDuration;
      if (now > windowEnd + 60000) { // Keep for 1 minute after window ends
        this.rateLimitTracking.delete(key);
      }
    }
    
    logger.debug(`Rate limit tracking cleanup completed, ${this.rateLimitTracking.size} entries remaining`);
  }

  /**
   * Utility methods
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Export singleton instance
export const comprehensiveErrorHandler = new ComprehensiveErrorHandler();

// Cleanup intervals
setInterval(() => {
  comprehensiveErrorHandler.cleanupErrorHistory();
  comprehensiveErrorHandler.cleanupRateLimitTracking();
}, 60 * 60 * 1000); // Run cleanup every hour