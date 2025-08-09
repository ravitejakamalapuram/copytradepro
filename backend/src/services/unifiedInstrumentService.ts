/**
 * Unified Instrument Service
 * Single database approach for all equity, options, and futures instruments
 * Provides common helper functions and unified search capabilities
 */

import mongoose from 'mongoose';
import { symbolDatabaseService } from './symbolDatabaseService';
import { CreateStandardizedSymbolData, StandardizedSymbol } from '../models/symbolModels';
import { logger } from '../utils/logger';

export interface UnifiedSearchOptions {
  query?: string;
  instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE' | 'ALL';
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
  fuzzy?: boolean;
  sortBy?: 'relevance' | 'name' | 'expiry' | 'strike';
  sortOrder?: 'asc' | 'desc';
}

export interface UnifiedInstrument {
  id: string;
  tradingSymbol: string;
  displayName: string;
  name: string;
  exchange: string;
  instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
  underlying?: string | undefined;
  strikePrice?: number | undefined;
  optionType?: 'CE' | 'PE' | undefined;
  expiryDate?: string | undefined;
  sector?: string | undefined;
  lotSize: number;
  tickSize: number;
  isActive: boolean;
  relevanceScore?: number | undefined;
}

export interface SearchResult {
  instruments: UnifiedInstrument[];
  total: number;
  hasMore: boolean;
  searchTime: number;
}

export interface MigrationResult {
  success: boolean;
  migrated: number;
  errors: number;
  message: string;
  details?: any;
}

export class UnifiedInstrumentService {
  private static instance: UnifiedInstrumentService;

  static getInstance(): UnifiedInstrumentService {
    if (!UnifiedInstrumentService.instance) {
      UnifiedInstrumentService.instance = new UnifiedInstrumentService();
    }
    return UnifiedInstrumentService.instance;
  }

