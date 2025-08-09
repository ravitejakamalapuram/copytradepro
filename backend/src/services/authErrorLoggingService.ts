/**
 * Authentication Error Logging Service
 * Integrates error logging with authentication and authorization operations
 */

import { ErrorLoggingService } from './errorLoggingService';
import { traceIdService } from './traceIdService';
import TraceContext from '../utils/traceContext';
import { logger } from '../utils/logger';

export interface AuthOperationContext {
  userId?: string | undefined;
  email?: string | undefined;
  operation: string;
  sessionInfo?: {
    sessionId?: string;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    tokenExpiry?: Date;
  };
  securityContext?: {
    loginAttempts?: number;
    lastLoginTime?: Date;
    suspiciousActivity?: boolean;
    geoLocation?: string;
  };
  requestDetails?: {
    url?: string;
    method?: string;
    requestId?: string;
    duration?: number;
    headers?: Record<string, string>;
  };
  traceId?: string;
}

export interface AuthErrorClassification {
  category: 'INVALID_CREDENTIALS' | 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'UNAUTHORIZED_ACCESS' | 
           'ACCOUNT_LOCKED' | 'RATE_LIMITED' | 'SUSPICIOUS_ACTIVITY' | 'VALIDATION_ERROR' | 
           'SYSTEM_ERROR' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isSecurityEvent: boolean;
  requiresUserAction: boolean;
  affectsUserAccess: boolean;
  suggestedRecovery: string[];
}

export class AuthErrorLoggingService {
  private static instance: AuthErrorLoggingService;
  private errorLoggingService: ErrorLoggingService;

  private constructor() {
    this.errorLoggingService = ErrorLoggingService.getInstance();
  }

  public static getInstance(): AuthErrorLoggingService {
    if (!AuthErrorLoggingService.instance) {
      AuthErrorLoggingService.instance = new AuthErrorLoggingService();
    }
    return AuthErrorLoggingService.instance;
  }

  /**
   * Log authentication error with comprehensive context
   */
  public async logAuthError(
    message: string,
    error: any,
    context: AuthOperationContext
  ): Promise<string> {
    const classification = this.classifyAuthError(error, context);
    const traceId = context.traceId || TraceContext.getTraceId() || traceIdService.generateTraceId();

    // Enhanced error message with auth context
    const enhancedMessage = `[AUTH] ${context.operation}: ${message}`;

    // Create comprehensive error context
    const errorContext = {
      traceId,
      component: 'AUTH_CONTROLLER',
      operation: context.operation,
      source: 'BE' as const,
      level: this.mapSeverityToLevel(classification.severity),
      errorType: `AUTH_${classification.category}`,
      userId: context.userId,
      sessionId: context.sessionInfo?.sessionId,
      userAgent: context.sessionInfo?.userAgent,
      ipAddress: context.sessionInfo?.ipAddress,
      url: context.requestDetails?.url,
      method: context.requestDetails?.method,
      duration: context.requestDetails?.duration,
      requestId: context.requestDetails?.requestId
    };

    // Log the error with enhanced context
    const errorId = await this.errorLoggingService.logError(
      enhancedMessage,
      error,
      errorContext
    );

    // Log additional auth-specific context
    logger.error(`Authentication operation failed: ${context.operation}`, {
      errorId,
      traceId,
      email: context.email,
      classification: classification.category,
      severity: classification.severity,
      isSecurityEvent: classification.isSecurityEvent,
      requiresUserAction: classification.requiresUserAction,
      affectsUserAccess: classification.affectsUserAccess,
      sessionInfo: context.sessionInfo,
      securityContext: context.securityContext,
      suggestedRecovery: classification.suggestedRecovery
    });

    // Log security events separately for monitoring
    if (classification.isSecurityEvent) {
      await this.logSecurityEvent(message, context, classification, errorId);
    }

    return errorId;
  }

  /**
   * Log successful authentication operation for analytics
   */
  public async logAuthSuccess(
    message: string,
    context: AuthOperationContext
  ): Promise<string> {
    const traceId = context.traceId || TraceContext.getTraceId() || traceIdService.generateTraceId();

    const successMessage = `[AUTH] ${context.operation}: ${message}`;

    return await this.errorLoggingService.logInfo(
      successMessage,
      {
        traceId,
        component: 'AUTH_CONTROLLER',
        operation: context.operation,
        source: 'BE' as const,
        userId: context.userId,
        sessionId: context.sessionInfo?.sessionId
      }
    );
  }

