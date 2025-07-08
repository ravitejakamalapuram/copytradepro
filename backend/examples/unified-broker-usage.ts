/**
 * Unified Broker Library Usage Examples
 * Demonstrates how to use the publishable broker library
 */

// Step 1: Install packages
// npm install @copytrade/broker-core @copytrade/broker-shoonya @copytrade/broker-fyers

// Step 2: Import core library and broker plugins
import { 
  BrokerFactory, 
  initializeBrokerCore, 
  getLibraryInfo, 
  healthCheck 
} from '@copytrade/broker-core';

// Import broker plugins (auto-registers them)
import '@copytrade/broker-shoonya';
import '@copytrade/broker-fyers';

// Optional: Import specific broker functions
import { 
  validateShoonyaCredentials, 
  getShoonyaConfig 
} from '@copytrade/broker-shoonya';

import { 
  validateFyersCredentials, 
  generateFyersAuthUrl 
} from '@copytrade/broker-fyers';

/**
 * Example 1: Basic Setup and Initialization
 */
async function basicSetup() {
  console.log('🚀 Initializing Unified Broker Library');
  
  // Initialize the core library
  initializeBrokerCore({
    enabledBrokers: ['shoonya', 'fyers'], // Only enable specific brokers
    autoLoad: true
  });
  
  // Check library health
  const health = healthCheck();
  console.log('Health Check:', health);
  
  // Get library information
  const info = getLibraryInfo();
  console.log('Library Info:', info);
  
  // Get factory instance
  const factory = BrokerFactory.getInstance();
  console.log('Available Brokers:', factory.getSupportedBrokers());
}

/**
 * Example 2: Working with Shoonya Broker
 */
async function shoonyaExample() {
  console.log('📈 Shoonya Broker Example');
  
  const factory = BrokerFactory.getInstance();
  
  // Validate credentials first
  const shoonyaCredentials = {
    userId: 'your-user-id',
    password: 'your-password',
    vendorCode: 'your-vendor-code',
    apiSecret: 'your-api-secret',
    imei: 'your-imei',
    totpKey: 'your-totp-key'
  };
  
  const validation = validateShoonyaCredentials(shoonyaCredentials);
  if (!validation.isValid) {
    console.error('Invalid Shoonya credentials:', validation.errors);
    return;
  }
  
  // Create broker instance
  const shoonyaBroker = factory.createBroker('shoonya');
  
  try {
    // Login
    const loginResponse = await shoonyaBroker.login(shoonyaCredentials);
    console.log('Shoonya Login:', loginResponse);
    
    if (loginResponse.success) {
      // Place an order
      const orderResponse = await shoonyaBroker.placeOrder({
        symbol: 'TCS',
        action: 'BUY',
        quantity: 1,
        orderType: 'LIMIT',
        price: 3500,
        exchange: 'NSE',
        productType: 'CNC',
        validity: 'DAY',
        accountId: shoonyaCredentials.userId
      });
      
      console.log('Order Response:', orderResponse);
      
      // Get quote
      const quote = await shoonyaBroker.getQuote('TCS', 'NSE');
      console.log('TCS Quote:', quote);
      
      // Get positions
      const positions = await shoonyaBroker.getPositions();
      console.log('Positions:', positions);
      
      // Logout
      await shoonyaBroker.logout();
    }
  } catch (error) {
    console.error('Shoonya Error:', error);
  }
}

/**
 * Example 3: Working with Fyers Broker
 */
async function fyersExample() {
  console.log('📊 Fyers Broker Example');
  
  const factory = BrokerFactory.getInstance();
  
  // Validate credentials first
  const fyersCredentials = {
    appId: 'your-app-id',
    clientId: 'your-client-id',
    secretKey: 'your-secret-key',
    redirectUri: 'https://your-redirect-url.com/callback'
  };
  
  const validation = validateFyersCredentials(fyersCredentials);
  if (!validation.isValid) {
    console.error('Invalid Fyers credentials:', validation.errors);
    return;
  }
  
  // Generate auth URL for OAuth flow
  const authUrl = generateFyersAuthUrl(
    fyersCredentials.appId, 
    fyersCredentials.redirectUri
  );
  console.log('Fyers Auth URL:', authUrl);
  
  // Create broker instance
  const fyersBroker = factory.createBroker('fyers');
  
  try {
    // For this example, assume we have an auth code from the OAuth flow
    const authCode = 'auth-code-from-oauth-callback';
    
    // Login with auth code
    const loginResponse = await fyersBroker.login({
      ...fyersCredentials,
      authCode
    });
    
    console.log('Fyers Login:', loginResponse);
    
    if (loginResponse.success) {
      // Place an order
      const orderResponse = await fyersBroker.placeOrder({
        symbol: 'TCS',
        action: 'BUY',
        quantity: 1,
        orderType: 'LIMIT',
        price: 3500,
        exchange: 'NSE',
        productType: 'CNC',
        validity: 'DAY',
        accountId: fyersCredentials.clientId
      });
      
      console.log('Order Response:', orderResponse);
      
      // Get quote
      const quote = await fyersBroker.getQuote('TCS', 'NSE');
      console.log('TCS Quote:', quote);
      
      // Logout
      await fyersBroker.logout();
    }
  } catch (error) {
    console.error('Fyers Error:', error);
  }
}

