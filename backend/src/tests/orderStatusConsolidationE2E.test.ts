/**
 * End-to-End Integration Tests for Order Status Consolidation
 * Tests complete order status flow from API request to database update
 * Requirements: 1.3, 1.4, 2.3
 */

import { describe, test, expect, beforeEach, afterEach, jest, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { Server } from 'http';
import { checkOrderStatus } from '../controllers/brokerController';
import { userDatabase } from '../services/databaseCompatibility';
import { BrokerConnectionHelper } from '../helpers/brokerConnectionHelper';
import { orderStatusUpdateService } from '../services/orderStatusUpdateService';
import websocketService from '../services/websocketService';

// Mock dependencies
jest.mock('../services/databaseCompatibility');
jest.mock('../helpers/brokerConnectionHelper');
jest.mock('../services/orderStatusUpdateService');
jest.mock('../services/websocketService');

const mockUserDatabase = userDatabase as jest.Mocked<typeof userDatabase>;
const mockBrokerConnectionHelper = BrokerConnectionHelper as jest.Mocked<typeof BrokerConnectionHelper>;
const mockOrderStatusUpdateService = orderStatusUpdateService as jest.Mocked<typeof orderStatusUpdateService>;
const mockWebsocketService = websocketService as jest.Mocked<typeof websocketService>;

describe('Order Status Consolidation E2E Integration Tests', () => {
  let app: Express;
  let server: Server | undefined;

  // Helper function to create consistent mock orders
  const createMockOrder = (overrides: any = {}) => ({
    id: '507f1f77bcf86cd799439011',
    user_id: 'user123',
    account_id: 'account123',
    broker_name: 'shoonya',
    broker_order_id: 'BROKER123',
    symbol: 'RELIANCE',
    action: 'BUY' as const,
    quantity: 100,
    price: 2500,
    order_type: 'LIMIT' as const,
    status: 'PENDING' as const,
    exchange: 'NSE',
    product_type: 'CNC',
    remarks: 'Test order',
    executed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides
  });

  // Helper function to create mock broker service
  const createMockBrokerService = (orderStatusResponse: any) => ({
    getOrderStatus: jest.fn().mockResolvedValue(orderStatusResponse),
    validateSession: jest.fn().mockResolvedValue(true),
    placeOrder: jest.fn(),
    getOrderHistory: jest.fn(),
    getPositions: jest.fn(),
    getHoldings: jest.fn(),
    getFunds: jest.fn(),
    getQuote: jest.fn()
  } as any);

  beforeAll(() => {
    // Setup global test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret';
  });

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Add auth middleware mock
    app.use((req: any, res, next) => {
      req.user = { id: 'user123', email: 'test@example.com', name: 'Test User' };
      req.headers = { 'x-request-id': 'test-request-123' };
      next();
    });
    
    app.post('/check-order-status', checkOrderStatus);

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up if server was started
    if (server && server.listening) {
      server.close();
    }
  });

  afterAll(() => {
    // Cleanup global test environment
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
  });

  describe('Complete Order Status Flow - End to End', () => {
    test('should handle complete end-to-end order status check with database update and WebSocket broadcast', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439011';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER123',
        status: 'PENDING'
      });

      const mockBrokerStatus = {
        stat: 'Ok',
        status: 'COMPLETED',
        executedQuantity: 100,
        averagePrice: 2505,
        updateTime: new Date().toISOString(),
        rejectionReason: null
      };

      // Mock database lookup
      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      // Mock broker connection and status retrieval
      const mockBrokerService = createMockBrokerService(mockBrokerStatus);
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      // Mock status update service
      (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
        success: true,
        updated: true,
        orderHistory: { ...mockOrder, status: 'COMPLETED' },
        broadcastResult: {
          success: true,
          retriesUsed: 0
        }
      });

      // Mock WebSocket broadcasting
      (mockWebsocketService.broadcastOrderStatusUpdate as any).mockResolvedValue({
        success: true
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: expect.objectContaining({
          orderId: mockOrder.id,
          brokerOrderId: mockOrder.broker_order_id,
          status: mockBrokerStatus.status,
          symbol: mockOrder.symbol,
          quantity: mockOrder.quantity,
          filledQuantity: mockBrokerStatus.executedQuantity,
          price: mockOrder.price,
          averagePrice: mockBrokerStatus.averagePrice,
          brokerName: mockOrder.broker_name,
          statusChanged: true,
          previousStatus: 'PENDING'
        })
      });

      // Verify complete flow was executed
      expect(mockUserDatabase.getOrderHistoryById).toHaveBeenCalledWith(orderId);
      expect(mockBrokerConnectionHelper.findBrokerConnection).toHaveBeenCalledWith('user123', 'shoonya', 'account123');
      expect(mockBrokerService.getOrderStatus).toHaveBeenCalledWith('user123', 'BROKER123');
      expect(mockOrderStatusUpdateService.updateOrderStatusComprehensive).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          status: mockBrokerStatus.status,
          executedQuantity: mockBrokerStatus.executedQuantity,
          averagePrice: mockBrokerStatus.averagePrice
        }),
        'user123',
        expect.objectContaining({
          broadcastUpdate: true
        })
      );
    });

    test('should handle order lookup by broker order ID when internal ID not found', async () => {
      // Arrange
      const brokerOrderId = 'BROKER456';
      const mockOrder = createMockOrder({
        id: '507f1f77bcf86cd799439012',
        broker_name: 'fyers',
        broker_order_id: brokerOrderId,
        symbol: 'INFY',
        quantity: 50,
        price: 1500,
        status: 'EXECUTED' as const,
        account_id: 'account456'
      });

      const mockBrokerStatus = {
        stat: 'Ok',
        status: 'EXECUTED',
        executedQuantity: 50,
        averagePrice: 1502,
        updateTime: new Date().toISOString(),
        rejectionReason: null
      };

      // Mock database lookup - first call returns null, second returns order
      mockUserDatabase.getOrderHistoryById.mockResolvedValue(null);
      mockUserDatabase.getOrderHistoryByBrokerOrderId.mockResolvedValue(mockOrder);
      
      // Mock broker service
      const mockBrokerService = createMockBrokerService(mockBrokerStatus);
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      // Mock no status update needed (status unchanged)
      (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
        success: true,
        updated: false,
        orderHistory: mockOrder
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId: brokerOrderId, brokerName: 'fyers' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.brokerOrderId).toBe(mockOrder.broker_order_id);

      // Verify both database lookup methods were called
      expect(mockUserDatabase.getOrderHistoryById).toHaveBeenCalledWith(brokerOrderId);
      expect(mockUserDatabase.getOrderHistoryByBrokerOrderId).toHaveBeenCalledWith(brokerOrderId);
      
      // Verify WebSocket was not called since status didn't change
      expect(mockWebsocketService.broadcastOrderStatusUpdate).not.toHaveBeenCalled();
    });

    test('should handle database update failure gracefully while still returning broker status', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439013';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER789',
        status: 'PENDING'
      });

      const mockBrokerStatus = {
        stat: 'Ok',
        status: 'COMPLETED',
        executedQuantity: 100,
        averagePrice: 2505,
        updateTime: new Date().toISOString(),
        rejectionReason: null
      };

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      const mockBrokerService = createMockBrokerService(mockBrokerStatus);
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      // Mock database update failure
      (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
        success: false,
        updated: false,
        error: 'Database update failed'
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });

      // Assert - Should return error when database update fails
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Multiple Broker Types Consistency', () => {
    const brokerTestCases = [
      {
        brokerName: 'shoonya',
        orderId: '507f1f77bcf86cd799439013',
        brokerOrderId: 'SHOONYA123',
        accountId: 'SHOONYA_ACC_123'
      },
      {
        brokerName: 'fyers',
        orderId: '507f1f77bcf86cd799439014',
        brokerOrderId: 'FYERS456',
        accountId: 'FYERS_ACC_456'
      },
      {
        brokerName: 'zerodha',
        orderId: '507f1f77bcf86cd799439015',
        brokerOrderId: 'ZERODHA789',
        accountId: 'ZERODHA_ACC_789'
      }
    ];

    brokerTestCases.forEach(({ brokerName, orderId, brokerOrderId, accountId }) => {
      test(`should handle ${brokerName} broker consistently with standardized response format`, async () => {
        // Arrange
        const mockOrder = createMockOrder({
          id: orderId,
          broker_name: brokerName,
          broker_order_id: brokerOrderId,
          account_id: accountId
        });

        const mockBrokerStatus = {
          stat: 'Ok',
          status: 'COMPLETED',
          executedQuantity: 100,
          averagePrice: 2505,
          updateTime: new Date().toISOString(),
          rejectionReason: null
        };

        mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
        
        const mockBrokerService = createMockBrokerService(mockBrokerStatus);
        (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
          success: true,
          connection: mockBrokerService
        });

        (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
          success: true,
          updated: true,
          orderHistory: { ...mockOrder, status: 'COMPLETED' },
          broadcastResult: { success: true }
        });

        (mockWebsocketService.broadcastOrderStatusUpdate as any).mockResolvedValue({
          success: true
        });

        // Act
        const response = await request(app)
          .post('/check-order-status')
          .send({ orderId, brokerName });

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.brokerName).toBe(brokerName);
        
        // Verify consistent behavior across brokers
        expect(mockBrokerConnectionHelper.findBrokerConnection).toHaveBeenCalledWith('user123', brokerName, accountId);
        expect(mockBrokerService.getOrderStatus).toHaveBeenCalledWith('user123', brokerOrderId);
        expect(mockWebsocketService.broadcastOrderStatusUpdate).toHaveBeenCalled();

        // Verify response structure is consistent
        expect(response.body.data).toEqual(expect.objectContaining({
          orderId: expect.any(String),
          brokerOrderId: expect.any(String),
          status: expect.any(String),
          symbol: expect.any(String),
          quantity: expect.any(Number),
          filledQuantity: expect.any(Number),
          price: expect.any(Number),
          averagePrice: expect.any(Number),
          brokerName: expect.any(String),
          statusChanged: expect.any(Boolean)
        }));
      });
    });

    test('should handle broker-specific error responses consistently', async () => {
      const brokerErrorTestCases = [
        {
          brokerName: 'shoonya',
          error: new Error('Shoonya API rate limit exceeded'),
          expectedErrorCode: 'BROKER_ERROR'
        },
        {
          brokerName: 'fyers',
          error: new Error('Fyers session expired'),
          expectedErrorCode: 'BROKER_ERROR'
        },
        {
          brokerName: 'zerodha',
          error: new Error('Zerodha server maintenance'),
          expectedErrorCode: 'BROKER_ERROR'
        }
      ];

      for (const { brokerName, error, expectedErrorCode } of brokerErrorTestCases) {
        const orderId = `507f1f77bcf86cd79943901${Math.floor(Math.random() * 10)}`;
        const mockOrder = createMockOrder({
          id: orderId,
          broker_name: brokerName,
          broker_order_id: `${brokerName.toUpperCase()}_ORDER_123`
        });

        mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
        
        const mockBrokerService = {
          getOrderStatus: jest.fn().mockRejectedValue(error)
        };
        
        (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
          success: true,
          connection: mockBrokerService
        });

        const response = await request(app)
          .post('/check-order-status')
          .send({ orderId, brokerName });

        expect(response.status).toBe(500);
        expect(response.body.success).toBe(false);
        expect(response.body.error).toBeDefined();
      }
    });
  });

  describe('WebSocket Broadcasting Functionality', () => {
    test('should broadcast order updates via WebSocket when status changes', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439016';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER789',
        status: 'PENDING'
      });

      const mockBrokerStatus = {
        stat: 'Ok',
        status: 'REJECTED',
        executedQuantity: 0,
        averagePrice: 0,
        updateTime: new Date().toISOString(),
        rejectionReason: 'Insufficient funds'
      };

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      const mockBrokerService = createMockBrokerService(mockBrokerStatus);
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
        success: true,
        updated: true,
        orderHistory: { ...mockOrder, status: 'REJECTED' },
        broadcastResult: {
          success: true,
          retriesUsed: 1
        }
      });

      (mockWebsocketService.broadcastOrderStatusUpdate as any).mockResolvedValue({
        success: true
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('REJECTED');
      expect(response.body.data.rejectionReason).toBe('Insufficient funds');
      expect(response.body.data.statusChanged).toBe(true);

      // Verify WebSocket broadcast was called through the update service
      expect(mockOrderStatusUpdateService.updateOrderStatusComprehensive).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          status: mockBrokerStatus.status,
          rejectionReason: mockBrokerStatus.rejectionReason
        }),
        'user123',
        expect.objectContaining({
          broadcastUpdate: true
        })
      );
    });

    test('should not broadcast when status has not changed', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439017';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_name: 'fyers',
        broker_order_id: 'BROKER999',
        symbol: 'INFY',
        quantity: 50,
        price: 1500,
        status: 'EXECUTED' as const,
        account_id: 'account456'
      });

      const mockBrokerStatus = {
        stat: 'Ok',
        status: 'EXECUTED', // Same status as in database
        executedQuantity: 50,
        averagePrice: 1502,
        updateTime: new Date().toISOString(),
        rejectionReason: null
      };

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      const mockBrokerService = createMockBrokerService(mockBrokerStatus);
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      // No update needed since status is the same
      (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
        success: true,
        updated: false,
        orderHistory: mockOrder
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'fyers' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.statusChanged).toBe(false);

      // Verify update service was called but with skipIfUnchanged option
      expect(mockOrderStatusUpdateService.updateOrderStatusComprehensive).toHaveBeenCalledWith(
        mockOrder.id,
        expect.any(Object),
        'user123',
        expect.objectContaining({
          skipIfUnchanged: true
        })
      );
    });

    test('should handle WebSocket broadcasting errors gracefully', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439018';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER888',
        status: 'PENDING'
      });

      const mockBrokerStatus = {
        stat: 'Ok',
        status: 'COMPLETED',
        executedQuantity: 100,
        averagePrice: 2505,
        updateTime: new Date().toISOString(),
        rejectionReason: null
      };

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      const mockBrokerService = createMockBrokerService(mockBrokerStatus);
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      // Mock WebSocket broadcasting failure but successful database update
      (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
        success: true,
        updated: true,
        orderHistory: { ...mockOrder, status: 'COMPLETED' },
        broadcastResult: {
          success: false,
          error: 'WebSocket connection failed',
          retriesUsed: 3
        }
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });

      // Assert - Should still return success even if WebSocket fails
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');
      expect(response.body.data.statusChanged).toBe(true);

      // Verify update service was called and handled WebSocket failure
      expect(mockOrderStatusUpdateService.updateOrderStatusComprehensive).toHaveBeenCalled();
    });

    test('should handle multiple concurrent WebSocket broadcasts', async () => {
      // Arrange
      const orderIds = [
        '507f1f77bcf86cd799439025',
        '507f1f77bcf86cd799439026',
        '507f1f77bcf86cd799439027'
      ];

      const mockOrders = orderIds.map((id, index) => createMockOrder({
        id,
        broker_order_id: `BROKER_${id.slice(-3)}`,
        status: 'PENDING'
      }));

      const mockBrokerStatus = {
        stat: 'Ok',
        status: 'COMPLETED',
        executedQuantity: 100,
        averagePrice: 2505,
        updateTime: new Date().toISOString(),
        rejectionReason: null
      };

      // Setup mocks for all orders
      mockUserDatabase.getOrderHistoryById
        .mockResolvedValueOnce(mockOrders[0])
        .mockResolvedValueOnce(mockOrders[1])
        .mockResolvedValueOnce(mockOrders[2]);
      
      const mockBrokerService = createMockBrokerService(mockBrokerStatus);
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
        success: true,
        updated: true,
        orderHistory: mockOrders[0],
        broadcastResult: { success: true }
      });

      // Act - Send concurrent requests
      const promises = orderIds.map(orderId =>
        request(app)
          .post('/check-order-status')
          .send({ orderId, brokerName: 'shoonya' })
      );

      const responses = await Promise.all(promises);

      // Assert
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.orderId).toBe(orderIds[index]);
      });

      // Verify all database calls were made
      expect(mockUserDatabase.getOrderHistoryById).toHaveBeenCalledTimes(3);
      expect(mockOrderStatusUpdateService.updateOrderStatusComprehensive).toHaveBeenCalledTimes(3);
    });
  });

  describe('POST Endpoint Only Validation', () => {
    test('should only accept POST requests to /check-order-status', async () => {
      // Test that GET request is not supported
      const getResponse = await request(app)
        .get('/check-order-status');

      expect(getResponse.status).toBe(404);

      // Test that PUT request is not supported
      const putResponse = await request(app)
        .put('/check-order-status')
        .send({ orderId: 'test' });

      expect(putResponse.status).toBe(404);

      // Test that DELETE request is not supported
      const deleteResponse = await request(app)
        .delete('/check-order-status');

      expect(deleteResponse.status).toBe(404);

      // Test that PATCH request is not supported
      const patchResponse = await request(app)
        .patch('/check-order-status')
        .send({ orderId: 'test' });

      expect(patchResponse.status).toBe(404);
    });

    test('should accept POST requests with proper payload structure', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439020';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_name: 'fyers',
        broker_order_id: 'BROKER222',
        symbol: 'INFY',
        quantity: 50,
        price: 1500,
        status: 'EXECUTED' as const,
        account_id: 'account456'
      });

      const mockBrokerStatus = {
        stat: 'Ok',
        status: 'EXECUTED',
        executedQuantity: 50,
        averagePrice: 1502,
        updateTime: new Date().toISOString(),
        rejectionReason: null
      };

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      const mockBrokerService = createMockBrokerService(mockBrokerStatus);
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
        success: true,
        updated: false,
        orderHistory: mockOrder
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'fyers' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.orderId).toBe(orderId);
    });

    test('should validate required orderId parameter', async () => {
      // Act - Send request without orderId
      const response = await request(app)
        .post('/check-order-status')
        .send({ brokerName: 'shoonya' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should validate required brokerName parameter', async () => {
      // Act - Send request without brokerName
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId: 'test-order-id' });

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle missing order gracefully', async () => {
      // Arrange
      const orderId = 'nonexistent-order-id';

      // Mock database lookup returning null for both methods
      mockUserDatabase.getOrderHistoryById.mockResolvedValue(null);
      mockUserDatabase.getOrderHistoryByBrokerOrderId.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle user ownership verification', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439021';
      const mockOrder = createMockOrder({
        id: orderId,
        user_id: 'different-user', // Different user ID
        broker_order_id: 'BROKER333'
      });

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    test('should handle database errors gracefully', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439022';
      
      mockUserDatabase.getOrderHistoryById.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle broker connection errors', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439023';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER111'
      });

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      // Mock broker connection failure
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: false,
        error: 'Session expired'
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle broker API errors', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439024';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER444'
      });

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      const mockBrokerService = {
        getOrderStatus: jest.fn().mockRejectedValue(new Error('Broker API error'))
      } as any;
      
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should handle timeout scenarios gracefully', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439028';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER555'
      });

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      // Mock broker service with timeout
      const mockBrokerService = {
        getOrderStatus: jest.fn().mockImplementation(() => 
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
        )
      } as any;
      
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Performance and Reliability', () => {
    test('should handle concurrent requests efficiently', async () => {
      // Arrange
      const orderIds = [
        '507f1f77bcf86cd799439025',
        '507f1f77bcf86cd799439026',
        '507f1f77bcf86cd799439027'
      ];

      const mockOrders = orderIds.map(id => createMockOrder({
        id,
        broker_order_id: `BROKER_${id.slice(-3)}`
      }));

      const mockBrokerStatus = {
        stat: 'Ok',
        status: 'COMPLETED',
        executedQuantity: 100,
        averagePrice: 2505,
        updateTime: new Date().toISOString(),
        rejectionReason: null
      };

      // Setup mocks for all orders
      mockUserDatabase.getOrderHistoryById
        .mockResolvedValueOnce(mockOrders[0])
        .mockResolvedValueOnce(mockOrders[1])
        .mockResolvedValueOnce(mockOrders[2]);
      
      const mockBrokerService = createMockBrokerService(mockBrokerStatus);
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
        success: true,
        updated: true,
        orderHistory: mockOrders[0],
        broadcastResult: { success: true }
      });

      // Act - Send concurrent requests
      const promises = orderIds.map(orderId =>
        request(app)
          .post('/check-order-status')
          .send({ orderId, brokerName: 'shoonya' })
      );

      const responses = await Promise.all(promises);

      // Assert
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.orderId).toBe(orderIds[index]);
      });

      // Verify all database calls were made
      expect(mockUserDatabase.getOrderHistoryById).toHaveBeenCalledTimes(3);
    });

    test('should maintain response time under load', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439029';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER_PERF_TEST'
      });

      const mockBrokerStatus = {
        stat: 'Ok',
        status: 'COMPLETED',
        executedQuantity: 100,
        averagePrice: 2505,
        updateTime: new Date().toISOString(),
        rejectionReason: null
      };

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      const mockBrokerService = createMockBrokerService(mockBrokerStatus);
      (mockBrokerConnectionHelper.findBrokerConnection as any).mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      (mockOrderStatusUpdateService.updateOrderStatusComprehensive as any).mockResolvedValue({
        success: true,
        updated: true,
        orderHistory: mockOrder,
        broadcastResult: { success: true }
      });

      // Act
      const startTime = Date.now();
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId, brokerName: 'shoonya' });
      const endTime = Date.now();

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify response time is reasonable (under 5 seconds for integration test)
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(5000);
    });
  });
});