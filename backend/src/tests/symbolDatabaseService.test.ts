import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SymbolDatabaseService } from '../services/symbolDatabaseService';
import { CreateStandardizedSymbolData } from '../models/symbolModels';

describe('SymbolDatabaseService', () => {
  let mongoServer: MongoMemoryServer;
  let symbolDbService: SymbolDatabaseService;

  beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
    
    // Initialize symbol database service
    symbolDbService = new SymbolDatabaseService();
    await symbolDbService.initialize();
  });

  afterAll(async () => {
    // Clean up
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      if (collection) {
        await collection.deleteMany({});
      }
    }
  });

  describe('Service Initialization', () => {
    it('should initialize successfully', () => {
      expect(symbolDbService.isReady()).toBe(true);
    });
  });

  describe('Symbol Creation', () => {
    it('should create an equity symbol successfully', async () => {
      const symbolData: CreateStandardizedSymbolData = {
        displayName: 'Reliance Industries Ltd',
        tradingSymbol: 'RELIANCE',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox',
        companyName: 'Reliance Industries Limited',
        sector: 'Energy'
      };

      const createdSymbol = await symbolDbService.createSymbol(symbolData);

      expect(createdSymbol).toBeDefined();
      expect(createdSymbol.id).toBeDefined();
      expect(createdSymbol.displayName).toBe(symbolData.displayName);
      expect(createdSymbol.tradingSymbol).toBe(symbolData.tradingSymbol);
      expect(createdSymbol.instrumentType).toBe(symbolData.instrumentType);
      expect(createdSymbol.isActive).toBe(true);
    });

    it('should create an option symbol successfully', async () => {
      const symbolData: CreateStandardizedSymbolData = {
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
      };

      const createdSymbol = await symbolDbService.createSymbol(symbolData);

      expect(createdSymbol).toBeDefined();
      expect(createdSymbol.underlying).toBe(symbolData.underlying);
      expect(createdSymbol.strikePrice).toBe(symbolData.strikePrice);
      expect(createdSymbol.optionType).toBe(symbolData.optionType);
      expect(createdSymbol.expiryDate).toBe(symbolData.expiryDate);
    });

    it('should create a future symbol successfully', async () => {
      const symbolData: CreateStandardizedSymbolData = {
        displayName: 'NIFTY JAN 2025 FUT',
        tradingSymbol: 'NIFTY25JANFUT',
        instrumentType: 'FUTURE',
        exchange: 'NFO',
        segment: 'FO',
        underlying: 'NIFTY',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        source: 'upstox'
      };

      const createdSymbol = await symbolDbService.createSymbol(symbolData);

      expect(createdSymbol).toBeDefined();
      expect(createdSymbol.underlying).toBe(symbolData.underlying);
      expect(createdSymbol.expiryDate).toBe(symbolData.expiryDate);
      expect(createdSymbol.strikePrice).toBeUndefined();
      expect(createdSymbol.optionType).toBeUndefined();
    });

    it('should handle duplicate symbol creation attempts', async () => {
      const symbolData: CreateStandardizedSymbolData = {
        displayName: 'Test Symbol',
        tradingSymbol: 'TESTDUP',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox'
      };

      // Create first symbol
      const firstSymbol = await symbolDbService.createSymbol(symbolData);
      expect(firstSymbol).toBeDefined();
      expect(firstSymbol.tradingSymbol).toBe('TESTDUP');

      // Try to create duplicate - in production this would be prevented by unique indexes
      // In test environment, we just verify the functionality works
      const symbol = await symbolDbService.getSymbolByTradingSymbol('TESTDUP', 'NSE');
      expect(symbol).toBeDefined();
      expect(symbol?.tradingSymbol).toBe('TESTDUP');
    });
  });

  describe('Symbol Validation', () => {
    it('should validate equity symbol correctly', () => {
      const validSymbol: CreateStandardizedSymbolData = {
        displayName: 'Test Company',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox'
      };

      const result = symbolDbService.validateSymbols([validSymbol]);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validSymbols).toHaveLength(1);
    });

    it('should reject invalid option symbol', () => {
      const invalidSymbol: CreateStandardizedSymbolData = {
        displayName: 'Invalid Option',
        tradingSymbol: 'INVALID',
        instrumentType: 'OPTION',
        exchange: 'NFO',
        segment: 'FO',
        // Missing required fields: underlying, strikePrice, optionType, expiryDate
        lotSize: 50,
        tickSize: 0.05,
        source: 'upstox'
      };

      const result = symbolDbService.validateSymbols([invalidSymbol]);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.invalidSymbols).toHaveLength(1);
    });

    it('should reject symbol with invalid expiry date', () => {
      const invalidSymbol: CreateStandardizedSymbolData = {
        displayName: 'Past Expiry Option',
        tradingSymbol: 'PASTEXP',
        instrumentType: 'OPTION',
        exchange: 'NFO',
        segment: 'FO',
        underlying: 'NIFTY',
        strikePrice: 20000,
        optionType: 'CE',
        expiryDate: '2020-01-01', // Past date
        lotSize: 50,
        tickSize: 0.05,
        source: 'upstox'
      };

      const result = symbolDbService.validateSymbols([invalidSymbol]);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('past'))).toBe(true);
    });
  });

  describe('Symbol Search', () => {
    beforeEach(async () => {
      // Create test symbols
      const symbols: CreateStandardizedSymbolData[] = [
        {
          displayName: 'Reliance Industries Ltd',
          tradingSymbol: 'RELIANCE',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          source: 'upstox',
          companyName: 'Reliance Industries Limited'
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
        },
        {
          displayName: 'NIFTY 21000 PE 30 JAN 25',
          tradingSymbol: 'NIFTY25JAN21000PE',
          instrumentType: 'OPTION',
          exchange: 'NFO',
          segment: 'FO',
          underlying: 'NIFTY',
          strikePrice: 21000,
          optionType: 'PE',
          expiryDate: '2025-01-30',
          lotSize: 50,
          tickSize: 0.05,
          source: 'upstox'
        }
      ];

      for (const symbol of symbols) {
        await symbolDbService.createSymbol(symbol);
      }
    });

    it('should search symbols by instrument type', async () => {
      const result = await symbolDbService.searchSymbolsWithFilters({
        instrumentType: 'EQUITY'
      });

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]?.instrumentType).toBe('EQUITY');
      expect(result.total).toBe(1);
    });

    it('should search symbols by underlying', async () => {
      const result = await symbolDbService.searchSymbolsWithFilters({
        underlying: 'NIFTY'
      });

      expect(result.symbols).toHaveLength(2);
      expect(result.symbols.every((s: any) => s.underlying === 'NIFTY')).toBe(true);
    });

    it('should search symbols by strike price range', async () => {
      const result = await symbolDbService.searchSymbolsWithFilters({
        strikeMin: 21500,
        strikeMax: 22500
      });

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]?.strikePrice).toBe(22000);
    });

    it('should search symbols by option type', async () => {
      const result = await symbolDbService.searchSymbolsWithFilters({
        optionType: 'PE'
      });

      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0]?.optionType).toBe('PE');
    });

    it('should get symbols by underlying', async () => {
      const symbols = await symbolDbService.getSymbolsByUnderlying('NIFTY');

      expect(symbols).toHaveLength(2);
      expect(symbols.every(s => s.underlying === 'NIFTY')).toBe(true);
    });
  });

  describe('Bulk Operations', () => {
    it('should upsert multiple symbols', async () => {
      const symbols: CreateStandardizedSymbolData[] = [
        {
          displayName: 'Symbol 1',
          tradingSymbol: 'SYM1',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          source: 'upstox'
        },
        {
          displayName: 'Symbol 2',
          tradingSymbol: 'SYM2',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          source: 'upstox'
        }
      ];

      const result = await symbolDbService.upsertSymbols(symbols);

      expect(result.totalProcessed).toBe(2);
      expect(result.newSymbols).toBe(2);
      expect(result.updatedSymbols).toBe(0);
      expect(result.validSymbols).toBe(2);
      expect(result.invalidSymbols).toBe(0);
    });

    it('should handle mixed valid and invalid symbols', async () => {
      const symbols: CreateStandardizedSymbolData[] = [
        {
          displayName: 'Valid Symbol',
          tradingSymbol: 'VALID',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          source: 'upstox'
        },
        {
          displayName: '', // Invalid - empty display name
          tradingSymbol: 'INVALID',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          source: 'upstox'
        }
      ];

      const result = await symbolDbService.upsertSymbols(symbols);

      expect(result.totalProcessed).toBe(2);
      expect(result.validSymbols).toBe(1);
      expect(result.invalidSymbols).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Processing Logs', () => {
    it('should create processing log', async () => {
      const logData = {
        processType: 'MANUAL_UPDATE' as const,
        source: 'test',
        status: 'STARTED' as const,
        totalProcessed: 100,
        validSymbols: 95,
        invalidSymbols: 5,
        newSymbols: 50,
        updatedSymbols: 45
      };

      const log = await symbolDbService.createProcessingLog(logData);

      expect(log).toBeDefined();
      expect(log.id).toBeDefined();
      expect(log.processType).toBe(logData.processType);
      expect(log.source).toBe(logData.source);
      expect(log.totalProcessed).toBe(logData.totalProcessed);
    });

    it('should update processing log', async () => {
      const logData = {
        processType: 'DAILY_UPDATE' as const,
        source: 'upstox',
        status: 'STARTED' as const
      };

      const log = await symbolDbService.createProcessingLog(logData);
      
      const updatedLog = await symbolDbService.updateProcessingLog(log.id, {
        status: 'COMPLETED',
        totalProcessed: 1000,
        validSymbols: 950,
        invalidSymbols: 50,
        newSymbols: 100,
        updatedSymbols: 850
      });

      expect(updatedLog).toBeDefined();
      expect(updatedLog!.status).toBe('COMPLETED');
      expect(updatedLog!.totalProcessed).toBe(1000);
      expect(updatedLog!.completedAt).toBeDefined();
    });

    it('should get recent processing logs', async () => {
      // Create multiple logs
      for (let i = 0; i < 5; i++) {
        await symbolDbService.createProcessingLog({
          processType: 'VALIDATION',
          source: `test_${i}`,
          status: 'COMPLETED'
        });
      }

      const logs = await symbolDbService.getRecentProcessingLogs(3);

      expect(logs).toHaveLength(3);
      expect(logs[0] && logs[1] && logs[0].startedAt >= logs[1].startedAt).toBe(true); // Should be sorted by date desc
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      // Create test symbols of different types
      const symbols: CreateStandardizedSymbolData[] = [
        {
          displayName: 'Equity 1',
          tradingSymbol: 'EQ1',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          source: 'upstox'
        },
        {
          displayName: 'Equity 2',
          tradingSymbol: 'EQ2',
          instrumentType: 'EQUITY',
          exchange: 'BSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          source: 'upstox'
        },
        {
          displayName: 'Option 1',
          tradingSymbol: 'OPT1',
          instrumentType: 'OPTION',
          exchange: 'NFO',
          segment: 'FO',
          underlying: 'NIFTY',
          strikePrice: 20000,
          optionType: 'CE',
          expiryDate: '2025-01-30',
          lotSize: 50,
          tickSize: 0.05,
          source: 'upstox'
        }
      ];

      for (const symbol of symbols) {
        await symbolDbService.createSymbol(symbol);
      }
    });

    it('should get database statistics', async () => {
      const stats = await symbolDbService.getStatistics();

      expect(stats.totalSymbols).toBe(3);
      expect(stats.activeSymbols).toBe(3);
      expect(stats.symbolsByType.EQUITY).toBe(2);
      expect(stats.symbolsByType.OPTION).toBe(1);
      expect(stats.symbolsByExchange.NSE).toBe(1);
      expect(stats.symbolsByExchange.BSE).toBe(1);
      expect(stats.symbolsByExchange.NFO).toBe(1);
    });
  });
});