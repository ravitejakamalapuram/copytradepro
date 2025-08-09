/**
 * Comprehensive Unit Tests for Search Functionality
 * Tests search functionality and filtering with various scenarios
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getSymbolSearchService } from '../services/symbolSearchService';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { StandardizedSymbol } from '../models/symbolModels';

// Mock the symbol database service
jest.mock('../services/symbolDatabaseService', () => ({
  symbolDatabaseService: {
    searchSymbolsWithFilters: jest.fn(),
    getSymbolById: jest.fn(),
    getSymbolsByUnderlying: jest.fn()
  }
}));

const mockSymbolDatabaseService = symbolDatabaseService as jest.Mocked<typeof symbolDatabaseService>;

describe('Symbol Search Functionality', () => {
  let searchService: ReturnType<typeof getSymbolSearchService>;

  // Mock symbols for testing
  const mockEquitySymbols: StandardizedSymbol[] = [
    {
      id: '507f1f77bcf86cd799439011',
      displayName: 'Tata Consultancy Services Ltd',
      tradingSymbol: 'TCS',
      instrumentType: 'EQUITY',
      exchange: 'NSE',
      segment: 'EQ',
      lotSize: 1,
      tickSize: 0.05,
      isActive: true,
      lastUpdated: '2024-01-15T10:00:00.000Z',
      source: 'upstox',
      companyName: 'Tata Consultancy Services Ltd',
      sector: 'Information Technology',
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    {
      id: '507f1f77bcf86cd799439021',
      displayName: 'Infosys Ltd',
      tradingSymbol: 'INFY',
      instrumentType: 'EQUITY',
      exchange: 'NSE',
      segment: 'EQ',
      lotSize: 1,
      tickSize: 0.05,
      isActive: true,
      lastUpdated: '2024-01-15T10:00:00.000Z',
      source: 'upstox',
      companyName: 'Infosys Ltd',
      sector: 'Information Technology',
      createdAt: '2024-01-01T00:00:00.000Z'
    }
  ];

  const mockOptionSymbols: StandardizedSymbol[] = [
    {
      id: '507f1f77bcf86cd799439012',
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
      lastUpdated: '2024-01-15T10:00:00.000Z',
      source: 'upstox',
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    {
      id: '507f1f77bcf86cd799439022',
      displayName: 'NIFTY 21500 PE 30 JAN 25',
      tradingSymbol: 'NIFTY25JAN21500PE',
      instrumentType: 'OPTION',
      exchange: 'NFO',
      segment: 'FO',
      underlying: 'NIFTY',
      strikePrice: 21500,
      optionType: 'PE',
      expiryDate: '2025-01-30',
      lotSize: 50,
      tickSize: 0.05,
      isActive: true,
      lastUpdated: '2024-01-15T10:00:00.000Z',
      source: 'upstox',
      createdAt: '2024-01-01T00:00:00.000Z'
    }
  ];

  beforeEach(() => {
    searchService = getSymbolSearchService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('searchSymbols', () => {
    it('should perform basic text search', async () => {
      const mockResult = {
        symbols: mockEquitySymbols.slice(0, 1),
        total: 1,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.searchSymbols({
        query: 'TCS',
        limit: 10
      });

      expect(result.symbols).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.searchTime).toBeGreaterThan(0);
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        query: 'TCS',
        instrumentType: undefined,
        exchange: undefined,
        underlying: undefined,
        strikeMin: undefined,
        strikeMax: undefined,
        expiryStart: undefined,
        expiryEnd: undefined,
        optionType: undefined,
        isActive: true,
        limit: 10,
        offset: 0
      });
    });

    it('should handle empty query', async () => {
      const mockResult = {
        symbols: mockEquitySymbols,
        total: 2,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.searchSymbols({
        limit: 10
      });

      expect(result.symbols).toHaveLength(2);
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        query: undefined,
        instrumentType: undefined,
        exchange: undefined,
        underlying: undefined,
        strikeMin: undefined,
        strikeMax: undefined,
        expiryStart: undefined,
        expiryEnd: undefined,
        optionType: undefined,
        isActive: true,
        limit: 10,
        offset: 0
      });
    });

    it('should filter by instrument type', async () => {
      const mockResult = {
        symbols: mockOptionSymbols,
        total: 2,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      await searchService.searchSymbols({
        instrumentType: 'OPTION',
        limit: 10
      });

      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          instrumentType: 'OPTION'
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Database error'));

      const result = await searchService.searchSymbols({
        query: 'TCS',
        limit: 10
      });

      expect(result.symbols).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(result.searchTime).toBeGreaterThan(0);
    });
  });

  describe('quickSearch', () => {
    it('should return empty array for short queries', async () => {
      const result = await searchService.quickSearch('T');
      expect(result).toEqual([]);
    });

    it('should return empty array for empty queries', async () => {
      const result = await searchService.quickSearch('');
      expect(result).toEqual([]);
    });

    it('should perform quick search with default limit', async () => {
      const mockResult = {
        symbols: mockEquitySymbols,
        total: 2,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.quickSearch('TCS');

      expect(result).toHaveLength(2);
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        query: 'TCS',
        limit: 10,
        isActive: true
      });
    });

    it('should handle search errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Search failed'));

      const result = await searchService.quickSearch('TCS');

      expect(result).toEqual([]);
    });
  });

  describe('searchByUnderlying', () => {
    it('should search options by underlying', async () => {
      const niftyOptions = mockOptionSymbols.filter(s => s.underlying === 'NIFTY');
      const mockResult = {
        symbols: niftyOptions,
        total: 2,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.searchByUnderlying('NIFTY', 'OPTION');

      expect(result).toHaveLength(2);
      expect(result.every(s => s.underlying === 'NIFTY')).toBe(true);
      expect(result.every(s => s.instrumentType === 'OPTION')).toBe(true);
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        underlying: 'NIFTY',
        instrumentType: 'OPTION',
        expiryStart: undefined,
        expiryEnd: undefined,
        isActive: true,
        limit: 1000
      });
    });

    it('should handle search errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Search failed'));

      const result = await searchService.searchByUnderlying('NIFTY', 'OPTION');

      expect(result).toEqual([]);
    });
  });

  describe('getOptionChain', () => {
    it('should return separated calls and puts', async () => {
      const mockResult = {
        symbols: mockOptionSymbols,
        total: 2,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.getOptionChain('NIFTY');

      expect(result.calls).toHaveLength(1); // CE options
      expect(result.puts).toHaveLength(1);  // PE options
      expect(result.calls.every(option => option.optionType === 'CE')).toBe(true);
      expect(result.puts.every(option => option.optionType === 'PE')).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Search failed'));

      const result = await searchService.getOptionChain('NIFTY');

      expect(result).toEqual({ calls: [], puts: [], expiries: [] });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array(1000).fill(null).map((_, i) => ({
        ...mockEquitySymbols[0],
        id: `507f1f77bcf86cd79943${i.toString().padStart(4, '0')}`,
        tradingSymbol: `SYMBOL${i}`
      }));

      const mockResult = {
        symbols: largeResultSet,
        total: 1000,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const startTime = Date.now();
      const result = await searchService.searchSymbols({ query: 'SYMBOL' });
      const endTime = Date.now();

      expect(result.symbols).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});