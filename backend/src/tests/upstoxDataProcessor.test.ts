import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { UpstoxDataProcessor, RawUpstoxSymbolData } from '../services/upstoxDataProcessor';
import { CreateStandardizedSymbolData } from '../models/symbolModels';

// Mock dependencies
jest.mock('axios');
jest.mock('node-cron');
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../services/symbolDatabaseService', () => ({
  symbolDatabaseService: {
    initialize: jest.fn(),
    isReady: jest.fn(() => true),
    createProcessingLog: jest.fn(() => Promise.resolve({ id: 'test-log-id' })),
    updateProcessingLog: jest.fn(() => Promise.resolve()),
    upsertSymbols: jest.fn(() => Promise.resolve({
      totalProcessed: 3,
      validSymbols: 3,
      invalidSymbols: 0,
      newSymbols: 2,
      updatedSymbols: 1,
      errors: []
    }))
  }
}));

describe('UpstoxDataProcessor', () => {
  let processor: UpstoxDataProcessor;
  let testDataDir: string;
  let testCsvPath: string;

  beforeAll(() => {
    // Create test data directory
    testDataDir = path.join(__dirname, 'test-data');
    testCsvPath = path.join(testDataDir, 'test_upstox_symbols.csv');
    
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Create a new processor instance for each test
    processor = new UpstoxDataProcessor();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testCsvPath)) {
      fs.unlinkSync(testCsvPath);
    }
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('CSV Parsing', () => {
    it('should parse valid Upstox CSV data correctly', async () => {
      // Create test CSV data
      const csvData = `instrument_key,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange,isin,multiplier,freeze_qty,underlying,underlying_key
NSE_EQ|INE002A01018,3045,RELIANCE,Reliance Industries Limited,2500.0,,0,0.05,1,EQ,NSE,NSE,INE002A01018,1,10000,,
NSE_FO|NIFTY25JAN22000CE,123456,NIFTY25JAN22000CE,NIFTY 22000 CE 30 JAN 25,150.0,2025-01-30,22000,0.05,50,CE,NSE,NFO,,1,1800,NIFTY,NSE_INDEX|NIFTY 50
NSE_FO|NIFTY25JAN22000PE,123457,NIFTY25JAN22000PE,NIFTY 22000 PE 30 JAN 25,200.0,2025-01-30,22000,0.05,50,PE,NSE,NFO,,1,1800,NIFTY,NSE_INDEX|NIFTY 50`;

      fs.writeFileSync(testCsvPath, csvData);

      // Test parsing
      const result = await processor.processUpstoxData(testCsvPath);

      expect(result).toBeDefined();
      expect(result.totalProcessed).toBe(3);
      expect(result.validSymbols).toBe(3);
      expect(result.invalidSymbols).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle malformed CSV data gracefully', async () => {
      // Create test CSV with malformed data
      const csvData = `instrument_key,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange,isin,multiplier,freeze_qty,underlying,underlying_key
NSE_EQ|INE002A01018,3045,RELIANCE,Reliance Industries Limited,2500.0,,0,0.05,1,EQ,NSE,NSE,INE002A01018,1,10000,,
,,,,,,,,,,,,,,,, 
INVALID_DATA_ROW
NSE_FO|NIFTY25JAN22000CE,123456,NIFTY25JAN22000CE,NIFTY 22000 CE 30 JAN 25,150.0,2025-01-30,22000,0.05,50,CE,NSE,NFO,,1,1800,NIFTY,NSE_INDEX|NIFTY 50`;

      fs.writeFileSync(testCsvPath, csvData);

      // Test parsing
      const result = await processor.processUpstoxData(testCsvPath);

      expect(result).toBeDefined();
      expect(result.totalProcessed).toBe(2); // Only valid rows should be processed
      expect(result.validSymbols).toBe(2);
    });
  });

  describe('Data Transformation', () => {
    it('should transform equity symbols correctly', () => {
      const rawSymbol: RawUpstoxSymbolData = {
        instrument_key: 'NSE_EQ|INE002A01018',
        exchange_token: '3045',
        tradingsymbol: 'RELIANCE',
        name: 'Reliance Industries Limited',
        last_price: 2500.0,
        expiry: '',
        strike: 0,
        tick_size: 0.05,
        lot_size: 1,
        instrument_type: 'EQ',
        segment: 'NSE',
        exchange: 'NSE',
        isin: 'INE002A01018',
        multiplier: 1,
        freeze_qty: 10000,
        underlying: '',
        underlying_key: ''
      };

      // Use reflection to access private method for testing
      const transformMethod = (processor as any).transformToStandardFormat.bind(processor);
      const result: CreateStandardizedSymbolData[] = transformMethod([rawSymbol]);

      expect(result).toHaveLength(1);
      const transformed = result[0];
      
      expect(transformed.instrumentType).toBe('EQUITY');
      expect(transformed.exchange).toBe('NSE');
      expect(transformed.tradingSymbol).toBe('RELIANCE');
      expect(transformed.displayName).toBe('Reliance Industries Limited');
      expect(transformed.companyName).toBe('Reliance Industries Limited');
      expect(transformed.isin).toBe('INE002A01018');
      expect(transformed.lotSize).toBe(1);
      expect(transformed.tickSize).toBe(0.05);
      expect(transformed.source).toBe('upstox');
      expect(transformed.underlying).toBeUndefined();
      expect(transformed.strikePrice).toBeUndefined();
      expect(transformed.optionType).toBeUndefined();
      expect(transformed.expiryDate).toBeUndefined();
    });

    it('should transform option symbols correctly', () => {
      const rawSymbol: RawUpstoxSymbolData = {
        instrument_key: 'NSE_FO|NIFTY25JAN22000CE',
        exchange_token: '123456',
        tradingsymbol: 'NIFTY25JAN22000CE',
        name: 'NIFTY 22000 CE 30 JAN 25',
        last_price: 150.0,
        expiry: '2025-01-30',
        strike: 22000,
        tick_size: 0.05,
        lot_size: 50,
        instrument_type: 'CE',
        segment: 'NSE',
        exchange: 'NSE',
        isin: '',
        multiplier: 1,
        freeze_qty: 1800,
        underlying: 'NIFTY',
        underlying_key: 'NSE_INDEX|NIFTY 50'
      };

      const transformMethod = (processor as any).transformToStandardFormat.bind(processor);
      const result: CreateStandardizedSymbolData[] = transformMethod([rawSymbol]);

      expect(result).toHaveLength(1);
      const transformed = result[0];
      
      expect(transformed.instrumentType).toBe('OPTION');
      expect(transformed.exchange).toBe('NFO');
      expect(transformed.tradingSymbol).toBe('NIFTY25JAN22000CE');
      expect(transformed.underlying).toBe('NIFTY');
      expect(transformed.strikePrice).toBe(22000);
      expect(transformed.optionType).toBe('CE');
      expect(transformed.expiryDate).toBe('2025-01-30');
      expect(transformed.lotSize).toBe(50);
      expect(transformed.tickSize).toBe(0.05);
      expect(transformed.source).toBe('upstox');
      expect(transformed.companyName).toBeUndefined();
    });

    it('should skip unsupported instrument types', () => {
      const rawSymbol: RawUpstoxSymbolData = {
        instrument_key: 'NSE_CD|UNSUPPORTED',
        exchange_token: '999999',
        tradingsymbol: 'UNSUPPORTED',
        name: 'Unsupported Instrument',
        last_price: 100.0,
        expiry: '',
        strike: 0,
        tick_size: 0.05,
        lot_size: 1,
        instrument_type: 'CD', // Currency derivative - not supported
        segment: 'NSE',
        exchange: 'NSE',
        isin: '',
        multiplier: 1,
        freeze_qty: 1000,
        underlying: '',
        underlying_key: ''
      };

      const transformMethod = (processor as any).transformToStandardFormat.bind(processor);
      const result: CreateStandardizedSymbolData[] = transformMethod([rawSymbol]);

      expect(result).toHaveLength(0); // Should be skipped
    });
  });

  describe('Service Status', () => {
    it('should return correct stats', () => {
      const stats = processor.getStats();

      expect(stats).toBeDefined();
      expect(stats.service).toBe('Upstox Data Processor');
      expect(stats.status).toBe('idle');
      expect(stats.dataSource).toBe('Upstox CSV');
      expect(stats.nextUpdate).toBe('Daily at 6:00 AM IST');
    });

    it('should indicate when update is needed', () => {
      const stats = processor.getStats();
      expect(stats.needsUpdate).toBe(true); // Should be true for new instance
    });

    it('should indicate readiness correctly', () => {
      expect(processor.isReady()).toBe(false); // Should be false for new instance without processing
    });
  });

  describe('Error Handling', () => {
    it('should handle file not found errors gracefully', async () => {
      const nonExistentPath = path.join(testDataDir, 'non-existent-file.csv');
      
      await expect(processor.processUpstoxData(nonExistentPath)).rejects.toThrow();
    });

    it('should handle empty CSV files', async () => {
      // Create empty CSV file
      fs.writeFileSync(testCsvPath, '');

      await expect(processor.processUpstoxData(testCsvPath)).rejects.toThrow();
    });

    it('should handle CSV with only headers', async () => {
      const csvData = 'instrument_key,exchange_token,tradingsymbol,name,last_price,expiry,strike,tick_size,lot_size,instrument_type,segment,exchange,isin,multiplier,freeze_qty,underlying,underlying_key';
      fs.writeFileSync(testCsvPath, csvData);

      const result = await processor.processUpstoxData(testCsvPath);
      
      expect(result.totalProcessed).toBe(0);
      expect(result.validSymbols).toBe(0);
    });
  });
});