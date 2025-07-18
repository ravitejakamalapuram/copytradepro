/**
 * Margin Calculator Service
 * Handles margin calculations, monitoring, and validation for derivatives trading
 * Provides real-time margin monitoring and margin call detection
 */

import { 
  DerivativePosition, 
  OptionPosition, 
  FuturesPosition, 
  DerivativeOrder 
} from '@copytrade/shared-types';
import websocketService from './websocketService';

/**
 * Margin information interface
 */
export interface MarginInfo {
  /** Initial margin required */
  initialMargin: number;
  /** Maintenance margin required */
  maintenanceMargin: number;
  /** Available margin */
  availableMargin: number;
  /** Margin utilization percentage */
  marginUtilization: number;
  /** Whether margin call is triggered */
  marginCall: boolean;
  /** Excess margin available */
  excessMargin: number;
  /** Margin used by current positions */
  usedMargin: number;
  /** Total account equity */
  totalEquity: number;
  /** Last calculation timestamp */
  lastCalculated: Date;
}

/**
 * Margin requirement for a specific position or order
 */
export interface MarginRequirement {
  /** Position or order symbol */
  symbol: string;
  /** Underlying asset */
  underlying: string;
  /** Initial margin required */
  initialMargin: number;
  /** Maintenance margin required */
  maintenanceMargin: number;
  /** Margin type */
  marginType: 'span' | 'exposure' | 'premium' | 'var';
  /** Calculation method used */
  calculationMethod: string;
  /** Additional margin factors */
  additionalFactors: MarginFactor[];
}

/**
 * Additional margin factors
 */
export interface MarginFactor {
  /** Factor type */
  type: 'volatility' | 'liquidity' | 'concentration' | 'calendar_spread' | 'inter_commodity' | 'premium' | 'var';
  /** Factor description */
  description: string;
  /** Margin amount */
  amount: number;
  /** Factor percentage */
  percentage: number;
}

/**
 * Margin impact of a new order
 */
export interface MarginImpact {
  /** Additional margin required */
  additionalMargin: number;
  /** New total margin after order */
  newTotalMargin: number;
  /** New margin utilization percentage */
  newMarginUtilization: number;
  /** Whether order can be placed with available margin */
  canPlaceOrder: boolean;
  /** Margin shortfall if any */
  marginShortfall: number;
  /** Suggested actions if margin insufficient */
  suggestedActions: string[];
}

/**
 * Margin call information
 */
export interface MarginCall {
  /** Margin call ID */
  id: string;
  /** User ID */
  userId: string;
  /** Broker ID */
  brokerId: string;
  /** Margin call type */
  type: 'maintenance' | 'initial' | 'liquidation';
  /** Required margin amount */
  requiredMargin: number;
  /** Current margin available */
  currentMargin: number;
  /** Margin deficit */
  marginDeficit: number;
  /** Positions causing margin call */
  affectedPositions: string[];
  /** Margin call timestamp */
  timestamp: Date;
  /** Deadline for margin call resolution */
  deadline: Date;
  /** Status of margin call */
  status: 'active' | 'resolved' | 'liquidated';
  /** Actions taken */
  actions: MarginCallAction[];
}

/**
 * Margin call action
 */
export interface MarginCallAction {
  /** Action type */
  type: 'add_funds' | 'close_position' | 'reduce_position' | 'liquidation';
  /** Action description */
  description: string;
  /** Action timestamp */
  timestamp: Date;
  /** Amount involved */
  amount: number;
  /** Position affected */
  positionId?: string;
}

/**
 * Margin monitoring subscription
 */
interface MarginSubscription {
  userId: string;
  brokerId: string;
  marginThreshold: number; // Percentage threshold for alerts
  lastUpdate: Date;
  alertsEnabled: boolean;
}

/**
 * Margin Calculator Service implementation
 */
export class MarginCalculatorService {
  private marginSubscriptions: Map<string, MarginSubscription> = new Map();
  private activeMarginCalls: Map<string, MarginCall> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly MONITORING_FREQUENCY = 30000; // 30 seconds
  private readonly DEFAULT_MARGIN_THRESHOLD = 80; // 80% utilization threshold
  private readonly MARGIN_CALL_DEADLINE_HOURS = 24; // 24 hours to resolve margin call
  
