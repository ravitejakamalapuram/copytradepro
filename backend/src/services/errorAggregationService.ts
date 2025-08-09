import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';
import { logger } from '../utils/logger';

export interface ErrorAggregationDimensions {
  timeRange: {
    start: Date;
    end: Date;
    granularity: 'hour' | 'day' | 'week' | 'month';
  };
  filters?: {
    level?: string[];
    source?: string[];
    component?: string[];
    errorType?: string[];
    userId?: string;
    traceId?: string;
  };
}

export interface ErrorAggregationResult {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsBySource: Record<string, number>;
  errorsByComponent: Record<string, number>;
  errorsByType: Record<string, number>;
  errorsByTimeRange: Array<{
    timestamp: Date;
    count: number;
    level: Record<string, number>;
  }>;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurred: Date;
    errorType: string;
    component: string;
  }>;
  errorTrends: {
    hourly: number[];
    daily: number[];
    weekly: number[];
  };
}

export interface ErrorPattern {
  id: string;
  pattern: string;
  description: string;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  components: string[];
  errorTypes: string[];
  trend: 'INCREASING' | 'DECREASING' | 'STABLE';
  impactScore: number;
  relatedTraceIds: string[];
}

export interface ErrorImpactAnalysis {
  systemHealthScore: number; // 0-100, higher is better
  userExperienceImpact: {
    affectedUsers: number;
    totalUsers: number;
    impactPercentage: number;
  };
  componentReliability: Record<string, {
    errorRate: number;
    availability: number;
    meanTimeBetweenFailures: number;
  }>;
  criticalErrorsCount: number;
  recoveryTime: {
    average: number;
    median: number;
    p95: number;
  };
  businessImpact: {
    tradingOperationsAffected: number;
    revenueImpact: 'LOW' | 'MEDIUM' | 'HIGH';
    userSatisfactionScore: number;
  };
}

export class ErrorAggregationService {
  /**
   * Aggregate error data by various dimensions
   */
  async aggregateErrors(dimensions: ErrorAggregationDimensions): Promise<ErrorAggregationResult> {
    try {
      const { timeRange, filters } = dimensions;
      
      // Build MongoDB aggregation pipeline
      const matchStage: any = {
        timestamp: {
          $gte: timeRange.start,
          $lte: timeRange.end
        }
      };

      // Apply filters
      if (filters) {
        if (filters.level?.length) matchStage.level = { $in: filters.level };
        if (filters.source?.length) matchStage.source = { $in: filters.source };
        if (filters.component?.length) matchStage.component = { $in: filters.component };
        if (filters.errorType?.length) matchStage.errorType = { $in: filters.errorType };
        if (filters.userId) matchStage['context.userId'] = filters.userId;
        if (filters.traceId) matchStage.traceId = filters.traceId;
      }

      // Execute aggregation queries in parallel
      const [
        totalErrors,
        errorsByLevel,
        errorsBySource,
        errorsByComponent,
        errorsByType,
        errorsByTimeRange,
        topErrors,
        errorTrends
      ] = await Promise.all([
        this.getTotalErrors(matchStage),
        this.getErrorsByDimension(matchStage, 'level'),
        this.getErrorsByDimension(matchStage, 'source'),
        this.getErrorsByDimension(matchStage, 'component'),
        this.getErrorsByDimension(matchStage, 'errorType'),
        this.getErrorsByTimeRange(matchStage, timeRange.granularity),
        this.getTopErrors(matchStage),
        this.getErrorTrends(matchStage, timeRange)
      ]);

      return {
        totalErrors,
        errorsByLevel,
        errorsBySource,
        errorsByComponent,
        errorsByType,
        errorsByTimeRange,
        topErrors,
        errorTrends
      };
    } catch (error) {
      logger.error('Error aggregating error data:', error);
      throw new Error('Failed to aggregate error data');
    }
  }

