import { StandardizedSymbol } from '../../models/symbolModels';

export interface BrokerSymbolFormat {
  tradingSymbol: string;
  exchange?: string;
  segment?: string;
  additionalParams?: Record<string, any>;
}

export interface IBrokerSymbolConverter {
  /**
   * Convert standardized symbol to broker-specific format
   */
  convertToBrokerFormat(symbol: StandardizedSymbol): BrokerSymbolFormat;
  
  /**
   * Get the broker name this converter handles
   */
  getBrokerName(): string;
  
  /**
   * Validate if the symbol can be converted for this broker
   */
  canConvert(symbol: StandardizedSymbol): boolean;
}