import { EventEmitter } from 'events';
import { userDatabase } from './sqliteDatabase';
import { DerivativeOrder } from '../../../dev-packages/shared-types/src/derivatives';
import { derivativesBracketOrderService } from './derivativesBracketOrderService';

/**
 * Order modification request for derivatives
 */
export interface DerivativeOrderModificationRequest {
  orderId: string;
  brokerId: string;
  modificationType: 'price' | 'quantity' | 'stop_price' | 'trigger_price' | 'validity';
  newPrice?: number;
  newQuantity?: number;
  newStopPrice?: number;
  newTriggerPrice?: number;
  newValidity?: 'day' | 'ioc' | 'gtc';
  reason?: string;
}

/**
 * Bulk order cancellation request
 */
export interface BulkCancellationRequest {
  orderIds: string[];
  brokerId?: string;
  symbol?: string;
  underlying?: string;
  strategyId?: string;
  reason?: string;
}

/**
 * Order replacement request
 */
export interface OrderReplacementRequest {
  originalOrderId: string;
  brokerId: string;
  newOrder: Partial<DerivativeOrder>;
  reason?: string;
}

/**
 * Modification validation result
 */
export interface ModificationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedImpact?: {
    marginChange: number;
    riskChange: number;
    costChange: number;
  };
}

/**
 * Service for managing derivatives order modifications
 */
class DerivativesOrderModificationService extends EventEmitter {
  private pendingModifications: Map<string, DerivativeOrderModificationRequest> = new Map();
  private modificationHistory: Map<string, DerivativeOrderModificationRequest[]> = new Map();

  constructor() {
    super();
    this.initializeDatabase();
  }

