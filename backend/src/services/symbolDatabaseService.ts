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
  query?: string | undefined;               // Text search
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
      console.log('✅ Symbol Database Service initialized successfully');

      // Warm the cache after initialization
      setTimeout(() => {
        symbolCacheService.warmCache(this).catch(error => {
          console.error('🚨 Failed to warm cache during initialization:', error);
        });
      }, 1000); // Delay to ensure service is fully ready
    } catch (error) {
      console.error('🚨 Failed to initialize Symbol Database Service:', error);
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
      expiryDate: doc.expiryDate ? doc.expiryDate.toISOString().split('T')[0] : undefined,
      lotSize: doc.lotSize,
      tickSize: doc.tickSize,
      isActive: doc.isActive,
      lastUpdated: doc.lastUpdated.toISOString(),
      source: doc.source,
      isin: doc.isin || undefined,
      companyName: doc.companyName || undefined,
      sector: doc.sector || undefined,
      createdAt: doc.createdAt.toISOString()
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

  // Standardized Symbol Operations
  
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
      

      
      console.log('✅ Symbol created successfully:', symbolData.tradingSymbol);
      return this.symbolDocToInterface(savedSymbol);
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error('Symbol already exists with this combination of trading symbol, exchange, expiry, strike, and option type');
      }
      console.error('🚨 Failed to create symbol:', error);
      throw error;
    }
  }

  /**
   * Replace all symbols with fresh data from source
   */
  async upsertSymbols(symbols: CreateStandardizedSymbolData[]): Promise<ProcessingResult> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      logger.info('Starting symbol replacement process', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'REPLACE_ALL_SYMBOLS',
        inputCount: symbols.length
      });

      // Step 1: Validate all symbols first
      const validSymbols: CreateStandardizedSymbolData[] = [];
      const errors: string[] = [];
      let invalidSymbols = 0;

      for (const symbolData of symbols) {
        const validation = this.validateSymbolData(symbolData);
        if (validation.isValid) {
          validSymbols.push({
            ...symbolData,
            expiryDate: symbolData.expiryDate ? new Date(symbolData.expiryDate).toISOString().split('T')[0] : undefined
          });
        } else {
          invalidSymbols++;
          errors.push(`Invalid symbol ${symbolData.tradingSymbol}: ${validation.errors.join(', ')}`);
        }
      }

      if (validSymbols.length === 0) {
        throw new Error('No valid symbols to insert');
      }

      logger.info('Symbol validation completed', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'VALIDATION_COMPLETE',
        validSymbols: validSymbols.length,
        invalidSymbols
      });

      // Step 2: Use transaction for atomic replacement
      const session = await mongoose.startSession();
      let result: ProcessingResult = {
        totalProcessed: symbols.length,
        validSymbols: validSymbols.length,
        invalidSymbols,
        newSymbols: validSymbols.length,
        updatedSymbols: 0,
        errors
      };

      try {
        await session.withTransaction(async () => {
          // Clear existing symbols
          const deleteResult = await this.StandardizedSymbolModel.deleteMany({}, { session });
          logger.info('Cleared existing symbols', {
            component: 'SYMBOL_DATABASE_SERVICE',
            operation: 'CLEAR_EXISTING',
            deletedCount: deleteResult.deletedCount
          });

          // Insert new symbols in batches for better performance
          const batchSize = 1000;
          const batches = [];
          for (let i = 0; i < validSymbols.length; i += batchSize) {
            batches.push(validSymbols.slice(i, i + batchSize));
          }

          let insertedCount = 0;
          for (const batch of batches) {
            const insertResult = await this.StandardizedSymbolModel.insertMany(
              batch.map(symbol => ({
                ...symbol,
                expiryDate: symbol.expiryDate ? new Date(symbol.expiryDate) : undefined
              })),
              { session, ordered: false }
            );
            insertedCount += insertResult.length;
            
            logger.info('Inserted symbol batch', {
              component: 'SYMBOL_DATABASE_SERVICE',
              operation: 'BATCH_INSERT',
              batchSize: batch.length,
              insertedCount: insertResult.length,
              totalInserted: insertedCount
            });
          }

          result = {
            totalProcessed: symbols.length,
            validSymbols: validSymbols.length,
            invalidSymbols,
            newSymbols: validSymbols.length, // All are new since we replaced everything
            updatedSymbols: 0, // None updated since we replaced everything
            errors
          };
        });

        // Clear all symbol cache since we replaced everything
        symbolCacheService.invalidateAll();
        
        logger.info('Symbol replacement completed successfully', {
          component: 'SYMBOL_DATABASE_SERVICE',
          operation: 'REPLACE_COMPLETE',
          ...result!
        });

        return result;

      } finally {
        await session.endSession();
      }

    } catch (error) {
      logger.error('Failed to replace symbols', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'REPLACE_ERROR'
      }, error);
      throw error;
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
      console.error('🚨 Failed to get symbol by ID:', error);
      return null;
    }
  }

  /**
   * Search symbols with filters
   */
  async searchSymbolsWithFilters(searchQuery: SymbolSearchQuery): Promise<SymbolSearchResult> {
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

      const query: any = {};
      
      // Text search
      if (searchQuery.query) {
        // Check if it's a direct trading symbol search or text search
        if (searchQuery.query.length <= 20 && !searchQuery.query.includes(' ')) {
          // Likely a trading symbol search
          query.$or = [
            { tradingSymbol: { $regex: searchQuery.query, $options: 'i' } },
            { displayName: { $regex: searchQuery.query, $options: 'i' } }
          ];
        } else {
          // Full text search
          query.$text = { $search: searchQuery.query };
        }
      }

      // Filters
      if (searchQuery.instrumentType) {
        query.instrumentType = searchQuery.instrumentType;
      }

      if (searchQuery.exchange) {
        query.exchange = searchQuery.exchange;
      }

      if (searchQuery.underlying) {
        query.underlying = { $regex: searchQuery.underlying, $options: 'i' };
      }

      if (searchQuery.strikeMin !== undefined || searchQuery.strikeMax !== undefined) {
        query.strikePrice = {};
        if (searchQuery.strikeMin !== undefined) {
          query.strikePrice.$gte = searchQuery.strikeMin;
        }
        if (searchQuery.strikeMax !== undefined) {
          query.strikePrice.$lte = searchQuery.strikeMax;
        }
      }

      if (searchQuery.expiryStart || searchQuery.expiryEnd) {
        query.expiryDate = {};
        if (searchQuery.expiryStart) {
          query.expiryDate.$gte = new Date(searchQuery.expiryStart);
        }
        if (searchQuery.expiryEnd) {
          query.expiryDate.$lte = new Date(searchQuery.expiryEnd);
        }
      }

      if (searchQuery.optionType) {
        query.optionType = searchQuery.optionType;
      }

      if (searchQuery.isActive !== undefined) {
        query.isActive = searchQuery.isActive;
      }

      const limit = searchQuery.limit || 50;
      const offset = searchQuery.offset || 0;

      // Get total count with performance monitoring
      const countStart = Date.now();
      const total = await this.StandardizedSymbolModel.countDocuments(query);
      const countDuration = Date.now() - countStart;
      databaseOptimizationService.recordQuery('countDocuments', 'standardizedsymbols', countDuration, query, { count: total });
      
      // Record count monitoring metrics
      symbolMonitoringService.recordDatabaseMetrics({
        operation: 'searchSymbolsCount',
        collection: 'standardizedsymbols',
        duration: countDuration,
        queryType: 'countDocuments',
        indexUsed: this.hasIndexForQuery(query),
        documentsExamined: total,
        documentsReturned: 1,
        success: true
      });

      // Get symbols with performance monitoring
      const findStart = Date.now();
      const symbols = await this.StandardizedSymbolModel
        .find(query)
        .sort({ displayName: 1 })
        .limit(limit)
        .skip(offset);
      const findDuration = Date.now() - findStart;
      databaseOptimizationService.recordQuery('find', 'standardizedsymbols', findDuration, query, { count: symbols.length });
      
      // Record search monitoring metrics
      symbolMonitoringService.recordDatabaseMetrics({
        operation: 'searchSymbols',
        collection: 'standardizedsymbols',
        duration: findDuration,
        queryType: 'find',
        indexUsed: this.hasIndexForQuery(query),
        documentsExamined: Math.min(total, limit + offset),
        documentsReturned: symbols.length,
        success: true
      });

      const result = {
        symbols: symbols.map(symbol => this.symbolDocToInterface(symbol)),
        total,
        hasMore: offset + symbols.length < total
      };

      // Cache the search result
      symbolCacheService.cacheSearchResults(cacheKey, result);

      return result;
    } catch (error) {
      console.error('🚨 Failed to search symbols:', error);
      return { symbols: [], total: 0, hasMore: false };
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
      console.error('🚨 Failed to get symbol by trading symbol:', error);
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
      console.error('🚨 Failed to get symbols by underlying:', error);
      return [];
    }
  }

  /**
   * Deactivate symbols not in the provided list
   */
  async deactivateRemovedSymbols(activeSymbolIds: string[]): Promise<number> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const result = await this.StandardizedSymbolModel.updateMany(
        { 
          _id: { $nin: activeSymbolIds.map(id => new mongoose.Types.ObjectId(id)) },
          isActive: true 
        },
        { 
          isActive: false, 
          lastUpdated: new Date() 
        }
      );

      console.log(`✅ Deactivated ${result.modifiedCount} symbols`);
      return result.modifiedCount;
    } catch (error) {
      console.error('🚨 Failed to deactivate removed symbols:', error);
      return 0;
    }
  }



  // Processing Log Operations

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
      console.error('🚨 Failed to create processing log:', error);
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
      console.error('🚨 Failed to update processing log:', error);
      return null;
    }
  }

  /**
   * Get recent processing logs
   */
  async getRecentProcessingLogs(limit: number = 20): Promise<SymbolProcessingLog[]> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const logs = await this.SymbolProcessingLogModel
        .find({})
        .sort({ startedAt: -1 })
        .limit(limit);

      return logs.map(log => this.logDocToInterface(log));
    } catch (error) {
      console.error('🚨 Failed to get processing logs:', error);
      return [];
    }
  }

  // Additional methods for symbol lifecycle management

  /**
   * Update symbol by ID
   */
  async updateSymbol(id: string, updateData: Partial<CreateStandardizedSymbolData>): Promise<StandardizedSymbol | null> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const existingSymbol = await this.StandardizedSymbolModel.findById(id);
      if (!existingSymbol) {
        return null;
      }

      const oldData = this.symbolDocToInterface(existingSymbol);
      
      // Update the symbol
      const updatedSymbol = await this.StandardizedSymbolModel.findByIdAndUpdate(
        id,
        {
          ...updateData,
          expiryDate: updateData.expiryDate ? new Date(updateData.expiryDate) : undefined,
          lastUpdated: new Date()
        },
        { new: true }
      );

      if (!updatedSymbol) {
        return null;
      }

      // Invalidate cache
      symbolCacheService.invalidateSymbol(id, updatedSymbol.tradingSymbol, updatedSymbol.exchange);



      return this.symbolDocToInterface(updatedSymbol);
    } catch (error) {
      console.error('🚨 Failed to update symbol:', error);
      return null;
    }
  }



  /**
   * Get symbols updated before a certain date
   */
  async getSymbolsUpdatedBefore(date: string): Promise<StandardizedSymbol[]> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const symbols = await this.StandardizedSymbolModel
        .find({ 
          lastUpdated: { $lt: new Date(date) },
          isActive: true 
        })
        .sort({ lastUpdated: 1 })
        .limit(1000);

      return symbols.map(symbol => this.symbolDocToInterface(symbol));
    } catch (error) {
      console.error('🚨 Failed to get symbols updated before date:', error);
      return [];
    }
  }

  /**
   * Delete symbol by ID (for cleanup of expired symbols)
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
        
        console.log(`✅ Deleted symbol: ${result.tradingSymbol}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('🚨 Failed to delete symbol:', error);
      return false;
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
        operation: 'CLEAR_ALL_SYMBOLS_SUCCESS',
        deletedCount: deleteResult.deletedCount,
        countBefore
      });

      return deleteResult.deletedCount || 0;
    } catch (error) {
      logger.error('Failed to clear all symbols', {
        component: 'SYMBOL_DATABASE_SERVICE',
        operation: 'CLEAR_ALL_SYMBOLS_ERROR'
      }, error);
      throw error;
    }
  }

  // Validation Methods

  /**
   * Validate symbol data
   */
  private validateSymbolData(symbolData: CreateStandardizedSymbolData): ValidationResult {
    const errors: string[] = [];

    // Required fields
    if (!symbolData.displayName?.trim()) {
      errors.push('Display name is required');
    }

    if (!symbolData.tradingSymbol?.trim()) {
      errors.push('Trading symbol is required');
    }

    if (!symbolData.instrumentType) {
      errors.push('Instrument type is required');
    }

    if (!symbolData.exchange) {
      errors.push('Exchange is required');
    }

    if (!symbolData.segment?.trim()) {
      errors.push('Segment is required');
    }

    if (!symbolData.source?.trim()) {
      errors.push('Source is required');
    }

    // Numeric validations
    if (symbolData.lotSize <= 0) {
      errors.push('Lot size must be positive');
    }

    if (symbolData.tickSize <= 0) {
      errors.push('Tick size must be positive');
    }

    // Options-specific validations
    if (symbolData.instrumentType === 'OPTION') {
      if (!symbolData.underlying?.trim()) {
        errors.push('Underlying is required for options');
      }

      if (!symbolData.strikePrice || symbolData.strikePrice <= 0) {
        errors.push('Valid strike price is required for options');
      }

      if (!symbolData.optionType) {
        errors.push('Option type (CE/PE) is required for options');
      }

      if (!symbolData.expiryDate) {
        errors.push('Expiry date is required for options');
      }
    }

    // Futures-specific validations
    if (symbolData.instrumentType === 'FUTURE') {
      if (!symbolData.underlying?.trim()) {
        errors.push('Underlying is required for futures');
      }

      if (!symbolData.expiryDate) {
        errors.push('Expiry date is required for futures');
      }
    }

    // Date validation
    if (symbolData.expiryDate) {
      const expiryDate = new Date(symbolData.expiryDate);
      if (isNaN(expiryDate.getTime())) {
        errors.push('Invalid expiry date format');
      } else if (expiryDate < new Date()) {
        errors.push('Expiry date cannot be in the past');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      validSymbols: errors.length === 0 ? [symbolData as any] : [],
      invalidSymbols: errors.length > 0 ? [symbolData] : []
    };
  }

  /**
   * Validate multiple symbols
   */
  validateSymbols(symbols: CreateStandardizedSymbolData[]): ValidationResult {
    const allErrors: string[] = [];
    const validSymbols: StandardizedSymbol[] = [];
    const invalidSymbols: any[] = [];

    for (const symbol of symbols) {
      const validation = this.validateSymbolData(symbol);
      if (validation.isValid) {
        validSymbols.push(symbol as any);
      } else {
        invalidSymbols.push(symbol);
        allErrors.push(...validation.errors.map(error => `${symbol.tradingSymbol}: ${error}`));
      }
    }

    return {
      isValid: invalidSymbols.length === 0,
      errors: allErrors,
      validSymbols,
      invalidSymbols
    };
  }

  // Legacy methods for backward compatibility with existing routes
  
  /**
   * Legacy search method for backward compatibility
   */
  async searchSymbols(query: string, limit: number = 10, exchangeFilter: string = 'ALL'): Promise<any[]> {
    try {
      const searchQuery: SymbolSearchQuery = {
        query,
        limit,
        exchange: exchangeFilter !== 'ALL' ? exchangeFilter : undefined
      };
      
      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols.map(symbol => ({
        tradingSymbol: symbol.tradingSymbol,
        symbol: symbol.displayName,
        name: symbol.companyName || symbol.displayName,
        exchange: symbol.exchange,
        instrument_type: symbol.instrumentType,
        isin: symbol.isin,
        series: symbol.segment,
        group: symbol.sector
      }));
    } catch (error) {
      console.error('🚨 Legacy search symbols failed:', error);
      return [];
    }
  }

  /**
   * Get option chain for an underlying symbol
   */
  async getOptionChain(underlying: string, expiry?: string): Promise<any[]> {
    try {
      const searchQuery: SymbolSearchQuery = {
        instrumentType: 'OPTION',
        underlying,
        expiryStart: expiry || undefined,
        expiryEnd: expiry || undefined,
        limit: 1000
      };
      
      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols.map(symbol => ({
        symbol: symbol.tradingSymbol,
        name: symbol.displayName,
        strike_price: symbol.strikePrice,
        option_type: symbol.optionType,
        expiry_date: symbol.expiryDate,
        exchange: symbol.exchange,
        lot_size: symbol.lotSize,
        tick_size: symbol.tickSize
      }));
    } catch (error) {
      console.error('🚨 Get option chain failed:', error);
      return [];
    }
  }

  /**
   * Get expiry dates for an underlying symbol
   */
  async getExpiryDates(underlying: string): Promise<string[]> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const expiryDates = await this.StandardizedSymbolModel
        .distinct('expiryDate', { 
          underlying: underlying.toUpperCase(),
          isActive: true,
          expiryDate: { $exists: true, $ne: null }
        });

      return expiryDates
        .filter((date): date is Date => date != null)
        .map(date => date.toISOString().split('T')[0] as string)
        .sort();
    } catch (error) {
      console.error('🚨 Get expiry dates failed:', error);
      return [];
    }
  }

  /**
   * Search all instruments (unified search)
   */
  async searchAllInstruments(query: string, limit: number = 20): Promise<any> {
    try {
      const [equity, options, futures] = await Promise.all([
        this.searchEquityInstruments(query, Math.floor(limit / 3)),
        this.searchOptionsInstruments(query, Math.floor(limit / 3)),
        this.searchFuturesInstruments(query, Math.floor(limit / 3))
      ]);

      return {
        equity,
        options,
        futures,
        total: equity.length + options.length + futures.length
      };
    } catch (error) {
      console.error('🚨 Search all instruments failed:', error);
      return { equity: [], options: [], futures: [], total: 0 };
    }
  }

  /**
   * Search equity instruments
   */
  async searchEquityInstruments(query: string, limit: number = 10): Promise<any[]> {
    try {
      const searchQuery: SymbolSearchQuery = {
        query,
        instrumentType: 'EQUITY',
        limit
      };
      
      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols.map(symbol => ({
        tradingSymbol: symbol.tradingSymbol,
        symbol: symbol.displayName,
        name: symbol.companyName || symbol.displayName,
        exchange: symbol.exchange,
        sector: symbol.sector
      }));
    } catch (error) {
      console.error('🚨 Search equity instruments failed:', error);
      return [];
    }
  }

  /**
   * Search options instruments
   */
  async searchOptionsInstruments(query: string, limit: number = 10): Promise<any[]> {
    try {
      const searchQuery: SymbolSearchQuery = {
        query,
        instrumentType: 'OPTION',
        limit
      };
      
      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols.map(symbol => ({
        tradingSymbol: symbol.tradingSymbol,
        name: symbol.displayName,
        exchange: symbol.exchange,
        underlying: symbol.underlying,
        strikePrice: symbol.strikePrice,
        optionType: symbol.optionType,
        expiryDate: symbol.expiryDate
      }));
    } catch (error) {
      console.error('🚨 Search options instruments failed:', error);
      return [];
    }
  }

  /**
   * Check if query likely uses an index
   */
  private hasIndexForQuery(query: any): boolean {
    // Check for indexed fields
    const indexedFields = ['_id', 'tradingSymbol', 'instrumentType', 'exchange', 'underlying', 'expiryDate', 'isActive', 'displayName'];
    
    for (const field of indexedFields) {
      if (query[field] !== undefined) {
        return true;
      }
    }
    
    // Check for text search (has text index)
    if (query.$text) {
      return true;
    }
    
    // Check for compound queries
    if (query.$or && Array.isArray(query.$or)) {
      return query.$or.some((subQuery: any) => this.hasIndexForQuery(subQuery));
    }
    
    return false;
  }

  /**
   * Search futures instruments
   */
  async searchFuturesInstruments(query: string, limit: number = 10): Promise<any[]> {
    try {
      const searchQuery: SymbolSearchQuery = {
        query,
        instrumentType: 'FUTURE',
        limit
      };
      
      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols.map(symbol => ({
        tradingSymbol: symbol.tradingSymbol,
        name: symbol.displayName,
        exchange: symbol.exchange,
        underlying: symbol.underlying,
        expiryDate: symbol.expiryDate
      }));
    } catch (error) {
      console.error('🚨 Search futures instruments failed:', error);
      return [];
    }
  }

  /**
   * Get equity instruments
   */
  async getEquityInstruments(limit: number = 50): Promise<any[]> {
    try {
      const searchQuery: SymbolSearchQuery = {
        instrumentType: 'EQUITY',
        limit
      };
      
      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols.map(symbol => ({
        tradingSymbol: symbol.tradingSymbol,
        symbol: symbol.displayName,
        name: symbol.companyName || symbol.displayName,
        exchange: symbol.exchange,
        sector: symbol.sector
      }));
    } catch (error) {
      console.error('🚨 Get equity instruments failed:', error);
      return [];
    }
  }

  /**
   * Get options instruments
   */
  async getOptionsInstruments(limit: number = 50): Promise<any[]> {
    try {
      const searchQuery: SymbolSearchQuery = {
        instrumentType: 'OPTION',
        limit
      };
      
      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols.map(symbol => ({
        tradingSymbol: symbol.tradingSymbol,
        name: symbol.displayName,
        exchange: symbol.exchange,
        underlying: symbol.underlying,
        strikePrice: symbol.strikePrice,
        optionType: symbol.optionType,
        expiryDate: symbol.expiryDate
      }));
    } catch (error) {
      console.error('🚨 Get options instruments failed:', error);
      return [];
    }
  }

  /**
   * Get futures instruments
   */
  async getFuturesInstruments(limit: number = 50): Promise<any[]> {
    try {
      const searchQuery: SymbolSearchQuery = {
        instrumentType: 'FUTURE',
        limit
      };
      
      const result = await this.searchSymbolsWithFilters(searchQuery);
      return result.symbols.map(symbol => ({
        tradingSymbol: symbol.tradingSymbol,
        name: symbol.displayName,
        exchange: symbol.exchange,
        underlying: symbol.underlying,
        expiryDate: symbol.expiryDate
      }));
    } catch (error) {
      console.error('🚨 Get futures instruments failed:', error);
      return [];
    }
  }

  /**
   * Get stats for debugging
   */
  getStats(): any {
    return {
      isReady: this.isReady(),
      isInitialized: this.isInitialized,
      cache: symbolCacheService.getStats(),
      memoryUsage: symbolCacheService.getMemoryUsage()
    };
  }

  /**
   * Force update (placeholder for compatibility)
   */
  async forceUpdate(): Promise<void> {
    console.log('🔄 Force update called - this is a placeholder for now');
    // This would trigger a data refresh in a real implementation
  }

  /**
   * Check if symbol data exists and is fresh
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
        return { hasData: false, isFresh: false, totalSymbols: 0 };
      }

      // Get total symbol count
      const totalSymbols = await this.StandardizedSymbolModel.countDocuments();
      
      if (totalSymbols === 0) {
        return { hasData: false, isFresh: false, totalSymbols: 0 };
      }

      // Get the most recently updated symbol to check freshness
      const recentSymbol = await this.StandardizedSymbolModel
        .findOne({}, { lastUpdated: 1 })
        .sort({ lastUpdated: -1 })
        .lean();

      if (!recentSymbol?.lastUpdated) {
        // If no lastUpdated field, consider data as old
        return { 
          hasData: true, 
          isFresh: false, 
          totalSymbols
        };
      }

      const now = new Date();
      const lastUpdated = new Date(recentSymbol.lastUpdated);
      const ageHours = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
      
      // Consider data fresh if updated within last 24 hours
      const isFresh = ageHours < 24;

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
      return { hasData: false, isFresh: false, totalSymbols: 0 };
    }
  }

  /**
   * Get database statistics
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

      const [
        totalSymbols,
        activeSymbols,
        symbolsByType,
        symbolsByExchange
      ] = await Promise.all([
        this.StandardizedSymbolModel.countDocuments(),
        this.StandardizedSymbolModel.countDocuments({ isActive: true }),
        this.StandardizedSymbolModel.aggregate([
          { $group: { _id: '$instrumentType', count: { $sum: 1 } } }
        ]),
        this.StandardizedSymbolModel.aggregate([
          { $group: { _id: '$exchange', count: { $sum: 1 } } }
        ])
      ]);

      const typeStats: Record<string, number> = {};
      symbolsByType.forEach((item: any) => {
        typeStats[item._id] = item.count;
      });

      const exchangeStats: Record<string, number> = {};
      symbolsByExchange.forEach((item: any) => {
        exchangeStats[item._id] = item.count;
      });

      return {
        totalSymbols,
        activeSymbols,
        symbolsByType: typeStats,
        symbolsByExchange: exchangeStats
      };
    } catch (error) {
      console.error('🚨 Failed to get statistics:', error);
      return {
        totalSymbols: 0,
        activeSymbols: 0,
        symbolsByType: {},
        symbolsByExchange: {}
      };
    }
  }
}

// Create and export a singleton instance for backward compatibility
export const symbolDatabaseService = new SymbolDatabaseService();