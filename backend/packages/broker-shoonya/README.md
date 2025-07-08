# @copytrade/broker-shoonya

Shoonya (Finvasia) broker adapter for the unified broker library. This package provides seamless integration with Shoonya's trading APIs through a unified interface.

## 🚀 Installation

```bash
# Install core library and Shoonya adapter
npm install @copytrade/broker-core @copytrade/broker-shoonya
```

## 📋 Prerequisites

- Shoonya trading account with API access
- Valid API credentials from Finvasia
- Node.js 16+ environment

## 🔧 Quick Start

```typescript
import { BrokerFactory } from '@copytrade/broker-core';
import '@copytrade/broker-shoonya'; // Auto-registers Shoonya broker

const factory = BrokerFactory.getInstance();
const shoonyaBroker = factory.createBroker('shoonya');

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

## 🔑 Credentials Setup

You need the following credentials from your Shoonya account:

```typescript
interface ShoonyaCredentials {
  userId: string;        // Your Shoonya user ID
  password: string;      // Your trading password
  vendorCode: string;    // Vendor code from Finvasia
  apiSecret: string;     // API secret key
  imei: string;          // Device IMEI or unique identifier
  totpKey: string;       // TOTP secret for 2FA
}
```

## 📊 Supported Features

### ✅ Trading Operations
- Order placement (Market, Limit, Stop-Loss)
- Order modification and cancellation
- Order status tracking
- Trade history

### ✅ Market Data
- Real-time quotes
- Historical data
- Symbol search

### ✅ Portfolio Management
- Positions tracking
- Holdings information
- P&L calculations

### ✅ Account Information
- Balance and margins
- Trading limits
- Account details

## 🏛️ Supported Exchanges

- **NSE** (National Stock Exchange)
- **BSE** (Bombay Stock Exchange)
- **NFO** (NSE Futures & Options)
- **BFO** (BSE Futures & Options)
- **MCX** (Multi Commodity Exchange)

## 📈 Order Types

- `MARKET` - Market orders
- `LIMIT` - Limit orders
- `SL-LIMIT` - Stop-Loss Limit orders
- `SL-MARKET` - Stop-Loss Market orders

## 🛡️ Product Types

- `CNC` - Cash and Carry (Delivery)
- `MIS` - Margin Intraday Square-off
- `NRML` - Normal (Carry Forward)
- `BO` - Bracket Orders

## ⚙️ Configuration

```typescript
import { getShoonyaConfig } from '@copytrade/broker-shoonya';

const config = getShoonyaConfig();
console.log('Supported exchanges:', config.supportedExchanges);
console.log('Rate limits:', config.rateLimits);
```

## 🔒 Security Best Practices

1. **Never hardcode credentials** in your source code
2. **Use environment variables** for sensitive data
3. **Implement proper error handling** for authentication failures
4. **Rotate TOTP keys** regularly
5. **Monitor API usage** to stay within rate limits

## 📝 Example: Environment Setup

```bash
# .env file
SHOONYA_USER_ID=your_user_id
SHOONYA_PASSWORD=your_password
SHOONYA_VENDOR_CODE=your_vendor_code
SHOONYA_API_SECRET=your_api_secret
SHOONYA_IMEI=your_imei
SHOONYA_TOTP_KEY=your_totp_key
```

```typescript
// Using environment variables
const credentials = {
  userId: process.env.SHOONYA_USER_ID!,
  password: process.env.SHOONYA_PASSWORD!,
  vendorCode: process.env.SHOONYA_VENDOR_CODE!,
  apiSecret: process.env.SHOONYA_API_SECRET!,
  imei: process.env.SHOONYA_IMEI!,
  totpKey: process.env.SHOONYA_TOTP_KEY!
};
```

## 🚨 Error Handling

```typescript
try {
  const response = await shoonyaBroker.placeOrder(orderRequest);
  if (response.success) {
    console.log('Order successful:', response.orderId);
  } else {
    console.error('Order failed:', response.message);
  }
} catch (error) {
  console.error('API Error:', error.message);
}
```

## 📞 Support

- **Documentation**: [Full API Documentation](https://docs.copytrade.com)
- **Issues**: [GitHub Issues](https://github.com/ravitejakamalapuram/copytradepro/issues)
- **Community**: [Discord Server](https://discord.gg/copytrade)

## 📄 License

MIT License - see LICENSE file for details.

## ⚠️ Disclaimer

This is an unofficial library for Shoonya API integration. Please ensure compliance with Finvasia's terms of service and trading regulations. Trading involves financial risk - use at your own discretion.
