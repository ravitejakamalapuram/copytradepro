import { BrokerSymbolConverterFactory } from './brokerSymbolConverters/BrokerSymbolConverterFactory';

/**
 * Centralized helper to convert standardized symbol metadata into broker-specific
 * trading symbol and exchange.
 */
export interface SymbolConversionInput {
  // Minimal fields we expect from symbolDatabaseService StandardizedSymbol
  tradingSymbol: string;
  exchange: string;
  instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE' | string;
  segment?: string;
  strikePrice?: number;
  optionType?: 'CE' | 'PE' | string;
  expiryDate?: string;
  [key: string]: any;
}

export interface SymbolConversionResult {
  tradingSymbol: string;
  exchange?: string;
}

export function convertSymbolForBroker(
  symbol: SymbolConversionInput,
  brokerName: string
): SymbolConversionResult {
  try {
    const converter = BrokerSymbolConverterFactory.getConverter(brokerName);
    const brokerSymbol = converter.convertToBrokerFormat(symbol as any);
    return {
      tradingSymbol: brokerSymbol?.tradingSymbol || symbol.tradingSymbol,
      exchange: brokerSymbol?.exchange || symbol.exchange
    };
  } catch (err) {
    // Fallback to input if conversion fails
    return {
      tradingSymbol: symbol?.tradingSymbol,
      exchange: symbol?.exchange
    };
  }
}

