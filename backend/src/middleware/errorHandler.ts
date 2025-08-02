import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { productionMonitoringService } from '../services/productionMonitoringService';
import { errorLoggingService } from '../services/errorLoggingService';
import { traceIdService } from '../services/traceIdService';
import { TraceContext } from '../utils/traceContext';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

interface ErrorContext {
  requestInfo: {
    method: string;
    url: string;
    originalUrl: string;
    path: string;
    query: any;
    params: any;
    headers: Record<string, string>;
    body?: any;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
    referer?: string | undefined;
  };
  userInfo: {
    userId?: string;
    sessionId?: string;
    isAuthenticated: boolean;
    userRole?: string;
  };
  systemInfo: {
    timestamp: Date;
    traceId: string;
    requestId: string;
    duration: number;
    memoryUsage: NodeJS.MemoryUsage;
    nodeVersion: string;
    environment: string;
  };
  brokerInfo?: {
    brokerName?: string | undefined;
    accountId?: string | undefined;
    operation?: string | undefined;
  };
}

interface ErrorClassification {
  errorType: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  isRetryable: boolean;
  statusCode?: number;
  userMessage?: string;
  technicalMessage: string;
  suggestedActions: string[];
}

export const errorHandler = async (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  const traceId = req.traceId || 'unknown';

  // Capture comprehensive error context
  const errorContext = await captureErrorContext(req, err);
  
  // Determine error type and classification
  const { errorType, classification } = classifyError(err, statusCode, errorContext);
  
  // Update status code and message based on classification
  statusCode = classification.statusCode || statusCode;
  message = classification.userMessage || message;

  // Find related errors for correlation
  const relatedErrors = await findRelatedErrors(traceId, errorContext.userInfo.sessionId);

  // Log error with comprehensive context using the enhanced error logging service
  try {
    const errorId = await errorLoggingService.logError(
      `API Error: ${message}`,
      err,
      {
        traceId,
        component: 'ERROR_HANDLER',
        operation: 'HANDLE_API_ERROR',
        source: 'BE',
        level: statusCode >= 500 ? 'ERROR' : 'WARN',
        errorType,
        userId: errorContext.userInfo.userId,
        sessionId: errorContext.userInfo.sessionId,
        requestId: traceId,
        url: errorContext.requestInfo.originalUrl,
        method: errorContext.requestInfo.method,
        statusCode,
        duration: errorContext.systemInfo.duration,
        userAgent: errorContext.requestInfo.userAgent,
        ipAddress: errorContext.requestInfo.ipAddress,
        brokerName: errorContext.brokerInfo?.brokerName,
        accountId: errorContext.brokerInfo?.accountId,
        retryCount: 0
      }
    );

    // Log structured error information with trace context
    TraceContext.logWithTrace('error', `Structured API Error: ${errorType}`, {
      component: 'ERROR_HANDLER',
      operation: 'STRUCTURED_ERROR_LOG',
      errorId,
      errorType,
      category: classification.category,
      severity: classification.severity,
      isRetryable: classification.isRetryable,
      statusCode,
      duration: errorContext.systemInfo.duration,
      memoryUsage: errorContext.systemInfo.memoryUsage.heapUsed,
      relatedErrorsCount: relatedErrors.length,
      userAuthenticated: errorContext.userInfo.isAuthenticated,
      brokerOperation: errorContext.brokerInfo?.operation
    });

    // Complete trace operation with error status and detailed metadata
    if (req.traceId) {
      await traceIdService.completeOperation(
        req.traceId,
        'ERROR_HANDLING',
        'ERROR',
        {
          errorId,
          errorType,
          category: classification.category,
          severity: classification.severity,
          statusCode,
          message: err.message,
          isRetryable: classification.isRetryable,
          relatedErrorsCount: relatedErrors.length,
          userContext: {
            authenticated: errorContext.userInfo.isAuthenticated,
            userId: errorContext.userInfo.userId
          },
          systemContext: {
            memoryUsage: errorContext.systemInfo.memoryUsage.heapUsed,
            duration: errorContext.systemInfo.duration
          }
        }
      );
    }
  } catch (loggingError) {
    // Fallback to regular logging if enhanced logging fails
    logger.error('Failed to log error to enhanced logging service', {
      component: 'ERROR_HANDLER',
      operation: 'LOG_ERROR',
      traceId,
      originalError: err.message
    }, loggingError);
  }

  // Also log with regular logger for immediate console output with structured data
  logger.error(`[${classification.category}] API Error: ${errorType}`, {
    component: 'ERROR_HANDLER',
    operation: 'HANDLE_ERROR',
    errorType,
    category: classification.category,
    severity: classification.severity,
    method: errorContext.requestInfo.method,
    url: errorContext.requestInfo.originalUrl,
    status: statusCode,
    requestId: traceId,
    traceId,
    duration: errorContext.systemInfo.duration,
    userAgent: errorContext.requestInfo.userAgent,
    ipAddress: errorContext.requestInfo.ipAddress,
    userId: errorContext.userInfo.userId,
    authenticated: errorContext.userInfo.isAuthenticated,
    brokerName: errorContext.brokerInfo?.brokerName,
    memoryUsed: Math.round(errorContext.systemInfo.memoryUsage.heapUsed / 1024 / 1024), // MB
    isRetryable: classification.isRetryable,
    relatedErrorsCount: relatedErrors.length
  }, err);

  // Record error in monitoring service
  productionMonitoringService.recordPerformanceMetric(
    `${req.method} ${req.route?.path || req.path}`,
    Date.now() - (req.startTime || Date.now()),
    false,
    {
      component: 'ERROR_HANDLER',
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      requestId: traceId,
      traceId,
      severity: statusCode >= 500 ? 'high' : 'medium'
    },
    message
  );

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Something went wrong';
  }

  res.status(statusCode).json({
    success: false,
    message,
    traceId, // Include trace ID in response for debugging
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      errorType,
      context: errorContext
    }),
  });
};

