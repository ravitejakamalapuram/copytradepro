/**
 * Futures Contract Service
 * Handles futures contract specifications, rollover logic, and validation
 */

import { FuturesContract, FuturesChain, FuturesSpecification } from '@copytrade/shared-types';

/**
 * Futures contract month codes for Indian markets
 */
export const FUTURES_MONTH_CODES = {
  1: 'JAN', 2: 'FEB', 3: 'MAR', 4: 'APR', 5: 'MAY', 6: 'JUN',
  7: 'JUL', 8: 'AUG', 9: 'SEP', 10: 'OCT', 11: 'NOV', 12: 'DEC'
} as const;

/**
 * Standard futures contract specifications for Indian markets
 */
export const STANDARD_FUTURES_SPECS: Record<string, FuturesSpecification> = {
  'NIFTY': {
    contractSize: 50,
    tickValue: 0.05,
    tradingHours: { start: '09:15', end: '15:30' },
    settlementType: 'cash',
    marginPercentage: 0.10 // 10%
  },
  'BANKNIFTY': {
    contractSize: 25,
    tickValue: 0.05,
    tradingHours: { start: '09:15', end: '15:30' },
    settlementType: 'cash',
    marginPercentage: 0.12 // 12%
  },
  'FINNIFTY': {
    contractSize: 40,
    tickValue: 0.05,
    tradingHours: { start: '09:15', end: '15:30' },
    settlementType: 'cash',
    marginPercentage: 0.12 // 12%
  },
  'MIDCPNIFTY': {
    contractSize: 75,
    tickValue: 0.05,
    tradingHours: { start: '09:15', end: '15:30' },
    settlementType: 'cash',
    marginPercentage: 0.15 // 15%
  }
};

/**
 * Futures contract service for managing contract specifications and rollover logic
 */
export class FuturesContractService {
  
  /**
   * Generate futures contract symbol based on underlying and expiry
   */
  public static generateContractSymbol(
    underlying: string,
    expiryDate: Date
  ): string {
    const year = expiryDate.getFullYear().toString().slice(-2);
    const month = FUTURES_MONTH_CODES[expiryDate.getMonth() + 1 as keyof typeof FUTURES_MONTH_CODES];
    
    return `${underlying}${year}${month}FUT`;
  }

  /**
   * Get contract specifications for an underlying asset
   */
  public static getContractSpecifications(underlying: string): FuturesSpecification {
    const specs = STANDARD_FUTURES_SPECS[underlying.toUpperCase()];
    
    if (!specs) {
      // Default specifications for unknown underlyings
      return {
        contractSize: 1,
        tickValue: 0.05,
        tradingHours: { start: '09:15', end: '15:30' },
        settlementType: 'cash',
        marginPercentage: 0.20 // 20% for unknown contracts
      };
    }
    
    return specs;
  }

  /**
   * Calculate margin requirement for a futures position
   */
  public static calculateMarginRequirement(
    contract: FuturesContract,
    quantity: number,
    price: number
  ): { initialMargin: number; maintenanceMargin: number } {
    const specs = this.getContractSpecifications(contract.underlying);
    const positionValue = price * quantity * specs.contractSize;
    
    const initialMargin = positionValue * specs.marginPercentage;
    const maintenanceMargin = initialMargin * 0.75; // 75% of initial margin
    
    return {
      initialMargin: Math.round(initialMargin * 100) / 100,
      maintenanceMargin: Math.round(maintenanceMargin * 100) / 100
    };
  }

  /**
   * Validate lot size for futures trading
   */
  public static validateLotSize(
    underlying: string,
    quantity: number
  ): { isValid: boolean; error?: string; suggestedQuantity?: number } {
    const specs = this.getContractSpecifications(underlying);
    const lotSize = specs.contractSize;
    
    if (quantity <= 0) {
      return {
        isValid: false,
        error: 'Quantity must be greater than zero'
      };
    }
    
    if (quantity % lotSize !== 0) {
      const suggestedQuantity = Math.round(quantity / lotSize) * lotSize;
      return {
        isValid: false,
        error: `Quantity must be in multiples of lot size (${lotSize})`,
        suggestedQuantity: suggestedQuantity > 0 ? suggestedQuantity : lotSize
      };
    }
    
    return { isValid: true };
  }

  /**
   * Validate tick size for price
   */
  public static validateTickSize(
    underlying: string,
    price: number
  ): { isValid: boolean; error?: string; suggestedPrice?: number } {
    const specs = this.getContractSpecifications(underlying);
    const tickSize = specs.tickValue;
    
    if (price <= 0) {
      return {
        isValid: false,
        error: 'Price must be greater than zero'
      };
    }
    
    // Convert to integer arithmetic to avoid floating point issues
    const priceInCents = Math.round(price * 100);
    const tickSizeInCents = Math.round(tickSize * 100);
    
    if (priceInCents % tickSizeInCents !== 0) {
      const suggestedPrice = Math.round(price / tickSize) * tickSize;
      return {
        isValid: false,
        error: `Price must be in multiples of tick size (${tickSize})`,
        suggestedPrice: Math.round(suggestedPrice * 100) / 100
      };
    }
    
    return { isValid: true };
  }

