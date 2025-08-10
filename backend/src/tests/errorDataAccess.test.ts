import mongoose from 'mongoose';
import { errorLoggingService } from '../services/errorLoggingService';
import { traceLifecycleService } from '../services/traceLifecycleService';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';

describe('Error Data Access Layer', () => {
  beforeAll(async () => {
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copytrade_test');
    }
  });

  afterEach(async () => {
    // Clean up test data
    await ErrorLog.deleteMany({ message: { $regex: /test/i } });
    await TraceLifecycle.deleteMany({ traceId: { $regex: /test/i } });
  });

  describe('ErrorLoggingService CRUD Operations', () => {
    it('should create and retrieve error by ID', async () => {
      // Create an error
      const errorId = await errorLoggingService.logError(
        'Test error message',
        new Error('Test error'),
        {
          component: 'TEST_COMPONENT',
          operation: 'TEST_OPERATION',
          source: 'BE',
          level: 'ERROR',
          errorType: 'TEST_ERROR'
        }
      );

      expect(errorId).toBeDefined();

      // Retrieve the error
      const retrievedError = await errorLoggingService.getErrorById(errorId);
      expect(retrievedError).toBeTruthy();
      expect(retrievedError?.message).toBe('Test error message');
      expect(retrievedError?.component).toBe('TEST_COMPONENT');
    });

    it('should search errors with filters', async () => {
      // Create test errors
      await errorLoggingService.logError('Test error 1', new Error('Test 1'), {
        component: 'TEST_COMPONENT_1',
        operation: 'TEST_OP_1',
        source: 'BE',
        level: 'ERROR'
      });

      await errorLoggingService.logError('Test error 2', new Error('Test 2'), {
        component: 'TEST_COMPONENT_2',
        operation: 'TEST_OP_2',
        source: 'UI',
        level: 'WARN'
      });

      // Search with filters
      const results = await errorLoggingService.searchErrorLogs({
        level: ['ERROR'],
        source: ['BE'],
        limit: 10
      });

      expect(results.errors.length).toBeGreaterThan(0);
      if (results.errors.length > 0) {
        expect(results.errors[0].level).toBe('ERROR');
        expect(results.errors[0].source).toBe('BE');
      }
    });

    it('should update error details', async () => {
      // Create an error
      const errorId = await errorLoggingService.logError(
        'Test error for update',
        new Error('Test error'),
        {
          component: 'TEST_COMPONENT',
          operation: 'TEST_OPERATION'
        }
      );

      // Update the error
      const updated = await errorLoggingService.updateError(errorId, {
        resolved: true,
        resolvedBy: 'test-user',
        resolution: 'Fixed in test'
      });

      expect(updated).toBe(true);

      // Verify the update
      const retrievedError = await errorLoggingService.getErrorById(errorId);
      expect(retrievedError?.resolved).toBe(true);
      expect(retrievedError?.resolvedBy).toBe('test-user');
    });

    it('should get error count with filters', async () => {
      // Create test errors
      await errorLoggingService.logError('Test error count 1', new Error('Test'), {
        component: 'COUNT_TEST',
        operation: 'COUNT_OP',
        level: 'ERROR'
      });

      await errorLoggingService.logError('Test error count 2', new Error('Test'), {
        component: 'COUNT_TEST',
        operation: 'COUNT_OP',
        level: 'WARN'
      });

      const errorCount = await errorLoggingService.getErrorCount({
        component: ['COUNT_TEST']
      });

      expect(errorCount).toBeGreaterThanOrEqual(2);
    });

    it('should get recent errors', async () => {
      // Create a test error
      await errorLoggingService.logError('Recent test error', new Error('Test'), {
        component: 'RECENT_TEST',
        operation: 'RECENT_OP'
      });

      const recentErrors = await errorLoggingService.getRecentErrors(5);
      expect(recentErrors.length).toBeGreaterThan(0);
      if (recentErrors.length > 0) {
        expect(recentErrors[0].message).toContain('test');
      }
    });
  });

  describe('TraceLifecycleService CRUD Operations', () => {
    it('should search traces with filters', async () => {
      const results = await traceLifecycleService.searchTraces({
        status: ['SUCCESS', 'ERROR'],
        limit: 10
      });

      expect(results).toBeDefined();
      expect(results.traces).toBeInstanceOf(Array);
      expect(results.total).toBeGreaterThanOrEqual(0);
    });

    it('should get trace analytics', async () => {
      const analytics = await traceLifecycleService.getTraceAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.totalTraces).toBeGreaterThanOrEqual(0);
      expect(analytics.tracesByStatus).toBeDefined();
      expect(analytics.tracesByTimeRange).toBeInstanceOf(Array);
    });

    it('should get traces by status', async () => {
      const successTraces = await traceLifecycleService.getTracesByStatus('SUCCESS');
      expect(successTraces).toBeInstanceOf(Array);

      const errorTraces = await traceLifecycleService.getTracesByStatus('ERROR');
      expect(errorTraces).toBeInstanceOf(Array);
    });

    it('should get recent traces', async () => {
      const recentTraces = await traceLifecycleService.getRecentTraces(5);
      expect(recentTraces).toBeInstanceOf(Array);
    });

    it('should get trace count', async () => {
      const count = await traceLifecycleService.getTraceCount({
        status: ['SUCCESS', 'ERROR', 'PENDING']
      });
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Analytics and Aggregation', () => {
    it('should get error analytics', async () => {
      const analytics = await errorLoggingService.getErrorAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.totalErrors).toBeGreaterThanOrEqual(0);
      expect(analytics.errorsByType).toBeDefined();
      expect(analytics.errorsByComponent).toBeDefined();
      expect(analytics.errorTrends).toBeDefined();
    });

    it('should get error patterns', async () => {
      const patterns = await errorLoggingService.getErrorPatterns();

      expect(patterns).toBeDefined();
      expect(patterns.recurringErrors).toBeInstanceOf(Array);
      expect(patterns.errorSpikes).toBeInstanceOf(Array);
      expect(patterns.correlatedErrors).toBeInstanceOf(Array);
    });

    it('should get error aggregation by time range', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();

      const aggregation = await errorLoggingService.getErrorAggregationByTimeRange(
        startDate,
        endDate,
        'hour'
      );

      expect(aggregation).toBeInstanceOf(Array);
      aggregation.forEach(item => {
        expect(item.timestamp).toBeInstanceOf(Date);
        expect(item.count).toBeGreaterThanOrEqual(0);
        expect(item.level).toBeDefined();
      });
    });
  });
});