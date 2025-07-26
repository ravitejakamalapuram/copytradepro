/**
 * Integration test for order status consolidation
 * Verifies that frontend properly uses the consolidated endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { brokerService } from '../services/brokerService';

// Mock the API module
vi.mock('../services/api', () => ({
  default: {
    post: vi.fn()
  }
}));

import api from '../services/api';

describe('Order Status Consolidation - Frontend Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkOrderStatus', () => {
    it('should use POST /broker/check-order-status endpoint', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            orderId: '123',
            brokerOrderId: 'BROKER123',
            status: 'EXECUTED',
            symbol: 'RELIANCE',
            quantity: 100,
            filledQuantity: 100,
            price: 2500,
            averagePrice: 2505,
            timestamp: new Date(),
            brokerName: 'shoonya',
            statusChanged: true,
            previousStatus: 'PENDING'
          },
          timestamp: new Date().toISOString()
        }
      };

      (api.post as any).mockResolvedValue(mockResponse);

      const result = await brokerService.checkOrderStatus('123');

      // Verify correct endpoint is called
      expect(api.post).toHaveBeenCalledWith('/broker/check-order-status', {
        orderId: '123'
      });

      // Verify response is returned correctly
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle standardized error response format', async () => {
      const mockErrorResponse = {
        response: {
          data: {
            success: false,
            error: {
              message: 'Order not found',
              code: 'ORDER_NOT_FOUND',
              retryable: false
            },
            timestamp: new Date().toISOString()
          }
        }
      };

      (api.post as any).mockRejectedValue(mockErrorResponse);

      const result = await brokerService.checkOrderStatus('invalid-id');

      // Verify error response is handled correctly
      expect(result).toEqual(mockErrorResponse.response.data);
    });

    it('should handle network errors with standardized format', async () => {
      const networkError = new Error('Network Error');
      (api.post as any).mockRejectedValue(networkError);

      const result = await brokerService.checkOrderStatus('123');

      // Verify network error is converted to standardized format
      expect(result).toEqual({
        success: false,
        error: {
          message: 'Network error. Please check your connection and try again.',
          code: 'NETWORK_ERROR',
          retryable: true
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Legacy endpoint verification', () => {
    it('should not use GET endpoint for order status checking', async () => {
      // This test ensures we're not accidentally using the old GET endpoint
      const mockResponse = {
        data: {
          success: true,
          data: { status: 'EXECUTED' }
        }
      };

      (api.post as any).mockResolvedValue(mockResponse);

      await brokerService.checkOrderStatus('123');

      // Verify only POST endpoint is used
      expect(api.post).toHaveBeenCalledWith('/broker/check-order-status', {
        orderId: '123'
      });

      // Verify GET is not called (we don't have api.get mock, so this would fail if called)
      expect(api.post).toHaveBeenCalledTimes(1);
    });
  });
});