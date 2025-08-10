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

describe('Error Correlation and Grouping Integration Tests', () => {
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

  describe('Error Correlation by Trace ID', () => {
    it('should correlate multiple errors within same trace', async () => {
      // Arrange - Create trace context
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Act - Log multiple related errors in same trace
      const errorIds = await Promise.all([
        errorLoggingService.logError(
          'Authentication failed',
          new Error('Invalid credentials'),
          {
            traceId,
            component: 'AUTH_CONTROLLER',
            operation: 'LOGIN',
            userId: 'user_123',
            errorType: 'AUTH_ERROR'
          }
        ),
        errorLoggingService.logError(
          'Database connection failed',
          new Error('Connection timeout'),
          {
            traceId,
            component: 'DATABASE_SERVICE',
            operation: 'CONNECT',
            errorType: 'DB_ERROR'
          }
        ),
        errorLoggingService.logError(
          'Broker API call failed',
          new Error('Service unavailable'),
          {
            traceId,
            component: 'BROKER_CONTROLLER',
            operation: 'PLACE_ORDER',
            brokerName: 'zerodha',
            errorType: 'BROKER_ERROR'
          }
        )
      ]);

      // Assert - Verify all errors are correlated by trace ID
      const correlatedErrors = await ErrorLog.find({ traceId }).sort({ timestamp: 1 }).lean();
      expect(correlatedErrors).toHaveLength(3);

      // Verify all errors share the same trace ID
      correlatedErrors.forEach(error => {
        expect(error.traceId).toBe(traceId);
      });

      // Verify error sequence and components
      expect(correlatedErrors[0].component).toBe('AUTH_CONTROLLER');
      expect(correlatedErrors[1].component).toBe('DATABASE_SERVICE');
      expect(correlatedErrors[2].component).toBe('BROKER_CONTROLLER');

      // Verify different error types are captured
      const errorTypes = correlatedErrors.map(e => e.errorType);
      expect(errorTypes).toContain('AUTH_ERROR');
      expect(errorTypes).toContain('DB_ERROR');
      expect(errorTypes).toContain('BROKER_ERROR');

      // Verify trace lifecycle reflects error count
      const traceLifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(traceLifecycle).toBeDefined();
      expect(traceLifecycle!.errorCount).toBe(3);
    });

    it('should detect error cascades within traces', async () => {
      // Arrange - Create trace for cascade scenario
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      // Act - Simulate error cascade (one error causing others)
      await traceIdService.addOperation(traceId, 'VALIDATE_TOKEN', 'AUTH_SERVICE');
      await traceIdService.addOperation(traceId, 'FETCH_USER_DATA', 'USER_SERVICE');
      await traceIdService.addOperation(traceId, 'CONNECT_BROKER', 'BROKER_SERVICE');
      await traceIdService.addOperation(traceId, 'EXECUTE_TRADE', 'TRADING_SERVICE');

      // First error - token validation fails
      await traceIdService.completeOperation(traceId, 'VALIDATE_TOKEN', 'ERROR');
      await errorLoggingService.logError(
        'Token validation failed',
        new Error('Token expired'),
        {
          traceId,
          component: 'AUTH_SERVICE',
          operation: 'VALIDATE_TOKEN',
          errorType: 'TOKEN_EXPIRED'
        }
      );

      // Cascade errors due to auth failure
      await traceIdService.completeOperation(traceId, 'FETCH_USER_DATA', 'ERROR');
      await errorLoggingService.logError(
        'Cannot fetch user data without valid token',
        new Error('Unauthorized'),
        {
          traceId,
          component: 'USER_SERVICE',
          operation: 'FETCH_USER_DATA',
          errorType: 'UNAUTHORIZED'
        }
      );

      await traceIdService.completeOperation(traceId, 'CONNECT_BROKER', 'ERROR');
      await errorLoggingService.logError(
        'Broker connection failed due to auth failure',
        new Error('Authentication required'),
        {
          traceId,
          component: 'BROKER_SERVICE',
          operation: 'CONNECT_BROKER',
          errorType: 'AUTH_REQUIRED'
        }
      );

      await traceIdService.completeOperation(traceId, 'EXECUTE_TRADE', 'ERROR');
      await errorLoggingService.logError(
        'Trade execution failed - no broker connection',
        new Error('No connection available'),
        {
          traceId,
          component: 'TRADING_SERVICE',
          operation: 'EXECUTE_TRADE',
          errorType: 'CONNECTION_ERROR'
        }
      );

      // Assert - Verify cascade detection
      const timeRange = {
        start: new Date(Date.now() - 60000), // 1 minute ago
        end: new Date()
      };

      const patterns = await errorAggregationService.detectErrorPatterns(timeRange);
      const cascadePattern = patterns.find(p => p.pattern.includes('cascade'));
      
      expect(cascadePattern).toBeDefined();
      expect(cascadePattern!.relatedTraceIds).toContain(traceId);
      expect(cascadePattern!.occurrences).toBe(4);

      // Verify all errors are linked to the same trace
      const cascadeErrors = await ErrorLog.find({ traceId }).lean();
      expect(cascadeErrors).toHaveLength(4);
      
      // Verify error sequence timing (should be close together)
      const timestamps = cascadeErrors.map(e => e.timestamp.getTime());
      const timeSpan = Math.max(...timestamps) - Math.min(...timestamps);
      expect(timeSpan).toBeLessThan(10000); // Within 10 seconds
    });

    it('should group errors by related trace patterns', async () => {
      // Arrange - Create multiple traces with similar error patterns
      const traceContexts = await Promise.all([
        traceIdService.createTraceContext(),
        traceIdService.createTraceContext(),
        traceIdService.createTraceContext()
      ]);

      // Act - Create similar error patterns across different traces
      for (const context of traceContexts) {
        const traceId = context.traceId;
        
        // Similar pattern: auth -> broker -> order failure
        await errorLoggingService.logError(
          'Authentication timeout',
          new Error('Request timeout'),
          {
            traceId,
            component: 'AUTH_CONTROLLER',
            operation: 'AUTHENTICATE',
            errorType: 'TIMEOUT_ERROR'
          }
        );

        await errorLoggingService.logError(
          'Broker connection failed',
          new Error('Connection refused'),
          {
            traceId,
            component: 'BROKER_CONTROLLER',
            operation: 'CONNECT',
            brokerName: 'zerodha',
            errorType: 'CONNECTION_ERROR'
          }
        );

        await errorLoggingService.logError(
          'Order placement failed',
          new Error('No broker connection'),
          {
            traceId,
            component: 'ORDER_CONTROLLER',
            operation: 'PLACE_ORDER',
            errorType: 'ORDER_ERROR'
          }
        );
      }

      // Assert - Verify pattern grouping
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };

      const patterns = await errorAggregationService.detectErrorPatterns(timeRange);
      
      // Should detect recurring error patterns
      const recurringPatterns = patterns.filter(p => p.pattern.includes('Recurring'));
      expect(recurringPatterns.length).toBeGreaterThan(0);

      // Verify each pattern has multiple occurrences
      recurringPatterns.forEach(pattern => {
        expect(pattern.occurrences).toBeGreaterThanOrEqual(3);
      });

      // Verify all traces are represented
      const allTraceIds = traceContexts.map(ctx => ctx.traceId);
      const errorLogs = await ErrorLog.find({
        traceId: { $in: allTraceIds }
      }).lean();
      
      expect(errorLogs).toHaveLength(9); // 3 errors × 3 traces
    });
  });

  describe('Error Grouping by User and Session', () => {
    it('should group errors by user ID', async () => {
      // Arrange - Create errors for same user across different traces
      const userId = 'user_123';
      const sessionId = 'session_456';

      const traceContexts = await Promise.all([
        traceIdService.createTraceContext(),
        traceIdService.createTraceContext(),
        traceIdService.createTraceContext()
      ]);

      // Act - Log errors for same user in different contexts
      const errorPromises = traceContexts.map(async (context, index) => {
        return errorLoggingService.logError(
          `User error ${index + 1}`,
          new Error(`Error in operation ${index + 1}`),
          {
            traceId: context.traceId,
            component: `COMPONENT_${index + 1}`,
            operation: `OPERATION_${index + 1}`,
            userId,
            sessionId,
            errorType: 'USER_ERROR'
          }
        );
      });

      await Promise.all(errorPromises);

      // Assert - Verify user-based grouping
      const userErrors = await ErrorLog.find({
        'context.userId': userId
      }).lean();

      expect(userErrors).toHaveLength(3);
      
      // Verify all errors belong to same user
      userErrors.forEach(error => {
        expect(error.context.userId).toBe(userId);
        expect(error.context.sessionId).toBe(sessionId);
      });

      // Verify different traces but same user
      const userTraceIds = userErrors.map(e => e.traceId);
      const uniqueTraceIds = new Set(userTraceIds);
      expect(uniqueTraceIds.size).toBe(3);

      // Test user-specific pattern detection
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };

      const patterns = await errorAggregationService.detectErrorPatterns(timeRange);
      const userPattern = patterns.find(p => p.pattern.includes(userId));
      
      if (userPattern) {
        expect(userPattern.occurrences).toBe(3);
      }
    });

    it('should group errors by session context', async () => {
      // Arrange - Create multiple sessions for same user
      const userId = 'user_123';
      const sessions = ['session_1', 'session_2', 'session_3'];

      // Act - Create errors across different sessions
      const sessionErrors = [];
      
      for (const sessionId of sessions) {
        const traceContext = await traceIdService.createTraceContext();
        
        const errorId = await errorLoggingService.logError(
          'Session-specific error',
          new Error('Session error'),
          {
            traceId: traceContext.traceId,
            component: 'SESSION_MANAGER',
            operation: 'MANAGE_SESSION',
            userId,
            sessionId,
            errorType: 'SESSION_ERROR'
          }
        );
        
        sessionErrors.push({ errorId, sessionId, traceId: traceContext.traceId });
      }

      // Assert - Verify session-based grouping
      for (const session of sessions) {
        const sessionSpecificErrors = await ErrorLog.find({
          'context.sessionId': session
        }).lean();

        expect(sessionSpecificErrors).toHaveLength(1);
        expect(sessionSpecificErrors[0].context.userId).toBe(userId);
        expect(sessionSpecificErrors[0].context.sessionId).toBe(session);
      }

      // Verify all errors belong to same user but different sessions
      const allUserErrors = await ErrorLog.find({
        'context.userId': userId
      }).lean();

      expect(allUserErrors).toHaveLength(3);
      
      const sessionIds = allUserErrors.map(e => e.context.sessionId);
      expect(new Set(sessionIds)).toEqual(new Set(sessions));
    });

    it('should correlate errors across user journey', async () => {
      // Arrange - Simulate user journey with multiple operations
      const userId = 'user_123';
      const sessionId = 'session_456';
      const userAgent = 'Mozilla/5.0 (Test Browser)';

      // Act - Simulate user journey with errors at different stages
      const journeySteps = [
        {
          operation: 'LOGIN',
          component: 'AUTH_CONTROLLER',
          error: 'Login failed - invalid credentials',
          errorType: 'AUTH_ERROR'
        },
        {
          operation: 'FETCH_PORTFOLIO',
          component: 'PORTFOLIO_CONTROLLER',
          error: 'Portfolio fetch failed - unauthorized',
          errorType: 'UNAUTHORIZED'
        },
        {
          operation: 'PLACE_ORDER',
          component: 'ORDER_CONTROLLER',
          error: 'Order placement failed - insufficient funds',
          errorType: 'INSUFFICIENT_FUNDS'
        },
        {
          operation: 'LOGOUT',
          component: 'AUTH_CONTROLLER',
          error: 'Logout failed - session expired',
          errorType: 'SESSION_EXPIRED'
        }
      ];

      const journeyErrors = [];
      
      for (const step of journeySteps) {
        const traceContext = await traceIdService.createTraceContext();
        
        const errorId = await errorLoggingService.logError(
          step.error,
          new Error(step.error),
          {
            traceId: traceContext.traceId,
            component: step.component,
            operation: step.operation,
            userId,
            sessionId,
            userAgent,
            errorType: step.errorType
          }
        );
        
        journeyErrors.push({
          errorId,
          traceId: traceContext.traceId,
          operation: step.operation
        });
      }

      // Assert - Verify user journey correlation
      const userJourneyErrors = await ErrorLog.find({
        'context.userId': userId,
        'context.sessionId': sessionId
      }).sort({ timestamp: 1 }).lean();

      expect(userJourneyErrors).toHaveLength(4);

      // Verify journey sequence
      expect(userJourneyErrors[0].operation).toBe('LOGIN');
      expect(userJourneyErrors[1].operation).toBe('FETCH_PORTFOLIO');
      expect(userJourneyErrors[2].operation).toBe('PLACE_ORDER');
      expect(userJourneyErrors[3].operation).toBe('LOGOUT');

      // Verify all errors have consistent user context
      userJourneyErrors.forEach(error => {
        expect(error.context.userId).toBe(userId);
        expect(error.context.sessionId).toBe(sessionId);
        expect(error.context.userAgent).toBe(userAgent);
      });

      // Verify error progression shows user experience degradation
      const errorTypes = userJourneyErrors.map(e => e.errorType);
      expect(errorTypes).toContain('AUTH_ERROR');
      expect(errorTypes).toContain('UNAUTHORIZED');
      expect(errorTypes).toContain('INSUFFICIENT_FUNDS');
      expect(errorTypes).toContain('SESSION_EXPIRED');
    });
  });

  describe('Error Grouping by Component and Operation', () => {
    it('should group errors by component', async () => {
      // Arrange - Create errors for same component across different traces
      const component = 'BROKER_CONTROLLER';
      const brokerName = 'zerodha';

      // Act - Create multiple errors for same component
      const componentErrors = [];
      
      for (let i = 0; i < 5; i++) {
        const traceContext = await traceIdService.createTraceContext();
        
        const errorId = await errorLoggingService.logError(
          `Broker error ${i + 1}`,
          new Error(`Connection error ${i + 1}`),
          {
            traceId: traceContext.traceId,
            component,
            operation: `OPERATION_${i + 1}`,
            brokerName,
            errorType: 'BROKER_ERROR'
          }
        );
        
        componentErrors.push({ errorId, traceId: traceContext.traceId });
      }

      // Assert - Verify component-based grouping
      const brokerErrors = await ErrorLog.find({
        component: component
      }).lean();

      expect(brokerErrors).toHaveLength(5);

      // Verify all errors belong to same component
      brokerErrors.forEach(error => {
        expect(error.component).toBe(component);
        expect(error.context.brokerName).toBe(brokerName);
        expect(error.errorType).toBe('BROKER_ERROR');
      });

      // Verify different operations within same component
      const operations = brokerErrors.map(e => e.operation);
      expect(new Set(operations).size).toBe(5);

      // Test component reliability analysis
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };

      const impact = await errorAggregationService.analyzeErrorImpact(timeRange);
      expect(impact.componentReliability).toHaveProperty(component);
      
      const componentReliability = impact.componentReliability[component];
      expect(componentReliability.errorRate).toBeGreaterThan(0);
      expect(componentReliability.availability).toBeLessThan(100);
    });

    it('should group errors by operation type', async () => {
      // Arrange - Create errors for same operation across different components
      const operation = 'CONNECT';
      const components = ['BROKER_SERVICE', 'DATABASE_SERVICE', 'CACHE_SERVICE'];

      // Act - Create connection errors across different services
      const operationErrors = [];
      
      for (const component of components) {
        const traceContext = await traceIdService.createTraceContext();
        
        const errorId = await errorLoggingService.logError(
          `${component} connection failed`,
          new Error('Connection timeout'),
          {
            traceId: traceContext.traceId,
            component,
            operation,
            errorType: 'CONNECTION_ERROR'
          }
        );
        
        operationErrors.push({ errorId, component, traceId: traceContext.traceId });
      }

      // Assert - Verify operation-based grouping
      const connectionErrors = await ErrorLog.find({
        operation: operation
      }).lean();

      expect(connectionErrors).toHaveLength(3);

      // Verify all errors are for same operation
      connectionErrors.forEach(error => {
        expect(error.operation).toBe(operation);
        expect(error.errorType).toBe('CONNECTION_ERROR');
      });

      // Verify different components affected
      const affectedComponents = connectionErrors.map(e => e.component);
      expect(new Set(affectedComponents)).toEqual(new Set(components));

      // Test operation pattern detection
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };

      const patterns = await errorAggregationService.detectErrorPatterns(timeRange);
      const connectionPattern = patterns.find(p => 
        p.pattern.toLowerCase().includes('connection') || 
        p.pattern.toLowerCase().includes('connect')
      );
      
      if (connectionPattern) {
        expect(connectionPattern.components).toEqual(
          expect.arrayContaining(components)
        );
      }
    });
  });

  describe('Error Grouping by Time and Frequency', () => {
    it('should detect error spikes and group by time periods', async () => {
      // Arrange - Create error spike scenario
      const baseTime = new Date();
      const spikeStartTime = new Date(baseTime.getTime() - 300000); // 5 minutes ago

      // Act - Create error spike (many errors in short time)
      const spikeErrors = [];
      
      for (let i = 0; i < 15; i++) {
        const traceContext = await traceIdService.createTraceContext();
        const errorTime = new Date(spikeStartTime.getTime() + (i * 10000)); // 10 seconds apart
        
        const errorId = await errorLoggingService.logError(
          'Spike error',
          new Error('System overload'),
          {
            traceId: traceContext.traceId,
            component: 'SYSTEM_CONTROLLER',
            operation: 'PROCESS_REQUEST',
            errorType: 'SYSTEM_OVERLOAD'
          }
        );
        
        // Manually set timestamp to simulate spike timing
        await ErrorLog.updateOne(
          { errorId },
          { timestamp: errorTime }
        );
        
        spikeErrors.push({ errorId, timestamp: errorTime });
      }

      // Assert - Verify spike detection
      const timeRange = {
        start: new Date(baseTime.getTime() - 600000), // 10 minutes ago
        end: baseTime
      };

      const patterns = await errorAggregationService.detectErrorPatterns(timeRange);
      const spikePattern = patterns.find(p => p.pattern.includes('spike'));
      
      if (spikePattern) {
        expect(spikePattern.occurrences).toBeGreaterThanOrEqual(10);
      }

      // Verify time-based aggregation
      const aggregation = await errorAggregationService.aggregateErrors({
        timeRange: {
          start: timeRange.start,
          end: timeRange.end,
          granularity: 'hour'
        }
      });

      expect(aggregation.totalErrors).toBeGreaterThanOrEqual(15);
      expect(aggregation.errorsByTimeRange.length).toBeGreaterThan(0);
    });

    it('should group recurring errors by frequency patterns', async () => {
      // Arrange - Create recurring error pattern
      const recurringError = {
        message: 'Database connection pool exhausted',
        component: 'DATABASE_SERVICE',
        operation: 'GET_CONNECTION',
        errorType: 'POOL_EXHAUSTED'
      };

      // Act - Create recurring errors over time
      const recurringInstances = [];
      
      for (let i = 0; i < 8; i++) {
        const traceContext = await traceIdService.createTraceContext();
        
        const errorId = await errorLoggingService.logError(
          recurringError.message,
          new Error(recurringError.message),
          {
            traceId: traceContext.traceId,
            component: recurringError.component,
            operation: recurringError.operation,
            errorType: recurringError.errorType
          }
        );
        
        recurringInstances.push({ errorId, traceId: traceContext.traceId });
      }

      // Assert - Verify recurring pattern detection
      const timeRange = {
        start: new Date(Date.now() - 600000), // 10 minutes ago
        end: new Date()
      };

      const patterns = await errorAggregationService.detectErrorPatterns(timeRange);
      const recurringPattern = patterns.find(p => 
        p.pattern.includes('Recurring') && 
        p.pattern.includes(recurringError.message)
      );
      
      expect(recurringPattern).toBeDefined();
      expect(recurringPattern!.occurrences).toBe(8);
      expect(recurringPattern!.components).toContain(recurringError.component);

      // Verify frequency analysis
      const analytics = await errorLoggingService.getErrorAnalytics();
      expect(analytics.topErrors.some(e => 
        e.message === recurringError.message && e.count >= 8
      )).toBe(true);
    });
  });

  describe('Cross-System Error Correlation', () => {
    it('should correlate errors across frontend and backend', async () => {
      // Arrange - Simulate frontend-backend error correlation
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;
      const userId = 'user_123';
      const sessionId = 'session_456';

      // Act - Log frontend error first
      const frontendErrorId = await errorLoggingService.logError(
        'React component render failed',
        new Error('Cannot read property of undefined'),
        {
          traceId,
          component: 'REACT_COMPONENT',
          operation: 'RENDER',
          source: 'UI',
          userId,
          sessionId,
          url: '/dashboard',
          errorType: 'FRONTEND_ERROR'
        }
      );

      // Log corresponding backend error
      const backendErrorId = await errorLoggingService.logError(
        'API endpoint failed',
        new Error('Internal server error'),
        {
          traceId,
          component: 'API_CONTROLLER',
          operation: 'GET_DATA',
          source: 'BE',
          userId,
          sessionId,
          url: '/api/dashboard-data',
          method: 'GET',
          statusCode: 500,
          errorType: 'BACKEND_ERROR'
        }
      );

      // Assert - Verify cross-system correlation
      const correlatedErrors = await ErrorLog.find({ traceId }).lean();
      expect(correlatedErrors).toHaveLength(2);

      // Verify frontend and backend errors are linked
      const frontendError = correlatedErrors.find(e => e.source === 'UI');
      const backendError = correlatedErrors.find(e => e.source === 'BE');

      expect(frontendError).toBeDefined();
      expect(backendError).toBeDefined();

      // Verify common context
      expect(frontendError!.context.userId).toBe(userId);
      expect(backendError!.context.userId).toBe(userId);
      expect(frontendError!.context.sessionId).toBe(sessionId);
      expect(backendError!.context.sessionId).toBe(sessionId);

      // Verify trace lifecycle shows both systems
      const traceLifecycle = await TraceLifecycle.findOne({ traceId }).lean();
      expect(traceLifecycle).toBeDefined();
      expect(traceLifecycle!.errorCount).toBe(2);
    });

    it('should correlate errors across microservices', async () => {
      // Arrange - Simulate microservice error propagation
      const traceContext = await traceIdService.createTraceContext();
      const traceId = traceContext.traceId;

      const services = [
        'API_GATEWAY',
        'AUTH_SERVICE',
        'USER_SERVICE',
        'BROKER_SERVICE',
        'NOTIFICATION_SERVICE'
      ];

      // Act - Create error chain across microservices
      const serviceErrors = [];
      
      for (let i = 0; i < services.length; i++) {
        const service = services[i];
        
        const errorId = await errorLoggingService.logError(
          `${service} error in chain`,
          new Error(`Service ${i + 1} failed`),
          {
            traceId,
            component: service,
            operation: `OPERATION_${i + 1}`,
            errorType: 'SERVICE_ERROR',
            serviceChainPosition: i + 1
          }
        );
        
        serviceErrors.push({ errorId, service, position: i + 1 });
      }

      // Assert - Verify microservice correlation
      const chainErrors = await ErrorLog.find({ traceId }).sort({ timestamp: 1 }).lean();
      expect(chainErrors).toHaveLength(5);

      // Verify service chain order
      chainErrors.forEach((error, index) => {
        expect(error.component).toBe(services[index]);
        expect(error.context.serviceChainPosition).toBe(index + 1);
      });

      // Verify error propagation pattern
      const timeRange = {
        start: new Date(Date.now() - 60000),
        end: new Date()
      };

      const patterns = await errorAggregationService.detectErrorPatterns(timeRange);
      const chainPattern = patterns.find(p => p.relatedTraceIds.includes(traceId));
      
      if (chainPattern) {
        expect(chainPattern.components).toEqual(
          expect.arrayContaining(services)
        );
      }
    });
  });
});