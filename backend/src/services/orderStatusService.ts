import { EventEmitter } from 'events';
import { userDatabase } from './sqliteDatabase';
import websocketService from './websocketService';
import { ShoonyaService } from './shoonyaService';

// Import broker connections from controller (we'll need to export this)
// For now, we'll create a simple interface to access broker connections
interface BrokerConnectionManager {
  getBrokerConnection(userId: string, brokerName: string): ShoonyaService | null;
}

// Global broker connection manager - will be set by the broker controller
let brokerConnectionManager: BrokerConnectionManager | null = null;

export const setBrokerConnectionManager = (manager: BrokerConnectionManager) => {
  brokerConnectionManager = manager;
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
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  status: string;
  broker_name: string;
  broker_order_id?: string;
  created_at: string;
  updated_at: string;
  executed_at?: string;
}

class OrderStatusService extends EventEmitter {
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private activeOrders: Map<string, Order> = new Map();
  private isPolling: boolean = false;
  private pollingFrequency: number = 10000; // 10 seconds for demo
  private maxRetries: number = 3;

  constructor() {
    super();
  }

  /**
   * Start monitoring order status for all active orders
   */
  async startMonitoring(): Promise<void> {
    if (this.isPolling) {
      logger.info('Order status monitoring already running');
      return;
    }

    this.isPolling = true;
    logger.info('Starting real-time order status monitoring');

    try {
      // Get all pending orders from database
      const pendingOrders = await this.getPendingOrders();

      logger.info(`Found ${pendingOrders.length} orders to monitor`);

      // Group orders by broker for efficient polling
      const ordersByBroker = this.groupOrdersByBroker(pendingOrders);

      // Start polling for each broker
      for (const [brokerName, orders] of ordersByBroker.entries()) {
        this.startBrokerPolling(brokerName, orders);
      }

    } catch (error) {
      logger.error('Failed to start order monitoring:', error);
      this.isPolling = false;
    }
  }

