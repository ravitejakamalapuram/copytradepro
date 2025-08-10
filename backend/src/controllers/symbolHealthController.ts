/**
 * Symbol Health Controller
 * Provides endpoints for monitoring symbol system health and performance
 */

import { Request, Response } from 'express';
import { symbolMonitoringService } from '../services/symbolMonitoringService';
import { symbolAlertingService } from '../services/symbolAlertingService';
import { symbolCacheService } from '../services/symbolCacheService';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { productionMonitoringService } from '../services/productionMonitoringService';
import { logger } from '../utils/logger';

/**
 * Get overall system health status
 */
export const getSystemHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const startTime = Date.now();

    // Get health status from various services
    const [
      symbolHealth,
      productionHealth,
      cacheStats,
      performanceStats,
      notificationStats
    ] = await Promise.all([
      Promise.resolve(symbolMonitoringService.getDashboardData()),
      Promise.resolve(productionMonitoringService.getHealthStatus()),
      Promise.resolve(symbolCacheService.getStats()),
      Promise.resolve(symbolMonitoringService.getPerformanceStats()),
      Promise.resolve(symbolAlertingService.getNotificationStats())
    ]);

    // Determine overall health status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const issues: string[] = [];

    if (symbolHealth.healthStatus.status === 'unhealthy' || productionHealth.status === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (symbolHealth.healthStatus.status === 'degraded' || productionHealth.status === 'degraded') {
      overallStatus = 'degraded';
    }

    issues.push(...symbolHealth.healthStatus.issues);
    if (productionHealth.status !== 'healthy') {
      issues.push(productionHealth.summary);
    }

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      summary: overallStatus === 'healthy' 
        ? 'All systems operational' 
        : `${issues.length} issue(s) detected`,
      issues: issues.slice(0, 5), // Limit to top 5 issues
      components: {
        symbolSystem: {
          status: symbolHealth.healthStatus.status,
          summary: symbolHealth.healthStatus.summary,
          metrics: {
            totalSymbols: symbolHealth.summary.totalSymbols,
            activeSymbols: symbolHealth.summary.activeSymbols,
            avgSearchTime: symbolHealth.summary.avgSearchTime,
            avgCacheHitRate: symbolHealth.summary.avgCacheHitRate,
            avgUpdateErrorRate: symbolHealth.summary.avgUpdateErrorRate
          }
        },
        production: {
          status: productionHealth.status,
          summary: productionHealth.summary,
          metrics: productionHealth.metrics ? {
            memoryUsage: `${productionHealth.metrics.memory.percentage.toFixed(1)}%`,
            errorRate: `${productionHealth.metrics.errorRate.toFixed(2)}%`,
            avgResponseTime: `${productionHealth.metrics.responseTime.average.toFixed(0)}ms`,
            uptime: `${Math.floor(productionHealth.metrics.uptime / 3600)}h ${Math.floor((productionHealth.metrics.uptime % 3600) / 60)}m`
          } : null
        },
        cache: {
          status: cacheStats.hitRate > 80 ? 'healthy' : cacheStats.hitRate > 60 ? 'degraded' : 'unhealthy',
          hitRate: `${cacheStats.hitRate.toFixed(2)}%`,
          totalKeys: cacheStats.memoryUsage.symbolCache.size + cacheStats.memoryUsage.searchCache.size,
          memoryUsage: `${(cacheStats.memoryUsage.symbolCache.utilization + cacheStats.memoryUsage.searchCache.utilization).toFixed(2)}MB`
        },
        database: {
          status: symbolDatabaseService.isReady() ? 'healthy' : 'unhealthy',
          connected: symbolDatabaseService.isReady()
        },
        alerting: {
          status: notificationStats.successRate > 95 ? 'healthy' : 'degraded',
          successRate: `${notificationStats.successRate.toFixed(2)}%`,
          totalSent: notificationStats.totalSent,
          totalFailed: notificationStats.totalFailed
        }
      },
      performance: {
        search: performanceStats.searchPerformance,
        updates: performanceStats.updatePerformance,
        cache: performanceStats.cachePerformance
      },
      responseTime: Date.now() - startTime
    };

    // Record this health check
    symbolMonitoringService.recordSearchMetrics({
      operation: 'getById',
      query: 'health_check',
      resultCount: 1,
      duration: Date.now() - startTime,
      cacheHit: false,
      success: true
    });

    res.json(response);

    logger.info('System health check completed', {
      component: 'SYMBOL_HEALTH',
      operation: 'HEALTH_CHECK'
    }, {
      overallStatus,
      issuesCount: issues.length,
      responseTime: Date.now() - startTime
    });

  } catch (error) {
    logger.error('Failed to get system health', {
      component: 'SYMBOL_HEALTH',
      operation: 'HEALTH_CHECK_ERROR'
    }, error);

    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      summary: 'Health check failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get detailed monitoring dashboard data
 */
export const getMonitoringDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 3600000; // Default 1 hour

    const [
      dashboardData,
      performanceStats,
      productionDashboard,
      notificationStats,
      alertRules,
      channels
    ] = await Promise.all([
      Promise.resolve(symbolMonitoringService.getDashboardData()),
      Promise.resolve(symbolMonitoringService.getPerformanceStats(timeWindow)),
      Promise.resolve(productionMonitoringService.getDashboardData()),
      Promise.resolve(symbolAlertingService.getNotificationStats(timeWindow)),
      Promise.resolve(symbolAlertingService.getAlertRules()),
      Promise.resolve(symbolAlertingService.getChannels())
    ]);

    const response = {
      timestamp: new Date().toISOString(),
      timeWindow,
      overview: {
        systemHealth: dashboardData.healthStatus,
        totalSymbols: dashboardData.summary.totalSymbols,
        activeSymbols: dashboardData.summary.activeSymbols,
        activeAlerts: dashboardData.activeAlerts.length,
        avgSearchTime: dashboardData.summary.avgSearchTime,
        avgCacheHitRate: dashboardData.summary.avgCacheHitRate,
        avgUpdateErrorRate: dashboardData.summary.avgUpdateErrorRate
      },
      metrics: {
        symbol: {
          recent: dashboardData.recentMetrics,
          performance: performanceStats
        },
        production: {
          systemHealth: productionDashboard.systemHealth,
          recentMetrics: productionDashboard.recentMetrics,
          errorSummary: productionDashboard.errorSummary,
          uptime: productionDashboard.uptime
        }
      },
      alerts: {
        active: dashboardData.activeAlerts,
        rules: alertRules.filter(rule => rule.enabled),
        notifications: notificationStats
      },
      alerting: {
        channels: channels.filter(channel => channel.enabled),
        stats: notificationStats
      }
    };

    res.json(response);

    logger.debug('Monitoring dashboard data retrieved', {
      component: 'SYMBOL_HEALTH',
      operation: 'DASHBOARD'
    }, {
      timeWindow,
      activeAlerts: dashboardData.activeAlerts.length,
      totalSymbols: dashboardData.summary.totalSymbols
    });

  } catch (error) {
    logger.error('Failed to get monitoring dashboard', {
      component: 'SYMBOL_HEALTH',
      operation: 'DASHBOARD_ERROR'
    }, error);

    res.status(500).json({
      error: 'Failed to retrieve monitoring dashboard',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get performance metrics
 */
export const getPerformanceMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 3600000; // Default 1 hour
    const metricType = req.query.type as string;

    const performanceStats = symbolMonitoringService.getPerformanceStats(timeWindow);
    const productionSLA = productionMonitoringService.getSLAMetrics(timeWindow);

    let response: any = {
      timestamp: new Date().toISOString(),
      timeWindow,
      sla: productionSLA
    };

    if (!metricType || metricType === 'all') {
      response.metrics = performanceStats;
    } else if (metricType === 'search') {
      response.metrics = { search: performanceStats.searchPerformance };
    } else if (metricType === 'update') {
      response.metrics = { update: performanceStats.updatePerformance };
    } else if (metricType === 'cache') {
      response.metrics = { cache: performanceStats.cachePerformance };
    } else {
      res.status(400).json({
        error: 'Invalid metric type',
        validTypes: ['all', 'search', 'update', 'cache']
      });
      return;
    }

    res.json(response);

  } catch (error) {
    logger.error('Failed to get performance metrics', {
      component: 'SYMBOL_HEALTH',
      operation: 'PERFORMANCE_METRICS_ERROR'
    }, error);

    res.status(500).json({
      error: 'Failed to retrieve performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get active alerts
 */
export const getActiveAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const severity = req.query.severity as string;
    const type = req.query.type as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const dashboardData = symbolMonitoringService.getDashboardData();
    let alerts = dashboardData.activeAlerts;

    // Apply filters
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    if (type) {
      alerts = alerts.filter(alert => alert.type === type);
    }

    // Apply limit
    alerts = alerts.slice(0, limit);

    const response = {
      timestamp: new Date().toISOString(),
      total: alerts.length,
      alerts: alerts.map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        details: alert.details,
        age: Date.now() - alert.timestamp.getTime()
      }))
    };

    res.json(response);

  } catch (error) {
    logger.error('Failed to get active alerts', {
      component: 'SYMBOL_HEALTH',
      operation: 'ACTIVE_ALERTS_ERROR'
    }, error);

    res.status(500).json({
      error: 'Failed to retrieve active alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Resolve an alert
 */
export const resolveAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { alertId } = req.params;
    const { reason } = req.body;

    if (!alertId) {
      res.status(400).json({
        error: 'Alert ID is required'
      });
      return;
    }

    const resolved = symbolMonitoringService.resolveAlert(alertId);

    if (resolved) {
      logger.info('Alert resolved manually', {
        component: 'SYMBOL_HEALTH',
        operation: 'RESOLVE_ALERT'
      }, {
        alertId,
        reason: reason || 'Manual resolution'
      });

      res.json({
        success: true,
        message: 'Alert resolved successfully',
        alertId,
        resolvedAt: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        error: 'Alert not found or already resolved',
        alertId
      });
    }

  } catch (error) {
    logger.error('Failed to resolve alert', {
      component: 'SYMBOL_HEALTH',
      operation: 'RESOLVE_ALERT_ERROR'
    }, error);

    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = symbolCacheService.getStats();
    const detailed = req.query.detailed === 'true';

    let response: any = {
      timestamp: new Date().toISOString(),
      summary: {
        hitRate: `${stats.hitRate.toFixed(2)}%`,
        missRate: `${(100 - stats.hitRate).toFixed(2)}%`,
        totalKeys: stats.memoryUsage.symbolCache.size + stats.memoryUsage.searchCache.size,
        memoryUsage: `${(stats.memoryUsage.symbolCache.utilization + stats.memoryUsage.searchCache.utilization).toFixed(2)}MB`,
        evictionCount: 0 // Not available in current cache stats
      }
    };

    if (detailed) {
      response.detailed = {
        symbolCache: {
          size: stats.memoryUsage.symbolCache.size,
          hitCount: stats.hits,
          missCount: stats.misses
        },
        searchCache: {
          size: stats.memoryUsage.searchCache.size,
          hitCount: Math.floor(stats.hits * 0.3), // Approximate
          missCount: Math.floor(stats.misses * 0.3) // Approximate
        },
        performance: {
          avgLookupTime: 0, // Not available in current cache stats
          maxMemoryUsage: stats.memoryUsage.symbolCache.capacity + stats.memoryUsage.searchCache.capacity,
          cacheEfficiency: stats.hitRate
        }
      };
    }

    res.json(response);

  } catch (error) {
    logger.error('Failed to get cache stats', {
      component: 'SYMBOL_HEALTH',
      operation: 'CACHE_STATS_ERROR'
    }, error);

    res.status(500).json({
      error: 'Failed to retrieve cache statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Clear cache (admin operation)
 */
export const clearCache = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type } = req.body; // 'all', 'symbols', 'search'

    let clearedCount = 0;
    let message = '';

    switch (type) {
      case 'all':
        symbolCacheService.invalidateAll();
        clearedCount = 1; // Indicate success
        message = 'All caches cleared';
        break;
      case 'symbols':
        // Clear symbol cache by invalidating all
        symbolCacheService.invalidateAll();
        clearedCount = 1; // Indicate success
        message = 'Symbol cache cleared';
        break;
      case 'search':
        symbolCacheService.clearSearchCache();
        clearedCount = 1; // Indicate success
        message = 'Search cache cleared';
        break;
      default:
        res.status(400).json({
          error: 'Invalid cache type',
          validTypes: ['all', 'symbols', 'search']
        });
        return;
    }

    logger.info('Cache cleared manually', {
      component: 'SYMBOL_HEALTH',
      operation: 'CLEAR_CACHE'
    }, {
      type,
      clearedCount
    });

    res.json({
      success: true,
      message,
      clearedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to clear cache', {
      component: 'SYMBOL_HEALTH',
      operation: 'CLEAR_CACHE_ERROR'
    }, error);

    res.status(500).json({
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Test alert system
 */
export const testAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const { severity = 'medium', type = 'data_quality', message } = req.body;

    // Create a test alert
    const testAlert = {
      id: `test_alert_${Date.now()}`,
      type: type as any,
      severity: severity as any,
      message: message || `Test alert - ${severity} severity`,
      timestamp: new Date(),
      details: {
        test: true,
        triggeredBy: 'manual_test',
        timestamp: new Date().toISOString()
      },
      resolved: false
    };

    // Send the test alert
    await symbolAlertingService.sendAlert(testAlert);

    logger.info('Test alert sent', {
      component: 'SYMBOL_HEALTH',
      operation: 'TEST_ALERT'
    }, {
      alertId: testAlert.id,
      severity,
      type
    });

    res.json({
      success: true,
      message: 'Test alert sent successfully',
      alert: testAlert
    });

  } catch (error) {
    logger.error('Failed to send test alert', {
      component: 'SYMBOL_HEALTH',
      operation: 'TEST_ALERT_ERROR'
    }, error);

    res.status(500).json({
      error: 'Failed to send test alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};