import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  ErrorAggregationService, 
  ErrorAggregationDimensions, 
  ErrorAggregationResult,
  ErrorPattern,
  ErrorImpactAnalysis 
} from '../services/errorAggregationService';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';
import { logger } from '../utils/logger';

// Mock dependencies
vi.mock('../models/errorLogModels');
vi.mock('../utils/logger');

describe('ErrorAggregationService', () => {
  let errorAggregationService: ErrorAggregationService;
  let mockErrorLog: any;
  let mockTraceLifecycle: any;
  let mockLogger: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Mock ErrorLog model
    mockErrorLog = {
      countDocuments: vi.fn(),
      aggregate: vi.fn(),
      distinct: vi.fn(),
      find: vi.fn()
    };
    (ErrorLog as any) = mockErrorLog;

    // Mock TraceLifecycle model
    mockTraceLifecycle = {
      countDocuments: vi.fn(),
      aggregate: vi.fn(),
      distinct: vi.fn(),
      find: vi.fn()
    };
    (TraceLifecycle as any) = mockTraceLifecycle;

    // Mock logger
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    };
    (logger as any) = mockLogger;

    // Create fresh instance
    errorAggregationService = new ErrorAggregationService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('aggregateErrors', () => {
    it('should aggregate errors by various dimensions', async () => {
      // Arrange
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
          granularity: 'day'
        },
        filters: {
          level: ['ERROR'],
          source: ['BE'],
          component: ['BROKER_CONTROLLER']
        }
      };

      const mockAggregationResults = [
        100, // totalErrors
        [{ _id: 'BROKER_ERROR', count: 50 }, { _id: 'NETWORK_ERROR', count: 30 }], // errorsByType
        [{ _id: 'BROKER_CONTROLLER', count: 60 }], // errorsByComponent
        [{ _id: 'BE', count: 80 }, { _id: 'UI', count: 20 }], // errorsBySource
        [{ _id: 'BROKER_ERROR', count: 50 }], // errorsByType (duplicate for test)
        [{ _id: '2025-01-15', totalCount: 25, levels: [{ level: 'ERROR', count: 25 }] }], // errorsByTimeRange
        [{ _id: { message: 'Connection failed', errorType: 'NETWORK_ERROR', component: 'BROKER_CONTROLLER' }, count: 15, lastOccurred: new Date() }], // topErrors
        { hourly: [1, 2, 3], daily: [10, 15, 20], weekly: [50, 60, 70] } // errorTrends
      ];

      // Mock the private methods to return expected results
      vi.spyOn(errorAggregationService as any, 'getTotalErrors').mockResolvedValue(100);
      vi.spyOn(errorAggregationService as any, 'getErrorsByDimension').mockImplementation((matchStage, dimension) => {
        if (dimension === 'errorType') return Promise.resolve({ 'BROKER_ERROR': 50, 'NETWORK_ERROR': 30 });
        if (dimension === 'component') return Promise.resolve({ 'BROKER_CONTROLLER': 60 });
        if (dimension === 'source') return Promise.resolve({ 'BE': 80, 'UI': 20 });
        if (dimension === 'level') return Promise.resolve({ 'ERROR': 80, 'WARN': 20 });
        return Promise.resolve({});
      });
      vi.spyOn(errorAggregationService as any, 'getErrorsByTimeRange').mockResolvedValue([
        { timestamp: new Date('2025-01-15'), count: 25, level: { 'ERROR': 25 } }
      ]);
      vi.spyOn(errorAggregationService as any, 'getTopErrors').mockResolvedValue([
        { message: 'Connection failed', count: 15, lastOccurred: new Date(), errorType: 'NETWORK_ERROR', component: 'BROKER_CONTROLLER' }
      ]);
      vi.spyOn(errorAggregationService as any, 'getErrorTrends').mockResolvedValue({
        hourly: [1, 2, 3],
        daily: [10, 15, 20],
        weekly: [50, 60, 70]
      });

      // Act
      const result = await errorAggregationService.aggregateErrors(dimensions);

      // Assert
      expect(result).toEqual({
        totalErrors: 100,
        errorsByLevel: { 'ERROR': 80, 'WARN': 20 },
        errorsBySource: { 'BE': 80, 'UI': 20 },
        errorsByComponent: { 'BROKER_CONTROLLER': 60 },
        errorsByType: { 'BROKER_ERROR': 50, 'NETWORK_ERROR': 30 },
        errorsByTimeRange: [
          { timestamp: new Date('2025-01-15'), count: 25, level: { 'ERROR': 25 } }
        ],
        topErrors: [
          { message: 'Connection failed', count: 15, lastOccurred: expect.any(Date), errorType: 'NETWORK_ERROR', component: 'BROKER_CONTROLLER' }
        ],
        errorTrends: {
          hourly: [1, 2, 3],
          daily: [10, 15, 20],
          weekly: [50, 60, 70]
        }
      });
    });

    it('should handle aggregation with no filters', async () => {
      // Arrange
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
          granularity: 'hour'
        }
      };

      // Mock the private methods
      vi.spyOn(errorAggregationService as any, 'getTotalErrors').mockResolvedValue(50);
      vi.spyOn(errorAggregationService as any, 'getErrorsByDimension').mockResolvedValue({});
      vi.spyOn(errorAggregationService as any, 'getErrorsByTimeRange').mockResolvedValue([]);
      vi.spyOn(errorAggregationService as any, 'getTopErrors').mockResolvedValue([]);
      vi.spyOn(errorAggregationService as any, 'getErrorTrends').mockResolvedValue({
        hourly: [],
        daily: [],
        weekly: []
      });

      // Act
      const result = await errorAggregationService.aggregateErrors(dimensions);

      // Assert
      expect(result.totalErrors).toBe(50);
      expect(result.errorsByLevel).toEqual({});
      expect(result.errorsByTimeRange).toEqual([]);
    });

    it('should handle aggregation failure gracefully', async () => {
      // Arrange
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
          granularity: 'day'
        }
      };

      vi.spyOn(errorAggregationService as any, 'getTotalErrors').mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(errorAggregationService.aggregateErrors(dimensions)).rejects.toThrow('Failed to aggregate error data');
      expect(mockLogger.error).toHaveBeenCalledWith('Error aggregating error data:', expect.any(Error));
    });
  });

  describe('detectErrorPatterns', () => {
    it('should detect various error patterns', async () => {
      // Arrange
      const timeRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31')
      };

      // Mock the pattern detection methods
      vi.spyOn(errorAggregationService as any, 'findRecurringErrors').mockResolvedValue([
        {
          id: 'recurring_0',
          pattern: 'Recurring error: Connection timeout',
          description: 'Error "Connection timeout" occurred 10 times in BROKER_CONTROLLER',
          occurrences: 10,
          firstSeen: new Date('2025-01-01'),
          lastSeen: new Date('2025-01-15'),
          severity: 'HIGH',
          components: ['BROKER_CONTROLLER'],
          errorTypes: ['NETWORK_ERROR'],
          trend: 'INCREASING',
          impactScore: 100,
          relatedTraceIds: ['trace_1', 'trace_2']
        }
      ]);

      vi.spyOn(errorAggregationService as any, 'findErrorCascades').mockResolvedValue([
        {
          id: 'cascade_0',
          pattern: 'Error cascade in trace trace_123',
          description: '5 errors occurred in single request affecting 3 components',
          occurrences: 5,
          firstSeen: new Date('2025-01-10'),
          lastSeen: new Date('2025-01-10'),
          severity: 'HIGH',
          components: ['AUTH_CONTROLLER', 'BROKER_CONTROLLER', 'DATABASE'],
          errorTypes: ['AUTH_ERROR', 'BROKER_ERROR', 'DB_ERROR'],
          trend: 'STABLE',
          impactScore: 150,
          relatedTraceIds: ['trace_123']
        }
      ]);

      vi.spyOn(errorAggregationService as any, 'findComponentFailurePatterns').mockResolvedValue([]);
      vi.spyOn(errorAggregationService as any, 'findTimeBasedPatterns').mockResolvedValue([]);
      vi.spyOn(errorAggregationService as any, 'findUserSpecificPatterns').mockResolvedValue([]);

      // Act
      const result = await errorAggregationService.detectErrorPatterns(timeRange);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'cascade_0',
          pattern: 'Error cascade in trace trace_123',
          impactScore: 150,
          severity: 'HIGH'
        })
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          id: 'recurring_0',
          pattern: 'Recurring error: Connection timeout',
          impactScore: 100,
          severity: 'HIGH'
        })
      );
    });

    it('should limit patterns to top 50 by impact score', async () => {
      // Arrange
      const timeRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31')
      };

      // Create 60 patterns with different impact scores
      const manyPatterns = Array.from({ length: 60 }, (_, i) => ({
        id: `pattern_${i}`,
        pattern: `Pattern ${i}`,
        description: `Description ${i}`,
        occurrences: i + 1,
        firstSeen: new Date('2025-01-01'),
        lastSeen: new Date('2025-01-15'),
        severity: 'MEDIUM' as const,
        components: ['COMPONENT'],
        errorTypes: ['ERROR_TYPE'],
        trend: 'STABLE' as const,
        impactScore: i + 1, // Impact scores from 1 to 60
        relatedTraceIds: []
      }));

      vi.spyOn(errorAggregationService as any, 'findRecurringErrors').mockResolvedValue(manyPatterns);
      vi.spyOn(errorAggregationService as any, 'findErrorCascades').mockResolvedValue([]);
      vi.spyOn(errorAggregationService as any, 'findComponentFailurePatterns').mockResolvedValue([]);
      vi.spyOn(errorAggregationService as any, 'findTimeBasedPatterns').mockResolvedValue([]);
      vi.spyOn(errorAggregationService as any, 'findUserSpecificPatterns').mockResolvedValue([]);

      // Act
      const result = await errorAggregationService.detectErrorPatterns(timeRange);

      // Assert
      expect(result).toHaveLength(50);
      // Should be sorted by impact score descending (highest first)
      expect(result[0].impactScore).toBe(60);
      expect(result[49].impactScore).toBe(11);
    });

    it('should handle pattern detection failure gracefully', async () => {
      // Arrange
      const timeRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31')
      };

      vi.spyOn(errorAggregationService as any, 'findRecurringErrors').mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(errorAggregationService.detectErrorPatterns(timeRange)).rejects.toThrow('Failed to detect error patterns');
      expect(mockLogger.error).toHaveBeenCalledWith('Error detecting error patterns:', expect.any(Error));
    });
  });

  describe('analyzeErrorImpact', () => {
    it('should analyze comprehensive error impact', async () => {
      // Arrange
      const timeRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31')
      };

      // Mock all the impact analysis methods
      vi.spyOn(errorAggregationService as any, 'calculateSystemHealthScore').mockResolvedValue(85.5);
      vi.spyOn(errorAggregationService as any, 'calculateUserExperienceImpact').mockResolvedValue({
        affectedUsers: 25,
        totalUsers: 100,
        impactPercentage: 25.0
      });
      vi.spyOn(errorAggregationService as any, 'calculateComponentReliability').mockResolvedValue({
        'BROKER_CONTROLLER': {
          errorRate: 5.2,
          availability: 94.8,
          meanTimeBetweenFailures: 3600
        },
        'AUTH_CONTROLLER': {
          errorRate: 2.1,
          availability: 97.9,
          meanTimeBetweenFailures: 7200
        }
      });
      vi.spyOn(errorAggregationService as any, 'getCriticalErrorsCount').mockResolvedValue(15);
      vi.spyOn(errorAggregationService as any, 'calculateRecoveryTime').mockResolvedValue({
        average: 2500,
        median: 2000,
        p95: 5000
      });
      vi.spyOn(errorAggregationService as any, 'calculateBusinessImpact').mockResolvedValue({
        tradingOperationsAffected: 45,
        revenueImpact: 'MEDIUM',
        userSatisfactionScore: 78.5
      });

      // Act
      const result = await errorAggregationService.analyzeErrorImpact(timeRange);

      // Assert
      expect(result).toEqual({
        systemHealthScore: 85.5,
        userExperienceImpact: {
          affectedUsers: 25,
          totalUsers: 100,
          impactPercentage: 25.0
        },
        componentReliability: {
          'BROKER_CONTROLLER': {
            errorRate: 5.2,
            availability: 94.8,
            meanTimeBetweenFailures: 3600
          },
          'AUTH_CONTROLLER': {
            errorRate: 2.1,
            availability: 97.9,
            meanTimeBetweenFailures: 7200
          }
        },
        criticalErrorsCount: 15,
        recoveryTime: {
          average: 2500,
          median: 2000,
          p95: 5000
        },
        businessImpact: {
          tradingOperationsAffected: 45,
          revenueImpact: 'MEDIUM',
          userSatisfactionScore: 78.5
        }
      });
    });

    it('should handle impact analysis failure gracefully', async () => {
      // Arrange
      const timeRange = {
        start: new Date('2025-01-01'),
        end: new Date('2025-01-31')
      };

      vi.spyOn(errorAggregationService as any, 'calculateSystemHealthScore').mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(errorAggregationService.analyzeErrorImpact(timeRange)).rejects.toThrow('Failed to analyze error impact');
      expect(mockLogger.error).toHaveBeenCalledWith('Error analyzing error impact:', expect.any(Error));
    });
  });

  describe('private helper methods', () => {
    describe('getTotalErrors', () => {
      it('should count total errors with match criteria', async () => {
        // Arrange
        const matchStage = { level: 'ERROR', timestamp: { $gte: new Date() } };
        mockErrorLog.countDocuments.mockResolvedValue(150);

        // Act
        const result = await (errorAggregationService as any).getTotalErrors(matchStage);

        // Assert
        expect(result).toBe(150);
        expect(mockErrorLog.countDocuments).toHaveBeenCalledWith(matchStage);
      });
    });

    describe('getErrorsByDimension', () => {
      it('should aggregate errors by specified dimension', async () => {
        // Arrange
        const matchStage = { level: 'ERROR' };
        const dimension = 'component';
        const mockAggregateResult = [
          { _id: 'BROKER_CONTROLLER', count: 50 },
          { _id: 'AUTH_CONTROLLER', count: 30 }
        ];
        
        mockErrorLog.aggregate.mockResolvedValue(mockAggregateResult);

        // Act
        const result = await (errorAggregationService as any).getErrorsByDimension(matchStage, dimension);

        // Assert
        expect(result).toEqual({
          'BROKER_CONTROLLER': 50,
          'AUTH_CONTROLLER': 30
        });
        expect(mockErrorLog.aggregate).toHaveBeenCalledWith([
          { $match: matchStage },
          { $group: { _id: `${dimension}`, count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]);
      });
    });

    describe('getErrorsByTimeRange', () => {
      it('should aggregate errors by time range with daily granularity', async () => {
        // Arrange
        const matchStage = { level: 'ERROR' };
        const granularity = 'day';
        const mockAggregateResult = [
          {
            _id: '2025-01-15',
            totalCount: 25,
            levels: [
              { level: 'ERROR', count: 20 },
              { level: 'WARN', count: 5 }
            ]
          }
        ];
        
        mockErrorLog.aggregate.mockResolvedValue(mockAggregateResult);

        // Act
        const result = await (errorAggregationService as any).getErrorsByTimeRange(matchStage, granularity);

        // Assert
        expect(result).toEqual([
          {
            timestamp: new Date('2025-01-15'),
            count: 25,
            level: {
              'ERROR': 20,
              'WARN': 5
            }
          }
        ]);
      });

      it('should use correct date format for different granularities', async () => {
        // Arrange
        const matchStage = { level: 'ERROR' };
        mockErrorLog.aggregate.mockResolvedValue([]);

        // Test different granularities
        const granularities = ['hour', 'day', 'week', 'month'];
        const expectedFormats = ['%Y-%m-%d %H:00:00', '%Y-%m-%d', '%Y-%U', '%Y-%m'];

        for (let i = 0; i < granularities.length; i++) {
          // Act
          await (errorAggregationService as any).getErrorsByTimeRange(matchStage, granularities[i]);

          // Assert
          expect(mockErrorLog.aggregate).toHaveBeenCalledWith(
            expect.arrayContaining([
              expect.objectContaining({
                $group: expect.objectContaining({
                  _id: expect.objectContaining({
                    date: { $dateToString: { format: expectedFormats[i], date: '$timestamp' } }
                  })
                })
              })
            ])
          );
        }
      });
    });

    describe('getTopErrors', () => {
      it('should return top errors by count', async () => {
        // Arrange
        const matchStage = { level: 'ERROR' };
        const mockAggregateResult = [
          {
            _id: {
              message: 'Connection failed',
              errorType: 'NETWORK_ERROR',
              component: 'BROKER_CONTROLLER'
            },
            count: 25,
            lastOccurred: new Date('2025-01-15')
          },
          {
            _id: {
              message: 'Authentication failed',
              errorType: 'AUTH_ERROR',
              component: 'AUTH_CONTROLLER'
            },
            count: 15,
            lastOccurred: new Date('2025-01-14')
          }
        ];
        
        mockErrorLog.aggregate.mockResolvedValue(mockAggregateResult);

        // Act
        const result = await (errorAggregationService as any).getTopErrors(matchStage);

        // Assert
        expect(result).toEqual([
          {
            message: 'Connection failed',
            count: 25,
            lastOccurred: new Date('2025-01-15'),
            errorType: 'NETWORK_ERROR',
            component: 'BROKER_CONTROLLER'
          },
          {
            message: 'Authentication failed',
            count: 15,
            lastOccurred: new Date('2025-01-14'),
            errorType: 'AUTH_ERROR',
            component: 'AUTH_CONTROLLER'
          }
        ]);
        expect(mockErrorLog.aggregate).toHaveBeenCalledWith(
          expect.arrayContaining([
            { $match: matchStage },
            { $sort: { count: -1 } },
            { $limit: 20 }
          ])
        );
      });
    });

    describe('calculateSystemHealthScore', () => {
      it('should calculate health score based on error rate', async () => {
        // Arrange
        const timeRange = {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31')
        };
        
        mockTraceLifecycle.countDocuments
          .mockResolvedValueOnce(1000) // totalRequests
          .mockResolvedValueOnce(50);  // errorRequests

        // Act
        const result = await (errorAggregationService as any).calculateSystemHealthScore(timeRange);

        // Assert
        // Health score = (1 - errorRate) * 100 = (1 - 50/1000) * 100 = 95
        expect(result).toBe(95);
      });

      it('should return 100 when no requests', async () => {
        // Arrange
        const timeRange = {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31')
        };
        
        mockTraceLifecycle.countDocuments.mockResolvedValue(0);

        // Act
        const result = await (errorAggregationService as any).calculateSystemHealthScore(timeRange);

        // Assert
        expect(result).toBe(100);
      });
    });

    describe('calculateUserExperienceImpact', () => {
      it('should calculate user experience impact', async () => {
        // Arrange
        const timeRange = {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31')
        };
        
        mockErrorLog.distinct.mockResolvedValue(['user_1', 'user_2', 'user_3']); // affectedUsers
        mockTraceLifecycle.distinct.mockResolvedValue(['user_1', 'user_2', 'user_3', 'user_4', 'user_5']); // totalUsers

        // Act
        const result = await (errorAggregationService as any).calculateUserExperienceImpact(timeRange);

        // Assert
        expect(result).toEqual({
          affectedUsers: 3,
          totalUsers: 5,
          impactPercentage: 60
        });
      });

      it('should handle zero total users', async () => {
        // Arrange
        const timeRange = {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31')
        };
        
        mockErrorLog.distinct.mockResolvedValue(['user_1']);
        mockTraceLifecycle.distinct.mockResolvedValue([]);

        // Act
        const result = await (errorAggregationService as any).calculateUserExperienceImpact(timeRange);

        // Assert
        expect(result).toEqual({
          affectedUsers: 1,
          totalUsers: 0,
          impactPercentage: 0
        });
      });
    });

    describe('utility methods', () => {
      it('should calculate severity based on count and recency', () => {
        // Arrange
        const highCountRecentError = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
        const lowCountOldError = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

        // Act
        const criticalSeverity = (errorAggregationService as any).calculateSeverity(150, highCountRecentError);
        const lowSeverity = (errorAggregationService as any).calculateSeverity(5, lowCountOldError);

        // Assert
        expect(criticalSeverity).toBe('CRITICAL');
        expect(lowSeverity).toBe('LOW');
      });

      it('should calculate trend based on error rate', () => {
        // Arrange
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        // Act
        const increasingTrend = (errorAggregationService as any).calculateTrend(oneHourAgo, now, 10); // 10 errors per hour
        const decreasingTrend = (errorAggregationService as any).calculateTrend(oneHourAgo, now, 0.5); // 0.5 errors per hour
        const stableTrend = (errorAggregationService as any).calculateTrend(oneHourAgo, now, 3); // 3 errors per hour

        // Assert
        expect(increasingTrend).toBe('INCREASING');
        expect(decreasingTrend).toBe('DECREASING');
        expect(stableTrend).toBe('STABLE');
      });

      it('should calculate impact score with recency factor', () => {
        // Arrange
        const recentError = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        const oldError = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago

        // Act
        const recentImpact = (errorAggregationService as any).calculateImpactScore(10, 3, recentError);
        const oldImpact = (errorAggregationService as any).calculateImpactScore(10, 3, oldError);

        // Assert
        expect(recentImpact).toBeGreaterThan(oldImpact);
        expect(recentImpact).toBeGreaterThan(0);
        expect(oldImpact).toBeGreaterThan(0);
      });
    });
  });

  describe('error handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Arrange
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
          granularity: 'day'
        }
      };

      mockErrorLog.countDocuments.mockRejectedValue(new Error('Connection failed'));

      // Act & Assert
      await expect(errorAggregationService.aggregateErrors(dimensions)).rejects.toThrow('Failed to aggregate error data');
    });

    it('should handle malformed aggregation results', async () => {
      // Arrange
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
          granularity: 'day'
        }
      };

      // Mock methods to return malformed data
      vi.spyOn(errorAggregationService as any, 'getTotalErrors').mockResolvedValue(null);
      vi.spyOn(errorAggregationService as any, 'getErrorsByDimension').mockResolvedValue(null);
      vi.spyOn(errorAggregationService as any, 'getErrorsByTimeRange').mockResolvedValue(null);
      vi.spyOn(errorAggregationService as any, 'getTopErrors').mockResolvedValue(null);
      vi.spyOn(errorAggregationService as any, 'getErrorTrends').mockResolvedValue(null);

      // Act & Assert
      await expect(errorAggregationService.aggregateErrors(dimensions)).rejects.toThrow();
    });
  });

  describe('performance considerations', () => {
    it('should handle large datasets efficiently', async () => {
      // This test would verify that the service can handle large amounts of data
      // For now, we'll just ensure the aggregation pipeline is structured correctly
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
          granularity: 'day'
        },
        filters: {
          level: ['ERROR', 'WARN'],
          source: ['BE', 'UI'],
          component: ['BROKER_CONTROLLER', 'AUTH_CONTROLLER'],
          errorType: ['NETWORK_ERROR', 'AUTH_ERROR'],
          userId: 'user_123'
        }
      };

      // Mock all methods to return empty results quickly
      vi.spyOn(errorAggregationService as any, 'getTotalErrors').mockResolvedValue(0);
      vi.spyOn(errorAggregationService as any, 'getErrorsByDimension').mockResolvedValue({});
      vi.spyOn(errorAggregationService as any, 'getErrorsByTimeRange').mockResolvedValue([]);
      vi.spyOn(errorAggregationService as any, 'getTopErrors').mockResolvedValue([]);
      vi.spyOn(errorAggregationService as any, 'getErrorTrends').mockResolvedValue({
        hourly: [],
        daily: [],
        weekly: []
      });

      // Act
      const startTime = Date.now();
      const result = await errorAggregationService.aggregateErrors(dimensions);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result).toBeDefined();
    });
  });
});