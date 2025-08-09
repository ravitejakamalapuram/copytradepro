import { SymbolSearchQuery, SymbolSearchResult } from './symbolDatabaseService';
import { StandardizedSymbol } from '../models/symbolModels';
import { logger } from '../utils/logger';

/**
 * LRU Cache Node for doubly linked list
 */
export class CacheNode {
  key: string;
  value: any;
  prev: CacheNode | null = null;
  next: CacheNode | null = null;

  constructor(key: string, value: any) {
    this.key = key;
    this.value = value;
  }
}

/**
 * LRU Cache implementation for symbol data
 */
export class LRUCache {
  private capacity: number;
  private cache: Map<string, CacheNode>;
  private head: CacheNode;
  private tail: CacheNode;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
    
    // Create dummy head and tail nodes
    this.head = new CacheNode('', null);
    this.tail = new CacheNode('', null);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /**
   * Get value from cache
   */
  get(key: string): any | null {
    const node = this.cache.get(key);
    if (!node) {
      return null;
    }

    // Move to head (most recently used)
    this.moveToHead(node);
    return node.value;
  }

  /**
   * Put value in cache
   */
  put(key: string, value: any): void {
    const existingNode = this.cache.get(key);
    
    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      this.moveToHead(existingNode);
    } else {
      // Create new node
      const newNode = new CacheNode(key, value);
      
      if (this.cache.size >= this.capacity) {
        // Remove least recently used
        const tail = this.removeTail();
        if (tail) {
          this.cache.delete(tail.key);
        }
      }
      
      this.cache.set(key, newNode);
      this.addToHead(newNode);
    }
  }

  /**
   * Remove key from cache
   */
  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) {
      return false;
    }

    this.removeNode(node);
    this.cache.delete(key);
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; capacity: number; utilization: number } {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      utilization: (this.cache.size / this.capacity) * 100
    };
  }

  // Private helper methods
  private addToHead(node: CacheNode): void {
    node.prev = this.head;
    node.next = this.head.next;
    
    if (this.head.next) {
      this.head.next.prev = node;
    }
    this.head.next = node;
  }

  private removeNode(node: CacheNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }
  }

  private moveToHead(node: CacheNode): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  private removeTail(): CacheNode | null {
    const lastNode = this.tail.prev;
    if (lastNode && lastNode !== this.head) {
      this.removeNode(lastNode);
      return lastNode;
    }
    return null;
  }
}

/**
 * Cache statistics interface
 */
interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  memoryUsage: {
    symbolCache: { size: number; capacity: number; utilization: number };
    searchCache: { size: number; capacity: number; utilization: number };
    frequentSymbols: number;
  };
  lastWarmedAt?: string | undefined;
  warmingInProgress: boolean;
}

/**
 * Symbol Cache Service
 * Provides in-memory caching for frequently accessed symbols and search results
 */
export class SymbolCacheService {
  private symbolCache: LRUCache;           // Cache for individual symbols
  private searchCache: LRUCache;           // Cache for search results
  private frequentSymbols: Map<string, StandardizedSymbol>; // Frequently accessed symbols
  private stats: { hits: number; misses: number };
  private isWarming: boolean = false;
  private lastWarmedAt?: Date;

  // Cache configuration
  private readonly SYMBOL_CACHE_SIZE = 10000;      // Cache up to 10k individual symbols
  private readonly SEARCH_CACHE_SIZE = 1000;       // Cache up to 1k search results
  private readonly FREQUENT_SYMBOLS_SIZE = 500;    // Keep 500 most frequent symbols in memory
  private readonly SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes TTL for search results
  private readonly SYMBOL_CACHE_TTL = 30 * 60 * 1000; // 30 minutes TTL for symbols

  constructor() {
    this.symbolCache = new LRUCache(this.SYMBOL_CACHE_SIZE);
    this.searchCache = new LRUCache(this.SEARCH_CACHE_SIZE);
    this.frequentSymbols = new Map();
    this.stats = { hits: 0, misses: 0 };

    logger.info('✅ Symbol Cache Service initialized', {
      symbolCacheSize: this.SYMBOL_CACHE_SIZE,
      searchCacheSize: this.SEARCH_CACHE_SIZE,
      frequentSymbolsSize: this.FREQUENT_SYMBOLS_SIZE
    });
  }

