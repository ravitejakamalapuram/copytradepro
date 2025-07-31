import { SymbolDatabaseService, SymbolSearchQuery, SymbolSearchResult } from './symbolDatabaseService';
import { StandardizedSymbol } from '../models/symbolModels';

export interface SearchOptions {
  query?: string;
  instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE';
  exchange?: string;
  underlying?: string;
  strikeMin?: number;
  strikeMax?: number;
  expiryStart?: string;
  expiryEnd?: string;
  optionType?: 'CE' | 'PE';
  isActive?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'name' | 'symbol' | 'expiry' | 'strike';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResultWithScore extends StandardizedSymbol {
  relevanceScore?: number;
}

export interface EnhancedSearchResult {
  symbols: SearchResultWithScore[];
  total: number;
  hasMore: boolean;
  searchTime: number;
  filters: {
    instrumentTypes: Array<{ type: string; count: number }>;
    exchanges: Array<{ exchange: string; count: number }>;
    underlyings?: Array<{ underlying: string; count: number }>;
  };
}

/**
 * Symbol Search Service
 * Provides advanced search capabilities with fuzzy matching, filtering, and ranking
 */
export class SymbolSearchService {
  private symbolDatabaseService: SymbolDatabaseService;

  constructor(symbolDatabaseService: SymbolDatabaseService) {
    this.symbolDatabaseService = symbolDatabaseService;
  }

  /**
   * Unified search with fuzzy matching and relevance scoring
   */
  async searchSymbols(options: SearchOptions): Promise<EnhancedSearchResult> {
    const startTime = Date.now();

    try {
      // Build search query
      const searchQuery = this.buildSearchQuery(options);
      
      // Execute search
      const result = await this.symbolDatabaseService.searchSymbolsWithFilters(searchQuery);
      
      // Apply fuzzy matching and relevance scoring if text query is provided
      let scoredSymbols: SearchResultWithScore[] = result.symbols;
      if (options.query && options.query.trim()) {
        scoredSymbols = this.applyFuzzyMatchingAndScoring(result.symbols, options.query);
      }

      // Apply sorting
      scoredSymbols = this.applySorting(scoredSymbols, options.sortBy, options.sortOrder);

      // Get aggregated filters for faceted search
      const filters = await this.getSearchFilters(options);

      const searchTime = Date.now() - startTime;

      return {
        symbols: scoredSymbols,
        total: result.total,
        hasMore: result.hasMore,
        searchTime,
        filters
      };
    } catch (error) {
      console.error('🚨 Symbol search failed:', error);
      return {
        symbols: [],
        total: 0,
        hasMore: false,
        searchTime: Date.now() - startTime,
        filters: {
          instrumentTypes: [],
          exchanges: []
        }
      };
    }
  }

  /**
   * Quick search for autocomplete/typeahead functionality
   */
  async quickSearch(query: string, limit: number = 10): Promise<StandardizedSymbol[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      const searchQuery: SymbolSearchQuery = {
        query: query.trim(),
        limit,
        isActive: true
      };

      const result = await this.symbolDatabaseService.searchSymbolsWithFilters(searchQuery);
      
      // Apply fuzzy matching for better results
      const scoredResults = this.applyFuzzyMatchingAndScoring(result.symbols, query);
      
      // Return top results sorted by relevance
      return scoredResults
        .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
        .slice(0, limit);
    } catch (error) {
      console.error('🚨 Quick search failed:', error);
      return [];
    }
  }

