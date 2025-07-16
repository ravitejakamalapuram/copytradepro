import { 
  ErrorType, 
  ErrorSeverity, 
  ErrorClassification, 
  ErrorContext, 
  EnhancedError,
  RetryConfig 
} from '../types/errorTypes';
import { v4 as uuidv4 } from 'uuid';

export class ErrorClassificationService {
  private static instance: ErrorClassificationService;
  private errorMappings: Map<string, ErrorClassification>;
  private retryConfig: RetryConfig;

  private constructor() {
    this.errorMappings = new Map();
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrorTypes: ['network', 'broker', 'system']
    };
    this.initializeErrorMappings();
  }

  public static getInstance(): ErrorClassificationService {
    if (!ErrorClassificationService.instance) {
      ErrorClassificationService.instance = new ErrorClassificationService();
    }
    return ErrorClassificationService.instance;
  }

  private initializeErrorMappings(): void {
    // Network errors
    this.addErrorMapping('ECONNREFUSED', {
      type: 'network',
      severity: 'high',
      retryable: true,
      userMessage: 'Connection failed. Please check your internet connection and try again.',
      technicalDetails: 'Connection refused by server',
      suggestedActions: ['Check internet connection', 'Try again in a few moments'],
      retryDelay: 2000,
      maxRetries: 3
    });

    this.addErrorMapping('ETIMEDOUT', {
      type: 'network',
      severity: 'medium',
      retryable: true,
      userMessage: 'Request timed out. Please try again.',
      technicalDetails: 'Request timeout',
      suggestedActions: ['Try again', 'Check internet connection'],
      retryDelay: 1000,
      maxRetries: 2
    });

    this.addErrorMapping('ENOTFOUND', {
      type: 'network',
      severity: 'high',
      retryable: false,
      userMessage: 'Service temporarily unavailable. Please try again later.',
      technicalDetails: 'DNS resolution failed',
      suggestedActions: ['Try again later', 'Contact support if problem persists']
    });

    // Authentication errors
    this.addErrorMapping('UNAUTHORIZED', {
      type: 'authentication',
      severity: 'high',
      retryable: false,
      userMessage: 'Authentication failed. Please check your credentials and try again.',
      technicalDetails: 'Invalid or expired credentials',
      suggestedActions: ['Re-enter credentials', 'Check account status']
    });

    this.addErrorMapping('TOKEN_EXPIRED', {
      type: 'authentication',
      severity: 'medium',
      retryable: true,
      userMessage: 'Session expired. Please log in again.',
      technicalDetails: 'Access token has expired',
      suggestedActions: ['Log in again', 'Refresh session'],
      retryDelay: 0,
      maxRetries: 1
    });

    // Validation errors
    this.addErrorMapping('VALIDATION_ERROR', {
      type: 'validation',
      severity: 'low',
      retryable: false,
      userMessage: 'Please check your input and try again.',
      technicalDetails: 'Input validation failed',
      suggestedActions: ['Correct the highlighted fields', 'Follow the format requirements']
    });

    // Broker-specific errors
    this.addErrorMapping('BROKER_API_ERROR', {
      type: 'broker',
      severity: 'medium',
      retryable: true,
      userMessage: 'Broker service temporarily unavailable. Please try again.',
      technicalDetails: 'Broker API returned an error',
      suggestedActions: ['Try again in a few moments', 'Check broker service status'],
      retryDelay: 5000,
      maxRetries: 2
    });

    this.addErrorMapping('INSUFFICIENT_FUNDS', {
      type: 'broker',
      severity: 'medium',
      retryable: false,
      userMessage: 'Insufficient funds in your account to complete this transaction.',
      technicalDetails: 'Account balance insufficient for order',
      suggestedActions: ['Add funds to your account', 'Reduce order quantity']
    });

    this.addErrorMapping('MARKET_CLOSED', {
      type: 'broker',
      severity: 'low',
      retryable: false,
      userMessage: 'Market is currently closed. Orders will be processed when market opens.',
      technicalDetails: 'Trading session is not active',
      suggestedActions: ['Wait for market to open', 'Schedule order for next trading session']
    });

    // System errors
    this.addErrorMapping('DATABASE_ERROR', {
      type: 'system',
      severity: 'critical',
      retryable: true,
      userMessage: 'System temporarily unavailable. Please try again.',
      technicalDetails: 'Database operation failed',
      suggestedActions: ['Try again in a few moments', 'Contact support if problem persists'],
      retryDelay: 3000,
      maxRetries: 2
    });

    this.addErrorMapping('INTERNAL_SERVER_ERROR', {
      type: 'system',
      severity: 'critical',
      retryable: true,
      userMessage: 'An unexpected error occurred. Please try again.',
      technicalDetails: 'Internal server error',
      suggestedActions: ['Try again', 'Contact support if problem persists'],
      retryDelay: 2000,
      maxRetries: 1
    });
  }

  private addErrorMapping(errorCode: string, classification: ErrorClassification): void {
    this.errorMappings.set(errorCode, classification);
  }

  public classifyError(error: any, context: Partial<ErrorContext> = {}): EnhancedError {
    const errorCode = this.extractErrorCode(error);
    const classification = this.getErrorClassification(errorCode, error);
    
    const enhancedError: EnhancedError = {
      id: uuidv4(),
      timestamp: new Date(),
      type: classification.type,
      severity: classification.severity,
      context: {
        timestamp: new Date(),
        ...context
      },
      originalError: error,
      userMessage: classification.userMessage,
      technicalMessage: classification.technicalDetails,
      stackTrace: error?.stack,
      retryCount: 0,
      resolved: false,
      classification
    };

    return enhancedError;
  }

  private extractErrorCode(error: any): string {
    // Handle axios errors
    if (error?.response?.status) {
      switch (error.response.status) {
        case 401:
          return 'UNAUTHORIZED';
        case 403:
          return 'FORBIDDEN';
        case 404:
          return 'NOT_FOUND';
        case 429:
          return 'RATE_LIMITED';
        case 500:
          return 'INTERNAL_SERVER_ERROR';
        case 502:
        case 503:
        case 504:
          return 'SERVICE_UNAVAILABLE';
        default:
          return `HTTP_${error.response.status}`;
      }
    }

    // Handle network errors
    if (error?.code) {
      return error.code;
    }

    // Handle custom error types
    if (error?.type) {
      return error.type;
    }

    // Handle broker-specific errors
    if (error?.message?.includes('insufficient')) {
      return 'INSUFFICIENT_FUNDS';
    }

    if (error?.message?.includes('market') && error?.message?.includes('closed')) {
      return 'MARKET_CLOSED';
    }

    if (error?.message?.includes('validation')) {
      return 'VALIDATION_ERROR';
    }

    if (error?.message?.includes('token') && error?.message?.includes('expired')) {
      return 'TOKEN_EXPIRED';
    }

    // Default fallback
    return 'UNKNOWN_ERROR';
  }

  private getErrorClassification(errorCode: string, originalError: any): ErrorClassification {
    const mapping = this.errorMappings.get(errorCode);
    
    if (mapping) {
      return mapping;
    }

    // Default classification for unknown errors
    return {
      type: 'system',
      severity: 'medium',
      retryable: false,
      userMessage: 'An unexpected error occurred. Please try again or contact support.',
      technicalDetails: originalError?.message || 'Unknown error',
      suggestedActions: ['Try again', 'Contact support if problem persists']
    };
  }

  public shouldRetry(error: EnhancedError): boolean {
    return error.classification.retryable && 
           error.retryCount < (error.classification.maxRetries || this.retryConfig.maxRetries);
  }

  public getRetryDelay(error: EnhancedError): number {
    const baseDelay = error.classification.retryDelay || this.retryConfig.baseDelay;
    const delay = baseDelay * Math.pow(this.retryConfig.backoffMultiplier, error.retryCount);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  public incrementRetryCount(error: EnhancedError): EnhancedError {
    return {
      ...error,
      retryCount: error.retryCount + 1
    };
  }

  public getUserFriendlyMessage(error: any, context: Partial<ErrorContext> = {}): string {
    const enhancedError = this.classifyError(error, context);
    return enhancedError.userMessage;
  }

  public getSuggestedActions(error: any, context: Partial<ErrorContext> = {}): string[] {
    const enhancedError = this.classifyError(error, context);
    return enhancedError.classification.suggestedActions;
  }

  public updateRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  public addCustomErrorMapping(errorCode: string, classification: ErrorClassification): void {
    this.addErrorMapping(errorCode, classification);
  }
}