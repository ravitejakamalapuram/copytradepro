/**
 * Fyers Symbol Formatter
 * Handles proper symbol formatting for Fyers API
 */

export interface SymbolComponents {
  underlying: string;
  expiry: string;
  strike?: number;
  optionType?: 'CE' | 'PE';
  instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
}

export class FyersSymbolFormatter {
  /**
   * Format option symbol for Fyers API
   * @param underlying - Underlying symbol (e.g., 'NIFTY', 'BANKNIFTY', 'RELIANCE')
   * @param expiry - Expiry in YYMMMDD format (e.g., '25JAN30', '25JAN')
   * @param strike - Strike price (e.g., 22000, 3000)
   * @param optionType - 'CE' for Call, 'PE' for Put
   * @param exchange - Exchange (default: 'NSE')
   * @returns Formatted symbol (e.g., 'NSE:NIFTY25JAN22000CE')
   */
  static formatOption(
    underlying: string,
    expiry: string,
    strike: number,
    optionType: 'CE' | 'PE',
    exchange: string = 'NSE'
  ): string {
    return `${exchange}:${underlying}${expiry}${strike}${optionType}`;
  }

  /**
   * Format future symbol for Fyers API
   * @param underlying - Underlying symbol (e.g., 'NIFTY', 'BANKNIFTY', 'RELIANCE')
   * @param expiry - Expiry in YYMMMDD format (e.g., '25JAN30', '25JAN')
   * @param exchange - Exchange (default: 'NSE')
   * @returns Formatted symbol (e.g., 'NSE:NIFTY25JANFUT')
   */
  static formatFuture(
    underlying: string,
    expiry: string,
    exchange: string = 'NSE'
  ): string {
    return `${exchange}:${underlying}${expiry}FUT`;
  }

  /**
   * Format equity symbol for Fyers API
   * @param symbol - Stock symbol (e.g., 'RELIANCE', 'TCS')
   * @param exchange - Exchange (default: 'NSE')
   * @returns Formatted symbol (e.g., 'NSE:RELIANCE-EQ')
   */
  static formatEquity(symbol: string, exchange: string = 'NSE'): string {
    return `${exchange}:${symbol}-EQ`;
  }

  /**
   * Parse symbol to extract components
   * Attempts to detect instrument type and extract components
   * @param symbol - Input symbol
   * @returns Symbol components or null if parsing fails
   */
  static parseSymbol(symbol: string): SymbolComponents | null {
    try {
      // Remove exchange prefix if present (e.g., 'NSE:NIFTY25JAN22000CE' -> 'NIFTY25JAN22000CE')
      const cleanSymbol = symbol.includes(':') ? symbol.split(':')[1] : symbol;
      
      if (!cleanSymbol) {
        return null;
      }

      // Check for equity format (ends with -EQ)
      if (cleanSymbol.endsWith('-EQ')) {
        return {
          underlying: cleanSymbol.replace('-EQ', ''),
          expiry: '',
          instrumentType: 'EQUITY'
        };
      }

      // Check for futures format (ends with FUT)
      if (cleanSymbol.endsWith('FUT')) {
        const withoutFut = cleanSymbol.replace('FUT', '');
        const match = withoutFut.match(/^([A-Z]+)(\d{2}[A-Z]{3})$/);
        
        if (match && match[1] && match[2]) {
          return {
            underlying: match[1],
            expiry: match[2],
            instrumentType: 'FUTURE'
          };
        }
      }

      // Check for options format (ends with CE or PE)
      // Pattern: UNDERLYING + EXPIRY + STRIKE + OPTION_TYPE
      // Example: NIFTY25JAN22000CE -> NIFTY + 25JAN + 22000 + CE
      const optionMatch = cleanSymbol.match(/^([A-Z]+)(\d{2}[A-Z]{3})(\d+)(CE|PE)$/);
      if (optionMatch && optionMatch[1] && optionMatch[2] && optionMatch[3] && optionMatch[4]) {
        return {
          underlying: optionMatch[1],
          expiry: optionMatch[2],
          strike: parseInt(optionMatch[3]),
          optionType: optionMatch[4] as 'CE' | 'PE',
          instrumentType: 'OPTION'
        };
      }

      return null;
    } catch (error) {
      console.error('Error parsing symbol:', error);
      return null;
    }
  }

