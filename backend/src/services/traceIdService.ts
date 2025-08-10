import { v4 as uuidv4 } from 'uuid';
import { TraceLifecycle, ITraceLifecycle } from '../models/errorLogModels';
import { logger } from '../utils/logger';

export interface TraceContext {
  traceId: string;
  parentSpanId?: string;
  spanId: string;
  startTime: Date;
  operations: Array<{
    operation: string;
    component: string;
    startTime: Date;
    endTime?: Date;
    status: 'SUCCESS' | 'ERROR' | 'PENDING';
    metadata?: any;
  }>;
}

export interface TraceOperation {
  operation: string;
  component: string;
  startTime: Date;
  endTime?: Date;
  status: 'SUCCESS' | 'ERROR' | 'PENDING';
  metadata?: any;
}

export class TraceIdService {
  private static instance: TraceIdService;
  private activeTraces: Map<string, TraceContext> = new Map();
  private readonly TRACE_CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly TRACE_MAX_AGE = 300000; // 5 minutes

  constructor() {
    // Start cleanup interval
    setInterval(() => {
      this.cleanupOldTraces();
    }, this.TRACE_CLEANUP_INTERVAL);
  }

  public static getInstance(): TraceIdService {
    if (!TraceIdService.instance) {
      TraceIdService.instance = new TraceIdService();
    }
    return TraceIdService.instance;
  }

  /**
   * Generate a unique trace ID
   */
  public generateTraceId(): string {
    return `trace_${uuidv4().replace(/-/g, '')}`;
  }

  /**
   * Generate a unique span ID
   */
  public generateSpanId(): string {
    return `span_${uuidv4().substring(0, 8)}`;
  }

  /**
   * Create a new trace context
   */
  public async createTraceContext(traceId?: string): Promise<TraceContext> {
    const id = traceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const startTime = new Date();

    const context: TraceContext = {
      traceId: id,
      spanId,
      startTime,
      operations: []
    };

    // Store in memory for quick access
    this.activeTraces.set(id, context);

    // Create database record
    try {
      await TraceLifecycle.create({
        traceId: id,
        startTime,
        status: 'PENDING',
        operations: [],
        errorCount: 0,
        warningCount: 0
      });

      logger.debug('Created new trace context', {
        component: 'TRACE_SERVICE',
        operation: 'CREATE_TRACE',
        traceId: id,
        spanId
      });
    } catch (error) {
      logger.error('Failed to create trace lifecycle record', {
        component: 'TRACE_SERVICE',
        operation: 'CREATE_TRACE',
        traceId: id
      }, error);
    }

    return context;
  }

  /**
   * Get existing trace context
   */
  public getTraceContext(traceId: string): TraceContext | null {
    return this.activeTraces.get(traceId) || null;
  }

  /**
   * Add an operation to a trace
   */
  public async addOperation(
    traceId: string, 
    operation: string, 
    component: string,
    metadata?: any
  ): Promise<void> {
    const context = this.activeTraces.get(traceId);
    if (!context) {
      logger.warn('Attempted to add operation to non-existent trace', {
        component: 'TRACE_SERVICE',
        operation: 'ADD_OPERATION',
        traceId,
        operationName: operation,
        componentName: component
      });
      return;
    }

    const traceOperation: TraceOperation = {
      operation,
      component,
      startTime: new Date(),
      status: 'PENDING',
      metadata
    };

    context.operations.push(traceOperation);

    // Update database record
    try {
      await TraceLifecycle.updateOne(
        { traceId },
        {
          $push: {
            operations: traceOperation
          }
        }
      );

      logger.debug('Added operation to trace', {
        component: 'TRACE_SERVICE',
        operation: 'ADD_OPERATION',
        traceId,
        operationName: operation,
        componentName: component
      });
    } catch (error) {
      logger.error('Failed to update trace with new operation', {
        component: 'TRACE_SERVICE',
        operation: 'ADD_OPERATION',
        traceId,
        operationName: operation
      }, error);
    }
  }

