import { ErrorAggregationService, ErrorAggregationDimensions } from '../services/errorAggregationService';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';

// Mock the models
jest.mock('../models/errorLogModels');
jest.mock('../utils/logger');

const MockErrorLog = ErrorLog as jest.Mocked<typeof ErrorLog>;
const MockTraceLifecycle = TraceLifecycle as jest.Mocked<typeof TraceLifecycle>;

describe('ErrorAggregationService', () => {
  let service: ErrorAggregationService;
  let mockTimeRange: { start: Date; end: Date };

  beforeEach(() => {
    service = new ErrorAggregationService();
    mockTimeRange = {
      start: new Date('2025-01-01T00:00:00Z'),
      end: new Date('2025-01-07T23:59:59Z')
    };
    jest.clearAllMocks();
  });

  describe('aggregateErrors', () => {
    it('should aggregate errors by various dimensions', async () => {
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: mockTimeRange.start,
          end: mockTimeRange.end,
          granularity: 'day'
        },
        filters: {
          level: ['ERROR'],
          source: ['BE'],
          component: ['BROKER_CONTROLLER']
        }
      };

      // Mock database responses
      MockErrorLog.countDocuments = jest.fn().mockResolvedValue(150);
      MockErrorLog.aggregate = jest.fn()
        .mockResolvedValueOnce([
          { _id: 'ERROR', count: 120 },
          { _id: 'WARN', count: 30 }
        ])
        .mockResolvedValueOnce([
          { _id: 'BE', count: 100 },
          { _id: 'UI', count: 50 }
        ])
        .mockResolvedValueOnce([
          { _id: 'BROKER_CONTROLLER', count: 80 },
          { _id: 'AUTH_CONTROLLER', count: 70 }
        ])
        .mockResolvedValueOnce([
          { _id: 'BROKER_API_ERROR', count: 60 },
          { _id: 'VALIDATION_ERROR', count: 40 }
        ])
        .mockResolvedValueOnce([
          {
            _id: '2025-01-01',
            totalCount: 25,
            levels: [
              { level: 'ERROR', count: 20 },
              { level: 'WARN', count: 5 }
            ]
          }
        ])
        .mockResolvedValueOnce([
          {
            _id: {
              message: 'Insufficient funds',
              errorType: 'BROKER_API_ERROR',
              component: 'BROKER_CONTROLLER'
            },
            count: 15,
            lastOccurred: new Date('2025-01-07T12:00:00Z')
          }
        ])
        .mockResolvedValueOnce([]) // hourly trend
        .mockResolvedValueOnce([]) // daily trend
        .mockResolvedValueOnce([]); // weekly trend

      const result = await service.aggregateErrors(dimensions);

      expect(result).toEqual({
        totalErrors: 150,
        errorsByLevel: { ERROR: 120, WARN: 30 },
        errorsBySource: { BE: 100, UI: 50 },
        errorsByComponent: { BROKER_CONTROLLER: 80, AUTH_CONTROLLER: 70 },
        errorsByType: { BROKER_API_ERROR: 60, VALIDATION_ERROR: 40 },
        errorsByTimeRange: [
          {
            timestamp: new Date('2025-01-01'),
            count: 25,
            level: { ERROR: 20, WARN: 5 }
          }
        ],
        topErrors: [
          {
            message: 'Insufficient funds',
            count: 15,
            lastOccurred: new Date('2025-01-07T12:00:00Z'),
            errorType: 'BROKER_API_ERROR',
            component: 'BROKER_CONTROLLER'
          }
        ],
        errorTrends: {
          hourly: [],
          daily: [],
          weekly: []
        }
      });

      expect(MockErrorLog.countDocuments).toHaveBeenCalledWith({
        timestamp: {
          $gte: mockTimeRange.start,
          $lte: mockTimeRange.end
        },
        level: { $in: ['ERROR'] },
        source: { $in: ['BE'] },
        component: { $in: ['BROKER_CONTROLLER'] }
      });
    });

    it('should handle empty results gracefully', async () => {
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: mockTimeRange.start,
          end: mockTimeRange.end,
          granularity: 'day'
        }
      };

      MockErrorLog.countDocuments = jest.fn().mockResolvedValue(0);
      MockErrorLog.aggregate = jest.fn().mockResolvedValue([]);

      const result = await service.aggregateErrors(dimensions);

      expect(result.totalErrors).toBe(0);
      expect(result.errorsByLevel).toEqual({});
      expect(result.topErrors).toEqual([]);
    });

    it('should throw error when database operation fails', async () => {
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: mockTimeRange.start,
          end: mockTimeRange.end,
          granularity: 'day'
        }
      };

      MockErrorLog.countDocuments = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(service.aggregateErrors(dimensions)).rejects.toThrow('Failed to aggregate error data');
    });
  });

  describe('detectErrorPatterns', () => {
    it('should detect recurring error patterns', async () => {
      MockErrorLog.aggregate = jest.fn()
        .mockResolvedValueOnce([
          {
            _id: {
              message: 'Connection timeout',
              errorType: 'NETWORK_ERROR',
              component: 'BROKER_CONTROLLER'
            },
            count: 25,
            firstSeen: new Date('2025-01-01T10:00:00Z'),
            lastSeen: new Date('2025-01-07T15:00:00Z'),
            traceIds: ['trace1', 'trace2', 'trace3'],
            components: ['BROKER_CONTROLLER'],
            errorTypes: ['NETWORK_ERROR']
          }
        ])
        .mockResolvedValueOnce([]) // cascades
        .mockResolvedValueOnce([]) // component patterns
        .mockResolvedValueOnce([]) // time patterns
        .mockResolvedValueOnce([]); // user patterns

      const patterns = await service.detectErrorPatterns(mockTimeRange);

      expect(patterns).toHaveLength(1);
      expect(patterns[0]).toMatchObject({
        id: 'recurring_0',
        pattern: 'Recurring error: Connection timeout',
        occurrences: 25,
        components: ['BROKER_CONTROLLER'],
        errorTypes: ['NETWORK_ERROR']
      });
    });

    it('should detect error cascade patterns', async () => {
      MockErrorLog.aggregate = jest.fn()
        .mockResolvedValueOnce([]) // recurring errors
        .mockResolvedValueOnce([
          {
            _id: 'trace123',
            errorCount: 5,
            components: ['BROKER_CONTROLLER', 'DATABASE_SERVICE'],
            errorTypes: ['BROKER_API_ERROR', 'DATABASE_ERROR'],
            firstError: new Date('2025-01-05T10:00:00Z'),
            lastError: new Date('2025-01-05T10:05:00Z')
          }
        ])
        .mockResolvedValueOnce([]) // component patterns
        .mockResolvedValueOnce([]) // time patterns
        .mockResolvedValueOnce([]); // user patterns

      const patterns = await service.detectErrorPatterns(mockTimeRange);

      expect(patterns).toHaveLength(1);
      expect(patterns[0]).toMatchObject({
        id: 'cascade_0',
        pattern: 'Error cascade in trace trace123',
        occurrences: 5,
        severity: 'HIGH',
        components: ['BROKER_CONTROLLER', 'DATABASE_SERVICE']
      });
    });

    it('should handle database errors gracefully', async () => {
      MockErrorLog.aggregate = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(service.detectErrorPatterns(mockTimeRange)).rejects.toThrow('Failed to detect error patterns');
    });
  });

  describe('analyzeErrorImpact', () => {
    it('should calculate system health score', async () => {
      MockTraceLifecycle.countDocuments = jest.fn()
        .mockResolvedValueOnce(1000) // total requests
        .mockResolvedValueOnce(50); // error requests

      MockErrorLog.distinct = jest.fn()
        .mockResolvedValueOnce(['user1', 'user2']) // affected users
        .mockResolvedValueOnce(['user1', 'user2', 'user3', 'user4']); // total users

      MockTraceLifecycle.distinct = jest.fn()
        .mockResolvedValue(['user1', 'user2', 'user3', 'user4']); // total users from traces

      MockErrorLog.countDocuments = jest.fn()
        .mockResolvedValueOnce(10) // critical errors
        .mockResolvedValueOnce(5) // trading errors
        .mockResolvedValueOnce(100); // total errors for business impact

      MockTraceLifecycle.find = jest.fn().mockResolvedValue([
        { duration: 1000 },
        { duration: 2000 },
        { duration: 1500 }
      ]);

      const impact = await service.analyzeErrorImpact(mockTimeRange);

      expect(impact.systemHealthScore).toBe(95); // (1000-50)/1000 * 100
      expect(impact.userExperienceImpact.affectedUsers).toBe(2);
      expect(impact.userExperienceImpact.totalUsers).toBe(4);
      expect(impact.userExperienceImpact.impactPercentage).toBe(50);
      expect(impact.criticalErrorsCount).toBe(10);
    });

    it('should handle zero requests gracefully', async () => {
      MockTraceLifecycle.countDocuments = jest.fn()
        .mockResolvedValueOnce(0) // total requests
        .mockResolvedValueOnce(0); // error requests

      MockErrorLog.distinct = jest.fn().mockResolvedValue([]);
      MockTraceLifecycle.distinct = jest.fn().mockResolvedValue([]);
      MockErrorLog.countDocuments = jest.fn().mockResolvedValue(0);
      MockTraceLifecycle.find = jest.fn().mockResolvedValue([]);

      const impact = await service.analyzeErrorImpact(mockTimeRange);

      expect(impact.systemHealthScore).toBe(100);
      expect(impact.userExperienceImpact.impactPercentage).toBe(0);
    });
  });

  describe('calculateComponentReliability', () => {
    it('should calculate reliability metrics for components', async () => {
      MockErrorLog.distinct = jest.fn().mockResolvedValue(['BROKER_CONTROLLER', 'AUTH_CONTROLLER']);
      
      MockTraceLifecycle.countDocuments = jest.fn()
        .mockResolvedValueOnce(100) // total operations for BROKER_CONTROLLER
        .mockResolvedValueOnce(50); // total operations for AUTH_CONTROLLER

      MockErrorLog.countDocuments = jest.fn()
        .mockResolvedValueOnce(10) // errors for BROKER_CONTROLLER
        .mockResolvedValueOnce(5); // errors for AUTH_CONTROLLER

      MockErrorLog.find = jest.fn()
        .mockResolvedValueOnce([
          { timestamp: new Date('2025-01-01T10:00:00Z') },
          { timestamp: new Date('2025-01-01T12:00:00Z') }
        ])
        .mockResolvedValueOnce([
          { timestamp: new Date('2025-01-01T14:00:00Z') }
        ]);

      // Create a spy on the private method by accessing it through the service instance
      const service = new ErrorAggregationService();
      const reliability = await (service as any).calculateComponentReliability(mockTimeRange);

      expect(reliability['BROKER_CONTROLLER']).toMatchObject({
        errorRate: 10, // 10/100 * 100
        availability: 90, // 100 - 10
        meanTimeBetweenFailures: expect.any(Number)
      });

      expect(reliability['AUTH_CONTROLLER']).toMatchObject({
        errorRate: 10, // 5/50 * 100
        availability: 90, // 100 - 10
        meanTimeBetweenFailures: 0 // Only one failure
      });
    });
  });
});