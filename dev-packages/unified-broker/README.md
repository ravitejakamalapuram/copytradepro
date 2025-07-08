# @copytrade/unified-broker

🚀 **A unified, plugin-based broker interface library for Indian stock market brokers**

This library provides a consistent API across different brokers, making it easy to integrate multiple brokers into your trading applications with a single, unified interface.

## ✨ Features

- **🔌 Unified Interface**: Same API for all brokers
- **🧩 Plugin Architecture**: Add new brokers without modifying existing code
- **🛡️ Type Safety**: Full TypeScript support with comprehensive type definitions
- **⚡ Auto-Registration**: Brokers register themselves automatically
- **🔧 Easy Integration**: Simple setup with minimal configuration
- **📈 Production Ready**: Used in production trading applications

## 📦 Installation

```bash
npm install @copytrade/unified-broker
```

## 🚀 Quick Start

```typescript
import { createBroker, getSupportedBrokers } from '@copytrade/unified-broker';

// See available brokers
console.log('Supported brokers:', getSupportedBrokers());

// Create a broker instance
const shoonyaBroker = createBroker('shoonya');

// Login with credentials
const loginResponse = await shoonyaBroker.login({
  userId: 'your-user-id',
  password: 'your-password',
  vendorCode: 'your-vendor-code',
  apiSecret: 'your-api-secret',
  imei: 'your-imei',
  totpKey: 'your-totp-key'
});

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
    accountId: 'your-user-id'
  });
  
  console.log('Order placed:', orderResponse);
}
```

## 🏛️ Supported Brokers

| Broker | Status | Exchanges | Features |
|--------|--------|-----------|----------|
| **Shoonya (Finvasia)** | ✅ Available | NSE, BSE, NFO, BFO, MCX | Full API support |
| **Fyers** | ✅ Available | NSE, BSE, NFO, BFO, MCX | OAuth 2.0, WebSocket |
| **Zerodha** | 🚧 Coming Soon | NSE, BSE, NFO, BFO, MCX | KiteConnect API |
| **Upstox** | 🚧 Coming Soon | NSE, BSE, NFO, BFO, MCX | OAuth 2.0 |
| **Angel One** | 🚧 Coming Soon | NSE, BSE, NFO, BFO, MCX | SmartAPI |

## 🔧 Advanced Usage

### Factory Pattern

```typescript
import { BrokerFactory, initializeUnifiedBroker } from '@copytrade/unified-broker';

// Initialize with configuration
initializeUnifiedBroker({
  enabledBrokers: ['shoonya', 'fyers'], // Only enable specific brokers
  autoLoad: true
});

// Get factory instance
const factory = BrokerFactory.getInstance();

// Create multiple broker instances
const shoonyaBroker = factory.createBroker('shoonya');
const fyersBroker = factory.createBroker('fyers');
```

### Multi-Broker Operations

```typescript
import { getSupportedBrokers, createBroker } from '@copytrade/unified-broker';

// Work with all available brokers
const brokers = getSupportedBrokers().map(name => ({
  name,
  instance: createBroker(name)
}));

// Get quotes from all brokers
for (const broker of brokers) {
  try {
    const quote = await broker.instance.getQuote('TCS', 'NSE');
    console.log(`${broker.name} quote:`, quote);
  } catch (error) {
    console.log(`${broker.name} requires authentication`);
  }
}
```

## 📊 API Reference

### Core Interface

All brokers implement the same `IBrokerService` interface:

```typescript
interface IBrokerService {
  // Authentication
  login(credentials: BrokerCredentials): Promise<LoginResponse>;
  logout(): Promise<boolean>;
  validateSession(accountId?: string): Promise<boolean>;

  // Orders
  placeOrder(orderRequest: OrderRequest): Promise<OrderResponse>;
  getOrderStatus(orderId: string): Promise<OrderStatus>;
  getOrderHistory(): Promise<OrderStatus[]>;

  // Market Data
  getQuote(symbol: string, exchange: string): Promise<Quote>;

  // Portfolio
  getPositions(): Promise<Position[]>;
}
```

