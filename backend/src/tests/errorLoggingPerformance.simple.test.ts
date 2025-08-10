import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { ErrorLoggingService } from '../services/errorLoggingService';
import { TraceIdService } from '../services/traceIdService';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';

describe('Error Logging Performance Tests (Simple)', () => {
  let mongoServer: MongoMemoryServer;
  let errorLoggingService: ErrorLoggingService;
  let traceIdService: TraceIdService;

  beforeEach(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Get service instances
    errorLoggingService = ErrorLoggingService.getInstance();
    traceIdService = TraceIdService.getInstance();

    // Clear any existing data
    await ErrorLog.deleteMany({});
    await TraceLifecycle.deleteMany({});
  });

  afterEach(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  describe('Basic Performance Tests', () => {
    it('should handle moderate volume error logging efficiently', async () => {
      // Arrange
      const errorCount = 100; // Reduced for simple test
      const maxExecutionTime = 5000; // 5 seconds
      const errors = [];

      // Generate test errors
      for (let i = 0; i < errorCount; i++) {
        errors.push({
          message: `Performance test error ${i}`,
          error: new Error(`Test error ${i}`),
          context: {
            component: `COMPONENT_${i % 5}`,
            operation: `OPERATION_${i % 3}`,
            userId: `user_${i % 10}`,
            errorType: 'PERFORMANCE_TEST_ERROR'
          }
        });
      }

      // Act - Measure performance of bulk error logging
      const startTime = Date.now();
      
      const errorIds = await Promise.all(
        errors.map(({ message, error, context }) =>
          errorLoggingService.logError(message, error, context)
        )
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Assert - Performance requirements
      expect(executionTime).toBeLessThan(maxExecutionTime);
      expect(errorIds).toHaveLength(errorCount);
      
      // Verify all errors were logged
      const loggedErrors = await ErrorLog.countDocuments({});
      expect(loggedErrors).toBe(errorCount);

      // Calculate performance metrics
      const errorsPerSecond = (errorCount / executionTime) * 1000;
      const avgTimePerError = executionTime / errorCount;

      console.log(`Performance Metrics:
        - Total errors: ${errorCount}
        - Execution time: ${executionTime}ms
        - Errors per second: ${errorsPerSecond.toFixed(2)}
        - Average time per error: ${avgTimePerError.toFixed(2)}ms`);

      // Performance assertions
      expect(errorsPerSecond).toBeGreaterThan(10); // At least 10 errors per second
      expect(avgTimePerError).toBeLessThan(500); // Less than 500ms per error on average
    }, 10000); // 10 second timeout

    it('should handle trace operations efficiently', async () => {
      // Arrange
      const traceCount = 50; // Reduced for simple test
      const operationsPerTrace = 5;
      const maxExecutionTime = 5000; // 5 seconds

      // Act - Create traces with operations
      const startTime = Date.now();
      
      const tracePromises = Array.from({ length: traceCount }, async (_, traceIndex) => {
        const traceContext = await traceIdService.createTraceContext();
        const traceId = traceContext.traceId;

        // Add operations to trace
        for (let opIndex = 0; opIndex < operationsPerTrace; opIndex++) {
          await traceIdService.addOperation(
            traceId,
            `OPERATION_${opIndex}`,
            `COMPONENT_${opIndex % 3}`
          );
          
          // Complete some operations
          if (opIndex % 2 === 0) {
            await traceIdService.completeOperation(
              traceId,
              `OPERATION_${opIndex}`,
              opIndex % 4 === 0 ? 'ERROR' : 'SUCCESS'
            );
          }
        }

        // Complete trace
        await traceIdService.completeTrace(traceId, 'SUCCESS');
        
        return traceId;
      });

      const traceIds = await Promise.all(tracePromises);
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Assert - Performance requirements
      expect(executionTime).toBeLessThan(maxExecutionTime);
      expect(traceIds).toHaveLength(traceCount);

      // Verify traces were created
      const traceLifecycles = await TraceLifecycle.countDocuments({});
      expect(traceLifecycles).toBe(traceCount);

      // Calculate performance metrics
      const totalOperations = traceCount * operationsPerTrace;
      const operationsPerSecond = (totalOperations / executionTime) * 1000;

      console.log(`Trace Performance Metrics:
        - Total traces: ${traceCount}
        - Operations per trace: ${operationsPerTrace}
        - Total operations: ${totalOperations}
        - Execution time: ${executionTime}ms
        - Operations per second: ${operationsPerSecond.toFixed(2)}`);

      expect(operationsPerSecond).toBeGreaterThan(20); // At least 20 operations per second
    }, 10000); // 10 second timeout

    it('should perform error searches efficiently', async () => {
      // Arrange - Create dataset for search testing
      const datasetSize = 200; // Reduced for simple test
      const maxSearchTime = 1000; // 1 second max

      // Create dataset
      const searchPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Search test error ${i}`,
          new Error(`Search error ${i}`),
          {
            component: `SEARCH_COMPONENT_${i % 10}`,
            operation: `SEARCH_OPERATION_${i % 5}`,
            userId: `search_user_${i % 20}`,
            errorType: `SEARCH_ERROR_TYPE_${i % 8}`,
            level: (['ERROR', 'WARN', 'INFO'] as const)[i % 3]
          }
        );
        searchPromises.push(promise);
      }

      await Promise.all(searchPromises);

      // Act & Assert - Test search operations
      const searchTests = [
        {
          name: 'Search by level',
          filters: { level: ['ERROR'] }
        },
        {
          name: 'Search by component',
          filters: { component: ['SEARCH_COMPONENT_1', 'SEARCH_COMPONENT_2'] }
        },
        {
          name: 'Search by user',
          filters: { userId: 'search_user_5' }
        }
      ];

      for (const test of searchTests) {
        const startTime = Date.now();
        
        const results = await errorLoggingService.searchErrorLogs(test.filters);
        
        const endTime = Date.now();
        const queryTime = endTime - startTime;

        console.log(`${test.name}: ${queryTime}ms (${results.total} results)`);

        // Assert - Query performance
        expect(queryTime).toBeLessThan(maxSearchTime);
        expect(results.errors).toBeDefined();
        expect(results.total).toBeGreaterThanOrEqual(0);
      }
    }, 10000); // 10 second timeout

    it('should handle analytics efficiently', async () => {
      // Arrange - Create dataset for analytics
      const datasetSize = 150; // Reduced for simple test
      const maxAnalyticsTime = 2000; // 2 seconds max

      // Create dataset
      const analyticsPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Analytics test error ${i}`,
          new Error(`Analytics error ${i}`),
          {
            component: `ANALYTICS_COMP_${(i % 3) + 1}`,
            operation: `ANALYTICS_OP_${i % 4}`,
            userId: `analytics_user_${i % 15}`,
            errorType: `ERROR_TYPE_${(i % 3) + 1}`,
            level: (['ERROR', 'WARN', 'INFO'] as const)[i % 3]
          }
        );
        analyticsPromises.push(promise);
      }

      await Promise.all(analyticsPromises);

      // Act - Test analytics operations
      const analyticsTests = [
        {
          name: 'Basic error analytics',
          operation: () => errorLoggingService.getErrorAnalytics(86400000)
        },
        {
          name: 'Error patterns detection',
          operation: () => errorLoggingService.getErrorPatterns(86400000)
        }
      ];

      for (const test of analyticsTests) {
        const startTime = Date.now();
        
        const result = await test.operation();
        
        const endTime = Date.now();
        const operationTime = endTime - startTime;

        console.log(`${test.name}: ${operationTime}ms`);

        // Assert - Analytics performance
        expect(operationTime).toBeLessThan(maxAnalyticsTime);
        expect(result).toBeDefined();
      }
    }, 15000); // 15 second timeout
  });
});