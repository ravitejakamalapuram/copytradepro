import axios from 'axios';
import fs from 'fs';
import path from 'path';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { CreateStandardizedSymbolData } from '../models/symbolModels';
import { symbolDatabaseService, ProcessingResult } from './symbolDatabaseService';

// Configuration for symbol data sources (extensible for future sources)
export interface SymbolDataSourceConfig {
  name: string;
  enabled: boolean;
  url: string;
  format: 'json' | 'csv';
  compressed: boolean;
  priority: number;
}

// Raw symbol data interface (based on actual Upstox JSON format)
export interface RawSymbolData {
  instrument_key: string;
  exchange_token: string;
  trading_symbol: string; // Note: underscore in actual data
  name: string;
  last_price?: number;
  expiry?: number; // Unix timestamp
  strike_price?: number;
  tick_size: number;
  lot_size: number;
  instrument_type: string;
  segment: string;
  exchange: string;
  asset_symbol?: string;
  underlying_symbol?: string;
  weekly?: boolean;
  minimum_lot?: number;
  freeze_quantity?: number;
  qty_multiplier?: number;
  asset_type?: string;
  underlying_type?: string;
}

// Processing statistics interface
export interface SymbolProcessingStats {
  totalProcessed: number;
  validSymbols: number;
  invalidSymbols: number;
  newSymbols: number;
  updatedSymbols: number;
  errors: string[];
  processingTime: number;
  dataSource: string;
}

/**
 * Unified Symbol Data Processor Service
 * Handles downloading, parsing, and processing symbol data from configured sources
 * Currently supports Upstox JSON format, extensible for future data sources
 */
export class UnifiedSymbolProcessor {
  // Configuration for data sources (extensible)
  private readonly DATA_SOURCES: SymbolDataSourceConfig[] = [
    {
      name: 'upstox',
      enabled: true,
      url: 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz',
      format: 'json',
      compressed: true,
      priority: 1
    }
  ];

  private readonly DATA_DIR = path.join(__dirname, '../../data');
  private readonly JSON_FILE_PATH = path.join(this.DATA_DIR, 'symbols.json');
  private readonly STATS_FILE_PATH = path.join(this.DATA_DIR, 'processing_stats.json');

