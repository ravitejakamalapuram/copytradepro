/**
 * Basic Usage Example for Unified Trading API
 * This example demonstrates how to use the library for common trading operations
 */

import {
  createUnifiedTradingAPI,
  createShoonyaCredentials,
  createFyersCredentials,
  BrokerType,
  OrderType,
  OrderSide,
  ProductType,
  Exchange,
  UnifiedTradingAPI
} from '../src';

class TradingBot {
  private api: UnifiedTradingAPI;

  constructor() {
    // Create API instance with configuration
    this.api = createUnifiedTradingAPI({
      enableLogging: true,
      logLevel: 'info',
      retryAttempts: 3,
      timeout: 30000
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for broker authentication events
    this.api.on('brokerAuthenticated', ({ broker, profile }) => {
      console.log(`✅ ${broker} authenticated successfully`);
      console.log(`👤 User: ${profile?.userName} (${profile?.userId})`);
    });

    // Listen for order placement events
    this.api.on('orderPlaced', ({ broker, order }) => {
      console.log(`📈 Order placed on ${broker}:`);
      console.log(`   Order ID: ${order.orderId}`);
      console.log(`   Symbol: ${order.symbol}`);
      console.log(`   Side: ${order.side}`);
      console.log(`   Quantity: ${order.quantity}`);
    });

    // Listen for order updates
    this.api.on('orderUpdate', ({ broker, order }) => {
      console.log(`🔄 Order update from ${broker}:`);
      console.log(`   Order ID: ${order.orderId}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Filled: ${order.filledQuantity}/${order.quantity}`);
    });

    // Listen for real-time quote updates
    this.api.on('quoteUpdate', ({ broker, quote }) => {
      console.log(`💹 Quote update from ${broker}:`);
      console.log(`   ${quote.symbol}: ₹${quote.lastPrice} (${quote.changePercentage}%)`);
    });

    // Listen for broker errors
    this.api.on('brokerError', ({ broker, error }) => {
      console.error(`❌ Error from ${broker}:`, error.message);
    });

    // Listen for connection status changes
    this.api.on('connectionStatusChange', ({ broker, status }) => {
      console.log(`🔌 ${broker} connection status: ${status}`);
    });
  }

  async authenticateWithBrokers(): Promise<void> {
    console.log('🔐 Starting authentication with brokers...');

    try {
      // Create credentials for different brokers
      const shoonyaCredentials = createShoonyaCredentials(
        process.env.SHOONYA_USER_ID!,
        process.env.SHOONYA_PASSWORD!,
        process.env.SHOONYA_VENDOR_CODE!,
        process.env.SHOONYA_API_KEY!,
        process.env.SHOONYA_IMEI!,
        process.env.SHOONYA_TOTP_SECRET
      );

      const fyersCredentials = createFyersCredentials(
        process.env.FYERS_CLIENT_ID!,
        process.env.FYERS_SECRET_KEY!,
        process.env.FYERS_REDIRECT_URI!,
        process.env.FYERS_AUTH_CODE // Optional, for token exchange
      );

      // Authenticate with multiple brokers simultaneously
      const results = await this.api.authenticateMultipleBrokers([
        { broker: BrokerType.SHOONYA, credentials: shoonyaCredentials },
        { broker: BrokerType.FYERS, credentials: fyersCredentials }
      ]);

      // Check results
      for (const { broker, result } of results) {
        if (result.success) {
          console.log(`✅ ${broker} authentication successful`);
        } else {
          console.log(`❌ ${broker} authentication failed: ${result.message}`);
          
          // Handle OAuth flow for Fyers if needed
          if (result.requiresAuth && result.authUrl) {
            console.log(`🔗 Please complete OAuth for ${broker}: ${result.authUrl}`);
          }
        }
      }

    } catch (error) {
      console.error('Authentication error:', error);
    }
  }

  async placeTestOrders(): Promise<void> {
    console.log('📈 Placing test orders...');

    const orderRequest = {
      symbol: 'TCS-EQ',
      exchange: Exchange.NSE,
      orderType: OrderType.LIMIT,
      side: OrderSide.BUY,
      quantity: 1,
      price: 3500,
      productType: ProductType.INTRADAY,
      validity: 'DAY' as const,
      tag: 'test-order'
    };

    try {
      // Place order on specific broker
      const shoonyaResult = await this.api.placeOrder(BrokerType.SHOONYA, orderRequest);
      console.log('Shoonya order result:', shoonyaResult);

      // Place same order on multiple brokers
      const multiResults = await this.api.placeOrderMultipleBrokers(
        [BrokerType.SHOONYA, BrokerType.FYERS],
        {
          ...orderRequest,
          symbol: 'RELIANCE-EQ',
          price: 2500
        }
      );

      console.log('Multi-broker order results:', multiResults);

    } catch (error) {
      console.error('Order placement error:', error);
    }
  }

  async getPortfolioData(): Promise<void> {
    console.log('💼 Fetching portfolio data...');

    try {
      const activeBrokers = this.api.getActiveBrokers();

      for (const broker of activeBrokers) {
        console.log(`\n📊 ${broker} Portfolio:`);

        // Get positions
        const positions = await this.api.getPositions(broker);
        if (positions.success && positions.data) {
          console.log(`   Positions: ${positions.data.length}`);
          positions.data.forEach(pos => {
            console.log(`   - ${pos.symbol}: ${pos.quantity} @ ₹${pos.averagePrice} (P&L: ₹${pos.pnl})`);
          });
        }

        // Get holdings
        const holdings = await this.api.getHoldings(broker);
        if (holdings.success && holdings.data) {
          console.log(`   Holdings: ${holdings.data.length}`);
          holdings.data.forEach(holding => {
            console.log(`   - ${holding.symbol}: ${holding.quantity} @ ₹${holding.averagePrice}`);
          });
        }

        // Get orders
        const orders = await this.api.getOrders(broker);
        if (orders.success && orders.data) {
          console.log(`   Orders: ${orders.data.length}`);
          orders.data.forEach(order => {
            console.log(`   - ${order.symbol}: ${order.side} ${order.quantity} @ ₹${order.price} [${order.status}]`);
          });
        }
      }

    } catch (error) {
      console.error('Portfolio fetch error:', error);
    }
  }

  async getMarketData(): Promise<void> {
    console.log('📊 Fetching market data...');

    try {
      // Get quote for a specific symbol
      const quote = await this.api.getQuote('TCS-EQ', Exchange.NSE);
      if (quote.success && quote.data) {
        console.log(`TCS Quote: ₹${quote.data.lastPrice} (${quote.data.changePercentage}%)`);
      }

      // You can also get quotes from specific broker
      const fyersQuote = await this.api.getQuote('RELIANCE-EQ', Exchange.NSE, BrokerType.FYERS);
      if (fyersQuote.success && fyersQuote.data) {
        console.log(`Reliance Quote (Fyers): ₹${fyersQuote.data.lastPrice}`);
      }

    } catch (error) {
      console.error('Market data error:', error);
    }
  }

  async demonstrateRealTimeData(): Promise<void> {
    console.log('🔄 Setting up real-time data...');

    try {
      const activeBrokers = this.api.getActiveBrokers();

      for (const broker of activeBrokers) {
        // Subscribe to real-time quotes
        await this.api.subscribeToQuotes([
          { symbol: 'TCS-EQ', exchange: Exchange.NSE },
          { symbol: 'RELIANCE-EQ', exchange: Exchange.NSE },
          { symbol: 'INFY-EQ', exchange: Exchange.NSE }
        ]);

        // Subscribe to order updates
        await this.api.subscribeToOrderUpdates();
      }

      console.log('✅ Real-time subscriptions active');

    } catch (error) {
      console.error('Real-time setup error:', error);
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up...');

    try {
      // Logout from all brokers
      const logoutResults = await this.api.logoutAll();
      
      for (const { broker, result } of logoutResults) {
        if (result.success) {
          console.log(`✅ Logged out from ${broker}`);
        } else {
          console.log(`❌ Logout failed for ${broker}: ${result.message}`);
        }
      }

    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  getLibraryInfo(): void {
    const info = this.api.getLibraryInfo();
    console.log('📚 Library Info:', info);
  }
}

// Example usage
async function main() {
  const bot = new TradingBot();

  try {
    // Show library info
    bot.getLibraryInfo();

    // Authenticate with brokers
    await bot.authenticateWithBrokers();

    // Wait a bit for authentication to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get portfolio data
    await bot.getPortfolioData();

    // Get market data
    await bot.getMarketData();

    // Set up real-time data
    await bot.demonstrateRealTimeData();

    // Place test orders (uncomment to test)
    // await bot.placeTestOrders();

    // Keep running for real-time updates
    console.log('🔄 Bot is running... Press Ctrl+C to stop');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await bot.cleanup();
      process.exit(0);
    });

  } catch (error) {
    console.error('Main error:', error);
    await bot.cleanup();
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { TradingBot };
