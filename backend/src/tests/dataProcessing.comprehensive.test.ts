/**
 * Comprehensive Unit Tests for Data Processing
 * Tests data ingestion and processing with various scenarios
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { upstoxDataProcessor } from '../services/upstoxDataProcessor';
import { dataValidationService } from '../services/dataValidationService';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { StandardizedSymbol, CreateStandardizedSymbolData } from '../models/symbolModels';

// Mock dependencies
jest.mock('../services/upstoxDataProcessor', () => ({
  upstoxDataProcessor: {
    downloadAndProcessSymbols: jest.fn(),
    processSymbolData: jest.fn(),
    validateDataFormat: jest.fn()
  }
}));

jest.mock('../services/dataValidationService', () => ({
  dataValidationService: {
    validateSymbols: jest.fn(),
    validateSymbolData: jest.fn(),
    sanitizeSymbolData: jest.fn()
  }
}));

jest.mock('../services/symbolDatabaseService', () => ({
  symbolDatabaseService: {
    isReady: jest.fn(),
    upsertSymbols: jest.fn(),
    createProcessingLog: jest.fn(),
    updateProcessingLog: jest.fn(),
    clearAllSymbols: jest.fn()
  }
}));

const mockUpstoxDataProcessor = upstoxDataProcessor as jest.Mocked<typeof upstoxDataProcessor>;
const mockDataValidationService = dataValidationService as jest.Mocked<typeof dataValidationService>;
const mockSymbolDatabaseService = symbolDatabaseService as jest.Mocked<typeof symbolDatabaseService>;

describe('Data Processing', () => {
  // Mock data for testing
  const mockRawSymbolData = [
    {
      symbol: 'TCS',
      name: 'Tata Consultancy Services Ltd',
      exchange: 'NSE',
      segment: 'EQ',
      instrument_type: 'EQUITY',
      lot_size: 1,
      tick_size: 0.05,
      isin: 'INE467B01029'
    },
    {
      symbol: 'NIFTY25JAN22000CE',
      name: 'NIFTY 22000 CE 30 JAN 25',
      exchange: 'NFO',
      segment: 'FO',
      instrument_type: 'OPTION',
      underlying: 'NIFTY',
      strike_price: 22000,
      option_type: 'CE',
      expiry_date: '2025-01-30',
      lot_size: 50,
      tick_size: 0.05
    }
  ];

  const mockStandardizedSymbols: CreateStandardizedSymbolData[] = [
    {
      displayName: 'Tata Consultancy Services Ltd',
      tradingSymbol: 'TCS',
      instrumentType: 'EQUITY',
      exchange: 'NSE',
      segment: 'EQ',
      lotSize: 1,
      tickSize: 0.05,
      source: 'upstox',
      companyName: 'Tata Consultancy Services Ltd',
      sector: 'Information Technology',
      isin: 'INE467B01029'
    },
    {
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
      source: 'upstox'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockSymbolDatabaseService.isReady.mockReturnValue(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Upstox Data Processing', () => {
    it('should process Upstox data successfully', async () => {
      // Mock successful data processing
      mockUpstoxDataProcessor.downloadAndProcessSymbols.mockResolvedValue({
        success: true,
        totalSymbols: 2,
        processedSymbols: 2,
        validSymbols: 2,
        invalidSymbols: 0,
        symbols: mockStandardizedSymbols,
        errors: []
      });

      const result = await mockUpstoxDataProcessor.downloadAndProcessSymbols();

      expect(result.success).toBe(true);
      expect(result.totalSymbols).toBe(2);
      expect(result.validSymbols).toBe(2);
      expect(result.symbols).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle processing failures', async () => {
      mockUpstoxDataProcessor.downloadAndProcessSymbols.mockResolvedValue({
        success: false,
        totalSymbols: 0,
        processedSymbols: 0,
        validSymbols: 0,
        invalidSymbols: 0,
        symbols: [],
        errors: ['Failed to download data from Upstox'],
        error: 'Failed to download data from Upstox'
      });

      const result = await mockUpstoxDataProcessor.downloadAndProcessSymbols();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to download data from Upstox');
    });

    it('should handle partial validation failures', async () => {
      mockUpstoxDataProcessor.downloadAndProcessSymbols.mockResolvedValue({
        success: true,
        totalSymbols: 3,
        processedSymbols: 3,
        validSymbols: 2,
        invalidSymbols: 1,
        symbols: mockStandardizedSymbols,
        errors: ['Invalid symbol: missing trading symbol']
      });

      const result = await mockUpstoxDataProcessor.downloadAndProcessSymbols();

      expect(result.success).toBe(true);
      expect(result.validSymbols).toBe(2);
      expect(result.invalidSymbols).toBe(1);
      expect(result.errors).toContain('Invalid symbol: missing trading symbol');
    });
  });

  describe('Data Validation', () => {
    it('should validate all symbols successfully', async () => {
      mockDataValidationService.validateSymbols.mockResolvedValue({
        isValid: true,
        errors: [],
        validSymbols: mockStandardizedSymbols,
        invalidSymbols: []
      });

      const result = await mockDataValidationService.validateSymbols(mockStandardizedSymbols);

      expect(result.isValid).toBe(true);
      expect(result.validSymbols).toHaveLength(2);
      expect(result.invalidSymbols).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle validation failures', async () => {
      const invalidSymbol = { ...mockStandardizedSymbols[0], tradingSymbol: '' };
      
      mockDataValidationService.validateSymbols.mockResolvedValue({
        isValid: false,
        errors: ['Trading symbol is required'],
        validSymbols: [mockStandardizedSymbols[0]],
        invalidSymbols: [invalidSymbol]
      });

      const result = await mockDataValidationService.validateSymbols([mockStandardizedSymbols[0], invalidSymbol]);

      expect(result.isValid).toBe(false);
      expect(result.validSymbols).toHaveLength(1);
      expect(result.invalidSymbols).toHaveLength(1);
      expect(result.errors).toContain('Trading symbol is required');
    });

    it('should validate individual symbol data', async () => {
      const validSymbol = mockStandardizedSymbols[0];
      
      mockDataValidationService.validateSymbolData.mockResolvedValue({
        isValid: true,
        errors: []
      });

      const result = await mockDataValidationService.validateSymbolData(validSymbol);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Database Operations', () => {
    it('should upsert symbols successfully', async () => {
      mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
        totalProcessed: 2,
        validSymbols: 2,
        invalidSymbols: 0,
        newSymbols: 1,
        updatedSymbols: 1,
        errors: []
      });

      const result = await mockSymbolDatabaseService.upsertSymbols(mockStandardizedSymbols);

      expect(result.totalProcessed).toBe(2);
      expect(result.validSymbols).toBe(2);
      expect(result.newSymbols).toBe(1);
      expect(result.updatedSymbols).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      mockSymbolDatabaseService.upsertSymbols.mockRejectedValue(new Error('Database connection failed'));

      await expect(mockSymbolDatabaseService.upsertSymbols(mockStandardizedSymbols))
        .rejects.toThrow('Database connection failed');
    });

    it('should clear all symbols when requested', async () => {
      mockSymbolDatabaseService.clearAllSymbols.mockResolvedValue(1000);

      const result = await mockSymbolDatabaseService.clearAllSymbols();

      expect(result).toBe(1000);
      expect(mockSymbolDatabaseService.clearAllSymbols).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle service not ready', async () => {
      mockSymbolDatabaseService.isReady.mockReturnValue(false);

      expect(mockSymbolDatabaseService.isReady()).toBe(false);
    });

    it('should handle unexpected errors gracefully', async () => {
      mockUpstoxDataProcessor.downloadAndProcessSymbols.mockRejectedValue(new Error('Unexpected network error'));

      await expect(mockUpstoxDataProcessor.downloadAndProcessSymbols())
        .rejects.toThrow('Unexpected network error');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = Array(10000).fill(null).map((_, i) => ({
        ...mockStandardizedSymbols[0],
        tradingSymbol: `SYMBOL${i}`,
        displayName: `Company ${i}`
      }));

      mockUpstoxDataProcessor.downloadAndProcessSymbols.mockResolvedValue({
        success: true,
        totalSymbols: 10000,
        processedSymbols: 10000,
        validSymbols: 10000,
        invalidSymbols: 0,
        symbols: largeDataset,
        errors: []
      });

      const startTime = Date.now();
      const result = await mockUpstoxDataProcessor.downloadAndProcessSymbols();
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.totalSymbols).toBe(10000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete quickly since it's mocked
    });
  });

  describe('Data Transformation', () => {
    it('should transform raw data to standardized format', async () => {
      mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
        success: true,
        symbols: mockStandardizedSymbols,
        errors: []
      });

      const result = await mockUpstoxDataProcessor.processSymbolData(mockRawSymbolData);

      expect(result.success).toBe(true);
      expect(result.symbols).toEqual(mockStandardizedSymbols);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle transformation errors', async () => {
      mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
        success: false,
        symbols: [],
        errors: ['Invalid data format'],
        error: 'Transformation failed'
      });

      const result = await mockUpstoxDataProcessor.processSymbolData(mockRawSymbolData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transformation failed');
      expect(result.errors).toContain('Invalid data format');
    });
  });
});