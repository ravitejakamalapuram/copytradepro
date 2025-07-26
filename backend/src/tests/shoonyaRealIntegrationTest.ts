/**
 * Real Integration Test for Shoonya Order Status
 * This test uses actual MongoDB data and Shoonya credentials to test the complete flow
 */

import { userDatabase } from '../services/databaseCompatibility';
import orderStatusService from '../services/orderStatusService';
import { enhancedUnifiedBrokerManager } from '../services/enhancedUnifiedBrokerManager';

async function testShoonyaOrderStatusIntegration() {
  console.log('🧪 Starting Shoonya Order Status Real Integration Test...');
  
  try {
    // Step 1: Get real orders from MongoDB
    console.log('📊 Step 1: Fetching real orders from MongoDB...');
    const allOrders = await userDatabase.getAllOrderHistory(50); // Get last 50 orders
    
    console.log(`Found ${allOrders.length} orders in database`);
    
    // Filter for Shoonya orders that are not in final states
    const shoonyaOrders = allOrders.filter(order => 
      order.broker_name === 'shoonya' && 
      ['PLACED', 'PENDING'].includes(order.status)
    );
    
    console.log(`Found ${shoonyaOrders.length} Shoonya orders in PLACED/PENDING state`);
    
    if (shoonyaOrders.length === 0) {
      console.log('⚠️ No Shoonya orders in PLACED/PENDING state found. Looking for any Shoonya orders...');
      
      const anyShoonyaOrders = allOrders.filter(order => order.broker_name === 'shoonya');
      console.log(`Found ${anyShoonyaOrders.length} total Shoonya orders`);
      
      if (anyShoonyaOrders.length > 0) {
        console.log('📋 Sample Shoonya orders:');
        anyShoonyaOrders.slice(0, 3).forEach(order => {
          console.log(`  - Order ${order.id}: ${order.symbol} (${order.status}) - User: ${order.user_id}`);
        });
      }
      
      return;
    }
    
    // Step 2: Check broker connections for users with Shoonya orders
    console.log('\n📊 Step 2: Checking broker connections...');
    const userIds = [...new Set(shoonyaOrders.map(order => order.user_id.toString()))];
    
    for (const userId of userIds) {
      console.log(`\n👤 Checking connections for user ${userId}:`);
      const connections = enhancedUnifiedBrokerManager.getUserConnections(userId)
        .filter(conn => conn.brokerName === 'shoonya');
      console.log(`  - Found ${connections.length} Shoonya connections`);
      
      connections.forEach((conn, index) => {
        console.log(`  - Connection ${index + 1}: Account ${conn.accountId}, Active: ${conn.isActive}`);
      });
    }
    
    // Step 3: Test order status refresh for a specific order
    console.log('\n📊 Step 3: Testing order status refresh...');
    const testOrder = shoonyaOrders[0];
    if (!testOrder) {
      console.log('❌ No test order available');
      return;
    }
    
    console.log(`Testing with order: ${testOrder.id} (${testOrder.symbol}) - User: ${testOrder.user_id}`);
    console.log(`Current status: ${testOrder.status}`);
    console.log(`Broker order ID: ${testOrder.broker_order_id}`);
    
    // Test the actual order status refresh
    const refreshResult = await orderStatusService.refreshOrderStatus(
      testOrder.id.toString(), 
      testOrder.user_id.toString()
    );
    
    console.log('\n📊 Order Status Refresh Result:');
    console.log(`Success: ${refreshResult.success}`);
    console.log(`Message: ${refreshResult.message}`);
    if (refreshResult.data) {
      console.log('Data:', refreshResult.data);
    }
    
    // Step 4: Check if the order status was actually updated in the database
    console.log('\n📊 Step 4: Checking database for updates...');
    const updatedOrder = await userDatabase.getOrderHistoryById(testOrder.id.toString());
    
    if (updatedOrder) {
      console.log(`Original status: ${testOrder.status}`);
      console.log(`Updated status: ${updatedOrder.status}`);
      
      if (testOrder.status !== updatedOrder.status) {
        console.log('✅ Order status was updated in database!');
      } else {
        console.log('⚠️ Order status was not changed (might be same as broker status)');
      }
    }
    
    // Step 5: Test with multiple orders
    console.log('\n📊 Step 5: Testing refresh all orders for user...');
    const refreshAllResult = await orderStatusService.refreshAllOrderStatus(testOrder.user_id.toString());
    
    console.log('Refresh All Orders Result:');
    console.log(`Success: ${refreshAllResult.success}`);
    console.log(`Message: ${refreshAllResult.message}`);
    if (refreshAllResult.data) {
      console.log('Data:', refreshAllResult.data);
    }
    
  } catch (error: any) {
    console.error('🚨 Integration test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Export for manual testing
export { testShoonyaOrderStatusIntegration };

// Run if called directly
if (require.main === module) {
  testShoonyaOrderStatusIntegration()
    .then(() => {
      console.log('🎉 Integration test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Integration test failed:', error);
      process.exit(1);
    });
}