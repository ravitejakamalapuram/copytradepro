/**
 * Database Error Logging Service
 * Integrates error logging with database operations
 */

import { ErrorLoggingService } from './errorLoggingService';
import { traceIdService } from './traceIdService';
import TraceContext from '../utils/traceContext';
import { logger } from '../utils/logger';

export interface DatabaseOperationContext {
  userId?: string;
  operation: string;
  collection?: string | undefined;
  query?: any;
  data?: any;
  connectionState?: {
    isConnected: boolean;
    poolSize?: number;
    activeConnections?: number;
  };
  queryDetails?: {
    executionTime?: number;
    affectedRows?: number;
    indexesUsed?: string[];
  };
  traceId?: string;
}

export interface DatabaseErrorClassification {
  category: 'CONNECTION' | 'QUERY' | 'VALIDATION' | 'CONSTRAINT' | 'TIMEOUT' | 
           'PERMISSION' | 'RESOURCE' | 'CORRUPTION' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isRetryable: boolean;
  requiresUserAction: boolean;
  affectsDataIntegrity: boolean;
  suggestedRecovery: string[];
}

export class DatabaseErrorLoggingService {
  private static instance: DatabaseErrorLoggingService;
  private errorLoggingService: ErrorLoggingService;

  private constructor() {
    this.errorLoggingService = ErrorLoggingService.getInstance();
  }

  public static getInstance(): DatabaseErrorLoggingService {
    if (!DatabaseErrorLoggingService.instance) {
      DatabaseErrorLoggingService.instance = new DatabaseErrorLoggingService();
    }
    return DatabaseErrorLoggingService.instance;
  }

  /**
   * Log database operation error with comprehensive context
   */
  public async logDatabaseError(
    message: string,
    error: any,
    context: DatabaseOperationContext
  ): Promise<string> {
    const classification = this.classifyDatabaseError(error, context);
    const traceId = context.traceId || TraceContext.getTraceId() || traceIdService.generateTraceId();

    // Enhanced error message with database context
    const enhancedMessage = `[DB] ${context.operation}: ${message}`;

    // Create comprehensive error context
    const errorContext = {
      traceId,
      component: 'DATABASE_SERVICE',
      operation: context.operation,
      source: 'DB' as const,
      level: this.mapSeverityToLevel(classification.severity),
      errorType: `DATABASE_${classification.category}`,
      userId: context.userId,
      url: `/database/${context.collection || 'unknown'}`,
      method: this.mapOperationToMethod(context.operation),
      duration: context.queryDetails?.executionTime,
      retryCount: 0 // Will be incremented by retry logic
    };

    // Log the error with enhanced context
    const errorId = await this.errorLoggingService.logError(
      enhancedMessage,
      error,
      errorContext
    );

    // Log additional database-specific context
    logger.error(`Database operation failed: ${context.operation}`, {
      errorId,
      traceId,
      collection: context.collection,
      classification: classification.category,
      severity: classification.severity,
      isRetryable: classification.isRetryable,
      requiresUserAction: classification.requiresUserAction,
      affectsDataIntegrity: classification.affectsDataIntegrity,
      query: this.sanitizeQuery(context.query),
      connectionState: context.connectionState,
      queryDetails: context.queryDetails,
      suggestedRecovery: classification.suggestedRecovery
    });

    return errorId;
  }

  /**
   * Log successful database operation for analytics
   */
  public async logDatabaseSuccess(
    message: string,
    context: DatabaseOperationContext
  ): Promise<string> {
    const traceId = context.traceId || TraceContext.getTraceId() || traceIdService.generateTraceId();

    const successMessage = `[DB] ${context.operation}: ${message}`;

    return await this.errorLoggingService.logInfo(
      successMessage,
      {
        traceId,
        component: 'DATABASE_SERVICE',
        operation: context.operation,
        source: 'DB' as const,
        userId: context.userId
      }
    );
  }