  private isProcessing = false;
  private lastProcessed: Date | null = null;
  private processingStats: SymbolProcessingStats | null = null;
  private cronJob: any = null;

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
      logger.info('Created symbol data directory', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'ENSURE_DATA_DIRECTORY'
      });
    }
  }

  /**
   * Load processing statistics from cache
   */
  private loadProcessingStats(): void {
    try {
      if (fs.existsSync(this.STATS_FILE_PATH)) {
        const data = fs.readFileSync(this.STATS_FILE_PATH, 'utf8');
        const parsed = JSON.parse(data);
        this.processingStats = parsed.stats || null;
        this.lastProcessed = parsed.lastProcessed ? new Date(parsed.lastProcessed) : null;

        logger.info('Loaded symbol processing stats from cache', {
          component: 'UNIFIED_SYMBOL_PROCESSOR',
          operation: 'LOAD_PROCESSING_STATS',
          lastProcessed: this.lastProcessed?.toISOString()
        });
      }
    } catch (error: any) {
      logger.warn('Failed to load processing stats from cache', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'LOAD_PROCESSING_STATS_ERROR',
        error: error.message
      });
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

      fs.writeFileSync(this.STATS_FILE_PATH, JSON.stringify(data, null, 2));
      logger.info('Saved symbol processing stats to cache', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'SAVE_PROCESSING_STATS'
      });
    } catch (error: any) {
      logger.error('Failed to save processing stats', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'SAVE_PROCESSING_STATS_ERROR'
      }, error);
    }
  }

  /**
   * Setup daily cron job for symbol data updates
   */
  private setupDailyCron(): void {
    // Schedule for 6:00 AM IST daily (before market opens)
    this.cronJob = cron.schedule('0 6 * * *', async () => {
      logger.info('Daily symbol data update triggered', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'DAILY_CRON_TRIGGER'
      });
      await this.processSymbolData();
    }, {
      timezone: 'Asia/Kolkata',
      scheduled: false // Don't start immediately
    });

    logger.info('Scheduled daily symbol data updates', {
      component: 'UNIFIED_SYMBOL_PROCESSOR',
      operation: 'SETUP_DAILY_CRON',
      schedule: '6:00 AM IST'
    });
  }

  /**
   * Start the cron scheduler
   */
  startScheduler(): void {
    if (this.cronJob) {
      this.cronJob.start();
      logger.info('Started symbol data scheduler', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'START_SCHEDULER'
      });
    }
  }

  /**
   * Stop the cron scheduler
   */
  stopScheduler(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('Stopped symbol data scheduler', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'STOP_SCHEDULER'
      });
    }
  }

  /**
   * Download symbol data from the primary data source
   */
  private async downloadSymbolData(): Promise<string> {
    const primarySource = this.DATA_SOURCES.find(source => source.enabled && source.priority === 1);

    if (!primarySource) {
      throw new Error('No enabled data source found');
    }

    logger.info('Downloading symbol data', {
      component: 'UNIFIED_SYMBOL_PROCESSOR',
      operation: 'DOWNLOAD_SYMBOL_DATA',
      source: primarySource.name,
      url: primarySource.url,
      compressed: primarySource.compressed
    });

    try {
      const response = await axios.get(primarySource.url, {
        responseType: 'stream',
        timeout: 120000, // 2 minutes timeout
        maxRedirects: 5,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Encoding': 'gzip, deflate',
          'Accept': 'application/json, */*'
        },
        validateStatus: (status) => status >= 200 && status < 300
      });

      if (!response.data) {
        throw new Error('No data received from URL');
      }

      // Create file writer
      const writer = fs.createWriteStream(this.JSON_FILE_PATH);

      if (primarySource.compressed) {
        // Handle gzipped data
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

      // Verify file was created and has content
      const stats = fs.statSync(this.JSON_FILE_PATH);
      if (stats.size === 0) {
        throw new Error('Downloaded file is empty');
      }

      logger.info('Symbol data downloaded successfully', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'DOWNLOAD_SUCCESS',
        source: primarySource.name,
        filePath: this.JSON_FILE_PATH,
        fileSize: stats.size
      });

      return this.JSON_FILE_PATH;

    } catch (error: any) {
      logger.error('Failed to download symbol data', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'DOWNLOAD_ERROR',
        source: primarySource.name,
        url: primarySource.url
      }, error);
      throw error;
    }
  }

  /**
   * Parse JSON file and extract raw symbol data
   */
  private async parseJSONFile(): Promise<RawSymbolData[]> {
    try {
      if (!fs.existsSync(this.JSON_FILE_PATH)) {
        throw new Error(`JSON file not found: ${this.JSON_FILE_PATH}`);
      }

      const stats = fs.statSync(this.JSON_FILE_PATH);
      if (stats.size === 0) {
        throw new Error('JSON file is empty');
      }

      logger.info('Starting to parse symbol JSON file', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'PARSE_JSON_FILE',
        filePath: this.JSON_FILE_PATH,
        fileSize: stats.size
      });

      const data = fs.readFileSync(this.JSON_FILE_PATH, 'utf8');
      const jsonData = JSON.parse(data);

      // Handle both array format and object format
      const symbols = Array.isArray(jsonData) ? jsonData : Object.values(jsonData);

      logger.info('Completed parsing symbol JSON file', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'PARSE_JSON_COMPLETE',
        totalSymbols: symbols.length
      });

      return symbols as RawSymbolData[];
    } catch (error: any) {
      logger.error('Error parsing JSON file', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'PARSE_JSON_FILE_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Transform raw symbol data to standardized format
   */
  private transformToStandardFormat(rawSymbols: RawSymbolData[]): CreateStandardizedSymbolData[] {
    const standardizedSymbols: CreateStandardizedSymbolData[] = [];

    // Log sample raw symbols for debugging
    logger.info('Sample raw symbols for debugging', {
      component: 'UNIFIED_SYMBOL_PROCESSOR',
      operation: 'RAW_SYMBOLS_DEBUG',
      sampleCount: Math.min(5, rawSymbols.length),
      samples: rawSymbols.slice(0, 5).map(s => ({
        trading_symbol: s.trading_symbol,
        exchange: s.exchange,
        instrument_type: s.instrument_type,
        name: s.name,
        segment: s.segment
      }))
    });

    for (const symbol of rawSymbols) {
      try {
        // Skip symbols with missing required fields
        if (!symbol.trading_symbol || !symbol.exchange || !symbol.instrument_type) {
          logger.warn('Skipping symbol with missing required fields', {
            component: 'UNIFIED_SYMBOL_PROCESSOR',
            operation: 'SKIP_INVALID_SYMBOL',
            symbol: {
              trading_symbol: symbol.trading_symbol,
              exchange: symbol.exchange,
              instrument_type: symbol.instrument_type,
              name: symbol.name
            }
          });
          continue;
        }
        // Map exchange correctly (fix BSE mapping issue)
        let exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX';
        if (symbol.exchange.startsWith('BSE')) {
          exchange = symbol.exchange.includes('FO') ? 'BFO' : 'BSE';
        } else if (symbol.exchange.startsWith('NSE')) {
          exchange = symbol.exchange.includes('FO') ? 'NFO' : 'NSE';
        } else if (symbol.exchange === 'MCX') {
          exchange = 'MCX';
        } else {
          // Default mapping for unknown exchanges
          exchange = 'NSE';
        }

        // Determine instrument type
        let instrumentType: 'EQUITY' | 'FUTURE' | 'OPTION';
        switch (symbol.instrument_type) {
          case 'EQ':
          case 'EQUITY':
            instrumentType = 'EQUITY';
            break;
          case 'FUT':
          case 'FUTURE':
            instrumentType = 'FUTURE';
            break;
          case 'CE':
          case 'PE':
          case 'OPT':
          case 'OPTION':
            instrumentType = 'OPTION';
            break;
          default:
            // Default to EQUITY for unknown types (including commodities)
            instrumentType = 'EQUITY';
        }

        // Determine option type for options
        let optionType: 'CE' | 'PE' | undefined;
        if (instrumentType === 'OPTION') {
          optionType = symbol.instrument_type === 'CE' ? 'CE' : 'PE';
        }

        const standardizedSymbol: CreateStandardizedSymbolData = {
          displayName: symbol.name || symbol.trading_symbol || 'Unknown',
          tradingSymbol: symbol.trading_symbol,
          instrumentType,
          exchange,
          segment: symbol.segment || (instrumentType === 'EQUITY' ? `${exchange}_EQ` : `${exchange}_FO`),
          underlying: instrumentType !== 'EQUITY' ? symbol.underlying_symbol : undefined,
          strikePrice: instrumentType === 'OPTION' ? symbol.strike_price : undefined,
          optionType,
          expiryDate: (instrumentType !== 'EQUITY' && symbol.expiry) ?
            new Date(symbol.expiry).toISOString().split('T')[0] : undefined,
          lotSize: symbol.lot_size || 1,
          tickSize: symbol.tick_size || 0.05,
          source: 'upstox'
        };

        standardizedSymbols.push(standardizedSymbol);
      } catch (error: any) {
        logger.warn('Failed to transform symbol', {
          component: 'UNIFIED_SYMBOL_PROCESSOR',
          operation: 'TRANSFORM_SYMBOL_ERROR',
          symbol: symbol.trading_symbol,
          error: error.message
        });
      }
    }

    logger.info('Completed symbol transformation', {
      component: 'UNIFIED_SYMBOL_PROCESSOR',
      operation: 'TRANSFORM_COMPLETE',
      inputCount: rawSymbols.length,
      outputCount: standardizedSymbols.length
    });

    return standardizedSymbols;
  }

  /**
   * Main processing method - downloads, parses, transforms, and stores symbol data
   */
  async processSymbolData(): Promise<SymbolProcessingStats> {
    if (this.isProcessing) {
      throw new Error('Symbol data processing already in progress');
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      logger.info('Starting symbol data processing', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'PROCESS_SYMBOL_DATA'
      });

      // Create processing log
      const processingLog = await symbolDatabaseService.createProcessingLog({
        processType: 'DAILY_UPDATE',
        source: 'upstox',
        status: 'STARTED'
      });

      try {
        // Step 1: Download symbol data
        await this.downloadSymbolData();

        // Step 2: Parse JSON file
        const rawSymbols = await this.parseJSONFile();

        // Step 3: Transform to standardized format
        const standardizedSymbols = this.transformToStandardFormat(rawSymbols);

        // Step 4: Clear existing symbols and insert fresh data
        logger.info('Clearing existing symbols for fresh data load', {
          component: 'UNIFIED_SYMBOL_PROCESSOR',
          operation: 'CLEAR_EXISTING_SYMBOLS'
        });

        await symbolDatabaseService.clearAllSymbols();

        logger.info('Inserting fresh symbol data', {
          component: 'UNIFIED_SYMBOL_PROCESSOR',
          operation: 'INSERT_FRESH_SYMBOLS',
          symbolCount: standardizedSymbols.length
        });

        const result: ProcessingResult = await symbolDatabaseService.upsertSymbols(standardizedSymbols);

        // Calculate processing time
        const processingTime = Date.now() - startTime;

        // Create processing stats
        const stats: SymbolProcessingStats = {
          totalProcessed: rawSymbols.length,
          validSymbols: result.validSymbols,
          invalidSymbols: result.invalidSymbols,
          newSymbols: result.newSymbols,
          updatedSymbols: result.updatedSymbols,
          errors: result.errors,
          processingTime,
          dataSource: 'upstox'
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

        logger.info('Completed symbol data processing', {
          component: 'UNIFIED_SYMBOL_PROCESSOR',
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
      logger.error('Failed to process symbol data', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'PROCESS_ERROR'
      }, error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Unified Symbol Processor', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'INITIALIZE'
      });

      // Ensure symbol database service is initialized first
      if (!symbolDatabaseService.isReady()) {
        logger.info('Initializing symbol database service first', {
          component: 'UNIFIED_SYMBOL_PROCESSOR',
          operation: 'INIT_DATABASE_SERVICE'
        });
        await symbolDatabaseService.initialize();
      }

      // Startup rule: do NOT download/process on server start unless no local data file exists
      if (!fs.existsSync(this.JSON_FILE_PATH)) {
        logger.info('Symbol data file missing. Performing initial load once.', {
          component: 'UNIFIED_SYMBOL_PROCESSOR',
          operation: 'INITIAL_LOAD_NO_FILE'
        });
        await this.processSymbolData();
      } else {
        logger.info('Symbol data present locally. Skipping startup download; daily cron will refresh.', {
          component: 'UNIFIED_SYMBOL_PROCESSOR',
          operation: 'INITIALIZE_UP_TO_DATE'
        });
      }

      // Start the scheduler
      this.startScheduler();

      logger.info('Unified Symbol Processor initialized', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'INITIALIZE_COMPLETE'
      });
    } catch (error: any) {
      logger.error('Failed to initialize Unified Symbol Processor', {
        component: 'UNIFIED_SYMBOL_PROCESSOR',
        operation: 'INITIALIZE_ERROR'
      }, error);
      throw error;
    }
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
      service: 'Unified Symbol Processor',
      status: this.isProcessing ? 'processing' : 'idle',
      lastProcessed: this.lastProcessed?.toISOString(),
      needsUpdate: this.needsUpdate(),
      processingStats: this.processingStats,
      dataSources: this.DATA_SOURCES,
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
   * Returns true if a local symbols.json exists and is non-empty
   */
  hasLocalData(): boolean {
    try {
      if (!fs.existsSync(this.JSON_FILE_PATH)) return false;
      const stats = fs.statSync(this.JSON_FILE_PATH);
      return stats.size > 0;
    } catch {
      return false;
    }
  }

  /**
   * Run manual update
   */
  async runManualUpdate(): Promise<SymbolProcessingStats> {
    logger.info('Running manual symbol data update', {
      component: 'UNIFIED_SYMBOL_PROCESSOR',
      operation: 'RUN_MANUAL_UPDATE'
    });

    return await this.processSymbolData();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.stopScheduler();
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }
  }
}

// Export singleton instance
export const unifiedSymbolProcessor = new UnifiedSymbolProcessor();
