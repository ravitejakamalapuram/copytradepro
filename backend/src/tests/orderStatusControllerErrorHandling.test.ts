/**
 * Unit tests for standardized error handling in order status controller methods
 * Tests the controller methods directly with mocked dependencies
 */

import './testSetup';
import { Response } from 'express';
import { checkOrderStatus, refreshOrderStatus, refreshAllOrderStatus } from '../controllers/brokerController';
import { AuthenticatedRequest } from '../middleware/auth';
import { jest, expect, beforeEach } from '@jest/globals';

// Mock the services
jest.mock('../services/databaseCompatibility');
jest.mock('../services/orderStatusService');



// Create mock request and response objects
const createMockRequest = (body: any = {}, user: any = { id: 'test-user-123' }, params: any = {}): AuthenticatedRequest => ({
  body,
  user,
  params,
  headers: { 'x-request-id': 'test-request-123' },
  ip: '127.0.0.1'
} as any);

const createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

describe('Order Status Controller Standardized Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkOrderStatus', () => {
    it('should return standardized error for missing order ID', async () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      await checkOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Order ID is required and must be provided.',
          code: 'MISSING_ORDER_ID',
          retryable: false
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error for invalid broker name', async () => {
      const req = createMockRequest({
        orderId: 'valid-order-id',
        brokerName: '   '
      });
      const res = createMockResponse();

      await checkOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Invalid broker name provided.',
          code: 'INVALID_BROKER_NAME',
          retryable: false
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error for unauthenticated user', async () => {
      const req = createMockRequest({
        orderId: 'valid-order-id'
      }, null); // No user
      const res = createMockResponse();

      await checkOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'User not authenticated. Please log in again.',
          code: 'AUTHENTICATION_ERROR',
          retryable: false
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error for order not found', async () => {
      const { userDatabase } = require('../services/databaseCompatibility');
      // @ts-ignore
      userDatabase.getOrderHistoryById = jest.fn().mockResolvedValue(null);
      // @ts-ignore
      userDatabase.getOrderHistoryByBrokerOrderId = jest.fn().mockResolvedValue(null);

      const req = createMockRequest({
        orderId: 'non-existent-order'
      });
      const res = createMockResponse();

      await checkOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Order not found in the system.',
          code: 'ORDER_NOT_FOUND',
          retryable: false
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error for access denied', async () => {
      const { userDatabase } = require('../services/databaseCompatibility');
      const mockOrder = {
        id: 'order-123',
        user_id: 'different-user-456',
        broker_name: 'TestBroker',
        broker_order_id: 'broker-order-123',
        status: 'PENDING'
      };
      
      // @ts-ignore
      userDatabase.getOrderHistoryById = jest.fn().mockResolvedValue(mockOrder);

      const req = createMockRequest({
        orderId: 'order-123'
      });
      const res = createMockResponse();

      await checkOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'You do not have permission to access this order.',
          code: 'ACCESS_DENIED',
          retryable: false
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error for database error', async () => {
      const { userDatabase } = require('../services/databaseCompatibility');
      // @ts-ignore
      userDatabase.getOrderHistoryById = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const req = createMockRequest({
        orderId: 'valid-order-id'
      });
      const res = createMockResponse();

      await checkOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Failed to retrieve order from database',
          code: 'DATABASE_ERROR',
          retryable: true
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });
  });

  describe('refreshOrderStatus', () => {
    it('should return standardized error for missing order ID', async () => {
      const req = createMockRequest({}, { id: 'test-user-123' }, { orderId: null });
      const res = createMockResponse();

      await refreshOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Order ID is required and must be provided.',
          code: 'MISSING_ORDER_ID',
          retryable: false
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });

    it('should return standardized success response', async () => {
      const orderStatusService = require('../services/orderStatusService');
      
      // Mock the service method to return success
      (orderStatusService.default.refreshOrderStatus as any).mockResolvedValue({
        success: true,
        message: 'Order status refreshed successfully'
      });

      const req = createMockRequest({}, { id: 'test-user-123' }, { orderId: 'valid-order-id' });
      const res = createMockResponse();

      await refreshOrderStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          success: true,
          message: 'Order status refreshed successfully'
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });
  });

  describe('refreshAllOrderStatus', () => {
    it('should return standardized error for unauthenticated user', async () => {
      const req = createMockRequest({}, null);
      const res = createMockResponse();

      await refreshAllOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'User not authenticated. Please log in again.',
          code: 'AUTHENTICATION_ERROR',
          retryable: false
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });

    it('should return standardized success response', async () => {
      const orderStatusService = require('../services/orderStatusService');
      
      // Mock the service method to return success
      (orderStatusService.default.refreshAllOrderStatus as any).mockResolvedValue({
        success: true,
        message: 'All order statuses refreshed successfully',
        refreshedCount: 5,
        failedCount: 0
      });

      const req = createMockRequest({});
      const res = createMockResponse();

      await refreshAllOrderStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          success: true,
          message: 'All order statuses refreshed successfully',
          refreshedCount: 5,
          failedCount: 0
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });

    it('should return standardized error for service failure', async () => {
      const orderStatusService = require('../services/orderStatusService');
      
      // Mock the service method to return failure
      (orderStatusService.default.refreshAllOrderStatus as any).mockResolvedValue({
        success: false,
        message: 'Failed to refresh order statuses'
      });

      const req = createMockRequest({});
      const res = createMockResponse();

      await refreshAllOrderStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Failed to refresh order statuses',
          code: 'INTERNAL_ERROR',
          retryable: true
        },
        requestId: 'test-request-123',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Response Format Consistency', () => {
    it('should always include timestamp in responses', async () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      await checkOrderStatus(req, res);

      const callArgs = (res.json as any).mock.calls[0]?.[0];
      expect(callArgs).toHaveProperty('timestamp');
      expect(typeof callArgs?.timestamp).toBe('string');
      expect(new Date(callArgs?.timestamp)).toBeInstanceOf(Date);
    });

    it('should include requestId when provided', async () => {
      const req = createMockRequest({});
      req.headers = { 'x-request-id': 'custom-request-id' };
      const res = createMockResponse();

      await checkOrderStatus(req, res);

      const callArgs = (res.json as any).mock.calls[0]?.[0];
      expect(callArgs).toHaveProperty('requestId', 'custom-request-id');
    });

    it('should generate requestId when not provided', async () => {
      const req = createMockRequest({});
      req.headers = {};
      const res = createMockResponse();

      await checkOrderStatus(req, res);

      const callArgs = (res.json as any).mock.calls[0]?.[0];
      expect(callArgs).toHaveProperty('requestId');
      expect(typeof callArgs?.requestId).toBe('string');
      expect(callArgs?.requestId).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });
});