  /**
   * Log database warning (e.g., slow query, connection pool exhaustion)
   */
  public async logDatabaseWarning(
    message: string,
    context: DatabaseOperationContext
  ): Promise<string> {
    const traceId = context.traceId || TraceContext.getTraceId() || traceIdService.generateTraceId();

    const warningMessage = `[DB] ${context.operation}: ${message}`;

    return await this.errorLoggingService.logWarning(
      warningMessage,
      {
        traceId,
        component: 'DATABASE_SERVICE',
        operation: context.operation,
        source: 'DB' as const,
        userId: context.userId
      }
    );
  }

  /**
   * Classify database errors for better handling and recovery
   */
  private classifyDatabaseError(error: any, context: DatabaseOperationContext): DatabaseErrorClassification {
    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code || error?.errno || '';

    // Connection errors
    if (errorMessage.includes('connection') || errorMessage.includes('connect') ||
        errorCode === 'ECONNREFUSED' || errorCode === 'ENOTFOUND' || 
        errorCode === 'ETIMEDOUT' || errorCode === 'ECONNRESET') {
      return {
        category: 'CONNECTION',
        severity: 'HIGH',
        isRetryable: true,
        requiresUserAction: false,
        affectsDataIntegrity: false,
        suggestedRecovery: [
          'Check database connection',
          'Verify database server status',
          'Implement connection retry logic',
          'Check network connectivity'
        ]
      };
    }

    // Query syntax errors
    if (errorMessage.includes('syntax') || errorMessage.includes('invalid query') ||
        errorMessage.includes('malformed') || errorCode === 'ER_PARSE_ERROR') {
      return {
        category: 'QUERY',
        severity: 'MEDIUM',
        isRetryable: false,
        requiresUserAction: true,
        affectsDataIntegrity: false,
        suggestedRecovery: [
          'Review query syntax',
          'Check field names and types',
          'Validate query parameters',
          'Update query structure'
        ]
      };
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('invalid') ||
        errorMessage.includes('required') || errorMessage.includes('constraint')) {
      return {
        category: 'VALIDATION',
        severity: 'MEDIUM',
        isRetryable: false,
        requiresUserAction: true,
        affectsDataIntegrity: false,
        suggestedRecovery: [
          'Validate input data',
          'Check required fields',
          'Review data types',
          'Update validation rules'
        ]
      };
    }

    // Constraint violations
    if (errorMessage.includes('duplicate') || errorMessage.includes('unique') ||
        errorMessage.includes('foreign key') || errorCode === 'ER_DUP_ENTRY' ||
        errorCode === 'ER_NO_REFERENCED_ROW') {
      return {
        category: 'CONSTRAINT',
        severity: 'MEDIUM',
        isRetryable: false,
        requiresUserAction: true,
        affectsDataIntegrity: true,
        suggestedRecovery: [
          'Check for duplicate entries',
          'Verify foreign key relationships',
          'Update constraint definitions',
          'Handle unique violations'
        ]
      };
    }

    // Timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('lock wait') ||
        errorCode === 'ER_LOCK_WAIT_TIMEOUT' || errorCode === 'ETIMEDOUT') {
      return {
        category: 'TIMEOUT',
        severity: 'MEDIUM',
        isRetryable: true,
        requiresUserAction: false,
        affectsDataIntegrity: false,
        suggestedRecovery: [
          'Optimize query performance',
          'Reduce transaction time',
          'Implement query timeout handling',
          'Check for deadlocks'
        ]
      };
    }

    // Permission errors
    if (errorMessage.includes('permission') || errorMessage.includes('access denied') ||
        errorMessage.includes('unauthorized') || errorCode === 'ER_ACCESS_DENIED_ERROR') {
      return {
        category: 'PERMISSION',
        severity: 'HIGH',
        isRetryable: false,
        requiresUserAction: true,
        affectsDataIntegrity: false,
        suggestedRecovery: [
          'Check database user permissions',
          'Verify authentication credentials',
          'Review access control settings',
          'Update user privileges'
        ]
      };
    }

