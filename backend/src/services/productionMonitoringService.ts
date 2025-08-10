/**
 * Production Monitoring Service
 * Comprehensive monitoring system for production environment
 */

import { EventEmitter } from 'events';
import { logger, LogContext } from '../utils/logger';
// Optional brokerSessionManager (may not be present in all builds)
let brokerSessionManager: { getHealthStatistics: () => any } | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  brokerSessionManager = require('./brokerSessionManager').brokerSessionManager;
} catch {
  brokerSessionManager = null;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  uptime: number;
  activeConnections: number;
  errorRate: number;
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // milliseconds
  lastTriggered?: Date;
  enabled: boolean;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metrics: SystemMetrics;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface PerformanceMetric {
  timestamp: Date;
  operation: string;
  duration: number;
  success: boolean;
  errorMessage?: string;
  context?: LogContext;
}

export interface ErrorSummary {
  timestamp: Date;
  errorType: string;
  count: number;
  lastOccurrence: Date;
  severity: string;
  component: string;
}

export class ProductionMonitoringService extends EventEmitter {
  private metrics: SystemMetrics[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private alerts: Alert[] = [];
  private alertRules: AlertRule[] = [];
  private errorSummaries: Map<string, ErrorSummary> = new Map();
  
  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly MAX_PERFORMANCE_HISTORY = 5000;
  private readonly MAX_ALERTS_HISTORY = 500;
  private readonly METRICS_INTERVAL = 30000; // 30 seconds
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  
  private metricsInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor() {
    super();
    this.setupDefaultAlertRules();
  }

  /**
   * Start monitoring service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Production monitoring service is already running');
      return;
    }

    logger.info('Starting production monitoring service');
    
    this.isRunning = true;
    
    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.METRICS_INTERVAL);

    // Start cleanup routine
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, this.CLEANUP_INTERVAL);

    // Collect initial metrics
    this.collectSystemMetrics();

    logger.info('Production monitoring service started');
    this.emit('monitoring:started');
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping production monitoring service');
    
    this.isRunning = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.info('Production monitoring service stopped');
    this.emit('monitoring:stopped');
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const loadAvg = require('os').loadavg();
      
      // Calculate error rate from recent performance metrics
      const recentMetrics = this.performanceMetrics.filter(
        m => Date.now() - m.timestamp.getTime() < 300000 // Last 5 minutes
      );
      const errorRate = recentMetrics.length > 0 
        ? (recentMetrics.filter(m => !m.success).length / recentMetrics.length) * 100 
        : 0;

      // Calculate response times
      const successfulMetrics = recentMetrics.filter(m => m.success);
      const responseTimes = successfulMetrics.map(m => m.duration).sort((a, b) => a - b);
      const avgResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0;
      const p95Index = Math.floor(responseTimes.length * 0.95);
      const p99Index = Math.floor(responseTimes.length * 0.99);

      const metrics: SystemMetrics = {
        timestamp: new Date(),
        cpu: {
          usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
          loadAverage: loadAvg
        },
        memory: {
          used: memUsage.rss,
          total: require('os').totalmem(),
          percentage: (memUsage.rss / require('os').totalmem()) * 100,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal
        },
        uptime: process.uptime(),
        activeConnections: this.getActiveConnectionsCount(),
        errorRate,
        responseTime: {
          average: avgResponseTime,
          p95: responseTimes[p95Index] || 0,
          p99: responseTimes[p99Index] || 0
        }
      };

      this.metrics.push(metrics);
      this.checkAlertRules(metrics);
      
      // Emit metrics event
      this.emit('metrics:collected', metrics);

      // Log metrics periodically (every 5 minutes)
      if (this.metrics.length % 10 === 0) {
        logger.info('System metrics collected', {
          component: 'MONITORING',
          operation: 'METRICS_COLLECTION'
        }, {
          memoryUsage: `${Math.round(metrics.memory.percentage)}%`,
          errorRate: `${metrics.errorRate.toFixed(2)}%`,
          avgResponseTime: `${metrics.responseTime.average.toFixed(2)}ms`,
          activeConnections: metrics.activeConnections
        });
      }

    } catch (error) {
      logger.error('Failed to collect system metrics', {
        component: 'MONITORING',
        operation: 'METRICS_COLLECTION'
      }, error);
    }
  }

  /**
   * Get active connections count from WebSocket service
   */
  private getActiveConnectionsCount(): number {
    try {
      // This would need to be integrated with the WebSocket service
      // For now, return a placeholder
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Record performance metric
   */
  recordPerformanceMetric(
    operation: string,
    duration: number,
    success: boolean,
    context?: LogContext,
    errorMessage?: string
  ): void {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      operation,
      duration,
      success,
      ...(errorMessage && { errorMessage }),
      ...(context && { context })
    };

    this.performanceMetrics.push(metric);
    
    // Update error summary if this was an error
    if (!success && errorMessage) {
      this.updateErrorSummary(operation, errorMessage, context);
    }

    this.emit('performance:recorded', metric);
  }

  /**
   * Update error summary
   */
  private updateErrorSummary(operation: string, errorMessage: string, context?: LogContext): void {
    const key = `${operation}:${errorMessage}`;
    const existing = this.errorSummaries.get(key);
    
    if (existing) {
      existing.count++;
      existing.lastOccurrence = new Date();
    } else {
      this.errorSummaries.set(key, {
        timestamp: new Date(),
        errorType: errorMessage,
        count: 1,
        lastOccurrence: new Date(),
        severity: context?.severity || 'medium',
        component: context?.component || operation
      });
    }
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    this.alertRules = [
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        condition: (metrics) => metrics.memory.percentage > 85,
        severity: 'high',
        cooldown: 300000, // 5 minutes
        enabled: true
      },
      {
        id: 'critical-memory-usage',
        name: 'Critical Memory Usage',
        condition: (metrics) => metrics.memory.percentage > 95,
        severity: 'critical',
        cooldown: 60000, // 1 minute
        enabled: true
      },
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        condition: (metrics) => metrics.errorRate > 10,
        severity: 'high',
        cooldown: 300000, // 5 minutes
        enabled: true
      },
      {
        id: 'critical-error-rate',
        name: 'Critical Error Rate',
        condition: (metrics) => metrics.errorRate > 25,
        severity: 'critical',
        cooldown: 60000, // 1 minute
        enabled: true
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time',
        condition: (metrics) => metrics.responseTime.p95 > 5000, // 5 seconds
        severity: 'medium',
        cooldown: 600000, // 10 minutes
        enabled: true
      },
      {
        id: 'very-slow-response-time',
        name: 'Very Slow Response Time',
        condition: (metrics) => metrics.responseTime.p95 > 10000, // 10 seconds
        severity: 'high',
        cooldown: 300000, // 5 minutes
        enabled: true
      }
    ];
  }

  /**
   * Check alert rules against current metrics
   */
  private checkAlertRules(metrics: SystemMetrics): void {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered.getTime() < rule.cooldown) {
        continue;
      }

      // Check condition
      if (rule.condition(metrics)) {
        this.triggerAlert(rule, metrics);
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, metrics: SystemMetrics): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      severity: rule.severity,
      message: `${rule.name} - ${this.generateAlertMessage(rule, metrics)}`,
      timestamp: new Date(),
      metrics,
      resolved: false
    };

    this.alerts.push(alert);
    rule.lastTriggered = new Date();

    // Log alert
    logger.error(`🚨 ALERT: ${alert.message}`, {
      component: 'MONITORING',
      operation: 'ALERT_TRIGGERED',
      severity: alert.severity,
      alertId: alert.id
    });

    // Emit alert event
    this.emit('alert:triggered', alert);

    // Send to external alerting systems in production
    if (process.env.NODE_ENV === 'production') {
      this.sendExternalAlert(alert);
    }
  }

  /**
   * Generate alert message based on rule and metrics
   */
  private generateAlertMessage(rule: AlertRule, metrics: SystemMetrics): string {
    switch (rule.id) {
      case 'high-memory-usage':
      case 'critical-memory-usage':
        return `Memory usage at ${metrics.memory.percentage.toFixed(1)}%`;
      case 'high-error-rate':
      case 'critical-error-rate':
        return `Error rate at ${metrics.errorRate.toFixed(1)}%`;
      case 'slow-response-time':
      case 'very-slow-response-time':
        return `95th percentile response time at ${metrics.responseTime.p95.toFixed(0)}ms`;
      default:
        return 'Threshold exceeded';
    }
  }

  /**
   * Send alert to external systems
   */
  private async sendExternalAlert(alert: Alert): Promise<void> {
    try {
      // Import alerting service dynamically to avoid circular dependencies
      const { alertingService } = await import('./alertingService');
      
      // Convert Alert to MonitoringAlert
      const monitoringAlert = {
        id: alert.id,
        timestamp: alert.timestamp,
        type: 'SYSTEM_DEGRADATION' as const,
        severity: alert.severity.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        title: `System Alert: ${alert.ruleId}`,
        description: alert.message,
        affectedComponents: ['SYSTEM'],
        metrics: {
          currentValue: 0 // Would need to extract from alert.metrics
        },
        acknowledged: false,
        resolved: alert.resolved,
        actions: ['Check system metrics', 'Review alert details']
      };
      
      await alertingService.sendAlert(monitoringAlert);
      
      logger.info('📤 Alert sent to external systems', {
        component: 'MONITORING',
        operation: 'EXTERNAL_ALERT',
        alertId: alert.id,
        severity: alert.severity
      });
    } catch (error) {
      logger.error('Failed to send alert to external systems', {
        component: 'MONITORING',
        operation: 'EXTERNAL_ALERT',
        alertId: alert.id,
        severity: alert.severity
      }, error);
    }
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const now = Date.now();
    const oneHourAgo = now - 3600000; // 1 hour
    const oneDayAgo = now - 86400000; // 24 hours

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS_HISTORY);
    }

    // Keep only recent performance metrics
    if (this.performanceMetrics.length > this.MAX_PERFORMANCE_HISTORY) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.MAX_PERFORMANCE_HISTORY);
    }

    // Keep only recent alerts
    if (this.alerts.length > this.MAX_ALERTS_HISTORY) {
      this.alerts = this.alerts.slice(-this.MAX_ALERTS_HISTORY);
    }

    // Clean up old error summaries (older than 1 day)
    for (const [key, summary] of this.errorSummaries.entries()) {
      if (summary.lastOccurrence.getTime() < oneDayAgo) {
        this.errorSummaries.delete(key);
      }
    }

    logger.debug('Monitoring data cleanup completed', {
      component: 'MONITORING',
      operation: 'CLEANUP'
    });
  }

  /**
   * Get current system health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: SystemMetrics | null;
    activeAlerts: Alert[];
    summary: string;
  } {
    const latestMetrics = this.metrics[this.metrics.length - 1] || null;
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let summary = 'All systems operational';

    if (activeAlerts.some(a => a.severity === 'critical')) {
      status = 'unhealthy';
      summary = 'Critical issues detected';
    } else if (activeAlerts.some(a => a.severity === 'high')) {
      status = 'degraded';
      summary = 'Performance issues detected';
    } else if (activeAlerts.length > 0) {
      status = 'degraded';
      summary = 'Minor issues detected';
    }

    return {
      status,
      metrics: latestMetrics,
      activeAlerts,
      summary
    };
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData() {
    const recentMetrics = this.metrics.slice(-20); // Last 20 data points
    const errorSummary = Array.from(this.errorSummaries.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 errors

    return {
      systemHealth: this.getHealthStatus(),
      recentMetrics,
      errorSummary,
      brokerHealth: brokerSessionManager ? brokerSessionManager.getHealthStatistics() : { total: 0, active: 0 },
      uptime: process.uptime()
    };
  }

  /**
   * Get SLA metrics
   */
  getSLAMetrics(timeWindow: number = 3600000): {
    uptime: number;
    availability: number;
    averageResponseTime: number;
    errorRate: number;
    successRate: number;
  } {
    const cutoff = new Date(Date.now() - timeWindow);
    const recentMetrics = this.performanceMetrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        uptime: process.uptime(),
        availability: 100,
        averageResponseTime: 0,
        errorRate: 0,
        successRate: 100
      };
    }

    const successfulRequests = recentMetrics.filter(m => m.success);
    const totalRequests = recentMetrics.length;
    const successRate = (successfulRequests.length / totalRequests) * 100;
    const errorRate = 100 - successRate;
    
    const averageResponseTime = successfulRequests.length > 0
      ? successfulRequests.reduce((sum, m) => sum + m.duration, 0) / successfulRequests.length
      : 0;

    return {
      uptime: process.uptime(),
      availability: successRate,
      averageResponseTime,
      errorRate,
      successRate
    };
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.alertRules.push({ ...rule, id });
    return id;
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(id: string): boolean {
    const index = this.alertRules.findIndex(rule => rule.id === id);
    if (index !== -1) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alert:resolved', alert);
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const productionMonitoringService = new ProductionMonitoringService();