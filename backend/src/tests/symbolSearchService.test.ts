import { SymbolSearchService, SearchOptions } from '../services/symbolSearchService';
import { SymbolDatabaseService, SymbolSearchQuery, SymbolSearchResult } from '../services/symbolDatabaseService';
import { StandardizedSymbol } from '../models/symbolModels';

// Mock the SymbolDatabaseService
const mockSymbolDatabaseService = {
  searchSymbolsWithFilters: jest.fn(),
  getSymbolById: jest.fn(),
  getSymbolsByUnderlying: jest.fn(),
  isReady: jest.fn().mockReturnValue(true),
  initialize: jest.fn(),
  createSymbol: jest.fn(),
  upsertSymbols: jest.fn(),
  getSymbolByTradingSymbol: jest.fn(),
  deactivateRemovedSymbols: jest.fn(),
  getSymbolHistory: jest.fn(),
  createProcessingLog: jest.fn(),
  updateProcessingLog: jest.fn(),
  getRecentProcessingLogs: jest.fn(),
  validateSymbols: jest.fn(),
  searchSymbols: jest.fn(),
  getOptionChain: jest.fn(),
  getExpiryDates: jest.fn(),
  searchAllInstruments: jest.fn(),
  searchEquityInstruments: jest.fn(),
  searchOptionsInstruments: jest.fn(),
  searchFuturesInstruments: jest.fn(),
  getEquityInstruments: jest.fn(),
  getOptionsInstruments: jest.fn(),
  getFuturesInstruments: jest.fn(),
  getStats: jest.fn(),
  forceUpdate: jest.fn(),
  getStatistics: jest.fn()
} as any;

