/**
 * Comprehensive Unit Tests for Symbol Validation Functions
 * Tests all symbol validation functions with various scenarios
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SymbolValidationService } from '../services/symbolValidationService';
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
    it('should return error when service is not ready', async () => {
      mockSymbolDatabaseService.isReady.mockReturnValue(false);

      const result = await service.validateAndResolveSymbol('TCS');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Symbol database service not available');
    });

    it('should validate and resolve valid standardized symbol ID', async () => {
      const symbolId = '507f1f77bcf86cd799439011';
      mockSymbolDatabaseService.getSymbolById.mockResolvedValue(mockEquitySymbol);

      const result = await service.validateAndResolveSymbol(symbolId);

      expect(result.isValid).toBe(true);
      expect(result.symbol).toEqual(mockEquitySymbol);
      expect(result.isLegacyFormat).toBe(false);
      expect(mockSymbolDatabaseService.getSymbolById).toHaveBeenCalledWith(symbolId);
    });

    it('should validate and resolve trading symbol', async () => {
      mockSymbolDatabaseService.getSymbolByTradingSymbol.mockResolvedValue(mockEquitySymbol);

      const result = await service.validateAndResolveSymbol('TCS');

      expect(result.isValid).toBe(true);
      expect(result.symbol).toEqual(mockEquitySymbol);
      expect(result.isLegacyFormat).toBe(true);
      expect(mockSymbolDatabaseService.getSymbolByTradingSymbol).toHaveBeenCalledWith('TCS', undefined);
    });

    it('should handle database errors gracefully', async () => {
      mockSymbolDatabaseService.getSymbolById.mockRejectedValue(new Error('Database connection failed'));

      const result = await service.validateAndResolveSymbol('507f1f77bcf86cd799439011');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Symbol validation failed');
      expect(result.error).toContain('Database connection failed');
    });
  });

  describe('validateOrderParameters', () => {
    it('should validate correct order parameters', () => {
      const orderParams = {
        quantity: 50, // Multiple of lot size (50)
        price: 22000.05, // Multiple of tick size (0.05)
        orderType: 'LIMIT'
      };

      const result = service.validateOrderParameters(mockOptionSymbol, orderParams);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject quantity not in lot size multiples', () => {
      const orderParams = {
        quantity: 75, // Not multiple of lot size (50)
        orderType: 'MARKET'
      };

      const result = service.validateOrderParameters(mockOptionSymbol, orderParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Quantity must be in multiples of lot size 50');
    });

    it('should reject price not in tick size multiples', () => {
      const orderParams = {
        quantity: 50,
        price: 22000.03, // Not multiple of tick size (0.05)
        orderType: 'LIMIT'
      };

      const result = service.validateOrderParameters(mockOptionSymbol, orderParams);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price must be in multiples of tick size 0.05');
    });

    it('should not validate price for market orders', () => {
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
    it('should format equity symbol display info', () => {
      const result = service.getSymbolDisplayInfo(mockEquitySymbol);

      expect(result.displayName).toBe('Tata Consultancy Services Ltd');
      expect(result.description).toContain('EQUITY on NSE');
      expect(result.description).toContain('Tata Consultancy Services Ltd');
      expect(result.tags).toContain('EQUITY');
      expect(result.tags).toContain('NSE');
      expect(result.tags).toContain('Information Technology');
    });

    it('should format option symbol display info', () => {
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
});