  // Margin calculation parameters (these would be configurable per broker)
  private readonly MARGIN_PARAMETERS = {
    options: {
      shortCallPut: {
        spanMargin: 0.15, // 15% of underlying value
        exposureMargin: 0.05, // 5% additional exposure margin
        minimumMargin: 3000 // Minimum margin per lot
      },
      longCallPut: {
        premiumMargin: 1.0, // 100% of premium
        minimumMargin: 0
      }
    },
    futures: {
      initialMargin: 0.10, // 10% of contract value
      maintenanceMargin: 0.075, // 7.5% of contract value
      minimumMargin: 5000 // Minimum margin per contract
    },
    multipliers: {
      volatilityMultiplier: 1.2, // 20% additional margin for high volatility
      liquidityMultiplier: 1.1, // 10% additional margin for low liquidity
      concentrationMultiplier: 1.15 // 15% additional margin for concentrated positions
    }
  };

  /**
   * Initialize margin monitoring service
   */
  public initialize(): void {
    this.startMarginMonitoring();
    console.log('Margin Calculator Service initialized');
  }

  /**
   * Calculate initial margin for positions
   */
  public calculateInitialMargin(positions: DerivativePosition[]): number {
    let totalInitialMargin = 0;

    positions.forEach(position => {
      const marginReq = this.calculatePositionMargin(position, 'initial');
      totalInitialMargin += marginReq.initialMargin;
    });

    return totalInitialMargin;
  }

  /**
   * Calculate maintenance margin for positions
   */
  public calculateMaintenanceMargin(positions: DerivativePosition[]): number {
    let totalMaintenanceMargin = 0;

    positions.forEach(position => {
      const marginReq = this.calculatePositionMargin(position, 'maintenance');
      totalMaintenanceMargin += marginReq.maintenanceMargin;
    });

    return totalMaintenanceMargin;
  }

  /**
   * Calculate margin requirement for a specific position
   */
  public calculatePositionMargin(
    position: DerivativePosition,
    marginType: 'initial' | 'maintenance' = 'initial'
  ): MarginRequirement {
    if (this.isOptionPosition(position)) {
      return this.calculateOptionMargin(position as OptionPosition, marginType);
    } else if (this.isFuturesPosition(position)) {
      return this.calculateFuturesMargin(position as FuturesPosition, marginType);
    } else {
      // Default calculation for other derivative types
      return this.calculateDefaultMargin(position, marginType);
    }
  }

  /**
   * Validate margin requirement before order placement
   */
  public validateMarginRequirement(
    order: DerivativeOrder,
    currentPositions: DerivativePosition[],
    availableMargin: number
  ): boolean {
    const marginImpact = this.getMarginImpact(order, currentPositions, availableMargin);
    return marginImpact.canPlaceOrder;
  }

  /**
   * Get margin impact of a new order
   */
  public getMarginImpact(
    order: DerivativeOrder,
    currentPositions: DerivativePosition[],
    availableMargin: number
  ): MarginImpact {
    // Create a mock position from the order to calculate margin
    const mockPosition = this.createMockPositionFromOrder(order);
    const orderMargin = this.calculatePositionMargin(mockPosition, 'initial');
    
    // Check for netting opportunities with existing positions
    const nettingReduction = this.calculateNettingReduction(order, currentPositions);
    const additionalMargin = Math.max(0, orderMargin.initialMargin - nettingReduction);
    
    const currentTotalMargin = this.calculateInitialMargin(currentPositions);
    const newTotalMargin = currentTotalMargin + additionalMargin;
    const newMarginUtilization = availableMargin > 0 ? (newTotalMargin / availableMargin) * 100 : 100;
    
    const canPlaceOrder = additionalMargin <= availableMargin;
    const marginShortfall = Math.max(0, additionalMargin - availableMargin);
    
    const suggestedActions: string[] = [];
    if (!canPlaceOrder) {
      suggestedActions.push(`Add ${marginShortfall.toFixed(2)} to margin account`);
      suggestedActions.push('Close some existing positions to free up margin');
      suggestedActions.push('Reduce order quantity');
    }

    return {
      additionalMargin,
      newTotalMargin,
      newMarginUtilization,
      canPlaceOrder,
      marginShortfall,
      suggestedActions
    };
  }

