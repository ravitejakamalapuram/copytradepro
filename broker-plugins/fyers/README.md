# @copytradepro/broker-fyers

🚀 **Professional Fyers Securities broker integration plugin for the Unified Trading API**

[![npm version](https://badge.fury.io/js/%40copytradepro%2Fbroker-fyers.svg)](https://badge.fury.io/js/%40copytradepro%2Fbroker-fyers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🌟 Features

- ✅ **OAuth2 Authentication** - Secure OAuth2 flow with refresh tokens
- ✅ **Real-time Market Data** - Live quotes and market depth
- ✅ **Order Management** - Place, modify, cancel orders
- ✅ **Portfolio Tracking** - Positions, holdings, P&L
- ✅ **Multi-Exchange Support** - NSE, BSE, NFO, BFO, MCX
- ✅ **Options & Futures** - Complete derivatives trading
- ✅ **Commodities Trading** - MCX commodity support
- ✅ **Event-Driven** - Real-time updates via events

## 📦 Installation

```bash
npm install @copytradepro/broker-fyers
```

## 🚀 Quick Start

```typescript
import { UnifiedTradingAPI } from '@copytradepro/unified-trading-api';
import FyersPlugin from '@copytradepro/broker-fyers';

// Create API instance
const api = new UnifiedTradingAPI();

// Install Fyers plugin
const fyersPlugin = new FyersPlugin({
  enabled: true,
  autoStart: true,
  logLevel: 'info'
});

await api.installPlugin(fyersPlugin);

// Authenticate (OAuth2 flow)
const authResult = await api.authenticateBroker('fyers', {
  clientId: 'YOUR_CLIENT_ID',
  secretKey: 'YOUR_SECRET_KEY',
  redirectUri: 'YOUR_REDIRECT_URI'
});

if (authResult.authUrl) {
  console.log('Visit this URL to authorize:', authResult.authUrl);
  // After authorization, you'll get an auth code
  // Complete authentication with the auth code
}

// Place order
const result = await api.placeOrder('fyers', {
  symbol: 'NSE:TCS-EQ',
  exchange: 'NSE',
  orderType: 'MARKET',
  side: 'BUY',
  quantity: 1,
  productType: 'INTRADAY'
});
```

## 🔐 OAuth2 Authentication Flow

### Step 1: Initial Authentication
```typescript
const authResult = await api.authenticateBroker('fyers', {
  clientId: 'YZ1234567890-100',
  secretKey: 'YOUR_SECRET_KEY',
  redirectUri: 'https://yourapp.com/callback'
});

console.log('Authorization URL:', authResult.authUrl);
// User visits the URL and authorizes the app
```

### Step 2: Complete Authentication with Auth Code
```typescript
const finalAuth = await api.authenticateBroker('fyers', {
  clientId: 'YZ1234567890-100',
  secretKey: 'YOUR_SECRET_KEY',
  redirectUri: 'https://yourapp.com/callback',
  authCode: 'AUTH_CODE_FROM_CALLBACK'
});

if (finalAuth.success) {
  console.log('Authentication successful!');
  // Access and refresh tokens are automatically stored
}
```

## 📈 Trading Examples

### Equity Trading
```typescript
// Buy equity
const buyOrder = await api.placeOrder('fyers', {
  symbol: 'NSE:RELIANCE-EQ',
  exchange: 'NSE',
  orderType: 'LIMIT',
  side: 'BUY',
  quantity: 10,
  price: 2500.00,
  productType: 'DELIVERY'
});

// Sell equity
const sellOrder = await api.placeOrder('fyers', {
  symbol: 'NSE:INFY-EQ',
  exchange: 'NSE',
  orderType: 'MARKET',
  side: 'SELL',
  quantity: 5,
  productType: 'INTRADAY'
});
```

### Options Trading
```typescript
const optionOrder = await api.placeOrder('fyers', {
  symbol: 'NFO:NIFTY24DEC18000CE',
  exchange: 'NFO',
  orderType: 'LIMIT',
  side: 'BUY',
  quantity: 50,
  price: 25.50,
  productType: 'INTRADAY'
});
```

### Futures Trading
```typescript
const futureOrder = await api.placeOrder('fyers', {
  symbol: 'NFO:NIFTY24DECFUT',
  exchange: 'NFO',
  orderType: 'LIMIT',
  side: 'SELL',
  quantity: 25,
  price: 18500.00,
  productType: 'MARGIN'
});
```

### Commodities Trading
```typescript
const commodityOrder = await api.placeOrder('fyers', {
  symbol: 'MCX:GOLD24DECFUT',
  exchange: 'MCX',
  orderType: 'LIMIT',
  side: 'BUY',
  quantity: 1,
  price: 62000.00,
  productType: 'MARGIN'
});
```

## 📊 Market Data

### Get Live Quote
```typescript
const quote = await api.getQuote('fyers', 'NSE:TCS-EQ', 'NSE');
console.log(`LTP: ${quote.data.lastPrice}`);
```

### Multiple Quotes
```typescript
const quotes = await api.getQuotes('fyers', [
  { symbol: 'NSE:TCS-EQ', exchange: 'NSE' },
  { symbol: 'NSE:INFY-EQ', exchange: 'NSE' },
  { symbol: 'MCX:GOLD24DECFUT', exchange: 'MCX' }
]);
```

### Real-time Subscriptions
```typescript
await api.subscribeToQuotes('fyers', [
  { symbol: 'NSE:NIFTY50-INDEX', exchange: 'NSE' },
  { symbol: 'NSE:BANKNIFTY-INDEX', exchange: 'NSE' }
]);

api.onQuoteUpdate('fyers', (quote) => {
  console.log(`${quote.symbol}: ${quote.lastPrice}`);
});
```

## 💼 Portfolio Management

### Get Positions
```typescript
const positions = await api.getPositions('fyers');
positions.data.forEach(pos => {
  console.log(`${pos.symbol}: Qty=${pos.quantity}, P&L=${pos.pnl}`);
});
```

### Get Holdings
```typescript
const holdings = await api.getHoldings('fyers');
holdings.data.forEach(holding => {
  console.log(`${holding.symbol}: ${holding.quantity} @ ${holding.averagePrice}`);
});
```

### Account Balance
```typescript
const balance = await api.getAccountBalance('fyers');
console.log(`Available Cash: ${balance.data.availableCash}`);
console.log(`Used Margin: ${balance.data.usedMargin}`);
```

## 🔧 Configuration

```typescript
const config = {
  enabled: true,              // Enable/disable plugin
  autoStart: true,            // Auto-start on installation
  healthCheckInterval: 30000, // Health check interval (ms)
  maxRetries: 3,              // Max retry attempts
  timeout: 30000,             // Request timeout (ms)
  logLevel: 'info',           // Log level: debug, info, warn, error
  customSettings: {
    enableTokenRefresh: true,   // Auto-refresh tokens
    maxOrderValue: 5000000,     // Max order value (50L)
    allowedExchanges: ['NSE', 'BSE', 'NFO', 'BFO', 'MCX']
  }
};

const plugin = new FyersPlugin(config);
```

## 📊 Supported Features

| Feature | Support | Notes |
|---------|---------|-------|
| Authentication | ✅ | OAuth2 with refresh tokens |
| Order Types | ✅ | Market, Limit, SL, SL-M |
| Exchanges | ✅ | NSE, BSE, NFO, BFO, MCX |
| Products | ✅ | Delivery, Intraday, Margin |
| Real-time Data | ✅ | WebSocket streaming |
| Historical Data | ✅ | OHLC candles |
| Options Trading | ✅ | Full options chain |
| Futures Trading | ✅ | All F&O contracts |
| Commodities | ✅ | MCX contracts |
| Portfolio | ✅ | Positions & Holdings |

## 🛠️ Advanced Usage

### Token Management
```typescript
// Check token status
const adapter = plugin.getAdapter();
const isAuth = adapter.isAuthenticated();

// Manual token refresh
if (!isAuth) {
  await adapter.refreshAuth();
}
```

### Error Handling
```typescript
try {
  const result = await api.placeOrder('fyers', orderRequest);
  if (result.success) {
    console.log('Order placed:', result.data.orderId);
  } else {
    console.error('Order failed:', result.message);
  }
} catch (error) {
  if (error.message.includes('token')) {
    // Handle token expiry
    await adapter.refreshAuth();
    // Retry the operation
  }
}
```

## 🔗 Related Packages

- [@copytradepro/unified-trading-api](https://www.npmjs.com/package/@copytradepro/unified-trading-api) - Core trading library
- [@copytradepro/broker-shoonya](https://www.npmjs.com/package/@copytradepro/broker-shoonya) - Shoonya broker plugin
- [@copytradepro/broker-zerodha](https://www.npmjs.com/package/@copytradepro/broker-zerodha) - Zerodha broker plugin

## 📞 Support

- 📧 Email: support@copytradepro.com
- 💬 Discord: [Join our community](https://discord.gg/copytradepro)
- 📖 Documentation: [docs.copytradepro.com](https://docs.copytradepro.com)
- 🐛 Issues: [GitHub Issues](https://github.com/copytradepro/broker-plugins/issues)

## 📄 License

MIT © CopyTradePro

---

**⚠️ Disclaimer**: This software is for educational and informational purposes only. Trading in financial markets involves substantial risk. Please trade responsibly and consult with financial advisors before making investment decisions.
