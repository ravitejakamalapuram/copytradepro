/**
 * Detailed Order Status Debug Tool
 * Logs every step of the order status checking process including all API payloads and responses
 */

import { userDatabase } from '../services/databaseCompatibility';
import { UnifiedBrokerFactory } from '@copytrade/unified-broker';
import orderStatusService from '../services/orderStatusService';

interface DetailedLog {
  timestamp: string;
  step: string;
  data: any;
  success?: boolean | undefined;
  error?: string | undefined;
}

class OrderStatusDebugger {
  private logs: DetailedLog[] = [];

  private log(step: string, data: any, success?: boolean, error?: string) {
    const logEntry: DetailedLog = {
      timestamp: new Date().toISOString(),
      step,
      data,
      success,
      error
    };
    
    this.logs.push(logEntry);
    
    console.log(`\n🔍 [${logEntry.timestamp}] ${step}`);
    console.log('📊 Data:', JSON.stringify(data, null, 2));
    if (success !== undefined) {
      console.log(`✅ Success: ${success}`);
    }
    if (error) {
      console.log(`❌ Error: ${error}`);
    }
    console.log('─'.repeat(80));
  }

  async debugOrderStatus(orderId: string, userId?: string) {
    console.log('🚀 Starting Detailed Order Status Debug');
    console.log('═'.repeat(80));
    
    try {
      // Step 1: Get order from database
      this.log('1. Database Query - Get Order by ID', { orderId });
      
      const order = await userDatabase.getOrderHistoryById(orderId);
      
      if (!order) {
        this.log('1. Database Query Result', { found: false }, false, 'Order not found in database');
        return this.generateReport();
      }
      
      this.log('1. Database Query Result', {
        found: true,
        order: {
          id: order.id,
          user_id: order.user_id,
          broker_name: order.broker_name,
          broker_order_id: order.broker_order_id,
          status: order.status,
          symbol: order.symbol,
          quantity: order.quantity,
          price: order.price,
          account_id: order.account_id,
          order_type: order.order_type,
          exchange: order.exchange,
          product_type: order.product_type,
          created_at: order.created_at
        }
      }, true);

      // Step 2: Verify user access (if userId provided)
      if (userId && order.user_id.toString() !== userId.toString()) {
        this.log('2. User Access Check', { 
          requestingUserId: userId, 
          orderUserId: order.user_id.toString() 
        }, false, 'Access denied - order belongs to different user');
        return this.generateReport();
      }
      
      this.log('2. User Access Check', { 
        requestingUserId: userId || 'not provided', 
        orderUserId: order.user_id.toString(),
        accessGranted: true
      }, true);

      // Step 3: Check broker connections
      this.log('3. Broker Connection Check', {
        userId: order.user_id.toString(),
        brokerName: order.broker_name
      });

      const service = UnifiedBrokerFactory.getInstance().createBroker(order.broker_name);
      const connections = [{ accountId: order.account_id?.toString() || 'unknown', isActive: true, service, lastActivity: new Date().toISOString() }];

      this.log('3. Broker Connection Result', {
        connectionsFound: connections.length,
        connections: connections.map((conn: any) => ({
          accountId: conn.accountId,
          isActive: conn.isActive,
          connectedAt: conn.connectedAt,
          lastActivity: conn.lastActivity,
          brokerName: conn.brokerName
        }))
      }, connections.length > 0);

      if (connections.length === 0) {
        this.log('3. Broker Connection Error', {}, false, `No ${order.broker_name} connections found for user ${order.user_id}`);
        return this.generateReport();
      }

      // Step 4: Get active connection
      const activeConnection = connections.find(conn => conn.isActive) || connections[0];
      
      if (!activeConnection) {
        this.log('4. Active Connection Selection', {}, false, 'No active connection available');
        return this.generateReport();
      }
      
      this.log('4. Active Connection Selection', {
        selectedConnection: {
          accountId: activeConnection.accountId,
          isActive: activeConnection.isActive,
          isConnected: true,
          brokerName: order.broker_name
        }
      }, true);

      // Step 5: Check service connection status (assume connected in stateless mode)
      const isServiceConnected = true;

      this.log('5. Service Connection Status', {
        isConnected: isServiceConnected,
        brokerName: order.broker_name,
        accountId: activeConnection.accountId
      }, isServiceConnected);

      if (!isServiceConnected) {
        this.log('5. Service Connection Error', {}, false, 'Broker service is not connected');
        return this.generateReport();
      }

      // Step 6: Prepare API call parameters
      const apiParams = {
        accountId: activeConnection.accountId,
        orderId: order.broker_order_id,
        brokerName: order.broker_name
      };

      this.log('6. API Call Preparation', {
        apiParams,
        orderDetails: {
          databaseOrderId: order.id,
          brokerOrderId: order.broker_order_id,
          currentStatus: order.status,
          symbol: order.symbol
        }
      }, true);

      // Step 7: Make direct API call to broker service
      this.log('7. Direct Broker API Call - START', {
        method: 'getOrderStatus',
        parameters: apiParams
      });

      let apiResponse;
      let apiError;
      
      try {
        const startTime = Date.now();
        apiResponse = await activeConnection.service.getOrderStatus(
          activeConnection.accountId, 
          order.broker_order_id
        );
        const endTime = Date.now();
        
        this.log('7. Direct Broker API Call - SUCCESS', {
          responseTime: `${endTime - startTime}ms`,
          rawResponse: apiResponse,
          responseType: typeof apiResponse,
          responseKeys: apiResponse && typeof apiResponse === 'object' ? Object.keys(apiResponse) : 'N/A'
        }, true);

      } catch (error: any) {
        apiError = error;
        this.log('7. Direct Broker API Call - ERROR', {
          errorMessage: error.message,
          errorType: error.constructor.name,
          errorStack: error.stack,
          errorDetails: error
        }, false, error.message);
      }

      // Step 8: Process API response (if successful)
      if (apiResponse && !apiError) {
        this.log('8. API Response Processing', {
          responseAnalysis: {
            hasSuccessField: 'success' in apiResponse,
            successValue: apiResponse.success,
            hasDataField: 'data' in apiResponse,
            dataType: typeof apiResponse.data,
            dataKeys: apiResponse.data && typeof apiResponse.data === 'object' ? Object.keys(apiResponse.data) : 'N/A',
            fullResponse: apiResponse
          }
        });

        // Check if response indicates success
        if (apiResponse.success && apiResponse.data) {
          this.log('8. Response Status Extraction', {
            extractedData: {
              status: apiResponse.data.status,
              orderId: apiResponse.data.orderId,
              symbol: apiResponse.data.symbol,
              quantity: apiResponse.data.quantity,
              price: apiResponse.data.price,
              averagePrice: apiResponse.data.averagePrice,
              filledQuantity: apiResponse.data.filledQuantity
            },
            statusMapping: {
              originalStatus: order.status,
              newStatus: apiResponse.data.status,
              statusChanged: order.status !== apiResponse.data.status
            }
          }, true);
        } else {
          this.log('8. Response Status Extraction', {
            issue: 'Response does not indicate success or missing data field',
            responseStructure: apiResponse
          }, false);
        }
      }

      // Step 9: Use OrderStatusService to process the order
      this.log('9. OrderStatusService Processing - START', {
        orderForProcessing: {
          id: order.id.toString(),
          user_id: order.user_id.toString(),
          broker_name: order.broker_name,
          broker_order_id: order.broker_order_id,
          status: order.status
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

      try {
        await orderStatusService.checkOrderStatus(orderForMonitoring);
        this.log('9. OrderStatusService Processing - SUCCESS', {
          message: 'Order status check completed successfully'
        }, true);
      } catch (serviceError: any) {
        this.log('9. OrderStatusService Processing - ERROR', {
          errorMessage: serviceError.message,
          errorType: serviceError.constructor.name,
          errorStack: serviceError.stack
        }, false, serviceError.message);
      }

      // Step 10: Check final database state
      this.log('10. Final Database State Check', {});
      
      const updatedOrder = await userDatabase.getOrderHistoryById(orderId);
      
      if (updatedOrder) {
        this.log('10. Final Database State Result', {
          originalOrder: {
            status: order.status,
            updated_at: order.created_at
          },
          updatedOrder: {
            status: updatedOrder.status,
            updated_at: updatedOrder.created_at,
            executed_at: updatedOrder.executed_at
          },
          changes: {
            statusChanged: order.status !== updatedOrder.status,
            statusChange: `${order.status} → ${updatedOrder.status}`
          }
        }, true);
      } else {
        this.log('10. Final Database State Result', {}, false, 'Could not retrieve updated order from database');
      }

    } catch (error: any) {
      this.log('FATAL ERROR', {
        errorMessage: error.message,
        errorType: error.constructor.name,
        errorStack: error.stack
      }, false, error.message);
    }

    return this.generateReport();
  }

  private generateReport() {
    console.log('\n📋 DETAILED DEBUG REPORT');
    console.log('═'.repeat(80));
    
    const summary = {
      totalSteps: this.logs.length,
      successfulSteps: this.logs.filter(log => log.success === true).length,
      failedSteps: this.logs.filter(log => log.success === false).length,
      errors: this.logs.filter(log => log.error).map(log => ({
        step: log.step,
        error: log.error
      }))
    };

    console.log('📊 Summary:', JSON.stringify(summary, null, 2));
    
    console.log('\n📝 Full Log Sequence:');
    this.logs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.step} - ${log.success === true ? '✅' : log.success === false ? '❌' : '⏳'}`);
      if (log.error) {
        console.log(`   Error: ${log.error}`);
      }
    });

    console.log('\n💾 Complete Debug Data:');
    console.log(JSON.stringify(this.logs, null, 2));

    return {
      summary,
      logs: this.logs
    };
  }
}

// Main debug function
async function debugOrderStatusDetailed() {
  const orderDebugger = new OrderStatusDebugger();
  
  // You can modify these values for testing
  const orderId = '687c768ca3e19fb607b69c15'; // From your curl request
  const userId = '6861fffc6ca252479ba48892'; // From your JWT token
  
  console.log(`🎯 Debugging Order Status for Order ID: ${orderId}`);
  console.log(`👤 User ID: ${userId}`);
  
  await orderDebugger.debugOrderStatus(orderId, userId);
}

// Export for use in other files
export { OrderStatusDebugger, debugOrderStatusDetailed };

// Run if called directly
if (require.main === module) {
  debugOrderStatusDetailed().catch(console.error);
}