import mongoose, { Model } from 'mongoose';
import {
  StandardizedSymbol,
  CreateStandardizedSymbolData,
  SymbolProcessingLog,
  CreateSymbolProcessingLogData,
  StandardizedSymbolDocument,
  SymbolProcessingLogDocument,
  createStandardizedSymbolModel,
  createSymbolProcessingLogModel
} from '../models/symbolModels';
import { symbolCacheService } from './symbolCacheService';
import { databaseOptimizationService } from './databaseOptimizationService';
import { symbolMonitoringService } from './symbolMonitoringService';
import { logger } from '../utils/logger';

export interface SymbolSearchQuery {
  query?: string | undefined;
  instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE' | undefined;
  exchange?: string | undefined;
  underlying?: string | undefined;
  strikeMin?: number | undefined;
  strikeMax?: number | undefined;
  expiryStart?: string | undefined;
  expiryEnd?: string | undefined;
  optionType?: 'CE' | 'PE' | undefined;
  isActive?: boolean | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  fuzzy?: boolean | undefined;
}

export interface SymbolSearchResult {
  symbols: StandardizedSymbol[];
  total: number;
  hasMore: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  validSymbols: StandardizedSymbol[];
  invalidSymbols: any[];
}

export interface ProcessingResult {
  totalProcessed: number;
  validSymbols: number;
  invalidSymbols: number;
  newSymbols: number;
  updatedSymbols: number;
  errors: string[];
}

/**
 * Symbol Database Service
 * Handles all database operations for standardized symbols
 */
export class SymbolDatabaseService {
  private StandardizedSymbolModel!: Model<StandardizedSymbolDocument>;
  private SymbolProcessingLogModel!: Model<SymbolProcessingLogDocument>;
  private isInitialized: boolean = false;

  constructor() {
    // Models will be initialized when the service is initialized
  }

