/**
 * Risk Limits and Alerts Service
 * Implements configurable risk limits, monitoring, and alert system
 * Provides automatic risk reduction suggestions and actions
 */

import { 
  DerivativePosition, 
  OptionPosition, 
  FuturesPosition 
} from '@copytrade/shared-types';
import { PortfolioRisk, portfolioRiskCalculator } from './portfolioRiskCalculator';
import { MarginInfo, marginCalculatorService } from './marginCalculatorService';
import websocketService from './websocketService';

/**
 * Risk limit configuration
 */
export interface RiskLimits {
  /** User ID */
  userId: string;
  /** Broker ID */
  brokerId: string;
  /** Maximum position size per instrument (in value) */
  maxPositionSize: number;
  /** Maximum daily loss limit */
  maxDailyLoss: number;
  /** Maximum portfolio loss limit */
  maxPortfolioLoss: number;
  /** Maximum margin utilization percentage */
  maxMarginUtilization: number;
  /** Maximum Vega exposure */
  maxVegaExposure: number;
  /** Maximum Gamma exposure */
  maxGammaExposure: number;
  /** Maximum Delta exposure */
  maxDeltaExposure: number;
  /** Maximum concentration in single underlying (%) */
  maxConcentrationPercent: number;
  /** Maximum number of positions */
  maxPositions: number;
  /** Maximum Value at Risk */
  maxValueAtRisk: number;
  /** Risk limits enabled */
  enabled: boolean;
  /** Auto risk reduction enabled */
  autoRiskReduction: boolean;
  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Risk violation types
 */
export type RiskViolationType = 
  | 'position_size' 
  | 'daily_loss' 
  | 'portfolio_loss'
  | 'margin_utilization' 
  | 'vega_exposure' 
  | 'gamma_exposure'
  | 'delta_exposure'
  | 'concentration' 
  | 'position_count'
  | 'value_at_risk';

/**
 * Risk violation severity levels
 */
export type RiskViolationSeverity = 'warning' | 'error' | 'critical';

/**
 * Risk violation interface
 */
export interface RiskViolation {
  /** Violation ID */
  id: string;
  /** User ID */
  userId: string;
  /** Broker ID */
  brokerId: string;
  /** Violation type */
  type: RiskViolationType;
  /** Severity level */
  severity: RiskViolationSeverity;
  /** Violation message */
  message: string;
  /** Current value */
  currentValue: number;
  /** Limit value */
  limitValue: number;
  /** Violation percentage */
  violationPercent: number;
  /** Affected positions */
  affectedPositions: string[];
  /** Suggested actions */
  suggestedActions: RiskAction[];
  /** Auto remediation possible */
  autoRemediation: boolean;
  /** Violation timestamp */
  timestamp: Date;
  /** Resolution status */
  status: 'active' | 'acknowledged' | 'resolved';
  /** Resolution timestamp */
  resolvedAt?: Date;
}

/**
 * Risk action interface
 */
export interface RiskAction {
  /** Action type */
  type: 'reduce_position' | 'close_position' | 'add_hedge' | 'add_margin' | 'stop_trading';
  /** Action description */
  description: string;
  /** Priority level */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Estimated impact */
  estimatedImpact: number;
  /** Position ID if applicable */
  positionId?: string;
  /** Suggested quantity/amount */
  suggestedAmount?: number;
  /** Auto-executable */
  autoExecutable: boolean;
}

/**
 * Risk alert configuration
 */
export interface RiskAlertConfig {
  /** User ID */
  userId: string;
  /** Alert types enabled */
  enabledAlerts: RiskViolationType[];
  /** Warning thresholds (% of limit) */
  warningThresholds: { [key in RiskViolationType]?: number };
  /** Alert channels */
  alertChannels: AlertChannel[];
  /** Alert frequency limits */
  alertFrequency: { [key in RiskViolationType]?: number }; // minutes between alerts
  /** Last alert timestamps */
  lastAlerts: { [key in RiskViolationType]?: Date };
}

/**
 * Alert channel configuration
 */
export interface AlertChannel {
  /** Channel type */
  type: 'websocket' | 'email' | 'sms' | 'push';
  /** Channel enabled */
  enabled: boolean;
  /** Channel configuration */
  config: { [key: string]: any };
}

/**
 * Risk monitoring subscription
 */
interface RiskMonitoringSubscription {
  userId: string;
  brokerId: string;
  riskLimits: RiskLimits;
  alertConfig: RiskAlertConfig;
  lastCheck: Date;
  checkFrequency: number; // milliseconds
}

/**
 * Risk Limits and Alerts Service implementation
 */
export class RiskLimitsService {
  private riskLimits: Map<string, RiskLimits> = new Map();
  private alertConfigs: Map<string, RiskAlertConfig> = new Map();
  private activeViolations: Map<string, RiskViolation> = new Map();
  private monitoringSubscriptions: Map<string, RiskMonitoringSubscription> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  
  // Configuration
  private readonly MONITORING_FREQUENCY = 10000; // 10 seconds
  private readonly DEFAULT_WARNING_THRESHOLD = 80; // 80% of limit
  private readonly DEFAULT_ALERT_FREQUENCY = 300000; // 5 minutes between alerts
  
