#!/usr/bin/env node

/**
 * Comprehensive Fyers Integration Test Suite
 * Tests all Fyers helper functions and service methods
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Test user token from our previous registration
const TEST_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NjY0MjY3ODE2N2U3MGQyYWQ3NDk2MiIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsIm5hbWUiOiJUZXN0IFVzZXIiLCJpYXQiOjE3NTE1MzIxMzUsImV4cCI6MTc1MTYxODUzNX0.e7eS_NJFJUUKrWQEbhVFLXtW_oj0OxFD2KV3IlENjs0';

// Fyers test credentials
const FYERS_CREDENTIALS = {
  clientId: 'YZ7RCOVDOX-100',
  secretKey: '5BGXZUV1Z6',
  redirectUri: 'https://www.urlencoder.org/'
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  const fullMessage = `${status} ${name}${message ? ': ' + message : ''}`;
  console.log(fullMessage);
  
  testResults.tests.push({ name, passed, message });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

function logSection(title) {
  console.log(`\n🔍 ${title}`);
  console.log('='.repeat(50));
}

async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json',
        ...headers
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message,
      status: error.response?.status || 0
    };
  }
}

async function testAuthEndpoints() {
  logSection('Authentication Endpoints');
  
  // Test profile endpoint
  const profileResult = await makeRequest('GET', '/auth/profile');
  logTest('Get user profile', profileResult.success, 
    profileResult.success ? `User: ${profileResult.data?.data?.user?.email}` : profileResult.error);
}

async function testFyersConnection() {
  logSection('Fyers Connection Flow');
  
  // Test Fyers connection (should return auth URL)
  const connectResult = await makeRequest('POST', '/broker/connect', {
    brokerName: 'fyers',
    credentials: FYERS_CREDENTIALS
  });
  
  logTest('Fyers connection initiation', connectResult.success,
    connectResult.success ? 'Auth URL generated' : connectResult.error);
  
  if (connectResult.success && connectResult.data?.data?.authUrl) {
    console.log(`🔗 Auth URL: ${connectResult.data.data.authUrl}`);
    logTest('Auth URL format validation', 
      connectResult.data.data.authUrl.includes('api-t1.fyers.in'),
      'URL contains correct Fyers domain');
  }
}

async function testAccountManagement() {
  logSection('Account Management');
  
  // Test get connected accounts
  const accountsResult = await makeRequest('GET', '/broker/accounts');
  logTest('Get connected accounts', accountsResult.success,
    accountsResult.success ? `Found ${accountsResult.data?.accounts?.length || 0} accounts` : accountsResult.error);
  
  // Test account status check (should fail gracefully for non-existent account)
  const statusResult = await makeRequest('GET', '/broker/accounts/test-account/status');
  logTest('Account status check (non-existent)', !statusResult.success && statusResult.status === 404,
    'Correctly returns 404 for non-existent account');
}

async function testBrokerEndpoints() {
  logSection('Broker Service Endpoints');
  
  // Test symbol search (should work without authentication to broker)
  const searchResult = await makeRequest('GET', '/broker/search/fyers/NSE/TCS');
  logTest('Symbol search endpoint', searchResult.success || searchResult.status === 401,
    'Endpoint accessible (may require broker auth)');
  
  // Test order book (should require broker authentication)
  const orderBookResult = await makeRequest('GET', '/broker/orders/fyers');
  logTest('Order book endpoint', !orderBookResult.success,
    'Correctly requires broker authentication');
  
  // Test positions (should require broker authentication)
  const positionsResult = await makeRequest('GET', '/broker/positions/fyers');
  logTest('Positions endpoint', !positionsResult.success,
    'Correctly requires broker authentication');
}

async function testOrderPlacement() {
  logSection('Order Placement (Without Broker Auth)');
  
  // Test order placement (should fail without broker connection)
  const orderData = {
    brokerName: 'fyers',
    accountId: 'test-account',
    symbol: 'TCS',
    exchange: 'NSE',
    quantity: '1',
    action: 'BUY',
    orderType: 'LIMIT',
    price: '3500',
    productType: 'CNC'
  };
  
  const orderResult = await makeRequest('POST', '/broker/place-order', orderData);
  logTest('Order placement (no broker auth)', !orderResult.success,
    'Correctly fails without broker authentication');
}

async function testValidationRules() {
  logSection('Input Validation');
  
  // Test invalid broker name
  const invalidBrokerResult = await makeRequest('POST', '/broker/connect', {
    brokerName: 'invalid-broker',
    credentials: FYERS_CREDENTIALS
  });
  logTest('Invalid broker name validation', !invalidBrokerResult.success,
    'Correctly rejects invalid broker names');
  
  // Test missing credentials
  const missingCredsResult = await makeRequest('POST', '/broker/connect', {
    brokerName: 'fyers'
  });
  logTest('Missing credentials validation', !missingCredsResult.success,
    'Correctly requires credentials');
  
  // Test invalid Fyers credentials format
  const invalidCredsResult = await makeRequest('POST', '/broker/connect', {
    brokerName: 'fyers',
    credentials: { clientId: 'invalid' }
  });
  logTest('Invalid credentials format', !invalidCredsResult.success,
    'Correctly validates credential format');
}

async function testDatabaseOperations() {
  logSection('Database Operations');
  
  // Test that database is responding
  const accountsResult = await makeRequest('GET', '/broker/accounts');
  logTest('Database connectivity', accountsResult.success,
    'Database operations working');
  
  if (accountsResult.success) {
    logTest('Account data structure', 
      Array.isArray(accountsResult.data.accounts),
      'Returns proper array structure');
  }
}

async function testErrorHandling() {
  logSection('Error Handling');
  
  // Test malformed JSON
  try {
    const response = await axios.post(`${BASE_URL}/broker/connect`, 'invalid-json', {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    logTest('Malformed JSON handling', false, 'Should have failed');
  } catch (error) {
    logTest('Malformed JSON handling', error.response?.status === 400,
      'Correctly handles malformed JSON');
  }
  
  // Test missing authorization
  const noAuthResult = await makeRequest('GET', '/broker/accounts', null, { 'Authorization': '' });
  logTest('Missing authorization handling', !noAuthResult.success && noAuthResult.status === 401,
    'Correctly requires authentication');
}

async function testHealthAndStatus() {
  logSection('Health and Status');
  
  // Test health endpoint
  try {
    const healthResponse = await axios.get('http://localhost:3001/health');
    logTest('Health endpoint', healthResponse.status === 200,
      `Status: ${healthResponse.data?.status}`);
  } catch (error) {
    logTest('Health endpoint', false, 'Health check failed');
  }
}

function printSummary() {
  console.log('\n📊 TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests
      .filter(test => !test.passed)
      .forEach(test => console.log(`   - ${test.name}: ${test.message}`));
  }
  
  console.log('\n🎉 Fyers Integration Test Complete!');
}

async function runAllTests() {
  console.log('🚀 Starting Comprehensive Fyers Integration Tests');
  console.log('='.repeat(60));
  
  try {
    await testHealthAndStatus();
    await testAuthEndpoints();
    await testFyersConnection();
    await testAccountManagement();
    await testBrokerEndpoints();
    await testOrderPlacement();
    await testValidationRules();
    await testDatabaseOperations();
    await testErrorHandling();
  } catch (error) {
    console.error('🚨 Test suite error:', error);
  }
  
  printSummary();
}

// Run the tests
runAllTests();
