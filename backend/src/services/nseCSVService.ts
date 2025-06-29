import axios from 'axios';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import * as cron from 'node-cron';

interface NSESymbolData {
  symbol: string;
  name: string;
  series: string;
  listingDate: string;
  isin: string;
  marketLot: number;
  faceValue: number;
}

class NSECSVService {
  private readonly CSV_URL = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
  private readonly DATA_DIR = path.join(__dirname, '../../data');
  private readonly CSV_FILE_PATH = path.join(this.DATA_DIR, 'nse_symbols.csv');
  private readonly JSON_FILE_PATH = path.join(this.DATA_DIR, 'nse_symbols.json');
  private symbols: NSESymbolData[] = [];
  private lastUpdated: Date | null = null;
  private isUpdating = false;

  constructor() {
    this.ensureDataDirectory();
    this.loadExistingData();
    this.setupDailyCron();
    
    // Download on startup if no data exists or data is old
    this.checkAndDownloadOnStartup();
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.DATA_DIR)) {
      fs.mkdirSync(this.DATA_DIR, { recursive: true });
      console.log('📁 Created NSE data directory');
    }
  }

  /**
   * Load existing data from JSON file
   */
  private loadExistingData(): void {
    try {
      if (fs.existsSync(this.JSON_FILE_PATH)) {
        const data = fs.readFileSync(this.JSON_FILE_PATH, 'utf8');
        const parsed = JSON.parse(data);
        this.symbols = parsed.symbols || [];
        this.lastUpdated = parsed.lastUpdated ? new Date(parsed.lastUpdated) : null;
        
        console.log(`📊 Loaded ${this.symbols.length} NSE symbols from cache`);
        if (this.lastUpdated) {
          console.log(`📅 Last updated: ${this.lastUpdated.toISOString()}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load existing NSE data:', error);
      this.symbols = [];
      this.lastUpdated = null;
    }
  }

  /**
   * Check if data needs update and download on startup
   */
  private async checkAndDownloadOnStartup(): Promise<void> {
    const shouldUpdate = !this.lastUpdated || 
                        this.symbols.length === 0 || 
                        this.isDataOlderThan24Hours();

    if (shouldUpdate) {
      console.log('🔄 NSE data is missing or outdated, downloading...');
      await this.downloadAndProcessCSV();
    } else {
      console.log('✅ NSE data is up to date');
    }
  }

  /**
   * Check if data is older than 24 hours
   */
  private isDataOlderThan24Hours(): boolean {
    if (!this.lastUpdated) return true;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.lastUpdated < twentyFourHoursAgo;
  }

  /**
   * Setup daily cron job to download NSE CSV
   */
  private setupDailyCron(): void {
    // Run every day at 6:30 AM IST (after market close and before next day)
    cron.schedule('30 6 * * *', async () => {
      console.log('⏰ Daily NSE CSV update triggered');
      await this.downloadAndProcessCSV();
    }, {
      timezone: 'Asia/Kolkata'
    });

    console.log('⏰ Scheduled daily NSE CSV updates at 6:30 AM IST');
  }

  /**
   * Download and process NSE CSV file
   */
  async downloadAndProcessCSV(): Promise<void> {
    if (this.isUpdating) {
      console.log('🔄 NSE CSV update already in progress, skipping...');
      return;
    }

    this.isUpdating = true;
    console.log('📥 Starting NSE CSV download...');

    try {
      // Download CSV file
      const response = await axios.get(this.CSV_URL, {
        responseType: 'stream',
        timeout: 60000, // 60 seconds timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Save CSV file
      const writer = fs.createWriteStream(this.CSV_FILE_PATH);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      console.log('✅ NSE CSV file downloaded successfully');

      // Process CSV file
      await this.processCSVFile();

      // Save processed data
      await this.saveProcessedData();

      console.log(`🎉 NSE CSV update completed! Loaded ${this.symbols.length} symbols`);

    } catch (error: any) {
      console.error('❌ Failed to download NSE CSV:', error.message);
      throw error;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Process CSV file and extract symbol data
   */
  private async processCSVFile(): Promise<void> {
    return new Promise((resolve, reject) => {
      const symbols: NSESymbolData[] = [];

      fs.createReadStream(this.CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
          try {
            // NSE CSV columns: SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
            const symbol: NSESymbolData = {
              symbol: row['SYMBOL']?.trim() || '',
              name: row['NAME OF COMPANY']?.trim() || '',
              series: row['SERIES']?.trim() || '',
              listingDate: row['DATE OF LISTING']?.trim() || '',
              isin: row['ISIN NUMBER']?.trim() || '',
              marketLot: parseInt(row['MARKET LOT']) || 1,
              faceValue: parseFloat(row['FACE VALUE']) || 0
            };

            // Only include valid symbols
            if (symbol.symbol && symbol.name && symbol.series) {
              symbols.push(symbol);
            }
          } catch (error) {
            // Skip invalid rows
          }
        })
        .on('end', () => {
          this.symbols = symbols;
          this.lastUpdated = new Date();
          console.log(`📊 Processed ${symbols.length} symbols from NSE CSV`);
          resolve();
        })
        .on('error', (error) => {
          console.error('❌ Error processing CSV file:', error);
          reject(error);
        });
    });
  }

  /**
   * Save processed data to JSON file
   */
  private async saveProcessedData(): Promise<void> {
    try {
      const data = {
        symbols: this.symbols,
        lastUpdated: this.lastUpdated?.toISOString(),
        totalSymbols: this.symbols.length,
        source: 'NSE CSV',
        downloadedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.JSON_FILE_PATH, JSON.stringify(data, null, 2));
      console.log('💾 NSE symbol data saved to JSON file');
    } catch (error) {
      console.error('❌ Failed to save processed data:', error);
      throw error;
    }
  }

  /**
   * Search symbols by name or symbol
   */
  searchSymbols(query: string, limit: number = 10): NSESymbolData[] {
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
  getSymbol(symbolName: string): NSESymbolData | null {
    return this.symbols.find(symbol => 
      symbol.symbol.toUpperCase() === symbolName.toUpperCase()
    ) || null;
  }

  /**
   * Get all symbols
   */
  getAllSymbols(): NSESymbolData[] {
    return this.symbols;
  }

  /**
   * Get service statistics
   */
  getStats(): any {
    return {
      service: 'NSE CSV Service',
      status: 'active',
      totalSymbols: this.symbols.length,
      lastUpdated: this.lastUpdated?.toISOString(),
      dataAge: this.lastUpdated ? 
        Math.floor((Date.now() - this.lastUpdated.getTime()) / (1000 * 60 * 60)) + ' hours' : 
        'unknown',
      isUpdating: this.isUpdating,
      csvFilePath: this.CSV_FILE_PATH,
      jsonFilePath: this.JSON_FILE_PATH,
      nextUpdate: 'Daily at 6:30 AM IST'
    };
  }

  /**
   * Force update (manual trigger)
   */
  async forceUpdate(): Promise<void> {
    console.log('🔄 Force updating NSE CSV data...');
    await this.downloadAndProcessCSV();
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.symbols.length > 0 && !this.isUpdating;
  }
}

export const nseCSVService = new NSECSVService();
export type { NSESymbolData };
