import axios from 'axios';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';

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
  private lastDataDate: string | null = null; // Track the date of current data (YYYY-MM-DD)
  private dayChangeMonitor: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureDataDirectory();
    this.loadExistingData();
    this.setupDailyCron();
    this.setupDayChangeMonitor();

    // Download on startup if no data exists or data is old
    this.checkAndDownloadOnStartup();
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.DATA_DIR)) {
      fs.mkdirSync(this.DATA_DIR, { recursive: true });
      logger.info('Created NSE data directory', {
        component: 'NSE_CSV_SERVICE',
        operation: 'ENSURE_DATA_DIRECTORY'
      });
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

        // Set the data date from when it was last updated
        if (this.lastUpdated) {
          this.lastDataDate = this.lastUpdated.toISOString().split('T')[0] || null;
        }

        logger.info('Loaded NSE symbols from cache', {
          component: 'NSE_CSV_SERVICE',
          operation: 'LOAD_EXISTING_DATA',
          symbolCount: this.symbols.length,
          lastUpdated: this.lastUpdated?.toISOString(),
          dataDate: this.lastDataDate
        });
      }
    } catch (error) {
      logger.warn('Failed to load existing NSE data', {
        component: 'NSE_CSV_SERVICE',
        operation: 'LOAD_EXISTING_DATA_ERROR'
      }, error);
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
      logger.info('NSE data is missing or outdated, downloading', {
        component: 'NSE_CSV_SERVICE',
        operation: 'CHECK_AND_DOWNLOAD_ON_STARTUP'
      });
      await this.downloadAndProcessCSV();
    } else {
      logger.info('NSE data is up to date', {
        component: 'NSE_CSV_SERVICE',
        operation: 'CHECK_AND_DOWNLOAD_ON_STARTUP'
      });
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
   * Setup day change monitor that checks every hour for date changes
   */
  private setupDayChangeMonitor(): void {
    // Check every hour for day changes
    this.dayChangeMonitor = setInterval(async () => {
      await this.checkForDayChange();
    }, 60 * 60 * 1000); // 1 hour

    logger.info('Day change monitor started', {
      component: 'NSE_CSV_SERVICE',
      operation: 'SETUP_DAY_CHANGE_MONITOR',
      intervalHours: 1
    });
  }

  /**
   * Check if the day has changed and update data if needed
   */
  private async checkForDayChange(): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    // If we have data and it's from a different day, update it
    if (this.lastDataDate && this.lastDataDate !== today) {
      logger.info('Day changed, updating NSE CSV data', {
        component: 'NSE_CSV_SERVICE',
        operation: 'DAY_CHANGE_UPDATE',
        previousDate: this.lastDataDate,
        currentDate: today
      });

      try {
        // Delete old files to force fresh download
        await this.deleteOldCSVFile();

        // Download fresh data
        await this.downloadAndProcessCSV();

        logger.info('NSE CSV data updated for new day', {
          component: 'NSE_CSV_SERVICE',
          operation: 'DAY_CHANGE_UPDATE_SUCCESS',
          date: today
        });
      } catch (error) {
        logger.error('Failed to update NSE CSV for new day', {
          component: 'NSE_CSV_SERVICE',
          operation: 'DAY_CHANGE_UPDATE_ERROR',
          date: today
        }, error);
      }
    } else if (!this.lastDataDate) {
      // Set initial date if not set
      this.lastDataDate = today || null;
    }
  }

  /**
   * Delete old CSV file to ensure fresh download
   */
  private async deleteOldCSVFile(): Promise<void> {
    try {
      if (fs.existsSync(this.CSV_FILE_PATH)) {
        fs.unlinkSync(this.CSV_FILE_PATH);
        logger.info('Deleted old CSV file', {
          component: 'NSE_CSV_SERVICE',
          operation: 'DELETE_OLD_FILES'
        });
      }
      if (fs.existsSync(this.JSON_FILE_PATH)) {
        fs.unlinkSync(this.JSON_FILE_PATH);
        logger.info('Deleted old JSON cache', {
          component: 'NSE_CSV_SERVICE',
          operation: 'DELETE_OLD_FILES'
        });
      }
    } catch (error) {
      logger.warn('Failed to delete old files', {
        component: 'NSE_CSV_SERVICE',
        operation: 'DELETE_OLD_FILES_ERROR'
      }, error);
    }
  }

  /**
   * Setup daily cron job to download NSE CSV
   */
  private setupDailyCron(): void {
    // Run every day at 6:30 AM IST (after market close and before next day)
    cron.schedule('30 6 * * *', async () => {
      logger.info('Daily NSE CSV update triggered', {
        component: 'NSE_CSV_SERVICE',
        operation: 'DAILY_CRON_TRIGGER'
      });
      await this.downloadAndProcessCSV();
    }, {
      timezone: 'Asia/Kolkata'
    });

    logger.info('Scheduled daily NSE CSV updates', {
      component: 'NSE_CSV_SERVICE',
      operation: 'SETUP_DAILY_CRON',
      schedule: '6:30 AM IST'
    });
  }

  /**
   * Download and process NSE CSV file
   */
  async downloadAndProcessCSV(): Promise<void> {
    if (this.isUpdating) {
      logger.info('NSE CSV update already in progress, skipping', {
        component: 'NSE_CSV_SERVICE',
        operation: 'DOWNLOAD_AND_PROCESS_CSV'
      });
      return;
    }

    this.isUpdating = true;
    logger.info('Starting NSE CSV download', {
      component: 'NSE_CSV_SERVICE',
      operation: 'DOWNLOAD_AND_PROCESS_CSV'
    });

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

      logger.info('NSE CSV file downloaded successfully', {
        component: 'NSE_CSV_SERVICE',
        operation: 'DOWNLOAD_CSV_SUCCESS'
      });

      // Process CSV file
      await this.processCSVFile();

      // Save processed data
      await this.saveProcessedData();

      logger.info('NSE CSV update completed', {
        component: 'NSE_CSV_SERVICE',
        operation: 'DOWNLOAD_AND_PROCESS_COMPLETE',
        symbolCount: this.symbols.length
      });

    } catch (error: any) {
      logger.error('Failed to download NSE CSV', {
        component: 'NSE_CSV_SERVICE',
        operation: 'DOWNLOAD_AND_PROCESS_ERROR'
      }, error);
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
      let isFirstRow = true;

      fs.createReadStream(this.CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
          // Debug: Log column names from first row
          if (isFirstRow) {
            logger.debug('CSV columns detected', {
              component: 'NSE_CSV_SERVICE',
              operation: 'PROCESS_CSV_FILE',
              columns: Object.keys(row)
            });
            isFirstRow = false;
          }
          try {
            // NSE CSV columns with spaces: SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING, PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE
            const symbol: NSESymbolData = {
              symbol: (row['SYMBOL'] || row[' SYMBOL'])?.trim() || '',
              name: (row['NAME OF COMPANY'] || row[' NAME OF COMPANY'])?.trim() || '',
              series: (row['SERIES'] || row[' SERIES'])?.trim() || '',
              listingDate: (row['DATE OF LISTING'] || row[' DATE OF LISTING'])?.trim() || '',
              isin: (row['ISIN NUMBER'] || row[' ISIN NUMBER'])?.trim() || '',
              marketLot: parseInt(row['MARKET LOT'] || row[' MARKET LOT']) || 1,
              faceValue: parseFloat(row['FACE VALUE'] || row[' FACE VALUE']) || 0
            };

            // Only include valid symbols
            if (symbol.symbol && symbol.name && symbol.series) {
              symbols.push(symbol);
            }
          } catch (error) {
            // Skip invalid rows
            logger.warn('Failed to parse CSV row', {
              component: 'NSE_CSV_SERVICE',
              operation: 'PROCESS_CSV_ROW_ERROR'
            }, error);
          }
        })
        .on('end', () => {
          this.symbols = symbols;
          this.lastUpdated = new Date();
          this.lastDataDate = new Date().toISOString().split('T')[0] || null;
          logger.info('Processed symbols from NSE CSV', {
            component: 'NSE_CSV_SERVICE',
            operation: 'PROCESS_CSV_COMPLETE',
            symbolCount: symbols.length,
            dataDate: this.lastDataDate
          });
          resolve();
        })
        .on('error', (error) => {
          logger.error('Error processing CSV file', {
            component: 'NSE_CSV_SERVICE',
            operation: 'PROCESS_CSV_FILE_ERROR'
          }, error);
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
      logger.info('NSE symbol data saved to JSON file', {
        component: 'NSE_CSV_SERVICE',
        operation: 'SAVE_PROCESSED_DATA',
        symbolCount: this.symbols.length
      });
    } catch (error) {
      logger.error('Failed to save processed data', {
        component: 'NSE_CSV_SERVICE',
        operation: 'SAVE_PROCESSED_DATA_ERROR'
      }, error);
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
    const today = new Date().toISOString().split('T')[0];
    return {
      service: 'NSE CSV Service',
      status: 'active',
      totalSymbols: this.symbols.length,
      lastUpdated: this.lastUpdated?.toISOString(),
      dataDate: this.lastDataDate,
      isDataCurrent: this.lastDataDate === today,
      dataAge: this.lastUpdated ?
        Math.floor((Date.now() - this.lastUpdated.getTime()) / (1000 * 60 * 60)) + ' hours' :
        'unknown',
      isUpdating: this.isUpdating,
      csvFilePath: this.CSV_FILE_PATH,
      jsonFilePath: this.JSON_FILE_PATH,
      nextUpdate: 'Daily at 6:30 AM IST',
      dayChangeMonitor: 'Active (checks every hour)'
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.dayChangeMonitor) {
      clearInterval(this.dayChangeMonitor);
      this.dayChangeMonitor = null;
      logger.info('Day change monitor stopped', {
        component: 'NSE_CSV_SERVICE',
        operation: 'CLEANUP'
      });
    }
  }

  /**
   * Force update (manual trigger)
   */
  async forceUpdate(): Promise<void> {
    logger.info('Force updating NSE CSV data', {
      component: 'NSE_CSV_SERVICE',
      operation: 'FORCE_UPDATE'
    });
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
