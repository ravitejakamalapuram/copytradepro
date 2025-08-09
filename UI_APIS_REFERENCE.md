# UI APIs Reference

Complete list of all APIs being used in the frontend application.

## Base Configuration
- **Base URL**: `http://localhost:3001/api` (configurable via `VITE_API_URL`)
- **Authentication**: Bearer token in Authorization header
- **HTTP Client**: Axios with caching, deduplication, and retry logic

---

## 1. Authentication APIs (`/api/auth/`)

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| POST | `/api/auth/login` | User login | `authService.ts` |
| POST | `/api/auth/register` | User registration | `authService.ts` |
| POST | `/api/auth/logout` | User logout | `authService.ts` |
| GET | `/api/auth/profile` | Get user profile | `authService.ts` |

---

## 2. Broker Management APIs (`/api/broker/`)

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| POST | `/api/broker/connect` | Connect to broker | `brokerService.ts` |
| POST | `/api/broker/validate-fyers-auth` | Validate Fyers auth code | `brokerService.ts` |
| POST | `/api/broker/disconnect` | Disconnect broker | `brokerService.ts` |
| GET | `/api/broker/available` | Get available brokers | `brokerService.ts` |
| POST | `/api/broker/oauth/complete` | Complete OAuth flow | `brokerService.ts` |
| GET | `/api/broker/oauth/callback` | OAuth callback | `brokerService.ts` |

---

## 3. Account Management APIs (`/api/broker/accounts/`)

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| GET | `/api/broker/accounts` | Get connected accounts | `accountService.ts` |
| POST | `/api/broker/accounts` | Save connected account | `accountService.ts` |
| POST | `/api/broker/accounts/{id}/activate` | Activate account | `accountService.ts` |
| POST | `/api/broker/accounts/{id}/deactivate` | Deactivate account | `accountService.ts` |
| DELETE | `/api/broker/accounts/{id}` | Remove account | `accountService.ts` |

---

## 4. Order Management APIs (`/api/broker/`)

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| POST | `/api/broker/place-multi-account-order` | Place orders across accounts | `brokerService.ts` |
| POST | `/api/broker/refresh-all-order-status` | Refresh all order statuses | `brokerService.ts` |
| POST | `/api/broker/refresh-order-status/{orderId}` | Refresh specific order status | `brokerService.ts` |
| POST | `/api/broker/cancel-order/{orderId}` | Cancel order | `brokerService.ts` |
| PUT | `/api/broker/modify-order/{orderId}` | Modify order | `brokerService.ts` |
| POST | `/api/broker/retry-order/{orderId}` | Retry failed order | `brokerService.ts` |
| DELETE | `/api/broker/delete-order/{orderId}` | Delete order | `brokerService.ts` |
| GET | `/api/broker/order-history` | Get order history | `brokerService.ts` |
| POST | `/api/broker/check-order-status` | Check order status | `brokerService.ts` |
| GET | `/api/broker/order-search-suggestions` | Get order search suggestions | `brokerService.ts` |
| GET | `/api/broker/order-book` | Get order book | `brokerService.ts` |
| GET | `/api/broker/quotes/{broker}/{exchange}/{token}` | Get quotes | `brokerService.ts` |

---

## 5. Symbol & Market Data APIs

### Symbol APIs (`/api/symbols/`)

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| GET | `/api/symbols/search` | Search symbols | `symbolService.ts` |
| GET | `/api/symbols/details` | Get symbol details | `symbolService.ts` |
| GET | `/api/symbols/option-chain` | Get option chain | `symbolService.ts` |
| GET | `/api/symbols/expiry-dates` | Get expiry dates | `symbolService.ts` |

### Market Data APIs (`/api/market-data/`)

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| GET | `/api/market-data/search/{query}` | Legacy symbol search | Referenced in docs |
| GET | `/api/market-data/search-unified/{query}` | Unified symbol search | Referenced in docs |
| GET | `/api/market-data/option-chain/{underlying}` | Option chains | Referenced in docs |
| GET | `/api/market-data/expiry-dates/{underlying}` | Expiry dates | Referenced in docs |
| GET | `/api/market-data/price/{symbol}` | Individual stock price | Referenced in docs |
| POST | `/api/market-data/prices` | Batch stock prices | Referenced in docs |

---

## 6. Portfolio APIs (`/api/portfolio/`)

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| GET | `/api/portfolio/positions` | Get portfolio positions | `portfolioService.ts` |
| GET | `/api/portfolio/metrics` | Get portfolio metrics | `portfolioService.ts` |
| GET | `/api/portfolio/trading-stats` | Get trading statistics | `portfolioService.ts` |
| GET | `/api/portfolio/performance` | Get performance data | `portfolioService.ts` |
| GET | `/api/portfolio/symbols` | Get symbol-wise performance | `portfolioService.ts` |
| GET | `/api/portfolio/summary` | Get portfolio summary | `portfolioService.ts` |
| GET | `/api/portfolio/analytics` | Get portfolio analytics | `portfolioService.ts` |

