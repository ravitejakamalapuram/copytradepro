import { Request, Response } from 'express';
import { getSymbolLifecycleService } from '../services/symbolLifecycleManager';

/**
 * Simple Symbol Lifecycle Controller
 * Just handles basic symbol cleanup and stats
 */
export class SymbolLifecycleController {
  
  /**
   * Get active symbols count
   * GET /api/symbols/stats
   */
  async getSymbolStats(req: Request, res: Response): Promise<void> {
    try {
      const lifecycleService = getSymbolLifecycleService();
      const stats = await lifecycleService.getActiveSymbolsCount();

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      console.error('🚨 Failed to get symbol stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve symbol statistics',
        details: error.message
      });
    }
  }

  /**
   * Get symbols expiring soon
   * GET /api/symbols/expiring-soon
   */
  async getSymbolsExpiringSoon(req: Request, res: Response): Promise<void> {
    try {
      const { days = '7' } = req.query;

      const lifecycleService = getSymbolLifecycleService();
      const symbols = await lifecycleService.getSymbolsExpiringSoon(parseInt(days as string));

      res.json({
        success: true,
        data: {
          symbols,
          total: symbols.length,
          expiringInDays: parseInt(days as string)
        }
      });
    } catch (error: any) {
      console.error('🚨 Failed to get symbols expiring soon:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve symbols expiring soon',
        details: error.message
      });
    }
  }

  /**
   * Clean up expired symbols
   * POST /api/symbols/cleanup-expired
   */
  async cleanupExpiredSymbols(req: Request, res: Response): Promise<void> {
    try {
      const lifecycleService = getSymbolLifecycleService();
      const deletedCount = await lifecycleService.cleanupExpiredSymbols();

      res.json({
        success: true,
        data: {
          deletedCount
        },
        message: `Successfully cleaned up ${deletedCount} expired symbols`
      });
    } catch (error: any) {
      console.error('🚨 Failed to cleanup expired symbols:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired symbols',
        details: error.message
      });
    }
  }
}

// Export singleton instance
export const symbolLifecycleController = new SymbolLifecycleController();