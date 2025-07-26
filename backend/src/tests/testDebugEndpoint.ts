/**
 * Test the debug endpoint to make sure it works
 */

import axios from 'axios';

async function testDebugEndpoint() {
  console.log('🧪 Testing Debug Endpoint');
  console.log('═'.repeat(50));
  
  const baseUrl = 'http://localhost:3001';
  const orderId = '687c768ca3e19fb607b69c15';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NjFmZmZjNmNhMjUyNDc5YmE0ODg5MiIsImVtYWlsIjoickBnbWFpbC5jb20iLCJuYW1lIjoidGVqYSIsImlhdCI6MTc1Mjk5ODYzNiwiZXhwIjoxNzUzMDg1MDM2fQ.wIr24V_O88Gbgtw0IB2EnCEoTRl0-O7y87RDggXsu8U';
  
  try {
    console.log(`📡 Making request to: ${baseUrl}/api/broker/debug-order-status`);
    console.log(`🎯 Order ID: ${orderId}`);
    
    const response = await axios.post(
      `${baseUrl}/api/broker/debug-order-status`,
      { orderId },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    console.log('✅ Request successful!');
    console.log('📊 Response status:', response.status);
    console.log('📋 Response data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.debug && response.data.debug.logs) {
      console.log('\n🔍 Debug Steps Summary:');
      response.data.debug.logs.forEach((log: any, index: number) => {
        const status = log.success === true ? '✅' : log.success === false ? '❌' : '⏳';
        console.log(`${index + 1}. ${status} ${log.step}`);
        if (log.error) {
          console.log(`   ❌ Error: ${log.error}`);
        }
      });
      
      // Look for the direct API call
      const apiCallLog = response.data.debug.logs.find((log: any) => 
        log.step.includes('Direct Broker API Call')
      );
      
      if (apiCallLog) {
        console.log('\n🎯 SHOONYA API CALL RESULT:');
        console.log(JSON.stringify(apiCallLog, null, 2));
      }
    }
    
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
    
    if (error.response) {
      console.error('📊 Response status:', error.response.status);
      console.error('📋 Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('📡 No response received');
    } else {
      console.error('⚙️ Request setup error:', error.message);
    }
  }
}

// Run the test
if (require.main === module) {
  testDebugEndpoint().catch(console.error);
}

export { testDebugEndpoint };