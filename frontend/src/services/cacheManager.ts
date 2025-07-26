/**
 * CACHE MANAGER SERVICE
 * Advanced cache management with LRU eviction, TTL, and memory optimization
 */

interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: Date;
  lastAccessed: Date;
  accessCount: number;
  ttl: number; // Time to live in milliseconds
  size: number; // Estimated size in bytes
  tags: string[]; // For group invalidation
  priority: 'low' | 'medium' | 'high';
}

interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  maxEntries: number; // Maximum number of entries
  defaultTTL: number; // Default TTL in milliseconds
  cleanupInterval: number; // Cleanup interval in milliseconds
  enableCompression: boolean; // Enable data compression
  enablePersistence: boolean; // Enable localStorage persistence
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
  memoryPressure: number; // 0-1 scale
}

class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private accessOrder: string[] = []; // For LRU tracking
  private hitCount = 0;
  private missCount = 0;
  private evictionCount = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 1000,
      defaultTTL: 300000, // 5 minutes
      cleanupInterval: 60000, // 1 minute
      enableCompression: false,
      enablePersistence: true,
      ...config
    };

    this.startCleanupScheduler();
    this.loadFromPersistence();
  }

  /**
   * Set cache entry with advanced options
   */
  set<T>(
    key: string,
    data: T,
    options: {
      ttl?: number;
      tags?: string[];
      priority?: 'low' | 'medium' | 'high';
      persist?: boolean;
    } = {}
  ): boolean {
    try {
      const serializedData = this.serializeData(data);
      const size = this.estimateSize(serializedData);
      
      // Check if we need to make space
      if (!this.makeSpace(size)) {
        console.warn(`Failed to cache ${key}: insufficient space`);
        return false;
      }

      const entry: CacheEntry<T> = {
        key,
        data: this.config.enableCompression ? this.compress(serializedData) : serializedData,
        timestamp: new Date(),
        lastAccessed: new Date(),
        accessCount: 0,
        ttl: options.ttl || this.config.defaultTTL,
        size,
        tags: options.tags || [],
        priority: options.priority || 'medium'
      };

      // Remove existing entry if it exists
      if (this.cache.has(key)) {
        this.removeFromAccessOrder(key);
      }

      this.cache.set(key, entry);
      this.addToAccessOrder(key);

      // Persist if enabled
      if (this.config.enablePersistence && options.persist !== false) {
        this.persistEntry(key, entry);
      }

      return true;
    } catch (error) {
      console.error(`Failed to cache ${key}:`, error);
      return false;
    }
  }

  /**
   * Get cache entry
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (this.isExpired(entry)) {
      this.delete(key);
      this.missCount++;
      return null;
    }

    // Update access statistics
    entry.lastAccessed = new Date();
    entry.accessCount++;
    this.hitCount++;

    // Update LRU order
    this.updateAccessOrder(key);

    try {
      const data = this.config.enableCompression ? this.decompress(entry.data) : entry.data;
      return this.deserializeData(data);
    } catch (error) {
      console.error(`Failed to deserialize cached data for ${key}:`, error);
      this.delete(key);
      return null;
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    this.cache.delete(key);
    this.removeFromAccessOrder(key);
    
    // Remove from persistence
    if (this.config.enablePersistence) {
      this.removePersistentEntry(key);
    }

    return true;
  }

  /**
   * Clear cache by tags
   */
  clearByTags(tags: string[]): number {
    let clearedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.delete(key);
        clearedCount++;
      }
    }
    
    return clearedCount;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.hitCount = 0;
    this.missCount = 0;
    this.evictionCount = 0;
    
    // Clear persistence
    if (this.config.enablePersistence) {
      this.clearPersistence();
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hitCount + this.missCount;
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    
    // Calculate memory pressure directly here to avoid recursion
    const sizeRatio = totalSize / this.config.maxSize;
    const entryRatio = this.cache.size / this.config.maxEntries;
    const memoryPressure = Math.max(sizeRatio, entryRatio);
    
    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate: totalRequests > 0 ? this.hitCount / totalRequests : 0,
      missRate: totalRequests > 0 ? this.missCount / totalRequests : 0,
      evictionCount: this.evictionCount,
      oldestEntry: entries.length > 0 ? new Date(Math.min(...entries.map(e => e.timestamp.getTime()))) : null,
      newestEntry: entries.length > 0 ? new Date(Math.max(...entries.map(e => e.timestamp.getTime()))) : null,
      memoryPressure
    };
  }

  /**
   * Force cleanup of expired entries
   */
  cleanup(): number {
    let cleanedCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.delete(key);
        cleanedCount++;
      }
    }
    
    return cleanedCount;
  }

  /**
   * Optimize cache by removing low-priority, rarely accessed items
   */
  optimize(): number {
    const stats = this.getStats();
    
    // Only optimize if memory pressure is high
    if (stats.memoryPressure < 0.7) {
      return 0;
    }

    const entries = Array.from(this.cache.entries());
    
    // Sort by optimization score (lower is better for removal)
    entries.sort(([, a], [, b]) => {
      const scoreA = this.calculateOptimizationScore(a);
      const scoreB = this.calculateOptimizationScore(b);
      return scoreA - scoreB;
    });

    // Remove bottom 20% of entries
    const toRemove = Math.ceil(entries.length * 0.2);
    let removedCount = 0;
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [key] = entries[i];
      this.delete(key);
      removedCount++;
    }
    
    return removedCount;
  }

  /**
   * Preload cache with data
   */
  async preload(
    dataLoader: () => Promise<Array<{ key: string; data: any; options?: any }>>,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<number> {
    try {
      const items = await dataLoader();
      let loadedCount = 0;
      
      for (const item of items) {
        if (this.set(item.key, item.data, item.options)) {
          loadedCount++;
        }
        
        if (onProgress) {
          onProgress(loadedCount, items.length);
        }
      }
      
      return loadedCount;
    } catch (error) {
      console.error('Cache preload failed:', error);
      return 0;
    }
  }

  /**
   * Export cache data
   */
  export(): { [key: string]: any } {
    const exported: { [key: string]: any } = {};
    
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        try {
          const data = this.config.enableCompression ? this.decompress(entry.data) : entry.data;
          exported[key] = {
            data: this.deserializeData(data),
            metadata: {
              timestamp: entry.timestamp,
              ttl: entry.ttl,
              tags: entry.tags,
              priority: entry.priority
            }
          };
        } catch (error) {
          console.warn(`Failed to export cache entry ${key}:`, error);
        }
      }
    }
    
    return exported;
  }

  /**
   * Import cache data
   */
  import(data: { [key: string]: any }): number {
    let importedCount = 0;
    
    for (const [key, item] of Object.entries(data)) {
      try {
        if (item.data && item.metadata) {
          if (this.set(key, item.data, {
            ttl: item.metadata.ttl,
            tags: item.metadata.tags,
            priority: item.metadata.priority
          })) {
            importedCount++;
          }
        }
      } catch (error) {
        console.warn(`Failed to import cache entry ${key}:`, error);
      }
    }
    
    return importedCount;
  }

  /**
   * Private methods
   */

  private startCleanupScheduler(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const cleanedCount = this.cleanup();
      if (cleanedCount > 0) {
        console.log(`🧹 Cache cleanup: removed ${cleanedCount} expired entries`);
      }
      
      // Optimize if memory pressure is high
      const stats = this.getStats();
      if (stats.memoryPressure > 0.8) {
        const optimizedCount = this.optimize();
        if (optimizedCount > 0) {
          console.log(`🧹 Cache optimization: removed ${optimizedCount} entries`);
        }
      }
    }, this.config.cleanupInterval);
  }

  private makeSpace(requiredSize: number): boolean {
    const stats = this.getStats();
    
    // Check size limits
    while (
      (stats.totalSize + requiredSize > this.config.maxSize) ||
      (stats.totalEntries >= this.config.maxEntries)
    ) {
      if (!this.evictLRU()) {
        return false; // No more entries to evict
      }
    }
    
    return true;
  }

  private evictLRU(): boolean {
    if (this.accessOrder.length === 0) return false;
    
    // Find the least recently used entry
    const lruKey = this.accessOrder[0];
    this.delete(lruKey);
    this.evictionCount++;
    
    return true;
  }

  private addToAccessOrder(key: string): void {
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.addToAccessOrder(key);
  }

  private isExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp.getTime();
    return age > entry.ttl;
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // UTF-16 encoding
    } catch {
      return 1024; // Default estimate
    }
  }

  private serializeData(data: any): any {
    // Handle special types that don't serialize well
    if (data instanceof Date) {
      return { __type: 'Date', value: data.toISOString() };
    }
    if (data instanceof Map) {
      return { __type: 'Map', value: Array.from(data.entries()) };
    }
    if (data instanceof Set) {
      return { __type: 'Set', value: Array.from(data) };
    }
    return data;
  }

  private deserializeData(data: any): any {
    if (data && typeof data === 'object' && data.__type) {
      switch (data.__type) {
        case 'Date':
          return new Date(data.value);
        case 'Map':
          return new Map(data.value);
        case 'Set':
          return new Set(data.value);
      }
    }
    return data;
  }

  private compress(data: any): any {
    // Simple compression placeholder - could use LZ-string or similar
    return data;
  }

  private decompress(data: any): unknown {
    // Simple decompression placeholder
    return data;
  }



  private calculateOptimizationScore(entry: CacheEntry): number {
    const age = Date.now() - entry.timestamp.getTime();
    const timeSinceAccess = Date.now() - entry.lastAccessed.getTime();
    const priorityWeight = entry.priority === 'high' ? 3 : entry.priority === 'medium' ? 2 : 1;
    
    // Lower score = higher priority for removal
    return (entry.accessCount * priorityWeight) / (age + timeSinceAccess);
  }

  private persistEntry(key: string, entry: CacheEntry): void {
    if (!this.config.enablePersistence) return;
    
    try {
      const persistKey = `cache_${key}`;
      const persistData = {
        data: entry.data,
        timestamp: entry.timestamp.toISOString(),
        ttl: entry.ttl,
        tags: entry.tags,
        priority: entry.priority
      };
      localStorage.setItem(persistKey, JSON.stringify(persistData));
    } catch (error) {
      // localStorage might be full or unavailable
      console.warn(`Failed to persist cache entry ${key}:`, error);
    }
  }

  private removePersistentEntry(key: string): void {
    if (!this.config.enablePersistence) return;
    
    try {
      localStorage.removeItem(`cache_${key}`);
    } catch (error) {
      console.warn(`Failed to remove persistent cache entry ${key}:`, error);
    }
  }

  private loadFromPersistence(): void {
    if (!this.config.enablePersistence) return;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          const cacheKey = key.substring(6); // Remove 'cache_' prefix
          const data = localStorage.getItem(key);
          
          if (data) {
            try {
              const parsed = JSON.parse(data);
              const entry: CacheEntry = {
                key: cacheKey,
                data: parsed.data,
                timestamp: new Date(parsed.timestamp),
                lastAccessed: new Date(),
                accessCount: 0,
                ttl: parsed.ttl,
                size: this.estimateSize(parsed.data),
                tags: parsed.tags || [],
                priority: parsed.priority || 'medium'
              };
              
              // Only load if not expired
              if (!this.isExpired(entry)) {
                this.cache.set(cacheKey, entry);
                this.addToAccessOrder(cacheKey);
              } else {
                localStorage.removeItem(key);
              }
            } catch (error) {
              console.warn(`Failed to load persistent cache entry ${cacheKey}:`, error);
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from persistence:', error);
    }
  }

  private clearPersistence(): void {
    if (!this.config.enablePersistence) return;
    
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('Failed to clear cache persistence:', error);
    }
  }

  /**
   * Shutdown cache manager
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Persist current state if enabled
    if (this.config.enablePersistence) {
      for (const [key, entry] of this.cache.entries()) {
        this.persistEntry(key, entry);
      }
    }
    
    this.clear();
    console.log('🧹 Cache manager shutdown');
  }
}

// Create singleton instances for different cache types
export const appCache = new CacheManager({
  maxSize: 20 * 1024 * 1024, // 20MB
  maxEntries: 500,
  defaultTTL: 300000, // 5 minutes
  enablePersistence: true
});

export const apiCache = new CacheManager({
  maxSize: 10 * 1024 * 1024, // 10MB
  maxEntries: 200,
  defaultTTL: 60000, // 1 minute
  enablePersistence: false
});

export const marketDataCache = new CacheManager({
  maxSize: 5 * 1024 * 1024, // 5MB
  maxEntries: 1000,
  defaultTTL: 30000, // 30 seconds
  enablePersistence: false
});

export { CacheManager };
export default appCache;