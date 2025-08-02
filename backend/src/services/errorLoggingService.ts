import { v4 as uuidv4 } from 'uuid';
import { ErrorLog, IErrorLog } from '../models/errorLogModels';
import { traceIdService } from './traceIdService';
import { logger } from '../utils/logger';
import { ErrorType, ErrorSeverity, ErrorClassification } from '../types/errorTypes';

export interface ErrorLogEntry {
  id: string;
  traceId: string;
  timestamp: Date;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  source: 'UI' | 'BE' | 'DB' | 'API';
  component: string;
  operation: string;
  message: string;
  errorType: string;
  stackTrace?: string;
  context: {
    requestId?: string | undefined;
    userId?: string | undefined;
    sessionId?: string | undefined;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    brokerName?: string | undefined;
    accountId?: string | undefined;
    url?: string | undefined;
    method?: string | undefined;
    statusCode?: number | undefined;
    duration?: number | undefined;
    retryCount?: number | undefined;
  };
  metadata: {
    environment: string;
    version: string;
    nodeVersion: string;
    platform: string;
  };
  relatedErrors?: string[];
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByComponent: Record<string, number>;
  errorsBySource: Record<string, number>;
  errorsByTimeRange: Array<{ timestamp: Date; count: number }>;
  topErrors: Array<{ message: string; count: number; lastOccurred: Date }>;
  errorTrends: {
    hourly: number[];
    daily: number[];
    weekly: number[];
  };
  criticalErrors: number;
  resolvedErrors: number;
  unresolvedErrors: number;
}

export interface ErrorSearchFilters {
  traceId?: string;
  level?: string[];
  source?: string[];
  component?: string[];
  errorType?: string[];
  userId?: string;
  brokerName?: string;
  resolved?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export class ErrorLoggingService {
  private static instance: ErrorLoggingService;

  public static getInstance(): ErrorLoggingService {
    if (!ErrorLoggingService.instance) {
      ErrorLoggingService.instance = new ErrorLoggingService();
    }
    return ErrorLoggingService.instance;
  }

  /**
   * Log an error with comprehensive context
   */
  public async logError(
    message: string,
    error: any,
    context: {
      traceId?: string | undefined;
      component: string;
      operation: string;
      source?: 'UI' | 'BE' | 'DB' | 'API' | undefined;
      level?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | undefined;
      errorType?: string | undefined;
      userId?: string | undefined;
      sessionId?: string | undefined;
      requestId?: string | undefined;
      brokerName?: string | undefined;
      accountId?: string | undefined;
      url?: string | undefined;
      method?: string | undefined;
      statusCode?: number | undefined;
      duration?: number | undefined;
      retryCount?: number | undefined;
      userAgent?: string | undefined;
      ipAddress?: string | undefined;
    }
  ): Promise<string> {
    const errorId = uuidv4();
    const timestamp = new Date();
    const traceId = context.traceId || traceIdService.generateTraceId();

    // Determine error classification
    const classification = this.classifyError(error, context.errorType);
    
    // Extract stack trace
    const stackTrace = error?.stack || (error instanceof Error ? error.stack : undefined);

    // Create error log entry
    const errorLogEntry: ErrorLogEntry = {
      id: errorId,
      traceId,
      timestamp,
      level: context.level || 'ERROR',
      source: context.source || 'BE',
      component: context.component,
      operation: context.operation,
      message,
      errorType: context.errorType || classification.type,
      stackTrace,
      context: {
        requestId: context.requestId,
        userId: context.userId,
        sessionId: context.sessionId,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        brokerName: context.brokerName,
        accountId: context.accountId,
        url: context.url,
        method: context.method,
        statusCode: context.statusCode,
        duration: context.duration,
        retryCount: context.retryCount || 0
      },
      metadata: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.APP_VERSION || '1.0.0',
        nodeVersion: process.version,
        platform: process.platform
      }
    };

    try {
      // Save to database
      await ErrorLog.create({
        ...errorLogEntry,
        errorId: errorLogEntry.id
      });

      // Update trace with error operation
      await traceIdService.completeOperation(
        traceId,
        context.operation,
        'ERROR',
        { errorId, errorType: errorLogEntry.errorType }
      );

      // Log to console for immediate visibility
      logger.error(`[${errorLogEntry.source}] ${message}`, {
        component: context.component,
        operation: context.operation,
        traceId,
        errorId,
        errorType: errorLogEntry.errorType,
        userId: context.userId,
        brokerName: context.brokerName
      }, error);

      return errorId;
    } catch (dbError) {
      // Fallback logging if database fails
      logger.error('Failed to save error log to database', {
        component: 'ERROR_LOGGING_SERVICE',
        operation: 'LOG_ERROR',
        originalMessage: message,
        traceId
      }, dbError);

      // Still log the original error to console
      logger.error(`[FALLBACK] [${errorLogEntry.source}] ${message}`, {
        component: context.component,
        operation: context.operation,
        traceId,
        errorType: errorLogEntry.errorType
      }, error);

      return errorId;
    }
  }

