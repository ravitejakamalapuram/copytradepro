/**
 * Session Health Controller
 * Provides endpoints for monitoring broker session health
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { brokerSessionManager } from '../services/brokerSessionManager';

/**
 * Get session health statistics for all user accounts
 */
export const getSessionHealthStats = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Get overall health statistics
    const overallStats = brokerSessionManager.getHealthStatistics();
    
    // Get user-specific session health
    const userSessionHealth = brokerSessionManager.getUserSessionHealth(userId);

    res.status(200).json({
      success: true,
      data: {
        overall: overallStats,
        userSessions: userSessionHealth.map(session => ({
          brokerName: session.brokerName,
          accountId: session.accountId,
          isHealthy: session.isHealthy,
          healthScore: session.healthScore,
          lastValidated: session.lastValidated,
          lastSuccessfulCall: session.lastSuccessfulCall,
          consecutiveFailures: session.consecutiveFailures,
          averageResponseTime: Math.round(session.averageResponseTime),
          tokenExpiryTime: session.tokenExpiryTime,
          needsRefresh: session.needsRefresh,
          recentErrors: session.errorHistory.slice(0, 3) // Last 3 errors
        }))
      }
    });
  } catch (error: any) {
    console.error('🚨 Get session health stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session health statistics',
      error: error.message
    });
  }
};

/**
 * Get detailed session health for a specific account
 */
export const getAccountSessionHealth = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { brokerName, accountId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!brokerName || !accountId) {
      res.status(400).json({
        success: false,
        message: 'Broker name and account ID are required',
      });
      return;
    }

    // Get session health for specific account
    const sessionHealth = brokerSessionManager.getSessionHealth(userId, brokerName, accountId);

    if (!sessionHealth) {
      res.status(404).json({
        success: false,
        message: 'Session health data not found for this account',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        brokerName: sessionHealth.brokerName,
        accountId: sessionHealth.accountId,
        isHealthy: sessionHealth.isHealthy,
        healthScore: sessionHealth.healthScore,
        lastValidated: sessionHealth.lastValidated,
        lastSuccessfulCall: sessionHealth.lastSuccessfulCall,
        consecutiveFailures: sessionHealth.consecutiveFailures,
        averageResponseTime: Math.round(sessionHealth.averageResponseTime),
        tokenExpiryTime: sessionHealth.tokenExpiryTime,
        needsRefresh: sessionHealth.needsRefresh,
        errorHistory: sessionHealth.errorHistory
      }
    });
  } catch (error: any) {
    console.error('🚨 Get account session health error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get account session health',
      error: error.message
    });
  }
};

/**
 * Manually validate a specific session
 */
export const validateAccountSession = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { brokerName, accountId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!brokerName || !accountId) {
      res.status(400).json({
        success: false,
        message: 'Broker name and account ID are required',
      });
      return;
    }

    console.log(`🔄 Manual session validation requested for ${brokerName} account ${accountId}`);

    // Perform session validation
    const validationResult = await brokerSessionManager.validateSession(userId, brokerName, accountId);

    res.status(200).json({
      success: true,
      data: {
        isValid: validationResult.isValid,
        healthScore: validationResult.healthScore,
        needsRefresh: validationResult.needsRefresh,
        errorMessage: validationResult.errorMessage,
        responseTime: validationResult.responseTime,
        timestamp: new Date()
      }
    });
  } catch (error: any) {
    console.error('🚨 Manual session validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate session',
      error: error.message
    });
  }
};

/**
 * Manually refresh token for a specific session
 */
export const refreshAccountToken = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { brokerName, accountId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!brokerName || !accountId) {
      res.status(400).json({
        success: false,
        message: 'Broker name and account ID are required',
      });
      return;
    }

    console.log(`🔄 Manual token refresh requested for ${brokerName} account ${accountId}`);

    // Attempt token refresh
    const refreshSuccess = await brokerSessionManager.refreshSessionToken(userId, brokerName, accountId);

    if (refreshSuccess) {
      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          refreshed: true,
          timestamp: new Date()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Token refresh failed. Manual re-authentication may be required.',
        data: {
          refreshed: false,
          timestamp: new Date()
        }
      });
    }
  } catch (error: any) {
    console.error('🚨 Manual token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token',
      error: error.message
    });
  }
};