  /**
   * Calculate comprehensive margin information for an account
   */
  public calculateMarginInfo(
    positions: DerivativePosition[],
    totalEquity: number,
    cashBalance: number
  ): MarginInfo {
    const initialMargin = this.calculateInitialMargin(positions);
    const maintenanceMargin = this.calculateMaintenanceMargin(positions);
    const usedMargin = positions.reduce((sum, pos) => sum + pos.marginUsed, 0);
    
    const availableMargin = Math.max(0, totalEquity - usedMargin);
    const marginUtilization = totalEquity > 0 ? (usedMargin / totalEquity) * 100 : 0;
    const marginCall = marginUtilization > 100 || availableMargin < maintenanceMargin;
    const excessMargin = Math.max(0, availableMargin - initialMargin);

    return {
      initialMargin,
      maintenanceMargin,
      availableMargin,
      marginUtilization,
      marginCall,
      excessMargin,
      usedMargin,
      totalEquity,
      lastCalculated: new Date()
    };
  }

  /**
   * Subscribe to margin monitoring for a user
   */
  public subscribeToMarginMonitoring(
    userId: string,
    brokerId: string,
    marginThreshold: number = this.DEFAULT_MARGIN_THRESHOLD
  ): void {
    const subscriptionKey = `${userId}-${brokerId}`;
    
    this.marginSubscriptions.set(subscriptionKey, {
      userId,
      brokerId,
      marginThreshold,
      lastUpdate: new Date(),
      alertsEnabled: true
    });

    console.log(`Margin monitoring subscription created for user ${userId}, broker ${brokerId}`);
  }

  /**
   * Unsubscribe from margin monitoring
   */
  public unsubscribeFromMarginMonitoring(userId: string, brokerId: string): void {
    const subscriptionKey = `${userId}-${brokerId}`;
    this.marginSubscriptions.delete(subscriptionKey);
    
    console.log(`Margin monitoring subscription removed for user ${userId}, broker ${brokerId}`);
  }

  /**
   * Trigger margin call
   */
  public triggerMarginCall(
    userId: string,
    brokerId: string,
    marginInfo: MarginInfo,
    affectedPositions: DerivativePosition[]
  ): MarginCall {
    const marginCallId = `MC-${Date.now()}-${userId}-${brokerId}`;
    const deadline = new Date(Date.now() + this.MARGIN_CALL_DEADLINE_HOURS * 60 * 60 * 1000);
    
    const marginCall: MarginCall = {
      id: marginCallId,
      userId,
      brokerId,
      type: marginInfo.marginCall ? 'maintenance' : 'initial',
      requiredMargin: marginInfo.maintenanceMargin,
      currentMargin: marginInfo.availableMargin,
      marginDeficit: Math.max(0, marginInfo.maintenanceMargin - marginInfo.availableMargin),
      affectedPositions: affectedPositions.map(pos => pos.id),
      timestamp: new Date(),
      deadline,
      status: 'active',
      actions: []
    };

    this.activeMarginCalls.set(marginCallId, marginCall);

    // Send margin call notification
    this.sendMarginCallNotification(marginCall);

    console.log(`Margin call triggered: ${marginCallId}`);
    return marginCall;
  }

  /**
   * Resolve margin call
   */
  public resolveMarginCall(
    marginCallId: string,
    action: MarginCallAction
  ): boolean {
    const marginCall = this.activeMarginCalls.get(marginCallId);
    if (!marginCall) {
      console.error(`Margin call not found: ${marginCallId}`);
      return false;
    }

    marginCall.actions.push(action);
    marginCall.status = 'resolved';
    
    // Send resolution notification
    websocketService.sendToUser(marginCall.userId, 'margin_call_resolved', {
      marginCallId,
      action,
      timestamp: new Date()
    });

    console.log(`Margin call resolved: ${marginCallId}`);
    return true;
  }

