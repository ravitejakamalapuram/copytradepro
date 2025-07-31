/**
 * Performance Tests for Bulk Data Processing
 * Tests bulk data processing performance and memory usage
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { dataValidationService } from '../services/dataValidationService';
import { CreateStandardizedSymbolData } from '../models/symbolModels';

describe('Bulk Data Processing Performance', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
    
    // Initialize the symbol database service
    await symbolDatabaseService.initialize();
  }, 30000);

  afterAll(async () => {
    // Clean up
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database before each test
    await symbolDatabaseService.clearAllSymbols();
  });

  function generateTestSymbols(count: number): CreateStandardizedSymbolData[] {
    const symbols: CreateStandardizedSymbolData[] = [];
    
    for (let i = 0; i < count; i++) {
      if (i % 10 === 0) {
        // Options (10% of symbols)
        symbols.push({
          displayName: `NIFTY ${20000 + (i % 100) * 50} CE 30 JAN 25`,
          tradingSymbol: `NIFTY25JAN${20000 + (i % 100) * 50}CE`,
          instrumentType: 'OPTION',
          exchange: 'NFO',
          segment: 'FO',
          underlying: 'NIFTY',
          strikePrice: 20000 + (i % 100) * 50,
          optionType: 'CE',
          expiryDate: '2025-01-30',
          lotSize: 50,
          tickSize: 0.05,
          source: 'upstox'
        });
      } else if (i % 20 === 0) {
        // Futures (5% of symbols)
        symbols.push({
          displayName: `STOCK${i} FUT 30 JAN 25`,
          tradingSymbol: `STOCK${i}25JANFUT`,
          instrumentType: 'FUTURE',
          exchange: 'NFO',
          segment: 'FO',
          underlying: `STOCK${i}`,
          expiryDate: '2025-01-30',
          lotSize: 100,
          tickSize: 0.05,
          source: 'upstox'
        });
      } else {
        // Equity (85% of symbols)
        symbols.push({
          displayName: `Test Company ${i} Ltd`,
          tradingSymbol: `STOCK${i}`,
          instrumentType: 'EQUITY',
          exchange: i % 2 === 0 ? 'NSE' : 'BSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          source: 'upstox',
          companyName: `Test Company ${i} Ltd`,
          sector: ['Technology', 'Finance', 'Healthcare', 'Energy'][i % 4]
        });
      }
    }
    
    return symbols;
  }

  describe('Bulk Insertion Performance', () => {
    it('should handle 1,000 symbols efficiently', async () => {
      const symbolCount = 1000;
      const testSymbols = generateTestSymbols(symbolCount);
      
      const startTime = Date.now();
      const result = await symbolDatabaseService.upsertSymbols(testSymbols);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      const symbolsPerSecond = (symbolCount / processingTime) * 1000;
      
      expect(result.totalProcessed).toBe(symbolCount);
      expect(result.validSymbols).toBe(symbolCount);
      expect(processingTime).toBeLessThan(10000); // Within 10 seconds
      
      console.log(`1K symbols: ${processingTime}ms (${symbolsPerSecond.toFixed(0)} symbols/sec)`);
    }, 15000);

    it('should handle 5,000 symbols efficiently', async () => {
      const symbolCount = 5000;
      const testSymbols = generateTestSymbols(symbolCount);
      
      const startTime = Date.now();
      const result = await symbolDatabaseService.upsertSymbols(testSymbols);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      const symbolsPerSecond = (symbolCount / processingTime) * 1000;
      
      expect(result.totalProcessed).toBe(symbolCount);
      expect(result.validSymbols).toBe(symbolCount);
      expect(processingTime).toBeLessThan(30000); // Within 30 seconds
      
      console.log(`5K symbols: ${processingTime}ms (${symbolsPerSecond.toFixed(0)} symbols/sec)`);
    }, 35000);

    it('should handle 10,000 symbols efficiently', async () => {
      const symbolCount = 10000;
      const testSymbols = generateTestSymbols(symbolCount);
      
      const startTime = Date.now();
      const result = await symbolDatabaseService.upsertSymbols(testSymbols);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      const symbolsPerSecond = (symbolCount / processingTime) * 1000;
      
      expect(result.totalProcessed).toBe(symbolCount);
      expect(result.validSymbols).toBe(symbolCount);
      expect(processingTime).toBeLessThan(60000); // Within 60 seconds
      
      console.log(`10K symbols: ${processingTime}ms (${symbolsPerSecond.toFixed(0)} symbols/sec)`);
    }, 65000);
  });

  describe('Batch Processing Performance', () => {
    it('should optimize batch size for best performance', async () => {
      const totalSymbols = 5000;
      const batchSizes = [100, 500, 1000, 2500];
      const results: { batchSize: number; time: number; rate: number }[] = [];
      
      for (const batchSize of batchSizes) {
        await symbolDatabaseService.clearAllSymbols();
        
        const testSymbols = generateTestSymbols(totalSymbols);
        const batches = [];
        
        for (let i = 0; i < totalSymbols; i += batchSize) {
          batches.push(testSymbols.slice(i, i + batchSize));
        }
        
        const startTime = Date.now();
        
        for (const batch of batches) {
          await symbolDatabaseService.upsertSymbols(batch);
        }
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        const symbolsPerSecond = (totalSymbols / processingTime) * 1000;
        
        results.push({
          batchSize,
          time: processingTime,
          rate: symbolsPerSecond
        });
        
        console.log(`Batch size ${batchSize}: ${processingTime}ms (${symbolsPerSecond.toFixed(0)} symbols/sec)`);
      }
      
      // Find optimal batch size (highest rate)
      const optimal = results.reduce((best, current) => 
        current.rate > best.rate ? current : best
      );
      
      console.log(`Optimal batch size: ${optimal.batchSize} (${optimal.rate.toFixed(0)} symbols/sec)`);
      
      // All batch sizes should complete within reasonable time
      results.forEach(result => {
        expect(result.time).toBeLessThan(120000); // Within 2 minutes
      });
    }, 300000); // 5 minute timeout
  });

  describe('Memory Usage During Bulk Operations', () => {
    it('should maintain reasonable memory usage during large insertions', async () => {
      const initialMemory = process.memoryUsage();
      const symbolCount = 5000;
      
      console.log(`Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      
      const testSymbols = generateTestSymbols(symbolCount);
      
      const beforeInsert = process.memoryUsage();
      console.log(`Before insert: ${(beforeInsert.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      
      await symbolDatabaseService.upsertSymbols(testSymbols);
      
      const afterInsert = process.memoryUsage();
      console.log(`After insert: ${(afterInsert.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        const afterGC = process.memoryUsage();
        console.log(`After GC: ${(afterGC.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }
      
      const memoryIncrease = afterInsert.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;
      
      console.log(`Memory increase: ${memoryIncreaseMB.toFixed(2)}MB for ${symbolCount} symbols`);
      console.log(`Memory per symbol: ${(memoryIncreaseMB / symbolCount * 1024).toFixed(2)}KB`);
      
      // Memory increase should be reasonable (less than 200MB for 5K symbols)
      expect(memoryIncreaseMB).toBeLessThan(200);
    }, 30000);

    it('should not leak memory during repeated batch operations', async () => {
      const batchSize = 1000;
      const numBatches = 5;
      const memoryReadings: number[] = [];
      
      for (let i = 0; i < numBatches; i++) {
        const testSymbols = generateTestSymbols(batchSize);
        await symbolDatabaseService.upsertSymbols(testSymbols);
        await symbolDatabaseService.clearAllSymbols();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        const memory = process.memoryUsage().heapUsed / 1024 / 1024;
        memoryReadings.push(memory);
        console.log(`Batch ${i + 1} memory: ${memory.toFixed(2)}MB`);
      }
      
      // Memory should not continuously increase
      const firstReading = memoryReadings[0];
      const lastReading = memoryReadings[memoryReadings.length - 1];
      const memoryIncrease = lastReading - firstReading;
      
      console.log(`Memory increase over ${numBatches} batches: ${memoryIncrease.toFixed(2)}MB`);
      
      // Should not increase by more than 50MB over multiple batches
      expect(memoryIncrease).toBeLessThan(50);
    }, 45000);
  });

  describe('Validation Performance', () => {
    it('should validate large datasets efficiently', async () => {
      const symbolCounts = [1000, 5000, 10000];
      
      for (const count of symbolCounts) {
        const testSymbols = generateTestSymbols(count);
        
        const startTime = Date.now();
        const result = await dataValidationService.validateSymbols(testSymbols);
        const endTime = Date.now();
        
        const validationTime = endTime - startTime;
        const symbolsPerSecond = (count / validationTime) * 1000;
        
        expect(result.isValid).toBe(true);
        expect(result.validSymbols).toHaveLength(count);
        expect(validationTime).toBeLessThan(count * 2); // Less than 2ms per symbol
        
        console.log(`Validation ${count} symbols: ${validationTime}ms (${symbolsPerSecond.toFixed(0)} symbols/sec)`);
      }
    }, 60000);

    it('should handle mixed valid/invalid data efficiently', async () => {
      const symbolCount = 5000;
      const testSymbols = generateTestSymbols(symbolCount);
      
      // Introduce some invalid symbols (10%)
      for (let i = 0; i < symbolCount; i += 10) {
        testSymbols[i] = {
          ...testSymbols[i],
          displayName: '', // Invalid: empty display name
          lotSize: -1 // Invalid: negative lot size
        };
      }
      
      const startTime = Date.now();
      const result = await dataValidationService.validateSymbols(testSymbols);
      const endTime = Date.now();
      
      const validationTime = endTime - startTime;
      const expectedValid = symbolCount - Math.floor(symbolCount / 10);
      const expectedInvalid = Math.floor(symbolCount / 10);
      
      expect(result.isValid).toBe(false);
      expect(result.validSymbols).toHaveLength(expectedValid);
      expect(result.invalidSymbols).toHaveLength(expectedInvalid);
      expect(validationTime).toBeLessThan(symbolCount * 3); // Less than 3ms per symbol with validation errors
      
      console.log(`Mixed validation ${symbolCount} symbols: ${validationTime}ms`);
      console.log(`Valid: ${result.validSymbols.length}, Invalid: ${result.invalidSymbols.length}`);
    }, 30000);
  });

  describe('Update Performance', () => {
    it('should handle bulk updates efficiently', async () => {
      const symbolCount = 2000;
      const testSymbols = generateTestSymbols(symbolCount);
      
      // Initial insert
      const insertStart = Date.now();
      await symbolDatabaseService.upsertSymbols(testSymbols);
      const insertEnd = Date.now();
      const insertTime = insertEnd - insertStart;
      
      // Update all symbols
      const updatedSymbols = testSymbols.map(symbol => ({
        ...symbol,
        companyName: `${symbol.companyName || symbol.displayName} - Updated`
      }));
      
      const updateStart = Date.now();
      const updateResult = await symbolDatabaseService.upsertSymbols(updatedSymbols);
      const updateEnd = Date.now();
      const updateTime = updateEnd - updateStart;
      
      expect(updateResult.totalProcessed).toBe(symbolCount);
      expect(updateResult.updatedSymbols).toBe(symbolCount);
      expect(updateResult.newSymbols).toBe(0);
      
      console.log(`Insert ${symbolCount} symbols: ${insertTime}ms`);
      console.log(`Update ${symbolCount} symbols: ${updateTime}ms`);
      console.log(`Update/Insert ratio: ${(updateTime / insertTime).toFixed(2)}`);
      
      // Updates should be reasonably fast (within 2x insert time)
      expect(updateTime).toBeLessThan(insertTime * 2);
    }, 45000);

    it('should handle mixed insert/update operations efficiently', async () => {
      const initialCount = 1000;
      const updateCount = 500;
      const newCount = 500;
      
      // Initial insert
      const initialSymbols = generateTestSymbols(initialCount);
      await symbolDatabaseService.upsertSymbols(initialSymbols);
      
      // Prepare mixed operation: update first 500, add 500 new
      const mixedSymbols = [
        ...initialSymbols.slice(0, updateCount).map(symbol => ({
          ...symbol,
          companyName: `${symbol.companyName || symbol.displayName} - Updated`
        })),
        ...generateTestSymbols(newCount).map((symbol, i) => ({
          ...symbol,
          tradingSymbol: `NEW${i}`,
          displayName: `New Company ${i}`
        }))
      ];
      
      const startTime = Date.now();
      const result = await symbolDatabaseService.upsertSymbols(mixedSymbols);
      const endTime = Date.now();
      
      const processingTime = endTime - startTime;
      
      expect(result.totalProcessed).toBe(initialCount);
      expect(result.updatedSymbols).toBe(updateCount);
      expect(result.newSymbols).toBe(newCount);
      
      console.log(`Mixed operation (${updateCount} updates + ${newCount} inserts): ${processingTime}ms`);
      
      // Should complete within reasonable time
      expect(processingTime).toBeLessThan(20000);
    }, 30000);
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent bulk operations', async () => {
      const operationCount = 5;
      const symbolsPerOperation = 500;
      
      const operations = Array(operationCount).fill(null).map((_, i) => {
        const symbols = generateTestSymbols(symbolsPerOperation).map(symbol => ({
          ...symbol,
          tradingSymbol: `CONCURRENT${i}_${symbol.tradingSymbol}`,
          displayName: `Concurrent ${i} - ${symbol.displayName}`
        }));
        
        return symbolDatabaseService.upsertSymbols(symbols);
      });
      
      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const totalSymbols = operationCount * symbolsPerOperation;
      const symbolsPerSecond = (totalSymbols / totalTime) * 1000;
      
      // All operations should succeed
      results.forEach((result, i) => {
        expect(result.totalProcessed).toBe(symbolsPerOperation);
        expect(result.validSymbols).toBe(symbolsPerOperation);
      });
      
      console.log(`Concurrent operations: ${operationCount} x ${symbolsPerOperation} symbols`);
      console.log(`Total time: ${totalTime}ms (${symbolsPerSecond.toFixed(0)} symbols/sec)`);
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(60000);
    }, 65000);

    it('should maintain performance under concurrent read/write load', async () => {
      // Set up initial data
      const initialSymbols = generateTestSymbols(2000);
      await symbolDatabaseService.upsertSymbols(initialSymbols);
      
      // Concurrent operations: reads and writes
      const readOperations = Array(10).fill(null).map(() =>
        symbolDatabaseService.searchSymbolsWithFilters({
          instrumentType: 'EQUITY',
          limit: 50
        })
      );
      
      const writeOperations = Array(3).fill(null).map((_, i) => {
        const symbols = generateTestSymbols(200).map(symbol => ({
          ...symbol,
          tradingSymbol: `READWRITE${i}_${symbol.tradingSymbol}`
        }));
        return symbolDatabaseService.upsertSymbols(symbols);
      });
      
      const startTime = Date.now();
      const [readResults, writeResults] = await Promise.all([
        Promise.all(readOperations),
        Promise.all(writeOperations)
      ]);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      
      // All operations should succeed
      readResults.forEach(result => {
        expect(result.symbols.length).toBeGreaterThan(0);
      });
      
      writeResults.forEach(result => {
        expect(result.validSymbols).toBe(200);
      });
      
      console.log(`Concurrent read/write test: ${totalTime}ms`);
      console.log(`Read operations: ${readOperations.length}, Write operations: ${writeOperations.length}`);
      
      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(30000);
    }, 35000);
  });
});