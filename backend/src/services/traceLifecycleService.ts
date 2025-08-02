import { TraceLifecycle, ITraceLifecycle } from '../models/errorLogModels';
import { logger } from '../utils/logger';

export interface TraceSearchFilters {
  traceId?: string;
  status?: ('SUCCESS' | 'ERROR' | 'PENDING')[];
  startDate?: Date;
  endDate?: Date;
  minDuration?: number;
  maxDuration?: number;
  hasErrors?: boolean;
  limit?: number;
  offset?: number;
}

export interface TraceAnalytics {
  totalTraces: number;
  successfulTraces: number;
  errorTraces: number;
  pendingTraces: number;
  averageDuration: number;
  tracesByStatus: Record<string, number>;
  tracesByTimeRange: Array<{ timestamp: Date; count: number }>;
  slowestTraces: Array<{
    traceId: string;
    duration: number;
    errorCount: number;
    operations: number;
  }>;
  errorProneOperations: Array<{
    operation: string;
    component: string;
    errorRate: number;
    totalOccurrences: number;
  }>;
}

export class TraceLifecycleService {
  private static instance: TraceLifecycleService;

  private constructor() {}

  public static getInstance(): TraceLifecycleService {
    if (!TraceLifecycleService.instance) {
      TraceLifecycleService.instance = new TraceLifecycleService();
    }
    return TraceLifecycleService.instance;
  }

  /**
   * Get trace lifecycle by ID
   */
  public async getTraceById(traceId: string): Promise<ITraceLifecycle | null> {
    try {
      const trace = await TraceLifecycle.findOne({ traceId }).lean();
      return trace as ITraceLifecycle | null;
    } catch (error) {
      logger.error('Failed to get trace by ID', {
        component: 'TRACE_LIFECYCLE_SERVICE',
        operation: 'GET_TRACE_BY_ID',
        traceId
      }, error);
      return null;
    }
  }