  /**
   * Calculate option margin requirement
   */
  private calculateOptionMargin(
    position: OptionPosition,
    marginType: 'initial' | 'maintenance'
  ): MarginRequirement {
    const { symbol, underlying, quantity, strike, currentPrice, positionType } = position;
    const params = this.MARGIN_PARAMETERS.options;
    
    let initialMargin = 0;
    let maintenanceMargin = 0;
    const additionalFactors: MarginFactor[] = [];

    if (positionType === 'short') {
      // Short options require SPAN + Exposure margin
      const underlyingValue = strike * quantity;
      const spanMargin = underlyingValue * params.shortCallPut.spanMargin;
      const exposureMargin = underlyingValue * params.shortCallPut.exposureMargin;
      
      initialMargin = Math.max(
        spanMargin + exposureMargin,
        params.shortCallPut.minimumMargin * quantity
      );
      
      maintenanceMargin = initialMargin * 0.75; // 75% of initial margin
      
      additionalFactors.push({
        type: 'volatility',
        description: 'SPAN margin component',
        amount: spanMargin,
        percentage: params.shortCallPut.spanMargin * 100
      });
      
      additionalFactors.push({
        type: 'concentration',
        description: 'Exposure margin component',
        amount: exposureMargin,
        percentage: params.shortCallPut.exposureMargin * 100
      });
    } else {
      // Long options require premium payment
      initialMargin = position.premium * quantity;
      maintenanceMargin = 0; // No maintenance margin for long options
      
      additionalFactors.push({
        type: 'premium',
        description: 'Premium payment for long option',
        amount: initialMargin,
        percentage: 100
      });
    }

    // Apply volatility multiplier if high volatility
    if (position.impliedVolatility > 0.4) {
      const volatilityAdjustment = initialMargin * (this.MARGIN_PARAMETERS.multipliers.volatilityMultiplier - 1);
      initialMargin += volatilityAdjustment;
      maintenanceMargin += volatilityAdjustment;
      
      additionalFactors.push({
        type: 'volatility',
        description: 'High volatility adjustment',
        amount: volatilityAdjustment,
        percentage: (this.MARGIN_PARAMETERS.multipliers.volatilityMultiplier - 1) * 100
      });
    }

    return {
      symbol,
      underlying,
      initialMargin: marginType === 'initial' ? initialMargin : maintenanceMargin,
      maintenanceMargin,
      marginType: 'span',
      calculationMethod: 'SPAN + Exposure',
      additionalFactors
    };
  }

  /**
   * Calculate futures margin requirement
   */
  private calculateFuturesMargin(
    position: FuturesPosition,
    marginType: 'initial' | 'maintenance'
  ): MarginRequirement {
    const { symbol, underlying, quantity, currentPrice, contractSize } = position;
    const params = this.MARGIN_PARAMETERS.futures;
    
    const contractValue = currentPrice * quantity * contractSize;
    const initialMargin = Math.max(
      contractValue * params.initialMargin,
      params.minimumMargin * quantity
    );
    const maintenanceMargin = Math.max(
      contractValue * params.maintenanceMargin,
      params.minimumMargin * quantity * 0.75
    );

    const additionalFactors: MarginFactor[] = [
      {
        type: 'var',
        description: 'Initial margin requirement',
        amount: initialMargin,
        percentage: params.initialMargin * 100
      }
    ];

    return {
      symbol,
      underlying,
      initialMargin: marginType === 'initial' ? initialMargin : maintenanceMargin,
      maintenanceMargin,
      marginType: 'var',
      calculationMethod: 'Value at Risk',
      additionalFactors
    };
  }

  /**
   * Calculate default margin for other derivative types
   */
  private calculateDefaultMargin(
    position: DerivativePosition,
    marginType: 'initial' | 'maintenance'
  ): MarginRequirement {
    const { symbol, underlying, positionValue } = position;
    
    // Default to 10% of position value for initial, 7.5% for maintenance
    const initialMargin = Math.abs(positionValue) * 0.10;
    const maintenanceMargin = Math.abs(positionValue) * 0.075;

    return {
      symbol,
      underlying,
      initialMargin: marginType === 'initial' ? initialMargin : maintenanceMargin,
      maintenanceMargin,
      marginType: 'exposure',
      calculationMethod: 'Default percentage',
      additionalFactors: []
    };
  }

