import { nseService, NSESymbol } from './nseService';
import { nseCSVService, NSESymbolData } from './nseCSVService';
import { bseCSVService, BSESymbolData } from './bseCSVService';
import { optionsDatabase } from './optionsDatabase';
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



// Static F&O instruments for testing (no API calls needed)
const STATIC_FO_INSTRUMENTS = [
  // RELIANCE Options
  { symbol: "RELIANCE24FEB3000CE", tradingSymbol: "RELIANCE24FEB3000CE", name: "RELIANCE 3000 CE", instrument_type: "OPTION" as const, underlying_symbol: "RELIANCE", strike_price: 3000, expiry_date: "2024-02-29", option_type: "CE" as const, lot_size: 250, exchange: "NFO" as const, status: "Active" as const },
  { symbol: "RELIANCE24FEB3000PE", tradingSymbol: "RELIANCE24FEB3000PE", name: "RELIANCE 3000 PE", instrument_type: "OPTION" as const, underlying_symbol: "RELIANCE", strike_price: 3000, expiry_date: "2024-02-29", option_type: "PE" as const, lot_size: 250, exchange: "NFO" as const, status: "Active" as const },
  { symbol: "RELIANCE24FEB3100CE", tradingSymbol: "RELIANCE24FEB3100CE", name: "RELIANCE 3100 CE", instrument_type: "OPTION" as const, underlying_symbol: "RELIANCE", strike_price: 3100, expiry_date: "2024-02-29", option_type: "CE" as const, lot_size: 250, exchange: "NFO" as const, status: "Active" as const },
  { symbol: "RELIANCE24FEB3100PE", tradingSymbol: "RELIANCE24FEB3100PE", name: "RELIANCE 3100 PE", instrument_type: "OPTION" as const, underlying_symbol: "RELIANCE", strike_price: 3100, expiry_date: "2024-02-29", option_type: "PE" as const, lot_size: 250, exchange: "NFO" as const, status: "Active" as const },
  
  // NIFTY Options
  { symbol: "NIFTY24FEB21000CE", tradingSymbol: "NIFTY24FEB21000CE", name: "NIFTY 21000 CE", instrument_type: "OPTION" as const, underlying_symbol: "NIFTY", strike_price: 21000, expiry_date: "2024-02-29", option_type: "CE" as const, lot_size: 50, exchange: "NFO" as const, status: "Active" as const },
  { symbol: "NIFTY24FEB21000PE", tradingSymbol: "NIFTY24FEB21000PE", name: "NIFTY 21000 PE", instrument_type: "OPTION" as const, underlying_symbol: "NIFTY", strike_price: 21000, expiry_date: "2024-02-29", option_type: "PE" as const, lot_size: 50, exchange: "NFO" as const, status: "Active" as const },
  { symbol: "NIFTY24FEB21500CE", tradingSymbol: "NIFTY24FEB21500CE", name: "NIFTY 21500 CE", instrument_type: "OPTION" as const, underlying_symbol: "NIFTY", strike_price: 21500, expiry_date: "2024-02-29", option_type: "CE" as const, lot_size: 50, exchange: "NFO" as const, status: "Active" as const },
  { symbol: "NIFTY24FEB21500PE", tradingSymbol: "NIFTY24FEB21500PE", name: "NIFTY 21500 PE", instrument_type: "OPTION" as const, underlying_symbol: "NIFTY", strike_price: 21500, expiry_date: "2024-02-29", option_type: "PE" as const, lot_size: 50, exchange: "NFO" as const, status: "Active" as const },
  
  // TCS Options
  { symbol: "TCS24FEB4000CE", tradingSymbol: "TCS24FEB4000CE", name: "TCS 4000 CE", instrument_type: "OPTION" as const, underlying_symbol: "TCS", strike_price: 4000, expiry_date: "2024-02-29", option_type: "CE" as const, lot_size: 150, exchange: "NFO" as const, status: "Active" as const },
  { symbol: "TCS24FEB4000PE", tradingSymbol: "TCS24FEB4000PE", name: "TCS 4000 PE", instrument_type: "OPTION" as const, underlying_symbol: "TCS", strike_price: 4000, expiry_date: "2024-02-29", option_type: "PE" as const, lot_size: 150, exchange: "NFO" as const, status: "Active" as const },
  
  // Futures
  { symbol: "RELIANCE24FEBFUT", tradingSymbol: "RELIANCE24FEBFUT", name: "RELIANCE Future", instrument_type: "FUTURE" as const, underlying_symbol: "RELIANCE", expiry_date: "2024-02-29", lot_size: 250, exchange: "NFO" as const, status: "Active" as const },
  { symbol: "NIFTY24FEBFUT", tradingSymbol: "NIFTY24FEBFUT", name: "NIFTY Future", instrument_type: "FUTURE" as const, underlying_symbol: "NIFTY", expiry_date: "2024-02-29", lot_size: 50, exchange: "NFO" as const, status: "Active" as const },
  { symbol: "TCS24FEBFUT", tradingSymbol: "TCS24FEBFUT", name: "TCS Future", instrument_type: "FUTURE" as const, underlying_symbol: "TCS", expiry_date: "2024-02-29", lot_size: 150, exchange: "NFO" as const, status: "Active" as const }
];

