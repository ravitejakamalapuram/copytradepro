import { Request, Response } from 'express';
import { errorAggregationService, ErrorAggregationDimensions } from '../services/errorAggregationService';
import { errorReportingService, ErrorExportOptions } from '../services/errorReportingService';
import { logger } from '../utils/logger';
import { traceIdService } from '../services/traceIdService';
import * as path from 'path';

export class ErrorAnalyticsController {
  /**
   * Get aggregated error data
   */
  async getErrorAggregation(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_ERROR_AGGREGATION', 'ERROR_ANALYTICS_CONTROLLER');

      const {
        startDate,
        endDate,
        granularity = 'day',
        level,
        source,
        component,
        errorType,
        userId,
        traceIdFilter
      } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate are required',
          traceId
        });
        return;
      }

      // Build dimensions object
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: new Date(startDate as string),
          end: new Date(endDate as string),
          granularity: granularity as 'hour' | 'day' | 'week' | 'month'
        },
        filters: {}
      };

      // Add filters if provided
      if (level) dimensions.filters!.level = Array.isArray(level) ? level as string[] : [level as string];
      if (source) dimensions.filters!.source = Array.isArray(source) ? source as string[] : [source as string];
      if (component) dimensions.filters!.component = Array.isArray(component) ? component as string[] : [component as string];
      if (errorType) dimensions.filters!.errorType = Array.isArray(errorType) ? errorType as string[] : [errorType as string];
      if (userId) dimensions.filters!.userId = userId as string;
      if (traceIdFilter) dimensions.filters!.traceId = traceIdFilter as string;

      const aggregationResult = await errorAggregationService.aggregateErrors(dimensions);

      traceIdService.completeOperation(traceId, 'GET_ERROR_AGGREGATION', 'SUCCESS', {
        totalErrors: aggregationResult.totalErrors,
        timeRange: dimensions.timeRange
      });

      res.json({
        success: true,
        data: aggregationResult,
        traceId
      });
    } catch (error) {
      logger.error('Error getting error aggregation:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_ERROR_AGGREGATION', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get error aggregation',
        traceId
      });
    }
  }

  /**
   * Get error patterns
   */
  async getErrorPatterns(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_ERROR_PATTERNS', 'ERROR_ANALYTICS_CONTROLLER');

      const { startDate, endDate } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate are required',
          traceId
        });
        return;
      }

      const timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };

      const patterns = await errorAggregationService.detectErrorPatterns(timeRange);

      traceIdService.completeOperation(traceId, 'GET_ERROR_PATTERNS', 'SUCCESS', {
        patternsFound: patterns.length,
        timeRange
      });

      res.json({
        success: true,
        data: patterns,
        traceId
      });
    } catch (error) {
      logger.error('Error getting error patterns:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_ERROR_PATTERNS', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get error patterns',
        traceId
      });
    }
  }

  /**
   * Get error impact analysis
   */
  async getErrorImpactAnalysis(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_ERROR_IMPACT_ANALYSIS', 'ERROR_ANALYTICS_CONTROLLER');

      const { startDate, endDate } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate are required',
          traceId
        });
        return;
      }

      const timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };

      const impactAnalysis = await errorAggregationService.analyzeErrorImpact(timeRange);

      traceIdService.completeOperation(traceId, 'GET_ERROR_IMPACT_ANALYSIS', 'SUCCESS', {
        systemHealthScore: impactAnalysis.systemHealthScore,
        timeRange
      });

      res.json({
        success: true,
        data: impactAnalysis,
        traceId
      });
    } catch (error) {
      logger.error('Error getting error impact analysis:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_ERROR_IMPACT_ANALYSIS', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get error impact analysis',
        traceId
      });
    }
  }

  /**
   * Get error analytics dashboard data
   */
  async getDashboardData(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_DASHBOARD_DATA', 'ERROR_ANALYTICS_CONTROLLER');

      const {
        startDate,
        endDate,
        granularity = 'day'
      } = req.query;

      // Default to last 7 days if no dates provided
      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);

      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start,
          end,
          granularity: granularity as 'hour' | 'day' | 'week' | 'month'
        }
      };

      // Get all data in parallel
      const [aggregation, patterns, impact] = await Promise.all([
        errorAggregationService.aggregateErrors(dimensions),
        errorAggregationService.detectErrorPatterns({ start, end }),
        errorAggregationService.analyzeErrorImpact({ start, end })
      ]);

      const dashboardData = {
        summary: {
          totalErrors: aggregation.totalErrors,
          systemHealthScore: impact.systemHealthScore,
          criticalErrors: impact.criticalErrorsCount,
          affectedUsers: impact.userExperienceImpact.affectedUsers
        },
        aggregation,
        patterns: patterns.slice(0, 10), // Top 10 patterns
        impact,
        timeRange: { start, end }
      };

      traceIdService.completeOperation(traceId, 'GET_DASHBOARD_DATA', 'SUCCESS', {
        totalErrors: aggregation.totalErrors,
        patternsFound: patterns.length
      });

      res.json({
        success: true,
        data: dashboardData,
        traceId
      });
    } catch (error) {
      logger.error('Error getting dashboard data:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_DASHBOARD_DATA', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard data',
        traceId
      });
    }
  }

  /**
   * Export error data in specified format
   */
  async exportErrorData(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'EXPORT_ERROR_DATA', 'ERROR_ANALYTICS_CONTROLLER');

      const {
        format = 'json',
        startDate,
        endDate,
        level,
        source,
        component,
        errorType,
        userId,
        traceIdFilter,
        includeTraceLifecycle = 'false',
        includeAnalytics = 'false',
        maxRecords = '10000'
      } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate are required',
          traceId
        });
        return;
      }

      // Validate format
      if (!['json', 'csv', 'structured-logs'].includes(format as string)) {
        res.status(400).json({
          success: false,
          message: 'Invalid format. Supported formats: json, csv, structured-logs',
          traceId
        });
        return;
      }

      const options: ErrorExportOptions = {
        format: format as 'json' | 'csv' | 'structured-logs',
        timeRange: {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        },
        includeTraceLifecycle: includeTraceLifecycle === 'true',
        includeAnalytics: includeAnalytics === 'true',
        maxRecords: parseInt(maxRecords as string)
      };

      // Add filters if provided
      if (level || source || component || errorType || userId || traceIdFilter) {
        options.filters = {};
        if (level) options.filters.level = Array.isArray(level) ? level as string[] : [level as string];
        if (source) options.filters.source = Array.isArray(source) ? source as string[] : [source as string];
        if (component) options.filters.component = Array.isArray(component) ? component as string[] : [component as string];
        if (errorType) options.filters.errorType = Array.isArray(errorType) ? errorType as string[] : [errorType as string];
        if (userId) options.filters.userId = userId as string;
        if (traceIdFilter) options.filters.traceId = traceIdFilter as string;
      }

      const exportResult = await errorReportingService.exportErrorData(options);

      traceIdService.completeOperation(traceId, 'EXPORT_ERROR_DATA', 'SUCCESS', {
        format,
        recordCount: exportResult.recordCount,
        fileSize: exportResult.fileSize
      });

      // Set appropriate headers for file download
      const filename = path.basename(exportResult.filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', this.getContentType(format as string));

      // Send file
      res.sendFile(exportResult.filePath);
    } catch (error) {
      logger.error('Error exporting error data:', error, { traceId });
      traceIdService.completeOperation(traceId, 'EXPORT_ERROR_DATA', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to export error data',
        traceId
      });
    }
  }

  /**
   * Generate comprehensive error report
   */
  async generateErrorReport(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GENERATE_ERROR_REPORT', 'ERROR_ANALYTICS_CONTROLLER');

      const {
        startDate,
        endDate,
        format = 'json',
        save = 'false'
      } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate are required',
          traceId
        });
        return;
      }

      const timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };

      const report = await errorReportingService.generateErrorReport(timeRange);

      // Save report if requested
      let filePath: string | null = null;
      if (save === 'true') {
        filePath = await errorReportingService.saveErrorReport(
          report, 
          format as 'json' | 'html' | 'markdown'
        );
      }

      traceIdService.completeOperation(traceId, 'GENERATE_ERROR_REPORT', 'SUCCESS', {
        reportId: report.id,
        totalErrors: report.summary.totalErrors,
        patternsFound: report.patterns.length,
        saved: save === 'true'
      });

      res.json({
        success: true,
        data: {
          report,
          filePath
        },
        traceId
      });
    } catch (error) {
      logger.error('Error generating error report:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GENERATE_ERROR_REPORT', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to generate error report',
        traceId
      });
    }
  }

  /**
   * Generate development task summary
   */
  async generateDevelopmentTaskSummary(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GENERATE_DEV_TASK_SUMMARY', 'ERROR_ANALYTICS_CONTROLLER');

      const { startDate, endDate } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          message: 'startDate and endDate are required',
          traceId
        });
        return;
      }

      const timeRange = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };

      const taskSummary = await errorReportingService.generateDevelopmentTaskSummary(timeRange);

      traceIdService.completeOperation(traceId, 'GENERATE_DEV_TASK_SUMMARY', 'SUCCESS', {
        tasksGenerated: taskSummary.tasks.length
      });

      res.json({
        success: true,
        data: taskSummary,
        traceId
      });
    } catch (error) {
      logger.error('Error generating development task summary:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GENERATE_DEV_TASK_SUMMARY', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to generate development task summary',
        traceId
      });
    }
  }

  // Helper method
  private getContentType(format: string): string {
    switch (format) {
      case 'json': return 'application/json';
      case 'csv': return 'text/csv';
      case 'structured-logs': return 'text/plain';
      case 'html': return 'text/html';
      case 'markdown': return 'text/markdown';
      default: return 'application/octet-stream';
    }
  }
}

export const errorAnalyticsController = new ErrorAnalyticsController();