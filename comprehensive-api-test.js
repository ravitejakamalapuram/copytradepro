/**
 * Comprehensive API Test Suite
 * Tests all plugin APIs thoroughly to ensure everything works before cleanup
 */

const path = require('path');

// Test configuration
const TEST_CONFIG = {
  timeout: 30000,
  retries: 3,
  verbose: true
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  };
  
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

function assert(condition, message) {
  if (condition) {
    testResults.passed++;
    log(`✅ PASS: ${message}`, 'success');
    return true;
  } else {
    testResults.failed++;
    const error = `❌ FAIL: ${message}`;
    log(error, 'error');
    testResults.errors.push(error);
    return false;
  }
}

function skip(message) {
  testResults.skipped++;
  log(`⏭️  SKIP: ${message}`, 'warning');
}

async function runTest(testName, testFunction) {
  log(`🧪 Running test: ${testName}`, 'info');
  try {
    await testFunction();
  } catch (error) {
    testResults.failed++;
    const errorMsg = `❌ ERROR in ${testName}: ${error.message}`;
    log(errorMsg, 'error');
    testResults.errors.push(errorMsg);
  }
}

// Main test suite
async function runComprehensiveTests() {
  log('🚀 Starting Comprehensive API Test Suite', 'info');
  log('=' .repeat(60), 'info');

  // Test 1: Plugin Loading and Basic Functionality
  await runTest('Plugin Loading', async () => {
    log('Testing plugin loading...', 'info');
    
    // Load Shoonya Plugin
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    assert(ShoonyaPlugin && ShoonyaPlugin.default, 'Shoonya plugin module loads');
    
    const shoonyaPlugin = new ShoonyaPlugin.default();
    assert(shoonyaPlugin, 'Shoonya plugin instance created');
    
    // Load Fyers Plugin
    const FyersPlugin = require('./broker-plugins/fyers/dist/index.js');
    assert(FyersPlugin && FyersPlugin.default, 'Fyers plugin module loads');
    
    const fyersPlugin = new FyersPlugin.default();
    assert(fyersPlugin, 'Fyers plugin instance created');
    
    log('Plugin loading tests completed', 'success');
  });

  // Test 2: Plugin Metadata and Configuration
  await runTest('Plugin Metadata', async () => {
    log('Testing plugin metadata...', 'info');
    
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    const shoonyaPlugin = new ShoonyaPlugin.default();
    
    const metadata = shoonyaPlugin.getMetadata();
    assert(metadata.name, 'Shoonya plugin has name');
    assert(metadata.version, 'Shoonya plugin has version');
    assert(metadata.brokerType === 'shoonya', 'Shoonya plugin has correct broker type');
    assert(metadata.supportedFeatures, 'Shoonya plugin has supported features');
    
    const FyersPlugin = require('./broker-plugins/fyers/dist/index.js');
    const fyersPlugin = new FyersPlugin.default();
    
    const fyersMetadata = fyersPlugin.getMetadata();
    assert(fyersMetadata.name, 'Fyers plugin has name');
    assert(fyersMetadata.version, 'Fyers plugin has version');
    assert(fyersMetadata.brokerType === 'fyers', 'Fyers plugin has correct broker type');
    
    log('Plugin metadata tests completed', 'success');
  });

  // Test 3: Plugin Initialization
  await runTest('Plugin Initialization', async () => {
    log('Testing plugin initialization...', 'info');
    
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    const shoonyaPlugin = new ShoonyaPlugin.default({
      enabled: true,
      autoStart: false,
      logLevel: 'info'
    });
    
    await shoonyaPlugin.initialize({});
    const status = shoonyaPlugin.getStatus();
    assert(status.isInitialized, 'Shoonya plugin initializes successfully');
    assert(status.isLoaded, 'Shoonya plugin is loaded');
    
    const FyersPlugin = require('./broker-plugins/fyers/dist/index.js');
    const fyersPlugin = new FyersPlugin.default({
      enabled: true,
      autoStart: false,
      logLevel: 'info'
    });
    
    await fyersPlugin.initialize({});
    const fyersStatus = fyersPlugin.getStatus();
    assert(fyersStatus.isInitialized, 'Fyers plugin initializes successfully');
    
    log('Plugin initialization tests completed', 'success');
  });

  // Test 4: Plugin Adapters
  await runTest('Plugin Adapters', async () => {
    log('Testing plugin adapters...', 'info');
    
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    const shoonyaPlugin = new ShoonyaPlugin.default();
    await shoonyaPlugin.initialize({});
    
    const adapter = shoonyaPlugin.getAdapter();
    assert(adapter, 'Shoonya adapter is available');
    assert(adapter.getBrokerType() === 'shoonya', 'Shoonya adapter has correct broker type');
    assert(adapter.getBrokerName(), 'Shoonya adapter has broker name');
    assert(typeof adapter.isAuthenticated === 'function', 'Shoonya adapter has isAuthenticated method');
    
    const FyersPlugin = require('./broker-plugins/fyers/dist/index.js');
    const fyersPlugin = new FyersPlugin.default();
    await fyersPlugin.initialize({});
    
    const fyersAdapter = fyersPlugin.getAdapter();
    assert(fyersAdapter, 'Fyers adapter is available');
    assert(fyersAdapter.getBrokerType() === 'fyers', 'Fyers adapter has correct broker type');
    
    log('Plugin adapter tests completed', 'success');
  });

  // Test 5: Plugin Capabilities
  await runTest('Plugin Capabilities', async () => {
    log('Testing plugin capabilities...', 'info');
    
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    const shoonyaPlugin = new ShoonyaPlugin.default();
    
    const capabilities = shoonyaPlugin.getCapabilities();
    assert(capabilities, 'Shoonya plugin has capabilities');
    assert(typeof capabilities.maxConcurrentConnections === 'number', 'Has max connections');
    assert(Array.isArray(capabilities.supportedOrderTypes), 'Has supported order types');
    assert(capabilities.requiresApiKey === true, 'Correctly identifies API key requirement');
    
    const FyersPlugin = require('./broker-plugins/fyers/dist/index.js');
    const fyersPlugin = new FyersPlugin.default();
    
    const fyersCapabilities = fyersPlugin.getCapabilities();
    assert(fyersCapabilities.requiresOAuth === true, 'Fyers correctly identifies OAuth requirement');
    
    log('Plugin capabilities tests completed', 'success');
  });

  // Test 6: Plugin Health and Metrics
  await runTest('Plugin Health and Metrics', async () => {
    log('Testing plugin health and metrics...', 'info');
    
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    const shoonyaPlugin = new ShoonyaPlugin.default();
    await shoonyaPlugin.initialize({});
    
    const health = await shoonyaPlugin.performHealthCheck();
    assert(typeof health === 'boolean', 'Health check returns boolean');
    
    const metrics = shoonyaPlugin.getMetrics();
    assert(metrics, 'Plugin has metrics');
    assert(typeof metrics.requestCount === 'number', 'Has request count');
    assert(typeof metrics.errorCount === 'number', 'Has error count');
    assert(typeof metrics.uptime === 'number', 'Has uptime');
    
    log('Plugin health and metrics tests completed', 'success');
  });

  // Test 7: Plugin Configuration Management
  await runTest('Plugin Configuration', async () => {
    log('Testing plugin configuration...', 'info');
    
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    const shoonyaPlugin = new ShoonyaPlugin.default({
      enabled: true,
      logLevel: 'debug'
    });
    
    const config = shoonyaPlugin.getConfig();
    assert(config.enabled === true, 'Configuration is set correctly');
    assert(config.logLevel === 'debug', 'Log level is set correctly');
    
    shoonyaPlugin.updateConfig({ logLevel: 'info' });
    const updatedConfig = shoonyaPlugin.getConfig();
    assert(updatedConfig.logLevel === 'info', 'Configuration updates correctly');
    
    log('Plugin configuration tests completed', 'success');
  });

  // Test 8: Plugin Lifecycle Management
  await runTest('Plugin Lifecycle', async () => {
    log('Testing plugin lifecycle...', 'info');
    
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    const shoonyaPlugin = new ShoonyaPlugin.default();
    
    await shoonyaPlugin.initialize({});
    assert(shoonyaPlugin.getStatus().isInitialized, 'Plugin initializes');
    
    await shoonyaPlugin.start();
    assert(shoonyaPlugin.isHealthy(), 'Plugin starts successfully');
    
    await shoonyaPlugin.stop();
    // Note: Plugin might still be healthy after stop, depending on implementation
    
    await shoonyaPlugin.restart();
    assert(shoonyaPlugin.isHealthy(), 'Plugin restarts successfully');
    
    log('Plugin lifecycle tests completed', 'success');
  });

  // Test 9: Error Handling
  await runTest('Error Handling', async () => {
    log('Testing error handling...', 'info');
    
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    const shoonyaPlugin = new ShoonyaPlugin.default();
    
    // Test invalid configuration
    const validation = shoonyaPlugin.validateConfig(null);
    assert(!validation.isValid, 'Invalid config is rejected');
    assert(Array.isArray(validation.errors), 'Validation returns errors array');
    
    // Test dependency validation
    const depValidation = shoonyaPlugin.validateDependencies();
    assert(typeof depValidation.isValid === 'boolean', 'Dependency validation works');
    
    log('Error handling tests completed', 'success');
  });

  // Test 10: Plugin Export/Import
  await runTest('Plugin Export/Import', async () => {
    log('Testing plugin export/import...', 'info');
    
    const ShoonyaPlugin = require('./broker-plugins/shoonya/dist/index.js');
    const shoonyaPlugin = new ShoonyaPlugin.default({
      enabled: true,
      logLevel: 'info'
    });
    
    const exported = shoonyaPlugin.exportConfig();
    assert(typeof exported === 'string', 'Config exports as string');
    
    const imported = shoonyaPlugin.importConfig(exported);
    assert(typeof imported === 'boolean', 'Config import returns boolean');
    
    log('Plugin export/import tests completed', 'success');
  });

  // Test Summary
  log('=' .repeat(60), 'info');
  log('🏁 Test Suite Completed', 'info');
  log(`✅ Passed: ${testResults.passed}`, 'success');
  log(`❌ Failed: ${testResults.failed}`, testResults.failed > 0 ? 'error' : 'info');
  log(`⏭️  Skipped: ${testResults.skipped}`, 'warning');
  
  if (testResults.errors.length > 0) {
    log('\n📋 Error Summary:', 'error');
    testResults.errors.forEach(error => log(error, 'error'));
  }
  
  const totalTests = testResults.passed + testResults.failed + testResults.skipped;
  const successRate = totalTests > 0 ? (testResults.passed / totalTests * 100).toFixed(2) : 0;
  log(`\n📊 Success Rate: ${successRate}%`, successRate >= 90 ? 'success' : 'warning');
  
  return testResults.failed === 0;
}

// Export for use in other files
module.exports = { runComprehensiveTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runComprehensiveTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test suite failed:', error);
      process.exit(1);
    });
}
