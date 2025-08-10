/**
 * Test the real order status update with actual MongoDB data
 */

import { userDatabase } from '../services/databaseCompatibility';
import orderStatusService from '../services/orderStatusService';
import { UnifiedBrokerFactory } from '@copytrade/unified-broker';

async function testRealOrderStatusUpdate() {
  console.log('🧪 Testing Real Order Status Update...');
  
  try {
    // Step 1: Get real orders using the database compatibility layer
    console.log('\n📊 Step 1: Getting orders via database compatibility layer...');
    
    const allOrders = await userDatabase.getAllOrderHistory(10);
    console.log(`Found ${allOrders.length} orders via compatibility layer`);
    
    if (allOrders.length === 0) {
      console.log('❌ No orders found via compatibility layer');
      console.log('This suggests there might be a database connection or collection name issue');
      return;
    }
    
    // Show sample orders
    allOrders.forEach((order, index) => {
      console.log(`Order ${index + 1}:`);
      console.log(`  ID: ${order.id}`);
      console.log(`  User ID: ${order.user_id}`);
      console.log(`  Broker: ${order.broker_name}`);
      console.log(`  Symbol: ${order.symbol}`);
      console.log(`  Status: ${order.status}`);
      console.log(`  Broker Order ID: ${order.broker_order_id}`);
    });
    
    // Filter for Shoonya orders
    const shoonyaOrders = allOrders.filter(order => order.broker_name === 'shoonya');
    console.log(`\n🎯 Found ${shoonyaOrders.length} Shoonya orders`);
    
    if (shoonyaOrders.length === 0) {
      console.log('❌ No Shoonya orders found');
      return;
    }
    
    // Step 2: Test with the first Shoonya order
    const testOrder = shoonyaOrders[0];
    if (!testOrder) {
      console.log('❌ No test order available');
      return;
    }
    
    console.log(`\n📊 Step 2: Testing with order ${testOrder.id}:`);
    console.log(`  Symbol: ${testOrder.symbol}`);
    console.log(`  Current Status: ${testOrder.status}`);
    console.log(`  Broker Order ID: ${testOrder.broker_order_id}`);
    console.log(`  User ID: ${testOrder.user_id}`);
    
    // Step 3: Check broker connections
    console.log(`\n🔗 Step 3: Checking broker connections for user ${testOrder.user_id}...`);
    
    console.log('Stateless mode: connections are created on demand via UnifiedBrokerFactory');
    
    // Step 4: Test the actual order status refresh
    console.log(`\n🔄 Step 4: Testing order status refresh...`);
    
    const refreshResult = await orderStatusService.refreshOrderStatus(
      testOrder.id.toString(),
      testOrder.user_id.toString()
    );
    
    console.log('\n📊 Refresh Result:');
    console.log(`  Success: ${refreshResult.success}`);
    console.log(`  Message: ${refreshResult.message}`);
    
    if (refreshResult.data) {
      console.log('  Data:', JSON.stringify(refreshResult.data, null, 2));
    }
    
    // Step 5: Check if the order was actually updated in the database
    console.log(`\n🔍 Step 5: Checking for database updates...`);
    
    const updatedOrder = await userDatabase.getOrderHistoryById(testOrder.id.toString());
    
    if (updatedOrder) {
      console.log(`Original Status: ${testOrder.status}`);
      console.log(`Updated Status: ${updatedOrder.status}`);
      
      if (testOrder.status !== updatedOrder.status) {
        console.log('✅ Order status was updated in database!');
      } else {
        console.log('⚠️ Order status was not changed');
        console.log('This could mean:');
        console.log('  - The broker status is the same as database status');
        console.log('  - There was an error connecting to the broker');
        console.log('  - The broker API returned an error');
      }
    } else {
      console.log('❌ Could not retrieve updated order from database');
    }
    
    // Step 6: Test with a specific Shoonya order ID that we know exists
    console.log(`\n🎯 Step 6: Testing with known Shoonya order ID...`);
    
    // From the data we saw: Broker Order ID: 25071900001627
    const knownOrderId = '25071900001627';
    console.log(`Testing direct Shoonya API call for order: ${knownOrderId}`);
    
    // Stateless mode: create service on demand and call API directly
    const factory = UnifiedBrokerFactory.getInstance();
    const shoonyaService = factory.createBroker('shoonya');
    const accountId = testOrder.account_id?.toString();

    if (!accountId) {
      console.log('❌ Missing account ID on order');
      return;
    }

    console.log(`Using account: ${accountId}`);

    try {
        console.log('🔄 Making direct Shoonya API call...');
        const directResult = await shoonyaService.getOrderStatus(accountId, knownOrderId);
        
        console.log('📊 Direct Shoonya API Result:');
        console.log(JSON.stringify(directResult, null, 2));
        
      } catch (error: any) {
        console.error('❌ Direct Shoonya API call failed:', error.message);
        console.error('This might indicate:');
        console.error('  - Authentication issues');
        console.error('  - Invalid order ID');
        console.error('  - Network connectivity issues');
        console.error('  - Shoonya API issues');
      }

    
  } catch (error: any) {
    console.error('🚨 Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Export for manual testing
export { testRealOrderStatusUpdate };

// Run if called directly
if (require.main === module) {
  testRealOrderStatusUpdate()
    .then(() => {
      console.log('\n🎉 Real order status update test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}