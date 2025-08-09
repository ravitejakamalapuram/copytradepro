#!/usr/bin/env node

/**
 * CORS Testing Script
 * 
 * This script tests CORS configuration by making requests from different origins
 * Run with: node test-cors.js
 */

const http = require('http');

const testCORS = async (origin, port = 3001) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/api/health',
      method: 'GET',
      headers: {
        'Origin': origin,
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      const corsHeaders = {
        'access-control-allow-origin': res.headers['access-control-allow-origin'],
        'access-control-allow-credentials': res.headers['access-control-allow-credentials'],
        'access-control-allow-methods': res.headers['access-control-allow-methods'],
        'access-control-allow-headers': res.headers['access-control-allow-headers']
      };

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          origin,
          status: res.statusCode,
          corsHeaders,
          success: res.statusCode === 200
        });
      });
    });

    req.on('error', (err) => {
      reject({ origin, error: err.message });
    });

    req.end();
  });
};

const testPreflight = async (origin, port = 3001) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/api/broker/accounts',
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    };

    const req = http.request(options, (res) => {
      const corsHeaders = {
        'access-control-allow-origin': res.headers['access-control-allow-origin'],
        'access-control-allow-credentials': res.headers['access-control-allow-credentials'],
        'access-control-allow-methods': res.headers['access-control-allow-methods'],
        'access-control-allow-headers': res.headers['access-control-allow-headers']
      };

      resolve({
        origin,
        status: res.statusCode,
        corsHeaders,
        success: res.statusCode === 200
      });
    });

    req.on('error', (err) => {
      reject({ origin, error: err.message });
    });

    req.end();
  });
};

async function runTests() {
  console.log('🧪 Testing CORS Configuration...\n');

  const origins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'null' // For file:// protocol
  ];

  console.log('📋 Testing Simple Requests (GET /api/health)');
  console.log('=' .repeat(60));

  for (const origin of origins) {
    try {
      const result = await testCORS(origin);
      const status = result.success ? '✅' : '❌';
      console.log(`${status} Origin: ${origin}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   CORS Origin: ${result.corsHeaders['access-control-allow-origin']}`);
      console.log(`   Credentials: ${result.corsHeaders['access-control-allow-credentials']}`);
      console.log('');
    } catch (error) {
      console.log(`❌ Origin: ${origin}`);
      console.log(`   Error: ${error.error}`);
      console.log('');
    }
  }

  console.log('🚀 Testing Preflight Requests (OPTIONS /api/broker/accounts)');
  console.log('=' .repeat(60));

  for (const origin of origins) {
    try {
      const result = await testPreflight(origin);
      const status = result.success ? '✅' : '❌';
      console.log(`${status} Origin: ${origin}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   CORS Origin: ${result.corsHeaders['access-control-allow-origin']}`);
      console.log(`   Methods: ${result.corsHeaders['access-control-allow-methods']}`);
      console.log(`   Headers: ${result.corsHeaders['access-control-allow-headers']}`);
      console.log('');
    } catch (error) {
      console.log(`❌ Origin: ${origin}`);
      console.log(`   Error: ${error.error}`);
      console.log('');
    }
  }

  console.log('🎯 CORS Test Complete!');
  console.log('\n💡 Tips:');
  console.log('- If tests fail, make sure the backend server is running on port 3001');
  console.log('- Check backend logs for CORS-related messages');
  console.log('- In development, all origins should be allowed');
}

// Check if server is running first
const checkServer = () => {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/health',
      method: 'GET',
      timeout: 2000
    }, (res) => {
      resolve(true);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      resolve(false);
    });

    req.end();
  });
};

// Main execution
(async () => {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Backend server is not running on port 3001');
    console.log('💡 Start the backend server first:');
    console.log('   cd backend && npm run dev');
    process.exit(1);
  }

  await runTests();
})();