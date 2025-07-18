import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { userDatabase } from './sqliteDatabase';
import { DerivativeOrder } from '../../../dev-packages/shared-types/src/derivatives';

/**
 * Bracket order for derivatives with parent-child relationships
 */
export interface DerivativesBracketOrder {
  id: string;
  userId: number;
  brokerId: string;
  parentOrder: DerivativesParentOrder;
  profitTargetOrder?: DerivativesChildOrder | undefined;
  stopLossOrder?: DerivativesChildOrder | undefined;
  trailingStopOrder?: DerivativesTrailingStopOrder | undefined;
  status: 'pending' | 'active' | 'partially_filled' | 'completed' | 'cancelled' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parent order in bracket order system
 */
export interface DerivativesParentOrder extends DerivativeOrder {
  bracketOrderId: string;
  childOrderIds: string[];
}

/**
 * Child order (profit target or stop loss)
 */
export interface DerivativesChildOrder extends DerivativeOrder {
  bracketOrderId: string;
  parentOrderId: string;
  orderRole: 'profit_target' | 'stop_loss';
  isActive: boolean;
}

/**
 * Trailing stop order for derivatives
 */
export interface DerivativesTrailingStopOrder extends Omit<DerivativesChildOrder, 'orderRole'> {
  orderRole: 'profit_target' | 'stop_loss' | 'trailing_stop';
  trailAmount?: number | undefined;
  trailPercent?: number | undefined;
  trailTriggerPrice: number;
  highWaterMark: number; // For long positions
  lowWaterMark: number;  // For short positions
}

/**
 * Bracket order request for derivatives
 */
export interface DerivativesBracketOrderRequest {
  symbol: string;
  underlying: string;
  brokerId: string;
  orderType: 'market' | 'limit';
  transactionType: 'buy' | 'sell';
  quantity: number;
  price?: number; // Required for limit orders
  profitTarget?: number;
  stopLoss?: number;
  trailingStop?: {
    trailAmount?: number;
    trailPercent?: number;
    initialTriggerPrice: number;
  };
  validity?: 'day' | 'ioc' | 'gtc';
}

/**
 * Bracket order modification request
 */
export interface BracketOrderModification {
  bracketOrderId: string;
  modificationType: 'profit_target' | 'stop_loss' | 'trailing_stop' | 'cancel_all';
  newPrice?: number;
  newTriggerPrice?: number;
  newTrailAmount?: number;
  newTrailPercent?: number;
}

/**
 * Service for managing derivatives bracket orders
 */
class DerivativesBracketOrderService extends EventEmitter {
  private activeBracketOrders: Map<string, DerivativesBracketOrder> = new Map();
  private orderExecutionQueue: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeDatabase();
    this.loadActiveBracketOrders();
  }

  /**
   * Initialize database tables for bracket orders
   */
  private initializeDatabase(): void {
    const db = userDatabase.getDatabase();
    
    // Create bracket orders table
    db.exec(`
      CREATE TABLE IF NOT EXISTS derivatives_bracket_orders (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        broker_id TEXT NOT NULL,
        parent_order_id TEXT NOT NULL,
        profit_target_order_id TEXT,
        stop_loss_order_id TEXT,
        trailing_stop_order_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create derivatives orders table
    db.exec(`
      CREATE TABLE IF NOT EXISTS derivatives_orders (
        id TEXT PRIMARY KEY,
        bracket_order_id TEXT,
        parent_order_id TEXT,
        broker_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        underlying TEXT NOT NULL,
        order_type TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        price REAL,
        stop_price REAL,
        status TEXT NOT NULL DEFAULT 'pending',
        filled_quantity INTEGER DEFAULT 0,
        avg_fill_price REAL DEFAULT 0,
        order_role TEXT, -- 'parent', 'profit_target', 'stop_loss', 'trailing_stop'
        is_active BOOLEAN DEFAULT 0,
        trail_amount REAL,
        trail_percent REAL,
        trail_trigger_price REAL,
        high_water_mark REAL,
        low_water_mark REAL,
        broker_order_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bracket_order_id) REFERENCES derivatives_bracket_orders(id)
      )
    `);
  }

  /**
   * Load active bracket orders from database
   */
  private loadActiveBracketOrders(): void {
    const db = userDatabase.getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM derivatives_bracket_orders 
      WHERE status IN ('pending', 'active', 'partially_filled')
    `);
    
    const bracketOrders = stmt.all() as any[];
    
