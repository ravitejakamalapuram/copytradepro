import { EventEmitter } from 'events';
import { userDatabase } from './sqliteDatabase';
import websocketService from './websocketService';
import { ShoonyaService } from './shoonyaService';
import { notificationService, OrderNotificationData } from './notificationService';
import shoonyaWebSocketService, { ShoonyaOrderUpdate } from './shoonyaWebSocketService';

// Import broker connections from controller
import { userBrokerConnections } from '../controllers/brokerController';

// Broker connection manager interface
interface BrokerConnectionManager {
  getBrokerConnection(userId: string, brokerName: string): ShoonyaService | null;
}

// Create broker connection manager implementation
const brokerConnectionManager: BrokerConnectionManager = {
  getBrokerConnection(userId: string, brokerName: string): ShoonyaService | null {
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
      const shoonyaService = brokerService as ShoonyaService;
      if (shoonyaService.isLoggedIn()) {
        console.log(`✅ Found active ${brokerName} connection for user ${userId}`);
        return shoonyaService;
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
  private useWebSocket: boolean = true; // Prefer WebSocket over polling
  private connectedBrokerAccounts: Set<string> = new Set(); // Track WebSocket subscriptions

  constructor() {
    super();
    this.setupWebSocketHandlers();
  }

  /**
   * Setup WebSocket event handlers for real-time order updates
   */
  private setupWebSocketHandlers(): void {
    // Listen for real-time order updates from Shoonya WebSocket
    shoonyaWebSocketService.on('order_update', (orderUpdate: ShoonyaOrderUpdate) => {
      this.handleWebSocketOrderUpdate(orderUpdate);
    });

    shoonyaWebSocketService.on('connected', () => {
      logger.info('✅ Shoonya WebSocket connected - real-time order updates enabled');
    });

    shoonyaWebSocketService.on('disconnected', () => {
      logger.warn('❌ Shoonya WebSocket disconnected - falling back to polling if needed');
    });

    shoonyaWebSocketService.on('error', (error: Error) => {
      logger.error('🚨 Shoonya WebSocket error:', error.message);
    });
  }

  /**
   * Handle real-time order updates from Shoonya WebSocket
   */
  private async handleWebSocketOrderUpdate(orderUpdate: ShoonyaOrderUpdate): Promise<void> {
    try {
      logger.info(`📊 WebSocket order update: ${orderUpdate.norenordno} -> ${orderUpdate.status}`);

      // Find the order in our database by broker order ID
      const order = await this.findOrderByBrokerOrderId(orderUpdate.norenordno);

      if (!order) {
        logger.warn(`⚠️ Order not found in database: ${orderUpdate.norenordno}`);
        return;
      }

      // Map Shoonya status to our internal status
      const newStatus = this.mapShoonyaStatus(orderUpdate.status);

      if (newStatus !== order.status) {
        logger.info(`📊 WebSocket: Order ${order.id} status changed from ${order.status} to ${newStatus}`);

        // Update order in database
        await this.updateOrderStatus(order, newStatus, {
          executedQuantity: parseInt(orderUpdate.fillshares) || 0,
          averagePrice: parseFloat(orderUpdate.avgprc) || 0,
          rejectionReason: orderUpdate.rejreason || '',
          updateTime: orderUpdate.exch_tm
        });
      }

    } catch (error: any) {
      logger.error('🚨 Error handling WebSocket order update:', error.message);
    }
  }

  /**
   * Find order by broker order ID
   */
  private async findOrderByBrokerOrderId(brokerOrderId: string): Promise<Order | null> {
    try {
      const allOrders = userDatabase.getAllOrderHistory();
      const orderHistory = allOrders.find(order => order.broker_order_id === brokerOrderId);

      if (!orderHistory) {
        return null;
      }

      // Convert to Order format
      return {
        id: orderHistory.id.toString(),
        user_id: orderHistory.user_id.toString(),
        account_id: orderHistory.account_id.toString(),
        symbol: orderHistory.symbol,
        action: orderHistory.action,
        quantity: orderHistory.quantity,
        price: orderHistory.price,
        status: orderHistory.status,
        broker_name: orderHistory.broker_name,
        broker_order_id: orderHistory.broker_order_id,
        order_type: orderHistory.order_type,
        exchange: orderHistory.exchange,
        product_type: orderHistory.product_type,
        remarks: orderHistory.remarks || '',
        created_at: orderHistory.created_at,
        updated_at: orderHistory.created_at,
        executed_at: orderHistory.executed_at
      };
    } catch (error: any) {
      logger.error('Error finding order by broker order ID:', error.message);
      return null;
    }
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

      if (this.useWebSocket) {
        // Use WebSocket for real-time updates
        await this.startWebSocketMonitoring(pendingOrders);
      } else {
        // Fallback to polling
        await this.startPollingMonitoring(pendingOrders);
      }

    } catch (error) {
      logger.error('Failed to start order monitoring:', error);
      this.isPolling = false;
    }
  }

  /**
   * Start WebSocket-based monitoring
   */
  private async startWebSocketMonitoring(pendingOrders: Order[]): Promise<void> {
    logger.info('🔄 Starting WebSocket-based order monitoring');

    // Group orders by user/broker account
    const ordersByAccount = this.groupOrdersByAccount(pendingOrders);

    // Connect to WebSocket for each broker account
    for (const [accountInfo, orders] of ordersByAccount.entries()) {
      await this.connectWebSocketForAccount(accountInfo, orders);
    }

    // Store active orders for tracking
    for (const order of pendingOrders) {
      this.activeOrders.set(order.id, order);
    }
  }

  /**
   * Start polling-based monitoring (fallback)
   */
  private async startPollingMonitoring(pendingOrders: Order[]): Promise<void> {
    logger.info('🔄 Starting polling-based order monitoring (fallback)');

    // Group orders by broker for efficient polling
    const ordersByBroker = this.groupOrdersByBroker(pendingOrders);

    // Start polling for each broker
    for (const [brokerName, orders] of ordersByBroker.entries()) {
      this.startBrokerPolling(brokerName, orders);
    }
  }

  /**
   * Group orders by account for WebSocket subscriptions
   */
  private groupOrdersByAccount(orders: Order[]): Map<string, Order[]> {
    const ordersByAccount = new Map<string, Order[]>();

    for (const order of orders) {
      const accountKey = `${order.user_id}:${order.broker_name}`;

      if (!ordersByAccount.has(accountKey)) {
        ordersByAccount.set(accountKey, []);
      }

      ordersByAccount.get(accountKey)!.push(order);
    }

    return ordersByAccount;
  }

  /**
   * Connect WebSocket for a specific broker account
   */
  private async connectWebSocketForAccount(accountInfo: string, orders: Order[]): Promise<void> {
    try {
      const [userId, brokerName] = accountInfo.split(':');

      if (brokerName !== 'shoonya') {
        logger.warn(`⚠️ WebSocket not supported for broker: ${brokerName}`);
        return;
      }

      // TODO: Get broker connection to get session token
      // For now, skip WebSocket connection since broker connection manager is not available
      logger.warn(`⚠️ WebSocket connection not implemented yet for account: ${accountInfo}`);
      return;

    } catch (error: any) {
      logger.error(`🚨 Failed to connect WebSocket for account ${accountInfo}:`, error.message);
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

      // Try to get account info from order history table
      const orderHistory = userDatabase.getOrderHistoryById(typeof order.id === 'string' ? parseInt(order.id) : order.id);
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
   * Add a new order to monitoring (called when order is placed)
   */
  async addOrderToMonitoring(order: Order): Promise<void> {
    try {
      // Add to active orders
      this.activeOrders.set(order.id, order);

      if (this.useWebSocket && order.broker_name === 'shoonya') {
        // Ensure WebSocket is connected for this user
        const accountKey = `${order.user_id}:${order.broker_name}`;

        if (!this.connectedBrokerAccounts.has(accountKey)) {
          await this.connectWebSocketForAccount(accountKey, [order]);
        }

        logger.info(`📊 Added order ${order.id} to WebSocket monitoring`);
      } else {
        // Add to polling if WebSocket not available
        const brokerOrders = [order];
        this.startBrokerPolling(order.broker_name, brokerOrders);
        logger.info(`📊 Added order ${order.id} to polling monitoring`);
      }

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
