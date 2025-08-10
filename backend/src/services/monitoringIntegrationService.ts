import { realTimeErrorMonitoringService } from './realTimeErrorMonitoringService';
import { alertingService } from './alertingService';
import { errorLoggingService } from './errorLoggingService';
import { logger } from '../utils/logger';

export class MonitoringIntegrationService {
  private static instance: MonitoringIntegrationService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): MonitoringIntegrationService {
    if (!MonitoringIntegrationService.instance) {
      MonitoringIntegrationService.instance = new MonitoringIntegrationService();
    }
    return MonitoringIntegrationService.instance;
  }

  /**
   * Initialize monitoring integration
   */
  public initialize(): void {
    if (this.isInitialized) {
      logger.warn('Monitoring integration already initialized');
      return;
    }

    this.setupEventListeners();
    this.startMonitoring();
    this.isInitialized = true;

    logger.info('Monitoring integration initialized successfully', {
      component: 'MONITORING_INTEGRATION_SERVICE'
    });
  }

  /**
   * Shutdown monitoring integration
   */
  public shutdown(): void {
    if (!this.isInitialized) {
      return;
    }

    realTimeErrorMonitoringService.stopMonitoring();
    this.removeEventListeners();
    this.isInitialized = false;

    logger.info('Monitoring integration shut down', {
      component: 'MONITORING_INTEGRATION_SERVICE'
    });
  }

  private setupEventListeners(): void {
    // Listen for monitoring events
    realTimeErrorMonitoringService.on('monitoring_started', (data) => {
      logger.info('Real-time monitoring started', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        intervalMs: data.intervalMs
      });
    });

    realTimeErrorMonitoringService.on('monitoring_stopped', () => {
      logger.info('Real-time monitoring stopped', {
        component: 'MONITORING_INTEGRATION_SERVICE'
      });
    });

    realTimeErrorMonitoringService.on('monitoring_cycle_completed', (data) => {
      logger.debug('Monitoring cycle completed', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        timestamp: data.timestamp,
        healthScore: data.healthScore,
        errorRate: data.errorRate,
        activeAlerts: data.activeAlerts
      });
    });

    realTimeErrorMonitoringService.on('monitoring_cycle_error', (error) => {
      logger.error('Monitoring cycle error', {
        component: 'MONITORING_INTEGRATION_SERVICE'
      }, error);
    });

    // Listen for threshold events
    realTimeErrorMonitoringService.on('threshold_exceeded', async (data) => {
      const { threshold, alert, healthMetrics } = data;
      
      logger.warn('Threshold exceeded', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        thresholdId: threshold.id,
        thresholdName: threshold.name,
        alertId: alert.id,
        currentValue: alert.metrics.currentValue,
        thresholdValue: alert.metrics.thresholdValue
      });

      // Send alert through alerting service
      try {
        const deliveryResults = await alertingService.sendAlert(alert);
        logger.info('Threshold alert sent', {
          component: 'MONITORING_INTEGRATION_SERVICE',
          alertId: alert.id,
          deliveryResults: deliveryResults.map(r => ({
            channel: r.channelName,
            success: r.success
          }))
        });
      } catch (error) {
        logger.error('Failed to send threshold alert', {
          component: 'MONITORING_INTEGRATION_SERVICE',
          alertId: alert.id
        }, error);
      }
    });

    // Listen for error spike events
    realTimeErrorMonitoringService.on('error_spike_detected', async (spike) => {
      logger.warn('Error spike detected', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        spikeId: spike.id,
        errorCount: spike.errorCount,
        previousCount: spike.previousCount,
        increasePercentage: spike.increasePercentage,
        severity: spike.severity
      });

      // Send spike alert through alerting service
      try {
        const deliveryResults = await alertingService.sendErrorSpikeAlert(spike);
        logger.info('Error spike alert sent', {
          component: 'MONITORING_INTEGRATION_SERVICE',
          spikeId: spike.id,
          deliveryResults: deliveryResults.map(r => ({
            channel: r.channelName,
            success: r.success
          }))
        });
      } catch (error) {
        logger.error('Failed to send error spike alert', {
          component: 'MONITORING_INTEGRATION_SERVICE',
          spikeId: spike.id
        }, error);
      }
    });

    // Listen for alert events
    realTimeErrorMonitoringService.on('alert_acknowledged', (alert) => {
      logger.info('Alert acknowledged', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        alertId: alert.id,
        acknowledgedBy: alert.acknowledgedBy,
        acknowledgedAt: alert.acknowledgedAt
      });
    });

    realTimeErrorMonitoringService.on('alert_resolved', (alert) => {
      logger.info('Alert resolved', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        alertId: alert.id,
        resolvedBy: alert.resolvedBy,
        resolvedAt: alert.resolvedAt
      });
    });

    // Listen for alerting service events
    alertingService.on('alert_sent', (data) => {
      const { alert, results } = data;
      const successCount = results.filter((r: any) => r.success).length;
      const totalCount = results.length;

      logger.info('Alert delivery completed', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        alertId: alert.id,
        successCount,
        totalCount,
        deliveryRate: totalCount > 0 ? (successCount / totalCount) * 100 : 0
      });
    });

    alertingService.on('alert_send_error', (data) => {
      const { alert, error } = data;
      logger.error('Alert delivery failed', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        alertId: alert.id
      }, error);
    });

    // Listen for configuration changes
    realTimeErrorMonitoringService.on('threshold_updated', (threshold) => {
      logger.info('Threshold configuration updated', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        thresholdId: threshold.id,
        thresholdName: threshold.name,
        enabled: threshold.enabled
      });
    });

    realTimeErrorMonitoringService.on('threshold_removed', (data) => {
      logger.info('Threshold removed', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        thresholdId: data.thresholdId
      });
    });

    alertingService.on('channel_updated', (channel) => {
      logger.info('Alert channel updated', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        channelId: channel.id,
        channelName: channel.name,
        channelType: channel.type,
        enabled: channel.enabled
      });
    });

    alertingService.on('rule_updated', (rule) => {
      logger.info('Alert rule updated', {
        component: 'MONITORING_INTEGRATION_SERVICE',
        ruleId: rule.id,
        ruleName: rule.name,
        enabled: rule.enabled,
        channelCount: rule.channels.length
      });
    });
  }

  private removeEventListeners(): void {
    realTimeErrorMonitoringService.removeAllListeners();
    alertingService.removeAllListeners();
  }

  private startMonitoring(): void {
    // Start monitoring with 1-minute intervals
    const intervalMs = parseInt(process.env.MONITORING_INTERVAL_MS || '60000');
    realTimeErrorMonitoringService.startMonitoring(intervalMs);

    logger.info('Real-time monitoring started automatically', {
      component: 'MONITORING_INTEGRATION_SERVICE',
      intervalMs
    });
  }

  /**
   * Get integration status
   */
  public getStatus(): {
    initialized: boolean;
    monitoringActive: boolean;
    stats: any;
  } {
    return {
      initialized: this.isInitialized,
      monitoringActive: realTimeErrorMonitoringService.getMonitoringStats().isMonitoring,
      stats: realTimeErrorMonitoringService.getMonitoringStats()
    };
  }

  /**
   * Perform health check on monitoring system
   */
  public async performHealthCheck(): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    checks: Array<{
      name: string;
      status: 'PASS' | 'FAIL';
      message?: string | undefined;
      duration?: number | undefined;
    }>;
  }> {
    const checks = [];
    let overallStatus: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';

    // Check if monitoring is initialized
    const startTime = Date.now();
    checks.push({
      name: 'Monitoring Initialization',
      status: this.isInitialized ? 'PASS' as const : 'FAIL' as const,
      message: this.isInitialized ? 'Monitoring is initialized' : 'Monitoring not initialized',
      duration: Date.now() - startTime
    });

    if (!this.isInitialized) {
      overallStatus = 'UNHEALTHY';
    }

    // Check if real-time monitoring is active
    const monitoringStartTime = Date.now();
    const monitoringStats = realTimeErrorMonitoringService.getMonitoringStats();
    checks.push({
      name: 'Real-time Monitoring',
      status: monitoringStats.isMonitoring ? 'PASS' as const : 'FAIL' as const,
      message: monitoringStats.isMonitoring ? 'Real-time monitoring is active' : 'Real-time monitoring is not active',
      duration: Date.now() - monitoringStartTime
    });

    if (!monitoringStats.isMonitoring && overallStatus === 'HEALTHY') {
      overallStatus = 'DEGRADED';
    }

    // Check system health
    try {
      const healthStartTime = Date.now();
      const systemHealth = await realTimeErrorMonitoringService.getCurrentSystemHealth();
      const healthDuration = Date.now() - healthStartTime;

      if (systemHealth.overallHealthScore >= 80) {
        checks.push({
          name: 'System Health',
          status: 'PASS' as const,
          message: `System health score: ${systemHealth.overallHealthScore}%`,
          duration: healthDuration
        });
      } else if (systemHealth.overallHealthScore >= 50) {
        checks.push({
          name: 'System Health',
          status: 'PASS' as const,
          message: `System health score: ${systemHealth.overallHealthScore}% (degraded)`,
          duration: healthDuration
        });
        if (overallStatus === 'HEALTHY') {
          overallStatus = 'DEGRADED';
        }
      } else {
        checks.push({
          name: 'System Health',
          status: 'FAIL' as const,
          message: `System health score: ${systemHealth.overallHealthScore}% (critical)`,
          duration: healthDuration
        });
        overallStatus = 'UNHEALTHY';
      }
    } catch (error) {
      checks.push({
        name: 'System Health',
        status: 'FAIL' as const,
        message: `Failed to get system health: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: 0
      });
      overallStatus = 'UNHEALTHY';
    }

    // Check alert channels
    const channelStartTime = Date.now();
    const channels = alertingService.getChannels();
    const enabledChannels = channels.filter(c => c.enabled);
    checks.push({
      name: 'Alert Channels',
      status: enabledChannels.length > 0 ? 'PASS' as const : 'FAIL' as const,
      message: `${enabledChannels.length} of ${channels.length} channels enabled`,
      duration: Date.now() - channelStartTime
    });

    if (enabledChannels.length === 0 && overallStatus === 'HEALTHY') {
      overallStatus = 'DEGRADED';
    }

    return {
      status: overallStatus,
      checks
    };
  }
}

export const monitoringIntegrationService = MonitoringIntegrationService.getInstance();