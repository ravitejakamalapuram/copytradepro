/**
 * Simple symbol validation tests
 * Basic tests to verify symbol validation functionality
 */

import { describe, it, expect } from '@jest/globals';
import { symbolValidationService } from '../services/symbolValidationService';

describe('Symbol Validation Service - Simple Tests', () => {
  describe('Symbol ID Detection', () => {
    it('should detect MongoDB ObjectId format', () => {
      const service = symbolValidationService as any;
      
      // Valid ObjectId
      expect(service.isStandardizedSymbolId('507f1f77bcf86cd799439011')).toBe(true);
      
      // Invalid formats
      expect(service.isStandardizedSymbolId('RELIANCE')).toBe(false);
      expect(service.isStandardizedSymbolId('507f1f77bcf86cd79943901')).toBe(false); // Too short
      expect(service.isStandardizedSymbolId('507f1f77bcf86cd799439011x')).toBe(false); // Too long
      expect(service.isStandardizedSymbolId('507f1f77bcf86cd79943901g')).toBe(false); // Invalid hex
    });
  });

  describe('Broker Exchange Support', () => {
    it('should return supported exchanges for known brokers', () => {
      const service = symbolValidationService as any;
      
      const fyersExchanges = service.getBrokerSupportedExchanges('fyers');
      expect(fyersExchanges).toContain('NSE');
      expect(fyersExchanges).toContain('BSE');
      expect(fyersExchanges).toContain('NFO');
      
      const shoonyaExchanges = service.getBrokerSupportedExchanges('shoonya');
      expect(shoonyaExchanges).toContain('NSE');
      expect(shoonyaExchanges).toContain('BSE');
      
      const unknownExchanges = service.getBrokerSupportedExchanges('unknown');
      expect(unknownExchanges).toEqual(['NSE', 'BSE']);
    });
  });

  describe('Order Parameter Validation', () => {
    it('should validate lot size constraints', () => {
      const mockSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY' as const,
        exchange: 'NSE' as const,
        segment: 'EQ',
        lotSize: 10,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-30T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-30T00:00:00Z'
      };

      // Valid quantity (multiple of lot size)
      const validResult = symbolValidationService.validateOrderParameters(mockSymbol, {
        quantity: 20, // 2 lots
        orderType: 'MARKET'
      });
      expect(validResult.isValid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid quantity (not multiple of lot size)
      const invalidResult = symbolValidationService.validateOrderParameters(mockSymbol, {
        quantity: 15, // 1.5 lots
        orderType: 'MARKET'
      });
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Quantity must be in multiples of lot size 10');
    });

    it('should validate tick size constraints for limit orders', () => {
      const mockSymbol = {
        id: 'test',
        displayName: 'Test Symbol',
        tradingSymbol: 'TEST',
        instrumentType: 'EQUITY' as const,
        exchange: 'NSE' as const,
        segment: 'EQ',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-30T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-30T00:00:00Z'
      };

      // Valid price (multiple of tick size)
      const validResult = symbolValidationService.validateOrderParameters(mockSymbol, {
        quantity: 10,
        price: 100.05,
        orderType: 'LIMIT'
      });
      expect(validResult.isValid).toBe(true);

      // Invalid price (not multiple of tick size)
      const invalidResult = symbolValidationService.validateOrderParameters(mockSymbol, {
        quantity: 10,
        price: 100.03,
        orderType: 'LIMIT'
      });
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors).toContain('Price must be in multiples of tick size 0.05');
    });

    it('should validate expiry dates', () => {
      const expiredSymbol = {
        id: 'test',
        displayName: 'Expired Option',
        tradingSymbol: 'EXPIRED',
        instrumentType: 'OPTION' as const,
        exchange: 'NSE' as const,
        segment: 'FO',
        underlying: 'NIFTY',
        strikePrice: 22000,
        optionType: 'CE' as const,
        expiryDate: '2024-12-31', // Past date
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-30T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-30T00:00:00Z'
      };

      const result = symbolValidationService.validateOrderParameters(expiredSymbol, {
        quantity: 50,
        orderType: 'MARKET'
      });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Symbol has expired on 2024-12-31');
    });
  });

  describe('Symbol Display Information', () => {
    it('should generate display info for equity symbols', () => {
      const equitySymbol = {
        id: 'test',
        displayName: 'RELIANCE',
        tradingSymbol: 'RELIANCE',
        instrumentType: 'EQUITY' as const,
        exchange: 'NSE' as const,
        segment: 'EQ',
        companyName: 'Reliance Industries Limited',
        sector: 'Energy',
        lotSize: 1,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-30T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-30T00:00:00Z'
      };

      const displayInfo = symbolValidationService.getSymbolDisplayInfo(equitySymbol);
      
      expect(displayInfo.displayName).toBe('RELIANCE');
      expect(displayInfo.description).toContain('EQUITY on NSE');
      expect(displayInfo.description).toContain('Reliance Industries Limited');
      expect(displayInfo.tags).toContain('EQUITY');
      expect(displayInfo.tags).toContain('NSE');
      expect(displayInfo.tags).toContain('Energy');
    });

    it('should generate display info for option symbols', () => {
      const optionSymbol = {
        id: 'test',
        displayName: 'NIFTY 22000 CE 30 JAN 25',
        tradingSymbol: 'NIFTY25JAN22000CE',
        instrumentType: 'OPTION' as const,
        exchange: 'NSE' as const,
        segment: 'FO',
        underlying: 'NIFTY',
        strikePrice: 22000,
        optionType: 'CE' as const,
        expiryDate: '2025-01-30',
        lotSize: 50,
        tickSize: 0.05,
        isActive: true,
        lastUpdated: '2025-01-30T00:00:00Z',
        source: 'test',
        createdAt: '2025-01-30T00:00:00Z'
      };

      const displayInfo = symbolValidationService.getSymbolDisplayInfo(optionSymbol);
      
      expect(displayInfo.displayName).toBe('NIFTY 22000 CE 30 JAN 25');
      expect(displayInfo.description).toContain('OPTION on NSE');
      expect(displayInfo.description).toContain('Strike: 22000');
      expect(displayInfo.description).toContain('Type: CE');
      expect(displayInfo.description).toContain('Expiry: 2025-01-30');
      expect(displayInfo.tags).toContain('OPTION');
      expect(displayInfo.tags).toContain('NSE');
      expect(displayInfo.tags).toContain('Underlying: NIFTY');
    });
  });
});