  // Default risk limits
  private readonly DEFAULT_RISK_LIMITS: Partial<RiskLimits> = {
    maxPositionSize: 1000000, // 10 lakh per position
    maxDailyLoss: 50000, // 50k daily loss
    maxPortfolioLoss: 200000, // 2 lakh portfolio loss
    maxMarginUtilization: 80, // 80% margin utilization
    maxVegaExposure: 10000, // 10k vega exposure
    maxGammaExposure: 1000, // 1k gamma exposure
    maxDeltaExposure: 50000, // 50k delta exposure
    maxConcentrationPercent: 50, // 50% in single underlying
    maxPositions: 50, // 50 positions max
    maxValueAtRisk: 100000, // 1 lakh VaR
    enabled: true,
    autoRiskReduction: false
  };

  /**
   * Initialize risk limits service
   */
  public initialize(): void {
    this.startRiskMonitoring();
    console.log('Risk Limits Service initialized');
  }

  /**
   * Set risk limits for a user
   */
  public setRiskLimits(
    userId: string,
    brokerId: string,
    limits: Partial<RiskLimits>
  ): RiskLimits {
    const riskLimitsKey = `${userId}-${brokerId}`;
    
    const riskLimits: RiskLimits = {
      userId,
      brokerId,
      ...this.DEFAULT_RISK_LIMITS,
      ...limits,
      lastUpdated: new Date()
    } as RiskLimits;

    this.riskLimits.set(riskLimitsKey, riskLimits);
    
    console.log(`Risk limits set for user ${userId}, broker ${brokerId}`);
    return riskLimits;
  }

  /**
   * Get risk limits for a user
   */
  public getRiskLimits(userId: string, brokerId: string): RiskLimits | null {
    const riskLimitsKey = `${userId}-${brokerId}`;
    return this.riskLimits.get(riskLimitsKey) || null;
  }

  /**
   * Configure risk alerts for a user
   */
  public configureRiskAlerts(
    userId: string,
    alertConfig: Partial<RiskAlertConfig>
  ): RiskAlertConfig {
    const config: RiskAlertConfig = {
      userId,
      enabledAlerts: [
        'position_size',
        'daily_loss',
        'margin_utilization',
        'concentration',
        'value_at_risk'
      ],
      warningThresholds: {
        position_size: this.DEFAULT_WARNING_THRESHOLD,
        daily_loss: this.DEFAULT_WARNING_THRESHOLD,
        margin_utilization: this.DEFAULT_WARNING_THRESHOLD,
        concentration: this.DEFAULT_WARNING_THRESHOLD,
        value_at_risk: this.DEFAULT_WARNING_THRESHOLD
      },
      alertChannels: [
        { type: 'websocket', enabled: true, config: {} }
      ],
      alertFrequency: {},
      lastAlerts: {},
      ...alertConfig
    };

    this.alertConfigs.set(userId, config);
    
    console.log(`Risk alert configuration set for user ${userId}`);
    return config;
  }

  /**
   * Subscribe to risk monitoring
   */
  public subscribeToRiskMonitoring(
    userId: string,
    brokerId: string,
    checkFrequency: number = this.MONITORING_FREQUENCY
  ): void {
    const subscriptionKey = `${userId}-${brokerId}`;
    const riskLimitsKey = `${userId}-${brokerId}`;
    
    const riskLimits = this.riskLimits.get(riskLimitsKey);
    const alertConfig = this.alertConfigs.get(userId);
    
    if (!riskLimits) {
      // Create default risk limits
      this.setRiskLimits(userId, brokerId, {});
    }
    
    if (!alertConfig) {
      // Create default alert config
      this.configureRiskAlerts(userId, {});
    }

    const subscription: RiskMonitoringSubscription = {
      userId,
      brokerId,
      riskLimits: this.riskLimits.get(riskLimitsKey)!,
      alertConfig: this.alertConfigs.get(userId)!,
      lastCheck: new Date(),
      checkFrequency
    };

    this.monitoringSubscriptions.set(subscriptionKey, subscription);
    
    console.log(`Risk monitoring subscription created for user ${userId}, broker ${brokerId}`);
  }

