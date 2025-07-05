# 🔄 Plugin Migration Guide

**Complete guide for migrating from monolithic broker integration to plugin-based architecture**

## 📋 Overview

This guide helps you migrate from the old monolithic broker integration to the new plugin-based architecture. The new system offers better modularity, easier maintenance, and granular pricing options.

## 🆚 Before vs After

### **Before (Monolithic)**
```typescript
import { UnifiedTradingAPI, createShoonyaCredentials } from '@copytradepro/unified-trading-api';

const api = new UnifiedTradingAPI();
// All brokers bundled together
await api.authenticateBroker('shoonya', credentials);
```

### **After (Plugin-Based)**
```typescript
import { UnifiedTradingAPI } from '@copytradepro/unified-trading-api';
import ShoonyaPlugin from '@copytradepro/broker-shoonya';
import FyersPlugin from '@copytradepro/broker-fyers';

const api = new UnifiedTradingAPI();

// Install only the plugins you need
await api.installPlugin(new ShoonyaPlugin());
await api.installPlugin(new FyersPlugin());

await api.authenticateBroker('shoonya', credentials);
```

## 🚀 Migration Steps

### **Step 1: Update Dependencies**

#### Remove Old Dependencies
```bash
npm uninstall @copytradepro/unified-trading-api
```

#### Install New Core + Plugins
```bash
# Core library (required)
npm install @copytradepro/unified-trading-api@2.0.0

# Install only the broker plugins you need
npm install @copytradepro/broker-shoonya
npm install @copytradepro/broker-fyers
```

### **Step 2: Update Imports**

#### Old Import Style
```typescript
import { 
  UnifiedTradingAPI, 
  ShoonyaAdapter, 
  FyersAdapter,
  createShoonyaCredentials 
} from '@copytradepro/unified-trading-api';
```

#### New Import Style
```typescript
// Core library
import { UnifiedTradingAPI } from '@copytradepro/unified-trading-api';

// Individual broker plugins
import ShoonyaPlugin from '@copytradepro/broker-shoonya';
import FyersPlugin from '@copytradepro/broker-fyers';
```

### **Step 3: Update Initialization Code**

#### Old Initialization
```typescript
const api = new UnifiedTradingAPI({
  brokers: ['shoonya', 'fyers'],
  enableLogging: true
});

// Brokers were automatically available
await api.authenticateBroker('shoonya', credentials);
```

#### New Initialization
```typescript
const api = new UnifiedTradingAPI({
  enableLogging: true,
  logLevel: 'info'
});

// Install plugins explicitly
const shoonyaPlugin = new ShoonyaPlugin({
  enabled: true,
  autoStart: true,
  logLevel: 'info'
});

const fyersPlugin = new FyersPlugin({
  enabled: true,
  autoStart: true,
  logLevel: 'info'
});

await api.installPlugin(shoonyaPlugin);
await api.installPlugin(fyersPlugin);

// Now you can authenticate
await api.authenticateBroker('shoonya', credentials);
```

### **Step 4: Update Configuration**

#### Old Configuration
```typescript
const config = {
  brokers: ['shoonya', 'fyers'],
  enableLogging: true,
  logLevel: 'info',
  retryAttempts: 3,
  timeout: 30000
};
```

#### New Configuration
```typescript
// Core API configuration
const apiConfig = {
  enableLogging: true,
  logLevel: 'info',
  retryAttempts: 3,
  timeout: 30000
};

// Plugin-specific configurations
const shoonyaConfig = {
  enabled: true,
  autoStart: true,
  healthCheckInterval: 30000,
  maxRetries: 3,
  timeout: 30000,
  logLevel: 'info',
  customSettings: {
    enableOrderValidation: true,
    maxOrderValue: 1000000
  }
};

const fyersConfig = {
  enabled: true,
  autoStart: true,
  healthCheckInterval: 30000,
  maxRetries: 3,
  timeout: 30000,
  logLevel: 'info',
  customSettings: {
    enableTokenRefresh: true,
    maxOrderValue: 5000000
  }
};
```

## 🔧 Code Migration Examples

### **Authentication Migration**

#### Before
```typescript
import { createShoonyaCredentials, createFyersCredentials } from '@copytradepro/unified-trading-api';

const shoonyaCredentials = createShoonyaCredentials(
  'FN123456', 'password', 'FN123456_U', 'apikey', 'imei', 'totpsecret'
);

await api.authenticateBroker('shoonya', shoonyaCredentials);
```

#### After
```typescript
// Credentials are now plain objects
const shoonyaCredentials = {
  userId: 'FN123456',
  password: 'password',
  vendorCode: 'FN123456_U',
  apiKey: 'apikey',
  imei: 'imei',
  totpSecret: 'totpsecret'
};

await api.authenticateBroker('shoonya', shoonyaCredentials);
```

### **Order Placement Migration**

#### Before
```typescript
const result = await api.placeOrder('shoonya', {
  symbol: 'TCS-EQ',
  exchange: 'NSE',
  orderType: 'MARKET',
  side: 'BUY',
  quantity: 1,
  productType: 'INTRADAY'
});
```

#### After
```typescript
// Same API - no changes needed!
const result = await api.placeOrder('shoonya', {
  symbol: 'TCS-EQ',
  exchange: 'NSE',
  orderType: 'MARKET',
  side: 'BUY',
  quantity: 1,
  productType: 'INTRADAY'
});
```

### **Event Handling Migration**

