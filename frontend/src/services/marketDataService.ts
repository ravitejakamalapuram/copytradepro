import { authService } from './authService';

export interface MarketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  lastUpdated: string;
  exchange: string;
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
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

class MarketDataService {
  private baseURL = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/market-data`;

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
   * Get real-time price for a single symbol
   */
  async getPrice(symbol: string, exchange: string = 'NSE'): Promise<MarketPrice> {
    const response = await this.makeRequest(`/price/${symbol}?exchange=${exchange}`);
    return response.data;
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
   * Get major Indian market indices
   */
  async getMarketIndices(): Promise<MarketIndex[]> {
    const response = await this.makeRequest('/indices');
    return response.data.indices;
  }

  /**
   * Search symbols using NSE API (broker-independent)
   */
  async searchSymbols(query: string, limit: number = 10, exchange: string = 'NSE'): Promise<any> {
    if (query.length < 2) {
      return { success: false, data: [] };
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

      return await response.json();
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
  async getTopVolumeStocks(): Promise<any> {
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
   * Get cache statistics (for debugging)
   */
  async getCacheStats(): Promise<{ size: number; symbols: string[] }> {
    const response = await this.makeRequest('/cache/stats');
    return response.data;
  }

  /**
   * Clear market data cache (for debugging)
   */
  async clearCache(): Promise<void> {
    await this.makeRequest('/cache/clear', { method: 'POST' });
  }
}

export const marketDataService = new MarketDataService();
