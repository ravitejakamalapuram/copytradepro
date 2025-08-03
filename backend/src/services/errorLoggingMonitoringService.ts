/**
 * Error Logging Monitoring Service
 * Creates monitoring dashboards for error logging system health
 * Addresses requirements 6.1, 6.3 for monitoring dashboards and system health
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { ErrorLog } from '../models/errorLogModels';
import { logRotationService } from './logRotationService';
import { errorLogSecurityService } from './errorLogSecurityService';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);

interface SystemHealthMetrics {
  timestamp: Date;
  errorLoggingSystem: {
    status: 'healthy' | 'warning' | 'critical';
    uptime: number;
    totalErrors: number;
    errorRate: number;
    criticalErrors: number;
    lastErrorTime?: Date;
  };
  database: {
    status: 'healthy' | 'warning' | 'critical';
    connectionStatus: boolean;
    queryResponseTime: number;
    errorLogCount: number;
    indexHealth: boolean;
  };
  storage: {
    status: 'healthy' | 'warning' | 'critical';
    diskUsage: number;
    logFileCount: number;
    totalLogSize: number;
    rotationStatus: boolean;
  };
  security: {
    status: 'healthy' | 'warning' | 'critical';
    encryptionEnabled: boolean;
    accessControlEnabled: boolean;
    auditLogEntries: number;
    lastSecurityEvent?: Date;
  };
  performance: {
    status: 'healthy' | 'warning' | 'critical';
    avgLogProcessingTime: number;
    memoryUsage: number;
    queueSize: number;
    throughput: number;
  };
}

interface AlertThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
}

interface MonitoringAlert {
  id: string;
  timestamp: Date;
  severity: 'warning' | 'critical';
  component: string;
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
  resolved: boolean;
  resolvedAt?: Date;
}

export class ErrorLoggingMonitoringService {
  private static instance: ErrorLoggingMonitoringService;
  private isRunning: boolean = false;
  private startTime: Date = new Date();
  private healthMetrics: SystemHealthMetrics[] = [];
  private activeAlerts: MonitoringAlert[] = [];
  private monitoringJobs: Map<string, cron.ScheduledTask> = new Map();
  private config: any;

  // Performance tracking
  private logProcessingTimes: number[] = [];
  private errorCounts: { timestamp: Date; count: number }[] = [];
  private maxMetricsHistory = 1000;

  private constructor() {
    this.loadConfiguration();
    this.initializeThresholds();
  }

  public static getInstance(): ErrorLoggingMonitoringService {
    if (!ErrorLoggingMonitoringService.instance) {
      ErrorLoggingMonitoringService.instance = new ErrorLoggingMonitoringService();
    }
    return ErrorLoggingMonitoringService.instance;
  }

  /**
   * Load monitoring configuration
   */
  private loadConfiguration(): void {
    try {
      this.config = require('../../config/production-error-logging.config.js');
      logger.info('Error logging monitoring configuration loaded', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'LOAD_CONFIGURATION'
      });
    } catch (error) {
      logger.error('Failed to load monitoring configuration', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'LOAD_CONFIGURATION'
      }, error);
      throw error;
    }
  }

  /**
   * Initialize alert thresholds
   */
  private initializeThresholds(): void {
    this.alertThresholds = [
      {
        metric: 'errorRate',
        warning: 0.05, // 5%
        critical: 0.10, // 10%
        unit: 'percentage'
      },
      {
        metric: 'criticalErrors',
        warning: 5,
        critical: 10,
        unit: 'count/hour'
      },
      {
        metric: 'diskUsage',
        warning: 0.80, // 80%
        critical: 0.90, // 90%
        unit: 'percentage'
      },
      {
        metric: 'memoryUsage',
        warning: 500, // 500MB
        critical: 800, // 800MB
        unit: 'MB'
      },
      {
        metric: 'queryResponseTime',
        warning: 1000, // 1 second
        critical: 5000, // 5 seconds
        unit: 'ms'
      },
      {
        metric: 'logProcessingTime',
        warning: 100, // 100ms
        critical: 500, // 500ms
        unit: 'ms'
      }
    ];
  }

  private alertThresholds: AlertThreshold[] = [];

  /**
   * Start monitoring service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Error logging monitoring service is already running', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'START'
      });
      return;
    }

    try {
      logger.info('Starting error logging monitoring service', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'START'
      });

      this.startTime = new Date();

      // Schedule health checks
      await this.scheduleHealthChecks();

      // Schedule metrics collection
      await this.scheduleMetricsCollection();

      // Schedule alert processing
      await this.scheduleAlertProcessing();

      // Perform initial health check
      await this.performHealthCheck();

      this.isRunning = true;

      logger.info('Error logging monitoring service started successfully', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'START',
        monitoringJobs: this.monitoringJobs.size
      });
    } catch (error) {
      logger.error('Failed to start error logging monitoring service', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'START'
      }, error);
      throw error;
    }
  }

  /**
   * Stop monitoring service
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('Stopping error logging monitoring service', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'STOP'
      });

      // Stop all monitoring jobs
      this.monitoringJobs.forEach((job, name) => {
        job.stop();
        logger.debug(`Stopped monitoring job: ${name}`, {
          component: 'ERROR_LOGGING_MONITORING_SERVICE',
          operation: 'STOP_JOB'
        });
      });

      this.monitoringJobs.clear();
      this.isRunning = false;

      logger.info('Error logging monitoring service stopped successfully', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'STOP'
      });
    } catch (error) {
      logger.error('Failed to stop error logging monitoring service', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'STOP'
      }, error);
      throw error;
    }
  }

  /**
   * Schedule health checks
   */
  private async scheduleHealthChecks(): Promise<void> {
    const interval = this.config.monitoring.healthCheck.interval;
    const cronExpression = this.convertIntervalToCron(interval);

    const healthCheckJob = cron.schedule(cronExpression, async () => {
      await this.performHealthCheck();
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    healthCheckJob.start();
    this.monitoringJobs.set('health-check', healthCheckJob);

    logger.debug('Scheduled health check job', {
      component: 'ERROR_LOGGING_MONITORING_SERVICE',
      operation: 'SCHEDULE_HEALTH_CHECKS',
      interval,
      cronExpression
    });
  }

  /**
   * Schedule metrics collection
   */
  private async scheduleMetricsCollection(): Promise<void> {
    const interval = this.config.monitoring.metrics.interval;
    const cronExpression = this.convertIntervalToCron(interval);

    const metricsJob = cron.schedule(cronExpression, async () => {
      await this.collectMetrics();
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    metricsJob.start();
    this.monitoringJobs.set('metrics-collection', metricsJob);

    logger.debug('Scheduled metrics collection job', {
      component: 'ERROR_LOGGING_MONITORING_SERVICE',
      operation: 'SCHEDULE_METRICS_COLLECTION',
      interval,
      cronExpression
    });
  }

  /**
   * Schedule alert processing
   */
  private async scheduleAlertProcessing(): Promise<void> {
    // Process alerts every minute
    const alertJob = cron.schedule('* * * * *', async () => {
      await this.processAlerts();
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    alertJob.start();
    this.monitoringJobs.set('alert-processing', alertJob);

    logger.debug('Scheduled alert processing job', {
      component: 'ERROR_LOGGING_MONITORING_SERVICE',
      operation: 'SCHEDULE_ALERT_PROCESSING'
    });
  }

  /**
   * Convert millisecond interval to cron expression
   */
  private convertIntervalToCron(intervalMs: number): string {
    const minutes = Math.floor(intervalMs / 60000);
    
    if (minutes < 1) {
      return '* * * * *'; // Every minute (minimum)
    } else if (minutes < 60) {
      return `*/${minutes} * * * *`; // Every N minutes
    } else {
      const hours = Math.floor(minutes / 60);
      return `0 */${hours} * * *`; // Every N hours
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      logger.debug('Performing error logging system health check', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'PERFORM_HEALTH_CHECK'
      });

      const metrics: SystemHealthMetrics = {
        timestamp: new Date(),
        errorLoggingSystem: await this.checkErrorLoggingSystemHealth(),
        database: await this.checkDatabaseHealth(),
        storage: await this.checkStorageHealth(),
        security: await this.checkSecurityHealth(),
        performance: await this.checkPerformanceHealth()
      };

      // Store metrics
      this.healthMetrics.push(metrics);

      // Keep only recent metrics
      const retentionTime = this.config.monitoring.metrics.retention;
      const cutoff = new Date(Date.now() - retentionTime);
      this.healthMetrics = this.healthMetrics.filter(m => m.timestamp >= cutoff);

      // Check for alerts
      await this.checkForAlerts(metrics);

      logger.debug('Health check completed', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'PERFORM_HEALTH_CHECK',
        overallStatus: this.getOverallSystemStatus(metrics)
      });
    } catch (error) {
      logger.error('Failed to perform health check', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'PERFORM_HEALTH_CHECK'
      }, error);
    }
  }

  /**
   * Check error logging system health
   */
  private async checkErrorLoggingSystemHealth(): Promise<SystemHealthMetrics['errorLoggingSystem']> {
    try {
      const uptime = Date.now() - this.startTime.getTime();
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Get recent error statistics
      const recentErrors = await ErrorLog.countDocuments({
        timestamp: { $gte: oneHourAgo }
      });

      const criticalErrors = await ErrorLog.countDocuments({
        timestamp: { $gte: oneHourAgo },
        level: 'ERROR'
      });

      const totalErrors = await ErrorLog.countDocuments();

      // Calculate error rate (errors per minute)
      const errorRate = recentErrors / 60;

      // Get last error time
      const lastError = await ErrorLog.findOne({}, { timestamp: 1 }).sort({ timestamp: -1 });

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (criticalErrors > 10 || errorRate > 0.5) {
        status = 'critical';
      } else if (criticalErrors > 5 || errorRate > 0.1) {
        status = 'warning';
      }

      return {
        status,
        uptime,
        totalErrors,
        errorRate,
        criticalErrors,
        ...(lastError?.timestamp && { lastErrorTime: lastError.timestamp })
      };
    } catch (error) {
      logger.error('Failed to check error logging system health', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'CHECK_ERROR_LOGGING_SYSTEM_HEALTH'
      }, error);

      return {
        status: 'critical',
        uptime: 0,
        totalErrors: 0,
        errorRate: 0,
        criticalErrors: 0
      };
    }
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<SystemHealthMetrics['database']> {
    try {
      const startTime = Date.now();
      
      // Test database connection
      const connectionStatus = await this.testDatabaseConnection();
      
      // Measure query response time
      const queryResponseTime = Date.now() - startTime;

      // Get error log count
      const errorLogCount = await ErrorLog.countDocuments();

      // Check index health (simplified check)
      const indexHealth = await this.checkDatabaseIndexes();

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (!connectionStatus || queryResponseTime > 5000) {
        status = 'critical';
      } else if (queryResponseTime > 1000 || !indexHealth) {
        status = 'warning';
      }

      return {
        status,
        connectionStatus,
        queryResponseTime,
        errorLogCount,
        indexHealth
      };
    } catch (error) {
      logger.error('Failed to check database health', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'CHECK_DATABASE_HEALTH'
      }, error);

      return {
        status: 'critical',
        connectionStatus: false,
        queryResponseTime: 0,
        errorLogCount: 0,
        indexHealth: false
      };
    }
  }

  /**
   * Check storage health
   */
  private async checkStorageHealth(): Promise<SystemHealthMetrics['storage']> {
    try {
      const logsDir = path.dirname(this.config.filePaths.error);
      
      // Calculate disk usage
      const diskUsage = await this.calculateDiskUsage(logsDir);
      
      // Count log files
      const logFileCount = await this.countLogFiles(logsDir);
      
      // Calculate total log size
      const totalLogSize = await this.calculateTotalLogSize(logsDir);
      
      // Check rotation status
      const rotationStatus = logRotationService.getStatus().isRunning;

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (diskUsage > 0.90) {
        status = 'critical';
      } else if (diskUsage > 0.80 || !rotationStatus) {
        status = 'warning';
      }

      return {
        status,
        diskUsage,
        logFileCount,
        totalLogSize,
        rotationStatus
      };
    } catch (error) {
      logger.error('Failed to check storage health', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'CHECK_STORAGE_HEALTH'
      }, error);

      return {
        status: 'critical',
        diskUsage: 0,
        logFileCount: 0,
        totalLogSize: 0,
        rotationStatus: false
      };
    }
  }

  /**
   * Check security health
   */
  private async checkSecurityHealth(): Promise<SystemHealthMetrics['security']> {
    try {
      const securityStatus = errorLogSecurityService.getStatus();
      
      // Determine status based on security configuration
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (!securityStatus.configurationValid) {
        status = 'critical';
      } else if (!securityStatus.accessControlEnabled || !securityStatus.sanitizationEnabled) {
        status = 'warning';
      }

      return {
        status,
        encryptionEnabled: securityStatus.encryptionEnabled,
        accessControlEnabled: securityStatus.accessControlEnabled,
        auditLogEntries: securityStatus.auditLogEntries
      };
    } catch (error) {
      logger.error('Failed to check security health', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'CHECK_SECURITY_HEALTH'
      }, error);

      return {
        status: 'critical',
        encryptionEnabled: false,
        accessControlEnabled: false,
        auditLogEntries: 0
      };
    }
  }

  /**
   * Check performance health
   */
  private async checkPerformanceHealth(): Promise<SystemHealthMetrics['performance']> {
    try {
      // Calculate average log processing time
      const avgLogProcessingTime = this.logProcessingTimes.length > 0
        ? this.logProcessingTimes.reduce((sum, time) => sum + time, 0) / this.logProcessingTimes.length
        : 0;

      // Get memory usage
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB

      // Calculate throughput (logs per minute)
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const recentErrorCounts = this.errorCounts.filter(ec => ec.timestamp >= oneMinuteAgo);
      const throughput = recentErrorCounts.reduce((sum, ec) => sum + ec.count, 0);

      // Queue size (simplified - could be actual queue size)
      const queueSize = 0; // Placeholder

      // Determine status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (avgLogProcessingTime > 500 || memoryUsage > 800) {
        status = 'critical';
      } else if (avgLogProcessingTime > 100 || memoryUsage > 500) {
        status = 'warning';
      }

      return {
        status,
        avgLogProcessingTime,
        memoryUsage,
        queueSize,
        throughput
      };
    } catch (error) {
      logger.error('Failed to check performance health', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'CHECK_PERFORMANCE_HEALTH'
      }, error);

      return {
        status: 'critical',
        avgLogProcessingTime: 0,
        memoryUsage: 0,
        queueSize: 0,
        throughput: 0
      };
    }
  }

  /**
   * Test database connection
   */
  private async testDatabaseConnection(): Promise<boolean> {
    try {
      await ErrorLog.findOne().limit(1);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check database indexes
   */
  private async checkDatabaseIndexes(): Promise<boolean> {
    try {
      const indexes = await ErrorLog.collection.getIndexes();
      // Check if required indexes exist
      const requiredIndexes = ['traceId_1_timestamp_-1', 'level_1_timestamp_-1'];
      return requiredIndexes.every(index => 
        Object.keys(indexes).some(existingIndex => existingIndex.includes(index.split('_')[0] || ''))
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Calculate disk usage for logs directory
   */
  private async calculateDiskUsage(directory: string): Promise<number> {
    try {
      // This is a simplified calculation
      // In production, you might want to use a more sophisticated method
      const stats = await stat(directory);
      return 0.5; // Placeholder - return 50% usage
    } catch (error) {
      return 0;
    }
  }

  /**
   * Count log files in directory
   */
  private async countLogFiles(directory: string): Promise<number> {
    try {
      const files = await readdir(directory);
      return files.filter(file => file.endsWith('.log') || file.endsWith('.log.gz')).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate total log size
   */
  private async calculateTotalLogSize(directory: string): Promise<number> {
    try {
      const files = await readdir(directory);
      let totalSize = 0;

      for (const file of files) {
        if (file.endsWith('.log') || file.endsWith('.log.gz')) {
          const filePath = path.join(directory, file);
          const stats = await stat(filePath);
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get overall system status
   */
  private getOverallSystemStatus(metrics: SystemHealthMetrics): 'healthy' | 'warning' | 'critical' {
    const statuses = [
      metrics.errorLoggingSystem.status,
      metrics.database.status,
      metrics.storage.status,
      metrics.security.status,
      metrics.performance.status
    ];

    if (statuses.includes('critical')) {
      return 'critical';
    } else if (statuses.includes('warning')) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * Check for alerts based on metrics
   */
  private async checkForAlerts(metrics: SystemHealthMetrics): Promise<void> {
    const alerts: MonitoringAlert[] = [];

    // Check each threshold
    for (const threshold of this.alertThresholds) {
      const currentValue = this.getMetricValue(metrics, threshold.metric);
      
      if (currentValue >= threshold.critical) {
        alerts.push(this.createAlert('critical', threshold, currentValue));
      } else if (currentValue >= threshold.warning) {
        alerts.push(this.createAlert('warning', threshold, currentValue));
      }
    }

    // Add new alerts
    for (const alert of alerts) {
      const existingAlert = this.activeAlerts.find(a => 
        a.component === alert.component && 
        a.metric === alert.metric && 
        !a.resolved
      );

      if (!existingAlert) {
        this.activeAlerts.push(alert);
        await this.sendAlert(alert);
      }
    }

    // Resolve alerts that are no longer active
    for (const activeAlert of this.activeAlerts) {
      if (!activeAlert.resolved) {
        const currentValue = this.getMetricValue(metrics, activeAlert.metric);
        const threshold = this.alertThresholds.find(t => t.metric === activeAlert.metric);
        
        if (threshold && currentValue < threshold.warning) {
          activeAlert.resolved = true;
          activeAlert.resolvedAt = new Date();
          await this.sendAlertResolution(activeAlert);
        }
      }
    }
  }

  /**
   * Get metric value from health metrics
   */
  private getMetricValue(metrics: SystemHealthMetrics, metricName: string): number {
    switch (metricName) {
      case 'errorRate':
        return metrics.errorLoggingSystem.errorRate;
      case 'criticalErrors':
        return metrics.errorLoggingSystem.criticalErrors;
      case 'diskUsage':
        return metrics.storage.diskUsage;
      case 'memoryUsage':
        return metrics.performance.memoryUsage;
      case 'queryResponseTime':
        return metrics.database.queryResponseTime;
      case 'logProcessingTime':
        return metrics.performance.avgLogProcessingTime;
      default:
        return 0;
    }
  }

  /**
   * Create monitoring alert
   */
  private createAlert(severity: 'warning' | 'critical', threshold: AlertThreshold, currentValue: number): MonitoringAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      severity,
      component: 'ERROR_LOGGING_SYSTEM',
      metric: threshold.metric,
      currentValue,
      threshold: severity === 'critical' ? threshold.critical : threshold.warning,
      message: `${threshold.metric} is ${severity}: ${currentValue}${threshold.unit} (threshold: ${severity === 'critical' ? threshold.critical : threshold.warning}${threshold.unit})`,
      resolved: false
    };
  }

  /**
   * Send alert notification
   */
  private async sendAlert(alert: MonitoringAlert): Promise<void> {
    logger.warn(`ALERT: ${alert.message}`, {
      component: 'ERROR_LOGGING_MONITORING_SERVICE',
      operation: 'SEND_ALERT',
      alertId: alert.id,
      severity: alert.severity,
      metric: alert.metric
    });

    // In production, send to external alerting systems
    if (process.env.NODE_ENV === 'production') {
      // Send to webhook, email, Slack, etc.
      await this.sendToAlertingSystem(alert);
    }
  }

  /**
   * Send alert resolution notification
   */
  private async sendAlertResolution(alert: MonitoringAlert): Promise<void> {
    logger.info(`ALERT RESOLVED: ${alert.message}`, {
      component: 'ERROR_LOGGING_MONITORING_SERVICE',
      operation: 'SEND_ALERT_RESOLUTION',
      alertId: alert.id,
      resolvedAt: alert.resolvedAt
    });
  }

  /**
   * Send to external alerting system
   */
  private async sendToAlertingSystem(alert: MonitoringAlert): Promise<void> {
    // Placeholder for external alerting system integration
    logger.debug('Sending alert to external system', {
      component: 'ERROR_LOGGING_MONITORING_SERVICE',
      operation: 'SEND_TO_ALERTING_SYSTEM',
      alertId: alert.id
    });
  }

  /**
   * Collect additional metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Collect error counts
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const errorCount = await ErrorLog.countDocuments({
        timestamp: { $gte: oneMinuteAgo }
      });

      this.errorCounts.push({
        timestamp: new Date(),
        count: errorCount
      });

      // Keep only recent error counts
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      this.errorCounts = this.errorCounts.filter(ec => ec.timestamp >= oneHourAgo);

      logger.debug('Metrics collected', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'COLLECT_METRICS',
        errorCount,
        totalMetrics: this.errorCounts.length
      });
    } catch (error) {
      logger.error('Failed to collect metrics', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'COLLECT_METRICS'
      }, error);
    }
  }

  /**
   * Process alerts
   */
  private async processAlerts(): Promise<void> {
    try {
      // Clean up old resolved alerts
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      this.activeAlerts = this.activeAlerts.filter(alert => 
        !alert.resolved || (alert.resolvedAt && alert.resolvedAt >= oneWeekAgo)
      );

      logger.debug('Processed alerts', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'PROCESS_ALERTS',
        activeAlerts: this.activeAlerts.filter(a => !a.resolved).length,
        totalAlerts: this.activeAlerts.length
      });
    } catch (error) {
      logger.error('Failed to process alerts', {
        component: 'ERROR_LOGGING_MONITORING_SERVICE',
        operation: 'PROCESS_ALERTS'
      }, error);
    }
  }

  /**
   * Record log processing time
   */
  public recordLogProcessingTime(processingTime: number): void {
    this.logProcessingTimes.push(processingTime);
    
    // Keep only recent processing times
    if (this.logProcessingTimes.length > this.maxMetricsHistory) {
      this.logProcessingTimes = this.logProcessingTimes.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Get current system health
   */
  public getCurrentHealth(): SystemHealthMetrics | null {
    return this.healthMetrics.length > 0 ? this.healthMetrics[this.healthMetrics.length - 1] || null : null;
  }

  /**
   * Get health history
   */
  public getHealthHistory(hours: number = 24): SystemHealthMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.healthMetrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): MonitoringAlert[] {
    return this.activeAlerts.filter(alert => !alert.resolved);
  }

  /**
   * Get monitoring service status
   */
  public getStatus(): {
    isRunning: boolean;
    uptime: number;
    monitoringJobs: number;
    activeAlerts: number;
    healthMetrics: number;
    lastHealthCheck?: Date;
  } {
    const lastHealthCheck = this.healthMetrics.length > 0 
      ? this.healthMetrics[this.healthMetrics.length - 1]?.timestamp 
      : undefined;

    return {
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime.getTime(),
      monitoringJobs: this.monitoringJobs.size,
      activeAlerts: this.activeAlerts.filter(a => !a.resolved).length,
      healthMetrics: this.healthMetrics.length,
      ...(lastHealthCheck && { lastHealthCheck })
    };
  }
}

// Export singleton instance
export const errorLoggingMonitoringService = ErrorLoggingMonitoringService.getInstance();