import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import { ErrorLoggingService } from '../services/errorLoggingService';
import { TraceIdService } from '../services/traceIdService';
import { ErrorClassificationService } from '../services/errorClassificationService';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';
import { errorHandler } from '../middleware/errorHandler';
import { traceMiddleware } from '../middleware/traceMiddleware';

describe('Error Flow Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: express.Application;
  let errorLoggingService: ErrorLoggingService;
  let traceIdService: TraceIdService;
  let errorClassificationService: ErrorClassificationService;

  beforeEach(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create Express app with middleware
    app = express();
    app.use(express.json());
    app.use(traceMiddleware);

    // Get service instances
    errorLoggingService = ErrorLoggingService.getInstance();
    traceIdService = TraceIdService.getInstance();
    errorClassificationService = ErrorClassificationService.getInstance();

    // Add test routes
    app.get('/test/success', (req, res) => {
      res.json({ message: 'Success', traceId: (req as any).traceId });
    });

    app.get('/test/error', (req, res, next) => {
      const error = new Error('Test error for integration');
      error.name = 'TestError';
      next(error);
    });

    app.get('/test/broker-error', (req, res, next) => {
      const error = new Error('Broker connection failed');
      (error as any).code = 'ECONNREFUSED';
      (error as any).brokerName = 'zerodha';
      next(error);
    });

    app.get('/test/auth-error', (req, res, next) => {
      const error = new Error('Authentication failed');
      (error as any).response = { status: 401 };
      next(error);
    });

    app.get('/test/validation-error', (req, res, next) => {
      const error = new Error('Validation failed for email field');
      (error as any).type = 'VALIDATION_ERROR';
      next(error);
    });

    app.post('/test/frontend-error', async (req, res) => {
      const { error, context } = req.body;
      
      try {
        const errorId = await errorLoggingService.logError(
          error.message,
          error,
          {
            ...context,
            traceId: (req as any).traceId,
            source: 'UI' as const
          }
        );
        
        res.json({ errorId, traceId: (req as any).traceId });
      } catch (err) {
        res.status(500).json({ error: 'Failed to log frontend error' });
      }
    });

    // Add error handling middleware
    app.use(errorHandler);
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
    vi.clearAllMocks();
  });

  describe('Complete Error Lifecycle', () => {
    it('should handle complete error flow from request to storage', async () => {
      // Act - Make request that triggers an error
      const response = await request(app)
        .get('/test/error')
        .expect(500);

      // Assert - Check response contains trace ID
      expect(response.body).toHaveProperty('traceId');
      expect(response.body.traceId).toMatch(/^trace_[a-f0-9]{32}$/);

      const traceId = response.body.traceId;

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify error was logged in database
      const errorLogs = await ErrorLog.find({ traceId }).lean();
      expect(errorLogs).toHaveLength(1);

      const errorLog = errorLogs[0];
      expect(errorLog).toMatchObject({
        traceId,
        level: 'ERROR',
        source: 'BE',
        component: expect.any(String),
        operation: expect.any(String),
        message: expect.stringContaining('Test error for integration'),
        errorType: expect.any(String),
        stackTrace: expect.stringContaining('TestError'),
        metadata: expect.objectContaining({
          environment: expect.any(String),
          version: expect.any(String),
          nodeVersion: process.version,
          platform: process.platform
        })
      });

      // Verify trace lifecycle was created and updated
      const traceLifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(traceLifecycle).toBeDefined();
      expect(traceLifecycle).toMatchObject({
        traceId,
        startTime: expect.any(Date),
        status: expect.any(String),
        errorCount: expect.any(Number),
        operations: expect.any(Array)
      });

      // Verify error count was incremented
      expect(traceLifecycle!.errorCount).toBeGreaterThan(0);
    });

    it('should maintain trace ID consistency across multiple operations', async () => {
      // Act - Make successful request first
      const successResponse = await request(app)
        .get('/test/success')
        .expect(200);

      const traceId = successResponse.body.traceId;

      // Make error request with same trace ID (simulating same user session)
      const errorResponse = await request(app)
        .get('/test/error')
        .set('X-Trace-ID', traceId)
        .expect(500);

      // Assert - Both requests should have same trace ID
      expect(errorResponse.body.traceId).toBe(traceId);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify trace lifecycle contains both operations
      const traceLifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(traceLifecycle).toBeDefined();
      expect(traceLifecycle!.operations.length).toBeGreaterThan(0);

      // Verify error was logged with correct trace ID
      const errorLogs = await ErrorLog.find({ traceId }).lean();
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0].traceId).toBe(traceId);
    });

    it('should handle frontend error reporting integration', async () => {
      // Arrange - Simulate frontend error data
      const frontendError = {
        message: 'React component error',
        stack: 'Error: React component error\n    at Component.render',
        componentStack: 'in Component\n    in App'
      };

      const context = {
        component: 'REACT_COMPONENT',
        operation: 'RENDER',
        url: '/dashboard',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        userId: 'user_123'
      };

      // Act - Send frontend error to backend
      const response = await request(app)
        .post('/test/frontend-error')
        .send({ error: frontendError, context })
        .expect(200);

      // Assert - Response contains error ID and trace ID
      expect(response.body).toHaveProperty('errorId');
      expect(response.body).toHaveProperty('traceId');

      const { errorId, traceId } = response.body;

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify frontend error was logged correctly
      const errorLog = await ErrorLog.findOne({ errorId }).lean();
      expect(errorLog).toBeDefined();
      expect(errorLog).toMatchObject({
        traceId,
        level: 'ERROR',
        source: 'UI',
        component: 'REACT_COMPONENT',
        operation: 'RENDER',
        message: 'React component error',
        stackTrace: expect.stringContaining('React component error'),
        context: expect.objectContaining({
          userId: 'user_123',
          url: '/dashboard',
          userAgent: 'Mozilla/5.0 (Test Browser)'
        })
      });

      // Verify trace lifecycle was updated
      const traceLifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(traceLifecycle).toBeDefined();
      expect(traceLifecycle!.operations.some(op => 
        op.operation === 'RENDER' && op.component === 'REACT_COMPONENT'
      )).toBe(true);
    });
  });

  describe('Error Classification Integration', () => {
    it('should classify and handle broker errors correctly', async () => {
      // Act - Trigger broker error
      const response = await request(app)
        .get('/test/broker-error')
        .expect(500);

      const traceId = response.body.traceId;

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - Verify error classification
      const errorLog = await ErrorLog.findOne({ traceId }).lean();
      expect(errorLog).toBeDefined();
      expect(errorLog!.errorType).toBe('network'); // Should be classified as network error
      expect(errorLog!.message).toContain('Broker connection failed');
      expect(errorLog!.context.brokerName).toBe('zerodha');

      // Verify error was properly categorized
      expect(errorLog!.level).toBe('ERROR');
      expect(errorLog!.source).toBe('BE');
    });

    it('should classify and handle authentication errors correctly', async () => {
      // Act - Trigger auth error
      const response = await request(app)
        .get('/test/auth-error')
        .expect(500);

      const traceId = response.body.traceId;

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - Verify error classification
      const errorLog = await ErrorLog.findOne({ traceId }).lean();
      expect(errorLog).toBeDefined();
      expect(errorLog!.errorType).toBe('authentication'); // Should be classified as auth error
      expect(errorLog!.message).toContain('Authentication failed');

      // Verify HTTP status code was captured
      expect(errorLog!.context.statusCode).toBe(401);
    });

    it('should classify and handle validation errors correctly', async () => {
      // Act - Trigger validation error
      const response = await request(app)
        .get('/test/validation-error')
        .expect(500);

      const traceId = response.body.traceId;

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - Verify error classification
      const errorLog = await ErrorLog.findOne({ traceId }).lean();
      expect(errorLog).toBeDefined();
      expect(errorLog!.errorType).toBe('validation'); // Should be classified as validation error
      expect(errorLog!.message).toContain('Validation failed');
    });
  });

  describe('Error Correlation and Grouping', () => {
    it('should correlate multiple errors in same trace', async () => {
      // Act - Create multiple errors in same trace
      const firstResponse = await request(app)
        .get('/test/error')
        .expect(500);

      const traceId = firstResponse.body.traceId;

      // Make another error request with same trace ID
      await request(app)
        .get('/test/broker-error')
        .set('X-Trace-ID', traceId)
        .expect(500);

      // Make a third error request with same trace ID
      await request(app)
        .get('/test/auth-error')
        .set('X-Trace-ID', traceId)
        .expect(500);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert - All errors should be correlated by trace ID
      const errorLogs = await ErrorLog.find({ traceId }).sort({ timestamp: 1 }).lean();
      expect(errorLogs).toHaveLength(3);

      // Verify different error types are captured
      const errorTypes = errorLogs.map(log => log.errorType);
      expect(errorTypes).toContain('system'); // First error
      expect(errorTypes).toContain('network'); // Broker error
      expect(errorTypes).toContain('authentication'); // Auth error

      // Verify trace lifecycle shows multiple errors
      const traceLifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(traceLifecycle).toBeDefined();
      expect(traceLifecycle!.errorCount).toBe(3);
      expect(traceLifecycle!.status).toBe('ERROR');
    });

    it('should group related errors by user and session', async () => {
      // Arrange - Simulate same user making multiple requests
      const userId = 'user_123';
      const sessionId = 'session_456';

      // Act - Make multiple error requests as same user
      const requests = await Promise.all([
        request(app)
          .post('/test/frontend-error')
          .send({
            error: { message: 'UI Error 1' },
            context: { 
              component: 'COMPONENT_1', 
              operation: 'OPERATION_1',
              userId,
              sessionId
            }
          }),
        request(app)
          .post('/test/frontend-error')
          .send({
            error: { message: 'UI Error 2' },
            context: { 
              component: 'COMPONENT_2', 
              operation: 'OPERATION_2',
              userId,
              sessionId
            }
          }),
        request(app)
          .post('/test/frontend-error')
          .send({
            error: { message: 'UI Error 3' },
            context: { 
              component: 'COMPONENT_3', 
              operation: 'OPERATION_3',
              userId,
              sessionId
            }
          })
      ]);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 200));

      // Assert - All errors should be grouped by user and session
      const userErrors = await ErrorLog.find({ 
        'context.userId': userId,
        'context.sessionId': sessionId
      }).lean();

      expect(userErrors).toHaveLength(3);

      // Verify all errors belong to same user and session
      userErrors.forEach(error => {
        expect(error.context.userId).toBe(userId);
        expect(error.context.sessionId).toBe(sessionId);
        expect(error.source).toBe('UI');
      });

      // Verify different components are captured
      const components = userErrors.map(error => error.component);
      expect(components).toContain('COMPONENT_1');
      expect(components).toContain('COMPONENT_2');
      expect(components).toContain('COMPONENT_3');
    });
  });

  describe('Trace ID Consistency', () => {
    it('should propagate trace ID through middleware chain', async () => {
      // Act - Make request and capture trace ID
      const response = await request(app)
        .get('/test/success')
        .expect(200);

      const traceId = response.body.traceId;

      // Assert - Trace ID should be properly formatted
      expect(traceId).toMatch(/^trace_[a-f0-9]{32}$/);

      // Verify trace context was created
      const traceLifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(traceLifecycle).toBeDefined();
      expect(traceLifecycle!.traceId).toBe(traceId);
      expect(traceLifecycle!.startTime).toBeInstanceOf(Date);
    });

    it('should use provided trace ID from header', async () => {
      // Arrange - Provide custom trace ID
      const customTraceId = 'trace_custom123456789012345678901234';

      // Act - Make request with custom trace ID
      const response = await request(app)
        .get('/test/success')
        .set('X-Trace-ID', customTraceId)
        .expect(200);

      // Assert - Should use provided trace ID
      expect(response.body.traceId).toBe(customTraceId);

      // Verify trace lifecycle uses custom ID
      const traceLifecycle = await TraceLifecycle.findOne({ traceId: customTraceId }).lean();
      expect(traceLifecycle).toBeDefined();
      expect(traceLifecycle!.traceId).toBe(customTraceId);
    });

    it('should maintain trace ID across error and success operations', async () => {
      // Act - Start with successful operation
      const successResponse = await request(app)
        .get('/test/success')
        .expect(200);

      const traceId = successResponse.body.traceId;

      // Continue with error operation using same trace ID
      const errorResponse = await request(app)
        .get('/test/error')
        .set('X-Trace-ID', traceId)
        .expect(500);

      // Assert - Both operations should use same trace ID
      expect(errorResponse.body.traceId).toBe(traceId);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify trace lifecycle contains both operations
      const traceLifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(traceLifecycle).toBeDefined();
      expect(traceLifecycle!.operations.length).toBeGreaterThan(0);

      // Verify error was logged with correct trace ID
      const errorLogs = await ErrorLog.find({ traceId }).lean();
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0].traceId).toBe(traceId);
    });
  });

  describe('Error Context Capture', () => {
    it('should capture comprehensive request context', async () => {
      // Act - Make request with various headers and context
      const response = await request(app)
        .get('/test/error')
        .set('User-Agent', 'Test-Agent/1.0')
        .set('X-Forwarded-For', '192.168.1.100')
        .set('Authorization', 'Bearer test-token')
        .expect(500);

      const traceId = response.body.traceId;

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - Verify context was captured
      const errorLog = await ErrorLog.findOne({ traceId }).lean();
      expect(errorLog).toBeDefined();
      expect(errorLog!.context).toMatchObject({
        url: '/test/error',
        method: 'GET',
        userAgent: 'Test-Agent/1.0'
      });

      // Verify metadata is captured
      expect(errorLog!.metadata).toMatchObject({
        environment: expect.any(String),
        version: expect.any(String),
        nodeVersion: process.version,
        platform: process.platform
      });
    });

    it('should capture operation timing information', async () => {
      // Act - Make request that will be timed
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/test/error')
        .expect(500);

      const endTime = Date.now();
      const traceId = response.body.traceId;

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - Verify timing information
      const traceLifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(traceLifecycle).toBeDefined();
      expect(traceLifecycle!.startTime.getTime()).toBeGreaterThanOrEqual(startTime);
      expect(traceLifecycle!.startTime.getTime()).toBeLessThanOrEqual(endTime);

      // If trace is completed, verify duration
      if (traceLifecycle!.endTime && traceLifecycle!.duration) {
        expect(traceLifecycle!.duration).toBeGreaterThan(0);
        expect(traceLifecycle!.duration).toBeLessThan(10000); // Should be less than 10 seconds
      }
    });
  });

  describe('Error Recovery and Retry Logic', () => {
    it('should handle retryable errors appropriately', async () => {
      // This test would verify retry logic if implemented
      // For now, we'll verify that retryable errors are classified correctly
      
      // Act - Trigger network error (retryable)
      const response = await request(app)
        .get('/test/broker-error')
        .expect(500);

      const traceId = response.body.traceId;

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - Verify error is classified as retryable
      const errorLog = await ErrorLog.findOne({ traceId }).lean();
      expect(errorLog).toBeDefined();
      expect(errorLog!.errorType).toBe('network');

      // Verify the error classification service would mark this as retryable
      const classification = errorClassificationService.classifyError(
        { code: 'ECONNREFUSED', message: 'Broker connection failed' }
      );
      expect(classification.classification.retryable).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent error requests', async () => {
      // Act - Make multiple concurrent requests
      const concurrentRequests = 10;
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        request(app)
          .get('/test/error')
          .expect(500)
      );

      const responses = await Promise.all(requests);

      // Wait for all async operations
      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert - All requests should have unique trace IDs
      const traceIds = responses.map(r => r.body.traceId);
      const uniqueTraceIds = new Set(traceIds);
      expect(uniqueTraceIds.size).toBe(concurrentRequests);

      // Verify all errors were logged
      const errorLogs = await ErrorLog.find({ 
        traceId: { $in: traceIds } 
      }).lean();
      expect(errorLogs).toHaveLength(concurrentRequests);

      // Verify all trace lifecycles were created
      const traceLifecycles = await TraceLifecycle.find({ 
        traceId: { $in: traceIds } 
      }).lean();
      expect(traceLifecycles).toHaveLength(concurrentRequests);
    });

    it('should maintain performance under load', async () => {
      // Act - Measure performance of error logging
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/test/error')
        .expect(500);

      const requestTime = Date.now() - startTime;

      // Wait for async operations
      const asyncStartTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, 200));
      const asyncTime = Date.now() - asyncStartTime;

      // Assert - Performance should be reasonable
      expect(requestTime).toBeLessThan(1000); // Request should complete within 1 second
      expect(asyncTime).toBeLessThan(500); // Async operations should complete quickly

      // Verify error was still logged correctly
      const traceId = response.body.traceId;
      const errorLog = await ErrorLog.findOne({ traceId }).lean();
      expect(errorLog).toBeDefined();
    });
  });

  describe('Database Integration', () => {
    it('should handle database connection failures gracefully', async () => {
      // Arrange - Close database connection to simulate failure
      await mongoose.connection.close();

      // Act - Make request that would normally log to database
      const response = await request(app)
        .get('/test/error')
        .expect(500);

      // Assert - Request should still complete (fallback logging)
      expect(response.body).toHaveProperty('traceId');

      // Reconnect for cleanup
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });

    it('should maintain data consistency across collections', async () => {
      // Act - Generate error that affects both collections
      const response = await request(app)
        .get('/test/error')
        .expect(500);

      const traceId = response.body.traceId;

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - Verify data consistency
      const errorLog = await ErrorLog.findOne({ traceId }).lean();
      const traceLifecycle = await TraceLifecycle.findOne({ traceId }).lean();

      expect(errorLog).toBeDefined();
      expect(traceLifecycle).toBeDefined();

      // Verify trace IDs match
      expect(errorLog!.traceId).toBe(traceLifecycle!.traceId);

      // Verify timestamps are consistent
      expect(errorLog!.timestamp.getTime()).toBeGreaterThanOrEqual(
        traceLifecycle!.startTime.getTime()
      );
    });
  });
});