### Order Request Format

```typescript
interface OrderRequest {
  symbol: string;                    // Stock symbol (e.g., 'TCS')
  action: 'BUY' | 'SELL';           // Order action
  quantity: number;                  // Number of shares
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  price?: number;                    // Price for limit orders
  exchange: string;                  // Exchange (NSE, BSE, etc.)
  productType: string;               // CNC, MIS, NRML, BO
  validity: 'DAY' | 'IOC' | 'GTD';  // Order validity
  remarks?: string;                  // Optional remarks
  accountId: string;                 // Account identifier
}
```

## 🔑 Broker-Specific Setup

### Shoonya (Finvasia)

```typescript
const shoonyaBroker = createBroker('shoonya');

await shoonyaBroker.login({
  userId: 'your-user-id',
  password: 'your-password',
  vendorCode: 'your-vendor-code',
  apiSecret: 'your-api-secret',
  imei: 'your-imei',
  totpKey: 'your-totp-key'
});
```

### Fyers

```typescript
const fyersBroker = createBroker('fyers');

// Step 1: Get authorization URL
const authUrl = generateFyersAuthUrl(appId, redirectUri);
console.log('Visit:', authUrl);

// Step 2: After user authorization, use the auth code
await fyersBroker.login({
  appId: 'your-app-id',
  clientId: 'your-client-id',
  secretKey: 'your-secret-key',
  redirectUri: 'your-redirect-uri',
  authCode: 'auth-code-from-callback'
});
```

## 🛡️ Error Handling

```typescript
try {
  const response = await broker.placeOrder(orderRequest);
  
  if (response.success) {
    console.log('Order successful:', response.orderId);
  } else {
    console.error('Order failed:', response.message);
  }
} catch (error) {
  console.error('API Error:', error.message);
  
  // Handle specific error types
  if (error.message.includes('session')) {
    // Re-authenticate
    await broker.login(credentials);
  }
}
```

## 🔧 Configuration

```typescript
import { initializeUnifiedBroker, healthCheck } from '@copytrade/unified-broker';

// Configure the library
initializeUnifiedBroker({
  enabledBrokers: ['shoonya', 'fyers'], // Only enable specific brokers
  autoLoad: true                        // Auto-load broker plugins
});

// Check library health
const health = healthCheck();
console.log('Library status:', health);
```

## 🧪 Testing

```typescript
import { createBroker, getSupportedBrokers } from '@copytrade/unified-broker';

// Test all brokers with the same interface
const brokers = getSupportedBrokers();

for (const brokerName of brokers) {
  const broker = createBroker(brokerName);
  
  // All brokers support the same methods
  expect(typeof broker.login).toBe('function');
  expect(typeof broker.placeOrder).toBe('function');
  expect(typeof broker.getQuote).toBe('function');
}
```

## 📈 Examples

Check out the [examples directory](https://github.com/ravitejakamalapuram/copytradepro/tree/main/examples) for complete working examples:

- **Basic Trading Bot**: Simple buy/sell automation
- **Multi-Broker Arbitrage**: Price comparison across brokers
- **Portfolio Tracker**: Real-time portfolio monitoring
- **Order Management**: Advanced order handling

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This is an unofficial library for broker API integration. Please ensure compliance with your broker's terms of service and trading regulations. Trading involves financial risk - use at your own discretion.

## 📞 Support

- **Documentation**: [Full API Documentation](https://docs.copytrade.com)
- **Issues**: [GitHub Issues](https://github.com/ravitejakamalapuram/copytradepro/issues)
- **Discussions**: [GitHub Discussions](https://github.com/ravitejakamalapuram/copytradepro/discussions)
- **Email**: contact@copytrade.com

---

Made with ❤️ by the CopyTrade Team
