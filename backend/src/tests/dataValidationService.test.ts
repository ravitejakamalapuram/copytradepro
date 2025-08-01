import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataValidationService, ValidationRule } from '../services/dataValidationService';
import { CreateStandardizedSymbolData } from '../models/symbolModels';

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('DataValidationService', () => {
  let service: DataValidationService;

  beforeEach(() => {
    service = new DataValidationService();
  });

  describe('Validation Rules Management', () => {
    it('should initialize with default validation rules', () => {
      const rules = service.getValidationRules();
      expect(rules.length).toBeGreaterThan(0);
      
      // Check for some key rules
      const ruleNames = rules.map(r => r.name);
      expect(ruleNames).toContain('required_display_name');
      expect(ruleNames).toContain('required_trading_symbol');
      expect(ruleNames).toContain('required_instrument_type');
      expect(ruleNames).toContain('option_underlying_required');
    });

    it('should add custom validation rule', () => {
      const customRule: ValidationRule = {
        name: 'custom_test_rule',
        description: 'Test rule',
        severity: 'WARNING',
        validate: (symbol) => {
          if (symbol.tradingSymbol === 'TEST') {
            return [{
              rule: 'custom_test_rule',
              severity: 'WARNING',
              message: 'Test symbol detected',
              field: 'tradingSymbol',
              value: symbol.tradingSymbol
            }];
          }
          return [];
        }
      };

      service.addValidationRule(customRule);
      const rules = service.getValidationRules();
      expect(rules.find(r => r.name === 'custom_test_rule')).toBeDefined();
    });

    it('should remove validation rule', () => {
      const customRule: ValidationRule = {
        name: 'removable_rule',
        description: 'Rule to be removed',
        severity: 'INFO',
        validate: () => []
      };

      service.addValidationRule(customRule);
      expect(service.getValidationRules().find(r => r.name === 'removable_rule')).toBeDefined();

      const removed = service.removeValidationRule('removable_rule');
      expect(removed).toBe(true);
      expect(service.getValidationRules().find(r => r.name === 'removable_rule')).toBeUndefined();
    });
  });

  describe('Equity Symbol Validation', () => {
    it('should validate valid equity symbol', async () => {
      const symbol: CreateStandardizedSymbolData = {
        displayName: 'Reliance Industries Limited',
        tradingSymbol: 'RELIANCE',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox',
        isin: 'INE002A01018',
        companyName: 'Reliance Industries Limited',
        sector: 'Energy'
      };

      const result = await service.validateSymbols([symbol]);

      expect(result.isValid).toBe(true);
      expect(result.validSymbols).toHaveLength(1);
      expect(result.invalidSymbols).toHaveLength(0);
      expect(result.qualityMetrics.qualityScore).toBeGreaterThan(90);
    });

    it('should detect missing required fields in equity symbol', async () => {
      const symbol: CreateStandardizedSymbolData = {
        displayName: '',
        tradingSymbol: '',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: '',
        lotSize: 0,
        tickSize: 0,
        source: ''
      };

      const result = await service.validateSymbols([symbol]);

      expect(result.isValid).toBe(false);
      expect(result.invalidSymbols).toHaveLength(1);
      expect(result.allIssues.length).toBeGreaterThan(0);
      
      const issueRules = result.allIssues.map(issue => issue.rule);
      expect(issueRules).toContain('required_display_name');
      expect(issueRules).toContain('required_trading_symbol');
      expect(issueRules).toContain('required_segment');
      expect(issueRules).toContain('positive_lot_size');
      expect(issueRules).toContain('positive_tick_size');
      expect(issueRules).toContain('required_source');
    });
  });

  describe('Option Symbol Validation', () => {
    it('should validate valid option symbol', async () => {
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
        lotSize: 50,
        tickSize: 0.05,
        source: 'upstox'
      };

      const result = await service.validateSymbols([symbol]);

      expect(result.isValid).toBe(true);
      expect(result.validSymbols).toHaveLength(1);
      expect(result.invalidSymbols).toHaveLength(0);
    });

    it('should detect missing option-specific fields', async () => {
      const symbol: CreateStandardizedSymbolData = {
        displayName: 'Invalid Option',
        tradingSymbol: 'INVALID_OPTION',
        instrumentType: 'OPTION',
        exchange: 'NFO',
        segment: 'FO',
        lotSize: 50,
        tickSize: 0.05,
        source: 'upstox'
        // Missing: underlying, strikePrice, optionType, expiryDate
      };

      const result = await service.validateSymbols([symbol]);

      expect(result.isValid).toBe(false);
      expect(result.invalidSymbols).toHaveLength(1);
      
      const issueRules = result.allIssues.map(issue => issue.rule);
      expect(issueRules).toContain('option_underlying_required');
      expect(issueRules).toContain('option_strike_price_required');
      expect(issueRules).toContain('option_type_required');
      expect(issueRules).toContain('option_expiry_required');
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate symbols', async () => {
      const symbol1: CreateStandardizedSymbolData = {
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox'
      };

      const symbol2: CreateStandardizedSymbolData = {
        ...symbol1,
        displayName: 'Test Symbol Duplicate' // Different display name but same key
      };

      const result = await service.validateSymbols([symbol1, symbol2]);

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0]?.count).toBe(2);
      expect(result.duplicates[0]?.symbols).toHaveLength(2);
      expect(result.qualityMetrics.duplicateSymbols).toBe(1);
    });

    it('should not detect duplicates for different symbols', async () => {
      const symbol1: CreateStandardizedSymbolData = {
        displayName: 'Test Symbol 1',
        tradingSymbol: 'TEST1',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox'
      };

      const symbol2: CreateStandardizedSymbolData = {
        displayName: 'Test Symbol 2',
        tradingSymbol: 'TEST2',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox'
      };

      const result = await service.validateSymbols([symbol1, symbol2]);

      expect(result.duplicates).toHaveLength(0);
      expect(result.qualityMetrics.duplicateSymbols).toBe(0);
    });
  });

  describe('Quality Metrics', () => {
    it('should calculate quality score correctly', async () => {
      const validSymbol: CreateStandardizedSymbolData = {
        displayName: 'Valid Symbol',
        tradingSymbol: 'VALID',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        source: 'upstox'
      };

      const invalidSymbol: CreateStandardizedSymbolData = {
        displayName: '',
        tradingSymbol: '',
        instrumentType: 'EQUITY',
        exchange: 'NSE',
        segment: 'EQ',
        lotSize: 0,
        tickSize: 0,
        source: ''
      };

      const result = await service.validateSymbols([validSymbol, invalidSymbol]);

      expect(result.qualityMetrics.totalSymbols).toBe(2);
      expect(result.qualityMetrics.validSymbols).toBe(1);
      expect(result.qualityMetrics.invalidSymbols).toBe(1);
      expect(result.qualityMetrics.qualityScore).toBeLessThan(100);
      expect(result.qualityMetrics.qualityScore).toBeGreaterThan(0);
    });
  });

  describe('Service Statistics', () => {
    it('should return service statistics', () => {
      const stats = service.getStats();

      expect(stats.service).toBe('Data Validation Service');
      expect(stats.validationRules).toBeGreaterThan(0);
      expect(stats.availableRules).toBeInstanceOf(Array);
      expect(stats.rulesBySeverity).toBeDefined();
      expect(stats.rulesBySeverity.ERROR).toBeGreaterThan(0);
      expect(stats.rulesBySeverity.WARNING).toBeGreaterThan(0);
    });
  });
});