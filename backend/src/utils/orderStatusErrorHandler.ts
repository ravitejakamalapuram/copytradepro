/**
 * Standardized error handling utilities for order status operations
 * Provides consistent error categorization, logging, and response formatting
 */

import { Response } from 'express';
import { logger } from './logger';
import { 
  OrderStatusErrorCode, 
  OrderStatusError, 
  OrderStatusResponse,
  RefreshOrderStatusResponse,
  ERROR_CATEGORY_MAP,
  USER_FRIENDLY_MESSAGES
} from '../types/orderStatusTypes';

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  orderId?: string;
  brokerName?: string;
  operation: string;
  component: string;
  duration?: number;
  additionalData?: Record<string, any>;
}

export class OrderStatusErrorHandler {
  /**
   * Create a standardized error object
   */
  static createError(
    code: OrderStatusErrorCode,
    customMessage?: string,
    details?: any
  ): OrderStatusError {
    const errorConfig = ERROR_CATEGORY_MAP[code];
    const message = customMessage || USER_FRIENDLY_MESSAGES[code];
    
    return {
      message,
      code,
      retryable: errorConfig.retryable,
      details
    };
  }

  /**
   * Create a standardized success response
   */
  static createSuccessResponse(
    data: any,
    requestId?: string
  ): OrderStatusResponse | RefreshOrderStatusResponse {
    const response: OrderStatusResponse | RefreshOrderStatusResponse = {
      success: true,
      data,
      timestamp: new Date().toISOString()
    };
    
    if (requestId) {
      response.requestId = requestId;
    }
    
    return response;
  }

  /**
   * Create a standardized error response
   */
  static createErrorResponse(
    error: OrderStatusError,
    requestId?: string
  ): OrderStatusResponse | RefreshOrderStatusResponse {
    const response: OrderStatusResponse | RefreshOrderStatusResponse = {
      success: false,
      error,
      timestamp: new Date().toISOString()
    };
    
    if (requestId) {
      response.requestId = requestId;
    }
    
    return response;
  }

  /**
   * Send standardized error response with proper HTTP status code
   */
  static sendErrorResponse(
    res: Response,
    code: OrderStatusErrorCode,
    context: ErrorContext,
    customMessage?: string,
    details?: any
  ): void {
    const error = this.createError(code, customMessage, details);
    const errorConfig = ERROR_CATEGORY_MAP[code];
    const response = this.createErrorResponse(error, context.requestId);

    // Log the error with full context
    this.logError(code, context, error, details);

    // Send HTTP response
    res.status(errorConfig.httpStatus).json(response);
  }

  /**
   * Send standardized success response
   */
  static sendSuccessResponse(
    res: Response,
    data: any,
    context: ErrorContext
  ): void {
    const response = this.createSuccessResponse(data, context.requestId);

    // Log successful operation
    this.logSuccess(context, data);

    res.json(response);
  }

  /**
   * Categorize broker errors into standardized error codes
   */
  static categorizeBrokerError(
    error: any,
    brokerName: string
  ): { code: OrderStatusErrorCode; message?: string } {
    const errorMessage = error.message?.toLowerCase() || '';
    
    // Session/Authentication errors
    if (errorMessage.includes('session') || 
        errorMessage.includes('auth') || 
        error.errorType === 'SESSION_EXPIRED') {
      return {
        code: OrderStatusErrorCode.SESSION_EXPIRED,
        message: `Session expired for ${brokerName}. Please reconnect your account.`
      };
    }

    // Rate limiting errors
    if (errorMessage.includes('rate limit') || 
        error.errorType === 'RATE_LIMIT_ERROR') {
      return {
        code: OrderStatusErrorCode.RATE_LIMIT_ERROR,
        message: `Rate limit exceeded for ${brokerName}. Please try again later.`
      };
    }

    // Network errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') ||
        error.errorType === 'NETWORK_ERROR') {
      return {
        code: OrderStatusErrorCode.NETWORK_ERROR,
        message: `Network error connecting to ${brokerName}. Please try again.`
      };
    }

