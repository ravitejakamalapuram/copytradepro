/**
 * Startup Monitoring Service
 * Tracks startup performance metrics and provides monitoring capabilities
 */

import { logger } from '../utils/logger';
import { startupStatusService } from './startupStatusService';
import { startupSymbolInitializationService } from './startupSymbolInitializationService';

export interface StartupMetrics {
  serverStartupTime: number;
  symbolInitTime: number;
  totalStartupTime: number;
  memoryUsageAtStart: NodeJS.MemoryUsage;
  memoryUsageAtEnd?: NodeJS.MemoryUsage;
  cpuUsageAtStart: NodeJS.CpuUsage;
  cpuUsageAtEnd?: NodeJS.CpuUsage;
  retryCount: number;
  errorCount: number;
  performanceScore: number;
}

export interface StartupAlert {
  type: 'SLOW_STARTUP' | 'HIGH_MEMORY' | 'MULTIPLE_RETRIES' | 'STARTUP_FAILURE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  timestamp: Date;
  metrics?: any;
}

export class StartupMonitoringService {
  private metrics: Partial<StartupMetrics> = {};
  private alerts: StartupAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  // Performance thresholds
  private readonly SLOW_STARTUP_THRESHOLD = 120000; // 2 minutes
  private readonly HIGH_MEMORY_THRESHOLD = 500 * 1024 * 1024; // 500MB
  private readonly MAX_ACCEPTABLE_RETRIES = 2;

  constructor() {
    logger.info('Startup Monitoring Service created', {
      component: 'STARTUP_MONITORING',
      operation: 'CONSTRUCTOR'
    });
  }

  /**
   * Start monitoring startup process
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      logger.warn('Startup monitoring already active', {
        component: 'STARTUP_MONITORING',
        operation: 'START_MONITORING_ALREADY_ACTIVE'
      });
      return;
    }

    this.isMonitoring = true;
    this.metrics = {
      memoryUsageAtStart: process.memoryUsage(),
      cpuUsageAtStart: process.cpuUsage(),
      retryCount: 0,
      errorCount: 0
    };

    logger.info('Started startup monitoring', {
      component: 'STARTUP_MONITORING',
      operation: 'START_MONITORING',
      initialMemory: this.metrics.memoryUsageAtStart,
      initialCpu: this.metrics.cpuUsageAtStart
    });

    // Monitor every 10 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 10000);

    // Listen for startup status changes
    startupStatusService.onStatusUpdate((status) => {
      this.handleStatusUpdate(status);
    });
  }

  /**
   * Stop monitoring startup process
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Capture final metrics
    this.metrics.memoryUsageAtEnd = process.memoryUsage();
    this.metrics.cpuUsageAtEnd = process.cpuUsage(this.metrics.cpuUsageAtStart);

    // Calculate performance score
    this.calculatePerformanceScore();

    logger.info('Stopped startup monitoring', {
      component: 'STARTUP_MONITORING',
      operation: 'STOP_MONITORING',
      finalMetrics: this.metrics
    });
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    const currentMemory = process.memoryUsage();
    const status = startupStatusService.getStatus();
    const symbolStats = startupSymbolInitializationService.getInitializationStats();

    // Check for memory issues
    if (currentMemory.heapUsed > this.HIGH_MEMORY_THRESHOLD) {
      this.addAlert({
        type: 'HIGH_MEMORY',
        severity: 'MEDIUM',
        message: `High memory usage detected: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`,
        timestamp: new Date(),
        metrics: { memoryUsage: currentMemory }
      });
    }

    // Check for slow startup
    if (status.serverStartedAt && !status.symbolDataReady) {
      const elapsedTime = Date.now() - status.serverStartedAt.getTime();
      if (elapsedTime > this.SLOW_STARTUP_THRESHOLD) {
        this.addAlert({
          type: 'SLOW_STARTUP',
          severity: 'MEDIUM',
          message: `Startup taking longer than expected: ${Math.round(elapsedTime / 1000)}s`,
          timestamp: new Date(),
          metrics: { elapsedTime, threshold: this.SLOW_STARTUP_THRESHOLD }
        });
      }
    }

    // Check for multiple retries
    if (symbolStats.stepMetrics && symbolStats.stepMetrics.totalRetries > this.MAX_ACCEPTABLE_RETRIES) {
      this.addAlert({
        type: 'MULTIPLE_RETRIES',
        severity: 'MEDIUM',
        message: `Multiple retries detected: ${symbolStats.stepMetrics.totalRetries} total retries`,
        timestamp: new Date(),
        metrics: { totalRetries: symbolStats.stepMetrics.totalRetries }
      });
    }

    logger.debug('Collected startup metrics', {
      component: 'STARTUP_MONITORING',
      operation: 'COLLECT_METRICS',
      memoryUsage: currentMemory.heapUsed,
      startupPhase: status.startupPhase,
      symbolProgress: status.symbolInitStatus?.progress || 0
    });
  }

  /**
   * Handle startup status updates
   */
  private handleStatusUpdate(status: any): void {
    const now = Date.now();

    // Calculate server startup time
    if (status.serverReady && status.serverStartedAt && !this.metrics.serverStartupTime) {
      this.metrics.serverStartupTime = status.serverStartedAt.getTime() - (process.uptime() * 1000 - now);
    }

    // Calculate symbol initialization time
    if (status.symbolDataReady && status.symbolInitStartedAt && status.symbolInitCompletedAt && !this.metrics.symbolInitTime) {
      this.metrics.symbolInitTime = status.symbolInitCompletedAt.getTime() - status.symbolInitStartedAt.getTime();
    }

    // Calculate total startup time
    if (status.serverReady && status.symbolDataReady && !this.metrics.totalStartupTime) {
      this.metrics.totalStartupTime = now - (process.uptime() * 1000 - now);
      this.stopMonitoring(); // Stop monitoring when fully ready
    }

    // Check for startup failure
    if (status.startupPhase === 'FAILED') {
      this.addAlert({
        type: 'STARTUP_FAILURE',
        severity: 'CRITICAL',
        message: `Startup failed: ${status.error || 'Unknown error'}`,
        timestamp: new Date(),
        metrics: { error: status.error, phase: status.startupPhase }
      });
      this.stopMonitoring();
    }
  }