  /**
   * Detect error patterns and recurring issues
   */
  async detectErrorPatterns(timeRange: { start: Date; end: Date }): Promise<ErrorPattern[]> {
    try {
      const patterns: ErrorPattern[] = [];

      // Pattern 1: Recurring error messages
      const recurringErrors = await this.findRecurringErrors(timeRange);
      patterns.push(...recurringErrors);

      // Pattern 2: Error cascades (multiple errors with same trace ID)
      const cascadePatterns = await this.findErrorCascades(timeRange);
      patterns.push(...cascadePatterns);

      // Pattern 3: Component failure patterns
      const componentPatterns = await this.findComponentFailurePatterns(timeRange);
      patterns.push(...componentPatterns);

      // Pattern 4: Time-based patterns (errors at specific times)
      const timePatterns = await this.findTimeBasedPatterns(timeRange);
      patterns.push(...timePatterns);

      // Pattern 5: User-specific error patterns
      const userPatterns = await this.findUserSpecificPatterns(timeRange);
      patterns.push(...userPatterns);

      // Sort by impact score and return top patterns
      return patterns
        .sort((a, b) => b.impactScore - a.impactScore)
        .slice(0, 50); // Limit to top 50 patterns
    } catch (error) {
      logger.error('Error detecting error patterns:', error);
      throw new Error('Failed to detect error patterns');
    }
  }

  /**
   * Analyze error impact on system health and user experience
   */
  async analyzeErrorImpact(timeRange: { start: Date; end: Date }): Promise<ErrorImpactAnalysis> {
    try {
      const [
        systemHealthScore,
        userExperienceImpact,
        componentReliability,
        criticalErrorsCount,
        recoveryTime,
        businessImpact
      ] = await Promise.all([
        this.calculateSystemHealthScore(timeRange),
        this.calculateUserExperienceImpact(timeRange),
        this.calculateComponentReliability(timeRange),
        this.getCriticalErrorsCount(timeRange),
        this.calculateRecoveryTime(timeRange),
        this.calculateBusinessImpact(timeRange)
      ]);

      return {
        systemHealthScore,
        userExperienceImpact,
        componentReliability,
        criticalErrorsCount,
        recoveryTime,
        businessImpact
      };
    } catch (error) {
      logger.error('Error analyzing error impact:', error);
      throw new Error('Failed to analyze error impact');
    }
  }

  // Private helper methods

  private async getTotalErrors(matchStage: any): Promise<number> {
    const result = await ErrorLog.countDocuments(matchStage);
    return result;
  }

