/**
 * Comprehensive Error Handler for Shoonya Order Status Operations
 * Implements proper error categorization, user-friendly messages, retry logic, and rate limiting
 */
import { ErrorType, ErrorSeverity, ErrorClassification, ErrorContext, RetryConfig } from '../types/errorTypes';
export interface OrderStatusError {
    id: string;
    timestamp: Date;
    operation: 'getOrderStatus' | 'placeOrder' | 'cancelOrder' | 'modifyOrder';
    brokerName: string;
    accountId?: string;
    orderId?: string;
    userId?: string;
    originalError: any;
    classification: ErrorClassification;
    retryCount: number;
    resolved: boolean;
}
export interface RateLimitInfo {
    userId: string;
    brokerName: string;
    operation: string;
    requestCount: number;
    windowStart: Date;
    windowDuration: number;
    maxRequests: number;
    isBlocked: boolean;
    resetTime?: Date;
}
export declare class ComprehensiveErrorHandler {
    private errorHistory;
    private rateLimitTracking;
    private rateLimits;
    private retryConfig;
    /**
     * Categorize errors for different failure scenarios
     */
    categorizeError(error: any, context: ErrorContext): ErrorClassification;
    /**
     * Check if error is session/authentication related
     */
    private isSessionError;
    /**
     * Check if error is network/connection related
     */
    private isNetworkError;
    /**
     * Check if error is rate limiting related
     */
    private isRateLimitError;
    /**
     * Check if error is order not found related
     */
    private isOrderNotFoundError;
    /**
     * Check if error is server/broker related
     */
    private isServerError;
    /**
     * Check if error is validation related
     */
    private isValidationError;
    /**
     * Check rate limiting for user and operation
     */
    checkRateLimit(userId: string, brokerName: string, operation: string): {
        allowed: boolean;
        rateLimitInfo?: RateLimitInfo;
        waitTime?: number;
    };
    /**
     * Implement retry logic with exponential backoff
     */
    executeWithRetry<T>(operation: () => Promise<T>, context: ErrorContext, customRetryConfig?: Partial<RetryConfig>): Promise<T>;
    /**
     * Create enhanced error object with full context
     */
    private createEnhancedError;
    /**
     * Log error with proper categorization and context
     */
    private logError;
    /**
     * Get user-friendly error message
     */
    getUserFriendlyMessage(error: any, context: ErrorContext): string;
    /**
     * Get suggested actions for error resolution
     */
    getSuggestedActions(error: any, context: ErrorContext): string[];
    /**
     * Check if error is retryable
     */
    isRetryable(error: any, context: ErrorContext): boolean;
    /**
     * Get retry delay for error
     */
    getRetryDelay(error: any, context: ErrorContext, attempt: number): number;
    /**
     * Get error statistics for monitoring
     */
    getErrorStatistics(timeWindow?: number): {
        totalErrors: number;
        errorsByType: Record<ErrorType, number>;
        errorsBySeverity: Record<ErrorSeverity, number>;
        errorsByBroker: Record<string, number>;
        retryableErrors: number;
        resolvedErrors: number;
    };
    /**
     * Clear old error history to prevent memory leaks
     */
    cleanupErrorHistory(maxAge?: number): void;
    /**
     * Clear old rate limit tracking to prevent memory leaks
     */
    cleanupRateLimitTracking(): void;
    /**
     * Utility methods
     */
    private delay;
    private generateErrorId;
}
export declare const comprehensiveErrorHandler: ComprehensiveErrorHandler;
//# sourceMappingURL=comprehensiveErrorHandler.d.ts.map