  /**
   * Unsubscribe from risk monitoring
   */
  public unsubscribeFromRiskMonitoring(userId: string, brokerId: string): void {
    const subscriptionKey = `${userId}-${brokerId}`;
    this.monitoringSubscriptions.delete(subscriptionKey);
    
    console.log(`Risk monitoring subscription removed for user ${userId}, broker ${brokerId}`);
  }

  /**
   * Check risk violations for positions
   */
  public checkRiskViolations(
    userId: string,
    brokerId: string,
    positions: DerivativePosition[],
    portfolioRisk: PortfolioRisk,
    marginInfo: MarginInfo,
    dailyPnL: number
  ): RiskViolation[] {
    const riskLimits = this.getRiskLimits(userId, brokerId);
    if (!riskLimits || !riskLimits.enabled) {
      return [];
    }

    const violations: RiskViolation[] = [];

    // Check position size limits
    violations.push(...this.checkPositionSizeLimits(userId, brokerId, positions, riskLimits));

    // Check daily loss limits
    violations.push(...this.checkDailyLossLimits(userId, brokerId, dailyPnL, riskLimits));

    // Check portfolio loss limits
    violations.push(...this.checkPortfolioLossLimits(userId, brokerId, portfolioRisk, riskLimits));

    // Check margin utilization limits
    violations.push(...this.checkMarginLimits(userId, brokerId, marginInfo, riskLimits));

    // Check Greeks exposure limits
    violations.push(...this.checkGreeksLimits(userId, brokerId, portfolioRisk, riskLimits));

    // Check concentration limits
    violations.push(...this.checkConcentrationLimits(userId, brokerId, portfolioRisk, riskLimits));

    // Check position count limits
    violations.push(...this.checkPositionCountLimits(userId, brokerId, positions, riskLimits));

    // Check VaR limits
    violations.push(...this.checkVaRLimits(userId, brokerId, portfolioRisk, riskLimits));

    // Store active violations
    violations.forEach(violation => {
      this.activeViolations.set(violation.id, violation);
    });

    return violations;
  }

  /**
   * Generate risk reduction suggestions
   */
  public generateRiskReductionSuggestions(
    positions: DerivativePosition[],
    violations: RiskViolation[]
  ): RiskAction[] {
    const suggestions: RiskAction[] = [];

    violations.forEach(violation => {
      switch (violation.type) {
        case 'position_size':
          suggestions.push(...this.suggestPositionSizeReduction(positions, violation));
          break;
        case 'daily_loss':
        case 'portfolio_loss':
          suggestions.push(...this.suggestLossReduction(positions, violation));
          break;
        case 'margin_utilization':
          suggestions.push(...this.suggestMarginReduction(positions, violation));
          break;
        case 'concentration':
          suggestions.push(...this.suggestDiversification(positions, violation));
          break;
        case 'vega_exposure':
        case 'gamma_exposure':
        case 'delta_exposure':
          suggestions.push(...this.suggestGreeksReduction(positions, violation));
          break;
        case 'value_at_risk':
          suggestions.push(...this.suggestVaRReduction(positions, violation));
          break;
      }
    });

    return suggestions;
  }

  /**
   * Execute automatic risk reduction
   */
  public async executeAutoRiskReduction(
    userId: string,
    brokerId: string,
    violations: RiskViolation[]
  ): Promise<boolean> {
    const riskLimits = this.getRiskLimits(userId, brokerId);
    if (!riskLimits || !riskLimits.autoRiskReduction) {
      return false;
    }

    // Only execute auto reduction for critical violations
    const criticalViolations = violations.filter(v => v.severity === 'critical' && v.autoRemediation);
    
    if (criticalViolations.length === 0) {
      return false;
    }

    try {
      // In a real implementation, this would execute actual trades
      // For now, we'll just log the actions
      for (const violation of criticalViolations) {
        const autoActions = violation.suggestedActions.filter(a => a.autoExecutable);
        
        for (const action of autoActions) {
          console.log(`Auto-executing risk reduction: ${action.description}`);
          // Execute the action (close positions, add hedges, etc.)
        }
      }

      return true;
    } catch (error) {
      console.error('Error executing auto risk reduction:', error);
      return false;
    }
  }

