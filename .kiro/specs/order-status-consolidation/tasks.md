# Implementation Plan

- [x] 1. Standardize database compatibility layer to use string IDs only
  - Update `databaseCompatibility.getOrderHistoryById()` to accept only string parameters (MongoDB ObjectId format)
  - Remove any numeric ID handling and legacy ID conversion utilities
  - Add `getOrderHistoryByBrokerOrderId()` method for broker order ID lookups
  - Write unit tests for string ID handling scenarios only
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Implement single consolidated order status controller method
  - Create unified `checkOrderStatus` method as the only order status endpoint
  - Implement proper input validation for order ID parameter
  - Add user ownership verification before returning order status
  - Implement fresh status retrieval from broker APIs with error handling
  - _Requirements: 1.1, 1.3, 3.2, 4.2_

- [x] 3. Remove duplicate GET endpoint and controller method
  - Delete `getOrderStatus` controller method entirely
  - Remove GET `/order-status/:brokerOrderId` route from router
  - Ensure only POST `/check-order-status` endpoint exists
  - Update route documentation to reflect single endpoint
  - _Requirements: 1.1, 4.1_

- [x] 4. Standardize error handling and response formats
  - Implement standardized error response structure with success/error format
  - Add error categorization with appropriate HTTP status codes
  - Create user-friendly error messages for common failure scenarios
  - Implement proper logging for all error conditions
  - _Requirements: 3.2, 4.4_

- [x] 5. Add database update and WebSocket broadcasting
  - Implement order status update logic when broker status changes
  - Add WebSocket broadcasting for real-time order status updates
  - Ensure database consistency during status updates
  - Add error handling for database update failures
  - _Requirements: 1.4, 2.3_

- [x] 6. Update frontend to use only the consolidated endpoint
  - Modify all frontend order status checking to use POST `/check-order-status` endpoint only
  - Remove any references to the old GET endpoint in frontend code
  - Update error handling to work with new standardized error response format
  - Verify UI functionality works correctly with the single endpoint
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 7. Create comprehensive unit tests for consolidated functionality
  - Write tests for the single checkOrderStatus method with various input scenarios
  - Test error handling for all error categories (missing ID, not found, access denied)
  - Test user ownership verification logic
  - Ensure no tests reference the removed GET endpoint
  - _Requirements: 1.1, 3.1, 4.2_

- [x] 8. Add integration tests for end-to-end functionality
  - Test complete order status flow from API request to database update
  - Test only the POST endpoint functionality
  - Test WebSocket broadcasting functionality
  - Test with multiple broker types to ensure consistency
  - _Requirements: 1.3, 1.4, 2.3_

- [x] 9. Remove all duplicate and legacy code
  - Delete duplicate controller methods and route handlers
  - Remove any legacy database methods that handle numeric IDs
  - Clean up unused imports and deprecated methods
  - Remove any legacy error handling patterns
  - _Requirements: 4.1, 4.3_

- [x] 10. Add comprehensive logging and verify UI integration
  - Implement structured logging for all order status operations
  - Add performance monitoring for API response times
  - Cross-check with UI to ensure all order status functionality works as intended
  - Verify no UI components are broken by the consolidation
  - _Requirements: 4.4_
