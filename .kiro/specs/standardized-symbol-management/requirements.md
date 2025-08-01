# Requirements Document

## Introduction

This specification defines a standardized symbol management system for CopyTrade Pro that decouples symbol data from broker-specific APIs and provides a unified format for all instruments (equity, options, futures). The system will pre-process symbol data from external sources (like Upstox) and maintain a standardized internal format that can be easily converted to any broker's required format.

## Requirements

### Requirement 1: Standardized Symbol Data Structure

**User Story:** As a developer, I want a unified symbol data structure that contains both human-readable and standardized formats, so that the frontend can display user-friendly names while the backend uses consistent identifiers for broker operations.

#### Acceptance Criteria

1. WHEN the system stores symbol data THEN it SHALL include both human-readable display name and standardized trading symbol
2. WHEN storing options data THEN the system SHALL include underlying symbol, strike price, expiry date, and option type as separate fields
3. WHEN storing futures data THEN the system SHALL include underlying symbol and expiry date as separate fields
4. WHEN storing equity data THEN the system SHALL include company name and trading symbol
5. IF the symbol is an option THEN the system SHALL store strike price as a numeric value
6. IF the symbol is an option or future THEN the system SHALL store expiry date in ISO format (YYYY-MM-DD)

### Requirement 2: Daily Symbol Data Processing

**User Story:** As a system administrator, I want the symbol database to be automatically updated daily from external sources, so that users always have access to current and accurate instrument data without manual intervention.

#### Acceptance Criteria

1. WHEN the daily update process runs THEN it SHALL download the latest symbol data from configured sources
2. WHEN processing Upstox symbol data THEN the system SHALL convert it to the standardized internal format
3. WHEN new symbols are found THEN the system SHALL add them to the database with proper categorization
4. WHEN existing symbols are updated THEN the system SHALL preserve historical data while updating current information
5. IF the download fails THEN the system SHALL log the error and retry with exponential backoff
6. IF the processing fails THEN the system SHALL send alerts to administrators
7. WHEN the update completes THEN the system SHALL log statistics about added, updated, and removed symbols

### Requirement 3: Broker-Agnostic Symbol Search API

**User Story:** As a frontend developer, I want a unified search API that returns standardized symbol data, so that I can build consistent user interfaces without worrying about broker-specific symbol formats.

#### Acceptance Criteria

1. WHEN a user searches for symbols THEN the API SHALL return results with both display names and standardized identifiers
2. WHEN searching for options THEN the API SHALL support filtering by underlying, expiry date, strike range, and option type
3. WHEN searching for futures THEN the API SHALL support filtering by underlying and expiry date
4. WHEN searching for equity THEN the API SHALL support filtering by exchange and sector
5. IF no results are found THEN the API SHALL return an empty array with appropriate status
6. WHEN returning results THEN the API SHALL include instrument type, exchange, and all relevant metadata
7. WHEN the search query is too broad THEN the API SHALL limit results to prevent performance issues

### Requirement 4: Broker-Specific Symbol Formatting

**User Story:** As a trading system, I want to convert standardized symbols to broker-specific formats automatically, so that orders can be placed successfully on any supported broker without manual symbol translation.

#### Acceptance Criteria

1. WHEN placing an order THEN the system SHALL automatically convert the standardized symbol to the target broker's required format
2. WHEN converting for Fyers THEN the system SHALL add exchange prefix and format according to Fyers specifications
3. WHEN converting for Shoonya THEN the system SHALL format without exchange prefix and map to correct exchange codes
4. WHEN converting for any broker THEN the system SHALL handle equity, options, and futures appropriately
5. IF the conversion fails THEN the system SHALL log the error and return a user-friendly error message
6. WHEN a new broker is added THEN the system SHALL support adding new formatting rules without changing existing code

### Requirement 5: Symbol Data Validation and Quality Control

**User Story:** As a system operator, I want the symbol data to be validated for accuracy and completeness, so that users don't encounter errors when placing orders due to invalid or incomplete symbol information.

#### Acceptance Criteria

1. WHEN processing symbol data THEN the system SHALL validate all required fields are present
2. WHEN validating options THEN the system SHALL ensure strike prices are positive numbers and expiry dates are in the future
3. WHEN validating futures THEN the system SHALL ensure expiry dates are valid and in the future
4. WHEN validating equity symbols THEN the system SHALL ensure trading symbols follow exchange naming conventions
5. IF validation fails THEN the system SHALL log the specific validation errors and skip the invalid record
6. WHEN validation completes THEN the system SHALL report statistics on valid vs invalid records processed

### Requirement 6: Historical Symbol Data Management

**User Story:** As a compliance officer, I want to maintain historical records of symbol changes and delistings, so that we can track the complete lifecycle of instruments for regulatory and audit purposes.

#### Acceptance Criteria

1. WHEN a symbol is delisted THEN the system SHALL mark it as inactive rather than deleting it
2. WHEN symbol details change THEN the system SHALL maintain a history of changes with timestamps
3. WHEN querying symbols THEN the system SHALL by default return only active symbols
4. WHEN specifically requested THEN the system SHALL provide access to historical and inactive symbols
5. IF a symbol is reactivated THEN the system SHALL update its status while preserving historical data
6. WHEN generating reports THEN the system SHALL support filtering by date ranges and status

### Requirement 7: Performance and Caching

**User Story:** As an end user, I want symbol searches and order placement to be fast and responsive, so that I can execute trades quickly without delays caused by symbol lookup operations.

#### Acceptance Criteria

1. WHEN users search for symbols THEN the response time SHALL be under 200ms for typical queries
2. WHEN the system starts THEN it SHALL preload frequently used symbols into memory cache
3. WHEN symbol data is updated THEN the cache SHALL be refreshed without service interruption
4. WHEN placing orders THEN symbol format conversion SHALL complete in under 50ms
5. IF cache becomes unavailable THEN the system SHALL fall back to database queries gracefully
6. WHEN memory usage exceeds thresholds THEN the system SHALL implement LRU eviction for cached symbols

### Requirement 8: Legacy System Cleanup and Fresh Data Initialization

**User Story:** As a system administrator, I want to completely remove legacy symbol processing systems and start fresh with standardized data on each server startup, so that we eliminate technical debt and ensure data consistency without migration overhead.

#### Acceptance Criteria

1. WHEN removing legacy systems THEN the system SHALL delete all existing symbol data and processing code
2. WHEN server starts THEN the system SHALL automatically download and process fresh Upstox data
3. WHEN cleaning up legacy code THEN the system SHALL remove NSE CSV processing and related infrastructure
4. WHEN startup data load completes THEN the system SHALL validate all symbol data is properly formatted
5. IF startup data load fails THEN the system SHALL provide clear error messages and prevent server startup
6. WHEN legacy systems are removed THEN there SHALL be no duplicate or conflicting symbol data sources