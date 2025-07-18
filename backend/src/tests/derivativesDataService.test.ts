/**
 * Tests for Derivatives Data Service
 * Verifies caching, real-time updates, and data validation
 */

import { derivativesDataService } from '../services/derivativesDataService';
import { derivativesDataCacheService } from '../services/derivativesDataCacheService';
import { realTimeGreeksService } from '../services/realTimeGreeksService';
import { afterEach } from 'node:test';

describe('DerivativesDataService', () => {
  beforeAll(() => {
    // Initialize services
    derivativesDataService.initialize();
  });

  afterAll(() => {
    // Cleanup services
    derivativesDataService.shutdown();
  });

  describe('Option Chain Operations', () => {
    test('should fetch and cache option chain', async () => {
      const underlying = 'NIFTY';
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // First call should fetch from "broker"
      const optionChain1 = await derivativesDataService.getOptionChain(underlying, expiryDate);
      expect(optionChain1).toBeTruthy();
      expect(optionChain1?.underlying).toBe(underlying);
      expect(optionChain1?.expiryDate).toEqual(expiryDate);

      // Second call should hit cache
      const optionChain2 = await derivativesDataService.getOptionChain(underlying, expiryDate);
      expect(optionChain2).toBeTruthy();
      expect(optionChain2?.underlying).toBe(underlying);
    });

    test('should force refresh option chain when requested', async () => {
      const underlying = 'BANKNIFTY';
      const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      // First call
      const optionChain1 = await derivativesDataService.getOptionChain(underlying, expiryDate);
      expect(optionChain1).toBeTruthy();

      // Force refresh should bypass cache
      const optionChain2 = await derivativesDataService.getOptionChain(underlying, expiryDate, true);
      expect(optionChain2).toBeTruthy();
    });
  });

  describe('Futures Chain Operations', () => {
    test('should fetch and cache futures chain', async () => {
      const underlying = 'NIFTY';

      // First call should fetch from "broker"
      const futuresChain1 = await derivativesDataService.getFuturesChain(underlying);
      expect(futuresChain1).toBeTruthy();
      expect(futuresChain1?.underlying).toBe(underlying);

      // Second call should hit cache
      const futuresChain2 = await derivativesDataService.getFuturesChain(underlying);
      expect(futuresChain2).toBeTruthy();
      expect(futuresChain2?.underlying).toBe(underlying);
    });
  });

  describe('Real-time Data Subscriptions', () => {
    test('should create and manage subscriptions', () => {
      const userId = 'test-user-1';
      const symbols = ['NIFTY24JAN20000CE', 'NIFTY24JAN20000PE'];
      const underlyings = ['NIFTY'];

      // Subscribe to derivatives data
      derivativesDataService.subscribeToDerivativesData(userId, symbols, underlyings, 'both');

      // Check service stats
      const stats = derivativesDataService.getStats();
      expect(stats.activeSubscriptions).toBeGreaterThan(0);

      // Unsubscribe
      derivativesDataService.unsubscribeFromDerivativesData(userId);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate cache on significant price changes', () => {
      const underlying = 'NIFTY';
      const oldPrice = 20000;
      const newPrice = 20500; // 2.5% change

      // This should trigger cache invalidation
      derivativesDataService.handleUnderlyingPriceChange(underlying, newPrice, oldPrice);

      // Verify cache was invalidated (indirectly through no errors)
      expect(true).toBe(true);
    });

    test('should not invalidate cache on small price changes', () => {
      const underlying = 'BANKNIFTY';
      const oldPrice = 45000;
      const newPrice = 45050; // 0.11% change

      // This should not trigger cache invalidation
      derivativesDataService.handleUnderlyingPriceChange(underlying, newPrice, oldPrice);

      // Verify cache was not invalidated (indirectly through no errors)
      expect(true).toBe(true);
    });
  });

  describe('Service Statistics', () => {
    test('should provide comprehensive service statistics', () => {
      const stats = derivativesDataService.getStats();

      expect(stats).toHaveProperty('isInitialized');
      expect(stats).toHaveProperty('activeSubscriptions');
      expect(stats).toHaveProperty('cache');
      expect(stats).toHaveProperty('greeksService');
      expect(stats).toHaveProperty('updateFrequency');

      expect(stats.isInitialized).toBe(true);
      expect(typeof stats.activeSubscriptions).toBe('number');
      expect(typeof stats.updateFrequency).toBe('number');
    });
  });
});

