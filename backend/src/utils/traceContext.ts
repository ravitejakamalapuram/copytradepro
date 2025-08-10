/**
 * Trace context utility for propagating trace IDs across all operations
 */

import { AsyncLocalStorage } from 'async_hooks';
import { traceIdService } from '../services/traceIdService';
import { logger } from './logger';

export interface TraceContextData {
  traceId: string;
  userId?: string | undefined;
  sessionId?: string | undefined;
  requestId?: string | undefined;
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
  brokerName?: string | undefined;
  accountId?: string | undefined;
  operation?: string | undefined;
  component?: string | undefined;
}

// AsyncLocalStorage for maintaining trace context across async operations
const traceStorage = new AsyncLocalStorage<TraceContextData>();

export class TraceContext {
  /**
   * Set trace context for the current execution context
   */
  static setContext(context: TraceContextData): void {
    traceStorage.enterWith(context);
  }

  /**
   * Get current trace context
   */
  static getContext(): TraceContextData | undefined {
    return traceStorage.getStore();
  }

  /**
   * Get current trace ID
   */
  static getTraceId(): string | undefined {
    const context = traceStorage.getStore();
    return context?.traceId;
  }

  /**
   * Run a function with trace context
   */
  static run<T>(context: TraceContextData, fn: () => T): T {
    return traceStorage.run(context, fn);
  }

  /**
   * Add operation to current trace
   */
  static async addOperation(
    operation: string,
    component: string,
    metadata?: any
  ): Promise<void> {
    const context = traceStorage.getStore();
    if (context?.traceId) {
      await traceIdService.addOperation(
        context.traceId,
        operation,
        component,
        {
          ...metadata,
          userId: context.userId,
          brokerName: context.brokerName,
          accountId: context.accountId
        }
      );
    }
  }

  /**
   * Complete operation in current trace
   */
  static async completeOperation(
    operation: string,
    status: 'SUCCESS' | 'ERROR',
    metadata?: any
  ): Promise<void> {
    const context = traceStorage.getStore();
    if (context?.traceId) {
      await traceIdService.completeOperation(
        context.traceId,
        operation,
        status,
        {
          ...metadata,
          userId: context.userId,
          brokerName: context.brokerName,
          accountId: context.accountId
        }
      );
    }
  }

  /**
   * Create child context with additional properties
   */
  static createChildContext(additionalProps: Partial<TraceContextData>): TraceContextData | undefined {
    const currentContext = traceStorage.getStore();
    if (currentContext) {
      return {
        ...currentContext,
        ...additionalProps
      };
    }
    return undefined;
  }

  /**
   * Execute database operation with trace context
   */
  static async withDatabaseTrace<T>(
    operation: string,
    dbOperation: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    const context = traceStorage.getStore();
    if (!context?.traceId) {
      return dbOperation();
    }

    await TraceContext.addOperation(operation, 'DATABASE', metadata);
    
    try {
      const result = await dbOperation();
      await TraceContext.completeOperation(operation, 'SUCCESS', {
        ...metadata,
        resultType: typeof result,
        hasResult: !!result
      });
      return result;
    } catch (error) {
      await TraceContext.completeOperation(operation, 'ERROR', {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Execute external API call with trace context
   */
  static async withExternalApiTrace<T>(
    operation: string,
    apiName: string,
    apiOperation: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    const context = traceStorage.getStore();
    if (!context?.traceId) {
      return apiOperation();
    }

    await TraceContext.addOperation(operation, 'EXTERNAL_API', {
      ...metadata,
      apiName,
      brokerName: context.brokerName
    });
    
    try {
      const result = await apiOperation();
      await TraceContext.completeOperation(operation, 'SUCCESS', {
        ...metadata,
        apiName,
        resultType: typeof result,
        hasResult: !!result
      });
      return result;
    } catch (error) {
      await TraceContext.completeOperation(operation, 'ERROR', {
        ...metadata,
        apiName,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: (error as any)?.code,
        statusCode: (error as any)?.response?.status
      });
      throw error;
    }
  }

  /**
   * Execute internal service call with trace context
   */
  static async withServiceTrace<T>(
    operation: string,
    serviceName: string,
    serviceOperation: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    const context = traceStorage.getStore();
    if (!context?.traceId) {
      return serviceOperation();
    }

    await TraceContext.addOperation(operation, serviceName, metadata);
    
    try {
      const result = await serviceOperation();
      await TraceContext.completeOperation(operation, 'SUCCESS', {
        ...metadata,
        resultType: typeof result,
        hasResult: !!result
      });
      return result;
    } catch (error) {
      await TraceContext.completeOperation(operation, 'ERROR', {
        ...metadata,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Log with trace context
   */
  static logWithTrace(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    additionalContext?: any
  ): void {
    const context = traceStorage.getStore();
    const logContext = {
      ...additionalContext,
      traceId: context?.traceId,
      userId: context?.userId,
      brokerName: context?.brokerName,
      component: context?.component,
      operation: context?.operation
    };

    switch (level) {
      case 'debug':
        logger.debug(message, logContext);
        break;
      case 'info':
        logger.info(message, logContext);
        break;
      case 'warn':
        logger.warn(message, logContext);
        break;
      case 'error':
        logger.error(message, logContext);
        break;
    }
  }

  /**
   * Get logging context for current trace
   */
  static getLoggingContext(): any {
    const context = traceStorage.getStore();
    return {
      traceId: context?.traceId,
      userId: context?.userId,
      brokerName: context?.brokerName,
      component: context?.component,
      operation: context?.operation,
      requestId: context?.requestId,
      sessionId: context?.sessionId
    };
  }
}

export default TraceContext;