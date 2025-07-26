/**
 * Integration tests for order status consolidation functionality
 * Tests complete end-to-end flow from API request to database update
 * Requirements: 1.3, 1.4, 2.3
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
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

describe('Order Status Consolidation Integration Tests', () => {
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

  describe('Complete Order Status Flow', () => {
    test('should handle complete end-to-end order status check with database update', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439011';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER123'
      });

      const mockBrokerStatus = {
        status: 'COMPLETED',
        filledQuantity: 100,
        averagePrice: 2505,
        timestamp: new Date(),
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
        orderHistory: mockOrder
      });

      // Mock WebSocket broadcasting
      (mockWebsocketService.broadcastOrderStatusUpdate as any).mockResolvedValue({
        success: true
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          orderId: mockOrder.id,
          brokerOrderId: mockOrder.broker_order_id,
          status: mockBrokerStatus.status,
          symbol: mockOrder.symbol,
          quantity: mockOrder.quantity,
          filledQuantity: mockBrokerStatus.filledQuantity,
          price: mockOrder.price,
          averagePrice: mockBrokerStatus.averagePrice,
          timestamp: mockBrokerStatus.timestamp,
          brokerName: mockOrder.broker_name,
          rejectionReason: mockBrokerStatus.rejectionReason
        }
      });

      // Verify database was called correctly
      expect(mockUserDatabase.getOrderHistoryById).toHaveBeenCalledWith(orderId);
      
      // Verify broker service was called
      expect(mockBrokerConnectionHelper.findBrokerConnection).toHaveBeenCalledWith('user123', 'shoonya');
      expect(mockBrokerService.getOrderStatus).toHaveBeenCalledWith('BROKER123');
      
      // Verify status update was called since status changed
      expect(mockOrderStatusUpdateService.updateOrderStatusComprehensive).toHaveBeenCalledWith(
        mockOrder.id,
        expect.objectContaining({
          status: mockBrokerStatus.status,
          executedQuantity: mockBrokerStatus.filledQuantity,
          averagePrice: mockBrokerStatus.averagePrice
        }),
        'user123',
        expect.any(Object)
      );

      // Verify WebSocket broadcast was called
      expect(mockWebsocketService.broadcastOrderStatusUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          orderId: mockOrder.id,
          brokerOrderId: mockOrder.broker_order_id,
          status: mockBrokerStatus.status,
          timestamp: expect.any(Date)
        }),
        expect.any(Object)
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
        status: 'EXECUTED',
        filledQuantity: 50,
        averagePrice: 1502,
        timestamp: new Date(),
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
        .send({ orderId: brokerOrderId });

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
  });

  describe('Multiple Broker Types Consistency', () => {
    const brokerTestCases = [
      {
        brokerName: 'shoonya',
        orderId: '507f1f77bcf86cd799439013',
        brokerOrderId: 'SHOONYA123'
      },
      {
        brokerName: 'fyers',
        orderId: '507f1f77bcf86cd799439014',
        brokerOrderId: 'FYERS456'
      },
      {
        brokerName: 'zerodha',
        orderId: '507f1f77bcf86cd799439015',
        brokerOrderId: 'ZERODHA789'
      }
    ];

    brokerTestCases.forEach(({ brokerName, orderId, brokerOrderId }) => {
      test(`should handle ${brokerName} broker consistently`, async () => {
        // Arrange
        const mockOrder = createMockOrder({
          id: orderId,
          broker_name: brokerName,
          broker_order_id: brokerOrderId
        });

        const mockBrokerStatus = {
          status: 'COMPLETED',
          filledQuantity: 100,
          averagePrice: 2505,
          timestamp: new Date(),
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
          orderHistory: mockOrder
        });

        (mockWebsocketService.broadcastOrderStatusUpdate as any).mockResolvedValue({
          success: true
        });

        // Act
        const response = await request(app)
          .post('/check-order-status')
          .send({ orderId });

        // Assert
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.brokerName).toBe(mockOrder.broker_name);
        
        // Verify consistent behavior across brokers
        expect(mockBrokerConnectionHelper.findBrokerConnection).toHaveBeenCalledWith('user123', mockOrder.broker_name);
        expect(mockBrokerService.getOrderStatus).toHaveBeenCalledWith(mockOrder.broker_order_id);
        expect(mockWebsocketService.broadcastOrderStatusUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('WebSocket Broadcasting', () => {
    test('should broadcast order updates via WebSocket when status changes', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439016';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER789'
      });

      const mockBrokerStatus = {
        status: 'REJECTED',
        filledQuantity: 0,
        averagePrice: 0,
        timestamp: new Date(),
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
        orderHistory: mockOrder
      });

      (mockWebsocketService.broadcastOrderStatusUpdate as any).mockResolvedValue({
        success: true
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('REJECTED');
      expect(response.body.data.rejectionReason).toBe('Insufficient funds');

      // Verify WebSocket broadcast was called with correct data
      expect(mockWebsocketService.broadcastOrderStatusUpdate).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          orderId: mockOrder.id,
          brokerOrderId: mockOrder.broker_order_id,
          status: mockBrokerStatus.status,
          timestamp: expect.any(Date)
        }),
        expect.any(Object)
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
        status: 'EXECUTED', // Same status as in database
        filledQuantity: 50,
        averagePrice: 1502,
        timestamp: new Date(),
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
        .send({ orderId });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify WebSocket broadcast was NOT called
      expect(mockWebsocketService.broadcastOrderStatusUpdate).not.toHaveBeenCalled();
    });

    test('should handle WebSocket broadcasting errors gracefully', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439018';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER888'
      });

      const mockBrokerStatus = {
        status: 'COMPLETED',
        filledQuantity: 100,
        averagePrice: 2505,
        timestamp: new Date(),
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
        orderHistory: mockOrder
      });

      // Mock WebSocket broadcasting failure
      (mockWebsocketService.broadcastOrderStatusUpdate as any).mockRejectedValue(
        new Error('WebSocket connection failed')
      );

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId });

      // Assert - Should still return success even if WebSocket fails
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('COMPLETED');

      // Verify WebSocket broadcast was attempted
      expect(mockWebsocketService.broadcastOrderStatusUpdate).toHaveBeenCalled();
    });
  });

  describe('POST Endpoint Only', () => {
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

    test('should accept POST requests with proper payload', async () => {
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
        status: 'EXECUTED',
        filledQuantity: 50,
        averagePrice: 1502,
        timestamp: new Date(),
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
        .send({ orderId });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should validate required orderId parameter', async () => {
      // Act - Send request without orderId
      const response = await request(app)
        .post('/check-order-status')
        .send({});

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Order ID is required');
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
        .send({ orderId });

      // Assert
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Order not found');
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
        .send({ orderId });

      // Assert
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Access denied');
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
        .send({ orderId });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Internal server error');
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
        .send({ orderId });

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Session expired');
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
        .send({ orderId });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Internal server error');
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
        status: 'COMPLETED',
        filledQuantity: 100,
        averagePrice: 2505,
        timestamp: new Date(),
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
        orderHistory: mockOrders[0]
      });

      (mockWebsocketService.broadcastOrderStatusUpdate as any).mockResolvedValue({
        success: true
      });

      // Act - Send concurrent requests
      const promises = orderIds.map(orderId =>
        request(app)
          .post('/check-order-status')
          .send({ orderId })
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
        .send({ orderId });

      // Assert
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });
  });
});