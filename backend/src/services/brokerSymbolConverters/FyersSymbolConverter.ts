import { StandardizedSymbol } from '../../models/symbolModels';
import { IBrokerSymbolConverter, BrokerSymbolFormat } from './IBrokerSymbolConverter';

export class FyersSymbolConverter implements IBrokerSymbolConverter {
  
  getBrokerName(): string {
    return 'fyers';
  }

  canConvert(symbol: StandardizedSymbol): boolean {
    // Fyers supports NSE, BSE, NFO, BFO, MCX exchanges
    const supportedExchanges = ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'];
    return supportedExchanges.includes(symbol.exchange);
  }

  convertToBrokerFormat(symbol: StandardizedSymbol): BrokerSymbolFormat {
    if (!this.canConvert(symbol)) {
      throw new Error(`Fyers does not support exchange: ${symbol.exchange}`);
    }

    let fyersSymbol: string;
    
    switch (symbol.instrumentType) {
      case 'EQUITY':
        fyersSymbol = this.convertEquitySymbol(symbol);
        break;
      case 'OPTION':
        fyersSymbol = this.convertOptionSymbol(symbol);
        break;
      case 'FUTURE':
        fyersSymbol = this.convertFutureSymbol(symbol);
        break;
      default:
        throw new Error(`Unsupported instrument type: ${symbol.instrumentType}`);
    }

    return {
      tradingSymbol: fyersSymbol,
      exchange: symbol.exchange,
      segment: symbol.segment
    };
  }

  private convertEquitySymbol(symbol: StandardizedSymbol): string {
    // Fyers equity format:
    // - NSE: EXCHANGE:SYMBOL-EQ (ensure -EQ once)
    // - BSE: EXCHANGE:SYMBOL (plain scrip symbol)
    this.validateEquitySymbol(symbol);
    const exch = symbol.exchange;
    const base = symbol.tradingSymbol || '';
    const normalized = exch === 'BSE' ? base.replace(/-[A-Z]{1,3}$/i, '') : (base.endsWith('-EQ') ? base : `${base}-EQ`);
    return `${exch}:${normalized}`;
  }

  private convertOptionSymbol(symbol: StandardizedSymbol): string {
    // Fyers option format: EXCHANGE:SYMBOL
    // The trading symbol already contains the full option details
    // Example: NSE:NIFTY25JAN22000CE
    this.validateOptionSymbol(symbol);
    return `${symbol.exchange}:${symbol.tradingSymbol}`;
  }

  private convertFutureSymbol(symbol: StandardizedSymbol): string {
    // Fyers future format: EXCHANGE:SYMBOL
    // The trading symbol already contains the full future details
    // Example: NSE:NIFTY25JANFUT
    this.validateFutureSymbol(symbol);
    return `${symbol.exchange}:${symbol.tradingSymbol}`;
  }

  private validateEquitySymbol(symbol: StandardizedSymbol): void {
    if (!symbol.tradingSymbol) {
      throw new Error('Trading symbol is required for equity conversion');
    }
    
    if (symbol.exchange !== 'NSE' && symbol.exchange !== 'BSE') {
      throw new Error(`Invalid exchange for equity: ${symbol.exchange}. Expected NSE or BSE`);
    }
  }

  private validateOptionSymbol(symbol: StandardizedSymbol): void {
    if (!symbol.tradingSymbol) {
      throw new Error('Trading symbol is required for option conversion');
    }
    
    if (!symbol.underlying) {
      throw new Error('Underlying symbol is required for option conversion');
    }
    
    if (symbol.strikePrice === undefined || symbol.strikePrice <= 0) {
      throw new Error('Valid strike price is required for option conversion');
    }
    
    if (!symbol.optionType || !['CE', 'PE'].includes(symbol.optionType)) {
      throw new Error('Valid option type (CE/PE) is required for option conversion');
    }
    
    if (!symbol.expiryDate) {
      throw new Error('Expiry date is required for option conversion');
    }
    
    // Options are typically traded on NFO/BFO
    if (!['NSE', 'NFO', 'BSE', 'BFO'].includes(symbol.exchange)) {
      throw new Error(`Invalid exchange for options: ${symbol.exchange}. Expected NSE, NFO, BSE, or BFO`);
    }
  }

  private validateFutureSymbol(symbol: StandardizedSymbol): void {
    if (!symbol.tradingSymbol) {
      throw new Error('Trading symbol is required for future conversion');
    }
    
    if (!symbol.underlying) {
      throw new Error('Underlying symbol is required for future conversion');
    }
    
    if (!symbol.expiryDate) {
      throw new Error('Expiry date is required for future conversion');
    }
    
    // Futures are typically traded on NFO/BFO/MCX
    if (!['NSE', 'NFO', 'BSE', 'BFO', 'MCX'].includes(symbol.exchange)) {
      throw new Error(`Invalid exchange for futures: ${symbol.exchange}. Expected NSE, NFO, BSE, BFO, or MCX`);
    }
  }
}