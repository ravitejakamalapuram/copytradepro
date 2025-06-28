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
}

class MarketDataService {
  private baseURL = 'http://localhost:3001/api/market-data';

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
   * Search for symbols (for autocomplete)
   */
  async searchSymbols(query: string, limit: number = 10): Promise<SymbolSearchResult[]> {
    if (query.length < 2) {
      return [];
    }
    
    const response = await this.makeRequest(`/search/${encodeURIComponent(query)}?limit=${limit}`);
    return response.data.results;
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
