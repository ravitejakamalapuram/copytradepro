/**
 * @copytrade/shared-types
 * 
 * Shared TypeScript types for CopyTrade application
 * Used across frontend, backend, and broker packages
 */

// Export all API response types
export * from './api-responses';

// Export constants and database interfaces
export * from './constants';
export * from './database-interfaces';

// Re-export commonly used types for convenience
export type {
  ApiError,
  BaseApiResponse,
  ActivateAccountResponse,
  DeactivateAccountResponse,
  ConnectedAccountsResponse,
  OAuthCompletionResponse,
  SuccessResponse,
  OrderResponse,
  PortfolioResponse,
  MarketDataResponse
} from './api-responses';

// Re-export constants as values
export {
  AuthenticationStep,
  ApiErrorCode
} from './api-responses';

// Export helper functions
export {
  createSuccessResponse,
  createErrorResponse,
  createActivationResponse
} from './api-responses';