  /**
   * Get active violations for a user
   */
  public getActiveViolations(userId: string, brokerId?: string): RiskViolation[] {
    return Array.from(this.activeViolations.values()).filter(violation => {
      if (violation.userId !== userId) return false;
      if (brokerId && violation.brokerId !== brokerId) return false;
      return true; // Return all violations, not just active ones
    });
  }

  /**
   * Acknowledge risk violation
   */
  public acknowledgeViolation(violationId: string): boolean {
    const violation = this.activeViolations.get(violationId);
    if (!violation) return false;

    violation.status = 'acknowledged';
    this.activeViolations.set(violationId, violation);

    return true;
  }

  /**
   * Resolve risk violation
   */
  public resolveViolation(violationId: string): boolean {
    const violation = this.activeViolations.get(violationId);
    if (!violation) return false;

    violation.status = 'resolved';
    violation.resolvedAt = new Date();
    this.activeViolations.set(violationId, violation);

    return true;
  }

  /**
   * Check position size limits
   */
  private checkPositionSizeLimits(
    userId: string,
    brokerId: string,
    positions: DerivativePosition[],
    limits: RiskLimits
  ): RiskViolation[] {
    const violations: RiskViolation[] = [];

    positions.forEach(position => {
      const positionValue = Math.abs(position.positionValue);
      
      if (positionValue > limits.maxPositionSize) {
        const violationPercent = (positionValue / limits.maxPositionSize - 1) * 100;
        
        violations.push({
          id: `pos-size-${position.id}-${Date.now()}`,
          userId,
          brokerId,
          type: 'position_size',
          severity: violationPercent > 50 ? 'critical' : violationPercent > 20 ? 'error' : 'warning',
          message: `Position ${position.symbol} exceeds maximum size limit`,
          currentValue: positionValue,
          limitValue: limits.maxPositionSize,
          violationPercent,
          affectedPositions: [position.id],
          suggestedActions: [
            {
              type: 'reduce_position',
              description: `Reduce ${position.symbol} position by ${(positionValue - limits.maxPositionSize).toFixed(0)}`,
              priority: 'high',
              estimatedImpact: positionValue - limits.maxPositionSize,
              positionId: position.id,
              suggestedAmount: positionValue - limits.maxPositionSize,
              autoExecutable: false
            }
          ],
          autoRemediation: false,
          timestamp: new Date(),
          status: 'active'
        });
      }
    });

    return violations;
  }

  /**
   * Check daily loss limits
   */
  private checkDailyLossLimits(
    userId: string,
    brokerId: string,
    dailyPnL: number,
    limits: RiskLimits
  ): RiskViolation[] {
    const violations: RiskViolation[] = [];

    if (dailyPnL < -limits.maxDailyLoss) {
      const violationPercent = (Math.abs(dailyPnL) / limits.maxDailyLoss - 1) * 100;
      
      violations.push({
        id: `daily-loss-${userId}-${Date.now()}`,
        userId,
        brokerId,
        type: 'daily_loss',
        severity: violationPercent > 50 ? 'critical' : violationPercent > 20 ? 'error' : 'warning',
        message: `Daily loss exceeds maximum limit`,
        currentValue: Math.abs(dailyPnL),
        limitValue: limits.maxDailyLoss,
        violationPercent,
        affectedPositions: [],
        suggestedActions: [
          {
            type: 'stop_trading',
            description: 'Stop trading for the day',
            priority: 'critical',
            estimatedImpact: 0,
            autoExecutable: true
          },
          {
            type: 'close_position',
            description: 'Close losing positions',
            priority: 'high',
            estimatedImpact: Math.abs(dailyPnL) - limits.maxDailyLoss,
            autoExecutable: false
          }
        ],
        autoRemediation: true,
        timestamp: new Date(),
        status: 'active'
      });
    }

    return violations;
  }

