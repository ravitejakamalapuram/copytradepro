import { DerivativeStrategy, StrategyLeg } from './strategyBuilderService';

/**
 * Multi-leg order execution result
 */
export interface MultiLegExecutionResult {
  /** Execution ID */
  executionId: string;
  /** Strategy ID */
  strategyId: string;
  /** Overall execution status */
  status: 'pending' | 'partial' | 'completed' | 'failed' | 'cancelled';
  /** Individual leg results */
  legResults: LegExecutionResult[];
  /** Total filled legs */
  filledLegs: number;
  /** Total legs */
  totalLegs: number;
  /** Net premium received/paid */
  netPremium: number;
  /** Execution start time */
  startTime: Date;
  /** Execution end time */
  endTime?: Date;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Individual leg execution result
 */
export interface LegExecutionResult {
  /** Leg ID */
  legId: string;
  /** Order ID from broker */
  orderId: string;
  /** Broker ID */
  brokerId: string;
  /** Execution status */
  status: 'pending' | 'partial' | 'filled' | 'rejected' | 'cancelled';
  /** Requested quantity */
  requestedQuantity: number;
  /** Filled quantity */
  filledQuantity: number;
  /** Average fill price */
  avgFillPrice: number;
  /** Total fill value */
  fillValue: number;
  /** Execution timestamp */
  executionTime?: Date;
  /** Error message if rejected */
  errorMessage?: string;
  /** Partial fill details */
  partialFills: PartialFill[];
}

/**
 * Partial fill information
 */
export interface PartialFill {
  /** Fill ID */
  fillId: string;
  /** Fill quantity */
  quantity: number;
  /** Fill price */
  price: number;
  /** Fill timestamp */
  timestamp: Date;
  /** Fill value */
  value: number;
}

/**
 * Order routing venue information
 */
export interface ExecutionVenue {
  /** Broker ID */
  brokerId: string;
  /** Broker name */
  brokerName: string;
  /** Available liquidity */
  liquidity: number;
  /** Bid price */
  bidPrice: number;
  /** Ask price */
  askPrice: number;
  /** Spread */
  spread: number;
  /** Estimated execution probability */
  executionProbability: number;
  /** Execution cost estimate */
  estimatedCost: number;
}

/**
 * Multi-leg order execution configuration
 */
export interface MultiLegExecutionConfig {
  /** Execution type */
  executionType: 'simultaneous' | 'sequential' | 'conditional';
  /** Maximum execution time in seconds */
  maxExecutionTime: number;
  /** Allow partial fills */
  allowPartialFills: boolean;
  /** Minimum fill percentage required */
  minFillPercentage: number;
  /** Price tolerance percentage */
  priceTolerance: number;
  /** Retry attempts for failed legs */
  retryAttempts: number;
  /** Retry delay in milliseconds */
  retryDelay: number;
  /** Cancel all on single leg failure */
  cancelAllOnFailure: boolean;
}

/**
 * Multi-leg order manager for executing complex derivative strategies
 */
export class MultiLegOrderManager {
  private activeExecutions: Map<string, MultiLegExecutionResult>;
  private executionTimeouts: Map<string, NodeJS.Timeout>;

  constructor() {
    this.activeExecutions = new Map();
    this.executionTimeouts = new Map();
  }

