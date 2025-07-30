/**
 * Shoonya Symbol Formatter
 * Handles proper symbol formatting for Shoonya API
 */

export interface SymbolComponents {
  underlying: string;
  expiry: string;
  strike?: number;
  optionType?: 'CE' | 'PE';
  instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
}

export class ShoonyaSymbolFormatter {
  /**
   * Format option symbol for Shoonya API
   * @param underlying - Underlying symbol (e.g., 'NIFTY', 'BANKNIFTY', 'RELIANCE')
   * @param expiry - Expiry in YYMMMDD format (e.g., '25JAN30', '25JAN')
   * @param strike - Strike price (e.g., 22000, 3000)
   * @param optionType - 'CE' for Call, 'PE' for Put
   * @returns Formatted symbol (e.g., 'NIFTY25JAN22000CE')
   */
  static formatOption(
    underlying: string,
    expiry: string,
    strike: number,
    optionType: 'CE' | 'PE'
  ): string {
    return `${underlying}${expiry}${strike}${optionType}`;
  }

  /**
   * Format future symbol for Shoonya API
   * @param underlying - Underlying symbol (e.g., 'NIFTY', 'BANKNIFTY', 'RELIANCE')
   * @param expiry - Expiry in YYMMMDD format (e.g., '25JAN30', '25JAN')
   * @returns Formatted symbol (e.g., 'NIFTY25JANFUT')
   */
  static formatFuture(underlying: string, expiry: string): string {
    return `${underlying}${expiry}FUT`;
  }

  /**
   * Format equity symbol for Shoonya API
   * @param symbol - Stock symbol (e.g., 'RELIANCE', 'TCS')
   * @returns Formatted symbol (e.g., 'RELIANCE-EQ')
   */
  static formatEquity(symbol: string): string {
    return `${symbol}-EQ`;
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
        
        if (match) {
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
      if (optionMatch) {
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
   * @param exchange - Exchange (used for validation, not in final symbol)
   * @param instrumentType - Override instrument type detection
   * @returns Formatted symbol for Shoonya API
   */
  static formatSymbol(
    symbol: string,
    exchange: string = 'NSE',
    instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE'
  ): string {
    // Remove exchange prefix if present for Shoonya (it doesn't use exchange prefix in trading symbol)
    const cleanSymbol = symbol.includes(':') ? symbol.split(':')[1] : symbol;

    // Parse symbol to detect components
    const components = this.parseSymbol(cleanSymbol);
    
    if (!components) {
      // Fallback: assume equity if parsing fails
      console.warn(`Failed to parse symbol ${cleanSymbol}, assuming equity format`);
      return this.formatEquity(cleanSymbol);
    }

    // Use provided instrument type or detected type
    const finalInstrumentType = instrumentType || components.instrumentType;

    switch (finalInstrumentType) {
      case 'OPTION':
        if (!components.strike || !components.optionType) {
          throw new Error(`Invalid option symbol: ${cleanSymbol} - missing strike or option type`);
        }
        return this.formatOption(
          components.underlying,
          components.expiry,
          components.strike,
          components.optionType
        );

      case 'FUTURE':
        return this.formatFuture(components.underlying, components.expiry);

      case 'EQUITY':
      default:
        return this.formatEquity(components.underlying);
    }
  }

  /**
   * Get exchange code for Shoonya API
   * Maps common exchange names to Shoonya exchange codes
   * @param exchange - Input exchange
   * @param instrumentType - Instrument type for proper exchange mapping
   * @returns Shoonya exchange code
   */
  static getShoonyaExchange(
    exchange: string,
    instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE' = 'EQUITY'
  ): string {
    const exchangeMap: { [key: string]: { [key: string]: string } } = {
      'NSE': {
        'EQUITY': 'NSE',
        'OPTION': 'NFO',
        'FUTURE': 'NFO'
      },
      'BSE': {
        'EQUITY': 'BSE',
        'OPTION': 'BFO',
        'FUTURE': 'BFO'
      },
      'MCX': {
        'EQUITY': 'MCX',
        'OPTION': 'MCX',
        'FUTURE': 'MCX'
      }
    };

    return exchangeMap[exchange]?.[instrumentType] || exchange;
  }

  /**
   * Validate if symbol is properly formatted for Shoonya API
   * @param symbol - Symbol to validate
   * @returns true if valid, false otherwise
   */
  static isValidShoonyaSymbol(symbol: string): boolean {
    // Should not have exchange prefix for Shoonya
    if (symbol.includes(':')) {
      return false;
    }

    // Check trading symbol format
    if (symbol.endsWith('-EQ')) {
      // Equity format
      return symbol.length > 3;
    } else if (symbol.endsWith('FUT')) {
      // Future format
      const match = symbol.match(/^[A-Z]+\d{2}[A-Z]{3}FUT$/);
      return !!match;
    } else if (symbol.endsWith('CE') || symbol.endsWith('PE')) {
      // Option format
      const match = symbol.match(/^[A-Z]+\d{2}[A-Z]{3}\d+(CE|PE)$/);
      return !!match;
    }

    return false;
  }

  /**
   * Convert expiry date to Shoonya format
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

  /**
   * Detect instrument type from symbol
   * @param symbol - Input symbol
   * @returns Detected instrument type
   */
  static detectInstrumentType(symbol: string): 'EQUITY' | 'OPTION' | 'FUTURE' {
    const components = this.parseSymbol(symbol);
    return components?.instrumentType || 'EQUITY';
  }

  /**
   * Format symbol with proper exchange mapping
   * @param symbol - Input symbol
   * @param exchange - Exchange code
   * @param instrumentType - Instrument type (optional, will be detected if not provided)
   * @returns Object with formatted symbol and proper exchange code
   */
  static formatSymbolWithExchange(
    symbol: string,
    exchange: string = 'NSE',
    instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE'
  ): { tradingSymbol: string; exchange: string } {
    const detectedType = instrumentType || this.detectInstrumentType(symbol);
    const formattedSymbol = this.formatSymbol(symbol, exchange, detectedType);
    const shoonyaExchange = this.getShoonyaExchange(exchange, detectedType);

    return {
      tradingSymbol: formattedSymbol,
      exchange: shoonyaExchange
    };
  }
}