  /**
   * Check portfolio loss limits
   */
  private checkPortfolioLossLimits(
    userId: string,
    brokerId: string,
    portfolioRisk: PortfolioRisk,
    limits: RiskLimits
  ): RiskViolation[] {
    const violations: RiskViolation[] = [];
    const totalUnrealizedLoss = Math.abs(Math.min(0, portfolioRisk.totalValue));

    if (totalUnrealizedLoss > limits.maxPortfolioLoss) {
      const violationPercent = (totalUnrealizedLoss / limits.maxPortfolioLoss - 1) * 100;
      
      violations.push({
        id: `portfolio-loss-${userId}-${Date.now()}`,
        userId,
        brokerId,
        type: 'portfolio_loss',
        severity: violationPercent > 50 ? 'critical' : violationPercent > 20 ? 'error' : 'warning',
        message: `Portfolio loss exceeds maximum limit`,
        currentValue: totalUnrealizedLoss,
        limitValue: limits.maxPortfolioLoss,
        violationPercent,
        affectedPositions: [],
        suggestedActions: [
          {
            type: 'close_position',
            description: 'Close losing positions to reduce portfolio loss',
            priority: 'high',
            estimatedImpact: totalUnrealizedLoss - limits.maxPortfolioLoss,
            autoExecutable: false
          }
        ],
        autoRemediation: false,
        timestamp: new Date(),
        status: 'active'
      });
    }

    return violations;
  }

  /**
   * Check margin utilization limits
   */
  private checkMarginLimits(
    userId: string,
    brokerId: string,
    marginInfo: MarginInfo,
    limits: RiskLimits
  ): RiskViolation[] {
    const violations: RiskViolation[] = [];

    if (marginInfo.marginUtilization > limits.maxMarginUtilization) {
      const violationPercent = (marginInfo.marginUtilization / limits.maxMarginUtilization - 1) * 100;
      
      violations.push({
        id: `margin-util-${userId}-${Date.now()}`,
        userId,
        brokerId,
        type: 'margin_utilization',
        severity: violationPercent > 25 ? 'critical' : violationPercent > 10 ? 'error' : 'warning',
        message: `Margin utilization exceeds maximum limit`,
        currentValue: marginInfo.marginUtilization,
        limitValue: limits.maxMarginUtilization,
        violationPercent,
        affectedPositions: [],
        suggestedActions: [
          {
            type: 'add_margin',
            description: 'Add funds to margin account',
            priority: 'high',
            estimatedImpact: (marginInfo.marginUtilization - limits.maxMarginUtilization) * marginInfo.totalEquity / 100,
            autoExecutable: false
          },
          {
            type: 'reduce_position',
            description: 'Reduce positions to free up margin',
            priority: 'medium',
            estimatedImpact: marginInfo.usedMargin * 0.2,
            autoExecutable: false
          }
        ],
        autoRemediation: false,
        timestamp: new Date(),
        status: 'active'
      });
    }

    return violations;
  }

  /**
   * Check Greeks exposure limits
   */
  private checkGreeksLimits(
    userId: string,
    brokerId: string,
    portfolioRisk: PortfolioRisk,
    limits: RiskLimits
  ): RiskViolation[] {
    const violations: RiskViolation[] = [];
    const { portfolioGreeks } = portfolioRisk;

    // Check Vega exposure
    if (Math.abs(portfolioGreeks.vega) > limits.maxVegaExposure) {
      violations.push(this.createGreeksViolation(
        userId, brokerId, 'vega_exposure', 
        Math.abs(portfolioGreeks.vega), limits.maxVegaExposure
      ));
    }

    // Check Gamma exposure
    if (Math.abs(portfolioGreeks.gamma) > limits.maxGammaExposure) {
      violations.push(this.createGreeksViolation(
        userId, brokerId, 'gamma_exposure',
        Math.abs(portfolioGreeks.gamma), limits.maxGammaExposure
      ));
    }

    // Check Delta exposure
    if (Math.abs(portfolioGreeks.delta) > limits.maxDeltaExposure) {
      violations.push(this.createGreeksViolation(
        userId, brokerId, 'delta_exposure',
        Math.abs(portfolioGreeks.delta), limits.maxDeltaExposure
      ));
    }

    return violations;
  }

