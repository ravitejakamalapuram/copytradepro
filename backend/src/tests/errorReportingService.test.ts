import { ErrorReportingService, ErrorExportOptions } from '../services/errorReportingService';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';
import { errorAggregationService } from '../services/errorAggregationService';
import * as fs from 'fs/promises';

// Mock dependencies
jest.mock('../models/errorLogModels');
jest.mock('../services/errorAggregationService');
jest.mock('../utils/logger');
jest.mock('fs/promises');

const MockErrorLog = ErrorLog as jest.Mocked<typeof ErrorLog>;
const MockTraceLifecycle = TraceLifecycle as jest.Mocked<typeof TraceLifecycle>;
const mockErrorAggregationService = errorAggregationService as jest.Mocked<typeof errorAggregationService>;
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ErrorReportingService', () => {
  let service: ErrorReportingService;
  let mockTimeRange: { start: Date; end: Date };

  beforeEach(() => {
    service = new ErrorReportingService();
    mockTimeRange = {
      start: new Date('2025-01-01T00:00:00Z'),
      end: new Date('2025-01-07T23:59:59Z')
    };
    jest.clearAllMocks();

    // Mock fs operations
    mockFs.mkdir = jest.fn().mockResolvedValue(undefined);
    mockFs.writeFile = jest.fn().mockResolvedValue(undefined);
    mockFs.stat = jest.fn().mockResolvedValue({ size: 1024 } as any);
  });

  describe('exportErrorData', () => {
    it('should export error data in JSON format', async () => {
      const options: ErrorExportOptions = {
        format: 'json',
        timeRange: mockTimeRange,
        includeAnalytics: true,
        maxRecords: 100
      };

      const mockErrorLogs = [
        {
          _id: 'error1',
          timestamp: new Date('2025-01-01T10:00:00Z'),
          traceId: 'trace1',
          level: 'ERROR',
          source: 'BE',
          component: 'BROKER_CONTROLLER',
          message: 'Test error',
          errorType: 'BROKER_API_ERROR',
          context: { userId: 'user1' }
        }
      ];

      const mockAnalytics = {
        totalErrors: 1,
        errorsByLevel: { ERROR: 1 },
        errorsBySource: { BE: 1 }
      };

      MockErrorLog.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockErrorLogs)
          })
        })
      });

      mockErrorAggregationService.aggregateErrors = jest.fn().mockResolvedValue(mockAnalytics);

      const result = await service.exportErrorData(options);

      expect(result).toMatchObject({
        recordCount: 1,
        fileSize: 1024
      });
      expect(result.filePath).toContain('error-export-');
      expect(result.filePath).toMatch(/\.json$/);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should export error data in CSV format', async () => {
      const options: ErrorExportOptions = {
        format: 'csv',
        timeRange: mockTimeRange,
        maxRecords: 100
      };

      const mockErrorLogs = [
        {
          timestamp: new Date('2025-01-01T10:00:00Z'),
          traceId: 'trace1',
          level: 'ERROR',
          source: 'BE',
          component: 'BROKER_CONTROLLER',
          operation: 'PLACE_ORDER',
          errorType: 'BROKER_API_ERROR',
          message: 'Test error',
          context: {
            userId: 'user1',
            sessionId: 'session1',
            brokerName: 'zerodha',
            url: '/api/orders',
            method: 'POST',
            statusCode: 400,
            duration: 1000
          }
        }
      ];

      MockErrorLog.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockErrorLogs)
          })
        })
      });

      const result = await service.exportErrorData(options);

      expect(result.filePath).toMatch(/\.csv$/);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('timestamp,traceId,level,source,component'),
        'utf8'
      );
    });

    it('should export error data in structured logs format', async () => {
      const options: ErrorExportOptions = {
        format: 'structured-logs',
        timeRange: mockTimeRange
      };

      const mockErrorLogs = [
        {
          timestamp: new Date('2025-01-01T10:00:00Z'),
          traceId: 'trace1',
          level: 'ERROR',
          source: 'BE',
          component: 'BROKER_CONTROLLER',
          operation: 'PLACE_ORDER',
          errorType: 'BROKER_API_ERROR',
          message: 'Test error',
          context: { userId: 'user1' },
          metadata: { version: '1.0.0' }
        }
      ];

      MockErrorLog.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockErrorLogs)
          })
        })
      });

      const result = await service.exportErrorData(options);

      expect(result.filePath).toMatch(/\.log$/);
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"@timestamp"'),
        'utf8'
      );
    });

    it('should handle empty error logs', async () => {
      const options: ErrorExportOptions = {
        format: 'json',
        timeRange: mockTimeRange
      };

      MockErrorLog.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      const result = await service.exportErrorData(options);

      expect(result.recordCount).toBe(0);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should apply filters correctly', async () => {
      const options: ErrorExportOptions = {
        format: 'json',
        timeRange: mockTimeRange,
        filters: {
          level: ['ERROR'],
          source: ['BE'],
          component: ['BROKER_CONTROLLER'],
          userId: 'user1'
        }
      };

      MockErrorLog.find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
          })
        })
      });

      await service.exportErrorData(options);

      expect(MockErrorLog.find).toHaveBeenCalledWith({
        timestamp: {
          $gte: mockTimeRange.start,
          $lte: mockTimeRange.end
        },
        level: { $in: ['ERROR'] },
        source: { $in: ['BE'] },
        component: { $in: ['BROKER_CONTROLLER'] },
        'context.userId': 'user1'
      });
    });

    it('should throw error when export fails', async () => {
      const options: ErrorExportOptions = {
        format: 'json',
        timeRange: mockTimeRange
      };

      MockErrorLog.find = jest.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(service.exportErrorData(options)).rejects.toThrow('Failed to export error data');
    });
  });

  describe('generateErrorReport', () => {
    it('should generate comprehensive error report', async () => {
      const mockAggregation = {
        totalErrors: 100,
        errorsByLevel: { ERROR: 80, WARN: 20 },
        errorsBySource: { BE: 60, UI: 40 },
        errorsByComponent: { BROKER_CONTROLLER: 50, AUTH_CONTROLLER: 30 },
        errorsByType: { BROKER_API_ERROR: 40, VALIDATION_ERROR: 30 }
      };

      const mockPatterns = [
        {
          id: 'pattern1',
          pattern: 'Recurring connection timeout',
          description: 'Connection timeout errors in broker controller',
          occurrences: 25,
          severity: 'HIGH',
          components: ['BROKER_CONTROLLER'],
          errorTypes: ['NETWORK_ERROR'],
          impactScore: 75
        }
      ];

      const mockImpact = {
        systemHealthScore: 92,
        criticalErrorsCount: 5,
        userExperienceImpact: {
          affectedUsers: 10,
          totalUsers: 100,
          impactPercentage: 10
        },
        componentReliability: {
          BROKER_CONTROLLER: { errorRate: 5, availability: 95, meanTimeBetweenFailures: 3600 }
        }
      };

      mockErrorAggregationService.aggregateErrors = jest.fn().mockResolvedValue(mockAggregation);
      mockErrorAggregationService.detectErrorPatterns = jest.fn().mockResolvedValue(mockPatterns);
      mockErrorAggregationService.analyzeErrorImpact = jest.fn().mockResolvedValue(mockImpact);

      const report = await service.generateErrorReport(mockTimeRange);

      expect(report).toMatchObject({
        title: expect.stringContaining('Error Analysis Report'),
        timeRange: mockTimeRange,
        summary: {
          totalErrors: 100,
          criticalErrors: 5,
          systemHealthScore: 92,
          affectedUsers: 10
        }
      });

      expect(report.patterns).toHaveLength(1);
      expect(report.patterns[0]).toMatchObject({
        pattern: 'Recurring connection timeout',
        occurrences: 25,
        severity: 'HIGH'
      });

      expect(report.recommendations).toBeDefined();
      expect(report.developmentTasks).toBeDefined();
    });

    it('should handle errors during report generation', async () => {
      mockErrorAggregationService.aggregateErrors = jest.fn().mockRejectedValue(new Error('Aggregation failed'));

      await expect(service.generateErrorReport(mockTimeRange)).rejects.toThrow('Failed to generate error report');
    });
  });

  describe('generateDevelopmentTaskSummary', () => {
    it('should generate development task summary', async () => {
      const mockPatterns = [
        {
          pattern: 'High error rate in BROKER_CONTROLLER',
          description: 'Multiple broker API failures',
          occurrences: 50,
          severity: 'HIGH',
          components: ['BROKER_CONTROLLER'],
          errorTypes: ['BROKER_API_ERROR'],
          impactScore: 150
        },
        {
          pattern: 'Authentication failures',
          description: 'Users unable to authenticate',
          occurrences: 20,
          severity: 'MEDIUM',
          components: ['AUTH_CONTROLLER'],
          errorTypes: ['AUTH_ERROR'],
          impactScore: 60
        }
      ];

      const mockImpact = {
        systemHealthScore: 88,
        criticalErrorsCount: 8,
        userExperienceImpact: {
          affectedUsers: 15,
          totalUsers: 100,
          impactPercentage: 15
        }
      };

      mockErrorAggregationService.detectErrorPatterns = jest.fn().mockResolvedValue(mockPatterns);
      mockErrorAggregationService.analyzeErrorImpact = jest.fn().mockResolvedValue(mockImpact);

      const result = await service.generateDevelopmentTaskSummary(mockTimeRange);

      expect(result.summary).toContain('System Health Score: 88%');
      expect(result.summary).toContain('Critical Errors: 8');
      expect(result.summary).toContain('Affected Users: 15');

      expect(result.tasks).toHaveLength(3); // 2 patterns + 1 system improvement task
      expect(result.tasks[0]).toMatchObject({
        title: expect.stringContaining('Fix: High error rate in BROKER_CONTROLLER'),
        priority: 'HIGH',
        component: 'BROKER_CONTROLLER',
        errorCount: 50,
        impactScore: 150
      });

      // Tasks should be sorted by impact score
      if (result.tasks.length > 1) {
        expect(result.tasks[0].impactScore).toBeGreaterThanOrEqual(result.tasks[1].impactScore);
      }
    });

    it('should handle empty patterns', async () => {
      mockErrorAggregationService.detectErrorPatterns = jest.fn().mockResolvedValue([]);
      mockErrorAggregationService.analyzeErrorImpact = jest.fn().mockResolvedValue({
        systemHealthScore: 98,
        criticalErrorsCount: 0,
        userExperienceImpact: { affectedUsers: 0, totalUsers: 100, impactPercentage: 0 }
      });

      const result = await service.generateDevelopmentTaskSummary(mockTimeRange);

      expect(result.summary).toContain('System Health Score: 98%');
      expect(result.tasks).toHaveLength(0); // No patterns, system health is good
    });
  });

  describe('saveErrorReport', () => {
    it('should save report in JSON format', async () => {
      const mockReport = {
        id: 'test-report',
        title: 'Test Report',
        generatedAt: new Date(),
        timeRange: mockTimeRange,
        summary: { 
          totalErrors: 10, 
          criticalErrors: 2, 
          systemHealthScore: 95, 
          affectedUsers: 5,
          topComponents: [],
          topErrorTypes: []
        },
        patterns: [],
        recommendations: [],
        developmentTasks: []
      };

      const filePath = await service.saveErrorReport(mockReport, 'json');

      expect(filePath).toContain('test-report.json');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-report.json'),
        expect.stringContaining('"id": "test-report"'),
        'utf8'
      );
    });

    it('should save report in HTML format', async () => {
      const mockReport = {
        id: 'test-report',
        title: 'Test Report',
        generatedAt: new Date(),
        timeRange: mockTimeRange,
        summary: { 
          totalErrors: 10, 
          criticalErrors: 2, 
          systemHealthScore: 95, 
          affectedUsers: 5, 
          topComponents: [], 
          topErrorTypes: [] 
        },
        patterns: [],
        recommendations: [],
        developmentTasks: []
      };

      const filePath = await service.saveErrorReport(mockReport, 'html');

      expect(filePath).toContain('test-report.html');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-report.html'),
        expect.stringContaining('<!DOCTYPE html>'),
        'utf8'
      );
    });

    it('should save report in Markdown format', async () => {
      const mockReport = {
        id: 'test-report',
        title: 'Test Report',
        generatedAt: new Date(),
        timeRange: mockTimeRange,
        summary: { 
          totalErrors: 10, 
          criticalErrors: 2, 
          systemHealthScore: 95, 
          affectedUsers: 5, 
          topComponents: [], 
          topErrorTypes: [] 
        },
        patterns: [],
        recommendations: [],
        developmentTasks: []
      };

      const filePath = await service.saveErrorReport(mockReport, 'markdown');

      expect(filePath).toContain('test-report.markdown');
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-report.markdown'),
        expect.stringContaining('# Test Report'),
        'utf8'
      );
    });

    it('should throw error for unsupported format', async () => {
      const mockReport = {
        id: 'test-report',
        title: 'Test Report',
        generatedAt: new Date(),
        timeRange: mockTimeRange,
        summary: { 
          totalErrors: 10, 
          criticalErrors: 2, 
          systemHealthScore: 95, 
          affectedUsers: 5,
          topComponents: [],
          topErrorTypes: []
        },
        patterns: [],
        recommendations: [],
        developmentTasks: []
      };

      await expect(service.saveErrorReport(mockReport, 'xml' as any)).rejects.toThrow('Unsupported report format: xml');
    });
  });
});