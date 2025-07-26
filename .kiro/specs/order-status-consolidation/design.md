# Design Document

## Overview

This design addresses the consolidation of duplicate order status endpoints and inconsistent database methods in the CopyTrade Pro application. The current system has evolved to include multiple ways to check order status, creating confusion and maintenance overhead. The solution involves standardizing on a single primary endpoint, updating the database compatibility layer to handle consistent ID formats, and removing duplicate implementations while maintaining backward compatibility.

## Architecture

The consolidated order status system will follow this flow:

```
Frontend → Primary Endpoint (POST /check-order-status) → Unified Controller Logic → Database Compatibility Layer → Storage Backend
                ↑
Legacy Endpoint (GET /order-status/:id) → Redirect Logic
```

### Current State Analysis

**Duplicate Endpoints:**
- `GET /api/broker/order-status/:brokerOrderId` - Uses `getOrderStatus` controller method
- `POST /api/broker/check-order-status` - Uses `checkOrderStatus` controller method

**Inconsistent Database Methods:**
- `mongoDatabase.getOrderHistoryById(id: string)` - Expects MongoDB ObjectId as string
- `databaseCompatibility.getOrderHistoryById(id: number)` - Expects numeric ID

## Components and Interfaces

### 1. Consolidated Controller Design

#### Primary Endpoint: POST /check-order-status
This will be the main endpoint for order status checking:

```typescript
interface OrderStatusRequest {
  orderId: string;  // Can be broker order ID or internal order ID
  brokerName?: string;  // Optional broker specification
}

interface OrderStatusResponse {
  success: boolean;
  data?: {
    orderId: string;
    brokerOrderId: string;
    status: OrderStatusType;
    symbol: string;
    quantity: number;
    filledQuantity: number;
    price: number;
    averagePrice: number;
    timestamp: Date;
    brokerName: string;
    rejectionReason?: string;
  };
  error?: {
    message: string;
    code: string;
    retryable: boolean;
  };
}
```

#### Legacy Endpoint Handling
The GET endpoint will be maintained for backward compatibility but will internally redirect to the POST endpoint:

```typescript
export const getOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
  const orderId = req.params.brokerOrderId;
  
  // Create a new request object that matches the POST endpoint format
  const consolidatedRequest = {
    ...req,
    body: { orderId }
  };
  
  // Call the consolidated implementation
  return await checkOrderStatus(consolidatedRequest, res);
};
```

### 2. Database Compatibility Layer Enhancement

#### Unified ID Handling
The database compatibility layer will be updated to handle both string and numeric IDs:

```typescript
class DatabaseCompatibility {
  async getOrderHistoryById(id: string | number): Promise<OrderHistory | null> {
    const db = await this.getDb();
    
    // Handle both string (MongoDB ObjectId) and numeric (legacy) IDs
    if (typeof id === 'string') {
      // For MongoDB, use string ID directly
      return await db.getOrderHistoryById(id);
    } else {
      // For legacy numeric IDs, convert or handle appropriately
      return await db.getOrderHistoryByLegacyId(id);
    }
  }
  
  async getOrderHistoryByBrokerOrderId(brokerOrderId: string): Promise<OrderHistory | null> {
    const db = await this.getDb();
    return await db.getOrderHistoryByBrokerOrderId(brokerOrderId);
  }
}
```

#### MongoDB Interface Standardization
Ensure the MongoDB interface consistently uses string IDs:

```typescript
interface IMongoDatabase {
  getOrderHistoryById(id: string): Promise<OrderHistory | null>;
  getOrderHistoryByBrokerOrderId(brokerOrderId: string): Promise<OrderHistory | null>;
  // ... other methods
}
```

### 3. Unified Controller Implementation

#### Consolidated checkOrderStatus Method
```typescript
export const checkOrderStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { orderId, brokerName } = req.body;
    const userId = req.user.id;
    
    // Validate input
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Order ID is required',
          code: 'MISSING_ORDER_ID',
          retryable: false
        }
      });
    }
    
    // Try to find order in database first
    let orderHistory = await databaseCompatibility.getOrderHistoryById(orderId);
    
    // If not found by internal ID, try broker order ID
    if (!orderHistory) {
      orderHistory = await databaseCompatibility.getOrderHistoryByBrokerOrderId(orderId);
    }
    
    if (!orderHistory) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND',
          retryable: false
        }
      });
    }
    
    // Verify user owns this order
    if (orderHistory.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Access denied',
          code: 'ACCESS_DENIED',
          retryable: false
        }
      });
    }
    
    // Get fresh status from broker
    const brokerService = await getBrokerService(orderHistory.brokerName, userId);
    const freshStatus = await brokerService.getOrderStatus(orderHistory.brokerOrderId);
    
    // Update database if status changed
    if (freshStatus.status !== orderHistory.status) {
      await databaseCompatibility.updateOrderStatus(orderHistory.id, freshStatus.status);
      
      // Broadcast update via WebSocket
      broadcastOrderUpdate(userId, {
        orderId: orderHistory.id,
        brokerOrderId: orderHistory.brokerOrderId,
        status: freshStatus.status,
        timestamp: new Date()
      });
    }
    
    return res.json({
      success: true,
      data: {
        orderId: orderHistory.id,
        brokerOrderId: orderHistory.brokerOrderId,
        status: freshStatus.status,
        symbol: orderHistory.symbol,
        quantity: orderHistory.quantity,
        filledQuantity: freshStatus.filledQuantity,
        price: orderHistory.price,
        averagePrice: freshStatus.averagePrice,
        timestamp: freshStatus.timestamp,
        brokerName: orderHistory.brokerName,
        rejectionReason: freshStatus.rejectionReason
      }
    });
    
  } catch (error) {
    logger.error('Error checking order status:', error);
    return res.status(500).json({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        retryable: true
      }
    });
  }
};
```

