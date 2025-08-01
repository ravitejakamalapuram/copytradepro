/**
 * Symbol Alerting Service
 * Handles alerts and notifications for symbol management system
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { SymbolAlert } from './symbolMonitoringService';

export interface AlertChannel {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'slack' | 'console';
  config: Record<string, any>;
  enabled: boolean;
  severityFilter: ('low' | 'medium' | 'high' | 'critical')[];
}

export interface AlertNotification {
  id: string;
  alertId: string;
  channelId: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
  retryCount: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string; // JSON string describing the condition
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownPeriod: number; // milliseconds
  channels: string[]; // channel IDs
  lastTriggered?: Date;
}

export class SymbolAlertingService extends EventEmitter {
  private channels: Map<string, AlertChannel> = new Map();
  private notifications: AlertNotification[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  
  private readonly MAX_NOTIFICATIONS_HISTORY = 1000;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  constructor() {
    super();
    this.setupDefaultChannels();
    this.setupDefaultAlertRules();
  }

  /**
   * Setup default alert channels
   */
  private setupDefaultChannels(): void {
    // Console channel (always enabled for development)
    this.addChannel({
      id: 'console',
      name: 'Console Logger',
      type: 'console',
      config: {},
      enabled: true,
      severityFilter: ['low', 'medium', 'high', 'critical']
    });

    // Email channel (if configured)
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      this.addChannel({
        id: 'email',
        name: 'Email Notifications',
        type: 'email',
        config: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: process.env.ALERT_EMAIL_TO?.split(',') || []
        },
        enabled: true,
        severityFilter: ['high', 'critical']
      });
    }

    // Webhook channel (if configured)
    if (process.env.ALERT_WEBHOOK_URL) {
      this.addChannel({
        id: 'webhook',
        name: 'Webhook Notifications',
        type: 'webhook',
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.ALERT_WEBHOOK_TOKEN && {
              'Authorization': `Bearer ${process.env.ALERT_WEBHOOK_TOKEN}`
            })
          }
        },
        enabled: true,
        severityFilter: ['medium', 'high', 'critical']
      });
    }

    // Slack channel (if configured)
    if (process.env.SLACK_WEBHOOK_URL) {
      this.addChannel({
        id: 'slack',
        name: 'Slack Notifications',
        type: 'slack',
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || '#alerts',
          username: process.env.SLACK_USERNAME || 'CopyTrade Pro Alerts'
        },
        enabled: true,
        severityFilter: ['high', 'critical']
      });
    }
  }

  /**
   * Setup default alert rules
   */
  private setupDefaultAlertRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'Symbol Update Failure',
        description: 'Triggered when symbol update error rate exceeds threshold',
        condition: JSON.stringify({
          type: 'update_failure',
          errorRateThreshold: 5
        }),
        severity: 'high',
        enabled: true,
        cooldownPeriod: 300000, // 5 minutes
        channels: ['console', 'email', 'webhook']
      },
      {
        name: 'Critical Update Failure',
        description: 'Triggered when symbol update error rate is critically high',
        condition: JSON.stringify({
          type: 'update_failure',
          errorRateThreshold: 20
        }),
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 60000, // 1 minute
        channels: ['console', 'email', 'webhook', 'slack']
      },
      {
        name: 'Search Performance Degradation',
        description: 'Triggered when search operations are consistently slow',
        condition: JSON.stringify({
          type: 'performance_degradation',
          responseTimeThreshold: 1000
        }),
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 600000, // 10 minutes
        channels: ['console', 'webhook']
      },
      {
        name: 'Cache Performance Issues',
        description: 'Triggered when cache hit rate drops significantly',
        condition: JSON.stringify({
          type: 'cache_failure',
          hitRateThreshold: 70
        }),
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 300000, // 5 minutes
        channels: ['console', 'webhook']
      },
      {
        name: 'Data Quality Issues',
        description: 'Triggered when data validation errors exceed threshold',
        condition: JSON.stringify({
          type: 'data_quality',
          validationErrorThreshold: 1
        }),
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 600000, // 10 minutes
        channels: ['console', 'email']
      },
      {
        name: 'Database Performance Issues',
        description: 'Triggered when database operations are consistently slow',
        condition: JSON.stringify({
          type: 'database_error',
          responseTimeThreshold: 1000
        }),
        severity: 'high',
        enabled: true,
        cooldownPeriod: 300000, // 5 minutes
        channels: ['console', 'email', 'webhook']
      }
    ];

    defaultRules.forEach(rule => {
      const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.alertRules.set(id, { ...rule, id });
    });
  }

  /**
   * Add alert channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.set(channel.id, channel);
    
    logger.info('Alert channel added', {
      component: 'SYMBOL_ALERTING',
      operation: 'ADD_CHANNEL'
    }, {
      channelId: channel.id,
      channelName: channel.name,
      channelType: channel.type,
      enabled: channel.enabled
    });
  }

  /**
   * Remove alert channel
   */
  removeChannel(channelId: string): boolean {
    const removed = this.channels.delete(channelId);
    
    if (removed) {
      logger.info('Alert channel removed', {
        component: 'SYMBOL_ALERTING',
        operation: 'REMOVE_CHANNEL'
      }, { channelId });
    }
    
    return removed;
  }

  /**
   * Update alert channel
   */
  updateChannel(channelId: string, updates: Partial<AlertChannel>): boolean {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return false;
    }

    Object.assign(channel, updates);
    this.channels.set(channelId, channel);
    
    logger.info('Alert channel updated', {
      component: 'SYMBOL_ALERTING',
      operation: 'UPDATE_CHANNEL'
    }, { channelId, updates });
    
    return true;
  }

  /**
   * Send alert to configured channels
   */
  async sendAlert(alert: SymbolAlert): Promise<void> {
    logger.info('Processing alert for notification', {
      component: 'SYMBOL_ALERTING',
      operation: 'SEND_ALERT'
    }, {
      alertId: alert.id,
      alertType: alert.type,
      severity: alert.severity,
      message: alert.message
    });

    // Find matching alert rules
    const matchingRules = Array.from(this.alertRules.values()).filter(rule => {
      if (!rule.enabled) return false;
      
      // Check cooldown
      if (rule.lastTriggered && 
          Date.now() - rule.lastTriggered.getTime() < rule.cooldownPeriod) {
        return false;
      }

      // Check if rule matches alert
      try {
        const condition = JSON.parse(rule.condition);
        return this.evaluateAlertCondition(alert, condition);
      } catch (error) {
        logger.error('Failed to parse alert rule condition', {
          component: 'SYMBOL_ALERTING',
          operation: 'EVALUATE_CONDITION'
        }, error);
        return false;
      }
    });

    if (matchingRules.length === 0) {
      logger.debug('No matching alert rules found', {
        component: 'SYMBOL_ALERTING',
        operation: 'NO_MATCHING_RULES'
      }, { alertId: alert.id });
      return;
    }

    // Get all unique channels from matching rules
    const channelIds = new Set<string>();
    matchingRules.forEach(rule => {
      rule.channels.forEach(channelId => channelIds.add(channelId));
      rule.lastTriggered = new Date();
    });

    // Send to each channel
    const notifications: Promise<void>[] = [];
    for (const channelId of channelIds) {
      const channel = this.channels.get(channelId);
      if (channel && channel.enabled && channel.severityFilter.includes(alert.severity)) {
        notifications.push(this.sendToChannel(alert, channel));
      }
    }

    await Promise.allSettled(notifications);
  }

  /**
   * Evaluate if alert matches rule condition
   */
  private evaluateAlertCondition(alert: SymbolAlert, condition: any): boolean {
    // Basic type matching
    if (condition.type && condition.type !== alert.type) {
      return false;
    }

    // Specific condition checks based on alert type
    switch (alert.type) {
      case 'update_failure':
        if (condition.errorRateThreshold && 
            alert.details.errorRate < condition.errorRateThreshold) {
          return false;
        }
        break;
      
      case 'performance_degradation':
        if (condition.responseTimeThreshold && 
            alert.details.duration < condition.responseTimeThreshold) {
          return false;
        }
        break;
      
      case 'cache_failure':
        if (condition.hitRateThreshold && 
            alert.details.hitRate > condition.hitRateThreshold) {
          return false;
        }
        break;
      
      case 'data_quality':
        if (condition.validationErrorThreshold && 
            alert.details.errorRate < condition.validationErrorThreshold) {
          return false;
        }
        break;
      
      case 'database_error':
        if (condition.responseTimeThreshold && 
            alert.details.duration < condition.responseTimeThreshold) {
          return false;
        }
        break;
    }

    return true;
  }

  /**
   * Send alert to specific channel
   */
  private async sendToChannel(alert: SymbolAlert, channel: AlertChannel): Promise<void> {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const notification: AlertNotification = {
      id: notificationId,
      alertId: alert.id,
      channelId: channel.id,
      status: 'pending',
      retryCount: 0
    };

    this.notifications.push(notification);
    this.trimNotifications();

    try {
      switch (channel.type) {
        case 'console':
          await this.sendToConsole(alert, channel);
          break;
        case 'email':
          await this.sendToEmail(alert, channel);
          break;
        case 'webhook':
          await this.sendToWebhook(alert, channel);
          break;
        case 'slack':
          await this.sendToSlack(alert, channel);
          break;
        default:
          throw new Error(`Unsupported channel type: ${channel.type}`);
      }

      notification.status = 'sent';
      notification.sentAt = new Date();
      
      logger.info('Alert sent successfully', {
        component: 'SYMBOL_ALERTING',
        operation: 'SEND_SUCCESS'
      }, {
        alertId: alert.id,
        channelId: channel.id,
        channelType: channel.type
      });

    } catch (error) {
      notification.status = 'failed';
      notification.error = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Failed to send alert', {
        component: 'SYMBOL_ALERTING',
        operation: 'SEND_FAILED'
      }, error);

      // Retry if under retry limit
      if (notification.retryCount < this.MAX_RETRY_ATTEMPTS) {
        setTimeout(() => {
          this.retryNotification(notification, alert, channel);
        }, this.RETRY_DELAY * (notification.retryCount + 1));
      }
    }
  }

  /**
   * Send alert to console
   */
  private async sendToConsole(alert: SymbolAlert, channel: AlertChannel): Promise<void> {
    const severityEmoji = {
      low: '🟡',
      medium: '🟠',
      high: '🔴',
      critical: '🚨'
    };

    console.log(`\n${severityEmoji[alert.severity]} SYMBOL ALERT [${alert.severity.toUpperCase()}]`);
    console.log(`Type: ${alert.type}`);
    console.log(`Message: ${alert.message}`);
    console.log(`Time: ${alert.timestamp.toISOString()}`);
    console.log(`Details:`, JSON.stringify(alert.details, null, 2));
    console.log('─'.repeat(80));
  }

  /**
   * Send alert to email
   */
  private async sendToEmail(alert: SymbolAlert, channel: AlertChannel): Promise<void> {
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransporter({
      host: channel.config.host,
      port: channel.config.port,
      secure: channel.config.secure,
      auth: {
        user: channel.config.user,
        pass: channel.config.pass
      }
    });

    const subject = `[${alert.severity.toUpperCase()}] CopyTrade Pro Symbol Alert: ${alert.type}`;
    const html = this.generateEmailHTML(alert);

    await transporter.sendMail({
      from: channel.config.from,
      to: channel.config.to,
      subject,
      html
    });
  }

  /**
   * Send alert to webhook
   */
  private async sendToWebhook(alert: SymbolAlert, channel: AlertChannel): Promise<void> {
    const axios = require('axios');
    
    const payload = {
      alert: {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp.toISOString(),
        details: alert.details
      },
      service: 'copytrade-pro',
      component: 'symbol-management'
    };

    await axios({
      method: channel.config.method || 'POST',
      url: channel.config.url,
      headers: channel.config.headers || {},
      data: payload,
      timeout: 10000
    });
  }

  /**
   * Send alert to Slack
   */
  private async sendToSlack(alert: SymbolAlert, channel: AlertChannel): Promise<void> {
    const axios = require('axios');
    
    const color = {
      low: '#ffeb3b',
      medium: '#ff9800',
      high: '#f44336',
      critical: '#9c27b0'
    };

    const payload = {
      channel: channel.config.channel,
      username: channel.config.username,
      attachments: [{
        color: color[alert.severity],
        title: `Symbol Alert: ${alert.type}`,
        text: alert.message,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: alert.timestamp.toISOString(),
            short: true
          },
          {
            title: 'Details',
            value: JSON.stringify(alert.details, null, 2),
            short: false
          }
        ],
        footer: 'CopyTrade Pro Symbol Management',
        ts: Math.floor(alert.timestamp.getTime() / 1000)
      }]
    };

    await axios.post(channel.config.webhookUrl, payload);
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHTML(alert: SymbolAlert): string {
    const severityColor = {
      low: '#ffeb3b',
      medium: '#ff9800',
      high: '#f44336',
      critical: '#9c27b0'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>CopyTrade Pro Alert</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: ${severityColor[alert.severity]}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .alert-info { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .details { background-color: #f1f3f4; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; }
          .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Symbol Alert - ${alert.severity.toUpperCase()}</h1>
          </div>
          <div class="content">
            <div class="alert-info">
              <h3>Alert Information</h3>
              <p><strong>Type:</strong> ${alert.type}</p>
              <p><strong>Message:</strong> ${alert.message}</p>
              <p><strong>Time:</strong> ${alert.timestamp.toISOString()}</p>
              <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
            </div>
            <h3>Details</h3>
            <div class="details">${JSON.stringify(alert.details, null, 2)}</div>
          </div>
          <div class="footer">
            <p>CopyTrade Pro Symbol Management System</p>
            <p>This is an automated alert. Please check the system dashboard for more information.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Retry failed notification
   */
  private async retryNotification(
    notification: AlertNotification, 
    alert: SymbolAlert, 
    channel: AlertChannel
  ): Promise<void> {
    notification.retryCount++;
    notification.status = 'pending';
    
    logger.info('Retrying alert notification', {
      component: 'SYMBOL_ALERTING',
      operation: 'RETRY_NOTIFICATION'
    }, {
      notificationId: notification.id,
      alertId: alert.id,
      channelId: channel.id,
      retryCount: notification.retryCount
    });

    await this.sendToChannel(alert, channel);
  }

  /**
   * Trim notifications history
   */
  private trimNotifications(): void {
    if (this.notifications.length > this.MAX_NOTIFICATIONS_HISTORY) {
      this.notifications = this.notifications.slice(-this.MAX_NOTIFICATIONS_HISTORY);
    }
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(timeWindow: number = 86400000): {
    totalSent: number;
    totalFailed: number;
    successRate: number;
    channelStats: Record<string, { sent: number; failed: number; }>;
  } {
    const cutoff = new Date(Date.now() - timeWindow);
    const recentNotifications = this.notifications.filter(n => 
      n.sentAt && n.sentAt >= cutoff
    );

    const totalSent = recentNotifications.filter(n => n.status === 'sent').length;
    const totalFailed = recentNotifications.filter(n => n.status === 'failed').length;
    const successRate = (totalSent + totalFailed) > 0 
      ? (totalSent / (totalSent + totalFailed)) * 100 
      : 100;

    const channelStats: Record<string, { sent: number; failed: number; }> = {};
    for (const notification of recentNotifications) {
      if (!channelStats[notification.channelId]) {
        channelStats[notification.channelId] = { sent: 0, failed: 0 };
      }
      
      if (notification.status === 'sent') {
        channelStats[notification.channelId]!.sent++;
      } else if (notification.status === 'failed') {
        channelStats[notification.channelId]!.failed++;
      }
    }

    return {
      totalSent,
      totalFailed,
      successRate: Math.round(successRate * 100) / 100,
      channelStats
    };
  }

  /**
   * Get alert channels
   */
  getChannels(): AlertChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.alertRules.set(id, { ...rule, id });
    
    logger.info('Alert rule added', {
      component: 'SYMBOL_ALERTING',
      operation: 'ADD_RULE'
    }, { ruleId: id, ruleName: rule.name });
    
    return id;
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    
    if (removed) {
      logger.info('Alert rule removed', {
        component: 'SYMBOL_ALERTING',
        operation: 'REMOVE_RULE'
      }, { ruleId });
    }
    
    return removed;
  }

  /**
   * Update alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      return false;
    }

    Object.assign(rule, updates);
    this.alertRules.set(ruleId, rule);
    
    logger.info('Alert rule updated', {
      component: 'SYMBOL_ALERTING',
      operation: 'UPDATE_RULE'
    }, { ruleId, updates });
    
    return true;
  }
}

// Export singleton instance
export const symbolAlertingService = new SymbolAlertingService();