  /**
   * Execute a multi-leg strategy
   */
  public async executeStrategy(
    strategy: DerivativeStrategy,
    config: MultiLegExecutionConfig = this.getDefaultConfig()
  ): Promise<MultiLegExecutionResult> {
    const executionId = this.generateExecutionId();
    
    const execution: MultiLegExecutionResult = {
      executionId,
      strategyId: strategy.id,
      status: 'pending',
      legResults: [],
      filledLegs: 0,
      totalLegs: strategy.legs.length,
      netPremium: 0,
      startTime: new Date()
    };

    this.activeExecutions.set(executionId, execution);

    try {
      // Set execution timeout
      this.setExecutionTimeout(executionId, config.maxExecutionTime);

      // Validate strategy before execution
      const validation = await this.validateStrategyForExecution(strategy);
      if (!validation.isValid) {
        throw new Error(`Strategy validation failed: ${validation.errors.join(', ')}`);
      }

      // Find best execution venues for each leg
      const venues = await this.findBestExecutionVenues(strategy.legs);

      // Execute based on configuration
      switch (config.executionType) {
        case 'simultaneous':
          await this.executeSimultaneous(execution, strategy.legs, venues, config);
          break;
        case 'sequential':
          await this.executeSequential(execution, strategy.legs, venues, config);
          break;
        case 'conditional':
          await this.executeConditional(execution, strategy.legs, venues, config);
          break;
      }

      // Finalize execution
      execution.endTime = new Date();
      execution.status = this.determineOverallStatus(execution);
      
      // Calculate net premium
      execution.netPremium = this.calculateNetPremium(execution);

    } catch (error) {
      execution.status = 'failed';
      execution.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      execution.endTime = new Date();
    } finally {
      // Clear timeout
      this.clearExecutionTimeout(executionId);
    }

    return execution;
  }

  /**
   * Cancel multi-leg execution
   */
  public async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    execution.status = 'cancelled';
    
    // Cancel all pending orders
    const cancelPromises = execution.legResults
      .filter(leg => leg.status === 'pending' || leg.status === 'partial')
      .map(leg => this.cancelLegOrder(leg));

    await Promise.allSettled(cancelPromises);
    
    this.clearExecutionTimeout(executionId);
    return true;
  }

  /**
   * Get execution status
   */
  public getExecutionStatus(executionId: string): MultiLegExecutionResult | undefined {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Get all active executions
   */
  public getActiveExecutions(): MultiLegExecutionResult[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Handle partial fill for a leg
   */
  public async handlePartialFill(
    executionId: string,
    legId: string,
    fill: PartialFill
  ): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return;
    }

    const legResult = execution.legResults.find(leg => leg.legId === legId);
    if (!legResult) {
      return;
    }

    // Add partial fill
    legResult.partialFills.push(fill);
    legResult.filledQuantity += fill.quantity;
    legResult.fillValue += fill.value;
    
    // Update average fill price
    legResult.avgFillPrice = legResult.fillValue / legResult.filledQuantity;

    // Update leg status
    if (legResult.filledQuantity >= legResult.requestedQuantity) {
      legResult.status = 'filled';
      legResult.executionTime = new Date();
      execution.filledLegs++;
    } else {
      legResult.status = 'partial';
    }

    // Update overall execution status
    execution.status = this.determineOverallStatus(execution);
  }

  /**
   * Find best execution venues for legs
   */
  private async findBestExecutionVenues(legs: StrategyLeg[]): Promise<Map<string, ExecutionVenue[]>> {
    const venues = new Map<string, ExecutionVenue[]>();

    for (const leg of legs) {
      // This would integrate with actual broker APIs to get real quotes
      const legVenues = await this.getBrokerQuotes(leg);
      venues.set(leg.id, legVenues);
    }

    return venues;
  }

  /**
   * Get broker quotes for a leg (mock implementation)
   */
  private async getBrokerQuotes(leg: StrategyLeg): Promise<ExecutionVenue[]> {
    // Mock implementation - would integrate with actual broker APIs
    return [
      {
        brokerId: 'fyers',
        brokerName: 'Fyers',
        liquidity: 1000,
        bidPrice: leg.marketPrice - 0.5,
        askPrice: leg.marketPrice + 0.5,
        spread: 1.0,
        executionProbability: 0.95,
        estimatedCost: leg.marketPrice * leg.quantity
      },
      {
        brokerId: 'shoonya',
        brokerName: 'Shoonya',
        liquidity: 800,
        bidPrice: leg.marketPrice - 0.75,
        askPrice: leg.marketPrice + 0.75,
        spread: 1.5,
        executionProbability: 0.90,
        estimatedCost: leg.marketPrice * leg.quantity * 1.01
      }
    ];
  }

  /**
   * Execute legs simultaneously
   */
  private async executeSimultaneous(
    execution: MultiLegExecutionResult,
    legs: StrategyLeg[],
    venues: Map<string, ExecutionVenue[]>,
    config: MultiLegExecutionConfig
  ): Promise<void> {
    const executionPromises = legs.map(leg => 
      this.executeLeg(execution, leg, venues.get(leg.id) || [], config)
    );

    await Promise.allSettled(executionPromises);
  }

