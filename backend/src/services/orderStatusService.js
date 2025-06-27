const EventEmitter = require('events');
const { Order } = require('../models');
const brokerService = require('./brokerService');
const logger = require('../utils/logger');

class OrderStatusService extends EventEmitter {
  constructor() {
    super();
    this.pollingIntervals = new Map(); // Track polling intervals per broker
    this.activeOrders = new Map(); // Track orders being monitored
    this.isPolling = false;
    this.pollingFrequency = 5000; // 5 seconds default
    this.maxRetries = 3;
  }

  /**
   * Start monitoring order status for all active orders
   */
  async startMonitoring() {
    if (this.isPolling) {
      logger.info('Order status monitoring already running');
      return;
    }

    this.isPolling = true;
    logger.info('Starting real-time order status monitoring');

    try {
      // Get all pending orders from database
      const pendingOrders = await Order.findAll({
        where: {
          status: ['PLACED', 'PENDING', 'PARTIALLY_FILLED']
        }
      });

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
   * Stop monitoring order status
   */
  stopMonitoring() {
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
  async addOrderToMonitoring(order) {
    if (!this.isPolling) {
      await this.startMonitoring();
    }

    const orderKey = `${order.broker_name}_${order.broker_order_id}`;
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
  removeOrderFromMonitoring(order) {
    const orderKey = `${order.broker_name}_${order.broker_order_id}`;
    this.activeOrders.delete(orderKey);

    logger.info(`Removed order ${order.id} from monitoring (${orderKey})`);

    // Check if this was the last order for this broker
    const hasOtherOrders = Array.from(this.activeOrders.keys())
      .some(key => key.startsWith(order.broker_name + '_'));

    if (!hasOtherOrders && this.pollingIntervals.has(order.broker_name)) {
      clearInterval(this.pollingIntervals.get(order.broker_name));
      this.pollingIntervals.delete(order.broker_name);
      logger.info(`Stopped polling for broker ${order.broker_name} - no more orders`);
    }
  }

  /**
   * Group orders by broker for efficient polling
   */
  groupOrdersByBroker(orders) {
    const grouped = new Map();
    
    for (const order of orders) {
      if (!grouped.has(order.broker_name)) {
        grouped.set(order.broker_name, []);
      }
      grouped.get(order.broker_name).push(order);
      
      // Add to active orders tracking
      const orderKey = `${order.broker_name}_${order.broker_order_id}`;
      this.activeOrders.set(orderKey, order);
    }

    return grouped;
  }

  /**
   * Start polling for a specific broker
   */
  startBrokerPolling(brokerName, initialOrders) {
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
  async pollBrokerOrders(brokerName) {
    try {
      // Get all active orders for this broker
      const brokerOrders = Array.from(this.activeOrders.values())
        .filter(order => order.broker_name === brokerName);

      if (brokerOrders.length === 0) {
        return;
      }

      logger.debug(`Polling ${brokerOrders.length} orders for broker: ${brokerName}`);

      // Get broker service instance
      const broker = brokerService.getBrokerInstance(brokerName);
      if (!broker) {
        logger.error(`No broker service found for: ${brokerName}`);
        return;
      }

      // Check status for each order
      for (const order of brokerOrders) {
        await this.checkOrderStatus(broker, order);
      }

    } catch (error) {
      logger.error(`Error polling orders for broker ${brokerName}:`, error);
    }
  }

  /**
   * Check status of a specific order
   */
  async checkOrderStatus(broker, order, retryCount = 0) {
    try {
      // Get current status from broker
      const brokerStatus = await broker.getOrderStatus(order.broker_order_id);
      
      if (!brokerStatus) {
        logger.warn(`No status returned for order ${order.broker_order_id}`);
        return;
      }

      // Map broker status to our standard status
      const standardStatus = this.mapBrokerStatus(brokerStatus.status);
      
      // Check if status has changed
      if (standardStatus !== order.status) {
        await this.updateOrderStatus(order, standardStatus, brokerStatus);
      }

      // Update execution details if available
      if (brokerStatus.executed_quantity && brokerStatus.executed_quantity > 0) {
        await this.updateExecutionDetails(order, brokerStatus);
      }

    } catch (error) {
      logger.error(`Error checking status for order ${order.id}:`, error);

      // Retry logic
      if (retryCount < this.maxRetries) {
        logger.info(`Retrying status check for order ${order.id} (attempt ${retryCount + 1})`);
        setTimeout(() => {
          this.checkOrderStatus(broker, order, retryCount + 1);
        }, 1000 * (retryCount + 1)); // Exponential backoff
      }
    }
  }

  /**
   * Map broker-specific status to standard status
   */
  mapBrokerStatus(brokerStatus) {
    const statusMap = {
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
  async updateOrderStatus(order, newStatus, brokerData) {
    try {
      const oldStatus = order.status;
      
      // Update in database
      await Order.update({
        status: newStatus,
        executed_at: newStatus === 'EXECUTED' ? new Date() : order.executed_at,
        updated_at: new Date()
      }, {
        where: { id: order.id }
      });

      // Update local order object
      order.status = newStatus;
      if (newStatus === 'EXECUTED') {
        order.executed_at = new Date();
      }

      logger.info(`Order ${order.id} status updated: ${oldStatus} → ${newStatus}`);

      // Emit status change event
      this.emit('orderStatusChanged', {
        orderId: order.id,
        oldStatus,
        newStatus,
        order,
        brokerData,
        timestamp: new Date()
      });

      // Remove from monitoring if order is complete
      if (['EXECUTED', 'CANCELLED', 'REJECTED'].includes(newStatus)) {
        this.removeOrderFromMonitoring(order);
      }

    } catch (error) {
      logger.error(`Failed to update order ${order.id} status:`, error);
    }
  }

  /**
   * Update execution details for partially filled orders
   */
  async updateExecutionDetails(order, brokerData) {
    try {
      const updateData = {};
      
      if (brokerData.executed_quantity) {
        updateData.executed_quantity = brokerData.executed_quantity;
      }
      
      if (brokerData.average_price) {
        updateData.average_price = brokerData.average_price;
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date();
        
        await Order.update(updateData, {
          where: { id: order.id }
        });

        // Update local order object
        Object.assign(order, updateData);

        // Emit execution update event
        this.emit('orderExecutionUpdated', {
          orderId: order.id,
          order,
          executionData: updateData,
          timestamp: new Date()
        });
      }

    } catch (error) {
      logger.error(`Failed to update execution details for order ${order.id}:`, error);
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

module.exports = orderStatusService;
