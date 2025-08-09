import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { errorLoggingService } from '../services/errorLoggingService';
import { traceIdService } from '../services/traceIdService';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';

describe('Error Logging Infrastructure', () => {
  beforeAll(async () => {
    // Connect to test database
    const mongoUri = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/copytrade_test';
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    // Clean up and disconnect
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await ErrorLog.deleteMany({});
    await TraceLifecycle.deleteMany({});
  });

  describe('TraceIdService', () => {
    it('should generate unique trace IDs', () => {
      const traceId1 = traceIdService.generateTraceId();
      const traceId2 = traceIdService.generateTraceId();

      expect(traceId1).toMatch(/^trace_[a-f0-9]{32}$/);
      expect(traceId2).toMatch(/^trace_[a-f0-9]{32}$/);
      expect(traceId1).not.toBe(traceId2);
    });

    it('should create and manage trace context', async () => {
      const traceContext = await traceIdService.createTraceContext();

      expect(traceContext.traceId).toMatch(/^trace_[a-f0-9]{32}$/);
      expect(traceContext.spanId).toMatch(/^span_[a-f0-9]{8}$/);
      expect(traceContext.startTime).toBeInstanceOf(Date);
      expect(traceContext.operations).toEqual([]);

      // Verify database record was created
      const dbRecord = await TraceLifecycle.findOne({ traceId: traceContext.traceId });
      expect(dbRecord).toBeTruthy();
      expect(dbRecord?.status).toBe('PENDING');
    });

    it('should add and complete operations', async () => {
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Add operation
      await traceIdService.addOperation(traceId, 'TEST_OPERATION', 'TEST_COMPONENT', { test: true });

      // Verify operation was added
      const context = traceIdService.getTraceContext(traceId);
      expect(context?.operations).toHaveLength(1);
      expect(context?.operations[0]?.operation).toBe('TEST_OPERATION');
      expect(context?.operations[0]?.component).toBe('TEST_COMPONENT');
      expect(context?.operations[0]?.status).toBe('PENDING');

      // Complete operation
      await traceIdService.completeOperation(traceId, 'TEST_OPERATION', 'SUCCESS', { result: 'completed' });

      // Verify operation was completed
      const updatedContext = traceIdService.getTraceContext(traceId);
      expect(updatedContext?.operations[0]?.status).toBe('SUCCESS');
      expect(updatedContext?.operations[0]?.endTime).toBeInstanceOf(Date);
    });

    it('should get trace lifecycle from database', async () => {
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      await traceIdService.addOperation(traceId, 'DB_QUERY', 'DATABASE', { query: 'SELECT * FROM users' });
      await traceIdService.completeOperation(traceId, 'DB_QUERY', 'SUCCESS');

      const lifecycle = await traceIdService.getTraceLifecycle(traceId);
      expect(lifecycle).toBeTruthy();
      expect(lifecycle?.traceId).toBe(traceId);
      expect(lifecycle?.operations).toHaveLength(1);
      expect(lifecycle?.operations[0]?.operation).toBe('DB_QUERY');
    });
  });

  describe('ErrorLoggingService', () => {
    it('should log errors with comprehensive context', async () => {
      const testError = new Error('Test error message');
      const traceId = traceIdService.generateTraceId();

      const errorId = await errorLoggingService.logError(
        'Test error occurred',
        testError,
        {
          traceId,
          component: 'TEST_COMPONENT',
          operation: 'TEST_OPERATION',
          source: 'BE',
          userId: 'user123',
          brokerName: 'test_broker',
          url: '/api/test',
          method: 'POST',
          statusCode: 500
        }
      );

      expect(errorId).toBeTruthy();

      // Verify error was saved to database
      const savedError = await ErrorLog.findOne({ errorId: errorId });
      expect(savedError).toBeTruthy();
      expect(savedError?.message).toBe('Test error occurred');
      expect(savedError?.traceId).toBe(traceId);
      expect(savedError?.component).toBe('TEST_COMPONENT');
      expect(savedError?.operation).toBe('TEST_OPERATION');
      expect(savedError?.source).toBe('BE');
      expect(savedError?.level).toBe('ERROR');
      expect(savedError?.context.userId).toBe('user123');
      expect(savedError?.context.brokerName).toBe('test_broker');
      expect(savedError?.stackTrace).toContain('Test error message');
    });

    it('should log warnings and info messages', async () => {
      const traceId = traceIdService.generateTraceId();

      const warningId = await errorLoggingService.logWarning(
        'Test warning message',
        {
          traceId,
          component: 'TEST_COMPONENT',
          operation: 'TEST_WARNING',
          userId: 'user123'
        }
      );

      const infoId = await errorLoggingService.logInfo(
        'Test info message',
        {
          traceId,
          component: 'TEST_COMPONENT',
          operation: 'TEST_INFO',
          userId: 'user123'
        }
      );

      expect(warningId).toBeTruthy();
      expect(infoId).toBeTruthy();

      // Verify both were saved with correct levels
      const warningLog = await ErrorLog.findOne({ errorId: warningId });
      const infoLog = await ErrorLog.findOne({ errorId: infoId });

      expect(warningLog?.level).toBe('WARN');
      expect(infoLog?.level).toBe('INFO');
    });

    it('should search error logs with filters', async () => {
      const traceId = traceIdService.generateTraceId();

      // Create multiple test errors
      await errorLoggingService.logError('Error 1', new Error('Test 1'), {
        traceId,
        component: 'COMPONENT_A',
        operation: 'OP_1',
        source: 'BE',
        errorType: 'VALIDATION_ERROR'
      });

      await errorLoggingService.logError('Error 2', new Error('Test 2'), {
        traceId,
        component: 'COMPONENT_B',
        operation: 'OP_2',
        source: 'UI',
        errorType: 'NETWORK_ERROR'
      });

      // Search with filters
      const results = await errorLoggingService.searchErrorLogs({
        source: ['BE'],
        component: ['COMPONENT_A'],
        limit: 10
      });

      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]?.component).toBe('COMPONENT_A');
      expect(results.errors[0]?.source).toBe('BE');
      expect(results.total).toBe(1);
    });

    it('should generate error analytics', async () => {
      const traceId = traceIdService.generateTraceId();

      // Create test errors
      await errorLoggingService.logError('Error 1', new Error('Test'), {
        traceId,
        component: 'COMPONENT_A',
        operation: 'OP_1',
        errorType: 'VALIDATION_ERROR'
      });

      await errorLoggingService.logError('Error 2', new Error('Test'), {
        traceId,
        component: 'COMPONENT_A',
        operation: 'OP_2',
        errorType: 'NETWORK_ERROR'
      });

      const analytics = await errorLoggingService.getErrorAnalytics();

      expect(analytics.totalErrors).toBe(2);
      expect(analytics.errorsByComponent['COMPONENT_A']).toBe(2);
      expect(analytics.errorsByType['VALIDATION_ERROR']).toBe(1);
      expect(analytics.errorsByType['NETWORK_ERROR']).toBe(1);
      expect(analytics.unresolvedErrors).toBe(2);
      expect(analytics.resolvedErrors).toBe(0);
    });

    it('should resolve errors', async () => {
      const traceId = traceIdService.generateTraceId();

      const errorId = await errorLoggingService.logError('Test error', new Error('Test'), {
        traceId,
        component: 'TEST_COMPONENT',
        operation: 'TEST_OP'
      });

      // Resolve the error
      const resolved = await errorLoggingService.resolveError(
        errorId,
        'Fixed by updating configuration',
        'developer123'
      );

      expect(resolved).toBe(true);

      // Verify error is marked as resolved
      const resolvedError = await ErrorLog.findOne({ errorId: errorId });
      expect(resolvedError?.resolved).toBe(true);
      expect(resolvedError?.resolution).toBe('Fixed by updating configuration');
      expect(resolvedError?.resolvedBy).toBe('developer123');
      expect(resolvedError?.resolvedAt).toBeInstanceOf(Date);
    });

    it('should get errors by trace ID', async () => {
      const traceId = traceIdService.generateTraceId();

      // Create multiple errors with same trace ID
      await errorLoggingService.logError('Error 1', new Error('Test 1'), {
        traceId,
        component: 'COMPONENT_A',
        operation: 'OP_1'
      });

      await errorLoggingService.logError('Error 2', new Error('Test 2'), {
        traceId,
        component: 'COMPONENT_B',
        operation: 'OP_2'
      });

      const errors = await errorLoggingService.getErrorsByTraceId(traceId);

      expect(errors).toHaveLength(2);
      expect(errors[0]?.traceId).toBe(traceId);
      expect(errors[1]?.traceId).toBe(traceId);
      // Should be sorted by timestamp
      if (errors[0] && errors[1]) {
        expect(errors[0].timestamp.getTime()).toBeLessThanOrEqual(errors[1].timestamp.getTime());
      }
    });
  });

  describe('Integration Tests', () => {
    it('should integrate trace service with error logging', async () => {
      // Create trace context
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Add operation
      await traceIdService.addOperation(traceId, 'API_CALL', 'BROKER_SERVICE');

      // Log error during operation
      const errorId = await errorLoggingService.logError(
        'Broker API failed',
        new Error('Connection timeout'),
        {
          traceId,
          component: 'BROKER_SERVICE',
          operation: 'API_CALL',
          errorType: 'NETWORK_ERROR'
        }
      );

      // Complete operation with error
      await traceIdService.completeOperation(traceId, 'API_CALL', 'ERROR', { errorId });

      // Verify trace lifecycle includes error
      const lifecycle = await traceIdService.getTraceLifecycle(traceId);
      expect(lifecycle?.operations[0]?.status).toBe('ERROR');
      expect(lifecycle?.operations[0]?.metadata?.errorId).toBe(errorId);
      expect(lifecycle?.errorCount).toBe(1);

      // Verify error log references trace
      const errorLog = await ErrorLog.findOne({ errorId: errorId });
      expect(errorLog?.traceId).toBe(traceId);
    });
  });
});