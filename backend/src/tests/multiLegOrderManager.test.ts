import { MultiLegOrderManager, MultiLegExecutionConfig } from '../services/multiLegOrderManager';
import { StrategyBuilderService, DerivativeStrategy, StrategyLeg } from '../services/strategyBuilderService';

describe('MultiLegOrderManager', () => {
  let orderManager: MultiLegOrderManager;
  let strategyBuilder: StrategyBuilderService;
  let testStrategy: DerivativeStrategy;

  beforeEach(() => {
    orderManager = new MultiLegOrderManager();
    strategyBuilder = new StrategyBuilderService();
    
    // Create a test strategy
    testStrategy = strategyBuilder.createStrategyFromTemplate(
      'bull_call_spread',
      'NIFTY',
      18000
    );

    // Set market prices for legs
    testStrategy.legs.forEach((leg, index) => {
      leg.marketPrice = 100 + index * 50; // Different prices for each leg
    });
  });

  describe('Strategy Execution', () => {
    test('should execute strategy successfully', async () => {
      const result = await orderManager.executeStrategy(testStrategy);

      expect(result.executionId).toBeDefined();
      expect(result.strategyId).toBe(testStrategy.id);
      expect(result.totalLegs).toBe(testStrategy.legs.length);
      expect(result.legResults).toHaveLength(testStrategy.legs.length);
      expect(result.startTime).toBeDefined();
      expect(result.endTime).toBeDefined();
      expect(['pending', 'partial', 'completed', 'failed', 'cancelled']).toContain(result.status);
    });

    test('should execute strategy with custom configuration', async () => {
      const config: MultiLegExecutionConfig = {
        executionType: 'sequential',
        maxExecutionTime: 60,
        allowPartialFills: false,
        minFillPercentage: 1.0,
        priceTolerance: 0.01,
        retryAttempts: 5,
        retryDelay: 500,
        cancelAllOnFailure: true
      };

      const result = await orderManager.executeStrategy(testStrategy, config);

      expect(result.executionId).toBeDefined();
      expect(result.legResults).toHaveLength(testStrategy.legs.length);
    });

    test('should handle strategy validation errors', async () => {
      // Create invalid strategy
      const invalidStrategy = strategyBuilder.createCustomStrategy('Invalid', 'NIFTY');
      
      const result = await orderManager.executeStrategy(invalidStrategy);

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('validation failed');
    });

    test('should handle empty strategy', async () => {
      const emptyStrategy = strategyBuilder.createCustomStrategy('Empty', 'NIFTY');
      
      const result = await orderManager.executeStrategy(emptyStrategy);

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toContain('no legs to execute');
    });
  });

  describe('Execution Management', () => {
    test('should track active executions', async () => {
      const activeExecutionsBefore = orderManager.getActiveExecutions();
      
      const executionPromise = orderManager.executeStrategy(testStrategy);
      
      // Check that execution is tracked while active
      const activeExecutionsDuring = orderManager.getActiveExecutions();
      expect(activeExecutionsDuring.length).toBeGreaterThan(activeExecutionsBefore.length);
      
      await executionPromise;
    });

    test('should get execution status', async () => {
      const result = await orderManager.executeStrategy(testStrategy);
      
      const status = orderManager.getExecutionStatus(result.executionId);
      expect(status).toBeDefined();
      expect(status?.executionId).toBe(result.executionId);
    });

    test('should return undefined for non-existent execution', () => {
      const status = orderManager.getExecutionStatus('non_existent_id');
      expect(status).toBeUndefined();
    });

    test('should cancel execution', async () => {
      // Start execution but don't wait for completion
      const executionPromise = orderManager.executeStrategy(testStrategy);
      
      // Get the execution ID
      const activeExecutions = orderManager.getActiveExecutions();
      expect(activeExecutions.length).toBeGreaterThan(0);
      
      const executionId = activeExecutions[0]?.executionId;
      expect(executionId).toBeDefined();
      
      // Cancel the execution
      const cancelled = await orderManager.cancelExecution(executionId!);
      expect(cancelled).toBe(true);
      
      // Wait for the original execution to complete
      const result = await executionPromise;
      expect(result.status).toBe('cancelled');
    });

    test('should return false when cancelling non-existent execution', async () => {
      const cancelled = await orderManager.cancelExecution('non_existent_id');
      expect(cancelled).toBe(false);
    });
  });

  describe('Partial Fill Handling', () => {
    test('should handle partial fills correctly', async () => {
      const result = await orderManager.executeStrategy(testStrategy);
      
      const legResult = result.legResults[0];
      if (legResult) {
        const partialFill = {
          fillId: 'test_fill_1',
          quantity: 50,
          price: 105,
          timestamp: new Date(),
          value: 50 * 105
        };

        await orderManager.handlePartialFill(result.executionId, legResult.legId, partialFill);

        const updatedStatus = orderManager.getExecutionStatus(result.executionId);
        const updatedLeg = updatedStatus?.legResults.find(leg => leg.legId === legResult.legId);
        
        expect(updatedLeg?.partialFills).toContain(partialFill);
        expect(updatedLeg?.filledQuantity).toBe(partialFill.quantity);
        expect(updatedLeg?.avgFillPrice).toBe(partialFill.price);
      }
    });

    test('should update leg status when fully filled through partial fills', async () => {
      const result = await orderManager.executeStrategy(testStrategy);
      
      const legResult = result.legResults[0];
      if (legResult && legResult.requestedQuantity > 0) {
        const partialFill = {
          fillId: 'test_fill_complete',
          quantity: legResult.requestedQuantity,
          price: 105,
          timestamp: new Date(),
          value: legResult.requestedQuantity * 105
        };

        await orderManager.handlePartialFill(result.executionId, legResult.legId, partialFill);

        const updatedStatus = orderManager.getExecutionStatus(result.executionId);
        const updatedLeg = updatedStatus?.legResults.find(leg => leg.legId === legResult.legId);
        
        expect(updatedLeg?.status).toBe('filled');
        expect(updatedLeg?.executionTime).toBeDefined();
      }
    });

    test('should handle partial fill for non-existent execution', async () => {
      const partialFill = {
        fillId: 'test_fill',
        quantity: 50,
        price: 105,
        timestamp: new Date(),
        value: 50 * 105
      };

      // Should not throw error
      await orderManager.handlePartialFill('non_existent_execution', 'non_existent_leg', partialFill);
    });
  });

  describe('Execution Types', () => {
    test('should execute simultaneous orders', async () => {
      const config: MultiLegExecutionConfig = {
        executionType: 'simultaneous',
        maxExecutionTime: 30,
        allowPartialFills: true,
        minFillPercentage: 0.8,
        priceTolerance: 0.02,
        retryAttempts: 3,
        retryDelay: 1000,
        cancelAllOnFailure: false
      };

      const result = await orderManager.executeStrategy(testStrategy, config);
      
      expect(result.legResults).toHaveLength(testStrategy.legs.length);
      // All legs should have been attempted
      expect(result.legResults.every(leg => leg.status !== 'pending')).toBe(true);
    });

    test('should execute sequential orders', async () => {
      const config: MultiLegExecutionConfig = {
        executionType: 'sequential',
        maxExecutionTime: 30,
        allowPartialFills: true,
        minFillPercentage: 0.8,
        priceTolerance: 0.02,
        retryAttempts: 3,
        retryDelay: 1000,
        cancelAllOnFailure: false
      };

      const result = await orderManager.executeStrategy(testStrategy, config);
      
      expect(result.legResults).toHaveLength(testStrategy.legs.length);
    });

    test('should execute conditional orders', async () => {
      const config: MultiLegExecutionConfig = {
        executionType: 'conditional',
        maxExecutionTime: 30,
        allowPartialFills: true,
        minFillPercentage: 0.8,
        priceTolerance: 0.02,
        retryAttempts: 3,
        retryDelay: 1000,
        cancelAllOnFailure: true
      };

      const result = await orderManager.executeStrategy(testStrategy, config);
      
      expect(result.legResults.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle execution timeout', async () => {
      const config: MultiLegExecutionConfig = {
        executionType: 'simultaneous',
        maxExecutionTime: 0.1, // Very short timeout
        allowPartialFills: true,
        minFillPercentage: 0.8,
        priceTolerance: 0.02,
        retryAttempts: 3,
        retryDelay: 1000,
        cancelAllOnFailure: false
      };

      const result = await orderManager.executeStrategy(testStrategy, config);
      
      // Should complete quickly due to timeout
      expect(result.endTime).toBeDefined();
    });

    test('should handle invalid leg data', async () => {
      // Create strategy with invalid leg data
      const invalidStrategy = strategyBuilder.createCustomStrategy('Invalid Legs', 'NIFTY');
      const invalidLeg: StrategyLeg = {
        id: 'invalid_leg',
        instrumentType: 'option',
        symbol: '',
        underlying: 'NIFTY',
        action: 'buy',
        quantity: -1, // Invalid quantity
        strike: 18000,
        optionType: 'call',
        expiryDate: new Date(),
        orderType: 'market',
        limitPrice: undefined,
        marketPrice: 0, // Invalid price
        ratio: 1
      };

      const updatedStrategy = strategyBuilder.addLegToStrategy(invalidStrategy, invalidLeg);
      const result = await orderManager.executeStrategy(updatedStrategy);

      expect(result.status).toBe('failed');
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe('Venue Selection', () => {
    test('should select execution venues for legs', async () => {
      const result = await orderManager.executeStrategy(testStrategy);
      
      // Each leg should have been assigned to a broker
      result.legResults.forEach(legResult => {
        expect(legResult.brokerId).toBeDefined();
        expect(legResult.orderId).toBeDefined();
      });
    });
  });

  describe('Net Premium Calculation', () => {
    test('should calculate net premium correctly', async () => {
      const result = await orderManager.executeStrategy(testStrategy);
      
      expect(typeof result.netPremium).toBe('number');
      // Net premium should be calculated based on filled orders
      if (result.status === 'completed') {
        expect(result.netPremium).not.toBe(0);
      }
    });
  });
});