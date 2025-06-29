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

      // Fallback to static popular stocks if API fails
      return this.getFallbackSymbols(query, limit);
    }
  }

  /**
   * Fallback symbols for common Indian stocks
   */
  private getFallbackSymbols(query: string, limit: number): NSESymbol[] {
    const popularStocks: NSESymbol[] = [
      { symbol: 'RELIANCE', name: 'Reliance Industries Limited', exchange: 'NSE' },
      { symbol: 'TCS', name: 'Tata Consultancy Services Limited', exchange: 'NSE' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Limited', exchange: 'NSE' },
      { symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE' },
      { symbol: 'ICICIBANK', name: 'ICICI Bank Limited', exchange: 'NSE' },
      { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Limited', exchange: 'NSE' },
      { symbol: 'BHARTIARTL', name: 'Bharti Airtel Limited', exchange: 'NSE' },
      { symbol: 'ITC', name: 'ITC Limited', exchange: 'NSE' },
      { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
      { symbol: 'LT', name: 'Larsen & Toubro Limited', exchange: 'NSE' },
      { symbol: 'ASIANPAINT', name: 'Asian Paints Limited', exchange: 'NSE' },
      { symbol: 'MARUTI', name: 'Maruti Suzuki India Limited', exchange: 'NSE' },
      { symbol: 'BAJFINANCE', name: 'Bajaj Finance Limited', exchange: 'NSE' },
      { symbol: 'HCLTECH', name: 'HCL Technologies Limited', exchange: 'NSE' },
      { symbol: 'WIPRO', name: 'Wipro Limited', exchange: 'NSE' }
    ];

    const queryLower = query.toLowerCase();
    return popularStocks.filter(stock =>
      stock.symbol.toLowerCase().includes(queryLower) ||
      stock.name.toLowerCase().includes(queryLower)
    ).slice(0, limit);
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
      fallbackSymbols: 15,
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
   * Get all symbols (returns popular symbols for live API)
   */
  getAllSymbols(): NSESymbol[] {
    return this.getFallbackSymbols('', 15);
  }
}

export const symbolDatabaseService = new SymbolDatabaseService();
export type { NSESymbol };
