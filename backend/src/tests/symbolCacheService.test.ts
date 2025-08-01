import { SymbolCacheService } from '../services/symbolCacheService';
import { SymbolSearchQuery } from '../services/symbolDatabaseService';
import { StandardizedSymbol } from '../models/symbolModels';

describe('SymbolCacheService', () => {
  let cacheService: SymbolCacheService;
  let mockSymbol: StandardizedSymbol;

  beforeEach(() => {
    cacheService = new SymbolCacheService();
    mockSymbol = {
      id: 'test-symbol-1',
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
      isActive: true,
      lastUpdated: '2025-01-28T10:00:00.000Z',
      source: 'upstox',
      createdAt: '2025-01-28T10:00:00.000Z'
    };
  });

  describe('Symbol Caching', () => {
    it('should cache and retrieve symbols by ID', () => {
      const key = cacheService.generateSymbolKey(mockSymbol.id);
      
      // Initially should return null
      expect(cacheService.getSymbol(key)).toBeNull();
      
      // Cache the symbol
      cacheService.cacheSymbol(key, mockSymbol);
      
      // Should now return the cached symbol
      const cached = cacheService.getSymbol(key);
      expect(cached).toEqual(mockSymbol);
    });

    it('should cache and retrieve symbols by trading symbol', () => {
      const key = cacheService.generateSymbolKey(undefined, mockSymbol.tradingSymbol, mockSymbol.exchange);
      
      cacheService.cacheSymbol(key, mockSymbol);
      const cached = cacheService.getSymbol(key);
      
      expect(cached).toEqual(mockSymbol);
    });

    it('should generate correct cache keys', () => {
      const idKey = cacheService.generateSymbolKey('test-id');
      expect(idKey).toBe('symbol:id:test-id');

      const tradingKey = cacheService.generateSymbolKey(undefined, 'NIFTY25JAN22000CE', 'NFO');
      expect(tradingKey).toBe('symbol:trading:NFO:NIFTY25JAN22000CE');

      const tradingOnlyKey = cacheService.generateSymbolKey(undefined, 'NIFTY25JAN22000CE');
      expect(tradingOnlyKey).toBe('symbol:trading:NIFTY25JAN22000CE');
    });

    it('should throw error for invalid key generation parameters', () => {
      expect(() => {
        cacheService.generateSymbolKey();
      }).toThrow('Invalid parameters for symbol key generation');
    });
  });

  describe('Search Result Caching', () => {
    it('should cache and retrieve search results', () => {
      const searchQuery: SymbolSearchQuery = {
        query: 'NIFTY',
        instrumentType: 'OPTION',
        limit: 10
      };

      const searchResult = {
        symbols: [mockSymbol],
        total: 1,
        hasMore: false
      };

      const key = cacheService.generateSearchKey(searchQuery);
      
      // Initially should return null
      expect(cacheService.getSearchResults(key)).toBeNull();
      
      // Cache the search result
      cacheService.cacheSearchResults(key, searchResult);
      
      // Should now return the cached result
      const cached = cacheService.getSearchResults(key);
      expect(cached).toEqual(searchResult);
    });

    it('should generate consistent search keys', () => {
      const query1: SymbolSearchQuery = {
        query: 'NIFTY',
        instrumentType: 'OPTION',
        limit: 10
      };

      const query2: SymbolSearchQuery = {
        query: 'NIFTY',
        instrumentType: 'OPTION',
        limit: 10
      };

      const key1 = cacheService.generateSearchKey(query1);
      const key2 = cacheService.generateSearchKey(query2);
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different queries', () => {
      const query1: SymbolSearchQuery = {
        query: 'NIFTY',
        instrumentType: 'OPTION'
      };

      const query2: SymbolSearchQuery = {
        query: 'BANKNIFTY',
        instrumentType: 'OPTION'
      };

      const key1 = cacheService.generateSearchKey(query1);
      const key2 = cacheService.generateSearchKey(query2);
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate symbol cache entries', () => {
      const key = cacheService.generateSymbolKey(mockSymbol.id);
      cacheService.cacheSymbol(key, mockSymbol);
      
      // Verify it's cached
      expect(cacheService.getSymbol(key)).toEqual(mockSymbol);
      
      // Invalidate
      cacheService.invalidateSymbol(mockSymbol.id, mockSymbol.tradingSymbol, mockSymbol.exchange);
      
      // Should now return null
      expect(cacheService.getSymbol(key)).toBeNull();
    });

    it('should clear all cache entries', () => {
      const symbolKey = cacheService.generateSymbolKey(mockSymbol.id);
      const searchKey = cacheService.generateSearchKey({ query: 'NIFTY' });
      
      cacheService.cacheSymbol(symbolKey, mockSymbol);
      cacheService.cacheSearchResults(searchKey, { symbols: [mockSymbol], total: 1, hasMore: false });
      
      // Verify both are cached
      expect(cacheService.getSymbol(symbolKey)).toEqual(mockSymbol);
      expect(cacheService.getSearchResults(searchKey)).toBeTruthy();
      
      // Clear all
      cacheService.invalidateAll();
      
      // Both should now return null
      expect(cacheService.getSymbol(symbolKey)).toBeNull();
      expect(cacheService.getSearchResults(searchKey)).toBeNull();
    });

    it('should clear only search cache', () => {
      const symbolKey = cacheService.generateSymbolKey(mockSymbol.id);
      const searchKey = cacheService.generateSearchKey({ query: 'NIFTY' });
      
      cacheService.cacheSymbol(symbolKey, mockSymbol);
      cacheService.cacheSearchResults(searchKey, { symbols: [mockSymbol], total: 1, hasMore: false });
      
      // Clear only search cache
      cacheService.clearSearchCache();
      
      // Symbol should still be cached, search should not
      expect(cacheService.getSymbol(symbolKey)).toEqual(mockSymbol);
      expect(cacheService.getSearchResults(searchKey)).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', () => {
      const key = cacheService.generateSymbolKey(mockSymbol.id);
      
      // Initial stats
      let stats = cacheService.getStats();
      const initialHits = stats.hits;
      const initialMisses = stats.misses;
      
      // Cache miss
      cacheService.getSymbol(key);
      stats = cacheService.getStats();
      expect(stats.misses).toBe(initialMisses + 1);
      
      // Cache the symbol
      cacheService.cacheSymbol(key, mockSymbol);
      
      // Cache hit
      cacheService.getSymbol(key);
      stats = cacheService.getStats();
      expect(stats.hits).toBe(initialHits + 1);
    });

    it('should calculate hit rate correctly', () => {
      const key = cacheService.generateSymbolKey(mockSymbol.id);
      
      // Reset stats for clean test
      cacheService.resetStats();
      
      // 1 miss
      cacheService.getSymbol(key);
      
      // Cache and 2 hits
      cacheService.cacheSymbol(key, mockSymbol);
      cacheService.getSymbol(key);
      cacheService.getSymbol(key);
      
      const stats = cacheService.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(66.67); // 2/3 * 100, rounded to 2 decimals
    });

    it('should provide memory usage estimates', () => {
      const key = cacheService.generateSymbolKey(mockSymbol.id);
      cacheService.cacheSymbol(key, mockSymbol);
      
      const memoryUsage = cacheService.getMemoryUsage();
      
      expect(memoryUsage).toHaveProperty('estimated');
      expect(memoryUsage).toHaveProperty('breakdown');
      expect(memoryUsage.breakdown).toHaveProperty('symbolCache');
      expect(memoryUsage.breakdown).toHaveProperty('searchCache');
      expect(memoryUsage.breakdown).toHaveProperty('frequentSymbols');
      expect(memoryUsage.estimated).toBeGreaterThan(0);
    });

    it('should reset statistics', () => {
      const key = cacheService.generateSymbolKey(mockSymbol.id);
      
      // Generate some stats
      cacheService.getSymbol(key); // miss
      cacheService.cacheSymbol(key, mockSymbol);
      cacheService.getSymbol(key); // hit
      
      let stats = cacheService.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
      
      // Reset
      cacheService.resetStats();
      
      stats = cacheService.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('LRU Behavior', () => {
    it('should evict least recently used items when capacity is exceeded', () => {
      // Test LRU cache directly
      const { LRUCache } = require('../services/symbolCacheService');
      const lruCache = new LRUCache(2);

      const symbol1 = { ...mockSymbol, id: 'symbol1' };
      const symbol2 = { ...mockSymbol, id: 'symbol2' };
      const symbol3 = { ...mockSymbol, id: 'symbol3' };

      // Cache first two symbols
      lruCache.put('key1', symbol1);
      lruCache.put('key2', symbol2);

      // Both should be accessible
      expect(lruCache.get('key1')).toEqual(symbol1);
      expect(lruCache.get('key2')).toEqual(symbol2);

      // Cache third symbol (should evict first one)
      lruCache.put('key3', symbol3);

      // First symbol should be evicted, others should be accessible
      expect(lruCache.get('key1')).toBeNull();
      expect(lruCache.get('key2')).toEqual(symbol2);
      expect(lruCache.get('key3')).toEqual(symbol3);
    });
  });
});