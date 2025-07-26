/**
 * Debug Order Status Controller
 * Enhanced version with detailed logging for debugging Shoonya API issues
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { userDatabase } from '../services/databaseCompatibility';
import { enhancedUnifiedBrokerManager } from '../services/enhancedUnifiedBrokerManager';
import orderStatusService from '../services/orderStatusService';

interface DebugLogEntry {
  timestamp: string;
  step: string;
  data: any;
  success?: boolean | undefined;
  error?: string | undefined;
}

export const debugCheckOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const debugLogs: DebugLogEntry[] = [];
  const startTime = Date.now();
  
  const log = (step: string, data: any, success?: boolean, error?: string) => {
    const entry: DebugLogEntry = {
      timestamp: new Date().toISOString(),
      step,
      data,
      success,
      error
    };
    debugLogs.push(entry);
    console.log(`🔍 [DEBUG] ${step}:`, JSON.stringify(data, null, 2));
    if (error) console.log(`❌ [ERROR] ${error}`);
  };

  try {
    const userId = req.user?.id;
    log('1. Authentication Check', { userId: userId || 'not provided' });

    if (!userId) {
      log('1. Authentication Failed', {}, false, 'User not authenticated');
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
        debug: { logs: debugLogs }
      });
      return;
    }

    const { orderId } = req.body;
    log('2. Request Body Parsing', { orderId, bodyKeys: Object.keys(req.body) });

    if (!orderId) {
      log('2. Validation Failed', {}, false, 'Order ID is required');
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
        debug: { logs: debugLogs }
      });
      return;
    }

    // Step 3: Database lookup
    log('3. Database Query', { orderId, query: 'getOrderHistoryById' });
    
    const order = await userDatabase.getOrderHistoryById(orderId);
    
    if (!order) {
      log('3. Database Query Failed', {}, false, 'Order not found in database');
      res.status(404).json({
        success: false,
        message: 'Order not found',
        debug: { logs: debugLogs }
      });
      return;
    }

    log('3. Database Query Success', {
      order: {
        id: order.id,
        user_id: order.user_id,
        broker_name: order.broker_name,
        broker_order_id: order.broker_order_id,
        status: order.status,
        symbol: order.symbol,
        account_id: order.account_id
      }
    }, true);

    // Step 4: User authorization
    log('4. User Authorization Check', { 
      requestingUser: userId, 
      orderOwner: order.user_id.toString() 
    });

    if (order.user_id.toString() !== userId.toString()) {
      log('4. Authorization Failed', {}, false, 'Access denied - order belongs to different user');
      res.status(403).json({
        success: false,
        message: 'Access denied - order belongs to different user',
        debug: { logs: debugLogs }
      });
      return;
    }

    log('4. Authorization Success', {}, true);

    // Step 5: Broker connection check
    log('5. Broker Connection Lookup', {
      userId: order.user_id.toString(),
      brokerName: order.broker_name
    });

    const connections = enhancedUnifiedBrokerManager.getUserConnections(order.user_id.toString())
      .filter(conn => conn.brokerName === order.broker_name);

    log('5. Broker Connection Result', {
      connectionsFound: connections.length,
      connections: connections.map(conn => ({
        accountId: conn.accountId,
        isActive: conn.isActive,
        isConnected: conn.service.isConnected(),
        lastActivity: conn.lastActivity
      }))
    }, connections.length > 0);

    if (connections.length === 0) {
      log('5. No Broker Connections', {}, false, `No ${order.broker_name} connections found`);
      res.status(404).json({
        success: false,
        message: `Not connected to ${order.broker_name}. Please reconnect your broker account.`,
        debug: { logs: debugLogs }
      });
      return;
    }

    // Step 6: Select active connection
    const activeConnection = connections.find(conn => conn.isActive) || connections[0];
    
    if (!activeConnection) {
      log('6. No Active Connection', {}, false, 'No active connection available');
      res.status(500).json({
        success: false,
        message: 'No active broker connection available',
        debug: { logs: debugLogs }
      });
      return;
    }
    
    log('6. Active Connection Selected', {
      selectedConnection: {
        accountId: activeConnection.accountId,
        isActive: activeConnection.isActive,
        isConnected: activeConnection.service.isConnected()
      }
    }, true);

    // Step 7: Direct API call to broker
    log('7. Direct Broker API Call', {
      method: 'getOrderStatus',
      accountId: activeConnection.accountId,
      brokerOrderId: order.broker_order_id,
      brokerName: order.broker_name
    });

    let directApiResponse;
    let directApiError;

    try {
      const apiStartTime = Date.now();
      directApiResponse = await activeConnection.service.getOrderStatus(
        activeConnection.accountId,
        order.broker_order_id
      );
      const apiEndTime = Date.now();

      log('7. Direct API Call Success', {
        responseTime: `${apiEndTime - apiStartTime}ms`,
        response: directApiResponse,
        responseType: typeof directApiResponse,
        hasSuccess: directApiResponse && 'success' in directApiResponse,
        hasData: directApiResponse && 'data' in directApiResponse
      }, true);

    } catch (error: any) {
      directApiError = error;
      log('7. Direct API Call Failed', {
        errorMessage: error.message,
        errorType: error.constructor.name,
        errorCode: error.code,
        errorDetails: {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack
        }
      }, false, error.message);
    }

    // Step 8: Process through OrderStatusService
    log('8. OrderStatusService Processing', {
      orderForProcessing: {
        id: order.id.toString(),
        broker_order_id: order.broker_order_id,
        current_status: order.status
      }
    });

    const orderForMonitoring = {
      id: order.id.toString(),
      user_id: order.user_id.toString(),
      account_id: order.account_id?.toString() || '',
      symbol: order.symbol,
      action: order.action,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      broker_name: order.broker_name,
      broker_order_id: order.broker_order_id,
      order_type: order.order_type,
      exchange: order.exchange,
      product_type: order.product_type,
      remarks: order.remarks || '',
      created_at: order.created_at,
      updated_at: order.created_at,
      executed_at: order.executed_at
    };

    let serviceProcessingError;
    try {
      await orderStatusService.checkOrderStatus(orderForMonitoring);
      log('8. OrderStatusService Success', {}, true);
    } catch (error: any) {
      serviceProcessingError = error;
      log('8. OrderStatusService Failed', {
        errorMessage: error.message,
        errorType: error.constructor.name
      }, false, error.message);
    }

    // Step 9: Final database state
    log('9. Final Database Check', {});
    
    const updatedOrder = await userDatabase.getOrderHistoryById(orderId);
    
    if (updatedOrder) {
      const statusChanged = updatedOrder.status !== order.status;
      
      log('9. Final Database Result', {
        originalStatus: order.status,
        updatedStatus: updatedOrder.status,
        statusChanged,
        updatedAt: updatedOrder.created_at
      }, true);

      // Step 10: Prepare response
      const totalTime = Date.now() - startTime;
      
      log('10. Response Preparation', {
        totalProcessingTime: `${totalTime}ms`,
        statusChanged,
        finalStatus: updatedOrder.status
      }, true);

      res.status(200).json({
        success: true,
        message: statusChanged
          ? `Order status updated from ${order.status} to ${updatedOrder.status}`
          : `Order status confirmed as ${updatedOrder.status}`,
        data: {
          orderId: updatedOrder.id,
          previousStatus: order.status,
          currentStatus: updatedOrder.status,
          statusChanged,
          order: {
            id: updatedOrder.id,
            symbol: updatedOrder.symbol,
            action: updatedOrder.action,
            quantity: updatedOrder.quantity,
            price: updatedOrder.price,
            order_type: updatedOrder.order_type,
            status: updatedOrder.status,
            exchange: updatedOrder.exchange,
            broker_name: updatedOrder.broker_name,
            broker_order_id: updatedOrder.broker_order_id,
            executed_at: updatedOrder.executed_at,
            created_at: updatedOrder.created_at,
          },
          timestamp: new Date().toISOString(),
          processingTime: `${totalTime}ms`
        },
        debug: {
          logs: debugLogs,
          summary: {
            totalSteps: debugLogs.length,
            successfulSteps: debugLogs.filter(log => log.success === true).length,
            failedSteps: debugLogs.filter(log => log.success === false).length,
            directApiResponse: directApiResponse,
            directApiError: directApiError?.message,
            serviceProcessingError: serviceProcessingError?.message
          }
        }
      });

    } else {
      log('9. Final Database Failed', {}, false, 'Could not retrieve updated order');
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve updated order status',
        debug: { logs: debugLogs }
      });
    }

  } catch (error: any) {
    log('FATAL ERROR', {
      errorMessage: error.message,
      errorType: error.constructor.name,
      errorStack: error.stack?.split('\n').slice(0, 10)
    }, false, error.message);

    res.status(500).json({
      success: false,
      message: 'Failed to check order status',
      error: error.message,
      debug: { logs: debugLogs }
    });
  }
};