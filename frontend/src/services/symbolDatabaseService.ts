import api from './api';

export interface InstrumentSearchResult {
  symbol: string;
  name?: string;
  exchange: string;
  token?: string | null;
  instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
  optionType?: 'CE' | 'PE';
  strikePrice?: number;
  expiryDate?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class SymbolDatabaseService {
  /**
   * Search for instruments by type (EQUITY, OPTION, FUTURE)
   */
  async searchInstruments(
    query: string, 
    instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE', 
    limit: number = 10
  ): Promise<InstrumentSearchResult[]> {
    try {
      console.log(`🔍 SymbolDatabaseService: Searching for "${query}" type: ${instrumentType}`);
      
      const response = await api.get<ApiResponse<InstrumentSearchResult[]>>('/market-data/search-instruments', {
        params: { query, instrumentType, limit }
      });

      if (response.data.success) {
        console.log(`✅ SymbolDatabaseService: Found ${response.data.data.length} results`);
        return response.data.data;
      } else {
        console.warn('❌ SymbolDatabaseService: Search failed:', response.data.message);
        return [];
      }
    } catch (error) {
      console.error('❌ SymbolDatabaseService: Search error:', error);
      return [];
    }
  }

  /**
   * Get all available instruments by type
   */
  async getInstrumentsByType(instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE'): Promise<InstrumentSearchResult[]> {
    try {
      const response = await api.get<ApiResponse<InstrumentSearchResult[]>>('/market-data/instruments', {
        params: { instrumentType }
      });

      if (response.data.success) {
        return response.data.data;
      } else {
        console.warn('❌ SymbolDatabaseService: Failed to get instruments:', response.data.message);
        return [];
      }
    } catch (error) {
      console.error('❌ SymbolDatabaseService: Get instruments error:', error);
      return [];
    }
  }
}

export const symbolDatabaseService = new SymbolDatabaseService();