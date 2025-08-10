# New Broker Onboarding Checklist

## Overview
This checklist ensures all necessary components are implemented when adding a new broker to the CopyTrade Pro platform. Follow each section carefully to avoid missing critical functionality.

---

## 📋 Pre-Development Setup

### 1. Research & Documentation
- [ ] **API Documentation Review**
  - [ ] Study broker's official API documentation
  - [ ] Identify authentication method (OAuth, API Key, Username/Password)
  - [ ] Document rate limits and restrictions
  - [ ] Note symbol format requirements for equity/options/futures
  - [ ] Identify supported exchanges and segments
  - [ ] Document order types and product types supported

- [ ] **Symbol Format Analysis**
  - [ ] Document equity symbol format (e.g., `RELIANCE-EQ`, `NSE:RELIANCE-EQ`)
  - [ ] Document options symbol format (e.g., `NIFTY25JAN22000CE`)
  - [ ] Document futures symbol format (e.g., `NIFTY25JANFUT`)
  - [ ] Document exchange codes (NSE, BSE, NFO, BFO, MCX)
  - [ ] Note any special formatting requirements

- [ ] **Create Broker Research Document**
  - [ ] File: `docs/brokers/{BROKER_NAME}_integration_guide.md`
  - [ ] Include API endpoints, authentication flow, symbol formats
  - [ ] Document any broker-specific quirks or limitations

---

## 🏗️ Core Implementation

### 2. Dev Package Structure
- [ ] **Create Broker Package**
  - [ ] Directory: `dev-packages/broker-{broker-name}/`
  - [ ] Copy structure from existing broker (e.g., `broker-fyers`)
  - [ ] Update `package.json` with correct broker name and dependencies

- [ ] **Package Files Checklist**
  ```
  dev-packages/broker-{broker-name}/
  ├── src/
  │   ├── index.ts                    ✅ Plugin registration
  │   ├── {BrokerName}ServiceAdapter.ts  ✅ Unified interface adapter
  │   ├── {brokerName}Service.ts      ✅ Core broker API service
  │   ├── symbolFormatter.ts          ✅ Symbol formatting logic
  │   ├── types.ts                    ✅ Broker-specific types
  │   └── helpers.ts                  ✅ Utility functions
  ├── package.json                    ✅ Package configuration
  ├── tsconfig.json                   ✅ TypeScript configuration
  └── README.md                       ✅ Broker-specific documentation
  ```

### 3. Symbol Formatter Implementation
- [ ] **Create Symbol Formatter** (`src/symbolFormatter.ts`)
  - [ ] `formatEquity(symbol: string, exchange?: string): string`
  - [ ] `formatOption(underlying: string, expiry: string, strike: number, optionType: 'CE'|'PE', exchange?: string): string`
  - [ ] `formatFuture(underlying: string, expiry: string, exchange?: string): string`
  - [ ] `parseSymbol(symbol: string): SymbolComponents | null`
  - [ ] `formatSymbol(symbol: string, exchange?: string, instrumentType?: string): string`
  - [ ] `isValidSymbol(symbol: string): boolean`
  - [ ] `getExchange(symbol: string, defaultExchange?: string): string`
  - [ ] `formatExpiryDate(expiryDate: string | Date): string`

- [ ] **Exchange Mapping**
  - [ ] Map common exchanges to broker-specific codes
  - [ ] Handle equity vs derivatives exchange differences
  - [ ] Document exchange mapping in comments

### 4. Core Service Implementation
- [ ] **Broker Service** (`src/{brokerName}Service.ts`)
  - [ ] Authentication methods (login, logout, token refresh)
  - [ ] Order placement (`placeOrder`)
  - [ ] Order management (`getOrderBook`, `getOrderStatus`, `cancelOrder`, `modifyOrder`)
  - [ ] Portfolio data (`getPositions`, `getHoldings`)
  - [ ] Market data (`getQuotes`, `searchSymbols`)
  - [ ] Account information (`getProfile`, `getLimits`)
  - [ ] Session validation (`validateSession`)

