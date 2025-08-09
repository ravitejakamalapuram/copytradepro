import { BrokerSymbolConverterFactory } from '../services/brokerSymbolConverters/BrokerSymbolConverterFactory';
import { IBrokerSymbolConverter, BrokerSymbolFormat } from '../services/brokerSymbolConverters/IBrokerSymbolConverter';
import { FyersSymbolConverter } from '../services/brokerSymbolConverters/FyersSymbolConverter';
import { ShoonyaSymbolConverter } from '../services/brokerSymbolConverters/ShoonyaSymbolConverter';
import { StandardizedSymbol } from '../models/symbolModels';

// Mock converter for testing
class MockBrokerConverter implements IBrokerSymbolConverter {
  constructor(private brokerName: string, private supportedExchanges: string[] = ['NSE']) {}

  getBrokerName(): string {
    return this.brokerName;
  }

  canConvert(symbol: StandardizedSymbol): boolean {
    return this.supportedExchanges.includes(symbol.exchange);
  }

  convertToBrokerFormat(symbol: StandardizedSymbol): BrokerSymbolFormat {
    if (!this.canConvert(symbol)) {
      throw new Error(`${this.brokerName} does not support exchange: ${symbol.exchange}`);
    }
    
    return {
      tradingSymbol: `${this.brokerName.toUpperCase()}:${symbol.tradingSymbol}`,
      exchange: symbol.exchange,
      segment: symbol.segment
    };
  }
}