class SymbolDatabaseService {
  constructor() {
    console.log('🚀 Multi-Exchange Symbol Database Service initialized');
    console.log('📊 NSE CSV + BSE CSV + Live API integration enabled');
    console.log('🔗 Using NSE/BSE CSV for symbol search and live API for market data');
    console.log(`📈 Static F&O instruments loaded: ${STATIC_FO_INSTRUMENTS.length} instruments`);
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
      
      // Search by underlying symbol or direct option symbol
      const optionInstruments = STATIC_FO_INSTRUMENTS
        .filter(inst => 
          inst.instrument_type === 'OPTION' && 
          (inst.underlying_symbol.includes(searchQuery) || inst.symbol.includes(searchQuery))
        )
        .slice(0, limit);

      console.log(`📊 Found ${optionInstruments.length} options for "${query}"`);
      return optionInstruments;
    } catch (error: any) {
      console.error(`❌ Error searching options:`, error.message);
      return [];
    }
  }

  /**
   * Search futures instruments (using static data)
   */
  async searchFuturesInstruments(query: string, limit: number = 10): Promise<UnifiedSymbol[]> {
    try {
      const searchQuery = query.toUpperCase();
      
      // Search by underlying symbol or direct future symbol
      const futureInstruments = STATIC_FO_INSTRUMENTS
        .filter(inst => 
          inst.instrument_type === 'FUTURE' && 
          (inst.underlying_symbol.includes(searchQuery) || inst.symbol.includes(searchQuery))
        )
        .slice(0, limit);

      console.log(`📊 Found ${futureInstruments.length} futures for "${query}"`);
      return futureInstruments;
    } catch (error: any) {
      console.error(`❌ Error searching futures:`, error.message);
      return [];
    }
  }

  /**
   * Get option chain for a specific underlying (using static data)
   */
  async getOptionChain(underlyingSymbol: string, expiry?: string): Promise<UnifiedSymbol[]> {
    try {
      const searchSymbol = underlyingSymbol.toUpperCase();
      
      return STATIC_FO_INSTRUMENTS
        .filter(inst => 
          inst.instrument_type === 'OPTION' && 
          inst.underlying_symbol === searchSymbol &&
          (!expiry || inst.expiry_date === expiry)
        )
        .sort((a, b) => {
          // Sort by strike price
          if (a.strike_price && b.strike_price) {
            return a.strike_price - b.strike_price;
          }
          return 0;
        });
    } catch (error: any) {
      console.error(`❌ Error getting option chain:`, error.message);
      return [];
    }
  }

  /**
   * Get expiry dates for an underlying (using static data)
   */
  async getExpiryDates(underlyingSymbol: string): Promise<string[]> {
    try {
      const searchSymbol = underlyingSymbol.toUpperCase();
      
      const expiries = STATIC_FO_INSTRUMENTS
        .filter(inst => inst.underlying_symbol === searchSymbol)
        .map(inst => inst.expiry_date)
        .filter((expiry, index, arr) => arr.indexOf(expiry) === index) // Remove duplicates
        .sort();
        
      return expiries;
    } catch (error: any) {
      console.error(`❌ Error getting expiry dates:`, error.message);
      return [];
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
      const optionsData = STATIC_FO_INSTRUMENTS
        .filter(instrument => instrument.instrument_type === 'OPTION')
        .slice(0, limit);
      
      return optionsData.map(option => ({
        symbol: option.symbol,
        tradingSymbol: option.tradingSymbol,
        name: option.name,
        exchange: option.exchange,
        instrument_type: option.instrument_type,
        underlying_symbol: option.underlying_symbol,
        strike_price: option.strike_price,
        expiry_date: option.expiry_date,
        option_type: option.option_type,
        lot_size: option.lot_size,
        status: option.status
      }));
    } catch (error) {
      console.error('❌ Error getting options instruments:', error);
      return [];
    }
  }

  /**
   * Get futures instruments (limited list)
   */
  async getFuturesInstruments(limit: number = 50): Promise<UnifiedSymbol[]> {
    try {
      const futuresData = STATIC_FO_INSTRUMENTS
        .filter(instrument => instrument.instrument_type === 'FUTURE')
        .slice(0, limit);
      
      return futuresData.map(future => ({
        symbol: future.symbol,
        tradingSymbol: future.tradingSymbol,
        name: future.name,
        exchange: future.exchange,
        instrument_type: future.instrument_type,
        underlying_symbol: future.underlying_symbol,
        expiry_date: future.expiry_date,
        lot_size: future.lot_size,
        status: future.status
      }));
    } catch (error) {
      console.error('❌ Error getting futures instruments:', error);
      return [];
    }
  }
}

export const symbolDatabaseService = new SymbolDatabaseService();
export type { NSESymbol };
