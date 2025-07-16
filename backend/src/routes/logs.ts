import express from 'express';
import { logger } from '../utils/logger';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// POST /api/logs - Receive logs from frontend
router.post('/', authenticateToken, (req: AuthenticatedRequest, res): void => {
  try {
    const { logs } = req.body;
    
    if (!Array.isArray(logs)) {
      res.status(400).json({
        success: false,
        message: 'Logs must be an array'
      });
      return;
    }

    // Process each log entry
    logs.forEach((logEntry: any) => {
      const { level, message, context, data, error } = logEntry;
      
      // Add frontend prefix to distinguish from backend logs
      const frontendContext = {
        ...context,
        component: `FRONTEND_${context.component || 'UNKNOWN'}`,
        source: 'frontend'
      };

      // Log using the appropriate level
      switch (level) {
        case 'debug':
          logger.debug(`[Frontend] ${message}`, frontendContext, data);
          break;
        case 'info':
          logger.info(`[Frontend] ${message}`, frontendContext, data);
          break;
        case 'warn':
          logger.warn(`[Frontend] ${message}`, frontendContext, data);
          break;
        case 'error':
          logger.error(`[Frontend] ${message}`, frontendContext, error);
          break;
        case 'critical':
          logger.critical(`[Frontend] ${message}`, frontendContext, error);
          break;
        default:
          logger.info(`[Frontend] ${message}`, frontendContext, data);
      }
    });

    res.json({
      success: true,
      message: `Processed ${logs.length} log entries`,
      count: logs.length
    });

  } catch (error) {
    logger.error('Failed to process frontend logs', {
      component: 'LOGS_API',
      userId: req.user?.id
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to process logs'
    });
  }
});

export default router;