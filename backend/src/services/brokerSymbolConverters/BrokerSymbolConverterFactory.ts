import { StandardizedSymbol } from '../../models/symbolModels';
import { IBrokerSymbolConverter, BrokerSymbolFormat } from './IBrokerSymbolConverter';
import { FyersSymbolConverter } from './FyersSymbolConverter';
import { ShoonyaSymbolConverter } from './ShoonyaSymbolConverter';

export class BrokerSymbolConverterFactory {
  private static converters: Map<string, IBrokerSymbolConverter> = new Map();
  private static initialized = false;

  /**
   * Initialize the factory with default converters
   */
  private static initialize(): void {
    if (this.initialized) {
      return;
    }

    // Register default converters
    this.registerConverter(new FyersSymbolConverter());
    this.registerConverter(new ShoonyaSymbolConverter());
    
    this.initialized = true;
  }

  /**
   * Register a new broker symbol converter
   */
  static registerConverter(converter: IBrokerSymbolConverter): void {
    const brokerName = converter.getBrokerName().toLowerCase();
    this.converters.set(brokerName, converter);
  }

  /**
   * Unregister a broker symbol converter
   */
  static unregisterConverter(brokerName: string): boolean {
    return this.converters.delete(brokerName.toLowerCase());
  }

  /**
   * Get a converter for a specific broker
   */
  static getConverter(brokerName: string): IBrokerSymbolConverter {
    this.initialize();
    
    const converter = this.converters.get(brokerName.toLowerCase());
    if (!converter) {
      throw new Error(`No converter found for broker: ${brokerName}`);
    }
    
    return converter;
  }

  /**
   * Check if a converter exists for a broker
   */
  static hasConverter(brokerName: string): boolean {
    this.initialize();
    return this.converters.has(brokerName.toLowerCase());
  }

  /**
   * Get all registered broker names
   */
  static getRegisteredBrokers(): string[] {
    this.initialize();
    return Array.from(this.converters.keys());
  }

  /**
   * Convert a symbol to broker-specific format
   */
  static convertSymbol(symbol: StandardizedSymbol, brokerName: string): BrokerSymbolFormat {
    const converter = this.getConverter(brokerName);
    
    if (!converter.canConvert(symbol)) {
      throw new Error(`Broker ${brokerName} cannot convert symbol with exchange: ${symbol.exchange}`);
    }
    
    return converter.convertToBrokerFormat(symbol);
  }

  /**
   * Find all brokers that can convert a given symbol
   */
  static getCompatibleBrokers(symbol: StandardizedSymbol): string[] {
    this.initialize();
    
    const compatibleBrokers: string[] = [];
    
    for (const [brokerName, converter] of this.converters) {
      if (converter.canConvert(symbol)) {
        compatibleBrokers.push(brokerName);
      }
    }
    
    return compatibleBrokers;
  }

  /**
   * Batch convert multiple symbols for a broker
   */
  static convertSymbols(symbols: StandardizedSymbol[], brokerName: string): BrokerSymbolFormat[] {
    const converter = this.getConverter(brokerName);
    
    return symbols.map(symbol => {
      if (!converter.canConvert(symbol)) {
        throw new Error(`Broker ${brokerName} cannot convert symbol ${symbol.id} with exchange: ${symbol.exchange}`);
      }
      
      return converter.convertToBrokerFormat(symbol);
    });
  }

  /**
   * Validate if a symbol can be converted for a specific broker
   */
  static canConvertSymbol(symbol: StandardizedSymbol, brokerName: string): boolean {
    try {
      const converter = this.getConverter(brokerName);
      return converter.canConvert(symbol);
    } catch {
      return false;
    }
  }

  /**
   * Clear all registered converters (mainly for testing)
   */
  static clearConverters(): void {
    this.converters.clear();
    this.initialized = false;
  }

  /**
   * Get converter statistics
   */
  static getConverterStats(): { 
    totalConverters: number; 
    brokers: string[]; 
    supportedExchanges: string[] 
  } {
    this.initialize();
    
    const supportedExchanges = new Set<string>();
    
    // Collect all supported exchanges from all converters
    for (const converter of this.converters.values()) {
      // Test with different exchanges to see which ones are supported
      const testExchanges = ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'];
      
      for (const exchange of testExchanges) {
        const testSymbol: StandardizedSymbol = {
          id: 'test',
          displayName: 'Test',
          tradingSymbol: 'TEST',
          instrumentType: 'EQUITY',
          exchange: exchange as any,
          segment: 'EQ',
          lotSize: 1,
          tickSize: 0.05,
          isActive: true,
          lastUpdated: '2025-01-01T00:00:00Z',
          source: 'test',
          createdAt: '2025-01-01T00:00:00Z'
        };
        
        if (converter.canConvert(testSymbol)) {
          supportedExchanges.add(exchange);
        }
      }
    }
    
    return {
      totalConverters: this.converters.size,
      brokers: this.getRegisteredBrokers(),
      supportedExchanges: Array.from(supportedExchanges).sort()
    };
  }
}