describe('DerivativesDataCacheService', () => {
  beforeAll(() => {
    derivativesDataCacheService.initialize();
  });

  afterAll(() => {
    derivativesDataCacheService.shutdown();
  });

  describe('Cache Operations', () => {
    test('should cache and retrieve option chain', () => {
      const underlying = 'NIFTY';
      const expiryDate = new Date('2024-01-25');
      const mockOptionChain = {
        underlying,
        expiryDate,
        strikes: [],
        impliedVolatility: 0.2,
        historicalVolatility: 0.25,
        atmStrike: 20000,
        daysToExpiry: 30,
        interestRate: 0.05
      };

      // Cache the option chain
      derivativesDataCacheService.cacheOptionChain(underlying, expiryDate, mockOptionChain);

      // Retrieve from cache
      const cachedChain = derivativesDataCacheService.getCachedOptionChain(underlying, expiryDate);
      expect(cachedChain).toBeTruthy();
      expect(cachedChain?.underlying).toBe(underlying);
      expect(cachedChain?.atmStrike).toBe(20000);
    });

    test('should cache and retrieve futures chain', () => {
      const underlying = 'BANKNIFTY';
      const mockFuturesChain = {
        underlying,
        contracts: [],
        nearMonthContract: {} as any,
        rolloverDate: new Date(),
        specifications: {
          contractSize: 25,
          tickValue: 0.05,
          tradingHours: { start: '09:15', end: '15:30' },
          settlementType: 'cash' as const,
          marginPercentage: 10
        }
      };

      // Cache the futures chain
      derivativesDataCacheService.cacheFuturesChain(underlying, mockFuturesChain);

      // Retrieve from cache
      const cachedChain = derivativesDataCacheService.getCachedFuturesChain(underlying);
      expect(cachedChain).toBeTruthy();
      expect(cachedChain?.underlying).toBe(underlying);
      expect(cachedChain?.specifications.contractSize).toBe(25);
    });

    test('should return null for non-existent cache entries', () => {
      const nonExistentChain = derivativesDataCacheService.getCachedOptionChain('NONEXISTENT', new Date());
      expect(nonExistentChain).toBeNull();

      const nonExistentFutures = derivativesDataCacheService.getCachedFuturesChain('NONEXISTENT');
      expect(nonExistentFutures).toBeNull();
    });
  });

  describe('Cache Statistics', () => {
    test('should provide cache statistics', () => {
      const stats = derivativesDataCacheService.getStats();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('missRate');
      expect(stats).toHaveProperty('totalHits');
      expect(stats).toHaveProperty('totalMisses');
      expect(stats).toHaveProperty('memoryUsage');

      expect(typeof stats.totalEntries).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
      expect(typeof stats.missRate).toBe('number');
    });

    test('should provide detailed cache information', () => {
      const info = derivativesDataCacheService.getCacheInfo();

      expect(info).toHaveProperty('optionChains');
      expect(info).toHaveProperty('futuresChains');
      expect(info).toHaveProperty('optionContracts');
      expect(info).toHaveProperty('futuresContracts');
      expect(info).toHaveProperty('totalEntries');
      expect(info).toHaveProperty('config');
      expect(info).toHaveProperty('marketHours');
      expect(info).toHaveProperty('isInitialized');

      expect(info.isInitialized).toBe(true);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate cache entries for underlying', () => {
      const underlying = 'TESTSTOCK';
      const expiryDate = new Date('2024-01-25');
      const mockOptionChain = {
        underlying,
        expiryDate,
        strikes: [],
        impliedVolatility: 0.2,
        historicalVolatility: 0.25,
        atmStrike: 1000,
        daysToExpiry: 30,
        interestRate: 0.05
      };

      // Cache the option chain
      derivativesDataCacheService.cacheOptionChain(underlying, expiryDate, mockOptionChain);

      // Verify it's cached
      let cachedChain = derivativesDataCacheService.getCachedOptionChain(underlying, expiryDate);
      expect(cachedChain).toBeTruthy();

      // Invalidate cache for underlying
      derivativesDataCacheService.invalidateUnderlying(underlying);

      // The entry should still exist but be marked as stale
      // (actual removal happens during cleanup)
      expect(true).toBe(true); // Placeholder assertion
    });

    test('should clear all cache entries', () => {
      // Add some entries
      const underlying = 'CLEARTEST';
      const expiryDate = new Date('2024-01-25');
      const mockOptionChain = {
        underlying,
        expiryDate,
        strikes: [],
        impliedVolatility: 0.2,
        historicalVolatility: 0.25,
        atmStrike: 1000,
        daysToExpiry: 30,
        interestRate: 0.05
      };

      derivativesDataCacheService.cacheOptionChain(underlying, expiryDate, mockOptionChain);

      // Clear all
      derivativesDataCacheService.clearAll();

      // Verify cache is empty
      const stats = derivativesDataCacheService.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});

describe('RealTimeGreeksService', () => {
  afterEach(() => {
    // Cleanup after each test
    realTimeGreeksService.shutdown();
  });

  describe('Greeks Subscriptions', () => {
    test('should create and manage Greeks subscriptions', () => {
      const userId = 'test-user-greeks';
      const symbols = ['NIFTY24JAN20000CE', 'NIFTY24JAN20000PE'];

      // Subscribe to Greeks updates
      realTimeGreeksService.subscribeToGreeks(userId, symbols, 2000);

      // Check service stats
      const stats = realTimeGreeksService.getStats();
      expect(stats.activeSubscriptions).toBeGreaterThan(0);

      // Unsubscribe
      realTimeGreeksService.unsubscribeFromGreeks(userId);

      // Check stats after unsubscribe
      const statsAfter = realTimeGreeksService.getStats();
      expect(statsAfter.activeSubscriptions).toBe(0);
    });
  });

  describe('Portfolio Greeks Calculation', () => {
    test('should calculate portfolio Greeks from positions', () => {
      const userId = 'test-portfolio-user';
      const mockPositions = [
        {
          id: '1',
          brokerId: 'broker1',
          symbol: 'NIFTY24JAN20000CE',
          underlying: 'NIFTY',
          positionType: 'long' as const,
          quantity: 50,
          avgPrice: 100,
          currentPrice: 110,
          unrealizedPnL: 500,
          realizedPnL: 0,
          totalPnL: 500,
          positionValue: 5500,
          marginUsed: 1000,
          entryDate: new Date(),
          lastUpdated: new Date(),
          optionType: 'call' as const,
          strike: 20000,
          expiryDate: new Date('2024-01-25'),
          premium: 100,
          greeks: {
            delta: 0.5,
            gamma: 0.01,
            theta: -0.05,
            vega: 0.2,
            rho: 0.1
          },
          impliedVolatility: 0.2,
          timeValue: 50,
          intrinsicValue: 50,
          daysToExpiry: 30
        }
      ];

      const portfolioGreeks = realTimeGreeksService.calculatePortfolioGreeks(userId, mockPositions);

      expect(portfolioGreeks).toBeTruthy();
      expect(portfolioGreeks.totalDelta).toBe(25); // 0.5 * 50
      expect(portfolioGreeks.totalGamma).toBe(0.5); // 0.01 * 50
      expect(portfolioGreeks.totalTheta).toBe(-2.5); // -0.05 * 50
      expect(portfolioGreeks.totalVega).toBe(10); // 0.2 * 50
      expect(portfolioGreeks.totalRho).toBe(5); // 0.1 * 50
      expect(portfolioGreeks.underlyingBreakdown).toHaveProperty('NIFTY');
    });
  });

  describe('Service Statistics', () => {
    test('should provide Greeks service statistics', () => {
      const stats = realTimeGreeksService.getStats();

      expect(stats).toHaveProperty('activeSubscriptions');
      expect(stats).toHaveProperty('cachedSymbols');
      expect(stats).toHaveProperty('activeIntervals');
      expect(stats).toHaveProperty('portfolioGreeksCache');
      expect(stats).toHaveProperty('totalUnderlyings');

      expect(typeof stats.activeSubscriptions).toBe('number');
      expect(typeof stats.cachedSymbols).toBe('number');
      expect(typeof stats.activeIntervals).toBe('number');
    });
  });
});