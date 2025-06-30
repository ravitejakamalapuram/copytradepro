import { nseService, NSESymbol } from './nseService';
import { nseCSVService, NSESymbolData } from './nseCSVService';

class SymbolDatabaseService {
  constructor() {
    console.log('🚀 NSE Symbol Database Service initialized');
    console.log('📊 NSE CSV + Live API integration enabled');
    console.log('🔗 Using NSE CSV for symbol search and live API for market data');
  }

  /**
   * Search symbols using NSE CSV data (faster and more comprehensive)
   */
  async searchSymbols(query: string, limit: number = 10): Promise<NSESymbol[]> {
    if (!query || query.length < 1) {
      return [];
    }

    try {
      console.log(`🔍 Searching NSE symbols for: "${query}"`);

      // Use NSE CSV service for symbol search (faster and offline)
      const csvResults = nseCSVService.searchSymbols(query, limit);

      // Convert NSESymbolData to NSESymbol format
      const results: NSESymbol[] = csvResults.map(symbol => ({
        symbol: symbol.symbol,
        name: symbol.name,
        exchange: 'NSE',
        isin: symbol.isin,
        series: symbol.series
      }));

      console.log(`📊 Found ${results.length} NSE symbols for "${query}" from CSV data`);
      return results;

    } catch (error: any) {
      console.error('❌ NSE CSV search failed, falling back to API:', error.message);

      // Fallback to live API if CSV search fails
      try {
        const apiResults = await nseService.searchStocks(query);
        console.log(`📊 Found ${apiResults.length} NSE stocks from API fallback`);
        return apiResults.slice(0, limit);
      } catch (apiError: any) {
        console.error('❌ NSE API fallback also failed:', apiError.message);
        return [];
      }
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