  /**
   * Format symbol based on detected or provided instrument type
   * @param symbol - Input symbol
   * @param exchange - Exchange (default: 'NSE')
   * @param instrumentType - Override instrument type detection
   * @returns Formatted symbol for Fyers API
   */
  static formatSymbol(
    symbol: string,
    exchange: string = 'NSE',
    instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE'
  ): string {
    // If symbol already has exchange prefix, return as-is
    if (symbol.includes(':')) {
      return symbol;
    }

    // Parse symbol to detect components
    const components = this.parseSymbol(symbol);
    
    if (!components) {
      // Fallback: assume equity if parsing fails
      console.warn(`Failed to parse symbol ${symbol}, assuming equity format`);
      return this.formatEquity(symbol, exchange);
    }

    // Use provided instrument type or detected type
    const finalInstrumentType = instrumentType || components.instrumentType;

    switch (finalInstrumentType) {
      case 'OPTION':
        if (!components.strike || !components.optionType) {
          throw new Error(`Invalid option symbol: ${symbol} - missing strike or option type`);
        }
        return this.formatOption(
          components.underlying,
          components.expiry,
          components.strike,
          components.optionType,
          exchange
        );

      case 'FUTURE':
        return this.formatFuture(components.underlying, components.expiry, exchange);

      case 'EQUITY':
      default:
        return this.formatEquity(components.underlying, exchange);
    }
  }

  /**
   * Validate if symbol is properly formatted for Fyers API
   * @param symbol - Symbol to validate
   * @returns true if valid, false otherwise
   */
  static isValidFyersSymbol(symbol: string): boolean {
    // Must have exchange prefix
    if (!symbol.includes(':')) {
      return false;
    }

    const [exchange, tradingSymbol] = symbol.split(':');
    
    // Valid exchanges
    const validExchanges = ['NSE', 'BSE', 'MCX', 'CDS'];
    if (!validExchanges.includes(exchange)) {
      return false;
    }

    if (!tradingSymbol) {
      return false;
    }

    // Check trading symbol format
    if (tradingSymbol.endsWith('-EQ')) {
      // Equity format
      return tradingSymbol.length > 3;
    } else if (tradingSymbol.endsWith('FUT')) {
      // Future format
      const match = tradingSymbol.match(/^[A-Z]+\d{2}[A-Z]{3}FUT$/);
      return !!match;
    } else if (tradingSymbol.endsWith('CE') || tradingSymbol.endsWith('PE')) {
      // Option format
      const match = tradingSymbol.match(/^[A-Z]+\d{2}[A-Z]{3}\d+(CE|PE)$/);
      return !!match;
    }

    return false;
  }

  /**
   * Get exchange from symbol or default
   * @param symbol - Input symbol
   * @param defaultExchange - Default exchange if not found in symbol
   * @returns Exchange code
   */
  static getExchange(symbol: string, defaultExchange: string = 'NSE'): string {
    if (symbol.includes(':')) {
      const exchange = symbol.split(':')[0];
      return exchange || defaultExchange;
    }
    return defaultExchange;
  }

  /**
   * Convert expiry date to Fyers format
   * @param expiryDate - Date in various formats (ISO, DD-MM-YYYY, etc.)
   * @returns Expiry in YYMMMDD format
   */
  static formatExpiryDate(expiryDate: string | Date): string {
    try {
      const date = typeof expiryDate === 'string' ? new Date(expiryDate) : expiryDate;
      
      const year = date.getFullYear().toString().slice(-2); // Last 2 digits
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                         'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = monthNames[date.getMonth()];
      const day = date.getDate().toString().padStart(2, '0');
      
      // For monthly expiry (last Thursday), just return YYMM
      // For weekly expiry, return YYMMMDD
      // This is a simplified approach - in practice, you'd need to determine
      // if it's a monthly or weekly expiry based on the date
      return `${year}${month}${day}`;
    } catch (error) {
      console.error('Error formatting expiry date:', error);
      throw new Error(`Invalid expiry date format: ${expiryDate}`);
    }
  }
}