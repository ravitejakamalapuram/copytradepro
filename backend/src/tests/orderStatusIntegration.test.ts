/**
 * Integration tests for order status consolidation functionality
 * Tests complete end-to-end flow from API request to database update
 * Requirements: 1.3, 1.4, 2.3
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { Server } from 'http';
import { checkOrderStatus } from '../controllers/brokerController';
import { userDatabase } from '../services/databaseCompatibility';
import { BrokerConnectionHelper } from '../helpers/brokerConnectionHelper';
import { comprehensiveErrorHandler } from '../services/comprehensiveErrorHandler';
import { orderStatusUpdateService } from '../services/orderStatusUpdateService';
import websocketService from '../services/websocketService';
import { AuthenticatedRequest } from '../middleware/auth';
import { OrderStatusErrorCode } from '../types/orderStatusTypes';

// Mock dependencies
jest.mock('../services/databaseCompatibility');
jest.mock('../helpers/brokerConnectionHelper');
jest.mock('../services/comprehensiveErrorHandler');
jest.mock('../services/orderStatusUpdateService');
jest.mock('../services/websocketService');

const mockUserDatabase = userDatabase as jest.Mocked<typeof userDatabase>;
const mockBrokerConnectionHelper = BrokerConnectionHelper as jest.Mocked<typeof BrokerConnectionHelper>;
const mockComprehensiveErrorHandler = comprehensiveErrorHandler as jest.Mocked<typeof comprehensiveErrorHandler>;
const mockOrderStatusUpdateService = orderStatusUpdateService as jest.Mocked<typeof orderStatusUpdateService>;
const mockWebsocketService = websocketService as jest.Mocked<typeof websocketService>;

describe('Order Status Integration Tests', () => {
  let app: Express;
  let server: Server | undefined;
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: any;

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
    app.post('/check-order-status', checkOrderStatus);

    // Setup mock request and response
    mockReq = {
      user: { id: 'user123', email: 'test@example.com', name: 'Test User' },
      body: {},
      headers: { 'x-request-id': 'test-request-123' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

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
    it('should handle complete end-to-end order status check with database update', async () => {
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
      mockBrokerConnectionHelper.findBrokerConnection.mockReturnValue({
        success: true,
        connection: mockBrokerService as any
      });

      // Mock status update service
      mockOrderStatusUpdateService.updateOrderStatusComprehensive.mockResolvedValue({
        success: true,
        updated: true,
        orderHistory: mockOrder as any
      });

      // Mock comprehensive error handler
      mockComprehensiveErrorHandler.executeWithRetry.mockImplementation(
        async (operation) => await operation()
      );

      // Mock WebSocket broadcasting
      mockWebsocketService.broadcastOrderStatusUpdate.mockResolvedValue({
        success: true
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId })
        .set('Authorization', 'Bearer valid-token');

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
    });

    it('should handle order lookup by broker order ID when internal ID not found', async () => {
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
      mockBrokerConnectionHelper.findBrokerConnection.mockReturnValue({
        success: true,
        connection: mockBrokerService as any
      });

      // Mock no status update needed (status unchanged)
      mockOrderStatusUpdateService.updateOrderStatusComprehensive.mockResolvedValue({
        success: true,
        updated: false,
        orderHistory: mockOrder as any
      });

      mockComprehensiveErrorHandler.executeWithRetry.mockImplementation(
        async (operation) => await operation()
      );

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId: brokerOrderId })
        .set('Authorization', 'Bearer valid-token');

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
      it(`should handle ${brokerName} broker consistently`, async () => {
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
        mockBrokerConnectionHelper.findBrokerConnection.mockReturnValue({
          success: true,
          connection: mockBrokerService as any
        });

        mockOrderStatusUpdateService.updateOrderStatusComprehensive.mockResolvedValue({
          success: true,
          updated: true,
          orderHistory: mockOrder as any
        });

        mockComprehensiveErrorHandler.executeWithRetry.mockImplementation(
          async (operation) => await operation()
        );

        mockWebsocketService.broadcastOrderStatusUpdate.mockResolvedValue({
          success: true
        });

        // Act
        const response = await request(app)
          .post('/check-order-status')
          .send({ orderId })
          .set('Authorization', 'Bearer valid-token');

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
    it('should broadcast order updates via WebSocket when status changes', async () => {
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
      mockBrokerConnectionHelper.findBrokerConnection.mockReturnValue({
        success: true,
        connection: mockBrokerService as any
      });

      mockOrderStatusUpdateService.updateOrderStatusComprehensive.mockResolvedValue({
        success: true,
        updated: true,
        orderHistory: mockOrder as any
      });

      mockComprehensiveErrorHandler.executeWithRetry.mockImplementation(
        async (operation) => await operation()
      );

      mockWebsocketService.broadcastOrderStatusUpdate.mockResolvedValue({
        success: true
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId })
        .set('Authorization', 'Bearer valid-token');

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

    it('should not broadcast when status has not changed', async () => {
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
      mockBrokerConnectionHelper.findBrokerConnection.mockReturnValue({
        success: true,
        connection: mockBrokerService as any
      });

      // No update needed since status is the same
      mockOrderStatusUpdateService.updateOrderStatusComprehensive.mockResolvedValue({
        success: true,
        updated: false,
        orderHistory: mockOrder as any
      });

      mockComprehensiveErrorHandler.executeWithRetry.mockImplementation(
        async (operation) => await operation()
      );

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId })
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify WebSocket broadcast was NOT called
      expect(mockWebsocketService.broadcastOrderStatusUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439018';
      
      mockUserDatabase.getOrderHistoryById.mockRejectedValue(
        new Error('Database connection failed')
      );

      mockComprehensiveErrorHandler.executeWithRetry.mockResolvedValue({
        success: false,
        error: {
          code: OrderStatusErrorCode.DATABASE_ERROR,
          message: 'Failed to retrieve order from database',
          retryable: false
        }
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId })
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: OrderStatusErrorCode.DATABASE_ERROR,
          message: 'Failed to retrieve order from database',
          retryable: false
        }
      });

      // Verify error handler was called
      expect(mockComprehensiveErrorHandler.executeWithRetry).toHaveBeenCalled();
    });

    it('should handle broker connection errors', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439019';
      const mockOrder = createMockOrder({
        id: orderId,
        broker_order_id: 'BROKER111'
      });

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      // Mock broker connection failure
      mockBrokerConnectionHelper.findBrokerConnection.mockReturnValue({
        success: false,
        error: 'Session expired'
      });

      mockComprehensiveErrorHandler.executeWithRetry.mockResolvedValue({
        success: false,
        error: {
          code: OrderStatusErrorCode.SESSION_EXPIRED,
          message: 'User not authenticated. Please log in again.',
          retryable: false
        }
      });

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId })
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: OrderStatusErrorCode.SESSION_EXPIRED,
          message: 'User not authenticated. Please log in again.',
          retryable: false
        }
      });
    });
  });

  describe('POST Endpoint Only', () => {
    it('should only accept POST requests to /check-order-status', async () => {
      // Test that GET request is not supported
      const getResponse = await request(app)
        .get('/check-order-status')
        .set('Authorization', 'Bearer valid-token');

      expect(getResponse.status).toBe(404);

      // Test that PUT request is not supported
      const putResponse = await request(app)
        .put('/check-order-status')
        .send({ orderId: 'test' })
        .set('Authorization', 'Bearer valid-token');

      expect(putResponse.status).toBe(404);

      // Test that DELETE request is not supported
      const deleteResponse = await request(app)
        .delete('/check-order-status')
        .set('Authorization', 'Bearer valid-token');

      expect(deleteResponse.status).toBe(404);
    });

    it('should accept POST requests with proper payload', async () => {
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
      mockBrokerConnectionHelper.findBrokerConnection.mockReturnValue({
        success: true,
        connection: mockBrokerService as any
      });

      mockOrderStatusUpdateService.updateOrderStatusComprehensive.mockResolvedValue({
        success: true,
        updated: false,
        orderHistory: mockOrder as any
      });

      mockComprehensiveErrorHandler.executeWithRetry.mockImplementation(
        async (operation) => await operation()
      );

      // Act
      const response = await request(app)
        .post('/check-order-status')
        .send({ orderId })
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});