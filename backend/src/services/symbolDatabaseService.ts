import { nseService, NSESymbol } from './nseService';
import { nseCSVService, NSESymbolData } from './nseCSVService';
import { bseCSVService, BSESymbolData } from './bseCSVService';
// optionsDatabase removed - using optionsDataService with direct MongoDB operations
import { Exchange } from '@copytrade/shared-types';

// Unified symbol interface for multi-exchange support including F&O
export interface UnifiedSymbol {
  symbol: string;           // Display symbol (TCS, RELIANCE24FEB3000CE)
  tradingSymbol: string;    // Exchange-specific format (TCS-EQ for NSE, TCS for BSE)
  name: string;
  exchange: Exchange;
  instrument_type: 'EQUITY' | 'OPTION' | 'FUTURE';
  isin?: string;
  series?: string;          // NSE: EQ, BE, etc.
  group?: string;           // BSE: A, B, T, M, Z
  securityCode?: string;    // BSE specific
  status?: 'Active' | 'Suspended' | 'Delisted';
  
  // F&O specific fields
  underlying_symbol?: string;
  strike_price?: number | undefined;
  expiry_date?: string;
  option_type?: 'CE' | 'PE' | 'FUT';
  lot_size?: number;
}

// Unified search result interface
export interface UnifiedSearchResult {
  equity: UnifiedSymbol[];
  options: UnifiedSymbol[];
  futures: UnifiedSymbol[];
  total: number;
}

// BSE Symbol interface
export interface BSESymbol {
  symbol: string;
  name: string;
  exchange: 'BSE';
  group: 'A' | 'B' | 'T' | 'M' | 'Z';
  isin: string;
  securityCode: string;
  status: 'Active' | 'Suspended' | 'Delisted';
}



// F&O instruments are now fetched dynamically from Upstox API
// No static data - all data comes from live Upstox instrument master

class SymbolDatabaseService {
  constructor() {
    console.log('🚀 Multi-Exchange Symbol Database Service initialized');
    console.log('📊 NSE CSV + BSE CSV + Live API integration enabled');
    console.log('🔗 Using NSE/BSE CSV for symbol search and live API for market data');
    console.log('📈 F&O instruments will be loaded dynamically from Upstox API');
  }

  /**
   * Search symbols across both NSE and BSE exchanges (legacy method)
   */
  async searchSymbols(query: string, limit: number = 10, exchange?: 'NSE' | 'BSE' | 'ALL'): Promise<UnifiedSymbol[]> {
    if (!query || query.length < 1) {
      return [];
    }

    try {
      const searchExchange = exchange || 'ALL';
      console.log(`🔍 Searching ${searchExchange} symbols for: "${query}"`);

      const results: UnifiedSymbol[] = [];

      // Search NSE symbols
      if (searchExchange === 'NSE' || searchExchange === 'ALL') {
        const nseResults = await this.searchNSESymbols(query, limit);
        results.push(...nseResults);
      }

      // Search BSE symbols
      if (searchExchange === 'BSE' || searchExchange === 'ALL') {
        const bseResults = await this.searchBSESymbols(query, limit);
        results.push(...bseResults);
      }

      // Sort by relevance and limit results
      const sortedResults = results
        .sort((a, b) => {
          // Prioritize exact matches
          const aExact = a.symbol.toLowerCase() === query.toLowerCase();
          const bExact = b.symbol.toLowerCase() === query.toLowerCase();
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          // Then prioritize starts with
          const aStarts = a.symbol.toLowerCase().startsWith(query.toLowerCase());
          const bStarts = b.symbol.toLowerCase().startsWith(query.toLowerCase());
          if (aStarts && !bStarts) return -1;
          if (!aStarts && bStarts) return 1;

          return 0;
        })
        .slice(0, limit);

      console.log(`✅ Found ${sortedResults.length} symbols for "${query}" across ${searchExchange}`);
      return sortedResults;

    } catch (error: any) {
      console.error(`❌ Error searching symbols:`, error.message);
      return [];
    }
  }

  /**
   * Search NSE symbols using CSV data
   */
  private async searchNSESymbols(query: string, limit: number): Promise<UnifiedSymbol[]> {
    try {
      // Use NSE CSV service for symbol search (faster and offline)
      const csvResults = nseCSVService.searchSymbols(query, limit);

      // Convert to unified format with NSE-specific trading symbol format
      const results: UnifiedSymbol[] = csvResults.map(symbol => ({
        symbol: symbol.symbol,                           // Display symbol (TCS)
        tradingSymbol: `${symbol.symbol}-${symbol.series}`, // Trading format (TCS-EQ)
        name: symbol.name,
        exchange: 'NSE' as const,
        instrument_type: 'EQUITY' as const,
        isin: symbol.isin,
        series: symbol.series,
        status: 'Active'
      }));

      return results;
    } catch (error: any) {
      console.error(`❌ Error searching NSE symbols:`, error.message);
      return [];
    }
  }

