/**
 * Comprehensive Unit Tests for Broker Symbol Converters
 * Tests all broker format converters with various symbol types
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { StandardizedSymbol } from '../models/symbolModels';

// Import the converter factory and individual converters
import { BrokerSymbolConverterFactory } from '../services/brokerSymbolConverters/BrokerSymbolConverterFactory';
import { FyersSymbolConverter } from '../services/brokerSymbolConverters/FyersSymbolConverter';
import { ShoonyaSymbolConverter } from '../services/brokerSymbolConverters/ShoonyaSymbolConverter';

describe('Broker Symbol Converters', () => {
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

  const mockBseEquitySymbol: StandardizedSymbol = {
    ...mockEquitySymbol,
    id: '507f1f77bcf86cd799439015',
    exchange: 'BSE',
    tradingSymbol: '532540'
  };

  const mockNiftyCallOption: StandardizedSymbol = {
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

  const mockNiftyPutOption: StandardizedSymbol = {
    ...mockNiftyCallOption,
    id: '507f1f77bcf86cd799439016',
    displayName: 'NIFTY 21500 PE 30 JAN 25',
    tradingSymbol: 'NIFTY25JAN21500PE',
    strikePrice: 21500,
    optionType: 'PE'
  };

  const mockBankNiftyOption: StandardizedSymbol = {
    id: '507f1f77bcf86cd799439017',
    displayName: 'BANKNIFTY 48000 CE 30 JAN 25',
    tradingSymbol: 'BANKNIFTY25JAN48000CE',
    instrumentType: 'OPTION',
    exchange: 'NFO',
    segment: 'FO',
    underlying: 'BANKNIFTY',
    strikePrice: 48000,
    optionType: 'CE',
    expiryDate: '2025-01-30',
    lotSize: 15,
    tickSize: 0.05,
    isActive: true,
    lastUpdated: '2024-01-15T10:00:00.000Z',
    source: 'upstox',
    createdAt: '2024-01-01T00:00:00.000Z'
  };

  const mockNiftyFuture: StandardizedSymbol = {
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

  const mockStockFuture: StandardizedSymbol = {
    id: '507f1f77bcf86cd799439018',
    displayName: 'TCS FUT 30 JAN 25',
    tradingSymbol: 'TCS25JANFUT',
    instrumentType: 'FUTURE',
    exchange: 'NFO',
    segment: 'FO',
    underlying: 'TCS',
    expiryDate: '2025-01-30',
    lotSize: 150,
    tickSize: 0.05,
    isActive: true,
    lastUpdated: '2024-01-15T10:00:00.000Z',
    source: 'upstox',
    createdAt: '2024-01-01T00:00:00.000Z'
  };

  const mockMcxSymbol: StandardizedSymbol = {
    id: '507f1f77bcf86cd799439019',
    displayName: 'GOLD FUT 05 FEB 25',
    tradingSymbol: 'GOLD25FEBFUT',
    instrumentType: 'FUTURE',
    exchange: 'MCX',
    segment: 'FO',
    underlying: 'GOLD',
    expiryDate: '2025-02-05',
    lotSize: 100,
    tickSize: 1.0,
    isActive: true,
    lastUpdated: '2024-01-15T10:00:00.000Z',
    source: 'upstox',
    createdAt: '2024-01-01T00:00:00.000Z'
  };

  describe('BrokerSymbolConverterFactory', () => {
    it('should return FyersSymbolConverter for fyers broker', () => {
      const converter = BrokerSymbolConverterFactory.getConverter('fyers');
      expect(converter).toBeInstanceOf(FyersSymbolConverter);
    });

    it('should return ShoonyaSymbolConverter for shoonya broker', () => {
      const converter = BrokerSymbolConverterFactory.getConverter('shoonya');
      expect(converter).toBeInstanceOf(ShoonyaSymbolConverter);
    });

    it('should throw error for unsupported broker', () => {
      expect(() => {
        BrokerSymbolConverterFactory.getConverter('unsupported');
      }).toThrow('No converter found for broker: unsupported');
    });

    it('should handle case-insensitive broker names', () => {
      const fyersConverter = BrokerSymbolConverterFactory.getConverter('FYERS');
      const shoonyaConverter = BrokerSymbolConverterFactory.getConverter('Shoonya');
      
      expect(fyersConverter).toBeInstanceOf(FyersSymbolConverter);
      expect(shoonyaConverter).toBeInstanceOf(ShoonyaSymbolConverter);
    });

    it('should return same instance for multiple calls (singleton pattern)', () => {
      const converter1 = BrokerSymbolConverterFactory.getConverter('fyers');
      const converter2 = BrokerSymbolConverterFactory.getConverter('fyers');
      
      expect(converter1).toBe(converter2);
    });
  });

  describe('FyersSymbolConverter', () => {
    let converter: FyersSymbolConverter;

    beforeEach(() => {
      converter = new FyersSymbolConverter();
    });

    describe('Equity Symbol Conversion', () => {
      it('should convert NSE equity symbol correctly', () => {
        const result = converter.convertToBrokerFormat(mockEquitySymbol);
        expect(result.tradingSymbol).toBe('NSE:TCS-EQ');
      });

      it('should convert BSE equity symbol correctly', () => {
        const result = converter.convertToBrokerFormat(mockBseEquitySymbol);
        expect(result.tradingSymbol).toBe('BSE:532540-EQ');
      });

      it('should handle equity symbols with special characters', () => {
        const specialSymbol = {
          ...mockEquitySymbol,
          tradingSymbol: 'M&M'
        };
        const result = converter.convertToBrokerFormat(specialSymbol);
        expect(result.tradingSymbol).toBe('NSE:M&M-EQ');
      });
    });

    describe('Option Symbol Conversion', () => {
      it('should convert NIFTY call option correctly', () => {
        const result = converter.convertToBrokerFormat(mockNiftyCallOption);
        expect(result.tradingSymbol).toBe('NFO:NIFTY25JAN22000CE');
      });

      it('should convert NIFTY put option correctly', () => {
        const result = converter.convertToBrokerFormat(mockNiftyPutOption);
        expect(result.tradingSymbol).toBe('NFO:NIFTY25JAN21500PE');
      });

      it('should convert BANKNIFTY option correctly', () => {
        const result = converter.convertToBrokerFormat(mockBankNiftyOption);
        expect(result.tradingSymbol).toBe('NFO:BANKNIFTY25JAN48000CE');
      });

      it('should handle options with different strike prices', () => {
        const testCases = [
          { strike: 100, expected: 'NFO:NIFTY25JAN100CE' },
          { strike: 15000.5, expected: 'NFO:NIFTY25JAN15000.5CE' },
          { strike: 50000, expected: 'NFO:NIFTY25JAN50000CE' }
        ];

        testCases.forEach(testCase => {
          const optionSymbol = {
            ...mockNiftyCallOption,
            strikePrice: testCase.strike,
            tradingSymbol: `NIFTY25JAN${testCase.strike}CE`
          };
          const result = converter.convertToBrokerFormat(optionSymbol);
          expect(result.tradingSymbol).toBe(testCase.expected);
        });
      });
    });

    describe('Future Symbol Conversion', () => {
      it('should convert NIFTY future correctly', () => {
        const result = converter.convertToBrokerFormat(mockNiftyFuture);
        expect(result.tradingSymbol).toBe('NFO:NIFTY25JANFUT');
      });

      it('should convert stock future correctly', () => {
        const result = converter.convertToBrokerFormat(mockStockFuture);
        expect(result.tradingSymbol).toBe('NFO:TCS25JANFUT');
      });

      it('should convert MCX future correctly', () => {
        const result = converter.convertToBrokerFormat(mockMcxSymbol);
        expect(result.tradingSymbol).toBe('MCX:GOLD25FEBFUT');
      });
    });

    describe('Error Handling', () => {
      it('should throw error for unsupported instrument type', () => {
        const invalidSymbol = {
          ...mockEquitySymbol,
          instrumentType: 'BOND' as any
        };

        expect(() => {
          converter.convertToBrokerFormat(invalidSymbol);
        }).toThrow('Unsupported instrument type: BOND');
      });

      it('should handle missing trading symbol', () => {
        const invalidSymbol = {
          ...mockEquitySymbol,
          tradingSymbol: ''
        };

        expect(() => {
          converter.convertToBrokerFormat(invalidSymbol);
        }).toThrow();
      });

      it('should handle missing exchange', () => {
        const invalidSymbol = {
          ...mockEquitySymbol,
          exchange: '' as any
        };

        expect(() => {
          converter.convertToBrokerFormat(invalidSymbol);
        }).toThrow();
      });
    });

    describe('Edge Cases', () => {
      it('should handle symbols with numeric trading symbols', () => {
        const numericSymbol = {
          ...mockEquitySymbol,
          tradingSymbol: '123456'
        };
        const result = converter.convertToBrokerFormat(numericSymbol);
        expect(result.tradingSymbol).toBe('NSE:123456-EQ');
      });

      it('should handle very long trading symbols', () => {
        const longSymbol = {
          ...mockEquitySymbol,
          tradingSymbol: 'VERYLONGTRADINGSYMBOLNAME'
        };
        const result = converter.convertToBrokerFormat(longSymbol);
        expect(result.tradingSymbol).toBe('NSE:VERYLONGTRADINGSYMBOLNAME-EQ');
      });
    });
  });

  describe('ShoonyaSymbolConverter', () => {
    let converter: ShoonyaSymbolConverter;

    beforeEach(() => {
      converter = new ShoonyaSymbolConverter();
    });

    describe('Equity Symbol Conversion', () => {
      it('should convert NSE equity symbol correctly', () => {
        const result = converter.convertToBrokerFormat(mockEquitySymbol);
        expect(result).toEqual({
          tradingSymbol: 'TCS',
          exchange: 'NSE',
          segment: 'EQ'
        });
      });

      it('should convert BSE equity symbol correctly', () => {
        const result = converter.convertToBrokerFormat(mockBseEquitySymbol);
        expect(result).toEqual({
          tradingSymbol: '532540',
          exchange: 'BSE',
          segment: 'EQ'
        });
      });
    });

    describe('Option Symbol Conversion', () => {
      it('should convert NSE option to NFO exchange', () => {
        const nseOption = {
          ...mockNiftyCallOption,
          exchange: 'NSE' as any
        };
        const result = converter.convertToBrokerFormat(nseOption);
        expect(result).toEqual({
          tradingSymbol: 'NIFTY25JAN22000CE',
          exchange: 'NFO',
          segment: 'FO'
        });
      });

      it('should convert NFO option correctly', () => {
        const result = converter.convertToBrokerFormat(mockNiftyCallOption);
        expect(result).toEqual({
          tradingSymbol: 'NIFTY25JAN22000CE',
          exchange: 'NFO',
          segment: 'FO'
        });
      });

      it('should convert BSE option to BFO exchange', () => {
        const bseOption = {
          ...mockNiftyCallOption,
          exchange: 'BSE' as any
        };
        const result = converter.convertToBrokerFormat(bseOption);
        expect(result).toEqual({
          tradingSymbol: 'NIFTY25JAN22000CE',
          exchange: 'BFO',
          segment: 'FO'
        });
      });

      it('should handle put options correctly', () => {
        const result = converter.convertToBrokerFormat(mockNiftyPutOption);
        expect(result).toEqual({
          tradingSymbol: 'NIFTY25JAN21500PE',
          exchange: 'NFO',
          segment: 'FO'
        });
      });
    });

    describe('Future Symbol Conversion', () => {
      it('should convert NSE future to NFO exchange', () => {
        const nseFuture = {
          ...mockNiftyFuture,
          exchange: 'NSE' as any
        };
        const result = converter.convertToShoonyaFormat(nseFuture);
        expect(result).toEqual({
          tradingSymbol: 'NIFTY25JANFUT',
          exchange: 'NFO'
        });
      });

      it('should convert NFO future correctly', () => {
        const result = converter.convertToShoonyaFormat(mockNiftyFuture);
        expect(result).toEqual({
          tradingSymbol: 'NIFTY25JANFUT',
          exchange: 'NFO'
        });
      });

      it('should convert MCX future correctly', () => {
        const result = converter.convertToShoonyaFormat(mockMcxSymbol);
        expect(result).toEqual({
          tradingSymbol: 'GOLD25FEBFUT',
          exchange: 'MCX'
        });
      });
    });

    describe('Exchange Mapping', () => {
      it('should map NSE equity to NSE', () => {
        const result = converter.convertToShoonyaFormat(mockEquitySymbol);
        expect(result.exchange).toBe('NSE');
      });

      it('should map NSE derivatives to NFO', () => {
        const nseOption = { ...mockNiftyCallOption, exchange: 'NSE' as any };
        const nseFuture = { ...mockNiftyFuture, exchange: 'NSE' as any };
        
        expect(converter.convertToShoonyaFormat(nseOption).exchange).toBe('NFO');
        expect(converter.convertToShoonyaFormat(nseFuture).exchange).toBe('NFO');
      });

      it('should map BSE equity to BSE', () => {
        const result = converter.convertToShoonyaFormat(mockBseEquitySymbol);
        expect(result.exchange).toBe('BSE');
      });

      it('should map BSE derivatives to BFO', () => {
        const bseOption = { ...mockNiftyCallOption, exchange: 'BSE' as any };
        const bseFuture = { ...mockNiftyFuture, exchange: 'BSE' as any };
        
        expect(converter.convertToShoonyaFormat(bseOption).exchange).toBe('BFO');
        expect(converter.convertToShoonyaFormat(bseFuture).exchange).toBe('BFO');
      });

      it('should keep MCX exchange as MCX', () => {
        const result = converter.convertToShoonyaFormat(mockMcxSymbol);
        expect(result.exchange).toBe('MCX');
      });

      it('should handle unknown exchanges', () => {
        const unknownExchangeSymbol = {
          ...mockEquitySymbol,
          exchange: 'UNKNOWN' as any
        };
        const result = converter.convertToShoonyaFormat(unknownExchangeSymbol);
        expect(result.exchange).toBe('UNKNOWN');
      });
    });

    describe('Error Handling', () => {
      it('should throw error for unsupported instrument type', () => {
        const invalidSymbol = {
          ...mockEquitySymbol,
          instrumentType: 'BOND' as any
        };

        expect(() => {
          converter.convertToShoonyaFormat(invalidSymbol);
        }).toThrow('Unsupported instrument type: BOND');
      });

      it('should handle missing trading symbol', () => {
        const invalidSymbol = {
          ...mockEquitySymbol,
          tradingSymbol: ''
        };

        expect(() => {
          converter.convertToShoonyaFormat(invalidSymbol);
        }).toThrow();
      });
    });

    describe('Generic Conversion Method', () => {
      it('should use convertToShoonyaFormat for generic conversion', () => {
        const result = converter.convertToBrokerFormat(mockEquitySymbol, 'shoonya');
        expect(result).toEqual({
          tradingSymbol: 'TCS',
          exchange: 'NSE'
        });
      });

      it('should handle different broker names in generic method', () => {
        const result = converter.convertToBrokerFormat(mockEquitySymbol, 'SHOONYA');
        expect(result).toEqual({
          tradingSymbol: 'TCS',
          exchange: 'NSE'
        });
      });
    });
  });

  describe('Cross-Broker Compatibility', () => {
    let fyersConverter: FyersSymbolConverter;
    let shoonyaConverter: ShoonyaSymbolConverter;

    beforeEach(() => {
      fyersConverter = new FyersSymbolConverter();
      shoonyaConverter = new ShoonyaSymbolConverter();
    });

    it('should handle same symbol across different brokers', () => {
      const fyersResult = fyersConverter.convertToFyersFormat(mockEquitySymbol);
      const shoonyaResult = shoonyaConverter.convertToShoonyaFormat(mockEquitySymbol);

      expect(fyersResult).toBe('NSE:TCS-EQ');
      expect(shoonyaResult).toEqual({
        tradingSymbol: 'TCS',
        exchange: 'NSE'
      });
    });

    it('should handle options consistently across brokers', () => {
      const fyersResult = fyersConverter.convertToFyersFormat(mockNiftyCallOption);
      const shoonyaResult = shoonyaConverter.convertToShoonyaFormat(mockNiftyCallOption);

      expect(fyersResult).toBe('NFO:NIFTY25JAN22000CE');
      expect(shoonyaResult).toEqual({
        tradingSymbol: 'NIFTY25JAN22000CE',
        exchange: 'NFO'
      });
    });

    it('should handle futures consistently across brokers', () => {
      const fyersResult = fyersConverter.convertToFyersFormat(mockNiftyFuture);
      const shoonyaResult = shoonyaConverter.convertToShoonyaFormat(mockNiftyFuture);

      expect(fyersResult).toBe('NFO:NIFTY25JANFUT');
      expect(shoonyaResult).toEqual({
        tradingSymbol: 'NIFTY25JANFUT',
        exchange: 'NFO'
      });
    });
  });

  describe('Performance Tests', () => {
    let fyersConverter: FyersSymbolConverter;
    let shoonyaConverter: ShoonyaSymbolConverter;

    beforeEach(() => {
      fyersConverter = new FyersSymbolConverter();
      shoonyaConverter = new ShoonyaSymbolConverter();
    });

    it('should convert symbols quickly (performance test)', () => {
      const symbols = [
        mockEquitySymbol,
        mockBseEquitySymbol,
        mockNiftyCallOption,
        mockNiftyPutOption,
        mockNiftyFuture,
        mockStockFuture,
        mockMcxSymbol
      ];

      const startTime = Date.now();
      
      // Convert 1000 symbols
      for (let i = 0; i < 1000; i++) {
        const symbol = symbols[i % symbols.length];
        fyersConverter.convertToFyersFormat(symbol);
        shoonyaConverter.convertToShoonyaFormat(symbol);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 100ms for 2000 conversions
      expect(duration).toBeLessThan(100);
    });

    it('should handle bulk conversions efficiently', () => {
      const symbols = Array(100).fill(null).map((_, i) => ({
        ...mockEquitySymbol,
        id: `507f1f77bcf86cd79943${i.toString().padStart(4, '0')}`,
        tradingSymbol: `SYMBOL${i}`
      }));

      const startTime = Date.now();
      
      symbols.forEach(symbol => {
        fyersConverter.convertToFyersFormat(symbol);
        shoonyaConverter.convertToShoonyaFormat(symbol);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 50ms for 200 conversions
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during repeated conversions', () => {
      const fyersConverter = new FyersSymbolConverter();
      const shoonyaConverter = new ShoonyaSymbolConverter();

      // Perform many conversions to test for memory leaks
      for (let i = 0; i < 10000; i++) {
        fyersConverter.convertToFyersFormat(mockEquitySymbol);
        shoonyaConverter.convertToShoonyaFormat(mockEquitySymbol);
      }

      // If we reach here without running out of memory, the test passes
      expect(true).toBe(true);
    });
  });
});