import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { derivativesBracketOrderService } from '../services/derivativesBracketOrderService';
import { userDatabase } from '../services/sqliteDatabase';
import type { 
  DerivativesBracketOrderRequest,
  BracketOrderModification 
} from '../services/derivativesBracketOrderService';

describe('DerivativesBracketOrderService', () => {
  const mockUserId = 1;
  const mockBrokerId = 'test-broker';

  beforeEach(async () => {
    // Clean up database before each test
    const db = userDatabase.getDatabase();
    // Disable foreign key constraints temporarily for cleanup
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec('DELETE FROM derivatives_orders');
    db.exec('DELETE FROM derivatives_bracket_orders');
    db.exec('PRAGMA foreign_keys = ON');
    
    // Clear the in-memory cache as well
    (derivativesBracketOrderService as any).activeBracketOrders.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createBracketOrder', () => {
    it('should create a basic bracket order with profit target and stop loss', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        profitTarget: 150,
        stopLoss: 80
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      expect(bracketOrder).toBeDefined();
      expect(bracketOrder.userId).toBe(mockUserId);
      expect(bracketOrder.brokerId).toBe(mockBrokerId);
      expect(bracketOrder.status).toBe('pending');
      expect(bracketOrder.parentOrder.symbol).toBe(request.symbol);
      expect(bracketOrder.parentOrder.quantity).toBe(request.quantity);
      expect(bracketOrder.parentOrder.price).toBe(request.price);
      expect(bracketOrder.profitTargetOrder).toBeDefined();
      expect(bracketOrder.profitTargetOrder!.price).toBe(request.profitTarget);
      expect(bracketOrder.profitTargetOrder!.transactionType).toBe('sell'); // Opposite of parent
      expect(bracketOrder.stopLossOrder).toBeDefined();
      expect(bracketOrder.stopLossOrder!.stopPrice).toBe(request.stopLoss);
      expect(bracketOrder.stopLossOrder!.transactionType).toBe('sell'); // Opposite of parent
    });

    it('should create bracket order with trailing stop', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000PE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'market',
        transactionType: 'sell',
        quantity: 25,
        trailingStop: {
          trailAmount: 10,
          initialTriggerPrice: 90
        }
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      expect(bracketOrder.trailingStopOrder).toBeDefined();
      expect(bracketOrder.trailingStopOrder!.trailAmount).toBe(10);
      expect(bracketOrder.trailingStopOrder!.trailTriggerPrice).toBe(90);
      expect(bracketOrder.trailingStopOrder!.transactionType).toBe('buy'); // Opposite of parent
      expect(bracketOrder.trailingStopOrder!.lowWaterMark).toBe(90); // For short position
    });

    it('should create bracket order with percentage-based trailing stop', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'BANKNIFTY24JAN45000CE',
        underlying: 'BANKNIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 15,
        price: 200,
        trailingStop: {
          trailPercent: 5,
          initialTriggerPrice: 180
        }
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      expect(bracketOrder.trailingStopOrder).toBeDefined();
      expect(bracketOrder.trailingStopOrder!.trailPercent).toBe(5);
      expect(bracketOrder.trailingStopOrder!.highWaterMark).toBe(180); // For long position
    });

    it('should handle market orders without price', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'market',
        transactionType: 'buy',
        quantity: 50,
        stopLoss: 80
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      expect(bracketOrder.parentOrder.orderType).toBe('market');
      expect(bracketOrder.parentOrder.price).toBeUndefined();
      expect(bracketOrder.stopLossOrder).toBeDefined();
    });
  });

  describe('getBracketOrder', () => {
    it('should retrieve bracket order by ID', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        profitTarget: 150
      };

      const createdOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);
      const retrievedOrder = derivativesBracketOrderService.getBracketOrder(createdOrder.id);

      expect(retrievedOrder).toBeDefined();
      expect(retrievedOrder!.id).toBe(createdOrder.id);
      expect(retrievedOrder!.parentOrder.symbol).toBe(request.symbol);
    });

    it('should return null for non-existent bracket order', () => {
      const result = derivativesBracketOrderService.getBracketOrder('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('getUserBracketOrders', () => {
    it('should return all bracket orders for a user', async () => {
      const request1: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        profitTarget: 150
      };

      const request2: DerivativesBracketOrderRequest = {
        symbol: 'BANKNIFTY24JAN45000PE',
        underlying: 'BANKNIFTY',
        brokerId: mockBrokerId,
        orderType: 'market',
        transactionType: 'sell',
        quantity: 25,
        stopLoss: 80
      };

      await derivativesBracketOrderService.createBracketOrder(mockUserId, request1);
      await derivativesBracketOrderService.createBracketOrder(mockUserId, request2);

      const userOrders = derivativesBracketOrderService.getUserBracketOrders(mockUserId);

      expect(userOrders).toHaveLength(2);
      expect(userOrders[0]?.userId).toBe(mockUserId);
      expect(userOrders[1]?.userId).toBe(mockUserId);
    });

    it('should return empty array for user with no orders', () => {
      const userOrders = derivativesBracketOrderService.getUserBracketOrders(999);
      expect(userOrders).toHaveLength(0);
    });
  });

  describe('handleParentOrderExecution', () => {
    it('should activate child orders when parent is fully executed', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        profitTarget: 150,
        stopLoss: 80
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      // Initially child orders should not be active
      expect(bracketOrder.profitTargetOrder!.isActive).toBe(false);
      expect(bracketOrder.stopLossOrder!.isActive).toBe(false);

      // Execute parent order fully
      await derivativesBracketOrderService.handleParentOrderExecution(
        bracketOrder.id,
        50, // Full quantity
        105  // Average fill price
      );

      const updatedOrder = derivativesBracketOrderService.getBracketOrder(bracketOrder.id);
      expect(updatedOrder!.status).toBe('active');
      expect(updatedOrder!.parentOrder.filledQuantity).toBe(50);
      expect(updatedOrder!.parentOrder.avgFillPrice).toBe(105);
      expect(updatedOrder!.profitTargetOrder!.isActive).toBe(true);
      expect(updatedOrder!.stopLossOrder!.isActive).toBe(true);
    });

    it('should set status to partially_filled for partial execution', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        profitTarget: 150
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      // Execute parent order partially
      await derivativesBracketOrderService.handleParentOrderExecution(
        bracketOrder.id,
        25, // Partial quantity
        105
      );

      const updatedOrder = derivativesBracketOrderService.getBracketOrder(bracketOrder.id);
      expect(updatedOrder!.status).toBe('partially_filled');
      expect(updatedOrder!.parentOrder.filledQuantity).toBe(25);
      expect(updatedOrder!.profitTargetOrder!.isActive).toBe(false); // Should not be active yet
    });
  });

  describe('updateTrailingStop', () => {
    it('should update trailing stop for long position when price moves up', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        trailingStop: {
          trailAmount: 10,
          initialTriggerPrice: 90
        }
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);
      
      // Activate the trailing stop (simulate parent execution)
      await derivativesBracketOrderService.handleParentOrderExecution(bracketOrder.id, 50, 100);

      // Update with higher price
      const updated = derivativesBracketOrderService.updateTrailingStop(bracketOrder.id, 120);

      expect(updated).toBe(true);
      const updatedOrder = derivativesBracketOrderService.getBracketOrder(bracketOrder.id);
      expect(updatedOrder!.trailingStopOrder!.highWaterMark).toBe(120);
      expect(updatedOrder!.trailingStopOrder!.trailTriggerPrice).toBe(110); // 120 - 10
    });

    it('should update trailing stop for short position when price moves down', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000PE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'sell',
        quantity: 50,
        price: 100,
        trailingStop: {
          trailAmount: 10,
          initialTriggerPrice: 110
        }
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);
      
      // Activate the trailing stop
      await derivativesBracketOrderService.handleParentOrderExecution(bracketOrder.id, 50, 100);

      // Update with lower price
      const updated = derivativesBracketOrderService.updateTrailingStop(bracketOrder.id, 80);

      expect(updated).toBe(true);
      const updatedOrder = derivativesBracketOrderService.getBracketOrder(bracketOrder.id);
      expect(updatedOrder!.trailingStopOrder!.lowWaterMark).toBe(80);
      expect(updatedOrder!.trailingStopOrder!.trailTriggerPrice).toBe(90); // 80 + 10
    });

    it('should use percentage-based trailing for percentage trail', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        trailingStop: {
          trailPercent: 10, // 10%
          initialTriggerPrice: 90
        }
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);
      
      // Activate the trailing stop
      await derivativesBracketOrderService.handleParentOrderExecution(bracketOrder.id, 50, 100);

      // Update with higher price
      const updated = derivativesBracketOrderService.updateTrailingStop(bracketOrder.id, 120);

      expect(updated).toBe(true);
      const updatedOrder = derivativesBracketOrderService.getBracketOrder(bracketOrder.id);
      expect(updatedOrder!.trailingStopOrder!.trailTriggerPrice).toBe(108); // 120 * 0.9
    });

    it('should not update trailing stop if price moves against position', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        trailingStop: {
          trailAmount: 10,
          initialTriggerPrice: 90
        }
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);
      
      // Activate the trailing stop
      await derivativesBracketOrderService.handleParentOrderExecution(bracketOrder.id, 50, 100);

      // Update with lower price (against long position)
      const updated = derivativesBracketOrderService.updateTrailingStop(bracketOrder.id, 80);

      expect(updated).toBe(false);
      const updatedOrder = derivativesBracketOrderService.getBracketOrder(bracketOrder.id);
      expect(updatedOrder!.trailingStopOrder!.trailTriggerPrice).toBe(90); // Should remain unchanged
    });
  });

  describe('modifyBracketOrder', () => {
    it('should modify profit target price', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        profitTarget: 150
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      const modification: BracketOrderModification = {
        bracketOrderId: bracketOrder.id,
        modificationType: 'profit_target',
        newPrice: 160
      };

      const success = await derivativesBracketOrderService.modifyBracketOrder(modification);

      expect(success).toBe(true);
      const updatedOrder = derivativesBracketOrderService.getBracketOrder(bracketOrder.id);
      expect(updatedOrder!.profitTargetOrder!.price).toBe(160);
    });

    it('should modify stop loss trigger price', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        stopLoss: 80
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      const modification: BracketOrderModification = {
        bracketOrderId: bracketOrder.id,
        modificationType: 'stop_loss',
        newTriggerPrice: 85
      };

      const success = await derivativesBracketOrderService.modifyBracketOrder(modification);

      expect(success).toBe(true);
      const updatedOrder = derivativesBracketOrderService.getBracketOrder(bracketOrder.id);
      expect(updatedOrder!.stopLossOrder!.stopPrice).toBe(85);
    });

    it('should modify trailing stop parameters', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        trailingStop: {
          trailAmount: 10,
          initialTriggerPrice: 90
        }
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      const modification: BracketOrderModification = {
        bracketOrderId: bracketOrder.id,
        modificationType: 'trailing_stop',
        newTrailAmount: 15,
        newTrailPercent: 5
      };

      const success = await derivativesBracketOrderService.modifyBracketOrder(modification);

      expect(success).toBe(true);
      const updatedOrder = derivativesBracketOrderService.getBracketOrder(bracketOrder.id);
      expect(updatedOrder!.trailingStopOrder!.trailAmount).toBe(15);
      expect(updatedOrder!.trailingStopOrder!.trailPercent).toBe(5);
    });
  });

  describe('cancelBracketOrder', () => {
    it('should cancel bracket order and all child orders', async () => {
      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        profitTarget: 150,
        stopLoss: 80
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      const success = await derivativesBracketOrderService.cancelBracketOrder(bracketOrder.id);

      expect(success).toBe(true);
      const updatedOrder = derivativesBracketOrderService.getBracketOrder(bracketOrder.id);
      expect(updatedOrder!.status).toBe('cancelled');
    });

    it('should return false for non-existent bracket order', async () => {
      const success = await derivativesBracketOrderService.cancelBracketOrder('non-existent-id');
      expect(success).toBe(false);
    });
  });

  describe('event emission', () => {
    it('should emit bracketOrderCreated event', async () => {
      const eventSpy = jest.fn();
      derivativesBracketOrderService.on('bracketOrderCreated', eventSpy);

      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        profitTarget: 150
      };

      await derivativesBracketOrderService.createBracketOrder(mockUserId, request);

      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('should emit parentOrderExecuted event', async () => {
      const eventSpy = jest.fn();
      derivativesBracketOrderService.on('parentOrderExecuted', eventSpy);

      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        profitTarget: 150
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);
      await derivativesBracketOrderService.handleParentOrderExecution(bracketOrder.id, 50, 105);

      expect(eventSpy).toHaveBeenCalledTimes(1);
    });

    it('should emit trailingStopUpdated event', async () => {
      const eventSpy = jest.fn();
      derivativesBracketOrderService.on('trailingStopUpdated', eventSpy);

      const request: DerivativesBracketOrderRequest = {
        symbol: 'NIFTY24JAN18000CE',
        underlying: 'NIFTY',
        brokerId: mockBrokerId,
        orderType: 'limit',
        transactionType: 'buy',
        quantity: 50,
        price: 100,
        trailingStop: {
          trailAmount: 10,
          initialTriggerPrice: 90
        }
      };

      const bracketOrder = await derivativesBracketOrderService.createBracketOrder(mockUserId, request);
      await derivativesBracketOrderService.handleParentOrderExecution(bracketOrder.id, 50, 100);
      derivativesBracketOrderService.updateTrailingStop(bracketOrder.id, 120);

      expect(eventSpy).toHaveBeenCalledTimes(1);
    });
  });
});