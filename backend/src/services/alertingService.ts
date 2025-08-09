import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { MonitoringAlert, ErrorSpike, SystemHealthMetrics } from './realTimeErrorMonitoringService';

export interface AlertChannel {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'slack' | 'console' | 'database';
  enabled: boolean;
  config: {
    // Email config
    recipients?: string[];
    smtpConfig?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
    
    // Webhook config
    url?: string;
    headers?: Record<string, string>;
    method?: 'POST' | 'PUT';
    
    // Slack config
    webhookUrl?: string;
    channel?: string;
    username?: string;
    
    // Database config
    collection?: string;
  };
  filters?: {
    severity?: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
    alertTypes?: string[];
    components?: string[];
  };
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    severity?: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
    alertTypes?: string[];
    components?: string[];
    timeWindow?: number; // in milliseconds
    frequency?: number; // max alerts per time window
  };
  channels: string[]; // Channel IDs
  escalation?: {
    enabled: boolean;
    delayMinutes: number;
    escalationChannels: string[];
  };
}

export interface AlertDeliveryResult {
  channelId: string;
  channelName: string;
  success: boolean;
  error?: string;
  deliveredAt: Date;
  responseTime: number;
}

export interface AlertHistory {
  id: string;
  alertId: string;
  timestamp: Date;
  action: 'SENT' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED';
  channelId?: string | undefined;
  userId?: string | undefined;
  details?: any;
}

export class AlertingService extends EventEmitter {
  private static instance: AlertingService;
  private channels: Map<string, AlertChannel> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private alertHistory: Map<string, AlertHistory[]> = new Map();
  private rateLimitTracker: Map<string, { count: number; windowStart: number }> = new Map();

  private constructor() {
    super();
    this.initializeDefaultChannels();
    this.initializeDefaultRules();
  }

  public static getInstance(): AlertingService {
    if (!AlertingService.instance) {
      AlertingService.instance = new AlertingService();
    }
    return AlertingService.instance;
  }

