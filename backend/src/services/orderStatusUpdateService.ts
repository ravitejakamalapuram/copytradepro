import { logger } from '../utils/logger';
import { userDatabase } from './databaseCompatibility';
import websocketService from './websocketService';
import { OrderHistory } from '../interfaces/IDatabaseAdapter';

/**
 * Enhanced Order Status Update Service
 * Provides comprehensive order status updates with database consistency and WebSocket broadcasting
 */
export class OrderStatusUpdateService {
  /**
   * Update order status with comprehensive data and broadcast changes
   * @param orderId - Internal order ID (MongoDB ObjectId string)
   * @param statusUpdate - Status update data from broker
   * @param userId - User ID for WebSocket broadcasting
   * @param options - Update options
   */
  async updateOrderStatusComprehensive(
    orderId: string,
    statusUpdate: {
      status: string;
      executedQuantity?: number;
      averagePrice?: number;
      rejectionReason?: string;
      updateTime?: Date;
      brokerResponse?: any;
    },
    userId: string,
    options: {
      broadcastUpdate?: boolean;
      requireAcknowledgment?: boolean;
      maxBroadcastRetries?: number;
      skipIfUnchanged?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    updated: boolean;
    orderHistory?: OrderHistory;
    broadcastResult?: { success: boolean; error?: string; retriesUsed?: number };
    error?: string;
  }> {
    const {
      broadcastUpdate = true,
      requireAcknowledgment = false,
      maxBroadcastRetries = 3,
      skipIfUnchanged = true
    } = options;

    try {
      // Get current order from database
      const currentOrder = await userDatabase.getOrderHistoryById(orderId);
      if (!currentOrder) {
        logger.error(`Order ${orderId} not found for status update`);
        return { success: false, updated: false, error: 'Order not found' };
      }

      // Check if status actually changed
      const statusChanged = currentOrder.status !== statusUpdate.status;
      const quantityChanged = currentOrder.executed_quantity !== statusUpdate.executedQuantity;
      const priceChanged = currentOrder.average_price !== statusUpdate.averagePrice;
      
      const hasChanges = statusChanged || quantityChanged || priceChanged || statusUpdate.rejectionReason;

      if (skipIfUnchanged && !hasChanges) {
        logger.debug(`No changes detected for order ${orderId}, skipping update`);
        return { success: true, updated: false, orderHistory: currentOrder };
      }

      // Prepare comprehensive update data
      const updateData: any = {
        last_updated: statusUpdate.updateTime || new Date()
      };

      if (statusUpdate.status) updateData.status = statusUpdate.status;
      if (statusUpdate.executedQuantity !== undefined) updateData.executed_quantity = statusUpdate.executedQuantity;
      if (statusUpdate.averagePrice !== undefined) updateData.average_price = statusUpdate.averagePrice;
      if (statusUpdate.rejectionReason) updateData.rejection_reason = statusUpdate.rejectionReason;

      // Perform atomic database update
      const updatedOrder = await userDatabase.updateOrderComprehensive(orderId, updateData);
      
      if (!updatedOrder) {
        logger.error(`Failed to update order ${orderId} in database`);
        return { success: false, updated: false, error: 'Database update failed' };
      }

      logger.info(`Order ${orderId} updated successfully`, {
        orderId,
        userId,
        previousStatus: currentOrder.status,
        newStatus: updatedOrder.status,
        statusChanged,
        quantityChanged,
        priceChanged
      });

      let broadcastResult;
      
      // Broadcast update via WebSocket if requested
      if (broadcastUpdate) {
        broadcastResult = await this.broadcastOrderUpdate(
          userId,
          updatedOrder,
          currentOrder,
          {
            requireAcknowledgment,
            maxRetries: maxBroadcastRetries
          }
        );
      }

      const result: any = {
        success: true,
        updated: true,
        orderHistory: updatedOrder
      };
      
      if (broadcastResult) {
        result.broadcastResult = broadcastResult;
      }
      
      return result;

    } catch (error: any) {
      logger.error(`Error updating order status for ${orderId}:`, error);
      return { success: false, updated: false, error: error.message };
    }
  }

  /**
   * Update order status with error information
   * @param orderId - Internal order ID
   * @param errorInfo - Error information
   * @param userId - User ID for broadcasting
   */
  async updateOrderWithError(
    orderId: string,
    errorInfo: {
      status: string;
      errorMessage?: string;
      errorCode?: string;
      errorType?: 'NETWORK' | 'BROKER' | 'VALIDATION' | 'AUTH' | 'SYSTEM' | 'MARKET';
      failureReason?: string;
      isRetryable?: boolean;
    },
    userId: string,
    options: { broadcastUpdate?: boolean } = {}
  ): Promise<{ success: boolean; updated: boolean; broadcastResult?: any; error?: string }> {
    const { broadcastUpdate = true } = options;

    try {
      // Get current order for comparison
      const currentOrder = await userDatabase.getOrderHistoryById(orderId);
      if (!currentOrder) {
        return { success: false, updated: false, error: 'Order not found' };
      }

      // Update order with error information
      const errorData: any = {
        status: errorInfo.status,
        is_retryable: errorInfo.isRetryable || false
      };
      
      if (errorInfo.errorMessage) errorData.error_message = errorInfo.errorMessage;
      if (errorInfo.errorCode) errorData.error_code = errorInfo.errorCode;
      if (errorInfo.errorType) errorData.error_type = errorInfo.errorType;
      if (errorInfo.failureReason) errorData.failure_reason = errorInfo.failureReason;

      const updateSuccess = await userDatabase.updateOrderWithError(orderId, errorData);

      if (!updateSuccess) {
        return { success: false, updated: false, error: 'Database update failed' };
      }

      // Get updated order
      const updatedOrder = await userDatabase.getOrderHistoryById(orderId);
      if (!updatedOrder) {
        return { success: false, updated: false, error: 'Failed to retrieve updated order' };
      }

      logger.info(`Order ${orderId} updated with error information`, {
        orderId,
        userId,
        errorStatus: errorInfo.status,
        errorType: errorInfo.errorType,
        isRetryable: errorInfo.isRetryable
      });

      let broadcastResult;
      
      // Broadcast error update if requested
      if (broadcastUpdate) {
        broadcastResult = await this.broadcastOrderUpdate(
          userId,
          updatedOrder,
          currentOrder,
          { requireAcknowledgment: false, maxRetries: 2 }
        );
      }

      return { success: true, updated: true, broadcastResult };

    } catch (error: any) {
      logger.error(`Error updating order with error info for ${orderId}:`, error);
      return { success: false, updated: false, error: error.message };
    }
  }

  /**
   * Broadcast order update via WebSocket
   * @param userId - User ID
   * @param updatedOrder - Updated order data
   * @param previousOrder - Previous order data for comparison
   * @param options - Broadcasting options
   */
  private async broadcastOrderUpdate(
    userId: string,
    updatedOrder: OrderHistory,
    previousOrder: OrderHistory,
    options: {
      requireAcknowledgment?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<{ success: boolean; error?: string; retriesUsed?: number }> {
    try {
      const orderUpdate: any = {
        orderId: updatedOrder.id.toString(),
        brokerOrderId: updatedOrder.broker_order_id,
        status: updatedOrder.status,
        timestamp: new Date(),
        symbol: updatedOrder.symbol,
        executedQuantity: (updatedOrder as any).executed_quantity || 0,
        averagePrice: (updatedOrder as any).average_price || 0
      };
      
      if (previousOrder.status !== updatedOrder.status) {
        orderUpdate.previousStatus = previousOrder.status;
      }
      
      if ((updatedOrder as any).rejection_reason) {
        orderUpdate.rejectionReason = (updatedOrder as any).rejection_reason;
      }

      return await websocketService.broadcastOrderStatusUpdate(
        userId,
        orderUpdate,
        {
          maxRetries: options.maxRetries || 3,
          retryDelay: 1000,
          requireAcknowledgment: options.requireAcknowledgment || false
        }
      );

    } catch (error: any) {
      logger.error(`Error broadcasting order update for ${updatedOrder.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Batch update multiple orders with broadcasting
   * @param updates - Array of order updates
   * @param userId - User ID for broadcasting
   */
  async batchUpdateOrderStatus(
    updates: Array<{
      orderId: string;
      statusUpdate: {
        status: string;
        executedQuantity?: number;
        averagePrice?: number;
        rejectionReason?: string;
        updateTime?: Date;
      };
    }>,
    userId: string,
    options: { broadcastUpdates?: boolean } = {}
  ): Promise<{
    success: boolean;
    results: Array<{ orderId: string; success: boolean; updated: boolean; error?: string }>;
    totalUpdated: number;
  }> {
    const { broadcastUpdates = true } = options;
    const results: Array<{ orderId: string; success: boolean; updated: boolean; error?: string }> = [];
    let totalUpdated = 0;

    logger.info(`Starting batch update of ${updates.length} orders for user ${userId}`);

    for (const update of updates) {
      try {
        const result = await this.updateOrderStatusComprehensive(
          update.orderId,
          update.statusUpdate,
          userId,
          {
            broadcastUpdate: broadcastUpdates,
            requireAcknowledgment: false,
            maxBroadcastRetries: 2,
            skipIfUnchanged: true
          }
        );

        const resultItem: any = {
          orderId: update.orderId,
          success: result.success,
          updated: result.updated
        };
        
        if (result.error) {
          resultItem.error = result.error;
        }
        
        results.push(resultItem);

        if (result.updated) {
          totalUpdated++;
        }

      } catch (error: any) {
        logger.error(`Error in batch update for order ${update.orderId}:`, error);
        results.push({
          orderId: update.orderId,
          success: false,
          updated: false,
          error: error.message
        });
      }
    }

    logger.info(`Batch update completed: ${totalUpdated}/${updates.length} orders updated`);

    return {
      success: true,
      results,
      totalUpdated
    };
  }
}

// Export singleton instance
export const orderStatusUpdateService = new OrderStatusUpdateService();