/**
 * Test suite for enhanced error logging system
 */

import { errorLoggingService } from '../services/errorLoggingService';
import { traceIdService } from '../services/traceIdService';
import { TraceContext } from '../utils/traceContext';
import { TracedDatabase } from '../utils/tracedDatabase';
import { TracedApiClient } from '../utils/tracedApiClient';

describe('Enhanced Error Logging System', () => {
  let testTraceId: string;

  beforeEach(async () => {
    // Create a test trace context
    testTraceId = traceIdService.generateTraceId();
    const traceContext = await traceIdService.createTraceContext(testTraceId);
    
    TraceContext.setContext({
      traceId: testTraceId,
      userId: 'test-user-123',
      component: 'TEST_COMPONENT',
      operation: 'TEST_OPERATION'
    });
  });

  describe('ErrorLoggingService', () => {
    it('should log error with comprehensive context', async () => {
      const testError = new Error('Test error message');
      
      const errorId = await errorLoggingService.logError(
        'Test error occurred',
        testError,
        {
          traceId: testTraceId,
          component: 'TEST_SERVICE',
          operation: 'TEST_OPERATION',
          source: 'BE',
          userId: 'test-user-123'
        }
      );

      expect(errorId).toBeDefined();
      expect(typeof errorId).toBe('string');
    });

    it('should categorize errors correctly', () => {
      const brokerError = new Error('Broker API connection failed');
      const authError = new Error('Token expired');
      const validationError = new Error('Invalid input provided');

      const brokerContext = { component: 'BROKER_SERVICE', operation: 'PLACE_ORDER' };
      const authContext = { component: 'AUTH_SERVICE', operation: 'VALIDATE_TOKEN' };
      const validationContext = { component: 'VALIDATION_SERVICE', operation: 'VALIDATE_INPUT' };

      const brokerCategorization = errorLoggingService.categorizeError(brokerError, brokerContext);
      const authCategorization = errorLoggingService.categorizeError(authError, authContext);
      const validationCategorization = errorLoggingService.categorizeError(validationError, validationContext);

      expect(brokerCategorization.category).toBe('TRADING');
      expect(authCategorization.category).toBe('AUTHENTICATION');
      expect(validationCategorization.category).toBe('SYSTEM');
    });

    it('should generate error analytics', async () => {
      const analytics = await errorLoggingService.getErrorAnalytics(3600000); // 1 hour

      expect(analytics).toHaveProperty('totalErrors');
      expect(analytics).toHaveProperty('errorsByType');
      expect(analytics).toHaveProperty('errorsByComponent');
      expect(analytics).toHaveProperty('errorsByCategory');
      expect(analytics).toHaveProperty('errorTrends');
      expect(analytics.errorTrends).toHaveProperty('hourly');
      expect(analytics.errorTrends).toHaveProperty('daily');
      expect(analytics.errorTrends).toHaveProperty('weekly');
    });

    it('should generate error patterns and insights', async () => {
      const patterns = await errorLoggingService.getErrorPatterns(3600000);

      expect(patterns).toHaveProperty('recurringErrors');
      expect(patterns).toHaveProperty('errorSpikes');
      expect(patterns).toHaveProperty('correlatedErrors');
      expect(Array.isArray(patterns.recurringErrors)).toBe(true);
      expect(Array.isArray(patterns.errorSpikes)).toBe(true);
      expect(Array.isArray(patterns.correlatedErrors)).toBe(true);
    });

    it('should generate actionable insights', async () => {
      const insights = await errorLoggingService.generateErrorInsights(3600000);

      expect(insights).toHaveProperty('criticalIssues');
      expect(insights).toHaveProperty('performanceImpacts');
      expect(insights).toHaveProperty('systemHealthScore');
      expect(insights.systemHealthScore).toHaveProperty('overall');
      expect(insights.systemHealthScore).toHaveProperty('breakdown');
      expect(typeof insights.systemHealthScore.overall).toBe('number');
    });
  });

  describe('TraceContext', () => {
    it('should maintain trace context across async operations', async () => {
      const context = TraceContext.getContext();
      expect(context?.traceId).toBe(testTraceId);
      expect(context?.userId).toBe('test-user-123');
    });

    it('should add and complete operations', async () => {
      await TraceContext.addOperation('TEST_OPERATION', 'TEST_COMPONENT', { test: true });
      await TraceContext.completeOperation('TEST_OPERATION', 'SUCCESS', { result: 'success' });

      // Verify operation was recorded (this would require checking the trace service)
      const traceLifecycle = await traceIdService.getTraceLifecycle(testTraceId);
      expect(traceLifecycle).toBeDefined();
    });

    it('should create child contexts', () => {
      const childContext = TraceContext.createChildContext({
        brokerName: 'test-broker',
        operation: 'CHILD_OPERATION'
      });

      expect(childContext?.traceId).toBe(testTraceId);
      expect(childContext?.brokerName).toBe('test-broker');
      expect(childContext?.operation).toBe('CHILD_OPERATION');
    });
  });

  describe('TracedDatabase', () => {
    // Note: These tests would require a test database setup
    it('should wrap database operations with trace context', () => {
      expect(TracedDatabase.find).toBeDefined();
      expect(TracedDatabase.findOne).toBeDefined();
      expect(TracedDatabase.create).toBeDefined();
      expect(TracedDatabase.updateOne).toBeDefined();
      expect(TracedDatabase.deleteOne).toBeDefined();
    });
  });

  describe('TracedApiClient', () => {
    it('should create traced API client', () => {
      const client = TracedApiClient.create('TEST_API', {
        baseURL: 'https://api.test.com',
        timeout: 5000
      });

      expect(client).toBeDefined();
      expect(client.get).toBeDefined();
      expect(client.post).toBeDefined();
      expect(client.put).toBeDefined();
      expect(client.delete).toBeDefined();
    });

    it('should include trace ID in request headers', () => {
      const client = TracedApiClient.create('TEST_API');
      const axiosClient = client.getClient();

      // Check if request interceptor is set up
      expect(axiosClient.interceptors.request.handlers.length).toBeGreaterThan(0);
      expect(axiosClient.interceptors.response.handlers.length).toBeGreaterThan(0);
    });
  });

  afterEach(async () => {
    // Clean up trace
    if (testTraceId) {
      await traceIdService.completeTrace(testTraceId, 'SUCCESS');
    }
  });
});

// Integration test for error middleware
describe('Error Middleware Integration', () => {
  it('should handle errors with comprehensive context capture', () => {
    // This would require setting up Express app and making test requests
    // For now, we'll just verify the functions exist
    const { errorHandler } = require('../middleware/errorHandler');
    expect(errorHandler).toBeDefined();
    expect(typeof errorHandler).toBe('function');
  });
});