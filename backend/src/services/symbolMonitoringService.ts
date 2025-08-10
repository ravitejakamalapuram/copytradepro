/**
 * Symbol Monitoring Service
 * Comprehensive monitoring for symbol management system operations
 */

import { EventEmitter } from 'events';
import { logger, LogContext } from '../utils/logger';
import { symbolCacheService } from './symbolCacheService';
import { symbolDatabaseService } from './symbolDatabaseService';
import { productionMonitoringService } from './productionMonitoringService';

export interface SymbolUpdateMetrics {
  timestamp: Date;
  source: string;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  duration: number;
  errorRate: number;
  newSymbols: number;
  updatedSymbols: number;
  validationErrors: number;
}

export interface SearchPerformanceMetrics {
  timestamp: Date;
  operation: 'search' | 'getById' | 'getByTradingSymbol' | 'getByUnderlying';
  query: string;
  resultCount: number;
  duration: number;
  cacheHit: boolean;
  success: boolean;
  errorMessage?: string;
}

export interface CacheMetrics {
  timestamp: Date;
  totalKeys: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  memoryUsage: number;
  symbolCacheSize: number;
  searchCacheSize: number;
}

export interface DatabasePerformanceMetrics {
  timestamp: Date;
  operation: string;
  collection: string;
  duration: number;
  queryType: 'find' | 'findOne' | 'countDocuments' | 'updateMany' | 'insertMany' | 'deleteMany' | 'aggregate';
  indexUsed: boolean;
  documentsExamined: number;
  documentsReturned: number;
  success: boolean;
  errorMessage?: string;
}

export interface DataQualityMetrics {
  timestamp: Date;
  totalSymbols: number;
  activeSymbols: number;
  inactiveSymbols: number;
  equityCount: number;
  optionCount: number;
  futureCount: number;
  validationErrors: number;
  duplicateSymbols: number;
  expiredSymbols: number;
  missingData: number;
}

export interface SymbolAlert {
  id: string;
  type: 'update_failure' | 'data_quality' | 'performance_degradation' | 'cache_failure' | 'database_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  details: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
}

export class SymbolMonitoringService extends EventEmitter {
  private updateMetrics: SymbolUpdateMetrics[] = [];
  private searchMetrics: SearchPerformanceMetrics[] = [];
  private cacheMetrics: CacheMetrics[] = [];
  private databaseMetrics: DatabasePerformanceMetrics[] = [];
  private dataQualityMetrics: DataQualityMetrics[] = [];
  private alerts: SymbolAlert[] = [];

  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly METRICS_COLLECTION_INTERVAL = 60000; // 1 minute
  private readonly DATA_QUALITY_CHECK_INTERVAL = 300000; // 5 minutes
  
  private metricsInterval: NodeJS.Timeout | null = null;
  private dataQualityInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private startupTime: Date = new Date();

  // Performance thresholds
  private readonly SEARCH_PERFORMANCE_THRESHOLD = 200; // ms
  private readonly UPDATE_ERROR_RATE_THRESHOLD = 5; // %
  private readonly CACHE_HIT_RATE_THRESHOLD = 80; // %
  private readonly DATABASE_PERFORMANCE_THRESHOLD = 500; // ms

  constructor() {
    super();
  }

