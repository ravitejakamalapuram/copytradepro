"use strict";
/**
 * Comprehensive Error Handler for Shoonya Order Status Operations
 * Implements proper error categorization, user-friendly messages, retry logic, and rate limiting
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.comprehensiveErrorHandler = exports.ComprehensiveErrorHandler = void 0;
const logger_1 = require("../utils/logger");
class ComprehensiveErrorHandler {
    constructor() {
        this.errorHistory = new Map();
        this.rateLimitTracking = new Map();
        // Rate limiting configuration per broker and operation
        this.rateLimits = {
            shoonya: {
                getOrderStatus: { maxRequests: 60, windowMs: 60000 }, // 60 requests per minute
                placeOrder: { maxRequests: 30, windowMs: 60000 }, // 30 requests per minute
                cancelOrder: { maxRequests: 20, windowMs: 60000 }, // 20 requests per minute
                modifyOrder: { maxRequests: 20, windowMs: 60000 } // 20 requests per minute
            },
            fyers: {
                getOrderStatus: { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
                placeOrder: { maxRequests: 50, windowMs: 60000 }, // 50 requests per minute
                cancelOrder: { maxRequests: 30, windowMs: 60000 }, // 30 requests per minute
                modifyOrder: { maxRequests: 30, windowMs: 60000 } // 30 requests per minute
            }
        };
        // Retry configuration
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000, // 1 second
            maxDelay: 30000, // 30 seconds
            backoffMultiplier: 2,
            retryableErrorTypes: ['network', 'system', 'broker']
        };
    }
    /**
     * Categorize errors for different failure scenarios
     */
    categorizeError(error, context) {
        const errorMessage = error?.message?.toLowerCase() || '';
        const errorCode = error?.code || error?.status || '';
        // Session and authentication errors
        if (this.isSessionError(errorMessage, errorCode)) {
            return {
                type: 'authentication',
                severity: 'high',
                retryable: false,
                userMessage: 'Your session has expired. Please reconnect your account.',
                technicalDetails: `Authentication error: ${error?.message || 'Session expired'}`,
                suggestedActions: [
                    'Click the "Reconnect Account" button',
                    'Re-enter your broker credentials',
                    'Ensure your broker account is active'
                ]
            };
        }
        // Network and connection errors
        if (this.isNetworkError(errorMessage, errorCode)) {
            return {
                type: 'network',
                severity: 'medium',
                retryable: true,
                userMessage: 'Network connection issue. Please check your internet connection and try again.',
                technicalDetails: `Network error: ${error?.message || 'Connection failed'}`,
                suggestedActions: [
                    'Check your internet connection',
                    'Try again in a few moments',
                    'Contact support if the issue persists'
                ],
                retryDelay: 2000,
                maxRetries: 3
            };
        }
        // Rate limiting errors
        if (this.isRateLimitError(errorMessage, errorCode)) {
            return {
                type: 'broker',
                severity: 'medium',
                retryable: true,
                userMessage: 'Too many requests. Please wait a moment and try again.',
                technicalDetails: `Rate limit exceeded: ${error?.message || 'Too many requests'}`,
                suggestedActions: [
                    'Wait for 30 seconds before trying again',
                    'Reduce the frequency of your requests',
                    'Consider using bulk operations where available'
                ],
                retryDelay: 30000,
                maxRetries: 2
            };
        }
        // Order not found errors
        if (this.isOrderNotFoundError(errorMessage, errorCode)) {
            return {
                type: 'validation',
                severity: 'low',
                retryable: false,
                userMessage: 'Order not found. Please verify the order number and try again.',
                technicalDetails: `Order not found: ${error?.message || 'Invalid order ID'}`,
                suggestedActions: [
                    'Check the order number is correct',
                    'Refresh your order list',
                    'The order may have been cancelled or executed'
                ]
            };
        }
        // Server and broker errors
        if (this.isServerError(errorMessage, errorCode)) {
            return {
                type: 'broker',
                severity: 'high',
                retryable: true,
                userMessage: 'Broker server is experiencing issues. Please try again later.',
                technicalDetails: `Server error: ${error?.message || 'Internal server error'}`,
                suggestedActions: [
                    'Try again in a few minutes',
                    'Check broker status page',
                    'Contact broker support if issue persists'
                ],
                retryDelay: 5000,
                maxRetries: 2
            };
        }
        // Validation and parameter errors
        if (this.isValidationError(errorMessage, errorCode)) {
            return {
                type: 'validation',
                severity: 'medium',
                retryable: false,
                userMessage: 'Invalid request parameters. Please check the order details and try again.',
                technicalDetails: `Validation error: ${error?.message || 'Invalid parameters'}`,
                suggestedActions: [
                    'Check all required fields are filled',
                    'Verify order parameters are correct',
                    'Ensure account has sufficient permissions'
                ]
            };
        }
        // Default classification for unknown errors
        return {
            type: 'system',
            severity: 'medium',
            retryable: false,
            userMessage: 'An unexpected error occurred. Please try again or contact support.',
            technicalDetails: `Unknown error: ${error?.message || 'Unclassified error'}`,
            suggestedActions: [
                'Try the operation again',
                'Refresh the page',
                'Contact support with error details'
            ]
        };
    }
    /**
     * Check if error is session/authentication related
     */
    isSessionError(message, code) {
        const sessionKeywords = [
            'session expired', 'invalid session', 'authentication failed',
            'token expired', 'token invalid', 'unauthorized', 'login required',
            'invalid credentials', 'access denied', 'forbidden'
        ];
        const sessionCodes = [401, 403, 'UNAUTHORIZED', 'FORBIDDEN', 'TOKEN_EXPIRED'];
        return sessionKeywords.some(keyword => message.includes(keyword)) ||
            sessionCodes.includes(code);
    }
    /**
     * Check if error is network/connection related
     */
    isNetworkError(message, code) {
        const networkKeywords = [
            'network', 'timeout', 'connection', 'socket', 'econnreset',
            'enotfound', 'etimedout', 'econnrefused', 'dns', 'unreachable'
        ];
        const networkCodes = ['ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];
        return networkKeywords.some(keyword => message.includes(keyword)) ||
            networkCodes.includes(code);
    }
    /**
     * Check if error is rate limiting related
     */
    isRateLimitError(message, code) {
        const rateLimitKeywords = [
            'rate limit', 'too many requests', 'quota exceeded',
            'throttled', 'limit exceeded', 'request limit'
        ];
        const rateLimitCodes = [429, 'TOO_MANY_REQUESTS', 'RATE_LIMITED'];
        return rateLimitKeywords.some(keyword => message.includes(keyword)) ||
            rateLimitCodes.includes(code);
    }
    /**
     * Check if error is order not found related
     */
    isOrderNotFoundError(message, code) {
        const orderNotFoundKeywords = [
            'order not found', 'invalid order', 'order does not exist',
            'norenordno', 'order id not found', 'invalid order id'
        ];
        const orderNotFoundCodes = [404, 'NOT_FOUND', 'ORDER_NOT_FOUND'];
        return orderNotFoundKeywords.some(keyword => message.includes(keyword)) ||
            orderNotFoundCodes.includes(code);
    }
    /**
     * Check if error is server/broker related
     */
    isServerError(message, code) {
        const serverKeywords = [
            'server error', 'internal error', 'service unavailable',
            'server unavailable', 'maintenance', 'temporarily unavailable'
        ];
        const serverCodes = [500, 502, 503, 504, 'INTERNAL_ERROR', 'SERVICE_UNAVAILABLE'];
        return serverKeywords.some(keyword => message.includes(keyword)) ||
            serverCodes.includes(code);
    }
    /**
     * Check if error is validation related
     */
    isValidationError(message, code) {
        const validationKeywords = [
            'validation', 'invalid parameter', 'missing parameter',
            'bad request', 'invalid input', 'parameter error'
        ];
        const validationCodes = [400, 'BAD_REQUEST', 'VALIDATION_ERROR'];
        return validationKeywords.some(keyword => message.includes(keyword)) ||
            validationCodes.includes(code);
    }
    /**
     * Check rate limiting for user and operation
     */
    checkRateLimit(userId, brokerName, operation) {
        const key = `${userId}:${brokerName}:${operation}`;
        const now = new Date();
        // Get rate limit configuration for this broker and operation
        const brokerLimits = this.rateLimits[brokerName];
        if (!brokerLimits) {
            // No rate limiting configured for this broker
            return { allowed: true };
        }
        const operationLimit = brokerLimits[operation];
        if (!operationLimit) {
            // No rate limiting configured for this operation
            return { allowed: true };
        }
        let rateLimitInfo = this.rateLimitTracking.get(key);
        // Initialize or reset rate limit window if needed
        if (!rateLimitInfo || (now.getTime() - rateLimitInfo.windowStart.getTime()) >= rateLimitInfo.windowDuration) {
            rateLimitInfo = {
                userId,
                brokerName,
                operation,
                requestCount: 0,
                windowStart: now,
                windowDuration: operationLimit.windowMs,
                maxRequests: operationLimit.maxRequests,
                isBlocked: false
            };
        }
        // Check if rate limit is exceeded
        if (rateLimitInfo.requestCount >= rateLimitInfo.maxRequests) {
            const windowEnd = new Date(rateLimitInfo.windowStart.getTime() + rateLimitInfo.windowDuration);
            const waitTime = Math.max(0, windowEnd.getTime() - now.getTime());
            rateLimitInfo.isBlocked = true;
            rateLimitInfo.resetTime = windowEnd;
            this.rateLimitTracking.set(key, rateLimitInfo);
            logger_1.logger.warn(`Rate limit exceeded for ${key}. Wait time: ${waitTime}ms`);
            return {
                allowed: false,
                rateLimitInfo,
                waitTime
            };
        }
        // Increment request count and allow request
        rateLimitInfo.requestCount++;
        rateLimitInfo.isBlocked = false;
        this.rateLimitTracking.set(key, rateLimitInfo);
        return { allowed: true, rateLimitInfo };
    }
    /**
     * Implement retry logic with exponential backoff
     */
    async executeWithRetry(operation, context, customRetryConfig) {
        const config = { ...this.retryConfig, ...customRetryConfig };
        let lastError;
        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                // Check rate limiting before each attempt
                if (context.brokerName && context.operation) {
                    const rateLimitCheck = this.checkRateLimit(context.userId || 'unknown', context.brokerName, context.operation);
                    if (!rateLimitCheck.allowed) {
                        const waitTime = rateLimitCheck.waitTime || 0;
                        logger_1.logger.warn(`Rate limited, waiting ${waitTime}ms before retry`);
                        if (waitTime > 0) {
                            await this.delay(waitTime);
                        }
                    }
                }
                // Execute the operation
                const result = await operation();
                // Log successful retry if this wasn't the first attempt
                if (attempt > 0) {
                    logger_1.logger.info(`Operation succeeded on attempt ${attempt + 1}/${config.maxRetries + 1}`);
                }
                return result;
            }
            catch (error) {
                lastError = error;
                // Categorize the error
                const classification = this.categorizeError(error, context);
                // Log the error with context
                logger_1.logger.error(`Operation failed on attempt ${attempt + 1}/${config.maxRetries + 1}:`, {
                    error: error.message,
                    type: classification.type,
                    retryable: classification.retryable,
                    context
                });
                // Check if error is retryable and we have attempts left
                if (!classification.retryable || attempt >= config.maxRetries) {
                    // Create enhanced error for non-retryable errors or max retries exceeded
                    const enhancedError = this.createEnhancedError(error, context, classification, attempt);
                    this.logError(enhancedError);
                    throw error;
                }
                // Calculate delay for next retry with exponential backoff
                const delay = Math.min(classification.retryDelay || config.baseDelay * Math.pow(config.backoffMultiplier, attempt), config.maxDelay);
                logger_1.logger.info(`Retrying in ${delay}ms (attempt ${attempt + 1}/${config.maxRetries + 1})`);
                await this.delay(delay);
            }
        }
        // This should never be reached, but just in case
        throw lastError;
    }
    /**
     * Create enhanced error object with full context
     */
    createEnhancedError(originalError, context, classification, retryCount) {
        return {
            id: this.generateErrorId(),
            timestamp: new Date(),
            type: classification.type,
            severity: classification.severity,
            context,
            originalError,
            userMessage: classification.userMessage,
            technicalMessage: classification.technicalDetails,
            stackTrace: originalError?.stack,
            retryCount,
            resolved: false,
            classification
        };
    }
    /**
     * Log error with proper categorization and context
     */
    logError(error) {
        const logData = {
            errorId: error.id,
            type: error.type,
            severity: error.severity,
            operation: error.context.operation,
            brokerName: error.context.brokerName,
            userId: error.context.userId,
            accountId: error.context.accountId,
            retryCount: error.retryCount,
            userMessage: error.userMessage,
            technicalMessage: error.technicalMessage
        };
        // Log based on severity
        switch (error.severity) {
            case 'critical':
                logger_1.logger.error('CRITICAL ERROR:', logData);
                break;
            case 'high':
                logger_1.logger.error('HIGH SEVERITY ERROR:', logData);
                break;
            case 'medium':
                logger_1.logger.warn('MEDIUM SEVERITY ERROR:', logData);
                break;
            case 'low':
                logger_1.logger.info('LOW SEVERITY ERROR:', logData);
                break;
        }
        // Store error for analysis
        this.errorHistory.set(error.id, {
            id: error.id,
            timestamp: error.timestamp,
            operation: error.context.operation,
            brokerName: error.context.brokerName || 'unknown',
            accountId: error.context.accountId || 'unknown',
            orderId: error.context.orderId || 'unknown',
            userId: error.context.userId || 'unknown',
            originalError: error.originalError,
            classification: error.classification,
            retryCount: error.retryCount,
            resolved: error.resolved
        });
    }
    /**
     * Get user-friendly error message
     */
    getUserFriendlyMessage(error, context) {
        const classification = this.categorizeError(error, context);
        return classification.userMessage;
    }
    /**
     * Get suggested actions for error resolution
     */
    getSuggestedActions(error, context) {
        const classification = this.categorizeError(error, context);
        return classification.suggestedActions;
    }
    /**
     * Check if error is retryable
     */
    isRetryable(error, context) {
        const classification = this.categorizeError(error, context);
        return classification.retryable;
    }
    /**
     * Get retry delay for error
     */
    getRetryDelay(error, context, attempt) {
        const classification = this.categorizeError(error, context);
        if (classification.retryDelay) {
            return classification.retryDelay;
        }
        // Use exponential backoff
        return Math.min(this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt), this.retryConfig.maxDelay);
    }
    /**
     * Get error statistics for monitoring
     */
    getErrorStatistics(timeWindow) {
        const now = Date.now();
        const windowStart = timeWindow ? now - timeWindow : 0;
        const relevantErrors = Array.from(this.errorHistory.values())
            .filter(error => error.timestamp.getTime() >= windowStart);
        const stats = {
            totalErrors: relevantErrors.length,
            errorsByType: {},
            errorsBySeverity: {},
            errorsByBroker: {},
            retryableErrors: 0,
            resolvedErrors: 0
        };
        relevantErrors.forEach(error => {
            // Count by type
            stats.errorsByType[error.classification.type] =
                (stats.errorsByType[error.classification.type] || 0) + 1;
            // Count by severity
            stats.errorsBySeverity[error.classification.severity] =
                (stats.errorsBySeverity[error.classification.severity] || 0) + 1;
            // Count by broker
            stats.errorsByBroker[error.brokerName] =
                (stats.errorsByBroker[error.brokerName] || 0) + 1;
            // Count retryable and resolved
            if (error.classification.retryable)
                stats.retryableErrors++;
            if (error.resolved)
                stats.resolvedErrors++;
        });
        return stats;
    }
    /**
     * Clear old error history to prevent memory leaks
     */
    cleanupErrorHistory(maxAge = 24 * 60 * 60 * 1000) {
        const cutoff = Date.now() - maxAge;
        for (const [id, error] of this.errorHistory.entries()) {
            if (error.timestamp.getTime() < cutoff) {
                this.errorHistory.delete(id);
            }
        }
        logger_1.logger.info(`Cleaned up error history, ${this.errorHistory.size} errors remaining`);
    }
    /**
     * Clear old rate limit tracking to prevent memory leaks
     */
    cleanupRateLimitTracking() {
        const now = Date.now();
        for (const [key, info] of this.rateLimitTracking.entries()) {
            const windowEnd = info.windowStart.getTime() + info.windowDuration;
            if (now > windowEnd + 60000) { // Keep for 1 minute after window ends
                this.rateLimitTracking.delete(key);
            }
        }
        logger_1.logger.debug(`Rate limit tracking cleanup completed, ${this.rateLimitTracking.size} entries remaining`);
    }
    /**
     * Utility methods
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
}
exports.ComprehensiveErrorHandler = ComprehensiveErrorHandler;
// Export singleton instance
exports.comprehensiveErrorHandler = new ComprehensiveErrorHandler();
// Cleanup intervals
setInterval(() => {
    exports.comprehensiveErrorHandler.cleanupErrorHistory();
    exports.comprehensiveErrorHandler.cleanupRateLimitTracking();
}, 60 * 60 * 1000); // Run cleanup every hour
//# sourceMappingURL=comprehensiveErrorHandler.js.map