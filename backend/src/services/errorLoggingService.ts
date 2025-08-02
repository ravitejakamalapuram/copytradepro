import { v4 as uuidv4 } from 'uuid';
import { ErrorLog, IErrorLog } from '../models/errorLogModels';
import { traceIdService } from './traceIdService';
import { logger } from '../utils/logger';
import { ErrorType, ErrorSeverity, ErrorClassification } from '../types/errorTypes';
import { ErrorClassificationService } from './errorClassificationService';

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
  errorsByCategory: Record<string, number>;
  errorsByBroker: Record<string, number>;
  errorsByUser: Record<string, number>;
  severityDistribution: Record<string, number>;
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
  private errorClassificationService: ErrorClassificationService;

  private constructor() {
    this.errorClassificationService = ErrorClassificationService.getInstance();
  }

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

    // Determine error classification and categorization
    const classification = this.classifyError(error, context.errorType, context);
    const categorization = this.categorizeError(error, context);
    
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

      // Log to console for immediate visibility with categorization
      logger.error(`[${errorLogEntry.source}] [${categorization.category}] ${message}`, {
        component: context.component,
        operation: context.operation,
        traceId,
        errorId,
        errorType: errorLogEntry.errorType,
        category: categorization.category,
        businessImpact: categorization.businessImpact,
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
   * Get comprehensive error analytics with enhanced categorization
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
        hourlyTrends,
        errorsByCategory,
        errorsByBroker,
        errorsByUser,
        severityDistribution,
        dailyTrends,
        weeklyTrends
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
        ]),

        // Errors by business category (derived from component analysis)
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          {
            $addFields: {
              category: {
                $switch: {
                  branches: [
                    { case: { $regexMatch: { input: '$component', regex: /broker|order|trading/i } }, then: 'TRADING' },
                    { case: { $regexMatch: { input: '$component', regex: /auth|login/i } }, then: 'AUTHENTICATION' },
                    { case: { $regexMatch: { input: '$component', regex: /database|data/i } }, then: 'DATA' },
                    { case: { $regexMatch: { input: '$component', regex: /api|network/i } }, then: 'NETWORK' },
                    { case: { $eq: ['$source', 'UI'] }, then: 'USER_INTERFACE' }
                  ],
                  default: 'SYSTEM'
                }
              }
            }
          },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Errors by broker
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff }, 'context.brokerName': { $exists: true, $ne: null } } },
          { $group: { _id: '$context.brokerName', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Errors by user (top 10)
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff }, 'context.userId': { $exists: true, $ne: null } } },
          { $group: { _id: '$context.userId', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),

        // Error severity distribution
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          { $group: { _id: '$level', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Daily error trends (last 30 days)
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id': 1 } }
        ]),

        // Weekly error trends (last 12 weeks)
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: new Date(Date.now() - 12 * 7 * 24 * 60 * 60 * 1000) } } },
          {
            $group: {
              _id: {
                year: { $year: '$timestamp' },
                week: { $week: '$timestamp' }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.year': 1, '_id.week': 1 } }
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
        errorsByCategory: errorsByCategory.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        errorsByBroker: errorsByBroker.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        errorsByUser: errorsByUser.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        severityDistribution: severityDistribution.reduce((acc, item) => {
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
          daily: this.generateDailyTrends(dailyTrends),
          weekly: this.generateWeeklyTrends(weeklyTrends)
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
        errorsByCategory: {},
        errorsByBroker: {},
        errorsByUser: {},
        severityDistribution: {},
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
   * Get error patterns and insights
   */
  public async getErrorPatterns(timeWindow: number = 86400000): Promise<{
    recurringErrors: Array<{
      pattern: string;
      count: number;
      firstSeen: Date;
      lastSeen: Date;
      affectedComponents: string[];
      suggestedFix: string;
    }>;
    errorSpikes: Array<{
      timestamp: Date;
      errorCount: number;
      primaryCause: string;
      affectedSystems: string[];
    }>;
    correlatedErrors: Array<{
      traceId: string;
      errorChain: Array<{
        component: string;
        operation: string;
        timestamp: Date;
        message: string;
      }>;
    }>;
  }> {
    const cutoff = new Date(Date.now() - timeWindow);

    try {
      const [recurringErrors, errorSpikes, correlatedErrors] = await Promise.all([
        // Find recurring error patterns
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          {
            $group: {
              _id: {
                message: '$message',
                component: '$component',
                errorType: '$errorType'
              },
              count: { $sum: 1 },
              firstSeen: { $min: '$timestamp' },
              lastSeen: { $max: '$timestamp' },
              components: { $addToSet: '$component' }
            }
          },
          { $match: { count: { $gte: 3 } } }, // Errors that occurred 3+ times
          { $sort: { count: -1 } },
          { $limit: 20 }
        ]),

        // Detect error spikes (periods with unusually high error rates)
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          {
            $group: {
              _id: {
                hour: { $hour: '$timestamp' },
                date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
              },
              count: { $sum: 1 },
              primaryErrors: { $push: { component: '$component', errorType: '$errorType' } }
            }
          },
          { $match: { count: { $gte: 10 } } }, // Hours with 10+ errors
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),

        // Find correlated errors (errors in the same trace)
        ErrorLog.aggregate([
          { $match: { timestamp: { $gte: cutoff } } },
          {
            $group: {
              _id: '$traceId',
              errors: {
                $push: {
                  component: '$component',
                  operation: '$operation',
                  timestamp: '$timestamp',
                  message: '$message'
                }
              },
              errorCount: { $sum: 1 }
            }
          },
          { $match: { errorCount: { $gte: 2 } } }, // Traces with multiple errors
          { $sort: { errorCount: -1 } },
          { $limit: 15 }
        ])
      ]);

      return {
        recurringErrors: recurringErrors.map(item => ({
          pattern: `${item._id.component}: ${item._id.message}`,
          count: item.count,
          firstSeen: item.firstSeen,
          lastSeen: item.lastSeen,
          affectedComponents: item.components,
          suggestedFix: this.generateSuggestedFix(item._id.errorType, item._id.component)
        })),
        errorSpikes: errorSpikes.map(item => ({
          timestamp: new Date(`${item._id.date}T${item._id.hour.toString().padStart(2, '0')}:00:00`),
          errorCount: item.count as number,
          primaryCause: this.identifyPrimaryCause(item.primaryErrors),
          affectedSystems: [...new Set(item.primaryErrors.map((e: any) => e.component as string))] as string[]
        })),
        correlatedErrors: correlatedErrors.map(item => ({
          traceId: item._id,
          errorChain: item.errors.sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime())
        }))
      };
    } catch (error) {
      logger.error('Failed to get error patterns', {
        component: 'ERROR_LOGGING_SERVICE',
        operation: 'GET_ERROR_PATTERNS'
      }, error);

      return {
        recurringErrors: [],
        errorSpikes: [],
        correlatedErrors: []
      };
    }
  }

  /**
   * Generate actionable insights from error data
   */
  public async generateErrorInsights(timeWindow: number = 86400000): Promise<{
    criticalIssues: Array<{
      title: string;
      description: string;
      impact: string;
      recommendedActions: string[];
      priority: 'low' | 'medium' | 'high' | 'critical';
    }>;
    performanceImpacts: Array<{
      component: string;
      avgErrorRate: number;
      impactOnUserExperience: string;
      optimizationSuggestions: string[];
    }>;
    systemHealthScore: {
      overall: number;
      breakdown: {
        trading: number;
        authentication: number;
        data: number;
        network: number;
        ui: number;
      };
    };
  }> {
    try {
      const analytics = await this.getErrorAnalytics(timeWindow);
      const patterns = await this.getErrorPatterns(timeWindow);

      const criticalIssues = this.identifyCriticalIssues(analytics, patterns);
      const performanceImpacts = this.analyzePerformanceImpacts(analytics);
      const systemHealthScore = this.calculateSystemHealthScore(analytics);

      return {
        criticalIssues,
        performanceImpacts,
        systemHealthScore
      };
    } catch (error) {
      logger.error('Failed to generate error insights', {
        component: 'ERROR_LOGGING_SERVICE',
        operation: 'GENERATE_ERROR_INSIGHTS'
      }, error);

      return {
        criticalIssues: [],
        performanceImpacts: [],
        systemHealthScore: {
          overall: 0,
          breakdown: {
            trading: 0,
            authentication: 0,
            data: 0,
            network: 0,
            ui: 0
          }
        }
      };
    }
  }

  private generateSuggestedFix(errorType: string, component: string): string {
    const fixes: Record<string, string> = {
      'BROKER_API_ERROR': 'Check broker API credentials and connection settings',
      'DATABASE_ERROR': 'Review database connection pool and query optimization',
      'NETWORK_ERROR': 'Implement retry logic and check network connectivity',
      'AUTHENTICATION': 'Review token expiration and refresh mechanisms',
      'VALIDATION_ERROR': 'Add client-side validation and improve error messages'
    };

    return fixes[errorType] || 'Review error logs and implement appropriate error handling';
  }

  private identifyPrimaryCause(errors: any[]): string {
    const errorCounts = errors.reduce((acc, error) => {
      acc[error.errorType] = (acc[error.errorType] || 0) + 1;
      return acc;
    }, {});

    return Object.keys(errorCounts).reduce((a, b) => 
      errorCounts[a] > errorCounts[b] ? a : b
    );
  }

  private identifyCriticalIssues(analytics: any, patterns: any): any[] {
    const issues = [];

    // High error rate
    if (analytics.totalErrors > 100) {
      issues.push({
        title: 'High Error Rate Detected',
        description: `System generated ${analytics.totalErrors} errors in the analyzed period`,
        impact: 'Significant impact on user experience and system reliability',
        recommendedActions: [
          'Review error logs for common patterns',
          'Implement additional error handling',
          'Consider scaling infrastructure'
        ],
        priority: 'high' as const
      });
    }

    // Critical errors
    if (analytics.criticalErrors > 10) {
      issues.push({
        title: 'Critical Errors Present',
        description: `${analytics.criticalErrors} critical errors detected`,
        impact: 'System stability and data integrity at risk',
        recommendedActions: [
          'Immediate investigation required',
          'Review system logs',
          'Consider emergency maintenance'
        ],
        priority: 'critical' as const
      });
    }

    // Recurring patterns
    if (patterns.recurringErrors.length > 5) {
      issues.push({
        title: 'Multiple Recurring Error Patterns',
        description: `${patterns.recurringErrors.length} recurring error patterns identified`,
        impact: 'Indicates systematic issues requiring attention',
        recommendedActions: [
          'Prioritize fixing recurring errors',
          'Implement preventive measures',
          'Review code quality'
        ],
        priority: 'medium' as const
      });
    }

    return issues;
  }

  private analyzePerformanceImpacts(analytics: any): Array<{
    component: string;
    avgErrorRate: number;
    impactOnUserExperience: string;
    optimizationSuggestions: string[];
  }> {
    const impacts: Array<{
      component: string;
      avgErrorRate: number;
      impactOnUserExperience: string;
      optimizationSuggestions: string[];
    }> = [];

    Object.entries(analytics.errorsByComponent).forEach(([component, count]) => {
      const errorCount = count as number;
      if (errorCount > 20) {
        impacts.push({
          component,
          avgErrorRate: errorCount,
          impactOnUserExperience: this.getUXImpact(component, errorCount),
          optimizationSuggestions: this.getOptimizationSuggestions(component)
        });
      }
    });

    return impacts;
  }

  private getUXImpact(component: string, errorCount: number): string {
    if (component.toLowerCase().includes('broker') || component.toLowerCase().includes('trading')) {
      return errorCount > 50 ? 'Severe impact on trading operations' : 'Moderate impact on trading reliability';
    }
    if (component.toLowerCase().includes('auth')) {
      return 'Impact on user login and session management';
    }
    return errorCount > 30 ? 'Significant user experience degradation' : 'Minor user experience impact';
  }

  private getOptimizationSuggestions(component: string): string[] {
    const suggestions = [];
    
    if (component.toLowerCase().includes('broker')) {
      suggestions.push('Implement circuit breaker pattern', 'Add retry logic with exponential backoff');
    }
    if (component.toLowerCase().includes('database')) {
      suggestions.push('Optimize database queries', 'Review connection pooling');
    }
    if (component.toLowerCase().includes('api')) {
      suggestions.push('Add request caching', 'Implement rate limiting');
    }
    
    suggestions.push('Add comprehensive error handling', 'Implement monitoring and alerting');
    return suggestions;
  }

  private calculateSystemHealthScore(analytics: any): any {
    const totalErrors = analytics.totalErrors;
    const criticalErrors = analytics.criticalErrors;
    
    // Base score calculation (0-100)
    let overallScore = Math.max(0, 100 - (totalErrors * 0.5) - (criticalErrors * 2));
    
    const breakdown = {
      trading: this.calculateCategoryScore(analytics.errorsByCategory?.TRADING || 0),
      authentication: this.calculateCategoryScore(analytics.errorsByCategory?.AUTHENTICATION || 0),
      data: this.calculateCategoryScore(analytics.errorsByCategory?.DATA || 0),
      network: this.calculateCategoryScore(analytics.errorsByCategory?.NETWORK || 0),
      ui: this.calculateCategoryScore(analytics.errorsByCategory?.USER_INTERFACE || 0)
    };

    return {
      overall: Math.round(overallScore),
      breakdown
    };
  }

  private calculateCategoryScore(errorCount: number): number {
    return Math.max(0, Math.round(100 - (errorCount * 2)));
  }

  private generateDailyTrends(dailyData: any[]): number[] {
    const trends = new Array(30).fill(0);
    const today = new Date();
    
    dailyData.forEach(item => {
      const date = new Date(item._id);
      const daysDiff = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff < 30) {
        trends[29 - daysDiff] = item.count;
      }
    });

    return trends;
  }

  private generateWeeklyTrends(weeklyData: any[]): number[] {
    const trends = new Array(12).fill(0);
    
    weeklyData.forEach((item, index) => {
      if (index < 12) {
        trends[index] = item.count;
      }
    });

    return trends;
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
   * Classify error using the enhanced error classification service
   */
  private classifyError(error: any, errorType?: string, context?: any): ErrorClassification {
    // Use the enhanced error classification service
    const enhancedError = this.errorClassificationService.classifyError(error, context);
    return enhancedError.classification;
  }

  /**
   * Categorize errors by business domain
   */
  public categorizeError(error: any, context: any): {
    category: string;
    subcategory: string;
    businessImpact: 'low' | 'medium' | 'high' | 'critical';
    affectedFeatures: string[];
  } {
    const component = context.component?.toLowerCase() || '';
    const operation = context.operation?.toLowerCase() || '';
    const brokerName = context.brokerName?.toLowerCase() || '';

    // Trading-related errors
    if (component.includes('broker') || component.includes('order') || component.includes('trading')) {
      return {
        category: 'TRADING',
        subcategory: this.getTradingSubcategory(operation, error),
        businessImpact: this.getTradingBusinessImpact(error, context),
        affectedFeatures: this.getTradingAffectedFeatures(component, operation)
      };
    }

    // Authentication and authorization errors
    if (component.includes('auth') || operation.includes('login') || operation.includes('auth')) {
      return {
        category: 'AUTHENTICATION',
        subcategory: this.getAuthSubcategory(operation, error),
        businessImpact: 'high',
        affectedFeatures: ['User Login', 'Session Management', 'API Access']
      };
    }

    // Data and database errors
    if (component.includes('database') || component.includes('data') || operation.includes('query')) {
      return {
        category: 'DATA',
        subcategory: this.getDataSubcategory(operation, error),
        businessImpact: this.getDataBusinessImpact(error, context),
        affectedFeatures: this.getDataAffectedFeatures(component, operation)
      };
    }

    // API and network errors
    if (component.includes('api') || component.includes('network') || error?.code?.startsWith('E')) {
      return {
        category: 'NETWORK',
        subcategory: this.getNetworkSubcategory(error),
        businessImpact: 'medium',
        affectedFeatures: ['API Communication', 'External Services', 'Real-time Data']
      };
    }

    // UI and frontend errors
    if (context.source === 'UI' || component.includes('ui') || component.includes('frontend')) {
      return {
        category: 'USER_INTERFACE',
        subcategory: this.getUISubcategory(operation, error),
        businessImpact: 'low',
        affectedFeatures: ['User Experience', 'Frontend Components']
      };
    }

    // Default system category
    return {
      category: 'SYSTEM',
      subcategory: 'GENERAL',
      businessImpact: 'medium',
      affectedFeatures: ['System Stability']
    };
  }

  private getTradingSubcategory(operation: string, error: any): string {
    if (operation.includes('place') || operation.includes('order')) return 'ORDER_PLACEMENT';
    if (operation.includes('cancel')) return 'ORDER_CANCELLATION';
    if (operation.includes('modify')) return 'ORDER_MODIFICATION';
    if (operation.includes('portfolio') || operation.includes('position')) return 'PORTFOLIO_MANAGEMENT';
    if (operation.includes('market') || operation.includes('data')) return 'MARKET_DATA';
    return 'GENERAL_TRADING';
  }

  private getTradingBusinessImpact(error: any, context: any): 'low' | 'medium' | 'high' | 'critical' {
    const message = error?.message?.toLowerCase() || '';
    if (message.includes('insufficient') || message.includes('funds')) return 'medium';
    if (message.includes('market') && message.includes('closed')) return 'low';
    if (message.includes('connection') || message.includes('timeout')) return 'high';
    if (context.operation?.includes('place') || context.operation?.includes('order')) return 'high';
    return 'medium';
  }

  private getTradingAffectedFeatures(component: string, operation: string): string[] {
    const features = ['Trading Operations'];
    if (component.includes('broker')) features.push('Broker Integration');
    if (operation.includes('order')) features.push('Order Management');
    if (operation.includes('portfolio')) features.push('Portfolio Tracking');
    return features;
  }

  private getAuthSubcategory(operation: string, error: any): string {
    if (operation.includes('login')) return 'LOGIN';
    if (operation.includes('logout')) return 'LOGOUT';
    if (operation.includes('token') || operation.includes('refresh')) return 'TOKEN_MANAGEMENT';
    if (operation.includes('session')) return 'SESSION_MANAGEMENT';
    return 'GENERAL_AUTH';
  }

  private getDataSubcategory(operation: string, error: any): string {
    if (operation.includes('query') || operation.includes('find')) return 'DATA_RETRIEVAL';
    if (operation.includes('save') || operation.includes('create')) return 'DATA_CREATION';
    if (operation.includes('update') || operation.includes('modify')) return 'DATA_MODIFICATION';
    if (operation.includes('delete') || operation.includes('remove')) return 'DATA_DELETION';
    if (operation.includes('connection')) return 'DATABASE_CONNECTION';
    return 'GENERAL_DATA';
  }

  private getDataBusinessImpact(error: any, context: any): 'low' | 'medium' | 'high' | 'critical' {
    const message = error?.message?.toLowerCase() || '';
    if (message.includes('connection') || message.includes('timeout')) return 'critical';
    if (message.includes('duplicate') || message.includes('constraint')) return 'medium';
    if (context.operation?.includes('critical') || context.operation?.includes('order')) return 'high';
    return 'medium';
  }

  private getDataAffectedFeatures(component: string, operation: string): string[] {
    const features = ['Data Management'];
    if (component.includes('symbol')) features.push('Symbol Management');
    if (component.includes('user')) features.push('User Management');
    if (component.includes('order')) features.push('Order Data');
    if (component.includes('portfolio')) features.push('Portfolio Data');
    return features;
  }

  private getNetworkSubcategory(error: any): string {
    const code = error?.code || '';
    const message = error?.message?.toLowerCase() || '';
    
    if (code === 'ECONNREFUSED' || message.includes('connection refused')) return 'CONNECTION_REFUSED';
    if (code === 'ETIMEDOUT' || message.includes('timeout')) return 'TIMEOUT';
    if (code === 'ENOTFOUND' || message.includes('not found')) return 'DNS_RESOLUTION';
    if (message.includes('rate limit')) return 'RATE_LIMITING';
    return 'GENERAL_NETWORK';
  }

  private getUISubcategory(operation: string, error: any): string {
    if (operation.includes('render') || operation.includes('component')) return 'COMPONENT_RENDERING';
    if (operation.includes('navigation') || operation.includes('route')) return 'NAVIGATION';
    if (operation.includes('form') || operation.includes('input')) return 'FORM_HANDLING';
    if (operation.includes('api') || operation.includes('request')) return 'API_INTEGRATION';
    return 'GENERAL_UI';
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