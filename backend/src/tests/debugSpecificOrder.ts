/**
 * Debug specific order status with command line arguments
 * Usage: npm run ts-node src/tests/debugSpecificOrder.ts <orderId> [userId]
 */

import { OrderStatusDebugger } from './debugOrderStatusDetailed';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('❌ Usage: npm run ts-node src/tests/debugSpecificOrder.ts <orderId> [userId]');
    console.log('📝 Example: npm run ts-node src/tests/debugSpecificOrder.ts 687c768ca3e19fb607b69c15 6861fffc6ca252479ba48892');
    process.exit(1);
  }
  
  const orderId: string = args[0]!; // We already checked args.length > 0
  const userId: string | undefined = args[1]; // Optional
  
  console.log('🚀 Starting Specific Order Debug');
  console.log('═'.repeat(60));
  console.log(`🎯 Order ID: ${orderId}`);
  if (userId) {
    console.log(`👤 User ID: ${userId}`);
  }
  console.log('═'.repeat(60));
  
  const orderDebugger = new OrderStatusDebugger();
  
  try {
    await orderDebugger.debugOrderStatus(orderId, userId);
  } catch (error) {
    console.error('💥 Debug failed:', error);
  }
  
  console.log('\n🏁 Debug completed');
  process.exit(0);
}

main();