  /**
   * Search symbols by underlying asset (for options/futures chains)
   */
  async searchByUnderlying(
    underlying: string, 
    instrumentType?: 'OPTION' | 'FUTURE',
    expiry?: string
  ): Promise<StandardizedSymbol[]> {
    try {
      const searchQuery: SymbolSearchQuery = {
        underlying: underlying.toUpperCase(),
        instrumentType,
        expiryStart: expiry,
        expiryEnd: expiry,
        isActive: true,
        limit: 1000
      };

      const result = await this.symbolDatabaseService.searchSymbolsWithFilters(searchQuery);
      
      // Sort by expiry date and strike price for options
      return result.symbols.sort((a, b) => {
        // First sort by expiry date
        if (a.expiryDate && b.expiryDate) {
          const expiryCompare = a.expiryDate.localeCompare(b.expiryDate);
          if (expiryCompare !== 0) return expiryCompare;
        }
        
        // Then by strike price for options
        if (a.strikePrice && b.strikePrice) {
          return a.strikePrice - b.strikePrice;
        }
        
        // Finally by option type (CE before PE)
        if (a.optionType && b.optionType) {
          return a.optionType.localeCompare(b.optionType);
        }
        
        return 0;
      });
    } catch (error) {
      console.error('🚨 Search by underlying failed:', error);
      return [];
    }
  }

  /**
   * Get option chain for a specific underlying and expiry
   */
  async getOptionChain(underlying: string, expiry?: string): Promise<{
    calls: StandardizedSymbol[];
    puts: StandardizedSymbol[];
    expiries: string[];
  }> {
    try {
      // Get all options for the underlying
      const options = await this.searchByUnderlying(underlying, 'OPTION', expiry);
      
      // Separate calls and puts
      const calls = options.filter(option => option.optionType === 'CE');
      const puts = options.filter(option => option.optionType === 'PE');
      
      // Get available expiry dates if not specified
      let expiries: string[] = [];
      if (!expiry) {
        const allOptions = await this.searchByUnderlying(underlying, 'OPTION');
        expiries = [...new Set(allOptions
          .map(option => option.expiryDate)
          .filter((date): date is string => !!date)
        )].sort();
      }

      return { calls, puts, expiries };
    } catch (error) {
      console.error('🚨 Get option chain failed:', error);
      return { calls: [], puts: [], expiries: [] };
    }
  }

  /**
   * Get futures chain for a specific underlying
   */
  async getFuturesChain(underlying: string): Promise<{
    futures: StandardizedSymbol[];
    expiries: string[];
  }> {
    try {
      const futures = await this.searchByUnderlying(underlying, 'FUTURE');
      
      const expiries = [...new Set(futures
        .map(future => future.expiryDate)
        .filter((date): date is string => !!date)
      )].sort();

      return { futures, expiries };
    } catch (error) {
      console.error('🚨 Get futures chain failed:', error);
      return { futures: [], expiries: [] };
    }
  }

