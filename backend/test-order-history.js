const axios = require('axios');

// Test script to check order history functionality
async function testOrderHistory() {
  try {
    console.log('🧪 Testing order history API...');
    
    // Try to login with existing user
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'ravi@gmail.com',
      password: 'rAVI@1994'
    }).catch(err => {
      console.log('Login failed, trying different credentials...');
      return null;
    });

    if (!loginResponse) {
      console.log('Trying to register and login with test user...');
      
      // Try to register a test user
      await axios.post('http://localhost:3001/api/auth/register', {
        name: 'Test User',
        email: 'test@example.com',
        password: 'TestPassword123'
      }).catch(err => {
        console.log('Registration failed (user might already exist)');
      });

      // Try to login with test user
      const testLoginResponse = await axios.post('http://localhost:3001/api/auth/login', {
        email: 'test@example.com',
        password: 'TestPassword123'
      }).catch(err => {
        console.error('Test user login failed:', err.response?.data?.message);
        return null;
      });

      if (!testLoginResponse) {
        console.error('❌ Could not get authentication token');
        return;
      }

      loginResponse = testLoginResponse;
    }

    const token = loginResponse.data.token;
    console.log('✅ Got authentication token');

    // Test order history API
    console.log('📊 Testing order history API...');
    const historyResponse = await axios.get('http://localhost:3001/api/broker/order-history', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Order history response:', JSON.stringify(historyResponse.data, null, 2));

    if (historyResponse.data.success) {
      const orders = historyResponse.data.data.orders;
      console.log(`📈 Found ${orders.length} orders in history`);
      
      if (orders.length > 0) {
        console.log('📋 Recent orders:');
        orders.slice(0, 3).forEach((order, index) => {
          console.log(`  ${index + 1}. ${order.symbol} ${order.action} ${order.quantity} @ ${order.price} (${order.broker_order_id})`);
        });
      } else {
        console.log('📭 No orders found in history');
      }
    }

  } catch (error) {
    console.error('🚨 Test failed:', error.message);
    if (error.response) {
      console.error('🚨 Response status:', error.response.status);
      console.error('🚨 Response data:', error.response.data);
    }
  }
}

// Run the test
testOrderHistory();