    // Resource errors
    if (errorMessage.includes('out of memory') || errorMessage.includes('disk full') ||
        errorMessage.includes('resource') || errorCode === 'ER_OUT_OF_RESOURCES') {
      return {
        category: 'RESOURCE',
        severity: 'CRITICAL',
        isRetryable: true,
        requiresUserAction: true,
        affectsDataIntegrity: false,
        suggestedRecovery: [
          'Check available memory',
          'Monitor disk space',
          'Optimize resource usage',
          'Scale database resources'
        ]
      };
    }

    // Data corruption
    if (errorMessage.includes('corrupt') || errorMessage.includes('damaged') ||
        errorMessage.includes('integrity') || errorCode === 'ER_CRASHED_ON_USAGE') {
      return {
        category: 'CORRUPTION',
        severity: 'CRITICAL',
        isRetryable: false,
        requiresUserAction: true,
        affectsDataIntegrity: true,
        suggestedRecovery: [
          'Check database integrity',
          'Run database repair tools',
          'Restore from backup',
          'Contact database administrator'
        ]
      };
    }

    // Default classification for unknown errors
    return {
      category: 'UNKNOWN',
      severity: 'MEDIUM',
      isRetryable: true,
      requiresUserAction: false,
      affectsDataIntegrity: false,
      suggestedRecovery: [
        'Review error details',
        'Check database logs',
        'Monitor system resources',
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
   * Map database operation to HTTP method for logging
   */
  private mapOperationToMethod(operation: string): string {
    const op = operation.toLowerCase();
    if (op.includes('create') || op.includes('insert')) return 'POST';
    if (op.includes('update') || op.includes('modify')) return 'PUT';
    if (op.includes('delete') || op.includes('remove')) return 'DELETE';
    if (op.includes('get') || op.includes('find') || op.includes('search')) return 'GET';
    return 'POST';
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: any): any {
    if (!query) return query;

    const sanitized = JSON.parse(JSON.stringify(query));
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'credentials'];
    
    const sanitizeObject = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
      
      return obj;
    };

    return sanitizeObject(sanitized);
  }

  /**
   * Create database operation context
   */
  public createDatabaseContext(
    operation: string,
    collection?: string,
    additionalContext?: Partial<DatabaseOperationContext>
  ): DatabaseOperationContext {
    return {
      operation,
      collection,
      traceId: TraceContext.getTraceId() || traceIdService.generateTraceId(),
      ...additionalContext
    };
  }

  /**
   * Get database error analytics
   */
  public async getDatabaseErrorAnalytics(
    timeWindow: number = 86400000
  ): Promise<{
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    errorsByCollection: Record<string, number>;
    criticalErrors: number;
    retryableErrors: number;
    dataIntegrityErrors: number;
    connectionErrors: number;
    slowQueries: number;
  }> {
    try {
      const analytics = await this.errorLoggingService.getErrorAnalytics(timeWindow);
      
      // Filter database-specific errors
      const dbErrors = Object.entries(analytics.errorsByComponent)
        .filter(([component]) => component.includes('DATABASE'))
        .reduce((sum, [, count]) => sum + count, 0);

      return {
        totalErrors: dbErrors,
        errorsByCategory: analytics.errorsByCategory,
        errorsByCollection: {}, // Would need to be calculated from error details
        criticalErrors: analytics.criticalErrors,
        retryableErrors: 0, // Would need to be calculated from error details
        dataIntegrityErrors: 0, // Would need to be calculated from error details
        connectionErrors: 0, // Would need to be calculated from error details
        slowQueries: 0 // Would need to be calculated from performance metrics
      };
    } catch (error) {
      logger.error('Failed to get database error analytics', {
        component: 'DATABASE_ERROR_LOGGING_SERVICE',
        operation: 'GET_DATABASE_ERROR_ANALYTICS'
      }, error);

      return {
        totalErrors: 0,
        errorsByCategory: {},
        errorsByCollection: {},
        criticalErrors: 0,
        retryableErrors: 0,
        dataIntegrityErrors: 0,
        connectionErrors: 0,
        slowQueries: 0
      };
    }
  }
}

// Export singleton instance
export const databaseErrorLoggingService = DatabaseErrorLoggingService.getInstance();