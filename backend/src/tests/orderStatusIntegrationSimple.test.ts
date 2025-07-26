/**
 * Integration tests for order status consolidation functionality
 * Tests complete end-to-end flow from API request to database update
 * Requirements: 1.3, 1.4, 2.3
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { checkOrderStatus } from '../controllers/brokerController';
import { userDatabase } from '../services/databaseCompatibility';
import { BrokerConnectionHelper } from '../helpers/brokerConnectionHelper';
import { orderStatusUpdateService } from '../services/orderStatusUpdateService';
import websocketService from '../services/websocketService';
import { AuthenticatedRequest } from '../middleware/auth';

// Mock dependencies
jest.mock('../services/databaseCompatibility');
jest.mock('../helpers/brokerConnectionHelper');
jest.mock('../services/orderStatusUpdateService');
jest.mock('../services/websocketService');

const mockUserDatabase = userDatabase as jest.Mocked<typeof userDatabase>;
const mockBrokerConnectionHelper = BrokerConnectionHelper as jest.Mocked<typeof BrokerConnectionHelper>;
const mockOrderStatusUpdateService = orderStatusUpdateService as jest.Mocked<typeof orderStatusUpdateService>;
const mockWebsocketService = websocketService as jest.Mocked<typeof websocketService>;

describe('Order Status Integration Tests', () => {
  let app: Express;

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    
    // Add auth middleware mock
    app.use((req: any, res, next) => {
      req.user = { id: 'user123', email: 'test@example.com', name: 'Test User' };
      next();
    });
    
    app.post('/check-order-status', checkOrderStatus);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Complete Order Status Flow', () => {
    it('should handle complete end-to-end order status check with database update', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439011';
      const mockOrder = {
        id: orderId,
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
        created_at: new Date().toISOString()
      };

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
      const mockBrokerService = {
        getOrderStatus: jest.fn<any, any>().mockResolvedValue(mockBrokerStatus)
      } as any;
      
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
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.orderId).toBe(orderId);
      expect(response.body.data.brokerOrderId).toBe('BROKER123');
      expect(response.body.data.status).toBe('COMPLETED');

      // Verify database was called correctly
      expect(mockUserDatabase.getOrderHistoryById).toHaveBeenCalledWith(orderId);
      
      // Verify broker service was called
      expect(mockBrokerConnectionHelper.findBrokerConnection).toHaveBeenCalledWith('user123', 'shoonya');
      expect(mockBrokerService.getOrderStatus).toHaveBeenCalledWith('BROKER123');
    });

    it('should handle order lookup by broker order ID when internal ID not found', async () => {
      // Arrange
      const brokerOrderId = 'BROKER456';
      const mockOrder = {
        id: '507f1f77bcf86cd799439012',
        user_id: 'user123',
        account_id: 'account456',
        broker_name: 'fyers',
        broker_order_id: brokerOrderId,
        symbol: 'INFY',
        action: 'BUY' as const,
        quantity: 50,
        price: 1500,
        order_type: 'LIMIT' as const,
        status: 'EXECUTED' as const,
        exchange: 'NSE',
        product_type: 'CNC',
        remarks: 'Test order',
        executed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

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
      const mockBrokerService = {
        getOrderStatus: jest.fn<any, any>().mockResolvedValue(mockBrokerStatus)
      } as any;
      
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
      expect(response.body.data.brokerOrderId).toBe(brokerOrderId);

      // Verify both database lookup methods were called
      expect(mockUserDatabase.getOrderHistoryById).toHaveBeenCalledWith(brokerOrderId);
      expect(mockUserDatabase.getOrderHistoryByBrokerOrderId).toHaveBeenCalledWith(brokerOrderId);
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
      }
    ];

    brokerTestCases.forEach(({ brokerName, orderId, brokerOrderId }) => {
      it(`should handle ${brokerName} broker consistently`, async () => {
        // Arrange
        const mockOrder = {
          id: orderId,
          user_id: 'user123',
          account_id: 'account123',
          broker_name: brokerName,
          broker_order_id: brokerOrderId,
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
          created_at: new Date().toISOString()
        };

        const mockBrokerStatus = {
          status: 'COMPLETED',
          filledQuantity: 100,
          averagePrice: 2505,
          timestamp: new Date(),
          rejectionReason: null
        };

        mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
        
        const mockBrokerService = {
          getOrderStatus: jest.fn<any, any>().mockResolvedValue(mockBrokerStatus)
        } as any;
        
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
        expect(response.body.data.brokerName).toBe(brokerName);
        
        // Verify consistent behavior across brokers
        expect(mockBrokerConnectionHelper.findBrokerConnection).toHaveBeenCalledWith('user123', brokerName);
        expect(mockBrokerService.getOrderStatus).toHaveBeenCalledWith(brokerOrderId);
      });
    });
  });

  describe('WebSocket Broadcasting', () => {
    it('should broadcast order updates via WebSocket when status changes', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439016';
      const mockOrder = {
        id: orderId,
        user_id: 'user123',
        account_id: 'account123',
        broker_name: 'shoonya',
        broker_order_id: 'BROKER789',
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
        created_at: new Date().toISOString()
      };

      const mockBrokerStatus = {
        status: 'REJECTED',
        filledQuantity: 0,
        averagePrice: 0,
        timestamp: new Date(),
        rejectionReason: 'Insufficient funds'
      };

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      const mockBrokerService = {
        getOrderStatus: jest.fn().mockResolvedValue(mockBrokerStatus)
      };
      
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

      // Verify WebSocket broadcast was called
      expect(mockWebsocketService.broadcastOrderStatusUpdate).toHaveBeenCalled();
    });
  });

  describe('POST Endpoint Only', () => {
    it('should only accept POST requests to /check-order-status', async () => {
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
    });

    it('should accept POST requests with proper payload', async () => {
      // Arrange
      const orderId = '507f1f77bcf86cd799439020';
      const mockOrder = {
        id: orderId,
        user_id: 'user123',
        account_id: 'account456',
        broker_name: 'fyers',
        broker_order_id: 'BROKER222',
        symbol: 'INFY',
        action: 'BUY' as const,
        quantity: 50,
        price: 1500,
        order_type: 'LIMIT' as const,
        status: 'EXECUTED' as const,
        exchange: 'NSE',
        product_type: 'CNC',
        remarks: 'Test order',
        executed_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      const mockBrokerStatus = {
        status: 'EXECUTED',
        filledQuantity: 50,
        averagePrice: 1502,
        timestamp: new Date(),
        rejectionReason: null
      };

      mockUserDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);
      
      const mockBrokerService = {
        getOrderStatus: jest.fn().mockResolvedValue(mockBrokerStatus)
      };
      
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
  });
});