  /**
   * Universal search across all instrument types with unified results
   */
  async searchInstruments(options: UnifiedSearchOptions): Promise<SearchResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting unified instrument search', {
        component: 'UNIFIED_INSTRUMENT_SERVICE',
        operation: 'SEARCH_INSTRUMENTS',
        options: this.sanitizeOptionsForLogging(options)
      });

      const searchQuery = this.buildSearchQuery(options);
      const result = await symbolDatabaseService.searchSymbolsWithFilters(searchQuery);

      const instruments = result.symbols.map(symbol => this.mapToUnifiedInstrument(symbol));

      const searchResult: SearchResult = {
        instruments,
        total: result.total,
        hasMore: result.hasMore,
        searchTime: Date.now() - startTime
      };

      logger.info('Unified instrument search completed', {
        component: 'UNIFIED_INSTRUMENT_SERVICE',
        operation: 'SEARCH_COMPLETE',
        resultCount: instruments.length,
        searchTime: searchResult.searchTime
      });

      return searchResult;
    } catch (error) {
      logger.error('Unified instrument search failed', {
        component: 'UNIFIED_INSTRUMENT_SERVICE',
        operation: 'SEARCH_ERROR'
      }, error);

      return {
        instruments: [],
        total: 0,
        hasMore: false,
        searchTime: Date.now() - startTime
      };
    }
  }

  /**
   * Search equity instruments only
   */
  async searchEquity(query: string, limit: number = 10, fuzzy: boolean = true): Promise<UnifiedInstrument[]> {
    const result = await this.searchInstruments({
      query,
      instrumentType: 'EQUITY',
      limit,
      fuzzy
    });
    return result.instruments;
  }

  /**
   * Search options instruments only
   */
  async searchOptions(query: string, limit: number = 10, fuzzy: boolean = true): Promise<UnifiedInstrument[]> {
    const result = await this.searchInstruments({
      query,
      instrumentType: 'OPTION',
      limit,
      fuzzy
    });
    return result.instruments;
  }

  /**
   * Search futures instruments only
   */
  async searchFutures(query: string, limit: number = 10, fuzzy: boolean = true): Promise<UnifiedInstrument[]> {
    const result = await this.searchInstruments({
      query,
      instrumentType: 'FUTURE',
      limit,
      fuzzy
    });
    return result.instruments;
  }

  /**
   * Search all instrument types with categorized results
   */
  async searchAllCategorized(query: string, limit: number = 20, fuzzy: boolean = true): Promise<{
    equity: UnifiedInstrument[];
    options: UnifiedInstrument[];
    futures: UnifiedInstrument[];
    total: number;
    searchTime: number;
  }> {
    const startTime = Date.now();
    const limitPerType = Math.floor(limit / 3);

    const [equity, options, futures] = await Promise.all([
      this.searchEquity(query, limitPerType, fuzzy),
      this.searchOptions(query, limitPerType, fuzzy),
      this.searchFutures(query, limitPerType, fuzzy)
    ]);

    return {
      equity,
      options,
      futures,
      total: equity.length + options.length + futures.length,
      searchTime: Date.now() - startTime
    };
  }

  /**
   * Get option chain for an underlying
   */
  async getOptionChain(underlying: string, expiryDate?: string): Promise<{
    calls: UnifiedInstrument[];
    puts: UnifiedInstrument[];
    expiries: string[];
  }> {
    try {
      const searchOptions: UnifiedSearchOptions = {
        instrumentType: 'OPTION',
        underlying,
        limit: 1000,
        sortBy: 'strike',
        sortOrder: 'asc'
      };

      if (expiryDate) {
        searchOptions.expiryStart = expiryDate;
        searchOptions.expiryEnd = expiryDate;
      }

      const result = await this.searchInstruments(searchOptions);
      
      const calls = result.instruments.filter(inst => inst.optionType === 'CE');
      const puts = result.instruments.filter(inst => inst.optionType === 'PE');
      
      // Get unique expiry dates
      const expiries = [...new Set(result.instruments
        .map(inst => inst.expiryDate)
        .filter(date => date)
        .sort())] as string[];

      return { calls, puts, expiries };
    } catch (error) {
      logger.error('Failed to get option chain', {
        component: 'UNIFIED_INSTRUMENT_SERVICE',
        operation: 'GET_OPTION_CHAIN',
        underlying
      }, error);

      return { calls: [], puts: [], expiries: [] };
    }
  }

  /**
   * Get futures chain for an underlying
   */
  async getFuturesChain(underlying: string): Promise<{
    futures: UnifiedInstrument[];
    expiries: string[];
  }> {
    try {
      const result = await this.searchInstruments({
        instrumentType: 'FUTURE',
        underlying,
        limit: 100,
        sortBy: 'expiry',
        sortOrder: 'asc'
      });

      const expiries = [...new Set(result.instruments
        .map(inst => inst.expiryDate)
        .filter(date => date)
        .sort())] as string[];

      return { 
        futures: result.instruments, 
        expiries 
      };
    } catch (error) {
      logger.error('Failed to get futures chain', {
        component: 'UNIFIED_INSTRUMENT_SERVICE',
        operation: 'GET_FUTURES_CHAIN',
        underlying
      }, error);

      return { futures: [], expiries: [] };
    }
  }

  // Legacy migration methods removed - using direct data import instead

  // Legacy migration methods removed - using direct data import instead

  /**
   * Helper: Build search query from options
   */
  private buildSearchQuery(options: UnifiedSearchOptions) {
    return {
      query: options.query,
      instrumentType: options.instrumentType === 'ALL' ? undefined : options.instrumentType,
      exchange: options.exchange,
      underlying: options.underlying,
      strikeMin: options.strikeMin,
      strikeMax: options.strikeMax,
      expiryStart: options.expiryStart,
      expiryEnd: options.expiryEnd,
      optionType: options.optionType,
      isActive: options.isActive !== undefined ? options.isActive : true,
      limit: options.limit || 50,
      offset: options.offset || 0,
      fuzzy: options.fuzzy !== false
    };
  }

  /**
   * Helper: Map standardized symbol to unified instrument format
   */
  private mapToUnifiedInstrument(symbol: StandardizedSymbol): UnifiedInstrument {
    return {
      id: symbol.id,
      tradingSymbol: symbol.tradingSymbol,
      displayName: symbol.displayName,
      name: symbol.companyName || symbol.displayName,
      exchange: symbol.exchange,
      instrumentType: symbol.instrumentType,
      underlying: symbol.underlying || undefined,
      strikePrice: symbol.strikePrice || undefined,
      optionType: symbol.optionType || undefined,
      expiryDate: symbol.expiryDate || undefined,
      sector: symbol.sector || undefined,
      lotSize: symbol.lotSize,
      tickSize: symbol.tickSize,
      isActive: symbol.isActive,
      relevanceScore: (symbol as any).relevanceScore || 0
    };
  }

  /**
   * Helper: Sanitize options for logging (remove sensitive data)
   */
  private sanitizeOptionsForLogging(options: UnifiedSearchOptions): any {
    return {
      hasQuery: !!options.query,
      queryLength: options.query?.length || 0,
      instrumentType: options.instrumentType,
      exchange: options.exchange,
      underlying: options.underlying,
      limit: options.limit,
      fuzzy: options.fuzzy
    };
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    totalInstruments: number;
    equityCount: number;
    optionCount: number;
    futureCount: number;
    activeCount: number;
    inactiveCount: number;
    lastUpdated: string;
  }> {
    try {
      // This would need to be implemented in symbolDatabaseService
      // For now, return placeholder data
      return {
        totalInstruments: 0,
        equityCount: 0,
        optionCount: 0,
        futureCount: 0,
        activeCount: 0,
        inactiveCount: 0,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get database stats', {
        component: 'UNIFIED_INSTRUMENT_SERVICE',
        operation: 'GET_DATABASE_STATS'
      }, error);

      return {
        totalInstruments: 0,
        equityCount: 0,
        optionCount: 0,
        futureCount: 0,
        activeCount: 0,
        inactiveCount: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  /**
   * Clean up expired instruments
   */
  async cleanupExpiredInstruments(): Promise<{
    cleaned: number;
    errors: number;
  }> {
    try {
      logger.info('Starting cleanup of expired instruments', {
        component: 'UNIFIED_INSTRUMENT_SERVICE',
        operation: 'CLEANUP_EXPIRED'
      });

      // This would need to be implemented in symbolDatabaseService
      // For now, return placeholder
      return {
        cleaned: 0,
        errors: 0
      };
    } catch (error) {
      logger.error('Failed to cleanup expired instruments', {
        component: 'UNIFIED_INSTRUMENT_SERVICE',
        operation: 'CLEANUP_EXPIRED_ERROR'
      }, error);

      return {
        cleaned: 0,
        errors: 1
      };
    }
  }
}

// Export singleton instance
export const unifiedInstrumentService = UnifiedInstrumentService.getInstance();