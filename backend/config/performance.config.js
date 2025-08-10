/**
 * Performance Optimization Configuration
 * Production performance settings for the standardized symbol management system
 */

const cluster = require('cluster');
const os = require('os');

class PerformanceConfig {
  constructor() {
    this.settings = {
      // Clustering
      enableClustering: process.env.ENABLE_CLUSTERING === 'true',
      workerCount: parseInt(process.env.WORKER_COUNT || os.cpus().length),
      
      // Memory management
      maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE || '512'), // MB
      gcInterval: parseInt(process.env.GC_INTERVAL || '300000'), // 5 minutes
      
      // Connection pooling
      mongoPoolSize: parseInt(process.env.MONGO_POOL_SIZE || '10'),
      mongoMaxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '50'),
      
      // Caching
      enableCaching: process.env.ENABLE_CACHING !== 'false',
      cacheSize: parseInt(process.env.CACHE_SIZE || '1000'),
      cacheTTL: parseInt(process.env.CACHE_TTL || '300000'), // 5 minutes
      
      // Request optimization
      compressionEnabled: process.env.COMPRESSION_ENABLED !== 'false',
      compressionLevel: parseInt(process.env.COMPRESSION_LEVEL || '6'),
      
      // Symbol processing
      symbolBatchSize: parseInt(process.env.SYMBOL_BATCH_SIZE || '1000'),
      symbolProcessingConcurrency: parseInt(process.env.SYMBOL_PROCESSING_CONCURRENCY || '5'),
      
      // Database optimization
      dbQueryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000'), // 30 seconds
      dbConnectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'), // 10 seconds
      
