/**
 * Order Status UI Integration Test
 * Verifies that the frontend correctly integrates with the consolidated order status endpoint
 * Tests the complete UI flow and response handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { brokerService } from '../services/brokerService';
import api from '../services/api';

// Mock the api service
vi.mock('../services/api');
const mockedApi = api as unknown;

describe('Order Status UI Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('brokerService.checkOrderStatus', () => {
    it('should call the consolidated POST endpoint with correct parameters', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            orderId: 'order-123',
            brokerOrderId: 'broker-order-456',
            status: 'EXECUTED',
            symbol: 'RELIANCE',
            quantity: 10,
            filledQuantity: 10,
            price: 2500,
            averagePrice: 2505,
            timestamp: '2024-01-15T10:30:00Z',
            brokerName: 'shoonya',
            statusChanged: true,
            previousStatus: 'PLACED'
          }
        }
      };

      mockedApi.post = vi.fn().mockResolvedValue(mockResponse);

      const result = await brokerService.checkOrderStatus('order-123');

      // Verify correct endpoint is called
      expect(mockedApi.post).toHaveBeenCalledWith('/broker/check-order-status', {
        orderId: 'order-123'
      });

      // Verify response structure matches frontend expectations
      expect(result).toEqual({
        success: true,
        data: {
          orderId: 'order-123',
          brokerOrderId: 'broker-order-456',
          status: 'EXECUTED',
          symbol: 'RELIANCE',
          quantity: 10,
          filledQuantity: 10,
          price: 2500,
          averagePrice: 2505,
          timestamp: '2024-01-15T10:30:00Z',
          brokerName: 'shoonya',
          statusChanged: true,
          previousStatus: 'PLACED'
        }
      });
    });

    it('should handle error responses with standardized format', async () => {
      const mockErrorResponse = {
        response: {
          data: {
            success: false,
            error: {
              message: 'Order not found',
              code: 'ORDER_NOT_FOUND',
              retryable: false
            }
          }
        }
      };

      mockedApi.post = vi.fn().mockRejectedValue(mockErrorResponse);

      const result = await brokerService.checkOrderStatus('non-existent-order');

      // Verify error response structure matches frontend expectations
      expect(result).toEqual({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND',
          retryable: false
        }
      });
    });

    it('should handle network errors with fallback format', async () => {
      const networkError = new Error('Network Error');
      mockedApi.post = vi.fn().mockRejectedValue(networkError);

      const result = await brokerService.checkOrderStatus('order-123');

      // Verify network error fallback format
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

    it('should handle broker API errors correctly', async () => {
      const mockBrokerErrorResponse = {
        response: {
          data: {
            success: false,
            error: {
              message: 'Broker service temporarily unavailable',
              code: 'BROKER_SERVICE_ERROR',
              retryable: true
            }
          }
        }
      };

      mockedApi.post = vi.fn().mockRejectedValue(mockBrokerErrorResponse);

      const result = await brokerService.checkOrderStatus('order-123');

      expect(result).toEqual({
        success: false,
        error: {
          message: 'Broker service temporarily unavailable',
          code: 'BROKER_SERVICE_ERROR',
          retryable: true
        }
      });
    });

    it('should handle authentication errors', async () => {
      const mockAuthErrorResponse = {
        response: {
          data: {
            success: false,
            error: {
              message: 'Authentication required',
              code: 'AUTHENTICATION_ERROR',
              retryable: false
            }
          }
        }
      };

      mockedApi.post = vi.fn().mockRejectedValue(mockAuthErrorResponse);

      const result = await brokerService.checkOrderStatus('order-123');

      expect(result).toEqual({
        success: false,
        error: {
          message: 'Authentication required',
          code: 'AUTHENTICATION_ERROR',
          retryable: false
        }
      });
    });
  });

  describe('Response Format Compatibility', () => {
    it('should return data types compatible with frontend components', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            orderId: 'order-123',
            brokerOrderId: 'broker-order-456',
            status: 'EXECUTED',
            symbol: 'RELIANCE',
            quantity: 10,
            filledQuantity: 10,
            price: 2500,
            averagePrice: 2505,
            timestamp: '2024-01-15T10:30:00Z',
            brokerName: 'shoonya',
            rejectionReason: null,
            statusChanged: true,
            previousStatus: 'PLACED'
          }
        }
      };

      mockedApi.post = vi.fn().mockResolvedValue(mockResponse);

      const result = await brokerService.checkOrderStatus('order-123');

      // Verify data types match what frontend components expect
      expect(typeof result.data.orderId).toBe('string');
      expect(typeof result.data.brokerOrderId).toBe('string');
      expect(typeof result.data.status).toBe('string');
      expect(typeof result.data.symbol).toBe('string');
      expect(typeof result.data.quantity).toBe('number');
      expect(typeof result.data.filledQuantity).toBe('number');
      expect(typeof result.data.price).toBe('number');
      expect(typeof result.data.averagePrice).toBe('number');
      expect(typeof result.data.brokerName).toBe('string');
      expect(typeof result.data.statusChanged).toBe('boolean');
      expect(result.data.rejectionReason).toBeNull();
      expect(typeof result.data.previousStatus).toBe('string');
    });

    it('should handle partial data responses gracefully', async () => {
      const mockPartialResponse = {
        data: {
          success: true,
          data: {
            orderId: 'order-123',
            brokerOrderId: 'broker-order-456',
            status: 'PENDING',
            symbol: 'RELIANCE',
            quantity: 10,
            filledQuantity: 0,
            price: 2500,
            averagePrice: 0,
            timestamp: '2024-01-15T10:00:00Z',
            brokerName: 'shoonya',
            rejectionReason: null,
            statusChanged: false,
            previousStatus: null
          }
        }
      };

      mockedApi.post = vi.fn().mockResolvedValue(mockPartialResponse);

      const result = await brokerService.checkOrderStatus('order-123');

      // Verify partial data is handled correctly
      expect(result.data.filledQuantity).toBe(0);
      expect(result.data.averagePrice).toBe(0);
      expect(result.data.statusChanged).toBe(false);
      expect(result.data.previousStatus).toBeNull();
      expect(result.data.rejectionReason).toBeNull();
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should provide consistent error structure for UI error handling', async () => {
      const testCases = [
        {
          name: 'Order not found',
          mockError: {
            response: {
              data: {
                success: false,
                error: {
                  message: 'Order not found',
                  code: 'ORDER_NOT_FOUND',
                  retryable: false
                }
              }
            }
          },
          expectedError: {
            message: 'Order not found',
            code: 'ORDER_NOT_FOUND',
            retryable: false
          }
        },
        {
          name: 'Access denied',
          mockError: {
            response: {
              data: {
                success: false,
                error: {
                  message: 'Access denied',
                  code: 'ACCESS_DENIED',
                  retryable: false
                }
              }
            }
          },
          expectedError: {
            message: 'Access denied',
            code: 'ACCESS_DENIED',
            retryable: false
          }
        },
        {
          name: 'Broker connection error',
          mockError: {
            response: {
              data: {
                success: false,
                error: {
                  message: 'Not connected to broker. Please reconnect your account.',
                  code: 'BROKER_CONNECTION_ERROR',
                  retryable: true
                }
              }
            }
          },
          expectedError: {
            message: 'Not connected to broker. Please reconnect your account.',
            code: 'BROKER_CONNECTION_ERROR',
            retryable: true
          }
        }
      ];

      for (const testCase of testCases) {
        mockedApi.post = vi.fn().mockRejectedValue(testCase.mockError);

        const result = await brokerService.checkOrderStatus('order-123');

        expect(result).toEqual({
          success: false,
          error: testCase.expectedError
        });
      }
    });
  });

  describe('Frontend Integration Points', () => {
    it('should work with Orders page handleCheckOrderStatus function', async () => {
      // Simulate the Orders page calling checkOrderStatus
      const mockResponse = {
        data: {
          success: true,
          data: {
            orderId: 'order-123',
            brokerOrderId: 'broker-order-456',
            status: 'EXECUTED',
            symbol: 'RELIANCE',
            quantity: 10,
            filledQuantity: 10,
            price: 2500,
            averagePrice: 2505,
            timestamp: '2024-01-15T10:30:00Z',
            brokerName: 'shoonya',
            statusChanged: true,
            previousStatus: 'PLACED'
          }
        }
      };

      mockedApi.post = vi.fn().mockResolvedValue(mockResponse);

      // Simulate Orders page logic
      const orderId = 'order-123';
      const response = await brokerService.checkOrderStatus(orderId);

      if (response.success) {
        const { statusChanged, previousStatus, status: currentStatus } = response.data;
        
        // Verify the response provides all data needed by the Orders page
        expect(statusChanged).toBe(true);
        expect(previousStatus).toBe('PLACED');
        expect(currentStatus).toBe('EXECUTED');
        
        // Verify message generation logic would work
        const message = statusChanged 
          ? `Order status changed from ${previousStatus} to ${currentStatus}`
          : `Order status confirmed: ${currentStatus}`;
        
        expect(message).toBe('Order status changed from PLACED to EXECUTED');
      }
    });

    it('should provide error messages suitable for toast notifications', async () => {
      const mockErrorResponse = {
        response: {
          data: {
            success: false,
            error: {
              message: 'Order not found in your account',
              code: 'ORDER_NOT_FOUND',
              retryable: false
            }
          }
        }
      };

      mockedApi.post = vi.fn().mockRejectedValue(mockErrorResponse);

      const result = await brokerService.checkOrderStatus('non-existent-order');

      // Verify error message is suitable for toast display
      expect(result.error.message).toBe('Order not found in your account');
      expect(result.error.message.length).toBeLessThan(100); // Reasonable length for toast
      expect(result.error.retryable).toBe(false); // UI can decide whether to show retry button
    });
  });
});