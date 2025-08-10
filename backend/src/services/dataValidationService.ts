import { logger } from '../utils/logger';
import { CreateStandardizedSymbolData, StandardizedSymbol } from '../models/symbolModels';
import { symbolDatabaseService } from './symbolDatabaseService';

// Validation rule interface
export interface ValidationRule {
  name: string;
  description: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  validate: (symbol: CreateStandardizedSymbolData) => ValidationIssue[];
}

// Validation issue interface
export interface ValidationIssue {
  rule: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  field?: string;
  value?: any;
  suggestion?: string;
}

// Quality metrics interface
export interface QualityMetrics {
  totalSymbols: number;
  validSymbols: number;
  invalidSymbols: number;
  warningSymbols: number;
  duplicateSymbols: number;
  missingRequiredFields: number;
  dataConsistencyIssues: number;
  qualityScore: number; // 0-100
  issuesByRule: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  instrumentTypeDistribution: Record<string, number>;
  exchangeDistribution: Record<string, number>;
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  qualityMetrics: QualityMetrics;
  validSymbols: CreateStandardizedSymbolData[];
  invalidSymbols: CreateStandardizedSymbolData[];
  warningSymbols: CreateStandardizedSymbolData[];
  allIssues: ValidationIssue[];
  symbolIssues: Map<string, ValidationIssue[]>;
  duplicates: DuplicateGroup[];
  processingTime: number;
}

// Duplicate group interface
export interface DuplicateGroup {
  key: string;
  symbols: CreateStandardizedSymbolData[];
  count: number;
}

// Data consistency check result
export interface ConsistencyCheckResult {
  checkName: string;
  passed: boolean;
  message: string;
  affectedSymbols: number;
  details?: any;
}

/**
 * Data Validation and Quality Control Service
 * Provides comprehensive validation rules and quality metrics for symbol data
 */
export class DataValidationService {
  private readonly validationRules: Map<string, ValidationRule> = new Map();

  constructor() {
    this.initializeValidationRules();
  }