  /**
   * Log authentication warning (e.g., multiple login attempts, token near expiry)
   */
  public async logAuthWarning(
    message: string,
    context: AuthOperationContext
  ): Promise<string> {
    const traceId = context.traceId || TraceContext.getTraceId() || traceIdService.generateTraceId();

    const warningMessage = `[AUTH] ${context.operation}: ${message}`;

    return await this.errorLoggingService.logWarning(
      warningMessage,
      {
        traceId,
        component: 'AUTH_CONTROLLER',
        operation: context.operation,
        source: 'BE' as const,
        userId: context.userId,
        sessionId: context.sessionInfo?.sessionId
      }
    );
  }

  /**
   * Log security events for monitoring and alerting
   */
  private async logSecurityEvent(
    message: string,
    context: AuthOperationContext,
    classification: AuthErrorClassification,
    errorId: string
  ): Promise<void> {
    const securityEvent = {
      timestamp: new Date(),
      eventType: classification.category,
      severity: classification.severity,
      message,
      userId: context.userId,
      email: context.email,
      ipAddress: context.sessionInfo?.ipAddress,
      userAgent: context.sessionInfo?.userAgent,
      operation: context.operation,
      errorId,
      traceId: context.traceId,
      securityContext: context.securityContext
    };

    logger.warn('Security event detected', {
      component: 'AUTH_SECURITY_MONITOR',
      operation: 'SECURITY_EVENT',
      securityEvent
    });

    // Here you could integrate with external security monitoring systems
    // await externalSecurityMonitor.reportEvent(securityEvent);
  }

  /**
   * Classify authentication errors for better handling and recovery
   */
  private classifyAuthError(error: any, context: AuthOperationContext): AuthErrorClassification {
    const errorMessage = error?.message?.toLowerCase() || '';
    const operation = context.operation.toLowerCase();

    // Invalid credentials
    if (errorMessage.includes('invalid') && (errorMessage.includes('password') || errorMessage.includes('email')) ||
        errorMessage.includes('authentication failed') || errorMessage.includes('login failed')) {
      return {
        category: 'INVALID_CREDENTIALS',
        severity: 'MEDIUM',
        isSecurityEvent: true,
        requiresUserAction: true,
        affectsUserAccess: true,
        suggestedRecovery: [
          'Verify email and password',
          'Check for typos',
          'Use password reset if needed',
          'Contact support if persistent'
        ]
      };
    }

    // Token expired
    if (errorMessage.includes('expired') || errorMessage.includes('token') && errorMessage.includes('expired')) {
      return {
        category: 'TOKEN_EXPIRED',
        severity: 'LOW',
        isSecurityEvent: false,
        requiresUserAction: true,
        affectsUserAccess: true,
        suggestedRecovery: [
          'Login again to get new token',
          'Check token expiration settings',
          'Implement token refresh logic'
        ]
      };
    }

    // Invalid token
    if (errorMessage.includes('invalid token') || errorMessage.includes('malformed token') ||
        errorMessage.includes('jwt') && errorMessage.includes('invalid')) {
      return {
        category: 'TOKEN_INVALID',
        severity: 'MEDIUM',
        isSecurityEvent: true,
        requiresUserAction: true,
        affectsUserAccess: true,
        suggestedRecovery: [
          'Login again to get valid token',
          'Check token format',
          'Verify JWT secret configuration'
        ]
      };
    }

    // Unauthorized access
    if (errorMessage.includes('unauthorized') || errorMessage.includes('access denied') ||
        errorMessage.includes('forbidden') || operation.includes('unauthorized')) {
      return {
        category: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        isSecurityEvent: true,
        requiresUserAction: true,
        affectsUserAccess: true,
        suggestedRecovery: [
          'Check user permissions',
          'Verify authentication status',
          'Contact administrator for access',
          'Review authorization policies'
        ]
      };
    }

    // Account locked
    if (errorMessage.includes('locked') || errorMessage.includes('disabled') ||
        errorMessage.includes('suspended')) {
      return {
        category: 'ACCOUNT_LOCKED',
        severity: 'HIGH',
        isSecurityEvent: true,
        requiresUserAction: true,
        affectsUserAccess: true,
        suggestedRecovery: [
          'Contact administrator to unlock account',
          'Wait for automatic unlock period',
          'Verify account status',
          'Check for security violations'
        ]
      };
    }

    // Rate limiting
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many') ||
        errorMessage.includes('throttled')) {
      return {
        category: 'RATE_LIMITED',
        severity: 'MEDIUM',
        isSecurityEvent: true,
        requiresUserAction: false,
        affectsUserAccess: true,
        suggestedRecovery: [
          'Wait before retrying',
          'Implement exponential backoff',
          'Check rate limiting policies',
          'Contact support if legitimate use'
        ]
      };
    }

