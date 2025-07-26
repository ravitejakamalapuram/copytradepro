import { checkOrderStatus } from '../controllers/brokerController';
import { userDatabase } from '../services/databaseCompatibility';
import { AuthenticatedRequest } from '../middleware/auth';
import { Response } from 'express';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import { expect } from '@jest/globals';
import { expect } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
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
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../services/databaseCompatibility');
jest.mock('../services/websocketService');
jest.mock('../helpers/brokerConnectionHelper');

describe('checkOrderStatus Controller Method', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockReq = {
      user: { id: 'user123', email: 'test@example.com', name: 'Test User' },
      body: { orderId: 'order123' },
      headers: {},
      ip: '127.0.0.1'
    };
    
    mockRes = {
      status: mockStatus,
      json: mockJson
    };

    jest.clearAllMocks();
  });

  describe('Input Validation', () => {
    it('should return 401 when user is not authenticated', async () => {
      delete mockReq.user;

      await checkOrderStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'User not authenticated',
          code: 'AUTHENTICATION_ERROR',
          retryable: false
        }
      });
    });

    it('should return 400 when orderId is missing', async () => {
      mockReq.body = {};

      await checkOrderStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Order ID is required and must be a non-empty string',
          code: 'MISSING_ORDER_ID',
          retryable: false
        }
      });
    });

    it('should return 400 when orderId is empty string', async () => {
      mockReq.body = { orderId: '   ' };

      await checkOrderStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Order ID is required and must be a non-empty string',
          code: 'MISSING_ORDER_ID',
          retryable: false
        }
      });
    });

    it('should return 400 when brokerName is invalid', async () => {
      mockReq.body = { orderId: 'order123', brokerName: '   ' };

      await checkOrderStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Broker name must be a non-empty string if provided',
          code: 'INVALID_BROKER_NAME',
          retryable: false
        }
      });
    });
  });

  describe('Order Lookup', () => {
    it('should return 404 when order is not found', async () => {
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(null);
      (userDatabase.getOrderHistoryByBrokerOrderId as jest.Mock).mockResolvedValue(null);

      await checkOrderStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND',
          retryable: false
        }
      });
    });

    it('should try both internal ID and broker order ID lookup', async () => {
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(null);
      (userDatabase.getOrderHistoryByBrokerOrderId as jest.Mock).mockResolvedValue(null);

      await checkOrderStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(userDatabase.getOrderHistoryById).toHaveBeenCalledWith('order123');
      expect(userDatabase.getOrderHistoryByBrokerOrderId).toHaveBeenCalledWith('order123');
    });
  });

  describe('User Ownership Verification', () => {
    it('should return 403 when user does not own the order', async () => {
      const mockOrder = {
        id: 'order123',
        user_id: 'differentUser',
        broker_name: 'shoonya',
        broker_order_id: 'broker123',
        status: 'PENDING'
      };

      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrder);

      await checkOrderStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Access denied',
          code: 'ACCESS_DENIED',
          retryable: false
        }
      });
    });
  });

  describe('Broker Name Validation', () => {
    it('should return 400 when provided broker name does not match order', async () => {
      const mockOrder = {
        id: 'order123',
        user_id: 'user123',
        broker_name: 'shoonya',
        broker_order_id: 'broker123',
        status: 'PENDING'
      };

      mockReq.body = { orderId: 'order123', brokerName: 'fyers' };
      (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrder);

      await checkOrderStatus(mockReq as AuthenticatedRequest, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Order belongs to shoonya, not fyers',
          code: 'BROKER_MISMATCH',
          retryable: false
        }
      });
    });
  });
});