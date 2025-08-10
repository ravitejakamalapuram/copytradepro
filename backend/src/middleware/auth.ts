import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role?: string;
  };
  body: any;
  params: any;
  query: any;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  try {
    if (!token) {
      console.error('🚨 No token provided');
      res.status(401).json({
        success: false,
        message: 'Access token required',
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      id: string;
      email: string;
      name: string;
      role?: string;
    };

    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('🚨 Authentication error:', error.message);
    console.error('🔍 Token details:', {
      hasAuthHeader: !!authHeader,
      tokenLength: token?.length,
      errorType: error.name
    });
    res.status(403).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};


export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const role = req.user?.role?.toLowerCase();
  if (role === 'admin') return next();
  res.status(403).json({ success: false, message: 'Admin access required' });
};
