/**
 * Debug order status using the correct account for each order
 */

import { UnifiedBrokerFactory } from '@copytrade/unified-broker';
import { userDatabase } from '../services/databaseCompatibility';

async function debugWithCorrectAccount(orderId: string) {
  console.log('🎯 Debug Order Status with Correct Account');
  console.log('═'.repeat(60));
  console.log(`Order ID: ${orderId}`);
  
  try {
    // Get order from database - try both string and number approaches
    let order;
    try {
      // First try as string (MongoDB ObjectId)
      order = await userDatabase.getOrderHistoryById(orderId as any);
    } catch (error) {
      console.log('⚠️ String ID failed, trying as number...');
      // If that fails, try parsing as number
      order = await userDatabase.getOrderHistoryById(orderId);
    }
    if (!order) {
      console.log('❌ Order not found in database');
      return;
    }
    
    console.log('\n📋 Order Details:');
    console.log(`- Order ID: ${order.id}`);
    console.log(`- User ID: ${order.user_id}`);
    console.log(`- Broker: ${order.broker_name}`);
    console.log(`- Broker Order ID: ${order.broker_order_id}`);
    console.log(`- Account ID: ${order.account_id}`);
    console.log(`- Status: ${order.status}`);
    console.log(`- Symbol: ${order.symbol}`);
    
    // Create service statelessly using broker name
    const factory = UnifiedBrokerFactory.getInstance();
    const service = factory.createBroker(order.broker_name);

    console.log(`✅ Prepared stateless service for broker: ${order.broker_name}`);
    console.log(`- Account ID: ${order.account_id}`);

    // Make direct API call with correct account
    console.log('\n🚀 Making Shoonya API call with correct account...');
    console.log(`- Account ID: ${order.account_id}`);
    console.log(`- Broker Order ID: ${order.broker_order_id}`);

    try {
      const startTime = Date.now();
      const apiResponse = await service.getOrderStatus(
        order.account_id.toString(),
        order.broker_order_id
      );
      const endTime = Date.now();
      
      console.log(`\n✅ API Response (${endTime - startTime}ms):`);
      console.log('─'.repeat(50));
      console.log(JSON.stringify(apiResponse, null, 2));
      
      // Analyze the response
      if (apiResponse && typeof apiResponse === 'object') {
        console.log('\n🔍 Response Analysis:');
        console.log(`- Success: ${apiResponse.success}`);
        console.log(`- Has Data: ${!!apiResponse.data}`);
        
        if (apiResponse.success && apiResponse.data) {
          console.log(`- Order Status: ${apiResponse.data.status}`);
          console.log(`- Symbol: ${apiResponse.data.symbol}`);
          console.log(`- Quantity: ${apiResponse.data.quantity}`);
          console.log(`- Filled Quantity: ${apiResponse.data.filledQuantity}`);
          console.log(`- Price: ${apiResponse.data.price}`);
          console.log(`- Average Price: ${apiResponse.data.averagePrice}`);
        } else if (apiResponse.originalError) {
          console.log(`- Shoonya Error: ${apiResponse.originalError.stat}`);
          console.log(`- Error Message: ${apiResponse.originalError.emsg}`);
        }
      }
      
    } catch (apiError: any) {
      console.log(`\n❌ API Call Failed:`);
      console.log(`- Error: ${apiError.message}`);
      console.log(`- Type: ${apiError.constructor.name}`);
      if (apiError.response) {
        console.log(`- Response Status: ${apiError.response.status}`);
        console.log(`- Response Data:`, apiError.response.data);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Debug failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Test with both orders
async function testBothOrders() {
  console.log('🧪 Testing Both Orders');
  console.log('═'.repeat(80));
  
  const orders = [
    '687c768ca3e19fb607b69c15', // Account FN135151 (INACTIVE)
    '687c768ba3e19fb607b69c0e'  // Account FN135006 (ACTIVE)
  ];
  
  for (const orderId of orders) {
    await debugWithCorrectAccount(orderId);
    console.log('\n' + '═'.repeat(80) + '\n');
  }
  
  process.exit(0);
}

// Run if called directly
if (require.main === module) {
  const orderId = process.argv[2];
  if (orderId) {
    debugWithCorrectAccount(orderId).then(() => process.exit(0));
  } else {
    testBothOrders();
  }
}

export { debugWithCorrectAccount };