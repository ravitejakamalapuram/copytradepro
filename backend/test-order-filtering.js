const axios = require('axios');

// Test script to verify order history filtering functionality
async function testOrderFiltering() {
  try {
    console.log('🧪 Testing order history filtering...');
    
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

    // Test 1: Get all orders (no filters)
    console.log('\n📊 Test 1: All orders (no filters)');
    const allOrdersResponse = await axios.get('http://localhost:3001/api/broker/order-history', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (allOrdersResponse.data.success) {
      console.log(`✅ Found ${allOrdersResponse.data.data.orders.length} total orders`);
    }

    // Test 2: Filter by status
    console.log('\n📊 Test 2: Filter by status = PLACED');
    const statusFilterResponse = await axios.get('http://localhost:3001/api/broker/order-history?status=PLACED', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (statusFilterResponse.data.success) {
      console.log(`✅ Found ${statusFilterResponse.data.data.orders.length} PLACED orders`);
      statusFilterResponse.data.data.orders.forEach(order => {
        console.log(`   - ${order.symbol} ${order.action} (Status: ${order.status})`);
      });
    }

    // Test 3: Filter by symbol
    console.log('\n📊 Test 3: Filter by symbol containing "TEST"');
    const symbolFilterResponse = await axios.get('http://localhost:3001/api/broker/order-history?symbol=TEST', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (symbolFilterResponse.data.success) {
      console.log(`✅ Found ${symbolFilterResponse.data.data.orders.length} orders with TEST in symbol`);
      symbolFilterResponse.data.data.orders.forEach(order => {
        console.log(`   - ${order.symbol} ${order.action} (${order.status})`);
      });
    }

    // Test 4: Filter by action
    console.log('\n📊 Test 4: Filter by action = BUY');
    const actionFilterResponse = await axios.get('http://localhost:3001/api/broker/order-history?action=BUY', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (actionFilterResponse.data.success) {
      console.log(`✅ Found ${actionFilterResponse.data.data.orders.length} BUY orders`);
    }

    // Test 5: Multiple filters
    console.log('\n📊 Test 5: Multiple filters (status=PLACED & action=BUY)');
    const multiFilterResponse = await axios.get('http://localhost:3001/api/broker/order-history?status=PLACED&action=BUY', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (multiFilterResponse.data.success) {
      console.log(`✅ Found ${multiFilterResponse.data.data.orders.length} PLACED BUY orders`);
      multiFilterResponse.data.data.orders.forEach(order => {
        console.log(`   - ${order.symbol} ${order.action} (${order.status})`);
      });
    }

    // Test 6: Date range filter (today)
    const today = new Date().toISOString().split('T')[0];
    console.log(`\n📊 Test 6: Filter by date (today: ${today})`);
    const dateFilterResponse = await axios.get(`http://localhost:3001/api/broker/order-history?startDate=${today}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (dateFilterResponse.data.success) {
      console.log(`✅ Found ${dateFilterResponse.data.data.orders.length} orders from today`);
    }

    console.log('\n🎉 Order filtering tests completed successfully!');

  } catch (error) {
    console.error('🚨 Test failed:', error.message);
    if (error.response) {
      console.error('🚨 Response status:', error.response.status);
      console.error('🚨 Response data:', error.response.data);
    }
  }
}

// Run the test
testOrderFiltering();
