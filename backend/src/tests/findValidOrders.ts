/**
 * Find valid orders in the database for testing
 */

import { userDatabase } from '../services/databaseCompatibility';

async function findValidOrders() {
  console.log('🔍 Finding Valid Orders in Database');
  console.log('═'.repeat(50));
  
  try {
    // Get all order history
    console.log('📊 Fetching all orders...');
    const allOrders = await userDatabase.getAllOrderHistory();
    
    console.log(`📋 Found ${allOrders.length} total orders`);
    
    if (allOrders.length === 0) {
      console.log('❌ No orders found in database');
      return;
    }
    
    // Show first 10 orders
    console.log('\n📝 First 10 Orders:');
    console.log('─'.repeat(50));
    
    allOrders.slice(0, 10).forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order.id}`);
      console.log(`   User ID: ${order.user_id}`);
      console.log(`   Broker: ${order.broker_name}`);
      console.log(`   Broker Order ID: ${order.broker_order_id}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Symbol: ${order.symbol}`);
      console.log(`   Created: ${order.created_at}`);
      console.log('   ─'.repeat(30));
    });
    
    // Find orders for the specific user
    const userId = '6861fffc6ca252479ba48892';
    console.log(`\n👤 Orders for User ${userId}:`);
    console.log('─'.repeat(50));
    
    const userOrders = allOrders.filter(order => 
      order.user_id.toString() === userId
    );
    
    console.log(`📊 Found ${userOrders.length} orders for this user`);
    
    if (userOrders.length > 0) {
      userOrders.forEach((order, index) => {
        console.log(`${index + 1}. ✅ Valid Order ID: ${order.id}`);
        console.log(`   Broker: ${order.broker_name}`);
        console.log(`   Broker Order ID: ${order.broker_order_id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Symbol: ${order.symbol}`);
        console.log('   ─'.repeat(30));
      });
      
      // Show curl command for first valid order
      const firstOrder = userOrders[0]!; // We know it exists since length > 0
      console.log('\n🎯 Test with this valid order:');
      console.log('─'.repeat(50));
      console.log(`Order ID: ${firstOrder.id}`);
      console.log(`User ID: ${firstOrder.user_id}`);
      console.log(`Broker: ${firstOrder.broker_name}`);
      console.log(`Status: ${firstOrder.status}`);
      
      console.log('\n📋 Debug Command:');
      console.log(`npx ts-node src/tests/debugSpecificOrder.ts ${firstOrder.id} ${firstOrder.user_id}`);
      
      console.log('\n🌐 Curl Command:');
      console.log(`curl 'http://localhost:3001/api/broker/debug-order-status' \\`);
      console.log(`  -H 'Authorization: Bearer YOUR_TOKEN' \\`);
      console.log(`  -H 'Content-Type: application/json' \\`);
      console.log(`  --data-raw '{"orderId":"${firstOrder.id}"}'`);
      
    } else {
      console.log('❌ No orders found for this user');
    }
    
    // Find Shoonya orders specifically
    console.log(`\n🏢 Shoonya Orders:`);
    console.log('─'.repeat(50));
    
    const shoonyaOrders = allOrders.filter(order => 
      order.broker_name.toLowerCase() === 'shoonya'
    );
    
    console.log(`📊 Found ${shoonyaOrders.length} Shoonya orders`);
    
    if (shoonyaOrders.length > 0) {
      shoonyaOrders.slice(0, 5).forEach((order, index) => {
        console.log(`${index + 1}. Order ID: ${order.id}`);
        console.log(`   User ID: ${order.user_id}`);
        console.log(`   Broker Order ID: ${order.broker_order_id}`);
        console.log(`   Status: ${order.status}`);
        console.log(`   Symbol: ${order.symbol}`);
        console.log('   ─'.repeat(30));
      });
    }
    
  } catch (error: any) {
    console.error('❌ Error finding orders:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  findValidOrders().catch(console.error);
}

export { findValidOrders };