  /**
   * Advanced filtering with multiple criteria
   */
  async advancedFilter(filters: {
    instrumentTypes?: string[];
    exchanges?: string[];
    underlyings?: string[];
    strikeRange?: { min: number; max: number };
    expiryRange?: { start: string; end: string };
    optionTypes?: string[];
    sectors?: string[];
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<SymbolSearchResult> {
    try {
      const searchQuery: SymbolSearchQuery = {
        instrumentType: filters.instrumentTypes?.[0] as any, // For now, support single type
        exchange: filters.exchanges?.[0],
        underlying: filters.underlyings?.[0],
        strikeMin: filters.strikeRange?.min,
        strikeMax: filters.strikeRange?.max,
        expiryStart: filters.expiryRange?.start,
        expiryEnd: filters.expiryRange?.end,
        optionType: filters.optionTypes?.[0] as any,
        isActive: filters.isActive,
        limit: filters.limit,
        offset: filters.offset
      };

      return await this.symbolDatabaseService.searchSymbolsWithFilters(searchQuery);
    } catch (error) {
      console.error('🚨 Advanced filter failed:', error);
      return { symbols: [], total: 0, hasMore: false };
    }
  }

  /**
   * Build search query from options
   */
  private buildSearchQuery(options: SearchOptions): SymbolSearchQuery {
    return {
      query: options.query?.trim(),
      instrumentType: options.instrumentType,
      exchange: options.exchange,
      underlying: options.underlying,
      strikeMin: options.strikeMin,
      strikeMax: options.strikeMax,
      expiryStart: options.expiryStart,
      expiryEnd: options.expiryEnd,
      optionType: options.optionType,
      isActive: options.isActive !== undefined ? options.isActive : true,
      limit: Math.min(options.limit || 50, 100), // Cap at 100 for performance
      offset: options.offset || 0
    };
  }

  /**
   * Apply fuzzy matching and relevance scoring
   */
  private applyFuzzyMatchingAndScoring(symbols: StandardizedSymbol[], query: string): SearchResultWithScore[] {
    const normalizedQuery = query.toLowerCase().trim();
    
    return symbols.map(symbol => {
      let score = 0;
      
      // Exact matches get highest score
      if (symbol.tradingSymbol.toLowerCase() === normalizedQuery) {
        score += 100;
      } else if (symbol.displayName.toLowerCase() === normalizedQuery) {
        score += 95;
      } else if (symbol.companyName?.toLowerCase() === normalizedQuery) {
        score += 90;
      }
      
      // Prefix matches
      if (symbol.tradingSymbol.toLowerCase().startsWith(normalizedQuery)) {
        score += 80;
      } else if (symbol.displayName.toLowerCase().startsWith(normalizedQuery)) {
        score += 75;
      } else if (symbol.companyName?.toLowerCase().startsWith(normalizedQuery)) {
        score += 70;
      }
      
      // Contains matches
      if (symbol.tradingSymbol.toLowerCase().includes(normalizedQuery)) {
        score += 60;
      } else if (symbol.displayName.toLowerCase().includes(normalizedQuery)) {
        score += 55;
      } else if (symbol.companyName?.toLowerCase().includes(normalizedQuery)) {
        score += 50;
      }
      
      // Fuzzy matching using Levenshtein distance
      const tradingSymbolDistance = this.levenshteinDistance(
        symbol.tradingSymbol.toLowerCase(), 
        normalizedQuery
      );
      const displayNameDistance = this.levenshteinDistance(
        symbol.displayName.toLowerCase(), 
        normalizedQuery
      );
      
      // Add fuzzy score (inverse of distance, normalized)
      const maxLength = Math.max(symbol.tradingSymbol.length, symbol.displayName.length, normalizedQuery.length);
      const tradingSymbolFuzzyScore = Math.max(0, (maxLength - tradingSymbolDistance) / maxLength * 40);
      const displayNameFuzzyScore = Math.max(0, (maxLength - displayNameDistance) / maxLength * 35);
      
      score += Math.max(tradingSymbolFuzzyScore, displayNameFuzzyScore);
      
      // Boost score for active symbols
      if (symbol.isActive) {
        score += 10;
      }
      
      // Boost score for equity instruments (more commonly searched)
      if (symbol.instrumentType === 'EQUITY') {
        score += 5;
      }

      return {
        ...symbol,
        relevanceScore: Math.round(score)
      };
    }).filter(symbol => (symbol.relevanceScore || 0) > 0); // Filter out irrelevant results
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0]![i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j]![0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j]![i] = Math.min(
          matrix[j]![i - 1]! + 1, // deletion
          matrix[j - 1]![i]! + 1, // insertion
          matrix[j - 1]![i - 1]! + indicator // substitution
        );
      }
    }

    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Apply sorting to search results
   */
  private applySorting(
    symbols: SearchResultWithScore[], 
    sortBy: string = 'relevance', 
    sortOrder: string = 'desc'
  ): SearchResultWithScore[] {
    const multiplier = sortOrder === 'desc' ? -1 : 1;

    return symbols.sort((a, b) => {
      switch (sortBy) {
        case 'relevance':
          return ((b.relevanceScore || 0) - (a.relevanceScore || 0)) * multiplier;
        
        case 'name':
          return a.displayName.localeCompare(b.displayName) * multiplier;
        
        case 'symbol':
          return a.tradingSymbol.localeCompare(b.tradingSymbol) * multiplier;
        
        case 'expiry':
          if (a.expiryDate && b.expiryDate) {
            return a.expiryDate.localeCompare(b.expiryDate) * multiplier;
          }
          return 0;
        
        case 'strike':
          if (a.strikePrice && b.strikePrice) {
            return (a.strikePrice - b.strikePrice) * multiplier;
          }
          return 0;
        
        default:
          return ((b.relevanceScore || 0) - (a.relevanceScore || 0)) * multiplier;
      }
    });
  }

