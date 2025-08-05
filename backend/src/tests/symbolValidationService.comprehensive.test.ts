/**
 * Comprehensive Unit Tests for Symbol Validation Service
 * Tests all symbol validation functions with various scenarios
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SymbolValidationService, symbolValidationService } from '../services/symbolValidationService';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { StandardizedSymbol } from '../models/symbolModels';

// Mock the symbol database service
jest.mock('../services/symbolDatabaseService', () => ({
  symbolDatabaseService: {
    isReady: jest.fn(),
    getSymbolById: jest.fn(),
    getSymbolByTradingSymbol: jest.fn(),
    getSymbolsByUnderlying: jest.fn(),
    searchSymbolsWithFilters: jest.fn()
  }
}));

const mockSymbolDatabaseService = symbolDatabaseService as jest.Mocked<typeof symbolDatabaseService>;

describe('SymbolValidationService', () => {
  let service: SymbolValidationService;

  // Mock symbols for testing
  const mockEquitySymbol: StandardizedSymbol = {
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
  };

  const mockOptionSymbol: StandardizedSymbol = {
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
  };

  const mockFutureSymbol: StandardizedSymbol = {
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
  };

  const mockInactiveSymbol: StandardizedSymbol = {
    ...mockEquitySymbol,
    id: '507f1f77bcf86cd799439014',
    isActive: false
  };

  beforeEach(() => {
    service = new SymbolValidationService();
    jest.clearAllMocks();
    
    // Default mock implementations
    mockSymbolDatabaseService.isReady.mockReturnValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('validateAndResolveSymbol', () => {
    describe('Service Availability', () => {
      it('should return error when service is not ready', async () => {
        mockSymbolDatabaseService.isReady.mockReturnValue(false);

        const result = await service.validateAndResolveSymbol('TCS');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Symbol database service not available');
      });

      it('should return error when service is null', async () => {
        // Mock service as null
        jest.doMock('../services/symbolDatabaseService', () => ({
          symbolDatabaseService: null
        }));

        const result = await service.validateAndResolveSymbol('TCS');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Symbol database service not available');
      });
    });

    describe('Standardized Symbol ID Validation', () => {
      it('should validate and resolve valid standardized symbol ID', async () => {
        const symbolId = '507f1f77bcf86cd799439011';
        mockSymbolDatabaseService.getSymbolById.mockResolvedValue(mockEquitySymbol);

        const result = await service.validateAndResolveSymbol(symbolId);

        expect(result.isValid).toBe(true);
        expect(result.symbol).toEqual(mockEquitySymbol);
        expect(result.isLegacyFormat).toBe(false);
        expect(mockSymbolDatabaseService.getSymbolById).toHaveBeenCalledWith(symbolId);
      });

      it('should return error for valid format but non-existent symbol ID', async () => {
        const symbolId = '507f1f77bcf86cd799439999';
        mockSymbolDatabaseService.getSymbolById.mockResolvedValue(null);

        const result = await service.validateAndResolveSymbol(symbolId);

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Standardized symbol with ID');
        expect(result.error).toContain('not found');
      });

      it('should return error for inactive standardized symbol', async () => {
        const symbolId = '507f1f77bcf86cd799439014';
        mockSymbolDatabaseService.getSymbolById.mockResolvedValue(mockInactiveSymbol);

        const result = await service.validateAndResolveSymbol(symbolId);

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not active for trading');
      });

      it('should recognize valid MongoDB ObjectId format', async () => {
        const validIds = [
          '507f1f77bcf86cd799439011',
          '123456789012345678901234',
          'abcdef123456789012345678',
          'ABCDEF123456789012345678'
        ];

        for (const id of validIds) {
          mockSymbolDatabaseService.getSymbolById.mockResolvedValue(mockEquitySymbol);
          await service.validateAndResolveSymbol(id);
          expect(mockSymbolDatabaseService.getSymbolById).toHaveBeenCalledWith(id);
        }
      });

      it('should not treat invalid formats as standardized IDs', async () => {
        const invalidIds = [
          'TCS', // Too short
          '507f1f77bcf86cd79943901', // Too short (23 chars)
          '507f1f77bcf86cd7994390111', // Too long (25 chars)
          '507f1f77bcf86cd79943901g', // Invalid character
          '507f-1f77-bcf8-6cd7-99439011' // Contains hyphens
        ];

        for (const id of invalidIds) {
          mockSymbolDatabaseService.getSymbolByTradingSymbol.mockResolvedValue(mockEquitySymbol);
          await service.validateAndResolveSymbol(id);
          expect(mockSymbolDatabaseService.getSymbolById).not.toHaveBeenCalledWith(id);
          expect(mockSymbolDatabaseService.getSymbolByTradingSymbol).toHaveBeenCalledWith(id, undefined);
        }
      });
    });

    describe('Trading Symbol Validation', () => {
      it('should validate and resolve trading symbol without exchange', async () => {
        mockSymbolDatabaseService.getSymbolByTradingSymbol.mockResolvedValue(mockEquitySymbol);

        const result = await service.validateAndResolveSymbol('TCS');

        expect(result.isValid).toBe(true);
        expect(result.symbol).toEqual(mockEquitySymbol);
        expect(result.isLegacyFormat).toBe(true);
        expect(mockSymbolDatabaseService.getSymbolByTradingSymbol).toHaveBeenCalledWith('TCS', undefined);
      });

      it('should validate and resolve trading symbol with exchange', async () => {
        mockSymbolDatabaseService.getSymbolByTradingSymbol.mockResolvedValue(mockEquitySymbol);

        const result = await service.validateAndResolveSymbol('TCS', 'NSE');

        expect(result.isValid).toBe(true);
        expect(result.symbol).toEqual(mockEquitySymbol);
        expect(result.isLegacyFormat).toBe(true);
        expect(mockSymbolDatabaseService.getSymbolByTradingSymbol).toHaveBeenCalledWith('TCS', 'NSE');
      });

      it('should return error for inactive trading symbol', async () => {
        mockSymbolDatabaseService.getSymbolByTradingSymbol.mockResolvedValue(mockInactiveSymbol);

        const result = await service.validateAndResolveSymbol('TCS');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not active for trading');
      });

      it('should allow legacy format for unknown trading symbol', async () => {
        mockSymbolDatabaseService.getSymbolByTradingSymbol.mockResolvedValue(null);

        const result = await service.validateAndResolveSymbol('UNKNOWN');

        expect(result.isValid).toBe(true);
        // Legacy format property removed
        expect(result.error).toContain('not found in standardized database');
        expect(result.error).toContain('Using legacy format');
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        mockSymbolDatabaseService.getSymbolById.mockRejectedValue(new Error('Database connection failed'));

        const result = await service.validateAndResolveSymbol('507f1f77bcf86cd799439011');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Symbol validation failed');
        expect(result.error).toContain('Database connection failed');
      });

      it('should handle trading symbol lookup errors gracefully', async () => {
        mockSymbolDatabaseService.getSymbolByTradingSymbol.mockRejectedValue(new Error('Query timeout'));

        const result = await service.validateAndResolveSymbol('TCS');

        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Symbol validation failed');
        expect(result.error).toContain('Query timeout');
      });
    });
  });

  describe('validateSymbolForBroker', () => {
    it('should validate symbol for supported broker exchange', async () => {
      mockSymbolDatabaseService.getSymbolById.mockResolvedValue(mockEquitySymbol);

      const result = await service.validateSymbolForBroker('507f1f77bcf86cd799439011', 'fyers');

      expect(result.isValid).toBe(true);
      expect(result.symbol).toEqual(mockEquitySymbol);
    });

    it('should reject symbol for unsupported broker exchange', async () => {
      const mcxSymbol = { ...mockEquitySymbol, exchange: 'MCX' };
      mockSymbolDatabaseService.getSymbolById.mockResolvedValue(mcxSymbol);

      const result = await service.validateSymbolForBroker('507f1f77bcf86cd799439011', 'unsupported_broker');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('does not support exchange MCX');
    });

    it('should handle base validation failure', async () => {
      mockSymbolDatabaseService.getSymbolById.mockResolvedValue(null);

      const result = await service.validateSymbolForBroker('507f1f77bcf86cd799439999', 'fyers');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should validate different broker exchange support', async () => {
      const testCases = [
        { broker: 'fyers', exchange: 'NSE', shouldPass: true },
        { broker: 'fyers', exchange: 'BSE', shouldPass: true },
        { broker: 'fyers', exchange: 'NFO', shouldPass: true },
        { broker: 'fyers', exchange: 'MCX', shouldPass: true },
        { broker: 'shoonya', exchange: 'NSE', shouldPass: true },
        { broker: 'unknown', exchange: 'NSE', shouldPass: true }, // Falls back to default
        { broker: 'unknown', exchange: 'UNKNOWN_EXCHANGE', shouldPass: false }
      ];

      for (const testCase of testCases) {
        const symbol = { ...mockEquitySymbol, exchange: testCase.exchange };
        mockSymbolDatabaseService.getSymbolById.mockResolvedValue(symbol);

        const result = await service.validateSymbolForBroker('507f1f77bcf86cd799439011', testCase.broker);

        if (testCase.shouldPass) {
          expect(result.isValid).toBe(true);
        } else {
          expect(result.isValid).toBe(false);
          expect(result.error).toContain('does not support exchange');
        }
      }
    });
  });

  describe('getOrderSymbolInfo', () => {
    it('should return comprehensive symbol info for valid symbol', async () => {
      mockSymbolDatabaseService.getSymbolById.mockResolvedValue(mockEquitySymbol);

      const result = await service.getOrderSymbolInfo('507f1f77bcf86cd799439011');

      expect(result).not.toBeNull();
      expect(result!.standardizedSymbol).toEqual(mockEquitySymbol);
      expect(result!.originalInput).toBe('507f1f77bcf86cd799439011');
      expect(result!.isStandardizedId).toBe(true);
      expect(result!.validationWarnings).toHaveLength(0);
    });

    it('should include legacy format warning for trading symbol', async () => {
      mockSymbolDatabaseService.getSymbolByTradingSymbol.mockResolvedValue(mockEquitySymbol);

      const result = await service.getOrderSymbolInfo('TCS');

      expect(result).not.toBeNull();
      expect(result!.isStandardizedId).toBe(false);
      expect(result!.validationWarnings).toContain('Using legacy symbol format. Consider using standardized symbol ID for better performance.');
    });

    it('should include expiry warning for near-expiry options', async () => {
      // Create option expiring in 3 days
      const nearExpiryDate = new Date();
      nearExpiryDate.setDate(nearExpiryDate.getDate() + 3);
      const nearExpiryOption = {
        ...mockOptionSymbol,
        expiryDate: nearExpiryDate.toISOString().split('T')[0]
      };

      mockSymbolDatabaseService.getSymbolById.mockResolvedValue(nearExpiryOption);

      const result = await service.getOrderSymbolInfo('507f1f77bcf86cd799439012');

      expect(result).not.toBeNull();
      expect(result!.validationWarnings.some(warning => warning.includes('expires in'))).toBe(true);
    });

    it('should return null for invalid symbol', async () => {
      mockSymbolDatabaseService.getSymbolById.mockResolvedValue(null);

      const result = await service.getOrderSymbolInfo('507f1f77bcf86cd799439999');

      expect(result).toBeNull();
    });
  });

  describe('validateSymbols', () => {
    it('should validate multiple symbols successfully', async () => {
      const symbolInputs = [
        { symbol: '507f1f77bcf86cd799439011' },
        { symbol: 'TCS', exchange: 'NSE' },
        { symbol: '507f1f77bcf86cd799439012' }
      ];

      mockSymbolDatabaseService.getSymbolById
        .mockResolvedValueOnce(mockEquitySymbol)
        .mockResolvedValueOnce(mockOptionSymbol);
      mockSymbolDatabaseService.getSymbolByTradingSymbol.mockResolvedValue(mockEquitySymbol);

      const results = await service.validateSymbols(symbolInputs);

      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(true);
    });

    it('should handle mixed valid and invalid symbols', async () => {
      const symbolInputs = [
        { symbol: '507f1f77bcf86cd799439011' },
        { symbol: '507f1f77bcf86cd799439999' }
      ];

      mockSymbolDatabaseService.getSymbolById
        .mockResolvedValueOnce(mockEquitySymbol)
        .mockResolvedValueOnce(null);

      const results = await service.validateSymbols(symbolInputs);

      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
    });
  });

  describe('searchSymbolsForInput', () => {
    it('should return empty array when service not ready', async () => {
      mockSymbolDatabaseService.isReady.mockReturnValue(false);

      const result = await service.searchSymbolsForInput('TCS');

      expect(result).toEqual([]);
    });

    it('should search symbols with filters', async () => {
      const mockSearchResult = {
        symbols: [mockEquitySymbol],
        total: 1,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockSearchResult);

      const result = await service.searchSymbolsForInput('TCS', 'NSE', 'EQUITY', 5);

      expect(result).toEqual([mockEquitySymbol]);
      expect(mockSymbolDatabaseService.searchSymbolsWithFilters).toHaveBeenCalledWith({
        query: 'TCS',
        exchange: 'NSE',
        instrumentType: 'EQUITY',
        isActive: true,
        limit: 5
      });
    });

    it('should handle search errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Search failed'));

      const result = await service.searchSymbolsForInput('TCS');

      expect(result).toEqual([]);
    });
  });

  describe('validateOrderParameters', () => {
    it('should validate correct order parameters', async () => {
      const orderParams = {
        quantity: 50, // Multiple of lot size (50)
        price: 22000.05, // Multiple of tick size (0.05)
        orderType: 'LIMIT'
      };

      const result = service.validateOrderParameters(mockOptionSymbol, orderParams);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject quantity not in lot size multiples', async () => {
      const orderParams = {
        quantity: 75, // Not multiple of lot size (50)
        orderType: 'MARKET'
      };

      const result = service.validateOrderParameters(mockOptionSymbol, orderParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Quantity must be in multiples of lot size 50');
    });

    it('should reject price not in tick size multiples', async () => {
      const orderParams = {
        quantity: 50,
        price: 22000.03, // Not multiple of tick size (0.05)
        orderType: 'LIMIT'
      };

      const result = service.validateOrderParameters(mockOptionSymbol, orderParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price must be in multiples of tick size 0.05');
    });

    it('should handle floating point precision correctly', async () => {
      const orderParams = {
        quantity: 50,
        price: 22000.10, // Should be valid (multiple of 0.05)
        orderType: 'LIMIT'
      };

      const result = service.validateOrderParameters(mockOptionSymbol, orderParams);

      expect(result.isValid).toBe(true);
    });

    it('should reject expired symbols', async () => {
      const expiredSymbol = {
        ...mockOptionSymbol,
        expiryDate: '2023-01-30' // Past date
      };

      const orderParams = {
        quantity: 50,
        orderType: 'MARKET'
      };

      const result = service.validateOrderParameters(expiredSymbol, orderParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Symbol has expired on 2023-01-30');
    });

    it('should not validate price for market orders', async () => {
      const orderParams = {
        quantity: 50,
        price: 22000.03, // Invalid tick size, but should be ignored for market orders
        orderType: 'MARKET'
      };

      const result = service.validateOrderParameters(mockOptionSymbol, orderParams);

      expect(result.isValid).toBe(true);
    });
  });

  describe('getSymbolDisplayInfo', () => {
    it('should format equity symbol display info', async () => {
      const result = service.getSymbolDisplayInfo(mockEquitySymbol);

      expect(result.displayName).toBe('Tata Consultancy Services Ltd');
      expect(result.description).toContain('EQUITY on NSE');
      expect(result.description).toContain('Tata Consultancy Services Ltd');
      expect(result.tags).toContain('EQUITY');
      expect(result.tags).toContain('NSE');
      expect(result.tags).toContain('Information Technology');
    });

    it('should format option symbol display info', async () => {
      const result = service.getSymbolDisplayInfo(mockOptionSymbol);

      expect(result.displayName).toBe('NIFTY 22000 CE 30 JAN 25');
      expect(result.description).toContain('OPTION on NFO');
      expect(result.description).toContain('Strike: 22000');
      expect(result.description).toContain('Type: CE');
      expect(result.description).toContain('Expiry: 2025-01-30');
      expect(result.tags).toContain('OPTION');
      expect(result.tags).toContain('NFO');
      expect(result.tags).toContain('Underlying: NIFTY');
    });

    it('should format future symbol display info', async () => {
      const result = service.getSymbolDisplayInfo(mockFutureSymbol);

      expect(result.displayName).toBe('NIFTY FUT 30 JAN 25');
      expect(result.description).toContain('FUTURE on NFO');
      expect(result.description).toContain('Expiry: 2025-01-30');
      expect(result.tags).toContain('FUTURE');
      expect(result.tags).toContain('NFO');
      expect(result.tags).toContain('Underlying: NIFTY');
    });
  });

  describe('getSymbolSuggestions', () => {
    it('should provide direct match suggestions', async () => {
      const mockSearchResult = {
        symbols: [mockEquitySymbol],
        total: 1,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockSearchResult);

      const result = await service.getSymbolSuggestions('TCS');

      expect(result).toHaveLength(1);
      expect(result[0].symbol).toEqual(mockEquitySymbol);
      expect(result[0].reason).toBe('Direct match');
    });

    it('should provide derivative suggestions with underlying context', async () => {
      const mockSearchResult = {
        symbols: [mockEquitySymbol],
        total: 1,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockSearchResult);
      mockSymbolDatabaseService.getSymbolsByUnderlying.mockResolvedValue([mockOptionSymbol]);

      const result = await service.getSymbolSuggestions('22000', {
        underlying: 'NIFTY',
        instrumentType: 'OPTION'
      });

      expect(result.length).toBeGreaterThan(0);
      expect(result.some(suggestion => suggestion.reason.includes('OPTION on NIFTY'))).toBe(true);
    });

    it('should handle suggestion errors gracefully', async () => {
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockRejectedValue(new Error('Search failed'));

      const result = await service.getSymbolSuggestions('TCS');

      expect(result).toEqual([]);
    });

    it('should limit total suggestions to 10', async () => {
      const manySymbols = Array(15).fill(null).map((_, i) => ({
        ...mockEquitySymbol,
        id: `507f1f77bcf86cd79943901${i}`,
        tradingSymbol: `TCS${i}`
      }));

      const mockSearchResult = {
        symbols: manySymbols,
        total: 15,
        hasMore: false
      };
      mockSymbolDatabaseService.searchSymbolsWithFilters.mockResolvedValue(mockSearchResult);

      const result = await service.getSymbolSuggestions('TCS');

      expect(result.length).toBeLessThanOrEqual(10);
    });
  });
});