  /**
   * Search BSE symbols using CSV data
   */
  private async searchBSESymbols(query: string, limit: number): Promise<UnifiedSymbol[]> {
    try {
      // Use BSE CSV service for symbol search
      const csvResults = bseCSVService.searchSymbols(query, limit);

      // Convert to unified format with BSE-specific trading symbol format
      const results: UnifiedSymbol[] = csvResults.map(symbol => ({
        symbol: symbol.symbol,           // Display symbol (TCS)
        tradingSymbol: symbol.symbol,    // Trading format (TCS - plain for BSE)
        name: symbol.name,
        exchange: 'BSE' as const,
        instrument_type: 'EQUITY' as const,
        isin: symbol.isin,
        group: symbol.group,
        securityCode: symbol.securityCode,
        status: symbol.status
      }));

      return results;
    } catch (error: any) {
      console.error(`❌ Error searching BSE symbols:`, error.message);
      return [];
    }
  }

  /**
   * Get service stats
   */
  getStats(): any {
    return {
      service: 'Multi-Exchange CSV + Live API',
      status: 'active',
      searchType: 'csv_primary_api_fallback',
      supportedExchanges: ['NSE', 'BSE'],
      lastCheck: new Date().toISOString(),
      nseCSVServiceStats: nseCSVService.getStats(),
      bseCSVServiceStats: bseCSVService.getStats(),
      nseServiceStats: nseService.getStats()
    };
  }

  /**
   * Force update NSE CSV data
   */
  async forceUpdate(): Promise<void> {
    console.log('🔄 Force updating NSE CSV data...');
    await nseCSVService.forceUpdate();
  }

  /**
   * Get market status
   */
  async getMarketStatus(): Promise<any> {
    return nseService.getMarketStatus();
  }

  /**
   * Get top gainers
   */
  async getGainers(): Promise<any[]> {
    return nseService.getGainers();
  }

  /**
   * Get top losers
   */
  async getLosers(): Promise<any[]> {
    return nseService.getLosers();
  }

  /**
   * Get 52-week high stocks
   */
  async get52WeekHigh(): Promise<any[]> {
    return nseService.get52WeekHigh();
  }

  /**
   * Get 52-week low stocks
   */
  async get52WeekLow(): Promise<any[]> {
    return nseService.get52WeekLow();
  }

  /**
   * Get top value stocks
   */
  async getTopValueStocks(): Promise<any[]> {
    return nseService.getTopValueStocks();
  }

  /**
   * Get top volume stocks
   */
  async getTopVolumeStocks(): Promise<any[]> {
    return nseService.getTopVolumeStocks();
  }

  /**
   * Get all symbols from CSV data
   */
  getAllSymbols(): NSESymbol[] {
    const csvSymbols = nseCSVService.getAllSymbols();
    return csvSymbols.map(symbol => ({
      symbol: symbol.symbol,
      name: symbol.name,
      exchange: 'NSE',
      isin: symbol.isin,
      series: symbol.series
    }));
  }

  // ============================================================================
  // NEW: UNIFIED SEARCH METHODS (EQUITY + F&O)
  // ============================================================================

  /**
   * Search all instruments (equity + F&O) with unified results
   */
  async searchAllInstruments(query: string, limit: number = 20): Promise<UnifiedSearchResult> {
    if (!query || query.length < 1) {
      return { equity: [], options: [], futures: [], total: 0 };
    }

    try {
      console.log(`🔍 Unified search for: "${query}"`);

      const [equityResults, optionsResults, futuresResults] = await Promise.all([
        this.searchEquityInstruments(query, Math.ceil(limit / 3)),
        this.searchOptionsInstruments(query, Math.ceil(limit / 3)),
        this.searchFuturesInstruments(query, Math.ceil(limit / 3))
      ]);

      const result: UnifiedSearchResult = {
        equity: equityResults,
        options: optionsResults,
        futures: futuresResults,
        total: equityResults.length + optionsResults.length + futuresResults.length
      };

      console.log(`✅ Unified search found: ${result.total} instruments (${result.equity.length} equity, ${result.options.length} options, ${result.futures.length} futures)`);
      return result;

    } catch (error: any) {
      console.error(`❌ Error in unified search:`, error.message);
      return { equity: [], options: [], futures: [], total: 0 };
    }
  }