/**
 * Capture comprehensive error context from request and system state
 */
async function captureErrorContext(req: Request, err: AppError): Promise<ErrorContext> {
  // Sanitize sensitive headers
  const sanitizedHeaders = { ...req.headers };
  delete sanitizedHeaders.authorization;
  delete sanitizedHeaders.cookie;
  delete sanitizedHeaders['x-api-key'];

  // Sanitize request body (remove sensitive fields)
  let sanitizedBody;
  if (req.body && typeof req.body === 'object') {
    sanitizedBody = { ...req.body };
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    delete sanitizedBody.secret;
    delete sanitizedBody.credentials;
  }

  const context: ErrorContext = {
    requestInfo: {
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      path: req.path,
      query: req.query,
      params: req.params,
      headers: sanitizedHeaders as Record<string, string>,
      body: sanitizedBody,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip,
      referer: req.get('Referer')
    },
    userInfo: {
      userId: (req as any).user?.id,
      sessionId: (req as any).sessionID,
      isAuthenticated: !!(req as any).user,
      userRole: (req as any).user?.role
    },
    systemInfo: {
      timestamp: new Date(),
      traceId: req.traceId || 'unknown',
      requestId: req.traceId || 'unknown',
      duration: Date.now() - (req.startTime || Date.now()),
      memoryUsage: process.memoryUsage(),
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    }
  };

  // Add broker context if available
  const traceContext = TraceContext.getContext();
  if (traceContext?.brokerName || traceContext?.accountId) {
    context.brokerInfo = {
      brokerName: traceContext.brokerName,
      accountId: traceContext.accountId,
      operation: traceContext.operation
    };
  }

  return context;
}

/**
 * Classify error based on type, status code, and context
 */
