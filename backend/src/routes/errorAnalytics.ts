import { Router } from 'express';
import { errorAnalyticsController } from '../controllers/errorAnalyticsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route GET /api/error-analytics/aggregation
 * @desc Get aggregated error data with filtering and time range
 * @access Private (Admin)
 * @query {string} startDate - Start date (ISO string)
 * @query {string} endDate - End date (ISO string)
 * @query {string} [granularity=day] - Time granularity (hour|day|week|month)
 * @query {string|string[]} [level] - Error levels to filter by
 * @query {string|string[]} [source] - Error sources to filter by (UI|BE|DB|API)
 * @query {string|string[]} [component] - Components to filter by
 * @query {string|string[]} [errorType] - Error types to filter by
 * @query {string} [userId] - Filter by specific user ID
 * @query {string} [traceIdFilter] - Filter by specific trace ID
 */
router.get('/aggregation', errorAnalyticsController.getErrorAggregation.bind(errorAnalyticsController));

/**
 * @route GET /api/error-analytics/patterns
 * @desc Get detected error patterns and recurring issues
 * @access Private (Admin)
 * @query {string} startDate - Start date (ISO string)
 * @query {string} endDate - End date (ISO string)
 */
router.get('/patterns', errorAnalyticsController.getErrorPatterns.bind(errorAnalyticsController));

/**
 * @route GET /api/error-analytics/impact
 * @desc Get error impact analysis on system health and user experience
 * @access Private (Admin)
 * @query {string} startDate - Start date (ISO string)
 * @query {string} endDate - End date (ISO string)
 */
router.get('/impact', errorAnalyticsController.getErrorImpactAnalysis.bind(errorAnalyticsController));

/**
 * @route GET /api/error-analytics/dashboard
 * @desc Get comprehensive dashboard data including aggregation, patterns, and impact
 * @access Private (Admin)
 * @query {string} [startDate] - Start date (ISO string, defaults to 7 days ago)
 * @query {string} [endDate] - End date (ISO string, defaults to now)
 * @query {string} [granularity=day] - Time granularity (hour|day|week|month)
 */
router.get('/dashboard', errorAnalyticsController.getDashboardData.bind(errorAnalyticsController));

/**
 * @route GET /api/error-analytics/export
 * @desc Export error data in specified format (JSON, CSV, structured logs)
 * @access Private (Admin)
 * @query {string} startDate - Start date (ISO string)
 * @query {string} endDate - End date (ISO string)
 * @query {string} [format=json] - Export format (json|csv|structured-logs)
 * @query {string|string[]} [level] - Error levels to filter by
 * @query {string|string[]} [source] - Error sources to filter by
 * @query {string|string[]} [component] - Components to filter by
 * @query {string|string[]} [errorType] - Error types to filter by
 * @query {string} [userId] - Filter by specific user ID
 * @query {string} [traceIdFilter] - Filter by specific trace ID
 * @query {boolean} [includeTraceLifecycle=false] - Include trace lifecycle data
 * @query {boolean} [includeAnalytics=false] - Include analytics data
 * @query {number} [maxRecords=10000] - Maximum number of records to export
 */
router.get('/export', errorAnalyticsController.exportErrorData.bind(errorAnalyticsController));

/**
 * @route GET /api/error-analytics/report
 * @desc Generate comprehensive error report with patterns and recommendations
 * @access Private (Admin)
 * @query {string} startDate - Start date (ISO string)
 * @query {string} endDate - End date (ISO string)
 * @query {string} [format=json] - Report format (json|html|markdown)
 * @query {boolean} [save=false] - Save report to file
 */
router.get('/report', errorAnalyticsController.generateErrorReport.bind(errorAnalyticsController));

/**
 * @route GET /api/error-analytics/dev-tasks
 * @desc Generate development task summary for error resolution
 * @access Private (Admin)
 * @query {string} startDate - Start date (ISO string)
 * @query {string} endDate - End date (ISO string)
 */
router.get('/dev-tasks', errorAnalyticsController.generateDevelopmentTaskSummary.bind(errorAnalyticsController));

export default router;