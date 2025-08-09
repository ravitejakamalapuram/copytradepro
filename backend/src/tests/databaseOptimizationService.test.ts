import { DatabaseOptimizationService } from '../services/databaseOptimizationService';

// Mock mongoose
jest.mock('mongoose', () => ({
  connection: {
    readyState: 1,
    db: {
      admin: () => ({
        command: jest.fn().mockResolvedValue({
          connections: {
            current: 10,
            available: 5
          }
        })
      }),
      listCollections: () => ({
        toArray: jest.fn().mockResolvedValue([
          { name: 'standardizedsymbols' },
          { name: 'symbolhistories' }
        ])
      }),
      collection: () => ({
        indexes: jest.fn().mockResolvedValue([
          { name: '_id_' },
          { name: 'tradingSymbol_1' },
          { name: 'exchange_1' }
        ]),
        aggregate: () => ({
          toArray: jest.fn().mockResolvedValue([
            { name: 'tradingSymbol_1', accesses: { ops: 100 } },
            { name: 'exchange_1', accesses: { ops: 0 } }
          ])
        })
      })
    },
    on: jest.fn(),
    once: jest.fn()
  }
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('DatabaseOptimizationService', () => {
  let service: DatabaseOptimizationService;

  beforeEach(() => {
    service = new DatabaseOptimizationService();
    jest.clearAllMocks();
  });

  describe('Query Metrics Recording', () => {
    it('should record query metrics', () => {
      service.recordQuery('find', 'standardizedsymbols', 50, { tradingSymbol: 'NIFTY' }, { count: 10 });
      
      const stats = service['getQueryStats']();
      expect(stats.totalQueries).toBe(1);
      expect(stats.averageQueryTime).toBe(50);
    });

    it('should identify slow queries', () => {
      // Record a slow query (>100ms)
      service.recordQuery('find', 'standardizedsymbols', 150, { tradingSymbol: 'NIFTY' }, { count: 10 });
      
      const stats = service['getQueryStats']();
      expect(stats.slowQueries).toHaveLength(1);
      expect(stats.slowQueries[0]?.duration).toBe(150);
    });

    it('should calculate average query time correctly', () => {
      service.recordQuery('find', 'standardizedsymbols', 50);
      service.recordQuery('findOne', 'standardizedsymbols', 100);
      service.recordQuery('countDocuments', 'standardizedsymbols', 25);
      
      const stats = service['getQueryStats']();
      expect(stats.totalQueries).toBe(3);
      expect(stats.averageQueryTime).toBe(58.33); // (50 + 100 + 25) / 3 = 58.33
    });

    it('should limit metrics history', () => {
      const maxHistory = (service as any).MAX_METRICS_HISTORY;
      
      // Record more queries than the limit
      for (let i = 0; i < maxHistory + 100; i++) {
        service.recordQuery('find', 'test', 10);
      }
      
      const stats = service['getQueryStats']();
      expect(stats.totalQueries).toBe(maxHistory);
    });
  });

  describe('Performance Statistics', () => {
    it('should get performance statistics', async () => {
      // Record some test queries
      service.recordQuery('find', 'standardizedsymbols', 50);
      service.recordQuery('findOne', 'standardizedsymbols', 150); // slow query
      
      const stats = await service.getPerformanceStats();
      
      expect(stats).toHaveProperty('connectionPool');
      expect(stats).toHaveProperty('queryMetrics');
      expect(stats).toHaveProperty('indexUsage');
      
      expect(stats.queryMetrics.totalQueries).toBe(2);
      expect(stats.queryMetrics.slowQueries).toHaveLength(1);
      expect(stats.queryMetrics.averageQueryTime).toBe(100);
    });

    it('should handle errors gracefully when getting stats', async () => {
      // Mock mongoose to throw an error
      const mockConnection = require('mongoose').connection;
      mockConnection.db.admin = () => ({
        command: jest.fn().mockRejectedValue(new Error('Database error'))
      });
      
      const stats = await service.getPerformanceStats();
      
      // Should return default values instead of throwing
      expect(stats.connectionPool.totalConnections).toBe(0);
      expect(stats.queryMetrics.totalQueries).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Database Optimization', () => {
    it('should analyze query patterns and provide recommendations', async () => {
      // Record queries with patterns
      service.recordQuery('find', 'standardizedsymbols', 150, { tradingSymbol: 'NIFTY' });
      service.recordQuery('find', 'standardizedsymbols', 120, { tradingSymbol: 'BANKNIFTY' });
      service.recordQuery('find', 'standardizedsymbols', 130, { exchange: 'NSE' });
      
      const result = await service.optimizeDatabase();
      
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('indexesCreated');
      expect(result).toHaveProperty('indexesDropped');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should suggest optimizations for slow queries', async () => {
      // Record multiple slow queries
      for (let i = 0; i < 5; i++) {
        service.recordQuery('find', 'standardizedsymbols', 150, { tradingSymbol: `SYMBOL${i}` });
      }
      
      const result = await service.optimizeDatabase();
      
      expect(result.recommendations.some(rec => rec.includes('Found 5 slow queries'))).toBe(true);
    });
  });

  describe('Query Pattern Analysis', () => {
    it('should analyze query patterns correctly', () => {
      // Record queries with different patterns - need more than 5 to trigger suggestions
      for (let i = 0; i < 6; i++) {
        service.recordQuery('find', 'standardizedsymbols', 50, { exchange: 'NSE' });
      }
      for (let i = 0; i < 7; i++) {
        service.recordQuery('find', 'standardizedsymbols', 60, { tradingSymbol: 'NIFTY' });
      }
      
      const patterns = service['analyzeQueryPatterns']();
      
      // Should identify exchange as frequently queried field
      const exchangePattern = patterns.find(p => p.field === 'exchange');
      expect(exchangePattern).toBeDefined();
      expect(exchangePattern?.count).toBe(6);
      
      // Should identify tradingSymbol as queried field
      const tradingSymbolPattern = patterns.find(p => p.field === 'tradingSymbol');
      expect(tradingSymbolPattern).toBeDefined();
      expect(tradingSymbolPattern?.count).toBe(7);
    });

    it('should only suggest patterns for frequently used fields', () => {
      // Record queries but not enough to trigger suggestions
      service.recordQuery('find', 'standardizedsymbols', 50, { rareField: 'value' });
      service.recordQuery('find', 'standardizedsymbols', 60, { rareField: 'value2' });
      
      const patterns = service['analyzeQueryPatterns']();
      
      // Should not suggest optimization for rarely used fields
      expect(patterns).toHaveLength(0);
    });
  });

  describe('Query Sanitization', () => {
    it('should sanitize sensitive data from queries', () => {
      const sensitiveQuery = {
        tradingSymbol: 'NIFTY',
        password: 'secret123',
        token: 'abc123',
        normalField: 'value'
      };
      
      const sanitized = service['sanitizeQuery'](sensitiveQuery);
      
      expect(sanitized.tradingSymbol).toBe('NIFTY');
      expect(sanitized.normalField).toBe('value');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
    });

    it('should handle non-object queries', () => {
      expect(service['sanitizeQuery']('string query')).toBe('string query');
      expect(service['sanitizeQuery'](null)).toBe(null);
      expect(service['sanitizeQuery'](undefined)).toBe(undefined);
    });
  });

  describe('Utility Methods', () => {
    it('should clear metrics', () => {
      service.recordQuery('find', 'test', 50);
      expect(service['getQueryStats']().totalQueries).toBe(1);
      
      service.clearMetrics();
      expect(service['getQueryStats']().totalQueries).toBe(0);
    });

    it('should track uptime', () => {
      const uptime = service.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(typeof uptime).toBe('number');
    });
  });
});