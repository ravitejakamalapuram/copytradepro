import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
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

describe('Admin Dashboard Performance Tests', () => {
  let mongoServer: MongoMemoryServer;
  let app: express.Application;
  let errorLoggingService: ErrorLoggingService;
  let errorAggregationService: ErrorAggregationService;

  beforeEach(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);

    // Create Express app with admin routes
    app = express();
    app.use(express.json());

    // Get service instances
    errorLoggingService = ErrorLoggingService.getInstance();
    errorAggregationService = new ErrorAggregationService();

    // Add admin dashboard routes
    app.get('/admin/errors/analytics', async (req, res) => {
      try {
        const timeWindow = parseInt(req.query.timeWindow as string) || 86400000;
        const analytics = await errorLoggingService.getErrorAnalytics(timeWindow);
        res.json(analytics);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get analytics' });
      }
    });

    app.get('/admin/errors/patterns', async (req, res) => {
      try {
        const timeWindow = parseInt(req.query.timeWindow as string) || 86400000;
        const patterns = await errorLoggingService.getErrorPatterns(timeWindow);
        res.json(patterns);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get patterns' });
      }
    });

    app.get('/admin/errors/insights', async (req, res) => {
      try {
        const timeWindow = parseInt(req.query.timeWindow as string) || 86400000;
        const insights = await errorLoggingService.generateErrorInsights(timeWindow);
        res.json(insights);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get insights' });
      }
    });

    app.get('/admin/errors/search', async (req, res) => {
      try {
        const filters = {
          level: req.query.level ? (req.query.level as string).split(',') : undefined,
          component: req.query.component ? (req.query.component as string).split(',') : undefined,
          errorType: req.query.errorType ? (req.query.errorType as string).split(',') : undefined,
          userId: req.query.userId as string,
          brokerName: req.query.brokerName as string,
          startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
          endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
          limit: parseInt(req.query.limit as string) || 50,
          offset: parseInt(req.query.offset as string) || 0
        };

        const results = await errorLoggingService.searchErrorLogs(filters);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: 'Failed to search errors' });
      }
    });

    app.get('/admin/errors/aggregation', async (req, res) => {
      try {
        const dimensions = {
          timeRange: {
            start: new Date(req.query.startDate as string || Date.now() - 86400000),
            end: new Date(req.query.endDate as string || Date.now()),
            granularity: (req.query.granularity as any) || 'hour'
          },
          filters: {
            level: req.query.level ? (req.query.level as string).split(',') : undefined,
            component: req.query.component ? (req.query.component as string).split(',') : undefined
          }
        };

        const aggregation = await errorAggregationService.aggregateErrors(dimensions);
        res.json(aggregation);
      } catch (error) {
        res.status(500).json({ error: 'Failed to aggregate errors' });
      }
    });

    app.get('/admin/errors/impact', async (req, res) => {
      try {
        const timeRange = {
          start: new Date(req.query.startDate as string || Date.now() - 86400000),
          end: new Date(req.query.endDate as string || Date.now())
        };

        const impact = await errorAggregationService.analyzeErrorImpact(timeRange);
        res.json(impact);
      } catch (error) {
        res.status(500).json({ error: 'Failed to analyze impact' });
      }
    });

    app.get('/admin/errors/realtime', async (req, res) => {
      try {
        // Simulate real-time data by getting recent errors
        const recentErrors = await ErrorLog.find({
          timestamp: { $gte: new Date(Date.now() - 60000) } // Last minute
        }).sort({ timestamp: -1 }).limit(100).lean();

        const realtimeData = {
          recentErrors,
          errorCount: recentErrors.length,
          timestamp: new Date()
        };

        res.json(realtimeData);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get real-time data' });
      }
    });

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

  describe('Dashboard API Performance', () => {
    it('should handle analytics requests efficiently with large datasets', async () => {
      // Arrange - Create large dataset for analytics testing
      const datasetSize = 5000;
      const maxResponseTime = 3000; // 3 seconds max

      console.log(`Creating analytics dataset of ${datasetSize} errors...`);

      // Create diverse dataset for comprehensive analytics
      const analyticsPromises = [];
      const components = ['AUTH_SERVICE', 'BROKER_SERVICE', 'DATABASE_SERVICE', 'API_GATEWAY', 'USER_SERVICE'];
      const errorTypes = ['CONNECTION_ERROR', 'TIMEOUT_ERROR', 'VALIDATION_ERROR', 'SYSTEM_ERROR'];
      const brokers = ['zerodha', 'upstox', 'fyers', 'angel'];

      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Analytics dashboard error ${i}`,
          new Error(`Dashboard error ${i}`),
          {
            component: components[i % components.length],
            operation: `OPERATION_${i % 10}`,
            userId: `dashboard_user_${i % 200}`,
            brokerName: brokers[i % brokers.length],
            errorType: errorTypes[i % errorTypes.length],
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any,
            sessionId: `session_${i % 100}`
          }
        );
        analyticsPromises.push(promise);
      }

      await Promise.all(analyticsPromises);
      console.log('Analytics dataset created. Testing dashboard performance...');

      // Act & Assert - Test analytics endpoint performance
      const analyticsStart = Date.now();
      
      const analyticsResponse = await request(app)
        .get('/admin/errors/analytics')
        .query({ timeWindow: 86400000 })
        .expect(200);

      const analyticsTime = Date.now() - analyticsStart;

      console.log(`Analytics endpoint: ${analyticsTime}ms`);

      // Assert performance and response structure
      expect(analyticsTime).toBeLessThan(maxResponseTime);
      expect(analyticsResponse.body).toHaveProperty('totalErrors');
      expect(analyticsResponse.body).toHaveProperty('errorsByType');
      expect(analyticsResponse.body).toHaveProperty('errorsByComponent');
      expect(analyticsResponse.body).toHaveProperty('topErrors');
      expect(analyticsResponse.body.totalErrors).toBe(datasetSize);
    });

    it('should handle search requests efficiently with various filters', async () => {
      // Arrange - Create searchable dataset
      const datasetSize = 3000;
      const maxSearchTime = 1000; // 1 second max

      console.log(`Creating search dataset of ${datasetSize} errors...`);

      // Create structured dataset for search testing
      const searchPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Search dashboard error ${i}`,
          new Error(`Search error ${i}`),
          {
            component: `SEARCH_COMPONENT_${i % 15}`,
            operation: `SEARCH_OPERATION_${i % 8}`,
            userId: `search_user_${i % 300}`,
            brokerName: ['zerodha', 'upstox', 'fyers'][i % 3],
            errorType: `SEARCH_ERROR_TYPE_${i % 12}`,
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any
          }
        );
        searchPromises.push(promise);
      }

      await Promise.all(searchPromises);
      console.log('Search dataset created. Testing search performance...');

      // Act & Assert - Test various search scenarios
      const searchTests = [
        {
          name: 'Basic search by level',
          query: { level: 'ERROR', limit: 50 }
        },
        {
          name: 'Search by component',
          query: { component: 'SEARCH_COMPONENT_1,SEARCH_COMPONENT_2', limit: 50 }
        },
        {
          name: 'Search by user',
          query: { userId: 'search_user_100', limit: 50 }
        },
        {
          name: 'Search by broker',
          query: { brokerName: 'zerodha', limit: 50 }
        },
        {
          name: 'Complex multi-filter search',
          query: {
            level: 'ERROR,WARN',
            component: 'SEARCH_COMPONENT_1,SEARCH_COMPONENT_2',
            brokerName: 'zerodha',
            limit: 100
          }
        },
        {
          name: 'Paginated search',
          query: { level: 'ERROR', limit: 25, offset: 50 }
        }
      ];

      for (const test of searchTests) {
        const searchStart = Date.now();
        
        const searchResponse = await request(app)
          .get('/admin/errors/search')
          .query(test.query)
          .expect(200);

        const searchTime = Date.now() - searchStart;

        console.log(`${test.name}: ${searchTime}ms (${searchResponse.body.errors.length} results)`);

        // Assert search performance
        expect(searchTime).toBeLessThan(maxSearchTime);
        expect(searchResponse.body).toHaveProperty('errors');
        expect(searchResponse.body).toHaveProperty('total');
        expect(searchResponse.body).toHaveProperty('hasMore');
        expect(Array.isArray(searchResponse.body.errors)).toBe(true);
      }
    });

    it('should handle real-time data requests efficiently', async () => {
      // Arrange - Create recent errors for real-time testing
      const recentErrorCount = 100;
      const maxRealtimeTime = 500; // 500ms max for real-time data

      console.log(`Creating ${recentErrorCount} recent errors for real-time testing...`);

      // Create recent errors (within last minute)
      const realtimePromises = [];
      const now = Date.now();
      
      for (let i = 0; i < recentErrorCount; i++) {
        const errorTime = new Date(now - (Math.random() * 60000)); // Within last minute
        
        const promise = errorLoggingService.logError(
          `Real-time dashboard error ${i}`,
          new Error(`Real-time error ${i}`),
          {
            component: `REALTIME_COMPONENT_${i % 5}`,
            operation: `REALTIME_OPERATION_${i % 3}`,
            userId: `realtime_user_${i % 20}`,
            errorType: 'REALTIME_ERROR',
            level: ['ERROR', 'WARN'][i % 2] as any
          }
        ).then(async (errorId) => {
          // Update timestamp to be recent
          await ErrorLog.updateOne(
            { errorId },
            { timestamp: errorTime }
          );
          return errorId;
        });
        
        realtimePromises.push(promise);
      }

      await Promise.all(realtimePromises);
      console.log('Real-time dataset created. Testing real-time performance...');

      // Act & Assert - Test real-time endpoint multiple times
      const realtimeTests = 5;
      const realtimeTimes = [];

      for (let i = 0; i < realtimeTests; i++) {
        const realtimeStart = Date.now();
        
        const realtimeResponse = await request(app)
          .get('/admin/errors/realtime')
          .expect(200);

        const realtimeTime = Date.now() - realtimeStart;
        realtimeTimes.push(realtimeTime);

        console.log(`Real-time request ${i + 1}: ${realtimeTime}ms (${realtimeResponse.body.errorCount} errors)`);

        // Assert real-time performance
        expect(realtimeTime).toBeLessThan(maxRealtimeTime);
        expect(realtimeResponse.body).toHaveProperty('recentErrors');
        expect(realtimeResponse.body).toHaveProperty('errorCount');
        expect(realtimeResponse.body).toHaveProperty('timestamp');
        expect(Array.isArray(realtimeResponse.body.recentErrors)).toBe(true);
      }

      // Assert consistent performance
      const avgRealtimeTime = realtimeTimes.reduce((sum, time) => sum + time, 0) / realtimeTimes.length;
      const maxRealtimeTimeActual = Math.max(...realtimeTimes);

      console.log(`Real-time performance - Avg: ${avgRealtimeTime.toFixed(2)}ms, Max: ${maxRealtimeTimeActual}ms`);

      expect(avgRealtimeTime).toBeLessThan(maxRealtimeTime);
      expect(maxRealtimeTimeActual).toBeLessThan(maxRealtimeTime * 2); // Allow some variance
    });

    it('should handle concurrent dashboard requests efficiently', async () => {
      // Arrange - Create dataset for concurrent testing
      const datasetSize = 2000;
      const concurrentRequests = 10;
      const maxConcurrentTime = 5000; // 5 seconds max for all concurrent requests

      console.log(`Creating concurrent test dataset of ${datasetSize} errors...`);

      // Create dataset
      const concurrentPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Concurrent dashboard error ${i}`,
          new Error(`Concurrent error ${i}`),
          {
            component: `CONCURRENT_COMPONENT_${i % 8}`,
            operation: `CONCURRENT_OPERATION_${i % 5}`,
            userId: `concurrent_user_${i % 100}`,
            errorType: `CONCURRENT_ERROR_TYPE_${i % 6}`,
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any
          }
        );
        concurrentPromises.push(promise);
      }

      await Promise.all(concurrentPromises);
      console.log('Concurrent dataset created. Testing concurrent performance...');

      // Act - Make concurrent requests to different endpoints
      const concurrentStart = Date.now();

      const concurrentRequestPromises = [
        // Analytics requests
        request(app).get('/admin/errors/analytics').query({ timeWindow: 86400000 }),
        request(app).get('/admin/errors/analytics').query({ timeWindow: 3600000 }),
        
        // Search requests
        request(app).get('/admin/errors/search').query({ level: 'ERROR', limit: 50 }),
        request(app).get('/admin/errors/search').query({ component: 'CONCURRENT_COMPONENT_1', limit: 50 }),
        
        // Pattern requests
        request(app).get('/admin/errors/patterns').query({ timeWindow: 86400000 }),
        
        // Aggregation requests
        request(app).get('/admin/errors/aggregation').query({
          startDate: new Date(Date.now() - 86400000).toISOString(),
          endDate: new Date().toISOString(),
          granularity: 'hour'
        }),
        
        // Impact analysis requests
        request(app).get('/admin/errors/impact').query({
          startDate: new Date(Date.now() - 86400000).toISOString(),
          endDate: new Date().toISOString()
        }),
        
        // Real-time requests
        request(app).get('/admin/errors/realtime'),
        request(app).get('/admin/errors/realtime'),
        request(app).get('/admin/errors/realtime')
      ];

      const concurrentResponses = await Promise.all(concurrentRequestPromises);
      const concurrentTime = Date.now() - concurrentStart;

      console.log(`Concurrent requests completed in: ${concurrentTime}ms`);

      // Assert - All requests should complete successfully
      expect(concurrentTime).toBeLessThan(maxConcurrentTime);
      
      concurrentResponses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body).toBeDefined();
      });

      // Calculate average response time
      const avgResponseTime = concurrentTime / concurrentRequests;
      console.log(`Average response time under concurrency: ${avgResponseTime.toFixed(2)}ms`);

      expect(avgResponseTime).toBeLessThan(1000); // Average should be under 1 second
    });
  });

  describe('Dashboard Data Visualization Performance', () => {
    it('should generate chart data efficiently for large datasets', async () => {
      // Arrange - Create time-series dataset for charts
      const datasetSize = 4000;
      const maxChartDataTime = 2000; // 2 seconds max

      console.log(`Creating chart dataset of ${datasetSize} errors...`);

      // Create time-distributed dataset
      const now = Date.now();
      const chartPromises = [];
      
      for (let i = 0; i < datasetSize; i++) {
        // Distribute errors over last 24 hours
        const errorTime = new Date(now - (Math.random() * 24 * 60 * 60 * 1000));
        
        const promise = errorLoggingService.logError(
          `Chart data error ${i}`,
          new Error(`Chart error ${i}`),
          {
            component: ['CHART_COMP_1', 'CHART_COMP_2', 'CHART_COMP_3', 'CHART_COMP_4'][i % 4],
            operation: `CHART_OP_${i % 6}`,
            userId: `chart_user_${i % 150}`,
            brokerName: ['zerodha', 'upstox', 'fyers'][i % 3],
            errorType: ['CRITICAL', 'WARNING', 'INFO'][i % 3],
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any
          }
        ).then(async (errorId) => {
          // Update timestamp for time distribution
          await ErrorLog.updateOne(
            { errorId },
            { timestamp: errorTime }
          );
          return errorId;
        });
        
        chartPromises.push(promise);
      }

      await Promise.all(chartPromises);
      console.log('Chart dataset created. Testing chart data generation...');

      // Act & Assert - Test chart data endpoints
      const chartTests = [
        {
          name: 'Hourly aggregation for line charts',
          endpoint: '/admin/errors/aggregation',
          query: {
            startDate: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
            endDate: new Date(now).toISOString(),
            granularity: 'hour'
          }
        },
        {
          name: 'Component distribution for pie charts',
          endpoint: '/admin/errors/analytics',
          query: { timeWindow: 86400000 }
        },
        {
          name: 'Error trends for time series',
          endpoint: '/admin/errors/patterns',
          query: { timeWindow: 86400000 }
        }
      ];

      for (const test of chartTests) {
        const chartStart = Date.now();
        
        const chartResponse = await request(app)
          .get(test.endpoint)
          .query(test.query)
          .expect(200);

        const chartTime = Date.now() - chartStart;

        console.log(`${test.name}: ${chartTime}ms`);

        // Assert chart data performance
        expect(chartTime).toBeLessThan(maxChartDataTime);
        expect(chartResponse.body).toBeDefined();

        // Verify chart-specific data structure
        if (test.name.includes('aggregation')) {
          expect(chartResponse.body).toHaveProperty('errorsByTimeRange');
          expect(Array.isArray(chartResponse.body.errorsByTimeRange)).toBe(true);
        } else if (test.name.includes('analytics')) {
          expect(chartResponse.body).toHaveProperty('errorsByComponent');
          expect(chartResponse.body).toHaveProperty('errorsByType');
        }
      }
    });

    it('should handle dashboard refresh efficiently', async () => {
      // Arrange - Create dataset that simulates ongoing errors
      const initialDatasetSize = 1000;
      const maxRefreshTime = 1500; // 1.5 seconds max per refresh

      console.log(`Creating initial dataset of ${initialDatasetSize} errors...`);

      // Create initial dataset
      const initialPromises = [];
      for (let i = 0; i < initialDatasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Refresh test error ${i}`,
          new Error(`Refresh error ${i}`),
          {
            component: `REFRESH_COMPONENT_${i % 6}`,
            operation: `REFRESH_OPERATION_${i % 4}`,
            userId: `refresh_user_${i % 80}`,
            errorType: `REFRESH_ERROR_TYPE_${i % 5}`,
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any
          }
        );
        initialPromises.push(promise);
      }

      await Promise.all(initialPromises);
      console.log('Initial dataset created. Testing dashboard refresh...');

      // Act & Assert - Simulate dashboard refresh cycles
      const refreshCycles = 5;
      const refreshTimes = [];

      for (let cycle = 0; cycle < refreshCycles; cycle++) {
        // Add new errors to simulate ongoing activity
        const newErrorPromises = [];
        for (let i = 0; i < 50; i++) {
          const promise = errorLoggingService.logError(
            `New refresh error ${cycle}_${i}`,
            new Error(`New error ${cycle}_${i}`),
            {
              component: `NEW_COMPONENT_${i % 3}`,
              operation: `NEW_OPERATION_${i % 2}`,
              userId: `new_user_${i % 10}`,
              errorType: 'NEW_ERROR',
              level: 'ERROR' as any
            }
          );
          newErrorPromises.push(promise);
        }

        await Promise.all(newErrorPromises);

        // Simulate dashboard refresh (multiple concurrent requests)
        const refreshStart = Date.now();

        const refreshRequests = await Promise.all([
          request(app).get('/admin/errors/analytics').query({ timeWindow: 3600000 }),
          request(app).get('/admin/errors/realtime'),
          request(app).get('/admin/errors/search').query({ level: 'ERROR', limit: 20 }),
          request(app).get('/admin/errors/aggregation').query({
            startDate: new Date(Date.now() - 3600000).toISOString(),
            endDate: new Date().toISOString(),
            granularity: 'hour'
          })
        ]);

        const refreshTime = Date.now() - refreshStart;
        refreshTimes.push(refreshTime);

        console.log(`Refresh cycle ${cycle + 1}: ${refreshTime}ms`);

        // Assert refresh performance
        expect(refreshTime).toBeLessThan(maxRefreshTime);
        
        // Verify all requests succeeded
        refreshRequests.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body).toBeDefined();
        });

        // Brief pause between refresh cycles
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Assert consistent refresh performance
      const avgRefreshTime = refreshTimes.reduce((sum, time) => sum + time, 0) / refreshTimes.length;
      const maxRefreshTimeActual = Math.max(...refreshTimes);

      console.log(`Refresh performance - Avg: ${avgRefreshTime.toFixed(2)}ms, Max: ${maxRefreshTimeActual}ms`);

      expect(avgRefreshTime).toBeLessThan(maxRefreshTime);
      expect(maxRefreshTimeActual).toBeLessThan(maxRefreshTime * 1.5); // Allow some variance
    });
  });

  describe('Dashboard Memory and Resource Usage', () => {
    it('should maintain efficient memory usage during dashboard operations', async () => {
      // Arrange
      const datasetSize = 3000;
      const memoryThreshold = 100 * 1024 * 1024; // 100MB threshold

      console.log(`Creating memory test dataset of ${datasetSize} errors...`);

      // Create dataset with larger error objects
      const memoryPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Memory dashboard error ${i}`,
          new Error(`Memory error ${i}`),
          {
            component: `MEMORY_COMPONENT_${i % 10}`,
            operation: `MEMORY_OPERATION_${i % 5}`,
            userId: `memory_user_${i % 100}`,
            errorType: `MEMORY_ERROR_TYPE_${i % 8}`,
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any,
            largeContext: {
              data: 'x'.repeat(1000), // 1KB per error
              metadata: Array.from({ length: 100 }, (_, j) => `metadata_${j}`),
              stackTrace: 'Error\n'.repeat(50) // Simulate large stack trace
            }
          }
        );
        memoryPromises.push(promise);
      }

      await Promise.all(memoryPromises);
      console.log('Memory dataset created. Testing memory usage...');

      // Measure initial memory
      const initialMemory = process.memoryUsage();

      // Act - Perform memory-intensive dashboard operations
      const memoryTests = [
        {
          name: 'Large analytics request',
          operation: () => request(app).get('/admin/errors/analytics').query({ timeWindow: 86400000 })
        },
        {
          name: 'Large search request',
          operation: () => request(app).get('/admin/errors/search').query({ limit: 1000 })
        },
        {
          name: 'Complex aggregation',
          operation: () => request(app).get('/admin/errors/aggregation').query({
            startDate: new Date(Date.now() - 86400000).toISOString(),
            endDate: new Date().toISOString(),
            granularity: 'hour'
          })
        },
        {
          name: 'Pattern analysis',
          operation: () => request(app).get('/admin/errors/patterns').query({ timeWindow: 86400000 })
        }
      ];

      for (const test of memoryTests) {
        const beforeMemory = process.memoryUsage();
        
        const response = await test.operation();
        
        const afterMemory = process.memoryUsage();
        const memoryIncrease = afterMemory.heapUsed - beforeMemory.heapUsed;

        console.log(`${test.name}: Memory increase ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

        // Assert memory usage and response
        expect(response.status).toBe(200);
        expect(memoryIncrease).toBeLessThan(memoryThreshold);

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

    it('should handle dashboard load testing efficiently', async () => {
      // Arrange - Create realistic dataset
      const datasetSize = 2000;
      const loadTestDuration = 10000; // 10 seconds
      const maxRequestsPerSecond = 20;

      console.log(`Creating load test dataset of ${datasetSize} errors...`);

      // Create dataset
      const loadPromises = [];
      for (let i = 0; i < datasetSize; i++) {
        const promise = errorLoggingService.logError(
          `Load test error ${i}`,
          new Error(`Load error ${i}`),
          {
            component: `LOAD_COMPONENT_${i % 8}`,
            operation: `LOAD_OPERATION_${i % 5}`,
            userId: `load_user_${i % 50}`,
            errorType: `LOAD_ERROR_TYPE_${i % 6}`,
            level: ['ERROR', 'WARN', 'INFO'][i % 3] as any
          }
        );
        loadPromises.push(promise);
      }

      await Promise.all(loadPromises);
      console.log('Load test dataset created. Running load test...');

      // Act - Simulate continuous dashboard usage
      const startTime = Date.now();
      const requests = [];
      let requestCount = 0;

      while (Date.now() - startTime < loadTestDuration) {
        const requestStart = Date.now();
        
        // Randomly select dashboard endpoint
        const endpoints = [
          '/admin/errors/analytics?timeWindow=3600000',
          '/admin/errors/search?level=ERROR&limit=50',
          '/admin/errors/realtime',
          '/admin/errors/aggregation?granularity=hour'
        ];
        
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
        
        const requestPromise = request(app)
          .get(endpoint)
          .then(response => {
            const requestTime = Date.now() - requestStart;
            return { endpoint, time: requestTime, status: response.status };
          });

        requests.push(requestPromise);
        requestCount++;

        // Control request rate
        await new Promise(resolve => setTimeout(resolve, 50)); // 20 requests per second max
      }

      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // Assert - Load test results
      const successfulRequests = results.filter(r => r.status === 200).length;
      const avgResponseTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      const maxResponseTime = Math.max(...results.map(r => r.time));
      const requestsPerSecond = (requestCount / totalTime) * 1000;

      console.log(`Load Test Results:
        - Duration: ${totalTime}ms
        - Total requests: ${requestCount}
        - Successful requests: ${successfulRequests}
        - Requests per second: ${requestsPerSecond.toFixed(2)}
        - Avg response time: ${avgResponseTime.toFixed(2)}ms
        - Max response time: ${maxResponseTime}ms`);

      expect(successfulRequests).toBe(requestCount); // All requests should succeed
      expect(requestsPerSecond).toBeLessThanOrEqual(maxRequestsPerSecond);
      expect(avgResponseTime).toBeLessThan(2000); // Average under 2 seconds
      expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds
    });
  });
});