import { StrategyBuilderService, StrategyType, DerivativeStrategy, StrategyLeg } from '../services/strategyBuilderService';

describe('StrategyBuilderService', () => {
  let strategyBuilder: StrategyBuilderService;

  beforeEach(() => {
    strategyBuilder = new StrategyBuilderService();
  });

  describe('Strategy Templates', () => {
    test('should return all strategy templates', () => {
      const templates = strategyBuilder.getStrategyTemplates();
      expect(templates.length).toBeGreaterThan(0);
      expect(templates.some(t => t.type === 'bull_call_spread')).toBe(true);
      expect(templates.some(t => t.type === 'long_straddle')).toBe(true);
      expect(templates.some(t => t.type === 'iron_condor')).toBe(true);
    });

    test('should get specific strategy template', () => {
      const template = strategyBuilder.getStrategyTemplate('bull_call_spread');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Bull Call Spread');
      expect(template?.marketOutlook).toBe('bullish');
      expect(template?.legTemplates).toHaveLength(2);
    });

    test('should return undefined for non-existent template', () => {
      const template = strategyBuilder.getStrategyTemplate('non_existent' as StrategyType);
      expect(template).toBeUndefined();
    });
  });

  describe('Strategy Creation', () => {
    test('should create strategy from bull call spread template', () => {
      const strategy = strategyBuilder.createStrategyFromTemplate(
        'bull_call_spread',
        'NIFTY',
        18000,
        50
      );

      expect(strategy.type).toBe('bull_call_spread');
      expect(strategy.underlying).toBe('NIFTY');
      expect(strategy.legs).toHaveLength(2);
      expect(strategy.status).toBe('draft');

      // Check legs
      const buyLeg = strategy.legs.find(leg => leg.action === 'buy');
      const sellLeg = strategy.legs.find(leg => leg.action === 'sell');

      expect(buyLeg).toBeDefined();
      expect(sellLeg).toBeDefined();
      expect(buyLeg?.optionType).toBe('call');
      expect(sellLeg?.optionType).toBe('call');
      expect(buyLeg?.strike).toBeLessThan(sellLeg?.strike || 0);
    });

    test('should create strategy from long straddle template', () => {
      const strategy = strategyBuilder.createStrategyFromTemplate(
        'long_straddle',
        'BANKNIFTY',
        42000,
        100
      );

      expect(strategy.type).toBe('long_straddle');
      expect(strategy.underlying).toBe('BANKNIFTY');
      expect(strategy.legs).toHaveLength(2);

      const callLeg = strategy.legs.find(leg => leg.optionType === 'call');
      const putLeg = strategy.legs.find(leg => leg.optionType === 'put');

      expect(callLeg).toBeDefined();
      expect(putLeg).toBeDefined();
      expect(callLeg?.action).toBe('buy');
      expect(putLeg?.action).toBe('buy');
      expect(callLeg?.strike).toBe(putLeg?.strike); // Same strike for straddle
    });

    test('should create custom strategy', () => {
      const strategy = strategyBuilder.createCustomStrategy(
        'My Custom Strategy',
        'RELIANCE',
        'Custom multi-leg strategy for RELIANCE'
      );

      expect(strategy.type).toBe('custom');
      expect(strategy.name).toBe('My Custom Strategy');
      expect(strategy.underlying).toBe('RELIANCE');
      expect(strategy.legs).toHaveLength(0);
      expect(strategy.status).toBe('draft');
    });

    test('should throw error for invalid template type', () => {
      expect(() => {
        strategyBuilder.createStrategyFromTemplate(
          'invalid_template' as StrategyType,
          'NIFTY',
          18000
        );
      }).toThrow('Strategy template not found: invalid_template');
    });
  });

  describe('Strategy Leg Management', () => {
    let strategy: DerivativeStrategy;
    let testLeg: StrategyLeg;

    beforeEach(() => {
      strategy = strategyBuilder.createCustomStrategy('Test Strategy', 'NIFTY');
      testLeg = {
        id: 'test_leg_1',
        instrumentType: 'option',
        symbol: 'NIFTY_CALL_18000',
        underlying: 'NIFTY',
        action: 'buy',
        quantity: 1,
        strike: 18000,
        optionType: 'call',
        expiryDate: new Date('2024-03-28'),
        orderType: 'market',
        limitPrice: undefined,
        marketPrice: 150,
        ratio: 1
      };
    });

    test('should add leg to strategy', () => {
      const updatedStrategy = strategyBuilder.addLegToStrategy(strategy, testLeg);
      
      expect(updatedStrategy.legs).toHaveLength(1);
      expect(updatedStrategy.legs[0]).toEqual(testLeg);
    });

    test('should remove leg from strategy', () => {
      let updatedStrategy = strategyBuilder.addLegToStrategy(strategy, testLeg);
      expect(updatedStrategy.legs).toHaveLength(1);

      updatedStrategy = strategyBuilder.removeLegFromStrategy(updatedStrategy, testLeg.id);
      expect(updatedStrategy.legs).toHaveLength(0);
    });

    test('should update leg in strategy', () => {
      let updatedStrategy = strategyBuilder.addLegToStrategy(strategy, testLeg);
      
      updatedStrategy = strategyBuilder.updateLegInStrategy(updatedStrategy, testLeg.id, {
        quantity: 2,
        marketPrice: 175
      });

      const updatedLeg = updatedStrategy.legs.find(leg => leg.id === testLeg.id);
      expect(updatedLeg?.quantity).toBe(2);
      expect(updatedLeg?.marketPrice).toBe(175);
    });

    test('should throw error when updating non-existent leg', () => {
      expect(() => {
        strategyBuilder.updateLegInStrategy(strategy, 'non_existent_leg', { quantity: 2 });
      }).toThrow('Leg not found: non_existent_leg');
    });
  });

  describe('Strategy Validation', () => {
    test('should validate valid strategy', () => {
      const strategy = strategyBuilder.createStrategyFromTemplate(
        'bull_call_spread',
        'NIFTY',
        18000
      );

      // Set market prices for legs
      strategy.legs.forEach(leg => {
        leg.marketPrice = 100;
      });

      const validation = strategyBuilder.validateStrategy(strategy);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect validation errors', () => {
      const strategy = strategyBuilder.createCustomStrategy('Invalid Strategy', '');
      
      const validation = strategyBuilder.validateStrategy(strategy);
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Underlying asset is required');
      expect(validation.errors).toContain('Strategy must have at least one leg');
    });

    test('should validate option leg requirements', () => {
      const strategy = strategyBuilder.createCustomStrategy('Test Strategy', 'NIFTY');
      
      const invalidLeg: StrategyLeg = {
        id: 'invalid_leg',
        instrumentType: 'option',
        symbol: '',
        underlying: 'NIFTY',
        action: 'buy',
        quantity: 0,
        strike: undefined,
        optionType: undefined,
        expiryDate: undefined,
        orderType: 'market',
        limitPrice: undefined,
        marketPrice: 100,
        ratio: 1
      };

      const updatedStrategy = strategyBuilder.addLegToStrategy(strategy, invalidLeg);
      const validation = strategyBuilder.validateStrategy(updatedStrategy);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Leg 1: Symbol is required');
      expect(validation.errors).toContain('Leg 1: Quantity must be positive');
      expect(validation.errors).toContain('Leg 1: Valid strike price is required for options');
      expect(validation.errors).toContain('Leg 1: Option type (call/put) is required');
    });
  });

  describe('Payoff Calculations', () => {
    test('should calculate bull call spread payoff', () => {
      const strategy = strategyBuilder.createStrategyFromTemplate(
        'bull_call_spread',
        'NIFTY',
        18000
      );

      // Set market prices
      if (strategy.legs[0]) strategy.legs[0].marketPrice = 200; // Buy 17950 call
      if (strategy.legs[1]) strategy.legs[1].marketPrice = 100; // Sell 18050 call

      const underlyingPrices = [17800, 17950, 18000, 18050, 18200];
      const payoffs = strategyBuilder.calculatePayoffAtExpiry(strategy, underlyingPrices);

      expect(payoffs).toHaveLength(5);
      expect(payoffs[0]?.price).toBe(17800);
      expect(payoffs[4]?.price).toBe(18200);

      // At 17800 (below both strikes): max loss
      expect(payoffs[0]?.payoff).toBeLessThan(0);
      
      // At 18200 (above both strikes): max profit
      expect(payoffs[4]?.payoff).toBeGreaterThan(payoffs[0]?.payoff || 0);
    });

    test('should calculate long straddle payoff', () => {
      const strategy = strategyBuilder.createStrategyFromTemplate(
        'long_straddle',
        'NIFTY',
        18000
      );

      // Set market prices
      strategy.legs.forEach(leg => {
        leg.marketPrice = 150;
      });

      const underlyingPrices = [17700, 17850, 18000, 18150, 18300];
      const payoffs = strategyBuilder.calculatePayoffAtExpiry(strategy, underlyingPrices);

      // At ATM (18000): maximum loss (premium paid)
      const atmPayoff = payoffs.find(p => p.price === 18000);
      expect(atmPayoff?.payoff).toBeLessThan(0);

      // At extremes: should be profitable
      const lowPayoff = payoffs.find(p => p.price === 17700);
      const highPayoff = payoffs.find(p => p.price === 18300);
      expect(lowPayoff?.payoff).toBeGreaterThan(atmPayoff?.payoff || 0);
      expect(highPayoff?.payoff).toBeGreaterThan(atmPayoff?.payoff || 0);
    });
  });

  describe('Risk Assessment', () => {
    test('should assess strategy risk correctly', () => {
      const strategy = strategyBuilder.createStrategyFromTemplate(
        'bull_call_spread',
        'NIFTY',
        18000
      );

      // Set market prices to create realistic scenario
      if (strategy.legs[0]) strategy.legs[0].marketPrice = 200;
      if (strategy.legs[1]) strategy.legs[1].marketPrice = 100;

      const validation = strategyBuilder.validateStrategy(strategy);
      const riskAssessment = validation.riskAssessment;

      expect(riskAssessment.riskLevel).toBeDefined();
      expect(riskAssessment.maxLossAmount).toBeGreaterThan(0);
      expect(riskAssessment.marginRequirement).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(riskAssessment.liquidityRisk);
      expect(['low', 'medium', 'high']).toContain(riskAssessment.timeDecayRisk);
      expect(['low', 'medium', 'high']).toContain(riskAssessment.volatilityRisk);
    });
  });
});