  /**
   * Start monitoring service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Symbol monitoring service is already running');
      return;
    }

    logger.info('Starting symbol monitoring service', {
      component: 'SYMBOL_MONITORING',
      operation: 'START'
    });

    this.isRunning = true;

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectCacheMetrics();
    }, this.METRICS_COLLECTION_INTERVAL);

    // Start data quality checks
    this.dataQualityInterval = setInterval(() => {
      this.performDataQualityCheck();
    }, this.DATA_QUALITY_CHECK_INTERVAL);

    // Delay initial metrics collection to allow cache warming
    setTimeout(() => {
      this.collectCacheMetrics();
    }, 10000); // 10 second delay for cache warming
    
    this.performDataQualityCheck();

    logger.info('Symbol monitoring service started', {
      component: 'SYMBOL_MONITORING',
      operation: 'STARTED'
    });

    this.emit('monitoring:started');
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping symbol monitoring service', {
      component: 'SYMBOL_MONITORING',
      operation: 'STOP'
    });

    this.isRunning = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.dataQualityInterval) {
      clearInterval(this.dataQualityInterval);
      this.dataQualityInterval = null;
    }

    logger.info('Symbol monitoring service stopped', {
      component: 'SYMBOL_MONITORING',
      operation: 'STOPPED'
    });

    this.emit('monitoring:stopped');
  }

  /**
   * Record symbol update metrics
   */
  recordUpdateMetrics(metrics: Omit<SymbolUpdateMetrics, 'timestamp' | 'errorRate'>): void {
    const errorRate = metrics.totalProcessed > 0 
      ? (metrics.failureCount / metrics.totalProcessed) * 100 
      : 0;

    const updateMetric: SymbolUpdateMetrics = {
      ...metrics,
      timestamp: new Date(),
      errorRate
    };

    this.updateMetrics.push(updateMetric);
    this.trimMetricsArray(this.updateMetrics);

    // Check for alerts
    this.checkUpdateAlerts(updateMetric);

    // Record in production monitoring
    productionMonitoringService.recordPerformanceMetric(
      'symbol_update',
      metrics.duration,
      errorRate < this.UPDATE_ERROR_RATE_THRESHOLD,
      {
        component: 'SYMBOL_MONITORING',
        operation: 'UPDATE_METRICS'
      },
      errorRate >= this.UPDATE_ERROR_RATE_THRESHOLD ? `High error rate: ${errorRate.toFixed(2)}%` : undefined
    );

    logger.info('Symbol update metrics recorded', {
      component: 'SYMBOL_MONITORING',
      operation: 'UPDATE_METRICS'
    }, {
      source: metrics.source,
      totalProcessed: metrics.totalProcessed,
      successRate: `${(100 - errorRate).toFixed(2)}%`,
      duration: `${metrics.duration}ms`,
      newSymbols: metrics.newSymbols,
      updatedSymbols: metrics.updatedSymbols
    });

    this.emit('metrics:update', updateMetric);
  }

  /**
   * Record search performance metrics
   */
  recordSearchMetrics(metrics: Omit<SearchPerformanceMetrics, 'timestamp'>): void {
    const searchMetric: SearchPerformanceMetrics = {
      ...metrics,
      timestamp: new Date()
    };

    this.searchMetrics.push(searchMetric);
    this.trimMetricsArray(this.searchMetrics);

    // Check for performance alerts
    this.checkSearchPerformanceAlerts(searchMetric);

    // Record in production monitoring
    productionMonitoringService.recordPerformanceMetric(
      `symbol_${metrics.operation}`,
      metrics.duration,
      metrics.success,
      {
        component: 'SYMBOL_MONITORING',
        operation: 'SEARCH_METRICS'
      },
      metrics.errorMessage
    );

    // Log slow searches
    if (metrics.duration > this.SEARCH_PERFORMANCE_THRESHOLD) {
      logger.warn('Slow symbol search detected', {
        component: 'SYMBOL_MONITORING',
        operation: 'SLOW_SEARCH'
      }, {
        operation: metrics.operation,
        query: metrics.query,
        duration: `${metrics.duration}ms`,
        resultCount: metrics.resultCount,
        cacheHit: metrics.cacheHit
      });
    }

    this.emit('metrics:search', searchMetric);
  }

  /**
   * Record database performance metrics
   */
  recordDatabaseMetrics(metrics: Omit<DatabasePerformanceMetrics, 'timestamp'>): void {
    const dbMetric: DatabasePerformanceMetrics = {
      ...metrics,
      timestamp: new Date()
    };

    this.databaseMetrics.push(dbMetric);
    this.trimMetricsArray(this.databaseMetrics);

    // Check for database performance alerts
    this.checkDatabasePerformanceAlerts(dbMetric);

    // Record in production monitoring
    productionMonitoringService.recordPerformanceMetric(
      `db_${metrics.operation}`,
      metrics.duration,
      metrics.success,
      {
        component: 'SYMBOL_MONITORING',
        operation: 'DATABASE_METRICS'
      },
      metrics.errorMessage
    );

    this.emit('metrics:database', dbMetric);
  }