  /**
   * Get symbol from cache
   */
  getSymbol(key: string): StandardizedSymbol | null {
    // First check frequent symbols (fastest access)
    const frequentSymbol = this.frequentSymbols.get(key);
    if (frequentSymbol) {
      this.stats.hits++;
      return frequentSymbol;
    }

    // Then check LRU cache
    const cachedData = this.symbolCache.get(key);
    if (cachedData && this.isValidCacheEntry(cachedData)) {
      this.stats.hits++;
      return cachedData.symbol;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Cache a symbol
   */
  cacheSymbol(key: string, symbol: StandardizedSymbol): void {
    const cacheEntry = {
      symbol,
      cachedAt: Date.now(),
      accessCount: 1
    };

    this.symbolCache.put(key, cacheEntry);

    // Track access frequency for potential promotion to frequent symbols
    this.trackSymbolAccess(key, symbol);
  }

  /**
   * Get search results from cache
   */
  getSearchResults(queryKey: string): SymbolSearchResult | null {
    const cachedData = this.searchCache.get(queryKey);
    if (cachedData && this.isValidCacheEntry(cachedData)) {
      this.stats.hits++;
      return cachedData.result;
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Cache search results
   */
  cacheSearchResults(queryKey: string, result: SymbolSearchResult): void {
    const cacheEntry = {
      result,
      cachedAt: Date.now()
    };

    this.searchCache.put(queryKey, cacheEntry);
  }

  /**
   * Generate cache key for symbol lookup
   */
  generateSymbolKey(id?: string, tradingSymbol?: string, exchange?: string): string {
    if (id) {
      return `symbol:id:${id}`;
    }
    if (tradingSymbol && exchange) {
      return `symbol:trading:${exchange}:${tradingSymbol}`;
    }
    if (tradingSymbol) {
      return `symbol:trading:${tradingSymbol}`;
    }
    throw new Error('Invalid parameters for symbol key generation');
  }

  /**
   * Generate cache key for search query
   */
  generateSearchKey(query: SymbolSearchQuery): string {
    const keyParts = [
      'search',
      query.query || '',
      query.instrumentType || '',
      query.exchange || '',
      query.underlying || '',
      query.strikeMin?.toString() || '',
      query.strikeMax?.toString() || '',
      query.expiryStart || '',
      query.expiryEnd || '',
      query.optionType || '',
      query.isActive?.toString() || 'true',
      query.limit?.toString() || '50',
      query.offset?.toString() || '0'
    ];

    return keyParts.join(':');
  }

  /**
   * Warm cache with frequently accessed symbols
   */
  async warmCache(symbolDatabaseService: any): Promise<void> {
    if (this.isWarming) {
      logger.warn('Cache warming already in progress');
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();

    try {
      logger.info('🔥 Starting cache warming process');

      // Get popular equity symbols (top 100)
      const equitySymbols = await symbolDatabaseService.searchSymbolsWithFilters({
        instrumentType: 'EQUITY',
        limit: 100,
        isActive: true
      });

      // Get popular option underlyings
      const popularUnderlyings = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFC', 'ICICIBANK'];
      
      for (const underlying of popularUnderlyings) {
        const options = await symbolDatabaseService.searchSymbolsWithFilters({
          instrumentType: 'OPTION',
          underlying,
          limit: 50,
          isActive: true
        });

        // Cache the options
        for (const symbol of options.symbols) {
          const key = this.generateSymbolKey(symbol.id);
          this.cacheSymbol(key, symbol);
        }
      }

      // Cache equity symbols
      for (const symbol of equitySymbols.symbols) {
        const key = this.generateSymbolKey(symbol.id);
        this.cacheSymbol(key, symbol);
        
        // Add popular symbols to frequent symbols cache
        if (this.frequentSymbols.size < this.FREQUENT_SYMBOLS_SIZE) {
          this.frequentSymbols.set(key, symbol);
        }
      }

      this.lastWarmedAt = new Date();
      const duration = Date.now() - startTime;

      logger.info('✅ Cache warming completed', {
        duration,
        durationMs: `${duration}ms`,
        symbolsCached: this.symbolCache.size(),
        frequentSymbols: this.frequentSymbols.size
      });

    } catch (error) {
      logger.error('🚨 Cache warming failed', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Invalidate cache entries for updated symbols
   */
  invalidateSymbol(symbolId: string, tradingSymbol?: string, exchange?: string): void {
    // Remove from all possible cache locations
    const keys = [
      this.generateSymbolKey(symbolId),
      tradingSymbol && exchange ? this.generateSymbolKey(undefined, tradingSymbol, exchange) : null,
      tradingSymbol ? this.generateSymbolKey(undefined, tradingSymbol) : null
    ].filter(Boolean) as string[];

    for (const key of keys) {
      this.symbolCache.delete(key);
      this.frequentSymbols.delete(key);
    }

    // Clear search cache as it might contain outdated results
    this.clearSearchCache();

    logger.debug('🗑️ Invalidated cache for symbol', { symbolId, tradingSymbol, exchange });
  }

  /**
   * Invalidate all cache entries (for bulk updates)
   */
  invalidateAll(): void {
    this.symbolCache.clear();
    this.searchCache.clear();
    this.frequentSymbols.clear();
    
    logger.info('🗑️ All cache entries invalidated');
  }

  /**
   * Clear only search cache
   */
  clearSearchCache(): void {
    this.searchCache.clear();
    logger.debug('🗑️ Search cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      memoryUsage: {
        symbolCache: this.symbolCache.getStats(),
        searchCache: this.searchCache.getStats(),
        frequentSymbols: this.frequentSymbols.size
      },
      lastWarmedAt: this.lastWarmedAt?.toISOString() || undefined,
      warmingInProgress: this.isWarming
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0 };
    logger.info('📊 Cache statistics reset');
  }

  /**
   * Get memory usage in bytes (approximate)
   */
  getMemoryUsage(): { estimated: number; breakdown: Record<string, number> } {
    const symbolCacheSize = this.symbolCache.size() * 1024; // Rough estimate: 1KB per symbol
    const searchCacheSize = this.searchCache.size() * 2048; // Rough estimate: 2KB per search result
    const frequentSymbolsSize = this.frequentSymbols.size * 1024; // Rough estimate: 1KB per symbol

    return {
      estimated: symbolCacheSize + searchCacheSize + frequentSymbolsSize,
      breakdown: {
        symbolCache: symbolCacheSize,
        searchCache: searchCacheSize,
        frequentSymbols: frequentSymbolsSize
      }
    };
  }

  // Private helper methods

  /**
   * Check if cache entry is still valid (not expired)
   */
  private isValidCacheEntry(cacheEntry: any): boolean {
    if (!cacheEntry || !cacheEntry.cachedAt) {
      return false;
    }

    const now = Date.now();
    const age = now - cacheEntry.cachedAt;

    // Different TTL for different types of cache entries
    if (cacheEntry.symbol) {
      return age < this.SYMBOL_CACHE_TTL;
    }
    if (cacheEntry.result) {
      return age < this.SEARCH_CACHE_TTL;
    }

    return false;
  }

  /**
   * Track symbol access for frequency-based caching
   */
  private trackSymbolAccess(key: string, symbol: StandardizedSymbol): void {
    // If we have space in frequent symbols, add it
    if (this.frequentSymbols.size < this.FREQUENT_SYMBOLS_SIZE) {
      this.frequentSymbols.set(key, symbol);
      return;
    }

    // TODO: Implement more sophisticated frequency tracking
    // For now, we just maintain the first N symbols that get accessed
  }
}

// Export singleton instance
export const symbolCacheService = new SymbolCacheService();