  private async getErrorsByDimension(matchStage: any, dimension: string): Promise<Record<string, number>> {
    const result = await ErrorLog.aggregate([
      { $match: matchStage },
      { $group: { _id: `$${dimension}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    return result.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  private async getErrorsByTimeRange(matchStage: any, granularity: string): Promise<Array<{
    timestamp: Date;
    count: number;
    level: Record<string, number>;
  }>> {
    const dateFormat = this.getDateFormat(granularity);
    
    const result = await ErrorLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$timestamp' } },
            level: '$level'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          totalCount: { $sum: '$count' },
          levels: {
            $push: {
              level: '$_id.level',
              count: '$count'
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return result.map((item: any) => ({
      timestamp: new Date(item._id),
      count: item.totalCount,
      level: item.levels.reduce((acc: any, level: any) => {
        acc[level.level] = level.count;
        return acc;
      }, {})
    }));
  }

  private async getTopErrors(matchStage: any): Promise<Array<{
    message: string;
    count: number;
    lastOccurred: Date;
    errorType: string;
    component: string;
  }>> {
    const result = await ErrorLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            message: '$message',
            errorType: '$errorType',
            component: '$component'
          },
          count: { $sum: 1 },
          lastOccurred: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    return result.map((item: any) => ({
      message: item._id.message,
      count: item.count,
      lastOccurred: item.lastOccurred,
      errorType: item._id.errorType,
      component: item._id.component
    }));
  }

  private async getErrorTrends(matchStage: any, timeRange: { start: Date; end: Date }): Promise<{
    hourly: number[];
    daily: number[];
    weekly: number[];
  }> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [hourly, daily, weekly] = await Promise.all([
      this.getHourlyTrend(oneDayAgo, now),
      this.getDailyTrend(oneWeekAgo, now),
      this.getWeeklyTrend(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now)
    ]);

    return { hourly, daily, weekly };
  }

  private async findRecurringErrors(timeRange: { start: Date; end: Date }): Promise<ErrorPattern[]> {
    const result = await ErrorLog.aggregate([
      {
        $match: {
          timestamp: { $gte: timeRange.start, $lte: timeRange.end }
        }
      },
      {
        $group: {
          _id: {
            message: '$message',
            errorType: '$errorType',
            component: '$component'
          },
          count: { $sum: 1 },
          firstSeen: { $min: '$timestamp' },
          lastSeen: { $max: '$timestamp' },
          traceIds: { $addToSet: '$traceId' },
          components: { $addToSet: '$component' },
          errorTypes: { $addToSet: '$errorType' }
        }
      },
      {
        $match: { count: { $gte: 5 } } // Only patterns with 5+ occurrences
      },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    return result.map((item: any, index: number) => ({
      id: `recurring_${index}`,
      pattern: `Recurring error: ${item._id.message}`,
      description: `Error "${item._id.message}" occurred ${item.count} times in ${item._id.component}`,
      occurrences: item.count,
      firstSeen: item.firstSeen,
      lastSeen: item.lastSeen,
      severity: this.calculateSeverity(item.count, item.lastSeen),
      components: item.components,
      errorTypes: item.errorTypes,
      trend: this.calculateTrend(item.firstSeen, item.lastSeen, item.count),
      impactScore: this.calculateImpactScore(item.count, item.components.length, item.lastSeen),
      relatedTraceIds: item.traceIds.slice(0, 10) // Limit to 10 trace IDs
    }));
  }

  private async findErrorCascades(timeRange: { start: Date; end: Date }): Promise<ErrorPattern[]> {
    const result = await ErrorLog.aggregate([
      {
        $match: {
          timestamp: { $gte: timeRange.start, $lte: timeRange.end }
        }
      },
      {
        $group: {
          _id: '$traceId',
          errorCount: { $sum: 1 },
          components: { $addToSet: '$component' },
          errorTypes: { $addToSet: '$errorType' },
          firstError: { $min: '$timestamp' },
          lastError: { $max: '$timestamp' }
        }
      },
      {
        $match: { errorCount: { $gte: 3 } } // Cascades with 3+ errors
      },
      { $sort: { errorCount: -1 } },
      { $limit: 15 }
    ]);

    return result.map((item: any, index: number) => ({
      id: `cascade_${index}`,
      pattern: `Error cascade in trace ${item._id}`,
      description: `${item.errorCount} errors occurred in single request affecting ${item.components.length} components`,
      occurrences: item.errorCount,
      firstSeen: item.firstError,
      lastSeen: item.lastError,
      severity: 'HIGH' as const,
      components: item.components,
      errorTypes: item.errorTypes,
      trend: 'STABLE' as const,
      impactScore: item.errorCount * item.components.length * 10,
      relatedTraceIds: [item._id]
    }));
  }

  private async findComponentFailurePatterns(timeRange: { start: Date; end: Date }): Promise<ErrorPattern[]> {
    const result = await ErrorLog.aggregate([
      {
        $match: {
          timestamp: { $gte: timeRange.start, $lte: timeRange.end },
          level: 'ERROR'
        }
      },
      {
        $group: {
          _id: '$component',
          errorCount: { $sum: 1 },
          errorTypes: { $addToSet: '$errorType' },
          firstError: { $min: '$timestamp' },
          lastError: { $max: '$timestamp' },
          traceIds: { $addToSet: '$traceId' }
        }
      },
      {
        $match: { errorCount: { $gte: 10 } } // Components with 10+ errors
      },
      { $sort: { errorCount: -1 } },
      { $limit: 10 }
    ]);

    return result.map((item: any, index: number) => ({
      id: `component_${index}`,
      pattern: `High error rate in ${item._id}`,
      description: `Component ${item._id} generated ${item.errorCount} errors`,
      occurrences: item.errorCount,
      firstSeen: item.firstError,
      lastSeen: item.lastError,
      severity: this.calculateSeverity(item.errorCount, item.lastError),
      components: [item._id],
      errorTypes: item.errorTypes,
      trend: this.calculateTrend(item.firstError, item.lastError, item.errorCount),
      impactScore: item.errorCount * 5,
      relatedTraceIds: item.traceIds.slice(0, 10)
    }));
  }

  private async findTimeBasedPatterns(timeRange: { start: Date; end: Date }): Promise<ErrorPattern[]> {
    // Find errors that occur at specific hours of the day
    const result = await ErrorLog.aggregate([
      {
        $match: {
          timestamp: { $gte: timeRange.start, $lte: timeRange.end }
        }
      },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          errorCount: { $sum: 1 },
          components: { $addToSet: '$component' },
          errorTypes: { $addToSet: '$errorType' }
        }
      },
      {
        $match: { errorCount: { $gte: 20 } } // Hours with 20+ errors
      },
      { $sort: { errorCount: -1 } },
      { $limit: 5 }
    ]);

    return result.map((item: any, index: number) => ({
      id: `time_${index}`,
      pattern: `High error rate at hour ${item._id}`,
      description: `${item.errorCount} errors consistently occur around ${item._id}:00`,
      occurrences: item.errorCount,
      firstSeen: timeRange.start,
      lastSeen: timeRange.end,
      severity: 'MEDIUM' as const,
      components: item.components,
      errorTypes: item.errorTypes,
      trend: 'STABLE' as const,
      impactScore: item.errorCount * 2,
      relatedTraceIds: []
    }));
  }

  private async findUserSpecificPatterns(timeRange: { start: Date; end: Date }): Promise<ErrorPattern[]> {
    const result = await ErrorLog.aggregate([
      {
        $match: {
          timestamp: { $gte: timeRange.start, $lte: timeRange.end },
          'context.userId': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$context.userId',
          errorCount: { $sum: 1 },
          components: { $addToSet: '$component' },
          errorTypes: { $addToSet: '$errorType' },
          traceIds: { $addToSet: '$traceId' }
        }
      },
      {
        $match: { errorCount: { $gte: 15 } } // Users with 15+ errors
      },
      { $sort: { errorCount: -1 } },
      { $limit: 10 }
    ]);

    return result.map((item: any, index: number) => ({
      id: `user_${index}`,
      pattern: `High error rate for user ${item._id}`,
      description: `User ${item._id} experienced ${item.errorCount} errors`,
      occurrences: item.errorCount,
      firstSeen: timeRange.start,
      lastSeen: timeRange.end,
      severity: 'MEDIUM' as const,
      components: item.components,
      errorTypes: item.errorTypes,
      trend: 'STABLE' as const,
      impactScore: item.errorCount * 3,
      relatedTraceIds: item.traceIds.slice(0, 10)
    }));
  }

  private async calculateSystemHealthScore(timeRange: { start: Date; end: Date }): Promise<number> {
    const totalRequests = await TraceLifecycle.countDocuments({
      startTime: { $gte: timeRange.start, $lte: timeRange.end }
    });

    const errorRequests = await TraceLifecycle.countDocuments({
      startTime: { $gte: timeRange.start, $lte: timeRange.end },
      status: 'ERROR'
    });

    if (totalRequests === 0) return 100;

    const errorRate = errorRequests / totalRequests;
    const healthScore = Math.max(0, Math.min(100, (1 - errorRate) * 100));
    
    return Math.round(healthScore * 100) / 100;
  }

  private async calculateUserExperienceImpact(timeRange: { start: Date; end: Date }): Promise<{
    affectedUsers: number;
    totalUsers: number;
    impactPercentage: number;
  }> {
    const [affectedUsers, totalUsers] = await Promise.all([
      ErrorLog.distinct('context.userId', {
        timestamp: { $gte: timeRange.start, $lte: timeRange.end },
        'context.userId': { $exists: true, $ne: null }
      }),
      TraceLifecycle.distinct('operations.metadata.userId', {
        startTime: { $gte: timeRange.start, $lte: timeRange.end },
        'operations.metadata.userId': { $exists: true, $ne: null }
      })
    ]);

    const impactPercentage = totalUsers.length > 0 ? (affectedUsers.length / totalUsers.length) * 100 : 0;

    return {
      affectedUsers: affectedUsers.length,
      totalUsers: totalUsers.length,
      impactPercentage: Math.round(impactPercentage * 100) / 100
    };
  }

  private async calculateComponentReliability(timeRange: { start: Date; end: Date }): Promise<Record<string, {
    errorRate: number;
    availability: number;
    meanTimeBetweenFailures: number;
  }>> {
    const components = await ErrorLog.distinct('component', {
      timestamp: { $gte: timeRange.start, $lte: timeRange.end }
    });

    const reliability: Record<string, any> = {};

    for (const component of components) {
      const [totalOperations, errorOperations, failures] = await Promise.all([
        TraceLifecycle.countDocuments({
          startTime: { $gte: timeRange.start, $lte: timeRange.end },
          'operations.component': component
        }),
        ErrorLog.countDocuments({
          timestamp: { $gte: timeRange.start, $lte: timeRange.end },
          component: component
        }),
        ErrorLog.find({
          timestamp: { $gte: timeRange.start, $lte: timeRange.end },
          component: component,
          level: 'ERROR'
        }).sort({ timestamp: 1 }).select('timestamp')
      ]);

      const errorRate = totalOperations > 0 ? (errorOperations / totalOperations) * 100 : 0;
      const availability = Math.max(0, 100 - errorRate);
      
      let meanTimeBetweenFailures = 0;
      if (failures.length > 1) {
        const lastFailure = failures[failures.length - 1];
        const firstFailure = failures[0];
        if (lastFailure?.timestamp && firstFailure?.timestamp) {
          const totalTime = lastFailure.timestamp.getTime() - firstFailure.timestamp.getTime();
          meanTimeBetweenFailures = totalTime / (failures.length - 1);
        }
      }

      reliability[component] = {
        errorRate: Math.round(errorRate * 100) / 100,
        availability: Math.round(availability * 100) / 100,
        meanTimeBetweenFailures: Math.round(meanTimeBetweenFailures / 1000) // Convert to seconds
      };
    }

    return reliability;
  }

  private async getCriticalErrorsCount(timeRange: { start: Date; end: Date }): Promise<number> {
    return await ErrorLog.countDocuments({
      timestamp: { $gte: timeRange.start, $lte: timeRange.end },
      level: 'ERROR',
      $or: [
        { errorType: { $in: ['SYSTEM_FAILURE', 'DATABASE_CONNECTION', 'AUTHENTICATION_FAILURE'] } },
        { component: { $in: ['BROKER_CONTROLLER', 'AUTH_CONTROLLER'] } }
      ]
    });
  }

  private async calculateRecoveryTime(timeRange: { start: Date; end: Date }): Promise<{
    average: number;
    median: number;
    p95: number;
  }> {
    const traces = await TraceLifecycle.find({
      startTime: { $gte: timeRange.start, $lte: timeRange.end },
      status: 'ERROR',
      endTime: { $exists: true }
    }).select('startTime endTime duration');

    if (traces.length === 0) {
      return { average: 0, median: 0, p95: 0 };
    }

    const durations = traces.map((trace: any) => trace.duration || 0).sort((a: number, b: number) => a - b);
    const average = durations.reduce((sum: number, duration: number) => sum + duration, 0) / durations.length;
    const median = durations[Math.floor(durations.length / 2)];
    const p95Index = Math.floor(durations.length * 0.95);
    const p95 = durations[p95Index];

    return {
      average: Math.round(average),
      median: Math.round(median),
      p95: Math.round(p95)
    };
  }

  private async calculateBusinessImpact(timeRange: { start: Date; end: Date }): Promise<{
    tradingOperationsAffected: number;
    revenueImpact: 'LOW' | 'MEDIUM' | 'HIGH';
    userSatisfactionScore: number;
  }> {
    const tradingErrors = await ErrorLog.countDocuments({
      timestamp: { $gte: timeRange.start, $lte: timeRange.end },
      $or: [
        { component: { $in: ['BROKER_CONTROLLER', 'ORDER_CONTROLLER'] } },
        { errorType: { $in: ['BROKER_API_ERROR', 'ORDER_PLACEMENT_ERROR'] } }
      ]
    });

    const totalErrors = await ErrorLog.countDocuments({
      timestamp: { $gte: timeRange.start, $lte: timeRange.end }
    });

    const tradingImpactRatio = totalErrors > 0 ? tradingErrors / totalErrors : 0;
    
    let revenueImpact: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (tradingImpactRatio > 0.3) revenueImpact = 'HIGH';
    else if (tradingImpactRatio > 0.1) revenueImpact = 'MEDIUM';

    // Calculate user satisfaction score based on error frequency
    const userSatisfactionScore = Math.max(0, Math.min(100, 100 - (tradingImpactRatio * 100)));

    return {
      tradingOperationsAffected: tradingErrors,
      revenueImpact,
      userSatisfactionScore: Math.round(userSatisfactionScore * 100) / 100
    };
  }

  // Utility methods

  private getDateFormat(granularity: string): string {
    switch (granularity) {
      case 'hour': return '%Y-%m-%d %H:00:00';
      case 'day': return '%Y-%m-%d';
      case 'week': return '%Y-%U'; // Year-Week
      case 'month': return '%Y-%m';
      default: return '%Y-%m-%d';
    }
  }

  private async getHourlyTrend(start: Date, end: Date): Promise<number[]> {
    const result = await ErrorLog.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          count: { $sum: 1 }
        }
      }
    ]);

    const hourlyData = new Array(24).fill(0);
    result.forEach((item: any) => {
      hourlyData[item._id] = item.count;
    });

    return hourlyData;
  }

  private async getDailyTrend(start: Date, end: Date): Promise<number[]> {
    const result = await ErrorLog.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return result.map((item: any) => item.count);
  }

  private async getWeeklyTrend(start: Date, end: Date): Promise<number[]> {
    const result = await ErrorLog.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: { $week: '$timestamp' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return result.map((item: any) => item.count);
  }

  private calculateSeverity(count: number, lastOccurred: Date): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const hoursSinceLastError = (Date.now() - lastOccurred.getTime()) / (1000 * 60 * 60);
    
    if (count > 100 && hoursSinceLastError < 1) return 'CRITICAL';
    if (count > 50 && hoursSinceLastError < 6) return 'HIGH';
    if (count > 20 && hoursSinceLastError < 24) return 'MEDIUM';
    return 'LOW';
  }

  private calculateTrend(firstSeen: Date, lastSeen: Date, count: number): 'INCREASING' | 'DECREASING' | 'STABLE' {
    const timeSpan = lastSeen.getTime() - firstSeen.getTime();
    const rate = count / (timeSpan / (1000 * 60 * 60)); // Errors per hour

    if (rate > 5) return 'INCREASING';
    if (rate < 1) return 'DECREASING';
    return 'STABLE';
  }

  private calculateImpactScore(count: number, componentCount: number, lastOccurred: Date): number {
    const recencyFactor = Math.max(0.1, 1 - (Date.now() - lastOccurred.getTime()) / (1000 * 60 * 60 * 24)); // Decay over 24 hours
    return Math.round(count * componentCount * recencyFactor);
  }
}

export const errorAggregationService = new ErrorAggregationService();