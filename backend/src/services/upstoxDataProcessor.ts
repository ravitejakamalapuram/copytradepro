import axios from 'axios';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { CreateStandardizedSymbolData } from '../models/symbolModels';
import { symbolDatabaseService, ProcessingResult } from './symbolDatabaseService';

// Raw Upstox symbol data interface (based on Upstox CSV format)
export interface RawUpstoxSymbolData {
  instrument_key: string;
  exchange_token: string;
  tradingsymbol: string;
  name: string;
  last_price: number;
  expiry: string;
  strike: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string;
  segment: string;
  exchange: string;
  isin: string;
  multiplier: number;
  freeze_qty: number;
  underlying: string;
  underlying_key: string;
}

// Validation result interface
export interface UpstoxValidationResult {
  isValid: boolean;
  errors: string[];
  validSymbols: CreateStandardizedSymbolData[];
  invalidSymbols: RawUpstoxSymbolData[];
}

// Processing statistics interface
export interface UpstoxProcessingStats {
  totalProcessed: number;
  validSymbols: number;
  invalidSymbols: number;
  newSymbols: number;
  updatedSymbols: number;
  errors: string[];
  processingTime: number;
}

/**
 * Upstox Data Processor Service
 * Handles downloading, parsing, and processing Upstox symbol data
 */
export class UpstoxDataProcessor {
  private readonly UPSTOX_CSV_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz';
  private readonly FALLBACK_CSV_URLS = [
    'https://assets.upstox.com/market-quote/instruments/exchange/complete.csv',
    'https://api.upstox.com/v2/market-quote/instruments'
  ];
  private readonly DATA_DIR = path.join(__dirname, '../../data');
  private readonly CSV_FILE_PATH = path.join(this.DATA_DIR, 'upstox_symbols.csv');
  private readonly JSON_CACHE_PATH = path.join(this.DATA_DIR, 'upstox_symbols_cache.json');
  
  private isProcessing = false;
  private lastProcessed: Date | null = null;
  private processingStats: UpstoxProcessingStats | null = null;

  constructor() {
    this.ensureDataDirectory();
    this.loadProcessingStats();
    this.setupDailyCron();
  }

