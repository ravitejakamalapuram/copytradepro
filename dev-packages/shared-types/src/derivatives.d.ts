export interface Greeks {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
}
export interface DerivativeInstrument {
    symbol: string;
    underlying: string;
    expiryDate: Date;
    lotSize: number;
    tickSize: number;
    lastPrice: number;
    bid: number;
    ask: number;
    volume: number;
    openInterest: number;
    timestamp: Date;
}
export interface OptionContract extends DerivativeInstrument {
    optionType: 'call' | 'put';
    strike: number;
    premium: number;
    greeks: Greeks;
    impliedVolatility: number;
    timeValue: number;
    intrinsicValue: number;
    daysToExpiry: number;
}
export interface FuturesContract extends DerivativeInstrument {
    contractValue: number;
    initialMargin: number;
    maintenanceMargin: number;
    settlementPrice: number;
    multiplier: number;
    rolloverDate?: Date;
}
export interface OptionStrike {
    strike: number;
    call: OptionContract;
    put: OptionContract;
}
export interface OptionChain {
    underlying: string;
    expiryDate: Date;
    strikes: OptionStrike[];
    impliedVolatility: number;
    historicalVolatility: number;
    atmStrike: number;
    daysToExpiry: number;
    interestRate: number;
}
export interface FuturesChain {
    underlying: string;
    contracts: FuturesContract[];
    nearMonthContract: FuturesContract;
    rolloverDate: Date;
    specifications: FuturesSpecification;
}
export interface FuturesSpecification {
    contractSize: number;
    tickValue: number;
    tradingHours: {
        start: string;
        end: string;
    };
    settlementType: 'cash' | 'physical';
    marginPercentage: number;
}
export interface DerivativePosition {
    id: string;
    brokerId: string;
    symbol: string;
    underlying: string;
    positionType: 'long' | 'short';
    quantity: number;
    avgPrice: number;
    currentPrice: number;
    unrealizedPnL: number;
    realizedPnL: number;
    totalPnL: number;
    positionValue: number;
    marginUsed: number;
    entryDate: Date;
    lastUpdated: Date;
}
export interface OptionPosition extends DerivativePosition {
    optionType: 'call' | 'put';
    strike: number;
    expiryDate: Date;
    premium: number;
    greeks: Greeks;
    impliedVolatility: number;
    timeValue: number;
    intrinsicValue: number;
    daysToExpiry: number;
}
export interface FuturesPosition extends DerivativePosition {
    expiryDate: Date;
    contractSize: number;
    initialMargin: number;
    maintenanceMargin: number;
    markToMarket: number;
    settlementPrice: number;
    multiplier: number;
}
export type DerivativeOrderType = 'market' | 'limit' | 'stop_loss' | 'stop_limit';
export interface DerivativeOrder {
    id: string;
    brokerId: string;
    symbol: string;
    underlying: string;
    orderType: DerivativeOrderType;
    transactionType: 'buy' | 'sell';
    quantity: number;
    price?: number;
    stopPrice?: number;
    status: 'pending' | 'executed' | 'cancelled' | 'rejected' | 'partial';
    filledQuantity: number;
    avgFillPrice: number;
    timestamp: Date;
    orderExpiry?: Date;
}
//# sourceMappingURL=derivatives.d.ts.map