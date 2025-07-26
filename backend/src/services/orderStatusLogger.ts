/**
 * Order Status Logger Service
 * Provides structured logging, performance monitoring, and audit trails for order status operations
 * Implements requirements 4.1, 4.2, 4.3, 4.4 from the Shoonya order status fix specification
 */

import { logger, LogContext } from '../utils/logger';
import { performance } from 'perf_hooks';

export interface OrderStatusLogContext extends LogContext {
  orderId?: string;
  orderNumber?: string;
  exchange?: string;
  symbol?: string;
  quantity?: number;
  price?: number;
  orderType?: string;
  productType?: string;
  apiEndpoint?: string;
  responseTime?: number;
  statusCode?: number;
  errorCode?: string;
  retryAttempt?: number;
  rateLimitRemaining?: number;
  sessionValid?: boolean;
}

export interface PerformanceMetrics {
  operationId: string;
  operation: string;
  startTime: number;
  endTime?: number | undefined;
  duration?: number | undefined;
  success: boolean;
  errorType?: string | undefined;
  retryCount: number;
  brokerName: string;
  accountId: string;
  userId: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  accountId: string;
  brokerName: string;
  operation: string;
  orderId?: string | undefined;
  previousStatus?: string | undefined;
  newStatus?: string | undefined;
  changes?: Record<string, any> | undefined;
  success: boolean;
  errorMessage?: string | undefined;
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
  sessionId?: string | undefined;
}

export class OrderStatusLogger {
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private auditLogs: AuditLogEntry[] = [];
  private maxAuditLogs = 10000; // Keep last 10k audit entries in memory

  /**
   * Log order status API call with structured logging
   */
  logOrderStatusRequest(context: OrderStatusLogContext): void {
    const logContext: OrderStatusLogContext = {
      ...context,
      component: 'ORDER_STATUS',
      operation: 'getOrderStatus'
    };

    logger.info('Order status request initiated', logContext, {
      orderId: context.orderId,
      brokerName: context.brokerName,
      accountId: context.accountId,
      apiEndpoint: context.apiEndpoint || 'SingleOrdStatus'
    });
  }

  /**
   * Log successful order status response
   */
  logOrderStatusSuccess(context: OrderStatusLogContext, orderData: any): void {
    const logContext: OrderStatusLogContext = {
      ...context,
      component: 'ORDER_STATUS',
      operation: 'getOrderStatus',
      status: 200
    };

    logger.info('Order status retrieved successfully', logContext, {
      orderId: context.orderId,
      orderStatus: orderData.status,
      symbol: orderData.symbol || orderData.tsym,
      quantity: orderData.quantity || orderData.qty,
      filledQuantity: orderData.filledQuantity || orderData.fillshares,
      averagePrice: orderData.averagePrice || orderData.avgprc,
      responseTime: context.responseTime
    });

    // Create audit log entry for successful status retrieval
    this.createAuditLog({
      userId: context.userId || '',
      accountId: context.accountId || '',
      brokerName: context.brokerName || '',
      operation: 'getOrderStatus',
      orderId: context.orderId,
      newStatus: orderData.status,
      success: true,
      sessionId: context.sessionId,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress
    });
  }

  /**
   * Log order status error with detailed information
   */
  logOrderStatusError(context: OrderStatusLogContext, error: any): void {
    const logContext: OrderStatusLogContext = {
      ...context,
      component: 'ORDER_STATUS',
      operation: 'getOrderStatus',
      errorType: error.errorType || 'UNKNOWN_ERROR',
      severity: this.determineErrorSeverity(error)
    };

    logger.error('Order status request failed', logContext, {
      orderId: context.orderId,
      errorMessage: error.message,
      errorCode: error.code || error.errorCode,
      originalError: error.originalError,
      retryAttempt: context.retryAttempt || 0,
      retryable: error.retryable,
      suggestedActions: error.suggestedActions,
      brokerResponse: error.brokerResponse,
      responseTime: context.responseTime
    });

    // Create audit log entry for failed status retrieval
    this.createAuditLog({
      userId: context.userId || '',
      accountId: context.accountId || '',
      brokerName: context.brokerName || '',
      operation: 'getOrderStatus',
      orderId: context.orderId,
      success: false,
      errorMessage: error.message,
      sessionId: context.sessionId,
      userAgent: context.userAgent,
      ipAddress: context.ipAddress
    });
  }

  /**
   * Log API performance metrics
   */
  startPerformanceTracking(operationId: string, operation: string, context: OrderStatusLogContext): void {
    const metrics: PerformanceMetrics = {
      operationId,
      operation,
      startTime: performance.now(),
      success: false,
      retryCount: 0,
      brokerName: context.brokerName || '',
      accountId: context.accountId || '',
      userId: context.userId || ''
    };

    this.performanceMetrics.set(operationId, metrics);

    logger.debug('Performance tracking started', {
      ...context,
      component: 'PERFORMANCE',
      operationId,
      operation
    });
  }