  /**
   * Collect cache metrics
   */
  private collectCacheMetrics(): void {
    try {
      const cacheStats = symbolCacheService.getStats();
      
      const cacheMetric: CacheMetrics = {
        timestamp: new Date(),
        totalKeys: cacheStats.memoryUsage.symbolCache.size + cacheStats.memoryUsage.searchCache.size,
        hitRate: cacheStats.hitRate,
        missRate: 100 - cacheStats.hitRate,
        evictionCount: 0, // Not available in current cache stats
        memoryUsage: cacheStats.memoryUsage.symbolCache.utilization + cacheStats.memoryUsage.searchCache.utilization,
        symbolCacheSize: cacheStats.memoryUsage.symbolCache.size,
        searchCacheSize: cacheStats.memoryUsage.searchCache.size
      };

      this.cacheMetrics.push(cacheMetric);
      this.trimMetricsArray(this.cacheMetrics);

      // Check for cache performance alerts
      this.checkCachePerformanceAlerts(cacheMetric);

      logger.debug('Cache metrics collected', {
        component: 'SYMBOL_MONITORING',
        operation: 'CACHE_METRICS'
      }, {
        hitRate: `${cacheMetric.hitRate.toFixed(2)}%`,
        totalKeys: cacheMetric.totalKeys,
        memoryUsage: `${(cacheMetric.memoryUsage / 1024 / 1024).toFixed(2)}MB`
      });

      this.emit('metrics:cache', cacheMetric);
    } catch (error) {
      logger.error('Failed to collect cache metrics', {
        component: 'SYMBOL_MONITORING',
        operation: 'CACHE_METRICS_ERROR'
      }, error);
    }
  }

  /**
   * Perform data quality check
   */
  private async performDataQualityCheck(): Promise<void> {
    try {
      if (!symbolDatabaseService.isReady()) {
        return;
      }

      const startTime = Date.now();

      // Get symbol counts by type
      const [totalSymbols, activeSymbols, equitySymbols, optionSymbols, futureSymbols] = await Promise.all([
        this.getSymbolCount({}),
        this.getSymbolCount({ isActive: true }),
        this.getSymbolCount({ instrumentType: 'EQUITY', isActive: true }),
        this.getSymbolCount({ instrumentType: 'OPTION', isActive: true }),
        this.getSymbolCount({ instrumentType: 'FUTURE', isActive: true })
      ]);

      // Check for expired symbols
      const expiredSymbols = await this.getExpiredSymbolsCount();

      // Check for validation errors (symbols with missing required data)
      const validationErrors = await this.getValidationErrorsCount();

      // Check for duplicate symbols
      const duplicateSymbols = await this.getDuplicateSymbolsCount();

      const dataQualityMetric: DataQualityMetrics = {
        timestamp: new Date(),
        totalSymbols,
        activeSymbols,
        inactiveSymbols: totalSymbols - activeSymbols,
        equityCount: equitySymbols,
        optionCount: optionSymbols,
        futureCount: futureSymbols,
        validationErrors,
        duplicateSymbols,
        expiredSymbols,
        missingData: validationErrors
      };

      this.dataQualityMetrics.push(dataQualityMetric);
      this.trimMetricsArray(this.dataQualityMetrics);

      // Check for data quality alerts
      this.checkDataQualityAlerts(dataQualityMetric);

      const duration = Date.now() - startTime;

      logger.info('Data quality check completed', {
        component: 'SYMBOL_MONITORING',
        operation: 'DATA_QUALITY_CHECK'
      }, {
        totalSymbols,
        activeSymbols,
        equityCount: equitySymbols,
        optionCount: optionSymbols,
        futureCount: futureSymbols,
        validationErrors,
        duplicateSymbols,
        expiredSymbols,
        duration: `${duration}ms`
      });

      this.emit('metrics:dataQuality', dataQualityMetric);
    } catch (error) {
      logger.error('Failed to perform data quality check', {
        component: 'SYMBOL_MONITORING',
        operation: 'DATA_QUALITY_CHECK_ERROR'
      }, error);
    }
  }

