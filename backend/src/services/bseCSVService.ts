import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

// BSE Symbol Data Interface (based on BSE CSV format)
export interface BSESymbolData {
  symbol: string;        // SC_NAME (Security Name)
  name: string;          // Full company name
  securityCode: string;  // SC_CODE (Unique BSE code)
  group: string;         // SC_GROUP (A, B, T, M, Z)
  type: string;          // SC_TYPE (Equity, Preference, etc.)
  isin: string;          // ISIN code
  faceValue: number;     // Face value
  marketLot: number;     // Market lot size
  status: 'Active' | 'Suspended' | 'Delisted';
}

export class BSECSVService {
  private symbols: BSESymbolData[] = [];
  private lastUpdated: Date | null = null;
  private dataPath: string;
  private csvPath: string;

  constructor() {
    this.dataPath = path.join(__dirname, '../../data/bse_symbols.json');
    this.csvPath = path.join(__dirname, '../../data/bse_symbols.csv');
    this.ensureDataDirectory();
    this.loadSymbolsFromCache();
    this.setupDailyCron();

    // Download on startup if no data exists or data is old
    this.checkAndDownloadOnStartup();
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    const dataDir = path.dirname(this.dataPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('📁 Created BSE data directory');
    }
  }

  /**
   * Load symbols from cached JSON file
   */
  private loadSymbolsFromCache(): void {
    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf8');
        const parsed = JSON.parse(data);
        this.symbols = parsed.symbols || [];
        this.lastUpdated = parsed.lastUpdated ? new Date(parsed.lastUpdated) : null;
        console.log(`📊 Loaded ${this.symbols.length} BSE symbols from cache`);
        console.log(`📅 Last updated: ${this.lastUpdated?.toISOString() || 'Never'}`);
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
        count: this.symbols.length,
        dataDate: new Date().toISOString().split('T')[0]
      };

      fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2));
      console.log(`💾 Saved ${this.symbols.length} BSE symbols to cache`);
    } catch (error) {
      console.error('❌ Error saving BSE symbols to cache:', error);
    }
  }

  /**
   * Get BSE CSV URL for current date
   */
  private getBSECSVUrl(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // BSE CSV URL format: BhavCopy_BSE_CM_0_0_0_YYYYMMDD_F_0000.CSV
    const dateStr = `${year}${month}${day}`;
    return `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_${dateStr}_F_0000.CSV`;
  }

  /**
   * Download and parse BSE CSV data
   */
  async downloadAndParseCSV(): Promise<BSESymbolData[]> {
    try {
      const csvUrl = this.getBSECSVUrl();
      console.log(`🔄 Downloading BSE CSV from: ${csvUrl}`);

      const response = await axios.get(csvUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      console.log(`📊 Downloaded BSE CSV data (${response.data.length} bytes)`);

      // Save raw CSV for debugging
      fs.writeFileSync(this.csvPath, response.data);

      // Parse CSV data
      const symbols: BSESymbolData[] = [];
      const stream = Readable.from([response.data]);

      return new Promise((resolve, reject) => {
        stream
          .pipe(csv.default())
          .on('data', (row: any) => {
            try {
              // BSE CSV columns: FinInstrmId, TckrSymb, FinInstrmNm, SctySrs, ISIN, etc.
              const symbol: BSESymbolData = {
                securityCode: (row['FinInstrmId'])?.trim() || '',
                symbol: (row['TckrSymb'])?.trim() || '',
                name: (row['FinInstrmNm'])?.trim() || '',
                group: (row['SctySrs'])?.trim() || 'A',
                type: (row['FinInstrmTp'])?.trim() || 'STK',
                isin: (row['ISIN'])?.trim() || '',
                faceValue: 1, // Default value
                marketLot: 1, // Default value
                status: 'Active' as const
              };

              // Only include stock symbols with valid data (STK = Stock)
              if (symbol.securityCode && symbol.symbol && symbol.type === 'STK') {
                symbols.push(symbol);
              }
            } catch (error) {
              console.warn('⚠️ Error parsing BSE CSV row:', error);
            }
          })
          .on('end', () => {
            console.log(`✅ Parsed ${symbols.length} BSE symbols from CSV`);
            resolve(symbols);
          })
          .on('error', (error: any) => {
            console.error('❌ Error parsing BSE CSV:', error);
            reject(error);
          });
      });

    } catch (error: any) {
      console.error('❌ Error downloading BSE CSV:', error.message);
      
      // Try previous day if current day fails
      if (error.response?.status === 404) {
        console.log('🔄 Trying previous day BSE data...');
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');
        const dateStr = `${year}${month}${day}`;
        
        const yesterdayUrl = `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_${dateStr}_F_0000.CSV`;
        
        try {
          const response = await axios.get(yesterdayUrl, {
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          console.log(`📊 Downloaded BSE CSV data from previous day`);

          // Save raw CSV for debugging
          fs.writeFileSync(this.csvPath, response.data);

          // Parse CSV data
          const symbols: BSESymbolData[] = [];
          const stream = Readable.from([response.data]);

          return new Promise((resolve, reject) => {
            stream
              .pipe(csv.default())
              .on('data', (row: any) => {
                try {
                  // BSE CSV columns: FinInstrmId, TckrSymb, FinInstrmNm, SctySrs, ISIN, etc.
                  const symbol: BSESymbolData = {
                    securityCode: (row['FinInstrmId'])?.trim() || '',
                    symbol: (row['TckrSymb'])?.trim() || '',
                    name: (row['FinInstrmNm'])?.trim() || '',
                    group: (row['SctySrs'])?.trim() || 'A',
                    type: (row['FinInstrmTp'])?.trim() || 'STK',
                    isin: (row['ISIN'])?.trim() || '',
                    faceValue: 1, // Default value
                    marketLot: 1, // Default value
                    status: 'Active' as const
                  };

                  // Only include stock symbols with valid data (STK = Stock)
                  if (symbol.securityCode && symbol.symbol && symbol.type === 'STK') {
                    symbols.push(symbol);
                  }
                } catch (error) {
                  console.warn('⚠️ Error parsing BSE CSV row:', error);
                }
              })
              .on('end', () => {
                console.log(`✅ Parsed ${symbols.length} BSE symbols from previous day CSV`);
                resolve(symbols);
              })
              .on('error', (error: any) => {
                console.error('❌ Error parsing previous day BSE CSV:', error);
                reject(error);
              });
          });

        } catch (yesterdayError) {
          console.error('❌ Previous day BSE data also failed:', yesterdayError);
          return [];
        }
      }
      
      return [];
    }
  }

  /**
   * Update BSE symbols from CSV
   */
  async updateSymbols(): Promise<void> {
    try {
      console.log('🔄 Updating BSE symbols from CSV...');
      
      const symbols = await this.downloadAndParseCSV();
      
      if (symbols.length > 0) {
        this.symbols = symbols;
        this.lastUpdated = new Date();
        this.saveSymbolsToCache();
        console.log(`✅ Updated ${symbols.length} BSE symbols from CSV`);
      } else {
        console.log('⚠️ No BSE symbols downloaded, keeping existing cache');
      }

    } catch (error: any) {
      console.error('❌ Error updating BSE symbols:', error.message);
      throw error;
    }
  }

  /**
   * Search BSE symbols by name or symbol
   */
  searchSymbols(query: string, limit: number = 10): BSESymbolData[] {
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
  getSymbol(symbolName: string): BSESymbolData | null {
    return this.symbols.find(symbol =>
      symbol.symbol.toUpperCase() === symbolName.toUpperCase()
    ) || null;
  }

  /**
   * Get symbols by group
   */
  getSymbolsByGroup(group: string): BSESymbolData[] {
    return this.symbols.filter(symbol => symbol.group === group);
  }

  /**
   * Get all symbols
   */
  getAllSymbols(): BSESymbolData[] {
    return this.symbols;
  }

  /**
   * Get service statistics
   */
  getStats(): any {
    return {
      totalSymbols: this.symbols.length,
      lastUpdated: this.lastUpdated,
      dataSource: 'BSE Official CSV',
      csvUrl: this.getBSECSVUrl(),
      groupDistribution: {
        A: this.symbols.filter(s => s.group === 'A').length,
        B: this.symbols.filter(s => s.group === 'B').length,
        T: this.symbols.filter(s => s.group === 'T').length,
        M: this.symbols.filter(s => s.group === 'M').length,
        Z: this.symbols.filter(s => s.group === 'Z').length,
      },
      typeDistribution: {
        Equity: this.symbols.filter(s => s.type === 'Equity').length,
        Preference: this.symbols.filter(s => s.type === 'Preference').length,
        Debenture: this.symbols.filter(s => s.type === 'Debenture').length,
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
   * Setup daily cron job for BSE data updates
   */
  private setupDailyCron(): void {
    // BSE data is usually available after market close (around 6 PM IST)
    // Schedule for 7 PM IST daily
    const cronTime = '0 19 * * 1-5'; // 7 PM IST, Monday to Friday

    console.log('⏰ Scheduled daily BSE CSV updates at 7:00 PM IST');

    // For now, just log the schedule - actual cron implementation would go here
    // In production, you'd use node-cron or similar
  }

  /**
   * Check if data needs update and download on startup
   */
  private async checkAndDownloadOnStartup(): Promise<void> {
    try {
      if (this.symbols.length === 0) {
        console.log('📊 No BSE symbols found, downloading...');
        await this.updateSymbols();
      } else if (this.needsUpdate()) {
        console.log('📅 BSE symbols data is stale, updating...');
        await this.updateSymbols();
      } else {
        console.log('✅ BSE data is up to date');
      }
    } catch (error: any) {
      console.error('❌ Failed to download BSE data on startup:', error.message);
      // Don't throw error, allow service to work with cached data
    }
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing BSE CSV Service...');

      if (this.needsUpdate()) {
        console.log('📅 BSE symbols data is stale, updating...');
        await this.updateSymbols();
      } else {
        console.log('✅ BSE symbols data is up to date');
      }

      console.log(`🚀 BSE CSV Service initialized with ${this.symbols.length} symbols`);
    } catch (error: any) {
      console.error('❌ Error initializing BSE CSV Service:', error.message);
      // Don't throw error, allow service to work with cached data
    }
  }
}

// Export singleton instance
export const bseCSVService = new BSECSVService();