  /**
   * Complete an operation in a trace
   */
  public async completeOperation(
    traceId: string,
    operation: string,
    status: 'SUCCESS' | 'ERROR',
    metadata?: any
  ): Promise<void> {
    const context = this.activeTraces.get(traceId);
    if (!context) {
      logger.warn('Attempted to complete operation on non-existent trace', {
        component: 'TRACE_SERVICE',
        operation: 'COMPLETE_OPERATION',
        traceId,
        operationName: operation,
        operationStatus: status
      });
      return;
    }

    // Find and update the operation in memory
    const operationIndex = context.operations.findIndex(
      op => op.operation === operation && op.status === 'PENDING'
    );

    if (operationIndex !== -1 && context.operations[operationIndex]) {
      const operation = context.operations[operationIndex];
      operation.endTime = new Date();
      operation.status = status;
      if (metadata) {
        operation.metadata = {
          ...operation.metadata,
          ...metadata
        };
      }
    }

    // Update database record
    try {
      const updateResult = await TraceLifecycle.updateOne(
        { 
          traceId,
          'operations.operation': operation,
          'operations.status': 'PENDING'
        },
        {
          $set: {
            'operations.$.endTime': new Date(),
            'operations.$.status': status,
            ...(metadata && { 'operations.$.metadata': metadata })
          },
          ...(status === 'ERROR' && { $inc: { errorCount: 1 } })
        }
      );

      if (updateResult.modifiedCount === 0) {
        logger.warn('No pending operation found to complete', {
          component: 'TRACE_SERVICE',
          operation: 'COMPLETE_OPERATION',
          traceId,
          operationName: operation
        });
      } else {
        logger.debug('Completed operation in trace', {
          component: 'TRACE_SERVICE',
          operation: 'COMPLETE_OPERATION',
          traceId,
          operationName: operation,
          operationStatus: status
        });
      }
    } catch (error) {
      logger.error('Failed to complete operation in trace', {
        component: 'TRACE_SERVICE',
        operation: 'COMPLETE_OPERATION',
        traceId,
        operationName: operation
      }, error);
    }
  }

  /**
   * Complete a trace
   */
  public async completeTrace(traceId: string, status: 'SUCCESS' | 'ERROR'): Promise<void> {
    const context = this.activeTraces.get(traceId);
    if (!context) {
      logger.warn('Attempted to complete non-existent trace', {
        component: 'TRACE_SERVICE',
        operation: 'COMPLETE_TRACE',
        traceId,
        traceStatus: status
      });
      return;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - context.startTime.getTime();

    // Update database record
    try {
      await TraceLifecycle.updateOne(
        { traceId },
        {
          $set: {
            endTime,
            duration,
            status
          }
        }
      );

      logger.info('Completed trace', {
        component: 'TRACE_SERVICE',
        operation: 'COMPLETE_TRACE',
        traceId,
        traceStatus: status,
        duration
      });
    } catch (error) {
      logger.error('Failed to complete trace', {
        component: 'TRACE_SERVICE',
        operation: 'COMPLETE_TRACE',
        traceId
      }, error);
    }

    // Remove from active traces
    this.activeTraces.delete(traceId);
  }

  /**
   * Get complete trace lifecycle from database
   */
  public async getTraceLifecycle(traceId: string): Promise<ITraceLifecycle | null> {
    try {
      const lifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      return lifecycle;
    } catch (error) {
      logger.error('Failed to retrieve trace lifecycle', {
        component: 'TRACE_SERVICE',
        operation: 'GET_TRACE_LIFECYCLE',
        traceId
      }, error);
      return null;
    }
  }

  /**
   * Get trace statistics
   */
  public async getTraceStatistics(timeWindow: number = 3600000): Promise<{
    totalTraces: number;
    successfulTraces: number;
    errorTraces: number;
    averageDuration: number;
    activeTraces: number;
  }> {
    const cutoff = new Date(Date.now() - timeWindow);

    try {
      const stats = await TraceLifecycle.aggregate([
        {
          $match: {
            startTime: { $gte: cutoff }
          }
        },
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
            averageDuration: { $avg: '$duration' }
          }
        }
      ]);

      const result = stats[0] || {
        totalTraces: 0,
        successfulTraces: 0,
        errorTraces: 0,
        averageDuration: 0
      };

      return {
        ...result,
        activeTraces: this.activeTraces.size
      };
    } catch (error) {
      logger.error('Failed to get trace statistics', {
        component: 'TRACE_SERVICE',
        operation: 'GET_TRACE_STATISTICS'
      }, error);

      return {
        totalTraces: 0,
        successfulTraces: 0,
        errorTraces: 0,
        averageDuration: 0,
        activeTraces: this.activeTraces.size
      };
    }
  }

  /**
   * Clean up old traces from memory
   */
  private cleanupOldTraces(): void {
    const cutoff = Date.now() - this.TRACE_MAX_AGE;
    let cleanedCount = 0;

    for (const [traceId, context] of this.activeTraces.entries()) {
      if (context.startTime.getTime() < cutoff) {
        this.activeTraces.delete(traceId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('Cleaned up old traces from memory', {
        component: 'TRACE_SERVICE',
        operation: 'CLEANUP_TRACES',
        cleanedCount,
        remainingTraces: this.activeTraces.size
      });
    }
  }

  /**
   * Get all active trace IDs
   */
  public getActiveTraceIds(): string[] {
    return Array.from(this.activeTraces.keys());
  }

  /**
   * Force cleanup of a specific trace
   */
  public forceCleanupTrace(traceId: string): void {
    this.activeTraces.delete(traceId);
    logger.debug('Force cleaned up trace', {
      component: 'TRACE_SERVICE',
      operation: 'FORCE_CLEANUP_TRACE',
      traceId
    });
  }
}

// Export singleton instance
export const traceIdService = TraceIdService.getInstance();
export default traceIdService;