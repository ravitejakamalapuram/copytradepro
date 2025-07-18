/**
 * Derivatives Data Cache Service
 * Implements intelligent caching for option chains and futures contracts
 * Includes cache invalidation logic based on market hours and expiry dates
 */

import { OptionChain, FuturesChain, OptionContract, FuturesContract } from '@copytrade/shared-types';

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiryTime: Date;
  accessCount: number;
  lastAccessed: Date;
  isStale: boolean;
}

/**
 * Cache statistics
 */
interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

/**
 * Cache configuration
 */
interface CacheConfig {
  maxEntries: number;
  defaultTTL: number; // Time to live in milliseconds
  optionChainTTL: number;
  futuresChainTTL: number;
  contractTTL: number;
  cleanupInterval: number;
  maxMemoryUsage: number; // in bytes
}

/**
 * Market hours configuration
 */
interface MarketHours {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  timezone: string;
  tradingDays: number[]; // 0-6, Sunday = 0
}

/**
 * Derivatives data caching service with intelligent invalidation
 */
export class DerivativesDataCacheService {
  private optionChainCache: Map<string, CacheEntry<OptionChain>> = new Map();
  private futuresChainCache: Map<string, CacheEntry<FuturesChain>> = new Map();
  private optionContractCache: Map<string, CacheEntry<OptionContract>> = new Map();
  private futuresContractCache: Map<string, CacheEntry<FuturesContract>> = new Map();
  
  private stats = {
    totalHits: 0,
    totalMisses: 0,
    totalEvictions: 0,
    totalCleanups: 0
  };

  private cleanupInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  private readonly config: CacheConfig = {
    maxEntries: 10000,
    defaultTTL: 5 * 60 * 1000, // 5 minutes
    optionChainTTL: 2 * 60 * 1000, // 2 minutes
    futuresChainTTL: 5 * 60 * 1000, // 5 minutes
    contractTTL: 1 * 60 * 1000, // 1 minute
    cleanupInterval: 60 * 1000, // 1 minute
    maxMemoryUsage: 100 * 1024 * 1024 // 100MB
  };

  private readonly marketHours: MarketHours = {
    start: '09:15',
    end: '15:30',
    timezone: 'Asia/Kolkata',
    tradingDays: [1, 2, 3, 4, 5] // Monday to Friday
  };

  /**
   * Initialize the cache service
   */
  public initialize(): void {
    if (this.isInitialized) {
      console.warn('Derivatives cache service already initialized');
      return;
    }

    this.startCleanupInterval();
    this.isInitialized = true;
    console.log('Derivatives data cache service initialized');
  }

  /**
   * Cache option chain data
   */
  public cacheOptionChain(underlying: string, expiryDate: Date, optionChain: OptionChain): void {
    const key = this.generateOptionChainKey(underlying, expiryDate);
    const ttl = this.calculateDynamicTTL('optionChain', expiryDate);
    
    const entry: CacheEntry<OptionChain> = {
      data: optionChain,
      timestamp: new Date(),
      expiryTime: new Date(Date.now() + ttl),
      accessCount: 0,
      lastAccessed: new Date(),
      isStale: false
    };

    this.optionChainCache.set(key, entry);
    this.enforceMemoryLimits();
    
    console.debug(`Cached option chain for ${underlying} expiry ${expiryDate.toISOString()}`);
  }

