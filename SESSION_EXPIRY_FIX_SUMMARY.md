# Session Expiry Handling Fix

## Problem
The application was logging out users for any 401/403 HTTP error, even when the error was not related to session expiry (e.g., broker connection failures, API rate limits, etc.). This created a poor user experience where users would be unexpectedly logged out.

## Solution
Implemented precise session expiry detection that only logs out users when the session has actually expired, not for other types of authentication errors.

## Changes Made

### 1. Created Session Utility Functions (`frontend/src/utils/sessionUtils.ts`)
- `isSessionExpiredError()`: Detects if an error indicates session expiry
- `isAuthFailureStatus()`: Checks for auth-related HTTP status codes
- `shouldLogoutOnError()`: Determines if user should be logged out
- `handleSessionExpiry()`: Handles the logout process

### 2. Updated API Service (`frontend/src/services/api.ts`)
- Replaced URL-based logout logic with message-based detection
- Now checks error messages for specific session expiry indicators
- Uses centralized utility functions for consistency

### 3. Updated Auth Context (`frontend/src/context/AuthContext.tsx`)
- Improved token verification to detect session expiry accurately
- Uses the same utility functions for consistent behavior

### 4. Added Comprehensive Tests
- Unit tests for all session utility functions
- Updated existing API error handling tests
- Covers various error message formats and scenarios

## Session Expiry Detection Logic

The system now detects session expiry by checking for these specific error messages:
- "Token expired"
- "Invalid token"
- "Invalid or expired token"
- "session expired"
- "token expired"
- "jwt expired"
- "authentication failed"
- "TokenExpiredError"
- "JsonWebTokenError"

## Behavior Changes

### Before
```javascript
// Any 401/403 error on auth or profile endpoints = logout
if (status === 401 && url.includes('/auth/')) {
  logout(); // Too broad
}
```

### After
```javascript
// Only logout if error message indicates session expiry
if (isSessionExpiredError(error) && isAuthFailureStatus(status)) {
  logout(); // Precise detection
}
```

## Examples

### ✅ Will Log Out (Session Expired)
```javascript
// JWT token expired
{ status: 401, message: "Token expired" }

// Invalid JWT token
{ status: 401, message: "Invalid token" }
```

### ✅ Will Stay Logged In (Not Session Expiry)
```javascript
// Broker connection failed
{ status: 401, message: "Broker connection failed" }

// API rate limit
{ status: 429, message: "Too many requests" }

// Server error
{ status: 500, message: "Internal server error" }
```

### ✅ Development Mode
```javascript
// Never logs out in development, regardless of error
const isDevelopment = import.meta.env.DEV;
if (isDevelopment) {
  // Keep user logged in for better developer experience
}
```

## Benefits

1. **Better User Experience**: Users don't get unexpectedly logged out for non-session errors
2. **Precise Error Handling**: Only logs out when session is actually expired
3. **Development Friendly**: Never logs out during development
4. **Maintainable**: Centralized logic that's easy to test and modify
5. **Comprehensive**: Handles various error message formats and sources

## Testing

All changes are covered by comprehensive tests:
- `frontend/src/utils/__tests__/sessionUtils.test.ts` - 10 test cases
- Updated `frontend/src/tests/apiErrorHandling.test.ts` - 14 test cases

Run tests with:
```bash
cd frontend
npm test sessionUtils
npm test apiErrorHandling
```

## Files Modified

1. `frontend/src/services/api.ts` - Updated error handling logic
2. `frontend/src/context/AuthContext.tsx` - Improved token verification
3. `frontend/src/utils/sessionUtils.ts` - New utility functions
4. `frontend/src/utils/__tests__/sessionUtils.test.ts` - New tests
5. `frontend/src/tests/apiErrorHandling.test.ts` - Updated tests
6. `frontend/src/examples/sessionExpiryExample.ts` - Usage examples

## Backward Compatibility

This change is fully backward compatible. The new logic is more restrictive (only logs out for actual session expiry) so existing functionality is preserved while fixing the over-aggressive logout behavior.