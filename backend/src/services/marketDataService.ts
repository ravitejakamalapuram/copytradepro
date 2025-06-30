import axios from 'axios';
import { nseService, NSEMarketIndex } from './nseService';

export interface MarketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  lastUpdated: Date;
  exchange: string;
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  lastUpdated: Date;
}

interface YahooFinanceQuote {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  marketState: string;
  fullExchangeName: string;
}

interface YahooFinanceResponse {
  quoteResponse: {
    result: YahooFinanceQuote[];
    error: any;
  };
}

class MarketDataService {
  private cache = new Map<string, { data: MarketPrice; timestamp: number }>();
  private readonly CACHE_DURATION = 30 * 1000; // 30 seconds cache
  private readonly YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';
  private readonly REQUEST_DELAY = 100; // 100ms between requests to avoid rate limiting

  /**
   * Convert internal symbol to Yahoo Finance format
   */
  private formatSymbolForYahoo(symbol: string, exchange: string = 'NSE'): string {
    // Remove any existing suffixes
    const cleanSymbol = symbol.replace(/\.(NS|BO)$/, '');
    
    // Add appropriate suffix based on exchange
    if (exchange === 'BSE') {
      return `${cleanSymbol}.BO`;
    } else {
      return `${cleanSymbol}.NS`; // Default to NSE
    }
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(symbol: string): boolean {
    const cached = this.cache.get(symbol);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < this.CACHE_DURATION;
  }

  /**
   * Get cached price if available and valid
   */
  private getCachedPrice(symbol: string): MarketPrice | null {
    if (this.isCacheValid(symbol)) {
      return this.cache.get(symbol)!.data;
    }
    return null;
  }

  /**
   * Cache market price data
   */
  private cachePrice(symbol: string, data: MarketPrice): void {
    this.cache.set(symbol, {
      data,
      timestamp: Date.now()
    });
  }



  /**
   * Fetch real-time price from NSE API with Yahoo Finance fallback
   */
  async getPrice(symbol: string, exchange: string = 'NSE'): Promise<MarketPrice | null> {
    try {
      // Check cache first
      const cached = this.getCachedPrice(symbol);
      if (cached) {
        return cached;
      }

      // Try NSE API first for NSE symbols
      if (exchange === 'NSE') {
        try {
          const nseQuote = await nseService.getQuoteInfo(symbol);
          if (nseQuote) {
            const marketPrice: MarketPrice = {
              symbol: symbol,
              price: nseQuote.lastPrice || 0,
              change: nseQuote.change || 0,
              changePercent: nseQuote.pChange || 0,
              volume: 0, // NSE API doesn't provide volume in this format
              lastUpdated: new Date(),
              exchange: 'NSE'
            };

            // Cache the result
            this.cachePrice(symbol, marketPrice);
            return marketPrice;
          }
        } catch (nseError) {
          console.warn(`⚠️ NSE API failed for ${symbol}, trying Yahoo Finance:`, nseError);
        }
      }

      // Fallback to Yahoo Finance (with graceful error handling)
      const yahooSymbol = this.formatSymbolForYahoo(symbol, exchange);

      const response = await axios.get<YahooFinanceResponse>(this.YAHOO_BASE_URL, {
        params: {
          symbols: yahooSymbol,
          fields: 'regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketState,fullExchangeName'
        },
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const quote = response.data?.quoteResponse?.result?.[0];
      if (!quote) {
        console.warn(`⚠️ No data available for ${symbol}`);
        return null;
      }

      const marketPrice: MarketPrice = {
        symbol: symbol,
        price: quote.regularMarketPrice || 0,
        change: quote.regularMarketChange || 0,
        changePercent: quote.regularMarketChangePercent || 0,
        volume: quote.regularMarketVolume || 0,
        lastUpdated: new Date(),
        exchange: quote.fullExchangeName || exchange
      };

      // Cache the result
      this.cachePrice(symbol, marketPrice);

      return marketPrice;

    } catch (error: any) {
      // Only log as warning if it's not a 401 error (which is expected for Yahoo Finance)
      if (error.response?.status === 401) {
        console.log(`📊 Yahoo Finance API access restricted for ${symbol} (using NSE API only)`);
      } else {
        console.warn(`⚠️ Failed to fetch ${symbol}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Fetch multiple prices in batch (with rate limiting)
   */
  async getPrices(symbols: string[], exchange: string = 'NSE'): Promise<Map<string, MarketPrice>> {
    const results = new Map<string, MarketPrice>();
    
    // Check cache first
    const uncachedSymbols: string[] = [];
    for (const symbol of symbols) {
      const cached = this.getCachedPrice(symbol);
      if (cached) {
        results.set(symbol, cached);
      } else {
        uncachedSymbols.push(symbol);
      }
    }

    // Fetch uncached symbols in batches to avoid rate limiting
    const batchSize = 10; // Yahoo Finance allows multiple symbols in one request
    for (let i = 0; i < uncachedSymbols.length; i += batchSize) {
      const batch = uncachedSymbols.slice(i, i + batchSize);
      
      try {
        const yahooSymbols = batch.map(symbol => this.formatSymbolForYahoo(symbol, exchange));
        
        const response = await axios.get<YahooFinanceResponse>(this.YAHOO_BASE_URL, {
          params: {
            symbols: yahooSymbols.join(','),
            fields: 'regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketState,fullExchangeName'
          },
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const quotes = response.data?.quoteResponse?.result || [];
        
        quotes.forEach((quote, index) => {
          if (quote && batch[index]) {
            const symbol = batch[index];
            const marketPrice: MarketPrice = {
              symbol: symbol,
              price: quote.regularMarketPrice || 0,
              change: quote.regularMarketChange || 0,
              changePercent: quote.regularMarketChangePercent || 0,
              volume: quote.regularMarketVolume || 0,
              lastUpdated: new Date(),
              exchange: quote.fullExchangeName || exchange
            };

            results.set(symbol, marketPrice);
            this.cachePrice(symbol, marketPrice);
          }
        });

        // Rate limiting delay between batches
        if (i + batchSize < uncachedSymbols.length) {
          await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
        }

      } catch (error: any) {
        console.error(`Failed to fetch batch prices:`, error.message);
        
        // Fallback: fetch individually for this batch
        for (const symbol of batch) {
          try {
            await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));
            const price = await this.getPrice(symbol, exchange);
            if (price) {
              results.set(symbol, price);
            }
          } catch (individualError) {
            console.error(`Failed to fetch individual price for ${symbol}:`, individualError);
          }
        }
      }
    }

    return results;
  }



  /**
   * Get major Indian market indices from NSE API with graceful fallback
   */
  async getMarketIndices(): Promise<MarketIndex[]> {
    try {
      // Try NSE API first
      const nseIndices = await nseService.getIndices();
      if (nseIndices && nseIndices.length > 0) {
        const results: MarketIndex[] = nseIndices.map((index: NSEMarketIndex) => ({
          name: index.name,
          value: index.last || 0,
          change: index.variation || 0,
          changePercent: index.percentChange || 0,
          lastUpdated: new Date()
        }));

        console.log(`✅ Fetched ${results.length} market indices from NSE`);
        return results;
      }
    } catch (error) {
      console.warn('⚠️ NSE indices API failed:', error);
    }

    // If NSE fails, return empty array instead of trying Yahoo Finance
    // Yahoo Finance API has become unreliable with 401 errors
    console.log('📊 Using NSE API only for market indices (Yahoo Finance disabled due to API restrictions)');
    return [];
  }

  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache(): void {
    this.cache.clear();
  }



  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; symbols: string[] } {
    return {
      size: this.cache.size,
      symbols: Array.from(this.cache.keys())
    };
  }
}

export const marketDataService = new MarketDataService();
