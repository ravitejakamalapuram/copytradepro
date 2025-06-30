import { userDatabase } from './sqliteDatabase';
import { v4 as uuidv4 } from 'uuid';

export interface OrderTemplate {
  id?: number;
  user_id: number;
  name: string;
  description?: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET' | 'BRACKET' | 'COVER' | 'ICEBERG' | 'TRAILING_SL';
  price?: number;
  trigger_price?: number;
  stop_loss?: number;
  take_profit?: number;
  exchange: string;
  product_type: string;
  validity: 'DAY' | 'IOC' | 'GTD';
  iceberg_quantity?: number;
  trail_amount?: number;
  trail_percent?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AdvancedOrder {
  id?: number;
  user_id: number;
  parent_order_id?: number;
  order_group_id?: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET' | 'BRACKET' | 'COVER' | 'ICEBERG' | 'TRAILING_SL';
  price?: number;
  trigger_price?: number;
  stop_loss?: number;
  take_profit?: number;
  status: 'PENDING' | 'ACTIVE' | 'TRIGGERED' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';
  exchange: string;
  product_type: string;
  validity: 'DAY' | 'IOC' | 'GTD';
  expiry_date?: string;
  iceberg_quantity?: number;
  iceberg_executed: number;
  trail_amount?: number;
  trail_percent?: number;
  trail_trigger_price?: number;
  condition_type?: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'TIME_BASED' | 'VOLUME_BASED';
  condition_value?: number;
  is_bracket_order: boolean;
  bracket_stop_loss?: number;
  bracket_take_profit?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
  executed_at?: string;
}

export interface OrderModification {
  id?: number;
  user_id: number;
  order_id: number;
  broker_order_id: string;
  modification_type: 'PRICE' | 'QUANTITY' | 'TRIGGER_PRICE' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'CANCEL';
  old_value?: number;
  new_value?: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  error_message?: string;
  created_at?: string;
}

export interface BracketOrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  stop_loss: number;
  take_profit: number;
  exchange?: string;
  product_type?: string;
  validity?: 'DAY' | 'IOC' | 'GTD';
}

export interface IcebergOrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  iceberg_quantity: number;
  exchange?: string;
  product_type?: string;
  validity?: 'DAY' | 'IOC' | 'GTD';
}

export interface TrailingStopOrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  trigger_price: number;
  trail_amount?: number;
  trail_percent?: number;
  exchange?: string;
  product_type?: string;
  validity?: 'DAY' | 'IOC' | 'GTD';
}

export interface BulkOrderRequest {
  orders: Array<{
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
    price?: number;
    trigger_price?: number;
    exchange?: string;
    product_type?: string;
  }>;
  execution_type: 'PARALLEL' | 'SEQUENTIAL';
  stop_on_error: boolean;
}

class AdvancedOrderService {
  
