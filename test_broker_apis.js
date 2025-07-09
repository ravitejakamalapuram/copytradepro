/**
 * Test script for the enhanced broker APIs
 * Tests the new unified authentication flow
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test user credentials (you can modify these)
const TEST_USER = {
  email: 'test@example.com',
  password: 'test123',
  name: 'Test User'
};

// Let's try with a fresh user
const FRESH_USER = {
  email: `test${Date.now()}@example.com`,
  password: 'Test123!',
  name: 'Test User'
};

// Test broker credentials
const SHOONYA_CREDENTIALS = {
  userId: 'FN135006',
  password: 'rAVI@1994',
  totpKey: 'P4325AWTC4E66D57E3A547H567A5T3GF',
  vendorCode: 'FN135006_U',
  apiSecret: '2d73a28f0c56e3a3f41cf95a690c3cc2',
  imei: 'abc1234'
};

const FYERS_CREDENTIALS = {
  clientId: 'YZ7RCOVDOX-100',
  secretKey: '5BGXZUV1Z6',
  redirectUri: 'https://www.urlencoder.org/'
};

let authToken = null;

async function testAPI() {
  try {
    console.log('🧪 Starting Enhanced Broker API Tests...\n');

    // Step 1: Register/Login user
    console.log('1️⃣ Testing user authentication...');
    await testUserAuth();

    // Step 1.5: Test token with a simple authenticated endpoint
    console.log('\n1️⃣.5 Testing token with available brokers...');
    await testAvailableBrokers();

    // Step 2: Test Shoonya connection (direct auth)
    console.log('\n2️⃣ Testing Shoonya connection (direct auth)...');
    await testShoonyaConnection();

    // Step 3: Test Fyers connection (OAuth flow)
    console.log('\n3️⃣ Testing Fyers connection (OAuth flow)...');
    await testFyersConnection();

    // Step 4: Test get connected accounts
    console.log('\n4️⃣ Testing get connected accounts...');
    await testGetConnectedAccounts();

    console.log('\n✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

async function testUserAuth() {
  try {
    // Register a fresh user
    console.log('📝 Registering fresh user...');
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, FRESH_USER);
    console.log('✅ User registered successfully');

    // Login user
    console.log('🔐 Logging in...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: FRESH_USER.email,
      password: FRESH_USER.password
    });

    authToken = loginResponse.data.data.token;
    console.log('✅ User logged in successfully');
    console.log('🔑 Auth token obtained:', authToken ? 'Present' : 'Missing');
    console.log('📋 Login response:', loginResponse.data);

  } catch (error) {
    console.error('❌ Auth error details:', error.response?.data);
    throw new Error(`User auth failed: ${error.message}`);
  }
}

async function testAvailableBrokers() {
  try {
    const response = await axios.get(
      `${BASE_URL}/api/broker/available`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    console.log('✅ Available brokers response:', response.data);

  } catch (error) {
    console.error('❌ Available brokers error:', error.response?.data || error.message);
  }
}

async function testShoonyaConnection() {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/broker/connect`,
      {
        brokerName: 'shoonya',
        credentials: SHOONYA_CREDENTIALS
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    console.log('✅ Shoonya connection response:', response.data);
    
    if (response.data.success) {
      console.log('✅ Shoonya connected successfully');
      console.log('📊 Account Status:', response.data.data.accountStatus);
      console.log('👤 Account ID:', response.data.data.accountId);
      console.log('🏢 Broker:', response.data.data.brokerDisplayName);
    } else {
      console.log('⚠️ Shoonya connection failed:', response.data.message);
    }

  } catch (error) {
    console.error('❌ Shoonya connection error:', error.response?.data || error.message);
  }
}

async function testFyersConnection() {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/broker/connect`,
      {
        brokerName: 'fyers',
        credentials: FYERS_CREDENTIALS
      },
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    console.log('✅ Fyers connection response:', response.data);
    
    if (response.data.success) {
      console.log('✅ Fyers OAuth URL generated');
      console.log('📊 Account Status:', response.data.data.accountStatus);
      console.log('🔗 Auth URL:', response.data.data.authUrl ? 'Generated' : 'Not provided');
      console.log('🔄 Requires Auth Code:', response.data.data.requiresAuthCode);
    } else {
      console.log('⚠️ Fyers connection failed:', response.data.message);
    }

  } catch (error) {
    console.error('❌ Fyers connection error:', error.response?.data || error.message);
  }
}

async function testGetConnectedAccounts() {
  try {
    const response = await axios.get(
      `${BASE_URL}/api/broker/accounts`,
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    console.log('✅ Connected accounts response:', response.data);
    
    if (response.data.success) {
      console.log('✅ Retrieved connected accounts');
      console.log('📊 Total accounts:', response.data.accounts.length);

      response.data.accounts.forEach((account, index) => {
        console.log(`\n📋 Account ${index + 1}:`);
        console.log(`   🏢 Broker: ${account.brokerDisplayName}`);
        console.log(`   👤 Account ID: ${account.accountId}`);
        console.log(`   📊 Status: ${account.accountStatus}`);
        console.log(`   ✅ Active: ${account.isActive}`);
        console.log(`   ⏰ Token Expiry: ${account.tokenExpiryTime || 'Never'}`);
      });
    } else {
      console.log('⚠️ Get accounts failed:', response.data.message);
    }

  } catch (error) {
    console.error('❌ Get accounts error:', error.response?.data || error.message);
  }
}

// Run the tests
testAPI();
