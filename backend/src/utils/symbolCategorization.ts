import { CreateStandardizedSymbolData } from '../models/symbolModels';

// Raw symbol data interface for broker feeds
export interface RawSymbolData {
  symbol: string;
  name?: string;
  instrumentType?: string;
  exchange?: string;
  segment?: string;
  expiry?: string;
  strike?: number;
  optionType?: string;
  lotSize?: number;
  tickSize?: number;
  isin?: string;
  underlying?: string;
  [key: string]: any; // Allow additional broker-specific fields
}

// Categorization result interface
export interface CategorizationResult {
  instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE';
  underlying?: string;
  strikePrice?: number;
  optionType?: 'CE' | 'PE';
  expiryDate?: string;
  confidence: number; // 0-1 score indicating confidence in categorization
  warnings: string[];
}

export class SymbolCategorizer {
  /**
   * Detect instrument type from raw symbol data
   */
  static detectInstrumentType(rawData: RawSymbolData): CategorizationResult {
    const warnings: string[] = [];
    let confidence = 1.0;

    // First check if instrument type is explicitly provided
    if (rawData.instrumentType) {
      const normalizedType = this.normalizeInstrumentType(rawData.instrumentType);
      if (normalizedType) {
        return this.analyzeByExplicitType(rawData, normalizedType, warnings);
      }
    }

    // Fallback to symbol pattern analysis
    return this.analyzeBySymbolPattern(rawData, warnings);
  }

  /**
   * Normalize instrument type from various broker formats
   */
  private static normalizeInstrumentType(instrumentType: string): 'EQUITY' | 'OPTION' | 'FUTURE' | null {
    const normalized = instrumentType.toUpperCase().trim();
    
    // Common equity patterns
    if (['EQ', 'EQUITY', 'STOCK', 'SHARE', 'CASH'].includes(normalized)) {
      return 'EQUITY';
    }
    
    // Common option patterns
    if (['OPT', 'OPTION', 'OPTIONS', 'CE', 'PE', 'CALL', 'PUT'].includes(normalized)) {
      return 'OPTION';
    }
    
    // Common future patterns
    if (['FUT', 'FUTURE', 'FUTURES'].includes(normalized)) {
      return 'FUTURE';
    }
    
    return null;
  }

  /**
   * Analyze symbol when instrument type is explicitly provided
   */
  private static analyzeByExplicitType(
    rawData: RawSymbolData, 
    instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE',
    warnings: string[]
  ): CategorizationResult {
    const result: CategorizationResult = {
      instrumentType,
      confidence: 0.9,
      warnings
    };

    switch (instrumentType) {
      case 'EQUITY':
        return this.processEquity(rawData, result);
      case 'OPTION':
        return this.processOption(rawData, result);
      case 'FUTURE':
        return this.processFuture(rawData, result);
    }
  }

  /**
   * Analyze symbol by pattern matching when no explicit type is provided
   */
  private static analyzeBySymbolPattern(rawData: RawSymbolData, warnings: string[]): CategorizationResult {
    const symbol = rawData.symbol.toUpperCase();
    
    // Option patterns (most specific first)
    if (this.isOptionPattern(symbol)) {
      return this.processOption(rawData, {
        instrumentType: 'OPTION',
        confidence: 0.8,
        warnings: [...warnings, 'Instrument type detected from symbol pattern']
      });
    }
    
    // Future patterns
    if (this.isFuturePattern(symbol)) {
      return this.processFuture(rawData, {
        instrumentType: 'FUTURE',
        confidence: 0.8,
        warnings: [...warnings, 'Instrument type detected from symbol pattern']
      });
    }
    
    // Default to equity
    return this.processEquity(rawData, {
      instrumentType: 'EQUITY',
      confidence: 0.7,
      warnings: [...warnings, 'Defaulted to EQUITY - no clear pattern detected']
    });
  }

  /**
   * Check if symbol matches option patterns
   */
  private static isOptionPattern(symbol: string): boolean {
    // Common option patterns:
    // NIFTY25JAN22000CE, BANKNIFTY25FEB45000PE, RELIANCE25MAR2800CE
    const optionPatterns = [
      /\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d+[CP]E$/,
      /\d{4}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d+[CP]E$/,
      /CALL|PUT/i,
      /\d+[CP]E$/
    ];
    
    // Only match CE/PE if it's part of a larger pattern (not just ending with CE/PE)
    if (symbol.endsWith('CE') || symbol.endsWith('PE')) {
      return symbol.length > 2 && /\d/.test(symbol);
    }
    
    return optionPatterns.some(pattern => pattern.test(symbol));
  }

