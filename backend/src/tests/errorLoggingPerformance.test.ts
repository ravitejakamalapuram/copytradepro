import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { ErrorLoggingService } from '../services/errorLoggingService';
import { TraceIdService } from '../services/traceIdService';
import { ErrorAggregationService } from '../services/errorAggregationService';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';

// Mock logger to avoid console output during tests
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Error Logging Performance Tests', () => {
  let mongoServer: MongoMemoryServer;
  let errorLoggingService: ErrorLoggingService;
  let traceIdService: TraceIdService;
  let errorAggregationService: ErrorAggregationService;

  beforeEach(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Get service instances
    errorLoggingService = ErrorLoggingService.getInstance();
    traceIdService = TraceIdService.getInstance();
    errorAggregationService = new ErrorAggregationService();

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

  describe('High Load Error Logging Performance', () => {
    it('should handle high volume error logging efficiently', async () => {
      // Arrange
      const errorCount = 1000;
      const maxExecutionTime = 10000; // 10 seconds
      const errors = [];

      // Generate test errors
      for (let i = 0; i < errorCount; i++) {
        errors.push({
          message: `High load test error ${i}`,
          error: new Error(`Test error ${i}`),
          context: {
            component: `COMPONENT_${i % 10}`,
            operation: `OPERATION_${i % 5}`,
            userId: `user_${i % 100}`,
            brokerName: i % 2 === 0 ? 'zerodha' : 'upstox',
            errorType: 'LOAD_TEST_ERROR'
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
      expect(errorsPerSecond).toBeGreaterThan(50); // At least 50 errors per second
      expect(avgTimePerError).toBeLessThan(200); // Less than 200ms per error on average
    });

    it('should maintain performance under concurrent error logging', async () => {
      // Arrange
      const concurrentBatches = 10;
      const errorsPerBatch = 100;
      const maxExecutionTime = 15000; // 15 seconds

      // Act - Create concurrent error logging batches
      const startTime = Date.now();

      const batchPromises = Array.from({ length: concurrentBatches }, async (_, batchIndex) => {
        const batchErrors = [];
        
        for (let i = 0; i < errorsPerBatch; i++) {
          const errorPromise = errorLoggingService.logError(
            `Concurrent batch ${batchIndex} error ${i}`,
            new Error(`Batch ${batchIndex} error ${i}`),
            {
              component: `BATCH_COMPONENT_${batchIndex}`,
              operation: `BATCH_OPERATION_${i}`,
              userId: `batch_user_${batchIndex}_${i}`,
              batchId: batchIndex,
              errorType: 'CONCURRENT_TEST_ERROR'
            }
          );
          
          batchErrors.push(errorPromise);
        }
        
        return Promise.all(batchErrors);
      });

      const results = await Promise.all(batchPromises);
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Assert - Performance and correctness
      expect(executionTime).toBeLessThan(maxExecutionTime);
      
      // Verify all batches completed
      expect(results).toHaveLength(concurrentBatches);
      results.forEach(batch => {
        expect(batch).toHaveLength(errorsPerBatch);
      });

      // Verify total error count
      const totalErrors = await ErrorLog.countDocuments({});
      expect(totalErrors).toBe(concurrentBatches * errorsPerBatch);

      // Calculate concurrent performance metrics
      const totalErrorCount = concurrentBatches * errorsPerBatch;
      const concurrentErrorsPerSecond = (totalErrorCount / executionTime) * 1000;

      console.log(`Concurrent Performance Metrics:
        - Concurrent batches: ${concurrentBatches}
        - Errors per batch: ${errorsPerBatch}
        - Total errors: ${totalErrorCount}
        - Execution time: ${executionTime}ms
        - Concurrent errors per second: ${concurrentErrorsPerSecond.toFixed(2)}`);

      expect(concurrentErrorsPerSecond).toBeGreaterThan(30); // At least 30 errors per second under concurrency
    });

    it('should handle memory efficiently during high load', async () => {
      // Arrange
      const errorCount = 500;
      const memoryThreshold = 100 * 1024 * 1024; // 100MB threshold

      // Measure initial memory usage
      const initialMemory = process.memoryUsage();

      // Act - Generate errors and monitor memory
      const errorIds = [];
      
      for (let i = 0; i < errorCount; i++) {
        const errorId = await errorLoggingService.logError(
          `Memory test error ${i}`,
          new Error(`Large error with stack trace ${i}`),
          {
            component: 'MEMORY_TEST_COMPONENT',
            operation: 'MEMORY_TEST_OPERATION',
            userId: `memory_user_${i}`,
            largeContext: {
              data: 'x'.repeat(1000), // 1KB of data per error
              metadata: {
                timestamp: new Date(),
                requestId: `req_${i}`,
                additionalData: Array.from({ length: 100 }, (_, j) => `item_${j}`)
              }
            },
            errorType: 'MEMORY_TEST_ERROR'
          }
        );
        
        errorIds.push(errorId);

        // Check memory usage periodically
        if (i % 100 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
          
          // Memory should not grow excessively
          expect(memoryIncrease).toBeLessThan(memoryThreshold);
        }
      }

      // Assert - Final memory check
      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Memory Usage Metrics:
        - Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Memory increase: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB
        - Errors logged: ${errorCount}`);

      expect(totalMemoryIncrease).toBeLessThan(memoryThreshold);
      expect(errorIds).toHaveLength(errorCount);

      // Verify all errors were persisted
      const persistedErrors = await ErrorLog.countDocuments({});
      expect(persistedErrors).toBe(errorCount);
    });
  });

  describe('Database Query Performance', () => {
    it('should perform error searches efficiently with large datasets', async () => {
      // Arrange - Create large dataset
      const datasetSize = 5000;
      const searchTime = 2000; // 2 seconds max

      // Create diverse error dataset
      const errorPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Search test error ${i}`,
          new Error(`Error ${i}`),
          {
            component: `COMPONENT_${i % 20}`,
            operation: `OPERATION_${i % 10}`,
            userId: `user_${i % 500}`,
            brokerName: ['zerodha', 'upstox', 'fyers', 'angel'][i % 4],
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any,
            errorType: ['NETWORK_ERROR', 'AUTH_ERROR', 'VALIDATION_ERROR', 'SYSTEM_ERROR'][i % 4]
          }
        );
        errorPromises.push(promise);
      }

      await Promise.all(errorPromises);

      // Act - Perform various search operations and measure performance
      const searchTests = [
        {
          name: 'Search by level',
          filters: { level: ['ERROR'] }
        },
        {
          name: 'Search by component',
          filters: { component: ['COMPONENT_1', 'COMPONENT_2'] }
        },
        {
          name: 'Search by user',
          filters: { userId: 'user_100' }
        },
        {
          name: 'Search by broker',
          filters: { brokerName: 'zerodha' }
        },
        {
          name: 'Search by date range',
          filters: {
            startDate: new Date(Date.now() - 3600000), // 1 hour ago
            endDate: new Date()
          }
        },
        {
          name: 'Complex search',
          filters: {
            level: ['ERROR', 'WARN'],
            component: ['COMPONENT_1', 'COMPONENT_2', 'COMPONENT_3'],
            errorType: ['NETWORK_ERROR', 'AUTH_ERROR'],
            limit: 100
          }
        }
      ];

      for (const test of searchTests) {
        const startTime = Date.now();
        
        const results = await errorLoggingService.searchErrorLogs(test.filters);
        
        const endTime = Date.now();
        const queryTime = endTime - startTime;

        console.log(`${test.name}: ${queryTime}ms (${results.total} results)`);

        // Assert - Query performance
        expect(queryTime).toBeLessThan(searchTime);
        expect(results.errors).toBeDefined();
        expect(results.total).toBeGreaterThanOrEqual(0);
      }
    });

    it('should perform error analytics efficiently with large datasets', async () => {
      // Arrange - Create dataset with known patterns
      const datasetSize = 3000;
      const analyticsTime = 5000; // 5 seconds max

      // Create structured dataset for analytics
      const components = ['AUTH_SERVICE', 'BROKER_SERVICE', 'DATABASE_SERVICE', 'API_GATEWAY'];
      const errorTypes = ['CONNECTION_ERROR', 'TIMEOUT_ERROR', 'VALIDATION_ERROR', 'SYSTEM_ERROR'];
      const brokers = ['zerodha', 'upstox', 'fyers'];

      const errorPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Analytics test error ${i}`,
          new Error(`Error ${i}`),
          {
            component: components[i % components.length],
            operation: `OPERATION_${i % 5}`,
            userId: `user_${i % 200}`,
            brokerName: brokers[i % brokers.length],
            errorType: errorTypes[i % errorTypes.length],
            level: i % 3 === 0 ? 'ERROR' : 'WARN' as any
          }
        );
        errorPromises.push(promise);
      }

      await Promise.all(errorPromises);

      // Act - Perform analytics operations
      const analyticsTests = [
        {
          name: 'Basic analytics',
          operation: () => errorLoggingService.getErrorAnalytics()
        },
        {
          name: 'Error patterns',
          operation: () => errorLoggingService.getErrorPatterns()
        },
        {
          name: 'Error insights',
          operation: () => errorLoggingService.generateErrorInsights()
        },
        {
          name: 'Error aggregation',
          operation: () => errorAggregationService.aggregateErrors({
            timeRange: {
              start: new Date(Date.now() - 3600000),
              end: new Date(),
              granularity: 'hour'
            }
          })
        },
        {
          name: 'Impact analysis',
          operation: () => errorAggregationService.analyzeErrorImpact({
            start: new Date(Date.now() - 3600000),
            end: new Date()
          })
        }
      ];

      for (const test of analyticsTests) {
        const startTime = Date.now();
        
        const result = await test.operation();
        
        const endTime = Date.now();
        const operationTime = endTime - startTime;

        console.log(`${test.name}: ${operationTime}ms`);

        // Assert - Analytics performance
        expect(operationTime).toBeLessThan(analyticsTime);
        expect(result).toBeDefined();
      }
    });

    it('should handle database indexing efficiently', async () => {
      // Arrange - Create dataset to test index performance
      const datasetSize = 2000;
      const indexedFields = ['traceId', 'timestamp', 'component', 'errorType', 'context.userId'];

      // Create dataset
      const errorPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Index test error ${i}`,
          new Error(`Error ${i}`),
          {
            component: `COMPONENT_${i % 15}`,
            operation: `OPERATION_${i % 8}`,
            userId: `user_${i % 300}`,
            errorType: `ERROR_TYPE_${i % 12}`,
            sessionId: `session_${i % 100}`
          }
        );
        errorPromises.push(promise);
      }

      await Promise.all(errorPromises);

      // Act - Test queries that should use indexes
      const indexTests = [
        {
          name: 'Query by traceId (indexed)',
          query: async () => {
            const errors = await ErrorLog.find({}).limit(1).lean();
            if (errors.length > 0) {
              return ErrorLog.find({ traceId: errors[0].traceId }).lean();
            }
            return [];
          }
        },
        {
          name: 'Query by timestamp range (indexed)',
          query: () => ErrorLog.find({
            timestamp: {
              $gte: new Date(Date.now() - 1800000), // 30 minutes ago
              $lte: new Date()
            }
          }).lean()
        },
        {
          name: 'Query by component (indexed)',
          query: () => ErrorLog.find({ component: 'COMPONENT_1' }).lean()
        },
        {
          name: 'Query by errorType (indexed)',
          query: () => ErrorLog.find({ errorType: 'ERROR_TYPE_1' }).lean()
        },
        {
          name: 'Query by userId (indexed)',
          query: () => ErrorLog.find({ 'context.userId': 'user_100' }).lean()
        },
        {
          name: 'Compound index query',
          query: () => ErrorLog.find({
            component: 'COMPONENT_1',
            errorType: 'ERROR_TYPE_1',
            timestamp: { $gte: new Date(Date.now() - 3600000) }
          }).lean()
        }
      ];

      for (const test of indexTests) {
        const startTime = Date.now();
        
        const results = await test.query();
        
        const endTime = Date.now();
        const queryTime = endTime - startTime;

        console.log(`${test.name}: ${queryTime}ms (${results.length} results)`);

        // Assert - Indexed queries should be fast
        expect(queryTime).toBeLessThan(500); // Less than 500ms for indexed queries
        expect(results).toBeDefined();
      }
    });
  });

  describe('Trace ID Service Performance', () => {
    it('should handle high volume trace operations efficiently', async () => {
      // Arrange
      const traceCount = 1000;
      const operationsPerTrace = 10;
      const maxExecutionTime = 15000; // 15 seconds

      // Act - Create many traces with operations
      const startTime = Date.now();
      
      const tracePromises = Array.from({ length: traceCount }, async (_, traceIndex) => {
        const traceContext = await traceIdService.createTraceContext();
        const traceId = traceContext.traceId;

        // Add operations to trace
        const operationPromises = Array.from({ length: operationsPerTrace }, async (_, opIndex) => {
          await traceIdService.addOperation(
            traceId,
            `OPERATION_${opIndex}`,
            `COMPONENT_${opIndex % 5}`
          );
          
          // Complete some operations
          if (opIndex % 2 === 0) {
            await traceIdService.completeOperation(
              traceId,
              `OPERATION_${opIndex}`,
              opIndex % 4 === 0 ? 'ERROR' : 'SUCCESS'
            );
          }
        });

        await Promise.all(operationPromises);
        
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

      expect(operationsPerSecond).toBeGreaterThan(100); // At least 100 operations per second
    });

    it('should maintain memory efficiency with active traces', async () => {
      // Arrange
      const activeTraceCount = 500;
      const memoryThreshold = 50 * 1024 * 1024; // 50MB threshold

      const initialMemory = process.memoryUsage();

      // Act - Create many active traces (not completed)
      const activeTraces = [];
      
      for (let i = 0; i < activeTraceCount; i++) {
        const traceContext = await traceIdService.createTraceContext();
        
        // Add operations but don't complete trace
        await traceIdService.addOperation(
          traceContext.traceId,
          `OPERATION_${i}`,
          `COMPONENT_${i % 10}`
        );
        
        activeTraces.push(traceContext.traceId);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Assert - Memory efficiency
      expect(memoryIncrease).toBeLessThan(memoryThreshold);
      expect(activeTraces).toHaveLength(activeTraceCount);

      // Verify traces are in memory
      const activeTraceIds = traceIdService.getActiveTraceIds();
      expect(activeTraceIds.length).toBeGreaterThanOrEqual(activeTraceCount);

      console.log(`Active Trace Memory Metrics:
        - Active traces: ${activeTraceCount}
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB
        - Memory per trace: ${(memoryIncrease / activeTraceCount / 1024).toFixed(2)}KB`);

      // Cleanup - Complete traces to free memory
      for (const traceId of activeTraces) {
        await traceIdService.completeTrace(traceId, 'SUCCESS');
      }

      // Verify cleanup
      const finalActiveTraces = traceIdService.getActiveTraceIds();
      expect(finalActiveTraces.length).toBeLessThan(activeTraceCount);
    });

    it('should handle trace statistics efficiently', async () => {
      // Arrange - Create traces with different outcomes
      const traceCount = 1000;
      const statsTime = 1000; // 1 second max

      // Create traces
      const tracePromises = Array.from({ length: traceCount }, async (_, i) => {
        const traceContext = await traceIdService.createTraceContext();
        const traceId = traceContext.traceId;
        
        await traceIdService.addOperation(traceId, 'TEST_OPERATION', 'TEST_COMPONENT');
        await traceIdService.completeOperation(
          traceId,
          'TEST_OPERATION',
          i % 3 === 0 ? 'ERROR' : 'SUCCESS'
        );
        await traceIdService.completeTrace(
          traceId,
          i % 3 === 0 ? 'ERROR' : 'SUCCESS'
        );
        
        return traceId;
      });

      await Promise.all(tracePromises);

      // Act - Measure statistics performance
      const startTime = Date.now();
      
      const stats = await traceIdService.getTraceStatistics();
      
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // Assert - Statistics performance
      expect(queryTime).toBeLessThan(statsTime);
      expect(stats.totalTraces).toBe(traceCount);
      expect(stats.successfulTraces).toBeGreaterThan(0);
      expect(stats.errorTraces).toBeGreaterThan(0);
      expect(stats.averageDuration).toBeGreaterThan(0);

      console.log(`Trace Statistics Performance:
        - Query time: ${queryTime}ms
        - Total traces: ${stats.totalTraces}
        - Successful: ${stats.successfulTraces}
        - Errors: ${stats.errorTraces}
        - Avg duration: ${stats.averageDuration}ms`);
    });
  });

  describe('Real-time Performance', () => {
    it('should maintain low latency under continuous load', async () => {
      // Arrange
      const testDuration = 10000; // 10 seconds
      const targetLatency = 100; // 100ms max per operation
      const operations = [];

      // Act - Continuous error logging for test duration
      const startTime = Date.now();
      let operationCount = 0;
      
      while (Date.now() - startTime < testDuration) {
        const operationStart = Date.now();
        
        await errorLoggingService.logError(
          `Continuous load error ${operationCount}`,
          new Error(`Load test error ${operationCount}`),
          {
            component: 'LOAD_TEST_COMPONENT',
            operation: 'CONTINUOUS_OPERATION',
            userId: `load_user_${operationCount % 50}`,
            errorType: 'CONTINUOUS_LOAD_ERROR'
          }
        );
        
        const operationEnd = Date.now();
        const latency = operationEnd - operationStart;
        
        operations.push({ latency, timestamp: operationEnd });
        operationCount++;

        // Brief pause to simulate realistic load
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const totalTime = Date.now() - startTime;

      // Assert - Latency requirements
      const avgLatency = operations.reduce((sum, op) => sum + op.latency, 0) / operations.length;
      const maxLatency = Math.max(...operations.map(op => op.latency));
      const p95Latency = operations
        .map(op => op.latency)
        .sort((a, b) => a - b)[Math.floor(operations.length * 0.95)];

      console.log(`Continuous Load Performance:
        - Test duration: ${totalTime}ms
        - Operations: ${operationCount}
        - Avg latency: ${avgLatency.toFixed(2)}ms
        - Max latency: ${maxLatency}ms
        - P95 latency: ${p95Latency}ms
        - Operations per second: ${((operationCount / totalTime) * 1000).toFixed(2)}`);

      expect(avgLatency).toBeLessThan(targetLatency);
      expect(p95Latency).toBeLessThan(targetLatency * 2); // P95 can be higher but reasonable
      expect(operationCount).toBeGreaterThan(50); // Should complete reasonable number of operations
    });

    it('should handle burst traffic efficiently', async () => {
      // Arrange - Simulate traffic bursts
      const burstSize = 200;
      const burstCount = 5;
      const burstInterval = 1000; // 1 second between bursts
      const maxBurstTime = 2000; // 2 seconds max per burst

      // Act - Generate traffic bursts
      const burstResults = [];
      
      for (let burst = 0; burst < burstCount; burst++) {
        const burstStart = Date.now();
        
        // Create burst of errors
        const burstPromises = Array.from({ length: burstSize }, (_, i) =>
          errorLoggingService.logError(
            `Burst ${burst} error ${i}`,
            new Error(`Burst error ${i}`),
            {
              component: 'BURST_COMPONENT',
              operation: 'BURST_OPERATION',
              userId: `burst_user_${i}`,
              burstId: burst,
              errorType: 'BURST_ERROR'
            }
          )
        );

        await Promise.all(burstPromises);
        
        const burstEnd = Date.now();
        const burstTime = burstEnd - burstStart;
        
        burstResults.push({
          burstId: burst,
          time: burstTime,
          errorsPerSecond: (burstSize / burstTime) * 1000
        });

        console.log(`Burst ${burst}: ${burstTime}ms (${burstResults[burst].errorsPerSecond.toFixed(2)} errors/sec)`);

        // Assert - Burst performance
        expect(burstTime).toBeLessThan(maxBurstTime);
        
        // Wait before next burst
        if (burst < burstCount - 1) {
          await new Promise(resolve => setTimeout(resolve, burstInterval));
        }
      }

      // Assert - Overall burst performance
      const avgBurstTime = burstResults.reduce((sum, b) => sum + b.time, 0) / burstResults.length;
      const avgErrorsPerSecond = burstResults.reduce((sum, b) => sum + b.errorsPerSecond, 0) / burstResults.length;

      expect(avgBurstTime).toBeLessThan(maxBurstTime);
      expect(avgErrorsPerSecond).toBeGreaterThan(50); // At least 50 errors per second during bursts

      // Verify all errors were logged
      const totalErrors = await ErrorLog.countDocuments({});
      expect(totalErrors).toBeGreaterThanOrEqual(burstSize * burstCount);
    });
  });

  describe('Resource Utilization', () => {
    it('should optimize database connection usage', async () => {
      // Arrange
      const operationCount = 500;
      const maxConnections = 10; // Assume reasonable connection pool size

      // Monitor connection usage (this would require database monitoring in real scenario)
      // For this test, we'll verify that operations complete without connection errors

      // Act - Perform many database operations
      const operations = Array.from({ length: operationCount }, async (_, i) => {
        const traceContext = await traceIdService.createTraceContext();
        
        const errorId = await errorLoggingService.logError(
          `Connection test error ${i}`,
          new Error(`Error ${i}`),
          {
            traceId: traceContext.traceId,
            component: 'CONNECTION_TEST_COMPONENT',
            operation: 'CONNECTION_TEST_OPERATION',
            userId: `conn_user_${i}`,
            errorType: 'CONNECTION_TEST_ERROR'
          }
        );

        // Perform additional database operations
        await errorLoggingService.searchErrorLogs({
          component: ['CONNECTION_TEST_COMPONENT'],
          limit: 10
        });

        return errorId;
      });

      const results = await Promise.all(operations);

      // Assert - All operations completed successfully
      expect(results).toHaveLength(operationCount);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      });

      // Verify data integrity
      const connectionTestErrors = await ErrorLog.countDocuments({
        component: 'CONNECTION_TEST_COMPONENT'
      });
      expect(connectionTestErrors).toBe(operationCount);
    });

    it('should handle cleanup operations efficiently', async () => {
      // Arrange - Create data that needs cleanup
      const dataSize = 1000;
      const cleanupTime = 5000; // 5 seconds max

      // Create test data
      const traceIds = [];
      for (let i = 0; i < dataSize; i++) {
        const traceContext = await traceIdService.createTraceContext();
        traceIds.push(traceContext.traceId);
        
        await errorLoggingService.logError(
          `Cleanup test error ${i}`,
          new Error(`Error ${i}`),
          {
            traceId: traceContext.traceId,
            component: 'CLEANUP_TEST_COMPONENT',
            operation: 'CLEANUP_TEST_OPERATION',
            errorType: 'CLEANUP_TEST_ERROR'
          }
        );
      }

      // Act - Perform cleanup operations
      const cleanupStart = Date.now();

      // Complete all traces (triggers cleanup)
      const cleanupPromises = traceIds.map(traceId =>
        traceIdService.completeTrace(traceId, 'SUCCESS')
      );

      await Promise.all(cleanupPromises);

      const cleanupEnd = Date.now();
      const cleanupDuration = cleanupEnd - cleanupStart;

      // Assert - Cleanup performance
      expect(cleanupDuration).toBeLessThan(cleanupTime);

      // Verify cleanup effectiveness
      const activeTraces = traceIdService.getActiveTraceIds();
      expect(activeTraces.length).toBeLessThan(dataSize); // Should be cleaned up

      console.log(`Cleanup Performance:
        - Data size: ${dataSize}
        - Cleanup time: ${cleanupDuration}ms
        - Active traces after cleanup: ${activeTraces.length}`);
    });
  });
});