---

## 7. Funds Management APIs (`/api/funds/`)

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| GET | `/api/funds/balance` | Get funds balance | `fundsService.ts` |
| GET | `/api/funds/margin` | Get margin details | `fundsService.ts` |
| GET | `/api/funds/transactions` | Get fund transactions | `fundsService.ts` |
| GET | `/api/funds/margin-requirement` | Get margin requirements | `fundsService.ts` |

---

## 8. Advanced Orders APIs (`/api/advanced-orders/`)

### Order Templates

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| POST | `/api/advanced-orders/templates` | Create order template | `advancedOrderService.ts` |
| GET | `/api/advanced-orders/templates` | Get order templates | `advancedOrderService.ts` |
| GET | `/api/advanced-orders/templates/{id}` | Get specific template | `advancedOrderService.ts` |
| PUT | `/api/advanced-orders/templates/{id}` | Update template | `advancedOrderService.ts` |
| DELETE | `/api/advanced-orders/templates/{id}` | Delete template | `advancedOrderService.ts` |

### Advanced Order Types

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| POST | `/api/advanced-orders/bracket` | Create bracket order | `advancedOrderService.ts` |
| POST | `/api/advanced-orders/iceberg` | Create iceberg order | `advancedOrderService.ts` |
| POST | `/api/advanced-orders/trailing-stop` | Create trailing stop order | `advancedOrderService.ts` |
| GET | `/api/advanced-orders/orders` | Get advanced orders | `advancedOrderService.ts` |
| GET | `/api/advanced-orders/orders/{id}` | Get specific order | `advancedOrderService.ts` |
| POST | `/api/advanced-orders/orders/{id}/cancel` | Cancel advanced order | `advancedOrderService.ts` |

---

## 9. Admin & Monitoring APIs (`/api/admin/`)

### System Monitoring

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| GET | `/api/admin/monitoring/dashboard` | Get dashboard data | `adminService.ts` |
| GET | `/api/admin/monitoring/health` | Get system health | `adminService.ts` |
| GET | `/api/admin/monitoring/metrics` | Get system metrics | `adminService.ts` |
| GET | `/api/admin/monitoring/alerts` | Get system alerts | `adminService.ts` |

### Error Management

| Method | Endpoint | Description | Service File |
|--------|----------|-------------|--------------|
| GET | `/api/admin/errors` | Get errors | `errorService.ts` |
| GET | `/api/admin/errors/{id}` | Get specific error | `errorService.ts` |
| PUT | `/api/admin/errors/{id}` | Update error | `errorService.ts` |
| DELETE | `/api/admin/errors/{id}` | Delete error | `errorService.ts` |
| GET | `/api/admin/errors/analytics` | Get error analytics | `errorService.ts` |
| GET | `/api/admin/errors/patterns` | Get error patterns | `errorService.ts` |
| GET | `/api/admin/errors/insights` | Get error insights | `errorService.ts` |
| GET | `/api/admin/errors/export` | Export errors | `errorService.ts` |
| GET | `/api/admin/errors/stats` | Get error statistics | `errorService.ts` |
| GET | `/api/admin/traces/{id}/lifecycle` | Get trace lifecycle | `errorService.ts` |

---

## 10. WebSocket Connections

### Real-time Data (`useRealTimeData.ts`)

| Connection | Endpoint | Description |
|------------|----------|-------------|
| WebSocket | `/` | Main Socket.IO connection |

### WebSocket Events

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `subscribe_symbol` | Emit | Subscribe to symbol prices |
| `unsubscribe_symbol` | Emit | Unsubscribe from symbol |
| `subscribe_indices` | Emit | Subscribe to market indices |
| `unsubscribe_indices` | Emit | Unsubscribe from indices |
| `price_update` | Listen | Receive price updates |
| `indices_update` | Listen | Receive indices updates |
| `market_status_update` | Listen | Receive market status |
| `portfolioUpdate` | Listen | Receive portfolio updates |
| `price_update_error` | Listen | Receive price update errors |

---

## Summary

- **Total Active APIs**: 50+ endpoints
- **Main Categories**: Auth, Broker, Orders, Symbols, Portfolio, Funds, Admin
- **Real-time**: WebSocket connection for live data
- **HTTP Methods**: GET, POST, PUT, DELETE
- **Authentication**: Bearer token required for most endpoints
- **Caching**: Client-side caching implemented for performance
- **Error Handling**: Comprehensive error handling with retry logic
