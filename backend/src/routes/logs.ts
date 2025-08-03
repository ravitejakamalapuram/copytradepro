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

    // Process each log entry with error handling to prevent infinite loops
    let processedCount = 0;
    logs.forEach((logEntry: any) => {
      try {
        const { level, message, context, data, error } = logEntry;
        
        // Add frontend prefix to distinguish from backend logs
        const frontendContext = {
          ...context,
          component: `FRONTEND_${context.component || 'UNKNOWN'}`,
          source: context.source || 'UI' // Preserve original source or default to UI for frontend
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
        processedCount++;
      } catch (logError) {
        // Don't log this error to prevent infinite loops
        // Just increment processed count to maintain response accuracy
        console.error('Failed to process individual log entry:', logError);
      }
    });

    res.json({
      success: true,
      message: `Processed ${processedCount} log entries`,
      count: processedCount
    });

  } catch (error) {
    // Don't use logger.error here to prevent infinite loops if logger itself fails
    console.error('Failed to process frontend logs:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to process logs'
    });
  }
});

export default router;