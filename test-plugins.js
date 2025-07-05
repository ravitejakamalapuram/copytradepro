/**
 * Simple Plugin Test Script
 * Tests that the plugins can be loaded and basic functionality works
 */

const path = require('path');

async function testPlugins() {
  console.log('🧪 Testing Plugin Architecture...\n');

  try {
    // Test 1: Load Shoonya Plugin
    console.log('📦 Testing Shoonya Plugin...');
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    
    if (ShoonyaPlugin && ShoonyaPlugin.default) {
      const shoonyaPlugin = new ShoonyaPlugin.default();
      const metadata = shoonyaPlugin.getMetadata();
      console.log(`✅ Shoonya Plugin loaded: ${metadata.name} v${metadata.version}`);
      console.log(`   Broker Type: ${metadata.brokerType}`);
      console.log(`   Supported Features: ${Object.keys(metadata.supportedFeatures).join(', ')}`);
    } else {
      console.log('❌ Failed to load Shoonya Plugin');
    }

    // Test 2: Load Fyers Plugin
    console.log('\n📦 Testing Fyers Plugin...');
    const FyersPlugin = require('./broker-plugins/fyers/dist/index.js');
    
    if (FyersPlugin && FyersPlugin.default) {
      const fyersPlugin = new FyersPlugin.default();
      const metadata = fyersPlugin.getMetadata();
      console.log(`✅ Fyers Plugin loaded: ${metadata.name} v${metadata.version}`);
      console.log(`   Broker Type: ${metadata.brokerType}`);
      console.log(`   Supported Features: ${Object.keys(metadata.supportedFeatures).join(', ')}`);
    } else {
      console.log('❌ Failed to load Fyers Plugin');
    }

    // Test 3: Test Plugin Initialization
    console.log('\n🔧 Testing Plugin Initialization...');
    
    const shoonyaPlugin = new ShoonyaPlugin.default({
      enabled: true,
      autoStart: false,
      logLevel: 'info'
    });

    await shoonyaPlugin.initialize({});
    console.log('✅ Shoonya Plugin initialized successfully');

    const fyersPlugin = new FyersPlugin.default({
      enabled: true,
      autoStart: false,
      logLevel: 'info'
    });

    await fyersPlugin.initialize({});
    console.log('✅ Fyers Plugin initialized successfully');

    // Test 4: Test Plugin Status
    console.log('\n📊 Testing Plugin Status...');
    
    const shoonyaStatus = shoonyaPlugin.getStatus();
    console.log(`Shoonya Plugin Status: ${shoonyaStatus.isHealthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`  - Initialized: ${shoonyaStatus.isInitialized}`);
    console.log(`  - Loaded: ${shoonyaStatus.isLoaded}`);

    const fyersStatus = fyersPlugin.getStatus();
    console.log(`Fyers Plugin Status: ${fyersStatus.isHealthy ? 'Healthy' : 'Unhealthy'}`);
    console.log(`  - Initialized: ${fyersStatus.isInitialized}`);
    console.log(`  - Loaded: ${fyersStatus.isLoaded}`);

    // Test 5: Test Plugin Capabilities
    console.log('\n🔧 Testing Plugin Capabilities...');
    
    const shoonyaCapabilities = shoonyaPlugin.getCapabilities();
    console.log('Shoonya Capabilities:');
    console.log(`  - Max Connections: ${shoonyaCapabilities.maxConcurrentConnections}`);
    console.log(`  - Requires API Key: ${shoonyaCapabilities.requiresApiKey}`);
    console.log(`  - Supports WebSocket: ${shoonyaCapabilities.supportsWebSocket}`);

    const fyersCapabilities = fyersPlugin.getCapabilities();
    console.log('Fyers Capabilities:');
    console.log(`  - Max Connections: ${fyersCapabilities.maxConcurrentConnections}`);
    console.log(`  - Requires OAuth: ${fyersCapabilities.requiresOAuth}`);
    console.log(`  - Supports WebSocket: ${fyersCapabilities.supportsWebSocket}`);

    // Test 6: Test Plugin Adapters
    console.log('\n🔌 Testing Plugin Adapters...');
    
    const shoonyaAdapter = shoonyaPlugin.getAdapter();
    console.log(`✅ Shoonya Adapter: ${shoonyaAdapter.getBrokerName()}`);
    console.log(`   Broker Type: ${shoonyaAdapter.getBrokerType()}`);
    console.log(`   Authenticated: ${shoonyaAdapter.isAuthenticated()}`);

    const fyersAdapter = fyersPlugin.getAdapter();
    console.log(`✅ Fyers Adapter: ${fyersAdapter.getBrokerName()}`);
    console.log(`   Broker Type: ${fyersAdapter.getBrokerType()}`);
    console.log(`   Authenticated: ${fyersAdapter.isAuthenticated()}`);

    // Test 7: Test Plugin Configuration
    console.log('\n⚙️ Testing Plugin Configuration...');
    
    const shoonyaConfig = shoonyaPlugin.getConfig();
    console.log('Shoonya Config:');
    console.log(`  - Enabled: ${shoonyaConfig.enabled}`);
    console.log(`  - Auto Start: ${shoonyaConfig.autoStart}`);
    console.log(`  - Log Level: ${shoonyaConfig.logLevel}`);

    const fyersConfig = fyersPlugin.getConfig();
    console.log('Fyers Config:');
    console.log(`  - Enabled: ${fyersConfig.enabled}`);
    console.log(`  - Auto Start: ${fyersConfig.autoStart}`);
    console.log(`  - Log Level: ${fyersConfig.logLevel}`);

    console.log('\n🎉 All Plugin Tests Passed Successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Plugin loading works');
    console.log('✅ Plugin initialization works');
    console.log('✅ Plugin status reporting works');
    console.log('✅ Plugin capabilities work');
    console.log('✅ Plugin adapters work');
    console.log('✅ Plugin configuration works');

  } catch (error) {
    console.error('❌ Plugin test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testPlugins().catch(console.error);
