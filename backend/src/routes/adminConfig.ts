import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { getSearchWeights, updateSearchWeights } from '../controllers/adminConfigController';

const router = Router();

// Secure admin endpoints
router.get('/search-weights', authenticateToken, requireAdmin, getSearchWeights);
router.post('/search-weights', authenticateToken, requireAdmin, updateSearchWeights);

export default router;

