/**
 * Tracked Broker Service
 * Wraps broker service operations with comprehensive error logging
 */

import { IUnifiedBrokerService } from '@copytrade/unified-broker';
import { brokerErrorLoggingService, BrokerOperationContext } from './brokerErrorLoggingService';
import { traceIdService } from './traceIdService';
import TraceContext from '../utils/traceContext';
import { logger } from '../utils/logger';

/**
 * Wrapper class that adds error logging to broker service operations
 */
export class TrackedBrokerService {
  private brokerService: IUnifiedBrokerService;
  private userId: string;
  private brokerName: string;
  private accountId: string;

  constructor(
    brokerService: IUnifiedBrokerService,
    userId: string,
    brokerName: string,
    accountId: string
  ) {
    this.brokerService = brokerService;
    this.userId = userId;
    this.brokerName = brokerName;
    this.accountId = accountId;
  }

  /**
   * Place order with comprehensive error logging
   */
  async placeOrder(orderRequest: any): Promise<any> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const context: BrokerOperationContext = {
      userId: this.userId,
      brokerName: this.brokerName,
      accountId: this.accountId,
      operation: 'PLACE_ORDER',
      traceId,
      orderDetails: {
        symbol: orderRequest.symbol,
        quantity: orderRequest.quantity,
        price: orderRequest.price,
        orderType: orderRequest.orderType,
        side: orderRequest.side
      },
      requestDetails: {
        method: 'POST',
        url: `/api/broker/place-order`,
        requestId: traceId
      }
    };