      // API optimization
      apiResponseCaching: process.env.API_RESPONSE_CACHING === 'true',
      apiCacheDuration: parseInt(process.env.API_CACHE_DURATION || '60000'), // 1 minute
    };
    
    this.cache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };
    
    this.initializeOptimizations();
  }

  initializeOptimizations() {
    // Setup memory monitoring
    this.setupMemoryMonitoring();
    
    // Setup cache cleanup
    this.setupCacheCleanup();
    
    // Setup garbage collection optimization
    this.setupGarbageCollection();
  }

  // Memory monitoring and management
  setupMemoryMonitoring() {
    setInterval(() => {
      const memoryUsage = process.memoryUsage();
      const rssInMB = Math.round(memoryUsage.rss / 1024 / 1024);
      
      if (rssInMB > this.settings.maxMemoryUsage) {
        console.warn(`High memory usage detected: ${rssInMB}MB (threshold: ${this.settings.maxMemoryUsage}MB)`);
        
        // Clear cache if memory is high
        if (this.cache.size > 0) {
          const cacheSize = this.cache.size;
          this.clearCache();
          console.log(`Cleared cache (${cacheSize} entries) due to high memory usage`);
        }
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
          console.log('Forced garbage collection due to high memory usage');
        }
      }
    }, 60000); // Check every minute
  }

  // Cache management
  setupCacheCleanup() {
    if (!this.settings.enableCaching) return;
    
    setInterval(() => {
      this.cleanExpiredCache();
    }, this.settings.cacheTTL / 2); // Clean every half TTL
  }

  // Garbage collection optimization
  setupGarbageCollection() {
    if (global.gc && this.settings.gcInterval > 0) {
      setInterval(() => {
        global.gc();
      }, this.settings.gcInterval);
    }
  }

  // Cache operations
  setCache(key, value, ttl = this.settings.cacheTTL) {
    if (!this.settings.enableCaching) return false;
    
    // Check cache size limit
    if (this.cache.size >= this.settings.cacheSize) {
      // Remove oldest entry (LRU)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.cacheStats.deletes++;
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
    
    this.cacheStats.sets++;
    return true;
  }

  getCache(key) {
    if (!this.settings.enableCaching) return null;
    
    const entry = this.cache.get(key);
    if (!entry) {
      this.cacheStats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.cacheStats.misses++;
      this.cacheStats.deletes++;
      return null;
    }
    
    this.cacheStats.hits++;
    return entry.value;
  }

  deleteCache(key) {
    if (!this.settings.enableCaching) return false;
    
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.cacheStats.deletes++;
    }
    return deleted;
  }

  clearCache() {
    if (!this.settings.enableCaching) return;
    
    const size = this.cache.size;
    this.cache.clear();
    this.cacheStats.deletes += size;
  }

  cleanExpiredCache() {
    if (!this.settings.enableCaching) return;
    
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    this.cacheStats.deletes += cleaned;
    
    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired cache entries`);
    }
  }

  // Database connection optimization
  getMongoConnectionOptions() {
    return {
      maxPoolSize: this.settings.mongoMaxPoolSize,
      minPoolSize: this.settings.mongoPoolSize,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: this.settings.dbConnectionTimeout,
      socketTimeoutMS: this.settings.dbQueryTimeout,
      bufferMaxEntries: 0,
      bufferCommands: false,
      
      // Connection optimization
      useNewUrlParser: true,
      useUnifiedTopology: true,
      
      // Performance optimization
      readPreference: 'secondaryPreferred',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority', j: true, wtimeout: 10000 }
    };
  }

  // Symbol processing optimization
  async processSymbolsBatch(symbols, processor) {
    const batches = this.createBatches(symbols, this.settings.symbolBatchSize);
    const results = [];
    
    // Process batches with limited concurrency
    for (let i = 0; i < batches.length; i += this.settings.symbolProcessingConcurrency) {
      const concurrentBatches = batches.slice(i, i + this.settings.symbolProcessingConcurrency);
      
      const batchPromises = concurrentBatches.map(batch => 
        this.processBatch(batch, processor)
      );
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }

  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  async processBatch(batch, processor) {
    try {
      return await processor(batch);
    } catch (error) {
      console.error('Batch processing error:', error);
      throw error;
    }
  }

  // Express middleware for performance optimization
  compressionMiddleware() {
    if (!this.settings.compressionEnabled) {
      return (req, res, next) => next();
    }
    
    const compression = require('compression');
    return compression({
      level: this.settings.compressionLevel,
      threshold: 1024, // Only compress responses > 1KB
      filter: (req, res) => {
        // Don't compress if client doesn't support it
        if (req.headers['x-no-compression']) {
          return false;
        }
        
        // Use compression filter
        return compression.filter(req, res);
      }
    });
  }

  // API response caching middleware
  apiCacheMiddleware() {
    if (!this.settings.apiResponseCaching) {
      return (req, res, next) => next();
    }
    
    return (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }
      
      const cacheKey = `api:${req.originalUrl}`;
      const cached = this.getCache(cacheKey);
      
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
      
      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = (data) => {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.setCache(cacheKey, data, this.settings.apiCacheDuration);
        }
        
        res.set('X-Cache', 'MISS');
        return originalJson.call(res, data);
      };
      
      next();
    };
  }

  // Get performance statistics
  getPerformanceStats() {
    const memoryUsage = process.memoryUsage();
    
    return {
      timestamp: new Date().toISOString(),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
      },
      cache: {
        size: this.cache.size,
        maxSize: this.settings.cacheSize,
        hitRate: this.cacheStats.hits + this.cacheStats.misses > 0 
          ? ((this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100).toFixed(2) + '%'
          : '0%',
        stats: this.cacheStats
      },
      uptime: Math.round(process.uptime()) + 's',
      pid: process.pid,
      nodeVersion: process.version
    };
  }

  // Cluster management
  setupClustering() {
    if (!this.settings.enableClustering || cluster.isWorker) {
      return false;
    }
    
    console.log(`Setting up cluster with ${this.settings.workerCount} workers`);
    
    // Fork workers
    for (let i = 0; i < this.settings.workerCount; i++) {
      cluster.fork();
    }
    
    // Handle worker events
    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} died (${signal || code}). Restarting...`);
      cluster.fork();
    });
    
    cluster.on('online', (worker) => {
      console.log(`Worker ${worker.process.pid} is online`);
    });
    
    return true;
  }
}

// Create singleton instance
const performanceConfig = new PerformanceConfig();

module.exports = performanceConfig;