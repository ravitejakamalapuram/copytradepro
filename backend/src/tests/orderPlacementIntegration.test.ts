/**
 * Integration Tests for Order Placement with Standardized Symbols
 * Tests order placement using standardized symbols
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { symbolValidationService } from '../services/symbolValidationService';
import { BrokerSymbolConverterFactory } from '../services/brokerSymbolConverters/BrokerSymbolConverterFactory';
import { CreateStandardizedSymbolData, StandardizedSymbol } from '../models/symbolModels';

// Mock broker services
const mockBrokerService = {
  placeOrder: jest.fn(),
  validateSession: jest.fn(),
  isConnected: jest.fn()
};

// unified manager removed; no mock needed

describe('Order Placement Integration', () => {
  let mongoServer: MongoMemoryServer;
  let testSymbols: StandardizedSymbol[];

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
    
    // Initialize the symbol database service
    await symbolDatabaseService.initialize();
  });

  afterAll(async () => {
    // Clean up
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections and set up test data
    await symbolDatabaseService.clearAllSymbols();
    jest.clearAllMocks();

    const symbolData: CreateStandardizedSymbolData[] = [
      {
        displayName: 'Tata Consultancy Services Ltd',
        tradingSymbol: 'TCS',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox',
        companyName: 'Tata Consultancy Services Ltd',
        sector: 'Information Technology'
      },
      {
        displayName: 'NIFTY 22000 CE 30 JAN 25',
        tradingSymbol: 'NIFTY25JAN22000CE',
        instrumentType: 'OPTION',
        exchange: 'NFO',
        segment: 'FO',
        underlying: 'NIFTY',
        strikePrice: 22000,
        optionType: 'CE',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        source: 'upstox'
      },
      {
        displayName: 'NIFTY FUT 30 JAN 25',
        tradingSymbol: 'NIFTY25JANFUT',
        instrumentType: 'FUTURE',
        exchange: 'NFO',
        segment: 'FO',
        underlying: 'NIFTY',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        source: 'upstox'
      }
    ];

    const upsertResult = await symbolDatabaseService.upsertSymbols(symbolData);
    expect(upsertResult.validSymbols).toBe(3);

    // Get the inserted symbols with their IDs
    const searchResult = await symbolDatabaseService.searchSymbolsWithFilters({
      isActive: true,
      limit: 10
    });
    testSymbols = searchResult.symbols;

    // Set up mock broker service defaults
    mockBrokerService.isConnected.mockReturnValue(true);
    mockBrokerService.validateSession.mockResolvedValue(true);
    mockBrokerService.placeOrder.mockResolvedValue({
      success: true,
      orderId: 'MOCK_ORDER_123',
      message: 'Order placed successfully'
    });
  });

  describe('Symbol Validation for Orders', () => {
    it('should validate standardized symbol ID for order placement', async () => {
      const tcsSymbol = testSymbols.find(s => s.tradingSymbol === 'TCS')!;
      
      const validation = await symbolValidationService.validateAndResolveSymbol(tcsSymbol.id);
      
      expect(validation.isValid).toBe(true);
      expect(validation.symbol).not.toBeNull();
      expect(validation.symbol!.tradingSymbol).toBe('TCS');
      expect(validation.isLegacyFormat).toBe(false);
    });

    it('should validate trading symbol for backward compatibility', async () => {
      const validation = await symbolValidationService.validateAndResolveSymbol('TCS', 'NSE');
      
      expect(validation.isValid).toBe(true);
      expect(validation.symbol).not.toBeNull();
      expect(validation.symbol!.tradingSymbol).toBe('TCS');
      // Legacy format property removed
    });

    it('should validate symbol for specific broker', async () => {
      const tcsSymbol = testSymbols.find(s => s.tradingSymbol === 'TCS')!;
      
      const validation = await symbolValidationService.validateSymbolForBroker(
        tcsSymbol.id, 
        'fyers'
      );
      
      expect(validation.isValid).toBe(true);
      expect(validation.symbol).not.toBeNull();
    });

    it('should reject symbol for unsupported broker exchange', async () => {
      // Create a symbol with unsupported exchange
      const unsupportedSymbol: CreateStandardizedSymbolData = {
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'UNKNOWN' as any,
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'test'
      };

      await symbolDatabaseService.upsertSymbols([unsupportedSymbol]);
      const symbol = await symbolDatabaseService.getSymbolByTradingSymbol('TEST');
      
      const validation = await symbolValidationService.validateSymbolForBroker(
        symbol!.id, 
        'fyers'
      );
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('does not support exchange');
    });
  });

  describe('Order Parameter Validation', () => {
    it('should validate correct order parameters for equity', async () => {
      const tcsSymbol = testSymbols.find(s => s.tradingSymbol === 'TCS')!;
      
      const orderParams = {
        quantity: 10, // Multiple of lot size (1)
        price: 3500.05, // Multiple of tick size (0.05)
        orderType: 'LIMIT'
      };

      const validation = symbolValidationService.validateOrderParameters(tcsSymbol, orderParams);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate correct order parameters for options', async () => {
      const optionSymbol = testSymbols.find(s => s.instrumentType === 'OPTION')!;
      
      const orderParams = {
        quantity: 50, // Multiple of lot size (50)
        price: 100.05, // Multiple of tick size (0.05)
        orderType: 'LIMIT'
      };

      const validation = symbolValidationService.validateOrderParameters(optionSymbol, orderParams);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid lot size multiples', async () => {
      const optionSymbol = testSymbols.find(s => s.instrumentType === 'OPTION')!;
      
      const orderParams = {
        quantity: 75, // Not multiple of lot size (50)
        orderType: 'MARKET'
      };

      const validation = symbolValidationService.validateOrderParameters(optionSymbol, orderParams);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Quantity must be in multiples of lot size 50');
    });

    it('should reject invalid tick size multiples', async () => {
      const tcsSymbol = testSymbols.find(s => s.tradingSymbol === 'TCS')!;
      
      const orderParams = {
        quantity: 10,
        price: 3500.03, // Not multiple of tick size (0.05)
        orderType: 'LIMIT'
      };

      const validation = symbolValidationService.validateOrderParameters(tcsSymbol, orderParams);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Price must be in multiples of tick size 0.05');
    });
  });

  describe('Symbol Format Conversion', () => {
    it('should convert equity symbol to Fyers format', async () => {
      const tcsSymbol = testSymbols.find(s => s.tradingSymbol === 'TCS')!;
      
      const fyersConverter = BrokerSymbolConverterFactory.getConverter('fyers');
      const convertedSymbol = fyersConverter.convertToBrokerFormat(tcsSymbol);
      
      expect(convertedSymbol.tradingSymbol).toBe('NSE:TCS-EQ');
      expect(convertedSymbol.exchange).toBe('NSE');
    });

    it('should convert option symbol to Fyers format', async () => {
      const optionSymbol = testSymbols.find(s => s.instrumentType === 'OPTION')!;
      
      const fyersConverter = BrokerSymbolConverterFactory.getConverter('fyers');
      const convertedSymbol = fyersConverter.convertToBrokerFormat(optionSymbol);
      
      expect(convertedSymbol.tradingSymbol).toBe('NFO:NIFTY25JAN22000CE');
      expect(convertedSymbol.exchange).toBe('NFO');
    });

    it('should convert equity symbol to Shoonya format', async () => {
      const tcsSymbol = testSymbols.find(s => s.tradingSymbol === 'TCS')!;
      
      const shoonyaConverter = BrokerSymbolConverterFactory.getConverter('shoonya');
      const convertedSymbol = shoonyaConverter.convertToBrokerFormat(tcsSymbol);
      
      expect(convertedSymbol.tradingSymbol).toBe('TCS');
      expect(convertedSymbol.exchange).toBe('NSE');
    });

    it('should convert option symbol to Shoonya format', async () => {
      const optionSymbol = testSymbols.find(s => s.instrumentType === 'OPTION')!;
      
      const shoonyaConverter = BrokerSymbolConverterFactory.getConverter('shoonya');
      const convertedSymbol = shoonyaConverter.convertToBrokerFormat(optionSymbol);
      
      expect(convertedSymbol.tradingSymbol).toBe('NIFTY25JAN22000CE');
      expect(convertedSymbol.exchange).toBe('NFO');
    });

    it('should handle symbol conversion errors gracefully', async () => {
      const unsupportedSymbol = {
        ...testSymbols[0],
        exchange: 'UNKNOWN' as any
      };
      
      const fyersConverter = BrokerSymbolConverterFactory.getConverter('fyers');
      
      expect(() => {
        fyersConverter.convertToBrokerFormat(unsupportedSymbol);
      }).toThrow('Fyers does not support exchange: UNKNOWN');
    });
  });

  describe('End-to-End Order Placement Flow', () => {
    it('should place equity order using standardized symbol ID', async () => {
      const tcsSymbol = testSymbols.find(s => s.tradingSymbol === 'TCS')!;
      
      // Step 1: Validate symbol
      const symbolValidation = await symbolValidationService.validateAndResolveSymbol(tcsSymbol.id);
      expect(symbolValidation.isValid).toBe(true);
      
      // Step 2: Validate order parameters
      const orderParams = {
        quantity: 10,
        price: 3500.05,
        orderType: 'LIMIT'
      };
      
      const paramValidation = symbolValidationService.validateOrderParameters(
        symbolValidation.symbol!, 
        orderParams
      );
      expect(paramValidation.isValid).toBe(true);
      
      // Step 3: Convert symbol for broker
      const fyersConverter = BrokerSymbolConverterFactory.getConverter('fyers');
      const brokerSymbol = fyersConverter.convertToBrokerFormat(symbolValidation.symbol!);
      
      // Step 4: Place order (mocked)
      const orderRequest = {
        symbol: brokerSymbol.tradingSymbol,
        action: 'BUY' as const,
        quantity: orderParams.quantity,
        orderType: orderParams.orderType as any,
        price: orderParams.price,
        exchange: brokerSymbol.exchange!,
        productType: 'CNC',
        validity: 'DAY' as const,
        accountId: 'TEST_ACCOUNT'
      };
      
      const orderResult = await mockBrokerService.placeOrder(orderRequest);
      
      expect(orderResult.success).toBe(true);
      expect(orderResult.orderId).toBe('MOCK_ORDER_123');
      expect(mockBrokerService.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'NSE:TCS-EQ',
          quantity: 10,
          price: 3500.05
        })
      );
    });

    it('should place option order using trading symbol (legacy)', async () => {
      // Step 1: Validate symbol using trading symbol
      const symbolValidation = await symbolValidationService.validateAndResolveSymbol(
        'NIFTY25JAN22000CE', 
        'NFO'
      );
      expect(symbolValidation.isValid).toBe(true);
      // Legacy format property removed
      
      // Step 2: Validate order parameters
      const orderParams = {
        quantity: 50,
        price: 100.05,
        orderType: 'LIMIT'
      };
      
      const paramValidation = symbolValidationService.validateOrderParameters(
        symbolValidation.symbol!, 
        orderParams
      );
      expect(paramValidation.isValid).toBe(true);
      
      // Step 3: Convert symbol for Shoonya broker
      const shoonyaConverter = BrokerSymbolConverterFactory.getConverter('shoonya');
      const brokerSymbol = shoonyaConverter.convertToBrokerFormat(symbolValidation.symbol!);
      
      // Step 4: Place order
      const orderRequest = {
        symbol: brokerSymbol.tradingSymbol,
        action: 'BUY' as const,
        quantity: orderParams.quantity,
        orderType: orderParams.orderType as any,
        price: orderParams.price,
        exchange: brokerSymbol.exchange!,
        productType: 'MIS',
        validity: 'DAY' as const,
        accountId: 'TEST_ACCOUNT'
      };
      
      const orderResult = await mockBrokerService.placeOrder(orderRequest);
      
      expect(orderResult.success).toBe(true);
      expect(mockBrokerService.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'NIFTY25JAN22000CE',
          exchange: 'NFO',
          quantity: 50
        })
      );
    });

    it('should handle order placement with validation errors', async () => {
      const tcsSymbol = testSymbols.find(s => s.tradingSymbol === 'TCS')!;
      
      // Invalid order parameters
      const orderParams = {
        quantity: 7, // Not multiple of lot size
        price: 3500.03, // Not multiple of tick size
        orderType: 'LIMIT'
      };
      
      const paramValidation = symbolValidationService.validateOrderParameters(
        tcsSymbol, 
        orderParams
      );
      
      expect(paramValidation.isValid).toBe(false);
      expect(paramValidation.errors).toHaveLength(1); // Only tick size error for equity (lot size 1 is fine)
      expect(paramValidation.errors[0]).toContain('tick size');
      
      // Should not place order with invalid parameters
      expect(mockBrokerService.placeOrder).not.toHaveBeenCalled();
    });

    it('should handle broker service errors', async () => {
      const tcsSymbol = testSymbols.find(s => s.tradingSymbol === 'TCS')!;
      
      // Mock broker service failure
      mockBrokerService.placeOrder.mockResolvedValue({
        success: false,
        error: 'Insufficient funds',
        message: 'Order placement failed'
      });
      
      const symbolValidation = await symbolValidationService.validateAndResolveSymbol(tcsSymbol.id);
      const fyersConverter = BrokerSymbolConverterFactory.getConverter('fyers');
      const brokerSymbol = fyersConverter.convertToBrokerFormat(symbolValidation.symbol!);
      
      const orderRequest = {
        symbol: brokerSymbol.tradingSymbol,
        action: 'BUY' as const,
        quantity: 10,
        orderType: 'MARKET' as any,
        exchange: brokerSymbol.exchange!,
        productType: 'CNC',
        validity: 'DAY' as const,
        accountId: 'TEST_ACCOUNT'
      };
      
      const orderResult = await mockBrokerService.placeOrder(orderRequest);
      
      expect(orderResult.success).toBe(false);
      expect(orderResult.error).toBe('Insufficient funds');
    });
  });

  describe('Symbol Information for Orders', () => {
    it('should provide comprehensive symbol info for order UI', async () => {
      const optionSymbol = testSymbols.find(s => s.instrumentType === 'OPTION')!;
      
      const symbolInfo = await symbolValidationService.getOrderSymbolInfo(optionSymbol.id);
      
      expect(symbolInfo).not.toBeNull();
      expect(symbolInfo!.standardizedSymbol).toEqual(optionSymbol);
      expect(symbolInfo!.originalInput).toBe(optionSymbol.id);
      expect(symbolInfo!.isStandardizedId).toBe(true);
      expect(symbolInfo!.validationWarnings).toHaveLength(0);
    });

    it('should provide display information for UI', async () => {
      const optionSymbol = testSymbols.find(s => s.instrumentType === 'OPTION')!;
      
      const displayInfo = symbolValidationService.getSymbolDisplayInfo(optionSymbol);
      
      expect(displayInfo.displayName).toBe('NIFTY 22000 CE 30 JAN 25');
      expect(displayInfo.description).toContain('OPTION on NFO');
      expect(displayInfo.description).toContain('Strike: 22000');
      expect(displayInfo.description).toContain('Type: CE');
      expect(displayInfo.description).toContain('Expiry: 2025-01-30');
      expect(displayInfo.tags).toContain('OPTION');
      expect(displayInfo.tags).toContain('NFO');
      expect(displayInfo.tags).toContain('Underlying: NIFTY');
    });

    it('should provide symbol suggestions for autocomplete', async () => {
      const suggestions = await symbolValidationService.getSymbolSuggestions('NIFTY', {
        instrumentType: 'OPTION',
        underlying: 'NIFTY'
      });
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].symbol.underlying).toBe('NIFTY');
      expect(suggestions[0].symbol.instrumentType).toBe('OPTION');
      expect(suggestions[0].reason).toContain('OPTION on NIFTY');
    });
  });

  describe('Performance Tests', () => {
    it('should validate and convert symbols quickly', async () => {
      const tcsSymbol = testSymbols.find(s => s.tradingSymbol === 'TCS')!;
      
      const startTime = Date.now();
      
      // Perform 100 validation and conversion operations
      for (let i = 0; i < 100; i++) {
        const validation = await symbolValidationService.validateAndResolveSymbol(tcsSymbol.id);
        if (validation.isValid) {
          const fyersConverter = BrokerSymbolConverterFactory.getConverter('fyers');
          fyersConverter.convertToBrokerFormat(validation.symbol!);
        }
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000); // Within 1 second for 100 operations
    });

    it('should handle concurrent order validations', async () => {
      const symbols = testSymbols.slice(0, 3);
      
      const validationPromises = symbols.map(symbol =>
        symbolValidationService.validateAndResolveSymbol(symbol.id)
      );
      
      const startTime = Date.now();
      const results = await Promise.all(validationPromises);
      const endTime = Date.now();
      
      // All validations should succeed
      results.forEach(result => {
        expect(result.isValid).toBe(true);
      });
      
      // Should complete quickly
      expect(endTime - startTime).toBeLessThan(500);
    });
  });
});