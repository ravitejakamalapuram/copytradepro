import { Router } from 'express';
import { errorResolutionController } from '../controllers/errorResolutionController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Task management routes
router.post('/tasks', errorResolutionController.createTask.bind(errorResolutionController));
router.get('/tasks/search', errorResolutionController.searchTasks.bind(errorResolutionController));
router.get('/tasks/dashboard', errorResolutionController.getDashboardData.bind(errorResolutionController));
router.get('/tasks/:taskId', errorResolutionController.getTask.bind(errorResolutionController));
router.put('/tasks/:taskId/status', errorResolutionController.updateTaskStatus.bind(errorResolutionController));
router.put('/tasks/:taskId/assign', errorResolutionController.assignTask.bind(errorResolutionController));
router.post('/tasks/:taskId/comments', errorResolutionController.addComment.bind(errorResolutionController));

// Analytics routes
router.get('/analytics', errorResolutionController.getResolutionAnalytics.bind(errorResolutionController));

// Assignment rule management routes
router.get('/assignment-rules', errorResolutionController.getAssignmentRules.bind(errorResolutionController));
router.post('/assignment-rules', errorResolutionController.setAssignmentRule.bind(errorResolutionController));
router.delete('/assignment-rules/:ruleId', errorResolutionController.removeAssignmentRule.bind(errorResolutionController));

export default router;