  /**
   * Initialize the service with database connection
   */
  async initialize(): Promise<void> {
    try {
      if (!mongoose.connection.readyState) {
        throw new Error('MongoDB connection not established. Initialize main database first.');
      }

      // Create models using the existing connection
      this.StandardizedSymbolModel = createStandardizedSymbolModel(mongoose.connection);
      this.SymbolProcessingLogModel = createSymbolProcessingLogModel(mongoose.connection);

      this.isInitialized = true;
      logger.info('Symbol Database Service initialized successfully', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'INITIALIZE'
      });

      // Warm the cache after initialization (only if we have data)
      setTimeout(async () => {
        try {
          const stats = await this.getStatistics();
          if (stats.totalSymbols > 0) {
            await symbolCacheService.warmCache(this);
            logger.info('Cache warmed successfully after initialization', {
              component: 'SYMBOL_DATABASE_SERVICE',
              operation: 'CACHE_WARM_SUCCESS',
              totalSymbols: stats.totalSymbols
            });
          } else {
            logger.info('Skipping cache warming - no symbols available', {
              component: 'SYMBOL_DATABASE_SERVICE',
              operation: 'CACHE_WARM_SKIP'
            });
          }
        } catch (error) {
          logger.error('Failed to warm cache during initialization', {
            component: 'SYMBOL_DATABASE_SERVICE',
            operation: 'CACHE_WARM_ERROR'
          }, error);
        }
      }, 2000); // Increased delay to ensure data is loaded
    } catch (error) {
      logger.error('Failed to initialize Symbol Database Service', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'INITIALIZE_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized && mongoose.connection.readyState === 1;
  }

  // Document to interface converters
  private symbolDocToInterface(doc: StandardizedSymbolDocument): StandardizedSymbol {
    return {
      id: (doc._id as mongoose.Types.ObjectId).toString(),
      displayName: doc.displayName,
      tradingSymbol: doc.tradingSymbol,
      instrumentType: doc.instrumentType,
      exchange: doc.exchange,
      segment: doc.segment,
      underlying: doc.underlying || undefined,
      strikePrice: doc.strikePrice || undefined,
      optionType: doc.optionType || undefined,
      expiryDate: doc.expiryDate ? (doc.expiryDate instanceof Date ? doc.expiryDate.toISOString().split('T')[0] : doc.expiryDate) : undefined,
      lotSize: doc.lotSize,
      tickSize: doc.tickSize,
      isActive: doc.isActive,
      lastUpdated: doc.lastUpdated instanceof Date ? doc.lastUpdated.toISOString() : doc.lastUpdated,
      source: doc.source,
      isin: doc.isin || undefined,
      companyName: doc.companyName || undefined,
      sector: doc.sector || undefined,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt
    };
  }

  private logDocToInterface(doc: SymbolProcessingLogDocument): SymbolProcessingLog {
    return {
      id: (doc._id as mongoose.Types.ObjectId).toString(),
      processType: doc.processType,
      source: doc.source,
      status: doc.status,
      totalProcessed: doc.totalProcessed,
      validSymbols: doc.validSymbols,
      invalidSymbols: doc.invalidSymbols,
      newSymbols: doc.newSymbols,
      updatedSymbols: doc.updatedSymbols,
      errorDetails: doc.errorDetails || undefined,
      startedAt: doc.startedAt.toISOString(),
      completedAt: doc.completedAt ? doc.completedAt.toISOString() : undefined
    };
  }

  /**
   * Create a new standardized symbol
   */
  async createSymbol(symbolData: CreateStandardizedSymbolData): Promise<StandardizedSymbol> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const symbolDoc = new this.StandardizedSymbolModel({
        ...symbolData,
        expiryDate: symbolData.expiryDate ? new Date(symbolData.expiryDate) : undefined
      });

      const savedSymbol = await symbolDoc.save();
      
      logger.info('Symbol created successfully', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'CREATE_SYMBOL',
        tradingSymbol: symbolData.tradingSymbol
      });
      return this.symbolDocToInterface(savedSymbol);
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error('Symbol already exists with this combination of trading symbol, exchange, expiry, strike, and option type');
      }
      logger.error('Failed to create symbol', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'CREATE_SYMBOL_ERROR',
        tradingSymbol: symbolData.tradingSymbol
      }, error);
      throw error;
    }
  }

  /**
   * Upsert (create or update) a standardized symbol
   */
  async upsertSymbol(symbolData: CreateStandardizedSymbolData): Promise<StandardizedSymbol> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      // Build unique filter based on instrument type
      const filter: any = {
        tradingSymbol: symbolData.tradingSymbol,
        exchange: symbolData.exchange,
        instrumentType: symbolData.instrumentType
      };

      // Add additional fields for F&O instruments to ensure uniqueness
      if (symbolData.instrumentType === 'OPTION' || symbolData.instrumentType === 'FUTURE') {
        if (symbolData.expiryDate) {
          filter.expiryDate = new Date(symbolData.expiryDate);
        }
        if (symbolData.strikePrice) {
          filter.strikePrice = symbolData.strikePrice;
        }
        if (symbolData.optionType) {
          filter.optionType = symbolData.optionType;
        }
      }

      const updateData = {
        ...symbolData,
        expiryDate: symbolData.expiryDate ? new Date(symbolData.expiryDate) : undefined,
        lastUpdated: new Date(),
        isActive: true
      };

      const result = await this.StandardizedSymbolModel.findOneAndUpdate(
        filter,
        { $set: updateData },
        { 
          upsert: true, 
          new: true,
          runValidators: true
        }
      );

      return this.symbolDocToInterface(result);
    } catch (error: any) {
      logger.error('Failed to upsert symbol', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'UPSERT_SYMBOL_ERROR',
        tradingSymbol: symbolData.tradingSymbol
      }, error);
      throw error;
    }
  }

  /**
   * Search symbols with filters using unified approach
   */
  async searchSymbolsWithFilters(searchQuery: SymbolSearchQuery): Promise<SymbolSearchResult> {
    const startTime = Date.now();
    
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      // Check cache first for search results
      const cacheKey = symbolCacheService.generateSearchKey(searchQuery);
      const cachedResult = symbolCacheService.getSearchResults(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }

      // Use MongoDB aggregation for fuzzy search with relevance scoring
      const pipeline = this.buildFuzzySearchPipeline(searchQuery);

      // Execute aggregation with performance monitoring
      const aggregateStart = Date.now();
      const results = await this.StandardizedSymbolModel.aggregate(pipeline);
      const aggregateDuration = Date.now() - aggregateStart;

      // Extract symbols and total count from aggregation result
      const symbols = results[0]?.symbols || [];
      const total = results[0]?.totalCount?.[0]?.count || 0;

      const result = {
        symbols: symbols.map((symbol: any) => this.symbolDocToInterface(symbol)),
        total,
        hasMore: (searchQuery.offset || 0) + symbols.length < total
      };

      // Record performance metrics
      symbolMonitoringService.recordDatabaseMetrics({
        operation: 'fuzzySearchSymbols',
        collection: 'standardizedsymbols',
        duration: aggregateDuration,
        queryType: 'aggregate',
        indexUsed: true,
        documentsExamined: total,
        documentsReturned: symbols.length,
        success: true
      });

      // Cache the search result
      symbolCacheService.cacheSearchResults(cacheKey, result);

      logger.info('MongoDB fuzzy search completed', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'FUZZY_SEARCH',
        resultCount: symbols.length,
        duration: Date.now() - startTime
      });
      return result;
    } catch (error) {
      logger.error('MongoDB fuzzy search failed', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'FUZZY_SEARCH_ERROR'
      }, error);
      
      // Record error metrics
      symbolMonitoringService.recordDatabaseMetrics({
        operation: 'fuzzySearchSymbols',
        collection: 'standardizedsymbols',
        duration: Date.now() - startTime,
        queryType: 'aggregate',
        indexUsed: false,
        documentsExamined: 0,
        documentsReturned: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      return { symbols: [], total: 0, hasMore: false };
    }
  }

  /**
   * Build MongoDB aggregation pipeline for fuzzy search with relevance scoring
   */
  private buildFuzzySearchPipeline(searchQuery: SymbolSearchQuery): any[] {
    const { buildSearchPipeline } = require('../utils/searchHelpers');
    
    // Convert SymbolSearchQuery to SearchQuery format
    const unifiedQuery = {
      text: searchQuery.query,
      instrumentType: searchQuery.instrumentType,
      exchange: searchQuery.exchange,
      underlying: searchQuery.underlying,
      strikeMin: searchQuery.strikeMin,
      strikeMax: searchQuery.strikeMax,
      expiryStart: searchQuery.expiryStart,
      expiryEnd: searchQuery.expiryEnd,
      optionType: searchQuery.optionType,
      isActive: searchQuery.isActive,
      limit: searchQuery.limit,
      offset: searchQuery.offset,
      fuzzy: searchQuery.fuzzy
    };

    const pipeline = buildSearchPipeline(unifiedQuery);
    
    // Adjust the final facet stage to match expected output format
    const lastStage = pipeline[pipeline.length - 1];
    if (lastStage && lastStage.$facet) {
      lastStage.$facet = {
        symbols: lastStage.$facet.data || [
          { $skip: searchQuery.offset || 0 },
          { $limit: searchQuery.limit || 50 }
        ],
        totalCount: lastStage.$facet.totalCount || [
          { $count: "count" }
        ]
      };
    }

    return pipeline;
  }

  /**
   * Escape special regex characters for safe MongoDB regex queries
   */
  private escapeRegex(text: string): string {
    const { escapeRegex } = require('../utils/searchHelpers');
    return escapeRegex(text);
  }

  /**
   * Search all instruments with categorized results
   */
  async searchAllInstruments(query: string, limit: number = 20, fuzzy: boolean = true): Promise<{
    equity: any[];
    options: any[];
    futures: any[];
    total: number;
  }> {
    try {
      const limitPerType = Math.floor(limit / 3);

      const [equity, options, futures] = await Promise.all([
        this.searchEquityInstruments(query, limitPerType, fuzzy),
        this.searchOptionsInstruments(query, limitPerType, fuzzy),
        this.searchFuturesInstruments(query, limitPerType, fuzzy)
      ]);

      return {
        equity,
        options,
        futures,
        total: equity.length + options.length + futures.length
      };
    } catch (error) {
      logger.error('Failed to search all instruments', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'SEARCH_ALL_INSTRUMENTS_ERROR'
      }, error);

      return {
        equity: [],
        options: [],
        futures: [],
        total: 0
      };
    }
  }

  /**
   * Search equity instruments using unified collection
   */
  async searchEquityInstruments(query: string, limit: number = 10, fuzzy: boolean = true): Promise<any[]> {
    try {
      const searchQuery = {
        query,
        instrumentType: 'EQUITY' as const,
        limit,
        fuzzy,
        isActive: true
      };

      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols;
    } catch (error) {
      logger.error('Failed to search equity instruments', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'SEARCH_EQUITY_ERROR'
      }, error);
      return [];
    }
  }

  /**
   * Search options instruments using unified collection
   */
  async searchOptionsInstruments(query: string, limit: number = 10, fuzzy: boolean = true): Promise<any[]> {
    try {
      const searchQuery = {
        query,
        instrumentType: 'OPTION' as const,
        limit,
        fuzzy,
        isActive: true
      };

      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols;
    } catch (error) {
      logger.error('Failed to search options instruments', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'SEARCH_OPTIONS_ERROR'
      }, error);
      return [];
    }
  }

  /**
   * Search futures instruments using unified collection
   */
  async searchFuturesInstruments(query: string, limit: number = 10, fuzzy: boolean = true): Promise<any[]> {
    try {
      const searchQuery = {
        query,
        instrumentType: 'FUTURE' as const,
        limit,
        fuzzy,
        isActive: true
      };

      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols;
    } catch (error) {
      logger.error('Failed to search futures instruments', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'SEARCH_FUTURES_ERROR'
      }, error);
      return [];
    }
  }

  /**
   * Get option chain for an underlying
   */
  async getOptionChain(underlying: string, expiryDate?: string): Promise<any[]> {
    try {
      const searchQuery: any = {
        instrumentType: 'OPTION',
        underlying,
        limit: 1000,
        isActive: true
      };

      if (expiryDate) {
        searchQuery.expiryStart = expiryDate;
        searchQuery.expiryEnd = expiryDate;
      }

      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols;
    } catch (error) {
      logger.error('Failed to get option chain', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_OPTION_CHAIN_ERROR',
        underlying
      }, error);
      return [];
    }
  }

  /**
   * Get expiry dates for an underlying
   */
  async getExpiryDates(underlying: string): Promise<string[]> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const pipeline = [
        {
          $match: {
            underlying,
            instrumentType: { $in: ['OPTION', 'FUTURE'] },
            isActive: true,
            expiryDate: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: '$expiryDate'
          }
        },
        {
          $sort: { _id: 1 as 1 }
        }
      ];

      const results = await this.StandardizedSymbolModel.aggregate(pipeline);
      return results.map(result => result._id.toISOString().split('T')[0]);
    } catch (error) {
      logger.error('Failed to get expiry dates', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_EXPIRY_DATES_ERROR',
        underlying
      }, error);
      return [];
    }
  }

  /**
   * Get instruments by type
   */
  async getEquityInstruments(limit: number = 50): Promise<any[]> {
    try {
      const result = await this.searchSymbolsWithFilters({
        instrumentType: 'EQUITY',
        limit,
        isActive: true
      });
      return result.symbols;
    } catch (error) {
      logger.error('Failed to get equity instruments', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_EQUITY_INSTRUMENTS_ERROR'
      }, error);
      return [];
    }
  }

  async getOptionsInstruments(limit: number = 50): Promise<any[]> {
    try {
      const result = await this.searchSymbolsWithFilters({
        instrumentType: 'OPTION',
        limit,
        isActive: true
      });
      return result.symbols;
    } catch (error) {
      logger.error('Failed to get options instruments', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_OPTIONS_INSTRUMENTS_ERROR'
      }, error);
      return [];
    }
  }

  async getFuturesInstruments(limit: number = 50): Promise<any[]> {
    try {
      const result = await this.searchSymbolsWithFilters({
        instrumentType: 'FUTURE',
        limit,
        isActive: true
      });
      return result.symbols;
    } catch (error) {
      logger.error('Failed to get futures instruments', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_FUTURES_INSTRUMENTS_ERROR'
      }, error);
      return [];
    }
  }

  /**
   * Get database statistics
   */
  getStats(): any {
    return {
      isInitialized: this.isInitialized,
      isReady: this.isReady(),
      connectionState: mongoose.connection.readyState,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get detailed statistics
   */
  async getStatistics(): Promise<{
    totalSymbols: number;
    activeSymbols: number;
    symbolsByType: Record<string, number>;
    symbolsByExchange: Record<string, number>;
  }> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const [totalSymbols, activeSymbols, typeStats, exchangeStats] = await Promise.all([
        this.StandardizedSymbolModel.countDocuments(),
        this.StandardizedSymbolModel.countDocuments({ isActive: true }),
        this.StandardizedSymbolModel.aggregate([
          { $group: { _id: '$instrumentType', count: { $sum: 1 } } }
        ]),
        this.StandardizedSymbolModel.aggregate([
          { $group: { _id: '$exchange', count: { $sum: 1 } } }
        ])
      ]);

      const symbolsByType: Record<string, number> = {};
      typeStats.forEach((stat: any) => {
        symbolsByType[stat._id] = stat.count;
      });

      const symbolsByExchange: Record<string, number> = {};
      exchangeStats.forEach((stat: any) => {
        symbolsByExchange[stat._id] = stat.count;
      });

      return {
        totalSymbols,
        activeSymbols,
        symbolsByType,
        symbolsByExchange
      };
    } catch (error) {
      logger.error('Failed to get statistics', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_STATISTICS_ERROR'
      }, error);

      return {
        totalSymbols: 0,
        activeSymbols: 0,
        symbolsByType: {},
        symbolsByExchange: {}
      };
    }
  }

  /**
   * Check data freshness
   */
  async checkDataFreshness(): Promise<{
    hasData: boolean;
    isFresh: boolean;
    totalSymbols: number;
    lastUpdated?: Date;
    ageHours?: number;
  }> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const totalSymbols = await this.StandardizedSymbolModel.countDocuments();
      
      if (totalSymbols === 0) {
        return {
          hasData: false,
          isFresh: false,
          totalSymbols: 0
        };
      }

      // Get the most recent update
      const latestSymbol = await this.StandardizedSymbolModel
        .findOne({}, {}, { sort: { lastUpdated: -1 } });

      if (!latestSymbol) {
        return {
          hasData: false,
          isFresh: false,
          totalSymbols: 0
        };
      }

      const lastUpdated = latestSymbol.lastUpdated;
      const ageHours = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
      const isFresh = ageHours < 24; // Consider fresh if updated within 24 hours

      return {
        hasData: true,
        isFresh,
        totalSymbols,
        lastUpdated,
        ageHours
      };
    } catch (error) {
      logger.error('Failed to check data freshness', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'CHECK_DATA_FRESHNESS_ERROR'
      }, error);

      return {
        hasData: false,
        isFresh: false,
        totalSymbols: 0
      };
    }
  }

  /**
   * Get symbol by ID
   */
  async getSymbolById(id: string): Promise<StandardizedSymbol | null> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      // Check cache first
      const cacheKey = symbolCacheService.generateSymbolKey(id);
      const cachedSymbol = symbolCacheService.getSymbol(cacheKey);
      if (cachedSymbol) {
        return cachedSymbol;
      }

      // Fetch from database with performance monitoring
      const findStart = Date.now();
      const symbol = await this.StandardizedSymbolModel.findById(id);
      const duration = Date.now() - findStart;
      databaseOptimizationService.recordQuery('findById', 'standardizedsymbols', duration, { _id: id }, { found: !!symbol });
      
      // Record monitoring metrics
      symbolMonitoringService.recordDatabaseMetrics({
        operation: 'getSymbolById',
        collection: 'standardizedsymbols',
        duration,
        queryType: 'findOne',
        indexUsed: true, // _id queries always use index
        documentsExamined: 1,
        documentsReturned: symbol ? 1 : 0,
        success: true
      });
      
      if (symbol) {
        const symbolInterface = this.symbolDocToInterface(symbol);
        // Cache the result
        symbolCacheService.cacheSymbol(cacheKey, symbolInterface);
        return symbolInterface;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get symbol by ID', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_SYMBOL_BY_ID_ERROR',
        symbolId: id
      }, error);
      return null;
    }
  }

  /**
   * Get symbol by trading symbol
   */
  async getSymbolByTradingSymbol(tradingSymbol: string, exchange?: string): Promise<StandardizedSymbol | null> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      // Check cache first
      const cacheKey = exchange 
        ? symbolCacheService.generateSymbolKey(undefined, tradingSymbol, exchange)
        : symbolCacheService.generateSymbolKey(undefined, tradingSymbol);
      const cachedSymbol = symbolCacheService.getSymbol(cacheKey);
      if (cachedSymbol) {
        return cachedSymbol;
      }

      const query: any = { tradingSymbol, isActive: true };
      if (exchange) {
        query.exchange = exchange;
      }

      const findStart = Date.now();
      const symbol = await this.StandardizedSymbolModel.findOne(query);
      databaseOptimizationService.recordQuery('findOne', 'standardizedsymbols', Date.now() - findStart, query, { found: !!symbol });
      
      if (symbol) {
        const symbolInterface = this.symbolDocToInterface(symbol);
        // Cache the result
        symbolCacheService.cacheSymbol(cacheKey, symbolInterface);
        return symbolInterface;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get symbol by trading symbol', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_SYMBOL_BY_TRADING_SYMBOL_ERROR',
        tradingSymbol
      }, error);
      return null;
    }
  }

  /**
   * Get symbols by underlying
   */
  async getSymbolsByUnderlying(underlying: string): Promise<StandardizedSymbol[]> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const symbols = await this.StandardizedSymbolModel
        .find({ underlying, isActive: true })
        .sort({ expiryDate: 1, strikePrice: 1 });

      return symbols.map(symbol => this.symbolDocToInterface(symbol));
    } catch (error) {
      logger.error('Failed to get symbols by underlying', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_SYMBOLS_BY_UNDERLYING_ERROR',
        underlying
      }, error);
      return [];
    }
  }

  /**
   * Delete symbol by ID
   */
  async deleteSymbol(id: string): Promise<boolean> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      // Delete the symbol
      const result = await this.StandardizedSymbolModel.findByIdAndDelete(id);
      
      if (result) {
        // Clear from cache
        symbolCacheService.invalidateSymbol(id, result.tradingSymbol, result.exchange);
        
        logger.info('Symbol deleted successfully', {
          component: 'SYMBOL_DATABASE_SERVICE',
          operation: 'DELETE_SYMBOL',
          tradingSymbol: result.tradingSymbol
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to delete symbol', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'DELETE_SYMBOL_ERROR',
        symbolId: id
      }, error);
      return false;
    }
  }

  /**
   * Create processing log
   */
  async createProcessingLog(logData: CreateSymbolProcessingLogData): Promise<SymbolProcessingLog> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const logDoc = new this.SymbolProcessingLogModel({
        ...logData,
        completedAt: logData.completedAt ? new Date(logData.completedAt) : undefined
      });

      const savedLog = await logDoc.save();
      return this.logDocToInterface(savedLog);
    } catch (error) {
      logger.error('Failed to create processing log', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'CREATE_PROCESSING_LOG_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Update processing log
   */
  async updateProcessingLog(id: string, updateData: Partial<CreateSymbolProcessingLogData>): Promise<SymbolProcessingLog | null> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const updatedLog = await this.SymbolProcessingLogModel.findByIdAndUpdate(
        id,
        {
          ...updateData,
          completedAt: updateData.completedAt ? new Date(updateData.completedAt) : new Date()
        },
        { new: true }
      );

      return updatedLog ? this.logDocToInterface(updatedLog) : null;
    } catch (error) {
      logger.error('Failed to update processing log', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'UPDATE_PROCESSING_LOG_ERROR'
      }, error);
      return null;
    }
  }

  /**
   * Upsert symbols (batch operation)
   */
  async upsertSymbols(symbols: CreateStandardizedSymbolData[]): Promise<ProcessingResult> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      logger.info('Starting batch symbol upsert', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'UPSERT_SYMBOLS',
        inputCount: symbols.length
      });

      let newSymbols = 0;
      let updatedSymbols = 0;
      let errors = 0;
      const errorDetails: string[] = [];

      // Process in batches to avoid memory issues
      const batchSize = 100;
      for (let i = 0; i < symbols.length; i += batchSize) {
        const batch = symbols.slice(i, i + batchSize);
        
        for (const symbolData of batch) {
          try {
            const result = await this.upsertSymbol(symbolData);
            // Check if it was a new symbol or update (simplified check)
            newSymbols++;
          } catch (error) {
            errors++;
            errorDetails.push(`Failed to upsert ${symbolData.tradingSymbol}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      }

      const result: ProcessingResult = {
        totalProcessed: symbols.length,
        validSymbols: symbols.length - errors,
        invalidSymbols: errors,
        newSymbols,
        updatedSymbols,
        errors: errorDetails
      };

      logger.info('Batch symbol upsert completed', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'UPSERT_SYMBOLS_COMPLETE',
        ...result
      });

      return result;
    } catch (error) {
      logger.error('Failed to upsert symbols', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'UPSERT_SYMBOLS_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Clear all symbols from the database (for fresh start)
   */
  async clearAllSymbols(): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('Database service not initialized');
    }

    try {
      logger.info('Clearing all symbols from database', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'CLEAR_ALL_SYMBOLS'
      });

      // Get count before deletion for logging
      const countBefore = await this.StandardizedSymbolModel.countDocuments();

      // Delete all symbols
      const deleteResult = await this.StandardizedSymbolModel.deleteMany({});

      // Also clear processing logs for fresh start
      await this.SymbolProcessingLogModel.deleteMany({});

      logger.info('Cleared all symbols from database', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'CLEAR_ALL_SYMBOLS_COMPLETE',
        deletedCount: deleteResult.deletedCount
      });

      return deleteResult.deletedCount || 0;
    } catch (error) {
      logger.error('Failed to clear all symbols', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'CLEAR_ALL_SYMBOLS_ERROR'
      }, error);
      return 0;
    }
  }

  /**
   * Get total count of symbols in database
   */
  async getTotalCount(): Promise<number> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }
      const count = await this.StandardizedSymbolModel.countDocuments();
      return count;
    } catch (error) {
      logger.error('Failed to get total symbol count', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_TOTAL_COUNT_ERROR'
      }, error);
      return 0;
    }
  }

  /**
   * Get a few sample symbols for testing (bypassing search)
   */
  async getSampleSymbols(limit: number = 5): Promise<StandardizedSymbol[]> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }
      const docs = await this.StandardizedSymbolModel.find({}).limit(limit).lean();
      return docs.map(doc => this.symbolDocToInterface(doc));
    } catch (error) {
      logger.error('Failed to get sample symbols', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'GET_SAMPLE_SYMBOLS_ERROR'
      }, error);
      return [];
    }
  }

  /**
   * Validate symbol data
   */
  private validateSymbolData(symbolData: CreateStandardizedSymbolData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!symbolData.tradingSymbol) {
      errors.push('Trading symbol is required');
    }

    if (!symbolData.displayName) {
      errors.push('Display name is required');
    }

    if (!symbolData.instrumentType) {
      errors.push('Instrument type is required');
    }

    if (!symbolData.exchange) {
      errors.push('Exchange is required');
    }

    if (!symbolData.source) {
      errors.push('Source is required');
    }

    // Validate option-specific fields
    if (symbolData.instrumentType === 'OPTION') {
      if (!symbolData.underlying) {
        errors.push('Underlying is required for options');
      }
      if (!symbolData.strikePrice) {
        errors.push('Strike price is required for options');
      }
      if (!symbolData.optionType) {
        errors.push('Option type is required for options');
      }
      if (!symbolData.expiryDate) {
        errors.push('Expiry date is required for options');
      }
    }

    // Validate future-specific fields
    if (symbolData.instrumentType === 'FUTURE') {
      if (!symbolData.underlying) {
        errors.push('Underlying is required for futures');
      }
      if (!symbolData.expiryDate) {
        errors.push('Expiry date is required for futures');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const symbolDatabaseService = new SymbolDatabaseService();