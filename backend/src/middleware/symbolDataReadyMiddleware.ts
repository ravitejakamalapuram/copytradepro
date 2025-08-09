/**
 * Symbol Data Ready Middleware
 * Provides graceful handling when APIs are called before symbol data is ready
 */

import { Request, Response, NextFunction } from 'express';
import { startupStatusService } from '../services/startupStatusService';
import { logger } from '../utils/logger';

/**
 * Middleware to check if symbol data is ready before processing symbol-related requests
 */
export async function requireSymbolData(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Check if symbol data is ready; if not, try to infer readiness from DB to avoid false negatives
  if (!startupStatusService.isSymbolDataReady()) {
    await startupStatusService.refreshSymbolReadyFromDb();
  }

  if (!startupStatusService.isSymbolDataReady()) {
    logger.warn('API request blocked - symbol data not ready', {
      component: 'SYMBOL_DATA_MIDDLEWARE',
      operation: 'BLOCK_REQUEST',
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // Return graceful response
    const response = startupStatusService.getSymbolDataNotReadyResponse();
    res.status(503).json(response);
    return;
  }

  // Symbol data is ready, proceed with request
  next();
}

/**
 * Middleware to check if server is ready (less strict than symbol data)
 */
export function requireServerReady(req: Request, res: Response, next: NextFunction): void {
  // Check if server is ready
  if (!startupStatusService.isServerReady()) {
    logger.warn('API request blocked - server not ready', {
      component: 'SYMBOL_DATA_MIDDLEWARE',
      operation: 'BLOCK_SERVER_NOT_READY',
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    res.status(503).json({
      success: false,
      error: 'SERVER_NOT_READY',
      message: 'Server is still starting up. Please try again in a few moments.',
      retryAfter: 10
    });
    return;
  }

  // Server is ready, proceed with request
  next();
}

/**
 * Middleware that adds startup status to response headers (for debugging)
 */
export function addStartupStatusHeaders(req: Request, res: Response, next: NextFunction): void {
  const status = startupStatusService.getStatus();
  
  res.set({
    'X-Server-Ready': status.serverReady.toString(),
    'X-Symbol-Data-Ready': status.symbolDataReady.toString(),
    'X-Startup-Phase': status.startupPhase,
    'X-Symbol-Init-Progress': (status.symbolInitStatus?.progress || 0).toString()
  });

  next();
}

/**
 * Routes that require symbol data to be ready
 */
export const SYMBOL_DATA_REQUIRED_ROUTES = [
  '/api/symbols',
  '/api/symbol-search',
  '/api/broker/place-order',
  '/api/broker/modify-order',
  '/api/advanced-orders',
  '/api/market-data/quote',
  '/api/portfolio'
];

/**
 * Routes that only require server to be ready (can work without symbol data)
 */
export const SERVER_READY_REQUIRED_ROUTES = [
  '/api/auth',
  '/api/broker/accounts',
  '/api/broker/connect',
  '/api/monitoring',
  '/api/logs'
];

/**
 * Check if a route requires symbol data
 */
export function routeRequiresSymbolData(path: string): boolean {
  return SYMBOL_DATA_REQUIRED_ROUTES.some(route => path.startsWith(route));
}

/**
 * Check if a route requires server to be ready
 */
export function routeRequiresServerReady(path: string): boolean {
  return SERVER_READY_REQUIRED_ROUTES.some(route => path.startsWith(route));
}