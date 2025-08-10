import { EventEmitter } from 'events';
import { ErrorLog } from '../models/errorLogModels';
import { logger } from '../utils/logger';
import { errorAggregationService } from './errorAggregationService';

export interface ErrorThreshold {
  id: string;
  name: string;
  description: string;
  condition: {
    metric: 'error_rate' | 'error_count' | 'critical_errors' | 'component_errors';
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
    value: number;
    timeWindow: number; // in milliseconds
    component?: string;
    errorType?: string;
    level?: string;
  };
  enabled: boolean;
  cooldownPeriod: number; // in milliseconds
  lastTriggered?: Date;
  actions: {
    notify: boolean;
    escalate: boolean;
    autoResolve: boolean;
  };
}

export interface ErrorSpike {
  id: string;
  timestamp: Date;
  errorCount: number;
  previousCount: number;
  increasePercentage: number;
  duration: number;
  affectedComponents: string[];
  primaryErrorTypes: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  resolved: boolean;
  resolvedAt?: Date;
}

export interface SystemHealthMetrics {
  timestamp: Date;
  overallHealthScore: number;
  errorRate: number;
  criticalErrorCount: number;
  componentHealth: Record<string, {
    healthScore: number;
    errorRate: number;
    availability: number;
    lastError?: Date;
  }>;
  trends: {
    errorRateTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
    healthScoreTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING';
  };
}

export interface MonitoringAlert {
  id: string;
  timestamp: Date;
  type: 'THRESHOLD_EXCEEDED' | 'ERROR_SPIKE' | 'SYSTEM_DEGRADATION' | 'COMPONENT_FAILURE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  affectedComponents: string[];
  metrics: {
    currentValue: number;
    thresholdValue?: number;
    previousValue?: number;
  };
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  actions: string[];
}

export class RealTimeErrorMonitoringService extends EventEmitter {
  private static instance: RealTimeErrorMonitoringService;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private thresholds: Map<string, ErrorThreshold> = new Map();
  private activeSpikes: Map<string, ErrorSpike> = new Map();
  private healthHistory: SystemHealthMetrics[] = [];
  private activeAlerts: Map<string, MonitoringAlert> = new Map();
  private isMonitoring = false;

  private constructor() {
    super();
    this.initializeDefaultThresholds();
  }

  public static getInstance(): RealTimeErrorMonitoringService {
    if (!RealTimeErrorMonitoringService.instance) {
      RealTimeErrorMonitoringService.instance = new RealTimeErrorMonitoringService();
    }
    return RealTimeErrorMonitoringService.instance;
  }

