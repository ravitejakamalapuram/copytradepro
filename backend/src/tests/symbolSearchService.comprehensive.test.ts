/**
 * Comprehensive Unit Tests for Symbol Search Service
 * Tests search functionality and filtering with various scenarios
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SymbolSearchService, SearchOptions, EnhancedSearchResult } from '../services/symbolSearchService';
import { SymbolDatabaseService, SymbolSearchQuery, SymbolSearchResult } from '../services/symbolDatabaseService';
import { StandardizedSymbol } from '../models/symbolModels';

// Mock the symbol database service
const mockSymbolDatabaseService = {
  searchSymbolsWithFilters: jest.fn(),
  getSymbolById: jest.fn(),
  getSymbolsByUnderlying: jest.fn()
} as jest.Mocked<SymbolDatabaseService>;

describe('SymbolSearchService', () => {
  let searchService: SymbolSearchService;

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
    },
    {
      id: '507f1f77bcf86cd799439031',
      displayName: 'Reliance Industries Ltd',
      tradingSymbol: 'RELIANCE',
      instrumentType: 'EQUITY',
      exchange: 'NSE',
      segment: 'EQ',
      lotSize: 1,
      tickSize: 0.05,
      isActive: true,
      lastUpdated: '2024-01-15T10:00:00.000Z',
      source: 'upstox',
      companyName: 'Reliance Industries Ltd',
      sector: 'Oil & Gas',
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
    },
    {
      id: '507f1f77bcf86cd799439032',
      displayName: 'BANKNIFTY 48000 CE 30 JAN 25',
      tradingSymbol: 'BANKNIFTY25JAN48000CE',
      instrumentType: 'OPTION',
      exchange: 'NFO',
      segment: 'FO',
      underlying: 'BANKNIFTY',
      strikePrice: 48000,
      optionType: 'CE',
      expiryDate: '2025-01-30',
      lotSize: 15,
      tickSize: 0.05,
      isActive: true,
      lastUpdated: '2024-01-15T10:00:00.000Z',
      source: 'upstox',
      createdAt: '2024-01-01T00:00:00.000Z'
    }
  ];

  const mockFutureSymbols: StandardizedSymbol[] = [
    {
      id: '507f1f77bcf86cd799439013',
      displayName: 'NIFTY FUT 30 JAN 25',
      tradingSymbol: 'NIFTY25JANFUT',
      instrumentType: 'FUTURE',
      exchange: 'NFO',
      segment: 'FO',
      underlying: 'NIFTY',
      expiryDate: '2025-01-30',
      lotSize: 50,
      tickSize: 0.05,
      isActive: true,
      lastUpdated: '2024-01-15T10:00:00.000Z',
      source: 'upstox',
      createdAt: '2024-01-01T00:00:00.000Z'
    },
    {
      id: '507f1f77bcf86cd799439023',
      displayName: 'TCS FUT 30 JAN 25',
      tradingSymbol: 'TCS25JANFUT',
      instrumentType: 'FUTURE',
      exchange: 'NFO',
      segment: 'FO',
      underlying: 'TCS',
      expiryDate: '2025-01-30',
      lotSize: 150,
      tickSize: 0.05,
      isActive: true,
      lastUpdated: '2024-01-15T10:00:00.000Z',
      source: 'upstox',
      createdAt: '2024-01-01T00:00:00.000Z'
    }
  ];

  beforeEach(() => {
    searchService = new SymbolSearchService(mockSymbolDatabaseService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('searchSymbols', () => {
    describe('Basic Search Functionality', () => {
      it('should perform basic text search', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: mockEquitySymbols.slice(0, 2),
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          query: 'TCS',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.symbols).toHaveLength(2);
        expect(result.total).toBe(2);
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
        const mockResult: SymbolSearchResult = {
          symbols: mockEquitySymbols,
          total: 3,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.symbols).toHaveLength(3);
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

      it('should apply default limit and offset', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: [],
          total: 0,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        await searchService.searchSymbols({});

        expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 50,
            offset: 0
          })
        );
      });

      it('should cap limit at 100 for performance', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: [],
          total: 0,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        await searchService.searchSymbols({ limit: 200 });

        expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 100
          })
        );
      });
    });

    describe('Filtering Options', () => {
      it('should filter by instrument type', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: mockOptionSymbols,
          total: 3,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          instrumentType: 'OPTION',
          limit: 10
        };

        await searchService.searchSymbols(options);

        expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            instrumentType: 'OPTION'
          })
        );
      });

      it('should filter by exchange', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: mockEquitySymbols,
          total: 3,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          exchange: 'NSE',
          limit: 10
        };

        await searchService.searchSymbols(options);

        expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            exchange: 'NSE'
          })
        );
      });

      it('should filter by underlying', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: mockOptionSymbols.filter(s => s.underlying === 'NIFTY'),
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          underlying: 'NIFTY',
          limit: 10
        };

        await searchService.searchSymbols(options);

        expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            underlying: 'NIFTY'
          })
        );
      });

      it('should filter by strike price range', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: mockOptionSymbols.filter(s => s.strikePrice! >= 21000 && s.strikePrice! <= 22000),
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          strikeMin: 21000,
          strikeMax: 22000,
          limit: 10
        };

        await searchService.searchSymbols(options);

        expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            strikeMin: 21000,
            strikeMax: 22000
          })
        );
      });

      it('should filter by expiry date range', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: mockOptionSymbols,
          total: 3,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          expiryStart: '2025-01-01',
          expiryEnd: '2025-01-31',
          limit: 10
        };

        await searchService.searchSymbols(options);

        expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            expiryStart: '2025-01-01',
            expiryEnd: '2025-01-31'
          })
        );
      });

      it('should filter by option type', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: mockOptionSymbols.filter(s => s.optionType === 'CE'),
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          optionType: 'CE',
          limit: 10
        };

        await searchService.searchSymbols(options);

        expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            optionType: 'CE'
          })
        );
      });

      it('should combine multiple filters', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: [mockOptionSymbols[0]],
          total: 1,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          query: 'NIFTY',
          instrumentType: 'OPTION',
          exchange: 'NFO',
          underlying: 'NIFTY',
          optionType: 'CE',
          strikeMin: 22000,
          strikeMax: 22000,
          limit: 10
        };

        await searchService.searchSymbols(options);

        expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
          query: 'NIFTY',
          instrumentType: 'OPTION',
          exchange: 'NFO',
          underlying: 'NIFTY',
          strikeMin: 22000,
          strikeMax: 22000,
          expiryStart: undefined,
          expiryEnd: undefined,
          optionType: 'CE',
          isActive: true,
          limit: 10,
          offset: 0
        });
      });
    });

    describe('Fuzzy Matching and Scoring', () => {
      it('should apply relevance scoring for text queries', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: [
            { ...mockEquitySymbols[0], tradingSymbol: 'TCS' }, // Exact match
            { ...mockEquitySymbols[1], tradingSymbol: 'TCSL' }, // Similar
            { ...mockEquitySymbols[2], tradingSymbol: 'RELIANCE' } // Contains
          ],
          total: 3,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          query: 'TCS',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        // Should have relevance scores
        expect(result.symbols[0]).toHaveProperty('relevanceScore');
        expect(result.symbols[0].relevanceScore).toBeGreaterThan(0);

        // Exact match should have highest score
        const exactMatch = result.symbols.find(s => s.tradingSymbol === 'TCS');
        const otherMatches = result.symbols.filter(s => s.tradingSymbol !== 'TCS');
        
        if (exactMatch && otherMatches.length > 0) {
          expect(exactMatch.relevanceScore).toBeGreaterThan(otherMatches[0].relevanceScore || 0);
        }
      });

      it('should boost active symbols in scoring', async () => {
        const activeSymbol = { ...mockEquitySymbols[0], isActive: true };
        const inactiveSymbol = { ...mockEquitySymbols[1], isActive: false };
        
        const mockResult: SymbolSearchResult = {
          symbols: [activeSymbol, inactiveSymbol],
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          query: 'test',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        const activeResult = result.symbols.find(s => s.isActive);
        const inactiveResult = result.symbols.find(s => !s.isActive);

        if (activeResult && inactiveResult) {
          expect(activeResult.relevanceScore).toBeGreaterThan(inactiveResult.relevanceScore || 0);
        }
      });

      it('should boost equity instruments in scoring', async () => {
        const equitySymbol = mockEquitySymbols[0];
        const optionSymbol = mockOptionSymbols[0];
        
        const mockResult: SymbolSearchResult = {
          symbols: [equitySymbol, optionSymbol],
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          query: 'test',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        const equityResult = result.symbols.find(s => s.instrumentType === 'EQUITY');
        const optionResult = result.symbols.find(s => s.instrumentType === 'OPTION');

        if (equityResult && optionResult) {
          expect(equityResult.relevanceScore).toBeGreaterThan(optionResult.relevanceScore || 0);
        }
      });

      it('should filter out irrelevant results', async () => {
        // Mock symbols with very different names that should get low scores
        const irrelevantSymbols = [
          { ...mockEquitySymbols[0], tradingSymbol: 'XYZVERYIRRELEVANT', displayName: 'Very Irrelevant Company' }
        ];
        
        const mockResult: SymbolSearchResult = {
          symbols: irrelevantSymbols,
          total: 1,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          query: 'TCS',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        // Should filter out symbols with relevance score of 0
        expect(result.symbols.every(s => (s.relevanceScore || 0) > 0)).toBe(true);
      });
    });

    describe('Sorting Options', () => {
      it('should sort by relevance by default', async () => {
        const symbols = [
          { ...mockEquitySymbols[0], tradingSymbol: 'TCSL' }, // Lower relevance
          { ...mockEquitySymbols[1], tradingSymbol: 'TCS' }   // Higher relevance
        ];
        
        const mockResult: SymbolSearchResult = {
          symbols,
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          query: 'TCS',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        // Should be sorted by relevance (highest first)
        expect(result.symbols[0].tradingSymbol).toBe('TCS');
        expect(result.symbols[1].tradingSymbol).toBe('TCSL');
      });

      it('should sort by name when specified', async () => {
        const symbols = [
          { ...mockEquitySymbols[0], displayName: 'Zebra Company' },
          { ...mockEquitySymbols[1], displayName: 'Alpha Company' }
        ];
        
        const mockResult: SymbolSearchResult = {
          symbols,
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          sortBy: 'name',
          sortOrder: 'asc',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.symbols[0].displayName).toBe('Alpha Company');
        expect(result.symbols[1].displayName).toBe('Zebra Company');
      });

      it('should sort by symbol when specified', async () => {
        const symbols = [
          { ...mockEquitySymbols[0], tradingSymbol: 'ZZZ' },
          { ...mockEquitySymbols[1], tradingSymbol: 'AAA' }
        ];
        
        const mockResult: SymbolSearchResult = {
          symbols,
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          sortBy: 'symbol',
          sortOrder: 'asc',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.symbols[0].tradingSymbol).toBe('AAA');
        expect(result.symbols[1].tradingSymbol).toBe('ZZZ');
      });

      it('should sort by expiry date when specified', async () => {
        const symbols = [
          { ...mockOptionSymbols[0], expiryDate: '2025-02-28' },
          { ...mockOptionSymbols[1], expiryDate: '2025-01-30' }
        ];
        
        const mockResult: SymbolSearchResult = {
          symbols,
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          sortBy: 'expiry',
          sortOrder: 'asc',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.symbols[0].expiryDate).toBe('2025-01-30');
        expect(result.symbols[1].expiryDate).toBe('2025-02-28');
      });

      it('should sort by strike price when specified', async () => {
        const symbols = [
          { ...mockOptionSymbols[0], strikePrice: 22000 },
          { ...mockOptionSymbols[1], strikePrice: 21000 }
        ];
        
        const mockResult: SymbolSearchResult = {
          symbols,
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          sortBy: 'strike',
          sortOrder: 'asc',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.symbols[0].strikePrice).toBe(21000);
        expect(result.symbols[1].strikePrice).toBe(22000);
      });

      it('should handle descending sort order', async () => {
        const symbols = [
          { ...mockEquitySymbols[0], displayName: 'Alpha Company' },
          { ...mockEquitySymbols[1], displayName: 'Zebra Company' }
        ];
        
        const mockResult: SymbolSearchResult = {
          symbols,
          total: 2,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          sortBy: 'name',
          sortOrder: 'desc',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.symbols[0].displayName).toBe('Zebra Company');
        expect(result.symbols[1].displayName).toBe('Alpha Company');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Database error'));

        const options: SearchOptions = {
          query: 'TCS',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.symbols).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.hasMore).toBe(false);
        expect(result.searchTime).toBeGreaterThan(0);
      });

      it('should handle null/undefined query gracefully', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: mockEquitySymbols,
          total: 3,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          query: undefined,
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.symbols).toHaveLength(3);
        expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
          expect.objectContaining({
            query: undefined
          })
        );
      });
    });

    describe('Performance Metrics', () => {
      it('should track search time', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: mockEquitySymbols,
          total: 3,
          hasMore: false
        };
        
        // Add delay to simulate database query time
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockImplementation(
          () => new Promise(resolve => setTimeout(() => resolve(mockResult), 10))
        );

        const options: SearchOptions = {
          query: 'TCS',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.searchTime).toBeGreaterThan(5); // Should be at least 5ms due to delay
      });

      it('should include search filters in result', async () => {
        const mockResult: SymbolSearchResult = {
          symbols: mockEquitySymbols,
          total: 3,
          hasMore: false
        };
        mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

        const options: SearchOptions = {
          query: 'TCS',
          limit: 10
        };

        const result = await searchService.searchSymbols(options);

        expect(result.filters).toBeDefined();
        expect(result.filters.instrumentTypes).toBeDefined();
        expect(result.filters.exchanges).toBeDefined();
      });
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
      const mockResult: SymbolSearchResult = {
        symbols: mockEquitySymbols,
        total: 3,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.quickSearch('TCS');

      expect(result).toHaveLength(3);
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        query: 'TCS',
        limit: 10,
        isActive: true
      });
    });

    it('should respect custom limit', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: mockEquitySymbols.slice(0, 5),
        total: 5,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.quickSearch('TCS', 5);

      expect(result).toHaveLength(5);
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        query: 'TCS',
        limit: 5,
        isActive: true
      });
    });

    it('should handle search errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Search failed'));

      const result = await searchService.quickSearch('TCS');

      expect(result).toEqual([]);
    });

    it('should apply fuzzy matching and sort by relevance', async () => {
      const symbols = [
        { ...mockEquitySymbols[0], tradingSymbol: 'TCSL' }, // Lower relevance
        { ...mockEquitySymbols[1], tradingSymbol: 'TCS' }   // Higher relevance
      ];
      
      const mockResult: SymbolSearchResult = {
        symbols,
        total: 2,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.quickSearch('TCS');

      // Should be sorted by relevance
      expect(result[0].tradingSymbol).toBe('TCS');
      expect(result[1].tradingSymbol).toBe('TCSL');
    });
  });

  describe('searchByUnderlying', () => {
    it('should search options by underlying', async () => {
      const niftyOptions = mockOptionSymbols.filter(s => s.underlying === 'NIFTY');
      const mockResult: SymbolSearchResult = {
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

    it('should search futures by underlying', async () => {
      const niftyFutures = mockFutureSymbols.filter(s => s.underlying === 'NIFTY');
      const mockResult: SymbolSearchResult = {
        symbols: niftyFutures,
        total: 1,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.searchByUnderlying('NIFTY', 'FUTURE');

      expect(result).toHaveLength(1);
      expect(result[0].underlying).toBe('NIFTY');
      expect(result[0].instrumentType).toBe('FUTURE');
    });

    it('should filter by expiry date when provided', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: mockOptionSymbols,
        total: 3,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      await searchService.searchByUnderlying('NIFTY', 'OPTION', '2025-01-30');

      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        underlying: 'NIFTY',
        instrumentType: 'OPTION',
        expiryStart: '2025-01-30',
        expiryEnd: '2025-01-30',
        isActive: true,
        limit: 1000
      });
    });

    it('should sort results by expiry and strike price', async () => {
      const unsortedOptions = [
        { ...mockOptionSymbols[0], expiryDate: '2025-02-28', strikePrice: 22000 },
        { ...mockOptionSymbols[1], expiryDate: '2025-01-30', strikePrice: 21500 },
        { ...mockOptionSymbols[2], expiryDate: '2025-01-30', strikePrice: 22000 }
      ];
      
      const mockResult: SymbolSearchResult = {
        symbols: unsortedOptions,
        total: 3,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.searchByUnderlying('NIFTY', 'OPTION');

      // Should be sorted by expiry date first, then strike price
      expect(result[0].expiryDate).toBe('2025-01-30');
      expect(result[0].strikePrice).toBe(21500);
      expect(result[1].expiryDate).toBe('2025-01-30');
      expect(result[1].strikePrice).toBe(22000);
      expect(result[2].expiryDate).toBe('2025-02-28');
    });

    it('should handle search errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Search failed'));

      const result = await searchService.searchByUnderlying('NIFTY', 'OPTION');

      expect(result).toEqual([]);
    });
  });

  describe('getOptionChain', () => {
    it('should return separated calls and puts', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: mockOptionSymbols,
        total: 3,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.getOptionChain('NIFTY');

      expect(result.calls).toHaveLength(2); // NIFTY and BANKNIFTY CE options
      expect(result.puts).toHaveLength(1);  // NIFTY PE option
      expect(result.calls.every(option => option.optionType === 'CE')).toBe(true);
      expect(result.puts.every(option => option.optionType === 'PE')).toBe(true);
    });

    it('should return expiry dates when no specific expiry provided', async () => {
      const allOptions = [
        { ...mockOptionSymbols[0], expiryDate: '2025-01-30' },
        { ...mockOptionSymbols[1], expiryDate: '2025-02-28' },
        { ...mockOptionSymbols[2], expiryDate: '2025-01-30' }
      ];
      
      const mockResult: SymbolSearchResult = {
        symbols: allOptions,
        total: 3,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.getOptionChain('NIFTY');

      expect(result.expiries).toEqual(['2025-01-30', '2025-02-28']);
    });

    it('should filter by specific expiry when provided', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: mockOptionSymbols.filter(s => s.expiryDate === '2025-01-30'),
        total: 2,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      await searchService.getOptionChain('NIFTY', '2025-01-30');

      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        underlying: 'NIFTY',
        instrumentType: 'OPTION',
        expiryStart: '2025-01-30',
        expiryEnd: '2025-01-30',
        isActive: true,
        limit: 1000
      });
    });

    it('should handle errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Search failed'));

      const result = await searchService.getOptionChain('NIFTY');

      expect(result).toEqual({ calls: [], puts: [], expiries: [] });
    });
  });

  describe('getFuturesChain', () => {
    it('should return futures and expiry dates', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: mockFutureSymbols,
        total: 2,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await searchService.getFuturesChain('NIFTY');

      expect(result.futures).toHaveLength(2);
      expect(result.futures.every(future => future.instrumentType === 'FUTURE')).toBe(true);
      expect(result.expiries).toContain('2025-01-30');
    });

    it('should handle errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Search failed'));

      const result = await searchService.getFuturesChain('NIFTY');

      expect(result).toEqual({ futures: [], expiries: [] });
    });
  });

  describe('Performance Tests', () => {
    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array(1000).fill(null).map((_, i) => ({
        ...mockEquitySymbols[0],
        id: `507f1f77bcf86cd79943${i.toString().padStart(4, '0')}`,
        tradingSymbol: `SYMBOL${i}`
      }));

      const mockResult: SymbolSearchResult = {
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

    it('should handle fuzzy matching efficiently', async () => {
      const symbols = Array(100).fill(null).map((_, i) => ({
        ...mockEquitySymbols[0],
        id: `507f1f77bcf86cd79943${i.toString().padStart(4, '0')}`,
        tradingSymbol: `SYMBOL${i}`,
        displayName: `Company ${i}`,
        companyName: `Company Name ${i}`
      }));

      const mockResult: SymbolSearchResult = {
        symbols,
        total: 100,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const startTime = Date.now();
      const result = await searchService.searchSymbols({ query: 'SYMBOL' });
      const endTime = Date.now();

      expect(result.symbols).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
    });
  });
});