  /**
   * Log a warning with context
   */
  public async logWarning(
    message: string,
    context: {
      traceId?: string | undefined;
      component: string;
      operation: string;
      source?: 'UI' | 'BE' | 'DB' | 'API' | undefined;
      userId?: string | undefined;
      brokerName?: string | undefined;
      [key: string]: any;
    }
  ): Promise<string> {
    return this.logError(message, null, {
      ...context,
      level: 'WARN',
      errorType: 'WARNING'
    });
  }

  /**
   * Log an info message with context
   */
  public async logInfo(
    message: string,
    context: {
      traceId?: string | undefined;
      component: string;
      operation: string;
      source?: 'UI' | 'BE' | 'DB' | 'API' | undefined;
      userId?: string | undefined;
      brokerName?: string | undefined;
      [key: string]: any;
    }
  ): Promise<string> {
    return this.logError(message, null, {
      ...context,
      level: 'INFO',
      errorType: 'INFO'
    });
  }

  /**
   * Search error logs with filters
   */
  public async searchErrorLogs(filters: ErrorSearchFilters): Promise<{
    errors: IErrorLog[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const query: any = {};

      // Apply filters
      if (filters.traceId) {
        query.traceId = filters.traceId;
      }

      if (filters.level && filters.level.length > 0) {
        query.level = { $in: filters.level };
      }

      if (filters.source && filters.source.length > 0) {
        query.source = { $in: filters.source };
      }

      if (filters.component && filters.component.length > 0) {
        query.component = { $in: filters.component };
      }

      if (filters.errorType && filters.errorType.length > 0) {
        query.errorType = { $in: filters.errorType };
      }

      if (filters.userId) {
        query['context.userId'] = filters.userId;
      }

      if (filters.brokerName) {
        query['context.brokerName'] = filters.brokerName;
      }

      if (filters.resolved !== undefined) {
        query.resolved = filters.resolved;
      }

      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
          query.timestamp.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.timestamp.$lte = filters.endDate;
        }
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      // Get total count
      const total = await ErrorLog.countDocuments(query);

      // Get paginated results
      const errors = await ErrorLog.find(query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      return {
        errors: errors as IErrorLog[],
        total,
        hasMore: offset + errors.length < total
      };
    } catch (error) {
      logger.error('Failed to search error logs', {
        component: 'ERROR_LOGGING_SERVICE',
        operation: 'SEARCH_ERROR_LOGS'
      }, error);

      return {
        errors: [],
        total: 0,
        hasMore: false
      };
    }
  }