    // Suspicious activity
    if (context.securityContext?.suspiciousActivity || 
        errorMessage.includes('suspicious') || errorMessage.includes('anomaly')) {
      return {
        category: 'SUSPICIOUS_ACTIVITY',
        severity: 'HIGH',
        isSecurityEvent: true,
        requiresUserAction: true,
        affectsUserAccess: true,
        suggestedRecovery: [
          'Verify legitimate access attempt',
          'Check for compromised credentials',
          'Review recent account activity',
          'Contact security team'
        ]
      };
    }

    // Validation errors
    if (errorMessage.includes('validation') || errorMessage.includes('required') ||
        errorMessage.includes('invalid format')) {
      return {
        category: 'VALIDATION_ERROR',
        severity: 'LOW',
        isSecurityEvent: false,
        requiresUserAction: true,
        affectsUserAccess: false,
        suggestedRecovery: [
          'Check input format',
          'Verify required fields',
          'Review validation rules',
          'Update client-side validation'
        ]
      };
    }

    // System errors
    if (errorMessage.includes('database') || errorMessage.includes('connection') ||
        errorMessage.includes('server error') || errorMessage.includes('internal')) {
      return {
        category: 'SYSTEM_ERROR',
        severity: 'HIGH',
        isSecurityEvent: false,
        requiresUserAction: false,
        affectsUserAccess: true,
        suggestedRecovery: [
          'Check system status',
          'Retry operation',
          'Contact technical support',
          'Monitor system health'
        ]
      };
    }

    // Default classification for unknown errors
    return {
      category: 'UNKNOWN',
      severity: 'MEDIUM',
      isSecurityEvent: false,
      requiresUserAction: false,
      affectsUserAccess: true,
      suggestedRecovery: [
        'Review error details',
        'Check system logs',
        'Contact support if persistent',
        'Monitor for patterns'
      ]
    };
  }

  /**
   * Map error severity to log level
   */
  private mapSeverityToLevel(severity: string): 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'ERROR';
      case 'MEDIUM':
        return 'WARN';
      case 'LOW':
        return 'INFO';
      default:
        return 'ERROR';
    }
  }

  /**
   * Create authentication operation context
   */
  public createAuthContext(
    operation: string,
    additionalContext?: Partial<AuthOperationContext>
  ): AuthOperationContext {
    return {
      operation,
      traceId: TraceContext.getTraceId() || traceIdService.generateTraceId(),
      ...additionalContext
    };
  }

  /**
   * Get authentication error analytics
   */
  public async getAuthErrorAnalytics(
    timeWindow: number = 86400000
  ): Promise<{
    totalErrors: number;
    errorsByCategory: Record<string, number>;
    securityEvents: number;
    failedLogins: number;
    tokenErrors: number;
    unauthorizedAccess: number;
    suspiciousActivity: number;
  }> {
    try {
      const analytics = await this.errorLoggingService.getErrorAnalytics(timeWindow);
      
      // Filter auth-specific errors
      const authErrors = Object.entries(analytics.errorsByComponent)
        .filter(([component]) => component.includes('AUTH'))
        .reduce((sum, [, count]) => sum + count, 0);

      return {
        totalErrors: authErrors,
        errorsByCategory: analytics.errorsByCategory,
        securityEvents: 0, // Would need to be calculated from error details
        failedLogins: 0, // Would need to be calculated from error details
        tokenErrors: 0, // Would need to be calculated from error details
        unauthorizedAccess: 0, // Would need to be calculated from error details
        suspiciousActivity: 0 // Would need to be calculated from error details
      };
    } catch (error) {
      logger.error('Failed to get auth error analytics', {
        component: 'AUTH_ERROR_LOGGING_SERVICE',
        operation: 'GET_AUTH_ERROR_ANALYTICS'
      }, error);

      return {
        totalErrors: 0,
        errorsByCategory: {},
        securityEvents: 0,
        failedLogins: 0,
        tokenErrors: 0,
        unauthorizedAccess: 0,
        suspiciousActivity: 0
      };
    }
  }
}

// Export singleton instance
export const authErrorLoggingService = AuthErrorLoggingService.getInstance();