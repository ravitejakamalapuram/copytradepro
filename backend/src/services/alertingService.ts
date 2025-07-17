/**
 * Alerting Service
 * Handles external alerting integrations for production monitoring
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { Alert } from './productionMonitoringService';

export interface AlertChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: any;
  enabled: boolean;
  severityFilter: ('low' | 'medium' | 'high' | 'critical')[];
}

export interface AlertNotification {
  id: string;
  alert: Alert;
  channel: AlertChannel;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
  retryCount: number;
}

export class AlertingService extends EventEmitter {
  private channels: Map<string, AlertChannel> = new Map();
  private notifications: AlertNotification[] = [];
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 5000; // 5 seconds

  constructor() {
    super();
    this.setupDefaultChannels();
  }

  /**
   * Setup default alert channels from environment variables
   */
  private setupDefaultChannels(): void {
    // Email alerting
    if (process.env.ALERT_EMAIL_ENABLED === 'true') {
      this.addChannel({
        id: 'email-default',
        name: 'Email Alerts',
        type: 'email',
        config: {
          smtp: {
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          },
          from: process.env.ALERT_EMAIL_FROM,
          to: process.env.ALERT_EMAIL_TO?.split(',') || []
        },
        enabled: true,
        severityFilter: ['high', 'critical']
      });
    }

    // Slack alerting
    if (process.env.SLACK_WEBHOOK_URL) {
      this.addChannel({
        id: 'slack-default',
        name: 'Slack Alerts',
        type: 'slack',
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: process.env.SLACK_CHANNEL || '#alerts',
          username: process.env.SLACK_USERNAME || 'CopyTrade Monitor'
        },
        enabled: true,
        severityFilter: ['medium', 'high', 'critical']
      });
    }

    // Generic webhook
    if (process.env.ALERT_WEBHOOK_URL) {
      this.addChannel({
        id: 'webhook-default',
        name: 'Webhook Alerts',
        type: 'webhook',
        config: {
          url: process.env.ALERT_WEBHOOK_URL,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.ALERT_WEBHOOK_AUTH
          }
        },
        enabled: true,
        severityFilter: ['high', 'critical']
      });
    }
  }

  /**
   * Add alert channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.set(channel.id, channel);
    logger.info('Alert channel added', {
      component: 'ALERTING',
      operation: 'ADD_CHANNEL',
      channelId: channel.id,
      channelType: channel.type
    });
  }

  /**
   * Remove alert channel
   */
  removeChannel(channelId: string): boolean {
    const removed = this.channels.delete(channelId);
    if (removed) {
      logger.info('Alert channel removed', {
        component: 'ALERTING',
        operation: 'REMOVE_CHANNEL',
        channelId
      });
    }
    return removed;
  }

  /**
   * Send alert to all configured channels
   */
  async sendAlert(alert: Alert): Promise<void> {
    const eligibleChannels = Array.from(this.channels.values()).filter(
      channel => channel.enabled && channel.severityFilter.includes(alert.severity)
    );

    if (eligibleChannels.length === 0) {
      logger.warn('No eligible channels for alert', {
        component: 'ALERTING',
        operation: 'SEND_ALERT',
        alertId: alert.id,
        severity: alert.severity
      });
      return;
    }

    logger.info('Sending alert to channels', {
      component: 'ALERTING',
      operation: 'SEND_ALERT',
      alertId: alert.id,
      severity: alert.severity,
      channelCount: eligibleChannels.length
    });

    // Send to all eligible channels
    const promises = eligibleChannels.map(channel => this.sendToChannel(alert, channel));
    await Promise.allSettled(promises);
  }

  /**
   * Send alert to specific channel
   */
  private async sendToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    const notification: AlertNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alert,
      channel,
      status: 'pending',
      retryCount: 0
    };

    this.notifications.push(notification);

    try {
      await this.executeChannelSend(notification);
      notification.status = 'sent';
      notification.sentAt = new Date();
      
      logger.info('Alert sent successfully', {
        component: 'ALERTING',
        operation: 'CHANNEL_SEND',
        notificationId: notification.id,
        channelId: channel.id,
        channelType: channel.type
      });

      this.emit('notification:sent', notification);
    } catch (error: any) {
      notification.status = 'failed';
      notification.error = error.message;
      
      logger.error('Failed to send alert', {
        component: 'ALERTING',
        operation: 'CHANNEL_SEND',
        notificationId: notification.id,
        channelId: channel.id,
        channelType: channel.type
      }, error);

      // Retry if under limit
      if (notification.retryCount < this.MAX_RETRY_ATTEMPTS) {
        setTimeout(() => this.retryNotification(notification), this.RETRY_DELAY);
      } else {
        this.emit('notification:failed', notification);
      }
    }
  }

  /**
   * Execute the actual channel send based on type
   */
  private async executeChannelSend(notification: AlertNotification): Promise<void> {
    const { alert, channel } = notification;

    switch (channel.type) {
      case 'email':
        await this.sendEmailAlert(alert, channel);
        break;
      case 'slack':
        await this.sendSlackAlert(alert, channel);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert, channel);
        break;
      case 'sms':
        await this.sendSMSAlert(alert, channel);
        break;
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    // This would integrate with nodemailer or similar
    // For now, just log the attempt
    logger.info('Email alert would be sent', {
      component: 'ALERTING',
      operation: 'EMAIL_SEND',
      alertId: alert.id,
      to: channel.config.to,
      subject: `[${alert.severity.toUpperCase()}] ${alert.message}`
    });

    // Simulate email sending
    if (Math.random() > 0.1) { // 90% success rate simulation
      return Promise.resolve();
    } else {
      throw new Error('Simulated email sending failure');
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    const payload = {
      channel: channel.config.channel,
      username: channel.config.username,
      text: `🚨 *${alert.severity.toUpperCase()} Alert*`,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            {
              title: 'Message',
              value: alert.message,
              short: false
            },
            {
              title: 'Timestamp',
              value: new Date(alert.timestamp).toLocaleString(),
              short: true
            },
            {
              title: 'Alert ID',
              value: alert.id,
              short: true
            }
          ]
        }
      ]
    };

    // This would make actual HTTP request to Slack webhook
    logger.info('Slack alert would be sent', {
      component: 'ALERTING',
      operation: 'SLACK_SEND',
      alertId: alert.id,
      channel: channel.config.channel,
      payload: JSON.stringify(payload)
    });

    // Simulate Slack sending
    if (Math.random() > 0.05) { // 95% success rate simulation
      return Promise.resolve();
    } else {
      throw new Error('Simulated Slack sending failure');
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    const payload = {
      alert: {
        id: alert.id,
        severity: alert.severity,
        message: alert.message,
        timestamp: alert.timestamp,
        metrics: alert.metrics
      },
      source: 'copytrade-monitoring',
      timestamp: new Date().toISOString()
    };

    // This would make actual HTTP request
    logger.info('Webhook alert would be sent', {
      component: 'ALERTING',
      operation: 'WEBHOOK_SEND',
      alertId: alert.id,
      url: channel.config.url,
      method: channel.config.method
    });

    // Simulate webhook sending
    if (Math.random() > 0.05) { // 95% success rate simulation
      return Promise.resolve();
    } else {
      throw new Error('Simulated webhook sending failure');
    }
  }

  /**
   * Send SMS alert
   */
  private async sendSMSAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    const message = `CopyTrade Alert [${alert.severity.toUpperCase()}]: ${alert.message}`;

    // This would integrate with Twilio or similar SMS service
    logger.info('SMS alert would be sent', {
      component: 'ALERTING',
      operation: 'SMS_SEND',
      alertId: alert.id,
      message
    });

    // Simulate SMS sending
    if (Math.random() > 0.05) { // 95% success rate simulation
      return Promise.resolve();
    } else {
      throw new Error('Simulated SMS sending failure');
    }
  }

  /**
   * Retry failed notification
   */
  private async retryNotification(notification: AlertNotification): Promise<void> {
    notification.retryCount++;
    notification.status = 'pending';

    logger.info('Retrying notification', {
      component: 'ALERTING',
      operation: 'RETRY_NOTIFICATION',
      notificationId: notification.id,
      retryCount: notification.retryCount
    });

    try {
      await this.executeChannelSend(notification);
      notification.status = 'sent';
      notification.sentAt = new Date();
      this.emit('notification:sent', notification);
    } catch (error: any) {
      notification.status = 'failed';
      notification.error = error.message;

      if (notification.retryCount < this.MAX_RETRY_ATTEMPTS) {
        setTimeout(() => this.retryNotification(notification), this.RETRY_DELAY * notification.retryCount);
      } else {
        this.emit('notification:failed', notification);
      }
    }
  }

  /**
   * Get color for severity level
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'warning';
      case 'low': return 'good';
      default: return 'good';
    }
  }

  /**
   * Get notification history
   */
  getNotificationHistory(limit: number = 100): AlertNotification[] {
    return this.notifications
      .sort((a, b) => (b.sentAt || new Date(0)).getTime() - (a.sentAt || new Date(0)).getTime())
      .slice(0, limit);
  }

  /**
   * Get channel statistics
   */
  getChannelStats(): { [channelId: string]: { sent: number; failed: number; successRate: number } } {
    const stats: { [channelId: string]: { sent: number; failed: number; successRate: number } } = {};

    for (const notification of this.notifications) {
      const channelId = notification.channel.id;
      if (!stats[channelId]) {
        stats[channelId] = { sent: 0, failed: 0, successRate: 0 };
      }

      if (notification.status === 'sent') {
        stats[channelId].sent++;
      } else if (notification.status === 'failed') {
        stats[channelId].failed++;
      }
    }

    // Calculate success rates
    for (const channelId in stats) {
      const channelStats = stats[channelId];
      if (channelStats) {
        const { sent, failed } = channelStats;
        const total = sent + failed;
        channelStats.successRate = total > 0 ? (sent / total) * 100 : 100;
      }
    }

    return stats;
  }

  /**
   * Test alert channel
   */
  async testChannel(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    const testAlert: Alert = {
      id: `test_${Date.now()}`,
      ruleId: 'test-rule',
      severity: 'low',
      message: 'Test alert from CopyTrade monitoring system',
      timestamp: new Date(),
      metrics: {} as any,
      resolved: false
    };

    try {
      await this.sendToChannel(testAlert, channel);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const alertingService = new AlertingService();