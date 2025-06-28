import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { advancedOrderService } from '../services/advancedOrderService';
import { body, validationResult } from 'express-validator';

const router = express.Router();

/**
 * Create order template
 */
router.post('/templates', 
  authenticateToken,
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('symbol').notEmpty().withMessage('Symbol is required'),
    body('action').isIn(['BUY', 'SELL']).withMessage('Action must be BUY or SELL'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('order_type').isIn(['MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET', 'BRACKET', 'COVER', 'ICEBERG', 'TRAILING_SL']).withMessage('Invalid order type'),
    body('exchange').optional().isString(),
    body('product_type').optional().isString(),
    body('validity').optional().isIn(['DAY', 'IOC', 'GTD'])
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const templateData = {
        user_id: userId,
        name: req.body.name,
        description: req.body.description,
        symbol: req.body.symbol,
        action: req.body.action,
        quantity: req.body.quantity,
        order_type: req.body.order_type,
        price: req.body.price,
        trigger_price: req.body.trigger_price,
        stop_loss: req.body.stop_loss,
        take_profit: req.body.take_profit,
        exchange: req.body.exchange || 'NSE',
        product_type: req.body.product_type || 'C',
        validity: req.body.validity || 'DAY',
        iceberg_quantity: req.body.iceberg_quantity,
        trail_amount: req.body.trail_amount,
        trail_percent: req.body.trail_percent,
        is_active: req.body.is_active !== false
      };

      const template = advancedOrderService.createOrderTemplate(templateData);

      return res.json({
        success: true,
        data: template
      });
    } catch (error: any) {
      console.error('Failed to create order template:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create order template',
        details: error.message
      });
    }
  }
);

/**
 * Get user's order templates
 */
router.get('/templates', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const activeOnly = req.query.active_only === 'true';
    const templates = advancedOrderService.getUserOrderTemplates(userId, activeOnly);

    return res.json({
      success: true,
      data: {
        templates,
        count: templates.length
      }
    });
  } catch (error: any) {
    console.error('Failed to get order templates:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get order templates',
      details: error.message
    });
  }
});

/**
 * Get specific order template
 */
router.get('/templates/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const templateId = parseInt(req.params.id);
    const template = advancedOrderService.getOrderTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Order template not found'
      });
    }

    // Check if template belongs to user
    if (template.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    return res.json({
      success: true,
      data: template
    });
  } catch (error: any) {
    console.error('Failed to get order template:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get order template',
      details: error.message
    });
  }
});

/**
 * Update order template
 */
router.put('/templates/:id', 
  authenticateToken,
  [
    body('name').optional().notEmpty().withMessage('Template name cannot be empty'),
    body('symbol').optional().notEmpty().withMessage('Symbol cannot be empty'),
    body('action').optional().isIn(['BUY', 'SELL']).withMessage('Action must be BUY or SELL'),
    body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('order_type').optional().isIn(['MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET', 'BRACKET', 'COVER', 'ICEBERG', 'TRAILING_SL']).withMessage('Invalid order type'),
    body('validity').optional().isIn(['DAY', 'IOC', 'GTD'])
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const templateId = parseInt(req.params.id);
      const template = advancedOrderService.getOrderTemplate(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Order template not found'
        });
      }

      // Check if template belongs to user
      if (template.user_id !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const updates = {
        name: req.body.name,
        description: req.body.description,
        symbol: req.body.symbol,
        action: req.body.action,
        quantity: req.body.quantity,
        order_type: req.body.order_type,
        price: req.body.price,
        trigger_price: req.body.trigger_price,
        stop_loss: req.body.stop_loss,
        take_profit: req.body.take_profit,
        exchange: req.body.exchange,
        product_type: req.body.product_type,
        validity: req.body.validity,
        iceberg_quantity: req.body.iceberg_quantity,
        trail_amount: req.body.trail_amount,
        trail_percent: req.body.trail_percent,
        is_active: req.body.is_active
      };

      const success = advancedOrderService.updateOrderTemplate(templateId, updates);

      if (!success) {
        return res.status(500).json({
          success: false,
          error: 'Failed to update order template'
        });
      }

      const updatedTemplate = advancedOrderService.getOrderTemplate(templateId);

      return res.json({
        success: true,
        data: updatedTemplate
      });
    } catch (error: any) {
      console.error('Failed to update order template:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update order template',
        details: error.message
      });
    }
  }
);

/**
 * Delete order template
 */
router.delete('/templates/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const templateId = parseInt(req.params.id);
    const template = advancedOrderService.getOrderTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Order template not found'
      });
    }

    // Check if template belongs to user
    if (template.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const success = advancedOrderService.deleteOrderTemplate(templateId, userId);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete order template'
      });
    }

    return res.json({
      success: true,
      message: 'Order template deleted successfully'
    });
  } catch (error: any) {
    console.error('Failed to delete order template:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete order template',
      details: error.message
    });
  }
});

/**
 * Create bracket order
 */
router.post('/bracket',
  authenticateToken,
  [
    body('symbol').notEmpty().withMessage('Symbol is required'),
    body('action').isIn(['BUY', 'SELL']).withMessage('Action must be BUY or SELL'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('stop_loss').isFloat({ min: 0 }).withMessage('Stop loss must be a positive number'),
    body('take_profit').isFloat({ min: 0 }).withMessage('Take profit must be a positive number'),
    body('exchange').optional().isString(),
    body('product_type').optional().isString(),
    body('validity').optional().isIn(['DAY', 'IOC', 'GTD'])
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const orderData = {
        symbol: req.body.symbol,
        action: req.body.action,
        quantity: req.body.quantity,
        price: req.body.price,
        stop_loss: req.body.stop_loss,
        take_profit: req.body.take_profit,
        exchange: req.body.exchange || 'NSE',
        product_type: req.body.product_type || 'C',
        validity: req.body.validity || 'DAY'
      };

      const orderGroupId = advancedOrderService.createBracketOrder(userId, orderData);
      const orders = advancedOrderService.getOrdersByGroupId(orderGroupId);

      return res.json({
        success: true,
        data: {
          order_group_id: orderGroupId,
          orders,
          message: 'Bracket order created successfully'
        }
      });
    } catch (error: any) {
      console.error('Failed to create bracket order:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create bracket order',
        details: error.message
      });
    }
  }
);