  /**
   * Add an alert
   */
  private addAlert(alert: StartupAlert): void {
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }

    logger.warn('Startup alert generated', {
      component: 'STARTUP_MONITORING',
      operation: 'ADD_ALERT',
      alertType: alert.type,
      severity: alert.severity,
      message: alert.message
    });
  }

  /**
   * Calculate performance score based on metrics
   */
  private calculatePerformanceScore(): void {
    let score = 100;

    // Deduct points for slow startup
    if (this.metrics.totalStartupTime && this.metrics.totalStartupTime > this.SLOW_STARTUP_THRESHOLD) {
      score -= 20;
    }

    // Deduct points for high memory usage
    if (this.metrics.memoryUsageAtEnd && this.metrics.memoryUsageAtEnd.heapUsed > this.HIGH_MEMORY_THRESHOLD) {
      score -= 15;
    }

    // Deduct points for retries
    if (this.metrics.retryCount && this.metrics.retryCount > 0) {
      score -= Math.min(this.metrics.retryCount * 5, 25);
    }

    // Deduct points for errors
    if (this.metrics.errorCount && this.metrics.errorCount > 0) {
      score -= Math.min(this.metrics.errorCount * 10, 30);
    }

    this.metrics.performanceScore = Math.max(0, score);

    logger.info('Calculated startup performance score', {
      component: 'STARTUP_MONITORING',
      operation: 'CALCULATE_PERFORMANCE_SCORE',
      score: this.metrics.performanceScore,
      factors: {
        totalStartupTime: this.metrics.totalStartupTime,
        memoryUsage: this.metrics.memoryUsageAtEnd?.heapUsed,
        retryCount: this.metrics.retryCount,
        errorCount: this.metrics.errorCount
      }
    });
  }

  /**
   * Get current metrics
   */
  getMetrics(): StartupMetrics {
    return { ...this.metrics } as StartupMetrics;
  }

  /**
   * Get recent alerts
   */
  getAlerts(): StartupAlert[] {
    return [...this.alerts];
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): StartupAlert[] {
    return this.alerts.filter(alert => alert.severity === severity);
  }

  /**
   * Clear all alerts
   */
  clearAlerts(): void {
    this.alerts = [];
    logger.info('Cleared all startup alerts', {
      component: 'STARTUP_MONITORING',
      operation: 'CLEAR_ALERTS'
    });
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): any {
    return {
      isMonitoring: this.isMonitoring,
      metricsCollected: Object.keys(this.metrics).length,
      alertsGenerated: this.alerts.length,
      performanceScore: this.metrics.performanceScore,
      uptime: process.uptime()
    };
  }

  /**
   * Generate startup report
   */
  generateStartupReport(): any {
    const symbolStats = startupSymbolInitializationService.getInitializationStats();
    const status = startupStatusService.getStatus();

    return {
      summary: {
        status: status.startupPhase,
        performanceScore: this.metrics.performanceScore,
        totalStartupTime: this.metrics.totalStartupTime,
        symbolInitTime: this.metrics.symbolInitTime,
        serverStartupTime: this.metrics.serverStartupTime
      },
      metrics: this.metrics,
      symbolInitialization: symbolStats,
      alerts: this.alerts,
      recommendations: this.generateRecommendations()
    };
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.metrics.totalStartupTime && this.metrics.totalStartupTime > this.SLOW_STARTUP_THRESHOLD) {
      recommendations.push('Consider optimizing symbol data processing for faster startup times');
    }

    if (this.metrics.memoryUsageAtEnd && this.metrics.memoryUsageAtEnd.heapUsed > this.HIGH_MEMORY_THRESHOLD) {
      recommendations.push('Monitor memory usage during startup and consider implementing memory optimization');
    }

    if (this.metrics.retryCount && this.metrics.retryCount > this.MAX_ACCEPTABLE_RETRIES) {
      recommendations.push('Investigate causes of startup step failures to reduce retry attempts');
    }

    if (this.alerts.some(alert => alert.severity === 'CRITICAL')) {
      recommendations.push('Address critical startup issues to improve system reliability');
    }

    if (recommendations.length === 0) {
      recommendations.push('Startup performance is optimal - no recommendations at this time');
    }

    return recommendations;
  }
}

// Export singleton instance
export const startupMonitoringService = new StartupMonitoringService();