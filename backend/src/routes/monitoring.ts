/**
 * Monitoring Routes
 * Routes for production monitoring and health checks
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  healthCheck,
  getDetailedHealth,
  getDashboard,
  getSLAMetrics,
  getSystemMetrics,
  getErrorSummary,
  resolveAlert,
  getPerformanceMetrics,
  createAlertRule
} from '../controllers/monitoringController';

const router = Router();

// Public health check endpoint (for load balancers)
router.get('/health', healthCheck);

// Protected monitoring endpoints
router.get('/health/detailed', authenticateToken, getDetailedHealth);
router.get('/dashboard', authenticateToken, getDashboard);
router.get('/sla', authenticateToken, getSLAMetrics);
router.get('/metrics', authenticateToken, getSystemMetrics);
router.get('/errors', authenticateToken, getErrorSummary);
router.get('/performance', authenticateToken, getPerformanceMetrics);

// Alert management
router.post('/alerts/:alertId/resolve', authenticateToken, resolveAlert);
router.post('/alerts/rules', authenticateToken, createAlertRule);

export default router;