  /**
   * Send alert through configured channels
   */
  public async sendAlert(alert: MonitoringAlert): Promise<AlertDeliveryResult[]> {
    const results: AlertDeliveryResult[] = [];
    
    try {
      // Find applicable rules
      const applicableRules = this.findApplicableRules(alert);
      
      if (applicableRules.length === 0) {
        logger.info('No applicable alert rules found for alert', {
          component: 'ALERTING_SERVICE',
          alertId: alert.id,
          alertType: alert.type,
          severity: alert.severity
        });
        return results;
      }

      // Get all channels from applicable rules
      const channelIds = new Set<string>();
      applicableRules.forEach(rule => {
        rule.channels.forEach(channelId => channelIds.add(channelId));
      });

      // Send alert to each channel
      for (const channelId of channelIds) {
        const channel = this.channels.get(channelId);
        if (!channel || !channel.enabled) {
          continue;
        }

        // Check rate limiting
        if (!this.checkRateLimit(channelId, alert)) {
          logger.warn('Alert rate limit exceeded for channel', {
            component: 'ALERTING_SERVICE',
            channelId,
            alertId: alert.id
          });
          continue;
        }

        // Check channel filters
        if (!this.passesChannelFilters(channel, alert)) {
          continue;
        }

        const startTime = Date.now();
        try {
          await this.deliverToChannel(channel, alert);
          const responseTime = Date.now() - startTime;

          const result: AlertDeliveryResult = {
            channelId: channel.id,
            channelName: channel.name,
            success: true,
            deliveredAt: new Date(),
            responseTime
          };

          results.push(result);
          this.recordAlertHistory(alert.id, 'SENT', channel.id);

          logger.info('Alert delivered successfully', {
            component: 'ALERTING_SERVICE',
            alertId: alert.id,
            channelId: channel.id,
            channelType: channel.type,
            responseTime
          });
        } catch (error) {
          const responseTime = Date.now() - startTime;
          const result: AlertDeliveryResult = {
            channelId: channel.id,
            channelName: channel.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            deliveredAt: new Date(),
            responseTime
          };

          results.push(result);

          logger.error('Failed to deliver alert to channel', {
            component: 'ALERTING_SERVICE',
            alertId: alert.id,
            channelId: channel.id,
            channelType: channel.type,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Schedule escalation if configured
      this.scheduleEscalation(alert, applicableRules);

      this.emit('alert_sent', { alert, results });
      return results;
    } catch (error) {
      logger.error('Error sending alert:', error);
      this.emit('alert_send_error', { alert, error });
      return results;
    }
  }

  /**
   * Send error spike notification
   */
  public async sendErrorSpikeAlert(spike: ErrorSpike): Promise<AlertDeliveryResult[]> {
    const alert: MonitoringAlert = {
      id: `spike_alert_${spike.id}`,
      timestamp: spike.timestamp,
      type: 'ERROR_SPIKE',
      severity: spike.severity,
      title: `Error Spike Detected`,
      description: `Error count increased by ${spike.increasePercentage}% (${spike.previousCount} → ${spike.errorCount})`,
      affectedComponents: spike.affectedComponents,
      metrics: {
        currentValue: spike.errorCount,
        previousValue: spike.previousCount
      },
      acknowledged: false,
      resolved: false,
      actions: [
        'Investigate recent changes',
        'Check system resources',
        'Review error logs',
        'Monitor system stability'
      ]
    };

    return this.sendAlert(alert);
  }

  /**
   * Send system health degradation alert
   */
  public async sendSystemHealthAlert(healthMetrics: SystemHealthMetrics): Promise<AlertDeliveryResult[]> {
    if (healthMetrics.overallHealthScore >= 80) {
      return []; // No alert needed for healthy systems
    }

    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (healthMetrics.overallHealthScore < 30) severity = 'CRITICAL';
    else if (healthMetrics.overallHealthScore < 50) severity = 'HIGH';
    else if (healthMetrics.overallHealthScore < 70) severity = 'MEDIUM';

    const alert: MonitoringAlert = {
      id: `health_alert_${Date.now()}`,
      timestamp: healthMetrics.timestamp,
      type: 'SYSTEM_DEGRADATION',
      severity,
      title: `System Health Degradation`,
      description: `System health score dropped to ${healthMetrics.overallHealthScore}%`,
      affectedComponents: Object.keys(healthMetrics.componentHealth),
      metrics: {
        currentValue: healthMetrics.overallHealthScore
      },
      acknowledged: false,
      resolved: false,
      actions: [
        'Check system resources',
        'Review component health',
        'Investigate error patterns',
        'Consider scaling if needed'
      ]
    };

    return this.sendAlert(alert);
  }

  /**
   * Add or update alert channel
   */
  public setChannel(channel: AlertChannel): void {
    this.channels.set(channel.id, channel);
    logger.info('Alert channel updated', {
      component: 'ALERTING_SERVICE',
      channelId: channel.id,
      channelType: channel.type
    });
    this.emit('channel_updated', channel);
  }

  /**
   * Remove alert channel
   */
  public removeChannel(channelId: string): boolean {
    const removed = this.channels.delete(channelId);
    if (removed) {
      logger.info('Alert channel removed', {
        component: 'ALERTING_SERVICE',
        channelId
      });
      this.emit('channel_removed', { channelId });
    }
    return removed;
  }

  /**
   * Add or update alert rule
   */
  public setRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Alert rule updated', {
      component: 'ALERTING_SERVICE',
      ruleId: rule.id,
      ruleName: rule.name
    });
    this.emit('rule_updated', rule);
  }

  /**
   * Remove alert rule
   */
  public removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info('Alert rule removed', {
        component: 'ALERTING_SERVICE',
        ruleId
      });
      this.emit('rule_removed', { ruleId });
    }
    return removed;
  }

  /**
   * Get all channels
   */
  public getChannels(): AlertChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get all rules
   */
  public getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get alert history for a specific alert
   */
  public getAlertHistory(alertId: string): AlertHistory[] {
    return this.alertHistory.get(alertId) || [];
  }

  /**
   * Test alert channel
   */
  public async testChannel(channelId: string): Promise<AlertDeliveryResult> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    const testAlert: MonitoringAlert = {
      id: `test_${Date.now()}`,
      timestamp: new Date(),
      type: 'THRESHOLD_EXCEEDED',
      severity: 'LOW',
      title: 'Test Alert',
      description: 'This is a test alert to verify channel configuration',
      affectedComponents: ['TEST_COMPONENT'],
      metrics: {
        currentValue: 1
      },
      acknowledged: false,
      resolved: false,
      actions: ['This is a test - no action required']
    };

    const startTime = Date.now();
    try {
      await this.deliverToChannel(channel, testAlert);
      const responseTime = Date.now() - startTime;

      return {
        channelId: channel.id,
        channelName: channel.name,
        success: true,
        deliveredAt: new Date(),
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        channelId: channel.id,
        channelName: channel.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        deliveredAt: new Date(),
        responseTime
      };
    }
  }

  // Private methods

  private findApplicableRules(alert: MonitoringAlert): AlertRule[] {
    return Array.from(this.rules.values()).filter(rule => {
      if (!rule.enabled) return false;

      const { conditions } = rule;

      // Check severity filter
      if (conditions.severity && !conditions.severity.includes(alert.severity)) {
        return false;
      }

      // Check alert type filter
      if (conditions.alertTypes && !conditions.alertTypes.includes(alert.type)) {
        return false;
      }

      // Check component filter
      if (conditions.components && conditions.components.length > 0) {
        const hasMatchingComponent = alert.affectedComponents.some(component =>
          conditions.components!.includes(component)
        );
        if (!hasMatchingComponent) return false;
      }

      // Check frequency limit
      if (conditions.frequency && conditions.timeWindow) {
        const ruleKey = `rule_${rule.id}`;
        const tracker = this.rateLimitTracker.get(ruleKey);
        const now = Date.now();

        if (tracker) {
          if (now - tracker.windowStart < conditions.timeWindow) {
            if (tracker.count >= conditions.frequency) {
              return false; // Rate limit exceeded
            }
          } else {
            // Reset window
            this.rateLimitTracker.set(ruleKey, { count: 1, windowStart: now });
          }
        } else {
          this.rateLimitTracker.set(ruleKey, { count: 1, windowStart: now });
        }
      }

      return true;
    });
  }

  private passesChannelFilters(channel: AlertChannel, alert: MonitoringAlert): boolean {
    if (!channel.filters) return true;

    const { filters } = channel;

    // Check severity filter
    if (filters.severity && !filters.severity.includes(alert.severity)) {
      return false;
    }

    // Check alert type filter
    if (filters.alertTypes && !filters.alertTypes.includes(alert.type)) {
      return false;
    }

    // Check component filter
    if (filters.components && filters.components.length > 0) {
      const hasMatchingComponent = alert.affectedComponents.some(component =>
        filters.components!.includes(component)
      );
      if (!hasMatchingComponent) return false;
    }

    return true;
  }

  private checkRateLimit(channelId: string, alert: MonitoringAlert): boolean {
    // Simple rate limiting: max 10 alerts per 5 minutes per channel
    const key = `channel_${channelId}`;
    const tracker = this.rateLimitTracker.get(key);
    const now = Date.now();
    const windowSize = 5 * 60 * 1000; // 5 minutes
    const maxAlerts = 10;

    if (tracker) {
      if (now - tracker.windowStart < windowSize) {
        if (tracker.count >= maxAlerts) {
          return false; // Rate limit exceeded
        }
        tracker.count++;
      } else {
        // Reset window
        this.rateLimitTracker.set(key, { count: 1, windowStart: now });
      }
    } else {
      this.rateLimitTracker.set(key, { count: 1, windowStart: now });
    }

    return true;
  }

  private async deliverToChannel(channel: AlertChannel, alert: MonitoringAlert): Promise<void> {
    switch (channel.type) {
      case 'console':
        await this.deliverToConsole(channel, alert);
        break;
      case 'database':
        await this.deliverToDatabase(channel, alert);
        break;
      case 'webhook':
        await this.deliverToWebhook(channel, alert);
        break;
      case 'email':
        await this.deliverToEmail(channel, alert);
        break;
      case 'slack':
        await this.deliverToSlack(channel, alert);
        break;
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }
  }

  private async deliverToConsole(channel: AlertChannel, alert: MonitoringAlert): Promise<void> {
    const message = this.formatAlertMessage(alert);
    
    switch (alert.severity) {
      case 'CRITICAL':
        console.error(`🚨 CRITICAL ALERT: ${message}`);
        break;
      case 'HIGH':
        console.error(`⚠️  HIGH ALERT: ${message}`);
        break;
      case 'MEDIUM':
        console.warn(`⚡ MEDIUM ALERT: ${message}`);
        break;
      case 'LOW':
        console.info(`ℹ️  LOW ALERT: ${message}`);
        break;
    }
  }

  private async deliverToDatabase(channel: AlertChannel, alert: MonitoringAlert): Promise<void> {
    // This would typically save to a database collection
    // For now, we'll just log it as a structured entry
    logger.info('Alert stored to database', {
      component: 'ALERTING_SERVICE',
      channel: channel.name,
      alert: {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        timestamp: alert.timestamp,
        affectedComponents: alert.affectedComponents,
        metrics: alert.metrics
      }
    });
  }

  private async deliverToWebhook(channel: AlertChannel, alert: MonitoringAlert): Promise<void> {
    if (!channel.config.url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert: {
        id: alert.id,
        timestamp: alert.timestamp,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        affectedComponents: alert.affectedComponents,
        metrics: alert.metrics,
        actions: alert.actions
      },
      channel: {
        id: channel.id,
        name: channel.name
      }
    };

    // In a real implementation, this would make an HTTP request
    logger.info('Alert would be sent to webhook', {
      component: 'ALERTING_SERVICE',
      webhookUrl: channel.config.url,
      payload
    });
  }

  private async deliverToEmail(channel: AlertChannel, alert: MonitoringAlert): Promise<void> {
    if (!channel.config.recipients || channel.config.recipients.length === 0) {
      throw new Error('Email recipients not configured');
    }

    const subject = `[${alert.severity}] ${alert.title}`;
    const body = this.formatEmailBody(alert);

    // In a real implementation, this would send an email
    logger.info('Alert would be sent via email', {
      component: 'ALERTING_SERVICE',
      recipients: channel.config.recipients,
      subject,
      body
    });
  }

  private async deliverToSlack(channel: AlertChannel, alert: MonitoringAlert): Promise<void> {
    if (!channel.config.webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const slackMessage = this.formatSlackMessage(alert);

    // In a real implementation, this would send to Slack
    logger.info('Alert would be sent to Slack', {
      component: 'ALERTING_SERVICE',
      channel: channel.config.channel,
      message: slackMessage
    });
  }

  private formatAlertMessage(alert: MonitoringAlert): string {
    return `${alert.title} - ${alert.description} (Components: ${alert.affectedComponents.join(', ')})`;
  }

  private formatEmailBody(alert: MonitoringAlert): string {
    return `
Alert Details:
- ID: ${alert.id}
- Type: ${alert.type}
- Severity: ${alert.severity}
- Timestamp: ${alert.timestamp.toISOString()}
- Description: ${alert.description}
- Affected Components: ${alert.affectedComponents.join(', ')}
- Current Value: ${alert.metrics.currentValue}
${alert.metrics.thresholdValue ? `- Threshold: ${alert.metrics.thresholdValue}` : ''}

Recommended Actions:
${alert.actions.map(action => `- ${action}`).join('\n')}
    `.trim();
  }

  private formatSlackMessage(alert: MonitoringAlert): any {
    const color = {
      'CRITICAL': 'danger',
      'HIGH': 'warning',
      'MEDIUM': 'warning',
      'LOW': 'good'
    }[alert.severity];

    return {
      text: alert.title,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Severity',
              value: alert.severity,
              short: true
            },
            {
              title: 'Type',
              value: alert.type,
              short: true
            },
            {
              title: 'Description',
              value: alert.description,
              short: false
            },
            {
              title: 'Affected Components',
              value: alert.affectedComponents.join(', '),
              short: false
            }
          ],
          ts: Math.floor(alert.timestamp.getTime() / 1000)
        }
      ]
    };
  }

  private scheduleEscalation(alert: MonitoringAlert, rules: AlertRule[]): void {
    const escalationRules = rules.filter(rule => rule.escalation?.enabled);
    
    escalationRules.forEach(rule => {
      if (rule.escalation) {
        setTimeout(async () => {
          // Check if alert is still unresolved
          if (!alert.resolved && !alert.acknowledged) {
            logger.info('Escalating unresolved alert', {
              component: 'ALERTING_SERVICE',
              alertId: alert.id,
              ruleId: rule.id
            });

            // Send to escalation channels
            for (const channelId of rule.escalation?.escalationChannels || []) {
              const channel = this.channels.get(channelId);
              if (channel && channel.enabled) {
                try {
                  await this.deliverToChannel(channel, {
                    ...alert,
                    title: `[ESCALATED] ${alert.title}`,
                    description: `${alert.description} (Escalated after ${rule.escalation?.delayMinutes || 0} minutes)`
                  });
                  this.recordAlertHistory(alert.id, 'ESCALATED', channelId);
                } catch (error) {
                  logger.error('Failed to escalate alert', {
                    component: 'ALERTING_SERVICE',
                    alertId: alert.id,
                    channelId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                  });
                }
              }
            }
          }
        }, rule.escalation.delayMinutes * 60 * 1000);
      }
    });
  }

  private recordAlertHistory(alertId: string, action: 'SENT' | 'ACKNOWLEDGED' | 'RESOLVED' | 'ESCALATED', channelId?: string, userId?: string): void {
    if (!this.alertHistory.has(alertId)) {
      this.alertHistory.set(alertId, []);
    }

    const history = this.alertHistory.get(alertId)!;
    history.push({
      id: `${alertId}_${Date.now()}`,
      alertId,
      timestamp: new Date(),
      action,
      channelId,
      userId
    });

    // Keep only last 100 history entries per alert
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
  }

  private initializeDefaultChannels(): void {
    const defaultChannels: AlertChannel[] = [
      {
        id: 'console',
        name: 'Console Output',
        type: 'console',
        enabled: true,
        config: {}
      },
      {
        id: 'database',
        name: 'Database Storage',
        type: 'database',
        enabled: true,
        config: {
          collection: 'alerts'
        }
      }
    ];

    defaultChannels.forEach(channel => {
      this.channels.set(channel.id, channel);
    });
  }

  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'critical_alerts',
        name: 'Critical Alerts',
        description: 'Send all critical alerts immediately',
        enabled: true,
        conditions: {
          severity: ['CRITICAL']
        },
        channels: ['console', 'database'],
        escalation: {
          enabled: true,
          delayMinutes: 5,
          escalationChannels: ['console']
        }
      },
      {
        id: 'high_severity_alerts',
        name: 'High Severity Alerts',
        description: 'Send high severity alerts with rate limiting',
        enabled: true,
        conditions: {
          severity: ['HIGH'],
          frequency: 5,
          timeWindow: 10 * 60 * 1000 // 10 minutes
        },
        channels: ['console', 'database']
      },
      {
        id: 'broker_alerts',
        name: 'Broker Component Alerts',
        description: 'Alerts for broker-related issues',
        enabled: true,
        conditions: {
          components: ['BROKER_CONTROLLER', 'BROKER_SERVICE'],
          severity: ['MEDIUM', 'HIGH', 'CRITICAL']
        },
        channels: ['console', 'database']
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }
}

export const alertingService = AlertingService.getInstance();