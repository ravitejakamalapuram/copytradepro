/**
 * Simplified Symbol Service
 * Just fetches symbol details by symbol and exchange for equity orders
 */

import { symbolDatabaseService } from './symbolDatabaseService';
import { StandardizedSymbol } from '../models/symbolModels';

export interface SymbolValidationResult {
  isValid: boolean;
  symbol?: StandardizedSymbol;
  error?: string;
}

export interface OrderSymbolInfo {
  standardizedSymbol: StandardizedSymbol;
  originalInput: string;
}

export class SymbolValidationService {

  /**
   * Simple symbol lookup by symbol and exchange
   * No validation, just fetch symbol details
   */
  async validateAndResolveSymbol(
    symbolInput: string,
    exchange?: string
  ): Promise<SymbolValidationResult> {
    try {
      // Check if symbol database service is available
      if (!symbolDatabaseService || !symbolDatabaseService.isReady()) {
        return {
          isValid: true, // Allow order to proceed even if database unavailable
          error: 'Symbol database service not available. Using symbol as provided.'
        };
      }

      // Try to get symbol details by trading symbol
      const symbol = await symbolDatabaseService.getSymbolByTradingSymbol(symbolInput, exchange);
      if (symbol) {
        return {
          isValid: true,
          symbol
        };
      }

      // Symbol not found - still allow order to proceed
      return {
        isValid: true,
        error: `Symbol ${symbolInput} not found in database. Using symbol as provided.`
      };

    } catch (error: any) {
      console.error('Symbol lookup error:', error);
      return {
        isValid: true, // Allow order to proceed even on error
        error: `Symbol lookup failed: ${error.message}. Using symbol as provided.`
      };
    }
  }

  /**
   * Validate symbol for specific broker (simplified - same as basic validation)
   */
  async validateSymbolForBroker(
    symbolInput: string,
    brokerName: string,
    exchange?: string
  ): Promise<SymbolValidationResult> {
    return this.validateAndResolveSymbol(symbolInput, exchange);
  }

  /**
   * Get basic symbol information for order placement
   */
  async getOrderSymbolInfo(
    symbolInput: string,
    exchange?: string
  ): Promise<OrderSymbolInfo | null> {
    const validation = await this.validateAndResolveSymbol(symbolInput, exchange);

    if (!validation.symbol) {
      return null;
    }

    return {
      standardizedSymbol: validation.symbol,
      originalInput: symbolInput
    };
  }

  /**
   * Batch validate symbols (simplified)
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
   * Search for symbols (simplified - delegate to database service)
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
        limit
      });

      return searchResult.symbols;
    } catch (error) {
      console.error('Symbol search error:', error);
      return [];
    }
  }

  /**
   * Get symbol suggestions (simplified)
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

      // Direct matches only
      const directMatches = await this.searchSymbolsForInput(
        input,
        context?.exchange,
        context?.instrumentType,
        10
      );

      directMatches.forEach(symbol => {
        suggestions.push({
          symbol,
          reason: 'Direct match'
        });
      });

      return suggestions;
    } catch (error) {
      console.error('Symbol suggestions error:', error);
      return [];
    }
  }

  /**
   * Simplified order parameter validation (no constraints)
   */
  validateOrderParameters(
    _symbol: StandardizedSymbol,
    _orderParams: {
      quantity: number;
      price?: number;
      orderType: string;
    }
  ): { isValid: boolean; errors: string[] } {
    // No validation - always allow
    return {
      isValid: true,
      errors: []
    };
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

    let description = `${symbol.instrumentType} on ${symbol.exchange}`;

    if (symbol.companyName) {
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