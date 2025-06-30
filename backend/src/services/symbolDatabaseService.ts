import { nseService, NSESymbol } from './nseService';
import { nseCSVService, NSESymbolData } from './nseCSVService';

// Unified symbol interface for multi-exchange support
export interface UnifiedSymbol {
  symbol: string;           // Display symbol (TCS, AAKASH)
  tradingSymbol: string;    // Exchange-specific format (TCS-EQ for NSE, TCS for BSE)
  name: string;
  exchange: 'NSE' | 'BSE';
  isin: string;
  series?: string;          // NSE: EQ, BE, etc.
  group?: string;           // BSE: A, B, T, M, Z
  securityCode?: string;    // BSE specific
  status?: 'Active' | 'Suspended' | 'Delisted';
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

// Sample BSE symbols data (to be replaced with real data source)
const BSE_SAMPLE_SYMBOLS: BSESymbol[] = [
  {
    symbol: 'TCS',
    name: 'Tata Consultancy Services Limited',
    exchange: 'BSE',
    group: 'A',
    isin: 'INE467B01029',
    securityCode: '532540',
    status: 'Active'
  },
  {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Limited',
    exchange: 'BSE',
    group: 'A',
    isin: 'INE002A01018',
    securityCode: '500325',
    status: 'Active'
  },
  {
    symbol: 'INFY',
    name: 'Infosys Limited',
    exchange: 'BSE',
    group: 'A',
    isin: 'INE009A01021',
    securityCode: '500209',
    status: 'Active'
  },
  {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Limited',
    exchange: 'BSE',
    group: 'A',
    isin: 'INE040A01034',
    securityCode: '500180',
    status: 'Active'
  },
  {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Limited',
    exchange: 'BSE',
    group: 'A',
    isin: 'INE090A01021',
    securityCode: '532174',
    status: 'Active'
  },
  {
    symbol: 'AAKASH',
    name: 'Aakash Exploration Services Limited',
    exchange: 'BSE',
    group: 'B',
    isin: 'INE087Q01018',
    securityCode: '540683',
    status: 'Active'
  }
];

class SymbolDatabaseService {
  constructor() {
    console.log('🚀 NSE Symbol Database Service initialized');
    console.log('📊 NSE CSV + Live API integration enabled');
    console.log('🔗 Using NSE CSV for symbol search and live API for market data');
  }

  /**
   * Search symbols across both NSE and BSE exchanges
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
   * Search BSE symbols using sample data (to be replaced with real data source)
   */
  private async searchBSESymbols(query: string, limit: number): Promise<UnifiedSymbol[]> {
    try {
      const searchTerm = query.toLowerCase();

      // Filter BSE symbols
      const filteredSymbols = BSE_SAMPLE_SYMBOLS.filter(symbol =>
        symbol.symbol.toLowerCase().includes(searchTerm) ||
        symbol.name.toLowerCase().includes(searchTerm)
      );

      // Convert to unified format with BSE-specific trading symbol format
      const results: UnifiedSymbol[] = filteredSymbols.slice(0, limit).map(symbol => ({
        symbol: symbol.symbol,           // Display symbol (TCS)
        tradingSymbol: symbol.symbol,    // Trading format (TCS - plain for BSE)
        name: symbol.name,
        exchange: 'BSE' as const,
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
      service: 'NSE CSV + Live API',
      status: 'active',
      searchType: 'csv_primary_api_fallback',
      supportedExchanges: ['NSE'],
      lastCheck: new Date().toISOString(),
      csvServiceStats: nseCSVService.getStats(),
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
}

export const symbolDatabaseService = new SymbolDatabaseService();
export type { NSESymbol };
