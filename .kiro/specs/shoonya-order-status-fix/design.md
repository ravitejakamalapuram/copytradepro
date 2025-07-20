# Design Document

## Overview

This design addresses the issues with the Shoonya order status API implementation in CopyTrade Pro. The current implementation has several problems:

1. Incorrect API parameter mapping for Shoonya's SingleOrdStatus endpoint
2. Inconsistent response handling between different broker service layers
3. Legacy code paths that cause confusion and maintenance issues
4. Missing proper error handling and user feedback

The solution involves fixing the Shoonya API integration, standardizing the response format, and cleaning up legacy implementations while maintaining backward compatibility with the existing unified broker interface.

## Architecture

The order status functionality spans multiple layers:

```
Frontend Request → Broker Controller → Enhanced Unified Broker Manager → Shoonya Service Adapter → Shoonya Service → Shoonya API
```

### Key Components:
- **Broker Controller**: HTTP endpoint handler for order status requests
- **Enhanced Unified Broker Manager**: Manages broker connections and routing
- **Shoonya Service Adapter**: Implements IBrokerService interface for Shoonya
- **Shoonya Service**: Direct Shoonya API integration
- **Order Status Service**: Background monitoring and database updates

## Components and Interfaces

### 1. Shoonya API Integration

Based on Shoonya API documentation, the SingleOrdStatus endpoint requires:

**Request Parameters:**
```typescript
{
  uid: string,        // User ID
  actid: string,      // Account ID (same as uid for most cases)
  norenordno: string, // Order number from Shoonya
  exch?: string       // Exchange (optional but recommended)
}
```

**Response Format:**
```typescript
{
  stat: 'Ok' | 'Not_Ok',
  norenordno?: string,    // Order number
  status?: string,        // Order status (OPEN, COMPLETE, CANCELLED, etc.)
  tsym?: string,          // Trading symbol
  qty?: string,           // Order quantity
  prc?: string,           // Order price
  fillshares?: string,    // Filled quantity
  avgprc?: string,        // Average price
  rejreason?: string,     // Rejection reason if any
  norentm?: string,       // Order time
  exch_tm?: string,       // Exchange timestamp
  emsg?: string           // Error message if stat is Not_Ok
}
```

### 2. Service Layer Improvements

#### ShoonyaService.getOrderStatus()
- Fix parameter mapping to match Shoonya API specification
- Improve error handling and response transformation
- Add proper logging for debugging

#### ShoonyaServiceAdapter.getOrderStatus()
- Standardize response format to match IBrokerService interface
- Implement retry logic for transient failures
- Add proper error categorization

#### UnifiedShoonyaService.getOrderStatus()
- Ensure consistency with unified broker response format
- Handle authentication state management
- Provide user-friendly error messages

### 3. Controller Layer Updates

#### BrokerController.getOrderStatus()
- Fix parameter validation and routing
- Improve error response formatting
- Add proper authentication checks

### 4. Database Integration

#### Order Status Updates
- Ensure order status changes are properly persisted
- Update WebSocket broadcasts for real-time updates
- Maintain audit trail of status changes

## Data Models

### Unified Order Status Response
```typescript
interface UnifiedOrderStatus {
  orderId: string;           // Internal order ID
  brokerOrderId: string;     // Broker's order ID
  status: OrderStatusType;   // Standardized status
  symbol: string;            // Trading symbol
  quantity: number;          // Order quantity
  filledQuantity: number;    // Executed quantity
  price: number;             // Order price
  averagePrice: number;      // Average execution price
  timestamp: Date;           // Last update time
  rejectionReason?: string;  // If rejected
  exchange: string;          // Exchange name
  brokerName: string;        // Broker identifier
}

type OrderStatusType = 
  | 'PLACED' 
  | 'PENDING' 
  | 'EXECUTED' 
  | 'PARTIALLY_FILLED' 
  | 'CANCELLED' 
  | 'REJECTED';
```

### Shoonya Status Mapping
```typescript
const SHOONYA_STATUS_MAP = {
  'OPEN': 'PLACED',
  'COMPLETE': 'EXECUTED', 
  'CANCELLED': 'CANCELLED',
  'REJECTED': 'REJECTED',
  'TRIGGER_PENDING': 'PENDING',
  'PARTIALLY_FILLED': 'PARTIALLY_FILLED'
};
```

## Error Handling

### Error Categories
1. **Authentication Errors**: Session expired, invalid credentials
2. **Validation Errors**: Missing parameters, invalid order ID
3. **Network Errors**: Connection timeout, API unavailable
4. **Business Errors**: Order not found, insufficient permissions
5. **System Errors**: Database failures, internal server errors

### Error Response Format
```typescript
interface ErrorResponse {
  success: false;
  message: string;           // User-friendly message
  errorType: ErrorType;      // Categorized error type
  details?: any;             // Additional error details
  retryable: boolean;        // Whether operation can be retried
}
```

### Retry Strategy
- Network errors: 3 retries with exponential backoff
- Rate limit errors: Respect broker's rate limiting
- Authentication errors: Prompt for re-authentication
- Business errors: No retry, return error immediately

## Testing Strategy

### Unit Tests
- Test Shoonya API parameter mapping
- Test response transformation logic
- Test error handling scenarios
- Test status mapping functions

### Integration Tests
- Test end-to-end order status flow
- Test with real Shoonya API responses
- Test error scenarios with mock responses
- Test database update operations

### API Tests
- Test controller endpoints with various parameters
- Test authentication and authorization
- Test error response formats
- Test WebSocket update broadcasts

## Implementation Phases

### Phase 1: Core API Fix
1. Fix ShoonyaService.getOrderStatus() parameter mapping
2. Update response transformation logic
3. Add proper error handling
4. Update unit tests

### Phase 2: Service Layer Standardization
1. Update ShoonyaServiceAdapter implementation
2. Ensure UnifiedShoonyaService consistency
3. Add retry logic and error categorization
4. Update integration tests

### Phase 3: Controller and Database Updates
1. Fix BrokerController.getOrderStatus() implementation
2. Update database integration
3. Improve WebSocket broadcasting
4. Add comprehensive logging

### Phase 4: Legacy Cleanup
1. Remove duplicate implementations
2. Consolidate error handling patterns
3. Update documentation
4. Performance optimization

## Security Considerations

- Validate user permissions for order access
- Sanitize all input parameters
- Protect sensitive order information in logs
- Ensure secure credential handling
- Implement rate limiting to prevent abuse

## Performance Considerations

- Cache frequently accessed order status
- Implement connection pooling for API calls
- Use efficient database queries
- Minimize WebSocket broadcast overhead
- Monitor API response times and success rates