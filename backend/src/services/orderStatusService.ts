import { EventEmitter } from 'events';
import { userDatabase } from './sqliteDatabase';
import { BrokerRegistry, IBrokerService } from '@copytrade/unified-broker';
import { notificationService, OrderNotificationData } from './notificationService';

// Import broker connections from controller
import { userBrokerConnections } from '../controllers/brokerController';

// Broker connection manager interface
interface BrokerConnectionManager {
  getBrokerConnection(userId: string, brokerName: string): IBrokerService | null;
}

// Create broker connection manager implementation
const brokerConnectionManager: BrokerConnectionManager = {
  getBrokerConnection(userId: string, brokerName: string): IBrokerService | null {
    const userConnections = userBrokerConnections.get(userId);
    if (!userConnections) {
      console.log(`🔍 Looking for broker connection: userId=${userId}, brokerName=${brokerName}`);
      console.log(`❌ No connections found for user ${userId}`);
      return null;
    }

    const brokerService = userConnections.get(brokerName);
    if (!brokerService) {
      console.log(`🔍 Looking for broker connection: userId=${userId}, brokerName=${brokerName}`);
      console.log(`❌ No ${brokerName} connection found for user ${userId}`);
      return null;
    }

    if (brokerName === 'shoonya') {
      const brokerServiceTyped = brokerService as any; // Type assertion for legacy compatibility
      if (brokerServiceTyped.isLoggedIn && brokerServiceTyped.isLoggedIn()) {
        console.log(`✅ Found active ${brokerName} connection for user ${userId}`);
        return brokerServiceTyped;
      } else {
        console.log(`⚠️ Found ${brokerName} connection for user ${userId} but not logged in`);
        return null;
      }
    }

    return null;
  }
};

// Legacy function for backward compatibility
export const setBrokerConnectionManager = (manager: BrokerConnectionManager) => {
  // No longer needed as we use the direct implementation above
  console.log('⚠️ setBrokerConnectionManager is deprecated - using direct broker connection manager');
};

// Simple logger
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
};

interface Order {
  id: string;
  user_id: number | string; // Support both for MongoDB ObjectId compatibility
  account_id: number | string; // Support both for MongoDB ObjectId compatibility
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  status: string;
  broker_name: string;
  broker_order_id?: string;
  order_type: string;
  exchange: string;
  product_type: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
  executed_at?: string;
}

class OrderStatusService extends EventEmitter {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private activeOrders: Map<string, Order> = new Map();
  private isPolling: boolean = false;
  private pollingFrequency: number = 30000; // 30 seconds for production (fallback only)
  private maxRetries: number = 3;

  constructor() {
    super();
  }







  /**
   * Start monitoring order status (manual refresh only)
   */
  async startMonitoring(): Promise<void> {
    logger.info('Order status monitoring initialized (manual refresh only)');

    try {
      // Get all pending orders from database for initial count
      const pendingOrders = await this.getPendingOrders();
      logger.info(`Found ${pendingOrders.length} orders available for manual status checking`);

      this.isPolling = false; // No automatic polling
      logger.info('Order status monitoring ready - use manual refresh buttons for updates');

    } catch (error) {
      logger.error('Failed to initialize order monitoring:', error);
    }
  }







  /**
   * Get pending orders from SQLite database
   */
  private async getPendingOrders(): Promise<Order[]> {
    try {
      // Get all pending orders from all users
      const orders = userDatabase.getAllOrderHistory()
        .filter(order => ['PLACED', 'PENDING'].includes(order.status));

      // Convert OrderHistory to Order format
      return orders.map(order => ({
        id: order.id.toString(),
        user_id: order.user_id,
        symbol: order.symbol,
        action: order.action,
        quantity: order.quantity,
        price: order.price,
        status: order.status,
        broker_name: order.broker_name,
        broker_order_id: order.broker_order_id,
        created_at: order.created_at,
        updated_at: order.created_at,
        executed_at: order.executed_at,
        account_id: order.account_id,
        order_type: order.order_type,
        exchange: order.exchange,
        product_type: order.product_type,
        remarks: order.remarks
      }));
    } catch (error) {
      logger.error('Failed to get pending orders:', error);
      return [];
    }
  }

  /**
   * Stop monitoring order status
   */
  stopMonitoring(): void {
    logger.info('Stopping order status monitoring');
    this.isPolling = false;

    // Clear all polling intervals
    for (const [brokerName, intervalId] of this.pollingIntervals.entries()) {
      clearInterval(intervalId);
      logger.info(`Stopped polling for broker: ${brokerName}`);
    }

    this.pollingIntervals.clear();
    this.activeOrders.clear();
  }



