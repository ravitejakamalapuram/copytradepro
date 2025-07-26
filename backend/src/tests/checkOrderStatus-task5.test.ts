import { checkOrderStatus } from '../controllers/brokerController';
import { userDatabase } from '../services/databaseCompatibility';
import { orderStatusUpdateService } from '../services/orderStatusUpdateService';
import BrokerConnectionHelper from '../helpers/brokerConnectionHelper';

// Mock dependencies
jest.mock('../services/databaseCompatibility');
jest.mock('../services/orderStatusUpdateService');
jest.mock('../helpers/brokerConnectionHelper');
jest.mock('../services/comprehensiveErrorHandler', () => ({
  comprehensiveErrorHandler: {
    executeWithRetry: jest.fn()
  }
}));

describe('checkOrderStatus - Task 5 Integration', () => {
  let mockReq: any;
  let mockRes: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      user: { id: 'user123' },
      body: { orderId: '507f1f77bcf86cd799439011', brokerName: 'shoonya' },
      headers: {},
      ip: '127.0.0.1'
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  it('should update database and broadcast WebSocket when order status changes', async () => {
    // Mock order found in database
    const mockOrder = {
      id: '507f1f77bcf86cd799439011',
      user_id: 'user123',
      broker_name: 'shoonya',
      broker_order_id: 'BROKER123',
      account_id: 'account123',
      status: 'PENDING',
      symbol: 'RELIANCE',
      quantity: 100,
      price: 2500,
      created_at: new Date().toISOString()
    };

    // Mock fresh status from broker
    const mockFreshStatus = {
      stat: 'Ok',
      status: 'EXECUTED',
      executedQuantity: 100,
      averagePrice: 2505,
      updateTime: new Date().toISOString()
    };

    // Mock updated order after database update
    const mockUpdatedOrder = {
      ...mockOrder,
      status: 'EXECUTED',
      executed_quantity: 100,
      average_price: 2505
    };

    // Setup mocks
    (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrder);
    (userDatabase.getOrderHistoryByBrokerOrderId as jest.Mock).mockResolvedValue(null);
    
    (BrokerConnectionHelper.findBrokerConnection as jest.Mock).mockReturnValue({
      success: true,
      connection: {
        getOrderStatus: jest.fn().mockResolvedValue(mockFreshStatus)
      }
    });

    // Mock the comprehensive error handler
    const { comprehensiveErrorHandler } = require('../services/comprehensiveErrorHandler');
    comprehensiveErrorHandler.executeWithRetry.mockResolvedValue(mockFreshStatus);

    // Mock order status update service
    (orderStatusUpdateService.updateOrderStatusComprehensive as jest.Mock).mockResolvedValue({
      success: true,
      updated: true,
      orderHistory: mockUpdatedOrder,
      broadcastResult: {
        success: true,
        retriesUsed: 0
      }
    });

    // Execute the controller method
    await checkOrderStatus(mockReq, mockRes);

    // Verify database lookup was called
    expect(userDatabase.getOrderHistoryById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');

    // Verify broker API was called
    expect(BrokerConnectionHelper.findBrokerConnection).toHaveBeenCalledWith(
      'user123',
      'shoonya',
      'account123'
    );

    // Verify comprehensive order status update was called
    expect(orderStatusUpdateService.updateOrderStatusComprehensive).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      expect.objectContaining({
        status: 'EXECUTED',
        executedQuantity: 100,
        averagePrice: 2505,
        brokerResponse: mockFreshStatus
      }),
      'user123',
      expect.objectContaining({
        broadcastUpdate: true,
        requireAcknowledgment: false,
        maxBroadcastRetries: 3,
        skipIfUnchanged: true
      })
    );

    // Verify success response was sent
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        orderId: '507f1f77bcf86cd799439011',
        brokerOrderId: 'BROKER123',
        status: 'EXECUTED',
        statusChanged: true,
        previousStatus: 'PENDING',
        filledQuantity: 100,
        averagePrice: 2505
      }),
      message: expect.any(String),
      timestamp: expect.any(String),
      requestId: expect.any(String)
    });
  });

  it('should handle database update failure gracefully', async () => {
    // Mock order found in database
    const mockOrder = {
      id: '507f1f77bcf86cd799439011',
      user_id: 'user123',
      broker_name: 'shoonya',
      broker_order_id: 'BROKER123',
      account_id: 'account123',
      status: 'PENDING',
      symbol: 'RELIANCE',
      quantity: 100,
      price: 2500,
      created_at: new Date().toISOString()
    };

    // Mock fresh status from broker
    const mockFreshStatus = {
      stat: 'Ok',
      status: 'EXECUTED',
      executedQuantity: 100,
      averagePrice: 2505,
      updateTime: new Date().toISOString()
    };

    // Setup mocks
    (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrder);
    (userDatabase.getOrderHistoryByBrokerOrderId as jest.Mock).mockResolvedValue(null);
    
    (BrokerConnectionHelper.findBrokerConnection as jest.Mock).mockReturnValue({
      success: true,
      connection: {
        getOrderStatus: jest.fn().mockResolvedValue(mockFreshStatus)
      }
    });

    // Mock the comprehensive error handler
    const { comprehensiveErrorHandler } = require('../services/comprehensiveErrorHandler');
    comprehensiveErrorHandler.executeWithRetry.mockResolvedValue(mockFreshStatus);

    // Mock order status update service to fail
    (orderStatusUpdateService.updateOrderStatusComprehensive as jest.Mock).mockResolvedValue({
      success: false,
      updated: false,
      error: 'Database update failed'
    });

    // Execute the controller method
    await checkOrderStatus(mockReq, mockRes);

    // Verify error response was sent
    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'DATABASE_UPDATE_ERROR',
          message: 'Failed to update order status in database'
        })
      })
    );
  });

  it('should handle WebSocket broadcast failure but still return success', async () => {
    // Mock order found in database
    const mockOrder = {
      id: '507f1f77bcf86cd799439011',
      user_id: 'user123',
      broker_name: 'shoonya',
      broker_order_id: 'BROKER123',
      account_id: 'account123',
      status: 'PENDING',
      symbol: 'RELIANCE',
      quantity: 100,
      price: 2500,
      created_at: new Date().toISOString()
    };

    // Mock fresh status from broker
    const mockFreshStatus = {
      stat: 'Ok',
      status: 'EXECUTED',
      executedQuantity: 100,
      averagePrice: 2505,
      updateTime: new Date().toISOString()
    };

    // Mock updated order after database update
    const mockUpdatedOrder = {
      ...mockOrder,
      status: 'EXECUTED',
      executed_quantity: 100,
      average_price: 2505
    };

    // Setup mocks
    (userDatabase.getOrderHistoryById as jest.Mock).mockResolvedValue(mockOrder);
    (userDatabase.getOrderHistoryByBrokerOrderId as jest.Mock).mockResolvedValue(null);
    
    (BrokerConnectionHelper.findBrokerConnection as jest.Mock).mockReturnValue({
      success: true,
      connection: {
        getOrderStatus: jest.fn().mockResolvedValue(mockFreshStatus)
      }
    });

    // Mock the comprehensive error handler
    const { comprehensiveErrorHandler } = require('../services/comprehensiveErrorHandler');
    comprehensiveErrorHandler.executeWithRetry.mockResolvedValue(mockFreshStatus);

    // Mock order status update service with WebSocket failure
    (orderStatusUpdateService.updateOrderStatusComprehensive as jest.Mock).mockResolvedValue({
      success: true,
      updated: true,
      orderHistory: mockUpdatedOrder,
      broadcastResult: {
        success: false,
        error: 'WebSocket connection failed',
        retriesUsed: 3
      }
    });

    // Execute the controller method
    await checkOrderStatus(mockReq, mockRes);

    // Verify success response was still sent (database update succeeded)
    expect(mockRes.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        orderId: '507f1f77bcf86cd799439011',
        status: 'EXECUTED',
        statusChanged: true
      }),
      message: expect.any(String),
      timestamp: expect.any(String),
      requestId: expect.any(String)
    });
  });
});