/**
 * Startup Controller
 * Handles admin API endpoints for startup management
 */

import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { startupStatusService } from '../services/startupStatusService';
import { upstoxDataProcessor } from '../services/upstoxDataProcessor';
import { startupSymbolInitializationService } from '../services/startupStatusService';
import { startupMonitoringService } from '../services/startupMonitoringService';

/**
 * Get current startup status
 */
export async function getStartupStatus(req: Request, res: Response): Promise<void> {
  try {
    const status = startupStatusService.getStatus();
    const metrics = startupStatusService.getStartupMetrics();
    
    logger.info('Startup status requested', {
      component: 'STARTUP_CONTROLLER',
      operation: 'GET_STATUS',
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      data: {
        status,
        metrics,
        symbolInitialization: startupSymbolInitializationService.getInitializationStats()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Failed to get startup status', {
      component: 'STARTUP_CONTROLLER',
      operation: 'GET_STATUS_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to get startup status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get detailed symbol initialization status
 */
export async function getSymbolInitStatus(req: Request, res: Response): Promise<void> {
  try {
    const status = startupSymbolInitializationService.getStatus();
    const stats = startupSymbolInitializationService.getInitializationStats();
    
    logger.info('Symbol initialization status requested', {
      component: 'STARTUP_CONTROLLER',
      operation: 'GET_SYMBOL_INIT_STATUS',
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      data: {
        status,
        stats,
        isInProgress: startupSymbolInitializationService.isInProgress(),
        isDataReady: await startupSymbolInitializationService.isSymbolDataReady()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Failed to get symbol initialization status', {
      component: 'STARTUP_CONTROLLER',
      operation: 'GET_SYMBOL_INIT_STATUS_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to get symbol initialization status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Force restart symbol initialization
 */
export async function forceRestartSymbolInit(req: Request, res: Response): Promise<void> {
  try {
    logger.info('Force restart symbol initialization requested', {
      component: 'STARTUP_CONTROLLER',
      operation: 'FORCE_RESTART',
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Check if already in progress
    if (startupSymbolInitializationService.isInProgress()) {
      res.status(409).json({
        success: false,
        error: 'INITIALIZATION_IN_PROGRESS',
        message: 'Symbol initialization is already in progress. Please wait for it to complete.',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Start the initialization process in background
    startupSymbolInitializationService.forceRestart()
      .then(() => {
        logger.info('Force restart symbol initialization completed', {
          component: 'STARTUP_CONTROLLER',
          operation: 'FORCE_RESTART_SUCCESS'
        });
        startupStatusService.markSymbolInitCompleted();
      })
      .catch((error: any) => {
        logger.error('Force restart symbol initialization failed', {
          component: 'STARTUP_CONTROLLER',
          operation: 'FORCE_RESTART_ERROR'
        }, error);
        startupStatusService.markStartupFailed(error.message);
      });

    // Mark as started
    startupStatusService.markSymbolInitStarted();

    res.status(202).json({
      success: true,
      message: 'Symbol initialization restart initiated. Check status for progress.',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Failed to force restart symbol initialization', {
      component: 'STARTUP_CONTROLLER',
      operation: 'FORCE_RESTART_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to restart symbol initialization',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get startup metrics for monitoring
 */
export async function getStartupMetrics(req: Request, res: Response): Promise<void> {
  try {
    const metrics = startupStatusService.getStartupMetrics();
    const symbolStats = startupSymbolInitializationService.getInitializationStats();
    
    logger.info('Startup metrics requested', {
      component: 'STARTUP_CONTROLLER',
      operation: 'GET_METRICS',
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      data: {
        startup: metrics,
        symbolInitialization: symbolStats,
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version,
          platform: process.platform
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Failed to get startup metrics', {
      component: 'STARTUP_CONTROLLER',
      operation: 'GET_METRICS_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to get startup metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Check if system is ready for trading
 */
export async function checkSystemReadiness(req: Request, res: Response): Promise<void> {
  try {
    const isServerReady = startupStatusService.isServerReady();
    const isSymbolDataReady = startupStatusService.isSymbolDataReady();
    const isFullyReady = startupStatusService.isFullyReady();
    const status = startupStatusService.getStatus();
    
    logger.info('System readiness check requested', {
      component: 'STARTUP_CONTROLLER',
      operation: 'CHECK_READINESS',
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      data: {
        ready: isFullyReady,
        serverReady: isServerReady,
        symbolDataReady: isSymbolDataReady,
        phase: status.startupPhase,
        readinessChecks: {
          server: { ready: isServerReady, message: isServerReady ? 'Server is ready' : 'Server is starting' },
          symbolData: { ready: isSymbolDataReady, message: isSymbolDataReady ? 'Symbol data is ready' : 'Symbol data is initializing' },
          overall: { ready: isFullyReady, message: isFullyReady ? 'System is fully ready' : 'System is still initializing' }
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Failed to check system readiness', {
      component: 'STARTUP_CONTROLLER',
      operation: 'CHECK_READINESS_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to check system readiness',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Get startup monitoring metrics
 */
export async function getStartupMonitoringMetrics(req: Request, res: Response): Promise<void> {
  try {
    const metrics = startupMonitoringService.getMetrics();
    const alerts = startupMonitoringService.getAlerts();
    const monitoringStatus = startupMonitoringService.getMonitoringStatus();
    
    logger.info('Startup monitoring metrics requested', {
      component: 'STARTUP_CONTROLLER',
      operation: 'GET_MONITORING_METRICS',
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      data: {
        metrics,
        alerts,
        monitoringStatus,
        alertsSummary: {
          total: alerts.length,
          critical: alerts.filter(a => a.severity === 'CRITICAL').length,
          high: alerts.filter(a => a.severity === 'HIGH').length,
          medium: alerts.filter(a => a.severity === 'MEDIUM').length,
          low: alerts.filter(a => a.severity === 'LOW').length
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Failed to get startup monitoring metrics', {
      component: 'STARTUP_CONTROLLER',
      operation: 'GET_MONITORING_METRICS_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to get startup monitoring metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Generate startup report
 */
export async function generateStartupReport(req: Request, res: Response): Promise<void> {
  try {
    const report = startupMonitoringService.generateStartupReport();
    
    logger.info('Startup report generated', {
      component: 'STARTUP_CONTROLLER',
      operation: 'GENERATE_REPORT',
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Failed to generate startup report', {
      component: 'STARTUP_CONTROLLER',
      operation: 'GENERATE_REPORT_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to generate startup report',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Clear startup alerts
 */
export async function clearStartupAlerts(req: Request, res: Response): Promise<void> {
  try {
    startupMonitoringService.clearAlerts();
    
    logger.info('Startup alerts cleared', {
      component: 'STARTUP_CONTROLLER',
      operation: 'CLEAR_ALERTS',
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(200).json({
      success: true,
      message: 'Startup alerts cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Failed to clear startup alerts', {
      component: 'STARTUP_CONTROLLER',
      operation: 'CLEAR_ALERTS_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to clear startup alerts',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}