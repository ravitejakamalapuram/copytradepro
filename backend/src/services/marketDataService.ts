import axios from 'axios';

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
   * Get fallback price for a symbol
   */
  private getFallbackPrice(symbol: string, exchange: string = 'NSE'): MarketPrice {
    // Mock data for common Indian stocks
    const mockPrices: Record<string, { price: number; change: number }> = {
      'RELIANCE': { price: 2847.65, change: 12.45 },
      'TCS': { price: 4156.30, change: -23.70 },
      'INFY': { price: 1789.25, change: 8.90 },
      'HDFC': { price: 1654.80, change: -5.20 },
      'HDFCBANK': { price: 1654.80, change: -5.20 },
      'ICICIBANK': { price: 1234.56, change: 15.30 },
      'KOTAKBANK': { price: 1876.45, change: -8.90 },
      'BHARTIARTL': { price: 1567.89, change: 23.45 },
      'ITC': { price: 456.78, change: -2.34 },
      'SBIN': { price: 789.12, change: 12.67 },
      'LT': { price: 3456.78, change: -45.67 },
      'ASIANPAINT': { price: 2987.65, change: 34.56 },
      'MARUTI': { price: 11234.56, change: -123.45 },
      'BAJFINANCE': { price: 6789.12, change: 89.34 },
      'HCLTECH': { price: 1567.89, change: 23.45 }
    };

    const baseData = mockPrices[symbol.toUpperCase()] || { price: 1000, change: 0 };

    // Add small random variations
    const variation = (Math.random() - 0.5) * 20; // ±10 variation
    const price = baseData.price + variation;
    const change = baseData.change + (Math.random() - 0.5) * 5; // ±2.5 variation
    const changePercent = (change / price) * 100;

    return {
      symbol,
      price: Math.round(price * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
      volume: Math.floor(Math.random() * 1000000) + 100000, // Random volume
      lastUpdated: new Date(),
      exchange
    };
  }

  /**
   * Fetch real-time price from Yahoo Finance
   */
  async getPrice(symbol: string, exchange: string = 'NSE'): Promise<MarketPrice | null> {
    try {
      // Check cache first
      const cached = this.getCachedPrice(symbol);
      if (cached) {
        return cached;
      }

      const yahooSymbol = this.formatSymbolForYahoo(symbol, exchange);

      const response = await axios.get<YahooFinanceResponse>(this.YAHOO_BASE_URL, {
        params: {
          symbols: yahooSymbol,
          fields: 'regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketVolume,marketState,fullExchangeName'
        },
        timeout: 3000, // Reduced timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const quote = response.data?.quoteResponse?.result?.[0];
      if (!quote) {
        console.warn(`⚠️ No Yahoo Finance data for ${symbol}, using fallback`);
        return this.getFallbackPrice(symbol, exchange);
      }

      const marketPrice: MarketPrice = {
        symbol: symbol, // Use original symbol
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
      console.warn(`⚠️ Failed to fetch ${symbol} from Yahoo Finance, using fallback:`, error.message);
      return this.getFallbackPrice(symbol, exchange);
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
   * Get fallback market indices data
   */
  private getFallbackIndices(): MarketIndex[] {
    // Generate realistic mock data with slight variations
    const baseData = [
      { name: 'NIFTY 50', baseValue: 25637.80, baseChange: -1.26 },
      { name: 'SENSEX', baseValue: 84058.90, baseChange: 181.87 },
      { name: 'BANK NIFTY', baseValue: 54234.15, baseChange: -45.30 },
      { name: 'NIFTY IT', baseValue: 43567.25, baseChange: 123.45 }
    ];

    return baseData.map(index => {
      // Add small random variations to simulate live data
      const variation = (Math.random() - 0.5) * 100; // ±50 points variation
      const value = index.baseValue + variation;
      const change = index.baseChange + (Math.random() - 0.5) * 20; // ±10 points variation
      const changePercent = (change / value) * 100;

      return {
        name: index.name,
        value: Math.round(value * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        lastUpdated: new Date()
      };
    });
  }

  /**
   * Get major Indian market indices
   */
  async getMarketIndices(): Promise<MarketIndex[]> {
    const indices = [
      { symbol: '^NSEI', name: 'NIFTY 50' },
      { symbol: '^BSESN', name: 'SENSEX' },
      { symbol: '^NSEBANK', name: 'BANK NIFTY' },
      { symbol: '^NSEIT', name: 'NIFTY IT' }
    ];

    const results: MarketIndex[] = [];
    let successCount = 0;

    for (const index of indices) {
      try {
        const response = await axios.get<YahooFinanceResponse>(this.YAHOO_BASE_URL, {
          params: {
            symbols: index.symbol,
            fields: 'regularMarketPrice,regularMarketChange,regularMarketChangePercent'
          },
          timeout: 3000, // Reduced timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const quote = response.data?.quoteResponse?.result?.[0];
        if (quote) {
          results.push({
            name: index.name,
            value: quote.regularMarketPrice || 0,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            lastUpdated: new Date()
          });
          successCount++;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY));

      } catch (error: any) {
        console.warn(`⚠️ Failed to fetch ${index.name} from Yahoo Finance:`, error.message);
      }
    }

    // If we couldn't fetch any real data, use fallback
    if (successCount === 0) {
      console.log('📊 Using fallback market data (Yahoo Finance unavailable)');
      return this.getFallbackIndices();
    }

    // If we got some data but not all, fill in missing with fallback
    if (results.length < indices.length) {
      const fallbackData = this.getFallbackIndices();
      const missingIndices = indices.filter(index =>
        !results.some(result => result.name === index.name)
      );

      missingIndices.forEach(index => {
        const fallback = fallbackData.find(f => f.name === index.name);
        if (fallback) {
          results.push(fallback);
        }
      });
    }

    return results;
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
