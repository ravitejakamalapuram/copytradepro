import { Request, Response, NextFunction } from 'express';
import { logger, LogContext, EnhancedLogger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request to include logging context
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
      logger?: EnhancedLogger;
      user?: any; // Add user property
    }
  }
}

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Create request-specific logger context
  const requestContext: LogContext = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip || req.connection.remoteAddress,
    component: 'API'
  };

  // Add user context if available
  if (req.user) {
    requestContext.userId = (req.user as any).id || (req.user as any).userId;
  }

  // Create child logger with request context
  req.logger = logger.createChildLogger(requestContext) as EnhancedLogger;

  // Log incoming request
  req.logger!.info(`Incoming ${req.method} request`, requestContext, {
    headers: req.headers,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });

  // Override res.json to log responses
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - (req.startTime || 0);
    const status = res.statusCode;

    // Log API response
    req.logger?.logApiCall(req.method, req.originalUrl || req.url, duration, status, {
      ...requestContext,
      responseSize: JSON.stringify(body).length
    });

    // Log response body for errors or in development
    if (status >= 400 || process.env.NODE_ENV === 'development') {
      req.logger?.debug('Response body', requestContext, { body, status });
    }

    return originalJson.call(this, body);
  };

  // Handle response finish event
  res.on('finish', () => {
    const duration = Date.now() - (req.startTime || 0);
    const status = res.statusCode;

    // Log completion
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    req.logger?.[level](`Request completed`, {
      ...requestContext,
      status,
      duration
    });
  });

  // Handle errors
  res.on('error', (error) => {
    req.logger?.error('Response error', requestContext, error);
  });

  next();
};

export const errorLoggingMiddleware = (error: any, req: Request, res: Response, next: NextFunction): void => {
  const requestContext: LogContext = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    userAgent: req.get('User-Agent'),
    ipAddress: req.ip || req.connection.remoteAddress,
    component: 'ERROR_HANDLER'
  };

  // Log the error with full context
  logger.error('Unhandled request error', requestContext, error);

  // Continue with error handling
  next(error);
};