import { orderStatusUpdateService } from '../services/orderStatusUpdateService';
import websocketService from '../services/websocketService';
import { userDatabase } from '../services/databaseCompatibility';

// Mock the database and websocket service
jest.mock('../services/databaseCompatibility');
jest.mock('../services/websocketService');

describe('Task 5: Database Update and WebSocket Broadcasting Integration', () => {
  const mockUserId = 'user123';
  const mockOrderId = '507f1f77bcf86cd799439011';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Order Status Update with Database and WebSocket Integration', () => {
    it('should update database and broadcast via WebSocket when status changes', async () => {
      // Mock current order
      const mockCurrentOrder = {
        id: mockOrderId,
        user_id: mockUserId,
        broker_order_id: 'BROKER123',
        status: 'PENDING',
        symbol: 'RELIANCE',
        quantity: 100,
        price: 2500,
        broker_name: 'shoonya',
        created_at: new Date().toISOString()
      };

      // Mock updated order
      const mockUpdatedOrder = {
        ...mockCurrentOrder,
        status: 'EXECUTED',
        executed_quantity: 100,
        average_price: 2505,
        last_updated: new Date()
      };

      // Setup mocks
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockCurrentOrder);
      (userDatabase.updateOrderComprehensive as jest.Mock).mockResolvedValue(mockUpdatedOrder);
      (websocketService.broadcastOrderStatusUpdate as jest.Mock).mockResolvedValue({
        success: true,
        retriesUsed: 0
      });

      // Execute the update
      const result = await orderStatusUpdateService.updateOrderStatusComprehensive(
        mockOrderId,
        {
          status: 'EXECUTED',
          executedQuantity: 100,
          averagePrice: 2505,
          updateTime: new Date()
        },
        mockUserId,
        {
          broadcastUpdate: true,
          requireAcknowledgment: false,
          maxBroadcastRetries: 3,
          skipIfUnchanged: true
        }
      );

      // Verify database update was called
      expect(userDatabase.getOrderHistoryById).toHaveBeenCalledWith(mockOrderId);
      expect(userDatabase.updateOrderComprehensive).toHaveBeenCalledWith(
        mockOrderId,
        expect.objectContaining({
          status: 'EXECUTED',
          executed_quantity: 100,
          average_price: 2505
        })
      );

      // Verify WebSocket broadcast was called
      expect(websocketService.broadcastOrderStatusUpdate).toHaveBeenCalledWith(
        mockUserId,
        expect.objectContaining({
          orderId: mockOrderId,
          brokerOrderId: 'BROKER123',
          status: 'EXECUTED',
          previousStatus: 'PENDING',
          executedQuantity: 100,
          averagePrice: 2505
        }),
        expect.objectContaining({
          maxRetries: 3,
          retryDelay: 1000,
          requireAcknowledgment: false
        })
      );

      // Verify result
      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.orderHistory).toEqual(mockUpdatedOrder);
      expect(result.broadcastResult?.success).toBe(true);
    });

    it('should handle database update failure gracefully', async () => {
      // Mock current order
      const mockCurrentOrder = {
        id: mockOrderId,
        user_id: mockUserId,
        broker_order_id: 'BROKER123',
        status: 'PENDING',
        symbol: 'RELIANCE',
        quantity: 100,
        price: 2500,
        broker_name: 'shoonya',
        created_at: new Date().toISOString()
      };

      // Setup mocks
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockCurrentOrder);
      (userDatabase.updateOrderComprehensive as jest.Mock).mockResolvedValue(null); // Simulate failure

      // Execute the update
      const result = await orderStatusUpdateService.updateOrderStatusComprehensive(
        mockOrderId,
        {
          status: 'EXECUTED',
          executedQuantity: 100,
          averagePrice: 2505,
          updateTime: new Date()
        },
        mockUserId,
        {
          broadcastUpdate: true,
          skipIfUnchanged: true
        }
      );

      // Verify database update was attempted
      expect(userDatabase.getOrderHistoryById).toHaveBeenCalledWith(mockOrderId);
      expect(userDatabase.updateOrderComprehensive).toHaveBeenCalled();

      // Verify WebSocket broadcast was NOT called due to database failure
      expect(websocketService.broadcastOrderStatusUpdate).not.toHaveBeenCalled();

      // Verify error result
      expect(result.success).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.error).toBe('Database update failed');
    });

    it('should handle WebSocket broadcast failure gracefully', async () => {
      // Mock current order
      const mockCurrentOrder = {
        id: mockOrderId,
        user_id: mockUserId,
        broker_order_id: 'BROKER123',
        status: 'PENDING',
        symbol: 'RELIANCE',
        quantity: 100,
        price: 2500,
        broker_name: 'shoonya',
        created_at: new Date().toISOString()
      };

      // Mock updated order
      const mockUpdatedOrder = {
        ...mockCurrentOrder,
        status: 'EXECUTED',
        executed_quantity: 100,
        average_price: 2505,
        last_updated: new Date()
      };

      // Setup mocks
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockCurrentOrder);
      (userDatabase.updateOrderComprehensive as jest.Mock).mockResolvedValue(mockUpdatedOrder);
      (websocketService.broadcastOrderStatusUpdate as jest.Mock).mockResolvedValue({
        success: false,
        error: 'WebSocket connection failed',
        retriesUsed: 3
      });

      // Execute the update
      const result = await orderStatusUpdateService.updateOrderStatusComprehensive(
        mockOrderId,
        {
          status: 'EXECUTED',
          executedQuantity: 100,
          averagePrice: 2505,
          updateTime: new Date()
        },
        mockUserId,
        {
          broadcastUpdate: true,
          requireAcknowledgment: false,
          maxBroadcastRetries: 3,
          skipIfUnchanged: true
        }
      );

      // Verify database update succeeded
      expect(userDatabase.updateOrderComprehensive).toHaveBeenCalled();

      // Verify WebSocket broadcast was attempted
      expect(websocketService.broadcastOrderStatusUpdate).toHaveBeenCalled();

      // Verify result shows success despite broadcast failure
      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.orderHistory).toEqual(mockUpdatedOrder);
      expect(result.broadcastResult?.success).toBe(false);
      expect(result.broadcastResult?.error).toBe('WebSocket connection failed');
    });

    it('should skip update when no changes detected', async () => {
      // Mock current order
      const mockCurrentOrder = {
        id: mockOrderId,
        user_id: mockUserId,
        broker_order_id: 'BROKER123',
        status: 'EXECUTED',
        symbol: 'RELIANCE',
        quantity: 100,
        price: 2500,
        broker_name: 'shoonya',
        executed_quantity: 100,
        average_price: 2505,
        created_at: new Date().toISOString()
      };

      // Setup mocks
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockCurrentOrder);

      // Execute the update with same status
      const result = await orderStatusUpdateService.updateOrderStatusComprehensive(
        mockOrderId,
        {
          status: 'EXECUTED', // Same status
          executedQuantity: 100, // Same quantity
          averagePrice: 2505, // Same price
          updateTime: new Date()
        },
        mockUserId,
        {
          broadcastUpdate: true,
          skipIfUnchanged: true
        }
      );

      // Verify database update was NOT called
      expect(userDatabase.updateOrderComprehensive).not.toHaveBeenCalled();

      // Verify WebSocket broadcast was NOT called
      expect(websocketService.broadcastOrderStatusUpdate).not.toHaveBeenCalled();

      // Verify result
      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.orderHistory).toEqual(mockCurrentOrder);
    });
  });

  describe('Error Handling with Database Updates', () => {
    it('should update order with error information and broadcast', async () => {
      // Mock current order
      const mockCurrentOrder = {
        id: mockOrderId,
        user_id: mockUserId,
        broker_order_id: 'BROKER123',
        status: 'PENDING',
        symbol: 'RELIANCE',
        quantity: 100,
        price: 2500,
        broker_name: 'shoonya',
        created_at: new Date().toISOString()
      };

      // Mock updated order with error
      const mockUpdatedOrder = {
        ...mockCurrentOrder,
        status: 'REJECTED',
        error_message: 'Insufficient funds',
        error_code: 'FUND_ERROR',
        error_type: 'VALIDATION',
        is_retryable: false,
        last_updated: new Date()
      };

      // Setup mocks
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockCurrentOrder);
      (userDatabase.updateOrderWithError as jest.Mock).mockResolvedValue(true);
      (userDatabase.getOrderHistoryById as jest.Mock)
        .mockResolvedValueOnce(mockCurrentOrder)
        .mockResolvedValueOnce(mockUpdatedOrder);
      (websocketService.broadcastOrderStatusUpdate as jest.Mock).mockResolvedValue({
        success: true,
        retriesUsed: 0
      });

      // Execute error update
      const result = await orderStatusUpdateService.updateOrderWithError(
        mockOrderId,
        {
          status: 'REJECTED',
          errorMessage: 'Insufficient funds',
          errorCode: 'FUND_ERROR',
          errorType: 'VALIDATION',
          isRetryable: false
        },
        mockUserId,
        {
          broadcastUpdate: true
        }
      );

      // Verify database error update was called
      expect(userDatabase.updateOrderWithError).toHaveBeenCalledWith(
        mockOrderId,
        expect.objectContaining({
          status: 'REJECTED',
          is_retryable: false
        })
      );

      // Verify WebSocket broadcast was called
      expect(websocketService.broadcastOrderStatusUpdate).toHaveBeenCalled();

      // Verify result
      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
    });
  });

  describe('Batch Updates with Broadcasting', () => {
    it('should handle batch updates with individual broadcasting', async () => {
      const mockOrder1 = {
        id: 'order1',
        user_id: mockUserId,
        broker_order_id: 'BROKER1',
        status: 'PENDING',
        symbol: 'RELIANCE',
        quantity: 100,
        price: 2500,
        broker_name: 'shoonya',
        created_at: new Date().toISOString()
      };

      const mockOrder2 = {
        id: 'order2',
        user_id: mockUserId,
        broker_order_id: 'BROKER2',
        status: 'PENDING',
        symbol: 'TCS',
        quantity: 50,
        price: 3500,
        broker_name: 'shoonya',
        created_at: new Date().toISOString()
      };

      // Setup mocks for batch processing
      (userDatabase.getOrderHistoryById as jest.Mock)
        .mockResolvedValueOnce(mockOrder1)
        .mockResolvedValueOnce(mockOrder2);
      
      (userDatabase.updateOrderComprehensive as jest.Mock)
        .mockResolvedValueOnce({ ...mockOrder1, status: 'EXECUTED' })
        .mockResolvedValueOnce({ ...mockOrder2, status: 'EXECUTED' });

      (websocketService.broadcastOrderStatusUpdate as jest.Mock).mockResolvedValue({
        success: true,
        retriesUsed: 0
      });

      // Execute batch update
      const result = await orderStatusUpdateService.batchUpdateOrderStatus(
        [
          {
            orderId: 'order1',
            statusUpdate: { status: 'EXECUTED', executedQuantity: 100, averagePrice: 2505 }
          },
          {
            orderId: 'order2',
            statusUpdate: { status: 'EXECUTED', executedQuantity: 50, averagePrice: 3510 }
          }
        ],
        mockUserId,
        {
          broadcastUpdates: true
        }
      );

      // Verify both orders were processed
      expect(result.success).toBe(true);
      expect(result.totalUpdated).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0]?.success).toBe(true);
      expect(result.results[1]?.success).toBe(true);

      // Verify WebSocket broadcast was called for each order
      expect(websocketService.broadcastOrderStatusUpdate).toHaveBeenCalledTimes(2);
    });
  });
});