  /**
   * Check if symbol matches future patterns
   */
  private static isFuturePattern(symbol: string): boolean {
    // Common future patterns:
    // NIFTY25JANFUT, BANKNIFTY25FEBFUT, CRUDEOIL25MARFUT
    const futurePatterns = [
      /FUT$/,
      /FUTURE$/,
      /\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/,
      /\d{4}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/
    ];
    
    return futurePatterns.some(pattern => pattern.test(symbol));
  }

  /**
   * Process equity symbol
   */
  private static processEquity(rawData: RawSymbolData, result: CategorizationResult): CategorizationResult {
    // Equity symbols should not have derivative-specific fields
    if (rawData.expiry || rawData.strike || rawData.optionType) {
      result.warnings.push('Equity symbol has derivative fields - may be misclassified');
      result.confidence *= 0.8;
    }
    
    return result;
  }

  /**
   * Process option symbol
   */
  private static processOption(rawData: RawSymbolData, result: CategorizationResult): CategorizationResult {
    // Extract underlying symbol
    const underlying = this.extractUnderlyingSymbol(rawData);
    if (underlying) result.underlying = underlying;
    
    // Extract strike price
    const strikePrice = this.extractStrikePrice(rawData);
    if (strikePrice) result.strikePrice = strikePrice;
    
    // Extract option type
    const optionType = this.extractOptionType(rawData);
    if (optionType) result.optionType = optionType;
    
    // Extract expiry date
    const expiryDate = this.extractExpiryDate(rawData);
    if (expiryDate) result.expiryDate = expiryDate;
    
    // Validate required option fields
    if (!underlying) {
      result.warnings.push('Could not extract underlying symbol');
      result.confidence *= 0.7;
    }
    
    if (!strikePrice) {
      result.warnings.push('Could not extract strike price');
      result.confidence *= 0.7;
    }
    
    if (!optionType) {
      result.warnings.push('Could not extract option type');
      result.confidence *= 0.7;
    }
    
    if (!expiryDate) {
      result.warnings.push('Could not extract expiry date');
      result.confidence *= 0.7;
    }
    
    return result;
  }

  /**
   * Process future symbol
   */
  private static processFuture(rawData: RawSymbolData, result: CategorizationResult): CategorizationResult {
    // Extract underlying symbol
    const underlying = this.extractUnderlyingSymbol(rawData);
    if (underlying) result.underlying = underlying;
    
    // Extract expiry date
    const expiryDate = this.extractExpiryDate(rawData);
    if (expiryDate) result.expiryDate = expiryDate;
    
    // Validate required future fields
    if (!underlying) {
      result.warnings.push('Could not extract underlying symbol');
      result.confidence *= 0.7;
    }
    
    if (!expiryDate) {
      result.warnings.push('Could not extract expiry date');
      result.confidence *= 0.7;
    }
    
    // Futures should not have strike price or option type
    if (rawData.strike || rawData.optionType) {
      result.warnings.push('Future symbol has option-specific fields');
      result.confidence *= 0.8;
    }
    
    return result;
  }

  /**
   * Extract underlying symbol from raw data
   */
  static extractUnderlyingSymbol(rawData: RawSymbolData): string | undefined {
    // First check if explicitly provided
    if (rawData.underlying) {
      return rawData.underlying.toUpperCase();
    }
    
    // Extract from symbol pattern
    const symbol = rawData.symbol.toUpperCase();
    
    // Common patterns for derivatives
    const patterns = [
      // NIFTY25JAN22000CE -> NIFTY
      /^([A-Z]+)\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/,
      // BANKNIFTY25FEBFUT -> BANKNIFTY
      /^([A-Z]+)\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)FUT$/,
      // RELIANCE-EQ -> RELIANCE (remove suffix)
      /^([A-Z]+)-/,
      // General pattern: extract alphabetic prefix
      /^([A-Z]+)/
    ];
    
    for (const pattern of patterns) {
      const match = symbol.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return undefined;
  }

