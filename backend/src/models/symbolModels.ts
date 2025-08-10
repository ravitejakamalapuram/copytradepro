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
  contentHash?: string;         // hash of content for incremental sync
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
  contentHash?: string;
  isin?: string;
  companyName?: string;
  sector?: string;
  createdAt: Date;
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
  contentHash: { type: String, index: true },
  isin: { type: String },
  companyName: { type: String },
  sector: { type: String },
  createdAt: { type: Date, default: Date.now }
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

// Removed overly restrictive unique constraints that were rejecting valid market data
// Upstox data contains legitimate duplicates (same symbol on different exchanges, etc.)
// Using instrument_key from Upstox as the natural unique identifier instead

// Search optimization indexes
StandardizedSymbolSchema.index({ displayName: 'text', tradingSymbol: 'text', companyName: 'text' });

// Minimal partial indexes focused on active records (fast common queries)
StandardizedSymbolSchema.index(
  { tradingSymbol: 1 },
  { partialFilterExpression: { isActive: true }, name: 'idx_active_tradingSymbol' }
);
StandardizedSymbolSchema.index(
  { exchange: 1, instrumentType: 1 },
  { partialFilterExpression: { isActive: true }, name: 'idx_active_exchange_instrumentType' }
);
StandardizedSymbolSchema.index(
  { underlying: 1, instrumentType: 1, expiryDate: 1 },
  { partialFilterExpression: { isActive: true }, name: 'idx_active_underlying_instrument_expiry' }
);

// Existing query optimization indexes
StandardizedSymbolSchema.index({ underlying: 1, instrumentType: 1, expiryDate: 1, isActive: 1 });
StandardizedSymbolSchema.index({ instrumentType: 1, exchange: 1, isActive: 1 });
StandardizedSymbolSchema.index({ underlying: 1, expiryDate: 1, strikePrice: 1, optionType: 1, isActive: 1 });
StandardizedSymbolSchema.index({ exchange: 1, instrumentType: 1, isActive: 1 });
StandardizedSymbolSchema.index({ sector: 1, instrumentType: 1, isActive: 1 });

// Performance optimization indexes
StandardizedSymbolSchema.index({ isActive: 1, lastUpdated: -1 });
StandardizedSymbolSchema.index({ source: 1, lastUpdated: -1 });

// Option chain specific indexes
StandardizedSymbolSchema.index({ underlying: 1, expiryDate: 1, instrumentType: 1, isActive: 1 });
StandardizedSymbolSchema.index({ underlying: 1, strikePrice: 1, optionType: 1, expiryDate: 1, isActive: 1 });

// Update timestamps middleware
StandardizedSymbolSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Export models (will be created in the database service)
export const createStandardizedSymbolModel = (connection: mongoose.Connection): Model<StandardizedSymbolDocument> => {
  return connection.model<StandardizedSymbolDocument>('StandardizedSymbol', StandardizedSymbolSchema);
};




// Rejected symbols for debugging normalization/validation failures
export interface RejectedSymbolDocument extends Document {
  source: string;
  reason: string;
  raw: any;
  createdAt: Date;
}

export const RejectedSymbolSchema = new Schema<RejectedSymbolDocument>({
  source: { type: String, required: true },
  reason: { type: String, required: true },
  raw: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const createRejectedSymbolModel = (connection: mongoose.Connection): Model<RejectedSymbolDocument> => {
  return connection.model<RejectedSymbolDocument>('RejectedSymbol', RejectedSymbolSchema);
};

export const createSymbolProcessingLogModel = (connection: mongoose.Connection): Model<SymbolProcessingLogDocument> => {
  return connection.model<SymbolProcessingLogDocument>('SymbolProcessingLog', SymbolProcessingLogSchema);
};