  /**
   * Create order template
   */
  createOrderTemplate(templateData: Omit<OrderTemplate, 'id' | 'created_at' | 'updated_at'>): OrderTemplate {
    const insertTemplate = userDatabase.getDatabase().prepare(`
      INSERT INTO order_templates (
        user_id, name, description, symbol, action, quantity, order_type,
        price, trigger_price, stop_loss, take_profit, exchange, product_type,
        validity, iceberg_quantity, trail_amount, trail_percent, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = insertTemplate.run(
        templateData.user_id,
        templateData.name,
        templateData.description || null,
        templateData.symbol,
        templateData.action,
        templateData.quantity,
        templateData.order_type,
        templateData.price || null,
        templateData.trigger_price || null,
        templateData.stop_loss || null,
        templateData.take_profit || null,
        templateData.exchange,
        templateData.product_type,
        templateData.validity,
        templateData.iceberg_quantity || null,
        templateData.trail_amount || null,
        templateData.trail_percent || null,
        templateData.is_active ? 1 : 0
      );

      const templateId = result.lastInsertRowid as number;
      return this.getOrderTemplate(templateId)!;
    } catch (error: any) {
      console.error('Failed to create order template:', error);
      throw error;
    }
  }

  /**
   * Get order template by ID
   */
  getOrderTemplate(templateId: number): OrderTemplate | null {
    const getTemplate = userDatabase.getDatabase().prepare(`
      SELECT * FROM order_templates WHERE id = ?
    `);

    try {
      const template = getTemplate.get(templateId) as any;
      if (!template) return null;

      return {
        ...template,
        is_active: Boolean(template.is_active)
      };
    } catch (error: any) {
      console.error('Failed to get order template:', error);
      return null;
    }
  }

  /**
   * Get user's order templates
   */
  getUserOrderTemplates(userId: number, activeOnly: boolean = false): OrderTemplate[] {
    const query = activeOnly 
      ? `SELECT * FROM order_templates WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC`
      : `SELECT * FROM order_templates WHERE user_id = ? ORDER BY created_at DESC`;
    
    const getTemplates = userDatabase.getDatabase().prepare(query);

    try {
      const templates = getTemplates.all(userId) as any[];
      return templates.map(template => ({
        ...template,
        is_active: Boolean(template.is_active)
      }));
    } catch (error: any) {
      console.error('Failed to get user order templates:', error);
      return [];
    }
  }

  /**
   * Update order template
   */
  updateOrderTemplate(templateId: number, updates: Partial<OrderTemplate>): boolean {
    const updateTemplate = userDatabase.getDatabase().prepare(`
      UPDATE order_templates 
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          symbol = COALESCE(?, symbol),
          action = COALESCE(?, action),
          quantity = COALESCE(?, quantity),
          order_type = COALESCE(?, order_type),
          price = COALESCE(?, price),
          trigger_price = COALESCE(?, trigger_price),
          stop_loss = COALESCE(?, stop_loss),
          take_profit = COALESCE(?, take_profit),
          exchange = COALESCE(?, exchange),
          product_type = COALESCE(?, product_type),
          validity = COALESCE(?, validity),
          iceberg_quantity = COALESCE(?, iceberg_quantity),
          trail_amount = COALESCE(?, trail_amount),
          trail_percent = COALESCE(?, trail_percent),
          is_active = COALESCE(?, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    try {
      const result = updateTemplate.run(
        updates.name || null,
        updates.description || null,
        updates.symbol || null,
        updates.action || null,
        updates.quantity || null,
        updates.order_type || null,
        updates.price || null,
        updates.trigger_price || null,
        updates.stop_loss || null,
        updates.take_profit || null,
        updates.exchange || null,
        updates.product_type || null,
        updates.validity || null,
        updates.iceberg_quantity || null,
        updates.trail_amount || null,
        updates.trail_percent || null,
        updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : null,
        templateId
      );

      return result.changes > 0;
    } catch (error: any) {
      console.error('Failed to update order template:', error);
      return false;
    }
  }

  /**
   * Delete order template
   */
  deleteOrderTemplate(templateId: number, userId: number): boolean {
    const deleteTemplate = userDatabase.getDatabase().prepare(`
      DELETE FROM order_templates WHERE id = ? AND user_id = ?
    `);

    try {
      const result = deleteTemplate.run(templateId, userId);
      return result.changes > 0;
    } catch (error: any) {
      console.error('Failed to delete order template:', error);
      return false;
    }
  }

  /**
   * Create bracket order (main order with stop-loss and take-profit)
   */
  createBracketOrder(userId: number, orderData: BracketOrderRequest): string {
    const orderGroupId = uuidv4();
    
    try {
      userDatabase.getDatabase().transaction(() => {
        // Create main order
        this.createAdvancedOrder({
          user_id: userId,
          order_group_id: orderGroupId,
          symbol: orderData.symbol,
          action: orderData.action,
          quantity: orderData.quantity,
          order_type: 'LIMIT',
          price: orderData.price,
          status: 'PENDING',
          exchange: orderData.exchange || 'NSE',
          product_type: orderData.product_type || 'C',
          validity: orderData.validity || 'DAY',
          iceberg_executed: 0,
          is_bracket_order: true,
          bracket_stop_loss: orderData.stop_loss,
          bracket_take_profit: orderData.take_profit
        });

        // Create stop-loss order
        this.createAdvancedOrder({
          user_id: userId,
          order_group_id: orderGroupId,
          symbol: orderData.symbol,
          action: orderData.action === 'BUY' ? 'SELL' : 'BUY',
          quantity: orderData.quantity,
          order_type: 'SL-MARKET',
          trigger_price: orderData.stop_loss,
          status: 'PENDING',
          exchange: orderData.exchange || 'NSE',
          product_type: orderData.product_type || 'C',
          validity: orderData.validity || 'DAY',
          iceberg_executed: 0,
          is_bracket_order: false
        });

        // Create take-profit order
        this.createAdvancedOrder({
          user_id: userId,
          order_group_id: orderGroupId,
          symbol: orderData.symbol,
          action: orderData.action === 'BUY' ? 'SELL' : 'BUY',
          quantity: orderData.quantity,
          order_type: 'LIMIT',
          price: orderData.take_profit,
          status: 'PENDING',
          exchange: orderData.exchange || 'NSE',
          product_type: orderData.product_type || 'C',
          validity: orderData.validity || 'DAY',
          iceberg_executed: 0,
          is_bracket_order: false
        });
      })();

      return orderGroupId;
    } catch (error: any) {
      console.error('Failed to create bracket order:', error);
      throw error;
    }
  }

  /**
   * Create advanced order
   */
  private createAdvancedOrder(orderData: Omit<AdvancedOrder, 'id' | 'created_at' | 'updated_at'>): AdvancedOrder {
    const insertOrder = userDatabase.getDatabase().prepare(`
      INSERT INTO advanced_orders (
        user_id, parent_order_id, order_group_id, symbol, action, quantity,
        order_type, price, trigger_price, stop_loss, take_profit, status,
        exchange, product_type, validity, expiry_date, iceberg_quantity,
        iceberg_executed, trail_amount, trail_percent, trail_trigger_price,
        condition_type, condition_value, is_bracket_order, bracket_stop_loss,
        bracket_take_profit, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = insertOrder.run(
        orderData.user_id,
        orderData.parent_order_id || null,
        orderData.order_group_id || null,
        orderData.symbol,
        orderData.action,
        orderData.quantity,
        orderData.order_type,
        orderData.price || null,
        orderData.trigger_price || null,
        orderData.stop_loss || null,
        orderData.take_profit || null,
        orderData.status,
        orderData.exchange,
        orderData.product_type,
        orderData.validity,
        orderData.expiry_date || null,
        orderData.iceberg_quantity || null,
        orderData.iceberg_executed,
        orderData.trail_amount || null,
        orderData.trail_percent || null,
        orderData.trail_trigger_price || null,
        orderData.condition_type || null,
        orderData.condition_value || null,
        orderData.is_bracket_order ? 1 : 0,
        orderData.bracket_stop_loss || null,
        orderData.bracket_take_profit || null,
        orderData.remarks || null
      );

      const orderId = result.lastInsertRowid as number;
      return this.getAdvancedOrder(orderId)!;
    } catch (error: any) {
      console.error('Failed to create advanced order:', error);
      throw error;
    }
  }

  /**
   * Get advanced order by ID
   */
  getAdvancedOrder(orderId: number): AdvancedOrder | null {
    const getOrder = userDatabase.getDatabase().prepare(`
      SELECT * FROM advanced_orders WHERE id = ?
    `);

    try {
      const order = getOrder.get(orderId) as any;
      if (!order) return null;

      return {
        ...order,
        is_bracket_order: Boolean(order.is_bracket_order)
      };
    } catch (error: any) {
      console.error('Failed to get advanced order:', error);
      return null;
    }
  }

  /**
   * Get user's advanced orders
   */
  getUserAdvancedOrders(userId: number, status?: string): AdvancedOrder[] {
    const query = status
      ? `SELECT * FROM advanced_orders WHERE user_id = ? AND status = ? ORDER BY created_at DESC`
      : `SELECT * FROM advanced_orders WHERE user_id = ? ORDER BY created_at DESC`;

    const getOrders = userDatabase.getDatabase().prepare(query);

    try {
      const orders = status
        ? getOrders.all(userId, status) as any[]
        : getOrders.all(userId) as any[];

      return orders.map(order => ({
        ...order,
        is_bracket_order: Boolean(order.is_bracket_order)
      }));
    } catch (error: any) {
      console.error('Failed to get user advanced orders:', error);
      return [];
    }
  }

  /**
   * Create iceberg order
   */
  createIcebergOrder(userId: number, orderData: IcebergOrderRequest): number {
    try {
      const order = this.createAdvancedOrder({
        user_id: userId,
        symbol: orderData.symbol,
        action: orderData.action,
        quantity: orderData.quantity,
        order_type: 'ICEBERG',
        price: orderData.price,
        status: 'PENDING',
        exchange: orderData.exchange || 'NSE',
        product_type: orderData.product_type || 'C',
        validity: orderData.validity || 'DAY',
        iceberg_quantity: orderData.iceberg_quantity,
        iceberg_executed: 0,
        is_bracket_order: false
      });

      return order.id!;
    } catch (error: any) {
      console.error('Failed to create iceberg order:', error);
      throw error;
    }
  }

  /**
   * Create trailing stop order
   */
  createTrailingStopOrder(userId: number, orderData: TrailingStopOrderRequest): number {
    try {
      const order = this.createAdvancedOrder({
        user_id: userId,
        symbol: orderData.symbol,
        action: orderData.action,
        quantity: orderData.quantity,
        order_type: 'TRAILING_SL',
        trigger_price: orderData.trigger_price,
        status: 'PENDING',
        exchange: orderData.exchange || 'NSE',
        product_type: orderData.product_type || 'C',
        validity: orderData.validity || 'DAY',
        trail_amount: orderData.trail_amount || 0,
        trail_percent: orderData.trail_percent || 0,
        trail_trigger_price: orderData.trigger_price,
        iceberg_executed: 0,
        is_bracket_order: false
      });

      return order.id!;
    } catch (error: any) {
      console.error('Failed to create trailing stop order:', error);
      throw error;
    }
  }

  /**
   * Record order modification
   */
  recordOrderModification(modificationData: Omit<OrderModification, 'id' | 'created_at'>): OrderModification {
    const insertModification = userDatabase.getDatabase().prepare(`
      INSERT INTO order_modifications (
        user_id, order_id, broker_order_id, modification_type,
        old_value, new_value, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = insertModification.run(
        modificationData.user_id,
        modificationData.order_id,
        modificationData.broker_order_id,
        modificationData.modification_type,
        modificationData.old_value || null,
        modificationData.new_value || null,
        modificationData.status,
        modificationData.error_message || null
      );

      const modificationId = result.lastInsertRowid as number;
      return this.getOrderModification(modificationId)!;
    } catch (error: any) {
      console.error('Failed to record order modification:', error);
      throw error;
    }
  }

  /**
   * Get order modification by ID
   */
  getOrderModification(modificationId: number): OrderModification | null {
    const getModification = userDatabase.getDatabase().prepare(`
      SELECT * FROM order_modifications WHERE id = ?
    `);

    try {
      return getModification.get(modificationId) as OrderModification | null;
    } catch (error: any) {
      console.error('Failed to get order modification:', error);
      return null;
    }
  }

  /**
   * Get order modifications for a specific order
   */
  getOrderModifications(orderId: number): OrderModification[] {
    const getModifications = userDatabase.getDatabase().prepare(`
      SELECT * FROM order_modifications WHERE order_id = ? ORDER BY created_at DESC
    `);

    try {
      return getModifications.all(orderId) as OrderModification[];
    } catch (error: any) {
      console.error('Failed to get order modifications:', error);
      return [];
    }
  }

  /**
   * Update advanced order status
   */
  updateAdvancedOrderStatus(orderId: number, status: AdvancedOrder['status'], executedAt?: string): boolean {
    const updateOrder = userDatabase.getDatabase().prepare(`
      UPDATE advanced_orders
      SET status = ?,
          executed_at = COALESCE(?, executed_at),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    try {
      const result = updateOrder.run(status, executedAt || null, orderId);
      return result.changes > 0;
    } catch (error: any) {
      console.error('Failed to update advanced order status:', error);
      return false;
    }
  }

  /**
   * Cancel advanced order
   */
  cancelAdvancedOrder(orderId: number, userId: number): boolean {
    try {
      return this.updateAdvancedOrderStatus(orderId, 'CANCELLED');
    } catch (error: any) {
      console.error('Failed to cancel advanced order:', error);
      return false;
    }
  }

  /**
   * Get orders by group ID (for bracket orders)
   */
  getOrdersByGroupId(orderGroupId: string): AdvancedOrder[] {
    const getOrders = userDatabase.getDatabase().prepare(`
      SELECT * FROM advanced_orders WHERE order_group_id = ? ORDER BY created_at ASC
    `);

    try {
      const orders = getOrders.all(orderGroupId) as any[];
      return orders.map(order => ({
        ...order,
        is_bracket_order: Boolean(order.is_bracket_order)
      }));
    } catch (error: any) {
      console.error('Failed to get orders by group ID:', error);
      return [];
    }
  }

  /**
   * Update iceberg order execution
   */
  updateIcebergExecution(orderId: number, executedQuantity: number): boolean {
    const updateOrder = userDatabase.getDatabase().prepare(`
      UPDATE advanced_orders
      SET iceberg_executed = iceberg_executed + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND order_type = 'ICEBERG'
    `);

    try {
      const result = updateOrder.run(executedQuantity, orderId);
      return result.changes > 0;
    } catch (error: any) {
      console.error('Failed to update iceberg execution:', error);
      return false;
    }
  }

  /**
   * Update trailing stop trigger price
   */
  updateTrailingStopTrigger(orderId: number, newTriggerPrice: number): boolean {
    const updateOrder = userDatabase.getDatabase().prepare(`
      UPDATE advanced_orders
      SET trail_trigger_price = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND order_type = 'TRAILING_SL'
    `);

    try {
      const result = updateOrder.run(newTriggerPrice, orderId);
      return result.changes > 0;
    } catch (error: any) {
      console.error('Failed to update trailing stop trigger:', error);
      return false;
    }
  }
}

export const advancedOrderService = new AdvancedOrderService();