    for (const bracketOrder of bracketOrders) {
      const fullBracketOrder = this.buildBracketOrderFromDb(bracketOrder);
      if (fullBracketOrder) {
        this.activeBracketOrders.set(bracketOrder.id, fullBracketOrder);
      }
    }
  }

  /**
   * Build bracket order object from database records
   */
  private buildBracketOrderFromDb(bracketOrderRecord: any): DerivativesBracketOrder | null {
    const db = userDatabase.getDatabase();
    
    // Get all related orders
    const ordersStmt = db.prepare(`
      SELECT * FROM derivatives_orders WHERE bracket_order_id = ?
    `);
    const orders = ordersStmt.all(bracketOrderRecord.id) as any[];
    
    const parentOrder = orders.find(o => o.order_role === 'parent');
    if (!parentOrder) return null;

    const profitTargetOrder = orders.find(o => o.order_role === 'profit_target');
    const stopLossOrder = orders.find(o => o.order_role === 'stop_loss');
    const trailingStopOrder = orders.find(o => o.order_role === 'trailing_stop');

    return {
      id: bracketOrderRecord.id,
      userId: bracketOrderRecord.user_id,
      brokerId: bracketOrderRecord.broker_id,
      parentOrder: this.mapDbOrderToParentOrder(parentOrder),
      profitTargetOrder: profitTargetOrder ? this.mapDbOrderToChildOrder(profitTargetOrder) : undefined,
      stopLossOrder: stopLossOrder ? this.mapDbOrderToChildOrder(stopLossOrder) : undefined,
      trailingStopOrder: trailingStopOrder ? this.mapDbOrderToTrailingStopOrder(trailingStopOrder) : undefined,
      status: bracketOrderRecord.status,
      createdAt: new Date(bracketOrderRecord.created_at),
      updatedAt: new Date(bracketOrderRecord.updated_at)
    };
  }

  /**
   * Map database order record to parent order
   */
  private mapDbOrderToParentOrder(orderRecord: any): DerivativesParentOrder {
    return {
      id: orderRecord.id,
      brokerId: orderRecord.broker_id,
      symbol: orderRecord.symbol,
      underlying: orderRecord.underlying,
      orderType: orderRecord.order_type,
      transactionType: orderRecord.transaction_type,
      quantity: orderRecord.quantity,
      price: orderRecord.price,
      stopPrice: orderRecord.stop_price,
      status: orderRecord.status,
      filledQuantity: orderRecord.filled_quantity,
      avgFillPrice: orderRecord.avg_fill_price,
      timestamp: new Date(orderRecord.created_at),
      bracketOrderId: orderRecord.bracket_order_id,
      childOrderIds: [] // Will be populated separately
    };
  }

  /**
   * Map database order record to child order
   */
  private mapDbOrderToChildOrder(orderRecord: any): DerivativesChildOrder {
    return {
      id: orderRecord.id,
      brokerId: orderRecord.broker_id,
      symbol: orderRecord.symbol,
      underlying: orderRecord.underlying,
      orderType: orderRecord.order_type,
      transactionType: orderRecord.transaction_type,
      quantity: orderRecord.quantity,
      price: orderRecord.price,
      stopPrice: orderRecord.stop_price,
      status: orderRecord.status,
      filledQuantity: orderRecord.filled_quantity,
      avgFillPrice: orderRecord.avg_fill_price,
      timestamp: new Date(orderRecord.created_at),
      bracketOrderId: orderRecord.bracket_order_id,
      parentOrderId: orderRecord.parent_order_id,
      orderRole: orderRecord.order_role,
      isActive: Boolean(orderRecord.is_active)
    };
  }

  /**
   * Map database order record to trailing stop order
   */
  private mapDbOrderToTrailingStopOrder(orderRecord: any): DerivativesTrailingStopOrder {
    return {
      ...this.mapDbOrderToChildOrder(orderRecord),
      trailAmount: orderRecord.trail_amount,
      trailPercent: orderRecord.trail_percent,
      trailTriggerPrice: orderRecord.trail_trigger_price,
      highWaterMark: orderRecord.high_water_mark,
      lowWaterMark: orderRecord.low_water_mark
    };
  }

  /**
   * Create a new bracket order for derivatives
   */
  async createBracketOrder(
    userId: number, 
    request: DerivativesBracketOrderRequest
  ): Promise<DerivativesBracketOrder> {
    const bracketOrderId = uuidv4();
    const parentOrderId = uuidv4();
    
    const db = userDatabase.getDatabase();
    
    try {
      return await new Promise((resolve, reject) => {
        db.transaction(() => {
          try {
            // Create bracket order record
            const insertBracketOrder = db.prepare(`
              INSERT INTO derivatives_bracket_orders (
                id, user_id, broker_id, parent_order_id, status
              ) VALUES (?, ?, ?, ?, ?)
            `);
            
            insertBracketOrder.run(
              bracketOrderId,
              userId,
              request.brokerId,
              parentOrderId,
              'pending'
            );

            // Create parent order
            const parentOrder = this.createParentOrder(
              bracketOrderId,
              parentOrderId,
              request
            );

            // Create child orders if specified
            let profitTargetOrder: DerivativesChildOrder | undefined;
            let stopLossOrder: DerivativesChildOrder | undefined;
            let trailingStopOrder: DerivativesTrailingStopOrder | undefined;

            if (request.profitTarget) {
              profitTargetOrder = this.createProfitTargetOrder(
                bracketOrderId,
                parentOrderId,
                request,
                request.profitTarget
              );
            }

            if (request.stopLoss) {
              stopLossOrder = this.createStopLossOrder(
                bracketOrderId,
                parentOrderId,
                request,
                request.stopLoss
              );
            }

            if (request.trailingStop) {
              trailingStopOrder = this.createTrailingStopOrder(
                bracketOrderId,
                parentOrderId,
                request,
                request.trailingStop
              );
            }

            const bracketOrder: DerivativesBracketOrder = {
              id: bracketOrderId,
              userId,
              brokerId: request.brokerId,
              parentOrder,
              profitTargetOrder,
              stopLossOrder,
              trailingStopOrder,
              status: 'pending',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            // Store in memory
            this.activeBracketOrders.set(bracketOrderId, bracketOrder);

            this.emit('bracketOrderCreated', bracketOrder);
            resolve(bracketOrder);
          } catch (error) {
            reject(error);
          }
        })();
      });
    } catch (error) {
      console.error('Failed to create bracket order:', error);
      throw error;
    }
  }

  /**
   * Create parent order
   */
  private createParentOrder(
    bracketOrderId: string,
    parentOrderId: string,
    request: DerivativesBracketOrderRequest
  ): DerivativesParentOrder {
    const db = userDatabase.getDatabase();
    
    const insertOrder = db.prepare(`
      INSERT INTO derivatives_orders (
        id, bracket_order_id, broker_id, symbol, underlying, order_type,
        transaction_type, quantity, price, stop_price, order_role, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertOrder.run(
      parentOrderId,
      bracketOrderId,
      request.brokerId,
      request.symbol,
      request.underlying,
      request.orderType,
      request.transactionType,
      request.quantity,
      request.price || null,
      null,
      'parent',
      1
    );

    return {
      id: parentOrderId,
      brokerId: request.brokerId,
      symbol: request.symbol,
      underlying: request.underlying,
      orderType: request.orderType,
      transactionType: request.transactionType,
      quantity: request.quantity,
      price: request.price,
      status: 'pending',
      filledQuantity: 0,
      avgFillPrice: 0,
      timestamp: new Date(),
      bracketOrderId,
      childOrderIds: []
    } as DerivativesParentOrder;
  }

  /**
   * Create profit target order
   */
  private createProfitTargetOrder(
    bracketOrderId: string,
    parentOrderId: string,
    request: DerivativesBracketOrderRequest,
    profitTarget: number
  ): DerivativesChildOrder {
    const orderId = uuidv4();
    const db = userDatabase.getDatabase();
    
    const insertOrder = db.prepare(`
      INSERT INTO derivatives_orders (
        id, bracket_order_id, parent_order_id, broker_id, symbol, underlying,
        order_type, transaction_type, quantity, price, order_role, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Opposite transaction type for exit
    const exitTransactionType = request.transactionType === 'buy' ? 'sell' : 'buy';

    insertOrder.run(
      orderId,
      bracketOrderId,
      parentOrderId,
      request.brokerId,
      request.symbol,
      request.underlying,
      'limit',
      exitTransactionType,
      request.quantity,
      profitTarget,
      'profit_target',
      0 // Not active until parent is filled
    );

    return {
      id: orderId,
      brokerId: request.brokerId,
      symbol: request.symbol,
      underlying: request.underlying,
      orderType: 'limit',
      transactionType: exitTransactionType,
      quantity: request.quantity,
      price: profitTarget,
      status: 'pending',
      filledQuantity: 0,
      avgFillPrice: 0,
      timestamp: new Date(),
      bracketOrderId,
      parentOrderId,
      orderRole: 'profit_target',
      isActive: false
    };
  }

  /**
   * Create stop loss order
   */
  private createStopLossOrder(
    bracketOrderId: string,
    parentOrderId: string,
    request: DerivativesBracketOrderRequest,
    stopLoss: number
  ): DerivativesChildOrder {
    const orderId = uuidv4();
    const db = userDatabase.getDatabase();
    
    const insertOrder = db.prepare(`
      INSERT INTO derivatives_orders (
        id, bracket_order_id, parent_order_id, broker_id, symbol, underlying,
        order_type, transaction_type, quantity, stop_price, order_role, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Opposite transaction type for exit
    const exitTransactionType = request.transactionType === 'buy' ? 'sell' : 'buy';

    insertOrder.run(
      orderId,
      bracketOrderId,
      parentOrderId,
      request.brokerId,
      request.symbol,
      request.underlying,
      'stop_loss',
      exitTransactionType,
      request.quantity,
      stopLoss,
      'stop_loss',
      0 // Not active until parent is filled
    );

    return {
      id: orderId,
      brokerId: request.brokerId,
      symbol: request.symbol,
      underlying: request.underlying,
      orderType: 'stop_loss',
      transactionType: exitTransactionType,
      quantity: request.quantity,
      stopPrice: stopLoss,
      status: 'pending',
      filledQuantity: 0,
      avgFillPrice: 0,
      timestamp: new Date(),
      bracketOrderId,
      parentOrderId,
      orderRole: 'stop_loss',
      isActive: false
    };
  }

  /**
   * Create trailing stop order
   */
  private createTrailingStopOrder(
    bracketOrderId: string,
    parentOrderId: string,
    request: DerivativesBracketOrderRequest,
    trailingStop: { trailAmount?: number; trailPercent?: number; initialTriggerPrice: number }
  ): DerivativesTrailingStopOrder {
    const orderId = uuidv4();
    const db = userDatabase.getDatabase();
    
    const insertOrder = db.prepare(`
      INSERT INTO derivatives_orders (
        id, bracket_order_id, parent_order_id, broker_id, symbol, underlying,
        order_type, transaction_type, quantity, stop_price, order_role, is_active,
        trail_amount, trail_percent, trail_trigger_price, high_water_mark, low_water_mark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Opposite transaction type for exit
    const exitTransactionType = request.transactionType === 'buy' ? 'sell' : 'buy';
    
    // Initialize water marks based on position direction
    const highWaterMark = request.transactionType === 'buy' ? trailingStop.initialTriggerPrice : 0;
    const lowWaterMark = request.transactionType === 'sell' ? trailingStop.initialTriggerPrice : Number.MAX_VALUE;

    insertOrder.run(
      orderId,
      bracketOrderId,
      parentOrderId,
      request.brokerId,
      request.symbol,
      request.underlying,
      'stop_loss',
      exitTransactionType,
      request.quantity,
      trailingStop.initialTriggerPrice,
      'trailing_stop',
      0, // Not active until parent is filled
      trailingStop.trailAmount || null,
      trailingStop.trailPercent || null,
      trailingStop.initialTriggerPrice,
      highWaterMark,
      lowWaterMark
    );

    return {
      id: orderId,
      brokerId: request.brokerId,
      symbol: request.symbol,
      underlying: request.underlying,
      orderType: 'stop_loss',
      transactionType: exitTransactionType,
      quantity: request.quantity,
      stopPrice: trailingStop.initialTriggerPrice,
      status: 'pending',
      filledQuantity: 0,
      avgFillPrice: 0,
      timestamp: new Date(),
      bracketOrderId,
      parentOrderId,
      orderRole: 'trailing_stop',
      isActive: false,
      trailAmount: trailingStop.trailAmount || undefined,
      trailPercent: trailingStop.trailPercent || undefined,
      trailTriggerPrice: trailingStop.initialTriggerPrice,
      highWaterMark,
      lowWaterMark
    };
  }

  /**
   * Get bracket order by ID
   */
  getBracketOrder(bracketOrderId: string): DerivativesBracketOrder | null {
    return this.activeBracketOrders.get(bracketOrderId) || null;
  }

  /**
   * Get all bracket orders for a user
   */
  getUserBracketOrders(userId: number): DerivativesBracketOrder[] {
    return Array.from(this.activeBracketOrders.values())
      .filter(order => order.userId === userId);
  }

  /**
   * Handle parent order execution
   */
  async handleParentOrderExecution(
    bracketOrderId: string,
    filledQuantity: number,
    avgFillPrice: number
  ): Promise<void> {
    const bracketOrder = this.activeBracketOrders.get(bracketOrderId);
    if (!bracketOrder) return;

    // Update parent order
    bracketOrder.parentOrder.filledQuantity = filledQuantity;
    bracketOrder.parentOrder.avgFillPrice = avgFillPrice;
    bracketOrder.parentOrder.status = filledQuantity === bracketOrder.parentOrder.quantity ? 'executed' : 'partial';

    // Activate child orders if parent is fully filled
    if (filledQuantity === bracketOrder.parentOrder.quantity) {
      await this.activateChildOrders(bracketOrder);
      bracketOrder.status = 'active';
    } else {
      bracketOrder.status = 'partially_filled';
    }

    bracketOrder.updatedAt = new Date();
    this.updateBracketOrderInDb(bracketOrder);
    
    this.emit('parentOrderExecuted', bracketOrder);
  }

  /**
   * Activate child orders after parent execution
   */
  private async activateChildOrders(bracketOrder: DerivativesBracketOrder): Promise<void> {
    const db = userDatabase.getDatabase();
    
    // Activate profit target order
    if (bracketOrder.profitTargetOrder) {
      bracketOrder.profitTargetOrder.isActive = true;
      db.prepare(`UPDATE derivatives_orders SET is_active = 1 WHERE id = ?`)
        .run(bracketOrder.profitTargetOrder.id);
    }

    // Activate stop loss order
    if (bracketOrder.stopLossOrder) {
      bracketOrder.stopLossOrder.isActive = true;
      db.prepare(`UPDATE derivatives_orders SET is_active = 1 WHERE id = ?`)
        .run(bracketOrder.stopLossOrder.id);
    }

    // Activate trailing stop order
    if (bracketOrder.trailingStopOrder) {
      bracketOrder.trailingStopOrder.isActive = true;
      db.prepare(`UPDATE derivatives_orders SET is_active = 1 WHERE id = ?`)
        .run(bracketOrder.trailingStopOrder.id);
    }
  }

  /**
   * Update trailing stop based on market price movement
   */
  updateTrailingStop(bracketOrderId: string, currentPrice: number): boolean {
    const bracketOrder = this.activeBracketOrders.get(bracketOrderId);
    if (!bracketOrder?.trailingStopOrder || !bracketOrder.trailingStopOrder.isActive) {
      return false;
    }

    const trailingStop = bracketOrder.trailingStopOrder;
    const isLongPosition = bracketOrder.parentOrder.transactionType === 'buy';
    let updated = false;

    if (isLongPosition) {
      // For long positions, trail up with the price
      if (currentPrice > trailingStop.highWaterMark) {
        trailingStop.highWaterMark = currentPrice;
        
        // Calculate new trigger price
        let newTriggerPrice: number;
        if (trailingStop.trailAmount) {
          newTriggerPrice = currentPrice - trailingStop.trailAmount;
        } else if (trailingStop.trailPercent) {
          newTriggerPrice = currentPrice * (1 - trailingStop.trailPercent / 100);
        } else {
          return false;
        }

        // Only update if new trigger is higher than current
        if (newTriggerPrice > trailingStop.trailTriggerPrice) {
          trailingStop.trailTriggerPrice = newTriggerPrice;
          trailingStop.stopPrice = newTriggerPrice;
          updated = true;
        }
      }
    } else {
      // For short positions, trail down with the price
      if (currentPrice < trailingStop.lowWaterMark) {
        trailingStop.lowWaterMark = currentPrice;
        
        // Calculate new trigger price
        let newTriggerPrice: number;
        if (trailingStop.trailAmount) {
          newTriggerPrice = currentPrice + trailingStop.trailAmount;
        } else if (trailingStop.trailPercent) {
          newTriggerPrice = currentPrice * (1 + trailingStop.trailPercent / 100);
        } else {
          return false;
        }

        // Only update if new trigger is lower than current
        if (newTriggerPrice < trailingStop.trailTriggerPrice) {
          trailingStop.trailTriggerPrice = newTriggerPrice;
          trailingStop.stopPrice = newTriggerPrice;
          updated = true;
        }
      }
    }

    if (updated) {
      this.updateTrailingStopInDb(trailingStop);
      this.emit('trailingStopUpdated', bracketOrder, currentPrice);
    }

    return updated;
  }

  /**
   * Update trailing stop in database
   */
  private updateTrailingStopInDb(trailingStop: DerivativesTrailingStopOrder): void {
    const db = userDatabase.getDatabase();
    const updateStmt = db.prepare(`
      UPDATE derivatives_orders 
      SET trail_trigger_price = ?, stop_price = ?, high_water_mark = ?, low_water_mark = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    updateStmt.run(
      trailingStop.trailTriggerPrice,
      trailingStop.stopPrice,
      trailingStop.highWaterMark,
      trailingStop.lowWaterMark,
      trailingStop.id
    );
  }

  /**
   * Update bracket order in database
   */
  private updateBracketOrderInDb(bracketOrder: DerivativesBracketOrder): void {
    const db = userDatabase.getDatabase();
    const updateStmt = db.prepare(`
      UPDATE derivatives_bracket_orders 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    updateStmt.run(bracketOrder.status, bracketOrder.id);
  }

  /**
   * Cancel bracket order and all child orders
   */
  async cancelBracketOrder(bracketOrderId: string): Promise<boolean> {
    const bracketOrder = this.activeBracketOrders.get(bracketOrderId);
    if (!bracketOrder) return false;

    try {
      const db = userDatabase.getDatabase();
      
      db.transaction(() => {
        // Cancel all orders in the bracket
        db.prepare(`UPDATE derivatives_orders SET status = 'cancelled' WHERE bracket_order_id = ?`)
          .run(bracketOrderId);
        
        // Update bracket order status
        db.prepare(`UPDATE derivatives_bracket_orders SET status = 'cancelled' WHERE id = ?`)
          .run(bracketOrderId);
      })();

      bracketOrder.status = 'cancelled';
      bracketOrder.updatedAt = new Date();
      
      this.emit('bracketOrderCancelled', bracketOrder);
      return true;
    } catch (error) {
      console.error('Failed to cancel bracket order:', error);
      return false;
    }
  }

  /**
   * Modify bracket order
   */
  async modifyBracketOrder(modification: BracketOrderModification): Promise<boolean> {
    const bracketOrder = this.activeBracketOrders.get(modification.bracketOrderId);
    if (!bracketOrder) return false;

    try {
      const db = userDatabase.getDatabase();
      
      switch (modification.modificationType) {
        case 'profit_target':
          if (bracketOrder.profitTargetOrder && modification.newPrice) {
            bracketOrder.profitTargetOrder.price = modification.newPrice;
            db.prepare(`UPDATE derivatives_orders SET price = ? WHERE id = ?`)
              .run(modification.newPrice, bracketOrder.profitTargetOrder.id);
          }
          break;
          
        case 'stop_loss':
          if (bracketOrder.stopLossOrder && modification.newTriggerPrice) {
            bracketOrder.stopLossOrder.stopPrice = modification.newTriggerPrice;
            db.prepare(`UPDATE derivatives_orders SET stop_price = ? WHERE id = ?`)
              .run(modification.newTriggerPrice, bracketOrder.stopLossOrder.id);
          }
          break;
          
        case 'trailing_stop':
          if (bracketOrder.trailingStopOrder) {
            if (modification.newTriggerPrice) {
              bracketOrder.trailingStopOrder.trailTriggerPrice = modification.newTriggerPrice;
            }
            if (modification.newTrailAmount) {
              bracketOrder.trailingStopOrder.trailAmount = modification.newTrailAmount;
            }
            if (modification.newTrailPercent) {
              bracketOrder.trailingStopOrder.trailPercent = modification.newTrailPercent;
            }
            
            db.prepare(`
              UPDATE derivatives_orders 
              SET trail_trigger_price = COALESCE(?, trail_trigger_price),
                  trail_amount = COALESCE(?, trail_amount),
                  trail_percent = COALESCE(?, trail_percent)
              WHERE id = ?
            `).run(
              modification.newTriggerPrice || null,
              modification.newTrailAmount || null,
              modification.newTrailPercent || null,
              bracketOrder.trailingStopOrder.id
            );
          }
          break;
          
        case 'cancel_all':
          return await this.cancelBracketOrder(modification.bracketOrderId);
      }

      bracketOrder.updatedAt = new Date();
      this.emit('bracketOrderModified', bracketOrder, modification);
      return true;
    } catch (error) {
      console.error('Failed to modify bracket order:', error);
      return false;
    }
  }
}

export const derivativesBracketOrderService = new DerivativesBracketOrderService();