  /**
   * Remove order from monitoring
   */
  removeOrderFromMonitoring(order: Order): void {
    const orderKey = `${order.broker_name}_${order.broker_order_id || order.id}`;
    this.activeOrders.delete(orderKey);

    logger.info(`Removed order ${order.id} from monitoring (${orderKey})`);

    // Check if this was the last order for this broker
    const hasOtherOrders = Array.from(this.activeOrders.keys())
      .some(key => key.startsWith(order.broker_name + '_'));

    if (!hasOtherOrders && this.pollingIntervals.has(order.broker_name)) {
      const intervalId = this.pollingIntervals.get(order.broker_name);
      if (intervalId) {
        clearInterval(intervalId);
      }
      this.pollingIntervals.delete(order.broker_name);
      logger.info(`Stopped polling for broker ${order.broker_name} - no more orders`);
    }
  }





  /**
   * Check status of a specific order using real Shoonya API
   */
  async checkOrderStatus(order: Order, retryCount: number = 0): Promise<void> {
    try {
      if (!order.broker_order_id) {
        logger.warn(`Order ${order.id} has no broker_order_id`);
        return;
      }

      logger.debug(`Checking order status for ${order.symbol} (${order.broker_order_id})`);

      // Get the broker account ID from the order
      const brokerAccountId = await this.getBrokerAccountIdFromOrder(order);
      if (!brokerAccountId) {
        logger.warn(`Could not get broker account ID for order ${order.id}`);
        return;
      }

      logger.debug(`Using broker account ID: ${brokerAccountId} for order ${order.id}`);

      let newStatus = order.status;

      // Try to get real status from broker API first
      if (brokerConnectionManager && order.broker_name === 'shoonya') {
        try {
          // Get the broker connection for the user
          const brokerService = brokerConnectionManager.getBrokerConnection(brokerAccountId, order.broker_name);

          if (brokerService) {
            logger.debug(`Getting real order status from Shoonya API for order ${order.broker_order_id}`);

            // Try to get order status from broker API
            logger.debug(`Calling broker API for order status: ${order.broker_order_id}`);
            const brokerStatus = await brokerService.getOrderStatus(brokerAccountId, order.broker_order_id);
            logger.debug(`Broker API response:`, brokerStatus);

            if (brokerStatus && (brokerStatus as any).stat === 'Ok') {
              const mappedStatus = this.mapShoonyaStatus(brokerStatus.status);
              if (mappedStatus !== order.status) {
                newStatus = mappedStatus;
                logger.info(`📊 Real API: Order ${order.id} status changed from ${order.status} to ${newStatus}`);
              }
            } else {
              logger.warn(`Failed to get order status from Shoonya API: ${(brokerStatus as any)?.emsg || 'Unknown error'}`);
            }
          } else {
            logger.warn(`No active broker connection found for user ${brokerAccountId} and broker ${order.broker_name}`);
          }
        } catch (apiError: any) {
          logger.error(`Error calling Shoonya API for order ${order.id}:`, apiError.message);
          // Fall back to simulation if API call fails
        }
      }

      // Status will only change based on real broker API responses

      // Update status if changed
      if (newStatus !== order.status) {
        await this.updateOrderStatus(order, newStatus);
      }

    } catch (error) {
      logger.error(`Error checking status for order ${order.id}:`, error);

      // Retry logic
      if (retryCount < this.maxRetries) {
        logger.info(`Retrying status check for order ${order.id} (attempt ${retryCount + 1})`);
        setTimeout(() => {
          this.checkOrderStatus(order, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
      }
    }
  }

  /**
   * Get broker account ID from order (helper method)
   */
  private async getBrokerAccountIdFromOrder(order: Order): Promise<string | null> {
    try {
      logger.debug(`Getting broker account ID for order ${order.id}`);

      // First, try to get the connected account directly using the order's account_id
      if (order.account_id) {
        logger.debug(`Order has account_id: ${order.account_id}`);

        // Get connected account using account_id (handle both MongoDB string and SQLite number)
        let account = null;
        try {
          account = await userDatabase.getConnectedAccountById(order.account_id as any);
        } catch (error) {
          logger.debug(`Failed to get connected account by ID ${order.account_id}:`, error);
        }
        logger.debug(`Connected account found:`, account ? 'Yes' : 'No');

        if (account) {
          logger.debug(`Broker account ID: ${account.account_id}`);
          return account.account_id; // This is the broker account ID (e.g., "FN135006")
        }
      }

      // Fallback: Try to get account info from order history table
      logger.debug(`Fallback: Checking order history for order ${order.id}`);
      const orderHistory = await userDatabase.getOrderHistoryById(typeof order.id === 'string' ? parseInt(order.id) : order.id);
      logger.debug(`Order history found:`, orderHistory ? 'Yes' : 'No');

      if (orderHistory) {
        logger.debug(`Order history account_id: ${orderHistory.account_id}`);

        // Get the connected account to find the broker account ID
        const account = await userDatabase.getConnectedAccountById(orderHistory.account_id);
        logger.debug(`Connected account found:`, account ? 'Yes' : 'No');

        if (account) {
          logger.debug(`Broker account ID: ${account.account_id}`);
          return account.account_id; // This is the broker account ID (e.g., "FN135006")
        }
      }

      // Final fallback: Try to get broker account ID from active broker connections
      logger.debug(`Final fallback: Checking active broker connections for user ${order.user_id}`);
      const brokerService = brokerConnectionManager.getBrokerConnection(order.user_id.toString(), order.broker_name);

      if (brokerService && brokerService.isLoggedIn()) {
        // For Shoonya, the broker account ID is the user ID
        if (order.broker_name === 'shoonya') {
          const brokerServiceTyped = brokerService as any; // Type assertion for legacy compatibility
          const userId = brokerServiceTyped.getUserId && brokerServiceTyped.getUserId();
          if (userId) {
            logger.debug(`Found broker account ID from active connection: ${userId}`);
            return userId; // This is the broker account ID (e.g., "FN135006")
          }
        }
      }

      logger.warn(`Could not find broker account ID for order ${order.id}`);
      return null;
    } catch (error) {
      logger.error(`Failed to get broker account ID for order ${order.id}:`, error);
      return null;
    }
  }

  /**
   * Map Shoonya status to our standard status
   */
  private mapShoonyaStatus(shoonyaStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'PENDING': 'PENDING',
      'OPEN': 'PLACED',
      'COMPLETE': 'EXECUTED',
      'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED',
      'TRIGGER_PENDING': 'PENDING',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
    };

    return statusMap[shoonyaStatus] || shoonyaStatus;
  }



  /**
   * Update order status in database and emit event
   */
  async updateOrderStatus(order: Order, newStatus: string, executionData?: {
    executedQuantity?: number;
    averagePrice?: number;
    rejectionReason?: string;
    updateTime?: string;
  }): Promise<void> {
    try {
      const oldStatus = order.status;
      const now = new Date().toISOString();

      // Update in SQLite database (order_history table)
      logger.info(`Updating order ${order.id} in database: ${oldStatus} → ${newStatus}`);

      try {
        // Use the broker_order_id to update the database
        const updated = userDatabase.updateOrderStatus(
          order.broker_order_id || order.id,
          newStatus as 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED'
        );

        if (updated) {
          logger.info(`✅ Database updated successfully for order ${order.id}`);
        } else {
          logger.warn(`⚠️ No rows updated in database for order ${order.id} (broker_order_id: ${order.broker_order_id})`);
        }
      } catch (dbError: any) {
        logger.error(`🚨 Failed to update database for order ${order.id}:`, dbError.message);
      }

      // Update local order object
      order.status = newStatus;
      if (newStatus === 'EXECUTED') {
        order.executed_at = now;
      }
      order.updated_at = now;

      logger.info(`Order ${order.id} status updated: ${oldStatus} → ${newStatus}`);

      // WebSocket broadcasting removed - using manual refresh only

      // Send push notification for order status change
      try {
        const orderNotificationData: OrderNotificationData = {
          orderId: order.id,
          symbol: order.symbol,
          action: order.action as 'BUY' | 'SELL',
          quantity: order.quantity,
          price: order.price,
          oldStatus,
          newStatus,
          brokerName: order.broker_name,
          timestamp: now
        };

        await notificationService.sendOrderStatusNotification(order.user_id.toString(), orderNotificationData);
        logger.info(`📱 Push notification sent for order ${order.id} status change`);
      } catch (notificationError) {
        logger.error(`Failed to send push notification for order ${order.id}:`, notificationError);
        // Don't fail the entire operation if notification fails
      }

      // Remove from monitoring if order is complete
      if (['EXECUTED', 'CANCELLED', 'REJECTED'].includes(newStatus)) {
        this.removeOrderFromMonitoring(order);
      }

    } catch (error) {
      logger.error(`Failed to update order ${order.id} status:`, error);
    }
  }

  /**
   * Add a new order to monitoring (manual refresh only)
   */
  async addOrderToMonitoring(order: Order): Promise<void> {
    try {
      // Add to active orders for manual status checking
      this.activeOrders.set(order.id, order);
      logger.info(`📊 Added order ${order.id} to manual monitoring`);

    } catch (error: any) {
      logger.error(`🚨 Failed to add order ${order.id} to monitoring:`, error.message);
    }
  }

  /**
   * Get monitoring statistics
   */
  getMonitoringStats() {
    return {
      isPolling: this.isPolling,
      activeBrokers: this.pollingIntervals.size,
      activeOrders: this.activeOrders.size,
      pollingFrequency: this.pollingFrequency,
      brokers: Array.from(this.pollingIntervals.keys())
    };
  }
}

// Create singleton instance
const orderStatusService = new OrderStatusService();

export default orderStatusService;