  /**
   * Get aggregated filters for faceted search
   */
  private async getSearchFilters(options: SearchOptions): Promise<{
    instrumentTypes: Array<{ type: string; count: number }>;
    exchanges: Array<{ exchange: string; count: number }>;
    underlyings?: Array<{ underlying: string; count: number }>;
  }> {
    try {
      // This is a simplified implementation
      // In a real scenario, you might want to run aggregation queries
      return {
        instrumentTypes: [
          { type: 'EQUITY', count: 0 },
          { type: 'OPTION', count: 0 },
          { type: 'FUTURE', count: 0 }
        ],
        exchanges: [
          { exchange: 'NSE', count: 0 },
          { exchange: 'BSE', count: 0 },
          { exchange: 'NFO', count: 0 },
          { exchange: 'BFO', count: 0 },
          { exchange: 'MCX', count: 0 }
        ]
      };
    } catch (error) {
      console.error('🚨 Get search filters failed:', error);
      return {
        instrumentTypes: [],
        exchanges: []
      };
    }
  }

  /**
   * Get search suggestions based on partial input
   */
  async getSearchSuggestions(partialQuery: string, limit: number = 5): Promise<string[]> {
    if (!partialQuery || partialQuery.trim().length < 2) {
      return [];
    }

    try {
      const results = await this.quickSearch(partialQuery, limit * 2);
      
      // Extract unique suggestions from trading symbols and display names
      const suggestions = new Set<string>();
      
      results.forEach(symbol => {
        if (symbol.tradingSymbol.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(symbol.tradingSymbol);
        }
        if (symbol.displayName.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(symbol.displayName);
        }
        if (symbol.companyName && symbol.companyName.toLowerCase().includes(partialQuery.toLowerCase())) {
          suggestions.add(symbol.companyName);
        }
      });

      return Array.from(suggestions).slice(0, limit);
    } catch (error) {
      console.error('🚨 Get search suggestions failed:', error);
      return [];
    }
  }

  /**
   * Get popular/trending symbols (placeholder implementation)
   */
  async getPopularSymbols(instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE', limit: number = 10): Promise<StandardizedSymbol[]> {
    try {
      const searchQuery: SymbolSearchQuery = {
        instrumentType,
        isActive: true,
        limit
      };

      const result = await this.symbolDatabaseService.searchSymbolsWithFilters(searchQuery);
      
      // For now, just return the first results
      // In a real implementation, this would be based on trading volume, user searches, etc.
      return result.symbols;
    } catch (error) {
      console.error('🚨 Get popular symbols failed:', error);
      return [];
    }
  }
}

// Export singleton instance - will be initialized when database service is ready
let _symbolSearchService: SymbolSearchService | null = null;

export const getSymbolSearchService = (): SymbolSearchService => {
  if (!_symbolSearchService) {
    // Import here to avoid circular dependency
    const { symbolDatabaseService } = require('./symbolDatabaseService');
    _symbolSearchService = new SymbolSearchService(symbolDatabaseService);
  }
  return _symbolSearchService;
};

// For backward compatibility
export const symbolSearchService = new Proxy({} as SymbolSearchService, {
  get(target, prop) {
    return getSymbolSearchService()[prop as keyof SymbolSearchService];
  }
});