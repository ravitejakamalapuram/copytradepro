# 🚀 Unified Trading API Library

**A comprehensive, production-ready library for integrating with multiple Indian stock brokers through a single, unified interface.**

[![npm version](https://badge.fury.io/js/%40copytradepro%2Funified-trading-api.svg)](https://badge.fury.io/js/%40copytradepro%2Funified-trading-api)
[![License: Commercial](https://img.shields.io/badge/License-Commercial-red.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🎯 **Why Unified Trading API?**

### **The Problem**
- Each broker has different APIs, authentication methods, and data formats
- Building multi-broker applications requires maintaining separate integrations
- Switching between brokers means rewriting entire trading logic
- No standardized interface for Indian stock market brokers

### **The Solution**
- **🔧 Single API** - One interface for all brokers
- **⚙️ Configuration-Driven** - Broker-specific logic handled internally
- **🔌 Plug & Play** - Easy integration for any trading application
- **📈 Production-Ready** - Built for high-frequency trading applications

## 🏗️ **Architecture**

```
Your Application
       ↓
Unified Trading API
       ↓
Broker Abstraction Layer
       ↓
[Shoonya] [Fyers] [Zerodha] [Angel] [Upstox]
```

## 🚀 **Quick Start**

### **Installation**

```bash
npm install @copytradepro/unified-trading-api
```

### **Basic Usage**

```typescript
import { 
  createUnifiedTradingAPI, 
  createShoonyaCredentials,
  createFyersCredentials,
  BrokerType,
  OrderType,
  OrderSide,
  ProductType,
  Exchange
} from '@copytradepro/unified-trading-api';

// Create API instance
const tradingAPI = createUnifiedTradingAPI({
  enableLogging: true,
  logLevel: 'info'
});

// Set up event listeners
tradingAPI.on('brokerAuthenticated', ({ broker, profile }) => {
  console.log(`✅ ${broker} authenticated:`, profile);
});

tradingAPI.on('orderPlaced', ({ broker, order }) => {
  console.log(`📈 Order placed on ${broker}:`, order);
});

// Authenticate with multiple brokers
async function authenticateBrokers() {
  // Shoonya authentication
  const shoonyaCredentials = createShoonyaCredentials(
    'your_user_id',
    'your_password',
    'your_vendor_code',
    'your_api_key',
    'your_imei',
    'your_totp_secret'
  );

  // Fyers authentication
  const fyersCredentials = createFyersCredentials(
    'your_client_id',
    'your_secret_key',
    'your_redirect_uri'
  );

  // Authenticate with both brokers
  const results = await tradingAPI.authenticateMultipleBrokers([
    { broker: BrokerType.SHOONYA, credentials: shoonyaCredentials },
    { broker: BrokerType.FYERS, credentials: fyersCredentials }
  ]);

  console.log('Authentication results:', results);
}

// Place orders across multiple brokers
async function placeOrders() {
  const orderRequest = {
    symbol: 'TCS-EQ',
    exchange: Exchange.NSE,
    orderType: OrderType.MARKET,
    side: OrderSide.BUY,
    quantity: 10,
    productType: ProductType.INTRADAY
  };

  // Place same order on multiple brokers
  const results = await tradingAPI.placeOrderMultipleBrokers(
    [BrokerType.SHOONYA, BrokerType.FYERS],
    orderRequest
  );

  console.log('Order results:', results);
}

// Get portfolio data
async function getPortfolio() {
  const shoonyaPositions = await tradingAPI.getPositions(BrokerType.SHOONYA);
  const fyersPositions = await tradingAPI.getPositions(BrokerType.FYERS);
  
  console.log('Shoonya positions:', shoonyaPositions);
  console.log('Fyers positions:', fyersPositions);
}
```

## 📚 **Supported Brokers**

| Broker | Status | Authentication | Orders | Portfolio | Market Data | WebSocket |
|--------|--------|---------------|---------|-----------|-------------|-----------|
| **Shoonya** | ✅ Ready | ✅ TOTP | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Fyers** | ✅ Ready | ✅ OAuth | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Zerodha** | 🚧 Coming Soon | - | - | - | - | - |
| **Angel** | 🚧 Coming Soon | - | - | - | - | - |
| **Upstox** | 🚧 Coming Soon | - | - | - | - | - |

## 🔧 **Features**

### **🔐 Authentication**
- **Multiple auth methods** - TOTP, OAuth, API keys
- **Token management** - Automatic refresh and storage
- **Session handling** - Persistent login across restarts

### **📈 Trading Operations**
- **Order placement** - Market, limit, stop-loss orders
- **Order management** - Modify, cancel, track orders
- **Multi-broker orders** - Place same order across brokers
- **Order validation** - Pre-flight checks before placement

### **💼 Portfolio Management**
- **Positions tracking** - Real-time P&L updates
- **Holdings management** - Long-term investment tracking
- **Balance monitoring** - Cash, margin, collateral tracking

### **📊 Market Data**
- **Real-time quotes** - Live price updates
- **Market depth** - Order book data
- **Symbol search** - Find instruments across exchanges
- **Historical data** - OHLC and tick data

### **🔄 Real-time Updates**
- **WebSocket support** - Live data streaming
- **Event-driven** - React to market and order events
- **Auto-reconnection** - Resilient connection handling

## 🎛️ **Advanced Configuration**

```typescript
import { UnifiedTradingAPI, BrokerType } from '@copytradepro/unified-trading-api';

const config = {
  brokers: [
    {
      type: BrokerType.SHOONYA,
      name: 'Finvasia Shoonya',
      credentials: {}, // Will be provided during authentication
      endpoints: {
        auth: 'https://api.shoonya.com/NorenWClientTP/',
        orders: 'https://api.shoonya.com/NorenWClientTP/',
        positions: 'https://api.shoonya.com/NorenWClientTP/',
        holdings: 'https://api.shoonya.com/NorenWClientTP/',
        quotes: 'https://api.shoonya.com/NorenWClientTP/',
        websocket: 'wss://api.shoonya.com/NorenWSTP/'
      },
      features: {
        supportsWebSocket: true,
        supportsMarketData: true,
        supportsOptions: true,
        supportsCommodities: false,
        supportsRefreshToken: false
      },
      limits: {
        maxOrdersPerSecond: 10,
        maxPositions: 1000,
        maxOrderValue: 10000000
      }
    }
  ],
  defaultBroker: BrokerType.SHOONYA,
  enableLogging: true,
  logLevel: 'debug',
  retryAttempts: 3,
  timeout: 30000
};

const tradingAPI = new UnifiedTradingAPI(config);
```

## 🎯 **Use Cases**

### **🤖 Algorithmic Trading**
```typescript
// Execute strategy across multiple brokers
async function executeStrategy() {
  const signal = await getSignal();
  
  if (signal.action === 'BUY') {
    await tradingAPI.placeOrderMultipleBrokers(
      [BrokerType.SHOONYA, BrokerType.FYERS],
      {
        symbol: signal.symbol,
        exchange: Exchange.NSE,
        orderType: OrderType.MARKET,
        side: OrderSide.BUY,
        quantity: signal.quantity,
        productType: ProductType.INTRADAY
      }
    );
  }
}
```

### **📊 Portfolio Aggregation**
```typescript
// Get consolidated portfolio across brokers
async function getConsolidatedPortfolio() {
  const allPositions = [];
  
  for (const broker of tradingAPI.getActiveBrokers()) {
    const positions = await tradingAPI.getPositions(broker);
    allPositions.push(...positions.data);
  }
  
  return consolidatePositions(allPositions);
}
```

### **🔄 Copy Trading**
```typescript
// Copy trades from one broker to another
tradingAPI.on('orderUpdate', async ({ broker, order }) => {
  if (broker === BrokerType.SHOONYA && order.status === 'COMPLETE') {
    // Copy to Fyers
    await tradingAPI.placeOrder(BrokerType.FYERS, {
      symbol: order.symbol,
      exchange: order.exchange,
      orderType: order.orderType,
      side: order.side,
      quantity: order.quantity,
      productType: order.productType
    });
  }
});
```

## 🔒 **Security & Compliance**

- **🔐 Secure credential storage** - No hardcoded secrets
- **🛡️ Token encryption** - Encrypted token storage
- **📝 Audit logging** - Complete operation tracking
- **⚡ Rate limiting** - Broker-specific rate limits
- **🔄 Auto-retry** - Resilient error handling

## 📈 **Performance**

- **⚡ Low latency** - Optimized for speed
- **🔄 Connection pooling** - Efficient resource usage
- **📊 Monitoring** - Built-in performance metrics
- **🎯 Load balancing** - Distribute across brokers

## 💰 **Pricing & Licensing**

This is a **commercial library** with flexible licensing options:

### **📦 Pricing Tiers**

| Tier | Price | Brokers | Orders/Month | Support |
|------|-------|---------|--------------|---------|
| **Starter** | $99/month | 2 | 10,000 | Email |
| **Professional** | $299/month | 5 | 100,000 | Priority |
| **Enterprise** | $999/month | Unlimited | Unlimited | Dedicated |

### **🎯 Custom Solutions**
- **White-label licensing** available
- **On-premise deployment** options
- **Custom broker integrations**
- **SLA guarantees**

## 🤝 **Support & Community**

- **📧 Email Support**: support@copytradepro.com
- **📚 Documentation**: [docs.copytradepro.com](https://docs.copytradepro.com)
- **💬 Discord Community**: [Join our Discord](https://discord.gg/copytradepro)
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/ravitejakamalapuram/copytradepro/issues)

## 📄 **License**

This software is licensed under a commercial license. See [LICENSE](LICENSE) for details.

---

## 🚀 **Getting Started**

1. **Install the library**
   ```bash
   npm install @copytradepro/unified-trading-api
   ```

2. **Get your API credentials** from supported brokers

3. **Follow our quick start guide** above

4. **Join our community** for support and updates

## 🔮 **Roadmap**

- ✅ **Q1 2025**: Shoonya & Fyers integration
- 🚧 **Q2 2025**: Zerodha & Angel integration
- 🚧 **Q3 2025**: Options trading & advanced orders
- 🚧 **Q4 2025**: Commodities & international markets

---

**Built with ❤️ by CopyTradePro Team**

*Empowering traders with unified broker access*
