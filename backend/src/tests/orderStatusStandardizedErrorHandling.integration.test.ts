/**
 * Integration test for standardized order status error handling
 * Tests the actual controller methods with standardized error responses
 */

import request from 'supertest';
import express from 'express';
import { checkOrderStatus, refreshOrderStatus, refreshAllOrderStatus } from '../controllers/brokerController';
import { authenticateToken } from '../middleware/auth';

// Mock dependencies
jest.mock('../services/databaseCompatibility');
jest.mock('../services/orderStatusService');
jest.mock('../helpers/brokerConnectionHelper');
jest.mock('../utils/logger');

const app = express();
app.use(express.json());

// Mock authentication middleware
app.use((req: any, res, next) => {
  req.user = { id: 'test-user-123' };
  next();
});

// Add routes
app.post('/check-order-status', checkOrderStatus);
app.post('/refresh-order-status/:orderId', refreshOrderStatus);
app.post('/refresh-all-order-status', refreshAllOrderStatus);

describe('Standardized Order Status Error Handling Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /check-order-status', () => {
    it('should return standardized error response for missing order ID', async () => {
      const response = await request(app)
        .post('/check-order-status')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Order ID is required and must be provided.',
          code: 'MISSING_ORDER_ID',
          retryable: false
        },
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error response for invalid broker name', async () => {
      const response = await request(app)
        .post('/check-order-status')
        .send({
          orderId: 'valid-order-id',
          brokerName: ''
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Invalid broker name provided.',
          code: 'INVALID_BROKER_NAME',
          retryable: false
        },
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error response for order not found', async () => {
      const { userDatabase } = require('../services/databaseCompatibility');
      userDatabase.getOrderHistoryById.mockResolvedValue(null);
      userDatabase.getOrderHistoryByBrokerOrderId.mockResolvedValue(null);

      const response = await request(app)
        .post('/check-order-status')
        .send({
          orderId: 'non-existent-order'
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Order not found in the system.',
          code: 'ORDER_NOT_FOUND',
          retryable: false
        },
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error response for access denied', async () => {
      const { userDatabase } = require('../services/databaseCompatibility');
      const mockOrder = {
        id: 'order-123',
        user_id: 'different-user-456',
        broker_name: 'TestBroker',
        broker_order_id: 'broker-order-123',
        status: 'PENDING'
      };
      
      userDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);

      const response = await request(app)
        .post('/check-order-status')
        .send({
          orderId: 'order-123'
        });

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'You do not have permission to access this order.',
          code: 'ACCESS_DENIED',
          retryable: false
        },
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error response for broker mismatch', async () => {
      const { userDatabase } = require('../services/databaseCompatibility');
      const mockOrder = {
        id: 'order-123',
        user_id: 'test-user-123',
        broker_name: 'TestBroker',
        broker_order_id: 'broker-order-123',
        status: 'PENDING'
      };
      
      userDatabase.getOrderHistoryById.mockResolvedValue(mockOrder);

      const response = await request(app)
        .post('/check-order-status')
        .send({
          orderId: 'order-123',
          brokerName: 'DifferentBroker'
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Order belongs to TestBroker, not DifferentBroker',
          code: 'BROKER_MISMATCH',
          retryable: false
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('POST /refresh-order-status/:orderId', () => {
    it('should return standardized error response for missing order ID', async () => {
      const response = await request(app)
        .post('/refresh-order-status/');

      expect(response.status).toBe(404); // Route not found
    });

    it('should return standardized error response for empty order ID', async () => {
      const response = await request(app)
        .post('/refresh-order-status/   ');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Order ID is required and must be provided.',
          code: 'MISSING_ORDER_ID',
          retryable: false
        },
        timestamp: expect.any(String)
      });
    });

    it('should return standardized success response for valid refresh', async () => {
      const orderStatusService = require('../services/orderStatusService');
      orderStatusService.default.refreshOrderStatus.mockResolvedValue({
        success: true,
        message: 'Order status refreshed successfully'
      });

      const response = await request(app)
        .post('/refresh-order-status/valid-order-id');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          success: true,
          message: 'Order status refreshed successfully'
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('POST /refresh-all-order-status', () => {
    it('should return standardized success response for valid refresh all', async () => {
      const orderStatusService = require('../services/orderStatusService');
      orderStatusService.default.refreshAllOrderStatus.mockResolvedValue({
        success: true,
        message: 'All order statuses refreshed successfully',
        refreshedCount: 5,
        failedCount: 0
      });

      const response = await request(app)
        .post('/refresh-all-order-status');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          success: true,
          message: 'All order statuses refreshed successfully',
          refreshedCount: 5,
          failedCount: 0
        },
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error response for service failure', async () => {
      const orderStatusService = require('../services/orderStatusService');
      orderStatusService.default.refreshAllOrderStatus.mockResolvedValue({
        success: false,
        message: 'Failed to refresh order statuses'
      });

      const response = await request(app)
        .post('/refresh-all-order-status');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Failed to refresh order statuses',
          code: 'INTERNAL_ERROR',
          retryable: true
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Response Format Consistency', () => {
    it('should always include required response fields', async () => {
      const response = await request(app)
        .post('/check-order-status')
        .send({});

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.success).toBe('boolean');
      expect(typeof response.body.timestamp).toBe('string');
      
      if (!response.body.success) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('retryable');
        expect(typeof response.body.error.retryable).toBe('boolean');
      }
    });

    it('should include requestId when provided in headers', async () => {
      const response = await request(app)
        .post('/check-order-status')
        .set('x-request-id', 'test-request-123')
        .send({});

      expect(response.body).toHaveProperty('requestId', 'test-request-123');
    });
  });
});