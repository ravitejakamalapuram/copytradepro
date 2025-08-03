import { Router } from 'express';
import { realTimeMonitoringController } from '../controllers/realTimeMonitoringController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Monitoring control routes
router.post('/start', realTimeMonitoringController.startMonitoring.bind(realTimeMonitoringController));
router.post('/stop', realTimeMonitoringController.stopMonitoring.bind(realTimeMonitoringController));
router.get('/stats', realTimeMonitoringController.getMonitoringStats.bind(realTimeMonitoringController));

// System health routes
router.get('/health', realTimeMonitoringController.getSystemHealth.bind(realTimeMonitoringController));

// Alert management routes
router.get('/alerts', realTimeMonitoringController.getActiveAlerts.bind(realTimeMonitoringController));
router.post('/alerts/:alertId/acknowledge', realTimeMonitoringController.acknowledgeAlert.bind(realTimeMonitoringController));
router.post('/alerts/:alertId/resolve', realTimeMonitoringController.resolveAlert.bind(realTimeMonitoringController));

// Threshold management routes
router.get('/thresholds', realTimeMonitoringController.getThresholds.bind(realTimeMonitoringController));
router.post('/thresholds', realTimeMonitoringController.setThreshold.bind(realTimeMonitoringController));
router.delete('/thresholds/:thresholdId', realTimeMonitoringController.removeThreshold.bind(realTimeMonitoringController));

// Alert channel management routes
router.get('/channels', realTimeMonitoringController.getAlertChannels.bind(realTimeMonitoringController));
router.post('/channels', realTimeMonitoringController.setAlertChannel.bind(realTimeMonitoringController));
router.post('/channels/:channelId/test', realTimeMonitoringController.testAlertChannel.bind(realTimeMonitoringController));

// Alert rule management routes
router.get('/rules', realTimeMonitoringController.getAlertRules.bind(realTimeMonitoringController));
router.post('/rules', realTimeMonitoringController.setAlertRule.bind(realTimeMonitoringController));

export default router;