  /**
   * Ensure data directory exists
   */
  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.DATA_DIR)) {
      fs.mkdirSync(this.DATA_DIR, { recursive: true });
      logger.info('Created Upstox data directory', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'ENSURE_DATA_DIRECTORY'
      });
    }
  }

  /**
   * Load processing statistics from cache
   */
  private loadProcessingStats(): void {
    try {
      if (fs.existsSync(this.JSON_CACHE_PATH)) {
        const data = fs.readFileSync(this.JSON_CACHE_PATH, 'utf8');
        const parsed = JSON.parse(data);
        this.processingStats = parsed.stats || null;
        this.lastProcessed = parsed.lastProcessed ? new Date(parsed.lastProcessed) : null;
        
        logger.info('Loaded Upstox processing stats from cache', {
          component: 'UPSTOX_DATA_PROCESSOR',
          operation: 'LOAD_PROCESSING_STATS',
          lastProcessed: this.lastProcessed?.toISOString(),
          totalSymbols: this.processingStats?.validSymbols || 0
        });
      }
    } catch (error) {
      logger.warn('Failed to load Upstox processing stats', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'LOAD_PROCESSING_STATS_ERROR'
      }, error);
      this.processingStats = null;
      this.lastProcessed = null;
    }
  }

  /**
   * Save processing statistics to cache
   */
  private saveProcessingStats(): void {
    try {
      const data = {
        stats: this.processingStats,
        lastProcessed: this.lastProcessed?.toISOString(),
        savedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.JSON_CACHE_PATH, JSON.stringify(data, null, 2));
      logger.info('Saved Upstox processing stats to cache', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'SAVE_PROCESSING_STATS'
      });
    } catch (error) {
      logger.error('Failed to save Upstox processing stats', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'SAVE_PROCESSING_STATS_ERROR'
      }, error);
    }
  }

  /**
   * Setup daily cron job for Upstox data updates
   */
  private setupDailyCron(): void {
    // Schedule for 6:00 AM IST daily (before market opens)
    cron.schedule('0 6 * * *', async () => {
      logger.info('Daily Upstox data update triggered', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'DAILY_CRON_TRIGGER'
      });
      await this.processUpstoxData();
    }, {
      timezone: 'Asia/Kolkata'
    });

    logger.info('Scheduled daily Upstox data updates', {
      component: 'UPSTOX_DATA_PROCESSOR',
      operation: 'SETUP_DAILY_CRON',
      schedule: '6:00 AM IST'
    });
  }

  /**
   * Download Upstox CSV data
   */
  private async downloadUpstoxCSV(): Promise<void> {
    const urls = [this.UPSTOX_CSV_URL, ...this.FALLBACK_CSV_URLS];
    let lastError: Error | null = null;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (!url) continue;
      
      const isGzipped = url.endsWith('.gz');
      
      try {
        logger.info('Attempting to download Upstox CSV data', {
          component: 'UPSTOX_DATA_PROCESSOR',
          operation: 'DOWNLOAD_UPSTOX_CSV',
          url,
          attempt: i + 1,
          totalAttempts: urls.length,
          isGzipped
        });

        const response = await axios.get(url, {
          responseType: 'stream',
          timeout: 120000, // 2 minutes timeout for large file
          maxRedirects: 5,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept-Encoding': 'gzip, deflate',
            'Accept': 'text/csv, application/octet-stream, */*'
          },
          validateStatus: (status) => status >= 200 && status < 300
        });

        if (!response.data) {
          throw new Error('No data received from URL');
        }

        // Create file writer
        const writer = fs.createWriteStream(this.CSV_FILE_PATH);
        
        if (isGzipped) {
          // Import zlib for decompression
          const zlib = require('zlib');
          const gunzip = zlib.createGunzip();
          response.data.pipe(gunzip).pipe(writer);

          await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', reject);
            gunzip.on('error', reject);
          });
        } else {
          // Direct pipe for non-compressed files
          response.data.pipe(writer);

          await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', reject);
          });
        }

        // Check if file was created and has content
        const stats = fs.statSync(this.CSV_FILE_PATH);
        if (stats.size === 0) {
          throw new Error('Downloaded CSV file is empty');
        }

        logger.info('Upstox CSV file downloaded successfully', {
          component: 'UPSTOX_DATA_PROCESSOR',
          operation: 'DOWNLOAD_CSV_SUCCESS',
          url,
          filePath: this.CSV_FILE_PATH,
          fileSize: stats.size,
          isGzipped
        });

        return; // Success, exit the retry loop

      } catch (error: any) {
        lastError = error;
        logger.warn(`Failed to download from URL ${i + 1}/${urls.length}`, {
          component: 'UPSTOX_DATA_PROCESSOR',
          operation: 'DOWNLOAD_CSV_ATTEMPT_FAILED',
          url,
          attempt: i + 1,
          error: error.message
        });

        // If this is not the last URL, continue to next
        if (i < urls.length - 1) {
          continue;
        }
      }
    }

    // If we get here, all URLs failed
    logger.error('Failed to download Upstox CSV from all URLs', {
      component: 'UPSTOX_DATA_PROCESSOR',
      operation: 'DOWNLOAD_CSV_ALL_FAILED',
      attemptedUrls: urls.length
    }, lastError);
    
    throw new Error(`Failed to download Upstox CSV from any of ${urls.length} URLs. Last error: ${lastError?.message}`);
  }

  /**
   * Parse CSV file and extract raw symbol data
   */
  private async parseCSVFile(): Promise<RawUpstoxSymbolData[]> {
    return new Promise((resolve, reject) => {
      const symbols: RawUpstoxSymbolData[] = [];
      let rowCount = 0;
      let isFirstRow = true;
      let skippedRows = 0;

      // Check if file exists and has content
      if (!fs.existsSync(this.CSV_FILE_PATH)) {
        reject(new Error(`CSV file not found: ${this.CSV_FILE_PATH}`));
        return;
      }

      const stats = fs.statSync(this.CSV_FILE_PATH);
      if (stats.size === 0) {
        reject(new Error('CSV file is empty'));
        return;
      }

      logger.info('Starting to parse Upstox CSV file', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'PARSE_CSV_FILE',
        filePath: this.CSV_FILE_PATH,
        fileSize: stats.size
      });

      fs.createReadStream(this.CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
          // Debug: Log column names from first row
          if (isFirstRow) {
            logger.info('CSV columns detected', {
              component: 'UPSTOX_DATA_PROCESSOR',
              operation: 'PARSE_CSV_FILE',
              columns: Object.keys(row),
              sampleRow: row
            });
            isFirstRow = false;
          }

          try {
            rowCount++;
            
            // Parse Upstox CSV row
            const symbol: RawUpstoxSymbolData = {
              instrument_key: (row['instrument_key'] || '')?.trim(),
              exchange_token: (row['exchange_token'] || '')?.trim(),
              tradingsymbol: (row['tradingsymbol'] || '')?.trim(),
              name: (row['name'] || '')?.trim(),
              last_price: parseFloat(row['last_price'] || '0'),
              expiry: (row['expiry'] || '')?.trim(),
              strike: parseFloat(row['strike'] || '0'),
              tick_size: parseFloat(row['tick_size'] || '0.05'),
              lot_size: parseInt(row['lot_size'] || '1'),
              instrument_type: (row['instrument_type'] || '')?.trim(),
              segment: (row['segment'] || '')?.trim(),
              exchange: (row['exchange'] || '')?.trim(),
              isin: (row['isin'] || '')?.trim(),
              multiplier: parseInt(row['multiplier'] || '1'),
              freeze_qty: parseInt(row['freeze_qty'] || '0'),
              underlying: (row['underlying'] || '')?.trim(),
              underlying_key: (row['underlying_key'] || '')?.trim()
            };

            // Only include symbols with valid basic data
            if (symbol.instrument_key && symbol.tradingsymbol && symbol.instrument_type && symbol.exchange) {
              symbols.push(symbol);
            } else {
              skippedRows++;
              // Log first few skipped rows for debugging
              if (skippedRows <= 5) {
                logger.debug('Skipped invalid row', {
                  component: 'UPSTOX_DATA_PROCESSOR',
                  operation: 'PARSE_CSV_SKIP_ROW',
                  rowNumber: rowCount,
                  reason: 'Missing required fields',
                  row: {
                    instrument_key: symbol.instrument_key,
                    tradingsymbol: symbol.tradingsymbol,
                    instrument_type: symbol.instrument_type,
                    exchange: symbol.exchange
                  }
                });
              }
            }

            // Log progress every 10000 rows
            if (rowCount % 10000 === 0) {
              logger.info('CSV parsing progress', {
                component: 'UPSTOX_DATA_PROCESSOR',
                operation: 'PARSE_CSV_PROGRESS',
                rowsProcessed: rowCount,
                validSymbols: symbols.length,
                skippedRows
              });
            }

          } catch (error) {
            skippedRows++;
            logger.warn('Failed to parse CSV row', {
              component: 'UPSTOX_DATA_PROCESSOR',
              operation: 'PARSE_CSV_ROW_ERROR',
              rowNumber: rowCount,
              row: JSON.stringify(row).substring(0, 200)
            }, error);
          }
        })
        .on('end', () => {
          logger.info('Completed parsing Upstox CSV file', {
            component: 'UPSTOX_DATA_PROCESSOR',
            operation: 'PARSE_CSV_COMPLETE',
            totalRows: rowCount,
            validSymbols: symbols.length,
            skippedRows,
            successRate: rowCount > 0 ? ((symbols.length / rowCount) * 100).toFixed(2) + '%' : '0%'
          });

          if (symbols.length === 0) {
            reject(new Error(`No valid symbols found in CSV file. Processed ${rowCount} rows, all were invalid or empty.`));
            return;
          }

          resolve(symbols);
        })
        .on('error', (error) => {
          logger.error('Error parsing CSV file', {
            component: 'UPSTOX_DATA_PROCESSOR',
            operation: 'PARSE_CSV_FILE_ERROR'
          }, error);
          reject(error);
        });
    });
  }

  /**
   * Transform raw Upstox data to standardized format
   */
  private transformToStandardFormat(rawSymbols: RawUpstoxSymbolData[]): CreateStandardizedSymbolData[] {
    const standardizedSymbols: CreateStandardizedSymbolData[] = [];

    logger.info('Transforming Upstox data to standardized format', {
      component: 'UPSTOX_DATA_PROCESSOR',
      operation: 'TRANSFORM_TO_STANDARD_FORMAT',
      inputCount: rawSymbols.length
    });

    for (const rawSymbol of rawSymbols) {
      try {
        // Determine instrument type
        let instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
        switch (rawSymbol.instrument_type.toUpperCase()) {
          case 'EQ':
          case 'EQUITY':
            instrumentType = 'EQUITY';
            break;
          case 'CE':
          case 'PE':
          case 'OPTION':
            instrumentType = 'OPTION';
            break;
          case 'FUT':
          case 'FUTURE':
            instrumentType = 'FUTURE';
            break;
          default:
            // Skip unsupported instrument types
            continue;
        }

        // Map exchange
        let exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX';
        switch (rawSymbol.exchange.toUpperCase()) {
          case 'NSE':
            exchange = instrumentType === 'EQUITY' ? 'NSE' : 'NFO';
            break;
          case 'BSE':
            exchange = instrumentType === 'EQUITY' ? 'BSE' : 'BFO';
            break;
          case 'MCX':
            exchange = 'MCX';
            break;
          case 'NFO':
            exchange = 'NFO';
            break;
          case 'BFO':
            exchange = 'BFO';
            break;
          default:
            // Default to NSE for equity, NFO for derivatives
            exchange = instrumentType === 'EQUITY' ? 'NSE' : 'NFO';
        }

        // Create display name
        let displayName = rawSymbol.name || rawSymbol.tradingsymbol;
        if (instrumentType === 'OPTION') {
          const optionType = rawSymbol.instrument_type.toUpperCase() === 'CE' ? 'CE' : 'PE';
          const expiryDate = rawSymbol.expiry ? new Date(rawSymbol.expiry).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
          }).toUpperCase() : '';
          displayName = `${rawSymbol.underlying || rawSymbol.tradingsymbol} ${rawSymbol.strike} ${optionType} ${expiryDate}`;
        } else if (instrumentType === 'FUTURE') {
          const expiryDate = rawSymbol.expiry ? new Date(rawSymbol.expiry).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
          }).toUpperCase() : '';
          displayName = `${rawSymbol.underlying || rawSymbol.tradingsymbol} ${expiryDate} FUT`;
        }

        // Create standardized symbol
        const standardizedSymbol: CreateStandardizedSymbolData = {
          displayName,
          tradingSymbol: rawSymbol.tradingsymbol,
          instrumentType,
          exchange,
          segment: rawSymbol.segment || (instrumentType === 'EQUITY' ? 'EQ' : 'FO'),
          underlying: (instrumentType !== 'EQUITY' && rawSymbol.underlying) ? rawSymbol.underlying : undefined,
          strikePrice: (instrumentType === 'OPTION' && rawSymbol.strike > 0) ? rawSymbol.strike : undefined,
          optionType: (instrumentType === 'OPTION') ? 
            (rawSymbol.instrument_type.toUpperCase() === 'CE' ? 'CE' : 'PE') : undefined,
          expiryDate: (instrumentType !== 'EQUITY' && rawSymbol.expiry) ? 
            new Date(rawSymbol.expiry).toISOString().split('T')[0] : undefined,
          lotSize: rawSymbol.lot_size || 1,
          tickSize: rawSymbol.tick_size || 0.05,
          source: 'upstox',
          isin: rawSymbol.isin || undefined,
          companyName: (instrumentType === 'EQUITY') ? rawSymbol.name : undefined,
          sector: undefined // Upstox doesn't provide sector information
        };

        standardizedSymbols.push(standardizedSymbol);

      } catch (error) {
        logger.warn('Failed to transform symbol', {
          component: 'UPSTOX_DATA_PROCESSOR',
          operation: 'TRANSFORM_SYMBOL_ERROR',
          symbol: rawSymbol.tradingsymbol
        }, error);
      }
    }

    logger.info('Completed transformation to standardized format', {
      component: 'UPSTOX_DATA_PROCESSOR',
      operation: 'TRANSFORM_COMPLETE',
      inputCount: rawSymbols.length,
      outputCount: standardizedSymbols.length
    });

    return standardizedSymbols;
  }

  /**
   * Validate symbol data
   */
  private validateSymbolData(symbols: CreateStandardizedSymbolData[]): UpstoxValidationResult {
    const validSymbols: CreateStandardizedSymbolData[] = [];
    const invalidSymbols: RawUpstoxSymbolData[] = [];
    const errors: string[] = [];

    logger.info('Validating symbol data', {
      component: 'UPSTOX_DATA_PROCESSOR',
      operation: 'VALIDATE_SYMBOL_DATA',
      inputCount: symbols.length
    });

    for (const symbol of symbols) {
      const symbolErrors: string[] = [];

      // Required field validations
      if (!symbol.displayName?.trim()) {
        symbolErrors.push('Display name is required');
      }

      if (!symbol.tradingSymbol?.trim()) {
        symbolErrors.push('Trading symbol is required');
      }

      if (!symbol.instrumentType) {
        symbolErrors.push('Instrument type is required');
      }

      if (!symbol.exchange) {
        symbolErrors.push('Exchange is required');
      }

      if (!symbol.segment?.trim()) {
        symbolErrors.push('Segment is required');
      }

      if (!symbol.source?.trim()) {
        symbolErrors.push('Source is required');
      }

      // Numeric validations
      if (symbol.lotSize <= 0) {
        symbolErrors.push('Lot size must be positive');
      }

      if (symbol.tickSize <= 0) {
        symbolErrors.push('Tick size must be positive');
      }

      // Options-specific validations
      if (symbol.instrumentType === 'OPTION') {
        if (!symbol.underlying?.trim()) {
          symbolErrors.push('Underlying is required for options');
        }

        if (!symbol.strikePrice || symbol.strikePrice <= 0) {
          symbolErrors.push('Valid strike price is required for options');
        }

        if (!symbol.optionType) {
          symbolErrors.push('Option type (CE/PE) is required for options');
        }

        if (!symbol.expiryDate) {
          symbolErrors.push('Expiry date is required for options');
        }
      }

      // Futures-specific validations
      if (symbol.instrumentType === 'FUTURE') {
        if (!symbol.underlying?.trim()) {
          symbolErrors.push('Underlying is required for futures');
        }

        if (!symbol.expiryDate) {
          symbolErrors.push('Expiry date is required for futures');
        }
      }

      // Date validation
      if (symbol.expiryDate) {
        const expiryDate = new Date(symbol.expiryDate);
        if (isNaN(expiryDate.getTime())) {
          symbolErrors.push('Invalid expiry date format');
        } else if (expiryDate < new Date()) {
          symbolErrors.push('Expiry date cannot be in the past');
        }
      }

      if (symbolErrors.length === 0) {
        validSymbols.push(symbol);
      } else {
        errors.push(`${symbol.tradingSymbol}: ${symbolErrors.join(', ')}`);
        // Note: We don't have the raw symbol here, so we'll skip adding to invalidSymbols
      }
    }

    logger.info('Completed symbol data validation', {
      component: 'UPSTOX_DATA_PROCESSOR',
      operation: 'VALIDATE_COMPLETE',
      inputCount: symbols.length,
      validCount: validSymbols.length,
      invalidCount: symbols.length - validSymbols.length,
      errorCount: errors.length
    });

    return {
      isValid: errors.length === 0,
      errors,
      validSymbols,
      invalidSymbols
    };
  }

  /**
   * Main processing method - downloads, parses, transforms, validates and stores Upstox data
   */
  async processUpstoxData(filePath?: string): Promise<UpstoxProcessingStats> {
    if (this.isProcessing) {
      throw new Error('Upstox data processing already in progress');
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      logger.info('Starting Upstox data processing', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'PROCESS_UPSTOX_DATA',
        filePath: filePath || 'download from URL'
      });

      // Create processing log
      const processingLog = await symbolDatabaseService.createProcessingLog({
        processType: 'DAILY_UPDATE',
        source: 'upstox',
        status: 'STARTED'
      });

      let rawSymbols: RawUpstoxSymbolData[];

      try {
        // Step 1: Download CSV if no file path provided
        if (!filePath) {
          await this.downloadUpstoxCSV();
          filePath = this.CSV_FILE_PATH;
        }

        // Step 2: Parse CSV file
        rawSymbols = await this.parseCSVFile();

        // Step 3: Transform to standardized format
        const standardizedSymbols = this.transformToStandardFormat(rawSymbols);

        // Step 4: Validate symbol data
        const validation = this.validateSymbolData(standardizedSymbols);

        // Step 5: Store in database
        const result: ProcessingResult = await symbolDatabaseService.upsertSymbols(validation.validSymbols);

        // Calculate processing time
        const processingTime = Date.now() - startTime;

        // Create processing stats
        const stats: UpstoxProcessingStats = {
          totalProcessed: rawSymbols.length,
          validSymbols: result.validSymbols,
          invalidSymbols: result.invalidSymbols,
          newSymbols: result.newSymbols,
          updatedSymbols: result.updatedSymbols,
          errors: [...validation.errors, ...result.errors],
          processingTime
        };

        // Update processing log
        await symbolDatabaseService.updateProcessingLog(processingLog.id, {
          status: 'COMPLETED',
          totalProcessed: stats.totalProcessed,
          validSymbols: stats.validSymbols,
          invalidSymbols: stats.invalidSymbols,
          newSymbols: stats.newSymbols,
          updatedSymbols: stats.updatedSymbols,
          errorDetails: stats.errors.length > 0 ? { errors: stats.errors } : undefined
        });

        // Save stats and update last processed time
        this.processingStats = stats;
        this.lastProcessed = new Date();
        this.saveProcessingStats();

        logger.info('Completed Upstox data processing', {
          component: 'UPSTOX_DATA_PROCESSOR',
          operation: 'PROCESS_COMPLETE',
          ...stats
        });

        return stats;

      } catch (error) {
        // Update processing log with error
        await symbolDatabaseService.updateProcessingLog(processingLog.id, {
          status: 'FAILED',
          errorDetails: { error: error instanceof Error ? error.message : String(error) }
        });
        throw error;
      }

    } catch (error: any) {
      logger.error('Failed to process Upstox data', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'PROCESS_ERROR'
      }, error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Run manual update
   */
  async runManualUpdate(): Promise<UpstoxProcessingStats> {
    logger.info('Running manual Upstox data update', {
      component: 'UPSTOX_DATA_PROCESSOR',
      operation: 'RUN_MANUAL_UPDATE'
    });

    return await this.processUpstoxData();
  }

  /**
   * Check if processing is needed (data older than 24 hours)
   */
  needsUpdate(): boolean {
    if (!this.lastProcessed) return true;
    
    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - this.lastProcessed.getTime()) / (1000 * 60 * 60);
    return hoursSinceUpdate > 24;
  }

  /**
   * Get processing statistics
   */
  getStats(): any {
    return {
      service: 'Upstox Data Processor',
      status: this.isProcessing ? 'processing' : 'idle',
      lastProcessed: this.lastProcessed?.toISOString(),
      needsUpdate: this.needsUpdate(),
      processingStats: this.processingStats,
      dataSource: 'Upstox CSV',
      csvUrl: this.UPSTOX_CSV_URL,
      nextUpdate: 'Daily at 6:00 AM IST'
    };
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return !this.isProcessing && this.processingStats !== null;
  }

  /**
   * Test CSV download and parsing (for debugging)
   */
  async testCSVDownloadAndParse(): Promise<{ downloadSuccess: boolean; parseSuccess: boolean; symbolCount: number; error?: string }> {
    try {
      logger.info('Testing CSV download and parse', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'TEST_CSV_DOWNLOAD_PARSE'
      });

      // Test download
      await this.downloadUpstoxCSV();
      
      // Test parsing
      const symbols = await this.parseCSVFile();
      
      return {
        downloadSuccess: true,
        parseSuccess: true,
        symbolCount: symbols.length
      };
    } catch (error: any) {
      logger.error('CSV download/parse test failed', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'TEST_CSV_ERROR'
      }, error);
      
      return {
        downloadSuccess: fs.existsSync(this.CSV_FILE_PATH),
        parseSuccess: false,
        symbolCount: 0,
        error: error.message
      };
    }
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Upstox Data Processor', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'INITIALIZE'
      });

      // Check if we need to process data on startup
      if (this.needsUpdate()) {
        logger.info('Upstox data is stale or missing, processing', {
          component: 'UPSTOX_DATA_PROCESSOR',
          operation: 'INITIALIZE_PROCESS'
        });
        await this.processUpstoxData();
      } else {
        logger.info('Upstox data is up to date', {
          component: 'UPSTOX_DATA_PROCESSOR',
          operation: 'INITIALIZE_UP_TO_DATE'
        });
      }

      logger.info('Upstox Data Processor initialized', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'INITIALIZE_COMPLETE'
      });
    } catch (error: any) {
      logger.error('Error initializing Upstox Data Processor', {
        component: 'UPSTOX_DATA_PROCESSOR',
        operation: 'INITIALIZE_ERROR'
      }, error);
      // Don't throw error, allow service to work with cached data
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    logger.info('Cleaning up Upstox Data Processor', {
      component: 'UPSTOX_DATA_PROCESSOR',
      operation: 'CLEANUP'
    });
    // Any cleanup logic would go here
  }
}

// Export singleton instance
export const upstoxDataProcessor = new UpstoxDataProcessor();