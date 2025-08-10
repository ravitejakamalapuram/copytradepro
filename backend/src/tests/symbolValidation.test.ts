import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  SymbolValidator, 
  SymbolIdGenerator, 
  SymbolUtils, 
  ValidationError 
} from '../utils/symbolValidation';
import { CreateStandardizedSymbolData } from '../models/symbolModels';

describe('SymbolIdGenerator', () => {
  describe('generateId', () => {
    it('should generate correct ID for equity symbol', () => {
      const symbol: CreateStandardizedSymbolData = {
        displayName: 'Reliance Industries Ltd',
        tradingSymbol: 'RELIANCE',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox',
        companyName: 'Reliance Industries Ltd',
        sector: 'Energy'
      };

      const id = SymbolIdGenerator.generateId(symbol);
      expect(id).toBe('NSE_EQUITY_RELIANCE');
    });

    it('should generate correct ID for option symbol', () => {
      const symbol: CreateStandardizedSymbolData = {
        displayName: 'NIFTY 22000 CE 30 JAN 25',
        tradingSymbol: 'NIFTY25JAN22000CE',
        instrumentType: 'OPTION',
        exchange: 'NFO',
        segment: 'FO',
        underlying: 'NIFTY',
        strikePrice: 22000,
        optionType: 'CE',
        expiryDate: '2025-01-30',
        lotSize: 25,
        tickSize: 0.05,
        source: 'upstox'
      };

      const id = SymbolIdGenerator.generateId(symbol);
      expect(id).toBe('NFO_OPTION_NIFTY25JAN22000CE_20250130_22000_CE');
    });

    it('should generate correct ID for future symbol', () => {
      const symbol: CreateStandardizedSymbolData = {
        displayName: 'NIFTY 30 JAN 25 FUT',
        tradingSymbol: 'NIFTY25JANFUT',
        instrumentType: 'FUTURE',
        exchange: 'NFO',
        segment: 'FO',
        underlying: 'NIFTY',
        expiryDate: '2025-01-30',
        lotSize: 25,
        tickSize: 0.05,
        source: 'upstox'
      };

      const id = SymbolIdGenerator.generateId(symbol);
      expect(id).toBe('NFO_FUTURE_NIFTY25JANFUT_20250130');
    });
  });

  describe('generateDisplayId', () => {
    it('should generate display ID for equity', () => {
      const symbol: CreateStandardizedSymbolData = {
        displayName: 'Reliance Industries Ltd',
        tradingSymbol: 'RELIANCE',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox',
        companyName: 'Reliance Industries Ltd'
      };

      const displayId = SymbolIdGenerator.generateDisplayId(symbol);
      expect(displayId).toBe('NSE:RELIANCE');
    });

    it('should generate display ID for option', () => {
      const symbol: CreateStandardizedSymbolData = {
        displayName: 'NIFTY 22000 CE 30 JAN 25',
        tradingSymbol: 'NIFTY25JAN22000CE',
        instrumentType: 'OPTION',
        exchange: 'NFO',
        segment: 'FO',
        underlying: 'NIFTY',
        strikePrice: 22000,
        optionType: 'CE',
        expiryDate: '2025-01-30',
        lotSize: 25,
        tickSize: 0.05,
        source: 'upstox'
      };

      const displayId = SymbolIdGenerator.generateDisplayId(symbol);
      expect(displayId).toBe('NIFTY 22000 CE 30 JAN 25');
    });

    it('should generate display ID for future', () => {
      const symbol: CreateStandardizedSymbolData = {
        displayName: 'NIFTY 30 JAN 25 FUT',
        tradingSymbol: 'NIFTY25JANFUT',
        instrumentType: 'FUTURE',
        exchange: 'NFO',
        segment: 'FO',
        underlying: 'NIFTY',
        expiryDate: '2025-01-30',
        lotSize: 25,
        tickSize: 0.05,
        source: 'upstox'
      };

      const displayId = SymbolIdGenerator.generateDisplayId(symbol);
      expect(displayId).toBe('NIFTY 30 JAN 25 FUT');
    });
  });
});

