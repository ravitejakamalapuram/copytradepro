/**
 * Memory Usage Monitoring Tests
 * Tests memory usage during symbol operations and updates
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { symbolCacheService } from '../services/symbolCacheService';
import { getSymbolSearchService } from '../services/symbolSearchService';
import { CreateStandardizedSymbolData } from '../models/symbolModels';

interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

describe('Memory Usage Monitoring', () => {
  let mongoServer: MongoMemoryServer;
  let memorySnapshots: MemorySnapshot[] = [];

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
    
    // Initialize services
    await symbolDatabaseService.initialize();
  }, 30000);

  afterAll(async () => {
    // Clean up
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear database and reset memory snapshots
    await symbolDatabaseService.clearAllSymbols();
    memorySnapshots = [];
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  function takeMemorySnapshot(label?: string): MemorySnapshot {
    const memory = process.memoryUsage();
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      rss: memory.rss
    };
    
    memorySnapshots.push(snapshot);
    
    if (label) {
      console.log(`${label}: ${(snapshot.heapUsed / 1024 / 1024).toFixed(2)}MB heap, ${(snapshot.rss / 1024 / 1024).toFixed(2)}MB RSS`);
    }
    
    return snapshot;
  }

  function analyzeMemoryUsage(snapshots: MemorySnapshot[]): {
    maxHeapUsed: number;
    maxRss: number;
    heapGrowth: number;
    rssGrowth: number;
    avgHeapUsed: number;
  } {
    if (snapshots.length === 0) {
      return { maxHeapUsed: 0, maxRss: 0, heapGrowth: 0, rssGrowth: 0, avgHeapUsed: 0 };
    }
    
    const maxHeapUsed = Math.max(...snapshots.map(s => s.heapUsed));
    const maxRss = Math.max(...snapshots.map(s => s.rss));
    const heapGrowth = snapshots[snapshots.length - 1].heapUsed - snapshots[0].heapUsed;
    const rssGrowth = snapshots[snapshots.length - 1].rss - snapshots[0].rss;
    const avgHeapUsed = snapshots.reduce((sum, s) => sum + s.heapUsed, 0) / snapshots.length;
    
    return {
      maxHeapUsed: maxHeapUsed / 1024 / 1024, // Convert to MB
      maxRss: maxRss / 1024 / 1024,
      heapGrowth: heapGrowth / 1024 / 1024,
      rssGrowth: rssGrowth / 1024 / 1024,
      avgHeapUsed: avgHeapUsed / 1024 / 1024
    };
  }

  function generateTestSymbols(count: number, prefix: string = 'TEST'): CreateStandardizedSymbolData[] {
    return Array(count).fill(null).map((_, i) => ({
      displayName: `${prefix} Company ${i} Ltd`,
      tradingSymbol: `${prefix}${i}`,
      instrumentType: 'EQUITY' as const,
      exchange: i % 2 === 0 ? 'NSE' as const : 'BSE' as const,
      segment: 'EQ',
      lotSize: 1,
      tickSize: 0.05,
      source: 'test',
      companyName: `${prefix} Company ${i} Ltd`,
      sector: ['Technology', 'Finance', 'Healthcare'][i % 3]
    }));
  }

  describe('Database Operations Memory Usage', () => {
    it('should monitor memory during bulk symbol insertion', async () => {
      takeMemorySnapshot('Initial');
      
      const symbolCounts = [1000, 2000, 3000, 4000, 5000];
      
      for (const count of symbolCounts) {
        const symbols = generateTestSymbols(count, `BULK${count}_`);
        
        takeMemorySnapshot(`Before inserting ${count} symbols`);
        await symbolDatabaseService.upsertSymbols(symbols);
        takeMemorySnapshot(`After inserting ${count} symbols`);
        
        // Clear for next iteration
        await symbolDatabaseService.clearAllSymbols();
        
        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
        
        takeMemorySnapshot(`After cleanup ${count} symbols`);
      }
      
      const analysis = analyzeMemoryUsage(memorySnapshots);
      
      console.log('Bulk insertion memory analysis:');
      console.log(`Max heap used: ${analysis.maxHeapUsed.toFixed(2)}MB`);
      console.log(`Max RSS: ${analysis.maxRss.toFixed(2)}MB`);
      console.log(`Heap growth: ${analysis.heapGrowth.toFixed(2)}MB`);
      console.log(`Average heap: ${analysis.avgHeapUsed.toFixed(2)}MB`);
      
      // Memory should not grow excessively
      expect(analysis.heapGrowth).toBeLessThan(100); // Less than 100MB growth
      expect(analysis.maxHeapUsed).toBeLessThan(500); // Less than 500MB peak
    }, 60000);

    it('should monitor memory during repeated operations', async () => {
      const operationCount = 10;
      const symbolsPerOperation = 500;
      
      takeMemorySnapshot('Initial');
      
      for (let i = 0; i < operationCount; i++) {
        const symbols = generateTestSymbols(symbolsPerOperation, `OP${i}_`);
        
        await symbolDatabaseService.upsertSymbols(symbols);
        takeMemorySnapshot(`After operation ${i + 1}`);
        
        await symbolDatabaseService.clearAllSymbols();
        
        // Force garbage collection every few operations
        if (i % 3 === 0 && global.gc) {
          global.gc();
          takeMemorySnapshot(`After GC operation ${i + 1}`);
        }
      }
      
      const analysis = analyzeMemoryUsage(memorySnapshots);
      
      console.log('Repeated operations memory analysis:');
      console.log(`Max heap used: ${analysis.maxHeapUsed.toFixed(2)}MB`);
      console.log(`Heap growth: ${analysis.heapGrowth.toFixed(2)}MB`);
      
      // Memory should not continuously grow
      expect(analysis.heapGrowth).toBeLessThan(50); // Less than 50MB growth over all operations
    }, 45000);

    it('should monitor memory during concurrent operations', async () => {
      takeMemorySnapshot('Before concurrent operations');
      
      const concurrentOperations = Array(5).fill(null).map((_, i) => {
        const symbols = generateTestSymbols(300, `CONCURRENT${i}_`);
        return symbolDatabaseService.upsertSymbols(symbols);
      });
      
      await Promise.all(concurrentOperations);
      takeMemorySnapshot('After concurrent operations');
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      takeMemorySnapshot('After GC');
      
      const analysis = analyzeMemoryUsage(memorySnapshots);
      
      console.log('Concurrent operations memory analysis:');
      console.log(`Max heap used: ${analysis.maxHeapUsed.toFixed(2)}MB`);
      console.log(`Heap growth: ${analysis.heapGrowth.toFixed(2)}MB`);
      
      // Memory usage should be reasonable for concurrent operations
      expect(analysis.maxHeapUsed).toBeLessThan(300);
    }, 30000);
  });

  describe('Search Operations Memory Usage', () => {
    beforeEach(async () => {
      // Set up test data for search operations
      const testSymbols = generateTestSymbols(2000, 'SEARCH_');
      await symbolDatabaseService.upsertSymbols(testSymbols);
    });

    it('should monitor memory during search operations', async () => {
      const searchService = getSymbolSearchService();
      
      takeMemorySnapshot('Before searches');
      
      // Perform various search operations
      const searchOperations = [
        () => searchService.searchSymbols({ query: 'SEARCH', limit: 100 }),
        () => searchService.searchSymbols({ instrumentType: 'EQUITY', limit: 200 }),
        () => searchService.searchSymbols({ exchange: 'NSE', limit: 150 }),
        () => searchService.quickSearch('SEARCH_1'),
        () => symbolDatabaseService.searchSymbolsWithFilters({ query: 'Company', limit: 50 })
      ];
      
      for (let i = 0; i < searchOperations.length; i++) {
        await searchOperations[i]();
        takeMemorySnapshot(`After search operation ${i + 1}`);
      }
      
      // Perform repeated searches to test for memory leaks
      for (let i = 0; i < 20; i++) {
        await searchService.searchSymbols({ query: `SEARCH_${i % 10}`, limit: 20 });
        
        if (i % 5 === 0) {
          takeMemorySnapshot(`After repeated search ${i + 1}`);
        }
      }
      
      const analysis = analyzeMemoryUsage(memorySnapshots);
      
      console.log('Search operations memory analysis:');
      console.log(`Max heap used: ${analysis.maxHeapUsed.toFixed(2)}MB`);
      console.log(`Heap growth: ${analysis.heapGrowth.toFixed(2)}MB`);
      
      // Search operations should not cause significant memory growth
      expect(analysis.heapGrowth).toBeLessThan(30);
    }, 30000);

    it('should monitor memory during large result set searches', async () => {
      takeMemorySnapshot('Before large searches');
      
      // Perform searches that return large result sets
      const largeSearches = [
        () => symbolDatabaseService.searchSymbolsWithFilters({ instrumentType: 'EQUITY', limit: 500 }),
        () => symbolDatabaseService.searchSymbolsWithFilters({ exchange: 'NSE', limit: 1000 }),
        () => symbolDatabaseService.searchSymbolsWithFilters({ query: 'Company', limit: 800 })
      ];
      
      for (let i = 0; i < largeSearches.length; i++) {
        const result = await largeSearches[i]();
        takeMemorySnapshot(`After large search ${i + 1} (${result.symbols.length} results)`);
      }
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      takeMemorySnapshot('After GC');
      
      const analysis = analyzeMemoryUsage(memorySnapshots);
      
      console.log('Large search operations memory analysis:');
      console.log(`Max heap used: ${analysis.maxHeapUsed.toFixed(2)}MB`);
      console.log(`Heap growth: ${analysis.heapGrowth.toFixed(2)}MB`);
      
      // Large searches should not cause excessive memory usage
      expect(analysis.maxHeapUsed).toBeLessThan(200);
    }, 20000);
  });

  describe('Cache Memory Usage', () => {
    it('should monitor cache memory usage', async () => {
      // Set up test data
      const testSymbols = generateTestSymbols(1000, 'CACHE_');
      await symbolDatabaseService.upsertSymbols(testSymbols);
      
      takeMemorySnapshot('Before cache operations');
      
      // Perform operations that populate cache
      for (let i = 0; i < 100; i++) {
        await symbolDatabaseService.getSymbolByTradingSymbol(`CACHE_${i}`, 'NSE');
        
        if (i % 20 === 0) {
          takeMemorySnapshot(`After ${i + 1} cache lookups`);
        }
      }
      
      // Perform searches that use cache
      const searchService = getSymbolSearchService();
      for (let i = 0; i < 50; i++) {
        await searchService.searchSymbols({ query: `CACHE_${i % 10}`, limit: 10 });
      }
      
      takeMemorySnapshot('After cache-heavy operations');
      
      // Clear cache and measure memory
      symbolCacheService.clearCache();
      
      if (global.gc) {
        global.gc();
      }
      takeMemorySnapshot('After cache clear and GC');
      
      const analysis = analyzeMemoryUsage(memorySnapshots);
      
      console.log('Cache memory usage analysis:');
      console.log(`Max heap used: ${analysis.maxHeapUsed.toFixed(2)}MB`);
      console.log(`Heap growth: ${analysis.heapGrowth.toFixed(2)}MB`);
      
      // Cache should not cause excessive memory usage
      expect(analysis.maxHeapUsed).toBeLessThan(150);
    }, 25000);

    it('should monitor cache eviction behavior', async () => {
      // Set up large dataset to trigger cache eviction
      const testSymbols = generateTestSymbols(2000, 'EVICT_');
      await symbolDatabaseService.upsertSymbols(testSymbols);
      
      takeMemorySnapshot('Before cache eviction test');
      
      // Access many symbols to fill cache beyond capacity
      for (let i = 0; i < 1500; i++) {
        await symbolDatabaseService.getSymbolByTradingSymbol(`EVICT_${i}`, 'NSE');
        
        if (i % 300 === 0) {
          takeMemorySnapshot(`After ${i + 1} symbol accesses`);
        }
      }
      
      // Access symbols again to test eviction
      for (let i = 0; i < 500; i++) {
        await symbolDatabaseService.getSymbolByTradingSymbol(`EVICT_${i}`, 'NSE');
      }
      
      takeMemorySnapshot('After cache eviction cycles');
      
      const analysis = analyzeMemoryUsage(memorySnapshots);
      
      console.log('Cache eviction memory analysis:');
      console.log(`Max heap used: ${analysis.maxHeapUsed.toFixed(2)}MB`);
      console.log(`Heap growth: ${analysis.heapGrowth.toFixed(2)}MB`);
      
      // Cache eviction should prevent unbounded memory growth
      expect(analysis.heapGrowth).toBeLessThan(100);
    }, 35000);
  });

  describe('Memory Leak Detection', () => {
    it('should detect memory leaks in repeated operations', async () => {
      const operationCycles = 10;
      const symbolsPerCycle = 200;
      const memoryReadings: number[] = [];
      
      for (let cycle = 0; cycle < operationCycles; cycle++) {
        // Create and insert symbols
        const symbols = generateTestSymbols(symbolsPerCycle, `LEAK${cycle}_`);
        await symbolDatabaseService.upsertSymbols(symbols);
        
        // Perform various operations
        await symbolDatabaseService.searchSymbolsWithFilters({ query: `LEAK${cycle}`, limit: 50 });
        await symbolDatabaseService.getSymbolByTradingSymbol(`LEAK${cycle}_0`, 'NSE');
        
        // Clean up
        await symbolDatabaseService.clearAllSymbols();
        
        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
        
        const memory = process.memoryUsage().heapUsed / 1024 / 1024;
        memoryReadings.push(memory);
        
        console.log(`Cycle ${cycle + 1}: ${memory.toFixed(2)}MB`);
      }
      
      // Analyze memory trend
      const firstHalf = memoryReadings.slice(0, Math.floor(operationCycles / 2));
      const secondHalf = memoryReadings.slice(Math.floor(operationCycles / 2));
      
      const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      const memoryGrowthRate = (secondHalfAvg - firstHalfAvg) / firstHalfAvg;
      
      console.log(`Memory leak detection:`);
      console.log(`First half average: ${firstHalfAvg.toFixed(2)}MB`);
      console.log(`Second half average: ${secondHalfAvg.toFixed(2)}MB`);
      console.log(`Growth rate: ${(memoryGrowthRate * 100).toFixed(2)}%`);
      
      // Memory growth rate should be minimal (less than 20%)
      expect(memoryGrowthRate).toBeLessThan(0.2);
    }, 60000);

    it('should detect memory leaks in search operations', async () => {
      // Set up test data
      const testSymbols = generateTestSymbols(1000, 'SEARCHLEAK_');
      await symbolDatabaseService.upsertSymbols(testSymbols);
      
      const searchCycles = 20;
      const searchesPerCycle = 10;
      const memoryReadings: number[] = [];
      
      for (let cycle = 0; cycle < searchCycles; cycle++) {
        // Perform multiple searches
        const searchService = getSymbolSearchService();
        
        for (let search = 0; search < searchesPerCycle; search++) {
          await searchService.searchSymbols({ 
            query: `SEARCHLEAK_${search % 10}`, 
            limit: 20 
          });
        }
        
        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
        
        const memory = process.memoryUsage().heapUsed / 1024 / 1024;
        memoryReadings.push(memory);
      }
      
      // Check for memory growth trend
      const linearRegression = (values: number[]) => {
        const n = values.length;
        const sumX = values.reduce((sum, _, i) => sum + i, 0);
        const sumY = values.reduce((sum, val) => sum + val, 0);
        const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
        const sumXX = values.reduce((sum, _, i) => sum + i * i, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        return slope;
      };
      
      const memorySlope = linearRegression(memoryReadings);
      
      console.log(`Search memory leak detection:`);
      console.log(`Memory slope: ${memorySlope.toFixed(4)}MB per cycle`);
      console.log(`Total memory change: ${(memoryReadings[memoryReadings.length - 1] - memoryReadings[0]).toFixed(2)}MB`);
      
      // Memory slope should be minimal (less than 0.1MB per cycle)
      expect(Math.abs(memorySlope)).toBeLessThan(0.1);
    }, 45000);
  });

  describe('Memory Usage Reporting', () => {
    it('should generate comprehensive memory usage report', async () => {
      const report = {
        testPhases: [] as Array<{
          phase: string;
          memoryBefore: MemorySnapshot;
          memoryAfter: MemorySnapshot;
          memoryDelta: number;
          operations: number;
        }>
      };
      
      // Phase 1: Bulk insertion
      const beforeBulk = takeMemorySnapshot();
      const bulkSymbols = generateTestSymbols(2000, 'REPORT_BULK_');
      await symbolDatabaseService.upsertSymbols(bulkSymbols);
      const afterBulk = takeMemorySnapshot();
      
      report.testPhases.push({
        phase: 'Bulk Insertion (2000 symbols)',
        memoryBefore: beforeBulk,
        memoryAfter: afterBulk,
        memoryDelta: (afterBulk.heapUsed - beforeBulk.heapUsed) / 1024 / 1024,
        operations: 2000
      });
      
      // Phase 2: Search operations
      const beforeSearch = takeMemorySnapshot();
      const searchService = getSymbolSearchService();
      for (let i = 0; i < 100; i++) {
        await searchService.searchSymbols({ query: `REPORT_BULK_${i % 10}`, limit: 20 });
      }
      const afterSearch = takeMemorySnapshot();
      
      report.testPhases.push({
        phase: 'Search Operations (100 searches)',
        memoryBefore: beforeSearch,
        memoryAfter: afterSearch,
        memoryDelta: (afterSearch.heapUsed - beforeSearch.heapUsed) / 1024 / 1024,
        operations: 100
      });
      
      // Phase 3: Cache operations
      const beforeCache = takeMemorySnapshot();
      for (let i = 0; i < 200; i++) {
        await symbolDatabaseService.getSymbolByTradingSymbol(`REPORT_BULK_${i}`, 'NSE');
      }
      const afterCache = takeMemorySnapshot();
      
      report.testPhases.push({
        phase: 'Cache Operations (200 lookups)',
        memoryBefore: beforeCache,
        memoryAfter: afterCache,
        memoryDelta: (afterCache.heapUsed - beforeCache.heapUsed) / 1024 / 1024,
        operations: 200
      });
      
      // Generate report
      console.log('\n=== MEMORY USAGE REPORT ===');
      report.testPhases.forEach(phase => {
        console.log(`\n${phase.phase}:`);
        console.log(`  Memory before: ${(phase.memoryBefore.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Memory after:  ${(phase.memoryAfter.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Memory delta:  ${phase.memoryDelta.toFixed(2)}MB`);
        console.log(`  Memory per op: ${(phase.memoryDelta / phase.operations * 1024).toFixed(2)}KB`);
      });
      
      const totalMemoryDelta = report.testPhases.reduce((sum, phase) => sum + phase.memoryDelta, 0);
      console.log(`\nTotal memory increase: ${totalMemoryDelta.toFixed(2)}MB`);
      
      // All phases should have reasonable memory usage
      report.testPhases.forEach(phase => {
        expect(phase.memoryDelta).toBeLessThan(100); // Less than 100MB per phase
      });
      
      expect(totalMemoryDelta).toBeLessThan(200); // Less than 200MB total
    }, 45000);
  });
});