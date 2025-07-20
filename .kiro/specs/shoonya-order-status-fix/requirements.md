# Requirements Document

## Introduction

The Shoonya order status API is not working properly in the CopyTrade Pro application. Users are unable to get accurate order status updates from their Shoonya broker accounts. This feature is critical for tracking order execution, managing positions, and providing real-time updates to users. The current implementation has issues with API parameter mapping, response handling, and legacy code that needs to be cleaned up.

## Requirements

### Requirement 1

**User Story:** As a trader using Shoonya broker, I want to get accurate order status information, so that I can track my order execution and make informed trading decisions.

#### Acceptance Criteria

1. WHEN a user requests order status for a Shoonya order THEN the system SHALL return the current status from Shoonya API
2. WHEN the Shoonya API returns order status THEN the system SHALL correctly map all status fields including order number, status, symbol, quantity, price, executed quantity, and average price
3. WHEN an order status request is made THEN the system SHALL use the correct Shoonya API endpoint with proper authentication
4. WHEN the order status is retrieved THEN the system SHALL transform the response to match the unified broker interface format

### Requirement 2

**User Story:** As a developer maintaining the system, I want clean and consistent API implementations, so that the codebase is maintainable and follows best practices.

#### Acceptance Criteria

1. WHEN implementing order status functionality THEN the system SHALL remove any legacy or duplicate implementations
2. WHEN calling Shoonya APIs THEN the system SHALL use the correct API parameters as specified in Shoonya documentation
3. WHEN handling API responses THEN the system SHALL implement proper error handling and user-friendly error messages
4. WHEN integrating with the unified broker system THEN the implementation SHALL follow the established patterns and interfaces

### Requirement 3

**User Story:** As a user of the application, I want reliable order status updates, so that I can trust the information displayed in the trading interface.

#### Acceptance Criteria

1. WHEN an order status request fails THEN the system SHALL provide clear error messages indicating the reason for failure
2. WHEN the Shoonya session is expired THEN the system SHALL handle authentication errors gracefully and prompt for re-authentication
3. WHEN network issues occur THEN the system SHALL implement appropriate retry logic with exponential backoff
4. WHEN order status is successfully retrieved THEN the system SHALL update the local database and broadcast real-time updates via WebSocket

### Requirement 4

**User Story:** As a system administrator, I want proper logging and monitoring of order status operations, so that I can troubleshoot issues and monitor system health.

#### Acceptance Criteria

1. WHEN order status requests are made THEN the system SHALL log all API calls with appropriate detail levels
2. WHEN errors occur during order status retrieval THEN the system SHALL log detailed error information for debugging
3. WHEN order status is successfully retrieved THEN the system SHALL log the status change for audit purposes
4. WHEN API rate limits are encountered THEN the system SHALL log warnings and implement appropriate throttling