import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { logger } from '../utils/logger';

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
      logger.info('Created BSE data directory', {
        component: 'BSE_CSV_SERVICE',
        operation: 'ENSURE_DATA_DIRECTORY'
      });
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
        logger.info('Loaded BSE symbols from cache', {
          component: 'BSE_CSV_SERVICE',
          operation: 'LOAD_SYMBOLS_FROM_CACHE',
          symbolCount: this.symbols.length,
          lastUpdated: this.lastUpdated?.toISOString() || 'Never'
        });
      } else {
        logger.info('No BSE symbol cache found, will need to fetch data', {
          component: 'BSE_CSV_SERVICE',
          operation: 'LOAD_SYMBOLS_FROM_CACHE'
        });
      }
    } catch (error) {
      logger.error('Error loading BSE symbols from cache', {
        component: 'BSE_CSV_SERVICE',
        operation: 'LOAD_SYMBOLS_FROM_CACHE_ERROR'
      }, error);
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
      logger.info('Saved BSE symbols to cache', {
        component: 'BSE_CSV_SERVICE',
        operation: 'SAVE_SYMBOLS_TO_CACHE',
        symbolCount: this.symbols.length
      });
    } catch (error) {
      logger.error('Error saving BSE symbols to cache', {
        component: 'BSE_CSV_SERVICE',
        operation: 'SAVE_SYMBOLS_TO_CACHE_ERROR'
      }, error);
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
      logger.info('Downloading BSE CSV', {
        component: 'BSE_CSV_SERVICE',
        operation: 'DOWNLOAD_AND_PARSE_CSV',
        csvUrl
      });

      const response = await axios.get(csvUrl, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      logger.info('Downloaded BSE CSV data', {
        component: 'BSE_CSV_SERVICE',
        operation: 'DOWNLOAD_CSV_SUCCESS',
        dataSize: response.data.length
      });

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
              logger.warn('Error parsing BSE CSV row', {
                component: 'BSE_CSV_SERVICE',
                operation: 'PARSE_CSV_ROW_ERROR'
              }, error);
            }
          })
          .on('end', () => {
            logger.info('Parsed BSE symbols from CSV', {
              component: 'BSE_CSV_SERVICE',
              operation: 'PARSE_CSV_SUCCESS',
              symbolCount: symbols.length
            });
            resolve(symbols);
          })
          .on('error', (error: any) => {
            logger.error('Error parsing BSE CSV', {
              component: 'BSE_CSV_SERVICE',
              operation: 'PARSE_CSV_ERROR'
            }, error);
            reject(error);
          });
      });

    } catch (error: any) {
      logger.error('Error downloading BSE CSV', {
        component: 'BSE_CSV_SERVICE',
        operation: 'DOWNLOAD_CSV_ERROR'
      }, error);
      
      // Try previous day if current day fails
      if (error.response?.status === 404) {
        logger.info('Trying previous day BSE data', {
          component: 'BSE_CSV_SERVICE',
          operation: 'DOWNLOAD_PREVIOUS_DAY'
        });
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

          logger.info('Downloaded BSE CSV data from previous day', {
            component: 'BSE_CSV_SERVICE',
            operation: 'DOWNLOAD_PREVIOUS_DAY_SUCCESS'
          });

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
                  logger.warn('Error parsing BSE CSV row', {
                    component: 'BSE_CSV_SERVICE',
                    operation: 'PARSE_PREVIOUS_DAY_CSV_ROW_ERROR'
                  }, error);
                }
              })
              .on('end', () => {
                logger.info('Parsed BSE symbols from previous day CSV', {
                  component: 'BSE_CSV_SERVICE',
                  operation: 'PARSE_PREVIOUS_DAY_CSV_SUCCESS',
                  symbolCount: symbols.length
                });
                resolve(symbols);
              })
              .on('error', (error: any) => {
                logger.error('Error parsing previous day BSE CSV', {
                  component: 'BSE_CSV_SERVICE',
                  operation: 'PARSE_PREVIOUS_DAY_CSV_ERROR'
                }, error);
                reject(error);
              });
          });

        } catch (yesterdayError) {
          logger.error('Previous day BSE data also failed', {
            component: 'BSE_CSV_SERVICE',
            operation: 'DOWNLOAD_PREVIOUS_DAY_ERROR'
          }, yesterdayError);
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
      logger.info('Updating BSE symbols from CSV', {
        component: 'BSE_CSV_SERVICE',
        operation: 'UPDATE_SYMBOLS'
      });
      
      const symbols = await this.downloadAndParseCSV();
      
      if (symbols.length > 0) {
        this.symbols = symbols;
        this.lastUpdated = new Date();
        this.saveSymbolsToCache();
        logger.info('Updated BSE symbols from CSV', {
          component: 'BSE_CSV_SERVICE',
          operation: 'UPDATE_SYMBOLS_SUCCESS',
          symbolCount: symbols.length
        });
      } else {
        logger.warn('No BSE symbols downloaded, keeping existing cache', {
          component: 'BSE_CSV_SERVICE',
          operation: 'UPDATE_SYMBOLS_NO_DATA'
        });
      }

    } catch (error: any) {
      logger.error('Error updating BSE symbols', {
        component: 'BSE_CSV_SERVICE',
        operation: 'UPDATE_SYMBOLS_ERROR'
      }, error);
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

    logger.info('Scheduled daily BSE CSV updates', {
      component: 'BSE_CSV_SERVICE',
      operation: 'SETUP_DAILY_CRON',
      schedule: '7:00 PM IST'
    });

    // For now, just log the schedule - actual cron implementation would go here
    // In production, you'd use node-cron or similar
  }

  /**
   * Check if data needs update and download on startup
   */
  private async checkAndDownloadOnStartup(): Promise<void> {
    try {
      if (this.symbols.length === 0) {
        logger.info('No BSE symbols found, downloading', {
          component: 'BSE_CSV_SERVICE',
          operation: 'CHECK_AND_DOWNLOAD_ON_STARTUP'
        });
        await this.updateSymbols();
      } else if (this.needsUpdate()) {
        logger.info('BSE symbols data is stale, updating', {
          component: 'BSE_CSV_SERVICE',
          operation: 'CHECK_AND_DOWNLOAD_ON_STARTUP'
        });
        await this.updateSymbols();
      } else {
        logger.info('BSE data is up to date', {
          component: 'BSE_CSV_SERVICE',
          operation: 'CHECK_AND_DOWNLOAD_ON_STARTUP'
        });
      }
    } catch (error: any) {
      logger.error('Failed to download BSE data on startup', {
        component: 'BSE_CSV_SERVICE',
        operation: 'CHECK_AND_DOWNLOAD_ON_STARTUP_ERROR'
      }, error);
      // Don't throw error, allow service to work with cached data
    }
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing BSE CSV Service', {
        component: 'BSE_CSV_SERVICE',
        operation: 'INITIALIZE'
      });

      if (this.needsUpdate()) {
        logger.info('BSE symbols data is stale, updating', {
          component: 'BSE_CSV_SERVICE',
          operation: 'INITIALIZE_UPDATE'
        });
        await this.updateSymbols();
      } else {
        logger.info('BSE symbols data is up to date', {
          component: 'BSE_CSV_SERVICE',
          operation: 'INITIALIZE_UP_TO_DATE'
        });
      }

      logger.info('BSE CSV Service initialized', {
        component: 'BSE_CSV_SERVICE',
        operation: 'INITIALIZE_COMPLETE',
        symbolCount: this.symbols.length
      });
    } catch (error: any) {
      logger.error('Error initializing BSE CSV Service', {
        component: 'BSE_CSV_SERVICE',
        operation: 'INITIALIZE_ERROR'
      }, error);
      // Don't throw error, allow service to work with cached data
    }
  }
}

// Export singleton instance
export const bseCSVService = new BSECSVService();
