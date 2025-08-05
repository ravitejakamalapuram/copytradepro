/**
 * SYMBOL SERVICE
 * Service for symbol search and instrument data
 */

import api from './api';

export interface SymbolSearchResult {
  tradingSymbol?: string;
  symbol?: string;
  name?: string;
  displayName?: string;
  exchange: string;
  token?: string | null;
  relevanceScore?: number;
  // Options specific
  optionType?: 'CE' | 'PE';
  strikePrice?: number;
  expiryDate?: string;
  // Futures specific
  lotSize?: number;
  tickSize?: number;
}

export interface SymbolSearchResponse {
  success: boolean;
  data: SymbolSearchResult[];
  message?: string;
}

class SymbolService {
  private readonly baseUrl = '/api/symbols';

  /**
   * Search symbols by query
   */
  async searchSymbols(
    query: string,
    limit: number = 20,
    exchange?: string
  ): Promise<SymbolSearchResponse> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString()
      });

      if (exchange) {
        params.append('exchange', exchange);
      }

      const response = await api.get(`${this.baseUrl}/search?${params.toString()}`);
      return response.data as SymbolSearchResponse;
    } catch (error: any) {
      console.error('Symbol search error:', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Failed to search symbols'
      };
    }
  }

  /**
   * Search symbols with type filtering (equity, options, futures)
   */
  async searchSymbolsByType(
    query: string,
    instrumentType: 'equity' | 'options' | 'futures' | 'all' = 'all',
    limit: number = 20,
    exchange?: string
  ): Promise<SymbolSearchResponse> {
    try {
      const params = new URLSearchParams({
        q: query,
        type: instrumentType,
        limit: limit.toString()
      });

      if (exchange) {
        params.append('exchange', exchange);
      }

      const response = await api.get(`${this.baseUrl}/search?${params.toString()}`);
      return response.data as SymbolSearchResponse;
    } catch (error: any) {
      console.error('Symbol search by type error:', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Failed to search symbols by type'
      };
    }
  }

  /**
   * Get symbol details by trading symbol
   */
  async getSymbolDetails(tradingSymbol: string, exchange: string): Promise<{
    success: boolean;
    data?: SymbolSearchResult;
    message?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/details?symbol=${encodeURIComponent(tradingSymbol)}&exchange=${exchange}`);
      return response.data as { success: boolean; data?: SymbolSearchResult; message?: string };
    } catch (error: any) {
      console.error('Get symbol details error:', error);
      return {
        success: false,
        message: error.message || 'Failed to get symbol details'
      };
    }
  }

  /**
   * Get option chain for underlying symbol
   */
  async getOptionChain(underlying: string, exchange: string = 'NSE'): Promise<{
    success: boolean;
    data?: any[];
    message?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/option-chain?underlying=${encodeURIComponent(underlying)}&exchange=${exchange}`);
      return response.data as { success: boolean; data?: any[]; message?: string };
    } catch (error: any) {
      console.error('Get option chain error:', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Failed to get option chain'
      };
    }
  }

  /**
   * Get expiry dates for underlying symbol
   */
  async getExpiryDates(underlying: string, exchange: string = 'NSE'): Promise<{
    success: boolean;
    data?: string[];
    message?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/expiry-dates?underlying=${encodeURIComponent(underlying)}&exchange=${exchange}`);
      return response.data as { success: boolean; data?: string[]; message?: string };
    } catch (error: any) {
      console.error('Get expiry dates error:', error);
      return {
        success: false,
        data: [],
        message: error.message || 'Failed to get expiry dates'
      };
    }
  }
}

export const symbolService = new SymbolService();
export default symbolService;