  /**
   * Search equity instruments only
   */
  async searchEquityInstruments(query: string, limit: number = 10): Promise<UnifiedSymbol[]> {
    // Use existing searchSymbols method but ensure instrument_type is set
    const results = await this.searchSymbols(query, limit, 'ALL');
    return results.map(symbol => ({
      ...symbol,
      instrument_type: 'EQUITY' as const
    }));
  }

  /**
   * Search options instruments (using static data)
   */
  async searchOptionsInstruments(query: string, limit: number = 10): Promise<UnifiedSymbol[]> {
    try {
      const searchQuery = query.toUpperCase();
      console.log(`🔍 Searching options for: "${searchQuery}"`);

      const { optionsDataService } = await import('./optionsDataService');
      const ceResults = await optionsDataService.searchInstruments(searchQuery, 'CE');
      const peResults = await optionsDataService.searchInstruments(searchQuery, 'PE');
      
      const combinedResults = [...ceResults, ...peResults]
        .slice(0, limit)
        .map(option => ({
          symbol: option.trading_symbol,
          tradingSymbol: option.trading_symbol,
          name: option.name || option.trading_symbol,
          exchange: option.exchange,
          instrument_type: 'OPTION' as const,
          underlying_symbol: option.underlying,
          strike_price: option.strike,
          expiry_date: option.expiry,
          option_type: option.option_type,
          lot_size: option.lot_size,
          status: 'Active' as const
        }));

      console.log(`✅ Found ${combinedResults.length} options from Upstox for "${searchQuery}"`);
      return combinedResults;
    } catch (error: any) {
      console.error(`❌ Error searching options from Upstox:`, error.message);
      throw new Error(`Failed to search options: ${error.message}`);
    }
  }

  /**
   * Search futures instruments (using static data)
   */
  async searchFuturesInstruments(query: string, limit: number = 10): Promise<UnifiedSymbol[]> {
    try {
      const searchQuery = query.toUpperCase();
      console.log(`🔍 Searching futures for: "${searchQuery}"`);

      const { optionsDataService } = await import('./optionsDataService');
      const futureResults = await optionsDataService.searchInstruments(searchQuery, 'FUT');
      
      const transformedResults = futureResults
        .slice(0, limit)
        .map(future => ({
          symbol: future.trading_symbol,
          tradingSymbol: future.trading_symbol,
          name: future.name || future.trading_symbol,
          exchange: future.exchange,
          instrument_type: 'FUTURE' as const,
          underlying_symbol: future.underlying,
          expiry_date: future.expiry,
          lot_size: future.lot_size,
          status: 'Active' as const
        }));

      console.log(`✅ Found ${transformedResults.length} futures from Upstox for "${searchQuery}"`);
      return transformedResults;
    } catch (error: any) {
      console.error(`❌ Error searching futures from Upstox:`, error.message);
      throw new Error(`Failed to search futures: ${error.message}`);
    }
  }

  /**
   * Get option chain for a specific underlying (using Upstox data)
   */
  async getOptionChain(underlyingSymbol: string, expiry?: string): Promise<UnifiedSymbol[]> {
    try {
      const searchSymbol = underlyingSymbol.toUpperCase();
      console.log(`🔍 Getting option chain for: "${searchSymbol}", expiry: ${expiry || 'all'}`);
      
      const { optionsDataService } = await import('./optionsDataService');
      const ceResults = await optionsDataService.searchInstruments(searchSymbol, 'CE');
      const peResults = await optionsDataService.searchInstruments(searchSymbol, 'PE');
      
      const combinedResults = [...ceResults, ...peResults]
        .filter(option => 
          option.underlying === searchSymbol &&
          (!expiry || option.expiry === expiry)
        )
        .map(option => ({
          symbol: option.trading_symbol,
          tradingSymbol: option.trading_symbol,
          name: option.name || option.trading_symbol,
          exchange: option.exchange,
          instrument_type: 'OPTION' as const,
          underlying_symbol: option.underlying,
          strike_price: option.strike,
          expiry_date: option.expiry,
          option_type: option.option_type,
          lot_size: option.lot_size,
          status: 'Active' as const
        }))
        .sort((a, b) => {
          // Sort by strike price
          if (a.strike_price && b.strike_price) {
            return a.strike_price - b.strike_price;
          }
          return 0;
        });

      console.log(`✅ Found ${combinedResults.length} options in chain for "${searchSymbol}"`);
      return combinedResults;
    } catch (error: any) {
      console.error(`❌ Error getting option chain from Upstox:`, error.message);
      throw new Error(`Failed to get option chain: ${error.message}`);
    }
  }