describe('SymbolValidator', () => {
  let validEquitySymbol: CreateStandardizedSymbolData;
  let validOptionSymbol: CreateStandardizedSymbolData;
  let validFutureSymbol: CreateStandardizedSymbolData;

  beforeEach(() => {
    validEquitySymbol = {
      displayName: 'Reliance Industries Ltd',
      tradingSymbol: 'RELIANCE',
      instrumentType: 'EQUITY',
      exchange: 'NSE',
      segment: 'EQ',
      lotSize: 1,
      tickSize: 0.05,
      source: 'upstox',
      companyName: 'Reliance Industries Ltd',
      sector: 'Energy'
    };

    validOptionSymbol = {
      displayName: 'NIFTY 22000 CE 30 DEC 25',
      tradingSymbol: 'NIFTY25DEC22000CE',
      instrumentType: 'OPTION',
      exchange: 'NFO',
      segment: 'FO',
      underlying: 'NIFTY',
      strikePrice: 22000,
      optionType: 'CE',
      expiryDate: '2025-12-30',
      lotSize: 25,
      tickSize: 0.05,
      source: 'upstox'
    };

    validFutureSymbol = {
      displayName: 'NIFTY 30 DEC 25 FUT',
      tradingSymbol: 'NIFTY25DECFUT',
      instrumentType: 'FUTURE',
      exchange: 'NFO',
      segment: 'FO',
      underlying: 'NIFTY',
      expiryDate: '2025-12-30',
      lotSize: 25,
      tickSize: 0.05,
      source: 'upstox'
    };
  });

  describe('validate equity symbols', () => {
    it('should validate a correct equity symbol', () => {
      const result = SymbolValidator.validate(validEquitySymbol);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject equity with missing display name', () => {
      const symbol = { ...validEquitySymbol, displayName: '' };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'displayName',
        message: 'Display name is required',
        value: ''
      });
    });

    it('should reject equity with invalid trading symbol', () => {
      const symbol = { ...validEquitySymbol, tradingSymbol: 'reliance-123!' };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'tradingSymbol')).toBe(true);
    });

    it('should reject equity with derivative fields', () => {
      const symbol = { 
        ...validEquitySymbol, 
        underlying: 'NIFTY',
        strikePrice: 22000,
        optionType: 'CE' as const,
        expiryDate: '2025-01-30'
      };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'underlying')).toBe(true);
      expect(result.errors.some(e => e.field === 'strikePrice')).toBe(true);
      expect(result.errors.some(e => e.field === 'optionType')).toBe(true);
      expect(result.errors.some(e => e.field === 'expiryDate')).toBe(true);
    });

    it('should reject equity without company name', () => {
      const symbol = { ...validEquitySymbol };
      delete symbol.companyName;
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'companyName',
        message: 'Company name is required for equity symbols',
        value: undefined
      });
    });

    it('should reject equity with invalid exchange', () => {
      const symbol = { ...validEquitySymbol, exchange: 'INVALID' as any };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'exchange')).toBe(true);
    });

    it('should reject equity with invalid lot size', () => {
      const symbol = { ...validEquitySymbol, lotSize: -1 };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'lotSize',
        message: 'Lot size must be a positive number',
        value: -1
      });
    });

    it('should validate ISIN format', () => {
      const symbolWithValidIsin = { ...validEquitySymbol, isin: 'INE002A01018' };
      const result1 = SymbolValidator.validate(symbolWithValidIsin);
      expect(result1.isValid).toBe(true);

      const symbolWithInvalidIsin = { ...validEquitySymbol, isin: 'INVALID' };
      const result2 = SymbolValidator.validate(symbolWithInvalidIsin);
      expect(result2.isValid).toBe(false);
      expect(result2.errors.some(e => e.field === 'isin')).toBe(true);
    });
  });

  describe('validate option symbols', () => {
    it('should validate a correct option symbol', () => {
      const result = SymbolValidator.validate(validOptionSymbol);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject option without underlying', () => {
      const symbol = { ...validOptionSymbol };
      delete symbol.underlying;
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'underlying',
        message: 'Underlying symbol is required for options',
        value: undefined
      });
    });

    it('should reject option without strike price', () => {
      const symbol = { ...validOptionSymbol };
      delete symbol.strikePrice;
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'strikePrice',
        message: 'Strike price is required for options',
        value: undefined
      });
    });

    it('should reject option with invalid strike price', () => {
      const symbol = { ...validOptionSymbol, strikePrice: -100 };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'strikePrice',
        message: 'Strike price must be a positive number',
        value: -100
      });
    });

    it('should reject option without option type', () => {
      const symbol = { ...validOptionSymbol };
      delete symbol.optionType;
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'optionType',
        message: 'Option type must be CE or PE',
        value: undefined
      });
    });

    it('should reject option with invalid option type', () => {
      const symbol = { ...validOptionSymbol, optionType: 'INVALID' as any };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'optionType',
        message: 'Option type must be CE or PE',
        value: 'INVALID'
      });
    });

    it('should reject option without expiry date', () => {
      const symbol = { ...validOptionSymbol };
      delete symbol.expiryDate;
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'expiryDate',
        message: 'Expiry date is required for options',
        value: undefined
      });
    });

    it('should reject option with invalid expiry date format', () => {
      const symbol = { ...validOptionSymbol, expiryDate: '30-01-2025' };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'expiryDate',
        message: 'Expiry date must be in ISO format (YYYY-MM-DD)',
        value: '30-01-2025'
      });
    });

    it('should reject option with past expiry date', () => {
      const symbol = { ...validOptionSymbol, expiryDate: '2020-01-30' };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'expiryDate',
        message: 'Expiry date cannot be more than a year in the past',
        value: '2020-01-30'
      });
    });

    it('should reject option with equity-specific fields', () => {
      const symbol = { 
        ...validOptionSymbol, 
        companyName: 'Some Company',
        sector: 'Technology'
      };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'companyName')).toBe(true);
      expect(result.errors.some(e => e.field === 'sector')).toBe(true);
    });
  });

  describe('validate future symbols', () => {
    it('should validate a correct future symbol', () => {
      const result = SymbolValidator.validate(validFutureSymbol);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject future without underlying', () => {
      const symbol = { ...validFutureSymbol };
      delete symbol.underlying;
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'underlying',
        message: 'Underlying symbol is required for futures',
        value: undefined
      });
    });

    it('should reject future without expiry date', () => {
      const symbol = { ...validFutureSymbol };
      delete symbol.expiryDate;
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContainEqual({
        field: 'expiryDate',
        message: 'Expiry date is required for futures',
        value: undefined
      });
    });

    it('should reject future with option-specific fields', () => {
      const symbol = { 
        ...validFutureSymbol, 
        strikePrice: 22000,
        optionType: 'CE' as const
      };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'strikePrice')).toBe(true);
      expect(result.errors.some(e => e.field === 'optionType')).toBe(true);
    });

    it('should reject future with equity-specific fields', () => {
      const symbol = { 
        ...validFutureSymbol, 
        companyName: 'Some Company',
        sector: 'Technology'
      };
      const result = SymbolValidator.validate(symbol);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'companyName')).toBe(true);
      expect(result.errors.some(e => e.field === 'sector')).toBe(true);
    });
  });

  describe('validateBatch', () => {
    it('should validate multiple symbols and return correct summary', () => {
      const symbols = [
        validEquitySymbol,
        validOptionSymbol,
        { ...validFutureSymbol, underlying: '' }, // Invalid future
        { ...validEquitySymbol, displayName: '' } // Invalid equity
      ];

      const result = SymbolValidator.validateBatch(symbols);
      
      expect(result.summary.total).toBe(4);
      expect(result.summary.valid).toBe(2);
      expect(result.summary.invalid).toBe(2);
      expect(result.validSymbols).toHaveLength(2);
      expect(result.invalidSymbols).toHaveLength(2);
    });
  });
});

