/**
 * Debug script to check what's actually in the database
 */

import { userDatabase } from '../services/databaseCompatibility';

async function debugDatabase() {
  console.log('🔍 Debugging Database Contents...');
  
  try {
    // Check users
    console.log('\n👥 Checking users...');
    const userCount = await userDatabase.getUserCount();
    console.log(`Total users: ${userCount}`);
    
    // Check connected accounts - we'll need to get them by user
    console.log('\n🔗 Checking connected accounts...');
    // For now, let's skip this and focus on orders first
    
    // Check orders
    console.log('\n📋 Checking all orders...');
    const allOrders = await userDatabase.getAllOrderHistory(100);
    console.log(`Total orders: ${allOrders.length}`);
    
    if (allOrders.length > 0) {
      console.log('\nSample orders:');
      allOrders.slice(0, 5).forEach((order, index) => {
        console.log(`Order ${index + 1}:`);
        console.log(`  - ID: ${order.id}`);
        console.log(`  - User ID: ${order.user_id}`);
        console.log(`  - Broker: ${order.broker_name}`);
        console.log(`  - Symbol: ${order.symbol}`);
        console.log(`  - Status: ${order.status}`);
        console.log(`  - Broker Order ID: ${order.broker_order_id}`);
        console.log(`  - Created: ${order.created_at}`);
      });
      
      // Check specifically for Shoonya orders
      const shoonyaOrders = allOrders.filter(order => order.broker_name === 'shoonya');
      console.log(`\n🎯 Shoonya orders: ${shoonyaOrders.length}`);
      
      shoonyaOrders.forEach((order, index) => {
        console.log(`Shoonya Order ${index + 1}:`);
        console.log(`  - ID: ${order.id}`);
        console.log(`  - User ID: ${order.user_id}`);
        console.log(`  - Symbol: ${order.symbol}`);
        console.log(`  - Status: ${order.status}`);
        console.log(`  - Broker Order ID: ${order.broker_order_id}`);
        console.log(`  - Account ID: ${order.account_id}`);
      });
    }
    
    // No in-memory connection manager in stateless mode
    console.log('\nℹ️ Stateless mode: no unified broker manager connections to display');
    
  } catch (error: any) {
    console.error('🚨 Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Export for manual testing
export { debugDatabase };

// Run if called directly
if (require.main === module) {
  debugDatabase()
    .then(() => {
      console.log('\n🎉 Debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Debug failed:', error);
      process.exit(1);
    });
}