  /**
   * Extract strike price from raw data
   */
  static extractStrikePrice(rawData: RawSymbolData): number | undefined {
    // First check if explicitly provided
    if (rawData.strike && typeof rawData.strike === 'number') {
      return rawData.strike;
    }
    
    // Extract from symbol pattern
    const symbol = rawData.symbol.toUpperCase();
    
    // Common option patterns with strike prices
    const patterns = [
      // NIFTY25JAN22000CE -> 22000
      /\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d+)[CP]E$/,
      // Alternative pattern
      /(\d+)[CP]E$/
    ];
    
    for (const pattern of patterns) {
      const match = symbol.match(pattern);
      if (match && match[2]) {
        const strike = parseInt(match[2], 10);
        if (!isNaN(strike) && strike > 0) {
          return strike;
        }
      }
    }
    
    return undefined;
  }

  /**
   * Extract option type from raw data
   */
  static extractOptionType(rawData: RawSymbolData): 'CE' | 'PE' | undefined {
    // First check if explicitly provided
    if (rawData.optionType) {
      const normalized = rawData.optionType.toUpperCase();
      if (normalized === 'CE' || normalized === 'CALL') return 'CE';
      if (normalized === 'PE' || normalized === 'PUT') return 'PE';
    }
    
    // Extract from symbol pattern
    const symbol = rawData.symbol.toUpperCase();
    
    if (symbol.endsWith('CE') || symbol.includes('CALL')) {
      return 'CE';
    }
    
    if (symbol.endsWith('PE') || symbol.includes('PUT')) {
      return 'PE';
    }
    
    return undefined;
  }

  /**
   * Extract and parse expiry date from raw data
   */
  static extractExpiryDate(rawData: RawSymbolData): string | undefined {
    // First check if explicitly provided
    if (rawData.expiry) {
      return this.parseExpiryDate(rawData.expiry);
    }
    
    // Extract from symbol pattern
    const symbol = rawData.symbol.toUpperCase();
    
    // Common patterns for expiry in symbols
    const patterns = [
      // NIFTY25JAN22000CE -> 25JAN
      /(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/,
      // NIFTY2025JAN22000CE -> 2025JAN
      /(\d{4})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)/
    ];
    
    for (const pattern of patterns) {
      const match = symbol.match(pattern);
      if (match && match[1] && match[2]) {
        const year = match[1].length === 2 ? `20${match[1]}` : match[1];
        const month = match[2];
        return this.parseExpiryDate(`${year}${month}`);
      }
    }
    
    return undefined;
  }

  /**
   * Parse expiry date from various formats to ISO format
   */
  static parseExpiryDate(expiryStr: string): string | undefined {
    if (!expiryStr) return undefined;
    
    const expiry = expiryStr.toUpperCase().trim();
    
    // Month mapping
    const monthMap: { [key: string]: string } = {
      'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
      'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
      'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
    };
    
    // Try different patterns
    const patterns = [
      // 2025JAN -> 2025-01-30 (assume last Thursday of month)
      /^(\d{4})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/,
      // 25JAN -> 2025-01-30
      /^(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/,
      // 2025-01-30 (already ISO format)
      /^(\d{4})-(\d{2})-(\d{2})$/,
      // 30-01-2025 (DD-MM-YYYY)
      /^(\d{2})-(\d{2})-(\d{4})$/,
      // 01/30/2025 (MM/DD/YYYY)
      /^(\d{2})\/(\d{2})\/(\d{4})$/
    ];
    
    // Pattern 1 & 2: Year + Month
    const yearMonthMatch = expiry.match(/^(\d{2,4})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/);
    if (yearMonthMatch && yearMonthMatch[1] && yearMonthMatch[2]) {
      let year = yearMonthMatch[1];
      const month = yearMonthMatch[2];
      
      if (year.length === 2) {
        year = `20${year}`;
      }
      
      const monthNum = monthMap[month];
      if (monthNum) {
        // Get last Thursday of the month (common expiry pattern)
        const lastThursday = this.getLastThursday(parseInt(year), parseInt(monthNum));
        return `${year}-${monthNum}-${lastThursday.toString().padStart(2, '0')}`;
      }
    }
    
    // Pattern 3: Already ISO format
    const isoMatch = expiry.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return expiry.toLowerCase();
    }
    
    // Pattern 4: DD-MM-YYYY
    const ddmmyyyyMatch = expiry.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyyMatch) {
      return `${ddmmyyyyMatch[3]}-${ddmmyyyyMatch[2]}-${ddmmyyyyMatch[1]}`;
    }
    
    // Pattern 5: MM/DD/YYYY
    const mmddyyyyMatch = expiry.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (mmddyyyyMatch) {
      return `${mmddyyyyMatch[3]}-${mmddyyyyMatch[1]}-${mmddyyyyMatch[2]}`;
    }
    
    return undefined;
  }

  /**
   * Get the last Thursday of a given month (common expiry day for derivatives)
   */
  private static getLastThursday(year: number, month: number): number {
    // Get the last day of the month
    const lastDay = new Date(year, month, 0).getDate();
    
    // Find the last Thursday
    for (let day = lastDay; day >= 1; day--) {
      const date = new Date(year, month - 1, day);
      if (date.getDay() === 4) { // Thursday is day 4
        return day;
      }
    }
    
    // Fallback to last day if no Thursday found (shouldn't happen)
    return lastDay;
  }

  /**
   * Convert categorization result to standardized symbol data
   */
  static toStandardizedSymbol(
    rawData: RawSymbolData, 
    categorization: CategorizationResult,
    source: string = 'auto-categorized'
  ): Partial<CreateStandardizedSymbolData> {
    const standardized: Partial<CreateStandardizedSymbolData> = {
      tradingSymbol: rawData.symbol.toUpperCase(),
      instrumentType: categorization.instrumentType,
      exchange: this.normalizeExchange(rawData.exchange),
      segment: rawData.segment || this.getDefaultSegment(categorization.instrumentType),
      lotSize: rawData.lotSize || this.getDefaultLotSize(categorization.instrumentType),
      tickSize: rawData.tickSize || 0.05,
      source,
      underlying: categorization.underlying,
      strikePrice: categorization.strikePrice,
      optionType: categorization.optionType,
      expiryDate: categorization.expiryDate,
      isin: rawData.isin
    };

    // Generate display name
    standardized.displayName = this.generateDisplayName(standardized as CreateStandardizedSymbolData);

    return standardized;
  }

  /**
   * Normalize exchange names
   */
  private static normalizeExchange(exchange?: string): 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX' {
    if (!exchange) return 'NSE'; // Default
    
    const normalized = exchange.toUpperCase();
    
    if (['NSE', 'NATIONAL STOCK EXCHANGE'].includes(normalized)) return 'NSE';
    if (['BSE', 'BOMBAY STOCK EXCHANGE'].includes(normalized)) return 'BSE';
    if (['NFO', 'NSE_FO', 'NSE-FO'].includes(normalized)) return 'NFO';
    if (['BFO', 'BSE_FO', 'BSE-FO'].includes(normalized)) return 'BFO';
    if (['MCX', 'MULTI COMMODITY EXCHANGE'].includes(normalized)) return 'MCX';
    
    return 'NSE'; // Default fallback
  }

  /**
   * Get default segment based on instrument type
   */
  private static getDefaultSegment(instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE'): string {
    switch (instrumentType) {
      case 'EQUITY': return 'EQ';
      case 'OPTION':
      case 'FUTURE': return 'FO';
      default: return 'EQ';
    }
  }

  /**
   * Get default lot size based on instrument type
   */
  private static getDefaultLotSize(instrumentType: 'EQUITY' | 'OPTION' | 'FUTURE'): number {
    switch (instrumentType) {
      case 'EQUITY': return 1;
      case 'OPTION':
      case 'FUTURE': return 25; // Common lot size for index derivatives
      default: return 1;
    }
  }

  /**
   * Generate display name for the symbol
   */
  private static generateDisplayName(symbol: CreateStandardizedSymbolData): string {
    switch (symbol.instrumentType) {
      case 'EQUITY':
        return symbol.tradingSymbol;
      
      case 'OPTION':
        if (symbol.underlying && symbol.strikePrice && symbol.optionType && symbol.expiryDate) {
          const formattedDate = new Date(symbol.expiryDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
          }).toUpperCase();
          return `${symbol.underlying} ${symbol.strikePrice} ${symbol.optionType} ${formattedDate}`;
        }
        return symbol.tradingSymbol;
      
      case 'FUTURE':
        if (symbol.underlying && symbol.expiryDate) {
          const formattedDate = new Date(symbol.expiryDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: '2-digit'
          }).toUpperCase();
          return `${symbol.underlying} ${formattedDate} FUT`;
        }
        return symbol.tradingSymbol;
      
      default:
        return symbol.tradingSymbol;
    }
  }
}