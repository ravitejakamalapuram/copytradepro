// Test script to directly test database order history functionality
const { SQLiteUserDatabase } = require('./dist/services/sqliteDatabase');
const userDatabase = new SQLiteUserDatabase();

async function testDatabaseDirect() {
  try {
    console.log('🧪 Testing database order history directly...');
    
    // First, let's see if there are any users
    const users = userDatabase.getAllUsers();
    console.log('👥 Found users:', users.length);
    
    if (users.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    // Check all users for connected accounts
    let userWithAccounts = null;
    let accounts = [];

    for (const user of users) {
      console.log(`👤 Checking user: ${user.email} (ID: ${user.id})`);
      const userAccounts = userDatabase.getConnectedAccountsByUserId(user.id);
      console.log(`  🔗 Connected accounts: ${userAccounts.length}`);

      if (userAccounts.length > 0) {
        userWithAccounts = user;
        accounts = userAccounts;
        break;
      }
    }

    if (!userWithAccounts) {
      console.log('❌ No users with connected accounts found');
      return;
    }

    console.log('✅ Using user with accounts:', userWithAccounts.email, 'ID:', userWithAccounts.id);
    
    const account = accounts[0];
    console.log('💼 Using account:', account.broker_name, 'ID:', account.id);
    
    // Check existing order history
    const existingOrders = userDatabase.getOrderHistoryByUserId(userWithAccounts.id);
    console.log('📊 Existing orders in history:', existingOrders.length);
    
    if (existingOrders.length > 0) {
      console.log('📋 Recent orders:');
      existingOrders.slice(0, 3).forEach((order, index) => {
        console.log(`  ${index + 1}. ${order.symbol} ${order.action} ${order.quantity} @ ${order.price} (${order.broker_order_id})`);
      });
    }
    
    // Create a test order history record with PLACED status (correct behavior)
    console.log('➕ Creating test order history record with PLACED status...');
    const testOrderData = {
      user_id: userWithAccounts.id,
      account_id: account.id,
      broker_name: account.broker_name,
      broker_order_id: 'TEST_PLACED_ORDER_' + Date.now(),
      symbol: 'NEWSTOCK',
      action: 'BUY',
      quantity: 5,
      price: 50.25,
      order_type: 'MARKET',
      status: 'PLACED', // Correct status for newly placed orders
      exchange: 'NSE',
      product_type: 'C',
      remarks: 'Test order with correct PLACED status',
      executed_at: new Date().toISOString(),
    };
    
    const createdOrder = userDatabase.createOrderHistory(testOrderData);
    console.log('✅ Created test order:', createdOrder.broker_order_id);
    
    // Verify the order was created
    const updatedOrders = userDatabase.getOrderHistoryByUserId(userWithAccounts.id);
    console.log('📈 Total orders after creation:', updatedOrders.length);

    // Get order count
    const orderCount = userDatabase.getOrderCountByUserId(userWithAccounts.id);
    console.log('🔢 Order count:', orderCount);
    
    console.log('✅ Database test completed successfully!');
    
  } catch (error) {
    console.error('🚨 Database test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testDatabaseDirect();
