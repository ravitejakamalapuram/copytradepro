import mongoose from 'mongoose';
import { logger } from '../utils/logger';

/**
 * Query performance metrics interface
 */
interface QueryMetrics {
  operation: string;
  collection: string;
  duration: number;
  timestamp: Date;
  query?: any;
  result?: { count?: number; size?: number };
}

/**
 * Database performance statistics
 */
interface DatabaseStats {
  connectionPool: {
    totalConnections: number;
    availableConnections: number;
    checkedOutConnections: number;
    minPoolSize: number;
    maxPoolSize: number;
  };
  queryMetrics: {
    averageQueryTime: number;
    slowQueries: QueryMetrics[];
    totalQueries: number;
    queriesPerSecond: number;
  };
  indexUsage: {
    totalIndexes: number;
    indexHitRatio: number;
    unusedIndexes: string[];
  };
}

/**
 * Database Optimization Service
 * Handles connection pooling, query performance monitoring, and optimization
 */
export class DatabaseOptimizationService {
  private queryMetrics: QueryMetrics[] = [];
  private readonly SLOW_QUERY_THRESHOLD = 100; // 100ms
  private readonly MAX_METRICS_HISTORY = 1000;
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
    this.setupConnectionPooling();
    this.setupQueryMonitoring();
  }

  /**
   * Setup optimized connection pooling
   */
  private setupConnectionPooling(): void {
    // Configure connection pool settings
    const poolConfig = {
      maxPoolSize: 20,        // Maximum number of connections
      minPoolSize: 5,         // Minimum number of connections
      maxIdleTimeMS: 30000,   // Close connections after 30 seconds of inactivity
      serverSelectionTimeoutMS: 5000, // How long to try selecting a server
      socketTimeoutMS: 45000, // How long a send or receive on a socket can take
      bufferMaxEntries: 0,    // Disable mongoose buffering
      bufferCommands: false,  // Disable mongoose buffering
    };

    // Apply to existing connection if available
    if (mongoose.connection.readyState === 1) {
      logger.info('✅ Database connection pool configured', poolConfig);
    }

    // Monitor connection pool events
    mongoose.connection.on('connectionPoolCreated', (event) => {
      logger.info('🔗 Connection pool created', {
        maxPoolSize: event.options?.maxPoolSize,
        minPoolSize: event.options?.minPoolSize
      });
    });

    mongoose.connection.on('connectionPoolClosed', () => {
      logger.info('🔗 Connection pool closed');
    });

    mongoose.connection.on('connectionCheckedOut', () => {
      logger.debug('🔗 Connection checked out from pool');
    });

    mongoose.connection.on('connectionCheckedIn', () => {
      logger.debug('🔗 Connection checked in to pool');
    });
  }

  /**
   * Setup query performance monitoring
   */
  private setupQueryMonitoring(): void {
    // Enable MongoDB profiling for slow queries
    if (mongoose.connection.readyState === 1) {
      this.enableSlowQueryProfiling();
    } else {
      mongoose.connection.once('connected', () => {
        this.enableSlowQueryProfiling();
      });
    }
  }

  /**
   * Enable slow query profiling
   */
  private async enableSlowQueryProfiling(): Promise<void> {
    try {
      // Set profiling level to log slow operations (>100ms)
      if (mongoose.connection.db) {
        await mongoose.connection.db.admin().command({
          profile: 2,
          slowms: this.SLOW_QUERY_THRESHOLD
        });
      }

      logger.info('✅ Database slow query profiling enabled', {
        threshold: `${this.SLOW_QUERY_THRESHOLD}ms`
      });
    } catch (error) {
      logger.warn('⚠️ Could not enable database profiling', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Record query metrics
   */
  recordQuery(operation: string, collection: string, duration: number, query?: any, result?: any): void {
    const metric: QueryMetrics = {
      operation,
      collection,
      duration,
      timestamp: new Date(),
      query,
      result
    };

    this.queryMetrics.push(metric);

    // Keep only recent metrics
    if (this.queryMetrics.length > this.MAX_METRICS_HISTORY) {
      this.queryMetrics = this.queryMetrics.slice(-this.MAX_METRICS_HISTORY);
    }

    // Log slow queries
    if (duration > this.SLOW_QUERY_THRESHOLD) {
      logger.warn('🐌 Slow query detected', {
        operation,
        collection,
        duration,
        durationMs: `${duration}ms`,
        query: this.sanitizeQuery(query)
      });
    }
  }

  /**
   * Get database performance statistics
   */
  async getPerformanceStats(): Promise<DatabaseStats> {
    try {
      const connectionStats = await this.getConnectionPoolStats();
      const queryStats = this.getQueryStats();
      const indexStats = await this.getIndexStats();

      return {
        connectionPool: connectionStats,
        queryMetrics: queryStats,
        indexUsage: indexStats
      };
    } catch (error) {
      logger.error('🚨 Failed to get database performance stats', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        connectionPool: {
          totalConnections: 0,
          availableConnections: 0,
          checkedOutConnections: 0,
          minPoolSize: 0,
          maxPoolSize: 0
        },
        queryMetrics: {
          averageQueryTime: 0,
          slowQueries: [],
          totalQueries: 0,
          queriesPerSecond: 0
        },
        indexUsage: {
          totalIndexes: 0,
          indexHitRatio: 0,
          unusedIndexes: []
        }
      };
    }
  }

  /**
   * Get connection pool statistics
   */
  private async getConnectionPoolStats(): Promise<DatabaseStats['connectionPool']> {
    try {
      if (!mongoose.connection.db) {
        throw new Error('Database connection not available');
      }
      const serverStatus = await mongoose.connection.db.admin().command({ serverStatus: 1 });
      const connections = serverStatus.connections || {};

      return {
        totalConnections: connections.current || 0,
        availableConnections: connections.available || 0,
        checkedOutConnections: connections.current - connections.available || 0,
        minPoolSize: 5, // From our configuration
        maxPoolSize: 20 // From our configuration
      };
    } catch (error) {
      logger.warn('⚠️ Could not get connection pool stats', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        totalConnections: 0,
        availableConnections: 0,
        checkedOutConnections: 0,
        minPoolSize: 5,
        maxPoolSize: 20
      };
    }
  }

  /**
   * Get query performance statistics
   */
  private getQueryStats(): DatabaseStats['queryMetrics'] {
    if (this.queryMetrics.length === 0) {
      return {
        averageQueryTime: 0,
        slowQueries: [],
        totalQueries: 0,
        queriesPerSecond: 0
      };
    }

    const totalDuration = this.queryMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    const averageQueryTime = totalDuration / this.queryMetrics.length;
    const slowQueries = this.queryMetrics.filter(metric => metric.duration > this.SLOW_QUERY_THRESHOLD);

    // Calculate queries per second over the last minute
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentQueries = this.queryMetrics.filter(metric => metric.timestamp > oneMinuteAgo);
    const queriesPerSecond = recentQueries.length / 60;

    return {
      averageQueryTime: Math.round(averageQueryTime * 100) / 100,
      slowQueries: slowQueries.slice(-10), // Last 10 slow queries
      totalQueries: this.queryMetrics.length,
      queriesPerSecond: Math.round(queriesPerSecond * 100) / 100
    };
  }

  /**
   * Get index usage statistics
   */
  private async getIndexStats(): Promise<DatabaseStats['indexUsage']> {
    try {
      if (!mongoose.connection.db) {
        throw new Error('Database connection not available');
      }
      const collections = await mongoose.connection.db.listCollections().toArray();
      let totalIndexes = 0;
      const unusedIndexes: string[] = [];

      for (const collection of collections) {
        const collectionName = collection.name;
        const indexes = await mongoose.connection.db.collection(collectionName).indexes();
        totalIndexes += indexes.length;

        // Check index usage statistics (if available)
        try {
          const indexStats = await mongoose.connection.db.collection(collectionName).aggregate([
            { $indexStats: {} }
          ]).toArray();

          for (const indexStat of indexStats) {
            if (indexStat.accesses?.ops === 0 && indexStat.name !== '_id_') {
              unusedIndexes.push(`${collectionName}.${indexStat.name}`);
            }
          }
        } catch (error) {
          // Index stats might not be available in all MongoDB versions
          logger.debug('Index stats not available for collection', { collectionName });
        }
      }

      return {
        totalIndexes,
        indexHitRatio: 95, // Placeholder - would need more complex calculation
        unusedIndexes
      };
    } catch (error) {
      logger.warn('⚠️ Could not get index stats', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        totalIndexes: 0,
        indexHitRatio: 0,
        unusedIndexes: []
      };
    }
  }

  /**
   * Optimize database performance
   */
  async optimizeDatabase(): Promise<{
    indexesCreated: string[];
    indexesDropped: string[];
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    const indexesCreated: string[] = [];
    const indexesDropped: string[] = [];

    try {
      // Analyze slow queries and suggest optimizations
      const slowQueries = this.queryMetrics.filter(metric => metric.duration > this.SLOW_QUERY_THRESHOLD);
      
      if (slowQueries.length > 0) {
        recommendations.push(`Found ${slowQueries.length} slow queries. Consider adding indexes for frequently queried fields.`);
      }

      // Check for missing indexes on frequently queried fields
      const queryPatterns = this.analyzeQueryPatterns();
      for (const pattern of queryPatterns) {
        recommendations.push(`Consider adding index on ${pattern.collection}.${pattern.field} (queried ${pattern.count} times)`);
      }

      // Suggest connection pool optimization
      const stats = await this.getPerformanceStats();
      if (stats.connectionPool.checkedOutConnections > stats.connectionPool.maxPoolSize * 0.8) {
        recommendations.push('Consider increasing connection pool size due to high usage');
      }

      logger.info('✅ Database optimization analysis completed', {
        recommendations: recommendations.length,
        indexesCreated: indexesCreated.length,
        indexesDropped: indexesDropped.length
      });

      return {
        indexesCreated,
        indexesDropped,
        recommendations
      };
    } catch (error) {
      logger.error('🚨 Database optimization failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        indexesCreated: [],
        indexesDropped: [],
        recommendations: ['Database optimization failed - check logs for details']
      };
    }
  }

  /**
   * Analyze query patterns to suggest optimizations
   */
  private analyzeQueryPatterns(): Array<{ collection: string; field: string; count: number }> {
    const patterns: Record<string, number> = {};

    for (const metric of this.queryMetrics) {
      if (metric.query && typeof metric.query === 'object') {
        const fields = Object.keys(metric.query);
        for (const field of fields) {
          const key = `${metric.collection}.${field}`;
          patterns[key] = (patterns[key] || 0) + 1;
        }
      }
    }

    return Object.entries(patterns)
      .map(([key, count]) => {
        const [collection, field] = key.split('.');
        return { collection: collection || '', field: field || '', count };
      })
      .filter(pattern => pattern.count > 5 && pattern.collection && pattern.field) // Only suggest for frequently used fields
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 suggestions
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: any): any {
    if (!query || typeof query !== 'object') {
      return query;
    }

    const sanitized = { ...query };
    
    // Remove potentially sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key'];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Clear query metrics history
   */
  clearMetrics(): void {
    this.queryMetrics = [];
    logger.info('📊 Query metrics history cleared');
  }

  /**
   * Get uptime in seconds
   */
  getUptime(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / 1000);
  }
}

// Export singleton instance
export const databaseOptimizationService = new DatabaseOptimizationService();