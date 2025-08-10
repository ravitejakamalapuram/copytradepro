import { EventEmitter } from 'events';
import { userDatabase } from './databaseCompatibility';
import { UnifiedBrokerFactory } from '@copytrade/unified-broker';
import { notificationService } from './notificationService';

// Import WebSocket service for real-time updates
import websocketService from './websocketService';

// Import enhanced logging for order status operations
import { orderStatusLogger, OrderStatusLogContext } from './orderStatusLogger';

// Stateless helper to get a broker service connected with DB credentials
async function getStatelessBrokerService(userId: string, brokerName: string, accountId: string) {
  const credentials = await userDatabase.getAccountCredentials(accountId);
  if (!credentials) return null;
  const service = UnifiedBrokerFactory.getInstance().createBroker(brokerName);
  await service.connect(credentials).catch(() => {});
  return service;
}

// Enhanced logger with structured logging
const logger = {
  info: (message: string, context?: any, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [INFO] [ORDER_STATUS_SERVICE] ${message}`, context || {}, data || {});
  },
  warn: (message: string, context?: any, data?: any) => {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [WARN] [ORDER_STATUS_SERVICE] ${message}`, context || {}, data || {});
  },
  error: (message: string, context?: any, error?: any) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [ERROR] [ORDER_STATUS_SERVICE] ${message}`, context || {}, error || {});
  },
  debug: (message: string, context?: any, data?: any) => {
    const timestamp = new Date().toISOString();
    console.debug(`[${timestamp}] [DEBUG] [ORDER_STATUS_SERVICE] ${message}`, context || {}, data || {});
  },
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

  constructor() {
    super();
  }







  /**
   * Start monitoring order status (manual refresh only)
   */
  async startMonitoring(): Promise<void> {
    logger.info('Order status monitoring initialized (manual refresh only)');

    try {
      // Get all pending orders from database for initial count
      const pendingOrders = await this.getPendingOrders();
      logger.info(`Found ${pendingOrders.length} orders available for manual status checking`);

      this.isPolling = false; // No automatic polling
      logger.info('Order status monitoring ready - use manual refresh buttons for updates');

    } catch (error) {
      logger.error('Failed to initialize order monitoring:', error);
    }
  }







  /**
   * Get pending orders from database
   */
  private async getPendingOrders(): Promise<Order[]> {
    try {
      // Get all pending orders from all users
      const orders = (await userDatabase.getAllOrderHistory())
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
   * Check status of a specific order using real broker API with enhanced logging
   */
  async checkOrderStatus(order: Order, retryCount: number = 0): Promise<void> {
    const startTime = performance.now();
    const operationId = `checkOrderStatus_${order.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced logging context
    const logContext: OrderStatusLogContext = {
      userId: order.user_id?.toString(),
      brokerName: order.broker_name,
      accountId: order.account_id?.toString(),
      operation: 'checkOrderStatus',
      orderId: order.id,
      symbol: order.symbol,
      quantity: order.quantity,
      price: order.price,
      orderType: order.order_type,
      productType: order.product_type,
      retryAttempt: retryCount
    };
    
    // Add orderNumber only if it exists
    if (order.broker_order_id) {
      logContext.orderNumber = order.broker_order_id;
    }

    // Start performance tracking
    orderStatusLogger.startPerformanceTracking(operationId, 'checkOrderStatus', logContext);

    // Log operation start
    logger.info('Order status check initiated', logContext, {
      operationId,
      currentStatus: order.status,
      retryCount
    });

    try {
      if (!order.broker_order_id) {
        const error = new Error(`Order ${order.id} has no broker_order_id`);
        
        logger.warn('Order status check failed - missing broker order ID', logContext, {
          operationId,
          errorType: 'VALIDATION_ERROR'
        });

        orderStatusLogger.logOrderStatusError(logContext, {
          message: error.message,
          errorType: 'VALIDATION_ERROR'
        });

        orderStatusLogger.endPerformanceTracking(operationId, false, 'VALIDATION_ERROR');
        return;
      }

      logger.debug('Order status check parameters validated', logContext, {
        operationId,
        brokerOrderId: order.broker_order_id
      });

      // Get the broker account ID from the order
      const brokerAccountId = await this.getBrokerAccountIdFromOrder(order);
      if (!brokerAccountId) {
        const error = new Error(`Could not get broker account ID for order ${order.id}`);
        
        logger.warn('Order status check failed - broker account ID not found', logContext, {
          operationId,
          errorType: 'ACCOUNT_NOT_FOUND'
        });

        orderStatusLogger.logOrderStatusError(logContext, {
          message: error.message,
          errorType: 'ACCOUNT_NOT_FOUND'
        });

        orderStatusLogger.endPerformanceTracking(operationId, false, 'ACCOUNT_NOT_FOUND');
        return;
      }

      // Update log context with resolved account ID
      logContext.accountId = brokerAccountId;

      logger.debug('Broker account ID resolved', logContext, {
        operationId,
        brokerAccountId
      });

      let newStatus = order.status;

      // Try to get real status from broker API first (stateless)
      try {
        // Get stateless broker service using DB credentials
        const brokerService = await getStatelessBrokerService(order.user_id.toString(), order.broker_name, brokerAccountId);

        if (brokerService) {
          logger.debug('Stateless broker service ready, calling API', logContext, {
            operationId,
            brokerService: !!brokerService
          });

            // Log the API request
            orderStatusLogger.logOrderStatusRequest(logContext);

            // Try to get order status from broker API with performance tracking
            const apiStartTime = performance.now();
            logger.debug('Calling broker API for order status', logContext, {
              operationId,
              brokerOrderId: order.broker_order_id
            });

            const brokerStatus = await brokerService.getOrderStatus(brokerAccountId, order.broker_order_id);
            const apiDuration = performance.now() - apiStartTime;

            // Update log context with API response time
            logContext.responseTime = apiDuration;

            logger.debug('Broker API response received', logContext, {
              operationId,
              apiDuration: Math.round(apiDuration),
              responseType: typeof brokerStatus,
              hasResponse: !!brokerStatus
            });

            // Handle different broker response formats
            if (brokerStatus) {
              let statusValue = '';
              let brokerResponseData: any = {};

              // Handle unified response format
              if ((brokerStatus as any).success && (brokerStatus as any).data) {
                statusValue = (brokerStatus as any).data.status;
                brokerResponseData = (brokerStatus as any).data;
              }
              // Handle Shoonya response format
              else if ((brokerStatus as any).stat === 'Ok') {
                statusValue = (brokerStatus as any).status;
                brokerResponseData = brokerStatus;
              }
              // Handle direct OrderStatus format
              else if (brokerStatus.status) {
                statusValue = brokerStatus.status;
                brokerResponseData = brokerStatus;
              }

              if (statusValue) {
                const mappedStatus = this.mapBrokerStatus(statusValue, order.broker_name);
                
                logger.debug('Order status mapping completed', logContext, {
                  operationId,
                  originalStatus: statusValue,
                  mappedStatus,
                  currentStatus: order.status,
                  statusChanged: mappedStatus !== order.status
                });

                if (mappedStatus !== order.status) {
                  newStatus = mappedStatus;
                  
                  logger.info('Order status changed via broker API', logContext, {
                    operationId,
                    previousStatus: order.status,
                    newStatus: mappedStatus,
                    brokerStatus: statusValue
                  });

                  // Log successful status change
                  orderStatusLogger.logOrderStatusSuccess(logContext, {
                    ...brokerResponseData,
                    status: mappedStatus,
                    previousStatus: order.status
                  });
                } else {
                  logger.debug('Order status unchanged', logContext, {
                    operationId,
                    status: order.status
                  });

                  // Log successful status retrieval (no change)
                  orderStatusLogger.logOrderStatusSuccess(logContext, brokerResponseData);
                }
              } else {
                const errorMessage = (brokerStatus as any)?.emsg || 'Unknown error';
                
                logger.warn('Failed to extract status from broker API response', logContext, {
                  operationId,
                  errorMessage,
                  responseFormat: typeof brokerStatus
                });

                orderStatusLogger.logOrderStatusError(logContext, {
                  message: `Failed to get order status from broker API: ${errorMessage}`,
                  errorType: 'BROKER_RESPONSE_ERROR',
                  originalError: errorMessage
                });
              }
            } else {
              logger.warn('Empty response from broker API', logContext, {
                operationId,
                brokerResponse: brokerStatus
              });

              orderStatusLogger.logOrderStatusError(logContext, {
                message: 'Empty response from broker API',
                errorType: 'EMPTY_RESPONSE'
              });
            }
          } else {
            logger.warn('No active broker connection found', logContext, {
              operationId,
              brokerAccountId,
              brokerName: order.broker_name
            });

            orderStatusLogger.logOrderStatusError(logContext, {
              message: `No active broker connection found for user ${brokerAccountId} and broker ${order.broker_name}`,
              errorType: 'CONNECTION_NOT_FOUND'
            });
          }
        } catch (apiError: any) {
          const apiDuration = performance.now() - startTime;
          logContext.responseTime = apiDuration;

          logger.error('Broker API call failed', logContext, {
            operationId,
            errorMessage: apiError.message,
            errorType: apiError.errorType || 'API_ERROR',
            apiDuration: Math.round(apiDuration)
          });

          orderStatusLogger.logOrderStatusError(logContext, {
            message: `Error calling ${order.broker_name} API for order ${order.id}: ${apiError.message}`,
            errorType: apiError.errorType || 'API_ERROR',
            originalError: apiError.message
          });

          // Don't throw here - we want to continue with status update logic
        }


      // Update status if changed
      if (newStatus !== order.status) {
        const dbStartTime = performance.now();
        await this.updateOrderStatus(order, newStatus);
        const dbDuration = performance.now() - dbStartTime;

        // Log database operation
        orderStatusLogger.logDatabaseOperation(logContext, 'updateOrderStatus', true, {
          queryTime: Math.round(dbDuration),
          previousStatus: order.status,
          newStatus
        });

        logger.info('Order status updated in database', logContext, {
          operationId,
          previousStatus: order.status,
          newStatus,
          dbDuration: Math.round(dbDuration)
        });
      }

      // End performance tracking with success
      orderStatusLogger.endPerformanceTracking(operationId, true);

      const totalDuration = performance.now() - startTime;
      logger.info('Order status check completed successfully', logContext, {
        operationId,
        totalDuration: Math.round(totalDuration),
        statusChanged: newStatus !== order.status,
        finalStatus: newStatus
      });

    } catch (error: any) {
      const totalDuration = performance.now() - startTime;
      logContext.responseTime = totalDuration;

      logger.error('Order status check failed with unexpected error', logContext, {
        operationId,
        errorMessage: error.message,
        totalDuration: Math.round(totalDuration),
        retryCount
      });

      orderStatusLogger.logOrderStatusError(logContext, {
        message: `Error checking status for order ${order.id}: ${error.message}`,
        errorType: 'UNEXPECTED_ERROR',
        originalError: error.message
      });

      orderStatusLogger.endPerformanceTracking(operationId, false, 'UNEXPECTED_ERROR');

      // Retry logic with enhanced logging
      if (retryCount < this.maxRetries) {
        const retryDelay = 1000 * (retryCount + 1); // Exponential backoff
        
        logger.info('Scheduling retry for order status check', logContext, {
          operationId,
          retryAttempt: retryCount + 1,
          maxRetries: this.maxRetries,
          retryDelay
        });

        setTimeout(() => {
          this.checkOrderStatus(order, retryCount + 1);
        }, retryDelay);
      } else {
        logger.error('Max retries exceeded for order status check', logContext, {
          operationId,
          maxRetries: this.maxRetries,
          finalError: error.message
        });
      }
    }
  }

  /**
   * Get broker account ID from order (helper method)
   */
  private async getBrokerAccountIdFromOrder(order: Order): Promise<string | null> {
    try {
      logger.debug(`Getting broker account ID for order ${order.id}`);

      // First, try to get the connected account directly using the order's account_id
      if (order.account_id) {
        logger.debug(`Order has account_id: ${order.account_id}`);

        // Get connected account using account_id
        let account = null;
        try {
          account = await userDatabase.getConnectedAccountById(order.account_id as any);
        } catch (error) {
          logger.debug(`Failed to get connected account by ID ${order.account_id}:`, error);
        }
        logger.debug(`Connected account found:`, account ? 'Yes' : 'No');

        if (account) {
          logger.debug(`Broker account ID: ${account.account_id}`);
          return account.account_id; // This is the broker account ID (e.g., "FN135006")
        }
      }

      // Fallback: Try to get account info from order history table
      logger.debug(`Fallback: Checking order history for order ${order.id}`);
      const orderHistory = await userDatabase.getOrderHistoryById(order.id.toString());
      logger.debug(`Order history found:`, orderHistory ? 'Yes' : 'No');

      if (orderHistory) {
        logger.debug(`Order history account_id: ${orderHistory.account_id}`);

        // Get the connected account to find the broker account ID
        const account = await userDatabase.getConnectedAccountById(orderHistory.account_id);
        logger.debug(`Connected account found:`, account ? 'Yes' : 'No');

        if (account) {
          logger.debug(`Broker account ID: ${account.account_id}`);
          return account.account_id; // This is the broker account ID (e.g., "FN135006")
        }
      }

      // Final fallback: No stateless connection available without account ID
      logger.warn(`Could not find broker account ID for order ${order.id}`);
      return null;
    } catch (error) {
      logger.error(`Failed to get broker account ID for order ${order.id}:`, error);
      return null;
    }
  }

  /**
   * Map broker-specific status to our standard status
   */
  private mapBrokerStatus(brokerStatus: string, brokerName: string): string {
    // Shoonya status mapping
    const shoonyaStatusMap: { [key: string]: string } = {
      'PENDING': 'PENDING',
      'OPEN': 'PLACED',
      'COMPLETE': 'EXECUTED',
      'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED',
      'TRIGGER_PENDING': 'PENDING',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
    };

    // Fyers status mapping
    const fyersStatusMap: { [key: string]: string } = {
      'PENDING': 'PENDING',
      'OPEN': 'PLACED',
      'FILLED': 'EXECUTED',
      'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
    };

    // Select appropriate mapping based on broker
    let statusMap: { [key: string]: string };
    switch (brokerName.toLowerCase()) {
      case 'shoonya':
        statusMap = shoonyaStatusMap;
        break;
      case 'fyers':
        statusMap = fyersStatusMap;
        break;
      default:
        // For unknown brokers, return status as-is
        return brokerStatus;
    }

    return statusMap[brokerStatus] || brokerStatus;
  }



  /**
   * Update order status in database and emit event with enhanced logging
   */
  async updateOrderStatus(order: Order, newStatus: string, executionData?: {
    executedQuantity?: number;
    averagePrice?: number;
    rejectionReason?: string;
    updateTime?: string;
  }): Promise<void> {
    const startTime = performance.now();
    const operationId = `updateOrderStatus_${order.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced logging context
    const logContext: OrderStatusLogContext = {
      userId: order.user_id?.toString(),
      brokerName: order.broker_name,
      accountId: order.account_id?.toString(),
      operation: 'updateOrderStatus',
      orderId: order.id,
      symbol: order.symbol,
      quantity: order.quantity,
      price: order.price,
      orderType: order.order_type,
      productType: order.product_type
    };
    
    // Add orderNumber only if it exists
    if (order.broker_order_id) {
      logContext.orderNumber = order.broker_order_id;
    }

    try {
      const oldStatus = order.status;
      const now = new Date().toISOString();

      logger.info('Order status update initiated', logContext, {
        operationId,
        previousStatus: oldStatus,
        newStatus,
        executionData: executionData || {}
      });

      // Update in database (order_history collection)
      logger.info('Updating order in database', logContext, {
        operationId,
        statusChange: `${oldStatus} → ${newStatus}`,
        brokerOrderId: order.broker_order_id
      });

      let dbUpdateSuccess = false;
      let dbUpdateDuration = 0;

      try {
        const dbStartTime = performance.now();
        
        // Use the broker_order_id to update the database
        const updated = await userDatabase.updateOrderStatus(
          (order.broker_order_id || order.id).toString(),
          newStatus as 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED'
        );

        dbUpdateDuration = performance.now() - dbStartTime;
        dbUpdateSuccess = !!updated;

        // Log database operation result
        orderStatusLogger.logDatabaseOperation(logContext, 'updateOrderStatus', dbUpdateSuccess, {
          queryTime: Math.round(dbUpdateDuration),
          recordsAffected: updated ? 1 : 0,
          previousStatus: oldStatus,
          newStatus
        });

        if (dbUpdateSuccess) {
          logger.info('Database update successful', logContext, {
            operationId,
            dbDuration: Math.round(dbUpdateDuration),
            recordsUpdated: 1
          });
        } else {
          logger.warn('Database update returned no affected rows', logContext, {
            operationId,
            dbDuration: Math.round(dbUpdateDuration),
            brokerOrderId: order.broker_order_id,
            orderId: order.id
          });
        }
      } catch (dbError: any) {
        dbUpdateDuration = performance.now() - startTime;
        
        logger.error('Database update failed', logContext, {
          operationId,
          errorMessage: dbError.message,
          dbDuration: Math.round(dbUpdateDuration)
        });

        // Log database operation failure
        orderStatusLogger.logDatabaseOperation(logContext, 'updateOrderStatus', false, {
          queryTime: Math.round(dbUpdateDuration),
          error: dbError,
          retryable: true
        });

        // Don't throw here - continue with other operations
      }

      // Update local order object
      order.status = newStatus;
      if (newStatus === 'EXECUTED') {
        order.executed_at = now;
      }
      order.updated_at = now;

      logger.info('Local order object updated', logContext, {
        operationId,
        statusChange: `${oldStatus} → ${newStatus}`,
        executedAt: order.executed_at,
        updatedAt: order.updated_at
      });

      // Broadcast real-time update via WebSocket
      let wsUpdateSuccess = false;
      try {
        const wsStartTime = performance.now();
        
        const orderUpdateData = {
          orderId: order.id,
          brokerOrderId: order.broker_order_id,
          symbol: order.symbol,
          action: order.action,
          quantity: order.quantity,
          price: order.price,
          oldStatus,
          newStatus,
          brokerName: order.broker_name,
          exchange: order.exchange,
          orderType: order.order_type,
          timestamp: now,
          executionData: executionData || {}
        };

        // Emit to user-specific room
        websocketService.sendToUser(order.user_id.toString(), 'orderStatusUpdate', orderUpdateData);
        
        const wsDuration = performance.now() - wsStartTime;
        wsUpdateSuccess = true;

        // Log WebSocket broadcast
        orderStatusLogger.logWebSocketBroadcast(logContext, {
          orderId: order.id,
          status: newStatus,
          recipientCount: 1, // Single user
          type: 'orderStatusUpdate',
          broadcastDuration: Math.round(wsDuration)
        });

        logger.info('WebSocket update sent successfully', logContext, {
          operationId,
          wsDuration: Math.round(wsDuration),
          recipientUserId: order.user_id.toString(),
          eventType: 'orderStatusUpdate'
        });

      } catch (wsError: any) {
        const wsDuration = performance.now() - startTime;
        
        logger.error('WebSocket update failed', logContext, {
          operationId,
          errorMessage: wsError.message,
          wsDuration: Math.round(wsDuration),
          recipientUserId: order.user_id.toString()
        });

        // Don't fail the entire operation if WebSocket fails
      }

      // Send push notification for order status change
      let notificationSuccess = false;
      try {
        const notificationStartTime = performance.now();
        
        // Send order status notification
        await notificationService.sendNotification({
          id: `order_status_${order.id}_${Date.now()}`,
          type: 'alert',
          title: 'Order Status Update',
          message: `Order ${order.id} status changed from ${oldStatus} to ${newStatus}`,
          severity: newStatus === 'REJECTED' ? 'high' : 'medium',
          timestamp: new Date(now),
          data: {
            orderId: order.id,
            symbol: order.symbol,
            action: order.action,
            quantity: order.quantity,
            price: order.price,
            oldStatus,
            newStatus,
            brokerName: order.broker_name
          }
        });
        
        const notificationDuration = performance.now() - notificationStartTime;
        notificationSuccess = true;

        logger.info('Push notification sent successfully', logContext, {
          operationId,
          notificationDuration: Math.round(notificationDuration),
          recipientUserId: order.user_id.toString(),
          notificationType: 'orderStatusUpdate'
        });

      } catch (notificationError: any) {
        const notificationDuration = performance.now() - startTime;
        
        logger.error('Push notification failed', logContext, {
          operationId,
          errorMessage: notificationError.message,
          notificationDuration: Math.round(notificationDuration),
          recipientUserId: order.user_id.toString()
        });

        // Don't fail the entire operation if notification fails
      }

      // Remove from monitoring if order is complete
      const isCompleteStatus = ['EXECUTED', 'CANCELLED', 'REJECTED'].includes(newStatus);
      if (isCompleteStatus) {
        try {
          this.removeOrderFromMonitoring(order);
          
          logger.info('Order removed from monitoring', logContext, {
            operationId,
            reason: 'Order completed',
            finalStatus: newStatus
          });
        } catch (monitoringError: any) {
          logger.warn('Failed to remove order from monitoring', logContext, {
            operationId,
            errorMessage: monitoringError.message
          });
        }
      }

      const totalDuration = performance.now() - startTime;

      // Create comprehensive audit log entry
      orderStatusLogger.createAuditLog({
        userId: order.user_id?.toString() || '',
        accountId: order.account_id?.toString() || '',
        brokerName: order.broker_name,
        operation: 'updateOrderStatus',
        orderId: order.id,
        previousStatus: oldStatus,
        newStatus: newStatus,
        changes: {
          status: { from: oldStatus, to: newStatus },
          executionData: executionData || {},
          updatedAt: now,
          ...(newStatus === 'EXECUTED' && { executedAt: now })
        },
        success: true
      } as any);

      logger.info('Order status update completed successfully', logContext, {
        operationId,
        totalDuration: Math.round(totalDuration),
        statusChange: `${oldStatus} → ${newStatus}`,
        dbUpdateSuccess,
        wsUpdateSuccess,
        notificationSuccess,
        isCompleteStatus
      });

    } catch (error: any) {
      const totalDuration = performance.now() - startTime;
      
      logger.error('Order status update failed with unexpected error', logContext, {
        operationId,
        errorMessage: error.message,
        totalDuration: Math.round(totalDuration),
        stack: error.stack
      });

      // Create audit log entry for failure
      orderStatusLogger.createAuditLog({
        userId: order.user_id?.toString() || '',
        accountId: order.account_id?.toString() || '',
        brokerName: order.broker_name,
        operation: 'updateOrderStatus',
        orderId: order.id,
        success: false,
        errorMessage: error.message
      } as any);

      // Re-throw the error to maintain existing error handling behavior
      throw error;
      logger.error(`Failed to update order ${order.id} status:`, error);
    }
  }

  /**
   * Add a new order to monitoring (manual refresh only)
   */
  async addOrderToMonitoring(order: Order): Promise<void> {
    try {
      // Add to active orders for manual status checking
      this.activeOrders.set(order.id, order);
      logger.info(`📊 Added order ${order.id} to manual monitoring`);

    } catch (error: any) {
      logger.error(`🚨 Failed to add order ${order.id} to monitoring:`, error.message);
    }
  }

  /**
   * Manually refresh order status for all pending orders
   */
  async refreshAllOrderStatus(userId?: string): Promise<{
    success: boolean;
    message: string;
    data: {
      totalOrders: number;
      updatedOrders: number;
      errors: string[];
    };
  }> {
    try {
      logger.info(`🔄 Manual order status refresh requested${userId ? ` for user ${userId}` : ' for all users'}`);

      // Get all pending orders
      let pendingOrders = await this.getPendingOrders();
      
      // Filter by user if specified
      if (userId) {
        pendingOrders = pendingOrders.filter(order => order.user_id.toString() === userId);
      }

      logger.info(`Found ${pendingOrders.length} pending orders to check`);

      const errors: string[] = [];
      let updatedCount = 0;

      // Check status for each order
      for (const order of pendingOrders) {
        try {
          const oldStatus = order.status;
          await this.checkOrderStatus(order);
          
          // Check if status was updated
          if (order.status !== oldStatus) {
            updatedCount++;
          }
        } catch (error: any) {
          const errorMsg = `Failed to check order ${order.id}: ${error.message}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      const result = {
        success: true,
        message: `Order status refresh completed. ${updatedCount} orders updated.`,
        data: {
          totalOrders: pendingOrders.length,
          updatedOrders: updatedCount,
          errors
        }
      };

      logger.info(`✅ Order status refresh completed: ${updatedCount}/${pendingOrders.length} orders updated`);
      return result;

    } catch (error: any) {
      logger.error('🚨 Failed to refresh order status:', error);
      return {
        success: false,
        message: 'Failed to refresh order status',
        data: {
          totalOrders: 0,
          updatedOrders: 0,
          errors: [error.message]
        }
      };
    }
  }

  /**
   * Manually refresh order status for a specific order
   */
  async refreshOrderStatus(orderId: string, userId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      orderId: string;
      oldStatus: string;
      newStatus: string;
      updated: boolean;
    };
  }> {
    try {
      logger.info(`🔄 Manual order status refresh requested for order ${orderId}`);

      // Find the order in database
      const orderHistory = await userDatabase.getOrderHistoryById(orderId);
      if (!orderHistory) {
        return {
          success: false,
          message: 'Order not found'
        };
      }

      // Verify user owns the order
      if (orderHistory.user_id.toString() !== userId) {
        return {
          success: false,
          message: 'Access denied'
        };
      }

      // Convert to Order format
      const order: Order = {
        id: orderHistory.id.toString(),
        user_id: orderHistory.user_id,
        account_id: orderHistory.account_id,
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
        remarks: orderHistory.remarks,
        created_at: orderHistory.created_at,
        updated_at: orderHistory.created_at,
        executed_at: orderHistory.executed_at
      };

      const oldStatus = order.status;
      await this.checkOrderStatus(order);
      const updated = order.status !== oldStatus;

      return {
        success: true,
        message: updated ? 'Order status updated' : 'Order status unchanged',
        data: {
          orderId: order.id,
          oldStatus,
          newStatus: order.status,
          updated
        }
      };

    } catch (error: any) {
      logger.error(`🚨 Failed to refresh order ${orderId} status:`, error);
      return {
        success: false,
        message: 'Failed to refresh order status'
      };
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