  /**
   * Check concentration limits
   */
  private checkConcentrationLimits(
    userId: string,
    brokerId: string,
    portfolioRisk: PortfolioRisk,
    limits: RiskLimits
  ): RiskViolation[] {
    const violations: RiskViolation[] = [];

    if (portfolioRisk.concentrationRisk.largestPositionPercent > limits.maxConcentrationPercent) {
      const violationPercent = (portfolioRisk.concentrationRisk.largestPositionPercent / limits.maxConcentrationPercent - 1) * 100;
      
      violations.push({
        id: `concentration-${userId}-${Date.now()}`,
        userId,
        brokerId,
        type: 'concentration',
        severity: violationPercent > 50 ? 'critical' : violationPercent > 20 ? 'error' : 'warning',
        message: `Portfolio concentration exceeds maximum limit`,
        currentValue: portfolioRisk.concentrationRisk.largestPositionPercent,
        limitValue: limits.maxConcentrationPercent,
        violationPercent,
        affectedPositions: [],
        suggestedActions: [
          {
            type: 'reduce_position',
            description: 'Reduce largest positions to improve diversification',
            priority: 'medium',
            estimatedImpact: portfolioRisk.concentrationRisk.largestPositionPercent - limits.maxConcentrationPercent,
            autoExecutable: false
          }
        ],
        autoRemediation: false,
        timestamp: new Date(),
        status: 'active'
      });
    }

    return violations;
  }

  /**
   * Check position count limits
   */
  private checkPositionCountLimits(
    userId: string,
    brokerId: string,
    positions: DerivativePosition[],
    limits: RiskLimits
  ): RiskViolation[] {
    const violations: RiskViolation[] = [];

    if (positions.length > limits.maxPositions) {
      const violationPercent = (positions.length / limits.maxPositions - 1) * 100;
      
      violations.push({
        id: `position-count-${userId}-${Date.now()}`,
        userId,
        brokerId,
        type: 'position_count',
        severity: violationPercent > 50 ? 'critical' : violationPercent > 20 ? 'error' : 'warning',
        message: `Number of positions exceeds maximum limit`,
        currentValue: positions.length,
        limitValue: limits.maxPositions,
        violationPercent,
        affectedPositions: positions.map(p => p.id),
        suggestedActions: [
          {
            type: 'close_position',
            description: `Close ${positions.length - limits.maxPositions} positions`,
            priority: 'medium',
            estimatedImpact: positions.length - limits.maxPositions,
            autoExecutable: false
          }
        ],
        autoRemediation: false,
        timestamp: new Date(),
        status: 'active'
      });
    }

    return violations;
  }

  /**
   * Check VaR limits
   */
  private checkVaRLimits(
    userId: string,
    brokerId: string,
    portfolioRisk: PortfolioRisk,
    limits: RiskLimits
  ): RiskViolation[] {
    const violations: RiskViolation[] = [];

    if (portfolioRisk.valueAtRisk > limits.maxValueAtRisk) {
      const violationPercent = (portfolioRisk.valueAtRisk / limits.maxValueAtRisk - 1) * 100;
      
      violations.push({
        id: `var-${userId}-${Date.now()}`,
        userId,
        brokerId,
        type: 'value_at_risk',
        severity: violationPercent > 50 ? 'critical' : violationPercent > 20 ? 'error' : 'warning',
        message: `Value at Risk exceeds maximum limit`,
        currentValue: portfolioRisk.valueAtRisk,
        limitValue: limits.maxValueAtRisk,
        violationPercent,
        affectedPositions: [],
        suggestedActions: [
          {
            type: 'add_hedge',
            description: 'Add hedging positions to reduce portfolio risk',
            priority: 'high',
            estimatedImpact: portfolioRisk.valueAtRisk - limits.maxValueAtRisk,
            autoExecutable: false
          },
          {
            type: 'reduce_position',
            description: 'Reduce high-risk positions',
            priority: 'medium',
            estimatedImpact: portfolioRisk.valueAtRisk * 0.2,
            autoExecutable: false
          }
        ],
        autoRemediation: false,
        timestamp: new Date(),
        status: 'active'
      });
    }

    return violations;
  }

  /**
   * Create Greeks violation
   */
  private createGreeksViolation(
    userId: string,
    brokerId: string,
    type: RiskViolationType,
    currentValue: number,
    limitValue: number
  ): RiskViolation {
    const violationPercent = (currentValue / limitValue - 1) * 100;
    const greekName = type.replace('_exposure', '').toUpperCase();
    
    return {
      id: `${type}-${userId}-${Date.now()}`,
      userId,
      brokerId,
      type,
      severity: violationPercent > 50 ? 'critical' : violationPercent > 20 ? 'error' : 'warning',
      message: `${greekName} exposure exceeds maximum limit`,
      currentValue,
      limitValue,
      violationPercent,
      affectedPositions: [],
      suggestedActions: [
        {
          type: 'add_hedge',
          description: `Add positions to hedge ${greekName} exposure`,
          priority: 'high',
          estimatedImpact: currentValue - limitValue,
          autoExecutable: false
        }
      ],
      autoRemediation: false,
      timestamp: new Date(),
      status: 'active'
    };
  }

