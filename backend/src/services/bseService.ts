import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// BSE Symbol Data Interface
export interface BSESymbol {
  symbol: string;
  name: string;
  exchange: 'BSE';
  group: 'A' | 'B' | 'T' | 'M' | 'Z';
  isin: string;
  securityCode: string;
  faceValue?: number;
  marketCap?: number;
  industry?: string;
  status: 'Active' | 'Suspended' | 'Delisted';
}

// BSE API Constants
const BSE_CONSTANTS = {
  BASE_URL: 'https://api.bseindia.com',
  SCRIP_LIST_URL: 'https://www.bseindia.com/corporates/List_Scrips.html',
  MARKET_DATA_URL: 'https://api.bseindia.com/BseIndiaAPI/api',
};

// Common headers for BSE requests
const BSE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Referer': 'https://www.bseindia.com/'
};

export class BSEService {
  private symbols: BSESymbol[] = [];
  private lastUpdated: Date | null = null;
  private dataPath: string;

  constructor() {
    this.dataPath = path.join(__dirname, '../../data/bse_symbols.json');
    this.loadSymbolsFromCache();
  }

  /**
   * Load symbols from cached file
   */
  private loadSymbolsFromCache(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf8');
        const parsed = JSON.parse(data);
        this.symbols = parsed.symbols || [];
        this.lastUpdated = parsed.lastUpdated ? new Date(parsed.lastUpdated) : null;
        console.log(`📊 Loaded ${this.symbols.length} BSE symbols from cache`);
      } else {
        console.log('📊 No BSE symbol cache found, will need to fetch data');
      }
    } catch (error) {
      console.error('❌ Error loading BSE symbols from cache:', error);
      this.symbols = [];
    }
  }

  /**
   * Save symbols to cache file
   */
  private saveSymbolsToCache(): void {
    try {
      const dataDir = path.dirname(this.dataPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const data = {
        symbols: this.symbols,
        lastUpdated: new Date().toISOString(),
        count: this.symbols.length
      };

      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${this.symbols.length} BSE symbols to cache`);
    } catch (error) {
      console.error('❌ Error saving BSE symbols to cache:', error);
    }
  }

  /**
   * Make HTTP request with proper headers
   */
  private async makeRequest(url: string, options: any = {}): Promise<any> {
    try {
      const response = await axios({
        url,
        method: 'GET',
        headers: { ...BSE_HEADERS, ...options.headers },
        timeout: 30000,
        ...options
      });

      return response.data;
    } catch (error: any) {
      console.error(`❌ BSE API request failed for ${url}:`, error.message);
      throw new Error(`BSE API request failed: ${error.message}`);
    }
  }

  /**
   * Fetch BSE symbols from web scraping (fallback method)
   */
  private async fetchSymbolsFromWeb(): Promise<BSESymbol[]> {
    try {
      console.log('🔍 Fetching BSE symbols from web...');
      
      // This is a placeholder implementation
      // In practice, you would need to:
      // 1. Scrape BSE website for symbol list
      // 2. Parse the HTML/JSON response
      // 3. Extract symbol data
      
      // For now, return sample data structure
      const sampleSymbols: BSESymbol[] = [
        {
          symbol: 'TCS',
          name: 'Tata Consultancy Services Limited',
          exchange: 'BSE',
          group: 'A',
          isin: 'INE467B01029',
          securityCode: '532540',
          faceValue: 1,
          industry: 'Information Technology',
          status: 'Active'
        },
        {
          symbol: 'RELIANCE',
          name: 'Reliance Industries Limited',
          exchange: 'BSE',
          group: 'A',
          isin: 'INE002A01018',
          securityCode: '500325',
          faceValue: 10,
          industry: 'Oil & Gas',
          status: 'Active'
        }
      ];

      console.log(`📊 Fetched ${sampleSymbols.length} BSE symbols from web`);
      return sampleSymbols;

    } catch (error: any) {
      console.error('❌ Error fetching BSE symbols from web:', error.message);
      return [];
    }
  }

  /**
   * Update BSE symbols data
   */
  async updateSymbols(): Promise<void> {
    try {
      console.log('🔄 Updating BSE symbols...');
      
      const symbols = await this.fetchSymbolsFromWeb();
      
      if (symbols.length > 0) {
        this.symbols = symbols;
        this.lastUpdated = new Date();
        this.saveSymbolsToCache();
        console.log(`✅ Updated ${symbols.length} BSE symbols`);
      } else {
        console.log('⚠️ No BSE symbols fetched, keeping existing data');
      }

    } catch (error: any) {
      console.error('❌ Error updating BSE symbols:', error.message);
      throw error;
    }
  }

  /**
   * Search BSE symbols by name or symbol
   */
  searchSymbols(query: string, limit: number = 10): BSESymbol[] {
    if (!query || query.length < 1) {
      return [];
    }

    const searchTerm = query.toLowerCase();
    const results = this.symbols.filter(symbol =>
      symbol.symbol.toLowerCase().includes(searchTerm) ||
      symbol.name.toLowerCase().includes(searchTerm)
    );

    return results.slice(0, limit);
  }

  /**
   * Get symbol by exact symbol name
   */
  getSymbol(symbolName: string): BSESymbol | null {
    return this.symbols.find(symbol =>
      symbol.symbol.toUpperCase() === symbolName.toUpperCase()
    ) || null;
  }

  /**
   * Get symbols by group
   */
  getSymbolsByGroup(group: 'A' | 'B' | 'T' | 'M' | 'Z'): BSESymbol[] {
    return this.symbols.filter(symbol => symbol.group === group);
  }

  /**
   * Get all symbols
   */
  getAllSymbols(): BSESymbol[] {
    return this.symbols;
  }

  /**
   * Get service statistics
   */
  getStats(): any {
    return {
      totalSymbols: this.symbols.length,
      lastUpdated: this.lastUpdated,
      groupDistribution: {
        A: this.symbols.filter(s => s.group === 'A').length,
        B: this.symbols.filter(s => s.group === 'B').length,
        T: this.symbols.filter(s => s.group === 'T').length,
        M: this.symbols.filter(s => s.group === 'M').length,
        Z: this.symbols.filter(s => s.group === 'Z').length,
      },
      statusDistribution: {
        Active: this.symbols.filter(s => s.status === 'Active').length,
        Suspended: this.symbols.filter(s => s.status === 'Suspended').length,
        Delisted: this.symbols.filter(s => s.status === 'Delisted').length,
      }
    };
  }

  /**
   * Check if symbols need update (older than 24 hours)
   */
  needsUpdate(): boolean {
    if (!this.lastUpdated) return true;
    
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - this.lastUpdated.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate > 24;
  }

  /**
   * Initialize service and update if needed
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing BSE Service...');
      
      if (this.needsUpdate()) {
        console.log('📅 BSE symbols data is stale, updating...');
        await this.updateSymbols();
      } else {
        console.log('✅ BSE symbols data is up to date');
      }

      console.log(`🚀 BSE Service initialized with ${this.symbols.length} symbols`);
    } catch (error: any) {
      console.error('❌ Error initializing BSE Service:', error.message);
      // Don't throw error, allow service to work with cached data
    }
  }
}

// Export singleton instance
export const bseService = new BSEService();