  /**
   * Complete performance tracking and log results
   */
  endPerformanceTracking(operationId: string, success: boolean, errorType?: string): void {
    const metrics = this.performanceMetrics.get(operationId);
    if (!metrics) {
      logger.warn('Performance tracking not found for operation', { operationId });
      return;
    }

    metrics.endTime = performance.now();
    metrics.duration = metrics.endTime - metrics.startTime;
    metrics.success = success;
    if (errorType !== undefined) {
      metrics.errorType = errorType;
    }

    const logContext: LogContext = {
      component: 'PERFORMANCE',
      operation: metrics.operation,
      brokerName: metrics.brokerName,
      accountId: metrics.accountId,
      userId: metrics.userId,
      duration: Math.round(metrics.duration)
    };

    if (success) {
      logger.info('Operation completed successfully', logContext, {
        operationId,
        duration: `${Math.round(metrics.duration)}ms`,
        retryCount: metrics.retryCount
      });
    } else {
      logger.warn('Operation completed with errors', logContext, {
        operationId,
        duration: `${Math.round(metrics.duration)}ms`,
        errorType,
        retryCount: metrics.retryCount
      });
    }

    // Log performance warning if operation took too long
    if (metrics.duration > 5000) { // 5 seconds threshold
      logger.warn('Slow operation detected', logContext, {
        operationId,
        duration: `${Math.round(metrics.duration)}ms`,
        threshold: '5000ms',
        suggestion: 'Consider optimizing API calls or implementing caching'
      });
    }

    // Clean up metrics after logging
    this.performanceMetrics.delete(operationId);
  }

  /**
   * Log rate limiting information
   */
  logRateLimit(context: OrderStatusLogContext, rateLimitInfo: any): void {
    const logContext: OrderStatusLogContext = {
      ...context,
      component: 'RATE_LIMIT',
      operation: 'checkRateLimit',
      rateLimitRemaining: rateLimitInfo.remaining
    };

    if (rateLimitInfo.exceeded) {
      logger.warn('Rate limit exceeded', logContext, {
        requestCount: rateLimitInfo.requestCount,
        maxRequests: rateLimitInfo.maxRequests,
        windowDuration: rateLimitInfo.windowDuration,
        resetTime: rateLimitInfo.resetTime,
        waitTime: rateLimitInfo.waitTime
      });
    } else if (rateLimitInfo.remaining < 10) {
      logger.warn('Rate limit approaching', logContext, {
        remaining: rateLimitInfo.remaining,
        maxRequests: rateLimitInfo.maxRequests,
        windowDuration: rateLimitInfo.windowDuration,
        suggestion: 'Consider reducing request frequency'
      });
    } else {
      logger.debug('Rate limit check passed', logContext, {
        remaining: rateLimitInfo.remaining,
        maxRequests: rateLimitInfo.maxRequests
      });
    }
  }

  /**
   * Log session validation events
   */
  logSessionValidation(context: OrderStatusLogContext, isValid: boolean, validationDetails?: any): void {
    const logContext: OrderStatusLogContext = {
      ...context,
      component: 'SESSION_VALIDATION',
      operation: 'validateSession',
      sessionValid: isValid
    };

    if (isValid) {
      logger.info('Session validation successful', logContext, {
        sessionAge: validationDetails?.sessionAge,
        lastActivity: validationDetails?.lastActivity
      });
    } else {
      logger.warn('Session validation failed', logContext, {
        reason: validationDetails?.reason,
        sessionExpired: validationDetails?.sessionExpired,
        requiresReauth: validationDetails?.requiresReauth,
        suggestedAction: 'User needs to reconnect account'
      });
    }
  }

  /**
   * Log WebSocket broadcast events
   */
  logWebSocketBroadcast(context: OrderStatusLogContext, broadcastData: any): void {
    const logContext: OrderStatusLogContext = {
      ...context,
      component: 'WEBSOCKET',
      operation: 'broadcastOrderStatus'
    };

    logger.info('Order status broadcast sent', logContext, {
      orderId: broadcastData.orderId,
      status: broadcastData.status,
      recipientCount: broadcastData.recipientCount,
      broadcastType: broadcastData.type || 'orderStatusUpdate'
    });
  }

  /**
   * Log database operations
   */
  logDatabaseOperation(context: OrderStatusLogContext, operation: string, success: boolean, details?: any): void {
    const logContext: OrderStatusLogContext = {
      ...context,
      component: 'DATABASE',
      operation: operation
    };

    if (success) {
      logger.info(`Database ${operation} successful`, logContext, {
        recordsAffected: details?.recordsAffected,
        queryTime: details?.queryTime
      });
    } else {
      logger.error(`Database ${operation} failed`, logContext, {
        errorMessage: details?.error?.message,
        queryTime: details?.queryTime,
        retryable: details?.retryable
      });
    }
  }