  /**
   * Start real-time monitoring
   */
  public startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) {
      logger.warn('Real-time error monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performMonitoringCycle();
      } catch (error) {
        logger.error('Error in monitoring cycle:', error);
      }
    }, intervalMs);

    logger.info('Real-time error monitoring started', {
      component: 'REAL_TIME_ERROR_MONITORING',
      intervalMs
    });

    this.emit('monitoring_started', { intervalMs });
  }

  /**
   * Stop real-time monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    logger.info('Real-time error monitoring stopped');
    this.emit('monitoring_stopped');
  }

  /**
   * Add or update error threshold
   */
  public setThreshold(threshold: ErrorThreshold): void {
    this.thresholds.set(threshold.id, threshold);
    logger.info('Error threshold updated', {
      component: 'REAL_TIME_ERROR_MONITORING',
      thresholdId: threshold.id,
      thresholdName: threshold.name
    });

    this.emit('threshold_updated', threshold);
  }

  /**
   * Remove error threshold
   */
  public removeThreshold(thresholdId: string): boolean {
    const removed = this.thresholds.delete(thresholdId);
    if (removed) {
      logger.info('Error threshold removed', {
        component: 'REAL_TIME_ERROR_MONITORING',
        thresholdId
      });
      this.emit('threshold_removed', { thresholdId });
    }
    return removed;
  }

  /**
   * Get all configured thresholds
   */
  public getThresholds(): ErrorThreshold[] {
    return Array.from(this.thresholds.values());
  }

  /**
   * Get current system health metrics
   */
  public async getCurrentSystemHealth(): Promise<SystemHealthMetrics> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      // Get error analytics for the last hour
      const analytics = await errorAggregationService.aggregateErrors({
        timeRange: {
          start: oneHourAgo,
          end: now,
          granularity: 'hour'
        }
      });

      const impact = await errorAggregationService.analyzeErrorImpact({
        start: oneHourAgo,
        end: now
      });

      // Calculate component health
      const componentHealth: Record<string, any> = {};
      Object.entries(analytics.errorsByComponent).forEach(([component, errorCount]) => {
        const errorRate = (errorCount as number) / 60; // Errors per minute
        const healthScore = Math.max(0, 100 - (errorRate * 10));
        const availability = Math.max(0, 100 - (errorRate * 5));

        componentHealth[component] = {
          healthScore: Math.round(healthScore),
          errorRate: Math.round(errorRate * 100) / 100,
          availability: Math.round(availability),
          lastError: now // This would be calculated from actual data
        };
      });

      // Calculate trends
      const previousHealth = this.healthHistory.length > 0 
        ? this.healthHistory[this.healthHistory.length - 1] 
        : null;

      let errorRateTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING' = 'STABLE';
      let healthScoreTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING' = 'STABLE';

      if (previousHealth) {
        const errorRateChange = analytics.totalErrors - previousHealth.criticalErrorCount;
        const healthScoreChange = impact.systemHealthScore - previousHealth.overallHealthScore;

        if (errorRateChange > 5) errorRateTrend = 'DEGRADING';
        else if (errorRateChange < -5) errorRateTrend = 'IMPROVING';

        if (healthScoreChange > 5) healthScoreTrend = 'IMPROVING';
        else if (healthScoreChange < -5) healthScoreTrend = 'DEGRADING';
      }

      const healthMetrics: SystemHealthMetrics = {
        timestamp: now,
        overallHealthScore: impact.systemHealthScore,
        errorRate: analytics.totalErrors / 60, // Errors per minute
        criticalErrorCount: impact.criticalErrorsCount,
        componentHealth,
        trends: {
          errorRateTrend,
          healthScoreTrend
        }
      };

      // Store in history (keep last 24 hours)
      this.healthHistory.push(healthMetrics);
      if (this.healthHistory.length > 24 * 60) { // 24 hours of minute-by-minute data
        this.healthHistory.shift();
      }

      return healthMetrics;
    } catch (error) {
      logger.error('Error calculating system health metrics:', error);
      throw error;
    }
  }

  /**
   * Detect error spikes
   */
  public async detectErrorSpikes(): Promise<ErrorSpike[]> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    try {
      // Get error counts for current and previous 5-minute windows
      const [currentPeriod, previousPeriod] = await Promise.all([
        errorAggregationService.aggregateErrors({
          timeRange: {
            start: fiveMinutesAgo,
            end: now,
            granularity: 'hour'
          }
        }),
        errorAggregationService.aggregateErrors({
          timeRange: {
            start: tenMinutesAgo,
            end: fiveMinutesAgo,
            granularity: 'hour'
          }
        })
      ]);

      const currentCount = currentPeriod.totalErrors;
      const previousCount = previousPeriod.totalErrors;

      // Calculate spike threshold (200% increase or 50+ errors)
      const increasePercentage = previousCount > 0 
        ? ((currentCount - previousCount) / previousCount) * 100 
        : currentCount > 0 ? 100 : 0;

      const isSpike = increasePercentage >= 200 || (currentCount >= 50 && currentCount > previousCount * 2);

      if (isSpike) {
        const spikeId = `spike_${now.getTime()}`;
        
        // Determine severity
        let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
        if (currentCount >= 100 || increasePercentage >= 500) severity = 'CRITICAL';
        else if (currentCount >= 50 || increasePercentage >= 400) severity = 'HIGH';
        else if (currentCount >= 25 || increasePercentage >= 300) severity = 'MEDIUM';

        const spike: ErrorSpike = {
          id: spikeId,
          timestamp: now,
          errorCount: currentCount,
          previousCount,
          increasePercentage: Math.round(increasePercentage),
          duration: 5 * 60 * 1000, // 5 minutes
          affectedComponents: Object.keys(currentPeriod.errorsByComponent),
          primaryErrorTypes: Object.keys(currentPeriod.errorsByType).slice(0, 5),
          severity,
          resolved: false
        };

        this.activeSpikes.set(spikeId, spike);

        logger.warn('Error spike detected', {
          component: 'REAL_TIME_ERROR_MONITORING',
          spikeId,
          currentCount,
          previousCount,
          increasePercentage,
          severity
        });

        this.emit('error_spike_detected', spike);
        return [spike];
      }

      return [];
    } catch (error) {
      logger.error('Error detecting error spikes:', error);
      return [];
    }
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();

      logger.info('Alert acknowledged', {
        component: 'REAL_TIME_ERROR_MONITORING',
        alertId,
        acknowledgedBy
      });

      this.emit('alert_acknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Resolve alert
   */
  public resolveAlert(alertId: string, resolvedBy: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedBy = resolvedBy;
      alert.resolvedAt = new Date();

      logger.info('Alert resolved', {
        component: 'REAL_TIME_ERROR_MONITORING',
        alertId,
        resolvedBy
      });

      this.emit('alert_resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Get monitoring statistics
   */
  public getMonitoringStats(): {
    isMonitoring: boolean;
    activeThresholds: number;
    activeSpikes: number;
    activeAlerts: number;
    healthHistorySize: number;
    uptime: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      activeThresholds: this.thresholds.size,
      activeSpikes: this.activeSpikes.size,
      activeAlerts: Array.from(this.activeAlerts.values()).filter(a => !a.resolved).length,
      healthHistorySize: this.healthHistory.length,
      uptime: process.uptime()
    };
  }

  // Private methods

  private async performMonitoringCycle(): Promise<void> {
    try {
      // Get current system health
      const healthMetrics = await this.getCurrentSystemHealth();

      // Check thresholds
      await this.checkThresholds(healthMetrics);

      // Detect error spikes
      await this.detectErrorSpikes();

      // Clean up old spikes and alerts
      this.cleanupOldData();

      this.emit('monitoring_cycle_completed', {
        timestamp: new Date(),
        healthScore: healthMetrics.overallHealthScore,
        errorRate: healthMetrics.errorRate,
        activeAlerts: this.getActiveAlerts().length
      });
    } catch (error) {
      logger.error('Error in monitoring cycle:', error);
      this.emit('monitoring_cycle_error', error);
    }
  }

  private async checkThresholds(healthMetrics: SystemHealthMetrics): Promise<void> {
    for (const threshold of this.thresholds.values()) {
      if (!threshold.enabled) continue;

      // Check cooldown period
      if (threshold.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - threshold.lastTriggered.getTime();
        if (timeSinceLastTrigger < threshold.cooldownPeriod) {
          continue;
        }
      }

      const isTriggered = await this.evaluateThreshold(threshold, healthMetrics);
      
      if (isTriggered) {
        threshold.lastTriggered = new Date();
        await this.handleThresholdTrigger(threshold, healthMetrics);
      }
    }
  }

  private async evaluateThreshold(threshold: ErrorThreshold, healthMetrics: SystemHealthMetrics): Promise<boolean> {
    const { condition } = threshold;
    let currentValue: number;

    // Get the metric value based on condition
    switch (condition.metric) {
      case 'error_rate':
        currentValue = healthMetrics.errorRate;
        break;
      case 'error_count':
        currentValue = healthMetrics.criticalErrorCount;
        break;
      case 'critical_errors':
        currentValue = healthMetrics.criticalErrorCount;
        break;
      case 'component_errors':
        if (condition.component && healthMetrics.componentHealth[condition.component]) {
          currentValue = healthMetrics.componentHealth[condition.component]?.errorRate || 0;
        } else {
          return false;
        }
        break;
      default:
        return false;
    }

    // Evaluate condition
    switch (condition.operator) {
      case 'gt': return currentValue > condition.value;
      case 'gte': return currentValue >= condition.value;
      case 'lt': return currentValue < condition.value;
      case 'lte': return currentValue <= condition.value;
      case 'eq': return currentValue === condition.value;
      default: return false;
    }
  }

  private async handleThresholdTrigger(threshold: ErrorThreshold, healthMetrics: SystemHealthMetrics): Promise<void> {
    const alertId = `threshold_${threshold.id}_${Date.now()}`;
    
    const alert: MonitoringAlert = {
      id: alertId,
      timestamp: new Date(),
      type: 'THRESHOLD_EXCEEDED',
      severity: this.determineSeverityFromThreshold(threshold),
      title: `Threshold Exceeded: ${threshold.name}`,
      description: threshold.description,
      affectedComponents: threshold.condition.component ? [threshold.condition.component] : [],
      metrics: {
        currentValue: this.getCurrentMetricValue(threshold, healthMetrics),
        thresholdValue: threshold.condition.value
      },
      acknowledged: false,
      resolved: false,
      actions: this.generateRecommendedActions(threshold)
    };

    this.activeAlerts.set(alertId, alert);

    logger.warn('Threshold exceeded', {
      component: 'REAL_TIME_ERROR_MONITORING',
      thresholdId: threshold.id,
      thresholdName: threshold.name,
      alertId
    });

    this.emit('threshold_exceeded', { threshold, alert, healthMetrics });
  }

  private getCurrentMetricValue(threshold: ErrorThreshold, healthMetrics: SystemHealthMetrics): number {
    switch (threshold.condition.metric) {
      case 'error_rate': return healthMetrics.errorRate;
      case 'error_count': return healthMetrics.criticalErrorCount;
      case 'critical_errors': return healthMetrics.criticalErrorCount;
      case 'component_errors':
        if (threshold.condition.component && healthMetrics.componentHealth[threshold.condition.component]) {
          return healthMetrics.componentHealth[threshold.condition.component]?.errorRate || 0;
        }
        return 0;
      default: return 0;
    }
  }

  private determineSeverityFromThreshold(threshold: ErrorThreshold): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (threshold.condition.metric === 'critical_errors' && threshold.condition.value >= 10) {
      return 'CRITICAL';
    }
    if (threshold.condition.metric === 'error_rate' && threshold.condition.value >= 10) {
      return 'HIGH';
    }
    if (threshold.condition.value >= 50) {
      return 'HIGH';
    }
    if (threshold.condition.value >= 20) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private generateRecommendedActions(threshold: ErrorThreshold): string[] {
    const actions = [];
    
    if (threshold.condition.metric === 'error_rate') {
      actions.push('Review recent error logs for patterns');
      actions.push('Check system resource utilization');
      actions.push('Verify external service connectivity');
    }
    
    if (threshold.condition.metric === 'critical_errors') {
      actions.push('Immediate investigation required');
      actions.push('Check system stability');
      actions.push('Consider emergency maintenance');
    }
    
    if (threshold.condition.component) {
      actions.push(`Focus investigation on ${threshold.condition.component} component`);
      actions.push('Review component-specific logs');
    }
    
    actions.push('Monitor system health dashboard');
    actions.push('Escalate to development team if needed');
    
    return actions;
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Clean up old spikes (older than 1 hour)
    for (const [spikeId, spike] of this.activeSpikes.entries()) {
      if (spike.timestamp.getTime() < oneHourAgo) {
        this.activeSpikes.delete(spikeId);
      }
    }

    // Clean up old resolved alerts (older than 24 hours)
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt.getTime() < oneDayAgo) {
        this.activeAlerts.delete(alertId);
      }
    }
  }

  private initializeDefaultThresholds(): void {
    const defaultThresholds: ErrorThreshold[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'Error rate exceeds 10 errors per minute',
        condition: {
          metric: 'error_rate',
          operator: 'gt',
          value: 10,
          timeWindow: 5 * 60 * 1000 // 5 minutes
        },
        enabled: true,
        cooldownPeriod: 15 * 60 * 1000, // 15 minutes
        actions: {
          notify: true,
          escalate: false,
          autoResolve: false
        }
      },
      {
        id: 'critical_errors',
        name: 'Critical Errors',
        description: 'Critical error count exceeds threshold',
        condition: {
          metric: 'critical_errors',
          operator: 'gte',
          value: 5,
          timeWindow: 10 * 60 * 1000 // 10 minutes
        },
        enabled: true,
        cooldownPeriod: 10 * 60 * 1000, // 10 minutes
        actions: {
          notify: true,
          escalate: true,
          autoResolve: false
        }
      },
      {
        id: 'broker_component_errors',
        name: 'Broker Component High Error Rate',
        description: 'Broker component experiencing high error rate',
        condition: {
          metric: 'component_errors',
          operator: 'gt',
          value: 5,
          timeWindow: 5 * 60 * 1000, // 5 minutes
          component: 'BROKER_CONTROLLER'
        },
        enabled: true,
        cooldownPeriod: 20 * 60 * 1000, // 20 minutes
        actions: {
          notify: true,
          escalate: true,
          autoResolve: false
        }
      }
    ];

    defaultThresholds.forEach(threshold => {
      this.thresholds.set(threshold.id, threshold);
    });
  }
}

export const realTimeErrorMonitoringService = RealTimeErrorMonitoringService.getInstance();