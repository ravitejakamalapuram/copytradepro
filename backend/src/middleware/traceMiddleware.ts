import { Request, Response, NextFunction } from 'express';
import { traceIdService } from '../services/traceIdService';
import { logger } from '../utils/logger';
import { TraceContext, TraceContextData } from '../utils/traceContext';

// Extend Express Request interface to include trace context
declare global {
  namespace Express {
    interface Request {
      traceId?: string;
      traceContext?: any;
      startTime?: number;
    }
  }
}

/**
 * Middleware to attach trace ID to all incoming requests
 */
export const traceMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract trace ID from headers or generate new one
    const existingTraceId = req.headers['x-trace-id'] as string;
    const traceId = existingTraceId || traceIdService.generateTraceId();

    // Create trace context
    const traceContext = await traceIdService.createTraceContext(traceId);

    // Attach to request
    req.traceId = traceId;
    req.traceContext = traceContext;
    req.startTime = Date.now();

    // Add trace ID to response headers
    res.setHeader('x-trace-id', traceId);

    // Create trace context data
    const traceContextData: TraceContextData = {
      traceId,
      userId: (req as any).user?.id,
      sessionId: (req as any).sessionID,
      requestId: traceId,
      userAgent: req.get('User-Agent') || undefined,
      ipAddress: req.ip || undefined,
      operation: 'HTTP_REQUEST',
      component: 'REQUEST_HANDLER'
    };

    // Set trace context for the entire request lifecycle
    TraceContext.setContext(traceContextData);

    // Log request start
    await traceIdService.addOperation(
      traceId,
      'HTTP_REQUEST',
      'REQUEST_HANDLER',
      {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        userId: (req as any).user?.id,
        sessionId: (req as any).sessionID || undefined
      }
    );

    logger.debug('Request started with trace ID', {
      component: 'TRACE_MIDDLEWARE',
      operation: 'REQUEST_START',
      traceId,
      method: req.method,
      url: req.originalUrl,
      requestId: traceId,
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip
    });

    // Override res.end to complete the trace
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: any) {
      const duration = Date.now() - (req.startTime || Date.now());
      const status = res.statusCode < 400 ? 'SUCCESS' : 'ERROR';

      // Complete the HTTP request operation
      traceIdService.completeOperation(
        traceId,
        'HTTP_REQUEST',
        status,
        {
          statusCode: res.statusCode,
          duration,
          responseSize: res.get('content-length')
        }
      ).catch(error => {
        logger.error('Failed to complete trace operation', {
          component: 'TRACE_MIDDLEWARE',
          operation: 'COMPLETE_REQUEST',
          traceId
        }, error);
      });

      // Complete the entire trace if this is the main request
      traceIdService.completeTrace(traceId, status).catch(error => {
        logger.error('Failed to complete trace', {
          component: 'TRACE_MIDDLEWARE',
          operation: 'COMPLETE_TRACE',
          traceId
        }, error);
      });

      logger.debug('Request completed', {
        component: 'TRACE_MIDDLEWARE',
        operation: 'REQUEST_END',
        traceId,
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration,
        requestId: traceId
      });

      // Call original end method
      return originalEnd.call(this, chunk, encoding, cb);
    };

    // Execute the rest of the middleware chain within trace context
    TraceContext.run(traceContextData, () => {
      next();
    });
  } catch (error) {
    logger.error('Error in trace middleware', {
      component: 'TRACE_MIDDLEWARE',
      operation: 'ATTACH_TRACE_ID',
      method: req.method,
      url: req.originalUrl
    }, error);

    // Continue without trace ID if there's an error
    next();
  }
};

/**
 * Helper function to get trace ID from request
 */
export const getTraceId = (req: Request): string | undefined => {
  return req.traceId;
};

/**
 * Helper function to add operation to current trace
 */
export const addTraceOperation = async (
  req: Request,
  operation: string,
  component: string,
  metadata?: any
): Promise<void> => {
  if (req.traceId) {
    await traceIdService.addOperation(req.traceId, operation, component, metadata);
  }
};

/**
 * Helper function to complete operation in current trace
 */
export const completeTraceOperation = async (
  req: Request,
  operation: string,
  status: 'SUCCESS' | 'ERROR',
  metadata?: any
): Promise<void> => {
  if (req.traceId) {
    await traceIdService.completeOperation(req.traceId, operation, status, metadata);
  }
};