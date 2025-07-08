# @copytrade/broker-core

A unified, plugin-based broker interface library for Indian stock market brokers. This library provides a consistent API across different brokers, making it easy to integrate multiple brokers into your trading applications.

## 🚀 Features

- **Unified Interface**: Same API for all brokers
- **Plugin Architecture**: Add new brokers without modifying existing code
- **Type Safety**: Full TypeScript support
- **Dynamic Registration**: Brokers register themselves automatically
- **Extensible**: Easy to add new brokers
- **Production Ready**: Used in production trading applications

## 📦 Installation

### Core Library
```bash
npm install @copytrade/broker-core
```

### Broker Adapters
```bash
# Install the brokers you need
npm install @copytrade/broker-shoonya
npm install @copytrade/broker-fyers
```

## 🔧 Quick Start

```typescript
import { BrokerFactory } from '@copytrade/broker-core';
import '@copytrade/broker-shoonya'; // Auto-registers Shoonya
import '@copytrade/broker-fyers';   // Auto-registers Fyers

// Get factory instance
const factory = BrokerFactory.getInstance();

// Create broker instances
const shoonyaBroker = factory.createBroker('shoonya');
const fyersBroker = factory.createBroker('fyers');

// Use unified interface
const loginResponse = await shoonyaBroker.login({
  userId: 'your-user-id',
  password: 'your-password',
  // ... other credentials
});

const orderResponse = await shoonyaBroker.placeOrder({
  symbol: 'TCS',
  action: 'BUY',
  quantity: 10,
  orderType: 'LIMIT',
  price: 3500,
  exchange: 'NSE',
  productType: 'CNC',
  validity: 'DAY'
});
```

## 🏗️ Architecture

### Core Components

1. **BrokerRegistry**: Manages broker plugin registration
2. **BrokerFactory**: Creates broker instances
3. **IBrokerService**: Unified interface all brokers implement
4. **Plugin System**: Auto-registration mechanism

### Supported Operations

- **Authentication**: Login, logout, session validation
- **Order Management**: Place, modify, cancel orders
- **Market Data**: Real-time quotes, historical data
- **Portfolio**: Positions, holdings, P&L
- **Account**: Balance, margins, limits

## 📚 API Reference

### IBrokerService Interface

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
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  price?: number;
  exchange: string;
  productType: string;
  validity: 'DAY' | 'IOC' | 'GTD';
  remarks?: string;
  accountId: string;
}
```

## 🔌 Available Broker Plugins

| Broker | Package | Status |
|--------|---------|--------|
| Shoonya (Finvasia) | `@copytrade/broker-shoonya` | ✅ Available |
| Fyers | `@copytrade/broker-fyers` | ✅ Available |
| Zerodha | `@copytrade/broker-zerodha` | 🚧 Coming Soon |
| Upstox | `@copytrade/broker-upstox` | 🚧 Coming Soon |
| Angel One | `@copytrade/broker-angel` | 🚧 Coming Soon |

## 🛠️ Creating Custom Broker Plugins

```typescript
import { BrokerRegistry, BrokerPlugin } from '@copytrade/broker-core';

// 1. Implement IBrokerService
class MyBrokerAdapter implements IBrokerService {
  async login(credentials: BrokerCredentials): Promise<LoginResponse> {
    // Your implementation
  }
  // ... implement other methods
}

// 2. Create plugin configuration
const myBrokerPlugin: BrokerPlugin = {
  name: 'mybroker',
  version: '1.0.0',
  description: 'My custom broker integration',
  createInstance: () => new MyBrokerAdapter()
};

// 3. Register plugin
const registry = BrokerRegistry.getInstance();
registry.registerPlugin(myBrokerPlugin);
```

## ⚙️ Configuration

```typescript
import { configureBrokerRegistry } from '@copytrade/broker-core';

// Configure which brokers to enable
configureBrokerRegistry({
  enabledBrokers: ['shoonya', 'fyers'], // Only these will be loaded
  autoLoad: true,
  pluginPaths: ['./custom-brokers'] // Load custom plugins
});
```

## 🧪 Testing

```typescript
import { BrokerFactory } from '@copytrade/broker-core';

// All brokers implement the same interface
const supportedBrokers = factory.getSupportedBrokers();

for (const brokerName of supportedBrokers) {
  const broker = factory.createBroker(brokerName);
  
  // Test with same code for all brokers
  const isValid = await broker.validateSession('test-account');
  expect(typeof isValid).toBe('boolean');
}
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📞 Support

- GitHub Issues: [Report bugs or request features](https://github.com/ravitejakamalapuram/copytradepro/issues)
- Documentation: [Full API documentation](https://docs.copytrade.com)
- Discord: [Join our community](https://discord.gg/copytrade)
