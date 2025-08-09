import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  SymbolCategorizer, 
  RawSymbolData, 
  CategorizationResult 
} from '../utils/symbolCategorization';

describe('SymbolCategorizer', () => {
  describe('detectInstrumentType', () => {
    it('should detect equity from explicit instrument type', () => {
      const rawData: RawSymbolData = {
        symbol: 'RELIANCE',
        instrumentType: 'EQ',
        exchange: 'NSE',
        segment: 'EQ'
      };

      const result = SymbolCategorizer.detectInstrumentType(rawData);
      
      expect(result.instrumentType).toBe('EQUITY');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect option from explicit instrument type', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY25DEC22000CE',
        instrumentType: 'OPT',
        exchange: 'NFO',
        underlying: 'NIFTY',
        strike: 22000,
        optionType: 'CE',
        expiry: '2025-12-30'
      };

      const result = SymbolCategorizer.detectInstrumentType(rawData);
      
      expect(result.instrumentType).toBe('OPTION');
      expect(result.underlying).toBe('NIFTY');
      expect(result.strikePrice).toBe(22000);
      expect(result.optionType).toBe('CE');
      expect(result.expiryDate).toBe('2025-12-30');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect future from explicit instrument type', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY25DECFUT',
        instrumentType: 'FUT',
        exchange: 'NFO',
        underlying: 'NIFTY',
        expiry: '2025-12-30'
      };

      const result = SymbolCategorizer.detectInstrumentType(rawData);
      
      expect(result.instrumentType).toBe('FUTURE');
      expect(result.underlying).toBe('NIFTY');
      expect(result.expiryDate).toBe('2025-12-30');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should detect option from symbol pattern', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY25DEC22000CE',
        exchange: 'NFO'
      };

      const result = SymbolCategorizer.detectInstrumentType(rawData);
      
      expect(result.instrumentType).toBe('OPTION');
      expect(result.underlying).toBe('NIFTY');
      expect(result.strikePrice).toBe(22000);
      expect(result.optionType).toBe('CE');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.warnings).toContain('Instrument type detected from symbol pattern');
    });

    it('should detect future from symbol pattern', () => {
      const rawData: RawSymbolData = {
        symbol: 'BANKNIFTY25DECFUT',
        exchange: 'NFO'
      };

      const result = SymbolCategorizer.detectInstrumentType(rawData);
      
      expect(result.instrumentType).toBe('FUTURE');
      expect(result.underlying).toBe('BANKNIFTY');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.warnings).toContain('Instrument type detected from symbol pattern');
    });

    it('should default to equity when no clear pattern', () => {
      const rawData: RawSymbolData = {
        symbol: 'RELIANCE-EQ',
        exchange: 'NSE'
      };

      const result = SymbolCategorizer.detectInstrumentType(rawData);
      
      expect(result.instrumentType).toBe('EQUITY');
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.warnings).toContain('Defaulted to EQUITY - no clear pattern detected');
    });
  });

  describe('extractUnderlyingSymbol', () => {
    it('should extract from explicit underlying field', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY25DEC22000CE',
        underlying: 'nifty'
      };

      const underlying = SymbolCategorizer.extractUnderlyingSymbol(rawData);
      expect(underlying).toBe('NIFTY');
    });

    it('should extract from option symbol pattern', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY25DEC22000CE'
      };

      const underlying = SymbolCategorizer.extractUnderlyingSymbol(rawData);
      expect(underlying).toBe('NIFTY');
    });

    it('should extract from future symbol pattern', () => {
      const rawData: RawSymbolData = {
        symbol: 'BANKNIFTY25DECFUT'
      };

      const underlying = SymbolCategorizer.extractUnderlyingSymbol(rawData);
      expect(underlying).toBe('BANKNIFTY');
    });

    it('should extract from complex symbol patterns', () => {
      const testCases = [
        { symbol: 'RELIANCE25MAR2800CE', expected: 'RELIANCE' },
        { symbol: 'TATAMOTORS25APR500PE', expected: 'TATAMOTORS' },
        { symbol: 'CRUDEOIL25JANFUT', expected: 'CRUDEOIL' }
      ];

      testCases.forEach(({ symbol, expected }) => {
        const result = SymbolCategorizer.extractUnderlyingSymbol({ symbol });
        expect(result).toBe(expected);
      });
    });

    it('should handle symbols with hyphens', () => {
      const rawData: RawSymbolData = {
        symbol: 'RELIANCE-EQ'
      };

      const underlying = SymbolCategorizer.extractUnderlyingSymbol(rawData);
      expect(underlying).toBe('RELIANCE');
    });
  });

  describe('extractStrikePrice', () => {
    it('should extract from explicit strike field', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY25DEC22000CE',
        strike: 22000
      };

      const strike = SymbolCategorizer.extractStrikePrice(rawData);
      expect(strike).toBe(22000);
    });

    it('should extract from symbol pattern', () => {
      const testCases = [
        { symbol: 'NIFTY25DEC22000CE', expected: 22000 },
        { symbol: 'BANKNIFTY25FEB45000PE', expected: 45000 },
        { symbol: 'RELIANCE25MAR2800CE', expected: 2800 },
        { symbol: 'TATAMOTORS25APR500PE', expected: 500 }
      ];

      testCases.forEach(({ symbol, expected }) => {
        const result = SymbolCategorizer.extractStrikePrice({ symbol });
        expect(result).toBe(expected);
      });
    });

    it('should return undefined for non-option symbols', () => {
      const rawData: RawSymbolData = {
        symbol: 'RELIANCE'
      };

      const strike = SymbolCategorizer.extractStrikePrice(rawData);
      expect(strike).toBeUndefined();
    });
  });

  describe('extractOptionType', () => {
    it('should extract from explicit optionType field', () => {
      const testCases = [
        { optionType: 'CE', expected: 'CE' },
        { optionType: 'CALL', expected: 'CE' },
        { optionType: 'PE', expected: 'PE' },
        { optionType: 'PUT', expected: 'PE' }
      ];

      testCases.forEach(({ optionType, expected }) => {
        const result = SymbolCategorizer.extractOptionType({ 
          symbol: 'TEST', 
          optionType 
        });
        expect(result).toBe(expected);
      });
    });

    it('should extract from symbol pattern', () => {
      const testCases = [
        { symbol: 'NIFTY25DEC22000CE', expected: 'CE' },
        { symbol: 'BANKNIFTY25FEB45000PE', expected: 'PE' },
        { symbol: 'RELIANCE25MAR2800CE', expected: 'CE' },
        { symbol: 'TATAMOTORS25APR500PE', expected: 'PE' }
      ];

      testCases.forEach(({ symbol, expected }) => {
        const result = SymbolCategorizer.extractOptionType({ symbol });
        expect(result).toBe(expected);
      });
    });

    it('should return undefined for non-option symbols', () => {
      const rawData: RawSymbolData = {
        symbol: 'RELIANCE-EQ'
      };

      const optionType = SymbolCategorizer.extractOptionType(rawData);
      expect(optionType).toBeUndefined();
    });
  });

  describe('extractExpiryDate', () => {
    it('should extract from explicit expiry field', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY25DEC22000CE',
        expiry: '2025-12-30'
      };

      const expiry = SymbolCategorizer.extractExpiryDate(rawData);
      expect(expiry).toBe('2025-12-30');
    });

    it('should extract from symbol pattern with 2-digit year', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY25DEC22000CE'
      };

      const expiry = SymbolCategorizer.extractExpiryDate(rawData);
      expect(expiry).toMatch(/^2025-12-\d{2}$/);
    });

    it('should extract from symbol pattern with 4-digit year', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY2025DEC22000CE'
      };

      const expiry = SymbolCategorizer.extractExpiryDate(rawData);
      expect(expiry).toMatch(/^2025-12-\d{2}$/);
    });

    it('should handle different month patterns', () => {
      const testCases = [
        { symbol: 'NIFTY25JAN22000CE', expectedMonth: '01' },
        { symbol: 'NIFTY25FEB22000CE', expectedMonth: '02' },
        { symbol: 'NIFTY25MAR22000CE', expectedMonth: '03' },
        { symbol: 'NIFTY25DEC22000CE', expectedMonth: '12' }
      ];

      testCases.forEach(({ symbol, expectedMonth }) => {
        const result = SymbolCategorizer.extractExpiryDate({ symbol });
        expect(result).toMatch(new RegExp(`^2025-${expectedMonth}-\\d{2}$`));
      });
    });

    it('should return undefined for symbols without expiry', () => {
      const rawData: RawSymbolData = {
        symbol: 'RELIANCE'
      };

      const expiry = SymbolCategorizer.extractExpiryDate(rawData);
      expect(expiry).toBeUndefined();
    });
  });

  describe('parseExpiryDate', () => {
    it('should parse year-month format', () => {
      const testCases = [
        { input: '2025JAN', expected: /^2025-01-\d{2}$/ },
        { input: '25DEC', expected: /^2025-12-\d{2}$/ },
        { input: '2024FEB', expected: /^2024-02-\d{2}$/ }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = SymbolCategorizer.parseExpiryDate(input);
        expect(result).toMatch(expected);
      });
    });

    it('should parse ISO format', () => {
      const result = SymbolCategorizer.parseExpiryDate('2025-12-30');
      expect(result).toBe('2025-12-30');
    });

    it('should parse DD-MM-YYYY format', () => {
      const result = SymbolCategorizer.parseExpiryDate('30-12-2025');
      expect(result).toBe('2025-12-30');
    });

    it('should parse MM/DD/YYYY format', () => {
      const result = SymbolCategorizer.parseExpiryDate('12/30/2025');
      expect(result).toBe('2025-12-30');
    });

    it('should return undefined for invalid formats', () => {
      const testCases = ['invalid', '2025', 'JAN', ''];
      
      testCases.forEach(input => {
        const result = SymbolCategorizer.parseExpiryDate(input);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('toStandardizedSymbol', () => {
    it('should convert equity symbol correctly', () => {
      const rawData: RawSymbolData = {
        symbol: 'RELIANCE',
        instrumentType: 'EQ',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isin: 'INE002A01018'
      };

      const categorization: CategorizationResult = {
        instrumentType: 'EQUITY',
        confidence: 0.9,
        warnings: []
      };

      const result = SymbolCategorizer.toStandardizedSymbol(rawData, categorization, 'test');

      expect(result.tradingSymbol).toBe('RELIANCE');
      expect(result.instrumentType).toBe('EQUITY');
      expect(result.exchange).toBe('NSE');
      expect(result.segment).toBe('EQ');
      expect(result.lotSize).toBe(1);
      expect(result.tickSize).toBe(0.05);
      expect(result.source).toBe('test');
      expect(result.isin).toBe('INE002A01018');
      expect(result.displayName).toBe('RELIANCE');
    });

    it('should convert option symbol correctly', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY25DEC22000CE',
        instrumentType: 'OPT',
        exchange: 'NFO',
        segment: 'FO',
        lotSize: 25,
        tickSize: 0.05
      };

      const categorization: CategorizationResult = {
        instrumentType: 'OPTION',
        underlying: 'NIFTY',
        strikePrice: 22000,
        optionType: 'CE',
        expiryDate: '2025-12-30',
        confidence: 0.9,
        warnings: []
      };

      const result = SymbolCategorizer.toStandardizedSymbol(rawData, categorization, 'test');

      expect(result.tradingSymbol).toBe('NIFTY25DEC22000CE');
      expect(result.instrumentType).toBe('OPTION');
      expect(result.exchange).toBe('NFO');
      expect(result.underlying).toBe('NIFTY');
      expect(result.strikePrice).toBe(22000);
      expect(result.optionType).toBe('CE');
      expect(result.expiryDate).toBe('2025-12-30');
      expect(result.displayName).toBe('NIFTY 22000 CE 30 DEC 25');
    });

    it('should convert future symbol correctly', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTY25DECFUT',
        instrumentType: 'FUT',
        exchange: 'NFO',
        segment: 'FO',
        lotSize: 25,
        tickSize: 0.05
      };

      const categorization: CategorizationResult = {
        instrumentType: 'FUTURE',
        underlying: 'NIFTY',
        expiryDate: '2025-12-30',
        confidence: 0.9,
        warnings: []
      };

      const result = SymbolCategorizer.toStandardizedSymbol(rawData, categorization, 'test');

      expect(result.tradingSymbol).toBe('NIFTY25DECFUT');
      expect(result.instrumentType).toBe('FUTURE');
      expect(result.exchange).toBe('NFO');
      expect(result.underlying).toBe('NIFTY');
      expect(result.expiryDate).toBe('2025-12-30');
      expect(result.displayName).toBe('NIFTY 30 DEC 25 FUT');
    });

    it('should apply defaults for missing fields', () => {
      const rawData: RawSymbolData = {
        symbol: 'TEST'
      };

      const categorization: CategorizationResult = {
        instrumentType: 'EQUITY',
        confidence: 0.7,
        warnings: []
      };

      const result = SymbolCategorizer.toStandardizedSymbol(rawData, categorization);

      expect(result.exchange).toBe('NSE');
      expect(result.segment).toBe('EQ');
      expect(result.lotSize).toBe(1);
      expect(result.tickSize).toBe(0.05);
      expect(result.source).toBe('auto-categorized');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty symbol', () => {
      const rawData: RawSymbolData = {
        symbol: ''
      };

      const result = SymbolCategorizer.detectInstrumentType(rawData);
      expect(result.instrumentType).toBe('EQUITY');
      expect(result.confidence).toBeLessThan(0.8);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle malformed option symbols', () => {
      const rawData: RawSymbolData = {
        symbol: 'NIFTYINVALIDPATTERN'
      };

      const result = SymbolCategorizer.detectInstrumentType(rawData);
      expect(result.instrumentType).toBe('EQUITY');
      expect(result.warnings).toContain('Defaulted to EQUITY - no clear pattern detected');
    });

    it('should handle missing required option fields', () => {
      const rawData: RawSymbolData = {
        symbol: 'INVALIDOPTIONSYMBOL',
        instrumentType: 'OPT'
      };

      const result = SymbolCategorizer.detectInstrumentType(rawData);
      expect(result.instrumentType).toBe('OPTION');
      expect(result.confidence).toBeLessThan(0.9);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should handle inconsistent data', () => {
      const rawData: RawSymbolData = {
        symbol: 'RELIANCE',
        instrumentType: 'OPT', // Inconsistent with symbol
        strike: 2800,
        optionType: 'CE'
      };

      const result = SymbolCategorizer.detectInstrumentType(rawData);
      expect(result.instrumentType).toBe('OPTION');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThan(0.9);
    });
  });
});