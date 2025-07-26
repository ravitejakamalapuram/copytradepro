import { orderStatusUpdateService } from '../services/orderStatusUpdateService';
import { userDatabase } from '../services/databaseCompatibility';
import websocketService from '../services/websocketService';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { afterEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../services/databaseCompatibility');
jest.mock('../services/websocketService');
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('OrderStatusUpdateService', () => {
  const mockOrderId = '507f1f77bcf86cd799439011';
  const mockUserId = 'user123';
  
  const mockOrderHistory = {
    id: mockOrderId,
    user_id: mockUserId,
    account_id: 'account123',
    broker_name: 'SHOONYA',
    broker_order_id: 'broker123',
    symbol: 'RELIANCE',
    action: 'BUY' as const,
    quantity: 100,
    price: 2500,
    order_type: 'LIMIT' as const,
    status: 'PLACED' as const,
    exchange: 'NSE',
    product_type: 'C',
    remarks: '',
    executed_at: '2024-01-01T10:00:00.000Z',
    created_at: '2024-01-01T10:00:00.000Z',
    executed_quantity: 0,
    average_price: 0,
    last_updated: '2024-01-01T10:00:00.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateOrderStatusComprehensive', () => {
    it('should update order status and broadcast changes successfully', async () => {
      // Mock database methods
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrderHistory);
      (userDatabase.updateOrderComprehensive as jest.Mock).mockResolvedValue({
        ...mockOrderHistory,
        status: 'EXECUTED',
        executed_quantity: 100,
        average_price: 2505,
        last_updated: '2024-01-01T10:05:00.000Z'
      });

      // Mock WebSocket service
      (websocketService.broadcastOrderStatusUpdate as jest.Mock).mockResolvedValue({
        success: true,
        retriesUsed: 0
      });

      const statusUpdate = {
        status: 'EXECUTED',
        executedQuantity: 100,
        averagePrice: 2505,
        updateTime: new Date('2024-01-01T10:05:00.000Z')
      };

      const result = await orderStatusUpdateService.updateOrderStatusComprehensive(
        mockOrderId,
        statusUpdate,
        mockUserId,
        {
          broadcastUpdate: true,
          requireAcknowledgment: false,
          maxBroadcastRetries: 3,
          skipIfUnchanged: true
        }
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.orderHistory?.status).toBe('EXECUTED');
      expect(result.broadcastResult?.success).toBe(true);

      // Verify database calls
      expect(userDatabase.getOrderHistoryById).toHaveBeenCalledWith(mockOrderId);
      expect(userDatabase.updateOrderComprehensive).toHaveBeenCalledWith(
        mockOrderId,
        expect.objectContaining({
          status: 'EXECUTED',
          executed_quantity: 100,
          average_price: 2505
        })
      );

      // Verify WebSocket broadcast
      expect(websocketService.broadcastOrderStatusUpdate).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          orderId: mockOrderId,
          status: 'EXECUTED',
          previousStatus: 'PLACED'
        }),
        expect.objectContaining({
          maxRetries: 3,
          requireAcknowledgment: false
        })
      );
    });

    it('should skip update when no changes detected', async () => {
      // Mock database methods - return same status
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrderHistory);

      const statusUpdate = {
        status: 'PLACED', // Same as current status
        executedQuantity: 0, // Same as current
        averagePrice: 0 // Same as current
      };

      const result = await orderStatusUpdateService.updateOrderStatusComprehensive(
        mockOrderId,
        statusUpdate,
        mockUserId,
        { skipIfUnchanged: true }
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.orderHistory?.status).toBe('PLACED');

      // Should not call update methods
      expect(userDatabase.updateOrderComprehensive).not.toHaveBeenCalled();
      expect(websocketService.broadcastOrderStatusUpdate).not.toHaveBeenCalled();
    });

    it('should handle database update failure', async () => {
      // Mock database methods
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrderHistory);
      (userDatabase.updateOrderComprehensive as jest.Mock).mockResolvedValue(null);

      const statusUpdate = {
        status: 'EXECUTED',
        executedQuantity: 100
      };

      const result = await orderStatusUpdateService.updateOrderStatusComprehensive(
        mockOrderId,
        statusUpdate,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.error).toBe('Database update failed');
    });

    it('should handle order not found', async () => {
      // Mock database methods
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(null);

      const statusUpdate = {
        status: 'EXECUTED'
      };

      const result = await orderStatusUpdateService.updateOrderStatusComprehensive(
        mockOrderId,
        statusUpdate,
        mockUserId
      );

      expect(result.success).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.error).toBe('Order not found');
    });
  });

  describe('updateOrderWithError', () => {
    it('should update order with error information successfully', async () => {
      // Mock database methods
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrderHistory);
      (userDatabase.updateOrderWithError as jest.Mock).mockResolvedValue(true);
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValueOnce(mockOrderHistory)
        .mockResolvedValueOnce({
          ...mockOrderHistory,
          status: 'FAILED',
          error_message: 'Insufficient funds',
          error_type: 'VALIDATION'
        });

      // Mock WebSocket service
      (websocketService.broadcastOrderStatusUpdate as jest.Mock).mockResolvedValue({
        success: true
      });

      const errorInfo = {
        status: 'FAILED',
        errorMessage: 'Insufficient funds',
        errorType: 'VALIDATION' as const,
        isRetryable: false
      };

      const result = await orderStatusUpdateService.updateOrderWithError(
        mockOrderId,
        errorInfo,
        mockUserId,
        { broadcastUpdate: true }
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);

      // Verify database calls
      expect(userDatabase.updateOrderWithError).toHaveBeenCalledWith(
        mockOrderId,
        expect.objectContaining({
          status: 'FAILED',
          error_message: 'Insufficient funds',
          error_type: 'VALIDATION',
          is_retryable: false
        })
      );
    });
  });

  describe('batchUpdateOrderStatus', () => {
    it('should update multiple orders successfully', async () => {
      const mockOrder1 = { ...mockOrderHistory, id: 'order1' };
      const mockOrder2 = { ...mockOrderHistory, id: 'order2' };

      // Mock database methods for both orders
      (userDatabase.getOrderHistoryById as jest.Mock)
        .mockResolvedValueOnce(mockOrder1)
        .mockResolvedValueOnce(mockOrder2);
      
      (userDatabase.updateOrderComprehensive as jest.Mock)
        .mockResolvedValueOnce({ ...mockOrder1, status: 'EXECUTED' })
        .mockResolvedValueOnce({ ...mockOrder2, status: 'CANCELLED' });

      // Mock WebSocket service
      (websocketService.broadcastOrderStatusUpdate as jest.Mock).mockResolvedValue({
        success: true
      });

      const updates = [
        {
          orderId: 'order1',
          statusUpdate: { status: 'EXECUTED', executedQuantity: 100 }
        },
        {
          orderId: 'order2',
          statusUpdate: { status: 'CANCELLED' }
        }
      ];

      const result = await orderStatusUpdateService.batchUpdateOrderStatus(
        updates,
        mockUserId,
        { broadcastUpdates: true }
      );

      expect(result.success).toBe(true);
      expect(result.totalUpdated).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]?.success).toBe(true);
      expect(result.results[1]?.success).toBe(true);
    });

    it('should handle partial failures in batch update', async () => {
      const mockOrder1 = { ...mockOrderHistory, id: 'order1' };

      // Mock database methods - first succeeds, second fails
      (userDatabase.getOrderHistoryById as jest.Mock)
        .mockResolvedValueOnce(mockOrder1)
        .mockResolvedValueOnce(null); // Order not found
      
      (userDatabase.updateOrderComprehensive as jest.Mock)
        .mockResolvedValueOnce({ ...mockOrder1, status: 'EXECUTED' });

      // Mock WebSocket service
      (websocketService.broadcastOrderStatusUpdate as jest.Mock).mockResolvedValue({
        success: true
      });

      const updates = [
        {
          orderId: 'order1',
          statusUpdate: { status: 'EXECUTED' }
        },
        {
          orderId: 'order2',
          statusUpdate: { status: 'CANCELLED' }
        }
      ];

      const result = await orderStatusUpdateService.batchUpdateOrderStatus(
        updates,
        mockUserId
      );

      expect(result.success).toBe(true);
      expect(result.totalUpdated).toBe(1);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]?.success).toBe(true);
      expect(result.results[1]?.success).toBe(false);
      expect(result.results[1]?.error).toBe('Order not found');
    });
  });
});