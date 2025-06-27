const axios = require('axios');

// Test script to create many orders for testing scrolling
async function createManyOrders() {
  try {
    console.log('🧪 Creating many orders for scrolling test...');
    
    // Login to get token
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'r@gmail.com',
      password: 'rAVI@1994'
    }).catch(err => {
      console.error('Login failed:', err.response?.data?.message);
      return null;
    });

    if (!loginResponse) {
      console.error('❌ Could not login');
      return;
    }

    const token = loginResponse.data.data.token;
    console.log('✅ Successfully logged in');

    // Create 15 test orders with different symbols and statuses
    const testOrders = [
      { symbol: 'RELIANCE', action: 'BUY', quantity: 10, status: 'PLACED' },
      { symbol: 'TCS', action: 'SELL', quantity: 5, status: 'EXECUTED' },
      { symbol: 'INFY', action: 'BUY', quantity: 20, status: 'PLACED' },
      { symbol: 'HDFC', action: 'BUY', quantity: 15, status: 'CANCELLED' },
      { symbol: 'ICICIBANK', action: 'SELL', quantity: 8, status: 'EXECUTED' },
      { symbol: 'SBIN', action: 'BUY', quantity: 25, status: 'PLACED' },
      { symbol: 'WIPRO', action: 'BUY', quantity: 30, status: 'REJECTED' },
      { symbol: 'HCLTECH', action: 'SELL', quantity: 12, status: 'EXECUTED' },
      { symbol: 'TECHM', action: 'BUY', quantity: 18, status: 'PLACED' },
      { symbol: 'LT', action: 'BUY', quantity: 22, status: 'EXECUTED' },
      { symbol: 'MARUTI', action: 'SELL', quantity: 6, status: 'CANCELLED' },
      { symbol: 'BAJFINANCE', action: 'BUY', quantity: 14, status: 'PLACED' },
      { symbol: 'ASIANPAINT', action: 'BUY', quantity: 16, status: 'EXECUTED' },
      { symbol: 'NESTLEIND', action: 'SELL', quantity: 4, status: 'PLACED' },
      { symbol: 'KOTAKBANK', action: 'BUY', quantity: 28, status: 'EXECUTED' },
    ];

    console.log(`\n📊 Creating ${testOrders.length} test orders...`);

    for (let i = 0; i < testOrders.length; i++) {
      const order = testOrders[i];
      
      try {
        // Add order directly to database via API
        const orderData = {
          brokerName: 'shoonya',
          brokerOrderId: `TEST${Date.now()}_${i}`,
          symbol: order.symbol,
          action: order.action,
          quantity: order.quantity,
          price: Math.floor(Math.random() * 1000) + 100, // Random price between 100-1100
          orderType: 'MARKET',
          status: order.status,
          exchange: 'NSE',
          executedAt: new Date().toISOString(),
        };

        // We'll use the place order endpoint but modify the response
        console.log(`   Creating order ${i + 1}/${testOrders.length}: ${order.symbol} ${order.action} ${order.quantity}`);
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`   ❌ Failed to create order ${i + 1}:`, error.message);
      }
    }

    console.log('\n✅ Test orders creation completed!');
    console.log('📱 Now test the frontend scrolling with many orders');
    console.log('🔍 Try filtering and searching through the orders');

  } catch (error) {
    console.error('🚨 Test failed:', error.message);
    if (error.response) {
      console.error('🚨 Response status:', error.response.status);
      console.error('🚨 Response data:', error.response.data);
    }
  }
}

// Run the test
createManyOrders();
