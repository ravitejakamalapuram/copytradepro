import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ErrorLoggingService, ErrorLogEntry, ErrorAnalytics } from '../services/errorLoggingService';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';
import { traceIdService } from '../services/traceIdService';
import { logger } from '../utils/logger';
import { ErrorClassificationService } from '../services/errorClassificationService';

// Mock dependencies
jest.mock('../models/errorLogModels');
jest.mock('../services/traceIdService');
jest.mock('../utils/logger');
jest.mock('../services/errorClassificationService');

describe('ErrorLoggingService', () => {
  let errorLoggingService: ErrorLoggingService;
  let mockErrorLog: any;
  let mockTraceLifecycle: any;
  let mockTraceIdService: any;
  let mockLogger: any;
  let mockErrorClassificationService: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock ErrorLog model
    mockErrorLog = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
      distinct: jest.fn(),
      updateOne: jest.fn()
    };
    (ErrorLog as any) = mockErrorLog;

    // Mock TraceLifecycle model
    mockTraceLifecycle = {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
      distinct: jest.fn(),
      updateOne: jest.fn()
    };
    (TraceLifecycle as any) = mockTraceLifecycle;

    // Mock traceIdService
    mockTraceIdService = {
      generateTraceId: jest.fn(),
      completeOperation: jest.fn()
    };
    (traceIdService as any) = mockTraceIdService;

    // Mock logger
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    };
    (logger as any) = mockLogger;

    // Mock ErrorClassificationService
    mockErrorClassificationService = {
      getInstance: jest.fn().mockReturnValue({
        classifyError: jest.fn(),
        categorizeError: jest.fn()
      })
    };
    (ErrorClassificationService as any) = mockErrorClassificationService;

    // Get fresh instance
    errorLoggingService = ErrorLoggingService.getInstance();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('logError', () => {
    it('should log error with all required fields', async () => {
      // Arrange
      const mockError = new Error('Test error');
      const mockTraceId = 'trace_123';
      const mockErrorId = 'error_456';
      
      mockTraceIdService.generateTraceId.mockReturnValue(mockTraceId);
      mockErrorLog.create.mockResolvedValue({ id: mockErrorId });
      mockTraceIdService.completeOperation.mockResolvedValue(undefined);

      const context = {
        component: 'TEST_COMPONENT',
        operation: 'TEST_OPERATION',
        userId: 'user_123',
        brokerName: 'test_broker'
      };

      // Act
      const result = await errorLoggingService.logError('Test error message', mockError, context);

      // Assert
      expect(result).toBeDefined();
      expect(mockErrorLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: mockTraceId,
          level: 'ERROR',
          source: 'BE',
          component: 'TEST_COMPONENT',
          operation: 'TEST_OPERATION',
          message: 'Test error message',
          stackTrace: mockError.stack,
          context: expect.objectContaining({
            userId: 'user_123',
            brokerName: 'test_broker'
          }),
          metadata: expect.objectContaining({
            environment: expect.any(String),
            version: expect.any(String),
            nodeVersion: process.version,
            platform: process.platform
          })
        })
      );
      expect(mockTraceIdService.completeOperation).toHaveBeenCalledWith(
        mockTraceId,
        'TEST_OPERATION',
        'ERROR',
        expect.objectContaining({
          errorId: expect.any(String),
          errorType: expect.any(String)
        })
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle database save failure gracefully', async () => {
      // Arrange
      const mockError = new Error('Test error');
      const mockTraceId = 'trace_123';
      
      mockTraceIdService.generateTraceId.mockReturnValue(mockTraceId);
      mockErrorLog.create.mockRejectedValue(new Error('Database error'));

      const context = {
        component: 'TEST_COMPONENT',
        operation: 'TEST_OPERATION'
      };

      // Act
      const result = await errorLoggingService.logError('Test error message', mockError, context);

      // Assert
      expect(result).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to save error log to database',
        expect.any(Object),
        expect.any(Error)
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('[FALLBACK]'),
        expect.any(Object),
        mockError
      );
    });

    it('should use provided trace ID when available', async () => {
      // Arrange
      const mockError = new Error('Test error');
      const providedTraceId = 'provided_trace_123';
      
      mockErrorLog.create.mockResolvedValue({ id: 'error_456' });
      mockTraceIdService.completeOperation.mockResolvedValue(undefined);

      const context = {
        traceId: providedTraceId,
        component: 'TEST_COMPONENT',
        operation: 'TEST_OPERATION'
      };

      // Act
      await errorLoggingService.logError('Test error message', mockError, context);

      // Assert
      expect(mockTraceIdService.generateTraceId).not.toHaveBeenCalled();
      expect(mockErrorLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: providedTraceId
        })
      );
    });

    it('should handle different error levels', async () => {
      // Arrange
      const mockError = new Error('Test warning');
      const mockTraceId = 'trace_123';
      
      mockTraceIdService.generateTraceId.mockReturnValue(mockTraceId);
      mockErrorLog.create.mockResolvedValue({ id: 'error_456' });

      const context = {
        component: 'TEST_COMPONENT',
        operation: 'TEST_OPERATION',
        level: 'WARN' as const
      };

      // Act
      await errorLoggingService.logError('Test warning message', mockError, context);

      // Assert
      expect(mockErrorLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'WARN'
        })
      );
    });

    it('should handle different error sources', async () => {
      // Arrange
      const mockError = new Error('Test error');
      const mockTraceId = 'trace_123';
      
      mockTraceIdService.generateTraceId.mockReturnValue(mockTraceId);
      mockErrorLog.create.mockResolvedValue({ id: 'error_456' });

      const context = {
        component: 'TEST_COMPONENT',
        operation: 'TEST_OPERATION',
        source: 'UI' as const
      };

      // Act
      await errorLoggingService.logError('Test error message', mockError, context);

      // Assert
      expect(mockErrorLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'UI'
        })
      );
    });
  });

  describe('logWarning', () => {
    it('should log warning with correct level', async () => {
      // Arrange
      const mockTraceId = 'trace_123';
      mockTraceIdService.generateTraceId.mockReturnValue(mockTraceId);
      mockErrorLog.create.mockResolvedValue({ id: 'error_456' });

      const context = {
        component: 'TEST_COMPONENT',
        operation: 'TEST_OPERATION'
      };

      // Act
      await errorLoggingService.logWarning('Test warning message', context);

      // Assert
      expect(mockErrorLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'WARN',
          errorType: 'WARNING'
        })
      );
    });
  });

  describe('logInfo', () => {
    it('should log info with correct level', async () => {
      // Arrange
      const mockTraceId = 'trace_123';
      mockTraceIdService.generateTraceId.mockReturnValue(mockTraceId);
      mockErrorLog.create.mockResolvedValue({ id: 'error_456' });

      const context = {
        component: 'TEST_COMPONENT',
        operation: 'TEST_OPERATION'
      };

      // Act
      await errorLoggingService.logInfo('Test info message', context);

      // Assert
      expect(mockErrorLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'INFO',
          errorType: 'INFO'
        })
      );
    });
  });

  describe('searchErrorLogs', () => {
    it('should search errors with basic filters', async () => {
      // Arrange
      const mockErrors = [
        { id: 'error_1', message: 'Error 1', timestamp: new Date() },
        { id: 'error_2', message: 'Error 2', timestamp: new Date() }
      ];
      
      mockErrorLog.countDocuments.mockResolvedValue(10);
      mockErrorLog.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(mockErrors)
            })
          })
        })
      });

      const filters = {
        level: ['ERROR'],
        component: ['TEST_COMPONENT'],
        limit: 5,
        offset: 0
      };

      // Act
      const result = await errorLoggingService.searchErrorLogs(filters);

      // Assert
      expect(result).toEqual({
        errors: mockErrors,
        total: 10,
        hasMore: true
      });
      expect(mockErrorLog.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          level: { $in: ['ERROR'] },
          component: { $in: ['TEST_COMPONENT'] }
        })
      );
    });

    it('should handle trace ID filter', async () => {
      // Arrange
      const mockErrors = [{ id: 'error_1', traceId: 'trace_123' }];
      
      mockErrorLog.countDocuments.mockResolvedValue(1);
      mockErrorLog.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue(mockErrors)
            })
          })
        })
      });

      const filters = {
        traceId: 'trace_123'
      };

      // Act
      const result = await errorLoggingService.searchErrorLogs(filters);

      // Assert
      expect(mockErrorLog.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'trace_123'
        })
      );
    });

    it('should handle date range filters', async () => {
      // Arrange
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      
      mockErrorLog.countDocuments.mockResolvedValue(0);
      mockErrorLog.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              lean: vi.fn().mockResolvedValue([])
            })
          })
        })
      });

      const filters = {
        startDate,
        endDate
      };

      // Act
      await errorLoggingService.searchErrorLogs(filters);

      // Assert
      expect(mockErrorLog.countDocuments).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: {
            $gte: startDate,
            $lte: endDate
          }
        })
      );
    });

    it('should handle search failure gracefully', async () => {
      // Arrange
      mockErrorLog.countDocuments.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await errorLoggingService.searchErrorLogs({});

      // Assert
      expect(result).toEqual({
        errors: [],
        total: 0,
        hasMore: false
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to search error logs',
        expect.any(Object),
        expect.any(Error)
      );
    });
  });

  describe('getErrorAnalytics', () => {
    it('should return comprehensive error analytics', async () => {
      // Arrange
      const mockAggregationResults = [
        // Total stats
        [{ totalErrors: 100, criticalErrors: 10, resolvedErrors: 50, unresolvedErrors: 50 }],
        // Errors by type
        [{ _id: 'BROKER_ERROR', count: 30 }, { _id: 'NETWORK_ERROR', count: 20 }],
        // Errors by component
        [{ _id: 'BROKER_CONTROLLER', count: 25 }],
        // Errors by source
        [{ _id: 'BE', count: 80 }, { _id: 'UI', count: 20 }],
        // Top errors
        [{ _id: 'Connection failed', count: 15, lastOccurred: new Date() }],
        // Hourly trends
        [{ _id: { date: '2025-01-08', hour: 10 }, count: 5 }],
        // Errors by category
        [{ _id: 'TRADING', count: 40 }],
        // Errors by broker
        [{ _id: 'zerodha', count: 20 }],
        // Errors by user
        [{ _id: 'user_123', count: 10 }],
        // Severity distribution
        [{ _id: 'ERROR', count: 60 }, { _id: 'WARN', count: 40 }],
        // Daily trends
        [{ _id: '2025-01-08', count: 50 }],
        // Weekly trends
        [{ _id: { year: 2025, week: 2 }, count: 100 }]
      ];

      mockErrorLog.aggregate.mockImplementation((pipeline) => {
        // Return different results based on the aggregation pipeline
        const index = mockErrorLog.aggregate.mock.calls.length - 1;
        return Promise.resolve(mockAggregationResults[index] || []);
      });

      // Act
      const result = await errorLoggingService.getErrorAnalytics();

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          totalErrors: 100,
          criticalErrors: 10,
          resolvedErrors: 50,
          unresolvedErrors: 50,
          errorsByType: expect.objectContaining({
            'BROKER_ERROR': 30,
            'NETWORK_ERROR': 20
          }),
          errorsByComponent: expect.objectContaining({
            'BROKER_CONTROLLER': 25
          }),
          errorsBySource: expect.objectContaining({
            'BE': 80,
            'UI': 20
          }),
          topErrors: expect.arrayContaining([
            expect.objectContaining({
              message: 'Connection failed',
              count: 15
            })
          ]),
          errorTrends: expect.objectContaining({
            hourly: expect.any(Array),
            daily: expect.any(Array),
            weekly: expect.any(Array)
          })
        })
      );
    });

    it('should handle analytics failure gracefully', async () => {
      // Arrange
      mockErrorLog.aggregate.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await errorLoggingService.getErrorAnalytics();

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          totalErrors: 0,
          criticalErrors: 0,
          resolvedErrors: 0,
          unresolvedErrors: 0,
          errorsByType: {},
          errorsByComponent: {},
          errorsBySource: {},
          errorTrends: {
            hourly: [],
            daily: [],
            weekly: []
          }
        })
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get error analytics',
        expect.any(Object),
        expect.any(Error)
      );
    });
  });

  describe('getErrorPatterns', () => {
    it('should detect recurring error patterns', async () => {
      // Arrange
      const mockRecurringErrors = [
        {
          _id: { message: 'Connection timeout', component: 'BROKER_CONTROLLER', errorType: 'NETWORK_ERROR' },
          count: 10,
          firstSeen: new Date('2025-01-01'),
          lastSeen: new Date('2025-01-08'),
          components: ['BROKER_CONTROLLER'],
          traceIds: ['trace_1', 'trace_2']
        }
      ];

      const mockErrorSpikes = [
        {
          _id: { date: '2025-01-08', hour: 10 },
          count: 25,
          primaryErrors: [
            { component: 'BROKER_CONTROLLER', errorType: 'NETWORK_ERROR' }
          ]
        }
      ];

      const mockCorrelatedErrors = [
        {
          _id: 'trace_123',
          errors: [
            { component: 'AUTH_CONTROLLER', operation: 'LOGIN', timestamp: new Date(), message: 'Auth failed' },
            { component: 'BROKER_CONTROLLER', operation: 'CONNECT', timestamp: new Date(), message: 'Connection failed' }
          ],
          errorCount: 2
        }
      ];

      mockErrorLog.aggregate.mockImplementation((pipeline) => {
        const pipelineStr = JSON.stringify(pipeline);
        if (pipelineStr.includes('count: { $gte: 3 }')) {
          return Promise.resolve(mockRecurringErrors);
        } else if (pipelineStr.includes('count: { $gte: 10 }')) {
          return Promise.resolve(mockErrorSpikes);
        } else if (pipelineStr.includes('errorCount: { $gte: 2 }')) {
          return Promise.resolve(mockCorrelatedErrors);
        }
        return Promise.resolve([]);
      });

      // Act
      const result = await errorLoggingService.getErrorPatterns();

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          recurringErrors: expect.arrayContaining([
            expect.objectContaining({
              pattern: expect.stringContaining('Connection timeout'),
              count: 10,
              severity: expect.any(String),
              suggestedFix: expect.any(String)
            })
          ]),
          errorSpikes: expect.arrayContaining([
            expect.objectContaining({
              errorCount: 25,
              primaryCause: expect.any(String),
              affectedSystems: expect.arrayContaining(['BROKER_CONTROLLER'])
            })
          ]),
          correlatedErrors: expect.arrayContaining([
            expect.objectContaining({
              traceId: 'trace_123',
              errorChain: expect.arrayContaining([
                expect.objectContaining({
                  component: 'AUTH_CONTROLLER',
                  message: 'Auth failed'
                })
              ])
            })
          ])
        })
      );
    });

    it('should handle pattern detection failure gracefully', async () => {
      // Arrange
      mockErrorLog.aggregate.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await errorLoggingService.getErrorPatterns();

      // Assert
      expect(result).toEqual({
        recurringErrors: [],
        errorSpikes: [],
        correlatedErrors: []
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get error patterns',
        expect.any(Object),
        expect.any(Error)
      );
    });
  });

  describe('generateErrorInsights', () => {
    it('should generate actionable error insights', async () => {
      // Arrange
      const mockAnalytics = {
        totalErrors: 150,
        criticalErrors: 25,
        errorsByComponent: {
          'BROKER_CONTROLLER': 50,
          'AUTH_CONTROLLER': 30
        },
        errorsByCategory: {
          'TRADING': 60,
          'AUTHENTICATION': 30,
          'DATA': 20,
          'NETWORK': 25,
          'USER_INTERFACE': 15
        }
      };

      const mockPatterns = {
        recurringErrors: [
          { pattern: 'Connection timeout', count: 15 },
          { pattern: 'Auth failure', count: 10 }
        ]
      };

      // Mock the analytics and patterns methods
      vi.spyOn(errorLoggingService, 'getErrorAnalytics').mockResolvedValue(mockAnalytics as any);
      vi.spyOn(errorLoggingService, 'getErrorPatterns').mockResolvedValue(mockPatterns as any);

      // Act
      const result = await errorLoggingService.generateErrorInsights();

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          criticalIssues: expect.arrayContaining([
            expect.objectContaining({
              title: expect.any(String),
              description: expect.any(String),
              impact: expect.any(String),
              recommendedActions: expect.any(Array),
              priority: expect.any(String)
            })
          ]),
          performanceImpacts: expect.arrayContaining([
            expect.objectContaining({
              component: expect.any(String),
              avgErrorRate: expect.any(Number),
              impactOnUserExperience: expect.any(String),
              optimizationSuggestions: expect.any(Array)
            })
          ]),
          systemHealthScore: expect.objectContaining({
            overall: expect.any(Number),
            breakdown: expect.objectContaining({
              trading: expect.any(Number),
              authentication: expect.any(Number),
              data: expect.any(Number),
              network: expect.any(Number),
              ui: expect.any(Number)
            })
          })
        })
      );
    });

    it('should handle insights generation failure gracefully', async () => {
      // Arrange
      vi.spyOn(errorLoggingService, 'getErrorAnalytics').mockRejectedValue(new Error('Analytics error'));

      // Act
      const result = await errorLoggingService.generateErrorInsights();

      // Assert
      expect(result).toEqual({
        criticalIssues: [],
        performanceImpacts: [],
        systemHealthScore: {
          overall: 0,
          breakdown: {
            trading: 0,
            authentication: 0,
            data: 0,
            network: 0,
            ui: 0
          }
        }
      });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate error insights',
        expect.any(Object),
        expect.any(Error)
      );
    });
  });

  describe('getErrorById', () => {
    it('should retrieve error by ID', async () => {
      // Arrange
      const mockError = { errorId: 'error_123', message: 'Test error' };
      mockErrorLog.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockError)
      });

      // Act
      const result = await errorLoggingService.getErrorById('error_123');

      // Assert
      expect(result).toEqual(mockError);
      expect(mockErrorLog.findOne).toHaveBeenCalledWith({ errorId: 'error_123' });
    });

    it('should return null for non-existent error', async () => {
      // Arrange
      mockErrorLog.findOne.mockReturnValue({
        lean: vi.fn().mockResolvedValue(null)
      });

      // Act
      const result = await errorLoggingService.getErrorById('non_existent');

      // Assert
      expect(result).toBeNull();
    });

    it('should handle retrieval failure gracefully', async () => {
      // Arrange
      mockErrorLog.findOne.mockReturnValue({
        lean: vi.fn().mockRejectedValue(new Error('Database error'))
      });

      // Act & Assert
      await expect(errorLoggingService.getErrorById('error_123')).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get error by ID',
        expect.any(Object),
        expect.any(Error)
      );
    });
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      // Act
      const instance1 = ErrorLoggingService.getInstance();
      const instance2 = ErrorLoggingService.getInstance();

      // Assert
      expect(instance1).toBe(instance2);
    });
  });

  describe('error classification integration', () => {
    it('should use error classification service for categorization', async () => {
      // Arrange
      const mockError = new Error('Test error');
      const mockClassification = {
        type: 'NETWORK_ERROR',
        category: 'NETWORK',
        businessImpact: 'HIGH'
      };

      const mockClassificationService = {
        classifyError: vi.fn().mockReturnValue(mockClassification),
        categorizeError: vi.fn().mockReturnValue(mockClassification)
      };

      mockErrorClassificationService.getInstance.mockReturnValue(mockClassificationService);
      mockTraceIdService.generateTraceId.mockReturnValue('trace_123');
      mockErrorLog.create.mockResolvedValue({ id: 'error_456' });

      const context = {
        component: 'TEST_COMPONENT',
        operation: 'TEST_OPERATION'
      };

      // Act
      await errorLoggingService.logError('Test error message', mockError, context);

      // Assert
      expect(mockClassificationService.classifyError).toHaveBeenCalledWith(
        mockError,
        undefined,
        expect.any(Object)
      );
      expect(mockClassificationService.categorizeError).toHaveBeenCalledWith(
        mockError,
        expect.any(Object)
      );
    });
  });
});