  /**
   * Execute legs sequentially
   */
  private async executeSequential(
    execution: MultiLegExecutionResult,
    legs: StrategyLeg[],
    venues: Map<string, ExecutionVenue[]>,
    config: MultiLegExecutionConfig
  ): Promise<void> {
    for (const leg of legs) {
      if (execution.status === 'cancelled') {
        break;
      }

      await this.executeLeg(execution, leg, venues.get(leg.id) || [], config);
      
      // Check if we should continue based on previous leg results
      if (config.cancelAllOnFailure) {
        const lastLegResult = execution.legResults[execution.legResults.length - 1];
        if (lastLegResult?.status === 'rejected') {
          execution.status = 'failed';
          break;
        }
      }
    }
  }

  /**
   * Execute legs with conditional logic
   */
  private async executeConditional(
    execution: MultiLegExecutionResult,
    legs: StrategyLeg[],
    venues: Map<string, ExecutionVenue[]>,
    config: MultiLegExecutionConfig
  ): Promise<void> {
    // Sort legs by priority (buy legs first, then sell legs)
    const sortedLegs = [...legs].sort((a, b) => {
      if (a.action === 'buy' && b.action === 'sell') return -1;
      if (a.action === 'sell' && b.action === 'buy') return 1;
      return 0;
    });

    for (const leg of sortedLegs) {
      if (execution.status === 'cancelled') {
        break;
      }

      await this.executeLeg(execution, leg, venues.get(leg.id) || [], config);
      
      // Conditional logic: if buying leg fails, don't execute selling legs
      const legResult = execution.legResults[execution.legResults.length - 1];
      if (leg.action === 'buy' && legResult?.status === 'rejected') {
        execution.status = 'failed';
        execution.errorMessage = 'Failed to execute buy leg, cancelling remaining legs';
        break;
      }
    }
  }

  /**
   * Execute individual leg
   */
  private async executeLeg(
    execution: MultiLegExecutionResult,
    leg: StrategyLeg,
    venues: ExecutionVenue[],
    config: MultiLegExecutionConfig
  ): Promise<void> {
    if (venues.length === 0) {
      const legResult: LegExecutionResult = {
        legId: leg.id,
        orderId: '',
        brokerId: '',
        status: 'rejected',
        requestedQuantity: leg.quantity,
        filledQuantity: 0,
        avgFillPrice: 0,
        fillValue: 0,
        errorMessage: 'No execution venues available',
        partialFills: []
      };
      execution.legResults.push(legResult);
      return;
    }

    // Select best venue (highest execution probability)
    const bestVenue = venues.reduce((best, current) => 
      current.executionProbability > best.executionProbability ? current : best
    );

    const legResult: LegExecutionResult = {
      legId: leg.id,
      orderId: this.generateOrderId(),
      brokerId: bestVenue.brokerId,
      status: 'pending',
      requestedQuantity: leg.quantity,
      filledQuantity: 0,
      avgFillPrice: 0,
      fillValue: 0,
      partialFills: []
    };

    execution.legResults.push(legResult);

    try {
      // Simulate order execution (would integrate with actual broker APIs)
      await this.simulateOrderExecution(legResult, leg, bestVenue, config);
    } catch (error) {
      legResult.status = 'rejected';
      legResult.errorMessage = error instanceof Error ? error.message : 'Execution failed';
    }
  }

