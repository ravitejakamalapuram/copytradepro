/**
 * Symbol Health Routes
 * Routes for monitoring symbol system health and performance
 */

import { Router } from 'express';
import {
  getSystemHealth,
  getMonitoringDashboard,
  getPerformanceMetrics,
  getActiveAlerts,
  resolveAlert,
  getCacheStats,
  clearCache,
  testAlert
} from '../controllers/symbolHealthController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route GET /api/symbol-health/status
 * @desc Get overall system health status
 * @access Private
 */
router.get('/status', getSystemHealth);

/**
 * @route GET /api/symbol-health/dashboard
 * @desc Get detailed monitoring dashboard data
 * @query timeWindow - Time window in milliseconds (default: 3600000 = 1 hour)
 * @access Private
 */
router.get('/dashboard', getMonitoringDashboard);

/**
 * @route GET /api/symbol-health/metrics
 * @desc Get performance metrics
 * @query timeWindow - Time window in milliseconds (default: 3600000 = 1 hour)
 * @query type - Metric type: 'all', 'search', 'update', 'cache' (default: 'all')
 * @access Private
 */
router.get('/metrics', getPerformanceMetrics);

/**
 * @route GET /api/symbol-health/alerts
 * @desc Get active alerts
 * @query severity - Filter by severity: 'low', 'medium', 'high', 'critical'
 * @query type - Filter by type: 'update_failure', 'data_quality', 'performance_degradation', 'cache_failure', 'database_error'
 * @query limit - Maximum number of alerts to return (default: 50)
 * @access Private
 */
router.get('/alerts', getActiveAlerts);

/**
 * @route POST /api/symbol-health/alerts/:alertId/resolve
 * @desc Resolve an alert
 * @body reason - Optional reason for resolution
 * @access Private
 */
router.post('/alerts/:alertId/resolve', resolveAlert);

/**
 * @route GET /api/symbol-health/cache
 * @desc Get cache statistics
 * @query detailed - Include detailed cache information (default: false)
 * @access Private
 */
router.get('/cache', getCacheStats);

/**
 * @route POST /api/symbol-health/cache/clear
 * @desc Clear cache (admin operation)
 * @body type - Cache type to clear: 'all', 'symbols', 'search'
 * @access Private
 */
router.post('/cache/clear', clearCache);

/**
 * @route POST /api/symbol-health/test-alert
 * @desc Send a test alert
 * @body severity - Alert severity: 'low', 'medium', 'high', 'critical' (default: 'medium')
 * @body type - Alert type (default: 'data_quality')
 * @body message - Custom alert message
 * @access Private
 */
router.post('/test-alert', testAlert);

export default router;