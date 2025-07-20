# Implementation Plan

- [x] 1. Fix core Shoonya API integration
  - Fix ShoonyaService.getOrderStatus() method to use correct API parameters according to Shoonya documentation
  - Update parameter mapping to send uid, actid, norenordno, and exch fields correctly
  - Fix response parsing to handle Shoonya's actual response format
  - Add proper error handling for different Shoonya API error scenarios
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Standardize service adapter implementation
  - Update ShoonyaServiceAdapter.getOrderStatus() to properly transform Shoonya responses to unified format
  - Implement retry logic with exponential backoff for network errors
  - Add proper error categorization and user-friendly error messages
  - Ensure consistent response format matching IBrokerService interface
  - _Requirements: 1.4, 2.3, 3.1, 3.3_

- [x] 3. Fix unified service layer consistency
  - Update UnifiedShoonyaService.getOrderStatus() to maintain consistency with unified broker response format
  - Ensure proper authentication state management and session validation
  - Add comprehensive logging for debugging and monitoring
  - Implement proper status mapping from Shoonya statuses to unified statuses
  - _Requirements: 1.1, 1.4, 4.1, 4.2_

- [x] 4. Update broker controller endpoint
  - Fix BrokerController.getOrderStatus() parameter validation and routing logic
  - Update error response formatting to provide clear user feedback
  - Ensure proper authentication checks and user permission validation
  - Add comprehensive request/response logging for troubleshooting
  - _Requirements: 2.4, 3.1, 4.1, 4.3_

- [x] 5. Improve order status service integration
  - Update OrderStatusService.checkOrderStatus() to use fixed Shoonya API integration
  - Ensure proper database updates when order status changes
  - Fix WebSocket broadcasting for real-time order status updates
  - Add proper error handling for database operations
  - _Requirements: 1.1, 3.4, 4.3_

- [x] 6. Add comprehensive error handling
  - Implement proper error categorization for different failure scenarios
  - Add user-friendly error messages for common issues like session expiry
  - Implement retry logic with appropriate backoff strategies
  - Add rate limiting protection and proper throttling
  - _Requirements: 3.1, 3.2, 3.3, 4.4_

- [x] 7. Remove legacy implementations
  - Identify and remove duplicate or outdated order status code paths
  - Consolidate error handling patterns across all service layers
  - Clean up unused imports and deprecated methods
  - Update code comments and documentation
  - _Requirements: 2.1, 2.2_

- [x] 8. Add comprehensive testing
  - Write unit tests for Shoonya API parameter mapping and response transformation
  - Create integration tests for end-to-end order status flow
  - Add tests for error scenarios and edge cases
  - Test WebSocket broadcasting and database update functionality
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 9. Update logging and monitoring
  - Add structured logging for all order status operations
  - Implement proper error logging with sufficient detail for debugging
  - Add performance monitoring for API response times
  - Create audit logs for order status changes
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 10. Validate and test complete implementation
  - Test order status retrieval with real Shoonya accounts
  - Verify error handling works correctly for various failure scenarios
  - Confirm WebSocket updates are broadcast properly
  - Validate database consistency and audit trail functionality
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.4_