/**
 * Example 4: Multi-Broker Operations
 */
async function multiBrokerExample() {
  console.log('🔄 Multi-Broker Example');
  
  const factory = BrokerFactory.getInstance();
  const supportedBrokers = factory.getSupportedBrokers();
  
  console.log(`Working with ${supportedBrokers.length} brokers:`, supportedBrokers);
  
  // Create instances for all available brokers
  const brokers = supportedBrokers.map(brokerName => ({
    name: brokerName,
    instance: factory.createBroker(brokerName)
  }));
  
  // Example: Get quotes from all brokers (with proper authentication)
  const symbol = 'TCS';
  const exchange = 'NSE';
  
  for (const broker of brokers) {
    try {
      // Note: In real usage, you'd need to authenticate first
      console.log(`Getting quote from ${broker.name}...`);
      
      // This would fail without authentication, but shows the unified interface
      const quote = await broker.instance.getQuote(symbol, exchange);
      console.log(`${broker.name} Quote:`, quote);
    } catch (error) {
      console.log(`${broker.name} requires authentication`);
    }
  }
}

/**
 * Example 5: Error Handling and Validation
 */
async function errorHandlingExample() {
  console.log('⚠️ Error Handling Example');
  
  const factory = BrokerFactory.getInstance();
  
  try {
    // Try to create an unsupported broker
    const invalidBroker = factory.createBroker('unsupported-broker');
  } catch (error) {
    console.log('Expected error for unsupported broker:', error.message);
  }
  
  // Validate order request
  const invalidOrder = {
    symbol: '', // Invalid: empty symbol
    action: 'INVALID' as any, // Invalid action
    quantity: -1, // Invalid: negative quantity
    orderType: 'LIMIT' as any,
    exchange: 'NSE',
    productType: 'CNC',
    validity: 'DAY' as any,
    accountId: 'test'
  };
  
  const shoonyaBroker = factory.createBroker('shoonya');
  
  try {
    await shoonyaBroker.placeOrder(invalidOrder);
  } catch (error) {
    console.log('Expected validation error:', error.message);
  }
}

/**
 * Example 6: Configuration and Customization
 */
async function configurationExample() {
  console.log('⚙️ Configuration Example');
  
  // Get broker-specific configurations
  const shoonyaConfig = getShoonyaConfig();
  console.log('Shoonya Config:', shoonyaConfig);
  
  // Configure library with custom settings
  initializeBrokerCore({
    enabledBrokers: ['shoonya'], // Only enable Shoonya
    autoLoad: false, // Don't auto-load plugins
    pluginPaths: ['./custom-brokers'] // Load custom broker plugins
  });
  
  const factory = BrokerFactory.getInstance();
  console.log('Enabled Brokers:', factory.getSupportedBrokers());
}

/**
 * Main execution function
 */
async function main() {
  console.log('🎯 Unified Broker Library Examples\n');
  
  try {
    await basicSetup();
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Note: These examples require valid credentials
    // await shoonyaExample();
    // await fyersExample();
    // await multiBrokerExample();
    
    await errorHandlingExample();
    console.log('\n' + '='.repeat(50) + '\n');
    
    await configurationExample();
    
  } catch (error) {
    console.error('Example execution error:', error);
  }
}

// Run examples
if (require.main === module) {
  main();
}

export {
  basicSetup,
  shoonyaExample,
  fyersExample,
  multiBrokerExample,
  errorHandlingExample,
  configurationExample
};