  /**
   * Initialize database tables for order modifications
   */
  private initializeDatabase(): void {
    const db = userDatabase.getDatabase();
    
    // Create order modifications table
    db.exec(`
      CREATE TABLE IF NOT EXISTS derivatives_order_modifications (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        broker_id TEXT NOT NULL,
        modification_type TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES derivatives_orders(id)
      )
    `);

    // Create bulk cancellation log table
    db.exec(`
      CREATE TABLE IF NOT EXISTS derivatives_bulk_cancellations (
        id TEXT PRIMARY KEY,
        broker_id TEXT,
        symbol TEXT,
        underlying TEXT,
        strategy_id TEXT,
        order_ids TEXT NOT NULL, -- JSON array of order IDs
        total_orders INTEGER NOT NULL,
        successful_cancellations INTEGER DEFAULT 0,
        failed_cancellations INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Modify a derivatives order
   */
  async modifyOrder(request: DerivativeOrderModificationRequest): Promise<boolean> {
    try {
      // Validate modification request
      const validation = await this.validateModification(request);
      if (!validation.isValid) {
        this.emit('modificationFailed', request, validation.errors);
        return false;
      }

      // Check if order exists and is modifiable
      const order = await this.getOrderById(request.orderId);
      if (!order) {
        throw new Error(`Order ${request.orderId} not found`);
      }

      if (!this.isOrderModifiable(order)) {
        throw new Error(`Order ${request.orderId} is not in a modifiable state`);
      }

      // Store modification request
      this.pendingModifications.set(request.orderId, request);

      // Execute modification based on type
      const success = await this.executeModification(order, request);
      
      if (success) {
        await this.recordModification(request, 'completed');
        this.addToModificationHistory(request.orderId, request);
        this.emit('orderModified', order, request);
      } else {
        await this.recordModification(request, 'failed');
        this.emit('modificationFailed', request, ['Modification execution failed']);
      }

      this.pendingModifications.delete(request.orderId);
      return success;
    } catch (error) {
      console.error('Failed to modify order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.recordModification(request, 'failed', errorMessage);
      this.emit('modificationFailed', request, [errorMessage]);
      return false;
    }
  }

  /**
   * Validate modification request
   */
  private async validateModification(request: DerivativeOrderModificationRequest): Promise<ModificationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!request.orderId) {
      errors.push('Order ID is required');
    }

    if (!request.brokerId) {
      errors.push('Broker ID is required');
    }

    if (!request.modificationType) {
      errors.push('Modification type is required');
    }

    // Type-specific validation
    switch (request.modificationType) {
      case 'price':
        if (!request.newPrice || request.newPrice <= 0) {
          errors.push('Valid new price is required for price modification');
        }
        break;
      
      case 'quantity':
        if (!request.newQuantity || request.newQuantity <= 0) {
          errors.push('Valid new quantity is required for quantity modification');
        }
        break;
      
      case 'stop_price':
        if (!request.newStopPrice || request.newStopPrice <= 0) {
          errors.push('Valid new stop price is required for stop price modification');
        }
        break;
      
      case 'trigger_price':
        if (!request.newTriggerPrice || request.newTriggerPrice <= 0) {
          errors.push('Valid new trigger price is required for trigger price modification');
        }
        break;
      
      case 'validity':
        if (!request.newValidity || !['day', 'ioc', 'gtc'].includes(request.newValidity)) {
          errors.push('Valid new validity is required for validity modification');
        }
        break;
      
      default:
        errors.push('Invalid modification type');
    }

    // Get order for additional validation
    const order = await this.getOrderById(request.orderId);
    if (order) {
      // Check if modification makes sense for order type
      if (request.modificationType === 'stop_price' && !['stop_loss', 'stop_limit'].includes(order.orderType)) {
        errors.push('Stop price modification is only valid for stop orders');
      }

      // Check market hours for certain modifications
      if (request.modificationType === 'price' && !this.isMarketOpen()) {
        warnings.push('Price modification outside market hours may not be executed immediately');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if order is modifiable
   */
  private isOrderModifiable(order: DerivativeOrder): boolean {
    const modifiableStatuses = ['pending', 'open', 'partially_filled'];
    return modifiableStatuses.includes(order.status);
  }

  /**
   * Execute the modification
   */
  private async executeModification(order: DerivativeOrder, request: DerivativeOrderModificationRequest): Promise<boolean> {
    const db = userDatabase.getDatabase();
    
    try {
      return await new Promise((resolve) => {
        db.transaction(() => {
          let updateQuery = '';
          let updateParams: any[] = [];

          switch (request.modificationType) {
            case 'price':
              updateQuery = 'UPDATE derivatives_orders SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
              updateParams = [request.newPrice, request.orderId];
              break;
            
            case 'quantity':
              updateQuery = 'UPDATE derivatives_orders SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
              updateParams = [request.newQuantity, request.orderId];
              break;
            
            case 'stop_price':
              updateQuery = 'UPDATE derivatives_orders SET stop_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
              updateParams = [request.newStopPrice, request.orderId];
              break;
            
            case 'trigger_price':
              updateQuery = 'UPDATE derivatives_orders SET trigger_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
              updateParams = [request.newTriggerPrice, request.orderId];
              break;
            
            case 'validity':
              updateQuery = 'UPDATE derivatives_orders SET validity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
              updateParams = [request.newValidity, request.orderId];
              break;
          }

          if (updateQuery) {
            const stmt = db.prepare(updateQuery);
            const result = stmt.run(...updateParams);
            resolve(result.changes > 0);
          } else {
            resolve(false);
          }
        })();
      });
    } catch (error) {
      console.error('Failed to execute modification:', error);
      return false;
    }
  }

  /**
   * Record modification in database
   */
  private async recordModification(request: DerivativeOrderModificationRequest, status: string, errorMessage?: string): Promise<void> {
    const db = userDatabase.getDatabase();
    const modificationId = `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const insertStmt = db.prepare(`
      INSERT INTO derivatives_order_modifications (
        id, order_id, broker_id, modification_type, new_value, status, reason, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let newValue = '';
    switch (request.modificationType) {
      case 'price':
        newValue = request.newPrice?.toString() || '';
        break;
      case 'quantity':
        newValue = request.newQuantity?.toString() || '';
        break;
      case 'stop_price':
        newValue = request.newStopPrice?.toString() || '';
        break;
      case 'trigger_price':
        newValue = request.newTriggerPrice?.toString() || '';
        break;
      case 'validity':
        newValue = request.newValidity || '';
        break;
    }

    insertStmt.run(
      modificationId,
      request.orderId,
      request.brokerId,
      request.modificationType,
      newValue,
      status,
      request.reason || null,
      errorMessage || null
    );
  }

  /**
   * Add to modification history
   */
  private addToModificationHistory(orderId: string, request: DerivativeOrderModificationRequest): void {
    if (!this.modificationHistory.has(orderId)) {
      this.modificationHistory.set(orderId, []);
    }
    this.modificationHistory.get(orderId)!.push(request);
  }

  /**
   * Cancel multiple orders in bulk
   */
  async bulkCancelOrders(request: BulkCancellationRequest): Promise<{ successful: string[], failed: string[] }> {
    const successful: string[] = [];
    const failed: string[] = [];
    const bulkId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Record bulk cancellation attempt
      await this.recordBulkCancellation(bulkId, request);

      // Process each order
      for (const orderId of request.orderIds) {
        try {
          const order = await this.getOrderById(orderId);
          if (!order) {
            failed.push(orderId);
            continue;
          }

          // Check if order can be cancelled
          if (!this.isOrderCancellable(order)) {
            failed.push(orderId);
            continue;
          }

          // Cancel the order
          const cancelled = await this.cancelSingleOrder(orderId, request.brokerId, request.reason);
          if (cancelled) {
            successful.push(orderId);
          } else {
            failed.push(orderId);
          }
        } catch (error) {
          console.error(`Failed to cancel order ${orderId}:`, error);
          failed.push(orderId);
        }
      }

      // Update bulk cancellation record
      await this.updateBulkCancellation(bulkId, successful.length, failed.length);

      this.emit('bulkCancellationCompleted', {
        bulkId,
        successful,
        failed,
        request
      });

      return { successful, failed };
    } catch (error) {
      console.error('Bulk cancellation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('bulkCancellationFailed', request, errorMessage);
      return { successful, failed };
    }
  }

  /**
   * Check if order can be cancelled
   */
  private isOrderCancellable(order: DerivativeOrder): boolean {
    const cancellableStatuses = ['pending', 'open', 'partially_filled'];
    return cancellableStatuses.includes(order.status);
  }

  /**
   * Cancel a single order
   */
  private async cancelSingleOrder(orderId: string, brokerId?: string, reason?: string): Promise<boolean> {
    const db = userDatabase.getDatabase();
    
    try {
      const updateStmt = db.prepare(`
        UPDATE derivatives_orders 
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ? AND status IN ('pending', 'open', 'partially_filled')
      `);
      
      const result = updateStmt.run(orderId);
      
      if (result.changes > 0) {
        this.emit('orderCancelled', { orderId, brokerId, reason });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to cancel order ${orderId}:`, error);
      return false;
    }
  }