  /**
   * Create mock position from order for margin calculation
   */
  private createMockPositionFromOrder(order: DerivativeOrder): DerivativePosition {
    return {
      id: 'mock-' + order.id,
      brokerId: order.brokerId,
      symbol: order.symbol,
      underlying: order.underlying,
      positionType: order.transactionType === 'buy' ? 'long' : 'short',
      quantity: order.quantity,
      avgPrice: order.price || 0,
      currentPrice: order.price || 0,
      unrealizedPnL: 0,
      realizedPnL: 0,
      totalPnL: 0,
      positionValue: (order.price || 0) * order.quantity,
      marginUsed: 0,
      entryDate: new Date(),
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate margin reduction due to netting with existing positions
   */
  private calculateNettingReduction(
    order: DerivativeOrder,
    currentPositions: DerivativePosition[]
  ): number {
    // Find opposite positions that can be netted
    const oppositePositions = currentPositions.filter(pos => 
      pos.symbol === order.symbol &&
      ((pos.positionType === 'long' && order.transactionType === 'sell') ||
       (pos.positionType === 'short' && order.transactionType === 'buy'))
    );

    if (oppositePositions.length === 0) return 0;

    // Calculate potential netting reduction
    let nettingReduction = 0;
    let remainingOrderQuantity = order.quantity;

    oppositePositions.forEach(pos => {
      const nettableQuantity = Math.min(remainingOrderQuantity, pos.quantity);
      if (nettableQuantity > 0) {
        const positionMargin = this.calculatePositionMargin(pos, 'initial');
        const reductionPerUnit = positionMargin.initialMargin / pos.quantity;
        nettingReduction += reductionPerUnit * nettableQuantity;
        remainingOrderQuantity -= nettableQuantity;
      }
    });

    return nettingReduction;
  }

  /**
   * Start margin monitoring
   */
  private startMarginMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      await this.performMarginMonitoring();
    }, this.MONITORING_FREQUENCY);

    console.log(`Margin monitoring started with ${this.MONITORING_FREQUENCY}ms frequency`);
  }

  /**
   * Perform margin monitoring for all subscriptions
   */
  private async performMarginMonitoring(): Promise<void> {
    for (const [subscriptionKey, subscription] of this.marginSubscriptions.entries()) {
      try {
        // In a real implementation, this would fetch current positions and account data
        // For now, we'll skip the actual monitoring logic
        console.debug(`Monitoring margin for ${subscriptionKey}`);
        
        subscription.lastUpdate = new Date();
      } catch (error) {
        console.error(`Error in margin monitoring for ${subscriptionKey}:`, error);
      }
    }
  }

  /**
   * Send margin call notification
   */
  private sendMarginCallNotification(marginCall: MarginCall): void {
    websocketService.sendToUser(marginCall.userId, 'margin_call', {
      marginCall,
      timestamp: new Date()
    });

    // Also send email/SMS notification in production
    console.log(`Margin call notification sent to user ${marginCall.userId}`);
  }

  /**
   * Type guard for option positions
   */
  private isOptionPosition(position: DerivativePosition): position is OptionPosition {
    return 'optionType' in position && 'strike' in position;
  }

  /**
   * Type guard for futures positions
   */
  private isFuturesPosition(position: DerivativePosition): position is FuturesPosition {
    return 'contractSize' in position && 'multiplier' in position;
  }

  /**
   * Get active margin calls for a user
   */
  public getActiveMarginCalls(userId: string): MarginCall[] {
    return Array.from(this.activeMarginCalls.values())
      .filter(call => call.userId === userId && call.status === 'active');
  }

  /**
   * Get service statistics
   */
  public getStats() {
    return {
      activeSubscriptions: this.marginSubscriptions.size,
      activeMarginCalls: this.activeMarginCalls.size,
      monitoringFrequency: this.MONITORING_FREQUENCY,
      isMonitoring: this.monitoringInterval !== null
    };
  }

  /**
   * Shutdown the service
   */
  public shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.marginSubscriptions.clear();
    this.activeMarginCalls.clear();

    console.log('Margin Calculator Service shutdown complete');
  }
}

// Create singleton instance
export const marginCalculatorService = new MarginCalculatorService();