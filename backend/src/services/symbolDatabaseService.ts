import { nseService, NSESymbol } from './nseService';

class SymbolDatabaseService {
  constructor() {
    console.log('🚀 NSE Symbol Database Service initialized');
    console.log('📊 Direct NSE API integration enabled');
    console.log('🔗 Using integrated NSE service');
  }

  /**
   * Search symbols using NSE Direct API
   */
  async searchSymbols(query: string, limit: number = 10): Promise<NSESymbol[]> {
    if (!query || query.length < 1) {
      return [];
    }

    try {
      console.log(`🔍 Searching NSE stocks for: "${query}"`);

      // Use NSE Direct API for symbol search
      const results = await nseService.searchStocks(query);

      console.log(`📊 Found ${results.length} NSE stocks for "${query}"`);
      return results.slice(0, limit);

    } catch (error: any) {
      console.error('❌ NSE API search failed:', error.message);
      return [];
    }
  }



  /**
   * Get service stats
   */
  getStats(): any {
    return {
      service: 'NSE Direct API',
      status: 'active',
      searchType: 'live_api',
      supportedExchanges: ['NSE'],
      lastCheck: new Date().toISOString(),
      nseServiceStats: nseService.getStats()
    };
  }

  /**
   * Force update (not needed for live API)
   */
  async forceUpdate(): Promise<void> {
    console.log('🔄 Using live API - no update needed');
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
   * Get all symbols (returns empty array - use search instead)
   */
  getAllSymbols(): NSESymbol[] {
    return [];
  }
}

export const symbolDatabaseService = new SymbolDatabaseService();
export type { NSESymbol };
