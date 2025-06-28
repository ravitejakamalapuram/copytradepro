import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { portfolioAnalyticsService } from '../services/portfolioAnalyticsService';

const router = express.Router();

/**
 * Get portfolio positions
 */
router.get('/positions', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const positions = await portfolioAnalyticsService.getPortfolioPositions(userId);

    return res.json({
      success: true,
      data: positions
    });
  } catch (error: any) {
    console.error('Failed to get portfolio positions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get portfolio positions',
      details: error.message
    });
  }
});

/**
 * Get portfolio metrics
 */
router.get('/metrics', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const metrics = await portfolioAnalyticsService.getPortfolioMetrics(userId);

    return res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    console.error('Failed to get portfolio metrics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get portfolio metrics',
      details: error.message
    });
  }
});

/**
 * Get trading statistics
 */
router.get('/trading-stats', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const stats = await portfolioAnalyticsService.getTradingStatistics(userId);

    return res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Failed to get trading statistics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get trading statistics',
      details: error.message
    });
  }
});

/**
 * Get performance data
 */
router.get('/performance', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const days = parseInt(req.query.days as string) || 30;
    const performance = await portfolioAnalyticsService.getPerformanceData(userId, days);

    return res.json({
      success: true,
      data: performance
    });
  } catch (error: any) {
    console.error('Failed to get performance data:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get performance data',
      details: error.message
    });
  }
});

/**
 * Get symbol performance
 */
router.get('/symbols', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const symbolPerformance = await portfolioAnalyticsService.getSymbolPerformance(userId);

    return res.json({
      success: true,
      data: symbolPerformance
    });
  } catch (error: any) {
    console.error('Failed to get symbol performance:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get symbol performance',
      details: error.message
    });
  }
});

/**
 * Get portfolio summary for dashboard
 */
router.get('/summary', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const summary = await portfolioAnalyticsService.getPortfolioSummary(userId);

    return res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('Failed to get portfolio summary:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get portfolio summary',
      details: error.message
    });
  }
});

/**
 * Get detailed analytics
 */
router.get('/analytics', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const analytics = await portfolioAnalyticsService.getDetailedAnalytics(userId);

    return res.json({
      success: true,
      data: analytics
    });
  } catch (error: any) {
    console.error('Failed to get detailed analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get detailed analytics',
      details: error.message
    });
  }
});

export default router;
