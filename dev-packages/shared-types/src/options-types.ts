/**
 * Options Trading Types
 * 
 * Types specific to F&O (Futures & Options) trading
 */

import { Exchange, BrokerName } from './constants';

// ============================================================================
// OPTIONS INSTRUMENT TYPES
// ============================================================================

/**
 * Option types
 */
export const OPTION_TYPE = {
  CALL: 'CE',
  PUT: 'PE',
  FUTURE: 'FUT'
} as const;

export type OptionType = typeof OPTION_TYPE[keyof typeof OPTION_TYPE];

/**
 * Options instrument interface
 */
export interface OptionsInstrument {
  id: string;
  underlying_symbol: string;
  trading_symbol: string;
  instrument_key: string; // Broker-specific key
  strike_price?: number; // Not applicable for futures
  expiry_date: string; // ISO date string
  option_type: OptionType;
  lot_size: number;
  exchange: Exchange;
  segment: string; // NSE_FO, BFO, etc.
  tick_size: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

/**
 * Data for creating options instrument
 */
export interface CreateOptionsInstrumentData {
  underlying_symbol: string;
  trading_symbol: string;
  instrument_key: string;
  strike_price?: number;
  expiry_date: string;
  option_type: OptionType;
  lot_size: number;
  exchange: Exchange;
  segment: string;
  tick_size: number;
}

// ============================================================================
// OPTIONS MARKET DATA TYPES
// ============================================================================

/**
 * Options market data interface
 */
export interface OptionsMarketData {
  id: string;
  instrument_id: string;
  date: string; // ISO date string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  open_interest: number;
  change: number;
  change_percent: number;
  created_at: string;
}

/**
 * Real-time options quote
 */
export interface OptionsQuote {
  instrument_key: string;
  trading_symbol: string;
  ltp: number; // Last Traded Price
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  open_interest: number;
  change: number;
  change_percent: number;
  bid_price: number;
  ask_price: number;
  bid_quantity: number;
  ask_quantity: number;
  timestamp: string;
}

// ============================================================================
// OPTION CHAIN TYPES
// ============================================================================

/**
 * Option chain strike data
 */
export interface OptionChainStrike {
  strike_price: number;
  call: {
    instrument_key: string;
    trading_symbol: string;
    ltp: number;
    change: number;
    change_percent: number;
    volume: number;
    open_interest: number;
    bid_price: number;
    ask_price: number;
    iv?: number; // Implied Volatility
  } | null;
  put: {
    instrument_key: string;
    trading_symbol: string;
    ltp: number;
    change: number;
    change_percent: number;
    volume: number;
    open_interest: number;
    bid_price: number;
    ask_price: number;
    iv?: number; // Implied Volatility
  } | null;
}

/**
 * Complete option chain
 */
export interface OptionChain {
  underlying_symbol: string;
  underlying_price: number;
  expiry_date: string;
  strikes: OptionChainStrike[];
  total_call_oi: number;
  total_put_oi: number;
  pcr: number; // Put-Call Ratio
  max_pain?: number;
  timestamp: string;
}

// ============================================================================
// OPTIONS ORDER TYPES
// ============================================================================

/**
 * Options-specific order data
 */
export interface OptionsOrderData {
  underlying_symbol: string;
  strike_price?: number; // Not applicable for futures
  expiry_date: string;
  option_type: OptionType;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  product_type: string;
  trigger_price?: number;
  disclosed_quantity?: number;
  validity?: 'DAY' | 'IOC' | 'GTD';
  remarks?: string;
}

/**
 * Options order with instrument details
 */
export interface OptionsOrder extends OptionsOrderData {
  id: string;
  user_id: string;
  account_id: string;
  broker_name: BrokerName;
  broker_order_id: string;
  instrument_key: string;
  trading_symbol: string;
  lot_size: number;
  status: 'SUBMITTED' | 'PENDING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED';
  executed_quantity?: number;
  executed_price?: number;
  order_time: string;
  execution_time?: string;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

// ============================================================================
// OPTIONS STRATEGY TYPES
// ============================================================================

/**
 * Common option strategies
 */
export const OPTION_STRATEGY = {
  LONG_CALL: 'LONG_CALL',
  LONG_PUT: 'LONG_PUT',
  SHORT_CALL: 'SHORT_CALL',
  SHORT_PUT: 'SHORT_PUT',
  LONG_STRADDLE: 'LONG_STRADDLE',
  SHORT_STRADDLE: 'SHORT_STRADDLE',
  LONG_STRANGLE: 'LONG_STRANGLE',
  SHORT_STRANGLE: 'SHORT_STRANGLE',
  BULL_CALL_SPREAD: 'BULL_CALL_SPREAD',
  BEAR_PUT_SPREAD: 'BEAR_PUT_SPREAD',
  IRON_CONDOR: 'IRON_CONDOR',
  BUTTERFLY: 'BUTTERFLY',
  COLLAR: 'COLLAR',
  COVERED_CALL: 'COVERED_CALL',
  PROTECTIVE_PUT: 'PROTECTIVE_PUT'
} as const;

export type OptionStrategy = typeof OPTION_STRATEGY[keyof typeof OPTION_STRATEGY];

/**
 * Option strategy leg
 */
export interface OptionStrategyLeg {
  instrument_key: string;
  trading_symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  strike_price?: number;
  option_type: OptionType;
  price?: number;
}

/**
 * Option strategy definition
 */
export interface OptionStrategyDefinition {
  id: string;
  name: string;
  strategy_type: OptionStrategy;
  underlying_symbol: string;
  expiry_date: string;
  legs: OptionStrategyLeg[];
  max_profit?: number;
  max_loss?: number;
  breakeven_points?: number[];
  margin_required?: number;
  created_at: string;
}

// ============================================================================
// OPTIONS PORTFOLIO TYPES
// ============================================================================

/**
 * Options position
 */
export interface OptionsPosition {
  id: string;
  user_id: string;
  account_id: string;
  instrument_key: string;
  trading_symbol: string;
  underlying_symbol: string;
  strike_price?: number;
  expiry_date: string;
  option_type: OptionType;
  quantity: number; // Net quantity (positive for long, negative for short)
  average_price: number;
  current_price: number;
  pnl: number;
  pnl_percent: number;
  margin_used?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Options portfolio summary
 */
export interface OptionsPortfolioSummary {
  total_positions: number;
  total_pnl: number;
  total_pnl_percent: number;
  total_margin_used: number;
  day_pnl: number;
  positions_by_underlying: {
    [symbol: string]: {
      positions: OptionsPosition[];
      net_pnl: number;
      net_quantity: number;
    };
  };
  expiry_wise_summary: {
    [expiry: string]: {
      positions: number;
      pnl: number;
    };
  };
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Options instrument search response
 */
export interface OptionsInstrumentSearchResponse {
  success: boolean;
  data: OptionsInstrument[];
  total: number;
  page?: number;
  limit?: number;
}

/**
 * Option chain response
 */
export interface OptionChainResponse {
  success: boolean;
  data: OptionChain;
  message?: string;
}

/**
 * Options order response
 */
export interface OptionsOrderResponse {
  success: boolean;
  data: OptionsOrder;
  message?: string;
}

/**
 * Options portfolio response
 */
export interface OptionsPortfolioResponse {
  success: boolean;
  data: OptionsPortfolioSummary;
  message?: string;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

/**
 * Options instrument filters
 */
export interface OptionsInstrumentFilters {
  underlying_symbol?: string;
  option_type?: OptionType;
  expiry_date?: string;
  strike_price_min?: number;
  strike_price_max?: number;
  exchange?: Exchange;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Options order filters
 */
export interface OptionsOrderFilters {
  user_id?: string;
  account_id?: string;
  underlying_symbol?: string;
  option_type?: OptionType;
  expiry_date?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Options Greeks (for advanced analytics)
 */
export interface OptionsGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  implied_volatility: number;
}

/**
 * Options analytics
 */
export interface OptionsAnalytics {
  instrument_key: string;
  greeks?: OptionsGreeks;
  time_to_expiry: number; // Days
  moneyness: 'ITM' | 'ATM' | 'OTM'; // In/At/Out of the Money
  intrinsic_value: number;
  time_value: number;
}

/**
 * Expiry calendar
 */
export interface ExpiryCalendar {
  underlying_symbol: string;
  expiry_dates: {
    date: string;
    is_weekly: boolean;
    is_monthly: boolean;
    days_to_expiry: number;
    available_strikes: number[];
  }[];
}