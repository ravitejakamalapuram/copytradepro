const express = require('express');
const router = express.Router();
const { Order } = require('../models');
const orderStatusService = require('../services/orderStatusService');
const websocketService = require('../services/websocketService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

/**
 * Get real-time monitoring status
 */
router.get('/monitoring/status', auth, async (req, res) => {
  try {
    const orderStats = orderStatusService.getMonitoringStats();
    const wsStats = websocketService.getStats();

    res.json({
      success: true,
      data: {
        orderMonitoring: orderStats,
        websocket: wsStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Error getting monitoring status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monitoring status'
    });
  }
});

/**
 * Start order monitoring
 */
router.post('/monitoring/start', auth, async (req, res) => {
  try {
    await orderStatusService.startMonitoring();
    
    res.json({
      success: true,
      message: 'Order monitoring started',
      data: orderStatusService.getMonitoringStats()
    });
  } catch (error) {
    logger.error('Error starting monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start monitoring'
    });
  }
});

/**
 * Stop order monitoring
 */
router.post('/monitoring/stop', auth, async (req, res) => {
  try {
    orderStatusService.stopMonitoring();
    
    res.json({
      success: true,
      message: 'Order monitoring stopped'
    });
  } catch (error) {
    logger.error('Error stopping monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop monitoring'
    });
  }
});

/**
 * Add specific order to monitoring
 */
router.post('/monitoring/orders/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if order is in a monitorable state
    if (!['PLACED', 'PENDING', 'PARTIALLY_FILLED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: `Order status '${order.status}' is not monitorable`
      });
    }

    await orderStatusService.addOrderToMonitoring(order);
    
    res.json({
      success: true,
      message: `Order ${orderId} added to monitoring`,
      data: {
        orderId: order.id,
        status: order.status,
        broker: order.broker_name
      }
    });
  } catch (error) {
    logger.error('Error adding order to monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add order to monitoring'
    });
  }
});

/**
 * Remove specific order from monitoring
 */
router.delete('/monitoring/orders/:orderId', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    orderStatusService.removeOrderFromMonitoring(order);
    
    res.json({
      success: true,
      message: `Order ${orderId} removed from monitoring`
    });
  } catch (error) {
    logger.error('Error removing order from monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove order from monitoring'
    });
  }
});

/**
 * Force refresh order status
 */
router.post('/orders/:orderId/refresh', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Get broker service
    const brokerService = require('../services/brokerService');
    const broker = brokerService.getBrokerInstance(order.broker_name);
    
    if (!broker) {
      return res.status(400).json({
        success: false,
        error: `No broker service available for ${order.broker_name}`
      });
    }

    // Get current status from broker
    const brokerStatus = await broker.getOrderStatus(order.broker_order_id);
    
    if (!brokerStatus) {
      return res.status(404).json({
        success: false,
        error: 'Order not found on broker'
      });
    }

    // Map and update status if changed
    const standardStatus = orderStatusService.mapBrokerStatus(brokerStatus.status);
    
    if (standardStatus !== order.status) {
      await orderStatusService.updateOrderStatus(order, standardStatus, brokerStatus);
    }

    // Get updated order
    const updatedOrder = await Order.findByPk(orderId);
    
    res.json({
      success: true,
      message: 'Order status refreshed',
      data: {
        orderId: updatedOrder.id,
        oldStatus: order.status,
        newStatus: updatedOrder.status,
        brokerData: brokerStatus,
        lastUpdated: updatedOrder.updated_at
      }
    });
  } catch (error) {
    logger.error('Error refreshing order status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh order status'
    });
  }
});

/**
 * Get order status history
 */
router.get('/orders/:orderId/status-history', auth, async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // For now, return current order status
    // In production, you might want to store status history in a separate table
    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const statusHistory = [
      {
        status: 'PLACED',
        timestamp: order.created_at,
        source: 'system'
      }
    ];

    if (order.status !== 'PLACED') {
      statusHistory.push({
        status: order.status,
        timestamp: order.updated_at,
        source: 'broker'
      });
    }

    if (order.executed_at) {
      statusHistory.push({
        status: 'EXECUTED',
        timestamp: order.executed_at,
        source: 'broker'
      });
    }

    res.json({
      success: true,
      data: {
        orderId: order.id,
        currentStatus: order.status,
        history: statusHistory
      }
    });
  } catch (error) {
    logger.error('Error getting order status history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order status history'
    });
  }
});

/**
 * Get all orders being monitored
 */
router.get('/monitoring/orders', auth, async (req, res) => {
  try {
    const stats = orderStatusService.getMonitoringStats();
    
    // Get detailed order information
    const monitoredOrders = await Order.findAll({
      where: {
        status: ['PLACED', 'PENDING', 'PARTIALLY_FILLED']
      },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        monitoring: stats,
        orders: monitoredOrders.map(order => ({
          id: order.id,
          symbol: order.symbol,
          action: order.action,
          quantity: order.quantity,
          price: order.price,
          status: order.status,
          broker_name: order.broker_name,
          broker_order_id: order.broker_order_id,
          created_at: order.created_at,
          updated_at: order.updated_at
        }))
      }
    });
  } catch (error) {
    logger.error('Error getting monitored orders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monitored orders'
    });
  }
});

/**
 * Update monitoring configuration
 */
router.put('/monitoring/config', auth, async (req, res) => {
  try {
    const { pollingFrequency, maxRetries } = req.body;
    
    if (pollingFrequency && pollingFrequency >= 1000) {
      orderStatusService.pollingFrequency = pollingFrequency;
    }
    
    if (maxRetries && maxRetries >= 1) {
      orderStatusService.maxRetries = maxRetries;
    }

    res.json({
      success: true,
      message: 'Monitoring configuration updated',
      data: {
        pollingFrequency: orderStatusService.pollingFrequency,
        maxRetries: orderStatusService.maxRetries
      }
    });
  } catch (error) {
    logger.error('Error updating monitoring config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update monitoring configuration'
    });
  }
});

module.exports = router;
