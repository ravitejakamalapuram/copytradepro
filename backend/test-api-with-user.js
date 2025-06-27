const axios = require('axios');

// Test script to check order history API with the correct user
async function testOrderHistoryAPI() {
  try {
    console.log('🧪 Testing order history API with correct user...');
    
    // Try to login with the user that has connected accounts
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'r@gmail.com',
      password: 'rAVI@1994'
    }).catch(err => {
      console.error('Login failed:', err.response?.data?.message);
      return null;
    });

    if (!loginResponse) {
      console.error('❌ Could not login with r@gmail.com');
      return;
    }

    console.log('🔍 Login response:', JSON.stringify(loginResponse.data, null, 2));

    const token = loginResponse.data.data?.token || loginResponse.data.token;
    if (!token) {
      console.error('❌ No token found in login response');
      return;
    }

    console.log('✅ Successfully logged in as r@gmail.com');
    console.log('🔑 Token length:', token.length);

    // Test order history API
    console.log('📊 Testing order history API...');
    const historyResponse = await axios.get('http://localhost:3001/api/broker/order-history', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Order history API response:', JSON.stringify(historyResponse.data, null, 2));

    if (historyResponse.data.success) {
      const orders = historyResponse.data.data.orders;
      console.log(`📈 Found ${orders.length} orders in history`);
      
      if (orders.length > 0) {
        console.log('📋 Order details:');
        orders.forEach((order, index) => {
          console.log(`  ${index + 1}. ${order.symbol} ${order.action} ${order.quantity} @ ${order.price}`);
          console.log(`     Order ID: ${order.broker_order_id}, Status: ${order.status}`);
          console.log(`     Executed: ${order.executed_at}`);
        });
      } else {
        console.log('📭 No orders found in history');
      }
    }

    // Test with pagination
    console.log('\n📄 Testing pagination...');
    const paginatedResponse = await axios.get('http://localhost:3001/api/broker/order-history?limit=2&offset=0', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Paginated response:', JSON.stringify(paginatedResponse.data, null, 2));

  } catch (error) {
    console.error('🚨 Test failed:', error.message);
    if (error.response) {
      console.error('🚨 Response status:', error.response.status);
      console.error('🚨 Response data:', error.response.data);
    }
  }
}

// Run the test
testOrderHistoryAPI();