  /**
   * Search trace lifecycles with filters
   */
  public async searchTraces(filters: TraceSearchFilters): Promise<{
    traces: ITraceLifecycle[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const query: any = {};

      // Apply filters
      if (filters.traceId) {
        query.traceId = filters.traceId;
      }

      if (filters.status && filters.status.length > 0) {
        query.status = { $in: filters.status };
      }

      if (filters.startDate || filters.endDate) {
        query.startTime = {};
        if (filters.startDate) {
          query.startTime.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.startTime.$lte = filters.endDate;
        }
      }

      if (filters.minDuration !== undefined || filters.maxDuration !== undefined) {
        query.duration = {};
        if (filters.minDuration !== undefined) {
          query.duration.$gte = filters.minDuration;
        }
        if (filters.maxDuration !== undefined) {
          query.duration.$lte = filters.maxDuration;
        }
      }

      if (filters.hasErrors !== undefined) {
        if (filters.hasErrors) {
          query.errorCount = { $gt: 0 };
        } else {
          query.errorCount = 0;
        }
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      // Get total count
      const total = await TraceLifecycle.countDocuments(query);

      // Get paginated results
      const traces = await TraceLifecycle.find(query)
        .sort({ startTime: -1 })
        .skip(offset)
        .limit(limit)
        .lean();

      return {
        traces: traces as ITraceLifecycle[],
        total,
        hasMore: offset + traces.length < total
      };
    } catch (error) {
      logger.error('Failed to search traces', {
        component: 'TRACE_LIFECYCLE_SERVICE',
        operation: 'SEARCH_TRACES'
      }, error);

      return {
        traces: [],
        total: 0,
        hasMore: false
      };
    }
  }

  /**
   * Get trace analytics
   */
  public async getTraceAnalytics(timeWindow: number = 86400000): Promise<TraceAnalytics> {
    const cutoff = new Date(Date.now() - timeWindow);

    try {
      const [
        totalStats,
        tracesByStatus,
        hourlyTrends,
        slowestTraces,
        errorProneOperations
      ] = await Promise.all([
        // Total trace statistics
        TraceLifecycle.aggregate([
          { $match: { startTime: { $gte: cutoff } } },
          {
            $group: {
              _id: null,
              totalTraces: { $sum: 1 },
              successfulTraces: {
                $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] }
              },
              errorTraces: {
                $sum: { $cond: [{ $eq: ['$status', 'ERROR'] }, 1, 0] }
              },
              pendingTraces: {
                $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
              },
              averageDuration: { $avg: '$duration' }
            }
          }
        ]),

        // Traces by status
        TraceLifecycle.aggregate([
          { $match: { startTime: { $gte: cutoff } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),

        // Hourly trace trends
        TraceLifecycle.aggregate([
          { $match: { startTime: { $gte: cutoff } } },
          {
            $group: {
              _id: {
                hour: { $hour: '$startTime' },
                date: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } }
              },
              count: { $sum: 1 }
            }
          },
          { $sort: { '_id.date': 1, '_id.hour': 1 } }
        ]),

        // Slowest traces
        TraceLifecycle.aggregate([
          { $match: { startTime: { $gte: cutoff }, duration: { $exists: true } } },
          {
            $project: {
              traceId: 1,
              duration: 1,
              errorCount: 1,
              operations: { $size: '$operations' }
            }
          },
          { $sort: { duration: -1 } },
          { $limit: 10 }
        ]),

        // Error-prone operations
        TraceLifecycle.aggregate([
          { $match: { startTime: { $gte: cutoff } } },
          { $unwind: '$operations' },
          {
            $group: {
              _id: {
                operation: '$operations.operation',
                component: '$operations.component'
              },
              totalOccurrences: { $sum: 1 },
              errorOccurrences: {
                $sum: { $cond: [{ $eq: ['$operations.status', 'ERROR'] }, 1, 0] }
              }
            }
          },
          {
            $addFields: {
              errorRate: {
                $cond: [
                  { $eq: ['$totalOccurrences', 0] },
                  0,
                  { $divide: ['$errorOccurrences', '$totalOccurrences'] }
                ]
              }
            }
          },
          { $match: { errorRate: { $gt: 0 } } },
          { $sort: { errorRate: -1 } },
          { $limit: 10 }
        ])
      ]);

      const stats = totalStats[0] || {
        totalTraces: 0,
        successfulTraces: 0,
        errorTraces: 0,
        pendingTraces: 0,
        averageDuration: 0
      };

      return {
        totalTraces: stats.totalTraces,
        successfulTraces: stats.successfulTraces,
        errorTraces: stats.errorTraces,
        pendingTraces: stats.pendingTraces,
        averageDuration: stats.averageDuration || 0,
        tracesByStatus: tracesByStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        tracesByTimeRange: hourlyTrends.map(item => ({
          timestamp: new Date(`${item._id.date}T${item._id.hour.toString().padStart(2, '0')}:00:00`),
          count: item.count
        })),
        slowestTraces: slowestTraces.map(item => ({
          traceId: item.traceId,
          duration: item.duration,
          errorCount: item.errorCount,
          operations: item.operations
        })),
        errorProneOperations: errorProneOperations.map(item => ({
          operation: item._id.operation,
          component: item._id.component,
          errorRate: item.errorRate,
          totalOccurrences: item.totalOccurrences
        }))
      };
    } catch (error) {
      logger.error('Failed to get trace analytics', {
        component: 'TRACE_LIFECYCLE_SERVICE',
        operation: 'GET_TRACE_ANALYTICS'
      }, error);

      return {
        totalTraces: 0,
        successfulTraces: 0,
        errorTraces: 0,
        pendingTraces: 0,
        averageDuration: 0,
        tracesByStatus: {},
        tracesByTimeRange: [],
        slowestTraces: [],
        errorProneOperations: []
      };
    }
  }

  /**
   * Get traces by status
   */
  public async getTracesByStatus(
    status: 'SUCCESS' | 'ERROR' | 'PENDING',
    timeWindow: number = 86400000,
    limit: number = 100
  ): Promise<ITraceLifecycle[]> {
    try {
      const cutoff = new Date(Date.now() - timeWindow);
      const traces = await TraceLifecycle.find({
        status,
        startTime: { $gte: cutoff }
      })
        .sort({ startTime: -1 })
        .limit(limit)
        .lean();
      return traces as ITraceLifecycle[];
    } catch (error) {
      logger.error('Failed to get traces by status', {
        component: 'TRACE_LIFECYCLE_SERVICE',
        operation: 'GET_TRACES_BY_STATUS',
        status
      }, error);
      return [];
    }
  }

  /**
   * Get recent traces
   */
  public async getRecentTraces(limit: number = 50): Promise<ITraceLifecycle[]> {
    try {
      const traces = await TraceLifecycle.find({})
        .sort({ startTime: -1 })
        .limit(limit)
        .lean();
      return traces as ITraceLifecycle[];
    } catch (error) {
      logger.error('Failed to get recent traces', {
        component: 'TRACE_LIFECYCLE_SERVICE',
        operation: 'GET_RECENT_TRACES'
      }, error);
      return [];
    }
  }

