/**
 * NSE (National Stock Exchange) Service
 * Integrated from stock-market-india repository
 * Provides comprehensive NSE market data without broker dependencies
 */

import axios, { AxiosResponse } from 'axios';

// NSE API Constants
const NSE_CONSTANTS = {
  MARKET_STATUS_URL: 'https://www1.nseindia.com//emerge/homepage/smeNormalMktStatus.json',
  INDICES_WATCH_URL: 'https://www1.nseindia.com/live_market/dynaContent/live_watch/stock_watch/liveIndexWatchData.json',
  SECTORS_LIST: 'https://www1.nseindia.com/homepage/peDetails.json',
  QUOTE_INFO_URL: 'https://www1.nseindia.com/live_market/dynaContent/live_watch/get_quote/ajaxGetQuoteJSON.jsp?series=EQ&symbol=',
  GET_QUOTE_URL: 'https://www1.nseindia.com/live_market/dynaContent/live_watch/get_quote/GetQuote.jsp?symbol=',
  GAINERS_URL: 'https://www1.nseindia.com/live_market/dynaContent/live_analysis/gainers/niftyGainers1.json',
  LOSERS_URL: 'https://www1.nseindia.com/live_market/dynaContent/live_analysis/losers/niftyLosers1.json',
  ADVANCES_DECLINES_URL: 'https://www1.nseindia.com/common/json/indicesAdvanceDeclines.json',
  INDEX_STOCKS_URL: 'https://www1.nseindia.com/live_market/dynaContent/live_watch/stock_watch/',
  SEARCH_URL: 'https://www1.nseindia.com/live_market/dynaContent/live_watch/get_quote/ajaxCompanySearch.jsp?search=',
  YEAR_HIGH_URL: 'https://www1.nseindia.com/products/dynaContent/equities/equities/json/online52NewHigh.json',
  YEAR_LOW_URL: 'https://www1.nseindia.com/products/dynaContent/equities/equities/json/online52NewLow.json',
  TOP_VALUE_URL: 'https://www1.nseindia.com/live_market/dynaContent/live_analysis/most_active/allTopValue1.json',
  TOP_VOLUME_URL: 'https://www1.nseindia.com/live_market/dynaContent/live_analysis/most_active/allTopVolume1.json',
  NEW_CHART_DATA_URL: 'https://www1.nseindia.com/ChartApp/install/charts/data/GetHistoricalNew.jsp'
};

// Common headers for NSE requests
const NSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// Interfaces
export interface NSESymbol {
  symbol: string;
  name: string;
  exchange: string;
  isin?: string;
  series?: string;
  listingDate?: string;
}

export interface NSEQuote {
  symbol: string;
  companyName: string;
  lastPrice: number;
  change: number;
  pChange: number;
  previousClose: number;
  open: number;
  close: number;
  vwap: number;
  lowerCP: string;
  upperCP: string;
  pPriceBand: string;
  basePrice: number;
  intraDayHighLow: {
    min: number;
    max: number;
    value: number;
  };
  weekHighLow: {
    min: number;
    minDate: string;
    max: number;
    maxDate: string;
    value: number;
  };
  iNavValue: null;
  checkINAV: boolean;
  tickSize: number;
  marketStatus: {
    market: string;
    marketStatus: string;
    tradeDate: string;
    index: string;
    last: number;
    variation: number;
    percentChange: number;
  };
  isExDateFlag: boolean;
  isDebtSec: boolean;
  isSuspended: boolean;
  isETFSec: boolean;
  isDelisted: boolean;
  isin: string;
  slbIndicator: null;
  classOfShare: string;
  derivatives: string;
  surveillance: {
    surv: null;
    desc: null;
  };
  faceValue: number;
  issuedSize: number;
  extCm: {
    excToken: string;
    preopen: boolean;
    activeSeries: string[];
  };
}

export interface NSEMarketIndex {
  name: string;
  last: number;
  variation: number;
  percentChange: number;
  imgFileName: string;
}

export interface NSEGainerLoser {
  symbol: string;
  series: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  ltp: number;
  previousPrice: number;
  netPrice: number;
  tradedQuantity: number;
  turnoverInLakhs: number;
  lastCorpAnnouncementDate: string;
  lastCorpAnnouncement: string;
}

