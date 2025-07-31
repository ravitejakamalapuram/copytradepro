/**
 * Integration Tests for Symbol API Endpoints
 * Tests API endpoints with various query combinations
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { CreateStandardizedSymbolData } from '../models/symbolModels';

// Import routes
import symbolRoutes from '../routes/symbols';

describe('Symbol API Endpoints Integration', () => {
  let app: express.Application;
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
    
    // Initialize the symbol database service
    await symbolDatabaseService.initialize();

    // Set up Express app with routes
    app = express();
    app.use(express.json());
    app.use('/api/symbols', symbolRoutes);
  });

  afterAll(async () => {
    // Clean up
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections and set up test data before each test
    await symbolDatabaseService.clearAllSymbols();
    
    const testSymbols: CreateStandardizedSymbolData[] = [
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
        sector: 'Information Technology',
        isin: 'INE467B01029'
      },
      {
        displayName: 'Infosys Ltd',
        tradingSymbol: 'INFY',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox',
        companyName: 'Infosys Ltd',
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
        displayName: 'NIFTY 21500 PE 30 JAN 25',
        tradingSymbol: 'NIFTY25JAN21500PE',
        instrumentType: 'OPTION',
        exchange: 'NFO',
        segment: 'FO',
        underlying: 'NIFTY',
        strikePrice: 21500,
        optionType: 'PE',
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

    await symbolDatabaseService.upsertSymbols(testSymbols);
  });

  describe('GET /api/symbols/search', () => {
    it('should search symbols by query parameter', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ q: 'TCS' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toHaveLength(1);
      expect(response.body.data.symbols[0].tradingSymbol).toBe('TCS');
      expect(response.body.data.total).toBe(1);
    });

    it('should filter symbols by instrument type', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ instrumentType: 'EQUITY' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toHaveLength(2);
      expect(response.body.data.symbols.every((s: any) => s.instrumentType === 'EQUITY')).toBe(true);
    });

    it('should filter symbols by exchange', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ exchange: 'NFO' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toHaveLength(3); // 2 options + 1 future
      expect(response.body.data.symbols.every((s: any) => s.exchange === 'NFO')).toBe(true);
    });

    it('should filter options by underlying', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ underlying: 'NIFTY' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toHaveLength(3);
      expect(response.body.data.symbols.every((s: any) => s.underlying === 'NIFTY')).toBe(true);
    });

    it('should filter options by strike price range', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ 
          instrumentType: 'OPTION',
          strikeMin: 21000,
          strikeMax: 22000
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toHaveLength(2);
      expect(response.body.data.symbols.every((s: any) => 
        s.strikePrice >= 21000 && s.strikePrice <= 22000
      )).toBe(true);
    });

    it('should filter options by option type', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ 
          instrumentType: 'OPTION',
          optionType: 'CE'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toHaveLength(1);
      expect(response.body.data.symbols[0].optionType).toBe('CE');
    });

    it('should combine multiple filters', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ 
          instrumentType: 'OPTION',
          underlying: 'NIFTY',
          optionType: 'PE',
          exchange: 'NFO'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toHaveLength(1);
      expect(response.body.data.symbols[0].tradingSymbol).toBe('NIFTY25JAN21500PE');
    });

    it('should handle pagination', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ 
          limit: 2,
          offset: 0
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toHaveLength(2);
      expect(response.body.data.total).toBe(5);
      expect(response.body.data.hasMore).toBe(true);
    });

    it('should handle empty results', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ q: 'NONEXISTENT' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toHaveLength(0);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.hasMore).toBe(false);
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ 
          instrumentType: 'INVALID_TYPE',
          limit: -1
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });
  });

  describe('GET /api/symbols/:id', () => {
    it('should get symbol by valid ID', async () => {
      // First get a symbol to obtain its ID
      const searchResponse = await request(app)
        .get('/api/symbols/search')
        .query({ q: 'TCS' });

      const symbolId = searchResponse.body.data.symbols[0].id;

      const response = await request(app)
        .get(`/api/symbols/${symbolId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(symbolId);
      expect(response.body.data.tradingSymbol).toBe('TCS');
    });

    it('should return 404 for non-existent symbol ID', async () => {
      const response = await request(app)
        .get('/api/symbols/507f1f77bcf86cd799439999')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Symbol not found');
    });

    it('should return 400 for invalid symbol ID format', async () => {
      const response = await request(app)
        .get('/api/symbols/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid symbol ID');
    });
  });

  describe('GET /api/symbols/underlying/:symbol', () => {
    it('should get symbols by underlying', async () => {
      const response = await request(app)
        .get('/api/symbols/underlying/NIFTY')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3); // 2 options + 1 future
      expect(response.body.data.every((s: any) => s.underlying === 'NIFTY')).toBe(true);
    });

    it('should filter by instrument type', async () => {
      const response = await request(app)
        .get('/api/symbols/underlying/NIFTY')
        .query({ instrumentType: 'OPTION' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every((s: any) => s.instrumentType === 'OPTION')).toBe(true);
    });

    it('should filter by expiry date', async () => {
      const response = await request(app)
        .get('/api/symbols/underlying/NIFTY')
        .query({ expiry: '2025-01-30' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.every((s: any) => s.expiryDate === '2025-01-30')).toBe(true);
    });

    it('should return empty array for non-existent underlying', async () => {
      const response = await request(app)
        .get('/api/symbols/underlying/NONEXISTENT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/symbols/option-chain/:underlying', () => {
    it('should get option chain for underlying', async () => {
      const response = await request(app)
        .get('/api/symbols/option-chain/NIFTY')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.calls).toHaveLength(1);
      expect(response.body.data.puts).toHaveLength(1);
      expect(response.body.data.expiries).toContain('2025-01-30');
    });

    it('should filter option chain by expiry', async () => {
      const response = await request(app)
        .get('/api/symbols/option-chain/NIFTY')
        .query({ expiry: '2025-01-30' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.calls).toHaveLength(1);
      expect(response.body.data.puts).toHaveLength(1);
      expect(response.body.data.calls[0].expiryDate).toBe('2025-01-30');
      expect(response.body.data.puts[0].expiryDate).toBe('2025-01-30');
    });

    it('should return empty option chain for non-existent underlying', async () => {
      const response = await request(app)
        .get('/api/symbols/option-chain/NONEXISTENT')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.calls).toHaveLength(0);
      expect(response.body.data.puts).toHaveLength(0);
      expect(response.body.data.expiries).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      // Temporarily close the database connection
      await mongoose.disconnect();

      const response = await request(app)
        .get('/api/symbols/search')
        .query({ q: 'TCS' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('database');

      // Reconnect for other tests
      await mongoose.connect(mongoServer.getUri());
    });

    it('should handle malformed query parameters', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ 
          strikeMin: 'not-a-number',
          limit: 'invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('validation');
    });

    it('should handle very large limit values', async () => {
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ limit: 10000 })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should be capped at reasonable limit
      expect(response.body.data.symbols.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      // Set up larger dataset for performance testing
      const largeDataset: CreateStandardizedSymbolData[] = Array(1000).fill(null).map((_, i) => ({
        displayName: `Test Company ${i}`,
        tradingSymbol: `TEST${i}`,
        instrumentType: 'EQUITY' as const,
        exchange: 'NSE' as const,
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox',
        companyName: `Test Company ${i}`,
        sector: i % 2 === 0 ? 'Technology' : 'Finance'
      }));

      await symbolDatabaseService.upsertSymbols(largeDataset);
    });

    it('should handle large result sets efficiently', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/symbols/search')
        .query({ 
          instrumentType: 'EQUITY',
          limit: 100
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.symbols).toHaveLength(100);
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/symbols/search')
          .query({ q: 'TEST' })
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should handle concurrent requests efficiently
      expect(totalTime).toBeLessThan(3000); // Within 3 seconds for 10 concurrent requests
    });
  });

  describe('Data Consistency', () => {
    it('should return consistent results across multiple requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get('/api/symbols/search')
          .query({ instrumentType: 'EQUITY' })
      );

      const responses = await Promise.all(requests);

      // All responses should be identical
      const firstResponse = responses[0].body;
      responses.forEach(response => {
        expect(response.body.data.total).toBe(firstResponse.data.total);
        expect(response.body.data.symbols).toHaveLength(firstResponse.data.symbols.length);
      });
    });

    it('should maintain data integrity during searches', async () => {
      // Get all symbols
      const allSymbolsResponse = await request(app)
        .get('/api/symbols/search')
        .query({ limit: 100 });

      const totalSymbols = allSymbolsResponse.body.data.total;

      // Get symbols by different instrument types
      const equityResponse = await request(app)
        .get('/api/symbols/search')
        .query({ instrumentType: 'EQUITY', limit: 100 });

      const optionResponse = await request(app)
        .get('/api/symbols/search')
        .query({ instrumentType: 'OPTION', limit: 100 });

      const futureResponse = await request(app)
        .get('/api/symbols/search')
        .query({ instrumentType: 'FUTURE', limit: 100 });

      // Sum should equal total
      const sumByType = equityResponse.body.data.total + 
                       optionResponse.body.data.total + 
                       futureResponse.body.data.total;

      expect(sumByType).toBe(totalSymbols);
    });
  });
});