  /**
   * Create audit log entry
   */
  createAuditLog(entry: Partial<AuditLogEntry>): void {
    const auditEntry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      userId: entry.userId || '',
      accountId: entry.accountId || '',
      brokerName: entry.brokerName || '',
      operation: entry.operation || '',
      orderId: entry.orderId,
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      changes: entry.changes,
      success: entry.success || false,
      errorMessage: entry.errorMessage,
      userAgent: entry.userAgent,
      ipAddress: entry.ipAddress,
      sessionId: entry.sessionId
    };

    this.auditLogs.push(auditEntry);

    // Maintain audit log size limit
    if (this.auditLogs.length > this.maxAuditLogs) {
      this.auditLogs = this.auditLogs.slice(-this.maxAuditLogs);
    }

    // Log audit entry
    logger.info('Audit log created', {
      component: 'AUDIT',
      operation: entry.operation,
      userId: entry.userId,
      brokerName: entry.brokerName,
      auditId: auditEntry.id
    }, {
      auditEntry: {
        id: auditEntry.id,
        operation: auditEntry.operation,
        orderId: auditEntry.orderId,
        success: auditEntry.success,
        timestamp: auditEntry.timestamp
      }
    });
  }

  /**
   * Get audit logs for a specific user or operation
   */
  getAuditLogs(filters?: {
    userId?: string;
    brokerName?: string;
    operation?: string;
    orderId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): AuditLogEntry[] {
    let filteredLogs = [...this.auditLogs];

    if (filters) {
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
      }
      if (filters.brokerName) {
        filteredLogs = filteredLogs.filter(log => log.brokerName === filters.brokerName);
      }
      if (filters.operation) {
        filteredLogs = filteredLogs.filter(log => log.operation === filters.operation);
      }
      if (filters.orderId) {
        filteredLogs = filteredLogs.filter(log => log.orderId === filters.orderId);
      }
      if (filters.startDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
      }
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filters?.limit) {
      filteredLogs = filteredLogs.slice(0, filters.limit);
    }

    return filteredLogs;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(timeWindow: number = 3600000): {
    averageResponseTime: number;
    successRate: number;
    errorRate: number;
    totalOperations: number;
    slowOperations: number;
  } {
    const cutoff = new Date(Date.now() - timeWindow);
    const recentLogs = this.auditLogs.filter(log => log.timestamp >= cutoff);

    const totalOperations = recentLogs.length;
    const successfulOperations = recentLogs.filter(log => log.success).length;
    const failedOperations = totalOperations - successfulOperations;

    // Note: Response time data would need to be stored in audit logs for accurate calculation
    // This is a simplified implementation
    const averageResponseTime = 0; // Would need actual response time data
    const slowOperations = 0; // Would need actual response time data

    return {
      averageResponseTime,
      successRate: totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 0,
      errorRate: totalOperations > 0 ? (failedOperations / totalOperations) * 100 : 0,
      totalOperations,
      slowOperations
    };
  }

  /**
   * Determine error severity based on error type and context
   */
  private determineErrorSeverity(error: any): string {
    if (error.errorType === 'SESSION_EXPIRED' || error.errorType === 'AUTH_FAILED') {
      return 'high';
    }
    if (error.errorType === 'NETWORK_ERROR' || error.errorType === 'RATE_LIMITED') {
      return 'medium';
    }
    if (error.errorType === 'VALIDATION_ERROR' || error.errorType === 'ORDER_NOT_FOUND') {
      return 'low';
    }
    return 'medium'; // Default severity
  }

  /**
   * Generate unique audit ID
   */
  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear old audit logs (for maintenance)
   */
  clearOldAuditLogs(olderThan: Date): number {
    const initialCount = this.auditLogs.length;
    this.auditLogs = this.auditLogs.filter(log => log.timestamp > olderThan);
    const removedCount = initialCount - this.auditLogs.length;

    if (removedCount > 0) {
      logger.info('Old audit logs cleared', {
        component: 'AUDIT_MAINTENANCE',
        operation: 'clearOldLogs'
      }, {
        removedCount,
        remainingCount: this.auditLogs.length,
        cutoffDate: olderThan
      });
    }

    return removedCount;
  }
}

// Export singleton instance
export const orderStatusLogger = new OrderStatusLogger();

// Export convenience functions
export const logOrderStatusRequest = (context: OrderStatusLogContext) => 
  orderStatusLogger.logOrderStatusRequest(context);

export const logOrderStatusSuccess = (context: OrderStatusLogContext, orderData: any) => 
  orderStatusLogger.logOrderStatusSuccess(context, orderData);

export const logOrderStatusError = (context: OrderStatusLogContext, error: any) => 
  orderStatusLogger.logOrderStatusError(context, error);

export const startPerformanceTracking = (operationId: string, operation: string, context: OrderStatusLogContext) => 
  orderStatusLogger.startPerformanceTracking(operationId, operation, context);

export const endPerformanceTracking = (operationId: string, success: boolean, errorType?: string) => 
  orderStatusLogger.endPerformanceTracking(operationId, success, errorType);

export default orderStatusLogger;