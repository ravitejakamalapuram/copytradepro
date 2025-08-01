/**
 * Startup Routes
 * Admin API endpoints for startup management
 */

import express from 'express';
import {
  getStartupStatus,
  getSymbolInitStatus,
  forceRestartSymbolInit,
  getStartupMetrics,
  checkSystemReadiness,
  getStartupMonitoringMetrics,
  generateStartupReport,
  clearStartupAlerts
} from '../controllers/startupController';

const router = express.Router();

/**
 * @route GET /api/startup/status
 * @desc Get current startup status
 * @access Admin
 */
router.get('/status', getStartupStatus);

/**
 * @route GET /api/startup/symbol-init-status
 * @desc Get detailed symbol initialization status
 * @access Admin
 */
router.get('/symbol-init-status', getSymbolInitStatus);

/**
 * @route POST /api/startup/force-restart-symbol-init
 * @desc Force restart symbol initialization
 * @access Admin
 */
router.post('/force-restart-symbol-init', forceRestartSymbolInit);

/**
 * @route GET /api/startup/metrics
 * @desc Get startup metrics for monitoring
 * @access Admin
 */
router.get('/metrics', getStartupMetrics);

/**
 * @route GET /api/startup/readiness
 * @desc Check if system is ready for trading
 * @access Public
 */
router.get('/readiness', checkSystemReadiness);

/**
 * @route GET /api/startup/monitoring-metrics
 * @desc Get startup monitoring metrics and alerts
 * @access Admin
 */
router.get('/monitoring-metrics', getStartupMonitoringMetrics);

/**
 * @route GET /api/startup/report
 * @desc Generate comprehensive startup report
 * @access Admin
 */
router.get('/report', generateStartupReport);

/**
 * @route POST /api/startup/clear-alerts
 * @desc Clear startup alerts
 * @access Admin
 */
router.post('/clear-alerts', clearStartupAlerts);

export default router;