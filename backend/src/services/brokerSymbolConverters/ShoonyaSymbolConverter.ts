import { StandardizedSymbol } from '../../models/symbolModels';
import { IBrokerSymbolConverter, BrokerSymbolFormat } from './IBrokerSymbolConverter';

export class ShoonyaSymbolConverter implements IBrokerSymbolConverter {
  
  getBrokerName(): string {
    return 'shoonya';
  }

  canConvert(symbol: StandardizedSymbol): boolean {
    // Shoonya supports NSE, BSE, NFO, BFO, MCX exchanges
    const supportedExchanges = ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'];
    return supportedExchanges.includes(symbol.exchange);
  }

  convertToBrokerFormat(symbol: StandardizedSymbol): BrokerSymbolFormat {
    if (!this.canConvert(symbol)) {
      throw new Error(`Shoonya does not support exchange: ${symbol.exchange}`);
    }

    let shoonyaExchange: string;
    let tradingSymbol: string;
    
    switch (symbol.instrumentType) {
      case 'EQUITY':
        const equityResult = this.convertEquitySymbol(symbol);
        shoonyaExchange = equityResult.exchange;
        tradingSymbol = equityResult.tradingSymbol;
        break;
      case 'OPTION':
        const optionResult = this.convertOptionSymbol(symbol);
        shoonyaExchange = optionResult.exchange;
        tradingSymbol = optionResult.tradingSymbol;
        break;
      case 'FUTURE':
        const futureResult = this.convertFutureSymbol(symbol);
        shoonyaExchange = futureResult.exchange;
        tradingSymbol = futureResult.tradingSymbol;
        break;
      default:
        throw new Error(`Unsupported instrument type: ${symbol.instrumentType}`);
    }

    return {
      tradingSymbol: tradingSymbol,
      exchange: shoonyaExchange,
      segment: symbol.segment
    };
  }

  private convertEquitySymbol(symbol: StandardizedSymbol): { tradingSymbol: string; exchange: string } {
    // Shoonya equity format: No exchange prefix, just the symbol
    // Exchange mapping: NSE -> NSE, BSE -> BSE
    this.validateEquitySymbol(symbol);
    
    return {
      tradingSymbol: symbol.tradingSymbol,
      exchange: symbol.exchange // NSE or BSE remains the same
    };
  }

  private convertOptionSymbol(symbol: StandardizedSymbol): { tradingSymbol: string; exchange: string } {
    // Shoonya option format: No exchange prefix, just the symbol
    // Exchange mapping: NSE -> NFO, BSE -> BFO for derivatives
    this.validateOptionSymbol(symbol);
    
    const shoonyaExchange = this.mapDerivativeExchange(symbol.exchange);
    
    return {
      tradingSymbol: symbol.tradingSymbol,
      exchange: shoonyaExchange
    };
  }

  private convertFutureSymbol(symbol: StandardizedSymbol): { tradingSymbol: string; exchange: string } {
    // Shoonya future format: No exchange prefix, just the symbol
    // Exchange mapping: NSE -> NFO, BSE -> BFO, MCX -> MCX for derivatives
    this.validateFutureSymbol(symbol);
    
    const shoonyaExchange = this.mapDerivativeExchange(symbol.exchange);
    
    return {
      tradingSymbol: symbol.tradingSymbol,
      exchange: shoonyaExchange
    };
  }

  private mapDerivativeExchange(exchange: string): string {
    // Map exchanges for derivatives trading
    const exchangeMap: Record<string, string> = {
      'NSE': 'NFO',  // NSE derivatives trade on NFO
      'NFO': 'NFO',  // Already NFO
      'BSE': 'BFO',  // BSE derivatives trade on BFO
      'BFO': 'BFO',  // Already BFO
      'MCX': 'MCX'   // MCX remains MCX
    };
    
    return exchangeMap[exchange] || exchange;
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
    
    // Options can be on NSE/NFO or BSE/BFO
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
    
    // Futures can be on NSE/NFO, BSE/BFO, or MCX
    if (!['NSE', 'NFO', 'BSE', 'BFO', 'MCX'].includes(symbol.exchange)) {
      throw new Error(`Invalid exchange for futures: ${symbol.exchange}. Expected NSE, NFO, BSE, BFO, or MCX`);
    }
  }
}