  /**
   * Simulate order execution (mock implementation)
   */
  private async simulateOrderExecution(
    legResult: LegExecutionResult,
    leg: StrategyLeg,
    venue: ExecutionVenue,
    config: MultiLegExecutionConfig
  ): Promise<void> {
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

    // Simulate execution probability
    const executionSuccess = Math.random() < venue.executionProbability;
    
    if (executionSuccess) {
      // Simulate partial or full fill
      const fillPercentage = config.allowPartialFills 
        ? Math.random() * 0.4 + 0.6 // 60-100% fill
        : 1.0; // Full fill

      const fillQuantity = Math.floor(leg.quantity * fillPercentage);
      const fillPrice = leg.action === 'buy' ? venue.askPrice : venue.bidPrice;
      
      const partialFill: PartialFill = {
        fillId: this.generateFillId(),
        quantity: fillQuantity,
        price: fillPrice,
        timestamp: new Date(),
        value: fillQuantity * fillPrice
      };

      legResult.partialFills.push(partialFill);
      legResult.filledQuantity = fillQuantity;
      legResult.avgFillPrice = fillPrice;
      legResult.fillValue = partialFill.value;
      legResult.status = fillQuantity === leg.quantity ? 'filled' : 'partial';
      legResult.executionTime = new Date();
    } else {
      legResult.status = 'rejected';
      legResult.errorMessage = 'Order rejected by exchange';
    }
  }

  /**
   * Cancel individual leg order
   */
  private async cancelLegOrder(legResult: LegExecutionResult): Promise<void> {
    // Would integrate with actual broker APIs to cancel orders
    legResult.status = 'cancelled';
  }

  /**
   * Validate strategy for execution
   */
  private async validateStrategyForExecution(strategy: DerivativeStrategy): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    if (strategy.legs.length === 0) {
      errors.push('Strategy has no legs to execute');
    }

    for (const leg of strategy.legs) {
      if (leg.quantity <= 0) {
        errors.push(`Invalid quantity for leg ${leg.id}`);
      }

      if (!leg.symbol) {
        errors.push(`Missing symbol for leg ${leg.id}`);
      }

      if (leg.marketPrice <= 0) {
        errors.push(`Invalid market price for leg ${leg.id}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Determine overall execution status
   */
  private determineOverallStatus(execution: MultiLegExecutionResult): 'pending' | 'partial' | 'completed' | 'failed' | 'cancelled' {
    if (execution.status === 'cancelled') {
      return 'cancelled';
    }

    const legStatuses = execution.legResults.map(leg => leg.status);
    
    if (legStatuses.every(status => status === 'filled')) {
      return 'completed';
    }

    if (legStatuses.some(status => status === 'rejected')) {
      return 'failed';
    }

    if (legStatuses.some(status => status === 'filled' || status === 'partial')) {
      return 'partial';
    }

    return 'pending';
  }

  /**
   * Calculate net premium for execution
   */
  private calculateNetPremium(execution: MultiLegExecutionResult): number {
    return execution.legResults.reduce((total, leg) => {
      const legValue = leg.fillValue;
      // For buy orders, subtract from total (cash outflow)
      // For sell orders, add to total (cash inflow)
      const strategy = Array.from(this.activeExecutions.values())
        .find(exec => exec.executionId === execution.executionId);
      
      if (strategy) {
        const strategyLeg = strategy.legResults.find(l => l.legId === leg.legId);
        // This would need access to the original strategy to determine buy/sell
        // For now, assume positive values are credits, negative are debits
        return total + (leg.fillValue || 0);
      }
      
      return total;
    }, 0);
  }

  /**
   * Set execution timeout
   */
  private setExecutionTimeout(executionId: string, timeoutSeconds: number): void {
    const timeout = setTimeout(() => {
      this.cancelExecution(executionId);
    }, timeoutSeconds * 1000);

    this.executionTimeouts.set(executionId, timeout);
  }

  /**
   * Clear execution timeout
   */
  private clearExecutionTimeout(executionId: string): void {
    const timeout = this.executionTimeouts.get(executionId);
    if (timeout) {
      clearTimeout(timeout);
      this.executionTimeouts.delete(executionId);
    }
  }

  /**
   * Get default execution configuration
   */
  private getDefaultConfig(): MultiLegExecutionConfig {
    return {
      executionType: 'simultaneous',
      maxExecutionTime: 30, // 30 seconds
      allowPartialFills: true,
      minFillPercentage: 0.8, // 80% minimum fill
      priceTolerance: 0.02, // 2% price tolerance
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      cancelAllOnFailure: false
    };
  }

  /**
   * Generate execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate order ID
   */
  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate fill ID
   */
  private generateFillId(): string {
    return `fill_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}