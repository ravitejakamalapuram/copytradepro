// Derivatives data models and interfaces for CopyTrade Pro
// Supports options and futures trading across multiple brokers

/**
 * Greeks interface for options risk metrics
 * Contains the five primary Greeks used in options trading
 */
export interface Greeks {
  /** Delta: Price sensitivity to underlying asset price changes */
  delta: number;
  /** Gamma: Rate of change of delta */
  gamma: number;
  /** Theta: Time decay - price sensitivity to time passage */
  theta: number;
  /** Vega: Price sensitivity to implied volatility changes */
  vega: number;
  /** Rho: Price sensitivity to interest rate changes */
  rho: number;
}

/**
 * Base interface for all derivative instruments
 */
export interface DerivativeInstrument {
  /** Unique symbol identifier */
  symbol: string;
  /** Underlying asset symbol */
  underlying: string;
  /** Contract expiry date */
  expiryDate: Date;
  /** Lot size for the contract */
  lotSize: number;
  /** Minimum tick size */
  tickSize: number;
  /** Last traded price */
  lastPrice: number;
  /** Current bid price */
  bid: number;
  /** Current ask price */
  ask: number;
  /** Trading volume */
  volume: number;
  /** Open interest */
  openInterest: number;
  /** Timestamp of last update */
  timestamp: Date;
}

/**
 * Option contract interface
 */
export interface OptionContract extends DerivativeInstrument {
  /** Option type: call or put */
  optionType: 'call' | 'put';
  /** Strike price */
  strike: number;
  /** Option premium */
  premium: number;
  /** Greeks calculations */
  greeks: Greeks;
  /** Implied volatility */
  impliedVolatility: number;
  /** Time value component */
  timeValue: number;
  /** Intrinsic value component */
  intrinsicValue: number;
  /** Days to expiry */
  daysToExpiry: number;
}

/**
 * Futures contract interface
 */
export interface FuturesContract extends DerivativeInstrument {
  /** Contract value (price * lot size) */
  contractValue: number;
  /** Initial margin required */
  initialMargin: number;
  /** Maintenance margin required */
  maintenanceMargin: number;
  /** Settlement price */
  settlementPrice: number;
  /** Contract multiplier */
  multiplier: number;
  /** Rollover date for continuous contracts */
  rolloverDate?: Date;
}

/**
 * Option strike data for option chains
 */
export interface OptionStrike {
  /** Strike price */
  strike: number;
  /** Call option contract */
  call: OptionContract;
  /** Put option contract */
  put: OptionContract;
}

/**
 * Option chain interface containing all strikes for an expiry
 */
export interface OptionChain {
  /** Underlying asset symbol */
  underlying: string;
  /** Expiry date */
  expiryDate: Date;
  /** Array of strike prices with call/put data */
  strikes: OptionStrike[];
  /** Overall implied volatility */
  impliedVolatility: number;
  /** Historical volatility */
  historicalVolatility: number;
  /** At-the-money strike */
  atmStrike: number;
  /** Days to expiry */
  daysToExpiry: number;
  /** Interest rate used for calculations */
  interestRate: number;
}

/**
 * Futures chain interface containing contracts for different expiries
 */
export interface FuturesChain {
  /** Underlying asset symbol */
  underlying: string;
  /** Array of futures contracts */
  contracts: FuturesContract[];
  /** Near month (front month) contract */
  nearMonthContract: FuturesContract;
  /** Next rollover date */
  rolloverDate: Date;
  /** Contract specifications */
  specifications: FuturesSpecification;
}

/**
 * Futures contract specifications
 */
export interface FuturesSpecification {
  /** Contract size */
  contractSize: number;
  /** Minimum tick value */
  tickValue: number;
  /** Trading hours */
  tradingHours: {
    start: string;
    end: string;
  };
  /** Settlement type */
  settlementType: 'cash' | 'physical';
  /** Margin percentage */
  marginPercentage: number;
}

/**
 * Base class for derivative positions
 */
export interface DerivativePosition {
  /** Position ID */
  id: string;
  /** Broker account ID */
  brokerId: string;
  /** Instrument symbol */
  symbol: string;
  /** Underlying asset */
  underlying: string;
  /** Position type */
  positionType: 'long' | 'short';
  /** Quantity held */
  quantity: number;
  /** Average entry price */
  avgPrice: number;
  /** Current market price */
  currentPrice: number;
  /** Unrealized P&L */
  unrealizedPnL: number;
  /** Realized P&L */
  realizedPnL: number;
  /** Total P&L */
  totalPnL: number;
  /** Position value */
  positionValue: number;
  /** Margin used */
  marginUsed: number;
  /** Position entry date */
  entryDate: Date;
  /** Last update timestamp */
  lastUpdated: Date;
}

/**
 * Option position extending base derivative position
 */
export interface OptionPosition extends DerivativePosition {
  /** Option type */
  optionType: 'call' | 'put';
  /** Strike price */
  strike: number;
  /** Expiry date */
  expiryDate: Date;
  /** Premium paid/received */
  premium: number;
  /** Current Greeks */
  greeks: Greeks;
  /** Implied volatility */
  impliedVolatility: number;
  /** Time value */
  timeValue: number;
  /** Intrinsic value */
  intrinsicValue: number;
  /** Days to expiry */
  daysToExpiry: number;
}

/**
 * Futures position extending base derivative position
 */
export interface FuturesPosition extends DerivativePosition {
  /** Contract expiry date */
  expiryDate: Date;
  /** Contract size */
  contractSize: number;
  /** Initial margin */
  initialMargin: number;
  /** Maintenance margin */
  maintenanceMargin: number;
  /** Mark-to-market value */
  markToMarket: number;
  /** Settlement price */
  settlementPrice: number;
  /** Contract multiplier */
  multiplier: number;
}

/**
 * Derivative order types
 */
export type DerivativeOrderType = 'market' | 'limit' | 'stop_loss' | 'stop_limit';

/**
 * Derivative order interface
 */
export interface DerivativeOrder {
  /** Order ID */
  id: string;
  /** Broker ID */
  brokerId: string;
  /** Instrument symbol */
  symbol: string;
  /** Underlying asset */
  underlying: string;
  /** Order type */
  orderType: DerivativeOrderType;
  /** Transaction type */
  transactionType: 'buy' | 'sell';
  /** Quantity */
  quantity: number;
  /** Price (for limit orders) */
  price?: number;
  /** Stop price (for stop orders) */
  stopPrice?: number;
  /** Order status */
  status: 'pending' | 'executed' | 'cancelled' | 'rejected' | 'partial';
  /** Filled quantity */
  filledQuantity: number;
  /** Average fill price */
  avgFillPrice: number;
  /** Order timestamp */
  timestamp: Date;
  /** Expiry date for the order */
  orderExpiry?: Date;
}