  /**
   * Initialize validation rules
   */
  private initializeValidationRules(): void {
    // Required field validations
    this.addValidationRule({
      name: 'required_display_name',
      description: 'Display name must be present and non-empty',
      severity: 'ERROR',
      validate: (symbol) => {
        if (!symbol.displayName?.trim()) {
          return [{
            rule: 'required_display_name',
            severity: 'ERROR',
            message: 'Display name is required',
            field: 'displayName',
            value: symbol.displayName,
            suggestion: 'Provide a meaningful display name for the symbol'
          }];
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'required_trading_symbol',
      description: 'Trading symbol must be present and non-empty',
      severity: 'ERROR',
      validate: (symbol) => {
        if (!symbol.tradingSymbol?.trim()) {
          return [{
            rule: 'required_trading_symbol',
            severity: 'ERROR',
            message: 'Trading symbol is required',
            field: 'tradingSymbol',
            value: symbol.tradingSymbol,
            suggestion: 'Provide a valid trading symbol'
          }];
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'required_instrument_type',
      description: 'Instrument type must be valid',
      severity: 'ERROR',
      validate: (symbol) => {
        const validTypes = ['EQUITY', 'OPTION', 'FUTURE'];
        if (!symbol.instrumentType || !validTypes.includes(symbol.instrumentType)) {
          return [{
            rule: 'required_instrument_type',
            severity: 'ERROR',
            message: 'Invalid instrument type',
            field: 'instrumentType',
            value: symbol.instrumentType,
            suggestion: `Must be one of: ${validTypes.join(', ')}`
          }];
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'required_exchange',
      description: 'Exchange must be valid',
      severity: 'ERROR',
      validate: (symbol) => {
        const validExchanges = ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'];
        if (!symbol.exchange || !validExchanges.includes(symbol.exchange)) {
          return [{
            rule: 'required_exchange',
            severity: 'ERROR',
            message: 'Invalid exchange',
            field: 'exchange',
            value: symbol.exchange,
            suggestion: `Must be one of: ${validExchanges.join(', ')}`
          }];
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'required_segment',
      description: 'Segment must be present',
      severity: 'ERROR',
      validate: (symbol) => {
        if (!symbol.segment?.trim()) {
          return [{
            rule: 'required_segment',
            severity: 'ERROR',
            message: 'Segment is required',
            field: 'segment',
            value: symbol.segment,
            suggestion: 'Provide a valid segment (e.g., EQ, FO, CD)'
          }];
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'required_source',
      description: 'Source must be present',
      severity: 'ERROR',
      validate: (symbol) => {
        if (!symbol.source?.trim()) {
          return [{
            rule: 'required_source',
            severity: 'ERROR',
            message: 'Source is required',
            field: 'source',
            value: symbol.source,
            suggestion: 'Specify the data source (e.g., upstox, manual)'
          }];
        }
        return [];
      }
    });

    // Numeric validations
    this.addValidationRule({
      name: 'positive_lot_size',
      description: 'Lot size must be positive',
      severity: 'ERROR',
      validate: (symbol) => {
        if (symbol.lotSize <= 0) {
          return [{
            rule: 'positive_lot_size',
            severity: 'ERROR',
            message: 'Lot size must be positive',
            field: 'lotSize',
            value: symbol.lotSize,
            suggestion: 'Provide a positive lot size (typically 1 or more)'
          }];
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'positive_tick_size',
      description: 'Tick size must be positive',
      severity: 'ERROR',
      validate: (symbol) => {
        if (symbol.tickSize <= 0) {
          return [{
            rule: 'positive_tick_size',
            severity: 'ERROR',
            message: 'Tick size must be positive',
            field: 'tickSize',
            value: symbol.tickSize,
            suggestion: 'Provide a positive tick size (typically 0.05 or 0.01)'
          }];
        }
        return [];
      }
    });

    // Options-specific validations
    this.addValidationRule({
      name: 'option_underlying_required',
      description: 'Options must have underlying symbol',
      severity: 'ERROR',
      validate: (symbol) => {
        if (symbol.instrumentType === 'OPTION' && !symbol.underlying?.trim()) {
          return [{
            rule: 'option_underlying_required',
            severity: 'ERROR',
            message: 'Underlying symbol is required for options',
            field: 'underlying',
            value: symbol.underlying,
            suggestion: 'Provide the underlying symbol (e.g., NIFTY, BANKNIFTY)'
          }];
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'option_strike_price_required',
      description: 'Options must have valid strike price',
      severity: 'ERROR',
      validate: (symbol) => {
        if (symbol.instrumentType === 'OPTION' && (!symbol.strikePrice || symbol.strikePrice <= 0)) {
          return [{
            rule: 'option_strike_price_required',
            severity: 'ERROR',
            message: 'Valid strike price is required for options',
            field: 'strikePrice',
            value: symbol.strikePrice,
            suggestion: 'Provide a positive strike price'
          }];
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'option_type_required',
      description: 'Options must have valid option type',
      severity: 'ERROR',
      validate: (symbol) => {
        if (symbol.instrumentType === 'OPTION' && (!symbol.optionType || !['CE', 'PE'].includes(symbol.optionType))) {
          return [{
            rule: 'option_type_required',
            severity: 'ERROR',
            message: 'Valid option type is required for options',
            field: 'optionType',
            value: symbol.optionType,
            suggestion: 'Must be either CE (Call) or PE (Put)'
          }];
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'option_expiry_required',
      description: 'Options must have expiry date',
      severity: 'ERROR',
      validate: (symbol) => {
        if (symbol.instrumentType === 'OPTION' && !symbol.expiryDate) {
          return [{
            rule: 'option_expiry_required',
            severity: 'ERROR',
            message: 'Expiry date is required for options',
            field: 'expiryDate',
            value: symbol.expiryDate,
            suggestion: 'Provide expiry date in YYYY-MM-DD format'
          }];
        }
        return [];
      }
    });

    // Futures-specific validations
    this.addValidationRule({
      name: 'future_underlying_required',
      description: 'Futures must have underlying symbol',
      severity: 'ERROR',
      validate: (symbol) => {
        if (symbol.instrumentType === 'FUTURE' && !symbol.underlying?.trim()) {
          return [{
            rule: 'future_underlying_required',
            severity: 'ERROR',
            message: 'Underlying symbol is required for futures',
            field: 'underlying',
            value: symbol.underlying,
            suggestion: 'Provide the underlying symbol'
          }];
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'future_expiry_required',
      description: 'Futures must have expiry date',
      severity: 'ERROR',
      validate: (symbol) => {
        if (symbol.instrumentType === 'FUTURE' && !symbol.expiryDate) {
          return [{
            rule: 'future_expiry_required',
            severity: 'ERROR',
            message: 'Expiry date is required for futures',
            field: 'expiryDate',
            value: symbol.expiryDate,
            suggestion: 'Provide expiry date in YYYY-MM-DD format'
          }];
        }
        return [];
      }
    });

    // Date validations
    this.addValidationRule({
      name: 'valid_expiry_date',
      description: 'Expiry date must be valid and in future',
      severity: 'ERROR',
      validate: (symbol) => {
        if (symbol.expiryDate) {
          const expiryDate = new Date(symbol.expiryDate);
          if (isNaN(expiryDate.getTime())) {
            return [{
              rule: 'valid_expiry_date',
              severity: 'ERROR',
              message: 'Invalid expiry date format',
              field: 'expiryDate',
              value: symbol.expiryDate,
              suggestion: 'Use YYYY-MM-DD format'
            }];
          }
          
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (expiryDate < today) {
            return [{
              rule: 'valid_expiry_date',
              severity: 'WARNING',
              message: 'Expiry date is in the past',
              field: 'expiryDate',
              value: symbol.expiryDate,
              suggestion: 'Verify if this is an expired instrument'
            }];
          }
        }
        return [];
      }
    });

    // Exchange consistency validations
    this.addValidationRule({
      name: 'exchange_instrument_consistency',
      description: 'Exchange should be consistent with instrument type',
      severity: 'WARNING',
      validate: (symbol) => {
        const issues: ValidationIssue[] = [];
        
        if (symbol.instrumentType === 'EQUITY' && !['NSE', 'BSE'].includes(symbol.exchange)) {
          issues.push({
            rule: 'exchange_instrument_consistency',
            severity: 'WARNING',
            message: 'Equity instruments typically trade on NSE or BSE',
            field: 'exchange',
            value: symbol.exchange,
            suggestion: 'Verify if exchange is correct for equity instrument'
          });
        }
        
        if (['OPTION', 'FUTURE'].includes(symbol.instrumentType) && !['NFO', 'BFO', 'MCX'].includes(symbol.exchange)) {
          issues.push({
            rule: 'exchange_instrument_consistency',
            severity: 'WARNING',
            message: 'Derivatives typically trade on NFO, BFO, or MCX',
            field: 'exchange',
            value: symbol.exchange,
            suggestion: 'Verify if exchange is correct for derivative instrument'
          });
        }
        
        return issues;
      }
    });

    // Data quality validations
    this.addValidationRule({
      name: 'reasonable_strike_price',
      description: 'Strike price should be reasonable',
      severity: 'WARNING',
      validate: (symbol) => {
        if (symbol.instrumentType === 'OPTION' && symbol.strikePrice) {
          if (symbol.strikePrice > 100000) {
            return [{
              rule: 'reasonable_strike_price',
              severity: 'WARNING',
              message: 'Strike price seems unusually high',
              field: 'strikePrice',
              value: symbol.strikePrice,
              suggestion: 'Verify if strike price is correct'
            }];
          }
          
          if (symbol.strikePrice < 1) {
            return [{
              rule: 'reasonable_strike_price',
              severity: 'WARNING',
              message: 'Strike price seems unusually low',
              field: 'strikePrice',
              value: symbol.strikePrice,
              suggestion: 'Verify if strike price is correct'
            }];
          }
        }
        return [];
      }
    });

    this.addValidationRule({
      name: 'reasonable_lot_size',
      description: 'Lot size should be reasonable',
      severity: 'WARNING',
      validate: (symbol) => {
        if (symbol.lotSize > 10000) {
          return [{
            rule: 'reasonable_lot_size',
            severity: 'WARNING',
            message: 'Lot size seems unusually high',
            field: 'lotSize',
            value: symbol.lotSize,
            suggestion: 'Verify if lot size is correct'
          }];
        }
        return [];
      }
    });

    // ISIN validation
    this.addValidationRule({
      name: 'valid_isin_format',
      description: 'ISIN should follow standard format',
      severity: 'WARNING',
      validate: (symbol) => {
        if (symbol.isin && symbol.isin.trim()) {
          const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
          if (!isinRegex.test(symbol.isin)) {
            return [{
              rule: 'valid_isin_format',
              severity: 'WARNING',
              message: 'ISIN format appears invalid',
              field: 'isin',
              value: symbol.isin,
              suggestion: 'ISIN should be 12 characters: 2 country code + 9 alphanumeric + 1 check digit'
            }];
          }
        }
        return [];
      }
    });

    logger.info('Initialized validation rules', {
      component: 'DATA_VALIDATION_SERVICE',
      operation: 'INITIALIZE_VALIDATION_RULES',
      ruleCount: this.validationRules.size
    });
  }

  /**
   * Add a validation rule
   */
  addValidationRule(rule: ValidationRule): void {
    this.validationRules.set(rule.name, rule);
    logger.debug('Added validation rule', {
      component: 'DATA_VALIDATION_SERVICE',
      operation: 'ADD_VALIDATION_RULE',
      ruleName: rule.name,
      severity: rule.severity
    });
  }

  /**
   * Remove a validation rule
   */
  removeValidationRule(ruleName: string): boolean {
    const removed = this.validationRules.delete(ruleName);
    if (removed) {
      logger.debug('Removed validation rule', {
        component: 'DATA_VALIDATION_SERVICE',
        operation: 'REMOVE_VALIDATION_RULE',
        ruleName
      });
    }
    return removed;
  }

  /**
   * Get all validation rules
   */
  getValidationRules(): ValidationRule[] {
    return Array.from(this.validationRules.values());
  }

  /**
   * Validate symbols with comprehensive quality control
   */
  async validateSymbols(symbols: CreateStandardizedSymbolData[]): Promise<ValidationResult> {
    const startTime = Date.now();
    
    logger.info('Starting symbol validation', {
      component: 'DATA_VALIDATION_SERVICE',
      operation: 'VALIDATE_SYMBOLS',
      symbolCount: symbols.length
    });

    const validSymbols: CreateStandardizedSymbolData[] = [];
    const invalidSymbols: CreateStandardizedSymbolData[] = [];
    const warningSymbols: CreateStandardizedSymbolData[] = [];
    const allIssues: ValidationIssue[] = [];
    const symbolIssues = new Map<string, ValidationIssue[]>();
    
    // Validate each symbol
    for (const symbol of symbols) {
      const issues = this.validateSingleSymbol(symbol);
      
      if (issues.length > 0) {
        symbolIssues.set(symbol.tradingSymbol, issues);
        allIssues.push(...issues);
        
        const hasErrors = issues.some(issue => issue.severity === 'ERROR');
        const hasWarnings = issues.some(issue => issue.severity === 'WARNING');
        
        if (hasErrors) {
          invalidSymbols.push(symbol);
        } else if (hasWarnings) {
          warningSymbols.push(symbol);
          validSymbols.push(symbol); // Warnings don't make symbol invalid
        } else {
          validSymbols.push(symbol);
        }
      } else {
        validSymbols.push(symbol);
      }
    }

    // Detect duplicates
    const duplicates = this.detectDuplicates(symbols);

    // Perform consistency checks
    const consistencyResults = await this.performConsistencyChecks(symbols);

    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(
      symbols,
      validSymbols,
      invalidSymbols,
      warningSymbols,
      duplicates,
      allIssues
    );

    const processingTime = Date.now() - startTime;

    const result: ValidationResult = {
      isValid: invalidSymbols.length === 0,
      qualityMetrics,
      validSymbols,
      invalidSymbols,
      warningSymbols,
      allIssues,
      symbolIssues,
      duplicates,
      processingTime
    };

    logger.info('Symbol validation completed', {
      component: 'DATA_VALIDATION_SERVICE',
      operation: 'VALIDATE_SYMBOLS_COMPLETE',
      totalSymbols: symbols.length,
      validSymbols: validSymbols.length,
      invalidSymbols: invalidSymbols.length,
      warningSymbols: warningSymbols.length,
      duplicates: duplicates.length,
      qualityScore: qualityMetrics.qualityScore,
      processingTime
    });

    return result;
  }

  /**
   * Validate a single symbol
   */
  private validateSingleSymbol(symbol: CreateStandardizedSymbolData): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const rule of this.validationRules.values()) {
      try {
        const ruleIssues = rule.validate(symbol);
        issues.push(...ruleIssues);
      } catch (error: any) {
        logger.warn('Validation rule failed', {
          component: 'DATA_VALIDATION_SERVICE',
          operation: 'VALIDATE_SINGLE_SYMBOL',
          ruleName: rule.name,
          symbol: symbol.tradingSymbol
        }, error);
        
        issues.push({
          rule: rule.name,
          severity: 'ERROR',
          message: `Validation rule failed: ${error.message}`,
          suggestion: 'Check validation rule implementation'
        });
      }
    }

    return issues;
  }

  /**
   * Detect duplicate symbols
   */
  private detectDuplicates(symbols: CreateStandardizedSymbolData[]): DuplicateGroup[] {
    const duplicateMap = new Map<string, CreateStandardizedSymbolData[]>();

    for (const symbol of symbols) {
      // Create unique key based on trading symbol, exchange, expiry, strike, and option type
      const key = this.createSymbolKey(symbol);
      
      if (!duplicateMap.has(key)) {
        duplicateMap.set(key, []);
      }
      duplicateMap.get(key)!.push(symbol);
    }

    // Filter out non-duplicates
    const duplicates: DuplicateGroup[] = [];
    for (const [key, symbolGroup] of duplicateMap.entries()) {
      if (symbolGroup.length > 1) {
        duplicates.push({
          key,
          symbols: symbolGroup,
          count: symbolGroup.length
        });
      }
    }

    return duplicates;
  }

  /**
   * Create unique key for symbol
   */
  private createSymbolKey(symbol: CreateStandardizedSymbolData): string {
    const parts = [
      symbol.tradingSymbol,
      symbol.exchange,
      symbol.expiryDate || '',
      symbol.strikePrice?.toString() || '',
      symbol.optionType || ''
    ];
    return parts.join('|');
  }

  /**
   * Perform data consistency checks
   */
  private async performConsistencyChecks(symbols: CreateStandardizedSymbolData[]): Promise<ConsistencyCheckResult[]> {
    const results: ConsistencyCheckResult[] = [];

    try {
      // Check 1: Verify exchange-instrument type consistency
      const exchangeInconsistencies = symbols.filter(symbol => {
        if (symbol.instrumentType === 'EQUITY' && !['NSE', 'BSE'].includes(symbol.exchange)) {
          return true;
        }
        if (['OPTION', 'FUTURE'].includes(symbol.instrumentType) && !['NFO', 'BFO', 'MCX'].includes(symbol.exchange)) {
          return true;
        }
        return false;
      });

      results.push({
        checkName: 'exchange_instrument_consistency',
        passed: exchangeInconsistencies.length === 0,
        message: exchangeInconsistencies.length === 0 
          ? 'All symbols have consistent exchange-instrument type mapping'
          : `${exchangeInconsistencies.length} symbols have inconsistent exchange-instrument type mapping`,
        affectedSymbols: exchangeInconsistencies.length,
        details: exchangeInconsistencies.slice(0, 10) // Limit details
      });

      // Check 2: Verify expiry date consistency for derivatives
      const derivativeSymbols = symbols.filter(s => ['OPTION', 'FUTURE'].includes(s.instrumentType));
      const expiryInconsistencies = derivativeSymbols.filter(symbol => !symbol.expiryDate);

      results.push({
        checkName: 'derivative_expiry_consistency',
        passed: expiryInconsistencies.length === 0,
        message: expiryInconsistencies.length === 0
          ? 'All derivative symbols have expiry dates'
          : `${expiryInconsistencies.length} derivative symbols missing expiry dates`,
        affectedSymbols: expiryInconsistencies.length,
        details: expiryInconsistencies.slice(0, 10)
      });

      // Check 3: Verify option-specific fields
      const optionSymbols = symbols.filter(s => s.instrumentType === 'OPTION');
      const optionInconsistencies = optionSymbols.filter(symbol => 
        !symbol.underlying || !symbol.strikePrice || !symbol.optionType
      );

      results.push({
        checkName: 'option_fields_consistency',
        passed: optionInconsistencies.length === 0,
        message: optionInconsistencies.length === 0
          ? 'All option symbols have required fields'
          : `${optionInconsistencies.length} option symbols missing required fields`,
        affectedSymbols: optionInconsistencies.length,
        details: optionInconsistencies.slice(0, 10)
      });

      // Check 4: Verify reasonable value ranges
      const unreasonableValues = symbols.filter(symbol => 
        symbol.lotSize > 10000 || 
        symbol.tickSize > 100 ||
        (symbol.strikePrice && symbol.strikePrice > 100000)
      );

      results.push({
        checkName: 'reasonable_value_ranges',
        passed: unreasonableValues.length === 0,
        message: unreasonableValues.length === 0
          ? 'All symbols have reasonable value ranges'
          : `${unreasonableValues.length} symbols have potentially unreasonable values`,
        affectedSymbols: unreasonableValues.length,
        details: unreasonableValues.slice(0, 10)
      });

    } catch (error: any) {
      logger.error('Error performing consistency checks', {
        component: 'DATA_VALIDATION_SERVICE',
        operation: 'PERFORM_CONSISTENCY_CHECKS'
      }, error);
    }

    return results;
  }

  /**
   * Calculate quality metrics
   */
  private calculateQualityMetrics(
    totalSymbols: CreateStandardizedSymbolData[],
    validSymbols: CreateStandardizedSymbolData[],
    invalidSymbols: CreateStandardizedSymbolData[],
    warningSymbols: CreateStandardizedSymbolData[],
    duplicates: DuplicateGroup[],
    allIssues: ValidationIssue[]
  ): QualityMetrics {
    // Count issues by rule
    const issuesByRule: Record<string, number> = {};
    const issuesBySeverity: Record<string, number> = { ERROR: 0, WARNING: 0, INFO: 0 };

    for (const issue of allIssues) {
      issuesByRule[issue.rule] = (issuesByRule[issue.rule] || 0) + 1;
      issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
    }

    // Count instrument type distribution
    const instrumentTypeDistribution: Record<string, number> = {};
    for (const symbol of totalSymbols) {
      instrumentTypeDistribution[symbol.instrumentType] = 
        (instrumentTypeDistribution[symbol.instrumentType] || 0) + 1;
    }

    // Count exchange distribution
    const exchangeDistribution: Record<string, number> = {};
    for (const symbol of totalSymbols) {
      exchangeDistribution[symbol.exchange] = 
        (exchangeDistribution[symbol.exchange] || 0) + 1;
    }

    // Calculate quality score (0-100)
    const totalCount = totalSymbols.length;
    const validCount = validSymbols.length;
    const errorCount = issuesBySeverity.ERROR || 0;
    const warningCount = issuesBySeverity.WARNING || 0;
    const duplicateCount = duplicates.reduce((sum, group) => sum + group.count - 1, 0);

    let qualityScore = 100;
    if (totalCount > 0) {
      // Deduct points for errors (more severe)
      qualityScore -= (errorCount / totalCount) * 50;
      // Deduct points for warnings (less severe)
      qualityScore -= (warningCount / totalCount) * 20;
      // Deduct points for duplicates
      qualityScore -= (duplicateCount / totalCount) * 15;
    }

    qualityScore = Math.max(0, Math.round(qualityScore));

    return {
      totalSymbols: totalCount,
      validSymbols: validCount,
      invalidSymbols: invalidSymbols.length,
      warningSymbols: warningSymbols.length,
      duplicateSymbols: duplicateCount,
      missingRequiredFields: (issuesByRule['required_display_name'] || 0) +
                            (issuesByRule['required_trading_symbol'] || 0) +
                            (issuesByRule['required_instrument_type'] || 0),
      dataConsistencyIssues: issuesByRule['exchange_instrument_consistency'] || 0,
      qualityScore,
      issuesByRule,
      issuesBySeverity,
      instrumentTypeDistribution,
      exchangeDistribution
    };
  }

  /**
   * Generate quality report
   */
  generateQualityReport(result: ValidationResult): string {
    const { qualityMetrics, duplicates, allIssues } = result;
    
    let report = '# Data Quality Report\n\n';
    
    // Summary
    report += '## Summary\n';
    report += `- **Total Symbols**: ${qualityMetrics.totalSymbols}\n`;
    report += `- **Valid Symbols**: ${qualityMetrics.validSymbols}\n`;
    report += `- **Invalid Symbols**: ${qualityMetrics.invalidSymbols}\n`;
    report += `- **Warning Symbols**: ${qualityMetrics.warningSymbols}\n`;
    report += `- **Duplicate Symbols**: ${qualityMetrics.duplicateSymbols}\n`;
    report += `- **Quality Score**: ${qualityMetrics.qualityScore}/100\n\n`;
    
    // Issues by severity
    report += '## Issues by Severity\n';
    for (const [severity, count] of Object.entries(qualityMetrics.issuesBySeverity)) {
      if (count > 0) {
        report += `- **${severity}**: ${count}\n`;
      }
    }
    report += '\n';
    
    // Top issues by rule
    report += '## Top Issues by Rule\n';
    const sortedRules = Object.entries(qualityMetrics.issuesByRule)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    
    for (const [rule, count] of sortedRules) {
      report += `- **${rule}**: ${count}\n`;
    }
    report += '\n';
    
    // Instrument type distribution
    report += '## Instrument Type Distribution\n';
    for (const [type, count] of Object.entries(qualityMetrics.instrumentTypeDistribution)) {
      report += `- **${type}**: ${count}\n`;
    }
    report += '\n';
    
    // Exchange distribution
    report += '## Exchange Distribution\n';
    for (const [exchange, count] of Object.entries(qualityMetrics.exchangeDistribution)) {
      report += `- **${exchange}**: ${count}\n`;
    }
    report += '\n';
    
    // Duplicates
    if (duplicates.length > 0) {
      report += '## Duplicate Symbols\n';
      for (const duplicate of duplicates.slice(0, 10)) {
        report += `- **${duplicate.key}**: ${duplicate.count} occurrences\n`;
      }
      if (duplicates.length > 10) {
        report += `- ... and ${duplicates.length - 10} more\n`;
      }
      report += '\n';
    }
    
    return report;
  }

  /**
   * Get validation statistics
   */
  getStats(): any {
    return {
      service: 'Data Validation Service',
      validationRules: this.validationRules.size,
      availableRules: Array.from(this.validationRules.keys()),
      rulesBySeverity: {
        ERROR: Array.from(this.validationRules.values()).filter(r => r.severity === 'ERROR').length,
        WARNING: Array.from(this.validationRules.values()).filter(r => r.severity === 'WARNING').length,
        INFO: Array.from(this.validationRules.values()).filter(r => r.severity === 'INFO').length
      }
    };
  }
}

// Export singleton instance
export const dataValidationService = new DataValidationService();