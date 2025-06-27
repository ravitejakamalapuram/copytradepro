const axios = require('axios');

// Test script to debug place order issues
async function testPlaceOrder() {
  try {
    console.log('🧪 Testing place order API...');
    
    // First, let's try to register a test user
    const registerResponse = await axios.post('http://localhost:3001/api/auth/register', {
      name: 'Test User',
      email: 'testuser@example.com',
      password: 'TestPassword123'
    }).catch(err => {
      console.log('Registration failed (user might already exist):', err.response?.data?.message);
      return null;
    });

    // Try to login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'testuser@example.com',
      password: 'TestPassword123'
    }).catch(err => {
      console.error('Login failed:', err.response?.data?.message);
      return null;
    });

    if (!loginResponse) {
      console.error('❌ Could not get authentication token');
      return;
    }

    const token = loginResponse.data.token;
    console.log('✅ Got authentication token');

    // Connect to Shoonya
    console.log('🔗 Connecting to Shoonya...');
    const connectResponse = await axios.post('http://localhost:3001/api/broker/connect', {
      brokerName: 'shoonya',
      credentials: {
        userId: 'FN135006',
        password: 'rAVI@1994',
        totpKey: 'P4325AWTC4E66D57E3A547H567A5T3GF',
        vendorCode: 'FN135006_U',
        apiSecret: '2d73a28f0c56e3a3f41cf95a690c3cc2',
        imei: 'abc1234'
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).catch(err => {
      console.error('Shoonya connection failed:', err.response?.data?.message);
      return null;
    });

    if (!connectResponse) {
      console.error('❌ Could not connect to Shoonya');
      return;
    }

    console.log('✅ Connected to Shoonya');

    // Get connected accounts to get the account ID
    const accountsResponse = await axios.get('http://localhost:3001/api/broker/accounts', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const accounts = accountsResponse.data.accounts;
    if (!accounts || accounts.length === 0) {
      console.error('❌ No connected accounts found');
      return;
    }

    const account = accounts[0];
    console.log('📊 Using account:', account.id, account.brokerDisplayName);

    // Now test place order
    console.log('📈 Testing place order...');
    const orderResponse = await axios.post('http://localhost:3001/api/broker/place-order', {
      brokerName: 'shoonya',
      accountId: account.id,
      symbol: 'RELIANCE',
      action: 'BUY',
      quantity: 1,
      orderType: 'MARKET',
      exchange: 'NSE',
      productType: 'C',
      remarks: 'Test order from debug script'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Place order response:', orderResponse.data);

  } catch (error) {
    console.error('🚨 Test failed:', error.message);
    if (error.response) {
      console.error('🚨 Response status:', error.response.status);
      console.error('🚨 Response data:', error.response.data);
    }
  }
}

// Run the test
testPlaceOrder();