  /**
   * Suggest position size reduction
   */
  private suggestPositionSizeReduction(
    positions: DerivativePosition[],
    violation: RiskViolation
  ): RiskAction[] {
    const actions: RiskAction[] = [];
    const affectedPosition = positions.find(p => violation.affectedPositions.includes(p.id));
    
    if (affectedPosition) {
      const reductionAmount = violation.currentValue - violation.limitValue;
      
      actions.push({
        type: 'reduce_position',
        description: `Reduce ${affectedPosition.symbol} position by ${reductionAmount.toFixed(0)}`,
        priority: 'high',
        estimatedImpact: reductionAmount,
        positionId: affectedPosition.id,
        suggestedAmount: reductionAmount,
        autoExecutable: false
      });
    }

    return actions;
  }

  /**
   * Suggest loss reduction actions
   */
  private suggestLossReduction(
    positions: DerivativePosition[],
    violation: RiskViolation
  ): RiskAction[] {
    const actions: RiskAction[] = [];
    
    // Find losing positions
    const losingPositions = positions
      .filter(p => p.unrealizedPnL < 0)
      .sort((a, b) => a.unrealizedPnL - b.unrealizedPnL);

    if (losingPositions.length > 0) {
      const worstPosition = losingPositions[0]!;
      actions.push({
        type: 'close_position',
        description: `Close worst performing position: ${worstPosition.symbol}`,
        priority: 'high',
        estimatedImpact: Math.abs(worstPosition.unrealizedPnL),
        positionId: worstPosition.id,
        autoExecutable: false
      });
    }

    actions.push({
      type: 'stop_trading',
      description: 'Stop new position entries',
      priority: 'critical',
      estimatedImpact: 0,
      autoExecutable: true
    });

    return actions;
  }

  /**
   * Suggest margin reduction actions
   */
  private suggestMarginReduction(
    positions: DerivativePosition[],
    violation: RiskViolation
  ): RiskAction[] {
    const actions: RiskAction[] = [];
    
    actions.push({
      type: 'add_margin',
      description: 'Add funds to margin account',
      priority: 'high',
      estimatedImpact: violation.currentValue - violation.limitValue,
      autoExecutable: false
    });

    // Find high margin positions
    const highMarginPositions = positions
      .filter(p => p.marginUsed > 0)
      .sort((a, b) => b.marginUsed - a.marginUsed);

    if (highMarginPositions.length > 0) {
      const highestMarginPosition = highMarginPositions[0]!;
      actions.push({
        type: 'reduce_position',
        description: `Reduce highest margin position: ${highestMarginPosition.symbol}`,
        priority: 'medium',
        estimatedImpact: highestMarginPosition.marginUsed * 0.5,
        positionId: highestMarginPosition.id,
        autoExecutable: false
      });
    }

    return actions;
  }

  /**
   * Suggest diversification actions
   */
  private suggestDiversification(
    positions: DerivativePosition[],
    violation: RiskViolation
  ): RiskAction[] {
    const actions: RiskAction[] = [];
    
    // Group positions by underlying
    const underlyingGroups: { [underlying: string]: DerivativePosition[] } = {};
    positions.forEach(pos => {
      if (!underlyingGroups[pos.underlying]) {
        underlyingGroups[pos.underlying] = [];
      }
      underlyingGroups[pos.underlying]!.push(pos);
    });

    // Find most concentrated underlying
    const sortedUnderlyings = Object.entries(underlyingGroups)
      .sort((a, b) => b[1].length - a[1].length);

    if (sortedUnderlyings.length > 0) {
      const [underlying, underlyingPositions] = sortedUnderlyings[0]!;
      
      actions.push({
        type: 'reduce_position',
        description: `Reduce concentration in ${underlying}`,
        priority: 'medium',
        estimatedImpact: underlyingPositions.length * 0.2,
        autoExecutable: false
      });
    }

    return actions;
  }