## Data Models

### Standardized Order History Interface
```typescript
interface OrderHistory {
  id: string;                    // Internal order ID (MongoDB ObjectId as string)
  brokerOrderId: string;         // Broker's order ID
  userId: string;                // User who placed the order
  brokerName: string;            // Broker identifier
  symbol: string;                // Trading symbol
  quantity: number;              // Order quantity
  price: number;                 // Order price
  status: OrderStatusType;       // Current status
  orderType: OrderType;          // Order type (MARKET, LIMIT, etc.)
  side: OrderSide;              // BUY or SELL
  timestamp: Date;               // Order placement time
  lastUpdated: Date;             // Last status update time
  filledQuantity?: number;       // Executed quantity
  averagePrice?: number;         // Average execution price
  rejectionReason?: string;      // If rejected
  metadata?: Record<string, any>; // Additional broker-specific data
}
```

### Database Migration Strategy
For systems transitioning from numeric IDs to string IDs:

```typescript
interface LegacyOrderMapping {
  legacyId: number;              // Old numeric ID
  newId: string;                 // New MongoDB ObjectId
  migrationDate: Date;           // When migration occurred
}
```

## Error Handling

### Standardized Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  error: {
    message: string;             // User-friendly error message
    code: string;                // Machine-readable error code
    retryable: boolean;          // Whether the operation can be retried
    details?: any;               // Additional error context
  };
}
```

### Error Categories
- `MISSING_ORDER_ID`: Required order ID not provided
- `ORDER_NOT_FOUND`: Order doesn't exist in database
- `ACCESS_DENIED`: User doesn't have permission to access order
- `BROKER_ERROR`: Error from broker API
- `DATABASE_ERROR`: Database operation failed
- `INTERNAL_ERROR`: Unexpected system error

## Testing Strategy

### Unit Tests
- Test consolidated controller logic with various input scenarios
- Test database compatibility layer with both string and numeric IDs
- Test error handling for all error categories
- Test legacy endpoint redirection logic

### Integration Tests
- Test end-to-end order status flow through consolidated endpoint
- Test backward compatibility with existing frontend code
- Test database migration scenarios
- Test WebSocket broadcasting functionality

### API Tests
- Test both POST and GET endpoints return consistent responses
- Test error responses match expected format
- Test authentication and authorization
- Test rate limiting and performance

## Implementation Phases

### Phase 1: Database Layer Consolidation
1. Update databaseCompatibility to handle string IDs consistently
2. Add methods for both internal ID and broker order ID lookup
3. Implement ID conversion utilities for legacy support
4. Add comprehensive unit tests

### Phase 2: Controller Consolidation
1. Implement consolidated checkOrderStatus method
2. Update getOrderStatus to redirect to consolidated implementation
3. Standardize error handling and response formats
4. Add integration tests

### Phase 3: Frontend Updates
1. Update frontend code to use primary POST endpoint
2. Remove references to legacy GET endpoint where possible
3. Update error handling to work with new response format
4. Add frontend tests

### Phase 4: Legacy Cleanup
1. Mark legacy methods as deprecated
2. Add migration guides for external API consumers
3. Remove unused code paths
4. Update documentation

## Security Considerations

- Validate user ownership of orders before returning status
- Sanitize all input parameters to prevent injection attacks
- Implement rate limiting to prevent abuse
- Log security-relevant events for audit purposes
- Ensure sensitive order information is not exposed in error messages

## Performance Considerations

- Cache frequently accessed order status to reduce broker API calls
- Implement efficient database queries with proper indexing
- Use connection pooling for database operations
- Monitor API response times and implement timeouts
- Consider implementing background order status updates for active orders

## Backward Compatibility

- Maintain GET endpoint for existing integrations
- Ensure response formats remain consistent
- Provide migration period for deprecated features
- Document all changes and provide upgrade guides
- Support both old and new ID formats during transition period