/**
 * Comprehensive Unit Tests for Data Ingestion Service
 * Tests data ingestion and processing with various scenarios
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DataIngestionService } from '../services/dataIngestionService';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { upstoxDataProcessor } from '../services/upstoxDataProcessor';
import { dataValidationService } from '../services/dataValidationService';
import { StandardizedSymbol, CreateStandardizedSymbolData } from '../models/symbolModels';

// Mock dependencies
jest.mock('../services/symbolDatabaseService', () => ({
  symbolDatabaseService: {
    isReady: jest.fn(),
    upsertSymbols: jest.fn(),
    deactivateRemovedSymbols: jest.fn(),
    createProcessingLog: jest.fn(),
    updateProcessingLog: jest.fn(),
    clearAllSymbols: jest.fn()
  }
}));

jest.mock('../services/upstoxDataProcessor', () => ({
  upstoxDataProcessor: {
    downloadSymbolData: jest.fn(),
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

const mockSymbolDatabaseService = symbolDatabaseService as jest.Mocked<typeof symbolDatabaseService>;
const mockUpstoxDataProcessor = upstoxDataProcessor as jest.Mocked<typeof upstoxDataProcessor>;
const mockDataValidationService = dataValidationService as jest.Mocked<typeof dataValidationService>;

describe('DataIngestionService', () => {
  let dataIngestionService: DataIngestionService;

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
    },
    {
      symbol: 'NIFTY25JANFUT',
      name: 'NIFTY FUT 30 JAN 25',
      exchange: 'NFO',
      segment: 'FO',
      instrument_type: 'FUTURE',
      underlying: 'NIFTY',
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
      isActive: true,
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
      isActive: true,
      source: 'upstox'
    },
    {
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
      source: 'upstox'
    }
  ];

  const mockProcessingLog = {
    id: '507f1f77bcf86cd799439011',
    processType: 'DAILY_UPDATE' as const,
    source: 'upstox',
    status: 'STARTED' as const,
    totalProcessed: 0,
    validSymbols: 0,
    invalidSymbols: 0,
    newSymbols: 0,
    updatedSymbols: 0,
    startedAt: '2024-01-15T10:00:00.000Z'
  };

  beforeEach(() => {
    dataIngestionService = new DataIngestionService();
    jest.clearAllMocks();
    
    // Default mock implementations
    mockSymbolDatabaseService.isReady.mockReturnValue(true);
    mockSymbolDatabaseService.createProcessingLog.mockResolvedValue(mockProcessingLog);
    mockSymbolDatabaseService.updateProcessingLog.mockResolvedValue({
      ...mockProcessingLog,
      status: 'COMPLETED',
      completedAt: '2024-01-15T10:05:00.000Z'
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('processUpstoxData', () => {
    describe('Successful Processing', () => {
      it('should process Upstox data successfully', async () => {
        // Mock successful data processing
        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: mockRawSymbolData,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: mockStandardizedSymbols,
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: true,
          errors: [],
          validSymbols: mockStandardizedSymbols,
          invalidSymbols: []
        });

        mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
          totalProcessed: 3,
          validSymbols: 3,
          invalidSymbols: 0,
          newSymbols: 2,
          updatedSymbols: 1,
          errors: []
        });

        const result = await dataIngestionService.processUpstoxData();

        expect(result.success).toBe(true);
        expect(result.totalProcessed).toBe(3);
        expect(result.validSymbols).toBe(3);
        expect(result.newSymbols).toBe(2);
        expect(result.updatedSymbols).toBe(1);
        expect(result.errors).toHaveLength(0);

        // Verify all steps were called
        expect(mockUpstoxDataProcessor.downloadSymbolData).toHaveBeenCalled();
        expect(mockUpstoxDataProcessor.processSymbolData).toHaveBeenCalledWith(mockRawSymbolData);
        expect(mockDataValidationService.validateSymbols).toHaveBeenCalledWith(mockStandardizedSymbols);
        expect(mockSymbolDatabaseService.upsertSymbols).toHaveBeenCalledWith(mockStandardizedSymbols);
      });

      it('should create and update processing log', async () => {
        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: mockRawSymbolData,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: mockStandardizedSymbols,
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: true,
          errors: [],
          validSymbols: mockStandardizedSymbols,
          invalidSymbols: []
        });

        mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
          totalProcessed: 3,
          validSymbols: 3,
          invalidSymbols: 0,
          newSymbols: 2,
          updatedSymbols: 1,
          errors: []
        });

        await dataIngestionService.processUpstoxData();

        // Verify processing log creation
        expect(mockSymbolDatabaseService.createProcessingLog).toHaveBeenCalledWith({
          processType: 'DAILY_UPDATE',
          source: 'upstox',
          status: 'STARTED',
          totalProcessed: 0,
          validSymbols: 0,
          invalidSymbols: 0,
          newSymbols: 0,
          updatedSymbols: 0
        });

        // Verify processing log update
        expect(mockSymbolDatabaseService.updateProcessingLog).toHaveBeenCalledWith(
          mockProcessingLog.id,
          expect.objectContaining({
            status: 'COMPLETED',
            totalProcessed: 3,
            validSymbols: 3,
            invalidSymbols: 0,
            newSymbols: 2,
            updatedSymbols: 1
          })
        );
      });

      it('should handle partial validation failures', async () => {
        const invalidSymbol = { ...mockStandardizedSymbols[0], tradingSymbol: '' };
        const mixedSymbols = [...mockStandardizedSymbols.slice(0, 2), invalidSymbol];

        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: mockRawSymbolData,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: mixedSymbols,
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: false,
          errors: ['Invalid trading symbol'],
          validSymbols: mockStandardizedSymbols.slice(0, 2),
          invalidSymbols: [invalidSymbol]
        });

        mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
          totalProcessed: 2,
          validSymbols: 2,
          invalidSymbols: 1,
          newSymbols: 1,
          updatedSymbols: 1,
          errors: ['Invalid trading symbol']
        });

        const result = await dataIngestionService.processUpstoxData();

        expect(result.success).toBe(true); // Still successful even with some invalid symbols
        expect(result.totalProcessed).toBe(2);
        expect(result.validSymbols).toBe(2);
        expect(result.invalidSymbols).toBe(1);
        expect(result.errors).toContain('Invalid trading symbol');
      });
    });

    describe('Error Handling', () => {
      it('should handle database service not ready', async () => {
        mockSymbolDatabaseService.isReady.mockReturnValue(false);

        const result = await dataIngestionService.processUpstoxData();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Database service not ready');
        expect(result.totalProcessed).toBe(0);
      });

      it('should handle download failures', async () => {
        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: false,
          error: 'Failed to download data from Upstox',
          data: [],
          source: 'upstox'
        });

        const result = await dataIngestionService.processUpstoxData();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to download data from Upstox');
        expect(mockSymbolDatabaseService.updateProcessingLog).toHaveBeenCalledWith(
          mockProcessingLog.id,
          expect.objectContaining({
            status: 'FAILED',
            errorDetails: expect.objectContaining({
              error: 'Failed to download data from Upstox'
            })
          })
        );
      });

      it('should handle processing failures', async () => {
        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: mockRawSymbolData,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: false,
          error: 'Failed to process symbol data',
          symbols: [],
          errors: ['Processing error']
        });

        const result = await dataIngestionService.processUpstoxData();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to process symbol data');
      });

      it('should handle database upsert failures', async () => {
        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: mockRawSymbolData,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: mockStandardizedSymbols,
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: true,
          errors: [],
          validSymbols: mockStandardizedSymbols,
          invalidSymbols: []
        });

        mockSymbolDatabaseService.upsertSymbols.mockRejectedValue(new Error('Database connection failed'));

        const result = await dataIngestionService.processUpstoxData();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Database connection failed');
      });

      it('should handle processing log creation failures', async () => {
        mockSymbolDatabaseService.createProcessingLog.mockRejectedValue(new Error('Log creation failed'));

        const result = await dataIngestionService.processUpstoxData();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Log creation failed');
      });

      it('should handle unexpected errors gracefully', async () => {
        mockUpstoxDataProcessor.downloadSymbolData.mockRejectedValue(new Error('Unexpected network error'));

        const result = await dataIngestionService.processUpstoxData();

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unexpected network error');
      });
    });

    describe('Data Validation', () => {
      it('should validate all symbols before database insertion', async () => {
        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: mockRawSymbolData,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: mockStandardizedSymbols,
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: true,
          errors: [],
          validSymbols: mockStandardizedSymbols,
          invalidSymbols: []
        });

        mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
          totalProcessed: 3,
          validSymbols: 3,
          invalidSymbols: 0,
          newSymbols: 3,
          updatedSymbols: 0,
          errors: []
        });

        await dataIngestionService.processUpstoxData();

        expect(mockDataValidationService.validateSymbols).toHaveBeenCalledWith(mockStandardizedSymbols);
        expect(mockSymbolDatabaseService.upsertSymbols).toHaveBeenCalledWith(mockStandardizedSymbols);
      });

      it('should only insert valid symbols when validation fails', async () => {
        const validSymbols = mockStandardizedSymbols.slice(0, 2);
        const invalidSymbols = [{ ...mockStandardizedSymbols[2], tradingSymbol: '' }];

        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: mockRawSymbolData,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: [...validSymbols, ...invalidSymbols],
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: false,
          errors: ['Trading symbol is required'],
          validSymbols,
          invalidSymbols
        });

        mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
          totalProcessed: 2,
          validSymbols: 2,
          invalidSymbols: 1,
          newSymbols: 2,
          updatedSymbols: 0,
          errors: []
        });

        const result = await dataIngestionService.processUpstoxData();

        expect(result.success).toBe(true);
        expect(result.validSymbols).toBe(2);
        expect(result.invalidSymbols).toBe(1);
        expect(mockSymbolDatabaseService.upsertSymbols).toHaveBeenCalledWith(validSymbols);
      });

      it('should handle all symbols being invalid', async () => {
        const invalidSymbols = mockStandardizedSymbols.map(s => ({ ...s, tradingSymbol: '' }));

        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: mockRawSymbolData,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: invalidSymbols,
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: false,
          errors: ['All symbols invalid'],
          validSymbols: [],
          invalidSymbols
        });

        const result = await dataIngestionService.processUpstoxData();

        expect(result.success).toBe(false);
        expect(result.error).toContain('No valid symbols to process');
        expect(result.invalidSymbols).toBe(3);
        expect(mockSymbolDatabaseService.upsertSymbols).not.toHaveBeenCalled();
      });
    });

    describe('Performance and Scalability', () => {
      it('should handle large datasets efficiently', async () => {
        const largeDataset = Array(10000).fill(null).map((_, i) => ({
          ...mockRawSymbolData[0],
          symbol: `SYMBOL${i}`,
          name: `Company ${i}`
        }));

        const largeStandardizedDataset = Array(10000).fill(null).map((_, i) => ({
          ...mockStandardizedSymbols[0],
          tradingSymbol: `SYMBOL${i}`,
          displayName: `Company ${i}`
        }));

        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: largeDataset,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: largeStandardizedDataset,
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: true,
          errors: [],
          validSymbols: largeStandardizedDataset,
          invalidSymbols: []
        });

        mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
          totalProcessed: 10000,
          validSymbols: 10000,
          invalidSymbols: 0,
          newSymbols: 10000,
          updatedSymbols: 0,
          errors: []
        });

        const startTime = Date.now();
        const result = await dataIngestionService.processUpstoxData();
        const endTime = Date.now();

        expect(result.success).toBe(true);
        expect(result.totalProcessed).toBe(10000);
        expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      });

      it('should handle memory efficiently with large datasets', async () => {
        const memoryBefore = process.memoryUsage().heapUsed;

        const largeDataset = Array(1000).fill(null).map((_, i) => ({
          ...mockRawSymbolData[0],
          symbol: `SYMBOL${i}`
        }));

        const largeStandardizedDataset = Array(1000).fill(null).map((_, i) => ({
          ...mockStandardizedSymbols[0],
          tradingSymbol: `SYMBOL${i}`
        }));

        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: largeDataset,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: largeStandardizedDataset,
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: true,
          errors: [],
          validSymbols: largeStandardizedDataset,
          invalidSymbols: []
        });

        mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
          totalProcessed: 1000,
          validSymbols: 1000,
          invalidSymbols: 0,
          newSymbols: 1000,
          updatedSymbols: 0,
          errors: []
        });

        await dataIngestionService.processUpstoxData();

        const memoryAfter = process.memoryUsage().heapUsed;
        const memoryIncrease = memoryAfter - memoryBefore;

        // Memory increase should be reasonable (less than 100MB for 1000 symbols)
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
      });
    });

    describe('Retry Logic', () => {
      it('should retry on transient failures', async () => {
        let attemptCount = 0;
        mockUpstoxDataProcessor.downloadSymbolData.mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.resolve({
              success: false,
              error: 'Temporary network error',
              data: [],
              source: 'upstox'
            });
          }
          return Promise.resolve({
            success: true,
            data: mockRawSymbolData,
            source: 'upstox'
          });
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: mockStandardizedSymbols,
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: true,
          errors: [],
          validSymbols: mockStandardizedSymbols,
          invalidSymbols: []
        });

        mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
          totalProcessed: 3,
          validSymbols: 3,
          invalidSymbols: 0,
          newSymbols: 3,
          updatedSymbols: 0,
          errors: []
        });

        const result = await dataIngestionService.processUpstoxData({ maxRetries: 3 });

        expect(result.success).toBe(true);
        expect(attemptCount).toBe(3);
        expect(mockUpstoxDataProcessor.downloadSymbolData).toHaveBeenCalledTimes(3);
      });

      it('should fail after max retries exceeded', async () => {
        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: false,
          error: 'Persistent network error',
          data: [],
          source: 'upstox'
        });

        const result = await dataIngestionService.processUpstoxData({ maxRetries: 2 });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Persistent network error');
        expect(mockUpstoxDataProcessor.downloadSymbolData).toHaveBeenCalledTimes(3); // Initial + 2 retries
      });
    });

    describe('Fresh Data Initialization', () => {
      it('should clear existing data when freshStart is true', async () => {
        mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
          success: true,
          data: mockRawSymbolData,
          source: 'upstox'
        });

        mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
          success: true,
          symbols: mockStandardizedSymbols,
          errors: []
        });

        mockDataValidationService.validateSymbols.mockReturnValue({
          isValid: true,
          errors: [],
          validSymbols: mockStandardizedSymbols,
          invalidSymbols: []
        });

        mockSymbolDatabaseService.clearAllSymbols.mockResolvedValue(1000);
        mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
          totalProcessed: 3,
          validSymbols: 3,
          invalidSymbols: 0,
          newSymbols: 3,
          updatedSymbols: 0,
          errors: []
        });

        const result = await dataIngestionService.processUpstoxData({ freshStart: true });

        expect(result.success).toBe(true);
        expect(mockSymbolDatabaseService.clearAllSymbols).toHaveBeenCalled();
        expect(result.clearedSymbols).toBe(1000);
      });

      it('should handle clear operation failures', async () => {
        mockSymbolDatabaseService.clearAllSymbols.mockRejectedValue(new Error('Failed to clear symbols'));

        const result = await dataIngestionService.processUpstoxData({ freshStart: true });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to clear symbols');
      });
    });
  });

  describe('validateSymbolData', () => {
    it('should validate individual symbol data', () => {
      const validSymbol = mockStandardizedSymbols[0];
      
      mockDataValidationService.validateSymbolData.mockReturnValue({
        isValid: true,
        errors: []
      });

      const result = dataIngestionService.validateSymbolData(validSymbol);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(mockDataValidationService.validateSymbolData).toHaveBeenCalledWith(validSymbol);
    });

    it('should return validation errors for invalid symbol', () => {
      const invalidSymbol = { ...mockStandardizedSymbols[0], tradingSymbol: '' };
      
      mockDataValidationService.validateSymbolData.mockReturnValue({
        isValid: false,
        errors: ['Trading symbol is required']
      });

      const result = dataIngestionService.validateSymbolData(invalidSymbol);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Trading symbol is required');
    });
  });

  describe('transformToStandardFormat', () => {
    it('should transform raw data to standardized format', () => {
      mockUpstoxDataProcessor.processSymbolData.mockReturnValue({
        success: true,
        symbols: mockStandardizedSymbols,
        errors: []
      });

      const result = dataIngestionService.transformToStandardFormat(mockRawSymbolData);

      expect(result).toEqual(mockStandardizedSymbols);
      expect(mockUpstoxDataProcessor.processSymbolData).toHaveBeenCalledWith(mockRawSymbolData);
    });

    it('should handle transformation errors', () => {
      mockUpstoxDataProcessor.processSymbolData.mockReturnValue({
        success: false,
        error: 'Transformation failed',
        symbols: [],
        errors: ['Invalid data format']
      });

      expect(() => {
        dataIngestionService.transformToStandardFormat(mockRawSymbolData);
      }).toThrow('Transformation failed');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty data gracefully', async () => {
      mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
        success: true,
        data: [],
        source: 'upstox'
      });

      mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
        success: true,
        symbols: [],
        errors: []
      });

      const result = await dataIngestionService.processUpstoxData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('No symbols to process');
      expect(result.totalProcessed).toBe(0);
    });

    it('should handle malformed data gracefully', async () => {
      const malformedData = [
        { invalid: 'data' },
        null,
        undefined,
        'string_instead_of_object'
      ];

      mockUpstoxDataProcessor.downloadSymbolData.mockResolvedValue({
        success: true,
        data: malformedData as any,
        source: 'upstox'
      });

      mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
        success: false,
        error: 'Malformed data detected',
        symbols: [],
        errors: ['Invalid data structure']
      });

      const result = await dataIngestionService.processUpstoxData();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Malformed data detected');
    });

    it('should handle concurrent processing requests', async () => {
      mockUpstoxDataProcessor.downloadSymbolData.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          data: mockRawSymbolData,
          source: 'upstox'
        }), 100))
      );

      mockUpstoxDataProcessor.processSymbolData.mockResolvedValue({
        success: true,
        symbols: mockStandardizedSymbols,
        errors: []
      });

      mockDataValidationService.validateSymbols.mockReturnValue({
        isValid: true,
        errors: [],
        validSymbols: mockStandardizedSymbols,
        invalidSymbols: []
      });

      mockSymbolDatabaseService.upsertSymbols.mockResolvedValue({
        totalProcessed: 3,
        validSymbols: 3,
        invalidSymbols: 0,
        newSymbols: 3,
        updatedSymbols: 0,
        errors: []
      });

      // Start multiple concurrent processes
      const promises = [
        dataIngestionService.processUpstoxData(),
        dataIngestionService.processUpstoxData(),
        dataIngestionService.processUpstoxData()
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});