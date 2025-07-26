/**
 * Check the actual order data in MongoDB
 */

import mongoose from 'mongoose';

async function checkOrderData() {
  console.log('🔍 Checking Order Data in MongoDB...');
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://ravitejakamalapuram01:nHxzjl4H7U11TK9D@ravipersonal.fypwvrt.mongodb.net/?retryWrites=true&w=majority&appName=raviPersonal';
    
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected to MongoDB');
    console.log(`📊 Database: ${mongoose.connection.db?.databaseName}`);
    
    // Check the orderhistories collection
    console.log('\n📋 Checking orderhistories collection...');
    
    const orders = await mongoose.connection.db?.collection('orderhistories').find({}).toArray();
    console.log(`Found ${orders?.length || 0} orders`);
    
    if (orders && orders.length > 0) {
      orders.forEach((order, index) => {
        console.log(`\n📊 Order ${index + 1}:`);
        console.log(`  ID: ${order._id}`);
        console.log(`  User ID: ${order.user_id}`);
        console.log(`  Broker: ${order.broker_name}`);
        console.log(`  Broker Order ID: ${order.broker_order_id}`);
        console.log(`  Symbol: ${order.symbol}`);
        console.log(`  Status: ${order.status}`);
        console.log(`  Action: ${order.action}`);
        console.log(`  Quantity: ${order.quantity}`);
        console.log(`  Price: ${order.price}`);
        console.log(`  Account ID: ${order.account_id}`);
        console.log(`  Created: ${order.created_at}`);
        console.log(`  Updated: ${order.updated_at}`);
      });
      
      // Check for Shoonya orders specifically
      const shoonyaOrders = orders.filter(order => order.broker_name === 'shoonya');
      console.log(`\n🎯 Shoonya orders: ${shoonyaOrders.length}`);
      
      if (shoonyaOrders.length > 0) {
        console.log('\n🔍 Testing order status refresh with real data...');
        
        const testOrder = shoonyaOrders[0];
        if (testOrder) {
          console.log(`\n📊 Testing with order:`);
          console.log(`  Broker Order ID: ${testOrder.broker_order_id}`);
          console.log(`  Current Status: ${testOrder.status}`);
          console.log(`  User ID: ${testOrder.user_id}`);
          console.log(`  Symbol: ${testOrder.symbol}`);
          
          // Check connected accounts for this user
          console.log('\n🔗 Checking connected accounts for this user...');
          const connectedAccounts = await mongoose.connection.db?.collection('connectedaccounts')
            .find({ user_id: testOrder.user_id, broker_name: 'shoonya' }).toArray();
        
          console.log(`Found ${connectedAccounts?.length || 0} Shoonya accounts for user`);
          
          if (connectedAccounts && connectedAccounts.length > 0) {
            connectedAccounts.forEach((account, index) => {
              console.log(`  Account ${index + 1}:`);
              console.log(`    Account ID: ${account.account_id}`);
              console.log(`    User Name: ${account.user_name}`);
              console.log(`    Status: ${account.status || 'active'}`);
              console.log(`    Has Credentials: ${!!account.encrypted_credentials}`);
            });
          }
        }
      }
    }
    
  } catch (error: any) {
    console.error('🚨 Order data check failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Export for manual testing
export { checkOrderData };

// Run if called directly
if (require.main === module) {
  checkOrderData()
    .then(() => {
      console.log('\n🎉 Order data check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Order data check failed:', error);
      process.exit(1);
    });
}