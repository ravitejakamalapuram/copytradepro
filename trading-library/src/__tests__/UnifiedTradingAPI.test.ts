/**
 * Unit Tests for Unified Trading API
 */

import { UnifiedTradingAPI } from '../core/UnifiedTradingAPI';
import { ShoonyaAdapter } from '../adapters/ShoonyaAdapter';
import { FyersAdapter } from '../adapters/FyersAdapter';
import {
  BrokerType,
  OrderType,
  OrderSide,
  ProductType,
  Exchange,
  UnifiedTradingConfig
} from '../types';

describe('UnifiedTradingAPI', () => {
  let api: UnifiedTradingAPI;
  let config: UnifiedTradingConfig;

  beforeEach(() => {
    config = {
      brokers: [],
      enableLogging: false,
      logLevel: 'error',
      retryAttempts: 1,
      timeout: 5000
    };
    api = new UnifiedTradingAPI(config);
  });

  afterEach(() => {
    // Clean up any active connections
  });

  describe('Broker Registration', () => {
    test('should register broker adapters', () => {
      const shoonyaAdapter = new ShoonyaAdapter();
      const fyersAdapter = new FyersAdapter();

      api.registerBroker(shoonyaAdapter);
      api.registerBroker(fyersAdapter);

      const registeredBrokers = api.getRegisteredBrokers();
      expect(registeredBrokers).toContain(BrokerType.SHOONYA);
      expect(registeredBrokers).toContain(BrokerType.FYERS);
    });

    test('should check if broker is registered', () => {
      const shoonyaAdapter = new ShoonyaAdapter();
      api.registerBroker(shoonyaAdapter);

      expect(api.isBrokerRegistered(BrokerType.SHOONYA)).toBe(true);
      expect(api.isBrokerRegistered(BrokerType.FYERS)).toBe(false);
    });
  });

  describe('Authentication', () => {
    test('should authenticate with Shoonya broker', async () => {
      const shoonyaAdapter = new ShoonyaAdapter();
      api.registerBroker(shoonyaAdapter);

      const credentials = {
        userId: 'test_user',
        password: 'test_password',
        vendorCode: 'test_vendor',
        apiKey: 'test_api_key',
        imei: 'test_imei'
      };

      // Mock the authentication method
      jest.spyOn(shoonyaAdapter, 'authenticate').mockResolvedValue({
        success: true,
        accessToken: 'mock_token',
        message: 'Authentication successful'
      });

      const result = await api.authenticateBroker(BrokerType.SHOONYA, credentials);

      expect(result.success).toBe(true);
      expect(api.isBrokerActive(BrokerType.SHOONYA)).toBe(true);
    });

    test('should handle authentication failure', async () => {
      const shoonyaAdapter = new ShoonyaAdapter();
      api.registerBroker(shoonyaAdapter);

      const credentials = {
        userId: 'invalid_user',
        password: 'invalid_password',
        vendorCode: 'test_vendor',
        apiKey: 'test_api_key',
        imei: 'test_imei'
      };

      // Mock authentication failure
      jest.spyOn(shoonyaAdapter, 'authenticate').mockResolvedValue({
        success: false,
        message: 'Invalid credentials'
      });

      const result = await api.authenticateBroker(BrokerType.SHOONYA, credentials);

      expect(result.success).toBe(false);
      expect(api.isBrokerActive(BrokerType.SHOONYA)).toBe(false);
    });

    test('should authenticate with multiple brokers', async () => {
      const shoonyaAdapter = new ShoonyaAdapter();
      const fyersAdapter = new FyersAdapter();
      
      api.registerBroker(shoonyaAdapter);
      api.registerBroker(fyersAdapter);

      // Mock successful authentication for both
      jest.spyOn(shoonyaAdapter, 'authenticate').mockResolvedValue({
        success: true,
        accessToken: 'shoonya_token',
        message: 'Authentication successful'
      });

      jest.spyOn(fyersAdapter, 'authenticate').mockResolvedValue({
        success: true,
        accessToken: 'fyers_token',
        message: 'Authentication successful'
      });

      const credentials = [
        {
          broker: BrokerType.SHOONYA,
          credentials: {
            userId: 'test_user',
            password: 'test_password',
            vendorCode: 'test_vendor',
            apiKey: 'test_api_key',
            imei: 'test_imei'
          }
        },
        {
          broker: BrokerType.FYERS,
          credentials: {
            clientId: 'test_client_id',
            secretKey: 'test_secret',
            redirectUri: 'test_redirect',
            authCode: 'test_auth_code'
          }
        }
      ];

      const results = await api.authenticateMultipleBrokers(credentials);

      expect(results).toHaveLength(2);
      expect(results[0].result.success).toBe(true);
      expect(results[1].result.success).toBe(true);
      expect(api.getActiveBrokers()).toContain(BrokerType.SHOONYA);
      expect(api.getActiveBrokers()).toContain(BrokerType.FYERS);
    });
  });

  describe('Order Management', () => {
    beforeEach(async () => {
      const shoonyaAdapter = new ShoonyaAdapter();
      api.registerBroker(shoonyaAdapter);

      // Mock authentication
      jest.spyOn(shoonyaAdapter, 'authenticate').mockResolvedValue({
        success: true,
        accessToken: 'mock_token',
        message: 'Authentication successful'
      });

      await api.authenticateBroker(BrokerType.SHOONYA, {
        userId: 'test_user',
        password: 'test_password',
        vendorCode: 'test_vendor',
        apiKey: 'test_api_key',
        imei: 'test_imei'
      });
    });

    test('should place order with specific broker', async () => {
      const shoonyaAdapter = api['brokers'].get(BrokerType.SHOONYA);
      
      const mockOrder = {
        orderId: 'test_order_123',
        symbol: 'TCS-EQ',
        exchange: Exchange.NSE,
        orderType: OrderType.MARKET,
        side: OrderSide.BUY,
        quantity: 10,
        productType: ProductType.INTRADAY,
        status: 'PENDING' as any,
        filledQuantity: 0,
        timestamp: new Date(),
        broker: BrokerType.SHOONYA
      };

      jest.spyOn(shoonyaAdapter!, 'placeOrder').mockResolvedValue({
        success: true,
        data: mockOrder,
        message: 'Order placed successfully',
        timestamp: new Date()
      });

      const orderRequest = {
        symbol: 'TCS-EQ',
        exchange: Exchange.NSE,
        orderType: OrderType.MARKET,
        side: OrderSide.BUY,
        quantity: 10,
        productType: ProductType.INTRADAY
      };

      const result = await api.placeOrder(BrokerType.SHOONYA, orderRequest);

      expect(result.success).toBe(true);
      expect(result.data?.orderId).toBe('test_order_123');
    });

    test('should place order across multiple brokers', async () => {
      const fyersAdapter = new FyersAdapter();
      api.registerBroker(fyersAdapter);

      // Mock authentication for Fyers
      jest.spyOn(fyersAdapter, 'authenticate').mockResolvedValue({
        success: true,
        accessToken: 'fyers_token',
        message: 'Authentication successful'
      });

      await api.authenticateBroker(BrokerType.FYERS, {
        clientId: 'test_client_id',
        secretKey: 'test_secret',
        redirectUri: 'test_redirect',
        authCode: 'test_auth_code'
      });

      // Mock order placement for both brokers
      const shoonyaAdapter = api['brokers'].get(BrokerType.SHOONYA);
      const mockShoonyaOrder = {
        orderId: 'shoonya_order_123',
        symbol: 'TCS-EQ',
        exchange: Exchange.NSE,
        orderType: OrderType.MARKET,
        side: OrderSide.BUY,
        quantity: 10,
        productType: ProductType.INTRADAY,
        status: 'PENDING' as any,
        filledQuantity: 0,
        timestamp: new Date(),
        broker: BrokerType.SHOONYA
      };

      const mockFyersOrder = {
        ...mockShoonyaOrder,
        orderId: 'fyers_order_123',
        broker: BrokerType.FYERS
      };

      jest.spyOn(shoonyaAdapter!, 'placeOrder').mockResolvedValue({
        success: true,
        data: mockShoonyaOrder,
        message: 'Order placed successfully',
        timestamp: new Date()
      });

      jest.spyOn(fyersAdapter, 'placeOrder').mockResolvedValue({
        success: true,
        data: mockFyersOrder,
        message: 'Order placed successfully',
        timestamp: new Date()
      });

      const orderRequest = {
        symbol: 'TCS-EQ',
        exchange: Exchange.NSE,
        orderType: OrderType.MARKET,
        side: OrderSide.BUY,
        quantity: 10,
        productType: ProductType.INTRADAY
      };

      const results = await api.placeOrderMultipleBrokers(
        [BrokerType.SHOONYA, BrokerType.FYERS],
        orderRequest
      );

      expect(results).toHaveLength(2);
      expect(results[0].result.success).toBe(true);
      expect(results[1].result.success).toBe(true);
      expect(results[0].result.data?.orderId).toBe('shoonya_order_123');
      expect(results[1].result.data?.orderId).toBe('fyers_order_123');
    });
  });

  describe('Error Handling', () => {
    test('should throw error for unregistered broker', async () => {
      await expect(
        api.authenticateBroker(BrokerType.SHOONYA, {})
      ).rejects.toThrow('Broker shoonya is not registered');
    });

    test('should throw error for unauthenticated broker', async () => {
      const shoonyaAdapter = new ShoonyaAdapter();
      api.registerBroker(shoonyaAdapter);

      const orderRequest = {
        symbol: 'TCS-EQ',
        exchange: Exchange.NSE,
        orderType: OrderType.MARKET,
        side: OrderSide.BUY,
        quantity: 10,
        productType: ProductType.INTRADAY
      };

      await expect(
        api.placeOrder(BrokerType.SHOONYA, orderRequest)
      ).rejects.toThrow('Broker shoonya is not authenticated');
    });
  });

  describe('Library Info', () => {
    test('should return library information', () => {
      const info = api.getLibraryInfo();

      expect(info.name).toBe('@copytradepro/unified-trading-api');
      expect(info.version).toBe('1.0.0');
      expect(info.registeredBrokers).toEqual([]);
      expect(info.activeBrokers).toEqual([]);
    });

    test('should update library info after broker registration', () => {
      const shoonyaAdapter = new ShoonyaAdapter();
      api.registerBroker(shoonyaAdapter);

      const info = api.getLibraryInfo();
      expect(info.registeredBrokers).toContain(BrokerType.SHOONYA);
    });
  });
});