#### Before
```typescript
api.on('orderUpdate', (order) => {
  console.log('Order update:', order);
});

api.on('quoteUpdate', (quote) => {
  console.log('Quote update:', quote);
});
```

#### After
```typescript
// Plugin-specific event handling
shoonyaPlugin.onOrderUpdate((order) => {
  console.log('Shoonya order update:', order);
});

fyersPlugin.onQuoteUpdate((quote) => {
  console.log('Fyers quote update:', quote);
});

// Or use the unified API (same as before)
api.on('orderUpdate', (order) => {
  console.log('Order update:', order);
});
```

## 🏥 Health Monitoring

### **New Plugin Health Features**

```typescript
// Check plugin health
const plugins = api.getInstalledPlugins();

plugins.forEach(plugin => {
  const status = plugin.getStatus();
  const metrics = plugin.getMetrics();
  
  console.log(`Plugin: ${plugin.getMetadata().name}`);
  console.log(`Health: ${status.isHealthy ? 'Healthy' : 'Unhealthy'}`);
  console.log(`Requests: ${metrics.requestCount}`);
  console.log(`Errors: ${metrics.errorCount}`);
  console.log(`Uptime: ${Math.round(metrics.uptime / 1000)}s`);
});
```

### **Plugin Capabilities**

```typescript
// Check what each plugin supports
plugins.forEach(plugin => {
  const capabilities = plugin.getCapabilities();
  const metadata = plugin.getMetadata();
  
  console.log(`${metadata.name} capabilities:`);
  console.log(`- Max Connections: ${capabilities.maxConcurrentConnections}`);
  console.log(`- Real-time Data: ${capabilities.realTimeData}`);
  console.log(`- Options Trading: ${capabilities.optionsTrading}`);
  console.log(`- Supported Exchanges: ${capabilities.exchanges?.join(', ')}`);
});
```

## 💰 Pricing Migration

### **Old Pricing (Bundled)**
- Single package: $299/month
- All brokers included
- No granular control

### **New Pricing (Plugin-Based)**
```
Core Library: $99/month
├── Plugin Management System
├── Unified Interfaces  
├── Event System
└── Health Monitoring

Individual Plugins:
├── @copytradepro/broker-shoonya: $29/month
├── @copytradepro/broker-fyers: $29/month
├── @copytradepro/broker-zerodha: $39/month (coming soon)
└── @copytradepro/broker-angel: $29/month (coming soon)

Bundle Options:
├── Starter (Core + 2 plugins): $149/month
├── Professional (Core + 5 plugins): $299/month
└── Enterprise (Core + unlimited): $999/month
```

## 🧪 Testing Your Migration

### **1. Create a Test Script**

```typescript
// test-migration.ts
import { UnifiedTradingAPI } from '@copytradepro/unified-trading-api';
import ShoonyaPlugin from '@copytradepro/broker-shoonya';

async function testMigration() {
  const api = new UnifiedTradingAPI();
  const plugin = new ShoonyaPlugin();
  
  await api.installPlugin(plugin);
  
  // Test authentication
  const authResult = await api.authenticateBroker('shoonya', {
    userId: 'test',
    password: 'test',
    vendorCode: 'test',
    apiKey: 'test',
    imei: 'test'
  });
  
  console.log('Migration test:', authResult.success ? 'PASSED' : 'FAILED');
}

testMigration().catch(console.error);
```

### **2. Run Tests**

```bash
# Install dependencies
npm install

# Run your test
npx ts-node test-migration.ts

# Run existing tests
npm test
```

## 🚨 Common Migration Issues

### **Issue 1: Import Errors**
```
Error: Cannot find module '@copytradepro/broker-shoonya'
```

**Solution:**
```bash
npm install @copytradepro/broker-shoonya
```

### **Issue 2: Plugin Not Found**
```
Error: Plugin for broker 'shoonya' not found
```

**Solution:**
```typescript
// Make sure to install the plugin first
await api.installPlugin(new ShoonyaPlugin());
// Then authenticate
await api.authenticateBroker('shoonya', credentials);
```

### **Issue 3: Configuration Errors**
```
Error: Invalid plugin configuration
```

**Solution:**
```typescript
// Use proper plugin configuration
const plugin = new ShoonyaPlugin({
  enabled: true,
  autoStart: true,
  logLevel: 'info'
});
```

## 📚 Additional Resources

- 📖 [Plugin API Documentation](https://docs.copytradepro.com/plugins)
- 🎥 [Migration Video Tutorial](https://youtube.com/copytradepro)
- 💬 [Discord Support](https://discord.gg/copytradepro)
- 📧 [Email Support](mailto:support@copytradepro.com)

## 🎯 Migration Checklist

- [ ] Update package.json dependencies
- [ ] Update import statements
- [ ] Update initialization code
- [ ] Update configuration objects
- [ ] Test authentication flows
- [ ] Test order placement
- [ ] Test event handling
- [ ] Test error scenarios
- [ ] Update deployment scripts
- [ ] Update documentation

## 🎉 Benefits After Migration

✅ **Modular Architecture** - Install only what you need
✅ **Better Performance** - Smaller bundle sizes
✅ **Easier Maintenance** - Independent plugin updates
✅ **Granular Pricing** - Pay only for used brokers
✅ **Better Monitoring** - Plugin-level health checks
✅ **Faster Development** - Parallel plugin development
✅ **Better Testing** - Isolated plugin testing

---

**Need help with migration?** Contact our support team at support@copytradepro.com
