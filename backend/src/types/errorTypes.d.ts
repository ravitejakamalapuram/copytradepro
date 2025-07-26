export type ErrorType = 'network' | 'authentication' | 'validation' | 'broker' | 'system';
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export interface ErrorClassification {
    type: ErrorType;
    severity: ErrorSeverity;
    retryable: boolean;
    userMessage: string;
    technicalDetails: string;
    suggestedActions: string[];
    retryDelay?: number;
    maxRetries?: number;
}
export interface ErrorContext {
    userId?: string;
    brokerName?: string;
    accountId?: string;
    operation?: string;
    timestamp: Date;
    requestId?: string;
    userAgent?: string;
    ipAddress?: string;
}
export interface EnhancedError {
    id: string;
    timestamp: Date;
    type: ErrorType;
    severity: ErrorSeverity;
    context: ErrorContext;
    originalError: any;
    userMessage: string;
    technicalMessage: string;
    stackTrace?: string;
    retryCount: number;
    resolved: boolean;
    classification: ErrorClassification;
}
export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
    retryableErrorTypes: ErrorType[];
}
//# sourceMappingURL=errorTypes.d.ts.map