  /**
   * Get next expiry dates for futures contracts
   */
  public static getNextExpiryDates(count: number = 3): Date[] {
    const expiryDates: Date[] = [];
    const today = new Date();
    
    // Futures typically expire on the last Thursday of the month
    for (let i = 0; i < count + 3; i++) { // Get extra dates to ensure we have enough valid ones
      const targetMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const lastThursday = this.getLastThursday(targetMonth);
      
      // Only include future dates
      if (lastThursday > today) {
        expiryDates.push(lastThursday);
      }
      
      if (expiryDates.length >= count) {
        break;
      }
    }
    
    return expiryDates.slice(0, count);
  }

  /**
   * Get the last Thursday of a given month
   */
  private static getLastThursday(date: Date): Date {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Start from the last day of the month
    const lastDay = new Date(year, month + 1, 0);
    
    // Find the last Thursday
    while (lastDay.getDay() !== 4) { // 4 = Thursday
      lastDay.setDate(lastDay.getDate() - 1);
    }
    
    // Set time to market close (15:30 IST)
    lastDay.setHours(15, 30, 0, 0);
    
    return lastDay;
  }

  /**
   * Check if a contract is near expiry (within specified days)
   */
  public static isNearExpiry(
    expiryDate: Date,
    daysThreshold: number = 7
  ): boolean {
    const now = new Date();
    const timeDiff = expiryDate.getTime() - now.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return daysDiff <= daysThreshold && daysDiff >= 0;
  }

  /**
   * Get rollover date for a futures contract (typically 2-3 days before expiry)
   */
  public static getRolloverDate(
    expiryDate: Date,
    rolloverDaysBefore: number = 3
  ): Date {
    const rolloverDate = new Date(expiryDate);
    rolloverDate.setDate(rolloverDate.getDate() - rolloverDaysBefore);
    
    // Adjust for weekends - move to previous trading day
    while (rolloverDate.getDay() === 0 || rolloverDate.getDay() === 6) {
      rolloverDate.setDate(rolloverDate.getDate() - 1);
    }
    
    return rolloverDate;
  }

  /**
   * Create a futures contract with all specifications
   */
  public static createFuturesContract(
    underlying: string,
    expiryDate: Date,
    lastPrice: number,
    additionalData?: Partial<FuturesContract>
  ): FuturesContract {
    const specs = this.getContractSpecifications(underlying);
    const symbol = this.generateContractSymbol(underlying, expiryDate);
    const margins = this.calculateMarginRequirement(
      { underlying } as FuturesContract,
      1,
      lastPrice
    );
    
    return {
      symbol,
      underlying,
      expiryDate,
      lotSize: specs.contractSize,
      tickSize: specs.tickValue,
      lastPrice,
      bid: lastPrice - specs.tickValue,
      ask: lastPrice + specs.tickValue,
      volume: 0,
      openInterest: 0,
      timestamp: new Date(),
      contractValue: lastPrice * specs.contractSize,
      initialMargin: margins.initialMargin,
      maintenanceMargin: margins.maintenanceMargin,
      settlementPrice: lastPrice,
      multiplier: specs.contractSize,
      rolloverDate: this.getRolloverDate(expiryDate),
      ...additionalData
    };
  }

  /**
   * Create a futures chain for an underlying asset
   */
  public static createFuturesChain(
    underlying: string,
    contracts: FuturesContract[]
  ): FuturesChain {
    if (contracts.length === 0) {
      throw new Error('At least one contract is required to create a futures chain');
    }
    
    // Sort contracts by expiry date
    const sortedContracts = contracts.sort(
      (a, b) => a.expiryDate.getTime() - b.expiryDate.getTime()
    );
    
    const nearMonthContract = sortedContracts[0]!;
    const specifications = this.getContractSpecifications(underlying);
    
    return {
      underlying,
      contracts: sortedContracts,
      nearMonthContract,
      rolloverDate: nearMonthContract.rolloverDate || this.getRolloverDate(nearMonthContract.expiryDate),
      specifications
    };
  }

  /**
   * Check if rollover is recommended for a position
   */
  public static shouldRollover(
    contract: FuturesContract,
    currentDate: Date = new Date()
  ): { shouldRollover: boolean; reason?: string; daysToExpiry: number } {
    const timeDiff = contract.expiryDate.getTime() - currentDate.getTime();
    const daysToExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysToExpiry <= 0) {
      return {
        shouldRollover: true,
        reason: 'Contract has expired',
        daysToExpiry
      };
    }
    
    if (daysToExpiry <= 3) {
      return {
        shouldRollover: true,
        reason: 'Contract is near expiry (3 days or less)',
        daysToExpiry
      };
    }
    
    const rolloverDate = contract.rolloverDate || this.getRolloverDate(contract.expiryDate);
    if (currentDate >= rolloverDate) {
      return {
        shouldRollover: true,
        reason: 'Rollover date has been reached',
        daysToExpiry
      };
    }
    
    return {
      shouldRollover: false,
      daysToExpiry
    };
  }

  /**
   * Calculate contract value for a futures position
   */
  public static calculateContractValue(
    contract: FuturesContract,
    quantity: number,
    price?: number
  ): number {
    const effectivePrice = price || contract.lastPrice;
    return effectivePrice * quantity * contract.multiplier;
  }

  /**
   * Calculate P&L for a futures position
   */
  public static calculatePnL(
    entryPrice: number,
    currentPrice: number,
    quantity: number,
    multiplier: number,
    positionType: 'long' | 'short'
  ): number {
    const priceDiff = currentPrice - entryPrice;
    const rawPnL = priceDiff * quantity * multiplier;
    
    return positionType === 'long' ? rawPnL : -rawPnL;
  }
}