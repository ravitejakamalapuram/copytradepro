import axios from 'axios';
import { logger } from '../utils/logger';
import { getDatabase } from './databaseFactory';
import { MongoDatabase } from './mongoDatabase';
import cron from 'node-cron';

/**
 * Options Data Service
 * Handles fetching and managing F&O instrument data from various APIs
 */
export class OptionsDataService {
  private static instance: OptionsDataService;
  private isInitialized = false;
  private upstoxApiKey: string;
  private tiqs: { appId: string; token: string } | null = null;

  private constructor() {
    this.upstoxApiKey = process.env.UPSTOX_API_KEY || '';
    
    if (process.env.TIQS_APP_ID && process.env.TIQS_TOKEN) {
      this.tiqs = {
        appId: process.env.TIQS_APP_ID,
        token: process.env.TIQS_TOKEN
      };
    }
  }

  static getInstance(): OptionsDataService {
    if (!OptionsDataService.instance) {
      OptionsDataService.instance = new OptionsDataService();
    }
    return OptionsDataService.instance;
  }

  /**
   * Initialize the service and start scheduled jobs
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    logger.info('Initializing Options Data Service', {
      component: 'OPTIONS_DATA_SERVICE',
      operation: 'INITIALIZE'
    });

    // Schedule daily instrument refresh at 8:00 AM IST
    cron.schedule('0 8 * * *', async () => {
      await this.refreshInstruments();
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Schedule EOD data collection at 4:00 PM IST (after market close)
    cron.schedule('0 16 * * 1-5', async () => {
      await this.collectEODData();
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Schedule expired contract cleanup at 9:00 PM IST
    cron.schedule('0 21 * * *', async () => {
      await this.cleanupExpiredContracts();
    }, {
      timezone: 'Asia/Kolkata'
    });

    // Fetch instruments immediately on startup
    // Check if we need to fetch fresh data (with safety check)
    const { symbolDatabaseService } = require('./symbolDatabaseService');
    
    let dataStatus: any = { hasData: false, isFresh: false };
    try {
      // Ensure symbol database service is initialized first
      if (!symbolDatabaseService.isReady()) {
        await symbolDatabaseService.initialize();
      }
      dataStatus = await symbolDatabaseService.checkDataFreshness();
    } catch (error: any) {
      logger.warn('Failed to check data freshness, proceeding with fetch', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'CHECK_FRESHNESS_ERROR',
        error: error?.message || 'Unknown error'
      });
      // Continue with fetch if freshness check fails
    }
    
    if (dataStatus.hasData && dataStatus.isFresh) {
      logger.info('Fresh symbol data already exists, skipping startup fetch', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'SKIP_STARTUP_FETCH',
        totalSymbols: dataStatus.totalSymbols,
        lastUpdated: dataStatus.lastUpdated,
        ageHours: dataStatus.ageHours
      });
    } else {
      logger.info('Fetching instruments on startup (data is stale or missing)', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'STARTUP_FETCH',
        hasData: dataStatus.hasData,
        isFresh: dataStatus.isFresh,
        ageHours: dataStatus.ageHours
      });
      
      try {
        await this.refreshInstruments();
        logger.info('Instruments fetched successfully on startup', {
          component: 'OPTIONS_DATA_SERVICE',
          operation: 'STARTUP_FETCH_SUCCESS'
        });
      } catch (error) {
        logger.error('Failed to fetch instruments on startup', {
          component: 'OPTIONS_DATA_SERVICE',
          operation: 'STARTUP_FETCH_ERROR'
        }, error);
      }
    }

    this.isInitialized = true;
    logger.info('Options Data Service initialized successfully', {
      component: 'OPTIONS_DATA_SERVICE',
      operation: 'INITIALIZE_SUCCESS'
    });
  }

  /**
   * Fetch instruments from Upstox API
   */
  private async fetchUpstoxInstruments(): Promise<any[]> {
    try {
      logger.info('Fetching instruments from Upstox', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'FETCH_UPSTOX_INSTRUMENTS'
      });

      // Download the compressed instrument file
      const response = await axios.get(
        'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz',
        {
          responseType: 'arraybuffer',
          headers: {
            'Accept-Encoding': 'gzip'
          },
          timeout: 30000
        }
      );

      // Decompress gzip data
      const zlib = require('zlib');
      const decompressed = zlib.gunzipSync(response.data);
      const jsonData = JSON.parse(decompressed.toString());

      logger.info('Successfully fetched and parsed Upstox instruments', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'FETCH_UPSTOX_INSTRUMENTS_SUCCESS',
        totalInstruments: jsonData.length
      });

