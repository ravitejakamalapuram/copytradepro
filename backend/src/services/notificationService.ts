import { logger } from '../utils/logger';
import { userDatabase } from './sqliteDatabase';

export interface NotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  orderStatusChanges: boolean;
  orderExecutions: boolean;
  orderRejections: boolean;
  portfolioAlerts: boolean;
  marketAlerts: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string;   // HH:MM format
  };
}

export interface PushSubscription {
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: Date;
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface OrderNotificationData {
  orderId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  oldStatus: string;
  newStatus: string;
  brokerName: string;
  timestamp: string;
}

class NotificationService {
  private vapidKeys: { publicKey: string; privateKey: string } | null = null;
  private webpush: any = null;

  constructor() {
    this.initializeWebPush();
  }

  /**
   * Initialize web push with VAPID keys
   */
  private async initializeWebPush(): Promise<void> {
    try {
      // Import web-push dynamically to avoid issues if not installed
      this.webpush = await import('web-push');
      
      // Set VAPID details from environment variables
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      const privateKey = process.env.VAPID_PRIVATE_KEY;
      const email = process.env.VAPID_EMAIL || 'mailto:admin@copytradepro.com';

      if (publicKey && privateKey) {
        this.vapidKeys = { publicKey, privateKey };
        this.webpush.setVapidDetails(email, publicKey, privateKey);
        logger.info('✅ Web Push initialized with VAPID keys');
      } else {
        logger.warn('⚠️ VAPID keys not found in environment variables. Push notifications will be disabled.');
      }
    } catch (error) {
      logger.warn('⚠️ web-push package not installed. Push notifications will be disabled.');
      logger.debug('Install with: npm install web-push');
    }
  }

  /**
   * Generate VAPID keys for development
   */
  generateVapidKeys(): { publicKey: string; privateKey: string } | null {
    if (!this.webpush) {
      logger.error('web-push not available');
      return null;
    }

    try {
      const keys = this.webpush.generateVAPIDKeys();
      logger.info('Generated VAPID keys:');
      logger.info(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
      logger.info(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
      return keys;
    } catch (error) {
      logger.error('Failed to generate VAPID keys:', error);
      return null;
    }
  }

  /**
   * Subscribe user to push notifications
   */
  async subscribeToPush(userId: string, subscription: any): Promise<boolean> {
    try {
      // Store subscription in database
      const subscriptionData: PushSubscription = {
        userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        userAgent: subscription.userAgent,
        createdAt: new Date()
      };

      const success = userDatabase.savePushSubscription(subscriptionData);
      
      if (success) {
        logger.info(`✅ User ${userId} subscribed to push notifications`);
        
        // Send welcome notification
        await this.sendWelcomeNotification(userId);
        
        return true;
      } else {
        logger.error(`❌ Failed to save push subscription for user ${userId}`);
        return false;
      }
    } catch (error) {
      logger.error(`Failed to subscribe user ${userId} to push notifications:`, error);
      return false;
    }
  }

  /**
   * Unsubscribe user from push notifications
   */
  async unsubscribeFromPush(userId: string, endpoint?: string): Promise<boolean> {
    try {
      const success = userDatabase.removePushSubscription(userId, endpoint);
      
      if (success) {
        logger.info(`✅ User ${userId} unsubscribed from push notifications`);
        return true;
      } else {
        logger.warn(`⚠️ No subscription found for user ${userId}`);
        return false;
      }
    } catch (error) {
      logger.error(`Failed to unsubscribe user ${userId} from push notifications:`, error);
      return false;
    }
  }

  /**
   * Send welcome notification to new subscriber
   */
  private async sendWelcomeNotification(userId: string): Promise<void> {
    const payload: NotificationPayload = {
      title: '🎉 Push Notifications Enabled!',
      body: 'You\'ll now receive real-time updates about your trades and portfolio.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'welcome',
      data: {
        type: 'welcome',
        userId,
        timestamp: new Date().toISOString()
      }
    };

    await this.sendNotificationToUser(userId, payload);
  }

  /**
   * Send order status change notification
   */
  async sendOrderStatusNotification(userId: string, orderData: OrderNotificationData): Promise<void> {
    try {
      // Check if user has notifications enabled for order status changes
      const preferences = await this.getUserNotificationPreferences(userId);
      if (!preferences.pushEnabled || !preferences.orderStatusChanges) {
        logger.debug(`User ${userId} has order status notifications disabled`);
        return;
      }

      // Check quiet hours
      if (this.isInQuietHours(preferences.quietHours)) {
        logger.debug(`User ${userId} is in quiet hours, skipping notification`);
        return;
      }

      const { title, body, icon } = this.formatOrderStatusNotification(orderData);
      
      const payload: NotificationPayload = {
        title,
        body,
        icon,
        badge: '/icons/badge-72x72.png',
        tag: `order-${orderData.orderId}`,
        data: {
          type: 'order_status',
          orderId: orderData.orderId,
          symbol: orderData.symbol,
          newStatus: orderData.newStatus,
          timestamp: orderData.timestamp
        },
        actions: [
          {
            action: 'view_order',
            title: 'View Order',
            icon: '/icons/view-icon.png'
          },
          {
            action: 'view_portfolio',
            title: 'View Portfolio',
            icon: '/icons/portfolio-icon.png'
          }
        ],
        requireInteraction: ['EXECUTED', 'REJECTED', 'CANCELLED'].includes(orderData.newStatus)
      };

      await this.sendNotificationToUser(userId, payload);
      
      logger.info(`📱 Sent order status notification to user ${userId}: ${orderData.symbol} ${orderData.newStatus}`);
    } catch (error) {
      logger.error(`Failed to send order status notification to user ${userId}:`, error);
    }
  }

  /**
   * Format order status notification content
   */
  private formatOrderStatusNotification(orderData: OrderNotificationData): { title: string; body: string; icon: string } {
    const { symbol, action, quantity, newStatus, oldStatus } = orderData;
    
    let title = '';
    let body = '';
    let icon = '/icons/icon-192x192.png';

    switch (newStatus.toUpperCase()) {
      case 'EXECUTED':
      case 'FILLED':
        title = `✅ Order Executed`;
        body = `${action} ${quantity} ${symbol} order has been executed successfully`;
        icon = '/icons/success-icon.png';
        break;
      
      case 'REJECTED':
        title = `❌ Order Rejected`;
        body = `${action} ${quantity} ${symbol} order was rejected`;
        icon = '/icons/error-icon.png';
        break;
      
      case 'CANCELLED':
        title = `🚫 Order Cancelled`;
        body = `${action} ${quantity} ${symbol} order has been cancelled`;
        icon = '/icons/warning-icon.png';
        break;
      
      case 'PARTIALLY_FILLED':
        title = `🔄 Order Partially Filled`;
        body = `${action} ${quantity} ${symbol} order is partially executed`;
        icon = '/icons/partial-icon.png';
        break;
      
      case 'PENDING':
        title = `⏳ Order Pending`;
        body = `${action} ${quantity} ${symbol} order is now pending`;
        icon = '/icons/pending-icon.png';
        break;
      
      default:
        title = `📋 Order Status Updated`;
        body = `${action} ${quantity} ${symbol} order status: ${oldStatus} → ${newStatus}`;
        break;
    }

    return { title, body, icon };
  }

  /**
   * Send notification to specific user
   */
  private async sendNotificationToUser(userId: string, payload: NotificationPayload): Promise<void> {
    if (!this.webpush || !this.vapidKeys) {
      logger.debug('Push notifications not configured, skipping');
      return;
    }

    try {
      // Get user's push subscriptions
      const subscriptions = userDatabase.getUserPushSubscriptions(userId);
      
      if (!subscriptions || subscriptions.length === 0) {
        logger.debug(`No push subscriptions found for user ${userId}`);
        return;
      }

      // Send to all user's devices
      const sendPromises = subscriptions.map(async (subscription) => {
        try {
          await this.webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys
            },
            JSON.stringify(payload)
          );
          
          logger.debug(`✅ Notification sent to device: ${subscription.endpoint.substring(0, 50)}...`);
        } catch (error: any) {
          logger.error(`❌ Failed to send notification to device:`, error.message);
          
          // Remove invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            logger.info(`Removing invalid subscription for user ${userId}`);
            userDatabase.removePushSubscription(userId, subscription.endpoint);
          }
        }
      });

      await Promise.allSettled(sendPromises);
    } catch (error) {
      logger.error(`Failed to send notification to user ${userId}:`, error);
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const preferences = userDatabase.getUserNotificationPreferences(userId);
      
      if (preferences) {
        return preferences;
      }

      // Return default preferences if none found
      const defaultPreferences: NotificationPreferences = {
        userId,
        pushEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        orderStatusChanges: true,
        orderExecutions: true,
        orderRejections: true,
        portfolioAlerts: true,
        marketAlerts: false,
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00'
        }
      };