  /**
   * Get error analytics
   */
  public async getErrorAnalytics(timeWindow: number = 86400000): Promise<ErrorAnalytics> {
    const cutoff = new Date(Date.now() - timeWindow);

    try {
      const [
        totalStats,
        errorsByType,
        errorsByComponent,
        errorsBySource,
        topErrors,
        hourlyTrends
      ] = await Promise.all([
        // Total error statistics
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          {
            $group: {
              _id: null,
              totalErrors: { $sum: 1 },
              criticalErrors: {
                $sum: { $cond: [{ $eq: ['$level', 'ERROR'] }, 1, 0] }
              },
              resolvedErrors: {
                $sum: { $cond: ['$resolved', 1, 0] }
              },
              unresolvedErrors: {
                $sum: { $cond: ['$resolved', 0, 1] }
              }
            }
          }
        ]),

        // Errors by type
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          { $group: { _id: '$errorType', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Errors by component
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          { $group: { _id: '$component', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Errors by source
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          { $group: { _id: '$source', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Top error messages
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          {
            $group: {
              _id: '$message',
              count: { $sum: 1 },
              lastOccurred: { $max: '$timestamp' }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),

        // Hourly error trends
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          {
            $group: {
              _id: {
                hour: { $hour: '$timestamp' },
                date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.date': 1, '_id.hour': 1 } }
        ])
      ]);

      const stats = totalStats[0] || {
        totalErrors: 0,
        criticalErrors: 0,
        resolvedErrors: 0,
        unresolvedErrors: 0
      };

      return {
        totalErrors: stats.totalErrors,
        criticalErrors: stats.criticalErrors,
        resolvedErrors: stats.resolvedErrors,
        unresolvedErrors: stats.unresolvedErrors,
        errorsByType: errorsByType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        errorsByComponent: errorsByComponent.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        errorsBySource: errorsBySource.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        errorsByTimeRange: hourlyTrends.map(item => ({
          timestamp: new Date(`${item._id.date}T${item._id.hour.toString().padStart(2, '0')}:00:00`),
          count: item.count
        })),
        topErrors: topErrors.map(item => ({
          message: item._id,
          count: item.count,
          lastOccurred: item.lastOccurred
        })),
        errorTrends: {
          hourly: this.generateHourlyTrends(hourlyTrends),
          daily: [], // TODO: Implement daily trends
          weekly: [] // TODO: Implement weekly trends
        }
      };
    } catch (error) {
      logger.error('Failed to get error analytics', {
        component: 'ERROR_LOGGING_SERVICE',
        operation: 'GET_ERROR_ANALYTICS'
      }, error);

      return {
        totalErrors: 0,
        criticalErrors: 0,
        resolvedErrors: 0,
        unresolvedErrors: 0,
        errorsByType: {},
        errorsByComponent: {},
        errorsBySource: {},
        errorsByTimeRange: [],
        topErrors: [],
        errorTrends: {
          hourly: [],
          daily: [],
          weekly: []
        }
      };
    }
  }

  /**
   * Mark an error as resolved
   */
  public async resolveError(
    errorId: string,
    resolution: string,
    resolvedBy: string
  ): Promise<boolean> {
    try {
      const result = await ErrorLog.updateOne(
        { errorId: errorId },
        {
          $set: {
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy,
            resolution
          }
        }
      );

      if (result.modifiedCount > 0) {
        logger.info('Error marked as resolved', {
          component: 'ERROR_LOGGING_SERVICE',
          operation: 'RESOLVE_ERROR',
          errorId,
          resolvedBy
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to resolve error', {
        component: 'ERROR_LOGGING_SERVICE',
        operation: 'RESOLVE_ERROR',
        errorId
      }, error);
      return false;
    }
  }

  /**
   * Get errors by trace ID
   */
  public async getErrorsByTraceId(traceId: string): Promise<IErrorLog[]> {
    try {
      const errors = await ErrorLog.find({ traceId })
        .sort({ timestamp: 1 })
        .lean();

      return errors as IErrorLog[];
    } catch (error) {
      logger.error('Failed to get errors by trace ID', {
        component: 'ERROR_LOGGING_SERVICE',
        operation: 'GET_ERRORS_BY_TRACE_ID',
        traceId
      }, error);
      return [];
    }
  }

  /**
   * Classify error based on type and context
   */
  private classifyError(error: any, errorType?: string): ErrorClassification {
    // Default classification
    let classification: ErrorClassification = {
      type: 'system' as ErrorType,
      severity: 'medium' as ErrorSeverity,
      retryable: false,
      userMessage: 'An unexpected error occurred',
      technicalDetails: error?.message || 'Unknown error',
      suggestedActions: ['Contact support if the issue persists']
    };

    // Classify based on error type or error properties
    if (errorType) {
      switch (errorType.toLowerCase()) {
        case 'broker_api_error':
        case 'broker':
          classification.type = 'broker';
          classification.severity = 'high';
          classification.retryable = true;
          classification.userMessage = 'Broker service is temporarily unavailable';
          classification.suggestedActions = ['Retry the operation', 'Check broker connection'];
          break;

        case 'authentication':
        case 'auth_error':
          classification.type = 'authentication';
          classification.severity = 'high';
          classification.retryable = false;
          classification.userMessage = 'Authentication failed';
          classification.suggestedActions = ['Please log in again', 'Check your credentials'];
          break;

        case 'validation':
        case 'validation_error':
          classification.type = 'validation';
          classification.severity = 'low';
          classification.retryable = false;
          classification.userMessage = 'Invalid input provided';
          classification.suggestedActions = ['Check your input and try again'];
          break;

        case 'network':
        case 'network_error':
          classification.type = 'network';
          classification.severity = 'medium';
          classification.retryable = true;
          classification.userMessage = 'Network connection issue';
          classification.suggestedActions = ['Check your internet connection', 'Retry the operation'];
          break;
      }
    }

    // Classify based on error message or properties
    if (error?.message) {
      const message = error.message.toLowerCase();
      
      if (message.includes('timeout') || message.includes('network')) {
        classification.type = 'network';
        classification.retryable = true;
      } else if (message.includes('unauthorized') || message.includes('forbidden')) {
        classification.type = 'authentication';
        classification.severity = 'high';
      } else if (message.includes('validation') || message.includes('invalid')) {
        classification.type = 'validation';
        classification.severity = 'low';
      }
    }

    return classification;
  }

  /**
   * Generate hourly trends array
   */
  private generateHourlyTrends(hourlyData: any[]): number[] {
    const trends = new Array(24).fill(0);
    
    hourlyData.forEach(item => {
      const hour = item._id.hour;
      if (hour >= 0 && hour < 24) {
        trends[hour] = item.count;
      }
    });

    return trends;
  }
}

// Export singleton instance
export const errorLoggingService = ErrorLoggingService.getInstance();
export default errorLoggingService;