class NSEService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor() {
    console.log('🚀 NSE Service initialized');
    console.log('📊 Direct NSE API integration enabled');
  }

  /**
   * Make HTTP request with proper headers and error handling
   */
  private async makeRequest(url: string, options: any = {}): Promise<any> {
    try {
      const response = await axios.get(url, {
        headers: { ...NSE_HEADERS, ...options.headers },
        timeout: 10000,
        ...options
      });
      return response.data;
    } catch (error: any) {
      console.error(`❌ NSE API request failed for ${url}:`, error.message);
      throw new Error(`NSE API error: ${error.message}`);
    }
  }

  /**
   * Get cached data or fetch fresh data
   */
  private async getCachedOrFetch(key: string, fetchFn: () => Promise<any>): Promise<any> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
      return cached.data;
    }

    try {
      const data = await fetchFn();
      this.cache.set(key, { data, timestamp: now });
      return data;
    } catch (error) {
      // Return cached data if available, even if expired
      if (cached) {
        console.warn(`⚠️ Using expired cache for ${key}`);
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Strip HTML tags from string
   */
  private stripTags(str: string): string {
    return str.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * Transform search results from NSE HTML response
   */
  private transformSearchResults(data: string): NSESymbol[] {
    try {
      const matches = data.match(/<li.*?<\/li>/g);
      if (!matches) return [];

      return matches.map(value => {
        const symbolMatch = value.match(/symbol=(.*?)&/);
        const cleanText = this.stripTags(value);
        const symbol = symbolMatch?.[1] || '';
        const name = cleanText.replace(symbol, '').trim();

        return {
          symbol: symbol,
          name: name || symbol,
          exchange: 'NSE',
          series: 'EQ'
        };
      }).filter(item => item.symbol && item.name);
    } catch (error) {
      console.error('❌ Error transforming search results:', error);
      return [];
    }
  }

  /**
   * Get market status (open/closed)
   */
  async getMarketStatus(): Promise<{ status: string; isOpen: boolean }> {
    return this.getCachedOrFetch('market_status', async () => {
      const data = await this.makeRequest(NSE_CONSTANTS.MARKET_STATUS_URL);
      const status = data?.NormalMktStatus || 'Unknown';
      return {
        status,
        isOpen: status.toLowerCase().includes('open')
      };
    });
  }

  /**
   * Get live market indices
   */
  async getIndices(): Promise<NSEMarketIndex[]> {
    return this.getCachedOrFetch('indices', async () => {
      const data = await this.makeRequest(NSE_CONSTANTS.INDICES_WATCH_URL);
      return data?.data || [];
    });
  }

  /**
   * Search stocks by symbol or company name
   */
  async searchStocks(query: string): Promise<NSESymbol[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `search_${query.toLowerCase()}`;
    return this.getCachedOrFetch(cacheKey, async () => {
      const url = NSE_CONSTANTS.SEARCH_URL + encodeURIComponent(query);
      const data = await this.makeRequest(url, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://www1.nseindia.com/ChartApp/install/charts/mainpage.jsp',
          'Host': 'www1.nseindia.com'
        }
      });

      return this.transformSearchResults(data);
    });
  }

  /**
   * Get detailed quote information for a symbol
   */
  async getQuoteInfo(symbol: string): Promise<NSEQuote | null> {
    const cacheKey = `quote_${symbol}`;
    return this.getCachedOrFetch(cacheKey, async () => {
      const url = NSE_CONSTANTS.QUOTE_INFO_URL + encodeURIComponent(symbol);
      const data = await this.makeRequest(url, {
        headers: {
          'Referer': NSE_CONSTANTS.GET_QUOTE_URL + encodeURIComponent(symbol),
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      return data?.data?.[0] || null;
    });
  }

  /**
   * Get multiple quote information
   */
  async getMultipleQuoteInfo(symbols: string[]): Promise<(NSEQuote | null)[]> {
    const promises = symbols.map(symbol => this.getQuoteInfo(symbol));
    return Promise.all(promises);
  }

  /**
   * Get top gainers
   */
  async getGainers(): Promise<NSEGainerLoser[]> {
    return this.getCachedOrFetch('gainers', async () => {
      const data = await this.makeRequest(NSE_CONSTANTS.GAINERS_URL);
      return data?.data || [];
    });
  }

  /**
   * Get top losers
   */
  async getLosers(): Promise<NSEGainerLoser[]> {
    return this.getCachedOrFetch('losers', async () => {
      const data = await this.makeRequest(NSE_CONSTANTS.LOSERS_URL);
      return data?.data || [];
    });
  }

  /**
   * Get 52-week high stocks
   */
  async get52WeekHigh(): Promise<any[]> {
    return this.getCachedOrFetch('52_week_high', async () => {
      const data = await this.makeRequest(NSE_CONSTANTS.YEAR_HIGH_URL, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Host': 'www1.nseindia.com',
          'Referer': 'https://www1.nseindia.com/products/content/equities/equities/eq_new_high_low.htm'
        }
      });
      return data?.data || [];
    });
  }

  /**
   * Get 52-week low stocks
   */
  async get52WeekLow(): Promise<any[]> {
    return this.getCachedOrFetch('52_week_low', async () => {
      const data = await this.makeRequest(NSE_CONSTANTS.YEAR_LOW_URL, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Host': 'www1.nseindia.com',
          'Referer': 'https://nseindia.com/products/content/equities/equities/eq_new_high_low.htm'
        }
      });
      return data?.data || [];
    });
  }

  /**
   * Get top value stocks
   */
  async getTopValueStocks(): Promise<any[]> {
    return this.getCachedOrFetch('top_value', async () => {
      const data = await this.makeRequest(NSE_CONSTANTS.TOP_VALUE_URL, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Host': 'www1.nseindia.com',
          'Referer': 'https://www1.nseindia.com/live_market/dynaContent/live_analysis/most_active_securities.htm'
        }
      });
      return data?.data || [];
    });
  }

  /**
   * Get top volume stocks
   */
  async getTopVolumeStocks(): Promise<any[]> {
    return this.getCachedOrFetch('top_volume', async () => {
      const data = await this.makeRequest(NSE_CONSTANTS.TOP_VOLUME_URL, {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Host': 'www1.nseindia.com',
          'Referer': 'https://www1.nseindia.com/live_market/dynaContent/live_analysis/most_active_securities.htm'
        }
      });
      return data?.data || [];
    });
  }

  /**
   * Get service statistics
   */
  getStats(): any {
    return {
      service: 'NSE Direct API',
      status: 'active',
      cacheSize: this.cache.size,
      cacheDuration: this.CACHE_DURATION,
      supportedFeatures: [
        'symbol_search',
        'quote_info',
        'market_indices',
        'gainers_losers',
        '52_week_high_low',
        'top_value_volume'
      ],
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ NSE Service cache cleared');
  }
}

export const nseService = new NSEService();
export default nseService;
