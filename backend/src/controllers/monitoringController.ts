/**
 * Monitoring Controller
 * Provides endpoints for production monitoring and health checks
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { productionMonitoringService } from '../services/productionMonitoringService';
import { logger } from '../utils/logger';

/**
 * Health check endpoint - public endpoint for load balancers
 */
export const healthCheck = async (req: Request, res: Response): Promise<void> => {
  try {
    const healthStatus = productionMonitoringService.getHealthStatus();
    
    // Return appropriate HTTP status based on health
    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      summary: healthStatus.summary,
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error: any) {
    logger.error('Health check failed', {
      component: 'MONITORING',
      operation: 'HEALTH_CHECK'
    }, error);

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
};

/**
 * Detailed health status - requires authentication
 */
export const getDetailedHealth = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const healthStatus = productionMonitoringService.getHealthStatus();
    
    res.status(200).json({
      success: true,
      data: healthStatus
    });
  } catch (error: any) {
    logger.error('Failed to get detailed health status', {
      component: 'MONITORING',
      operation: 'DETAILED_HEALTH'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to get health status',
      error: error.message
    });
  }
};

/**
 * Get monitoring dashboard data
 */
export const getDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dashboardData = productionMonitoringService.getDashboardData();
    
    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error: any) {
    logger.error('Failed to get dashboard data', {
      component: 'MONITORING',
      operation: 'DASHBOARD'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data',
      error: error.message
    });
  }
};

/**
 * Get SLA metrics
 */
export const getSLAMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 3600000; // Default 1 hour
    const slaMetrics = productionMonitoringService.getSLAMetrics(timeWindow);
    
    res.status(200).json({
      success: true,
      data: {
        ...slaMetrics,
        timeWindow,
        timeWindowHours: timeWindow / 3600000
      }
    });
  } catch (error: any) {
    logger.error('Failed to get SLA metrics', {
      component: 'MONITORING',
      operation: 'SLA_METRICS'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to get SLA metrics',
      error: error.message
    });
  }
};

/**
 * Get system metrics
 */
export const getSystemMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const dashboardData = productionMonitoringService.getDashboardData();
    
    res.status(200).json({
      success: true,
      data: {
        current: dashboardData.systemHealth.metrics,
        history: dashboardData.recentMetrics.slice(-limit),
        uptime: dashboardData.uptime
      }
    });
  } catch (error: any) {
    logger.error('Failed to get system metrics', {
      component: 'MONITORING',
      operation: 'SYSTEM_METRICS'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to get system metrics',
      error: error.message
    });
  }
};

/**
 * Get error summary
 */
export const getErrorSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const dashboardData = productionMonitoringService.getDashboardData();
    
    res.status(200).json({
      success: true,
      data: {
        errors: dashboardData.errorSummary,
        activeAlerts: dashboardData.systemHealth.activeAlerts
      }
    });
  } catch (error: any) {
    logger.error('Failed to get error summary', {
      component: 'MONITORING',
      operation: 'ERROR_SUMMARY'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to get error summary',
      error: error.message
    });
  }
};

/**
 * Resolve an alert
 */
export const resolveAlert = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { alertId } = req.params;
    
    if (!alertId) {
      res.status(400).json({
        success: false,
        message: 'Alert ID is required'
      });
      return;
    }

    const resolved = productionMonitoringService.resolveAlert(alertId);
    
    if (resolved) {
      logger.info('Alert resolved', {
        component: 'MONITORING',
        operation: 'RESOLVE_ALERT',
        alertId,
        userId: req.user?.id
      });

      res.status(200).json({
        success: true,
        message: 'Alert resolved successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Alert not found or already resolved'
      });
    }
  } catch (error: any) {
    logger.error('Failed to resolve alert', {
      component: 'MONITORING',
      operation: 'RESOLVE_ALERT'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to resolve alert',
      error: error.message
    });
  }
};

/**
 * Get performance metrics for a specific operation
 */
export const getPerformanceMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { operation } = req.query;
    const limit = parseInt(req.query.limit as string) || 100;
    
    // This would need to be implemented in the monitoring service
    // For now, return a placeholder response
    res.status(200).json({
      success: true,
      data: {
        operation: operation || 'all',
        metrics: [],
        summary: {
          totalRequests: 0,
          successRate: 100,
          averageResponseTime: 0,
          errorRate: 0
        }
      }
    });
  } catch (error: any) {
    logger.error('Failed to get performance metrics', {
      component: 'MONITORING',
      operation: 'PERFORMANCE_METRICS'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to get performance metrics',
      error: error.message
    });
  }
};

/**
 * Create custom alert rule
 */
export const createAlertRule = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, condition, severity, cooldown, enabled } = req.body;
    
    if (!name || !condition || !severity) {
      res.status(400).json({
        success: false,
        message: 'Name, condition, and severity are required'
      });
      return;
    }

    // For security, we'll only allow predefined condition types
    // In a real implementation, you'd want to validate the condition more thoroughly
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      res.status(400).json({
        success: false,
        message: 'Invalid severity level'
      });
      return;
    }

    // This is a simplified implementation - in production you'd want more validation
    res.status(501).json({
      success: false,
      message: 'Custom alert rules not yet implemented'
    });
  } catch (error: any) {
    logger.error('Failed to create alert rule', {
      component: 'MONITORING',
      operation: 'CREATE_ALERT_RULE'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to create alert rule',
      error: error.message
    });
  }
};