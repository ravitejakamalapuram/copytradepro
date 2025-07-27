import mongoose, { Schema, Document, Model } from 'mongoose';
import { 
  OptionsInstrument, 
  OptionsMarketData, 
  OptionsPosition,
  OptionType,
  CreateOptionsInstrumentData 
} from '@copytrade/shared-types';

// ============================================================================
// MONGODB DOCUMENT INTERFACES
// ============================================================================

interface OptionsInstrumentDocument extends Document {
  underlying_symbol: string;
  trading_symbol: string;
  instrument_key: string;
  strike_price?: number;
  expiry_date: Date;
  option_type: OptionType;
  lot_size: number;
  exchange: string;
  segment: string;
  tick_size: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface OptionsMarketDataDocument extends Document {
  instrument_id: mongoose.Types.ObjectId;
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  open_interest: number;
  change: number;
  change_percent: number;
  created_at: Date;
}

interface OptionsPositionDocument extends Document {
  user_id: mongoose.Types.ObjectId;
  account_id: mongoose.Types.ObjectId;
  instrument_id: mongoose.Types.ObjectId;
  instrument_key: string;
  trading_symbol: string;
  underlying_symbol: string;
  strike_price?: number;
  expiry_date: Date;
  option_type: OptionType;
  quantity: number;
  average_price: number;
  current_price: number;
  pnl: number;
  pnl_percent: number;
  margin_used?: number;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// MONGODB SCHEMAS
// ============================================================================

const OptionsInstrumentSchema = new Schema<OptionsInstrumentDocument>({
  underlying_symbol: { type: String, required: true, index: true },
  trading_symbol: { type: String, required: true, unique: true },
  instrument_key: { type: String, required: true, unique: true },
  strike_price: { type: Number }, // Optional for futures
  expiry_date: { type: Date, required: true, index: true },
  option_type: { 
    type: String, 
    enum: ['CE', 'PE', 'FUT'], 
    required: true 
  },
  lot_size: { type: Number, required: true },
  exchange: { type: String, required: true },
  segment: { type: String, required: true },
  tick_size: { type: Number, required: true, default: 0.05 },
  is_active: { type: Boolean, default: true, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const OptionsMarketDataSchema = new Schema<OptionsMarketDataDocument>({
  instrument_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'OptionsInstrument', 
    required: true,
    index: true 
  },
  date: { type: Date, required: true, index: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, required: true },
  open_interest: { type: Number, required: true },
  change: { type: Number, default: 0 },
  change_percent: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

const OptionsPositionSchema = new Schema<OptionsPositionDocument>({
  user_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  account_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'ConnectedAccount', 
    required: true 
  },
  instrument_id: { 
    type: Schema.Types.ObjectId, 
    ref: 'OptionsInstrument', 
    required: true 
  },
  instrument_key: { type: String, required: true },
  trading_symbol: { type: String, required: true },
  underlying_symbol: { type: String, required: true, index: true },
  strike_price: { type: Number },
  expiry_date: { type: Date, required: true, index: true },
  option_type: { 
    type: String, 
    enum: ['CE', 'PE', 'FUT'], 
    required: true 
  },
  quantity: { type: Number, required: true }, // Net quantity
  average_price: { type: Number, required: true },
  current_price: { type: Number, required: true },
  pnl: { type: Number, required: true },
  pnl_percent: { type: Number, required: true },
  margin_used: { type: Number },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

// ============================================================================
// COMPOUND INDEXES
// ============================================================================

// Options Instruments
OptionsInstrumentSchema.index({ underlying_symbol: 1, expiry_date: 1 });
OptionsInstrumentSchema.index({ underlying_symbol: 1, option_type: 1, expiry_date: 1 });
OptionsInstrumentSchema.index({ underlying_symbol: 1, strike_price: 1, option_type: 1, expiry_date: 1 });
OptionsInstrumentSchema.index({ expiry_date: 1, is_active: 1 });

// Options Market Data
OptionsMarketDataSchema.index({ instrument_id: 1, date: -1 }, { unique: true });
OptionsMarketDataSchema.index({ date: -1 });

// Options Positions
OptionsPositionSchema.index({ user_id: 1, underlying_symbol: 1 });
OptionsPositionSchema.index({ user_id: 1, expiry_date: 1 });
OptionsPositionSchema.index({ account_id: 1, underlying_symbol: 1 });

// ============================================================================
// MIDDLEWARE
// ============================================================================

OptionsInstrumentSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

OptionsPositionSchema.pre('save', function(next) {
  this.updated_at = new Date();
  // Calculate PnL
  this.pnl = (this.current_price - this.average_price) * this.quantity;
  this.pnl_percent = this.average_price > 0 ? (this.pnl / (this.average_price * Math.abs(this.quantity))) * 100 : 0;
  next();
});

// ============================================================================
// OPTIONS DATABASE SERVICE
// ============================================================================

export class OptionsDatabase {
  private OptionsInstrumentModel: Model<OptionsInstrumentDocument>;
  private OptionsMarketDataModel: Model<OptionsMarketDataDocument>;
  private OptionsPositionModel: Model<OptionsPositionDocument>;

  constructor() {
    this.OptionsInstrumentModel = mongoose.model<OptionsInstrumentDocument>('OptionsInstrument', OptionsInstrumentSchema);
    this.OptionsMarketDataModel = mongoose.model<OptionsMarketDataDocument>('OptionsMarketData', OptionsMarketDataSchema);
    this.OptionsPositionModel = mongoose.model<OptionsPositionDocument>('OptionsPosition', OptionsPositionSchema);
  }

  // ============================================================================
  // INSTRUMENTS METHODS
  // ============================================================================

  async createInstrument(data: CreateOptionsInstrumentData): Promise<OptionsInstrument> {
    const instrument = new this.OptionsInstrumentModel({
      ...data,
      expiry_date: new Date(data.expiry_date)
    });
    
    const saved = await instrument.save();
    return this.instrumentDocToInterface(saved);
  }

  async getInstrumentsByUnderlying(
    underlyingSymbol: string, 
    expiry?: string,
    optionType?: OptionType
  ): Promise<OptionsInstrument[]> {
    const query: any = { 
      underlying_symbol: underlyingSymbol,
      is_active: true 
    };
    
    if (expiry) {
      query.expiry_date = new Date(expiry);
    }
    
    if (optionType) {
      query.option_type = optionType;
    }

    const instruments = await this.OptionsInstrumentModel
      .find(query)
      .sort({ strike_price: 1 });

    return instruments.map(doc => this.instrumentDocToInterface(doc));
  }

  async getInstrumentByKey(instrumentKey: string): Promise<OptionsInstrument | null> {
    const instrument = await this.OptionsInstrumentModel.findOne({ 
      instrument_key: instrumentKey,
      is_active: true 
    });
    
    return instrument ? this.instrumentDocToInterface(instrument) : null;
  }

  async getExpiryDates(underlyingSymbol: string): Promise<string[]> {
    const expiries = await this.OptionsInstrumentModel.distinct('expiry_date', {
      underlying_symbol: underlyingSymbol,
      is_active: true,
      expiry_date: { $gte: new Date() }
    });

    return expiries
      .map(date => date.toISOString().split('T')[0])
      .sort();
  }

  async deactivateExpiredInstruments(): Promise<number> {
    const result = await this.OptionsInstrumentModel.updateMany(
      { 
        expiry_date: { $lt: new Date() },
        is_active: true 
      },
      { is_active: false }
    );

    return result.modifiedCount;
  }

  // ============================================================================
  // MARKET DATA METHODS
  // ============================================================================

  async saveMarketData(instrumentId: string, data: Omit<OptionsMarketData, 'id' | 'instrument_id' | 'created_at'>): Promise<OptionsMarketData> {
    const marketData = new this.OptionsMarketDataModel({
      instrument_id: new mongoose.Types.ObjectId(instrumentId),
      ...data,
      date: new Date(data.date)
    });

    const saved = await marketData.save();
    return this.marketDataDocToInterface(saved);
  }

  async getLatestMarketData(instrumentId: string): Promise<OptionsMarketData | null> {
    const data = await this.OptionsMarketDataModel
      .findOne({ instrument_id: new mongoose.Types.ObjectId(instrumentId) })
      .sort({ date: -1 });

    return data ? this.marketDataDocToInterface(data) : null;
  }

  async getMarketDataByDate(instrumentId: string, date: string): Promise<OptionsMarketData | null> {
    const data = await this.OptionsMarketDataModel.findOne({
      instrument_id: new mongoose.Types.ObjectId(instrumentId),
      date: new Date(date)
    });

    return data ? this.marketDataDocToInterface(data) : null;
  }

  // ============================================================================
  // POSITIONS METHODS
  // ============================================================================

  async createOrUpdatePosition(
    userId: string,
    accountId: string,
    instrumentKey: string,
    quantity: number,
    price: number
  ): Promise<OptionsPosition> {
    // Find existing position
    const existingPosition = await this.OptionsPositionModel.findOne({
      user_id: new mongoose.Types.ObjectId(userId),
      account_id: new mongoose.Types.ObjectId(accountId),
      instrument_key: instrumentKey
    });

    if (existingPosition) {
      // Update existing position
      const newQuantity = existingPosition.quantity + quantity;
      const newAveragePrice = newQuantity !== 0 
        ? ((existingPosition.average_price * existingPosition.quantity) + (price * quantity)) / newQuantity
        : 0;

      existingPosition.quantity = newQuantity;
      existingPosition.average_price = newAveragePrice;
      existingPosition.current_price = price;

      const updated = await existingPosition.save();
      return this.positionDocToInterface(updated);
    } else {
      // Create new position
      const instrument = await this.getInstrumentByKey(instrumentKey);
      if (!instrument) {
        throw new Error(`Instrument not found: ${instrumentKey}`);
      }

      const position = new this.OptionsPositionModel({
        user_id: new mongoose.Types.ObjectId(userId),
        account_id: new mongoose.Types.ObjectId(accountId),
        instrument_id: new mongoose.Types.ObjectId(instrument.id),
        instrument_key: instrumentKey,
        trading_symbol: instrument.trading_symbol,
        underlying_symbol: instrument.underlying_symbol,
        strike_price: instrument.strike_price,
        expiry_date: new Date(instrument.expiry_date),
        option_type: instrument.option_type,
        quantity,
        average_price: price,
        current_price: price,
        pnl: 0,
        pnl_percent: 0
      });

      const saved = await position.save();
      return this.positionDocToInterface(saved);
    }
  }

  async getPositionsByUser(userId: string): Promise<OptionsPosition[]> {
    const positions = await this.OptionsPositionModel
      .find({ 
        user_id: new mongoose.Types.ObjectId(userId),
        quantity: { $ne: 0 } // Only non-zero positions
      })
      .sort({ underlying_symbol: 1, expiry_date: 1, strike_price: 1 });

    return positions.map(doc => this.positionDocToInterface(doc));
  }

  async getPositionsByUnderlying(userId: string, underlyingSymbol: string): Promise<OptionsPosition[]> {
    const positions = await this.OptionsPositionModel
      .find({ 
        user_id: new mongoose.Types.ObjectId(userId),
        underlying_symbol: underlyingSymbol,
        quantity: { $ne: 0 }
      })
      .sort({ expiry_date: 1, strike_price: 1 });

    return positions.map(doc => this.positionDocToInterface(doc));
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private instrumentDocToInterface(doc: OptionsInstrumentDocument): OptionsInstrument {
    return {
      id: doc._id.toString(),
      underlying_symbol: doc.underlying_symbol,
      trading_symbol: doc.trading_symbol,
      instrument_key: doc.instrument_key,
      strike_price: doc.strike_price,
      expiry_date: doc.expiry_date.toISOString(),
      option_type: doc.option_type,
      lot_size: doc.lot_size,
      exchange: doc.exchange as any,
      segment: doc.segment,
      tick_size: doc.tick_size,
      is_active: doc.is_active,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString()
    };
  }

  private marketDataDocToInterface(doc: OptionsMarketDataDocument): OptionsMarketData {
    return {
      id: doc._id.toString(),
      instrument_id: doc.instrument_id.toString(),
      date: doc.date.toISOString().split('T')[0],
      open: doc.open,
      high: doc.high,
      low: doc.low,
      close: doc.close,
      volume: doc.volume,
      open_interest: doc.open_interest,
      change: doc.change,
      change_percent: doc.change_percent,
      created_at: doc.created_at.toISOString()
    };
  }

  private positionDocToInterface(doc: OptionsPositionDocument): OptionsPosition {
    return {
      id: doc._id.toString(),
      user_id: doc.user_id.toString(),
      account_id: doc.account_id.toString(),
      instrument_key: doc.instrument_key,
      trading_symbol: doc.trading_symbol,
      underlying_symbol: doc.underlying_symbol,
      strike_price: doc.strike_price,
      expiry_date: doc.expiry_date.toISOString(),
      option_type: doc.option_type,
      quantity: doc.quantity,
      average_price: doc.average_price,
      current_price: doc.current_price,
      pnl: doc.pnl,
      pnl_percent: doc.pnl_percent,
      margin_used: doc.margin_used,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString()
    };
  }
}

// Export singleton instance
export const optionsDatabase = new OptionsDatabase();