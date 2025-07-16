/**
 * Performance Monitoring Middleware
 * Automatically tracks API performance metrics
 */

import { Request, Response, NextFunction } from 'express';
import { productionMonitoringService } from '../services/productionMonitoringService';
import { logger } from '../utils/logger';

export interface PerformanceRequest extends Request {
  startTime?: number;
  requestId?: string;
}

/**
 * Middleware to track API performance metrics
 */
export const performanceMonitoring = (
  req: PerformanceRequest,
  res: Response,
  next: NextFunction
): void => {
  // Skip monitoring for health check endpoints to avoid noise
  if (req.path === '/api/monitoring/health') {
    return next();
  }

  const startTime = Date.now();
  req.startTime = startTime;
  
  // Generate request ID if not present
  if (!req.requestId) {
    req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Override res.end to capture response metrics
  const originalEnd = res.end;
  let responseEnded = false;

  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    if (responseEnded) {
      return originalEnd.call(this, chunk, encoding, cb);
    }
    
    responseEnded = true;
    const endTime = Date.now();
    const duration = endTime - startTime;
    const success = res.statusCode < 400;
    
    // Record performance metric
    const operation = `${req.method} ${req.route?.path || req.path}`;
    productionMonitoringService.recordPerformanceMetric(
      operation,
      duration,
      success,
      {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        responseSize: res.get('Content-Length') ? parseInt(res.get('Content-Length')!) : undefined
      },
      success ? undefined : `HTTP ${res.statusCode}`
    );

    // Log slow requests
    if (duration > 2000) { // Requests slower than 2 seconds
      logger.warn('Slow API request detected', {
        component: 'PERFORMANCE',
        operation: 'SLOW_REQUEST',
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        duration,
        status: res.statusCode
      });
    }

    // Log error responses
    if (!success) {
      logger.warn('API error response', {
        component: 'PERFORMANCE',
        operation: 'ERROR_RESPONSE',
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        duration,
        status: res.statusCode
      });
    }

    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

/**
 * Middleware to add request ID to all requests
 */
export const requestIdMiddleware = (
  req: PerformanceRequest,
  res: Response,
  next: NextFunction
): void => {
  // Check if request ID is provided in headers
  const requestId = req.get('X-Request-ID') || 
                   req.get('X-Correlation-ID') ||
                   `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  next();
};