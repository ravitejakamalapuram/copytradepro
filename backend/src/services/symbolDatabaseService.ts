import mongoose, { Model } from 'mongoose';
import {
  StandardizedSymbol,
  CreateStandardizedSymbolData,
  SymbolHistory,
  CreateSymbolHistoryData,
  SymbolProcessingLog,
  CreateSymbolProcessingLogData,
  StandardizedSymbolDocument,
  SymbolHistoryDocument,
  SymbolProcessingLogDocument,
  createStandardizedSymbolModel,
  createSymbolHistoryModel,
  createSymbolProcessingLogModel
} from '../models/symbolModels';

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
  private SymbolHistoryModel!: Model<SymbolHistoryDocument>;
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
      this.SymbolHistoryModel = createSymbolHistoryModel(mongoose.connection);
      this.SymbolProcessingLogModel = createSymbolProcessingLogModel(mongoose.connection);

      this.isInitialized = true;
      console.log('✅ Symbol Database Service initialized successfully');
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

  private historyDocToInterface(doc: SymbolHistoryDocument): SymbolHistory {
    return {
      id: (doc._id as mongoose.Types.ObjectId).toString(),
      symbolId: doc.symbolId.toString(),
      changeType: doc.changeType,
      oldData: doc.oldData,
      newData: doc.newData,
      changedAt: doc.changedAt.toISOString(),
      changedBy: doc.changedBy || undefined
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
      
      // Create history entry
      await this.createHistoryEntry((savedSymbol._id as mongoose.Types.ObjectId).toString(), 'CREATED', undefined, symbolData);
      
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
   * Bulk create or update symbols
   */
  async upsertSymbols(symbols: CreateStandardizedSymbolData[]): Promise<ProcessingResult> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      let newSymbols = 0;
      let updatedSymbols = 0;
      let validSymbols = 0;
      let invalidSymbols = 0;
      const errors: string[] = [];

      for (const symbolData of symbols) {
        try {
          // Validate symbol data
          const validation = this.validateSymbolData(symbolData);
          if (!validation.isValid) {
            invalidSymbols++;
            errors.push(`Invalid symbol ${symbolData.tradingSymbol}: ${validation.errors.join(', ')}`);
            continue;
          }

          // Try to find existing symbol
          const existingSymbol = await this.StandardizedSymbolModel.findOne({
            tradingSymbol: symbolData.tradingSymbol,
            exchange: symbolData.exchange,
            expiryDate: symbolData.expiryDate ? new Date(symbolData.expiryDate) : undefined,
            strikePrice: symbolData.strikePrice,
            optionType: symbolData.optionType
          });

          if (existingSymbol) {
            // Update existing symbol
            const oldData = this.symbolDocToInterface(existingSymbol);
            Object.assign(existingSymbol, {
              ...symbolData,
              expiryDate: symbolData.expiryDate ? new Date(symbolData.expiryDate) : undefined,
              lastUpdated: new Date()
            });
            await existingSymbol.save();
            
            // Create history entry
            await this.createHistoryEntry((existingSymbol._id as mongoose.Types.ObjectId).toString(), 'UPDATED', oldData, symbolData);
            
            updatedSymbols++;
          } else {
            // Create new symbol
            const symbolDoc = new this.StandardizedSymbolModel({
              ...symbolData,
              expiryDate: symbolData.expiryDate ? new Date(symbolData.expiryDate) : undefined
            });
            await symbolDoc.save();
            
            // Create history entry
            await this.createHistoryEntry((symbolDoc._id as mongoose.Types.ObjectId).toString(), 'CREATED', undefined, symbolData);
            
            newSymbols++;
          }
          
          validSymbols++;
        } catch (error: any) {
          invalidSymbols++;
          errors.push(`Error processing symbol ${symbolData.tradingSymbol}: ${error.message}`);
        }
      }

      return {
        totalProcessed: symbols.length,
        validSymbols,
        invalidSymbols,
        newSymbols,
        updatedSymbols,
        errors
      };
    } catch (error) {
      console.error('🚨 Failed to upsert symbols:', error);
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

      const symbol = await this.StandardizedSymbolModel.findById(id);
      return symbol ? this.symbolDocToInterface(symbol) : null;
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

      // Get total count
      const total = await this.StandardizedSymbolModel.countDocuments(query);

      // Get symbols
      const symbols = await this.StandardizedSymbolModel
        .find(query)
        .sort({ displayName: 1 })
        .limit(limit)
        .skip(offset);

      return {
        symbols: symbols.map(symbol => this.symbolDocToInterface(symbol)),
        total,
        hasMore: offset + symbols.length < total
      };
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

      const query: any = { tradingSymbol, isActive: true };
      if (exchange) {
        query.exchange = exchange;
      }

      const symbol = await this.StandardizedSymbolModel.findOne(query);
      return symbol ? this.symbolDocToInterface(symbol) : null;
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

  // Symbol History Operations

  /**
   * Create history entry
   */
  private async createHistoryEntry(
    symbolId: string, 
    changeType: 'CREATED' | 'UPDATED' | 'DEACTIVATED' | 'REACTIVATED',
    oldData?: any,
    newData?: any,
    changedBy?: string
  ): Promise<void> {
    try {
      const historyDoc = new this.SymbolHistoryModel({
        symbolId: new mongoose.Types.ObjectId(symbolId),
        changeType,
        oldData,
        newData,
        changedBy
      });

      await historyDoc.save();
    } catch (error) {
      console.error('🚨 Failed to create history entry:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Get symbol history
   */
  async getSymbolHistory(symbolId: string, limit: number = 50): Promise<SymbolHistory[]> {
    try {
      if (!this.isReady()) {
        throw new Error('Symbol Database Service not initialized');
      }

      const history = await this.SymbolHistoryModel
        .find({ symbolId: new mongoose.Types.ObjectId(symbolId) })
        .sort({ changedAt: -1 })
        .limit(limit);

      return history.map(entry => this.historyDocToInterface(entry));
    } catch (error) {
      console.error('🚨 Failed to get symbol history:', error);
      return [];
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
      isInitialized: this.isInitialized
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