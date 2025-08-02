import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { getDatabase } from '../services/databaseFactory';
import { trackedUserDatabase } from '../services/trackedDatabaseCompatibility';
import { authErrorLoggingService } from '../services/authErrorLoggingService';
import { traceIdService } from '../services/traceIdService';
import TraceContext from '../utils/traceContext';
import { User } from '../interfaces/IDatabaseAdapter';
import { populateCacheForUser } from './brokerController';

// Helper function to generate JWT token
const generateToken = (user: Pick<User, 'id' | 'email' | 'name'>): string => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(
    {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
    },
    jwtSecret,
    { expiresIn: '24h' }
  );
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = performance.now();
  const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
  
  const authContext = authErrorLoggingService.createAuthContext(
    'REGISTER_USER',
    {
      email: req.body.email,
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
    await traceIdService.addOperation(traceId, 'REGISTER_USER', 'AUTH_CONTROLLER');

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const duration = performance.now() - startTime;
      const validationError = new Error('Validation failed');
      
      await authErrorLoggingService.logAuthError(
        'User registration failed: Validation errors',
        validationError,
        {
          ...authContext,
          requestDetails: {
            ...authContext.requestDetails!,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'REGISTER_USER',
        'ERROR',
        { 
          error: 'Validation failed',
          duration 
        }
      );

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const { email, password, name } = req.body;

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user using tracked database service
    const newUser = await trackedUserDatabase.createUser({
      email,
      name,
      password: hashedPassword,
    });

    // Generate token
    const token = generateToken({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    });

    const duration = performance.now() - startTime;

    // Log successful registration
    await authErrorLoggingService.logAuthSuccess(
      'User registered successfully',
      {
        ...authContext,
        userId: newUser.id.toString(),
        requestDetails: {
          ...authContext.requestDetails!,
          duration
        }
      }
    );

    await traceIdService.completeOperation(
      traceId,
      'REGISTER_USER',
      'SUCCESS',
      { 
        userId: newUser.id.toString(),
        email: newUser.email,
        duration 
      }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          createdAt: newUser.created_at,
        },
        token,
      },
    });
  } catch (error: any) {
    const duration = performance.now() - startTime;

    await authErrorLoggingService.logAuthError(
      `User registration failed: ${error.message}`,
      error,
      {
        ...authContext,
        requestDetails: {
          ...authContext.requestDetails!,
          duration
        }
      }
    );

    await traceIdService.completeOperation(
      traceId,
      'REGISTER_USER',
      'ERROR',
      { 
        error: error.message,
        duration 
      }
    );

    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = performance.now();
  const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
  
  const authContext = authErrorLoggingService.createAuthContext(
    'LOGIN_USER',
    {
      email: req.body.email,
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
    await traceIdService.addOperation(traceId, 'LOGIN_USER', 'AUTH_CONTROLLER');

    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const duration = performance.now() - startTime;
      const validationError = new Error('Validation failed');
      
      await authErrorLoggingService.logAuthError(
        'User login failed: Validation errors',
        validationError,
        {
          ...authContext,
          requestDetails: {
            ...authContext.requestDetails!,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'LOGIN_USER',
        'ERROR',
        { 
          error: 'Validation failed',
          duration 
        }
      );

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const { email, password } = req.body;

    // Find user using tracked database service
    const user = await trackedUserDatabase.findUserByEmail(email);
    if (!user) {
      const duration = performance.now() - startTime;
      const authError = new Error('Invalid email or password');
      
      await authErrorLoggingService.logAuthError(
        'Login failed: User not found',
        authError,
        {
          ...authContext,
          requestDetails: {
            ...authContext.requestDetails!,
            duration
          },
          securityContext: {
            suspiciousActivity: false // Not necessarily suspicious, could be typo
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'LOGIN_USER',
        'ERROR',
        { 
          error: 'User not found',
          email,
          duration 
        }
      );

      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      const duration = performance.now() - startTime;
      const authError = new Error('Invalid email or password');
      
      await authErrorLoggingService.logAuthError(
        'Login failed: Invalid password',
        authError,
        {
          ...authContext,
          userId: user.id.toString(),
          requestDetails: {
            ...authContext.requestDetails!,
            duration
          },
          securityContext: {
            suspiciousActivity: true, // Wrong password is more suspicious
            loginAttempts: 1 // In real app, track this
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'LOGIN_USER',
        'ERROR',
        { 
          error: 'Invalid password',
          userId: user.id.toString(),
          email,
          duration 
        }
      );

      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
    });

    // Populate broker account cache for this user
    await populateCacheForUser(user.id.toString());

    const duration = performance.now() - startTime;

    // Log successful login
    await authErrorLoggingService.logAuthSuccess(
      'User login successful',
      {
        ...authContext,
        userId: user.id.toString(),
        sessionInfo: {
          ...authContext.sessionInfo!,
          tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        },
        requestDetails: {
          ...authContext.requestDetails!,
          duration
        }
      }
    );

    await traceIdService.completeOperation(
      traceId,
      'LOGIN_USER',
      'SUCCESS',
      { 
        userId: user.id.toString(),
        email: user.email,
        duration 
      }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.created_at,
        },
        token,
      },
    });
  } catch (error: any) {
    const duration = performance.now() - startTime;

    await authErrorLoggingService.logAuthError(
      `User login failed: ${error.message}`,
      error,
      {
        ...authContext,
        requestDetails: {
          ...authContext.requestDetails!,
          duration
        }
      }
    );

    await traceIdService.completeOperation(
      traceId,
      'LOGIN_USER',
      'ERROR',
      { 
        error: error.message,
        duration 
      }
    );

    next(error);
  }
};

export const logout = (
  _req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): void => {
  try {
    // In a real application, you might want to blacklist the token
    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    _next(error);
  }
};

export const getProfile = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};