- [ ] **Service Adapter** (`src/{BrokerName}ServiceAdapter.ts`)
  - [ ] Extend `IBrokerService` from `@copytrade/unified-broker`
  - [ ] Implement all required interface methods
  - [ ] Use symbol formatter for all symbol-related operations
  - [ ] Add comprehensive error handling and retry logic
  - [ ] Include proper logging for debugging

### 5. Types & Interfaces
- [ ] **Broker-Specific Types** (`src/types.ts`)
  - [ ] Credentials interface (API keys, tokens, etc.)
  - [ ] Request/Response interfaces for API calls
  - [ ] Broker-specific enums and constants
  - [ ] Error types and codes

---

## 🔧 Integration & Configuration

### 6. Plugin Registration
- [ ] **Plugin Configuration** (`src/index.ts`)
  - [ ] Implement plugin factory function
  - [ ] Export initialization function
  - [ ] Add plugin metadata (name, version, description)
  - [ ] Register with `BrokerRegistry`

### 7. Backend Integration
- [ ] **Add to Enhanced Unified Broker Manager**
  - [ ] Update broker factory to include new broker
  - [ ] Add broker name to supported brokers list
  - [ ] Test connection management

- [ ] **Database Schema Updates**
  - [ ] Add broker name to `broker_name` enum if needed
  - [ ] Update credential storage schema if special fields required
  - [ ] Add any broker-specific configuration tables

### 8. Frontend Integration
- [ ] **Broker Selection UI**
  - [ ] Add broker to connection form
  - [ ] Create broker-specific credential input fields
  - [ ] Add broker logo and branding
  - [ ] Handle OAuth flow if applicable

- [ ] **Order Form Updates**
  - [ ] Test symbol search and selection
  - [ ] Verify order placement flow
  - [ ] Test different instrument types (equity/options/futures)

---

## 🧪 Testing & Validation

### 9. Symbol Formatting Tests
- [ ] **Create Test Script**
  - [ ] Copy and modify `test_symbol_formatting.js`
  - [ ] Test all instrument types (equity, options, futures)
  - [ ] Test various underlying symbols (NIFTY, BANKNIFTY, stocks)
  - [ ] Verify exchange mapping

- [ ] **Test Cases**
  - [ ] Equity symbols: `RELIANCE`, `TCS`, `INFY`
  - [ ] NIFTY options: `NIFTY25JAN22000CE`, `NIFTY25JAN22000PE`
  - [ ] BANKNIFTY options: `BANKNIFTY25JAN50000CE`, `BANKNIFTY25JAN50000PE`
  - [ ] Stock options: `RELIANCE25JAN3000CE`, `RELIANCE25JAN3000PE`
  - [ ] Futures: `NIFTY25JANFUT`, `BANKNIFTY25JANFUT`, `RELIANCE25JANFUT`

### 10. Integration Testing
- [ ] **Authentication Flow**
  - [ ] Test login with valid credentials
  - [ ] Test login with invalid credentials
  - [ ] Test session validation and refresh
  - [ ] Test logout functionality

- [ ] **Order Operations**
  - [ ] Place market orders (equity)
  - [ ] Place limit orders (equity)
  - [ ] Place options orders (calls and puts)
  - [ ] Place futures orders
  - [ ] Test order status retrieval
  - [ ] Test order history
  - [ ] Test order cancellation/modification

- [ ] **Portfolio Operations**
  - [ ] Retrieve positions
  - [ ] Retrieve holdings
  - [ ] Get account information
  - [ ] Test real-time quotes

### 11. Error Handling Tests
- [ ] **Network Errors**
  - [ ] Test timeout scenarios
  - [ ] Test connection failures
  - [ ] Test rate limiting

- [ ] **API Errors**
  - [ ] Test invalid symbols
  - [ ] Test insufficient funds
  - [ ] Test market closed scenarios
  - [ ] Test invalid order parameters

---

## 📚 Documentation & Deployment

### 12. Documentation
- [ ] **README.md** (in broker package)
  - [ ] Installation instructions
  - [ ] Configuration guide
  - [ ] Usage examples
  - [ ] Troubleshooting guide

- [ ] **API Documentation**
  - [ ] Document all public methods
  - [ ] Include code examples
  - [ ] Document error codes and handling

