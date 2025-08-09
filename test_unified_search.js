const axios = require('axios');

async function testUnifiedSearch() {
  const baseURL = 'http://localhost:5000';
  
  console.log('🧪 Testing Unified Search Implementation...\n');
  
  try {
    // Test 1: Database Stats
    console.log('1. Testing Database Stats...');
    try {
      const statsResponse = await axios.get(`${baseURL}/api/market-data/database-stats`, {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      console.log('✅ Database Stats:', JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Database Stats failed:', error.response?.data || error.message);
    }
    
    // Test 2: Symbol Status
    console.log('\n2. Testing Symbol Status...');
    try {
      const statusResponse = await axios.get(`${baseURL}/api/market-data/symbol-status`, {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      console.log('✅ Symbol Status:', JSON.stringify(statusResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Symbol Status failed:', error.response?.data || error.message);
    }
    
    // Test 3: Unified Search
    console.log('\n3. Testing Unified Search...');
    try {
      const searchResponse = await axios.get(`${baseURL}/api/market-data/search-unified/NIFTY?limit=5&type=all&fuzzy=true`, {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      console.log('✅ Unified Search Results:', JSON.stringify(searchResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Unified Search failed:', error.response?.data || error.message);
    }
    
    // Test 4: General Search
    console.log('\n4. Testing General Search...');
    try {
      const generalSearchResponse = await axios.get(`${baseURL}/api/market-data/search?query=RELIANCE&limit=3&fuzzy=true`, {
        headers: { 'Authorization': 'Bearer test-token' }
      });
      console.log('✅ General Search Results:', JSON.stringify(generalSearchResponse.data, null, 2));
    } catch (error) {
      console.log('❌ General Search failed:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testUnifiedSearch();