  /**
   * Get cached option chain data
   */
  public getCachedOptionChain(underlying: string, expiryDate: Date): OptionChain | null {
    const key = this.generateOptionChainKey(underlying, expiryDate);
    const entry = this.optionChainCache.get(key);

    if (!entry) {
      this.stats.totalMisses++;
      return null;
    }

    // Check if entry is expired
    if (this.isEntryExpired(entry)) {
      this.optionChainCache.delete(key);
      this.stats.totalMisses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.stats.totalHits++;

    return entry.data;
  }

  /**
   * Cache futures chain data
   */
  public cacheFuturesChain(underlying: string, futuresChain: FuturesChain): void {
    const key = this.generateFuturesChainKey(underlying);
    const ttl = this.calculateDynamicTTL('futuresChain');
    
    const entry: CacheEntry<FuturesChain> = {
      data: futuresChain,
      timestamp: new Date(),
      expiryTime: new Date(Date.now() + ttl),
      accessCount: 0,
      lastAccessed: new Date(),
      isStale: false
    };

    this.futuresChainCache.set(key, entry);
    this.enforceMemoryLimits();
    
    console.debug(`Cached futures chain for ${underlying}`);
  }

  /**
   * Get cached futures chain data
   */
  public getCachedFuturesChain(underlying: string): FuturesChain | null {
    const key = this.generateFuturesChainKey(underlying);
    const entry = this.futuresChainCache.get(key);

    if (!entry) {
      this.stats.totalMisses++;
      return null;
    }

    // Check if entry is expired
    if (this.isEntryExpired(entry)) {
      this.futuresChainCache.delete(key);
      this.stats.totalMisses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.stats.totalHits++;

    return entry.data;
  }

  /**
   * Cache individual option contract
   */
  public cacheOptionContract(symbol: string, contract: OptionContract): void {
    const ttl = this.calculateDynamicTTL('contract', contract.expiryDate);
    
    const entry: CacheEntry<OptionContract> = {
      data: contract,
      timestamp: new Date(),
      expiryTime: new Date(Date.now() + ttl),
      accessCount: 0,
      lastAccessed: new Date(),
      isStale: false
    };

    this.optionContractCache.set(symbol, entry);
    this.enforceMemoryLimits();
  }

  /**
   * Get cached option contract
   */
  public getCachedOptionContract(symbol: string): OptionContract | null {
    const entry = this.optionContractCache.get(symbol);

    if (!entry) {
      this.stats.totalMisses++;
      return null;
    }

    if (this.isEntryExpired(entry)) {
      this.optionContractCache.delete(symbol);
      this.stats.totalMisses++;
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.stats.totalHits++;

    return entry.data;
  }

  /**
   * Cache individual futures contract
   */
  public cacheFuturesContract(symbol: string, contract: FuturesContract): void {
    const ttl = this.calculateDynamicTTL('contract', contract.expiryDate);
    
    const entry: CacheEntry<FuturesContract> = {
      data: contract,
      timestamp: new Date(),
      expiryTime: new Date(Date.now() + ttl),
      accessCount: 0,
      lastAccessed: new Date(),
      isStale: false
    };

    this.futuresContractCache.set(symbol, entry);
    this.enforceMemoryLimits();
  }

  /**
   * Get cached futures contract
   */
  public getCachedFuturesContract(symbol: string): FuturesContract | null {
    const entry = this.futuresContractCache.get(symbol);

    if (!entry) {
      this.stats.totalMisses++;
      return null;
    }

    if (this.isEntryExpired(entry)) {
      this.futuresContractCache.delete(symbol);
      this.stats.totalMisses++;
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.stats.totalHits++;

    return entry.data;
  }

  /**
   * Invalidate cache entries for a specific underlying
   */
  public invalidateUnderlying(underlying: string): void {
    // Invalidate option chains
    for (const [key, entry] of this.optionChainCache.entries()) {
      if (key.startsWith(`${underlying}:`)) {
        entry.isStale = true;
      }
    }

    // Invalidate futures chains
    const futuresKey = this.generateFuturesChainKey(underlying);
    const futuresEntry = this.futuresChainCache.get(futuresKey);
    if (futuresEntry) {
      futuresEntry.isStale = true;
    }

    // Invalidate individual contracts
    for (const [symbol, entry] of this.optionContractCache.entries()) {
      if (entry.data.underlying === underlying) {
        entry.isStale = true;
      }
    }

    for (const [symbol, entry] of this.futuresContractCache.entries()) {
      if (entry.data.underlying === underlying) {
        entry.isStale = true;
      }
    }

    console.log(`Invalidated cache entries for underlying: ${underlying}`);
  }

  /**
   * Invalidate expired contracts
   */
  public invalidateExpiredContracts(): void {
    const now = new Date();
    let expiredCount = 0;

    // Check option contracts
    for (const [symbol, entry] of this.optionContractCache.entries()) {
      if (entry.data.expiryDate <= now) {
        this.optionContractCache.delete(symbol);
        expiredCount++;
      }
    }

    // Check futures contracts
    for (const [symbol, entry] of this.futuresContractCache.entries()) {
      if (entry.data.expiryDate <= now) {
        this.futuresContractCache.delete(symbol);
        expiredCount++;
      }
    }

    // Check option chains
    for (const [key, entry] of this.optionChainCache.entries()) {
      if (entry.data.expiryDate <= now) {
        this.optionChainCache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`Removed ${expiredCount} expired contract entries from cache`);
    }
  }

  /**
   * Clear all cache entries
   */
  public clearAll(): void {
    this.optionChainCache.clear();
    this.futuresChainCache.clear();
    this.optionContractCache.clear();
    this.futuresContractCache.clear();
    
    // Reset stats
    this.stats = {
      totalHits: 0,
      totalMisses: 0,
      totalEvictions: 0,
      totalCleanups: 0
    };

    console.log('All cache entries cleared');
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    const totalRequests = this.stats.totalHits + this.stats.totalMisses;
    const hitRate = totalRequests > 0 ? (this.stats.totalHits / totalRequests) * 100 : 0;
    const missRate = totalRequests > 0 ? (this.stats.totalMisses / totalRequests) * 100 : 0;

    const allEntries = [
      ...this.optionChainCache.values(),
      ...this.futuresChainCache.values(),
      ...this.optionContractCache.values(),
      ...this.futuresContractCache.values()
    ];

    const timestamps = allEntries.map(entry => entry.timestamp);
    const oldestEntry = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : null;
    const newestEntry = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : null;

    return {
      totalEntries: this.getTotalEntries(),
      hitRate: Number(hitRate.toFixed(2)),
      missRate: Number(missRate.toFixed(2)),
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      memoryUsage: this.estimateMemoryUsage(),
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Get detailed cache information
   */
  public getCacheInfo() {
    return {
      optionChains: this.optionChainCache.size,
      futuresChains: this.futuresChainCache.size,
      optionContracts: this.optionContractCache.size,
      futuresContracts: this.futuresContractCache.size,
      totalEntries: this.getTotalEntries(),
      config: this.config,
      marketHours: this.marketHours,
      stats: this.stats,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Generate cache key for option chain
   */
  private generateOptionChainKey(underlying: string, expiryDate: Date): string {
    return `${underlying}:${expiryDate.toISOString().split('T')[0]}`;
  }

  /**
   * Generate cache key for futures chain
   */
  private generateFuturesChainKey(underlying: string): string {
    return `futures:${underlying}`;
  }

  /**
   * Calculate dynamic TTL based on market conditions
   */
  private calculateDynamicTTL(
    type: 'optionChain' | 'futuresChain' | 'contract',
    expiryDate?: Date
  ): number {
    const now = new Date();
    const isMarketHours = this.isMarketHours(now);
    
    let baseTTL: number;
    switch (type) {
      case 'optionChain':
        baseTTL = this.config.optionChainTTL;
        break;
      case 'futuresChain':
        baseTTL = this.config.futuresChainTTL;
        break;
      case 'contract':
        baseTTL = this.config.contractTTL;
        break;
      default:
        baseTTL = this.config.defaultTTL;
    }

    // Reduce TTL during market hours for more frequent updates
    if (isMarketHours) {
      baseTTL = baseTTL * 0.5;
    } else {
      // Increase TTL outside market hours
      baseTTL = baseTTL * 2;
    }

    // Further reduce TTL for contracts expiring soon
    if (expiryDate) {
      const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysToExpiry <= 1) {
        baseTTL = baseTTL * 0.25; // Very short TTL for expiring contracts
      } else if (daysToExpiry <= 7) {
        baseTTL = baseTTL * 0.5; // Shorter TTL for contracts expiring within a week
      }
    }

    return Math.max(baseTTL, 30000); // Minimum 30 seconds TTL
  }

  /**
   * Check if current time is within market hours
   */
  private isMarketHours(date: Date): boolean {
    const dayOfWeek = date.getDay();
    
    // Check if it's a trading day
    if (!this.marketHours.tradingDays.includes(dayOfWeek)) {
      return false;
    }

    // Convert to market timezone (simplified - assumes local time is market time)
    const timeString = date.toTimeString().substring(0, 5); // HH:MM format
    
    return timeString >= this.marketHours.start && timeString <= this.marketHours.end;
  }

  /**
   * Check if cache entry is expired
   */
  private isEntryExpired<T>(entry: CacheEntry<T>): boolean {
    const now = new Date();
    return entry.isStale || entry.expiryTime <= now;
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);

    console.log(`Cache cleanup interval started: ${this.config.cleanupInterval}ms`);
  }

  /**
   * Perform cache cleanup
   */
  private performCleanup(): void {
    const now = new Date();
    let cleanedCount = 0;

    // Clean expired entries from all caches
    const caches = [
      { cache: this.optionChainCache, name: 'optionChain' },
      { cache: this.futuresChainCache, name: 'futuresChain' },
      { cache: this.optionContractCache, name: 'optionContract' },
      { cache: this.futuresContractCache, name: 'futuresContract' }
    ];

    caches.forEach(({ cache, name }) => {
      for (const [key, entry] of cache.entries()) {
        if (this.isEntryExpired(entry as CacheEntry<any>)) {
          cache.delete(key);
          cleanedCount++;
        }
      }
    });

    // Clean expired contracts
    this.invalidateExpiredContracts();

    // Enforce memory limits
    this.enforceMemoryLimits();

    this.stats.totalCleanups++;

    if (cleanedCount > 0) {
      console.log(`Cache cleanup completed: removed ${cleanedCount} expired entries`);
    }
  }

  /**
   * Enforce memory limits by evicting least recently used entries
   */
  private enforceMemoryLimits(): void {
    const totalEntries = this.getTotalEntries();
    const memoryUsage = this.estimateMemoryUsage();

    if (totalEntries <= this.config.maxEntries && memoryUsage <= this.config.maxMemoryUsage) {
      return;
    }

    // Collect all entries with their access information
    const allEntries: Array<{
      key: string;
      entry: CacheEntry<any>;
      cache: Map<string, CacheEntry<any>>;
      type: string;
    }> = [];

    // Add entries from all caches
    for (const [key, entry] of this.optionChainCache.entries()) {
      allEntries.push({ key, entry, cache: this.optionChainCache, type: 'optionChain' });
    }
    for (const [key, entry] of this.futuresChainCache.entries()) {
      allEntries.push({ key, entry, cache: this.futuresChainCache, type: 'futuresChain' });
    }
    for (const [key, entry] of this.optionContractCache.entries()) {
      allEntries.push({ key, entry, cache: this.optionContractCache, type: 'optionContract' });
    }
    for (const [key, entry] of this.futuresContractCache.entries()) {
      allEntries.push({ key, entry, cache: this.futuresContractCache, type: 'futuresContract' });
    }

    // Sort by last accessed time (LRU)
    allEntries.sort((a, b) => a.entry.lastAccessed.getTime() - b.entry.lastAccessed.getTime());

    // Remove entries until we're under limits
    const targetEntries = Math.floor(this.config.maxEntries * 0.8); // Remove to 80% of max
    let evictedCount = 0;

    while (allEntries.length > 0 && (this.getTotalEntries() > targetEntries || this.estimateMemoryUsage() > this.config.maxMemoryUsage)) {
      const { key, cache } = allEntries.shift()!;
      cache.delete(key);
      evictedCount++;
    }

    if (evictedCount > 0) {
      this.stats.totalEvictions += evictedCount;
      console.log(`Evicted ${evictedCount} cache entries to enforce memory limits`);
    }
  }

  /**
   * Get total number of cache entries
   */
  private getTotalEntries(): number {
    return this.optionChainCache.size + 
           this.futuresChainCache.size + 
           this.optionContractCache.size + 
           this.futuresContractCache.size;
  }

  /**
   * Estimate memory usage (rough calculation)
   */
  private estimateMemoryUsage(): number {
    // Rough estimation: each entry ~1KB on average
    return this.getTotalEntries() * 1024;
  }

  /**
   * Shutdown the cache service
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.clearAll();
    this.isInitialized = false;
    console.log('Derivatives data cache service shutdown complete');
  }
}

// Create singleton instance
export const derivativesDataCacheService = new DerivativesDataCacheService();