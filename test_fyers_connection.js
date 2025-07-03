// Test script to verify Fyers connection
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test credentials from .env file
const fyersCredentials = {
  clientId: 'YZ7RCOVDOX-100',
  secretKey: '5BGXZUV1Z6',
  redirectUri: 'https://www.urlencoder.org/'
};

// Mock JWT token for testing (you'll need to replace this with a real token)
const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NzU5ZjE5ZjE5ZjE5ZjE5ZjE5ZjE5ZiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTczNTg5NjAwMCwiZXhwIjoxNzM1OTgyNDAwfQ.test';

async function testFyersConnection() {
  try {
    console.log('🔗 Testing Fyers connection...');
    
    // Step 1: Try to connect to Fyers (should return auth URL)
    const connectResponse = await axios.post(`${BASE_URL}/broker/connect`, {
      brokerName: 'fyers',
      credentials: fyersCredentials
    }, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Connect response:', connectResponse.data);
    
    if (connectResponse.data.success && connectResponse.data.data.authUrl) {
      console.log('🔗 Auth URL generated:', connectResponse.data.data.authUrl);
      console.log('📝 Please visit this URL to complete authentication');
      
      // You would normally visit this URL and get an auth code
      // For testing, we'll simulate what happens after getting the auth code
      console.log('\n⚠️ To complete the test:');
      console.log('1. Visit the auth URL above');
      console.log('2. Complete authentication');
      console.log('3. Get the auth code from the redirect URL');
      console.log('4. Use the validateFyersAuthCode endpoint');
    }
    
  } catch (error) {
    console.error('❌ Connection failed:', error.response?.data || error.message);
  }
}

async function testGetAccounts() {
  try {
    console.log('\n📊 Testing get connected accounts...');
    
    const accountsResponse = await axios.get(`${BASE_URL}/broker/accounts`, {
      headers: {
        'Authorization': `Bearer ${testToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Accounts response:', accountsResponse.data);
    
  } catch (error) {
    console.error('❌ Get accounts failed:', error.response?.data || error.message);
  }
}

// Run tests
async function runTests() {
  await testFyersConnection();
  await testGetAccounts();
}

runTests();
