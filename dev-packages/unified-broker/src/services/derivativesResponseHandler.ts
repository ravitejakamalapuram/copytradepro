/**
 * Unified Derivatives Response Handler
 * Normalizes derivatives responses from different brokers and provides unified position aggregation
 */

import {
  OptionChain,
  FuturesChain,
  OptionPosition,
  FuturesPosition,
  DerivativePosition,
  DerivativeOrder,
  OptionContract,
  FuturesContract,
  Greeks,
  OptionStrike
} from '@copytrade/shared-types';

import {
  MarginInfo,
  TradingPermissions,
  OrderResponse
} from '../interfaces/IBrokerService';

/**
 * Broker-specific error types for derivatives
 */
export interface DerivativesError {
  brokerName: string;
  errorType: 'MARGIN_INSUFFICIENT' | 'CONTRACT_EXPIRED' | 'INVALID_STRIKE' | 'POSITION_LIMIT' | 'NETWORK_ERROR' | 'UNKNOWN';
  originalError: any;
  message: string;
  timestamp: Date;
}

/**
 * Unified derivatives response interface
 */
export interface UnifiedDerivativesResponse<T> {
  success: boolean;
  data?: T;
  error?: DerivativesError;
  brokerName: string;
  timestamp: Date;
}

/**
 * Aggregated position data across multiple brokers
 */
export interface AggregatedDerivativePositions {
  totalPositions: number;
  totalValue: number;
  totalPnL: number;
  totalMarginUsed: number;
  positionsByBroker: { [brokerName: string]: DerivativePosition[] };
  positionsByUnderlying: { [underlying: string]: DerivativePosition[] };
  optionsPositions: OptionPosition[];
  futuresPositions: FuturesPosition[];
  riskMetrics: {
    totalDelta: number;
    totalGamma: number;
    totalTheta: number;
    totalVega: number;
    totalRho: number;
  };
}

/**
 * Unified derivatives response handler service
 */
export class DerivativesResponseHandler {
  