  /**
   * Suggest Greeks reduction actions
   */
  private suggestGreeksReduction(
    positions: DerivativePosition[],
    violation: RiskViolation
  ): RiskAction[] {
    const actions: RiskAction[] = [];
    const greekType = violation.type.replace('_exposure', '');
    
    actions.push({
      type: 'add_hedge',
      description: `Add hedging positions to reduce ${greekType.toUpperCase()} exposure`,
      priority: 'high',
      estimatedImpact: violation.currentValue - violation.limitValue,
      autoExecutable: false
    });

    return actions;
  }

  /**
   * Suggest VaR reduction actions
   */
  private suggestVaRReduction(
    positions: DerivativePosition[],
    violation: RiskViolation
  ): RiskAction[] {
    const actions: RiskAction[] = [];
    
    actions.push({
      type: 'add_hedge',
      description: 'Add portfolio hedging to reduce overall risk',
      priority: 'high',
      estimatedImpact: violation.currentValue - violation.limitValue,
      autoExecutable: false
    });

    actions.push({
      type: 'reduce_position',
      description: 'Reduce high-risk positions',
      priority: 'medium',
      estimatedImpact: violation.currentValue * 0.3,
      autoExecutable: false
    });

    return actions;
  }

  /**
   * Start risk monitoring
   */
  private startRiskMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      await this.performRiskMonitoring();
    }, this.MONITORING_FREQUENCY);

    console.log(`Risk monitoring started with ${this.MONITORING_FREQUENCY}ms frequency`);
  }

  /**
   * Perform risk monitoring for all subscriptions
   */
  private async performRiskMonitoring(): Promise<void> {
    for (const [subscriptionKey, subscription] of this.monitoringSubscriptions.entries()) {
      try {
        // In a real implementation, this would fetch current positions and calculate risks
        // For now, we'll skip the actual monitoring logic
        console.debug(`Monitoring risks for ${subscriptionKey}`);
        
        subscription.lastCheck = new Date();
      } catch (error) {
        console.error(`Error in risk monitoring for ${subscriptionKey}:`, error);
      }
    }
  }

  /**
   * Send risk alert
   */
  private async sendRiskAlert(violation: RiskViolation): Promise<void> {
    const alertConfig = this.alertConfigs.get(violation.userId);
    if (!alertConfig || !alertConfig.enabledAlerts.includes(violation.type)) {
      return;
    }

    // Check alert frequency limits
    const lastAlert = alertConfig.lastAlerts[violation.type];
    const alertFrequency = alertConfig.alertFrequency[violation.type] || this.DEFAULT_ALERT_FREQUENCY;
    
    if (lastAlert && Date.now() - lastAlert.getTime() < alertFrequency) {
      return; // Skip alert due to frequency limit
    }

    // Send alerts through configured channels
    for (const channel of alertConfig.alertChannels) {
      if (!channel.enabled) continue;

      switch (channel.type) {
        case 'websocket':
          websocketService.sendToUser(violation.userId, 'risk_violation', {
            violation,
            timestamp: new Date()
          });
          break;
        case 'email':
          // Send email alert (implementation would depend on email service)
          console.log(`Email alert sent to user ${violation.userId}`);
          break;
        case 'sms':
          // Send SMS alert (implementation would depend on SMS service)
          console.log(`SMS alert sent to user ${violation.userId}`);
          break;
        case 'push':
          // Send push notification (implementation would depend on push service)
          console.log(`Push notification sent to user ${violation.userId}`);
          break;
      }
    }

    // Update last alert timestamp
    alertConfig.lastAlerts[violation.type] = new Date();
    this.alertConfigs.set(violation.userId, alertConfig);
  }

  /**
   * Get service statistics
   */
  public getStats() {
    return {
      riskLimitsCount: this.riskLimits.size,
      alertConfigsCount: this.alertConfigs.size,
      activeViolationsCount: this.activeViolations.size,
      monitoringSubscriptionsCount: this.monitoringSubscriptions.size,
      isMonitoring: this.monitoringInterval !== null,
      monitoringFrequency: this.MONITORING_FREQUENCY
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

    this.riskLimits.clear();
    this.alertConfigs.clear();
    this.activeViolations.clear();
    this.monitoringSubscriptions.clear();

    console.log('Risk Limits Service shutdown complete');
  }
}

// Create singleton instance
export const riskLimitsService = new RiskLimitsService();