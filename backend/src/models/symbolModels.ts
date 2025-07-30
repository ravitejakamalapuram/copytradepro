import mongoose, { Schema, Document, Model } from 'mongoose';

// TypeScript interfaces for standardized symbols
export interface StandardizedSymbol {
  id: string;
  displayName: string;          // "NIFTY 22000 CE 30 JAN 25"
  tradingSymbol: string;        // "NIFTY25JAN22000CE"
  instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
  exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX';
  segment: string;              // "EQ", "FO", "CD", etc.
  underlying?: string | undefined;          // For options/futures
  strikePrice?: number | undefined;         // For options
  optionType?: 'CE' | 'PE' | undefined;     // For options
  expiryDate?: string | undefined;          // ISO format: "2025-01-30"
  lotSize: number;
  tickSize: number;
  isActive: boolean;
  lastUpdated: string;          // ISO timestamp
  source: string;               // "upstox", "manual", etc.
  isin?: string | undefined;
  companyName?: string | undefined;         // For equity
  sector?: string | undefined;              // For equity
  createdAt: string;
}

export interface CreateStandardizedSymbolData {
  displayName: string;
  tradingSymbol: string;
  instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
  exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX';
  segment: string;
  underlying?: string | undefined;
  strikePrice?: number | undefined;
  optionType?: 'CE' | 'PE' | undefined;
  expiryDate?: string | undefined;
  lotSize: number;
  tickSize: number;
  source: string;
  isin?: string | undefined;
  companyName?: string | undefined;
  sector?: string | undefined;
}

export interface SymbolHistory {
  id: string;
  symbolId: string;
  changeType: 'CREATED' | 'UPDATED' | 'DEACTIVATED' | 'REACTIVATED';
  oldData?: any;
  newData?: any;
  changedAt: string;
  changedBy?: string | undefined;
}

export interface CreateSymbolHistoryData {
  symbolId: string;
  changeType: 'CREATED' | 'UPDATED' | 'DEACTIVATED' | 'REACTIVATED';
  oldData?: any;
  newData?: any;
  changedBy?: string;
}

export interface SymbolProcessingLog {
  id: string;
  processType: 'DAILY_UPDATE' | 'MANUAL_UPDATE' | 'VALIDATION';
  source: string;
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  totalProcessed: number;
  validSymbols: number;
  invalidSymbols: number;
  newSymbols: number;
  updatedSymbols: number;
  errorDetails?: any | undefined;
  startedAt: string;
  completedAt?: string | undefined;
}

export interface CreateSymbolProcessingLogData {
  processType: 'DAILY_UPDATE' | 'MANUAL_UPDATE' | 'VALIDATION';
  source: string;
  status?: 'STARTED' | 'COMPLETED' | 'FAILED';
  totalProcessed?: number;
  validSymbols?: number;
  invalidSymbols?: number;
  newSymbols?: number;
  updatedSymbols?: number;
  errorDetails?: any;
  completedAt?: string;
}

// MongoDB Document Interfaces
export interface StandardizedSymbolDocument extends Document {
  displayName: string;
  tradingSymbol: string;
  instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
  exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX';
  segment: string;
  underlying?: string;
  strikePrice?: number;
  optionType?: 'CE' | 'PE';
  expiryDate?: Date;
  lotSize: number;
  tickSize: number;
  isActive: boolean;
  lastUpdated: Date;
  source: string;
  isin?: string;
  companyName?: string;
  sector?: string;
  createdAt: Date;
}

export interface SymbolHistoryDocument extends Document {
  symbolId: mongoose.Types.ObjectId;
  changeType: 'CREATED' | 'UPDATED' | 'DEACTIVATED' | 'REACTIVATED';
  oldData?: any;
  newData?: any;
  changedAt: Date;
  changedBy?: string;
}

export interface SymbolProcessingLogDocument extends Document {
  processType: 'DAILY_UPDATE' | 'MANUAL_UPDATE' | 'VALIDATION';
  source: string;
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  totalProcessed: number;
  validSymbols: number;
  invalidSymbols: number;
  newSymbols: number;
  updatedSymbols: number;
  errorDetails?: any;
  startedAt: Date;
  completedAt?: Date;
}

