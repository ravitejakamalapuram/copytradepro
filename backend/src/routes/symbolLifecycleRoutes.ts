import { Router } from 'express';
import { symbolLifecycleController } from '../controllers/symbolLifecycleController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Simple Symbol Lifecycle Routes
 * Basic symbol management and cleanup
 */

// Get symbol statistics
router.get('/symbols/stats', symbolLifecycleController.getSymbolStats.bind(symbolLifecycleController));

// Get symbols expiring soon
router.get('/symbols/expiring-soon', symbolLifecycleController.getSymbolsExpiringSoon.bind(symbolLifecycleController));

// Clean up expired symbols (admin only)
router.post('/symbols/cleanup-expired', symbolLifecycleController.cleanupExpiredSymbols.bind(symbolLifecycleController));

export default router;