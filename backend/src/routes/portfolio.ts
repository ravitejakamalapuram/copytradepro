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

    console.log(`📊 Calculating positions with live prices for user ${userId}...`);
    const positions = await portfolioAnalyticsService.calculatePortfolioPositions(userId);
    console.log(`✅ Calculated ${positions.length} positions with live market data`);

    return res.json({
      success: true,
      data: {
        positions,
        count: positions.length
      }
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

    const metrics = portfolioAnalyticsService.calculatePortfolioMetrics(userId);

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

    const stats = portfolioAnalyticsService.calculateTradingStats(userId);

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
 * Get performance data for charts
 */
router.get('/performance', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    const days = parseInt(req.query.days as string) || 30;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (days < 1 || days > 365) {
      return res.status(400).json({
        success: false,
        error: 'Days parameter must be between 1 and 365'
      });
    }

    const performanceData = portfolioAnalyticsService.getPerformanceData(userId, days);

    return res.json({
      success: true,
      data: {
        performance: performanceData,
        period: `${days} days`
      }
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
 * Get symbol-wise performance
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
      data: {
        symbols: symbolPerformance,
        count: symbolPerformance.length
      }
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
 * Get portfolio summary (combined overview)
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

    // Get all portfolio data in one call for dashboard
    const [metrics, positions, tradingStats, performanceData] = await Promise.all([
      portfolioAnalyticsService.calculatePortfolioMetrics(userId),
      portfolioAnalyticsService.calculatePortfolioPositions(userId),
      portfolioAnalyticsService.calculateTradingStats(userId),
      portfolioAnalyticsService.getPerformanceData(userId, 7) // Last 7 days for quick overview
    ]);

    return res.json({
      success: true,
      data: {
        metrics,
        positions: positions.slice(0, 5), // Top 5 positions
        tradingStats,
        recentPerformance: performanceData,
        summary: {
          totalPositions: positions.length,
          portfolioValue: metrics.currentValue,
          totalPnL: metrics.totalPnL,
          dayPnL: metrics.dayPnL,
          successRate: metrics.successRate,
          winRate: tradingStats.winRate
        }
      }
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
 * Get portfolio analytics for a specific date range
 */
router.get('/analytics', authenticateToken, async (req: any, res: any) => {
  try {
    const userId = req.user?.id;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // For now, return basic analytics
    // In a full implementation, you'd filter by date range
    const metrics = await portfolioAnalyticsService.calculatePortfolioMetrics(userId);
    const tradingStats = await portfolioAnalyticsService.calculateTradingStats(userId);
    const symbolPerformance = await portfolioAnalyticsService.getSymbolPerformance(userId);

    return res.json({
      success: true,
      data: {
        period: {
          startDate: startDate || 'All time',
          endDate: endDate || new Date().toISOString().split('T')[0]
        },
        metrics,
        tradingStats,
        topPerformers: symbolPerformance.slice(0, 10),
        analytics: {
          riskMetrics: {
            maxDrawdown: tradingStats.maxDrawdown,
            sharpeRatio: tradingStats.sharpeRatio,
            volatility: tradingStats.sharpeRatio > 0 ? 1 / tradingStats.sharpeRatio : 0
          },
          diversification: {
            totalSymbols: symbolPerformance.length,
            concentrationRisk: symbolPerformance.length > 0 ?
              (symbolPerformance[0]?.volume || 0) / symbolPerformance.reduce((sum, s) => sum + s.volume, 0) * 100 : 0
          }
        }
      }
    });
  } catch (error: any) {
    console.error('Failed to get portfolio analytics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get portfolio analytics',
      details: error.message
    });
  }
});

export default router;