describe('SymbolUtils', () => {
  let equitySymbol: CreateStandardizedSymbolData;
  let optionSymbol: CreateStandardizedSymbolData;
  let futureSymbol: CreateStandardizedSymbolData;

  beforeEach(() => {
    equitySymbol = {
      displayName: 'Reliance Industries Ltd',
      tradingSymbol: 'RELIANCE',
      instrumentType: 'EQUITY',
      exchange: 'NSE',
      segment: 'EQ',
      lotSize: 1,
      tickSize: 0.05,
      source: 'upstox',
      companyName: 'Reliance Industries Ltd'
    };

    optionSymbol = {
      displayName: 'NIFTY 22000 CE 30 JAN 25',
      tradingSymbol: 'NIFTY25JAN22000CE',
      instrumentType: 'OPTION',
      exchange: 'NFO',
      segment: 'FO',
      underlying: 'NIFTY',
      strikePrice: 22000,
      optionType: 'CE',
      expiryDate: '2025-01-30',
      lotSize: 25,
      tickSize: 0.05,
      source: 'upstox'
    };

    futureSymbol = {
      displayName: 'NIFTY 30 JAN 25 FUT',
      tradingSymbol: 'NIFTY25JANFUT',
      instrumentType: 'FUTURE',
      exchange: 'NFO',
      segment: 'FO',
      underlying: 'NIFTY',
      expiryDate: '2025-01-30',
      lotSize: 25,
      tickSize: 0.05,
      source: 'upstox'
    };
  });

  describe('type checking methods', () => {
    it('should correctly identify equity symbols', () => {
      expect(SymbolUtils.isEquity(equitySymbol)).toBe(true);
      expect(SymbolUtils.isEquity(optionSymbol)).toBe(false);
      expect(SymbolUtils.isEquity(futureSymbol)).toBe(false);
    });

    it('should correctly identify option symbols', () => {
      expect(SymbolUtils.isOption(equitySymbol)).toBe(false);
      expect(SymbolUtils.isOption(optionSymbol)).toBe(true);
      expect(SymbolUtils.isOption(futureSymbol)).toBe(false);
    });

    it('should correctly identify future symbols', () => {
      expect(SymbolUtils.isFuture(equitySymbol)).toBe(false);
      expect(SymbolUtils.isFuture(optionSymbol)).toBe(false);
      expect(SymbolUtils.isFuture(futureSymbol)).toBe(true);
    });

    it('should correctly identify derivative symbols', () => {
      expect(SymbolUtils.isDerivative(equitySymbol)).toBe(false);
      expect(SymbolUtils.isDerivative(optionSymbol)).toBe(true);
      expect(SymbolUtils.isDerivative(futureSymbol)).toBe(true);
    });

    it('should correctly identify call and put options', () => {
      expect(SymbolUtils.isCallOption(optionSymbol)).toBe(true);
      expect(SymbolUtils.isPutOption(optionSymbol)).toBe(false);

      const putOption = { ...optionSymbol, optionType: 'PE' as const };
      expect(SymbolUtils.isCallOption(putOption)).toBe(false);
      expect(SymbolUtils.isPutOption(putOption)).toBe(true);

      expect(SymbolUtils.isCallOption(equitySymbol)).toBe(false);
      expect(SymbolUtils.isPutOption(equitySymbol)).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should get base symbol correctly', () => {
      expect(SymbolUtils.getBaseSymbol(equitySymbol)).toBe('RELIANCE');
      expect(SymbolUtils.getBaseSymbol(optionSymbol)).toBe('NIFTY');
      expect(SymbolUtils.getBaseSymbol(futureSymbol)).toBe('NIFTY');
    });

    it('should format expiry date correctly', () => {
      const formatted = SymbolUtils.formatExpiryDate('2025-01-30');
      expect(formatted).toBe('30 JAN 25');
    });

    it('should get type description correctly', () => {
      expect(SymbolUtils.getTypeDescription(equitySymbol)).toBe('Equity');
      expect(SymbolUtils.getTypeDescription(optionSymbol)).toBe('Call Option');
      
      const putOption = { ...optionSymbol, optionType: 'PE' as const };
      expect(SymbolUtils.getTypeDescription(putOption)).toBe('Put Option');
      
      expect(SymbolUtils.getTypeDescription(futureSymbol)).toBe('Future');
    });
  });
});