/**
 * Create iceberg order
 */
router.post('/iceberg',
  authenticateToken,
  [
    body('symbol').notEmpty().withMessage('Symbol is required'),
    body('action').isIn(['BUY', 'SELL']).withMessage('Action must be BUY or SELL'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    body('iceberg_quantity').isInt({ min: 1 }).withMessage('Iceberg quantity must be a positive integer'),
    body('exchange').optional().isString(),
    body('product_type').optional().isString(),
    body('validity').optional().isIn(['DAY', 'IOC', 'GTD'])
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Validate iceberg quantity is less than total quantity
      if (req.body.iceberg_quantity >= req.body.quantity) {
        return res.status(400).json({
          success: false,
          error: 'Iceberg quantity must be less than total quantity'
        });
      }

      const orderData = {
        symbol: req.body.symbol,
        action: req.body.action,
        quantity: req.body.quantity,
        price: req.body.price,
        iceberg_quantity: req.body.iceberg_quantity,
        exchange: req.body.exchange || 'NSE',
        product_type: req.body.product_type || 'C',
        validity: req.body.validity || 'DAY'
      };

      const orderId = advancedOrderService.createIcebergOrder(userId, orderData);
      const order = advancedOrderService.getAdvancedOrder(orderId);

      return res.json({
        success: true,
        data: {
          order,
          message: 'Iceberg order created successfully'
        }
      });
    } catch (error: any) {
      console.error('Failed to create iceberg order:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create iceberg order',
        details: error.message
      });
    }
  }
);

/**
 * Create trailing stop order
 */
router.post('/trailing-stop',
  authenticateToken,
  [
    body('symbol').notEmpty().withMessage('Symbol is required'),
    body('action').isIn(['BUY', 'SELL']).withMessage('Action must be BUY or SELL'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    body('trigger_price').isFloat({ min: 0 }).withMessage('Trigger price must be a positive number'),
    body('trail_amount').optional().isFloat({ min: 0 }).withMessage('Trail amount must be a positive number'),
    body('trail_percent').optional().isFloat({ min: 0, max: 100 }).withMessage('Trail percent must be between 0 and 100'),
    body('exchange').optional().isString(),
    body('product_type').optional().isString(),
    body('validity').optional().isIn(['DAY', 'IOC', 'GTD'])
  ],
  async (req: any, res: any) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      // Validate that either trail_amount or trail_percent is provided
      if (!req.body.trail_amount && !req.body.trail_percent) {
        return res.status(400).json({
          success: false,
          error: 'Either trail_amount or trail_percent must be provided'
        });
      }

      const orderData = {
        symbol: req.body.symbol,
        action: req.body.action,
        quantity: req.body.quantity,
        trigger_price: req.body.trigger_price,
        trail_amount: req.body.trail_amount,
        trail_percent: req.body.trail_percent,
        exchange: req.body.exchange || 'NSE',
        product_type: req.body.product_type || 'C',
        validity: req.body.validity || 'DAY'
      };

      const orderId = advancedOrderService.createTrailingStopOrder(userId, orderData);
      const order = advancedOrderService.getAdvancedOrder(orderId);

      return res.json({
        success: true,
        data: {
          order,
          message: 'Trailing stop order created successfully'
        }
      });
    } catch (error: any) {
      console.error('Failed to create trailing stop order:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create trailing stop order',
        details: error.message
      });
    }
  }
);

/**
 * Get user's advanced orders
 */
router.get('/orders', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const status = req.query.status as string;
    const orders = advancedOrderService.getUserAdvancedOrders(userId, status);

    return res.json({
      success: true,
      data: {
        orders,
        count: orders.length
      }
    });
  } catch (error: any) {
    console.error('Failed to get advanced orders:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get advanced orders',
      details: error.message
    });
  }
});

/**
 * Get specific advanced order
 */
router.get('/orders/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const orderId = parseInt(req.params.id);
    const order = advancedOrderService.getAdvancedOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Advanced order not found'
      });
    }

    // Check if order belongs to user
    if (order.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get order modifications
    const modifications = advancedOrderService.getOrderModifications(orderId);

    return res.json({
      success: true,
      data: {
        order,
        modifications
      }
    });
  } catch (error: any) {
    console.error('Failed to get advanced order:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get advanced order',
      details: error.message
    });
  }
});

/**
 * Cancel advanced order
 */
router.post('/orders/:id/cancel', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const orderId = parseInt(req.params.id);
    const order = advancedOrderService.getAdvancedOrder(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Advanced order not found'
      });
    }

    // Check if order belongs to user
    if (order.user_id !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if order can be cancelled
    if (['EXECUTED', 'CANCELLED', 'EXPIRED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel order with status: ${order.status}`
      });
    }

    const success = advancedOrderService.cancelAdvancedOrder(orderId, userId);

    if (!success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to cancel advanced order'
      });
    }

    return res.json({
      success: true,
      message: 'Advanced order cancelled successfully'
    });
  } catch (error: any) {
    console.error('Failed to cancel advanced order:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cancel advanced order',
      details: error.message
    });
  }
});

export default router;
