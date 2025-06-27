const axios = require('axios');

// Test script to verify order search functionality
async function testSearchFunctionality() {
  try {
    console.log('🔍 Testing order search functionality...');
    
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

    // Test 1: Search by symbol
    console.log('\n🔍 Test 1: Search by symbol "TEST"');
    const symbolSearchResponse = await axios.get('http://localhost:3001/api/broker/order-history?search=TEST', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (symbolSearchResponse.data.success) {
      console.log(`✅ Found ${symbolSearchResponse.data.data.orders.length} orders with "TEST" in symbol`);
      symbolSearchResponse.data.data.orders.forEach(order => {
        console.log(`   - ${order.symbol} ${order.action} (${order.status})`);
      });
    }

    // Test 2: Search by partial symbol
    console.log('\n🔍 Test 2: Search by partial symbol "NEW"');
    const partialSearchResponse = await axios.get('http://localhost:3001/api/broker/order-history?search=NEW', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (partialSearchResponse.data.success) {
      console.log(`✅ Found ${partialSearchResponse.data.data.orders.length} orders with "NEW" in symbol`);
      partialSearchResponse.data.data.orders.forEach(order => {
        console.log(`   - ${order.symbol} ${order.action} (${order.status})`);
      });
    }

    // Test 3: Search suggestions for symbols
    console.log('\n💡 Test 3: Get search suggestions for "TEST"');
    const suggestionsResponse = await axios.get('http://localhost:3001/api/broker/order-search-suggestions?q=TEST&limit=5', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (suggestionsResponse.data.success) {
      console.log(`✅ Found ${suggestionsResponse.data.data.suggestions.length} suggestions for "TEST"`);
      suggestionsResponse.data.data.suggestions.forEach(suggestion => {
        console.log(`   - ${suggestion.value} (${suggestion.type})`);
      });
    }

    // Test 4: Search suggestions for partial match
    console.log('\n💡 Test 4: Get search suggestions for "N"');
    const partialSuggestionsResponse = await axios.get('http://localhost:3001/api/broker/order-search-suggestions?q=N&limit=8', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (partialSuggestionsResponse.data.success) {
      console.log(`✅ Found ${partialSuggestionsResponse.data.data.suggestions.length} suggestions for "N"`);
      partialSuggestionsResponse.data.data.suggestions.forEach(suggestion => {
        console.log(`   - ${suggestion.value} (${suggestion.type})`);
      });
    }

    // Test 5: Combined search and filters
    console.log('\n🔍 Test 5: Combined search "TEST" with status filter "EXECUTED"');
    const combinedSearchResponse = await axios.get('http://localhost:3001/api/broker/order-history?search=TEST&status=EXECUTED', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (combinedSearchResponse.data.success) {
      console.log(`✅ Found ${combinedSearchResponse.data.data.orders.length} EXECUTED orders with "TEST" in symbol`);
      combinedSearchResponse.data.data.orders.forEach(order => {
        console.log(`   - ${order.symbol} ${order.action} (${order.status})`);
      });
    }

    // Test 6: Search by order ID (if numeric)
    console.log('\n🔍 Test 6: Search by order ID "1"');
    const orderIdSearchResponse = await axios.get('http://localhost:3001/api/broker/order-history?search=1', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (orderIdSearchResponse.data.success) {
      console.log(`✅ Found ${orderIdSearchResponse.data.data.orders.length} orders with "1" in ID or symbol`);
      orderIdSearchResponse.data.data.orders.forEach(order => {
        console.log(`   - ID: ${order.id}, Symbol: ${order.symbol}, Broker Order: ${order.broker_order_id}`);
      });
    }

    // Test 7: Empty search (should return all orders)
    console.log('\n🔍 Test 7: Empty search (should return all orders)');
    const emptySearchResponse = await axios.get('http://localhost:3001/api/broker/order-history?search=', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (emptySearchResponse.data.success) {
      console.log(`✅ Found ${emptySearchResponse.data.data.orders.length} total orders (empty search)`);
    }

    console.log('\n🎉 Search functionality tests completed successfully!');
    console.log('📱 Now test the frontend search input with autocomplete');

  } catch (error) {
    console.error('🚨 Test failed:', error.message);
    if (error.response) {
      console.error('🚨 Response status:', error.response.status);
      console.error('🚨 Response data:', error.response.data);
    }
  }
}

// Run the test
testSearchFunctionality();
