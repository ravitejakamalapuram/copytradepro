import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { ErrorLoggingService } from '../services/errorLoggingService';
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

describe('Database Query Performance Tests', () => {
  let mongoServer: MongoMemoryServer;
  let errorLoggingService: ErrorLoggingService;
  let errorAggregationService: ErrorAggregationService;

  beforeEach(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Get service instances
    errorLoggingService = ErrorLoggingService.getInstance();
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

  describe('Large Dataset Query Performance', () => {
    it('should handle complex aggregation queries efficiently', async () => {
      // Arrange - Create large, diverse dataset
      const datasetSize = 10000;
      const maxQueryTime = 3000; // 3 seconds max per query

      console.log(`Creating dataset of ${datasetSize} errors...`);
      
      // Create structured dataset for comprehensive testing
      const components = [
        'AUTH_SERVICE', 'BROKER_SERVICE', 'DATABASE_SERVICE', 'API_GATEWAY',
        'USER_SERVICE', 'ORDER_SERVICE', 'PORTFOLIO_SERVICE', 'NOTIFICATION_SERVICE',
        'MARKET_DATA_SERVICE', 'ANALYTICS_SERVICE'
      ];
      
      const errorTypes = [
        'CONNECTION_ERROR', 'TIMEOUT_ERROR', 'VALIDATION_ERROR', 'SYSTEM_ERROR',
        'AUTH_ERROR', 'BROKER_ERROR', 'DATABASE_ERROR', 'NETWORK_ERROR'
      ];
      
      const brokers = ['zerodha', 'upstox', 'fyers', 'angel', 'dhan'];
      const levels = ['ERROR', 'WARN', 'INFO'];

      // Create errors in batches for better performance
      const batchSize = 500;
      const batches = Math.ceil(datasetSize / batchSize);

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = [];
        const batchStart = batch * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, datasetSize);

        for (let i = batchStart; i < batchEnd; i++) {
          const promise = errorLoggingService.logError(
            `Performance test error ${i}`,
            new Error(`Test error ${i}`),
            {
              component: components[i % components.length],
              operation: `OPERATION_${i % 20}`,
              userId: `user_${i % 1000}`,
              brokerName: brokers[i % brokers.length],
              errorType: errorTypes[i % errorTypes.length],
              level: levels[i % levels.length] as any,
              sessionId: `session_${i % 200}`,
              requestId: `req_${i}`,
              statusCode: [200, 400, 401, 403, 404, 500, 502, 503][i % 8],
              duration: Math.floor(Math.random() * 5000) + 100
            }
          );
          batchPromises.push(promise);
        }

        await Promise.all(batchPromises);
        console.log(`Completed batch ${batch + 1}/${batches}`);
      }

      console.log('Dataset created. Running performance tests...');

      // Act & Assert - Test various complex queries
      const queryTests = [
        {
          name: 'Error count by component (GROUP BY)',
          query: async () => {
            const start = Date.now();
            const result = await ErrorLog.aggregate([
              { $group: { _id: '$component', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ]);
            const time = Date.now() - start;
            return { result, time };
          }
        },
        {
          name: 'Error trends by hour (TIME SERIES)',
          query: async () => {
            const start = Date.now();
            const result = await ErrorLog.aggregate([
              {
                $group: {
                  _id: {
                    year: { $year: '$timestamp' },
                    month: { $month: '$timestamp' },
                    day: { $dayOfMonth: '$timestamp' },
                    hour: { $hour: '$timestamp' }
                  },
                  count: { $sum: 1 }
                }
              },
              { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.hour': 1 } }
            ]);
            const time = Date.now() - start;
            return { result, time };
          }
        },
        {
          name: 'Top errors by frequency (COMPLEX GROUPING)',
          query: async () => {
            const start = Date.now();
            const result = await ErrorLog.aggregate([
              {
                $group: {
                  _id: {
                    message: '$message',
                    component: '$component',
                    errorType: '$errorType'
                  },
                  count: { $sum: 1 },
                  lastOccurred: { $max: '$timestamp' },
                  firstOccurred: { $min: '$timestamp' }
                }
              },
              { $match: { count: { $gte: 5 } } },
              { $sort: { count: -1 } },
              { $limit: 50 }
            ]);
            const time = Date.now() - start;
            return { result, time };
          }
        },
        {
          name: 'User error distribution (NESTED GROUPING)',
          query: async () => {
            const start = Date.now();
            const result = await ErrorLog.aggregate([
              { $match: { 'context.userId': { $exists: true, $ne: null } } },
              {
                $group: {
                  _id: '$context.userId',
                  errorCount: { $sum: 1 },
                  errorTypes: { $addToSet: '$errorType' },
                  components: { $addToSet: '$component' },
                  lastError: { $max: '$timestamp' }
                }
              },
              { $match: { errorCount: { $gte: 10 } } },
              { $sort: { errorCount: -1 } },
              { $limit: 100 }
            ]);
            const time = Date.now() - start;
            return { result, time };
          }
        },
        {
          name: 'Broker performance analysis (MULTI-STAGE)',
          query: async () => {
            const start = Date.now();
            const result = await ErrorLog.aggregate([
              { $match: { 'context.brokerName': { $exists: true, $ne: null } } },
              {
                $group: {
                  _id: '$context.brokerName',
                  totalErrors: { $sum: 1 },
                  avgDuration: { $avg: '$context.duration' },
                  errorsByType: {
                    $push: {
                      errorType: '$errorType',
                      timestamp: '$timestamp'
                    }
                  }
                }
              },
              {
                $addFields: {
                  errorRate: {
                    $divide: ['$totalErrors', datasetSize]
                  }
                }
              },
              { $sort: { totalErrors: -1 } }
            ]);
            const time = Date.now() - start;
            return { result, time };
          }
        },
        {
          name: 'Error correlation analysis (COMPLEX JOIN)',
          query: async () => {
            const start = Date.now();
            const result = await ErrorLog.aggregate([
              {
                $group: {
                  _id: '$traceId',
                  errorCount: { $sum: 1 },
                  components: { $addToSet: '$component' },
                  errorTypes: { $addToSet: '$errorType' },
                  duration: {
                    $max: {
                      $subtract: ['$timestamp', { $min: '$timestamp' }]
                    }
                  }
                }
              },
              { $match: { errorCount: { $gte: 2 } } },
              {
                $addFields: {
                  componentCount: { $size: '$components' },
                  errorTypeCount: { $size: '$errorTypes' }
                }
              },
              { $sort: { errorCount: -1, componentCount: -1 } },
              { $limit: 100 }
            ]);
            const time = Date.now() - start;
            return { result, time };
          }
        }
      ];

      for (const test of queryTests) {
        const { result, time } = await test.query();
        
        console.log(`${test.name}: ${time}ms (${result.length} results)`);
        
        // Assert performance requirements
        expect(time).toBeLessThan(maxQueryTime);
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it('should optimize search queries with various filter combinations', async () => {
      // Arrange - Create dataset optimized for search testing
      const datasetSize = 5000;
      const maxSearchTime = 1000; // 1 second max per search

      console.log(`Creating search-optimized dataset of ${datasetSize} errors...`);

      // Create dataset with known patterns for search testing
      const searchPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Search test error ${i}`,
          new Error(`Search error ${i}`),
          {
            component: `COMPONENT_${i % 25}`,
            operation: `OPERATION_${i % 15}`,
            userId: `user_${i % 500}`,
            brokerName: ['zerodha', 'upstox', 'fyers'][i % 3],
            errorType: `ERROR_TYPE_${i % 10}`,
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any,
            sessionId: `session_${i % 100}`,
            traceId: `trace_${Math.floor(i / 10)}` // Group errors by trace
          }
        );
        searchPromises.push(promise);
      }

      await Promise.all(searchPromises);
      console.log('Search dataset created. Running search performance tests...');

      // Act & Assert - Test various search scenarios
      const searchTests = [
        {
          name: 'Simple level filter',
          filters: { level: ['ERROR'] }
        },
        {
          name: 'Component filter',
          filters: { component: ['COMPONENT_1', 'COMPONENT_2', 'COMPONENT_3'] }
        },
        {
          name: 'User-specific search',
          filters: { userId: 'user_100' }
        },
        {
          name: 'Broker filter',
          filters: { brokerName: 'zerodha' }
        },
        {
          name: 'Error type filter',
          filters: { errorType: ['ERROR_TYPE_1', 'ERROR_TYPE_2'] }
        },
        {
          name: 'Date range filter',
          filters: {
            startDate: new Date(Date.now() - 3600000), // 1 hour ago
            endDate: new Date()
          }
        },
        {
          name: 'Multi-field filter',
          filters: {
            level: ['ERROR', 'WARN'],
            component: ['COMPONENT_1', 'COMPONENT_2'],
            brokerName: 'zerodha'
          }
        },
        {
          name: 'Complex filter with pagination',
          filters: {
            level: ['ERROR'],
            errorType: ['ERROR_TYPE_1', 'ERROR_TYPE_2', 'ERROR_TYPE_3'],
            startDate: new Date(Date.now() - 7200000), // 2 hours ago
            limit: 100,
            offset: 0
          }
        },
        {
          name: 'Trace-based search',
          filters: { traceId: 'trace_50' }
        },
        {
          name: 'Full-text search simulation',
          filters: {
            component: Array.from({ length: 10 }, (_, i) => `COMPONENT_${i}`),
            errorType: Array.from({ length: 5 }, (_, i) => `ERROR_TYPE_${i}`),
            limit: 50
          }
        }
      ];

      for (const test of searchTests) {
        const startTime = Date.now();
        
        const results = await errorLoggingService.searchErrorLogs(test.filters);
        
        const searchTime = Date.now() - startTime;
        
        console.log(`${test.name}: ${searchTime}ms (${results.total} total, ${results.errors.length} returned)`);
        
        // Assert search performance
        expect(searchTime).toBeLessThan(maxSearchTime);
        expect(results.errors).toBeDefined();
        expect(results.total).toBeGreaterThanOrEqual(0);
        expect(results.hasMore).toBeDefined();
      }
    });

    it('should handle pagination efficiently with large result sets', async () => {
      // Arrange - Create dataset for pagination testing
      const datasetSize = 3000;
      const pageSize = 50;
      const maxPageTime = 500; // 500ms max per page

      console.log(`Creating pagination dataset of ${datasetSize} errors...`);

      // Create uniform dataset for pagination testing
      const paginationPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Pagination test error ${i}`,
          new Error(`Pagination error ${i}`),
          {
            component: 'PAGINATION_COMPONENT',
            operation: 'PAGINATION_OPERATION',
            userId: `user_${i % 100}`,
            errorType: 'PAGINATION_ERROR',
            level: 'ERROR' as any,
            sequenceNumber: i // For ordering verification
          }
        );
        paginationPromises.push(promise);
      }

      await Promise.all(paginationPromises);
      console.log('Pagination dataset created. Running pagination tests...');

      // Act & Assert - Test pagination performance
      const totalPages = Math.ceil(datasetSize / pageSize);
      const pagesToTest = Math.min(10, totalPages); // Test first 10 pages

      for (let page = 0; page < pagesToTest; page++) {
        const offset = page * pageSize;
        
        const startTime = Date.now();
        
        const results = await errorLoggingService.searchErrorLogs({
          component: ['PAGINATION_COMPONENT'],
          limit: pageSize,
          offset: offset
        });
        
        const pageTime = Date.now() - startTime;
        
        console.log(`Page ${page + 1}: ${pageTime}ms (offset: ${offset}, returned: ${results.errors.length})`);
        
        // Assert pagination performance
        expect(pageTime).toBeLessThan(maxPageTime);
        expect(results.errors.length).toBeLessThanOrEqual(pageSize);
        
        // Verify pagination correctness
        if (offset + pageSize < datasetSize) {
          expect(results.hasMore).toBe(true);
        }
        
        // Performance should not degrade significantly with offset
        if (page > 0) {
          // Later pages should not be dramatically slower
          expect(pageTime).toBeLessThan(maxPageTime * 2);
        }
      }

      // Test deep pagination performance
      const deepOffset = Math.floor(datasetSize * 0.8); // 80% through dataset
      const deepStartTime = Date.now();
      
      const deepResults = await errorLoggingService.searchErrorLogs({
        component: ['PAGINATION_COMPONENT'],
        limit: pageSize,
        offset: deepOffset
      });
      
      const deepPageTime = Date.now() - deepStartTime;
      
      console.log(`Deep pagination (offset ${deepOffset}): ${deepPageTime}ms`);
      
      // Deep pagination should still be reasonable
      expect(deepPageTime).toBeLessThan(maxPageTime * 3);
      expect(deepResults.errors.length).toBeGreaterThan(0);
    });

    it('should optimize analytics queries for real-time dashboards', async () => {
      // Arrange - Create time-series dataset for analytics
      const datasetSize = 8000;
      const maxAnalyticsTime = 2000; // 2 seconds max per analytics query

      console.log(`Creating analytics dataset of ${datasetSize} errors...`);

      // Create time-distributed dataset
      const now = new Date();
      const analyticsPromises = [];
      
      for (let i = 0; i < datasetSize; i++) {
        // Distribute errors over last 24 hours
        const errorTime = new Date(now.getTime() - (Math.random() * 24 * 60 * 60 * 1000));
        
        const promise = errorLoggingService.logError(
          `Analytics test error ${i}`,
          new Error(`Analytics error ${i}`),
          {
            component: ['ANALYTICS_COMP_1', 'ANALYTICS_COMP_2', 'ANALYTICS_COMP_3'][i % 3],
            operation: `ANALYTICS_OP_${i % 8}`,
            userId: `analytics_user_${i % 200}`,
            brokerName: ['zerodha', 'upstox', 'fyers', 'angel'][i % 4],
            errorType: ['CRITICAL_ERROR', 'WARNING', 'INFO_ERROR'][i % 3],
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any
          }
        );
        
        analyticsPromises.push(promise.then(async (errorId) => {
          // Update timestamp to distribute over time
          await ErrorLog.updateOne(
            { errorId },
            { timestamp: errorTime }
          );
          return errorId;
        }));
      }

      await Promise.all(analyticsPromises);
      console.log('Analytics dataset created. Running analytics performance tests...');

      // Act & Assert - Test analytics queries
      const analyticsTests = [
        {
          name: 'Basic error analytics',
          query: async () => {
            const start = Date.now();
            const result = await errorLoggingService.getErrorAnalytics(86400000); // 24 hours
            const time = Date.now() - start;
            return { result, time };
          }
        },
        {
          name: 'Error patterns detection',
          query: async () => {
            const start = Date.now();
            const result = await errorLoggingService.getErrorPatterns(86400000);
            const time = Date.now() - start;
            return { result, time };
          }
        },
        {
          name: 'Error insights generation',
          query: async () => {
            const start = Date.now();
            const result = await errorLoggingService.generateErrorInsights(86400000);
            const time = Date.now() - start;
            return { result, time };
          }
        },
        {
          name: 'Error aggregation by hour',
          query: async () => {
            const start = Date.now();
            const result = await errorAggregationService.aggregateErrors({
              timeRange: {
                start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                end: now,
                granularity: 'hour'
              }
            });
            const time = Date.now() - start;
            return { result, time };
          }
        },
        {
          name: 'Impact analysis',
          query: async () => {
            const start = Date.now();
            const result = await errorAggregationService.analyzeErrorImpact({
              start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
              end: now
            });
            const time = Date.now() - start;
            return { result, time };
          }
        },
        {
          name: 'Pattern detection',
          query: async () => {
            const start = Date.now();
            const result = await errorAggregationService.detectErrorPatterns({
              start: new Date(now.getTime() - 24 * 60 * 60 * 1000),
              end: now
            });
            const time = Date.now() - start;
            return { result, time };
          }
        }
      ];

      for (const test of analyticsTests) {
        const { result, time } = await test.query();
        
        console.log(`${test.name}: ${time}ms`);
        
        // Assert analytics performance
        expect(time).toBeLessThan(maxAnalyticsTime);
        expect(result).toBeDefined();
        
        // Verify result structure based on query type
        if (test.name.includes('analytics')) {
          expect(result).toHaveProperty('totalErrors');
          expect(result).toHaveProperty('errorsByType');
        } else if (test.name.includes('patterns')) {
          expect(Array.isArray(result.recurringErrors || result)).toBe(true);
        } else if (test.name.includes('insights')) {
          expect(result).toHaveProperty('criticalIssues');
          expect(result).toHaveProperty('systemHealthScore');
        }
      }
    });
  });

  describe('Index Performance Optimization', () => {
    it('should utilize database indexes effectively', async () => {
      // Arrange - Create dataset to test index usage
      const datasetSize = 5000;
      const maxIndexedQueryTime = 200; // 200ms max for indexed queries

      console.log(`Creating indexed query dataset of ${datasetSize} errors...`);

      // Create dataset with indexed fields
      const indexPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Index test error ${i}`,
          new Error(`Index error ${i}`),
          {
            component: `INDEX_COMPONENT_${i % 20}`,
            operation: `INDEX_OPERATION_${i % 10}`,
            userId: `index_user_${i % 300}`,
            errorType: `INDEX_ERROR_TYPE_${i % 15}`,
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any,
            traceId: `index_trace_${Math.floor(i / 5)}`
          }
        );
        indexPromises.push(promise);
      }

      await Promise.all(indexPromises);
      console.log('Index dataset created. Testing indexed queries...');

      // Act & Assert - Test queries that should use indexes
      const indexedQueries = [
        {
          name: 'Query by traceId (primary index)',
          query: () => ErrorLog.find({ traceId: 'index_trace_100' }).lean()
        },
        {
          name: 'Query by timestamp range (indexed)',
          query: () => ErrorLog.find({
            timestamp: {
              $gte: new Date(Date.now() - 3600000),
              $lte: new Date()
            }
          }).lean()
        },
        {
          name: 'Query by component (indexed)',
          query: () => ErrorLog.find({ component: 'INDEX_COMPONENT_5' }).lean()
        },
        {
          name: 'Query by errorType (indexed)',
          query: () => ErrorLog.find({ errorType: 'INDEX_ERROR_TYPE_3' }).lean()
        },
        {
          name: 'Query by userId (indexed)',
          query: () => ErrorLog.find({ 'context.userId': 'index_user_150' }).lean()
        },
        {
          name: 'Query by level (indexed)',
          query: () => ErrorLog.find({ level: 'ERROR' }).lean()
        },
        {
          name: 'Compound index query (timestamp + component)',
          query: () => ErrorLog.find({
            timestamp: { $gte: new Date(Date.now() - 3600000) },
            component: 'INDEX_COMPONENT_1'
          }).lean()
        },
        {
          name: 'Compound index query (component + errorType)',
          query: () => ErrorLog.find({
            component: 'INDEX_COMPONENT_1',
            errorType: 'INDEX_ERROR_TYPE_1'
          }).lean()
        }
      ];

      for (const test of indexedQueries) {
        const startTime = Date.now();
        
        const results = await test.query();
        
        const queryTime = Date.now() - startTime;
        
        console.log(`${test.name}: ${queryTime}ms (${results.length} results)`);
        
        // Assert indexed query performance
        expect(queryTime).toBeLessThan(maxIndexedQueryTime);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      }

      // Test non-indexed query for comparison
      const nonIndexedStart = Date.now();
      const nonIndexedResults = await ErrorLog.find({
        message: { $regex: /Index test error 1/ }
      }).lean();
      const nonIndexedTime = Date.now() - nonIndexedStart;
      
      console.log(`Non-indexed regex query: ${nonIndexedTime}ms (${nonIndexedResults.length} results)`);
      
      // Non-indexed queries will be slower, but should still complete
      expect(nonIndexedTime).toBeLessThan(5000); // 5 seconds max for non-indexed
    });

    it('should optimize sort operations with indexes', async () => {
      // Arrange - Create dataset for sort testing
      const datasetSize = 3000;
      const maxSortTime = 500; // 500ms max for indexed sorts

      console.log(`Creating sort optimization dataset of ${datasetSize} errors...`);

      // Create dataset with varied timestamps
      const sortPromises = [];
      const baseTime = Date.now();
      
      for (let i = 0; i < datasetSize; i++) {
        const errorTime = new Date(baseTime - (Math.random() * 24 * 60 * 60 * 1000));
        
        const promise = errorLoggingService.logError(
          `Sort test error ${i}`,
          new Error(`Sort error ${i}`),
          {
            component: `SORT_COMPONENT_${i % 10}`,
            operation: `SORT_OPERATION_${i % 5}`,
            userId: `sort_user_${i % 100}`,
            errorType: `SORT_ERROR_TYPE_${i % 8}`,
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any,
            priority: Math.floor(Math.random() * 10) + 1
          }
        ).then(async (errorId) => {
          // Update timestamp for sort testing
          await ErrorLog.updateOne(
            { errorId },
            { timestamp: errorTime }
          );
          return errorId;
        });
        
        sortPromises.push(promise);
      }

      await Promise.all(sortPromises);
      console.log('Sort dataset created. Testing sort performance...');

      // Act & Assert - Test various sort operations
      const sortTests = [
        {
          name: 'Sort by timestamp DESC (indexed)',
          query: () => ErrorLog.find({}).sort({ timestamp: -1 }).limit(100).lean()
        },
        {
          name: 'Sort by timestamp ASC (indexed)',
          query: () => ErrorLog.find({}).sort({ timestamp: 1 }).limit(100).lean()
        },
        {
          name: 'Sort by component + timestamp (compound index)',
          query: () => ErrorLog.find({})
            .sort({ component: 1, timestamp: -1 })
            .limit(100)
            .lean()
        },
        {
          name: 'Sort with filter by component (indexed)',
          query: () => ErrorLog.find({ component: 'SORT_COMPONENT_1' })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean()
        },
        {
          name: 'Sort with filter by errorType (indexed)',
          query: () => ErrorLog.find({ errorType: 'SORT_ERROR_TYPE_1' })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean()
        },
        {
          name: 'Sort with multiple filters (compound index)',
          query: () => ErrorLog.find({
            component: 'SORT_COMPONENT_1',
            level: 'ERROR'
          }).sort({ timestamp: -1 }).limit(50).lean()
        }
      ];

      for (const test of sortTests) {
        const startTime = Date.now();
        
        const results = await test.query();
        
        const sortTime = Date.now() - startTime;
        
        console.log(`${test.name}: ${sortTime}ms (${results.length} results)`);
        
        // Assert sort performance
        expect(sortTime).toBeLessThan(maxSortTime);
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
        
        // Verify sort order for timestamp sorts
        if (test.name.includes('timestamp DESC')) {
          for (let i = 1; i < results.length; i++) {
            expect(results[i-1].timestamp.getTime()).toBeGreaterThanOrEqual(
              results[i].timestamp.getTime()
            );
          }
        } else if (test.name.includes('timestamp ASC')) {
          for (let i = 1; i < results.length; i++) {
            expect(results[i-1].timestamp.getTime()).toBeLessThanOrEqual(
              results[i].timestamp.getTime()
            );
          }
        }
      }
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should handle large result sets without memory issues', async () => {
      // Arrange
      const largeDatasetSize = 10000;
      const memoryThreshold = 200 * 1024 * 1024; // 200MB threshold

      console.log(`Creating large dataset of ${largeDatasetSize} errors for memory testing...`);

      // Create large dataset
      const memoryPromises = [];
      for (let i = 0; i < largeDatasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Memory test error ${i}`,
          new Error(`Memory error ${i}`),
          {
            component: `MEMORY_COMPONENT_${i % 50}`,
            operation: `MEMORY_OPERATION_${i % 20}`,
            userId: `memory_user_${i % 1000}`,
            errorType: `MEMORY_ERROR_TYPE_${i % 25}`,
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any,
            largeData: {
              description: 'x'.repeat(500), // 500 bytes per error
              metadata: Array.from({ length: 50 }, (_, j) => `metadata_${j}`)
            }
          }
        );
        memoryPromises.push(promise);
      }

      await Promise.all(memoryPromises);
      console.log('Large dataset created. Testing memory usage...');

      // Measure initial memory
      const initialMemory = process.memoryUsage();

      // Act - Perform memory-intensive operations
      const memoryTests = [
        {
          name: 'Large result set query',
          operation: async () => {
            return await ErrorLog.find({}).limit(5000).lean();
          }
        },
        {
          name: 'Aggregation with large groups',
          operation: async () => {
            return await ErrorLog.aggregate([
              {
                $group: {
                  _id: '$component',
                  count: { $sum: 1 },
                  errors: { $push: { message: '$message', timestamp: '$timestamp' } }
                }
              }
            ]);
          }
        },
        {
          name: 'Complex analytics query',
          operation: async () => {
            return await errorLoggingService.getErrorAnalytics();
          }
        }
      ];

      for (const test of memoryTests) {
        const beforeMemory = process.memoryUsage();
        
        const result = await test.operation();
        
        const afterMemory = process.memoryUsage();
        const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;
        
        console.log(`${test.name}: Memory increase ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
        
        // Assert memory usage
        expect(memoryIncrease).toBeLessThan(memoryThreshold);
        expect(result).toBeDefined();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const totalMemoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`Total memory increase: ${(totalMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // Total memory increase should be reasonable
      expect(totalMemoryIncrease).toBeLessThan(memoryThreshold);
    });
  });
});