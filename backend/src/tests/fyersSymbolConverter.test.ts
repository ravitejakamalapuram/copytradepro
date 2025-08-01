import { FyersSymbolConverter } from '../services/brokerSymbolConverters/FyersSymbolConverter';
import { StandardizedSymbol } from '../models/symbolModels';

describe('FyersSymbolConverter', () => {
  let converter: FyersSymbolConverter;

  beforeEach(() => {
    converter = new FyersSymbolConverter();
  });

  describe('getBrokerName', () => {
    it('should return fyers as broker name', () => {
      expect(converter.getBrokerName()).toBe('fyers');
    });
  });

  describe('canConvert', () => {
    it('should return true for supported exchanges', () => {
      const supportedExchanges = ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'];
      
      supportedExchanges.forEach(exchange => {
        const symbol: StandardizedSymbol = {
          id: 'test',
          displayName: 'Test Symbol',
          tradingSymbol: 'TEST',
          instrumentType: 'EQUITY',
          exchange: exchange as any,
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          isActive: true,
          lastUpdated: '2025-01-01T00:00:00Z',
          source: 'test',
          createdAt: '2025-01-01T00:00:00Z'
        };
        
        expect(converter.canConvert(symbol)).toBe(true);
      });
    });

    it('should return false for unsupported exchanges', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'UNSUPPORTED' as any,
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };
      
      expect(converter.canConvert(symbol)).toBe(false);
    });
  });

  describe('convertToBrokerFormat - Equity', () => {
    it('should convert NSE equity symbol correctly', () => {
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
        createdAt: '2025-01-01T00:00:00Z',
        companyName: 'Reliance Industries Ltd',
        isin: 'INE002A01018'
      };

      const result = converter.convertToBrokerFormat(symbol);
      
      expect(result.tradingSymbol).toBe('NSE:RELIANCE-EQ');
      expect(result.exchange).toBe('NSE');
      expect(result.segment).toBe('EQ');
    });

    it('should convert BSE equity symbol correctly', () => {
      const symbol: StandardizedSymbol = {
        id: 'reliance-bse-eq',
        displayName: 'Reliance Industries Ltd',
        tradingSymbol: 'RELIANCE',
        instrumentType: 'EQUITY',
        exchange: 'BSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'upstox',
        createdAt: '2025-01-01T00:00:00Z',
        companyName: 'Reliance Industries Ltd',
        isin: 'INE002A01018'
      };

      const result = converter.convertToBrokerFormat(symbol);
      
      expect(result.tradingSymbol).toBe('BSE:RELIANCE-EQ');
      expect(result.exchange).toBe('BSE');
      expect(result.segment).toBe('EQ');
    });

    it('should throw error for equity with invalid exchange', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'NFO',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Invalid exchange for equity: NFO. Expected NSE or BSE');
    });

    it('should throw error for equity without trading symbol', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: '',
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

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Trading symbol is required for equity conversion');
    });
  });

  describe('convertToBrokerFormat - Options', () => {
    it('should convert NSE option symbol correctly', () => {
      const symbol: StandardizedSymbol = {
        id: 'nifty-option-ce',
        displayName: 'NIFTY 22000 CE 30 JAN 25',
        tradingSymbol: 'NIFTY25JAN22000CE',
        instrumentType: 'OPTION',
        exchange: 'NSE',
        segment: 'FO',
        underlying: 'NIFTY',
        strikePrice: 22000,
        optionType: 'CE',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'upstox',
        createdAt: '2025-01-01T00:00:00Z'
      };

      const result = converter.convertToBrokerFormat(symbol);
      
      expect(result.tradingSymbol).toBe('NSE:NIFTY25JAN22000CE');
      expect(result.exchange).toBe('NSE');
      expect(result.segment).toBe('FO');
    });

    it('should convert NFO option symbol correctly', () => {
      const symbol: StandardizedSymbol = {
        id: 'nifty-option-pe',
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
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'upstox',
        createdAt: '2025-01-01T00:00:00Z'
      };

      const result = converter.convertToBrokerFormat(symbol);
      
      expect(result.tradingSymbol).toBe('NFO:NIFTY25JAN21000PE');
      expect(result.exchange).toBe('NFO');
      expect(result.segment).toBe('FO');
    });

    it('should throw error for option without underlying', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Option',
        tradingSymbol: 'TEST25JAN1000CE',
        instrumentType: 'OPTION',
        exchange: 'NSE',
        segment: 'FO',
        strikePrice: 1000,
        optionType: 'CE',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Underlying symbol is required for option conversion');
    });

    it('should throw error for option without strike price', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Option',
        tradingSymbol: 'TEST25JAN1000CE',
        instrumentType: 'OPTION',
        exchange: 'NSE',
        segment: 'FO',
        underlying: 'TEST',
        optionType: 'CE',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Valid strike price is required for option conversion');
    });

    it('should throw error for option with invalid strike price', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Option',
        tradingSymbol: 'TEST25JAN1000CE',
        instrumentType: 'OPTION',
        exchange: 'NSE',
        segment: 'FO',
        underlying: 'TEST',
        strikePrice: -100,
        optionType: 'CE',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Valid strike price is required for option conversion');
    });

    it('should throw error for option without option type', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Option',
        tradingSymbol: 'TEST25JAN1000CE',
        instrumentType: 'OPTION',
        exchange: 'NSE',
        segment: 'FO',
        underlying: 'TEST',
        strikePrice: 1000,
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Valid option type (CE/PE) is required for option conversion');
    });

    it('should throw error for option without expiry date', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Option',
        tradingSymbol: 'TEST25JAN1000CE',
        instrumentType: 'OPTION',
        exchange: 'NSE',
        segment: 'FO',
        underlying: 'TEST',
        strikePrice: 1000,
        optionType: 'CE',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Expiry date is required for option conversion');
    });
  });

  describe('convertToBrokerFormat - Futures', () => {
    it('should convert NSE future symbol correctly', () => {
      const symbol: StandardizedSymbol = {
        id: 'nifty-future',
        displayName: 'NIFTY FUT 30 JAN 25',
        tradingSymbol: 'NIFTY25JANFUT',
        instrumentType: 'FUTURE',
        exchange: 'NSE',
        segment: 'FO',
        underlying: 'NIFTY',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'upstox',
        createdAt: '2025-01-01T00:00:00Z'
      };

      const result = converter.convertToBrokerFormat(symbol);
      
      expect(result.tradingSymbol).toBe('NSE:NIFTY25JANFUT');
      expect(result.exchange).toBe('NSE');
      expect(result.segment).toBe('FO');
    });

    it('should convert MCX future symbol correctly', () => {
      const symbol: StandardizedSymbol = {
        id: 'gold-future',
        displayName: 'GOLD FUT 30 JAN 25',
        tradingSymbol: 'GOLD25JANFUT',
        instrumentType: 'FUTURE',
        exchange: 'MCX',
        segment: 'FO',
        underlying: 'GOLD',
        expiryDate: '2025-01-30',
        lotSize: 100,
        tickSize: 1.0,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'upstox',
        createdAt: '2025-01-01T00:00:00Z'
      };

      const result = converter.convertToBrokerFormat(symbol);
      
      expect(result.tradingSymbol).toBe('MCX:GOLD25JANFUT');
      expect(result.exchange).toBe('MCX');
      expect(result.segment).toBe('FO');
    });

    it('should throw error for future without underlying', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Future',
        tradingSymbol: 'TEST25JANFUT',
        instrumentType: 'FUTURE',
        exchange: 'NSE',
        segment: 'FO',
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Underlying symbol is required for future conversion');
    });

    it('should throw error for future without expiry date', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Future',
        tradingSymbol: 'TEST25JANFUT',
        instrumentType: 'FUTURE',
        exchange: 'NSE',
        segment: 'FO',
        underlying: 'TEST',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Expiry date is required for future conversion');
    });
  });

  describe('convertToBrokerFormat - Error Cases', () => {
    it('should throw error for unsupported exchange', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'UNSUPPORTED' as any,
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Fyers does not support exchange: UNSUPPORTED');
    });

    it('should throw error for unsupported instrument type', () => {
      const symbol: StandardizedSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'UNSUPPORTED' as any,
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-01T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-01T00:00:00Z'
      };

      expect(() => converter.convertToBrokerFormat(symbol))
        .toThrow('Unsupported instrument type: UNSUPPORTED');
    });
  });
});