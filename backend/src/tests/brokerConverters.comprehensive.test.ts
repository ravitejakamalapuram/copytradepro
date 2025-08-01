/**
 * Comprehensive Unit Tests for Broker Symbol Converters
 * Tests all broker format converters with various symbol types
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { StandardizedSymbol } from '../models/symbolModels';
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

  beforeEach(() => {
    // Clear converters before each test
    BrokerSymbolConverterFactory.clearConverters();
  });

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
        expect(result.exchange).toBe('NSE');
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
        const result = converter.convertToBrokerFormat(mockOptionSymbol);
        expect(result.tradingSymbol).toBe('NFO:NIFTY25JAN22000CE');
        expect(result.exchange).toBe('NFO');
      });
    });

    describe('Future Symbol Conversion', () => {
      it('should convert NIFTY future correctly', () => {
        const result = converter.convertToBrokerFormat(mockFutureSymbol);
        expect(result.tradingSymbol).toBe('NFO:NIFTY25JANFUT');
        expect(result.exchange).toBe('NFO');
      });
    });

    describe('Validation', () => {
      it('should validate supported exchanges', () => {
        expect(converter.canConvert(mockEquitySymbol)).toBe(true);
        expect(converter.canConvert(mockOptionSymbol)).toBe(true);
        expect(converter.canConvert(mockFutureSymbol)).toBe(true);
      });

      it('should reject unsupported exchanges', () => {
        const unsupportedSymbol = {
          ...mockEquitySymbol,
          exchange: 'UNKNOWN' as any
        };
        expect(converter.canConvert(unsupportedSymbol)).toBe(false);
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
        expect(result.tradingSymbol).toBe('TCS');
        expect(result.exchange).toBe('NSE');
      });
    });

    describe('Option Symbol Conversion', () => {
      it('should convert NFO option correctly', () => {
        const result = converter.convertToBrokerFormat(mockOptionSymbol);
        expect(result.tradingSymbol).toBe('NIFTY25JAN22000CE');
        expect(result.exchange).toBe('NFO');
      });
    });

    describe('Future Symbol Conversion', () => {
      it('should convert NFO future correctly', () => {
        const result = converter.convertToBrokerFormat(mockFutureSymbol);
        expect(result.tradingSymbol).toBe('NIFTY25JANFUT');
        expect(result.exchange).toBe('NFO');
      });
    });

    describe('Validation', () => {
      it('should validate supported exchanges', () => {
        expect(converter.canConvert(mockEquitySymbol)).toBe(true);
        expect(converter.canConvert(mockOptionSymbol)).toBe(true);
        expect(converter.canConvert(mockFutureSymbol)).toBe(true);
      });

      it('should reject unsupported exchanges', () => {
        const unsupportedSymbol = {
          ...mockEquitySymbol,
          exchange: 'UNKNOWN' as any
        };
        expect(converter.canConvert(unsupportedSymbol)).toBe(false);
      });
    });
  });

  describe('Cross-Broker Compatibility', () => {
    it('should handle same symbol across different brokers', () => {
      const fyersConverter = new FyersSymbolConverter();
      const shoonyaConverter = new ShoonyaSymbolConverter();

      const fyersResult = fyersConverter.convertToBrokerFormat(mockEquitySymbol);
      const shoonyaResult = shoonyaConverter.convertToBrokerFormat(mockEquitySymbol);

      expect(fyersResult.tradingSymbol).toBe('NSE:TCS-EQ');
      expect(shoonyaResult.tradingSymbol).toBe('TCS');
      expect(shoonyaResult.exchange).toBe('NSE');
    });
  });

  describe('Performance Tests', () => {
    it('should convert symbols quickly', () => {
      const fyersConverter = new FyersSymbolConverter();
      const shoonyaConverter = new ShoonyaSymbolConverter();
      
      const symbols = [mockEquitySymbol, mockOptionSymbol, mockFutureSymbol];

      const startTime = Date.now();
      
      // Convert 1000 symbols
      for (let i = 0; i < 1000; i++) {
        const symbol = symbols[i % symbols.length];
        fyersConverter.convertToBrokerFormat(symbol);
        shoonyaConverter.convertToBrokerFormat(symbol);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 100ms for 2000 conversions
      expect(duration).toBeLessThan(100);
    });
  });
});