/**
 * Unit tests for Futures Contract Service
 * Tests contract specifications, rollover logic, and validation utilities
 */

import { FuturesContractService, FUTURES_MONTH_CODES, STANDARD_FUTURES_SPECS } from '../services/futuresContractService';

describe('FuturesContractService', () => {
  describe('Contract Symbol Generation', () => {
    test('should generate correct contract symbol', () => {
      const expiryDate = new Date('2024-01-25'); // January 2024
      const symbol = FuturesContractService.generateContractSymbol('NIFTY', expiryDate);
      
      expect(symbol).toBe('NIFTY24JANFUT');
    });

    test('should handle different months correctly', () => {
      const marchExpiry = new Date('2024-03-28');
      const decemberExpiry = new Date('2024-12-26');
      
      expect(FuturesContractService.generateContractSymbol('BANKNIFTY', marchExpiry))
        .toBe('BANKNIFTY24MARFUT');
      expect(FuturesContractService.generateContractSymbol('FINNIFTY', decemberExpiry))
        .toBe('FINNIFTY24DECFUT');
    });
  });

  describe('Contract Specifications', () => {
    test('should return correct specifications for known underlyings', () => {
      const niftySpecs = FuturesContractService.getContractSpecifications('NIFTY');
      
      expect(niftySpecs).toEqual(STANDARD_FUTURES_SPECS.NIFTY);
      expect(niftySpecs.contractSize).toBe(50);
      expect(niftySpecs.marginPercentage).toBe(0.10);
    });

    test('should return default specifications for unknown underlyings', () => {
      const unknownSpecs = FuturesContractService.getContractSpecifications('UNKNOWN');
      
      expect(unknownSpecs.contractSize).toBe(1);
      expect(unknownSpecs.marginPercentage).toBe(0.20);
      expect(unknownSpecs.settlementType).toBe('cash');
    });

    test('should handle case insensitive underlying names', () => {
      const lowerCaseSpecs = FuturesContractService.getContractSpecifications('nifty');
      const upperCaseSpecs = FuturesContractService.getContractSpecifications('NIFTY');
      
      expect(lowerCaseSpecs).toEqual(upperCaseSpecs);
    });
  });

  describe('Margin Calculations', () => {
    test('should calculate margin requirements correctly', () => {
      const contract = {
        underlying: 'NIFTY',
        lastPrice: 18000
      } as any;
      
      const margins = FuturesContractService.calculateMarginRequirement(contract, 1, 18000);
      
      // NIFTY contract size is 50, margin is 10%
      // Position value = 18000 * 1 * 50 = 900,000
      // Initial margin = 900,000 * 0.10 = 90,000
      // Maintenance margin = 90,000 * 0.75 = 67,500
      expect(margins.initialMargin).toBe(90000);
      expect(margins.maintenanceMargin).toBe(67500);
    });

    test('should handle multiple quantities', () => {
      const contract = {
        underlying: 'BANKNIFTY',
        lastPrice: 40000
      } as any;
      
      const margins = FuturesContractService.calculateMarginRequirement(contract, 2, 40000);
      
      // BANKNIFTY contract size is 25, margin is 12%
      // Position value = 40000 * 2 * 25 = 2,000,000
      // Initial margin = 2,000,000 * 0.12 = 240,000
      expect(margins.initialMargin).toBe(240000);
    });
  });

  describe('Lot Size Validation', () => {
    test('should validate correct lot sizes', () => {
      const result = FuturesContractService.validateLotSize('NIFTY', 50);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should reject invalid lot sizes', () => {
      const result = FuturesContractService.validateLotSize('NIFTY', 75);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('multiples of lot size');
      expect(result.suggestedQuantity).toBe(100); // Nearest multiple of 50
    });

    test('should reject zero or negative quantities', () => {
      const result = FuturesContractService.validateLotSize('NIFTY', 0);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('greater than zero');
    });

    test('should suggest minimum lot size for very small quantities', () => {
      const result = FuturesContractService.validateLotSize('NIFTY', 10);
      
      expect(result.isValid).toBe(false);
      expect(result.suggestedQuantity).toBe(50); // Minimum lot size
    });
  });

  describe('Tick Size Validation', () => {
    test('should validate correct tick sizes', () => {
      // Test with a simple price that's clearly a multiple of 0.05
      const result = FuturesContractService.validateTickSize('NIFTY', 18000.00);
      
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid tick sizes', () => {
      const result = FuturesContractService.validateTickSize('NIFTY', 18000.03);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('multiples of tick size');
      expect(result.suggestedPrice).toBe(18000.05);
    });

    test('should reject zero or negative prices', () => {
      const result = FuturesContractService.validateTickSize('NIFTY', -100);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('greater than zero');
    });
  });

  describe('Expiry Date Calculations', () => {
    test('should generate future expiry dates', () => {
      const expiryDates = FuturesContractService.getNextExpiryDates(3);
      
      expect(expiryDates).toHaveLength(3);
      
      // All dates should be in the future
      const now = new Date();
      expiryDates.forEach(date => {
        expect(date.getTime()).toBeGreaterThan(now.getTime());
      });
      
      // Dates should be in ascending order
      for (let i = 1; i < expiryDates.length; i++) {
        expect(expiryDates[i]!.getTime()).toBeGreaterThan(expiryDates[i-1]!.getTime());
      }
    });

    test('should generate expiry dates on Thursdays', () => {
      const expiryDates = FuturesContractService.getNextExpiryDates(3);
      
      expiryDates.forEach(date => {
        expect(date.getDay()).toBe(4); // Thursday
      });
    });

    test('should set expiry time to market close', () => {
      const expiryDates = FuturesContractService.getNextExpiryDates(1);
      const expiryDate = expiryDates[0];
      
      expect(expiryDate!.getHours()).toBe(15);
      expect(expiryDate!.getMinutes()).toBe(30);
    });
  });

  describe('Rollover Logic', () => {
    test('should identify contracts near expiry', () => {
      const nearExpiryDate = new Date();
      nearExpiryDate.setDate(nearExpiryDate.getDate() + 5);
      
      const isNear = FuturesContractService.isNearExpiry(nearExpiryDate, 7);
      expect(isNear).toBe(true);
      
      const farExpiryDate = new Date();
      farExpiryDate.setDate(farExpiryDate.getDate() + 15);
      
      const isFar = FuturesContractService.isNearExpiry(farExpiryDate, 7);
      expect(isFar).toBe(false);
    });

    test('should calculate rollover dates correctly', () => {
      const expiryDate = new Date('2024-01-25'); // Thursday
      const rolloverDate = FuturesContractService.getRolloverDate(expiryDate, 3);
      
      // Should be 3 days before expiry
      const expectedDate = new Date('2024-01-22'); // Monday
      expect(rolloverDate.toDateString()).toBe(expectedDate.toDateString());
    });

    test('should adjust rollover date for weekends', () => {
      // Create a Sunday expiry date (which would be unusual but let's test the logic)
      const expiryDate = new Date('2024-01-28'); // This is actually a Sunday
      
      const rolloverDate = FuturesContractService.getRolloverDate(expiryDate, 3);
      
      // Should not be on weekend
      expect(rolloverDate.getDay()).not.toBe(0); // Not Sunday
      expect(rolloverDate.getDay()).not.toBe(6); // Not Saturday
    });

    test('should recommend rollover for expired contracts', () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 1);
      
      const contract = {
        expiryDate: expiredDate
      } as any;
      
      const rolloverCheck = FuturesContractService.shouldRollover(contract);
      
      expect(rolloverCheck.shouldRollover).toBe(true);
      expect(rolloverCheck.reason).toContain('expired');
    });

    test('should recommend rollover for contracts near expiry', () => {
      const nearExpiryDate = new Date();
      nearExpiryDate.setDate(nearExpiryDate.getDate() + 2);
      
      const contract = {
        expiryDate: nearExpiryDate
      } as any;
      
      const rolloverCheck = FuturesContractService.shouldRollover(contract);
      
      expect(rolloverCheck.shouldRollover).toBe(true);
      expect(rolloverCheck.reason).toContain('near expiry');
    });
  });

  describe('Contract Creation', () => {
    test('should create complete futures contract', () => {
      const expiryDate = new Date('2024-01-25');
      const contract = FuturesContractService.createFuturesContract('NIFTY', expiryDate, 18000);
      
      expect(contract.symbol).toBe('NIFTY24JANFUT');
      expect(contract.underlying).toBe('NIFTY');
      expect(contract.expiryDate).toEqual(expiryDate);
      expect(contract.lastPrice).toBe(18000);
      expect(contract.lotSize).toBe(50);
      expect(contract.tickSize).toBe(0.05);
      expect(contract.contractValue).toBe(900000); // 18000 * 50
      expect(contract.rolloverDate).toBeDefined();
    });

    test('should create futures chain', () => {
      const contracts = [
        FuturesContractService.createFuturesContract('NIFTY', new Date('2024-02-29'), 18000),
        FuturesContractService.createFuturesContract('NIFTY', new Date('2024-01-25'), 18050),
        FuturesContractService.createFuturesContract('NIFTY', new Date('2024-03-28'), 17950)
      ];
      
      const chain = FuturesContractService.createFuturesChain('NIFTY', contracts);
      
      expect(chain.underlying).toBe('NIFTY');
      expect(chain.contracts).toHaveLength(3);
      expect(chain.nearMonthContract.symbol).toBe('NIFTY24JANFUT'); // Earliest expiry
      expect(chain.specifications).toEqual(STANDARD_FUTURES_SPECS.NIFTY);
    });
  });

  describe('P&L Calculations', () => {
    test('should calculate P&L for long positions', () => {
      const pnl = FuturesContractService.calculatePnL(18000, 18100, 1, 50, 'long');
      
      // Price increased by 100, quantity 1, multiplier 50
      // P&L = 100 * 1 * 50 = 5000
      expect(pnl).toBe(5000);
    });

    test('should calculate P&L for short positions', () => {
      const pnl = FuturesContractService.calculatePnL(18000, 18100, 1, 50, 'short');
      
      // Price increased by 100, but short position loses money
      // P&L = -(100 * 1 * 50) = -5000
      expect(pnl).toBe(-5000);
    });

    test('should handle negative price movements', () => {
      const longPnL = FuturesContractService.calculatePnL(18000, 17900, 1, 50, 'long');
      const shortPnL = FuturesContractService.calculatePnL(18000, 17900, 1, 50, 'short');
      
      // Price decreased by 100
      expect(longPnL).toBe(-5000); // Long loses money
      expect(shortPnL).toBe(5000);  // Short makes money
    });
  });

  describe('Contract Value Calculations', () => {
    test('should calculate contract value correctly', () => {
      const contract = {
        lastPrice: 18000,
        multiplier: 50
      } as any;
      
      const value = FuturesContractService.calculateContractValue(contract, 2);
      
      // 18000 * 2 * 50 = 1,800,000
      expect(value).toBe(1800000);
    });

    test('should use custom price when provided', () => {
      const contract = {
        lastPrice: 18000,
        multiplier: 50
      } as any;
      
      const value = FuturesContractService.calculateContractValue(contract, 1, 18500);
      
      // 18500 * 1 * 50 = 925,000
      expect(value).toBe(925000);
    });
  });
});