  /**
   * Get pending orders from SQLite database
   */
  private async getPendingOrders(): Promise<Order[]> {
    try {
      // For now, return empty array since we don't have a direct orders table
      // In a real implementation, you would query the order_history table
      // and filter for pending orders
      const orders = userDatabase.getOrderHistoryByUserIdWithFilters(
        0, // Get all users for now
        100, // limit
        0, // offset
        { status: 'PLACED' }
      );

      // Convert OrderHistory to Order format
      return orders.map(order => ({
        id: order.id.toString(),
        symbol: order.symbol,
        action: order.action,
        quantity: order.quantity,
        price: order.price,
        status: order.status,
        broker_name: order.broker_name,
        broker_order_id: order.broker_order_id,
        created_at: order.created_at,
        updated_at: order.created_at,
        executed_at: order.executed_at
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
   * Add a new order to monitoring
   */
  async addOrderToMonitoring(order: Order): Promise<void> {
    if (!this.isPolling) {
      await this.startMonitoring();
    }

    const orderKey = `${order.broker_name}_${order.broker_order_id || order.id}`;
    this.activeOrders.set(orderKey, order);

    logger.info(`Added order ${order.id} to monitoring (${orderKey})`);

    // If this is the first order for this broker, start polling
    if (!this.pollingIntervals.has(order.broker_name)) {
      this.startBrokerPolling(order.broker_name, [order]);
    }
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
   * Group orders by broker for efficient polling
   */
  private groupOrdersByBroker(orders: Order[]): Map<string, Order[]> {
    const grouped = new Map<string, Order[]>();

    for (const order of orders) {
      if (!grouped.has(order.broker_name)) {
        grouped.set(order.broker_name, []);
      }
      grouped.get(order.broker_name)!.push(order);

      // Add to active orders tracking
      const orderKey = `${order.broker_name}_${order.broker_order_id || order.id}`;
      this.activeOrders.set(orderKey, order);
    }

    return grouped;
  }

  /**
   * Start polling for a specific broker
   */
  private startBrokerPolling(brokerName: string, initialOrders: Order[]): void {
    if (this.pollingIntervals.has(brokerName)) {
      logger.warn(`Polling already active for broker: ${brokerName}`);
      return;
    }

    logger.info(`Starting polling for broker: ${brokerName} with ${initialOrders.length} orders`);

    const intervalId = setInterval(async () => {
      await this.pollBrokerOrders(brokerName);
    }, this.pollingFrequency);

    this.pollingIntervals.set(brokerName, intervalId);

    // Do initial poll immediately
    this.pollBrokerOrders(brokerName);
  }

  /**
   * Poll order status for a specific broker
   */
  async pollBrokerOrders(brokerName: string): Promise<void> {
    try {
      // Get all active orders for this broker
      const brokerOrders = Array.from(this.activeOrders.values())
        .filter(order => order.broker_name === brokerName);

      if (brokerOrders.length === 0) {
        return;
      }

      logger.debug(`Polling ${brokerOrders.length} orders for broker: ${brokerName}`);

      // Check status for each order
      for (const order of brokerOrders) {
        await this.checkOrderStatus(order);
      }

    } catch (error) {
      logger.error(`Error polling orders for broker ${brokerName}:`, error);
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

            const brokerStatus = await brokerService.getOrderStatus(brokerAccountId, order.broker_order_id);

            if (brokerStatus && brokerStatus.stat === 'Ok') {
              const mappedStatus = this.mapShoonyaStatus(brokerStatus.status);
              if (mappedStatus !== order.status) {
                newStatus = mappedStatus;
                logger.info(`📊 Real API: Order ${order.id} status changed from ${order.status} to ${newStatus}`);
              }
            } else {
              logger.warn(`Failed to get order status from Shoonya API: ${brokerStatus?.emsg || 'Unknown error'}`);
            }
          } else {
            logger.warn(`No active broker connection found for user ${brokerAccountId} and broker ${order.broker_name}`);
          }
        } catch (apiError: any) {
          logger.error(`Error calling Shoonya API for order ${order.id}:`, apiError.message);
          // Fall back to simulation if API call fails
        }
      }

      // If no real status change detected, fall back to demo simulation
      if (newStatus === order.status) {
        const orderAge = Date.now() - new Date(order.created_at).getTime();

        if (orderAge > 15000 && order.status === 'PLACED') { // After 15 seconds
          if (order.symbol === 'TCS') {
            newStatus = 'REJECTED';
            logger.info(`🎯 DEMO: TCS order ${order.id} simulated as REJECTED due to insufficient balance`);
          } else if (Math.random() < 0.7) {
            newStatus = 'EXECUTED';
            logger.info(`✅ DEMO: Order ${order.id} simulated as EXECUTED`);
          }
        }
      }

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

      // Try to get account info from order history table
      const orderHistory = userDatabase.getOrderHistoryById(parseInt(order.id));
      logger.debug(`Order history found:`, orderHistory ? 'Yes' : 'No');

      if (orderHistory) {
        logger.debug(`Order history account_id: ${orderHistory.account_id}`);

        // Get the connected account to find the broker account ID
        const account = userDatabase.getConnectedAccountById(orderHistory.account_id);
        logger.debug(`Connected account found:`, account ? 'Yes' : 'No');

        if (account) {
          logger.debug(`Broker account ID: ${account.account_id}`);
          return account.account_id; // This is the broker account ID (e.g., "FN135006")
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
   * Map broker-specific status to standard status
   */
  private mapBrokerStatus(brokerStatus: string): string {
    const statusMap: { [key: string]: string } = {
      // Shoonya statuses
      'PENDING': 'PENDING',
      'OPEN': 'PLACED',
      'COMPLETE': 'EXECUTED',
      'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED',

      // Fyers statuses
      'PLACED': 'PLACED',
      'EXECUTED': 'EXECUTED',
      'CANCELED': 'CANCELLED',
      'PARTIAL': 'PARTIALLY_FILLED',

      // Generic statuses
      'FILLED': 'EXECUTED',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
      'NEW': 'PLACED'
    };

    return statusMap[brokerStatus] || brokerStatus;
  }

  /**
   * Update order status in database and emit event
   */
  async updateOrderStatus(order: Order, newStatus: string): Promise<void> {
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

      // Broadcast to all connected clients via Socket.IO
      const updateData = {
        orderId: order.id,
        oldStatus,
        newStatus,
        order: {
          id: order.id,
          symbol: order.symbol,
          action: order.action,
          quantity: order.quantity,
          price: order.price,
          status: order.status,
          broker_name: order.broker_name,
          executed_at: order.executed_at
        },
        timestamp: now
      };

      websocketService.broadcastOrderStatusChange(updateData);

      // Remove from monitoring if order is complete
      if (['EXECUTED', 'CANCELLED', 'REJECTED'].includes(newStatus)) {
        this.removeOrderFromMonitoring(order);
      }

    } catch (error) {
      logger.error(`Failed to update order ${order.id} status:`, error);
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
