import { authService } from './authService';
import { eventBusService } from './eventBusService';

export interface MarketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  lastUpdated: string;
  exchange: string;
  source?: 'websocket' | 'rest' | 'cache';
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  source?: 'websocket' | 'rest' | 'cache';
}

export interface SymbolSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  price?: number;
  change?: number;
  changePercent?: number;
  token?: string;
  brokerData?: Record<string, unknown>;
}

interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
  source: 'websocket' | 'rest';
}

interface MarketDataCache {
  prices: Map<string, CacheEntry<MarketPrice>>;
  indices: CacheEntry<MarketIndex[]> | null;
  searches: Map<string, CacheEntry<SymbolSearchResult[]>>;
  marketStatus: CacheEntry<any> | null;
}

class MarketDataService {
  private baseURL = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/market-data`;
  private cache: MarketDataCache = {
    prices: new Map(),
    indices: null,
    searches: new Map(),
    marketStatus: null
  };
  
  // Cache TTL settings (in milliseconds)
  private readonly CACHE_TTL = {
    PRICE: 30000,        // 30 seconds for prices
    INDICES: 60000,      // 1 minute for indices
    SEARCH: 300000,      // 5 minutes for search results
    MARKET_STATUS: 60000 // 1 minute for market status
  };

  private websocketConnected = false;
  private fallbackMode = false;
  private eventListenerIds: string[] = [];

  constructor() {
    this.initializeEventListeners();
  }

  /**
   * Initialize event listeners for WebSocket data
   */
  private initializeEventListeners(): void {
    // Listen for price updates from WebSocket
    const priceUpdateId = eventBusService.subscribe('price_update', (priceData: any) => {
      this.updatePriceCache(priceData, 'websocket');
    }, { priority: 10 });

    // Listen for indices updates from WebSocket
    const indicesUpdateId = eventBusService.subscribe('indices_update', (data: any) => {
      this.updateIndicesCache(data.indices, 'websocket');
    }, { priority: 10 });

    // Listen for connection status updates
    const connectionStatusId = eventBusService.subscribe('connection_status', (status: any) => {
      this.websocketConnected = status.connected;
      if (!status.connected) {
        this.fallbackMode = true;
        console.log('📊 Market data service switching to REST fallback mode');
      } else {
        this.fallbackMode = false;
        console.log('📊 Market data service using WebSocket mode');
      }
    }, { priority: 10 });

    this.eventListenerIds = [priceUpdateId, indicesUpdateId, connectionStatusId];
  }

  /**
   * Update price cache with new data
   */
  private updatePriceCache(priceData: MarketPrice, source: 'websocket' | 'rest'): void {
    const key = `${priceData.symbol}:${priceData.exchange}`;
    const cacheEntry: CacheEntry<MarketPrice> = {
      data: { ...priceData, source },
      timestamp: new Date(),
      ttl: this.CACHE_TTL.PRICE,
      source
    };
    
    this.cache.prices.set(key, cacheEntry);
    console.log(`📊 Updated price cache for ${key} from ${source}`);
  }

  /**
   * Update indices cache with new data
   */
  private updateIndicesCache(indices: MarketIndex[], source: 'websocket' | 'rest'): void {
    const cacheEntry: CacheEntry<MarketIndex[]> = {
      data: indices.map(index => ({ ...index, source })),
      timestamp: new Date(),
      ttl: this.CACHE_TTL.INDICES,
      source
    };
    
    this.cache.indices = cacheEntry;
    console.log(`📊 Updated indices cache from ${source}`);
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
    if (!entry) return false;
    const now = Date.now();
    const entryTime = entry.timestamp.getTime();
    return (now - entryTime) < entry.ttl;
  }

  /**
   * Get cached price or fetch from API
   */
  private async getCachedPrice(symbol: string, exchange: string = 'NSE'): Promise<MarketPrice | null> {
    const key = `${symbol}:${exchange}`;
    const cachedEntry = this.cache.prices.get(key);
    
    if (this.isCacheValid(cachedEntry)) {
      console.log(`📊 Returning cached price for ${key}`);
      return { ...cachedEntry!.data, source: 'cache' };
    }
    
    return null;
  }

  /**
   * Get cached indices or fetch from API
   */
  private async getCachedIndices(): Promise<MarketIndex[] | null> {
    if (this.isCacheValid(this.cache.indices)) {
      console.log('📊 Returning cached indices');
      return this.cache.indices!.data.map(index => ({ ...index, source: 'cache' }));
    }
    
    return null;
  }

  /**
   * Fallback to REST API when WebSocket fails
   */
  private async fallbackToRest<T>(
    restCall: () => Promise<T>,
    cacheKey?: string,
    cacheTtl?: number
  ): Promise<T> {
    try {
      console.log('📊 Using REST API fallback');
      const result = await restCall();
      
      // Cache the result if cache parameters provided
      if (cacheKey && cacheTtl) {
        // Implementation depends on the type of data being cached
      }
      
      return result;
    } catch (error) {
      console.error('📊 REST API fallback failed:', error);
      throw error;
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = authService.getToken();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get real-time price for a single symbol with caching and fallback
   */
  async getPrice(symbol: string, exchange: string = 'NSE'): Promise<MarketPrice> {
    // Try cache first
    const cachedPrice = await this.getCachedPrice(symbol, exchange);
    if (cachedPrice) {
      return cachedPrice;
    }

    // If WebSocket is connected and not in fallback mode, wait briefly for WebSocket data
    if (this.websocketConnected && !this.fallbackMode) {
      // Give WebSocket a chance to provide data
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const cachedAfterWait = await this.getCachedPrice(symbol, exchange);
      if (cachedAfterWait) {
        return cachedAfterWait;
      }
    }

    // Fallback to REST API
    try {
      const response = await this.makeRequest(`/price/${symbol}?exchange=${exchange}`);
      const priceData = response.data;
      
      // Update cache with REST data
      this.updatePriceCache(priceData, 'rest');
      
      return { ...priceData, source: 'rest' };
    } catch (error) {
      console.error(`📊 Failed to get price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get real-time prices for multiple symbols
   */
  async getPrices(symbols: string[], exchange: string = 'NSE'): Promise<Record<string, MarketPrice>> {
    const response = await this.makeRequest('/prices', {
      method: 'POST',
      body: JSON.stringify({ symbols, exchange })
    });
    return response.data.prices;
  }

