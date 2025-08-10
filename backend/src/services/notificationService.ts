/**
 * Notification Service
 * Handles various types of notifications for the symbol management system
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { symbolAlertingService } from './symbolAlertingService';
import { symbolMonitoringService } from './symbolMonitoringService';

export interface NotificationConfig {
  email?: {
    enabled: boolean;
    recipients: string[];
    smtpConfig: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
  slack?: {
    enabled: boolean;
    webhookUrl: string;
    channel: string;
    username: string;
  };
}

export interface Notification {
  id: string;
  type: 'alert' | 'update_complete' | 'system_status' | 'performance_warning';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  data?: Record<string, any>;
}

export class NotificationService extends EventEmitter {
  private config: NotificationConfig;
  private isInitialized = false;

  constructor() {
    super();
    this.config = this.loadConfiguration();
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    try {
      // Set up alert monitoring
      symbolMonitoringService.on('alert:created', (alert) => {
        this.handleSymbolAlert(alert);
      });

      // Set up update completion notifications
      symbolMonitoringService.on('metrics:update', (metrics) => {
        this.handleUpdateMetrics(metrics);
      });

      this.isInitialized = true;
      
      logger.info('Notification service initialized', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'INITIALIZE'
      });

      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize notification service', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'INITIALIZE_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Load notification configuration from environment
   */
  private loadConfiguration(): NotificationConfig {
    const config: NotificationConfig = {};

    // Email configuration
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      config.email = {
        enabled: process.env.NOTIFICATIONS_EMAIL_ENABLED === 'true',
        recipients: process.env.NOTIFICATION_EMAIL_RECIPIENTS?.split(',') || [],
        smtpConfig: {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        }
      };
    }

    // Webhook configuration
    if (process.env.NOTIFICATION_WEBHOOK_URL) {
      config.webhook = {
        enabled: process.env.NOTIFICATIONS_WEBHOOK_ENABLED === 'true',
        url: process.env.NOTIFICATION_WEBHOOK_URL,
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.NOTIFICATION_WEBHOOK_TOKEN && {
            'Authorization': `Bearer ${process.env.NOTIFICATION_WEBHOOK_TOKEN}`
          })
        }
      };
    }

    // Slack configuration
    if (process.env.SLACK_WEBHOOK_URL) {
      config.slack = {
        enabled: process.env.NOTIFICATIONS_SLACK_ENABLED === 'true',
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#alerts',
        username: process.env.SLACK_USERNAME || 'CopyTrade Pro'
      };
    }

    return config;
  }

  /**
   * Handle symbol alerts
   */
  private async handleSymbolAlert(alert: any): Promise<void> {
    try {
      const notification: Notification = {
        id: `alert_${alert.id}`,
        type: 'alert',
        title: `Symbol System Alert: ${alert.type}`,
        message: alert.message,
        severity: alert.severity,
        timestamp: alert.timestamp,
        data: {
          alertId: alert.id,
          alertType: alert.type,
          details: alert.details
        }
      };

      await this.sendNotification(notification);
    } catch (error) {
      logger.error('Failed to handle symbol alert notification', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'HANDLE_ALERT'
      }, error);
    }
  }

  /**
   * Handle update metrics for completion notifications
   */
  private async handleUpdateMetrics(metrics: any): Promise<void> {
    try {
      // Only send notifications for significant updates or errors
      if (metrics.errorRate > 10 || metrics.newSymbols > 100) {
        const notification: Notification = {
          id: `update_${Date.now()}`,
          type: 'update_complete',
          title: 'Symbol Update Completed',
          message: `Symbol update from ${metrics.source} completed with ${metrics.errorRate.toFixed(2)}% error rate`,
          severity: metrics.errorRate > 20 ? 'high' : metrics.errorRate > 10 ? 'medium' : 'low',
          timestamp: metrics.timestamp,
          data: {
            source: metrics.source,
            totalProcessed: metrics.totalProcessed,
            successCount: metrics.successCount,
            failureCount: metrics.failureCount,
            errorRate: metrics.errorRate,
            newSymbols: metrics.newSymbols,
            updatedSymbols: metrics.updatedSymbols
          }
        };

        await this.sendNotification(notification);
      }
    } catch (error) {
      logger.error('Failed to handle update metrics notification', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'HANDLE_UPDATE_METRICS'
      }, error);
    }
  }

  /**
   * Send a notification through all configured channels
   */
  async sendNotification(notification: Notification): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Notification service not initialized, skipping notification');
      return;
    }

    const promises: Promise<void>[] = [];

    // Send via email if configured and enabled
    if (this.config.email?.enabled) {
      promises.push(this.sendEmailNotification(notification));
    }

    // Send via webhook if configured and enabled
    if (this.config.webhook?.enabled) {
      promises.push(this.sendWebhookNotification(notification));
    }

    // Send via Slack if configured and enabled
    if (this.config.slack?.enabled) {
      promises.push(this.sendSlackNotification(notification));
    }

    // Always log to console
    promises.push(this.logNotification(notification));

    try {
      await Promise.allSettled(promises);
      
      logger.info('Notification sent', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'SEND_NOTIFICATION'
      }, {
        notificationId: notification.id,
        type: notification.type,
        severity: notification.severity,
        channelsCount: promises.length
      });

      this.emit('notification:sent', notification);
    } catch (error) {
      logger.error('Failed to send notification', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'SEND_NOTIFICATION_ERROR'
      }, error);
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: Notification): Promise<void> {
    try {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransporter(this.config.email!.smtpConfig);

      const subject = `[${notification.severity.toUpperCase()}] ${notification.title}`;
      const html = this.generateEmailHTML(notification);

      await transporter.sendMail({
        from: this.config.email!.smtpConfig.auth.user,
        to: this.config.email!.recipients.join(','),
        subject,
        html
      });

      logger.debug('Email notification sent', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'EMAIL_SENT'
      });
    } catch (error) {
      logger.error('Failed to send email notification', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'EMAIL_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhookNotification(notification: Notification): Promise<void> {
    try {
      const axios = require('axios');
      
      const payload = {
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          severity: notification.severity,
          timestamp: notification.timestamp.toISOString(),
          data: notification.data
        },
        service: 'copytrade-pro',
        component: 'symbol-management'
      };

      await axios.post(this.config.webhook!.url, payload, {
        headers: this.config.webhook!.headers,
        timeout: 10000
      });

      logger.debug('Webhook notification sent', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'WEBHOOK_SENT'
      });
    } catch (error) {
      logger.error('Failed to send webhook notification', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'WEBHOOK_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(notification: Notification): Promise<void> {
    try {
      const axios = require('axios');
      
      const color = {
        low: '#36a64f',
        medium: '#ff9500',
        high: '#ff0000',
        critical: '#8b0000'
      };

      const payload = {
        channel: this.config.slack!.channel,
        username: this.config.slack!.username,
        attachments: [{
          color: color[notification.severity],
          title: notification.title,
          text: notification.message,
          fields: [
            {
              title: 'Severity',
              value: notification.severity.toUpperCase(),
              short: true
            },
            {
              title: 'Type',
              value: notification.type,
              short: true
            },
            {
              title: 'Time',
              value: notification.timestamp.toISOString(),
              short: false
            }
          ],
          footer: 'CopyTrade Pro Symbol Management',
          ts: Math.floor(notification.timestamp.getTime() / 1000)
        }]
      };

      await axios.post(this.config.slack!.webhookUrl, payload);

      logger.debug('Slack notification sent', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'SLACK_SENT'
      });
    } catch (error) {
      logger.error('Failed to send Slack notification', {
        component: 'NOTIFICATION_SERVICE',
        operation: 'SLACK_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Log notification to console
   */
  private async logNotification(notification: Notification): Promise<void> {
    const severityEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };

    console.log(`\n${severityEmoji[notification.severity]} NOTIFICATION [${notification.severity.toUpperCase()}]`);
    console.log(`Title: ${notification.title}`);
    console.log(`Message: ${notification.message}`);
    console.log(`Type: ${notification.type}`);
    console.log(`Time: ${notification.timestamp.toISOString()}`);
    if (notification.data) {
      console.log(`Data:`, JSON.stringify(notification.data, null, 2));
    }
    console.log('─'.repeat(80));
  }

  /**
   * Generate HTML email content
   */
  private generateEmailHTML(notification: Notification): string {
    const severityColor = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#7c2d12'
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>CopyTrade Pro Notification</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background-color: ${severityColor[notification.severity]}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .notification-info { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
          .data { background-color: #f1f3f4; padding: 15px; border-radius: 4px; font-family: monospace; white-space: pre-wrap; }
          .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${notification.title}</h1>
            <p>Severity: ${notification.severity.toUpperCase()}</p>
          </div>
          <div class="content">
            <div class="notification-info">
              <h3>Notification Details</h3>
              <p><strong>Type:</strong> ${notification.type}</p>
              <p><strong>Message:</strong> ${notification.message}</p>
              <p><strong>Time:</strong> ${notification.timestamp.toISOString()}</p>
              <p><strong>ID:</strong> ${notification.id}</p>
            </div>
            ${notification.data ? `
            <h3>Additional Data</h3>
            <div class="data">${JSON.stringify(notification.data, null, 2)}</div>
            ` : ''}
          </div>
          <div class="footer">
            <p>CopyTrade Pro Symbol Management System</p>
            <p>This is an automated notification. Please check the system dashboard for more information.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send a test notification
   */
  async sendTestNotification(severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    const testNotification: Notification = {
      id: `test_${Date.now()}`,
      type: 'system_status',
      title: 'Test Notification',
      message: `This is a test notification with ${severity} severity to verify the notification system is working correctly.`,
      severity,
      timestamp: new Date(),
      data: {
        test: true,
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
      }
    };

    await this.sendNotification(testNotification);
  }

  /**
   * Get notification configuration status
   */
  getConfigurationStatus(): {
    email: { configured: boolean; enabled: boolean; recipients: number };
    webhook: { configured: boolean; enabled: boolean };
    slack: { configured: boolean; enabled: boolean };
  } {
    return {
      email: {
        configured: !!this.config.email,
        enabled: this.config.email?.enabled || false,
        recipients: this.config.email?.recipients.length || 0
      },
      webhook: {
        configured: !!this.config.webhook,
        enabled: this.config.webhook?.enabled || false
      },
      slack: {
        configured: !!this.config.slack,
        enabled: this.config.slack?.enabled || false
      }
    };
  }

  /**
   * Update notification configuration
   */
  updateConfiguration(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    logger.info('Notification configuration updated', {
      component: 'NOTIFICATION_SERVICE',
      operation: 'CONFIG_UPDATE'
    });

    this.emit('config:updated', this.config);
  }
}

// Export singleton instance
export const notificationService = new NotificationService();