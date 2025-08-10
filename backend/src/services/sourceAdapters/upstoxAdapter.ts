import { CreateStandardizedSymbolData } from '../../models/symbolModels';

export interface UnifiedRawSymbol {
  trading_symbol: string;
  exchange: string;
  instrument_type: string;
  name: string;
  expiry?: number;
  strike_price?: number;
  lot_size?: number;
  tick_size?: number;
  underlying_symbol?: string;
  segment?: string;
}

export interface SourceAdapter {
  readonly name: string;
  normalize(raw: any[]): UnifiedRawSymbol[];
}

export class UpstoxAdapter implements SourceAdapter {
  readonly name = 'upstox';

  normalize(raw: any[]): UnifiedRawSymbol[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((s: any) => ({
      trading_symbol: s?.trading_symbol,
      exchange: s?.exchange,
      instrument_type: s?.instrument_type,
      name: s?.name,
      expiry: s?.expiry,
      strike_price: s?.strike_price,
      lot_size: s?.lot_size,
      tick_size: s?.tick_size,
      underlying_symbol: s?.underlying_symbol,
      segment: s?.segment
    }));
  }
}

