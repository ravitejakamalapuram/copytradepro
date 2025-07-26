/**
 * Order Status Consolidation UI Integration Test
 * Tests the complete flow from frontend to backend with comprehensive logging verification
 * Implements task 10 requirements: comprehensive logging and UI integration verification
 */

import request from 'supertest';
import app from '../index';
import { userDatabase } from '../services/databaseCompatibility';
import { enhancedUnifiedBrokerManager } from '../services/enhancedUnifiedBrokerManager';
import { logger } from '../utils/logger';
import { orderStatusLogger } from '../services/orderStatusLogger';
import jwt from 'jsonwebtoken';
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
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
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
import { afterEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { beforeEach } from '@jest/globals';
import { beforeAll } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';

// Mock the broker service
const mockBrokerService = {
  getOrderStatus: jest.fn(),
  isConnected: jest.fn().mockReturnValue(true)
};

// Mock the enhanced unified broker manager
jest.mock('../services/enhancedUnifiedBrokerManager', () => ({
  enhancedUnifiedBrokerManager: {
    getBrokerService: jest.fn(),
    getUserConnections: jest.fn(),
    getConnection: jest.fn()
  }
}));

// Mock the database
jest.mock('../services/databaseCompatibility', () => ({
  userDatabase: {
    getOrderHistoryById: jest.fn(),
    getOrderHistoryByBrokerOrderId: jest.fn(),
    updateOrderStatus: jest.fn(),
    getConnectedAccountById: jest.fn()
  }
}));

// Mock the order status update service
jest.mock('../services/orderStatusUpdateService', () => ({
  orderStatusUpdateService: {
    updateOrderStatusComprehensive: jest.fn()
  }
}));

// Mock the comprehensive error handler
jest.mock('../services/comprehensiveErrorHandler', () => ({
  comprehensiveErrorHandler: {
    executeWithRetry: jest.fn()
  }
}));

// Mock BrokerConnectionHelper
jest.mock('../helpers/brokerConnectionHelper', () => ({
  default: {
    findBrokerConnection: jest.fn()
  }
}));

describe('Order Status Consolidation UI Integration', () => {
  let authToken: string;
  let testUserId: string;
  let testOrderId: string;
  let testBrokerOrderId: string;
  let loggerSpy: jest.SpyInstance;
  let orderStatusLoggerSpy: jest.SpyInstance;

  beforeAll(() => {
    // Create test user and auth token
    testUserId = 'test-user-123';
    testOrderId = 'order-123';
    testBrokerOrderId = 'broker-order-456';
    
    authToken = jwt.sign(
      { id: testUserId, email: 'test@example.com' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup logging spies to verify comprehensive logging
    loggerSpy = jest.spyOn(logger, 'info');
    orderStatusLoggerSpy = jest.spyOn(orderStatusLogger, 'logOrderStatusRequest');
  });

  afterEach(() => {
    loggerSpy.mockRestore();
    orderStatusLoggerSpy.mockRestore();
  });

  describe('POST /api/broker/check-order-status - UI Integration', () => {
    it('should handle successful order status check with comprehensive logging', async () => {
      // Setup test data
      const mockOrderHistory = {
        id: testOrderId,
        user_id: testUserId,
        broker_order_id: testBrokerOrderId,
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        status: 'PLACED',
        broker_name: 'shoonya',
        account_id: 'test-account-123',
        order_type: 'LIMIT',
        product_type: 'MIS',
        exchange: 'NSE',
        created_at: '2024-01-15T10:00:00Z'
      };

      const mockBrokerResponse = {
        stat: 'Ok',
        status: 'EXECUTED',
        executedQuantity: 10,
        averagePrice: 2505,
        updateTime: '2024-01-15T10:30:00Z'
      };

      const mockUpdateResult = {
        success: true,
        updated: true,
        orderHistory: { ...mockOrderHistory, status: 'EXECUTED' },
        broadcastResult: {
          success: true,
          retriesUsed: 0,
          duration: 50
        }
      };

      // Setup mocks
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrderHistory);
      (enhancedUnifiedBrokerManager.getBrokerService as jest.Mock).mockReturnValue(mockBrokerService);
      
      const { BrokerConnectionHelper } = require('../helpers/brokerConnectionHelper');
      BrokerConnectionHelper.findBrokerConnection.mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      const { comprehensiveErrorHandler } = require('../services/comprehensiveErrorHandler');
      comprehensiveErrorHandler.executeWithRetry.mockResolvedValue(mockBrokerResponse);

      const { orderStatusUpdateService } = require('../services/orderStatusUpdateService');
      orderStatusUpdateService.updateOrderStatusComprehensive.mockResolvedValue(mockUpdateResult);

      // Make request that simulates frontend call
      const response = await request(app)
        .post('/api/broker/check-order-status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .set('User-Agent', 'CopyTrade-Frontend/1.0.0')
        .set('X-Request-ID', 'test-request-123')
        .send({
          orderId: testOrderId,
          brokerName: 'shoonya'
        });

      // Verify response matches frontend expectations
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          orderId: testOrderId,
          brokerOrderId: testBrokerOrderId,
          status: 'EXECUTED',
          symbol: 'RELIANCE',
          quantity: 10,
          filledQuantity: 10,
          price: 2500,
          averagePrice: 2505,
          brokerName: 'shoonya',
          statusChanged: true,
          previousStatus: 'PLACED'
        }
      });

      // Verify comprehensive logging was implemented
      expect(loggerSpy).toHaveBeenCalledWith(
        'Consolidated order status check initiated',
        expect.objectContaining({
          requestId: 'test-request-123',
          userId: testUserId,
          orderId: testOrderId,
          brokerName: 'shoonya',
          operation: 'CHECK_ORDER_STATUS',
          component: 'BROKER_CONTROLLER',
          userAgent: 'CopyTrade-Frontend/1.0.0'
        }),
        expect.objectContaining({
          requestBody: { orderId: testOrderId, brokerName: 'shoonya' },
          headers: expect.objectContaining({
            userAgent: 'CopyTrade-Frontend/1.0.0'
          })
        })
      );

      // Verify order status request logging
      expect(orderStatusLoggerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          brokerName: 'shoonya',
          orderId: testOrderId,
          apiEndpoint: 'getOrderStatus'
        })
      );

      // Verify performance tracking was started and ended
      expect(loggerSpy).toHaveBeenCalledWith(
        'Order status check completed successfully',
        expect.objectContaining({
          operation: 'CHECK_ORDER_STATUS'
        }),
        expect.objectContaining({
          performanceMetrics: expect.objectContaining({
            totalDuration: expect.any(Number),
            brokerApiDuration: expect.any(Number),
            statusChanged: true,
            finalStatus: 'EXECUTED'
          })
        })
      );
    });

    it('should handle order not found with proper error logging', async () => {
      // Setup mocks for order not found scenario
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(null);
      (userDatabase.getOrderHistoryByBrokerOrderId as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/broker/check-order-status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .set('User-Agent', 'CopyTrade-Frontend/1.0.0')
        .send({
          orderId: 'non-existent-order',
          brokerName: 'shoonya'
        });

      // Verify error response matches frontend expectations
      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('Order not found'),
          code: 'ORDER_NOT_FOUND',
          retryable: false
        }
      });

      // Verify error logging
      expect(loggerSpy).toHaveBeenCalledWith(
        'Order not found in database',
        expect.objectContaining({
          operation: 'CHECK_ORDER_STATUS'
        }),
        expect.objectContaining({
          searchId: 'non-existent-order',
          errorType: 'ORDER_NOT_FOUND'
        })
      );
    });

    it('should handle broker API errors with comprehensive error logging', async () => {
      const mockOrderHistory = {
        id: testOrderId,
        user_id: testUserId,
        broker_order_id: testBrokerOrderId,
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        status: 'PLACED',
        broker_name: 'shoonya',
        account_id: 'test-account-123',
        order_type: 'LIMIT',
        product_type: 'MIS',
        exchange: 'NSE',
        created_at: '2024-01-15T10:00:00Z'
      };

      const brokerError = new Error('Broker API timeout');
      brokerError.name = 'TimeoutError';

      // Setup mocks
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrderHistory);
      
      const { BrokerConnectionHelper } = require('../helpers/brokerConnectionHelper');
      BrokerConnectionHelper.findBrokerConnection.mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      const { comprehensiveErrorHandler } = require('../services/comprehensiveErrorHandler');
      comprehensiveErrorHandler.executeWithRetry.mockRejectedValue(brokerError);

      const response = await request(app)
        .post('/api/broker/check-order-status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          orderId: testOrderId,
          brokerName: 'shoonya'
        });

      // Verify error response
      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.any(String),
          retryable: expect.any(Boolean)
        }
      });

      // Verify comprehensive error logging
      expect(loggerSpy).toHaveBeenCalledWith(
        'Broker API error during order status check',
        expect.objectContaining({
          operation: 'CHECK_ORDER_STATUS'
        }),
        expect.objectContaining({
          errorMessage: 'Broker API timeout',
          errorType: 'TimeoutError',
          brokerName: 'shoonya',
          brokerOrderId: testBrokerOrderId,
          performanceMetrics: expect.objectContaining({
            totalDuration: expect.any(Number),
            brokerApiDuration: expect.any(Number)
          })
        })
      );
    });

    it('should handle missing authentication with proper logging', async () => {
      const response = await request(app)
        .post('/api/broker/check-order-status')
        .set('Content-Type', 'application/json')
        .send({
          orderId: testOrderId,
          brokerName: 'shoonya'
        });

      // Verify authentication error
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('authentication'),
          code: 'AUTHENTICATION_ERROR'
        }
      });
    });

    it('should handle invalid input with validation logging', async () => {
      const response = await request(app)
        .post('/api/broker/check-order-status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          // Missing orderId
          brokerName: 'shoonya'
        });

      // Verify validation error
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: expect.stringContaining('Order ID'),
          code: 'MISSING_ORDER_ID'
        }
      });

      // Verify validation logging
      expect(loggerSpy).toHaveBeenCalledWith(
        'Order ID validation failed',
        expect.objectContaining({
          operation: 'CHECK_ORDER_STATUS'
        }),
        expect.objectContaining({
          errorType: 'MISSING_ORDER_ID'
        })
      );
    });
  });

  describe('Performance Monitoring Integration', () => {
    it('should log performance metrics for all operations', async () => {
      const mockOrderHistory = {
        id: testOrderId,
        user_id: testUserId,
        broker_order_id: testBrokerOrderId,
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        status: 'PLACED',
        broker_name: 'shoonya',
        account_id: 'test-account-123',
        order_type: 'LIMIT',
        product_type: 'MIS',
        exchange: 'NSE',
        created_at: '2024-01-15T10:00:00Z'
      };

      const mockBrokerResponse = {
        stat: 'Ok',
        status: 'EXECUTED',
        executedQuantity: 10,
        averagePrice: 2505
      };

      // Setup mocks
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrderHistory);
      
      const { BrokerConnectionHelper } = require('../helpers/brokerConnectionHelper');
      BrokerConnectionHelper.findBrokerConnection.mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      const { comprehensiveErrorHandler } = require('../services/comprehensiveErrorHandler');
      comprehensiveErrorHandler.executeWithRetry.mockResolvedValue(mockBrokerResponse);

      const { orderStatusUpdateService } = require('../services/orderStatusUpdateService');
      orderStatusUpdateService.updateOrderStatusComprehensive.mockResolvedValue({
        success: true,
        updated: true,
        orderHistory: mockOrderHistory
      });

      const startTime = Date.now();
      
      await request(app)
        .post('/api/broker/check-order-status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          orderId: testOrderId,
          brokerName: 'shoonya'
        });

      const endTime = Date.now();

      // Verify performance logging includes timing information
      expect(loggerSpy).toHaveBeenCalledWith(
        'Database lookup completed',
        expect.objectContaining({
          operation: 'CHECK_ORDER_STATUS'
        }),
        expect.objectContaining({
          duration: expect.any(Number),
          method: expect.any(String),
          found: true
        })
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'Broker API call completed',
        expect.objectContaining({
          operation: 'CHECK_ORDER_STATUS'
        }),
        expect.objectContaining({
          duration: expect.any(Number),
          hasResponse: true
        })
      );
    });
  });

  describe('Frontend Response Format Compatibility', () => {
    it('should return response format compatible with frontend expectations', async () => {
      const mockOrderHistory = {
        id: testOrderId,
        user_id: testUserId,
        broker_order_id: testBrokerOrderId,
        symbol: 'RELIANCE',
        action: 'BUY',
        quantity: 10,
        price: 2500,
        status: 'PLACED',
        broker_name: 'shoonya',
        account_id: 'test-account-123',
        order_type: 'LIMIT',
        product_type: 'MIS',
        exchange: 'NSE',
        created_at: '2024-01-15T10:00:00Z'
      };

      const mockBrokerResponse = {
        stat: 'Ok',
        status: 'EXECUTED',
        executedQuantity: 10,
        averagePrice: 2505,
        updateTime: '2024-01-15T10:30:00Z'
      };

      // Setup mocks
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrderHistory);
      
      const { BrokerConnectionHelper } = require('../helpers/brokerConnectionHelper');
      BrokerConnectionHelper.findBrokerConnection.mockReturnValue({
        success: true,
        connection: mockBrokerService
      });

      const { comprehensiveErrorHandler } = require('../services/comprehensiveErrorHandler');
      comprehensiveErrorHandler.executeWithRetry.mockResolvedValue(mockBrokerResponse);

      const { orderStatusUpdateService } = require('../services/orderStatusUpdateService');
      orderStatusUpdateService.updateOrderStatusComprehensive.mockResolvedValue({
        success: true,
        updated: true,
        orderHistory: { ...mockOrderHistory, status: 'EXECUTED' }
      });

      const response = await request(app)
        .post('/api/broker/check-order-status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          orderId: testOrderId,
          brokerName: 'shoonya'
        });

      // Verify response structure matches what frontend expects
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('orderId');
      expect(response.body.data).toHaveProperty('brokerOrderId');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('symbol');
      expect(response.body.data).toHaveProperty('quantity');
      expect(response.body.data).toHaveProperty('filledQuantity');
      expect(response.body.data).toHaveProperty('price');
      expect(response.body.data).toHaveProperty('averagePrice');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('brokerName');
      expect(response.body.data).toHaveProperty('statusChanged');
      expect(response.body.data).toHaveProperty('previousStatus');

      // Verify data types match frontend expectations
      expect(typeof response.body.data.orderId).toBe('string');
      expect(typeof response.body.data.brokerOrderId).toBe('string');
      expect(typeof response.body.data.status).toBe('string');
      expect(typeof response.body.data.symbol).toBe('string');
      expect(typeof response.body.data.quantity).toBe('number');
      expect(typeof response.body.data.filledQuantity).toBe('number');
      expect(typeof response.body.data.price).toBe('number');
      expect(typeof response.body.data.averagePrice).toBe('number');
      expect(typeof response.body.data.brokerName).toBe('string');
      expect(typeof response.body.data.statusChanged).toBe('boolean');
    });

    it('should return standardized error format for frontend', async () => {
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(null);
      (userDatabase.getOrderHistoryByBrokerOrderId as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/broker/check-order-status')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({
          orderId: 'non-existent-order',
          brokerName: 'shoonya'
        });

      // Verify error response structure matches frontend expectations
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('retryable');

      // Verify error data types
      expect(typeof response.body.error.message).toBe('string');
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.retryable).toBe('boolean');
    });
  });
});