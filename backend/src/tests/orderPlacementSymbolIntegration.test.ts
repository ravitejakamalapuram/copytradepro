/**
 * Integration tests for order placement with standardized symbols
 * Tests the integration between order controllers and symbol validation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { symbolValidationService } from '../services/symbolValidationService';
import { StandardizedSymbol } from '../models/symbolModels';
import { authenticateToken } from '../middleware/auth';
import symbolRoutes from '../routes/symbols';

// Mock the broker services and database
jest.mock('../services/databaseCompatibility');
jest.mock('../services/enhancedUnifiedBrokerManager');
jest.mock('../helpers/brokerConnectionHelper');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req: any, res, next) => {
  req.user = { id: 'test-user-id' };
  next();
});

app.use('/api/symbols', symbolRoutes);

describe('Order Placement Symbol Integration', () => {
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
        displayName: 'EXPIRED OPTION',
        tradingSymbol: 'NIFTY24DEC22000CE',
        instrumentType: 'OPTION',
        exchange: 'NSE',
        segment: 'FO',
        underlying: 'NIFTY',
        strikePrice: 22000,
        optionType: 'CE',
        expiryDate: '2024-12-31', // Expired
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-30T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-30T00:00:00Z'
      },
      {
        id: '507f1f77bcf86cd799439014',
        displayName: 'INACTIVE SYMBOL',
        tradingSymbol: 'INACTIVE',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: false, // Inactive
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

  describe('Symbol Validation API', () => {
    it('should validate standardized symbol ID successfully', async () => {
      const response = await request(app)
        .post('/api/symbols/validate')
        .send({
          symbol: '507f1f77bcf86cd799439011', // RELIANCE ID
          brokerName: 'fyers'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.symbol.tradingSymbol).toBe('RELIANCE');
      expect(response.body.data.isLegacyFormat).toBe(false);
    });

    it('should validate trading symbol successfully', async () => {
      const response = await request(app)
        .post('/api/symbols/validate')
        .send({
          symbol: 'RELIANCE',
          exchange: 'NSE',
          brokerName: 'fyers'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.symbol.tradingSymbol).toBe('RELIANCE');
      expect(response.body.data.isLegacyFormat).toBe(true);
    });

    it('should reject inactive symbols', async () => {
      const response = await request(app)
        .post('/api/symbols/validate')
        .send({
          symbol: '507f1f77bcf86cd799439014', // INACTIVE symbol ID
          brokerName: 'fyers'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not active for trading');
    });

    it('should reject non-existent symbols', async () => {
      const response = await request(app)
        .post('/api/symbols/validate')
        .send({
          symbol: '507f1f77bcf86cd799439999', // Non-existent ID
          brokerName: 'fyers'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should validate broker compatibility', async () => {
      const response = await request(app)
        .post('/api/symbols/validate')
        .send({
          symbol: 'RELIANCE',
          exchange: 'NSE',
          brokerName: 'fyers'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should provide symbol display information', async () => {
      const response = await request(app)
        .post('/api/symbols/validate')
        .send({
          symbol: '507f1f77bcf86cd799439012', // NIFTY option ID
          brokerName: 'fyers'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.displayInfo).toBeDefined();
      expect(response.body.data.displayInfo.displayName).toBe('NIFTY 22000 CE 30 JAN 25');
      expect(response.body.data.displayInfo.tags).toContain('OPTION');
      expect(response.body.data.displayInfo.tags).toContain('NSE');
    });
  });

  describe('Batch Symbol Validation', () => {
    it('should validate multiple symbols successfully', async () => {
      const response = await request(app)
        .post('/api/symbols/batch-validate')
        .send({
          symbols: [
            { symbol: 'RELIANCE', exchange: 'NSE' },
            { symbol: '507f1f77bcf86cd799439012' }, // NIFTY option ID
            { symbol: 'UNKNOWN_SYMBOL', exchange: 'NSE' }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.valid).toBe(3); // All should be valid (unknown symbol allowed for backward compatibility)
      expect(response.body.data.results).toHaveLength(3);
    });

    it('should reject batch with too many symbols', async () => {
      const symbols = Array.from({ length: 51 }, (_, i) => ({ symbol: `SYMBOL${i}`, exchange: 'NSE' }));
      
      const response = await request(app)
        .post('/api/symbols/batch-validate')
        .send({ symbols });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Maximum 50 symbols');
    });
  });

  describe('Symbol Validation Service', () => {
    it('should validate order parameters against symbol constraints', async () => {
      const symbol = testSymbols[1]!; // NIFTY option with lot size 50
      
      // Valid quantity (multiple of lot size)
      const validParams = symbolValidationService.validateOrderParameters(symbol, {
        quantity: 100, // 2 lots
        price: 100.05, // Multiple of tick size
        orderType: 'LIMIT'
      });
      
      expect(validParams.isValid).toBe(true);
      expect(validParams.errors).toHaveLength(0);

      // Invalid quantity (not multiple of lot size)
      const invalidQuantityParams = symbolValidationService.validateOrderParameters(symbol, {
        quantity: 75, // Not multiple of 50
        price: 100.05,
        orderType: 'LIMIT'
      });
      
      expect(invalidQuantityParams.isValid).toBe(false);
      expect(invalidQuantityParams.errors).toContain('Quantity must be in multiples of lot size 50');

      // Invalid price (not multiple of tick size)
      const invalidPriceParams = symbolValidationService.validateOrderParameters(symbol, {
        quantity: 100,
        price: 100.03, // Not multiple of 0.05
        orderType: 'LIMIT'
      });
      
      expect(invalidPriceParams.isValid).toBe(false);
      expect(invalidPriceParams.errors).toContain('Price must be in multiples of tick size 0.05');
    });

    it('should detect expired symbols', async () => {
      const expiredSymbol = testSymbols[2]!; // Expired option
      
      const params = symbolValidationService.validateOrderParameters(expiredSymbol, {
        quantity: 50,
        orderType: 'MARKET'
      });
      
      expect(params.isValid).toBe(false);
      expect(params.errors).toContain('Symbol has expired on 2024-12-31');
    });

    it('should provide symbol suggestions', async () => {
      const suggestions = await symbolValidationService.getSymbolSuggestions('NIFTY', {
        instrumentType: 'OPTION',
        underlying: 'NIFTY'
      });

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      
      if (suggestions.length > 0) {
        expect(suggestions[0]).toHaveProperty('symbol');
        expect(suggestions[0]).toHaveProperty('reason');
      }
    });

    it('should search symbols for autocomplete', async () => {
      const results = await symbolValidationService.searchSymbolsForInput('REL', 'NSE', 'EQUITY', 5);

      expect(Array.isArray(results)).toBe(true);
      
      if (results.length > 0) {
        expect(results[0]!.tradingSymbol).toContain('REL');
      }
    });
  });

  describe('Symbol ID Detection', () => {
    it('should correctly identify standardized symbol IDs', async () => {
      const validation = await symbolValidationService.validateAndResolveSymbol('507f1f77bcf86cd799439011');
      
      expect(validation.isValid).toBe(true);
      expect(validation.isLegacyFormat).toBe(false);
      expect(validation.symbol?.tradingSymbol).toBe('RELIANCE');
    });

    it('should correctly identify trading symbols', async () => {
      const validation = await symbolValidationService.validateAndResolveSymbol('RELIANCE', 'NSE');
      
      expect(validation.isValid).toBe(true);
      expect(validation.isLegacyFormat).toBe(true);
      expect(validation.symbol?.tradingSymbol).toBe('RELIANCE');
    });

    it('should handle unknown symbols gracefully', async () => {
      const validation = await symbolValidationService.validateAndResolveSymbol('UNKNOWN_SYMBOL', 'NSE');
      
      expect(validation.isValid).toBe(true);
      expect(validation.isLegacyFormat).toBe(true);
      expect(validation.error).toContain('not found in standardized database');
    });
  });

  describe('Broker Compatibility', () => {
    it('should validate symbol for specific broker', async () => {
      const validation = await symbolValidationService.validateSymbolForBroker('RELIANCE', 'fyers', 'NSE');
      
      expect(validation.isValid).toBe(true);
      expect(validation.symbol?.exchange).toBe('NSE');
    });

    it('should reject unsupported exchanges for broker', async () => {
      // Create a symbol with unsupported exchange
      const unsupportedSymbol: StandardizedSymbol = {
        id: '507f1f77bcf86cd799439015',
        displayName: 'UNSUPPORTED',
        tradingSymbol: 'UNSUPPORTED',
        instrumentType: 'EQUITY',
        exchange: 'UNKNOWN' as any,
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-30T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-30T00:00:00Z'
      };

      await symbolDatabaseService.createSymbol(unsupportedSymbol);

      const validation = await symbolValidationService.validateSymbolForBroker('507f1f77bcf86cd799439015', 'fyers');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('does not support exchange UNKNOWN');

      // Clean up
      await symbolDatabaseService.deleteSymbol(unsupportedSymbol.id);
    });
  });

  describe('Error Handling', () => {
    it('should handle database service unavailable', async () => {
      // Mock database service as not ready
      const originalIsReady = symbolDatabaseService.isReady;
      symbolDatabaseService.isReady = jest.fn().mockReturnValue(false);

      const validation = await symbolValidationService.validateAndResolveSymbol('RELIANCE');
      
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Symbol database service not available');

      // Restore original method
      symbolDatabaseService.isReady = originalIsReady;
    });

    it('should handle validation API errors gracefully', async () => {
      const response = await request(app)
        .post('/api/symbols/validate')
        .send({
          symbol: '', // Empty symbol
          brokerName: 'fyers'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    it('should handle batch validation API errors gracefully', async () => {
      const response = await request(app)
        .post('/api/symbols/batch-validate')
        .send({
          symbols: [] // Empty array
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });
});