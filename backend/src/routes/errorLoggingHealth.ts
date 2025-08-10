/**
 * Error Logging Health Check Routes
 * Provides monitoring endpoints for the error logging system
 */

import { Router } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { robustErrorLoggingService } from '../services/robustErrorLoggingService';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Admin role check middleware
const requireAdmin = (req: AuthenticatedRequest, res: any, next: any) => {
  const user = req.user as any; // Type assertion to access role property
  
  if (user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Apply admin check to all routes
router.use(requireAdmin);

/**
 * @route GET /api/error-logging-health/status
 * @desc Get error logging system status
 * @access Private (Admin)
 */
router.get('/status', (req: AuthenticatedRequest, res) => {
  try {
    const status = robustErrorLoggingService.getQueueStatus();
    
    const healthStatus = {
      status: status.circuitBreakerOpen ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      queue: {
        size: status.queueSize,
        isProcessing: status.isProcessing
      },
      circuitBreaker: {
        isOpen: status.circuitBreakerOpen,
        failureCount: status.failureCount
      },
      recommendations: [] as string[]
    };

    // Add recommendations based on status
    if (status.circuitBreakerOpen) {
      healthStatus.recommendations.push('Circuit breaker is open - database connectivity issues detected');
    }
    
    if (status.queueSize > 100) {
      healthStatus.recommendations.push('Error queue is growing - consider investigating database performance');
    }
    
    if (status.queueSize > 500) {
      healthStatus.recommendations.push('Error queue is critically high - immediate attention required');
    }

    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    // Don't use logger here to prevent infinite loops
    console.error('Failed to get error logging health status:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get error logging health status',
      data: {
        status: 'unknown',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @route POST /api/error-logging-health/reset-circuit-breaker
 * @desc Reset the circuit breaker (admin action)
 * @access Private (Admin)
 */
router.post('/reset-circuit-breaker', (req: AuthenticatedRequest, res) => {
  try {
    robustErrorLoggingService.resetCircuitBreaker();
    
    res.json({
      success: true,
      message: 'Circuit breaker reset successfully'
    });
  } catch (error) {
    console.error('Failed to reset circuit breaker:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to reset circuit breaker'
    });
  }
});

/**
 * @route POST /api/error-logging-health/force-process-queue
 * @desc Force process the error queue (admin action)
 * @access Private (Admin)
 */
router.post('/force-process-queue', async (req: AuthenticatedRequest, res) => {
  try {
    await robustErrorLoggingService.forceProcessQueue();
    
    const status = robustErrorLoggingService.getQueueStatus();
    
    res.json({
      success: true,
      message: 'Queue processing completed',
      data: {
        queueSize: status.queueSize
      }
    });
  } catch (error) {
    console.error('Failed to force process queue:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to force process queue'
    });
  }
});

/**
 * @route POST /api/error-logging-health/clear-queue
 * @desc Clear the error queue (emergency action)
 * @access Private (Admin)
 */
router.post('/clear-queue', (req: AuthenticatedRequest, res) => {
  try {
    const statusBefore = robustErrorLoggingService.getQueueStatus();
    robustErrorLoggingService.clearQueue();
    
    res.json({
      success: true,
      message: 'Error queue cleared',
      data: {
        clearedItems: statusBefore.queueSize
      }
    });
  } catch (error) {
    console.error('Failed to clear queue:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to clear queue'
    });
  }
});

/**
 * @route GET /api/error-logging-health/metrics
 * @desc Get detailed metrics about error logging performance
 * @access Private (Admin)
 */
router.get('/metrics', (req: AuthenticatedRequest, res) => {
  try {
    const status = robustErrorLoggingService.getQueueStatus();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      queue: {
        currentSize: status.queueSize,
        isProcessing: status.isProcessing,
        status: status.queueSize === 0 ? 'empty' : 
                status.queueSize < 50 ? 'normal' :
                status.queueSize < 200 ? 'elevated' : 'critical'
      },
      circuitBreaker: {
        isOpen: status.circuitBreakerOpen,
        failureCount: status.failureCount,
        status: status.circuitBreakerOpen ? 'open' : 'closed'
      },
      systemHealth: {
        overall: status.circuitBreakerOpen ? 'degraded' : 
                 status.queueSize > 200 ? 'warning' : 'healthy',
        errorLoggingAvailable: !status.circuitBreakerOpen,
        queueBackpressure: status.queueSize > 100
      }
    };

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Failed to get error logging metrics:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to get error logging metrics'
    });
  }
});

export default router;