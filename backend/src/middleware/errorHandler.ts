import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { productionMonitoringService } from '../services/productionMonitoringService';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Log error with enhanced context
  logger.error('API Error occurred', {
    component: 'ERROR_HANDLER',
    operation: 'HANDLE_ERROR',
    method: req.method,
    url: req.originalUrl,
    status: statusCode,
    requestId: (req as any).requestId,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip
  }, err);

  // Record error in monitoring service
  productionMonitoringService.recordPerformanceMetric(
    `${req.method} ${req.route?.path || req.path}`,
    Date.now() - ((req as any).startTime || Date.now()),
    false,
    {
      component: 'ERROR_HANDLER',
      method: req.method,
      url: req.originalUrl,
      status: statusCode,
      requestId: (req as any).requestId,
      severity: statusCode >= 500 ? 'high' : 'medium'
    },
    message
  );

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Something went wrong';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
