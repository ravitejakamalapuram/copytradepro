/**
 * Order Retry Service
 * Handles automatic and manual retry of failed orders
 */

import { userDatabase } from './databaseCompatibility';
import { enhancedUnifiedBrokerManager } from './enhancedUnifiedBrokerManager';
import { OrderErrorClassifier } from './orderErrorClassifier';
import { logger } from '../utils/logger';
import { OrderHistory } from '../interfaces/IDatabaseAdapter';

export interface RetryResult {
  success: boolean;
  message: string;
  orderId?: string | undefined;
  newStatus?: string;
  retryCount?: number;
  isRetryable?: boolean;
}

export class OrderRetryService {
  private static instance: OrderRetryService;
  private errorClassifier: OrderErrorClassifier;
  private retryQueue: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.errorClassifier = OrderErrorClassifier.getInstance();
  }

  public static getInstance(): OrderRetryService {
    if (!OrderRetryService.instance) {
      OrderRetryService.instance = new OrderRetryService();
    }
    return OrderRetryService.instance;
  }

  /**
   * Retry a failed order manually
   */
  async retryOrder(orderId: string, userId: string): Promise<RetryResult> {
    try {
      // Get order from database
      const order = await userDatabase.getOrderHistoryById(parseInt(orderId));
      if (!order) {
        return {
          success: false,
          message: 'Order not found'
        };
      }

      // Verify order belongs to user
      if (order.user_id.toString() !== userId) {
        return {
          success: false,
          message: 'Access denied'
        };
      }

      // Check if order is retryable
      if (!order.is_retryable) {
        return {
          success: false,
          message: 'Order is not retryable',
          isRetryable: false
        };
      }

      // Check retry limits
      const currentRetryCount = order.retry_count || 0;
      const maxRetries = order.max_retries || 3;
      
      if (currentRetryCount >= maxRetries) {
        return {
          success: false,
          message: `Maximum retry attempts (${maxRetries}) exceeded`,
          retryCount: currentRetryCount,
          isRetryable: false
        };
      }

      // Increment retry count
      await userDatabase.incrementOrderRetryCount(orderId);

      // Attempt to retry the order
      const retryResult = await this.executeOrderRetry(order);

      if (retryResult.success) {
        // Update order status to PLACED
        await userDatabase.updateOrderStatus(parseInt(orderId), 'PLACED');
        
        return {
          success: true,
          message: 'Order retried successfully',
          orderId: retryResult.orderId,
          newStatus: 'PLACED',
          retryCount: currentRetryCount + 1
        };
      } else {
        // Update with new error information
        const errorClassification = this.errorClassifier.classifyFyersError({
          message: retryResult.message
        });

        await userDatabase.updateOrderWithError(orderId, {
          status: 'FAILED',
          error_message: retryResult.message,
          failure_reason: errorClassification.userMessage,
          is_retryable: errorClassification.isRetryable && (currentRetryCount + 1) < maxRetries
        });

        return {
          success: false,
          message: retryResult.message,
          retryCount: currentRetryCount + 1,
          isRetryable: errorClassification.isRetryable && (currentRetryCount + 1) < maxRetries
        };
      }

    } catch (error: any) {
      logger.error('Failed to retry order:', error);
      return {
        success: false,
        message: error.message || 'Failed to retry order'
      };
    }
  }

  /**
   * Schedule automatic retry for a failed order
   */
  async scheduleAutoRetry(orderId: string, delayMs: number): Promise<void> {
    // Cancel existing retry if scheduled
    if (this.retryQueue.has(orderId)) {
      clearTimeout(this.retryQueue.get(orderId)!);
    }

    // Schedule new retry
    const timeout = setTimeout(async () => {
      try {
        const order = await userDatabase.getOrderHistoryById(parseInt(orderId));
        if (order && order.is_retryable) {
          const result = await this.retryOrder(orderId, order.user_id.toString());
          logger.info(`Auto-retry result for order ${orderId}:`, result);
        }
      } catch (error) {
        logger.error(`Auto-retry failed for order ${orderId}:`, error);
      } finally {
        this.retryQueue.delete(orderId);
      }
    }, delayMs);

    this.retryQueue.set(orderId, timeout);
    logger.info(`Scheduled auto-retry for order ${orderId} in ${delayMs}ms`);
  }

  /**
   * Cancel scheduled retry
   */
  cancelScheduledRetry(orderId: string): void {
    if (this.retryQueue.has(orderId)) {
      clearTimeout(this.retryQueue.get(orderId)!);
      this.retryQueue.delete(orderId);
      logger.info(`Cancelled scheduled retry for order ${orderId}`);
    }
  }

  /**
   * Execute the actual order retry
   */
  private async executeOrderRetry(order: OrderHistory): Promise<{ success: boolean; message: string; orderId?: string }> {
    try {
      // Get account information
      const account = await userDatabase.getConnectedAccountById(order.account_id.toString());
      if (!account) {
        throw new Error('Account not found');
      }

      // Create order request from stored order data
      const orderRequest = {
        symbol: order.symbol,
        action: order.action,
        quantity: order.quantity,
        orderType: order.order_type,
        price: order.price,
        exchange: order.exchange,
        productType: order.product_type,
        validity: 'DAY' as const,
        remarks: `Retry of order ${order.broker_order_id}`,
        accountId: account.account_id
      };

      // Get broker service
      const brokerService = enhancedUnifiedBrokerManager.getBrokerService(
        order.user_id.toString(),
        order.broker_name,
        account.account_id
      );

      if (!brokerService) {
        throw new Error(`No active connection found for ${order.broker_name}`);
      }

      // Place the order
      const response = await brokerService.placeOrder(orderRequest);

      if (response.success) {
        return {
          success: true,
          message: 'Order retried successfully',
          orderId: response.data?.brokerOrderId || response.data?.orderId
        };
      } else {
        return {
          success: false,
          message: response.message || 'Retry failed'
        };
      }

    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Retry execution failed'
      };
    }
  }

  /**
   * Get retry statistics
   */
  getRetryStats(): { scheduledRetries: number; queuedOrders: string[] } {
    return {
      scheduledRetries: this.retryQueue.size,
      queuedOrders: Array.from(this.retryQueue.keys())
    };
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    for (const [orderId, timeout] of this.retryQueue) {
      clearTimeout(timeout);
    }
    this.retryQueue.clear();
  }
}

export const orderRetryService = OrderRetryService.getInstance();