describe('BrokerSymbolConverterFactory', () => {
  beforeEach(() => {
    // Clear converters before each test
    BrokerSymbolConverterFactory.clearConverters();
  });

  afterEach(() => {
    // Clean up after each test
    BrokerSymbolConverterFactory.clearConverters();
  });

  describe('registerConverter', () => {
    it('should register a new converter', () => {
      const mockConverter = new MockBrokerConverter('testbroker');
      
      BrokerSymbolConverterFactory.registerConverter(mockConverter);
      
      expect(BrokerSymbolConverterFactory.hasConverter('testbroker')).toBe(true);
      expect(BrokerSymbolConverterFactory.getRegisteredBrokers()).toContain('testbroker');
    });

    it('should handle case-insensitive broker names', () => {
      const mockConverter = new MockBrokerConverter('TestBroker');
      
      BrokerSymbolConverterFactory.registerConverter(mockConverter);
      
      expect(BrokerSymbolConverterFactory.hasConverter('testbroker')).toBe(true);
      expect(BrokerSymbolConverterFactory.hasConverter('TESTBROKER')).toBe(true);
      expect(BrokerSymbolConverterFactory.hasConverter('TestBroker')).toBe(true);
    });

    it('should replace existing converter with same name', () => {
      const mockConverter1 = new MockBrokerConverter('testbroker', ['NSE']);
      const mockConverter2 = new MockBrokerConverter('testbroker', ['NSE', 'BSE']);
      
      BrokerSymbolConverterFactory.registerConverter(mockConverter1);
      BrokerSymbolConverterFactory.registerConverter(mockConverter2);
      
      const converter = BrokerSymbolConverterFactory.getConverter('testbroker');
      
      const testSymbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'BSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      // Should be able to convert BSE (from second converter)
      expect(converter.canConvert(testSymbol)).toBe(true);
    });
  });

  describe('unregisterConverter', () => {
    it('should unregister an existing converter', () => {
      const mockConverter = new MockBrokerConverter('testbroker');
      
      BrokerSymbolConverterFactory.registerConverter(mockConverter);
      expect(BrokerSymbolConverterFactory.hasConverter('testbroker')).toBe(true);
      
      const result = BrokerSymbolConverterFactory.unregisterConverter('testbroker');
      
      expect(result).toBe(true);
      expect(BrokerSymbolConverterFactory.hasConverter('testbroker')).toBe(false);
    });

    it('should return false when unregistering non-existent converter', () => {
      const result = BrokerSymbolConverterFactory.unregisterConverter('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getConverter', () => {
    it('should return the correct converter', () => {
      const mockConverter = new MockBrokerConverter('testbroker');
      
      BrokerSymbolConverterFactory.registerConverter(mockConverter);
      
      const converter = BrokerSymbolConverterFactory.getConverter('testbroker');
      expect(converter.getBrokerName()).toBe('testbroker');
    });

    it('should throw error for non-existent converter', () => {
      expect(() => BrokerSymbolConverterFactory.getConverter('nonexistent'))
        .toThrow('No converter found for broker: nonexistent');
    });

    it('should initialize default converters on first access', () => {
      // Should have default converters
      expect(BrokerSymbolConverterFactory.hasConverter('fyers')).toBe(true);
      expect(BrokerSymbolConverterFactory.hasConverter('shoonya')).toBe(true);
    });
  });

  describe('convertSymbol', () => {
    it('should convert symbol using the correct converter', () => {
      const mockConverter = new MockBrokerConverter('testbroker');
      BrokerSymbolConverterFactory.registerConverter(mockConverter);
      
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      const result = BrokerSymbolConverterFactory.convertSymbol(symbol, 'testbroker');
      
      expect(result.tradingSymbol).toBe('TESTBROKER:TEST');
      expect(result.exchange).toBe('NSE');
      expect(result.segment).toBe('EQ');
    });

    it('should throw error when broker cannot convert symbol', () => {
      const mockConverter = new MockBrokerConverter('testbroker', ['NSE']);
      BrokerSymbolConverterFactory.registerConverter(mockConverter);
      
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'BSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      expect(() => BrokerSymbolConverterFactory.convertSymbol(symbol, 'testbroker'))
        .toThrow('Broker testbroker cannot convert symbol with exchange: BSE');
    });
  });

  describe('getCompatibleBrokers', () => {
    it('should return all brokers that can convert the symbol', () => {
      const converter1 = new MockBrokerConverter('broker1', ['NSE', 'BSE']);
      const converter2 = new MockBrokerConverter('broker2', ['NSE']);
      const converter3 = new MockBrokerConverter('broker3', ['BSE']);
      
      BrokerSymbolConverterFactory.registerConverter(converter1);
      BrokerSymbolConverterFactory.registerConverter(converter2);
      BrokerSymbolConverterFactory.registerConverter(converter3);
      
      const nseSymbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      const compatibleBrokers = BrokerSymbolConverterFactory.getCompatibleBrokers(nseSymbol);
      
      expect(compatibleBrokers).toContain('broker1');
      expect(compatibleBrokers).toContain('broker2');
      expect(compatibleBrokers).not.toContain('broker3');
      // Also contains default converters
      expect(compatibleBrokers).toContain('fyers');
      expect(compatibleBrokers).toContain('shoonya');
    });

    it('should include default converters that can convert MCX symbols', () => {
      const converter = new MockBrokerConverter('broker1', ['NSE']);
      BrokerSymbolConverterFactory.registerConverter(converter);
      
      const mcxSymbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'FUTURE',
        exchange: 'MCX',
        segment: 'FO',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      const compatibleBrokers = BrokerSymbolConverterFactory.getCompatibleBrokers(mcxSymbol);
      // Default converters (Fyers and Shoonya) support MCX
      expect(compatibleBrokers).toContain('fyers');
      expect(compatibleBrokers).toContain('shoonya');
      expect(compatibleBrokers).not.toContain('broker1');
    });
  });

  describe('convertSymbols', () => {
    it('should convert multiple symbols for a broker', () => {
      const mockConverter = new MockBrokerConverter('testbroker');
      BrokerSymbolConverterFactory.registerConverter(mockConverter);
      
      const symbols: StandardizedSymbol[] = [
        {
          id: 'test1',
          displayName: 'Test Symbol 1',
          tradingSymbol: 'TEST1',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          isActive: true,
          lastUpdated: '2025-01-01T00:00:00Z',
          source: 'test',
          createdAt: '2025-01-01T00:00:00Z'
        },
        {
          id: 'test2',
          displayName: 'Test Symbol 2',
          tradingSymbol: 'TEST2',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          isActive: true,
          lastUpdated: '2025-01-01T00:00:00Z',
          source: 'test',
          createdAt: '2025-01-01T00:00:00Z'
        }
      ];
      
      const results = BrokerSymbolConverterFactory.convertSymbols(symbols, 'testbroker');
      
      expect(results).toHaveLength(2);
      expect(results[0]?.tradingSymbol).toBe('TESTBROKER:TEST1');
      expect(results[1]?.tradingSymbol).toBe('TESTBROKER:TEST2');
    });

    it('should throw error if any symbol cannot be converted', () => {
      const mockConverter = new MockBrokerConverter('testbroker', ['NSE']);
      BrokerSymbolConverterFactory.registerConverter(mockConverter);
      
      const symbols: StandardizedSymbol[] = [
        {
          id: 'test1',
          displayName: 'Test Symbol 1',
          tradingSymbol: 'TEST1',
          instrumentType: 'EQUITY',
          exchange: 'NSE',
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          isActive: true,
          lastUpdated: '2025-01-01T00:00:00Z',
          source: 'test',
          createdAt: '2025-01-01T00:00:00Z'
        },
        {
          id: 'test2',
          displayName: 'Test Symbol 2',
          tradingSymbol: 'TEST2',
          instrumentType: 'EQUITY',
          exchange: 'BSE', // Not supported
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          isActive: true,
          lastUpdated: '2025-01-01T00:00:00Z',
          source: 'test',
          createdAt: '2025-01-01T00:00:00Z'
        }
      ];
      
      expect(() => BrokerSymbolConverterFactory.convertSymbols(symbols, 'testbroker'))
        .toThrow('Broker testbroker cannot convert symbol test2 with exchange: BSE');
    });
  });

  describe('canConvertSymbol', () => {
    it('should return true when broker can convert symbol', () => {
      const mockConverter = new MockBrokerConverter('testbroker');
      BrokerSymbolConverterFactory.registerConverter(mockConverter);
      
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      expect(BrokerSymbolConverterFactory.canConvertSymbol(symbol, 'testbroker')).toBe(true);
    });

    it('should return false when broker cannot convert symbol', () => {
      const mockConverter = new MockBrokerConverter('testbroker', ['NSE']);
      BrokerSymbolConverterFactory.registerConverter(mockConverter);
      
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'BSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      expect(BrokerSymbolConverterFactory.canConvertSymbol(symbol, 'testbroker')).toBe(false);
    });

    it('should return false when broker does not exist', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      expect(BrokerSymbolConverterFactory.canConvertSymbol(symbol, 'nonexistent')).toBe(false);
    });
  });

  describe('getConverterStats', () => {
    it('should return statistics including default converters', () => {
      const converter1 = new MockBrokerConverter('broker1', ['NSE', 'BSE']);
      const converter2 = new MockBrokerConverter('broker2', ['MCX']);
      
      BrokerSymbolConverterFactory.registerConverter(converter1);
      BrokerSymbolConverterFactory.registerConverter(converter2);
      
      const stats = BrokerSymbolConverterFactory.getConverterStats();
      
      // Should include default converters (fyers, shoonya) + our test converters
      expect(stats.totalConverters).toBeGreaterThanOrEqual(4);
      expect(stats.brokers).toContain('broker1');
      expect(stats.brokers).toContain('broker2');
      expect(stats.brokers).toContain('fyers');
      expect(stats.brokers).toContain('shoonya');
      expect(stats.supportedExchanges).toContain('NSE');
      expect(stats.supportedExchanges).toContain('BSE');
      expect(stats.supportedExchanges).toContain('MCX');
    });
  });

  describe('Default Converters Integration', () => {
    it('should have Fyers and Shoonya converters by default', () => {
      // Access factory to trigger initialization
      const brokers = BrokerSymbolConverterFactory.getRegisteredBrokers();
      
      expect(brokers).toContain('fyers');
      expect(brokers).toContain('shoonya');
    });

    it('should convert NSE equity symbol using Fyers converter', () => {
      const symbol: StandardizedSymbol = {
        id: 'reliance-nse-eq',
        displayName: 'Reliance Industries Ltd',
        tradingSymbol: 'RELIANCE',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'upstox',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      const result = BrokerSymbolConverterFactory.convertSymbol(symbol, 'fyers');
      expect(result.tradingSymbol).toBe('NSE:RELIANCE-EQ');
    });

    it('should convert NSE equity symbol using Shoonya converter', () => {
      const symbol: StandardizedSymbol = {
        id: 'reliance-nse-eq',
        displayName: 'Reliance Industries Ltd',
        tradingSymbol: 'RELIANCE',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'upstox',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      const result = BrokerSymbolConverterFactory.convertSymbol(symbol, 'shoonya');
      expect(result.tradingSymbol).toBe('RELIANCE');
      expect(result.exchange).toBe('NSE');
    });
  });
});