/**
 * Tracked Authentication Middleware
 * Enhanced authentication middleware with comprehensive error logging
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authErrorLoggingService } from '../services/authErrorLoggingService';
import { traceIdService } from '../services/traceIdService';
import TraceContext from '../utils/traceContext';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  body: any;
  params: any;
  query: any;
}

export const trackedAuthenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const startTime = performance.now();
  const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
  
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // Create auth context
  const authContext = authErrorLoggingService.createAuthContext(
    'AUTHENTICATE_TOKEN',
    {
      sessionInfo: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.connection.remoteAddress
      },
      requestDetails: {
        url: req.originalUrl,
        method: req.method,
        requestId: traceId,
        headers: {
          authorization: authHeader ? 'Bearer [REDACTED]' : 'none',
          'user-agent': req.headers['user-agent'] || 'unknown'
        }
      },
      traceId
    }
  );

  const completeAuth = async (success: boolean, error?: any) => {
    const duration = performance.now() - startTime;
    authContext.requestDetails!.duration = duration;

    if (success) {
      await authErrorLoggingService.logAuthSuccess(
        'Token authentication successful',
        {
          ...authContext,
          userId: req.user?.id,
          email: req.user?.email
        }
      );

      // Complete trace operation
      await traceIdService.completeOperation(
        traceId,
        'AUTHENTICATE_TOKEN',
        'SUCCESS',
        { 
          userId: req.user?.id,
          duration 
        }
      );
    } else {
      await authErrorLoggingService.logAuthError(
        error?.message || 'Token authentication failed',
        error,
        authContext
      );

      // Complete trace operation with error
      await traceIdService.completeOperation(
        traceId,
        'AUTHENTICATE_TOKEN',
        'ERROR',
        { 
          error: error?.message,
          duration 
        }
      );
    }
  };

  // Add trace operation
  traceIdService.addOperation(traceId, 'AUTHENTICATE_TOKEN', 'AUTH_MIDDLEWARE')
    .catch(err => console.error('Failed to add trace operation:', err));

  try {
    if (!token) {
      const error = new Error('Access token required');
      console.error('🚨 No token provided');
      
      completeAuth(false, error).catch(err => 
        console.error('Failed to log auth error:', err)
      );

      res.status(401).json({
        success: false,
        message: 'Access token required',
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      const error = new Error('JWT_SECRET not configured');
      
      completeAuth(false, error).catch(err => 
        console.error('Failed to log auth error:', err)
      );

      throw error;
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      id: string;
      email: string;
      name: string;
    };

    req.user = decoded;
    
    completeAuth(true).catch(err => 
      console.error('Failed to log auth success:', err)
    );

    next();
  } catch (error: any) {
    console.error('🚨 Authentication error:', error.message);
    console.error('🔍 Token details:', {
      hasAuthHeader: !!authHeader,
      tokenLength: token?.length,
      errorType: error.name
    });

    completeAuth(false, error).catch(err => 
      console.error('Failed to log auth error:', err)
    );

    res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};

/**
 * Optional authorization middleware for role-based access control
 */
export const trackedAuthorizeRole = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();

    const authContext = authErrorLoggingService.createAuthContext(
      'AUTHORIZE_ROLE',
      {
        userId: req.user?.id,
        email: req.user?.email,
        sessionInfo: {
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip || req.connection.remoteAddress
        },
        requestDetails: {
          url: req.originalUrl,
          method: req.method,
          requestId: traceId
        },
        traceId
      }
    );

    try {
      await traceIdService.addOperation(traceId, 'AUTHORIZE_ROLE', 'AUTH_MIDDLEWARE');

      if (!req.user) {
        const error = new Error('User not authenticated');
        const duration = performance.now() - startTime;
        authContext.requestDetails!.duration = duration;

        await authErrorLoggingService.logAuthError(
          'Authorization failed: User not authenticated',
          error,
          authContext
        );

        await traceIdService.completeOperation(
          traceId,
          'AUTHORIZE_ROLE',
          'ERROR',
          { 
            error: error.message,
            duration 
          }
        );

        res.status(401).json({
          success: false,
          message: 'User not authenticated',
        });
        return;
      }

      // In a real application, you would check user roles from database
      // For now, we'll assume all authenticated users have access
      const userHasRole = true; // This would be: await checkUserRole(req.user.id, allowedRoles);

      const duration = performance.now() - startTime;
      authContext.requestDetails!.duration = duration;

      if (userHasRole) {
        await authErrorLoggingService.logAuthSuccess(
          `Role authorization successful for roles: ${allowedRoles.join(', ')}`,
          authContext
        );

        await traceIdService.completeOperation(
          traceId,
          'AUTHORIZE_ROLE',
          'SUCCESS',
          { 
            allowedRoles,
            duration 
          }
        );

        next();
      } else {
        const error = new Error(`Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`);

        await authErrorLoggingService.logAuthError(
          'Authorization failed: Insufficient permissions',
          error,
          {
            ...authContext,
            securityContext: {
              suspiciousActivity: true // Unauthorized access attempt
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'AUTHORIZE_ROLE',
          'ERROR',
          { 
            error: error.message,
            allowedRoles,
            duration 
          }
        );

        res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
        });
      }
    } catch (error: any) {
      const duration = performance.now() - startTime;
      authContext.requestDetails!.duration = duration;

      await authErrorLoggingService.logAuthError(
        `Role authorization error: ${error.message}`,
        error,
        authContext
      );

      await traceIdService.completeOperation(
        traceId,
        'AUTHORIZE_ROLE',
        'ERROR',
        { 
          error: error.message,
          allowedRoles,
          duration 
        }
      );

      res.status(500).json({
        success: false,
        message: 'Authorization error',
      });
    }
  };
};