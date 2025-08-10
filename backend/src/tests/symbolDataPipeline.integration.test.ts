/**
 * Integration Tests for Symbol Data Pipeline
 * Tests end-to-end symbol data processing pipeline
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { upstoxDataProcessor } from '../services/upstoxDataProcessor';
import { dataValidationService } from '../services/dataValidationService';
import { CreateStandardizedSymbolData } from '../models/symbolModels';

describe('Symbol Data Pipeline Integration', () => {
  let mongoServer: MongoMemoryServer;

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
    // Clear all collections before each test
    await symbolDatabaseService.clearAllSymbols();
  });

  describe('End-to-End Data Processing', () => {
    it('should process and store symbols successfully', async () => {
      // Mock data that would come from Upstox
      const mockSymbolData: CreateStandardizedSymbolData[] = [
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

      // Step 1: Validate the data
      const validationResult = await dataValidationService.validateSymbols(mockSymbolData);
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.validSymbols).toHaveLength(3);

      // Step 2: Store the symbols in database
      const upsertResult = await symbolDatabaseService.upsertSymbols(validationResult.validSymbols);
      expect(upsertResult.totalProcessed).toBe(3);
      expect(upsertResult.validSymbols).toBe(3);
      expect(upsertResult.newSymbols).toBe(3);
      expect(upsertResult.updatedSymbols).toBe(0);

      // Step 3: Verify symbols can be retrieved
      const searchResult = await symbolDatabaseService.searchSymbolsWithFilters({
        isActive: true,
        limit: 10
      });
      expect(searchResult.symbols).toHaveLength(3);
      expect(searchResult.total).toBe(3);

      // Step 4: Test specific symbol retrieval
      const tcsSymbol = await symbolDatabaseService.getSymbolByTradingSymbol('TCS', 'NSE');
      expect(tcsSymbol).not.toBeNull();
      expect(tcsSymbol!.displayName).toBe('Tata Consultancy Services Ltd');
      expect(tcsSymbol!.instrumentType).toBe('EQUITY');

      // Step 5: Test option chain retrieval
      const niftyOptions = await symbolDatabaseService.getSymbolsByUnderlying('NIFTY');
      expect(niftyOptions).toHaveLength(2); // 1 option + 1 future
      
      const optionSymbols = niftyOptions.filter(s => s.instrumentType === 'OPTION');
      expect(optionSymbols).toHaveLength(1);
      expect(optionSymbols[0].strikePrice).toBe(22000);
      expect(optionSymbols[0].optionType).toBe('CE');
    });

    it('should handle duplicate symbols correctly', async () => {
      const symbolData: CreateStandardizedSymbolData = {
        displayName: 'Test Company Ltd',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox',
        companyName: 'Test Company Ltd'
      };

      // Insert symbol first time
      const firstResult = await symbolDatabaseService.upsertSymbols([symbolData]);
      expect(firstResult.newSymbols).toBe(1);
      expect(firstResult.updatedSymbols).toBe(0);

      // Insert same symbol again (should update)
      const updatedSymbolData = {
        ...symbolData,
        companyName: 'Test Company Ltd - Updated'
      };
      
      const secondResult = await symbolDatabaseService.upsertSymbols([updatedSymbolData]);
      expect(secondResult.newSymbols).toBe(0);
      expect(secondResult.updatedSymbols).toBe(1);

      // Verify the update
      const retrievedSymbol = await symbolDatabaseService.getSymbolByTradingSymbol('TEST', 'NSE');
      expect(retrievedSymbol).not.toBeNull();
      expect(retrievedSymbol!.companyName).toBe('Test Company Ltd - Updated');
    });

    it('should handle validation errors gracefully', async () => {
      const invalidSymbolData: CreateStandardizedSymbolData[] = [
        {
          displayName: 'Valid Symbol',
          tradingSymbol: 'VALID',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          source: 'upstox'
        },
        {
          displayName: '', // Invalid: empty display name
          tradingSymbol: 'INVALID',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          source: 'upstox'
        }
      ];

      const validationResult = await dataValidationService.validateSymbols(invalidSymbolData);
      expect(validationResult.isValid).toBe(false);
      expect(validationResult.validSymbols).toHaveLength(1);
      expect(validationResult.invalidSymbols).toHaveLength(1);

      // Only valid symbols should be stored
      const upsertResult = await symbolDatabaseService.upsertSymbols(validationResult.validSymbols);
      expect(upsertResult.totalProcessed).toBe(1);
      expect(upsertResult.validSymbols).toBe(1);

      // Verify only valid symbol is in database
      const searchResult = await symbolDatabaseService.searchSymbolsWithFilters({
        isActive: true,
        limit: 10
      });
      expect(searchResult.symbols).toHaveLength(1);
      expect(searchResult.symbols[0].tradingSymbol).toBe('VALID');
    });
  });

  describe('Search Functionality Integration', () => {
    beforeEach(async () => {
      // Set up test data
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
          sector: 'Information Technology'
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
        }
      ];

      await symbolDatabaseService.upsertSymbols(testSymbols);
    });

    it('should search symbols by text query', async () => {
      const result = await symbolDatabaseService.searchSymbolsWithFilters({
        query: 'TCS',
        limit: 10
      });

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].tradingSymbol).toBe('TCS');
      expect(result.total).toBe(1);
    });

    it('should filter symbols by instrument type', async () => {
      const equityResult = await symbolDatabaseService.searchSymbolsWithFilters({
        instrumentType: 'EQUITY',
        limit: 10
      });

      expect(equityResult.symbols).toHaveLength(2);
      expect(equityResult.symbols.every(s => s.instrumentType === 'EQUITY')).toBe(true);

      const optionResult = await symbolDatabaseService.searchSymbolsWithFilters({
        instrumentType: 'OPTION',
        limit: 10
      });

      expect(optionResult.symbols).toHaveLength(2);
      expect(optionResult.symbols.every(s => s.instrumentType === 'OPTION')).toBe(true);
    });

    it('should filter symbols by exchange', async () => {
      const nseResult = await symbolDatabaseService.searchSymbolsWithFilters({
        exchange: 'NSE',
        limit: 10
      });

      expect(nseResult.symbols).toHaveLength(2);
      expect(nseResult.symbols.every(s => s.exchange === 'NSE')).toBe(true);

      const nfoResult = await symbolDatabaseService.searchSymbolsWithFilters({
        exchange: 'NFO',
        limit: 10
      });

      expect(nfoResult.symbols).toHaveLength(2);
      expect(nfoResult.symbols.every(s => s.exchange === 'NFO')).toBe(true);
    });

    it('should filter options by strike price range', async () => {
      const result = await symbolDatabaseService.searchSymbolsWithFilters({
        instrumentType: 'OPTION',
        strikeMin: 21000,
        strikeMax: 22000,
        limit: 10
      });

      expect(result.symbols).toHaveLength(2);
      expect(result.symbols.every(s => s.strikePrice! >= 21000 && s.strikePrice! <= 22000)).toBe(true);
    });

    it('should filter by underlying symbol', async () => {
      const result = await symbolDatabaseService.searchSymbolsWithFilters({
        underlying: 'NIFTY',
        limit: 10
      });

      expect(result.symbols).toHaveLength(2);
      expect(result.symbols.every(s => s.underlying === 'NIFTY')).toBe(true);
    });

    it('should combine multiple filters', async () => {
      const result = await symbolDatabaseService.searchSymbolsWithFilters({
        instrumentType: 'OPTION',
        underlying: 'NIFTY',
        optionType: 'CE',
        limit: 10
      });

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].tradingSymbol).toBe('NIFTY25JAN22000CE');
      expect(result.symbols[0].optionType).toBe('CE');
    });

    it('should handle pagination correctly', async () => {
      const firstPage = await symbolDatabaseService.searchSymbolsWithFilters({
        limit: 2,
        offset: 0
      });

      expect(firstPage.symbols).toHaveLength(2);
      expect(firstPage.total).toBe(4);
      expect(firstPage.hasMore).toBe(true);

      const secondPage = await symbolDatabaseService.searchSymbolsWithFilters({
        limit: 2,
        offset: 2
      });

      expect(secondPage.symbols).toHaveLength(2);
      expect(secondPage.total).toBe(4);
      expect(secondPage.hasMore).toBe(false);

      // Ensure no overlap between pages
      const firstPageIds = firstPage.symbols.map(s => s.id);
      const secondPageIds = secondPage.symbols.map(s => s.id);
      const intersection = firstPageIds.filter(id => secondPageIds.includes(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk symbol insertion efficiently', async () => {
      // Generate 1000 test symbols
      const bulkSymbols: CreateStandardizedSymbolData[] = Array(1000).fill(null).map((_, i) => ({
        displayName: `Test Company ${i}`,
        tradingSymbol: `TEST${i}`,
        instrumentType: 'EQUITY' as const,
        exchange: 'NSE' as const,
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox',
        companyName: `Test Company ${i}`
      }));

      const startTime = Date.now();
      const result = await symbolDatabaseService.upsertSymbols(bulkSymbols);
      const endTime = Date.now();

      expect(result.totalProcessed).toBe(1000);
      expect(result.validSymbols).toBe(1000);
      expect(result.newSymbols).toBe(1000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify symbols are searchable
      const searchResult = await symbolDatabaseService.searchSymbolsWithFilters({
        query: 'TEST',
        limit: 10
      });
      expect(searchResult.total).toBe(1000);
      expect(searchResult.symbols).toHaveLength(10);
    });

    it('should perform searches efficiently', async () => {
      // Set up 100 test symbols
      const testSymbols: CreateStandardizedSymbolData[] = Array(100).fill(null).map((_, i) => ({
        displayName: `Company ${i}`,
        tradingSymbol: `SYM${i}`,
        instrumentType: 'EQUITY' as const,
        exchange: 'NSE' as const,
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox',
        companyName: `Company ${i}`,
        sector: i % 2 === 0 ? 'Technology' : 'Finance'
      }));

      await symbolDatabaseService.upsertSymbols(testSymbols);

      // Perform multiple search operations and measure time
      const searchOperations = [
        () => symbolDatabaseService.searchSymbolsWithFilters({ query: 'SYM', limit: 10 }),
        () => symbolDatabaseService.searchSymbolsWithFilters({ instrumentType: 'EQUITY', limit: 20 }),
        () => symbolDatabaseService.searchSymbolsWithFilters({ exchange: 'NSE', limit: 50 }),
        () => symbolDatabaseService.getSymbolByTradingSymbol('SYM50', 'NSE')
      ];

      const startTime = Date.now();
      
      for (const operation of searchOperations) {
        await operation();
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All search operations should complete quickly
      expect(totalTime).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('Data Consistency Tests', () => {
    it('should maintain referential integrity', async () => {
      const symbols: CreateStandardizedSymbolData[] = [
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
        }
      ];

      await symbolDatabaseService.upsertSymbols(symbols);

      // Verify the option can be found by underlying
      const underlyingOptions = await symbolDatabaseService.getSymbolsByUnderlying('NIFTY');
      expect(underlyingOptions).toHaveLength(1);
      expect(underlyingOptions[0].underlying).toBe('NIFTY');

      // Verify the option has correct relationships
      const option = underlyingOptions[0];
      expect(option.instrumentType).toBe('OPTION');
      expect(option.strikePrice).toBe(22000);
      expect(option.optionType).toBe('CE');
      expect(option.expiryDate).toBe('2025-01-30');
    });

    it('should handle concurrent operations safely', async () => {
      const symbol: CreateStandardizedSymbolData = {
        displayName: 'Concurrent Test Symbol',
        tradingSymbol: 'CONCURRENT',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox'
      };

      // Perform concurrent upsert operations
      const promises = Array(10).fill(null).map(() => 
        symbolDatabaseService.upsertSymbols([symbol])
      );

      const results = await Promise.all(promises);

      // Verify that only one symbol was created (not duplicated)
      const searchResult = await symbolDatabaseService.searchSymbolsWithFilters({
        query: 'CONCURRENT',
        limit: 10
      });

      expect(searchResult.symbols).toHaveLength(1);
      expect(searchResult.total).toBe(1);

      // At least one operation should have created the symbol
      const createdCount = results.reduce((sum, result) => sum + result.newSymbols, 0);
      const updatedCount = results.reduce((sum, result) => sum + result.updatedSymbols, 0);
      
      expect(createdCount).toBe(1);
      expect(updatedCount).toBe(9);
    });
  });
});