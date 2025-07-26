/**
 * Simple script to run the detailed order status debug
 * Usage: npm run ts-node src/tests/runOrderStatusDebug.ts
 */

import { debugOrderStatusDetailed } from './debugOrderStatusDetailed';

async function main() {
  console.log('🚀 Starting Order Status Debug Session');
  console.log('═'.repeat(60));
  
  try {
    await debugOrderStatusDetailed();
  } catch (error) {
    console.error('💥 Debug session failed:', error);
  }
  
  console.log('\n🏁 Debug session completed');
  process.exit(0);
}

main();