function classifyError(err: AppError, statusCode: number, context: ErrorContext): {
  errorType: string;
  classification: ErrorClassification;
} {
  let errorType = 'SYSTEM_ERROR';
  let classification: ErrorClassification = {
    errorType: 'SYSTEM_ERROR',
    category: 'SYSTEM',
    severity: 'medium',
    isRetryable: false,
    technicalMessage: err.message,
    suggestedActions: ['Contact support if the issue persists']
  };

  // Classify based on HTTP status code
  if (statusCode >= 400 && statusCode < 500) {
    errorType = 'CLIENT_ERROR';
    classification.category = 'CLIENT';
    classification.severity = 'low';
  } else if (statusCode >= 500) {
    errorType = 'SERVER_ERROR';
    classification.category = 'SERVER';
    classification.severity = 'high';
  }

  // Classify based on error name and message
  switch (err.name) {
    case 'ValidationError':
      errorType = 'VALIDATION_ERROR';
      classification = {
        errorType: 'VALIDATION_ERROR',
        category: 'VALIDATION',
        severity: 'low',
        isRetryable: false,
        statusCode: 400,
        userMessage: 'Please check your input and try again',
        technicalMessage: err.message,
        suggestedActions: ['Verify input format', 'Check required fields']
      };
      break;

    case 'JsonWebTokenError':
    case 'TokenExpiredError':
      errorType = 'AUTHENTICATION_ERROR';
      classification = {
        errorType: 'AUTHENTICATION_ERROR',
        category: 'AUTHENTICATION',
        severity: 'medium',
        isRetryable: false,
        statusCode: 401,
        userMessage: 'Authentication failed. Please log in again',
        technicalMessage: err.message,
        suggestedActions: ['Log in again', 'Check your credentials']
      };
      break;

    case 'MongoError':
    case 'MongooseError':
      errorType = 'DATABASE_ERROR';
      classification = {
        errorType: 'DATABASE_ERROR',
        category: 'DATABASE',
        severity: 'high',
        isRetryable: true,
        statusCode: 500,
        userMessage: 'System temporarily unavailable. Please try again',
        technicalMessage: err.message,
        suggestedActions: ['Try again in a few moments', 'Contact support if problem persists']
      };
      break;

    case 'AxiosError':
      errorType = 'EXTERNAL_API_ERROR';
      classification = {
        errorType: 'EXTERNAL_API_ERROR',
        category: 'EXTERNAL_SERVICE',
        severity: 'medium',
        isRetryable: true,
        statusCode: (err as any).response?.status || 500,
        userMessage: 'External service temporarily unavailable',
        technicalMessage: err.message,
        suggestedActions: ['Try again later', 'Check service status']
      };
      break;
  }

  // Classify based on error message patterns
  const message = err.message.toLowerCase();
  
  if (message.includes('timeout') || message.includes('etimedout')) {
    errorType = 'TIMEOUT_ERROR';
    classification.category = 'NETWORK';
    classification.isRetryable = true;
    classification.userMessage = 'Request timed out. Please try again';
  }

  if (message.includes('connection') || message.includes('econnrefused')) {
    errorType = 'CONNECTION_ERROR';
    classification.category = 'NETWORK';
    classification.severity = 'high';
    classification.isRetryable = true;
    classification.userMessage = 'Connection failed. Please check your internet connection';
  }

  if (message.includes('broker') || context.brokerInfo?.brokerName) {
    errorType = 'BROKER_ERROR';
    classification.category = 'TRADING';
    classification.severity = 'high';
    classification.userMessage = 'Trading service temporarily unavailable';
    classification.suggestedActions = ['Try again later', 'Check broker service status'];
  }

  if (message.includes('insufficient') || message.includes('funds')) {
    errorType = 'INSUFFICIENT_FUNDS';
    classification.category = 'TRADING';
    classification.severity = 'medium';
    classification.isRetryable = false;
    classification.userMessage = 'Insufficient funds for this transaction';
    classification.suggestedActions = ['Add funds to your account', 'Reduce order quantity'];
  }

  return { errorType, classification };
}

/**
 * Find related errors by trace ID and session context
 */
async function findRelatedErrors(traceId: string, sessionId?: string): Promise<string[]> {
  try {
    const relatedErrors = await errorLoggingService.getErrorsByTraceId(traceId);
    return relatedErrors.map(error => error.errorId);
  } catch (error) {
    logger.warn('Failed to find related errors', {
      component: 'ERROR_HANDLER',
      operation: 'FIND_RELATED_ERRORS',
      traceId
    });
    return [];
  }
}
