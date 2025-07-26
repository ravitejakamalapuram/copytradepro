/**
 * Setup script to create test data for Shoonya order status testing
 */

import { userDatabase } from '../services/databaseCompatibility';

async function setupTestData() {
  console.log('🔧 Setting up test data for Shoonya order status testing...');
  
  try {
    // Check if we already have data
    const userCount = await userDatabase.getUserCount();
    console.log(`Current users in database: ${userCount}`);
    
    if (userCount === 0) {
      console.log('📝 Creating test user...');
      
      // Create a test user
      const testUser = await userDatabase.createUser({
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedpassword123', // In real app, this would be properly hashed
        created_at: new Date(),
        updated_at: new Date()
      });
      
      console.log(`✅ Created test user with ID: ${testUser.id}`);
      
      // Create a test connected account for Shoonya
      console.log('🔗 Creating test Shoonya connected account...');
      
      const testAccount = await userDatabase.createConnectedAccount({
        user_id: testUser.id,
        broker_name: 'shoonya',
        account_id: 'TEST_ACCOUNT_ID', // You'll need to replace this with your actual Shoonya account ID
        status: 'active',
        credentials: JSON.stringify({
          // You'll need to add your actual Shoonya credentials here
          userId: 'YOUR_SHOONYA_USER_ID',
          password: 'YOUR_SHOONYA_PASSWORD',
          twoFA: 'YOUR_2FA_KEY'
        }),
        created_at: new Date(),
        updated_at: new Date()
      });
      
      console.log(`✅ Created test connected account with ID: ${testAccount.id}`);
      
      // Create some test orders
      console.log('📋 Creating test orders...');
      
      const testOrders = [
        {
          user_id: testUser.id,
          account_id: 'TEST_ACCOUNT_ID',
          broker_name: 'shoonya',
          broker_order_id: 'SH123456789', // Replace with actual Shoonya order ID
          symbol: 'RELIANCE-EQ',
          action: 'BUY',
          quantity: 10,
          price: 2500.00,
          order_type: 'LIMIT',
          product_type: 'CNC',
          status: 'PLACED',
          exchange: 'NSE',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          user_id: testUser.id,
          account_id: 'TEST_ACCOUNT_ID',
          broker_name: 'shoonya',
          broker_order_id: 'SH123456790', // Replace with actual Shoonya order ID
          symbol: 'TCS-EQ',
          action: 'BUY',
          quantity: 5,
          price: 3500.00,
          order_type: 'LIMIT',
          product_type: 'CNC',
          status: 'PLACED',
          exchange: 'NSE',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];
      
      for (const orderData of testOrders) {
        const order = await userDatabase.createOrderHistory(orderData);
        console.log(`✅ Created test order: ${order.id} (${orderData.symbol})`);
      }
      
      console.log('\n🎉 Test data setup completed!');
      console.log('\n📝 Next steps:');
      console.log('1. Update the credentials in the connected account with your real Shoonya credentials');
      console.log('2. Update the broker_order_id fields with real Shoonya order IDs');
      console.log('3. Run the integration test again');
      
    } else {
      console.log('✅ Database already has users. Checking existing data...');
      
      const allOrders = await userDatabase.getAllOrderHistory(10);
      console.log(`Found ${allOrders.length} existing orders`);
      
      const shoonyaOrders = allOrders.filter(order => order.broker_name === 'shoonya');
      console.log(`Found ${shoonyaOrders.length} Shoonya orders`);
      
      if (shoonyaOrders.length > 0) {
        console.log('\n📋 Existing Shoonya orders:');
        shoonyaOrders.forEach((order, index) => {
          console.log(`${index + 1}. Order ${order.id}: ${order.symbol} (${order.status})`);
          console.log(`   Broker Order ID: ${order.broker_order_id}`);
          console.log(`   User ID: ${order.user_id}`);
        });
      }
    }
    
  } catch (error: any) {
    console.error('🚨 Setup failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Export for manual testing
export { setupTestData };

// Run if called directly
if (require.main === module) {
  setupTestData()
    .then(() => {
      console.log('\n🎉 Setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Setup failed:', error);
      process.exit(1);
    });
}