      // Save default preferences
      userDatabase.saveUserNotificationPreferences(defaultPreferences);
      
      return defaultPreferences;
    } catch (error) {
      logger.error(`Failed to get notification preferences for user ${userId}:`, error);
      
      // Return safe defaults
      return {
        userId,
        pushEnabled: true,
        emailEnabled: false,
        smsEnabled: false,
        orderStatusChanges: true,
        orderExecutions: true,
        orderRejections: true,
        portfolioAlerts: true,
        marketAlerts: false,
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00'
        }
      };
    }
  }

  /**
   * Check if current time is in user's quiet hours
   */
  private isInQuietHours(quietHours: { enabled: boolean; startTime: string; endTime: string }): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { startTime, endTime } = quietHours;
    
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateNotificationPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<boolean> {
    try {
      const currentPreferences = await this.getUserNotificationPreferences(userId);
      const updatedPreferences = { ...currentPreferences, ...preferences, userId };
      
      const success = userDatabase.saveUserNotificationPreferences(updatedPreferences);
      
      if (success) {
        logger.info(`✅ Updated notification preferences for user ${userId}`);
        return true;
      } else {
        logger.error(`❌ Failed to update notification preferences for user ${userId}`);
        return false;
      }
    } catch (error) {
      logger.error(`Failed to update notification preferences for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get VAPID public key for client
   */
  getVapidPublicKey(): string | null {
    return this.vapidKeys?.publicKey || null;
  }

  /**
   * Test notification for user
   */
  async sendTestNotification(userId: string): Promise<boolean> {
    const payload: NotificationPayload = {
      title: '🧪 Test Notification',
      body: 'This is a test notification from CopyTrade Pro. Your notifications are working correctly!',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: 'test',
      data: {
        type: 'test',
        timestamp: new Date().toISOString()
      }
    };

    try {
      await this.sendNotificationToUser(userId, payload);
      logger.info(`📱 Sent test notification to user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send test notification to user ${userId}:`, error);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