  /**
   * Record bulk cancellation attempt
   */
  private async recordBulkCancellation(bulkId: string, request: BulkCancellationRequest): Promise<void> {
    const db = userDatabase.getDatabase();
    
    const insertStmt = db.prepare(`
      INSERT INTO derivatives_bulk_cancellations (
        id, broker_id, symbol, underlying, strategy_id, order_ids, total_orders, reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      bulkId,
      request.brokerId || null,
      request.symbol || null,
      request.underlying || null,
      request.strategyId || null,
      JSON.stringify(request.orderIds),
      request.orderIds.length,
      request.reason || null
    );
  }

  /**
   * Update bulk cancellation record
   */
  private async updateBulkCancellation(bulkId: string, successful: number, failed: number): Promise<void> {
    const db = userDatabase.getDatabase();
    
    const updateStmt = db.prepare(`
      UPDATE derivatives_bulk_cancellations 
      SET successful_cancellations = ?, failed_cancellations = ?, 
          status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const status = failed === 0 ? 'completed' : (successful === 0 ? 'failed' : 'partial');
    updateStmt.run(successful, failed, status, bulkId);
  }

  /**
   * Replace an order with a new one
   */
  async replaceOrder(request: OrderReplacementRequest): Promise<boolean> {
    try {
      // Validate replacement request
      const validation = await this.validateOrderReplacement(request);
      if (!validation.isValid) {
        this.emit('replacementFailed', request, validation.errors);
        return false;
      }

      const db = userDatabase.getDatabase();
      
      return await new Promise((resolve) => {
        db.transaction(() => {
          try {
            // Cancel original order
            const cancelStmt = db.prepare(`
              UPDATE derivatives_orders 
              SET status = 'replaced', updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `);
            cancelStmt.run(request.originalOrderId);

            // Create new order with updated details
            const newOrderId = `repl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const insertStmt = db.prepare(`
              INSERT INTO derivatives_orders (
                id, broker_id, symbol, underlying, order_type, transaction_type,
                quantity, price, stop_price, status, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);

            insertStmt.run(
              newOrderId,
              request.brokerId,
              request.newOrder.symbol,
              request.newOrder.underlying,
              request.newOrder.orderType,
              request.newOrder.transactionType,
              request.newOrder.quantity,
              request.newOrder.price || null,
              request.newOrder.stopPrice || null,
              'pending'
            );

            this.emit('orderReplaced', {
              originalOrderId: request.originalOrderId,
              newOrderId,
              request
            });

            resolve(true);
          } catch (error) {
            console.error('Failed to replace order:', error);
            resolve(false);
          }
        })();
      });
    } catch (error) {
      console.error('Order replacement failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('replacementFailed', request, [errorMessage]);
      return false;
    }
  }

  /**
   * Validate order replacement request
   */
  private async validateOrderReplacement(request: OrderReplacementRequest): Promise<ModificationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!request.originalOrderId) {
      errors.push('Original order ID is required');
    }

    if (!request.brokerId) {
      errors.push('Broker ID is required');
    }

    if (!request.newOrder) {
      errors.push('New order details are required');
    } else {
      // Validate new order details
      if (!request.newOrder.symbol) {
        errors.push('Symbol is required for new order');
      }
      if (!request.newOrder.orderType) {
        errors.push('Order type is required for new order');
      }
      if (!request.newOrder.transactionType) {
        errors.push('Transaction type is required for new order');
      }
      if (!request.newOrder.quantity || request.newOrder.quantity <= 0) {
        errors.push('Valid quantity is required for new order');
      }
    }

    // Check if original order exists and is replaceable
    const originalOrder = await this.getOrderById(request.originalOrderId);
    if (!originalOrder) {
      errors.push('Original order not found');
    } else if (!this.isOrderModifiable(originalOrder)) {
      errors.push('Original order is not in a replaceable state');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get order by ID
   */
  private async getOrderById(orderId: string): Promise<DerivativeOrder | null> {
    const db = userDatabase.getDatabase();
    const stmt = db.prepare('SELECT * FROM derivatives_orders WHERE id = ?');
    const row = stmt.get(orderId) as any;
    
    if (!row) return null;

    return {
      id: row.id,
      brokerId: row.broker_id,
      symbol: row.symbol,
      underlying: row.underlying,
      orderType: row.order_type,
      transactionType: row.transaction_type,
      quantity: row.quantity,
      price: row.price,
      stopPrice: row.stop_price,
      status: row.status,
      filledQuantity: row.filled_quantity || 0,
      avgFillPrice: row.avg_fill_price || 0,
      timestamp: new Date(row.created_at)
    };
  }

  /**
   * Get modification history for an order
   */
  getModificationHistory(orderId: string): DerivativeOrderModificationRequest[] {
    return this.modificationHistory.get(orderId) || [];
  }

  /**
   * Get pending modifications
   */
  getPendingModifications(): DerivativeOrderModificationRequest[] {
    return Array.from(this.pendingModifications.values());
  }

  /**
   * Check if market is open (simplified implementation)
   */
  private isMarketOpen(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 60 + minute;
    
    // Indian market hours: 9:15 AM to 3:30 PM
    const marketOpen = 9 * 60 + 15; // 9:15 AM
    const marketClose = 15 * 60 + 30; // 3:30 PM
    
    return currentTime >= marketOpen && currentTime <= marketClose;
  }
}

export const derivativesOrderModificationService = new DerivativesOrderModificationService();