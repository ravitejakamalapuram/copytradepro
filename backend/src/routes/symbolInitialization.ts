/**
 * Symbol Initialization Routes
 * API endpoints for managing symbol data initialization
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { startupSymbolInitializationService } from '../services/startupSymbolInitializationService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Get symbol initialization status
 */
router.get('/status', authenticateToken, async (req: any, res: any) => {
  try {
    const status = startupSymbolInitializationService.getStatus();
    const stats = startupSymbolInitializationService.getInitializationStats();
    const isReady = await startupSymbolInitializationService.isSymbolDataReady();

    res.json({
      success: true,
      data: {
        status,
        stats,
        isReady,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Failed to get symbol initialization status', {
      component: 'SYMBOL_INIT_ROUTES',
      operation: 'GET_STATUS_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to get initialization status',
      error: error.message
    });
  }
});

/**
 * Test CSV download and parsing (for debugging)
 */
router.get('/test-csv', authenticateToken, async (req: any, res: any) => {
  try {
    const { upstoxDataProcessor } = require('../services/upstoxDataProcessor');
    const result = await upstoxDataProcessor.testCSVDownloadAndParse();

    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('CSV test failed', {
      component: 'SYMBOL_INIT_ROUTES',
      operation: 'TEST_CSV_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      message: 'CSV test failed',
      error: error.message
    });
  }
});

/**
 * Force restart symbol initialization
 */
router.post('/restart', authenticateToken, async (req: any, res: any) => {
  try {
    logger.info('Manual symbol initialization restart requested', {
      component: 'SYMBOL_INIT_ROUTES',
      operation: 'RESTART_REQUESTED',
      userId: req.user?.id
    });

    // Check if already in progress
    if (startupSymbolInitializationService.isInProgress()) {
      return res.status(409).json({
        success: false,
        message: 'Symbol initialization is already in progress'
      });
    }

    // Start initialization in background
    startupSymbolInitializationService.forceRestart().catch((error: any) => {
      logger.error('Background symbol initialization failed', {
        component: 'SYMBOL_INIT_ROUTES',
        operation: 'RESTART_BACKGROUND_ERROR'
      }, error);
    });

    res.json({
      success: true,
      message: 'Symbol initialization restart initiated',
      data: {
        status: startupSymbolInitializationService.getStatus(),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Failed to restart symbol initialization', {
      component: 'SYMBOL_INIT_ROUTES',
      operation: 'RESTART_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to restart initialization',
      error: error.message
    });
  }
});

/**
 * Check if symbol data is ready for use
 */
router.get('/ready', async (req: any, res: any) => {
  try {
    const isReady = await startupSymbolInitializationService.isSymbolDataReady();
    const status = startupSymbolInitializationService.getStatus();

    res.json({
      success: true,
      data: {
        isReady,
        status: status.status,
        progress: status.progress,
        currentStep: status.currentStep,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Failed to check symbol data readiness', {
      component: 'SYMBOL_INIT_ROUTES',
      operation: 'CHECK_READY_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to check symbol data readiness',
      error: error.message
    });
  }
});

/**
 * Get detailed initialization statistics
 */
router.get('/stats', authenticateToken, async (req: any, res: any) => {
  try {
    const stats = startupSymbolInitializationService.getInitializationStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    logger.error('Failed to get initialization statistics', {
      component: 'SYMBOL_INIT_ROUTES',
      operation: 'GET_STATS_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to get initialization statistics',
      error: error.message
    });
  }
});

export default router;