    // Order not found in broker
    if (errorMessage.includes('not found') || 
        errorMessage.includes('invalid order')) {
      return {
        code: OrderStatusErrorCode.ORDER_NOT_FOUND_IN_BROKER,
        message: `Order not found in ${brokerName} system.`
      };
    }

    // Generic broker error
    return {
      code: OrderStatusErrorCode.BROKER_ERROR,
      message: `Failed to get status from ${brokerName}. Please try again.`
    };
  }

  /**
   * Log error with standardized format and context
   */
  private static logError(
    code: OrderStatusErrorCode,
    context: ErrorContext,
    error: OrderStatusError,
    originalError?: any
  ): void {
    const errorConfig = ERROR_CATEGORY_MAP[code];
    
    logger.error(`Order status operation failed: ${error.message}`, {
      errorCode: code,
      errorMessage: error.message,
      retryable: error.retryable,
      severity: errorConfig.severity,
      httpStatus: errorConfig.httpStatus,
      requestId: context.requestId,
      userId: context.userId,
      orderId: context.orderId,
      brokerName: context.brokerName,
      operation: context.operation,
      component: context.component,
      duration: context.duration,
      ...context.additionalData
    }, originalError);
  }

  /**
   * Log successful operation with context
   */
  private static logSuccess(
    context: ErrorContext,
    responseData: any
  ): void {
    logger.info(`Order status operation completed successfully`, {
      requestId: context.requestId,
      userId: context.userId,
      orderId: context.orderId,
      brokerName: context.brokerName,
      operation: context.operation,
      component: context.component,
      duration: context.duration,
      responseDataKeys: Object.keys(responseData || {}),
      ...context.additionalData
    });
  }

  /**
   * Validate order ID parameter
   */
  static validateOrderId(orderId: any): { isValid: boolean; error?: OrderStatusError } {
    if (!orderId) {
      return {
        isValid: false,
        error: this.createError(OrderStatusErrorCode.MISSING_ORDER_ID)
      };
    }

    if (typeof orderId !== 'string' || orderId.trim().length === 0) {
      return {
        isValid: false,
        error: this.createError(
          OrderStatusErrorCode.MISSING_ORDER_ID,
          'Order ID must be a non-empty string'
        )
      };
    }

    return { isValid: true };
  }

  /**
   * Validate broker name parameter
   */
  static validateBrokerName(brokerName: any): { isValid: boolean; error?: OrderStatusError } {
    if (brokerName && (typeof brokerName !== 'string' || brokerName.trim().length === 0)) {
      return {
        isValid: false,
        error: this.createError(
          OrderStatusErrorCode.INVALID_BROKER_NAME,
          'Broker name must be a non-empty string if provided'
        )
      };
    }

    return { isValid: true };
  }

  /**
   * Validate user authentication
   */
  static validateAuthentication(userId: any): { isValid: boolean; error?: OrderStatusError } {
    if (!userId) {
      return {
        isValid: false,
        error: this.createError(OrderStatusErrorCode.AUTHENTICATION_ERROR)
      };
    }

    return { isValid: true };
  }

  /**
   * Validate user ownership of order
   */
  static validateOrderOwnership(
    orderUserId: string,
    requestUserId: string
  ): { isValid: boolean; error?: OrderStatusError } {
    if (orderUserId.toString() !== requestUserId.toString()) {
      return {
        isValid: false,
        error: this.createError(OrderStatusErrorCode.ACCESS_DENIED)
      };
    }

    return { isValid: true };
  }

  /**
   * Validate broker name matches order
   */
  static validateBrokerMatch(
    orderBrokerName: string,
    providedBrokerName?: string
  ): { isValid: boolean; error?: OrderStatusError } {
    if (providedBrokerName && 
        providedBrokerName.toLowerCase() !== orderBrokerName.toLowerCase()) {
      return {
        isValid: false,
        error: this.createError(
          OrderStatusErrorCode.BROKER_MISMATCH,
          `Order belongs to ${orderBrokerName}, not ${providedBrokerName}`
        )
      };
    }

    return { isValid: true };
  }
}