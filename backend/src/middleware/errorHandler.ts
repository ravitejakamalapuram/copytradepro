import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { productionMonitoringService } from '../services/productionMonitoringService';
import { errorLoggingService } from '../services/errorLoggingService';
import { traceIdService } from '../services/traceIdService';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
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

  // Determine error type based on status code and error properties
  let errorType = 'SYSTEM_ERROR';
  if (statusCode >= 400 && statusCode < 500) {
    errorType = 'CLIENT_ERROR';
  } else if (statusCode >= 500) {
    errorType = 'SERVER_ERROR';
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    errorType = 'VALIDATION_ERROR';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorType = 'AUTHENTICATION_ERROR';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorType = 'AUTHENTICATION_ERROR';
  }

  // Log error with enhanced context using the new error logging service
  try {
    await errorLoggingService.logError(
      `API Error: ${message}`,
      err,
      {
        traceId,
        component: 'ERROR_HANDLER',
        operation: 'HANDLE_API_ERROR',
        source: 'BE',
        level: statusCode >= 500 ? 'ERROR' : 'WARN',
        errorType,
        userId: (req as any).user?.id,
        sessionId: (req as any).sessionID || undefined,
        requestId: traceId,
        url: req.originalUrl,
        method: req.method,
        statusCode,
        duration: Date.now() - (req.startTime || Date.now()),
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip
      }
    );

    // Complete trace operation with error status
    if (req.traceId) {
      await traceIdService.completeOperation(
        req.traceId,
        'ERROR_HANDLING',
        'ERROR',
        {
          errorType,
          statusCode,
          message: err.message
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

  // Also log with regular logger for immediate console output
  logger.error('API Error occurred', {
    component: 'ERROR_HANDLER',
    operation: 'HANDLE_ERROR',
    method: req.method,
    url: req.originalUrl,
    status: statusCode,
    requestId: traceId,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip,
    traceId
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
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
