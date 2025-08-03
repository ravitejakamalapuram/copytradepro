import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { TraceIdService } from '../services/traceIdService';
import { ErrorLoggingService } from '../services/errorLoggingService';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';
import { logger } from '../utils/logger';

// Mock logger to avoid console output during tests
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Trace ID Consistency Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let traceIdService: TraceIdService;
  let errorLoggingService: ErrorLoggingService;

  beforeEach(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Get service instances
    traceIdService = TraceIdService.getInstance();
    errorLoggingService = ErrorLoggingService.getInstance();

    // Clear any existing data
    await ErrorLog.deleteMany({});
    await TraceLifecycle.deleteMany({});
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
    vi.clearAllMocks();
  });

  describe('Trace ID Generation and Propagation', () => {
    it('should generate unique trace IDs consistently', async () => {
      // Act - Generate multiple trace IDs
      const traceIds = await Promise.all([
        traceIdService.createTraceContext(),
        traceIdService.createTraceContext(),
        traceIdService.createTraceContext(),
        traceIdService.createTraceContext(),
        traceIdService.createTraceContext()
      ]);

      // Assert - All trace IDs should be unique and properly formatted
      const traceIdStrings = traceIds.map(ctx => ctx.traceId);
      const uniqueTraceIds = new Set(traceIdStrings);
      
      expect(uniqueTraceIds.size).toBe(5);
      traceIdStrings.forEach(traceId => {
        expect(traceId).toMatch(/^trace_[a-f0-9]{32}$/);
      });

      // Verify all trace contexts are stored in memory
      traceIdStrings.forEach(traceId => {
        const context = traceIdService.getTraceContext(traceId);
        expect(context).toBeDefined();
        expect(context!.traceId).toBe(traceId);
      });

      // Verify all trace lifecycles are created in database
      const lifecycles = await TraceLifecycle.find({
        traceId: { $in: traceIdStrings }
      }).lean();
      expect(lifecycles).toHaveLength(5);
    });

    it('should maintain trace ID consistency across service calls', async () => {
      // Arrange - Create trace context
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Act - Add multiple operations to the same trace
      await traceIdService.addOperation(traceId, 'AUTHENTICATE_USER', 'AUTH_CONTROLLER');
      await traceIdService.addOperation(traceId, 'VALIDATE_REQUEST', 'VALIDATION_MIDDLEWARE');
      await traceIdService.addOperation(traceId, 'PROCESS_ORDER', 'ORDER_CONTROLLER');
      await traceIdService.addOperation(traceId, 'SAVE_TO_DATABASE', 'DATABASE_SERVICE');

      // Complete some operations
      await traceIdService.completeOperation(traceId, 'AUTHENTICATE_USER', 'SUCCESS');
      await traceIdService.completeOperation(traceId, 'VALIDATE_REQUEST', 'SUCCESS');
      await traceIdService.completeOperation(traceId, 'PROCESS_ORDER', 'ERROR', { 
        errorType: 'INSUFFICIENT_FUNDS' 
      });

      // Assert - Verify trace context maintains consistency
      const updatedContext = traceIdService.getTraceContext(traceId);
      expect(updatedContext).toBeDefined();
      expect(updatedContext!.operations).toHaveLength(4);

      // Verify operation statuses
      const operations = updatedContext!.operations;
      expect(operations.find(op => op.operation === 'AUTHENTICATE_USER')?.status).toBe('SUCCESS');
      expect(operations.find(op => op.operation === 'VALIDATE_REQUEST')?.status).toBe('SUCCESS');
      expect(operations.find(op => op.operation === 'PROCESS_ORDER')?.status).toBe('ERROR');
      expect(operations.find(op => op.operation === 'SAVE_TO_DATABASE')?.status).toBe('PENDING');

      // Verify database consistency
      const lifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(lifecycle).toBeDefined();
      expect(lifecycle!.operations).toHaveLength(4);
      expect(lifecycle!.errorCount).toBe(1);
    });

    it('should propagate trace ID through error logging', async () => {
      // Arrange - Create trace context
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Add operation to trace
      await traceIdService.addOperation(traceId, 'BROKER_CONNECT', 'BROKER_CONTROLLER');

      // Act - Log error with trace ID
      const errorId = await errorLoggingService.logError(
        'Failed to connect to broker',
        new Error('Connection timeout'),
        {
          traceId,
          component: 'BROKER_CONTROLLER',
          operation: 'BROKER_CONNECT',
          brokerName: 'zerodha',
          userId: 'user_123'
        }
      );

      // Assert - Verify error log contains correct trace ID
      const errorLog = await ErrorLog.findOne({ errorId }).lean();
      expect(errorLog).toBeDefined();
      expect(errorLog!.traceId).toBe(traceId);

      // Verify trace lifecycle was updated with error
      const lifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(lifecycle).toBeDefined();
      expect(lifecycle!.errorCount).toBe(1);

      // Verify operation was marked as error
      const errorOperation = lifecycle!.operations.find(
        op => op.operation === 'BROKER_CONNECT'
      );
      expect(errorOperation).toBeDefined();
      expect(errorOperation!.status).toBe('ERROR');
      expect(errorOperation!.metadata).toMatchObject({
        errorId,
        errorType: expect.any(String)
      });
    });
  });

  describe('Cross-Component Trace Consistency', () => {
    it('should maintain trace consistency across multiple components', async () => {
      // Arrange - Simulate a complex request flow
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Act - Simulate operations across different components
      const operations = [
        { operation: 'RECEIVE_REQUEST', component: 'API_GATEWAY' },
        { operation: 'AUTHENTICATE', component: 'AUTH_SERVICE' },
        { operation: 'VALIDATE_PERMISSIONS', component: 'AUTHORIZATION_SERVICE' },
        { operation: 'FETCH_USER_DATA', component: 'USER_SERVICE' },
        { operation: 'CONNECT_BROKER', component: 'BROKER_SERVICE' },
        { operation: 'PLACE_ORDER', component: 'TRADING_SERVICE' },
        { operation: 'UPDATE_PORTFOLIO', component: 'PORTFOLIO_SERVICE' },
        { operation: 'SEND_NOTIFICATION', component: 'NOTIFICATION_SERVICE' }
      ];

      // Add all operations
      for (const op of operations) {
        await traceIdService.addOperation(traceId, op.operation, op.component);
      }

      // Complete operations with mixed results
      await traceIdService.completeOperation(traceId, 'RECEIVE_REQUEST', 'SUCCESS');
      await traceIdService.completeOperation(traceId, 'AUTHENTICATE', 'SUCCESS');
      await traceIdService.completeOperation(traceId, 'VALIDATE_PERMISSIONS', 'SUCCESS');
      await traceIdService.completeOperation(traceId, 'FETCH_USER_DATA', 'SUCCESS');
      await traceIdService.completeOperation(traceId, 'CONNECT_BROKER', 'ERROR', {
        errorType: 'CONNECTION_FAILED'
      });

      // Log errors for failed operations
      await errorLoggingService.logError(
        'Broker connection failed',
        new Error('ECONNREFUSED'),
        {
          traceId,
          component: 'BROKER_SERVICE',
          operation: 'CONNECT_BROKER',
          brokerName: 'zerodha'
        }
      );

      // Assert - Verify trace consistency across all components
      const lifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(lifecycle).toBeDefined();
      expect(lifecycle!.operations).toHaveLength(8);
      expect(lifecycle!.errorCount).toBe(1);

      // Verify all components are represented
      const components = lifecycle!.operations.map(op => op.component);
      expect(components).toContain('API_GATEWAY');
      expect(components).toContain('AUTH_SERVICE');
      expect(components).toContain('BROKER_SERVICE');
      expect(components).toContain('TRADING_SERVICE');

      // Verify error log is linked to trace
      const errorLogs = await ErrorLog.find({ traceId }).lean();
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].component).toBe('BROKER_SERVICE');
      expect(errorLogs[0].operation).toBe('CONNECT_BROKER');
    });

    it('should handle concurrent operations on same trace', async () => {
      // Arrange - Create trace context
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Act - Add multiple operations concurrently
      const concurrentOperations = [
        traceIdService.addOperation(traceId, 'FETCH_MARKET_DATA', 'MARKET_SERVICE'),
        traceIdService.addOperation(traceId, 'VALIDATE_ORDER', 'VALIDATION_SERVICE'),
        traceIdService.addOperation(traceId, 'CHECK_BALANCE', 'ACCOUNT_SERVICE'),
        traceIdService.addOperation(traceId, 'CALCULATE_FEES', 'FEE_SERVICE'),
        traceIdService.addOperation(traceId, 'LOG_ACTIVITY', 'AUDIT_SERVICE')
      ];

      await Promise.all(concurrentOperations);

      // Complete operations concurrently
      const completionOperations = [
        traceIdService.completeOperation(traceId, 'FETCH_MARKET_DATA', 'SUCCESS'),
        traceIdService.completeOperation(traceId, 'VALIDATE_ORDER', 'SUCCESS'),
        traceIdService.completeOperation(traceId, 'CHECK_BALANCE', 'SUCCESS'),
        traceIdService.completeOperation(traceId, 'CALCULATE_FEES', 'SUCCESS'),
        traceIdService.completeOperation(traceId, 'LOG_ACTIVITY', 'ERROR')
      ];

      await Promise.all(completionOperations);

      // Assert - Verify all operations are tracked correctly
      const lifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(lifecycle).toBeDefined();
      expect(lifecycle!.operations).toHaveLength(5);
      expect(lifecycle!.errorCount).toBe(1);

      // Verify operation statuses
      const successfulOps = lifecycle!.operations.filter(op => op.status === 'SUCCESS');
      const errorOps = lifecycle!.operations.filter(op => op.status === 'ERROR');
      
      expect(successfulOps).toHaveLength(4);
      expect(errorOps).toHaveLength(1);
      expect(errorOps[0].operation).toBe('LOG_ACTIVITY');
    });
  });

  describe('Trace Lifecycle Management', () => {
    it('should complete trace lifecycle correctly', async () => {
      // Arrange - Create and populate trace
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      await traceIdService.addOperation(traceId, 'START_PROCESS', 'MAIN_CONTROLLER');
      await traceIdService.addOperation(traceId, 'VALIDATE_INPUT', 'VALIDATOR');
      await traceIdService.addOperation(traceId, 'PROCESS_DATA', 'PROCESSOR');

      await traceIdService.completeOperation(traceId, 'START_PROCESS', 'SUCCESS');
      await traceIdService.completeOperation(traceId, 'VALIDATE_INPUT', 'SUCCESS');
      await traceIdService.completeOperation(traceId, 'PROCESS_DATA', 'SUCCESS');

      // Act - Complete the trace
      await traceIdService.completeTrace(traceId, 'SUCCESS');

      // Assert - Verify trace completion
      const lifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(lifecycle).toBeDefined();
      expect(lifecycle!.status).toBe('SUCCESS');
      expect(lifecycle!.endTime).toBeDefined();
      expect(lifecycle!.duration).toBeDefined();
      expect(lifecycle!.duration).toBeGreaterThan(0);

      // Verify trace is removed from memory
      const memoryContext = traceIdService.getTraceContext(traceId);
      expect(memoryContext).toBeNull();
    });

    it('should handle trace completion with errors', async () => {
      // Arrange - Create trace with errors
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      await traceIdService.addOperation(traceId, 'INIT_PROCESS', 'CONTROLLER');
      await traceIdService.addOperation(traceId, 'CALL_EXTERNAL_API', 'API_CLIENT');
      
      await traceIdService.completeOperation(traceId, 'INIT_PROCESS', 'SUCCESS');
      await traceIdService.completeOperation(traceId, 'CALL_EXTERNAL_API', 'ERROR');

      // Log error
      await errorLoggingService.logError(
        'External API call failed',
        new Error('API timeout'),
        {
          traceId,
          component: 'API_CLIENT',
          operation: 'CALL_EXTERNAL_API'
        }
      );

      // Act - Complete trace with error status
      await traceIdService.completeTrace(traceId, 'ERROR');

      // Assert - Verify error trace completion
      const lifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(lifecycle).toBeDefined();
      expect(lifecycle!.status).toBe('ERROR');
      expect(lifecycle!.errorCount).toBe(1);
      expect(lifecycle!.endTime).toBeDefined();

      // Verify error log is associated
      const errorLogs = await ErrorLog.find({ traceId }).lean();
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].operation).toBe('CALL_EXTERNAL_API');
    });

    it('should handle trace statistics correctly', async () => {
      // Arrange - Create multiple traces with different outcomes
      const traces = [];
      
      // Create successful traces
      for (let i = 0; i < 3; i++) {
        const context = await traceIdService.createTraceContext();
        traces.push(context.traceId);
        await traceIdService.addOperation(context.traceId, 'OPERATION', 'COMPONENT');
        await traceIdService.completeOperation(context.traceId, 'OPERATION', 'SUCCESS');
        await traceIdService.completeTrace(context.traceId, 'SUCCESS');
      }

      // Create error traces
      for (let i = 0; i < 2; i++) {
        const context = await traceIdService.createTraceContext();
        traces.push(context.traceId);
        await traceIdService.addOperation(context.traceId, 'OPERATION', 'COMPONENT');
        await traceIdService.completeOperation(context.traceId, 'OPERATION', 'ERROR');
        await traceIdService.completeTrace(context.traceId, 'ERROR');
      }

      // Act - Get trace statistics
      const stats = await traceIdService.getTraceStatistics();

      // Assert - Verify statistics
      expect(stats.totalTraces).toBe(5);
      expect(stats.successfulTraces).toBe(3);
      expect(stats.errorTraces).toBe(2);
      expect(stats.averageDuration).toBeGreaterThan(0);
      expect(stats.activeTraces).toBe(0); // All traces completed
    });
  });

  describe('Error Correlation Through Traces', () => {
    it('should correlate multiple errors in same trace', async () => {
      // Arrange - Create trace with multiple error points
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Act - Simulate cascade of errors
      await traceIdService.addOperation(traceId, 'AUTH_CHECK', 'AUTH_SERVICE');
      await traceIdService.addOperation(traceId, 'BROKER_CONNECT', 'BROKER_SERVICE');
      await traceIdService.addOperation(traceId, 'PLACE_ORDER', 'TRADING_SERVICE');

      // First error - auth failure
      await traceIdService.completeOperation(traceId, 'AUTH_CHECK', 'ERROR');
      await errorLoggingService.logError(
        'Authentication failed',
        new Error('Invalid token'),
        {
          traceId,
          component: 'AUTH_SERVICE',
          operation: 'AUTH_CHECK',
          userId: 'user_123'
        }
      );

      // Second error - broker connection failure (cascade effect)
      await traceIdService.completeOperation(traceId, 'BROKER_CONNECT', 'ERROR');
      await errorLoggingService.logError(
        'Broker connection failed due to auth failure',
        new Error('Unauthorized'),
        {
          traceId,
          component: 'BROKER_SERVICE',
          operation: 'BROKER_CONNECT',
          brokerName: 'zerodha'
        }
      );

      // Third error - order placement failure (cascade effect)
      await traceIdService.completeOperation(traceId, 'PLACE_ORDER', 'ERROR');
      await errorLoggingService.logError(
        'Order placement failed',
        new Error('No broker connection'),
        {
          traceId,
          component: 'TRADING_SERVICE',
          operation: 'PLACE_ORDER'
        }
      );

      // Assert - Verify error correlation
      const errorLogs = await ErrorLog.find({ traceId }).sort({ timestamp: 1 }).lean();
      expect(errorLogs).toHaveLength(3);

      // Verify error sequence
      expect(errorLogs[0].component).toBe('AUTH_SERVICE');
      expect(errorLogs[1].component).toBe('BROKER_SERVICE');
      expect(errorLogs[2].component).toBe('TRADING_SERVICE');

      // Verify all errors share same trace ID
      errorLogs.forEach(error => {
        expect(error.traceId).toBe(traceId);
      });

      // Verify trace lifecycle shows error cascade
      const lifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(lifecycle).toBeDefined();
      expect(lifecycle!.errorCount).toBe(3);
      expect(lifecycle!.operations.every(op => op.status === 'ERROR')).toBe(true);
    });

    it('should maintain trace consistency during error recovery', async () => {
      // Arrange - Create trace with error and recovery
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Act - Simulate error and retry scenario
      await traceIdService.addOperation(traceId, 'INITIAL_ATTEMPT', 'SERVICE');
      await traceIdService.completeOperation(traceId, 'INITIAL_ATTEMPT', 'ERROR');
      
      await errorLoggingService.logError(
        'Initial attempt failed',
        new Error('Temporary failure'),
        {
          traceId,
          component: 'SERVICE',
          operation: 'INITIAL_ATTEMPT',
          retryCount: 0
        }
      );

      // Retry operation
      await traceIdService.addOperation(traceId, 'RETRY_ATTEMPT', 'SERVICE');
      await traceIdService.completeOperation(traceId, 'RETRY_ATTEMPT', 'SUCCESS');

      // Assert - Verify trace shows both attempts
      const lifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(lifecycle).toBeDefined();
      expect(lifecycle!.operations).toHaveLength(2);
      expect(lifecycle!.errorCount).toBe(1);

      // Verify operations
      const initialOp = lifecycle!.operations.find(op => op.operation === 'INITIAL_ATTEMPT');
      const retryOp = lifecycle!.operations.find(op => op.operation === 'RETRY_ATTEMPT');
      
      expect(initialOp?.status).toBe('ERROR');
      expect(retryOp?.status).toBe('SUCCESS');

      // Verify error log exists for failed attempt only
      const errorLogs = await ErrorLog.find({ traceId }).lean();
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].operation).toBe('INITIAL_ATTEMPT');
    });
  });

  describe('Memory and Performance Consistency', () => {
    it('should maintain consistent performance across trace operations', async () => {
      // Arrange - Create trace
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Act - Measure performance of multiple operations
      const operationCount = 50;
      const startTime = Date.now();

      for (let i = 0; i < operationCount; i++) {
        await traceIdService.addOperation(traceId, `OPERATION_${i}`, `COMPONENT_${i % 5}`);
        await traceIdService.completeOperation(traceId, `OPERATION_${i}`, 'SUCCESS');
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Assert - Performance should be consistent
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify all operations are tracked
      const lifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(lifecycle).toBeDefined();
      expect(lifecycle!.operations).toHaveLength(operationCount);

      // Verify memory consistency
      const memoryContext = traceIdService.getTraceContext(traceId);
      expect(memoryContext).toBeDefined();
      expect(memoryContext!.operations).toHaveLength(operationCount);
    });

    it('should handle trace cleanup correctly', async () => {
      // Arrange - Create multiple traces
      const traceContexts = await Promise.all([
        traceIdService.createTraceContext(),
        traceIdService.createTraceContext(),
        traceIdService.createTraceContext()
      ]);

      const traceIds = traceContexts.map(ctx => ctx.traceId);

      // Act - Complete some traces
      await traceIdService.completeTrace(traceIds[0], 'SUCCESS');
      await traceIdService.completeTrace(traceIds[1], 'ERROR');
      // Leave traceIds[2] active

      // Assert - Verify cleanup
      expect(traceIdService.getTraceContext(traceIds[0])).toBeNull(); // Completed
      expect(traceIdService.getTraceContext(traceIds[1])).toBeNull(); // Completed
      expect(traceIdService.getTraceContext(traceIds[2])).toBeDefined(); // Still active

      // Verify database consistency
      const lifecycles = await TraceLifecycle.find({
        traceId: { $in: traceIds }
      }).lean();
      
      expect(lifecycles).toHaveLength(3);
      expect(lifecycles.filter(l => l.status === 'SUCCESS')).toHaveLength(1);
      expect(lifecycles.filter(l => l.status === 'ERROR')).toHaveLength(1);
      expect(lifecycles.filter(l => l.status === 'PENDING')).toHaveLength(1);
    });
  });
});