- [ ] **Integration Guide**
  - [ ] Step-by-step setup instructions
  - [ ] Credential configuration
  - [ ] Testing procedures

### 13. Build & Deployment
- [ ] **Package Build**
  - [ ] Run `npm run build` successfully
  - [ ] Fix any TypeScript compilation errors
  - [ ] Verify dist files are generated correctly

- [ ] **Dependency Management**
  - [ ] Update root package.json if needed
  - [ ] Install in backend: `cd backend && npm install file:../dev-packages/broker-{name}`
  - [ ] Test package installation

### 14. Production Readiness
- [ ] **Security Review**
  - [ ] Ensure credentials are properly encrypted
  - [ ] Validate input sanitization
  - [ ] Check for sensitive data in logs

- [ ] **Performance Testing**
  - [ ] Test with multiple concurrent users
  - [ ] Verify rate limiting compliance
  - [ ] Monitor memory usage and performance

- [ ] **Monitoring & Logging**
  - [ ] Add structured logging
  - [ ] Set up error tracking
  - [ ] Configure performance monitoring

---

## 🚀 Go-Live Checklist

### 15. Pre-Launch
- [ ] **Code Review**
  - [ ] Peer review of all broker-specific code
  - [ ] Security review of credential handling
  - [ ] Performance review of API calls

- [ ] **User Acceptance Testing**
  - [ ] Test with real broker accounts (sandbox/demo)
  - [ ] Verify all order types work correctly
  - [ ] Test error scenarios and recovery

### 16. Launch
- [ ] **Gradual Rollout**
  - [ ] Enable for limited users initially
  - [ ] Monitor error rates and performance
  - [ ] Collect user feedback

- [ ] **Documentation Updates**
  - [ ] Update main README with new broker
  - [ ] Update user guides and tutorials
  - [ ] Update API documentation

### 17. Post-Launch
- [ ] **Monitoring**
  - [ ] Set up alerts for broker-specific errors
  - [ ] Monitor order success rates
  - [ ] Track user adoption

- [ ] **Maintenance**
  - [ ] Regular API compatibility checks
  - [ ] Update for broker API changes
  - [ ] Performance optimization based on usage patterns

---

## 📝 Templates & Examples

### Symbol Formatter Template
```typescript
export class {BrokerName}SymbolFormatter {
  static formatEquity(symbol: string, exchange: string = 'NSE'): string {
    // Implement broker-specific equity formatting
  }
  
  static formatOption(underlying: string, expiry: string, strike: number, optionType: 'CE'|'PE', exchange: string = 'NSE'): string {
    // Implement broker-specific option formatting
  }
  
  static formatFuture(underlying: string, expiry: string, exchange: string = 'NSE'): string {
    // Implement broker-specific future formatting
  }
  
  static parseSymbol(symbol: string): SymbolComponents | null {
    // Implement symbol parsing logic
  }
}
```

### Service Adapter Template
```typescript
export class {BrokerName}ServiceAdapter extends IBrokerService {
  constructor() {
    super('{broker-name}');
  }
  
  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    // Format symbol using formatter
    const formattedSymbol = {BrokerName}SymbolFormatter.formatSymbol(
      orderRequest.symbol,
      orderRequest.exchange
    );
    
    // Implement order placement logic
  }
}
```

---

## ⚠️ Common Pitfalls to Avoid

1. **Symbol Formatting**: Always implement and test symbol formatters first
2. **Exchange Mapping**: Different exchanges for equity vs derivatives
3. **Error Handling**: Implement comprehensive error handling and retries
4. **Rate Limiting**: Respect broker API rate limits
5. **Session Management**: Proper token refresh and session validation
6. **Testing**: Test with real broker sandbox/demo accounts
7. **Documentation**: Keep documentation updated with broker-specific details

---

## 📞 Support & Resources

- **Existing Broker Examples**: Study `broker-fyers` and `broker-shoonya` implementations
- **Unified Broker Interface**: `@copytrade/unified-broker` package documentation
- **Symbol Formatting Examples**: `test_symbol_formatting.js` script
- **Integration Guides**: Existing broker documentation in `docs/brokers/`

---

**✅ Completion Criteria**: All checkboxes must be completed before considering the broker integration ready for production use.