// MongoDB Schemas
export const StandardizedSymbolSchema = new Schema<StandardizedSymbolDocument>({
  displayName: { type: String, required: true, index: true },
  tradingSymbol: { type: String, required: true, index: true },
  instrumentType: { 
    type: String, 
    enum: ['EQUITY', 'OPTION', 'FUTURE'], 
    required: true, 
    index: true 
  },
  exchange: { 
    type: String, 
    enum: ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'], 
    required: true, 
    index: true 
  },
  segment: { type: String, required: true },
  underlying: { type: String, index: true },
  strikePrice: { type: Number, index: true },
  optionType: { type: String, enum: ['CE', 'PE'] },
  expiryDate: { type: Date, index: true },
  lotSize: { type: Number, required: true, default: 1 },
  tickSize: { type: Number, required: true, default: 0.05 },
  isActive: { type: Boolean, required: true, default: true, index: true },
  lastUpdated: { type: Date, default: Date.now },
  source: { type: String, required: true },
  isin: { type: String },
  companyName: { type: String },
  sector: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export const SymbolHistorySchema = new Schema<SymbolHistoryDocument>({
  symbolId: { type: Schema.Types.ObjectId, ref: 'StandardizedSymbol', required: true, index: true },
  changeType: { 
    type: String, 
    enum: ['CREATED', 'UPDATED', 'DEACTIVATED', 'REACTIVATED'], 
    required: true 
  },
  oldData: { type: Schema.Types.Mixed },
  newData: { type: Schema.Types.Mixed },
  changedAt: { type: Date, default: Date.now, index: true },
  changedBy: { type: String }
});

export const SymbolProcessingLogSchema = new Schema<SymbolProcessingLogDocument>({
  processType: { 
    type: String, 
    enum: ['DAILY_UPDATE', 'MANUAL_UPDATE', 'VALIDATION'], 
    required: true, 
    index: true 
  },
  source: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['STARTED', 'COMPLETED', 'FAILED'], 
    required: true, 
    index: true 
  },
  totalProcessed: { type: Number, default: 0 },
  validSymbols: { type: Number, default: 0 },
  invalidSymbols: { type: Number, default: 0 },
  newSymbols: { type: Number, default: 0 },
  updatedSymbols: { type: Number, default: 0 },
  errorDetails: { type: Schema.Types.Mixed },
  startedAt: { type: Date, default: Date.now, index: true },
  completedAt: { type: Date }
});

// Compound indexes for efficient queries
// For equity symbols (no expiry, strike, or option type)
StandardizedSymbolSchema.index({ tradingSymbol: 1, exchange: 1, instrumentType: 1 }, { 
  unique: true, 
  partialFilterExpression: { instrumentType: 'EQUITY' } 
});

// For options and futures (with expiry, and strike/option type for options)
StandardizedSymbolSchema.index({ tradingSymbol: 1, exchange: 1, expiryDate: 1, strikePrice: 1, optionType: 1 }, { 
  unique: true,
  partialFilterExpression: { instrumentType: { $in: ['OPTION', 'FUTURE'] } }
});
StandardizedSymbolSchema.index({ underlying: 1, instrumentType: 1, expiryDate: 1 });
StandardizedSymbolSchema.index({ displayName: 'text', tradingSymbol: 'text', companyName: 'text' });

// Update timestamps middleware
StandardizedSymbolSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Export models (will be created in the database service)
export const createStandardizedSymbolModel = (connection: mongoose.Connection): Model<StandardizedSymbolDocument> => {
  return connection.model<StandardizedSymbolDocument>('StandardizedSymbol', StandardizedSymbolSchema);
};

export const createSymbolHistoryModel = (connection: mongoose.Connection): Model<SymbolHistoryDocument> => {
  return connection.model<SymbolHistoryDocument>('SymbolHistory', SymbolHistorySchema);
};

export const createSymbolProcessingLogModel = (connection: mongoose.Connection): Model<SymbolProcessingLogDocument> => {
  return connection.model<SymbolProcessingLogDocument>('SymbolProcessingLog', SymbolProcessingLogSchema);
};