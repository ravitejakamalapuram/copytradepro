# 🏦 Shoonya Broker Plugin

**Official Finvasia Shoonya broker plugin for Unified Trading API**

[![npm version](https://badge.fury.io/js/%40copytradepro%2Fbroker-shoonya.svg)](https://badge.fury.io/js/%40copytradepro%2Fbroker-shoonya)
[![License: Commercial](https://img.shields.io/badge/License-Commercial-red.svg)](LICENSE)

## 🎯 **Overview**

This plugin provides seamless integration with Finvasia Shoonya broker through the Unified Trading API. It supports all major trading operations including order placement, portfolio management, and real-time market data.

## 🚀 **Features**

### **✅ Authentication**
- **TOTP Support** - Automatic TOTP generation
- **API Key Authentication** - Secure API key management
- **Session Management** - Persistent login sessions
- **Auto-Reactivation** - Automatic session renewal

### **📈 Trading Operations**
- **Order Placement** - Market, Limit, Stop-Loss orders
- **Order Management** - Modify, cancel, track orders
- **Multi-Exchange** - NSE, BSE, NFO, BFO support
- **Product Types** - Delivery, Intraday, Margin trading

### **💼 Portfolio Management**
- **Real-time Positions** - Live P&L tracking
- **Holdings Management** - Long-term investments
- **Balance Monitoring** - Cash and margin tracking
- **Risk Management** - Position limits and controls

### **📊 Market Data**
- **Real-time Quotes** - Live price updates
- **Market Depth** - Level 2 order book data
- **WebSocket Streaming** - High-frequency data
- **Historical Data** - OHLC and tick data

## 📦 **Installation**

```bash
# Install core library
npm install @copytradepro/unified-trading-api

# Install Shoonya plugin
npm install @copytradepro/broker-shoonya
```

## 🔧 **Quick Start**

```typescript
import { UnifiedTradingAPI } from '@copytradepro/unified-trading-api';
import ShoonyaPlugin from '@copytradepro/broker-shoonya';

// Create API instance
const api = new UnifiedTradingAPI({
  enableLogging: true,
  logLevel: 'info'
});

// Install Shoonya plugin
const shoonyaPlugin = new ShoonyaPlugin({
  enabled: true,
  autoStart: true,
  logLevel: 'info'
});

await api.installPlugin(shoonyaPlugin);

// Authenticate
await api.authenticateBroker(BrokerType.SHOONYA, {
  userId: 'your_user_id',
  password: 'your_password',
  vendorCode: 'your_vendor_code',
  apiKey: 'your_api_key',
  imei: 'your_imei',
  totpSecret: 'your_totp_secret' // Optional
});

// Place order
const result = await api.placeOrder(BrokerType.SHOONYA, {
  symbol: 'TCS-EQ',
  exchange: 'NSE',
  orderType: 'MARKET',
  side: 'BUY',
  quantity: 10,
  productType: 'INTRADAY'
});
```

## ⚙️ **Configuration**

```typescript
const shoonyaPlugin = new ShoonyaPlugin({
  enabled: true,
  autoStart: true,
  healthCheckInterval: 30000,
  maxRetries: 3,
  timeout: 30000,
  logLevel: 'info',
  customSettings: {
    enableWebSocket: true,
    enableHistoricalData: true,
    maxOrdersPerSecond: 10
  }
});
```

## 🔐 **Authentication**

### **Required Credentials**
```typescript
{
  userId: string;        // Your Shoonya user ID
  password: string;      // Your Shoonya password
  vendorCode: string;    // Your vendor code
  apiKey: string;        // Your API key
  imei: string;          // Device IMEI
  totpSecret?: string;   // TOTP secret (optional)
}
```

### **TOTP Setup**
1. Enable TOTP in your Shoonya account
2. Get the TOTP secret key
3. Provide it in credentials for automatic TOTP generation

## 📈 **Trading Examples**

### **Market Order**
```typescript
await api.placeOrder(BrokerType.SHOONYA, {
  symbol: 'RELIANCE-EQ',
  exchange: 'NSE',
  orderType: 'MARKET',
  side: 'BUY',
  quantity: 5,
  productType: 'DELIVERY'
});
```

### **Limit Order**
```typescript
await api.placeOrder(BrokerType.SHOONYA, {
  symbol: 'TCS-EQ',
  exchange: 'NSE',
  orderType: 'LIMIT',
  side: 'SELL',
  quantity: 10,
  price: 3500,
  productType: 'INTRADAY'
});
```

### **Options Trading**
```typescript
await api.placeOrder(BrokerType.SHOONYA, {
  symbol: 'NIFTY25JAN24000CE',
  exchange: 'NFO',
  orderType: 'LIMIT',
  side: 'BUY',
  quantity: 50,
  price: 100,
  productType: 'MARGIN'
});
```

## 📊 **Portfolio Management**

```typescript
// Get positions
const positions = await api.getPositions(BrokerType.SHOONYA);

// Get holdings
const holdings = await api.getHoldings(BrokerType.SHOONYA);

// Get account balance
const balance = await api.getAccountBalance(BrokerType.SHOONYA);

// Get orders
const orders = await api.getOrders(BrokerType.SHOONYA);
```

## 🔄 **Real-time Data**

```typescript
// Subscribe to quotes
await api.subscribeToQuotes([
  { symbol: 'TCS-EQ', exchange: 'NSE' },
  { symbol: 'RELIANCE-EQ', exchange: 'NSE' }
]);

// Listen for updates
api.on('quoteUpdate', ({ broker, quote }) => {
  if (broker === BrokerType.SHOONYA) {
    console.log(`${quote.symbol}: ₹${quote.lastPrice}`);
  }
});

// Subscribe to order updates
await api.subscribeToOrderUpdates();

api.on('orderUpdate', ({ broker, order }) => {
  if (broker === BrokerType.SHOONYA) {
    console.log(`Order ${order.orderId}: ${order.status}`);
  }
});
```

## 🏥 **Health Monitoring**

```typescript
// Check plugin health
const isHealthy = shoonyaPlugin.isHealthy();

// Get detailed status
const status = shoonyaPlugin.getStatus();

// Get plugin metrics
const metrics = shoonyaPlugin.getMetrics();

// Listen for health changes
api.on('pluginHealthCheck', ({ plugin, isHealthy }) => {
  console.log(`Shoonya plugin health: ${isHealthy ? '✅' : '❌'}`);
});
```

## 🎛️ **Advanced Features**

### **Plugin Capabilities**
```typescript
const capabilities = api.getPluginCapabilities(BrokerType.SHOONYA);
console.log('Max orders/sec:', capabilities.maxOrdersPerSecond);
console.log('Supports WebSocket:', capabilities.supportsWebSocket);
console.log('Supports Options:', capabilities.supportsOptionsTrading);
```

### **Error Handling**
```typescript
api.on('brokerError', ({ broker, error }) => {
  if (broker === BrokerType.SHOONYA) {
    console.error('Shoonya error:', error.message);
  }
});

shoonyaPlugin.onError((error) => {
  console.error('Plugin error:', error);
});
```

## 💰 **Pricing**

- **Plugin License**: $29/month
- **Includes**: Full Shoonya integration, real-time data, support
- **Enterprise**: Custom pricing for high-volume usage

## 🤝 **Support**

- **Documentation**: [docs.copytradepro.com/shoonya](https://docs.copytradepro.com/shoonya)
- **Email**: support@copytradepro.com
- **Discord**: [Join our community](https://discord.gg/copytradepro)

## 📄 **License**

Commercial License - See [LICENSE](LICENSE) for details.

---

**Built with ❤️ by CopyTradePro Team**