describe('SymbolSearchService', () => {
  let symbolSearchService: SymbolSearchService;

  // Sample test data
  const mockSymbol: StandardizedSymbol = {
    id: '1',
    displayName: 'RELIANCE',
    tradingSymbol: 'RELIANCE',
    instrumentType: 'EQUITY',
    exchange: 'NSE',
    segment: 'EQ',
    lotSize: 1,
    tickSize: 0.05,
    isActive: true,
    lastUpdated: '2025-01-28T00:00:00.000Z',
    source: 'upstox',
    companyName: 'Reliance Industries Limited',
    sector: 'Energy',
    createdAt: '2025-01-28T00:00:00.000Z'
  };

  const mockOptionSymbol: StandardizedSymbol = {
    id: '2',
    displayName: 'NIFTY 22000 CE 30 JAN 25',
    tradingSymbol: 'NIFTY25JAN22000CE',
    instrumentType: 'OPTION',
    exchange: 'NFO',
    segment: 'FO',
    underlying: 'NIFTY',
    strikePrice: 22000,
    optionType: 'CE',
    expiryDate: '2025-01-30',
    lotSize: 25,
    tickSize: 0.05,
    isActive: true,
    lastUpdated: '2025-01-28T00:00:00.000Z',
    source: 'upstox',
    createdAt: '2025-01-28T00:00:00.000Z'
  };

  beforeEach(() => {
    // Create service instance with mock
    symbolSearchService = new SymbolSearchService(mockSymbolDatabaseService);
    jest.clearAllMocks();
  });

  describe('searchSymbols', () => {
    it('should perform basic text search', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: [mockSymbol],
        total: 1,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const options: SearchOptions = {
        query: 'RELIANCE',
        limit: 10
      };

      const result = await symbolSearchService.searchSymbols(options);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]?.tradingSymbol).toBe('RELIANCE');
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        query: 'RELIANCE',
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

    it('should apply fuzzy matching and relevance scoring', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: [mockSymbol],
        total: 1,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const options: SearchOptions = {
        query: 'RELIANCE',
        limit: 10
      };

      const result = await symbolSearchService.searchSymbols(options);

      expect(result.symbols).toHaveLength(1);
      // Check that relevance scores are applied
      expect(result.symbols[0]?.relevanceScore).toBeDefined();
      expect(result.symbols[0]?.relevanceScore).toBeGreaterThan(0);
    });

    it('should filter by instrument type', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: [mockOptionSymbol],
        total: 1,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const options: SearchOptions = {
        instrumentType: 'OPTION',
        limit: 10
      };

      const result = await symbolSearchService.searchSymbols(options);

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]?.instrumentType).toBe('OPTION');
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith(
        expect.objectContaining({
          instrumentType: 'OPTION'
        })
      );
    });

    it('should handle search errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Database error'));

      const options: SearchOptions = {
        query: 'RELIANCE'
      };

      const result = await symbolSearchService.searchSymbols(options);

      expect(result.symbols).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
      expect(result.searchTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('quickSearch', () => {
    it('should return empty array for short queries', async () => {
      const result = await symbolSearchService.quickSearch('R');
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty queries', async () => {
      const result = await symbolSearchService.quickSearch('');
      expect(result).toHaveLength(0);
    });

    it('should perform quick search with relevance scoring', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: [mockSymbol],
        total: 1,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await symbolSearchService.quickSearch('REL', 5);

      expect(result.length).toBeLessThanOrEqual(5);
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        query: 'REL',
        limit: 5,
        isActive: true
      });
    });
  });

  describe('searchByUnderlying', () => {
    it('should search options by underlying', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: [mockOptionSymbol],
        total: 1,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await symbolSearchService.searchByUnderlying('NIFTY', 'OPTION');

      expect(result).toHaveLength(1);
      expect(result[0]?.underlying).toBe('NIFTY');
      expect(result[0]?.instrumentType).toBe('OPTION');
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        underlying: 'NIFTY',
        instrumentType: 'OPTION',
        expiryStart: undefined,
        expiryEnd: undefined,
        isActive: true,
        limit: 1000
      });
    });
  });

  describe('getOptionChain', () => {
    it('should return separated calls and puts', async () => {
      const mockPutSymbol: StandardizedSymbol = {
        ...mockOptionSymbol,
        id: '3',
        optionType: 'PE',
        displayName: 'NIFTY 22000 PE 30 JAN 25',
        tradingSymbol: 'NIFTY25JAN22000PE'
      };

      const mockResult: SymbolSearchResult = {
        symbols: [mockOptionSymbol, mockPutSymbol],
        total: 2,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await symbolSearchService.getOptionChain('NIFTY', '2025-01-30');

      expect(result.calls).toHaveLength(1);
      expect(result.puts).toHaveLength(1);
      expect(result.calls[0]?.optionType).toBe('CE');
      expect(result.puts[0]?.optionType).toBe('PE');
    });
  });

  describe('getSearchSuggestions', () => {
    it('should return empty array for short queries', async () => {
      const result = await symbolSearchService.getSearchSuggestions('R');
      expect(result).toHaveLength(0);
    });

    it('should return unique suggestions', async () => {
      const mockResult: SymbolSearchResult = {
        symbols: [mockSymbol],
        total: 1,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await symbolSearchService.getSearchSuggestions('REL', 5);

      expect(result).toContain('RELIANCE');
      expect(result).toContain('Reliance Industries Limited');
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Fuzzy matching and scoring', () => {
    it('should give higher scores to exact matches', async () => {
      const partialMatch: StandardizedSymbol = {
        ...mockSymbol,
        id: '2',
        tradingSymbol: 'RELIANCE-BE',
        displayName: 'RELIANCE-BE'
      };

      const mockResult: SymbolSearchResult = {
        symbols: [mockSymbol, partialMatch],
        total: 2,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await symbolSearchService.searchSymbols({ query: 'RELIANCE' });

      expect(result.symbols).toHaveLength(2);
      const exactMatch = result.symbols.find(s => s.tradingSymbol === 'RELIANCE');
      const partialMatchResult = result.symbols.find(s => s.tradingSymbol === 'RELIANCE-BE');
      
      expect(exactMatch?.relevanceScore).toBeGreaterThan(partialMatchResult?.relevanceScore || 0);
    });

    it('should boost active symbols', async () => {
      const inactiveSymbol: StandardizedSymbol = {
        ...mockSymbol,
        id: '2',
        isActive: false
      };

      const mockResult: SymbolSearchResult = {
        symbols: [inactiveSymbol, mockSymbol],
        total: 2,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await symbolSearchService.searchSymbols({ query: 'RELIANCE' });

      expect(result.symbols).toHaveLength(2);
      const activeSymbol = result.symbols.find(s => s.isActive);
      const inactiveSymbolResult = result.symbols.find(s => !s.isActive);
      
      expect(activeSymbol?.relevanceScore).toBeGreaterThan(inactiveSymbolResult?.relevanceScore || 0);
    });
  });

  describe('Sorting', () => {
    it('should sort by relevance by default', async () => {
      const lowerRelevanceSymbol: StandardizedSymbol = {
        ...mockSymbol,
        id: '2',
        tradingSymbol: 'RELIANCE-BE'
      };

      const mockResult: SymbolSearchResult = {
        symbols: [lowerRelevanceSymbol, mockSymbol],
        total: 2,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await symbolSearchService.searchSymbols({ 
        query: 'RELIANCE',
        sortBy: 'relevance',
        sortOrder: 'desc'
      });

      expect(result.symbols).toHaveLength(2);
      // First symbol should have higher relevance score (exact match vs partial match)
      const exactMatch = result.symbols.find(s => s.tradingSymbol === 'RELIANCE');
      const partialMatch = result.symbols.find(s => s.tradingSymbol === 'RELIANCE-BE');
      expect(exactMatch?.relevanceScore).toBeGreaterThan(partialMatch?.relevanceScore || 0);
    });

    it('should sort by name', async () => {
      const zebraSymbol: StandardizedSymbol = {
        ...mockSymbol,
        id: '2',
        displayName: 'ZEBRA'
      };

      const appleSymbol: StandardizedSymbol = {
        ...mockSymbol,
        id: '3',
        displayName: 'APPLE'
      };

      const mockResult: SymbolSearchResult = {
        symbols: [zebraSymbol, appleSymbol],
        total: 2,
        hasMore: false
      };

      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockResult);

      const result = await symbolSearchService.searchSymbols({ 
        sortBy: 'name',
        sortOrder: 'asc'
      });

      expect(result.symbols).toHaveLength(2);
      expect(result.symbols[0]?.displayName).toBe('APPLE');
      expect(result.symbols[1]?.displayName).toBe('ZEBRA');
    });
  });
});