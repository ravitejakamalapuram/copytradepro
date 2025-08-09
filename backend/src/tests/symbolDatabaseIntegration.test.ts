import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { MongoDatabase } from '../services/mongoDatabase';
import { SymbolDatabaseService } from '../services/symbolDatabaseService';
import { CreateStandardizedSymbolData } from '../models/symbolModels';

describe('Symbol Database Integration', () => {
  let database: MongoDatabase;
  let symbolDbService: SymbolDatabaseService;

  beforeAll(async () => {
    // Initialize main database
    database = new MongoDatabase();
    await database.initialize();
    
    // Initialize symbol database service
    symbolDbService = new SymbolDatabaseService();
    await symbolDbService.initialize();
  });

  afterAll(async () => {
    // Clean up
    await database.close();
  });

  it('should perform complete symbol lifecycle operations', async () => {
    // 1. Create a simple equity symbol first
    const timestamp = Date.now();
    const equitySymbol = await symbolDbService.createSymbol({
      displayName: 'Test Company Integration',
      tradingSymbol: `TESTINT${timestamp}`,
      instrumentType: 'EQUITY',
      exchange: 'NSE',
      segment: 'EQ',
      lotSize: 1,
      tickSize: 0.05,
      source: 'integration_test'
    });

    expect(equitySymbol).toBeDefined();
    expect(equitySymbol.tradingSymbol).toBe(`TESTINT${timestamp}`);

    // 2. Create processing log
    const processingLog = await symbolDbService.createProcessingLog({
      processType: 'MANUAL_UPDATE',
      source: 'integration_test',
      status: 'STARTED'
    });

    expect(processingLog).toBeDefined();
    expect(processingLog.processType).toBe('MANUAL_UPDATE');

    // 3. Search and verify symbols
    const equitySearch = await symbolDbService.searchSymbolsWithFilters({
      instrumentType: 'EQUITY'
    });
    expect(equitySearch.symbols.length).toBeGreaterThanOrEqual(1);
    
    const testSymbol = equitySearch.symbols.find((s: any) => s.tradingSymbol === `TESTINT${timestamp}`);
    expect(testSymbol).toBeDefined();

    // 4. Get symbol by trading symbol
    const retrievedSymbol = await symbolDbService.getSymbolByTradingSymbol(`TESTINT${timestamp}`, 'NSE');
    expect(retrievedSymbol).toBeDefined();
    expect(retrievedSymbol?.displayName).toBe('Test Company Integration');

    // 5. Get statistics
    const stats = await symbolDbService.getStatistics();
    expect(stats.totalSymbols).toBeGreaterThanOrEqual(1);
    expect(stats.activeSymbols).toBeGreaterThanOrEqual(1);
    expect(stats.symbolsByType.EQUITY).toBeGreaterThanOrEqual(1);

    // 6. Update processing log
    const updatedLog = await symbolDbService.updateProcessingLog(processingLog.id, {
      status: 'COMPLETED',
      totalProcessed: 1,
      validSymbols: 1,
      newSymbols: 1,
      updatedSymbols: 0,
      invalidSymbols: 0
    });

    expect(updatedLog).toBeDefined();
    expect(updatedLog?.status).toBe('COMPLETED');
    expect(updatedLog?.completedAt).toBeDefined();

    // 7. Get symbol history
    const history = await symbolDbService.getSymbolHistory(equitySymbol.id);
    expect(history).toHaveLength(1);
    expect(history[0]?.changeType).toBe('CREATED');

    console.log('✅ Integration test completed successfully');
  });

  it('should handle validation errors gracefully', async () => {
    const invalidSymbols: CreateStandardizedSymbolData[] = [
      {
        displayName: '', // Invalid - empty
        tradingSymbol: 'INVALID1',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'test'
      },
      {
        displayName: 'Invalid Option',
        tradingSymbol: 'INVALID2',
        instrumentType: 'OPTION',
        exchange: 'NFO',
        segment: 'FO',
        // Missing required option fields
        lotSize: 50,
        tickSize: 0.05,
        source: 'test'
      }
    ];

    const result = await symbolDbService.upsertSymbols(invalidSymbols);
    
    expect(result.totalProcessed).toBe(2);
    expect(result.invalidSymbols).toBe(2);
    expect(result.validSymbols).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});