      // Log summary of fetched data
      if (jsonData.length > 0) {
        const foCount = jsonData.filter((inst: any) => 
          inst.segment === 'NSE_FO' || 
          inst.exchange === 'NFO' ||
          inst.instrument_type === 'OPT' ||
          inst.instrument_type === 'FUT'
        ).length;
        
        console.log(`📊 Upstox data: ${jsonData.length} total instruments, ${foCount} F&O instruments`);
      }

      return jsonData;
    } catch (error) {
      logger.error('Failed to fetch Upstox instruments', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'FETCH_UPSTOX_INSTRUMENTS_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Fetch instruments from TIQS API (backup)
   */
  private async fetchTIQSInstruments(): Promise<any[]> {
    if (!this.tiqs) {
      throw new Error('TIQS credentials not configured');
    }

    try {
      logger.info('Fetching instruments from TIQS', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'FETCH_TIQS_INSTRUMENTS'
      });

      const response = await axios.get('https://api.tiqs.trading/all', {
        headers: {
          'appId': this.tiqs.appId,
          'token': this.tiqs.token
        }
      });

      // Parse CSV response
      const csvData = response.data;
      // TODO: Implement CSV parsing
      return [];
    } catch (error) {
      logger.error('Failed to fetch TIQS instruments', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'FETCH_TIQS_INSTRUMENTS_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Refresh instrument master data
   */
  async refreshInstruments(): Promise<void> {
    logger.info('Starting instrument refresh', {
      component: 'OPTIONS_DATA_SERVICE',
      operation: 'REFRESH_INSTRUMENTS'
    });

    try {
      let instruments: any[] = [];

      // Fetch from Upstox - no fallbacks
      instruments = await this.fetchUpstoxInstruments();

      // Option 1: Store ALL instruments (remove filtering)
      const allInstruments = instruments;
      console.log(`📊 Storing ${allInstruments.length} total instruments (no filtering)`);

      // Option 2: Store F&O + Equity instruments (selective filtering)
      // const relevantInstruments = instruments.filter(instrument => 
      //   instrument.segment === 'NSE_FO' || 
      //   instrument.exchange === 'NFO' ||
      //   instrument.instrument_type === 'OPT' ||
      //   instrument.instrument_type === 'FUT' ||
      //   instrument.instrument_type === 'EQ' ||
      //   instrument.segment === 'NSE_EQ' ||
      //   (instrument.exchange === 'NSE' && (instrument.instrument_type === 'OPT' || instrument.instrument_type === 'FUT' || instrument.instrument_type === 'EQ'))
      // );

      const foInstruments = allInstruments; // Use all instruments instead of filtered

      // Store in database
      await this.storeInstruments(foInstruments);

      logger.info('Instrument refresh completed', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'REFRESH_INSTRUMENTS_SUCCESS',
        instrumentCount: foInstruments.length
      });
    } catch (error) {
      logger.error('Instrument refresh failed', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'REFRESH_INSTRUMENTS_ERROR'
      }, error);
    }
  }

  /**
   * Store instruments in database
   */
  private async storeInstruments(instruments: any[]): Promise<void> {
    try {
      // Get MongoDB connection directly
      const mongoose = require('mongoose');
      const db = mongoose.connection.db;
      const collection = db.collection('standardizedsymbols');
      
      // Clear all existing data since we're now storing all instruments
      await collection.deleteMany({});
      
      // Transform and insert new data in standardized format
      const transformedInstruments = instruments.map(instrument => {
        // Extract underlying symbol and strike from trading_symbol (only for F&O)
        // Format: "INDUSINDBK 780 CE 30 SEP 25" or "NIFTY 21000 CE 30 JAN 25"
        let underlying = null;
        let strike = null;
        
        // Only extract underlying and strike for F&O instruments
        if (instrument.instrument_type === 'FUT' || instrument.instrument_type === 'CE' || instrument.instrument_type === 'PE' || instrument.instrument_type === 'OPT') {
          if (instrument.trading_symbol) {
            const parts = instrument.trading_symbol.split(' ');
            if (parts.length >= 3) {
              underlying = parts[0]; // First part is underlying
              const strikeStr = parts[1];
              if (!isNaN(parseFloat(strikeStr))) {
                strike = parseFloat(strikeStr);
              }
            }
          }
        }

        // Determine instrument type based on the raw data
        let instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
        if (instrument.instrument_type === 'FUT') {
          instrumentType = 'FUTURE';
        } else if (instrument.instrument_type === 'CE' || instrument.instrument_type === 'PE' || instrument.instrument_type === 'OPT') {
          instrumentType = 'OPTION';
        } else {
          instrumentType = 'EQUITY'; // Default for stocks, bonds, etc.
        }

        const optionType = (instrument.instrument_type === 'CE' || instrument.instrument_type === 'PE') 
          ? instrument.instrument_type as 'CE' | 'PE' 
          : undefined;
        
        return {
          // Standardized format
          displayName: instrument.trading_symbol || instrument.name || 'Unknown',
          tradingSymbol: instrument.trading_symbol,
          instrumentType,
          exchange: (instrument.exchange || 'NSE') as 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX',
          segment: instrument.segment || (instrumentType === 'EQUITY' ? 'NSE_EQ' : 'NSE_FO'),
          underlying: instrumentType !== 'EQUITY' ? (underlying || instrument.underlying) : undefined,
          strikePrice: instrumentType === 'OPTION' ? (strike || instrument.strike) : undefined,
          optionType,
          expiryDate: (instrumentType !== 'EQUITY' && instrument.expiry) ? new Date(instrument.expiry).toISOString().split('T')[0] : undefined,
          lotSize: instrument.lot_size || 1,
          tickSize: instrument.tick_size || 0.05,
          source: 'upstox_api',
          companyName: instrument.name,
          isActive: true,
          
          // Legacy fields for backward compatibility (can be removed later)
          instrument_key: instrument.instrument_key,
          exchange_token: instrument.exchange_token,
          last_price: instrument.last_price,
          
          createdAt: new Date(),
          updatedAt: new Date()
        };
      });
      
      if (transformedInstruments.length > 0) {
        await collection.insertMany(transformedInstruments);
      }
      
      logger.info('Successfully stored instruments in database', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'STORE_INSTRUMENTS_SUCCESS',
        count: transformedInstruments.length
      });
    } catch (error) {
      logger.error('Failed to store instruments in database', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'STORE_INSTRUMENTS_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Collect End of Day data
   */
  async collectEODData(): Promise<void> {
    logger.info('Starting EOD data collection', {
      component: 'OPTIONS_DATA_SERVICE',
      operation: 'COLLECT_EOD_DATA'
    });

    try {
      // Get active instruments from database
      const activeInstruments = await this.getActiveInstruments();

      // Fetch EOD data for each instrument
      for (const instrument of activeInstruments) {
        await this.fetchInstrumentEODData(instrument);
      }

      logger.info('EOD data collection completed', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'COLLECT_EOD_DATA_SUCCESS',
        instrumentCount: activeInstruments.length
      });
    } catch (error) {
      logger.error('EOD data collection failed', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'COLLECT_EOD_DATA_ERROR'
      }, error);
    }
  }

  /**
   * Get active instruments from database
   */
  private async getActiveInstruments(): Promise<any[]> {
    // TODO: Implement database query for active instruments
    return [];
  }

  /**
   * Fetch EOD data for a specific instrument
   */
  private async fetchInstrumentEODData(instrument: any): Promise<void> {
    try {
      // TODO: Implement Upstox Historical Data API call
      logger.debug('Fetching EOD data for instrument', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'FETCH_INSTRUMENT_EOD',
        symbol: instrument.trading_symbol
      });
    } catch (error) {
      logger.error('Failed to fetch EOD data for instrument', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'FETCH_INSTRUMENT_EOD_ERROR',
        symbol: instrument.trading_symbol
      }, error);
    }
  }

  /**
   * Cleanup expired contracts
   */
  async cleanupExpiredContracts(): Promise<void> {
    logger.info('Starting expired contract cleanup', {
      component: 'OPTIONS_DATA_SERVICE',
      operation: 'CLEANUP_EXPIRED'
    });

    try {
      const db = await getDatabase();
      const today = new Date();

      // TODO: Implement cleanup logic for expired contracts
      
      logger.info('Expired contract cleanup completed', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'CLEANUP_EXPIRED_SUCCESS'
      });
    } catch (error) {
      logger.error('Expired contract cleanup failed', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'CLEANUP_EXPIRED_ERROR'
      }, error);
    }
  }

  /**
   * Get option chain for a symbol
   */
  async getOptionChain(symbol: string, expiry?: string): Promise<any> {
    try {
      logger.info('Fetching option chain', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'GET_OPTION_CHAIN',
        symbol,
        expiry
      });

      // TODO: Implement option chain fetching logic
      return {
        symbol,
        expiry,
        strikes: []
      };
    } catch (error) {
      logger.error('Failed to fetch option chain', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'GET_OPTION_CHAIN_ERROR',
        symbol
      }, error);
      throw error;
    }
  }

  /**
   * Get available expiry dates for a symbol
   */
  async getExpiryDates(symbol: string): Promise<string[]> {
    try {
      // TODO: Implement expiry dates fetching from database
      return [];
    } catch (error) {
      logger.error('Failed to fetch expiry dates', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'GET_EXPIRY_DATES_ERROR',
        symbol
      }, error);
      throw error;
    }
  }

  /**
   * Search instruments by symbol
   */
  async searchInstruments(query: string, type?: 'CE' | 'PE' | 'FUT'): Promise<any[]> {
    try {
      // Get MongoDB connection directly
      const mongoose = require('mongoose');
      const db = mongoose.connection.db;
      const collection = db.collection('standardizedsymbols');
      
      // Check if database has F&O data
      const totalCount = await collection.countDocuments({ 
        instrumentType: { $in: ['OPTION', 'FUTURE'] }
      });
      if (totalCount === 0) {
        console.log('⚠️ No F&O instruments found in database. Run force-update-fo to fetch data.');
        return [];
      }
      
      const searchQuery: any = {
        instrumentType: { $in: ['OPTION', 'FUTURE'] },
        $or: [
          { tradingSymbol: { $regex: query, $options: 'i' } },
          { displayName: { $regex: query, $options: 'i' } },
          { companyName: { $regex: query, $options: 'i' } },
          { underlying: { $regex: query, $options: 'i' } }
        ]
      };
      
      // Filter by instrument type if specified
      if (type) {
        if (type === 'FUT') {
          searchQuery.instrumentType = 'FUTURE';
        } else {
          // For options, filter by optionType
          searchQuery.instrumentType = 'OPTION';
          searchQuery.optionType = type;
        }
      }
      
      const results = await collection
        .find(searchQuery)
        .limit(50)
        .sort({ expiry: 1, strike: 1 })
        .toArray();
      
      logger.info('Instrument search completed', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'SEARCH_INSTRUMENTS_SUCCESS',
        query,
        type,
        resultCount: results.length
      });
      
      return results;
    } catch (error) {
      logger.error('Failed to search instruments', {
        component: 'OPTIONS_DATA_SERVICE',
        operation: 'SEARCH_INSTRUMENTS_ERROR',
        query,
        type
      }, error);
      throw error;
    }
  }
}

// Export singleton instance
export const optionsDataService = OptionsDataService.getInstance();