/**
 * Plugin Integration Example
 * Demonstrates how to use the new plugin-based architecture
 */

import { UnifiedTradingAPI, PluginManager } from './trading-library/src';
import { BrokerType } from './trading-library/src/types';

// Import the plugin packages (these would be npm packages in production)
import ShoonyaPlugin from './broker-plugins/shoonya/dist';
import FyersPlugin from './broker-plugins/fyers/dist';

async function demonstratePluginIntegration() {
  console.log('🚀 Starting Plugin Integration Demo...\n');

  // 1. Create the Unified Trading API instance
  const api = new UnifiedTradingAPI({
    enableLogging: true,
    logLevel: 'info',
    retryAttempts: 3,
    timeout: 30000
  });

  console.log('✅ Created UnifiedTradingAPI instance');

  // 2. Install Shoonya Plugin
  console.log('\n📦 Installing Shoonya Plugin...');
  const shoonyaPlugin = new ShoonyaPlugin({
    enabled: true,
    autoStart: true,
    healthCheckInterval: 30000,
    logLevel: 'info'
  });

  await api.installPlugin(shoonyaPlugin);
  console.log('✅ Shoonya Plugin installed successfully');

  // 3. Install Fyers Plugin
  console.log('\n📦 Installing Fyers Plugin...');
  const fyersPlugin = new FyersPlugin({
    enabled: true,
    autoStart: true,
    healthCheckInterval: 30000,
    logLevel: 'info'
  });

  await api.installPlugin(fyersPlugin);
  console.log('✅ Fyers Plugin installed successfully');

  // 4. List installed plugins
  console.log('\n📋 Installed Plugins:');
  const plugins = api.getInstalledPlugins();
  plugins.forEach(plugin => {
    const metadata = plugin.getMetadata();
    console.log(`  - ${metadata.name} v${metadata.version} (${metadata.brokerType})`);
  });

  // 5. Authenticate with Shoonya
  console.log('\n🔐 Authenticating with Shoonya...');
  try {
    const shoonyaResult = await api.authenticateBroker(BrokerType.SHOONYA, {
      userId: 'FN135006',
      password: 'rAVI@1994',
      vendorCode: 'FN135006_U',
      apiKey: '2d73a28f0c56e3a3f41cf95a690c3cc2',
      imei: 'abc1234',
      totpSecret: 'P4325AWTC4E66D57E3A547H567A5T3GF'
    });

    if (shoonyaResult.success) {
      console.log('✅ Shoonya authentication successful');
    } else {
      console.log('❌ Shoonya authentication failed:', shoonyaResult.message);
    }
  } catch (error) {
    console.log('❌ Shoonya authentication error:', error.message);
  }

  // 6. Authenticate with Fyers
  console.log('\n🔐 Authenticating with Fyers...');
  try {
    const fyersResult = await api.authenticateBroker(BrokerType.FYERS, {
      clientId: 'YZ7RCOVDOX-100',
      secretKey: '5BGXZUV1Z6',
      redirectUri: 'https://www.urlencoder.org/',
      // authCode would be obtained from OAuth flow
    });

    if (fyersResult.success) {
      console.log('✅ Fyers authentication successful');
      if (fyersResult.authUrl) {
        console.log('🔗 Auth URL:', fyersResult.authUrl);
      }
    } else {
      console.log('❌ Fyers authentication failed:', fyersResult.message);
    }
  } catch (error) {
    console.log('❌ Fyers authentication error:', error.message);
  }

  // 7. Get plugin health status
  console.log('\n🏥 Plugin Health Status:');
  plugins.forEach(plugin => {
    const status = plugin.getStatus();
    const metadata = plugin.getMetadata();
    console.log(`  - ${metadata.name}: ${status.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    if (!status.isHealthy && status.lastError) {
      console.log(`    Error: ${status.lastError.message}`);
    }
  });

  // 8. Demonstrate order placement (mock)
  console.log('\n📈 Demonstrating Order Placement...');
  try {
    // This would work if authentication was successful
    const orderResult = await api.placeOrder(BrokerType.SHOONYA, {
      symbol: 'TCS-EQ',
      exchange: 'NSE',
      orderType: 'MARKET',
      side: 'BUY',
      quantity: 1,
      productType: 'INTRADAY'
    });

    if (orderResult.success) {
      console.log('✅ Order placed successfully:', orderResult.data?.orderId);
    } else {
      console.log('❌ Order placement failed:', orderResult.message);
    }
  } catch (error) {
    console.log('❌ Order placement error:', error.message);
  }

  // 9. Get plugin metrics
  console.log('\n📊 Plugin Metrics:');
  plugins.forEach(plugin => {
    const metrics = plugin.getMetrics();
    const metadata = plugin.getMetadata();
    console.log(`  - ${metadata.name}:`);
    console.log(`    Requests: ${metrics.requestCount}`);
    console.log(`    Errors: ${metrics.errorCount}`);
    console.log(`    Uptime: ${Math.round(metrics.uptime / 1000)}s`);
  });

  // 10. Plugin capabilities
  console.log('\n🔧 Plugin Capabilities:');
  plugins.forEach(plugin => {
    const capabilities = plugin.getCapabilities();
    const metadata = plugin.getMetadata();
    console.log(`  - ${metadata.name}:`);
    console.log(`    Max Connections: ${capabilities.maxConcurrentConnections}`);
    console.log(`    Supported Exchanges: ${capabilities.supportedExchanges?.join(', ')}`);
    console.log(`    Real-time Data: ${capabilities.realTimeData ? '✅' : '❌'}`);
    console.log(`    Options Trading: ${capabilities.optionsTrading ? '✅' : '❌'}`);
  });

  console.log('\n🎉 Plugin Integration Demo Complete!');
}

// Export for use in other files
export { demonstratePluginIntegration };

// Run demo if this file is executed directly
if (require.main === module) {
  demonstratePluginIntegration().catch(console.error);
}
