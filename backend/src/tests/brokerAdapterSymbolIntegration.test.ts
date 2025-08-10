/**
 * Integration tests for broker adapter symbol conversion
 * Tests the integration between broker adapters and standardized symbol system
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { FyersServiceAdapter } from '../../../dev-packages/broker-fyers/src/FyersServiceAdapter';
import { ShoonyaServiceAdapter } from '../../../dev-packages/broker-shoonya/src/ShoonyaServiceAdapter';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { BrokerSymbolConverterFactory } from '../services/brokerSymbolConverters/BrokerSymbolConverterFactory';
import { StandardizedSymbol } from '../models/symbolModels';
import mongoose from 'mongoose';

// Mock the broker services to avoid actual API calls
jest.mock('../../../dev-packages/unified-broker/src/services/fyersService');
jest.mock('../../../dev-packages/unified-broker/src/services/shoonyaService');

describe('Broker Adapter Symbol Integration', () => {
  let fyersAdapter: FyersServiceAdapter;
  let shoonyaAdapter: ShoonyaServiceAdapter;
  let testSymbols: StandardizedSymbol[];

  beforeAll(async () => {
    // Initialize database connection for testing
    if (!mongoose.connection.readyState) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copytrade_test');
    }

    // Initialize symbol database service
    await symbolDatabaseService.initialize();

    // Create test symbols
    testSymbols = [
      {
        id: '507f1f77bcf86cd799439011',
        displayName: 'RELIANCE',
        tradingSymbol: 'RELIANCE',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-30T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-30T00:00:00Z'
      },
      {
        id: '507f1f77bcf86cd799439012',
        displayName: 'NIFTY 22000 CE 30 JAN 25',
        tradingSymbol: 'NIFTY25JAN22000CE',
        instrumentType: 'OPTION',
        exchange: 'NSE',
        segment: 'FO',
        underlying: 'NIFTY',
        strikePrice: 22000,
        optionType: 'CE',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-30T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-30T00:00:00Z'
      },
      {
        id: '507f1f77bcf86cd799439013',
        displayName: 'NIFTY JAN FUT',
        tradingSymbol: 'NIFTY25JANFUT',
        instrumentType: 'FUTURE',
        exchange: 'NSE',
        segment: 'FO',
        underlying: 'NIFTY',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-30T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-30T00:00:00Z'
      }
    ];

    // Insert test symbols into database
    for (const symbol of testSymbols) {
      await symbolDatabaseService.createSymbol(symbol);
    }
  });

  beforeEach(() => {
    fyersAdapter = new FyersServiceAdapter();
    shoonyaAdapter = new ShoonyaServiceAdapter();
  });

  afterAll(async () => {
    // Clean up test data
    if (symbolDatabaseService.isReady()) {
      for (const symbol of testSymbols) {
        await symbolDatabaseService.deleteSymbol(symbol.id);
      }
    }

    // Close database connection
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
    }
  });

  describe('FyersServiceAdapter Symbol Integration', () => {
    it('should convert standardized equity symbol to Fyers format', async () => {
      const mockPlaceOrder = jest.fn().mockResolvedValue({ s: 'ok', id: 'test-order-id', message: 'Order placed' });
      (fyersAdapter as any).fyersService.placeOrder = mockPlaceOrder;

      const orderRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        orderType: 'MARKET' as const,
        exchange: 'NSE',
        productType: 'CNC',
        validity: 'DAY' as const,
        accountId: 'test-account'
      };

      await fyersAdapter.placeOrder(orderRequest);

      // Verify that the order was placed with Fyers-formatted symbol
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'NSE:RELIANCE-EQ'
        })
      );
    });

    it('should convert standardized option symbol to Fyers format', async () => {
      const mockPlaceOrder = jest.fn().mockResolvedValue({ s: 'ok', id: 'test-order-id', message: 'Order placed' });
      (fyersAdapter as any).fyersService.placeOrder = mockPlaceOrder;

      const orderRequest = {
        symbol: 'NIFTY25JAN22000CE',
        action: 'BUY' as const,
        quantity: 50,
        orderType: 'MARKET' as const,
        exchange: 'NSE',
        productType: 'MIS',
        validity: 'DAY' as const,
        accountId: 'test-account'
      };

      await fyersAdapter.placeOrder(orderRequest);

      // Verify that the order was placed with Fyers-formatted symbol
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'NSE:NIFTY25JAN22000CE'
        })
      );
    });

    it('should convert standardized future symbol to Fyers format', async () => {
      const mockPlaceOrder = jest.fn().mockResolvedValue({ s: 'ok', id: 'test-order-id', message: 'Order placed' });
      (fyersAdapter as any).fyersService.placeOrder = mockPlaceOrder;

      const orderRequest = {
        symbol: 'NIFTY25JANFUT',
        action: 'BUY' as const,
        quantity: 50,
        orderType: 'MARKET' as const,
        exchange: 'NSE',
        productType: 'MIS',
        validity: 'DAY' as const,
        accountId: 'test-account'
      };

      await fyersAdapter.placeOrder(orderRequest);

      // Verify that the order was placed with Fyers-formatted symbol
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'NSE:NIFTY25JANFUT'
        })
      );
    });

    it('should fallback to legacy formatting for unknown symbols', async () => {
      const mockPlaceOrder = jest.fn().mockResolvedValue({ s: 'ok', id: 'test-order-id', message: 'Order placed' });
      (fyersAdapter as any).fyersService.placeOrder = mockPlaceOrder;

      const orderRequest = {
        symbol: 'UNKNOWN_SYMBOL',
        action: 'BUY' as const,
        quantity: 10,
        orderType: 'MARKET' as const,
        exchange: 'NSE',
        productType: 'CNC',
        validity: 'DAY' as const,
        accountId: 'test-account'
      };

      await fyersAdapter.placeOrder(orderRequest);

      // Verify that the order was placed with fallback format
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'NSE:UNKNOWN_SYMBOL'
        })
      );
    });

    it('should handle quote requests with standardized symbols', async () => {
      const mockGetQuotes = jest.fn().mockResolvedValue([{
        symbol: 'NSE:RELIANCE-EQ',
        ltp: 2500,
        chng: 25,
        chngPercent: 1.0,
        volume: 1000000
      }]);
      (fyersAdapter as any).fyersService.getQuotes = mockGetQuotes;

      const quote = await fyersAdapter.getQuote('RELIANCE', 'NSE');

      expect(mockGetQuotes).toHaveBeenCalledWith(['NSE:RELIANCE-EQ']);
      expect(quote.symbol).toBe('NSE:RELIANCE-EQ');
      expect(quote.price).toBe(2500);
    });
  });

  describe('ShoonyaServiceAdapter Symbol Integration', () => {
    it('should convert standardized equity symbol to Shoonya format', async () => {
      const mockPlaceOrder = jest.fn().mockResolvedValue({ stat: 'Ok', norenordno: 'test-order-id', result: 'Order placed' });
      (shoonyaAdapter as any).shoonyaService.placeOrder = mockPlaceOrder;

      const orderRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        orderType: 'MARKET' as const,
        exchange: 'NSE',
        productType: 'CNC',
        validity: 'DAY' as const,
        accountId: 'test-account'
      };

      await shoonyaAdapter.placeOrder(orderRequest);

      // Verify that the order was placed with Shoonya-formatted symbol
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          tradingSymbol: 'RELIANCE',
          exchange: 'NSE'
        })
      );
    });

    it('should convert standardized option symbol to Shoonya format', async () => {
      const mockPlaceOrder = jest.fn().mockResolvedValue({ stat: 'Ok', norenordno: 'test-order-id', result: 'Order placed' });
      (shoonyaAdapter as any).shoonyaService.placeOrder = mockPlaceOrder;

      const orderRequest = {
        symbol: 'NIFTY25JAN22000CE',
        action: 'BUY' as const,
        quantity: 50,
        orderType: 'MARKET' as const,
        exchange: 'NSE',
        productType: 'MIS',
        validity: 'DAY' as const,
        accountId: 'test-account'
      };

      await shoonyaAdapter.placeOrder(orderRequest);

      // Verify that the order was placed with Shoonya-formatted symbol and exchange mapping
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          tradingSymbol: 'NIFTY25JAN22000CE',
          exchange: 'NFO' // NSE options trade on NFO
        })
      );
    });

    it('should convert standardized future symbol to Shoonya format', async () => {
      const mockPlaceOrder = jest.fn().mockResolvedValue({ stat: 'Ok', norenordno: 'test-order-id', result: 'Order placed' });
      (shoonyaAdapter as any).shoonyaService.placeOrder = mockPlaceOrder;

      const orderRequest = {
        symbol: 'NIFTY25JANFUT',
        action: 'BUY' as const,
        quantity: 50,
        orderType: 'MARKET' as const,
        exchange: 'NSE',
        productType: 'MIS',
        validity: 'DAY' as const,
        accountId: 'test-account'
      };

      await shoonyaAdapter.placeOrder(orderRequest);

      // Verify that the order was placed with Shoonya-formatted symbol and exchange mapping
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          tradingSymbol: 'NIFTY25JANFUT',
          exchange: 'NFO' // NSE futures trade on NFO
        })
      );
    });

    it('should fallback to legacy formatting for unknown symbols', async () => {
      const mockPlaceOrder = jest.fn().mockResolvedValue({ stat: 'Ok', norenordno: 'test-order-id', result: 'Order placed' });
      (shoonyaAdapter as any).shoonyaService.placeOrder = mockPlaceOrder;

      const orderRequest = {
        symbol: 'UNKNOWN_SYMBOL',
        action: 'BUY' as const,
        quantity: 10,
        orderType: 'MARKET' as const,
        exchange: 'NSE',
        productType: 'CNC',
        validity: 'DAY' as const,
        accountId: 'test-account'
      };

      await shoonyaAdapter.placeOrder(orderRequest);

      // Verify that the order was placed with fallback format
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          tradingSymbol: 'UNKNOWN_SYMBOL-EQ', // NSE equity fallback adds -EQ
          exchange: 'NSE'
        })
      );
    });

    it('should handle quote requests with standardized symbols', async () => {
      const mockGetQuotes = jest.fn().mockResolvedValue({
        tsym: 'RELIANCE',
        lp: '2500',
        c: '25',
        pc: '1.0',
        v: '1000000',
        exch: 'NSE'
      });
      (shoonyaAdapter as any).shoonyaService.getQuotes = mockGetQuotes;

      const quote = await shoonyaAdapter.getQuote('RELIANCE', 'NSE');

      expect(mockGetQuotes).toHaveBeenCalledWith('NSE', 'RELIANCE');
      expect(quote.symbol).toBe('RELIANCE');
      expect(quote.price).toBe(2500);
    });
  });

  describe('Symbol Converter Factory Integration', () => {
    it('should have Fyers converter registered', () => {
      expect(BrokerSymbolConverterFactory.hasConverter('fyers')).toBe(true);
    });

    it('should have Shoonya converter registered', () => {
      expect(BrokerSymbolConverterFactory.hasConverter('shoonya')).toBe(true);
    });

    it('should convert symbols correctly for both brokers', () => {
      const equitySymbol = testSymbols[0]!;
      const optionSymbol = testSymbols[1]!;

      // Test Fyers conversion
      const fyersEquity = BrokerSymbolConverterFactory.convertSymbol(equitySymbol, 'fyers');
      expect(fyersEquity.tradingSymbol).toBe('NSE:RELIANCE-EQ');

      const fyersOption = BrokerSymbolConverterFactory.convertSymbol(optionSymbol, 'fyers');
      expect(fyersOption.tradingSymbol).toBe('NSE:NIFTY25JAN22000CE');

      // Test Shoonya conversion
      const shoonyaEquity = BrokerSymbolConverterFactory.convertSymbol(equitySymbol, 'shoonya');
      expect(shoonyaEquity.tradingSymbol).toBe('RELIANCE');
      expect(shoonyaEquity.exchange).toBe('NSE');

      const shoonyaOption = BrokerSymbolConverterFactory.convertSymbol(optionSymbol, 'shoonya');
      expect(shoonyaOption.tradingSymbol).toBe('NIFTY25JAN22000CE');
      expect(shoonyaOption.exchange).toBe('NFO');
    });
  });

  describe('Error Handling', () => {
    it('should handle database service unavailable gracefully', async () => {
      // Mock database service as not ready
      const originalIsReady = symbolDatabaseService.isReady;
      symbolDatabaseService.isReady = jest.fn().mockReturnValue(false);

      const mockPlaceOrder = jest.fn().mockResolvedValue({ s: 'ok', id: 'test-order-id', message: 'Order placed' });
      (fyersAdapter as any).fyersService.placeOrder = mockPlaceOrder;

      const orderRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        orderType: 'MARKET' as const,
        exchange: 'NSE',
        productType: 'CNC',
        validity: 'DAY' as const,
        accountId: 'test-account'
      };

      await fyersAdapter.placeOrder(orderRequest);

      // Should fallback to legacy formatting
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'NSE:RELIANCE-EQ'
        })
      );

      // Restore original method
      symbolDatabaseService.isReady = originalIsReady;
    });

    it('should handle symbol lookup errors gracefully', async () => {
      // Mock database service to throw error
      const originalGetSymbol = symbolDatabaseService.getSymbolByTradingSymbol;
      symbolDatabaseService.getSymbolByTradingSymbol = jest.fn().mockRejectedValue(new Error('Database error'));

      const mockPlaceOrder = jest.fn().mockResolvedValue({ s: 'ok', id: 'test-order-id', message: 'Order placed' });
      (fyersAdapter as any).fyersService.placeOrder = mockPlaceOrder;

      const orderRequest = {
        symbol: 'RELIANCE',
        action: 'BUY' as const,
        quantity: 10,
        orderType: 'MARKET' as const,
        exchange: 'NSE',
        productType: 'CNC',
        validity: 'DAY' as const,
        accountId: 'test-account'
      };

      await fyersAdapter.placeOrder(orderRequest);

      // Should fallback to legacy formatting
      expect(mockPlaceOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'NSE:RELIANCE-EQ'
        })
      );

      // Restore original method
      symbolDatabaseService.getSymbolByTradingSymbol = originalGetSymbol;
    });
  });
});