  /**
   * Get trace count by filters
   */
  public async getTraceCount(filters: Partial<TraceSearchFilters>): Promise<number> {
    try {
      const query: any = {};

      if (filters.status && filters.status.length > 0) {
        query.status = { $in: filters.status };
      }

      if (filters.startDate || filters.endDate) {
        query.startTime = {};
        if (filters.startDate) {
          query.startTime.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.startTime.$lte = filters.endDate;
        }
      }

      if (filters.minDuration !== undefined || filters.maxDuration !== undefined) {
        query.duration = {};
        if (filters.minDuration !== undefined) {
          query.duration.$gte = filters.minDuration;
        }
        if (filters.maxDuration !== undefined) {
          query.duration.$lte = filters.maxDuration;
        }
      }

      if (filters.hasErrors !== undefined) {
        if (filters.hasErrors) {
          query.errorCount = { $gt: 0 };
        } else {
          query.errorCount = 0;
        }
      }

      return await TraceLifecycle.countDocuments(query);
    } catch (error) {
      logger.error('Failed to get trace count', {
        component: 'TRACE_LIFECYCLE_SERVICE',
        operation: 'GET_TRACE_COUNT'
      }, error);
      return 0;
    }
  }

  /**
   * Update trace status
   */
  public async updateTraceStatus(
    traceId: string,
    status: 'SUCCESS' | 'ERROR' | 'PENDING',
    endTime?: Date,
    duration?: number
  ): Promise<boolean> {
    try {
      const updateData: any = { status };
      if (endTime) {
        updateData.endTime = endTime;
      }
      if (duration !== undefined) {
        updateData.duration = duration;
      }

      const result = await TraceLifecycle.updateOne(
        { traceId },
        { $set: updateData }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Failed to update trace status', {
        component: 'TRACE_LIFECYCLE_SERVICE',
        operation: 'UPDATE_TRACE_STATUS',
        traceId
      }, error);
      return false;
    }
  }

  /**
   * Delete trace by ID (hard delete)
   */
  public async deleteTrace(traceId: string): Promise<boolean> {
    try {
      const result = await TraceLifecycle.deleteOne({ traceId });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Failed to delete trace', {
        component: 'TRACE_LIFECYCLE_SERVICE',
        operation: 'DELETE_TRACE',
        traceId
      }, error);
      return false;
    }
  }

  /**
   * Get trace aggregation by time range
   */
  public async getTraceAggregationByTimeRange(
    startDate: Date,
    endDate: Date,
    groupBy: 'hour' | 'day' | 'week' = 'day'
  ): Promise<Array<{ timestamp: Date; count: number; status: Record<string, number> }>> {
    try {
      let groupExpression: any;
      
      switch (groupBy) {
        case 'hour':
          groupExpression = {
            year: { $year: '$startTime' },
            month: { $month: '$startTime' },
            day: { $dayOfMonth: '$startTime' },
            hour: { $hour: '$startTime' }
          };
          break;
        case 'week':
          groupExpression = {
            year: { $year: '$startTime' },
            week: { $week: '$startTime' }
          };
          break;
        default: // day
          groupExpression = {
            year: { $year: '$startTime' },
            month: { $month: '$startTime' },
            day: { $dayOfMonth: '$startTime' }
          };
      }

      const results = await TraceLifecycle.aggregate([
        {
          $match: {
            startTime: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: groupExpression,
            count: { $sum: 1 },
            statuses: {
              $push: '$status'
            }
          }
        },
        {
          $addFields: {
            statusCounts: {
              SUCCESS: { $size: { $filter: { input: '$statuses', cond: { $eq: ['$$this', 'SUCCESS'] } } } },
              ERROR: { $size: { $filter: { input: '$statuses', cond: { $eq: ['$$this', 'ERROR'] } } } },
              PENDING: { $size: { $filter: { input: '$statuses', cond: { $eq: ['$$this', 'PENDING'] } } } }
            }
          }
        },
        {
          $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1, '_id.week': 1 }
        }
      ]);

      return results.map(item => ({
        timestamp: this.constructDateFromGroup(item._id, groupBy),
        count: item.count,
        status: item.statusCounts || {}
      }));
    } catch (error) {
      logger.error('Failed to get trace aggregation by time range', {
        component: 'TRACE_LIFECYCLE_SERVICE',
        operation: 'GET_TRACE_AGGREGATION_BY_TIME_RANGE'
      }, error);
      return [];
    }
  }

  /**
   * Construct date from aggregation group
   */
  private constructDateFromGroup(group: any, groupBy: 'hour' | 'day' | 'week'): Date {
    switch (groupBy) {
      case 'hour':
        return new Date(group.year, group.month - 1, group.day, group.hour);
      case 'week':
        // Approximate week start date
        const jan1 = new Date(group.year, 0, 1);
        const weekStart = new Date(jan1.getTime() + (group.week - 1) * 7 * 24 * 60 * 60 * 1000);
        return weekStart;
      default: // day
        return new Date(group.year, group.month - 1, group.day);
    }
  }
}

// Export singleton instance
export const traceLifecycleService = TraceLifecycleService.getInstance();
export default traceLifecycleService;