  /**
   * Get major Indian market indices with caching and fallback
   */
  async getMarketIndices(): Promise<MarketIndex[]> {
    // Try cache first
    const cachedIndices = await this.getCachedIndices();
    if (cachedIndices) {
      return cachedIndices;
    }

    // If WebSocket is connected and not in fallback mode, wait briefly for WebSocket data
    if (this.websocketConnected && !this.fallbackMode) {
      // Give WebSocket a chance to provide data
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const cachedAfterWait = await this.getCachedIndices();
      if (cachedAfterWait) {
        return cachedAfterWait;
      }
    }

    // Fallback to REST API
    try {
      const response = await this.makeRequest('/indices');
      const indicesData = response.data.indices;
      
      // Update cache with REST data
      this.updateIndicesCache(indicesData, 'rest');
      
      return indicesData.map((index: MarketIndex) => ({ ...index, source: 'rest' }));
    } catch (error) {
      console.error('📊 Failed to get market indices:', error);
      throw error;
    }
  }

  /**
   * Search symbols using NSE API with caching
   */
  async searchSymbols(query: string, limit: number = 10, exchange: string = 'NSE'): Promise<any> {
    if (query.length < 2) {
      return { success: false, data: [] };
    }

    // Check cache first
    const cacheKey = `${query.toLowerCase()}:${exchange}:${limit}`;
    const cachedEntry = this.cache.searches.get(cacheKey);
    
    if (this.isCacheValid(cachedEntry)) {
      console.log(`📊 Returning cached search results for "${query}"`);
      return { success: true, data: cachedEntry!.data };
    }

    try {
      const response = await fetch(`/api/market-data/search/${encodeURIComponent(query)}?limit=${limit}&exchange=${exchange}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Cache the search results
      if (result.success && result.data) {
        const cacheEntry: CacheEntry<SymbolSearchResult[]> = {
          data: result.data,
          timestamp: new Date(),
          ttl: this.CACHE_TTL.SEARCH,
          source: 'rest'
        };
        this.cache.searches.set(cacheKey, cacheEntry);
        console.log(`📊 Cached search results for "${query}"`);
      }

      return result;
    } catch (error) {
      console.error('Symbol search failed:', error);
      return { success: false, data: [] };
    }
  }

  /**
   * Get NSE market status
   */
  async getMarketStatus(): Promise<any> {
    try {
      const response = await fetch('/api/market-data/market-status', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Market status fetch failed:', error);
      return { success: false, data: null };
    }
  }

  /**
   * Get NSE gainers
   */
  async getGainers(): Promise<any> {
    try {
      const response = await fetch('/api/market-data/gainers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Gainers fetch failed:', error);
      return { success: false, data: [] };
    }
  }

  /**
   * Get NSE losers
   */
  async getLosers(): Promise<any> {
    try {
      const response = await fetch('/api/market-data/losers', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Losers fetch failed:', error);
      return { success: false, data: [] };
    }
  }

  /**
   * Get 52-week high stocks
   */
  async get52WeekHigh(): Promise<any> {
    try {
      const response = await fetch('/api/market-data/52-week-high', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('52-week high fetch failed:', error);
      return { success: false, data: [] };
    }
  }

  /**
   * Get 52-week low stocks
   */
  async get52WeekLow(): Promise<any> {
    try {
      const response = await fetch('/api/market-data/52-week-low', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('52-week low fetch failed:', error);
      return { success: false, data: [] };
    }
  }

  /**
   * Get top value stocks
   */
  async getTopValueStocks(): Promise<any> {
    try {
      const response = await fetch('/api/market-data/top-value', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Top value stocks fetch failed:', error);
      return { success: false, data: [] };
    }
  }

  /**
   * Get top volume stocks
   */
  async getTopVolumeStocks(): Promise<unknown> {
    try {
      const response = await fetch('/api/market-data/top-volume', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Top volume stocks fetch failed:', error);
      return { success: false, data: [] };
    }
  }

  /**
   * Get local cache statistics
   */
  getCacheStats(): { 
    prices: number; 
    indices: boolean; 
    searches: number; 
    marketStatus: boolean;
    totalSize: number;
  } {
    return {
      prices: this.cache.prices.size,
      indices: this.cache.indices !== null,
      searches: this.cache.searches.size,
      marketStatus: this.cache.marketStatus !== null,
      totalSize: this.cache.prices.size + this.cache.searches.size + 
                 (this.cache.indices ? 1 : 0) + (this.cache.marketStatus ? 1 : 0)
    };
  }

  /**
   * Clear local cache
   */
  clearLocalCache(): void {
    this.cache.prices.clear();
    this.cache.indices = null;
    this.cache.searches.clear();
    this.cache.marketStatus = null;
    console.log('📊 Local market data cache cleared');
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    
    // Clean expired prices
    for (const [key, entry] of this.cache.prices.entries()) {
      if (!this.isCacheValid(entry)) {
        this.cache.prices.delete(key);
      }
    }
    
    // Clean expired searches
    for (const [key, entry] of this.cache.searches.entries()) {
      if (!this.isCacheValid(entry)) {
        this.cache.searches.delete(key);
      }
    }
    
    // Clean expired indices
    if (this.cache.indices && !this.isCacheValid(this.cache.indices)) {
      this.cache.indices = null;
    }
    
    // Clean expired market status
    if (this.cache.marketStatus && !this.isCacheValid(this.cache.marketStatus)) {
      this.cache.marketStatus = null;
    }
    
    console.log('📊 Cleaned expired cache entries');
  }

  /**
   * Get connection status and mode
   */
  getConnectionStatus(): {
    websocketConnected: boolean;
    fallbackMode: boolean;
    eventListeners: number;
  } {
    return {
      websocketConnected: this.websocketConnected,
      fallbackMode: this.fallbackMode,
      eventListeners: this.eventListenerIds.length
    };
  }

  /**
   * Force fallback mode (for testing)
   */
  setFallbackMode(enabled: boolean): void {
    this.fallbackMode = enabled;
    console.log(`📊 Fallback mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Cleanup service (call on unmount)
   */
  cleanup(): void {
    // Unsubscribe from event bus
    this.eventListenerIds.forEach(id => {
      // Note: We can't unsubscribe by ID directly, but the event bus will clean up
      // when components unmount. This is a placeholder for future enhancement.
    });
    
    this.clearLocalCache();
    console.log('📊 Market data service cleaned up');
  }

  /**
   * Get server cache statistics (for debugging)
   */
  async getServerCacheStats(): Promise<{ size: number; symbols: string[] }> {
    const response = await this.makeRequest('/cache/stats');
    return response.data;
  }

  /**
   * Clear server cache (for debugging)
   */
  async clearServerCache(): Promise<void> {
    await this.makeRequest('/cache/clear', { method: 'POST' });
  }
}

export const marketDataService = new MarketDataService();