  /**
   * Get symbol count with filter
   */
  private async getSymbolCount(filter: Record<string, any>): Promise<number> {
    try {
      // This would need to be implemented in symbolDatabaseService
      // For now, return a placeholder
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get expired symbols count
   */
  private async getExpiredSymbolsCount(): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // This would need to be implemented in symbolDatabaseService
      // For now, return a placeholder
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get validation errors count
   */
  private async getValidationErrorsCount(): Promise<number> {
    try {
      // This would check for symbols with missing required fields
      // For now, return a placeholder
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get duplicate symbols count
   */
  private async getDuplicateSymbolsCount(): Promise<number> {
    try {
      // This would check for duplicate trading symbols
      // For now, return a placeholder
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Check for update-related alerts
   */
  private checkUpdateAlerts(metrics: SymbolUpdateMetrics): void {
    // High error rate alert
    if (metrics.errorRate > this.UPDATE_ERROR_RATE_THRESHOLD) {
      this.createAlert({
        type: 'update_failure',
        severity: metrics.errorRate > 20 ? 'critical' : 'high',
        message: `High symbol update error rate: ${metrics.errorRate.toFixed(2)}%`,
        details: {
          source: metrics.source,
          errorRate: metrics.errorRate,
          totalProcessed: metrics.totalProcessed,
          failureCount: metrics.failureCount
        }
      });
    }

    // No new symbols for extended period (potential data source issue)
    if (metrics.newSymbols === 0 && metrics.updatedSymbols === 0 && metrics.totalProcessed > 0) {
      const recentUpdates = this.updateMetrics
        .filter(m => m.source === metrics.source && Date.now() - m.timestamp.getTime() < 86400000) // Last 24 hours
        .filter(m => m.newSymbols > 0 || m.updatedSymbols > 0);

      if (recentUpdates.length === 0) {
        this.createAlert({
          type: 'data_quality',
          severity: 'medium',
          message: `No symbol updates from ${metrics.source} in the last 24 hours`,
          details: {
            source: metrics.source,
            lastUpdateWithChanges: recentUpdates[0]?.timestamp || 'Never'
          }
        });
      }
    }
  }

  /**
   * Check for search performance alerts
   */
  private checkSearchPerformanceAlerts(metrics: SearchPerformanceMetrics): void {
    if (metrics.duration > this.SEARCH_PERFORMANCE_THRESHOLD * 2) {
      this.createAlert({
        type: 'performance_degradation',
        severity: metrics.duration > this.SEARCH_PERFORMANCE_THRESHOLD * 5 ? 'high' : 'medium',
        message: `Slow symbol search performance: ${metrics.duration}ms`,
        details: {
          operation: metrics.operation,
          query: metrics.query,
          duration: metrics.duration,
          cacheHit: metrics.cacheHit,
          resultCount: metrics.resultCount
        }
      });
    }
  }

  /**
   * Check for cache performance alerts
   */
  private checkCachePerformanceAlerts(metrics: CacheMetrics): void {
    // Skip cache alerts during startup period (first 2 minutes) or if cache is empty
    const startupPeriodMs = 2 * 60 * 1000; // 2 minutes
    const timeSinceStartup = Date.now() - this.startupTime.getTime();
    
    if (timeSinceStartup < startupPeriodMs || metrics.totalKeys === 0) {
      logger.debug('Skipping cache performance alert - within startup period or cache is empty', {
        component: 'SYMBOL_MONITORING',
        operation: 'CACHE_ALERT_SKIP',
        timeSinceStartup: `${Math.round(timeSinceStartup / 1000)}s`,
        totalKeys: metrics.totalKeys
      });
      return;
    }

    // Only alert if cache has been populated but hit rate is low
    if (metrics.hitRate < this.CACHE_HIT_RATE_THRESHOLD && metrics.totalKeys > 0) {
      this.createAlert({
        type: 'cache_failure',
        severity: metrics.hitRate < 50 ? 'high' : 'medium',
        message: `Low cache hit rate: ${metrics.hitRate.toFixed(2)}%`,
        details: {
          hitRate: metrics.hitRate,
          totalKeys: metrics.totalKeys,
          memoryUsage: metrics.memoryUsage
        }
      });
    }

    // High memory usage alert
    const memoryUsageMB = metrics.memoryUsage / 1024 / 1024;
    if (memoryUsageMB > 500) { // 500MB threshold
      this.createAlert({
        type: 'cache_failure',
        severity: memoryUsageMB > 1000 ? 'high' : 'medium',
        message: `High cache memory usage: ${memoryUsageMB.toFixed(2)}MB`,
        details: {
          memoryUsage: memoryUsageMB,
          totalKeys: metrics.totalKeys,
          symbolCacheSize: metrics.symbolCacheSize,
          searchCacheSize: metrics.searchCacheSize
        }
      });
    }
  }

  /**
   * Check for database performance alerts
   */
  private checkDatabasePerformanceAlerts(metrics: DatabasePerformanceMetrics): void {
    if (metrics.duration > this.DATABASE_PERFORMANCE_THRESHOLD) {
      this.createAlert({
        type: 'database_error',
        severity: metrics.duration > this.DATABASE_PERFORMANCE_THRESHOLD * 2 ? 'high' : 'medium',
        message: `Slow database operation: ${metrics.operation} took ${metrics.duration}ms`,
        details: {
          operation: metrics.operation,
          collection: metrics.collection,
          duration: metrics.duration,
          queryType: metrics.queryType,
          indexUsed: metrics.indexUsed,
          documentsExamined: metrics.documentsExamined,
          documentsReturned: metrics.documentsReturned
        }
      });
    }

    // Alert if index not used for large queries
    if (!metrics.indexUsed && metrics.documentsExamined > 1000) {
      this.createAlert({
        type: 'database_error',
        severity: 'medium',
        message: `Database query without index examined ${metrics.documentsExamined} documents`,
        details: {
          operation: metrics.operation,
          collection: metrics.collection,
          documentsExamined: metrics.documentsExamined,
          documentsReturned: metrics.documentsReturned
        }
      });
    }
  }

  /**
   * Check for data quality alerts
   */
  private checkDataQualityAlerts(metrics: DataQualityMetrics): void {
    // High validation error rate
    const errorRate = metrics.totalSymbols > 0 ? (metrics.validationErrors / metrics.totalSymbols) * 100 : 0;
    if (errorRate > 1) { // More than 1% validation errors
      this.createAlert({
        type: 'data_quality',
        severity: errorRate > 5 ? 'high' : 'medium',
        message: `High data validation error rate: ${errorRate.toFixed(2)}%`,
        details: {
          validationErrors: metrics.validationErrors,
          totalSymbols: metrics.totalSymbols,
          errorRate
        }
      });
    }

    // Duplicate symbols
    if (metrics.duplicateSymbols > 0) {
      this.createAlert({
        type: 'data_quality',
        severity: metrics.duplicateSymbols > 100 ? 'high' : 'medium',
        message: `Duplicate symbols detected: ${metrics.duplicateSymbols}`,
        details: {
          duplicateSymbols: metrics.duplicateSymbols,
          totalSymbols: metrics.totalSymbols
        }
      });
    }

    // Large number of expired symbols
    const expiredRate = metrics.totalSymbols > 0 ? (metrics.expiredSymbols / metrics.totalSymbols) * 100 : 0;
    if (expiredRate > 10) { // More than 10% expired symbols
      this.createAlert({
        type: 'data_quality',
        severity: 'medium',
        message: `High expired symbols rate: ${expiredRate.toFixed(2)}%`,
        details: {
          expiredSymbols: metrics.expiredSymbols,
          totalSymbols: metrics.totalSymbols,
          expiredRate
        }
      });
    }
  }

  /**
   * Create an alert
   */
  private createAlert(alertData: Omit<SymbolAlert, 'id' | 'timestamp' | 'resolved'>): void {
    // Check if similar alert already exists and is not resolved
    const existingAlert = this.alerts.find(alert => 
      !alert.resolved && 
      alert.type === alertData.type && 
      alert.message === alertData.message &&
      Date.now() - alert.timestamp.getTime() < 3600000 // Within last hour
    );

    if (existingAlert) {
      return; // Don't create duplicate alerts
    }

    const alert: SymbolAlert = {
      id: `symbol_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false,
      ...alertData
    };

    this.alerts.push(alert);
    this.trimMetricsArray(this.alerts);

    // Log alert with appropriate level based on severity
    const logContext = {
      component: 'SYMBOL_MONITORING',
      operation: 'ALERT_CREATED',
      severity: alert.severity,
      alertId: alert.id,
      alertType: alert.type
    };

    const alertMessage = `🚨 SYMBOL ALERT: ${alert.message}`;

    switch (alert.severity) {
      case 'critical':
        logger.error(alertMessage, logContext, alert.details);
        break;
      case 'high':
        logger.error(alertMessage, logContext, alert.details);
        break;
      case 'medium':
        logger.warn(alertMessage, logContext, alert.details);
        break;
      case 'low':
        logger.info(alertMessage, logContext, alert.details);
        break;
      default:
        logger.warn(alertMessage, logContext, alert.details);
    }

    this.emit('alert:created', alert);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      
      logger.info('Symbol alert resolved', {
        component: 'SYMBOL_MONITORING',
        operation: 'ALERT_RESOLVED',
        alertId: alert.id,
        alertType: alert.type
      });

      this.emit('alert:resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get monitoring dashboard data
   */
  getDashboardData() {
    const recentUpdateMetrics = this.updateMetrics.slice(-10);
    const recentSearchMetrics = this.searchMetrics.slice(-20);
    const recentCacheMetrics = this.cacheMetrics.slice(-10);
    const recentDataQualityMetrics = this.dataQualityMetrics.slice(-5);
    const activeAlerts = this.alerts.filter(a => !a.resolved);

    // Calculate averages
    const avgSearchTime = recentSearchMetrics.length > 0
      ? recentSearchMetrics.reduce((sum, m) => sum + m.duration, 0) / recentSearchMetrics.length
      : 0;

    const avgCacheHitRate = recentCacheMetrics.length > 0
      ? recentCacheMetrics.reduce((sum, m) => sum + m.hitRate, 0) / recentCacheMetrics.length
      : 0;

    const avgUpdateErrorRate = recentUpdateMetrics.length > 0
      ? recentUpdateMetrics.reduce((sum, m) => sum + m.errorRate, 0) / recentUpdateMetrics.length
      : 0;

    return {
      summary: {
        avgSearchTime: Math.round(avgSearchTime),
        avgCacheHitRate: Math.round(avgCacheHitRate * 100) / 100,
        avgUpdateErrorRate: Math.round(avgUpdateErrorRate * 100) / 100,
        activeAlertsCount: activeAlerts.length,
        totalSymbols: recentDataQualityMetrics[recentDataQualityMetrics.length - 1]?.totalSymbols || 0,
        activeSymbols: recentDataQualityMetrics[recentDataQualityMetrics.length - 1]?.activeSymbols || 0
      },
      recentMetrics: {
        updates: recentUpdateMetrics,
        searches: recentSearchMetrics,
        cache: recentCacheMetrics,
        dataQuality: recentDataQualityMetrics
      },
      activeAlerts,
      healthStatus: this.getHealthStatus()
    };
  }

  /**
   * Get health status
   */
  private getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    summary: string;
    issues: string[];
  } {
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
    const highAlerts = activeAlerts.filter(a => a.severity === 'high');

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let summary = 'Symbol system operating normally';
    const issues: string[] = [];

    if (criticalAlerts.length > 0) {
      status = 'unhealthy';
      summary = 'Critical symbol system issues detected';
      issues.push(...criticalAlerts.map(a => a.message));
    } else if (highAlerts.length > 0) {
      status = 'degraded';
      summary = 'Symbol system performance issues detected';
      issues.push(...highAlerts.map(a => a.message));
    } else if (activeAlerts.length > 0) {
      status = 'degraded';
      summary = 'Minor symbol system issues detected';
      issues.push(...activeAlerts.slice(0, 3).map(a => a.message));
    }

    return { status, summary, issues };
  }

  /**
   * Trim metrics arrays to prevent memory leaks
   */
  private trimMetricsArray<T>(array: T[]): void {
    if (array.length > this.MAX_METRICS_HISTORY) {
      array.splice(0, array.length - this.MAX_METRICS_HISTORY);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(timeWindow: number = 3600000): {
    searchPerformance: {
      averageTime: number;
      p95Time: number;
      successRate: number;
      cacheHitRate: number;
    };
    updatePerformance: {
      averageErrorRate: number;
      averageDuration: number;
      totalUpdates: number;
      successfulUpdates: number;
    };
    cachePerformance: {
      averageHitRate: number;
      averageMemoryUsage: number;
      totalKeys: number;
    };
  } {
    const cutoff = new Date(Date.now() - timeWindow);
    
    const recentSearches = this.searchMetrics.filter(m => m.timestamp >= cutoff);
    const recentUpdates = this.updateMetrics.filter(m => m.timestamp >= cutoff);
    const recentCache = this.cacheMetrics.filter(m => m.timestamp >= cutoff);

    // Search performance
    const searchTimes = recentSearches.map(m => m.duration).sort((a, b) => a - b);
    const avgSearchTime = searchTimes.length > 0 
      ? searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length 
      : 0;
    const p95Index = Math.floor(searchTimes.length * 0.95);
    const p95SearchTime = searchTimes[p95Index] || 0;
    const searchSuccessRate = recentSearches.length > 0
      ? (recentSearches.filter(m => m.success).length / recentSearches.length) * 100
      : 100;
    const cacheHitRate = recentSearches.length > 0
      ? (recentSearches.filter(m => m.cacheHit).length / recentSearches.length) * 100
      : 0;

    // Update performance
    const avgUpdateErrorRate = recentUpdates.length > 0
      ? recentUpdates.reduce((sum, m) => sum + m.errorRate, 0) / recentUpdates.length
      : 0;
    const avgUpdateDuration = recentUpdates.length > 0
      ? recentUpdates.reduce((sum, m) => sum + m.duration, 0) / recentUpdates.length
      : 0;
    const totalUpdates = recentUpdates.reduce((sum, m) => sum + m.totalProcessed, 0);
    const successfulUpdates = recentUpdates.reduce((sum, m) => sum + m.successCount, 0);

    // Cache performance
    const avgCacheHitRate = recentCache.length > 0
      ? recentCache.reduce((sum, m) => sum + m.hitRate, 0) / recentCache.length
      : 0;
    const avgMemoryUsage = recentCache.length > 0
      ? recentCache.reduce((sum, m) => sum + m.memoryUsage, 0) / recentCache.length
      : 0;
    const latestCache = recentCache[recentCache.length - 1];

    return {
      searchPerformance: {
        averageTime: Math.round(avgSearchTime),
        p95Time: Math.round(p95SearchTime),
        successRate: Math.round(searchSuccessRate * 100) / 100,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100
      },
      updatePerformance: {
        averageErrorRate: Math.round(avgUpdateErrorRate * 100) / 100,
        averageDuration: Math.round(avgUpdateDuration),
        totalUpdates,
        successfulUpdates
      },
      cachePerformance: {
        averageHitRate: Math.round(avgCacheHitRate * 100) / 100,
        averageMemoryUsage: Math.round(avgMemoryUsage / 1024 / 1024 * 100) / 100, // MB
        totalKeys: latestCache?.totalKeys || 0
      }
    };
  }
}

// Export singleton instance
export const symbolMonitoringService = new SymbolMonitoringService();