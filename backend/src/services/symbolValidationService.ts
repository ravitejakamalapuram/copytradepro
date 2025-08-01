/**
 * Symbol Validation Service
 * Validates symbols for order placement and provides backward compatibility
 */

import { symbolDatabaseService } from './symbolDatabaseService';
import { StandardizedSymbol } from '../models/symbolModels';

export interface SymbolValidationResult {
  isValid: boolean;
  symbol?: StandardizedSymbol;
  error?: string;
  isLegacyFormat?: boolean;
}

export interface OrderSymbolInfo {
  standardizedSymbol: StandardizedSymbol;
  originalInput: string;
  isStandardizedId: boolean;
  validationWarnings: string[];
}

export class SymbolValidationService {
  
  /**
   * Validate and resolve symbol for order placement
   * Supports both standardized symbol IDs and legacy symbol formats
   */
  async validateAndResolveSymbol(
    symbolInput: string, 
    exchange?: string
  ): Promise<SymbolValidationResult> {
    try {
      // Check if symbol database service is available
      if (!symbolDatabaseService || !symbolDatabaseService.isReady()) {
        return {
          isValid: false,
          error: 'Symbol database service not available. Please try again later.'
        };
      }

      // Try to resolve as standardized symbol ID first (24-character hex string)
      if (this.isStandardizedSymbolId(symbolInput)) {
        const symbol = await symbolDatabaseService.getSymbolById(symbolInput);
        if (symbol) {
          if (!symbol.isActive) {
            return {
              isValid: false,
              error: `Symbol ${symbol.displayName} is not active for trading`
            };
          }
          return {
            isValid: true,
            symbol,
            isLegacyFormat: false
          };
        } else {
          return {
            isValid: false,
            error: `Standardized symbol with ID ${symbolInput} not found`
          };
        }
      }

      // Try to resolve as trading symbol
      const symbol = await symbolDatabaseService.getSymbolByTradingSymbol(symbolInput, exchange);
      if (symbol) {
        if (!symbol.isActive) {
          return {
            isValid: false,
            error: `Symbol ${symbol.displayName} is not active for trading`
          };
        }
        return {
          isValid: true,
          symbol,
          isLegacyFormat: true
        };
      }

      // Symbol not found in database - this could be a legacy symbol
      // For backward compatibility, we'll allow it but mark as legacy
      return {
        isValid: true,
        isLegacyFormat: true,
        error: `Symbol ${symbolInput} not found in standardized database. Using legacy format.`
      };

    } catch (error: any) {
      console.error('Symbol validation error:', error);
      return {
        isValid: false,
        error: `Symbol validation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate symbol for specific broker
   */
  async validateSymbolForBroker(
    symbolInput: string,
    brokerName: string,
    exchange?: string
  ): Promise<SymbolValidationResult> {
    const baseValidation = await this.validateAndResolveSymbol(symbolInput, exchange);
    
    if (!baseValidation.isValid || !baseValidation.symbol) {
      return baseValidation;
    }

    // Check if broker supports the symbol's exchange
    const supportedExchanges = this.getBrokerSupportedExchanges(brokerName);
    if (!supportedExchanges.includes(baseValidation.symbol.exchange)) {
      return {
        isValid: false,
        error: `Broker ${brokerName} does not support exchange ${baseValidation.symbol.exchange}`
      };
    }

    return baseValidation;
  }

  /**
   * Get comprehensive symbol information for order placement
   */
  async getOrderSymbolInfo(
    symbolInput: string,
    exchange?: string
  ): Promise<OrderSymbolInfo | null> {
    const validation = await this.validateAndResolveSymbol(symbolInput, exchange);
    
    if (!validation.isValid || !validation.symbol) {
      return null;
    }

    const warnings: string[] = [];
    
    // Add warnings for legacy format usage
    if (validation.isLegacyFormat) {
      warnings.push('Using legacy symbol format. Consider using standardized symbol ID for better performance.');
    }

    // Add warnings for expiring instruments
    if (validation.symbol.expiryDate) {
      const expiryDate = new Date(validation.symbol.expiryDate);
      const daysToExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysToExpiry <= 7) {
        warnings.push(`Symbol expires in ${daysToExpiry} day(s) on ${validation.symbol.expiryDate}`);
      }
    }

    return {
      standardizedSymbol: validation.symbol,
      originalInput: symbolInput,
      isStandardizedId: !validation.isLegacyFormat,
      validationWarnings: warnings
    };
  }

  /**
   * Batch validate symbols
   */
  async validateSymbols(
    symbolInputs: Array<{ symbol: string; exchange?: string }>
  ): Promise<SymbolValidationResult[]> {
    const results: SymbolValidationResult[] = [];
    
    for (const input of symbolInputs) {
      const result = await this.validateAndResolveSymbol(input.symbol, input.exchange);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Search for symbols matching partial input (for autocomplete)
   */
  async searchSymbolsForInput(
    partialInput: string,
    exchange?: string,
    instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE',
    limit: number = 10
  ): Promise<StandardizedSymbol[]> {
    try {
      if (!symbolDatabaseService || !symbolDatabaseService.isReady()) {
        return [];
      }

      const searchResult = await symbolDatabaseService.searchSymbolsWithFilters({
        query: partialInput,
        exchange,
        instrumentType,
        isActive: true,
        limit
      });

      return searchResult.symbols;
    } catch (error) {
      console.error('Symbol search error:', error);
      return [];
    }
  }

  /**
   * Get symbol suggestions based on user input
   */
  async getSymbolSuggestions(
    input: string,
    context?: {
      exchange?: string;
      instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE';
      underlying?: string;
    }
  ): Promise<Array<{ symbol: StandardizedSymbol; reason: string }>> {
    try {
      const suggestions: Array<{ symbol: StandardizedSymbol; reason: string }> = [];
      
      // Direct matches
      const directMatches = await this.searchSymbolsForInput(
        input, 
        context?.exchange, 
        context?.instrumentType, 
        5
      );
      
      directMatches.forEach(symbol => {
        suggestions.push({
          symbol,
          reason: 'Direct match'
        });
      });

      // If looking for options/futures and have underlying context
      if (context?.underlying && (context.instrumentType === 'OPTION' || context.instrumentType === 'FUTURE')) {
        const derivativeMatches = await symbolDatabaseService.getSymbolsByUnderlying(context.underlying);
        
        derivativeMatches
          .filter(symbol => 
            symbol.instrumentType === context.instrumentType &&
            symbol.displayName.toLowerCase().includes(input.toLowerCase())
          )
          .slice(0, 3)
          .forEach(symbol => {
            suggestions.push({
              symbol,
              reason: `${context.instrumentType} on ${context.underlying}`
            });
          });
      }

      return suggestions.slice(0, 10); // Limit total suggestions
    } catch (error) {
      console.error('Symbol suggestions error:', error);
      return [];
    }
  }

  /**
   * Validate order parameters against symbol constraints
   */
  validateOrderParameters(
    symbol: StandardizedSymbol,
    orderParams: {
      quantity: number;
      price?: number;
      orderType: string;
    }
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate lot size
    if (orderParams.quantity % symbol.lotSize !== 0) {
      errors.push(`Quantity must be in multiples of lot size ${symbol.lotSize}`);
    }

    // Validate tick size for limit orders
    if (orderParams.price && orderParams.orderType === 'LIMIT') {
      // Use precision-safe comparison for floating point numbers
      const priceRemainder = orderParams.price % symbol.tickSize;
      const tolerance = symbol.tickSize / 1000; // Small tolerance for floating point precision
      if (Math.abs(priceRemainder) > tolerance && Math.abs(priceRemainder - symbol.tickSize) > tolerance) {
        errors.push(`Price must be in multiples of tick size ${symbol.tickSize}`);
      }
    }

    // Validate expiry for derivatives
    if (symbol.expiryDate) {
      const expiryDate = new Date(symbol.expiryDate);
      if (expiryDate < new Date()) {
        errors.push(`Symbol has expired on ${symbol.expiryDate}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if input looks like a standardized symbol ID
   */
  private isStandardizedSymbolId(input: string): boolean {
    // MongoDB ObjectId format: 24-character hexadecimal string
    return /^[0-9a-fA-F]{24}$/.test(input);
  }

  /**
   * Get supported exchanges for a broker
   */
  private getBrokerSupportedExchanges(brokerName: string): string[] {
    const exchangeMap: Record<string, string[]> = {
      'fyers': ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'],
      'shoonya': ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'],
      'zerodha': ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'],
      'upstox': ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'],
      'angelone': ['NSE', 'BSE', 'NFO', 'BFO', 'MCX']
    };

    return exchangeMap[brokerName.toLowerCase()] || ['NSE', 'BSE'];
  }

  /**
   * Get symbol display information for UI
   */
  getSymbolDisplayInfo(symbol: StandardizedSymbol): {
    displayName: string;
    description: string;
    tags: string[];
  } {
    const tags: string[] = [symbol.instrumentType, symbol.exchange];
    
    if (symbol.sector) {
      tags.push(symbol.sector);
    }
    
    if (symbol.underlying) {
      tags.push(`Underlying: ${symbol.underlying}`);
    }

    let description = `${symbol.instrumentType} on ${symbol.exchange}`;
    
    if (symbol.instrumentType === 'OPTION') {
      description += ` | Strike: ${symbol.strikePrice} | Type: ${symbol.optionType} | Expiry: ${symbol.expiryDate}`;
    } else if (symbol.instrumentType === 'FUTURE') {
      description += ` | Expiry: ${symbol.expiryDate}`;
    } else if (symbol.companyName) {
      description += ` | ${symbol.companyName}`;
    }

    return {
      displayName: symbol.displayName,
      description,
      tags
    };
  }
}

// Export singleton instance
export const symbolValidationService = new SymbolValidationService();