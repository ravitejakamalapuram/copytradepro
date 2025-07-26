/**
 * Comprehensive tests for standardized order status error handling
 * Tests error categorization, response formats, and logging
 */

import './testSetup';
import { OrderStatusErrorHandler } from '../utils/orderStatusErrorHandler';
import { OrderStatusErrorCode, ERROR_CATEGORY_MAP } from '../types/orderStatusTypes';
import { Response } from 'express';

// Mock response object
const createMockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

describe('OrderStatusErrorHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Creation', () => {
    it('should create standardized error with default message', () => {
      const error = OrderStatusErrorHandler.createError(OrderStatusErrorCode.ORDER_NOT_FOUND);
      
      expect(error).toEqual({
        message: 'Order not found in the system.',
        code: OrderStatusErrorCode.ORDER_NOT_FOUND,
        retryable: false,
        details: undefined
      });
    });

    it('should create standardized error with custom message', () => {
      const customMessage = 'Custom error message';
      const error = OrderStatusErrorHandler.createError(
        OrderStatusErrorCode.BROKER_ERROR,
        customMessage
      );
      
      expect(error).toEqual({
        message: customMessage,
        code: OrderStatusErrorCode.BROKER_ERROR,
        retryable: true,
        details: undefined
      });
    });

    it('should create standardized error with details', () => {
      const details = { originalError: 'Original error message' };
      const error = OrderStatusErrorHandler.createError(
        OrderStatusErrorCode.INTERNAL_ERROR,
        undefined,
        details
      );
      
      expect(error.details).toEqual(details);
    });
  });

  describe('Response Creation', () => {
    it('should create success response', () => {
      const data = { orderId: '123', status: 'COMPLETE' };
      const requestId = 'req_123';
      
      const response = OrderStatusErrorHandler.createSuccessResponse(data, requestId);
      
      expect(response).toEqual({
        success: true,
        data,
        requestId,
        timestamp: expect.any(String)
      });
    });

    it('should create error response', () => {
      const error = OrderStatusErrorHandler.createError(OrderStatusErrorCode.ORDER_NOT_FOUND);
      const requestId = 'req_123';
      
      const response = OrderStatusErrorHandler.createErrorResponse(error, requestId);
      
      expect(response).toEqual({
        success: false,
        error,
        requestId,
        timestamp: expect.any(String)
      });
    });
  });

  describe('HTTP Response Handling', () => {
    it('should send error response with correct HTTP status', () => {
      const res = createMockResponse();
      const context = {
        requestId: 'req_123',
        userId: 'user_123',
        operation: 'TEST_OPERATION',
        component: 'TEST_COMPONENT'
      };

      OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.ORDER_NOT_FOUND,
        context
      );

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Order not found in the system.',
          code: OrderStatusErrorCode.ORDER_NOT_FOUND,
          retryable: false
        },
        requestId: 'req_123',
        timestamp: expect.any(String)
      });
    });

    it('should send success response', () => {
      const res = createMockResponse();
      const data = { orderId: '123', status: 'COMPLETE' };
      const context = {
        requestId: 'req_123',
        userId: 'user_123',
        operation: 'TEST_OPERATION',
        component: 'TEST_COMPONENT'
      };

      OrderStatusErrorHandler.sendSuccessResponse(res, data, context);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data,
        requestId: 'req_123',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Broker Error Categorization', () => {
    it('should categorize session expired errors', () => {
      const error = { message: 'Session expired', errorType: 'SESSION_EXPIRED' };
      const result = OrderStatusErrorHandler.categorizeBrokerError(error, 'TestBroker');
      
      expect(result.code).toBe(OrderStatusErrorCode.SESSION_EXPIRED);
      expect(result.message).toContain('TestBroker');
      expect(result.message).toContain('reconnect');
    });

    it('should categorize rate limit errors', () => {
      const error = { message: 'Rate limit exceeded' };
      const result = OrderStatusErrorHandler.categorizeBrokerError(error, 'TestBroker');
      
      expect(result.code).toBe(OrderStatusErrorCode.RATE_LIMIT_ERROR);
      expect(result.message).toContain('Rate limit exceeded');
    });

    it('should categorize network errors', () => {
      const error = { message: 'Network timeout occurred' };
      const result = OrderStatusErrorHandler.categorizeBrokerError(error, 'TestBroker');
      
      expect(result.code).toBe(OrderStatusErrorCode.NETWORK_ERROR);
      expect(result.message).toContain('Network error');
    });

    it('should categorize order not found errors', () => {
      const error = { message: 'Order not found in broker system' };
      const result = OrderStatusErrorHandler.categorizeBrokerError(error, 'TestBroker');
      
      expect(result.code).toBe(OrderStatusErrorCode.ORDER_NOT_FOUND_IN_BROKER);
      expect(result.message).toContain('not found');
    });

    it('should default to generic broker error', () => {
      const error = { message: 'Unknown broker error' };
      const result = OrderStatusErrorHandler.categorizeBrokerError(error, 'TestBroker');
      
      expect(result.code).toBe(OrderStatusErrorCode.BROKER_ERROR);
      expect(result.message).toContain('Failed to get status');
    });
  });

  describe('Validation Methods', () => {
    describe('validateOrderId', () => {
      it('should validate valid order ID', () => {
        const result = OrderStatusErrorHandler.validateOrderId('valid_order_id');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject null/undefined order ID', () => {
        const result = OrderStatusErrorHandler.validateOrderId(null);
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(OrderStatusErrorCode.MISSING_ORDER_ID);
      });

      it('should reject empty string order ID', () => {
        const result = OrderStatusErrorHandler.validateOrderId('   ');
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(OrderStatusErrorCode.MISSING_ORDER_ID);
      });

      it('should reject non-string order ID', () => {
        const result = OrderStatusErrorHandler.validateOrderId(123);
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(OrderStatusErrorCode.MISSING_ORDER_ID);
      });
    });

    describe('validateBrokerName', () => {
      it('should validate valid broker name', () => {
        const result = OrderStatusErrorHandler.validateBrokerName('valid_broker');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should allow undefined broker name', () => {
        const result = OrderStatusErrorHandler.validateBrokerName(undefined);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject empty string broker name', () => {
        const result = OrderStatusErrorHandler.validateBrokerName('   ');
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(OrderStatusErrorCode.INVALID_BROKER_NAME);
      });
    });

    describe('validateAuthentication', () => {
      it('should validate authenticated user', () => {
        const result = OrderStatusErrorHandler.validateAuthentication('user_123');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject unauthenticated user', () => {
        const result = OrderStatusErrorHandler.validateAuthentication(null);
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(OrderStatusErrorCode.AUTHENTICATION_ERROR);
      });
    });

    describe('validateOrderOwnership', () => {
      it('should validate matching user IDs', () => {
        const result = OrderStatusErrorHandler.validateOrderOwnership('user_123', 'user_123');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject non-matching user IDs', () => {
        const result = OrderStatusErrorHandler.validateOrderOwnership('user_123', 'user_456');
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(OrderStatusErrorCode.ACCESS_DENIED);
      });
    });

    describe('validateBrokerMatch', () => {
      it('should validate matching broker names', () => {
        const result = OrderStatusErrorHandler.validateBrokerMatch('TestBroker', 'TestBroker');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should validate case-insensitive broker names', () => {
        const result = OrderStatusErrorHandler.validateBrokerMatch('TestBroker', 'testbroker');
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should allow undefined provided broker name', () => {
        const result = OrderStatusErrorHandler.validateBrokerMatch('TestBroker', undefined);
        expect(result.isValid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it('should reject non-matching broker names', () => {
        const result = OrderStatusErrorHandler.validateBrokerMatch('TestBroker', 'OtherBroker');
        expect(result.isValid).toBe(false);
        expect(result.error?.code).toBe(OrderStatusErrorCode.BROKER_MISMATCH);
      });
    });
  });

  describe('Error Category Configuration', () => {
    it('should have correct HTTP status codes for all error types', () => {
      // Authentication errors should be 401
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.AUTHENTICATION_ERROR].httpStatus).toBe(401);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.SESSION_EXPIRED].httpStatus).toBe(401);
      
      // Validation errors should be 400
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.MISSING_ORDER_ID].httpStatus).toBe(400);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.INVALID_BROKER_NAME].httpStatus).toBe(400);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.BROKER_MISMATCH].httpStatus).toBe(400);
      
      // Access denied should be 403
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.ACCESS_DENIED].httpStatus).toBe(403);
      
      // Not found errors should be 404
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.ORDER_NOT_FOUND].httpStatus).toBe(404);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.ORDER_NOT_FOUND_IN_BROKER].httpStatus).toBe(404);
      
      // Rate limiting should be 429
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.RATE_LIMIT_ERROR].httpStatus).toBe(429);
      
      // Server errors should be 500
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.INTERNAL_ERROR].httpStatus).toBe(500);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.DATABASE_ERROR].httpStatus).toBe(500);
      
      // Service unavailable should be 503
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.BROKER_CONNECTION_ERROR].httpStatus).toBe(503);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.BROKER_SERVICE_ERROR].httpStatus).toBe(503);
    });

    it('should have appropriate retryable flags', () => {
      // Authentication and validation errors should not be retryable
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.AUTHENTICATION_ERROR].retryable).toBe(false);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.MISSING_ORDER_ID].retryable).toBe(false);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.ACCESS_DENIED].retryable).toBe(false);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.ORDER_NOT_FOUND].retryable).toBe(false);
      
      // Network and service errors should be retryable
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.NETWORK_ERROR].retryable).toBe(true);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.BROKER_CONNECTION_ERROR].retryable).toBe(true);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.RATE_LIMIT_ERROR].retryable).toBe(true);
      expect(ERROR_CATEGORY_MAP[OrderStatusErrorCode.INTERNAL_ERROR].retryable).toBe(true);
    });
  });
});