  /**
   * Get expiry dates for an underlying (using Upstox data)
   */
  async getExpiryDates(underlyingSymbol: string): Promise<string[]> {
    try {
      const searchSymbol = underlyingSymbol.toUpperCase();
      console.log(`🔍 Getting expiry dates for: "${searchSymbol}"`);
      
      const { optionsDataService } = await import('./optionsDataService');
      const ceResults = await optionsDataService.searchInstruments(searchSymbol, 'CE');
      const peResults = await optionsDataService.searchInstruments(searchSymbol, 'PE');
      const futResults = await optionsDataService.searchInstruments(searchSymbol, 'FUT');
      
      const allResults = [...ceResults, ...peResults, ...futResults];
      
      const expiries = allResults
        .filter(inst => inst.underlying === searchSymbol)
        .map(inst => inst.expiry)
        .filter((expiry, index, arr) => arr.indexOf(expiry) === index) // Remove duplicates
        .filter(expiry => expiry) // Remove null/undefined
        .sort();
        
      console.log(`✅ Found ${expiries.length} expiry dates for "${searchSymbol}"`);
      return expiries;
    } catch (error: any) {
      console.error(`❌ Error getting expiry dates from Upstox:`, error.message);
      throw new Error(`Failed to get expiry dates: ${error.message}`);
    }
  }
  /**
   * Get equity instruments (limited list)
   */
  async getEquityInstruments(limit: number = 50): Promise<UnifiedSymbol[]> {
    try {
      // Use existing search method to get equity symbols
      const results = await this.searchSymbols('', limit, 'ALL');
      return results.filter(symbol => symbol.instrument_type === 'EQUITY').slice(0, limit);
    } catch (error) {
      console.error('❌ Error getting equity instruments:', error);
      return [];
    }
  }

  /**
   * Get options instruments (limited list)
   */
  async getOptionsInstruments(limit: number = 50): Promise<UnifiedSymbol[]> {
    try {
      const { optionsDataService } = await import('./optionsDataService');
      
      // Get all options from database (use a broad search)
      const ceResults = await optionsDataService.searchInstruments('.', 'CE');
      const peResults = await optionsDataService.searchInstruments('.', 'PE');
      
      const combinedResults = [...ceResults, ...peResults]
        .slice(0, limit)
        .map(option => ({
          symbol: option.trading_symbol,
          tradingSymbol: option.trading_symbol,
          name: option.name || option.trading_symbol,
          exchange: option.exchange,
          instrument_type: 'OPTION' as const,
          underlying_symbol: option.underlying,
          strike_price: option.strike,
          expiry_date: option.expiry,
          option_type: option.option_type,
          lot_size: option.lot_size,
          status: 'Active' as const
        }));

      console.log(`✅ Retrieved ${combinedResults.length} options from Upstox database`);
      return combinedResults;
    } catch (error) {
      console.error('❌ Error getting options instruments from Upstox:', error);
      throw new Error(`Failed to get options instruments: ${error}`);
    }
  }

  /**
   * Get futures instruments (limited list)
   */
  async getFuturesInstruments(limit: number = 50): Promise<UnifiedSymbol[]> {
    try {
      const { optionsDataService } = await import('./optionsDataService');
      
      // Get all futures from database (use a broad search)
      const futureResults = await optionsDataService.searchInstruments('.', 'FUT');
      
      const transformedResults = futureResults
        .slice(0, limit)
        .map(future => ({
          symbol: future.trading_symbol,
          tradingSymbol: future.trading_symbol,
          name: future.name || future.trading_symbol,
          exchange: future.exchange,
          instrument_type: 'FUTURE' as const,
          underlying_symbol: future.underlying,
          expiry_date: future.expiry,
          lot_size: future.lot_size,
          status: 'Active' as const
        }));

      console.log(`✅ Retrieved ${transformedResults.length} futures from Upstox database`);
      return transformedResults;
    } catch (error) {
      console.error('❌ Error getting futures instruments from Upstox:', error);
      throw new Error(`Failed to get futures instruments: ${error}`);
    }
  }
}

export const symbolDatabaseService = new SymbolDatabaseService();
export type { NSESymbol };
