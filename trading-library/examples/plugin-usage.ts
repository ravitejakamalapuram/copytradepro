/**
 * Plugin System Usage Example
 * Demonstrates how to use the new plugin-based architecture
 */

import {
  createUnifiedTradingAPI,
  BrokerType,
  OrderType,
  OrderSide,
  ProductType,
  Exchange,
  UnifiedTradingAPI
} from '../src';

// Import broker plugins (these would be separate npm packages)
// import ShoonyaPlugin from '@copytradepro/broker-shoonya';
// import FyersPlugin from '@copytradepro/broker-fyers';

class PluginTradingBot {
  private api: UnifiedTradingAPI;

  constructor() {
    // Create API instance
    this.api = createUnifiedTradingAPI({
      enableLogging: true,
      logLevel: 'info',
      retryAttempts: 3,
      timeout: 30000
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Plugin-specific events
    this.api.on('pluginLoaded', ({ plugin, metadata }) => {
      console.log(`🔌 Plugin loaded: ${metadata.name} v${metadata.version}`);
      console.log(`   Broker: ${metadata.brokerType}`);
      console.log(`   Features: ${Object.keys(metadata.supportedFeatures).join(', ')}`);
    });

    this.api.on('pluginError', ({ plugin, error }) => {
      console.error(`❌ Plugin error:`, error.message);
    });

    this.api.on('pluginHealthCheck', ({ plugin, isHealthy }) => {
      const metadata = plugin.getMetadata();
      console.log(`🏥 Health check - ${metadata.brokerType}: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    });

    // Standard trading events
    this.api.on('brokerAuthenticated', ({ broker, profile }) => {
      console.log(`✅ ${broker} authenticated: ${profile?.userName}`);
    });

    this.api.on('orderPlaced', ({ broker, order }) => {
      console.log(`📈 Order placed on ${broker}: ${order.orderId}`);
    });

    this.api.on('orderUpdate', ({ broker, order }) => {
      console.log(`🔄 Order update from ${broker}: ${order.orderId} - ${order.status}`);
    });
  }

  async installBrokerPlugins(): Promise<void> {
    console.log('🔌 Installing broker plugins...');

    try {
      // Install Shoonya plugin
      // const shoonyaPlugin = new ShoonyaPlugin({
      //   enabled: true,
      //   autoStart: true,
      //   healthCheckInterval: 30000,
      //   logLevel: 'info'
      // });
      // await this.api.installPlugin(shoonyaPlugin);

      // Install Fyers plugin
      // const fyersPlugin = new FyersPlugin({
      //   enabled: true,
      //   autoStart: true,
      //   healthCheckInterval: 30000,
      //   logLevel: 'info'
      // });
      // await this.api.installPlugin(fyersPlugin);

      console.log('✅ All plugins installed successfully');

    } catch (error) {
      console.error('❌ Plugin installation failed:', error);
    }
  }

  async demonstratePluginCapabilities(): Promise<void> {
    console.log('\n🎯 Plugin Capabilities:');

    const registeredBrokers = this.api.getRegisteredBrokers();
    
    for (const broker of registeredBrokers) {
      try {
        const capabilities = this.api.getPluginCapabilities(broker);
        const status = this.api.getPluginStatus(broker);

        console.log(`\n📊 ${broker} Plugin:`);
        console.log(`   Status: ${status.isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
        console.log(`   Max Orders/sec: ${capabilities.maxOrdersPerSecond}`);
        console.log(`   Supported Exchanges: ${capabilities.supportedExchanges.join(', ')}`);
        console.log(`   WebSocket Support: ${capabilities.supportsWebSocket ? '✅' : '❌'}`);
        console.log(`   OAuth Required: ${capabilities.requiresOAuth ? '✅' : '❌'}`);

      } catch (error) {
        console.error(`❌ Failed to get capabilities for ${broker}:`, error);
      }
    }
  }

  async demonstratePluginBasedTrading(): Promise<void> {
    console.log('\n📈 Plugin-Based Trading Demo:');

    try {
      // Example order request
      const orderRequest = {
        symbol: 'TCS-EQ',
        exchange: Exchange.NSE,
        orderType: OrderType.LIMIT,
        side: OrderSide.BUY,
        quantity: 1,
        price: 3500,
        productType: ProductType.INTRADAY,
        validity: 'DAY' as const
      };

      // Place order on all available brokers
      const availableBrokers = this.api.getActiveBrokers();
      
      if (availableBrokers.length === 0) {
        console.log('⚠️ No active brokers available for trading');
        return;
      }

      console.log(`🎯 Placing orders on ${availableBrokers.length} broker(s)...`);

      const results = await this.api.placeOrderMultipleBrokers(
        availableBrokers,
        orderRequest
      );

      // Display results
      for (const { broker, result } of results) {
        if (result.success) {
          console.log(`✅ ${broker}: Order placed - ${result.data?.orderId}`);
        } else {
          console.log(`❌ ${broker}: Order failed - ${result.message}`);
        }
      }

    } catch (error) {
      console.error('❌ Trading demo failed:', error);
    }
  }

  async demonstratePluginManagement(): Promise<void> {
    console.log('\n🔧 Plugin Management Demo:');

    try {
      // Get library info with plugin stats
      const info = this.api.getLibraryInfo();
      console.log('📚 Library Info:');
      console.log(`   Name: ${info.name}`);
      console.log(`   Version: ${info.version}`);
      console.log(`   Plugin System: ${info.pluginSystem ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`   Registered Brokers: ${info.registeredBrokers.join(', ')}`);
      console.log(`   Active Brokers: ${info.activeBrokers.join(', ')}`);
      
      if (info.pluginStats) {
        console.log(`   Plugin Stats:`);
        console.log(`     Total: ${info.pluginStats.totalPlugins}`);
        console.log(`     Healthy: ${info.pluginStats.healthyPlugins}`);
        console.log(`     Unhealthy: ${info.pluginStats.unhealthyPlugins}`);
      }

    } catch (error) {
      console.error('❌ Plugin management demo failed:', error);
    }
  }

  async demonstratePluginMarketplace(): Promise<void> {
    console.log('\n🏪 Plugin Marketplace Concept:');
    
    // This demonstrates the future plugin marketplace concept
    const availablePlugins = [
      {
        name: '@copytradepro/broker-shoonya',
        version: '1.0.0',
        price: '$29/month',
        features: ['TOTP Auth', 'Real-time Data', 'Options Trading'],
        rating: 4.8,
        downloads: 1250
      },
      {
        name: '@copytradepro/broker-fyers',
        version: '1.0.0', 
        price: '$29/month',
        features: ['OAuth Auth', 'WebSocket', 'Margin Trading'],
        rating: 4.6,
        downloads: 980
      },
      {
        name: '@copytradepro/broker-zerodha',
        version: '1.0.0',
        price: '$39/month',
        features: ['KiteConnect API', 'Historical Data', 'Algo Trading'],
        rating: 4.9,
        downloads: 2100
      }
    ];

    console.log('🔌 Available Broker Plugins:');
    availablePlugins.forEach(plugin => {
      console.log(`\n📦 ${plugin.name}`);
      console.log(`   Version: ${plugin.version}`);
      console.log(`   Price: ${plugin.price}`);
      console.log(`   Rating: ${'⭐'.repeat(Math.floor(plugin.rating))} (${plugin.rating})`);
      console.log(`   Downloads: ${plugin.downloads.toLocaleString()}`);
      console.log(`   Features: ${plugin.features.join(', ')}`);
    });

    console.log('\n💡 Installation would be as simple as:');
    console.log('   npm install @copytradepro/broker-shoonya');
    console.log('   import ShoonyaPlugin from "@copytradepro/broker-shoonya";');
    console.log('   await api.installPlugin(new ShoonyaPlugin());');
  }

  async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    await this.api.destroy();
  }
}

// Example usage
async function main() {
  const bot = new PluginTradingBot();

  try {
    // Install plugins
    await bot.installBrokerPlugins();

    // Demonstrate capabilities
    await bot.demonstratePluginCapabilities();

    // Demonstrate plugin management
    await bot.demonstratePluginManagement();

    // Demonstrate marketplace concept
    await bot.demonstratePluginMarketplace();

    // Demonstrate trading (if brokers are authenticated)
    // await bot.demonstratePluginBasedTrading();

    console.log('\n🎉 Plugin system demonstration complete!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await bot.cleanup();
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { PluginTradingBot };