  /**
   * Normalize option chain response from different brokers
   */
  static normalizeOptionChain(
    brokerResponse: any, 
    brokerName: string, 
    underlying: string
  ): UnifiedDerivativesResponse<OptionChain> {
    try {
      let normalizedChain: OptionChain;

      switch (brokerName.toLowerCase()) {
        case 'fyers':
          normalizedChain = this.normalizeFyersOptionChain(brokerResponse, underlying);
          break;
        case 'shoonya':
          normalizedChain = this.normalizeShoonyaOptionChain(brokerResponse, underlying);
          break;
        default:
          throw new Error(`Unsupported broker: ${brokerName}`);
      }

      return {
        success: true,
        data: normalizedChain,
        brokerName,
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          brokerName,
          errorType: this.classifyError(error),
          originalError: error,
          message: error.message || 'Failed to normalize option chain',
          timestamp: new Date()
        },
        brokerName,
        timestamp: new Date()
      };
    }
  }

  /**
   * Normalize futures chain response from different brokers
   */
  static normalizeFuturesChain(
    brokerResponse: any, 
    brokerName: string, 
    underlying: string
  ): UnifiedDerivativesResponse<FuturesChain> {
    try {
      let normalizedChain: FuturesChain;

      switch (brokerName.toLowerCase()) {
        case 'fyers':
          normalizedChain = this.normalizeFyersFuturesChain(brokerResponse, underlying);
          break;
        case 'shoonya':
          normalizedChain = this.normalizeShoonyaFuturesChain(brokerResponse, underlying);
          break;
        default:
          throw new Error(`Unsupported broker: ${brokerName}`);
      }

      return {
        success: true,
        data: normalizedChain,
        brokerName,
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          brokerName,
          errorType: this.classifyError(error),
          originalError: error,
          message: error.message || 'Failed to normalize futures chain',
          timestamp: new Date()
        },
        brokerName,
        timestamp: new Date()
      };
    }
  }

  /**
   * Normalize order response from different brokers
   */
  static normalizeOrderResponse(
    brokerResponse: any, 
    brokerName: string
  ): UnifiedDerivativesResponse<OrderResponse> {
    try {
      let normalizedResponse: OrderResponse;

      switch (brokerName.toLowerCase()) {
        case 'fyers':
          normalizedResponse = this.normalizeFyersOrderResponse(brokerResponse);
          break;
        case 'shoonya':
          normalizedResponse = this.normalizeShoonyaOrderResponse(brokerResponse);
          break;
        default:
          throw new Error(`Unsupported broker: ${brokerName}`);
      }

      return {
        success: true,
        data: normalizedResponse,
        brokerName,
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          brokerName,
          errorType: this.classifyError(error),
          originalError: error,
          message: error.message || 'Failed to normalize order response',
          timestamp: new Date()
        },
        brokerName,
        timestamp: new Date()
      };
    }
  }

  /**
   * Aggregate derivative positions across multiple brokers
   */
  static aggregatePositions(
    positionsByBroker: { [brokerName: string]: DerivativePosition[] }
  ): AggregatedDerivativePositions {
    const allPositions: DerivativePosition[] = [];
    const positionsByUnderlying: { [underlying: string]: DerivativePosition[] } = {};
    const optionsPositions: OptionPosition[] = [];
    const futuresPositions: FuturesPosition[] = [];

    let totalValue = 0;
    let totalPnL = 0;
    let totalMarginUsed = 0;
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;
    let totalRho = 0;

    // Process positions from each broker
    for (const [brokerName, positions] of Object.entries(positionsByBroker)) {
      for (const position of positions) {
        allPositions.push(position);

        // Group by underlying
        if (!positionsByUnderlying[position.underlying]) {
          positionsByUnderlying[position.underlying] = [];
        }
        positionsByUnderlying[position.underlying].push(position);

        // Separate options and futures
        if (this.isOptionPosition(position)) {
          optionsPositions.push(position as OptionPosition);
          
          // Aggregate Greeks for options
          const optionPos = position as OptionPosition;
          totalDelta += optionPos.greeks.delta * optionPos.quantity;
          totalGamma += optionPos.greeks.gamma * optionPos.quantity;
          totalTheta += optionPos.greeks.theta * optionPos.quantity;
          totalVega += optionPos.greeks.vega * optionPos.quantity;
          totalRho += optionPos.greeks.rho * optionPos.quantity;
        } else {
          futuresPositions.push(position as FuturesPosition);
        }

        // Aggregate totals
        totalValue += position.positionValue;
        totalPnL += position.totalPnL;
        totalMarginUsed += position.marginUsed;
      }
    }

    return {
      totalPositions: allPositions.length,
      totalValue,
      totalPnL,
      totalMarginUsed,
      positionsByBroker,
      positionsByUnderlying,
      optionsPositions,
      futuresPositions,
      riskMetrics: {
        totalDelta,
        totalGamma,
        totalTheta,
        totalVega,
        totalRho
      }
    };
  }

  /**
   * Normalize margin info from different brokers
   */
  static normalizeMarginInfo(
    brokerResponse: any, 
    brokerName: string
  ): UnifiedDerivativesResponse<MarginInfo> {
    try {
      let normalizedMargin: MarginInfo;

      switch (brokerName.toLowerCase()) {
        case 'fyers':
          normalizedMargin = this.normalizeFyersMarginInfo(brokerResponse);
          break;
        case 'shoonya':
          normalizedMargin = this.normalizeShoonyaMarginInfo(brokerResponse);
          break;
        default:
          throw new Error(`Unsupported broker: ${brokerName}`);
      }

      return {
        success: true,
        data: normalizedMargin,
        brokerName,
        timestamp: new Date()
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          brokerName,
          errorType: this.classifyError(error),
          originalError: error,
          message: error.message || 'Failed to normalize margin info',
          timestamp: new Date()
        },
        brokerName,
        timestamp: new Date()
      };
    }
  }

  // Private helper methods for broker-specific normalization

  private static normalizeFyersOptionChain(response: any, underlying: string): OptionChain {
    // Implementation for Fyers option chain normalization
    return {
      underlying,
      expiryDate: new Date(),
      strikes: [],
      impliedVolatility: 0.2,
      historicalVolatility: 0.25,
      atmStrike: 0,
      daysToExpiry: 30,
      interestRate: 0.06
    };
  }

  private static normalizeShoonyaOptionChain(response: any, underlying: string): OptionChain {
    // Implementation for Shoonya option chain normalization
    return {
      underlying,
      expiryDate: new Date(),
      strikes: [],
      impliedVolatility: 0.2,
      historicalVolatility: 0.25,
      atmStrike: 0,
      daysToExpiry: 30,
      interestRate: 0.06
    };
  }

  private static normalizeFyersFuturesChain(response: any, underlying: string): FuturesChain {
    // Implementation for Fyers futures chain normalization
    return {
      underlying,
      contracts: [],
      nearMonthContract: {} as FuturesContract,
      rolloverDate: new Date(),
      specifications: {
        contractSize: 50,
        tickValue: 0.05,
        tradingHours: { start: '09:15', end: '15:30' },
        settlementType: 'cash',
        marginPercentage: 10
      }
    };
  }

  private static normalizeShoonyaFuturesChain(response: any, underlying: string): FuturesChain {
    // Implementation for Shoonya futures chain normalization
    return {
      underlying,
      contracts: [],
      nearMonthContract: {} as FuturesContract,
      rolloverDate: new Date(),
      specifications: {
        contractSize: 50,
        tickValue: 0.05,
        tradingHours: { start: '09:15', end: '15:30' },
        settlementType: 'cash',
        marginPercentage: 10
      }
    };
  }

  private static normalizeFyersOrderResponse(response: any): OrderResponse {
    return {
      success: response.s === 'ok',
      orderId: response.id,
      message: response.message || (response.s === 'ok' ? 'Order placed successfully' : 'Order failed'),
      data: response
    };
  }

  private static normalizeShoonyaOrderResponse(response: any): OrderResponse {
    return {
      success: response.stat === 'Ok',
      orderId: response.norenordno,
      message: response.emsg || (response.stat === 'Ok' ? 'Order placed successfully' : 'Order failed'),
      data: response
    };
  }

  private static normalizeFyersMarginInfo(response: any): MarginInfo {
    return {
      initialMargin: response.initialMargin || 0,
      maintenanceMargin: response.maintenanceMargin || 0,
      availableMargin: response.availableMargin || 0,
      marginUtilization: response.marginUtilization || 0,
      marginCall: response.marginCall || false,
      excessMargin: response.excessMargin || 0
    };
  }

  private static normalizeShoonyaMarginInfo(response: any): MarginInfo {
    return {
      initialMargin: response.initialMargin || 0,
      maintenanceMargin: response.maintenanceMargin || 0,
      availableMargin: response.availableMargin || 0,
      marginUtilization: response.marginUtilization || 0,
      marginCall: response.marginCall || false,
      excessMargin: response.excessMargin || 0
    };
  }

  private static isOptionPosition(position: DerivativePosition): boolean {
    return position.symbol.includes('CE') || position.symbol.includes('PE');
  }

  private static classifyError(error: any): DerivativesError['errorType'] {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('margin') || message.includes('insufficient')) {
      return 'MARGIN_INSUFFICIENT';
    }
    if (message.includes('expired') || message.includes('expiry')) {
      return 'CONTRACT_EXPIRED';
    }
    if (message.includes('strike') || message.includes('invalid')) {
      return 'INVALID_STRIKE';
    }
    if (message.includes('limit') || message.includes('position')) {
      return 'POSITION_LIMIT';
    }
    if (message.includes('network') || message.includes('timeout')) {
      return 'NETWORK_ERROR';
    }
    
    return 'UNKNOWN';
  }

  /**
   * Create standardized error response for derivatives operations
   */
  static createErrorResponse(
    brokerName: string,
    error: any,
    operation: string
  ): UnifiedDerivativesResponse<any> {
    return {
      success: false,
      error: {
        brokerName,
        errorType: this.classifyError(error),
        originalError: error,
        message: `${operation} failed: ${error.message || 'Unknown error'}`,
        timestamp: new Date()
      },
      brokerName,
      timestamp: new Date()
    };
  }

  /**
   * Validate derivatives order request across brokers
   */
  static validateDerivativeOrder(orderRequest: any, brokerName: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Common validations
    if (!orderRequest.symbol) {
      errors.push('Symbol is required');
    }
    if (!orderRequest.quantity || orderRequest.quantity <= 0) {
      errors.push('Valid quantity is required');
    }
    if (!orderRequest.action || !['BUY', 'SELL'].includes(orderRequest.action)) {
      errors.push('Valid action (BUY/SELL) is required');
    }

    // Broker-specific validations
    switch (brokerName.toLowerCase()) {
      case 'fyers':
        if (orderRequest.orderType === 'LIMIT' && (!orderRequest.price || orderRequest.price <= 0)) {
          errors.push('Price is required for limit orders');
        }
        break;
      case 'shoonya':
        if (!orderRequest.exchange) {
          errors.push('Exchange is required for Shoonya orders');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate portfolio-level risk metrics from aggregated positions
   */
  static calculatePortfolioRisk(aggregatedPositions: AggregatedDerivativePositions): {
    valueAtRisk: number;
    maxDrawdown: number;
    sharpeRatio: number;
    concentrationRisk: number;
  } {
    const { totalValue, totalPnL, positionsByUnderlying, riskMetrics } = aggregatedPositions;

    // Simplified risk calculations
    const valueAtRisk = totalValue * 0.05; // 5% VaR assumption
    const maxDrawdown = Math.abs(Math.min(0, totalPnL)) / Math.max(totalValue, 1);
    const sharpeRatio = totalPnL / Math.max(Math.sqrt(totalValue), 1); // Simplified Sharpe ratio
    
    // Concentration risk - check if any single underlying has > 30% of total value
    let maxConcentration = 0;
    for (const [underlying, positions] of Object.entries(positionsByUnderlying)) {
      const underlyingValue = positions.reduce((sum, pos) => sum + pos.positionValue, 0);
      const concentration = underlyingValue / Math.max(totalValue, 1);
      maxConcentration = Math.max(maxConcentration, concentration);
    }
    const concentrationRisk = maxConcentration;

    return {
      valueAtRisk,
      maxDrawdown,
      sharpeRatio,
      concentrationRisk
    };
  }
}