    try {
      await traceIdService.addOperation(traceId, 'PLACE_ORDER', 'BROKER_SERVICE');

      logger.info(`Placing order on ${this.brokerName}`, {
        component: 'TRACKED_BROKER_SERVICE',
        operation: 'PLACE_ORDER',
        traceId,
        userId: this.userId,
        brokerName: this.brokerName,
        accountId: this.accountId,
        orderDetails: context.orderDetails
      });

      const result = await this.brokerService.placeOrder(orderRequest);
      const duration = performance.now() - startTime;

      if (result.success) {
        await brokerErrorLoggingService.logBrokerSuccess(
          `Order placed successfully: ${orderRequest.symbol} ${orderRequest.side} ${orderRequest.quantity}`,
          {
            ...context,
            orderDetails: {
              ...context.orderDetails,
              orderId: result.orderId
            },
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'PLACE_ORDER',
          'SUCCESS',
          { 
            orderId: result.orderId,
            symbol: orderRequest.symbol,
            duration 
          }
        );
      } else {
        await brokerErrorLoggingService.logBrokerError(
          result.message || 'Order placement failed',
          new Error(result.message || 'Unknown order error'),
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'PLACE_ORDER',
          'ERROR',
          { 
            error: result.message,
            symbol: orderRequest.symbol,
            duration 
          }
        );
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      await brokerErrorLoggingService.logBrokerError(
        `Order placement failed: ${error.message}`,
        error,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'PLACE_ORDER',
        'ERROR',
        { 
          error: error.message,
          symbol: orderRequest.symbol,
          duration 
        }
      );

      throw error;
    }
  }

  /**
   * Get order status with error logging
   */
  async getOrderStatus(brokerAccountId: string, orderId: string): Promise<any> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const context: BrokerOperationContext = {
      userId: this.userId,
      brokerName: this.brokerName,
      accountId: this.accountId,
      operation: 'GET_ORDER_STATUS',
      traceId,
      orderDetails: {
        orderId
      },
      requestDetails: {
        method: 'GET',
        url: `/api/broker/order-status/${orderId}`,
        requestId: traceId
      }
    };

    try {
      await traceIdService.addOperation(traceId, 'GET_ORDER_STATUS', 'BROKER_SERVICE');

      const result = await this.brokerService.getOrderStatus(brokerAccountId, orderId);
      const duration = performance.now() - startTime;

      if (result.success) {
        await brokerErrorLoggingService.logBrokerSuccess(
          `Order status retrieved: ${orderId}`,
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'GET_ORDER_STATUS',
          'SUCCESS',
          { 
            orderId,
            status: result.status,
            duration 
          }
        );
      } else {
        await brokerErrorLoggingService.logBrokerError(
          result.message || 'Failed to get order status',
          new Error(result.message || 'Unknown order status error'),
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'GET_ORDER_STATUS',
          'ERROR',
          { 
            orderId,
            error: result.message,
            duration 
          }
        );
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      await brokerErrorLoggingService.logBrokerError(
        `Failed to get order status: ${error.message}`,
        error,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'GET_ORDER_STATUS',
        'ERROR',
        { 
          orderId,
          error: error.message,
          duration 
        }
      );

      throw error;
    }
  }

  /**
   * Cancel order with error logging
   */
  async cancelOrder(brokerAccountId: string, orderId: string): Promise<any> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const context: BrokerOperationContext = {
      userId: this.userId,
      brokerName: this.brokerName,
      accountId: this.accountId,
      operation: 'CANCEL_ORDER',
      traceId,
      orderDetails: {
        orderId
      },
      requestDetails: {
        method: 'DELETE',
        url: `/api/broker/cancel-order/${orderId}`,
        requestId: traceId
      }
    };

    try {
      await traceIdService.addOperation(traceId, 'CANCEL_ORDER', 'BROKER_SERVICE');

      const result = await this.brokerService.cancelOrder(orderId);
      const duration = performance.now() - startTime;

      if (result.success) {
        await brokerErrorLoggingService.logBrokerSuccess(
          `Order cancelled successfully: ${orderId}`,
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'CANCEL_ORDER',
          'SUCCESS',
          { 
            orderId,
            duration 
          }
        );
      } else {
        await brokerErrorLoggingService.logBrokerError(
          result.message || 'Order cancellation failed',
          new Error(result.message || 'Unknown cancellation error'),
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'CANCEL_ORDER',
          'ERROR',
          { 
            orderId,
            error: result.message,
            duration 
          }
        );
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      await brokerErrorLoggingService.logBrokerError(
        `Failed to cancel order: ${error.message}`,
        error,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'CANCEL_ORDER',
        'ERROR',
        { 
          orderId,
          error: error.message,
          duration 
        }
      );

      throw error;
    }
  }



  /**
   * Get order book with error logging
   */
  async getOrderBook(brokerAccountId: string): Promise<any> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const context: BrokerOperationContext = {
      userId: this.userId,
      brokerName: this.brokerName,
      accountId: this.accountId,
      operation: 'GET_ORDER_BOOK',
      traceId,
      requestDetails: {
        method: 'GET',
        url: `/api/broker/order-book`,
        requestId: traceId
      }
    };

    try {
      await traceIdService.addOperation(traceId, 'GET_ORDER_BOOK', 'BROKER_SERVICE');

      // const result = await this.brokerService.getOrderBook(brokerAccountId); // Method doesn't exist
      const result = { success: false, message: 'getOrderBook not implemented' };
      const duration = performance.now() - startTime;

      if (result.success) {
        await brokerErrorLoggingService.logBrokerSuccess(
          `Order book retrieved successfully`,
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'GET_ORDER_BOOK',
          'SUCCESS',
          { 
            // orderCount: result.orders?.length || 0, // orders property doesn't exist
            duration 
          }
        );
      } else {
        await brokerErrorLoggingService.logBrokerError(
          result.message || 'Failed to get order book',
          new Error(result.message || 'Unknown order book error'),
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'GET_ORDER_BOOK',
          'ERROR',
          { 
            error: result.message,
            duration 
          }
        );
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      await brokerErrorLoggingService.logBrokerError(
        `Failed to get order book: ${error.message}`,
        error,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'GET_ORDER_BOOK',
        'ERROR',
        { 
          error: error.message,
          duration 
        }
      );

      throw error;
    }
  }

  /**
   * Search symbols with error logging
   */
  async searchSymbols(query: string): Promise<any> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const context: BrokerOperationContext = {
      userId: this.userId,
      brokerName: this.brokerName,
      accountId: this.accountId,
      operation: 'SEARCH_SYMBOLS',
      traceId,
      requestDetails: {
        method: 'GET',
        url: `/api/broker/search-symbols?q=${query}`,
        requestId: traceId
      }
    };

    try {
      await traceIdService.addOperation(traceId, 'SEARCH_SYMBOLS', 'BROKER_SERVICE');

      const result = await this.brokerService.searchSymbols(query, 'NSE'); // Default exchange
      const duration = performance.now() - startTime;

      if (result.success) {
        await brokerErrorLoggingService.logBrokerSuccess(
          `Symbol search completed: ${query}`,
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'SEARCH_SYMBOLS',
          'SUCCESS',
          { 
            query,
            resultCount: result.symbols?.length || 0,
            duration 
          }
        );
      } else {
        await brokerErrorLoggingService.logBrokerError(
          result.message || 'Symbol search failed',
          new Error(result.message || 'Unknown search error'),
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'SEARCH_SYMBOLS',
          'ERROR',
          { 
            query,
            error: result.message,
            duration 
          }
        );
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      await brokerErrorLoggingService.logBrokerError(
        `Symbol search failed: ${error.message}`,
        error,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'SEARCH_SYMBOLS',
        'ERROR',
        { 
          query,
          error: error.message,
          duration 
        }
      );

      throw error;
    }
  }



  // Delegate methods that don't need error logging
  isConnected(): boolean {
    return this.brokerService.isConnected();
  }

  getBrokerName(): string {
    return this.brokerService.getBrokerName();
  }

  getAccountId(): string {
    const accountInfo = this.brokerService.getAccountInfo();
    return accountInfo?.accountId || '';
  }
}

/**
 * Factory function to create tracked broker service
 */
export function createTrackedBrokerService(
  brokerService: IUnifiedBrokerService,
  userId: string,
  brokerName: string,
  accountId: string
): TrackedBrokerService {
  return new TrackedBrokerService(brokerService, userId, brokerName, accountId);
}