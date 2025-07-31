/**
 * Notification Routes
 * Routes for managing notifications and alerts
 */

import { Router } from 'express';
import {
  getNotificationConfig,
  sendTestNotification,
  addAlertChannel,
  updateAlertChannel,
  removeAlertChannel,
  addAlertRule,
  updateAlertRule,
  removeAlertRule,
  getNotificationStats
} from '../controllers/notificationController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route GET /api/notifications/config
 * @desc Get notification configuration and status
 * @access Private
 */
router.get('/config', getNotificationConfig);

/**
 * @route POST /api/notifications/test
 * @desc Send a test notification
 * @body severity - Notification severity: 'low', 'medium', 'high', 'critical' (default: 'medium')
 * @body type - Notification type (default: 'system_status')
 * @body message - Custom message (optional)
 * @access Private
 */
router.post('/test', sendTestNotification);

/**
 * @route GET /api/notifications/stats
 * @desc Get notification statistics
 * @query timeWindow - Time window in milliseconds (default: 86400000 = 24 hours)
 * @access Private
 */
router.get('/stats', getNotificationStats);

// Alert Channel Management

/**
 * @route POST /api/notifications/channels
 * @desc Add a new alert channel
 * @body id - Unique channel ID
 * @body name - Channel name
 * @body type - Channel type: 'email', 'webhook', 'slack', 'console'
 * @body config - Channel configuration object
 * @body enabled - Whether channel is enabled (default: true)
 * @body severityFilter - Array of severities to filter (default: ['medium', 'high', 'critical'])
 * @access Private
 */
router.post('/channels', addAlertChannel);

/**
 * @route PUT /api/notifications/channels/:channelId
 * @desc Update an alert channel
 * @param channelId - Channel ID to update
 * @body Updates to apply to the channel
 * @access Private
 */
router.put('/channels/:channelId', updateAlertChannel);

/**
 * @route DELETE /api/notifications/channels/:channelId
 * @desc Remove an alert channel
 * @param channelId - Channel ID to remove
 * @access Private
 */
router.delete('/channels/:channelId', removeAlertChannel);

// Alert Rule Management

/**
 * @route POST /api/notifications/rules
 * @desc Add a new alert rule
 * @body name - Rule name
 * @body description - Rule description
 * @body condition - Rule condition as JSON string
 * @body severity - Rule severity: 'low', 'medium', 'high', 'critical' (default: 'medium')
 * @body enabled - Whether rule is enabled (default: true)
 * @body cooldownPeriod - Cooldown period in milliseconds (default: 300000 = 5 minutes)
 * @body channels - Array of channel IDs to send to (default: ['console'])
 * @access Private
 */
router.post('/rules', addAlertRule);

/**
 * @route PUT /api/notifications/rules/:ruleId
 * @desc Update an alert rule
 * @param ruleId - Rule ID to update
 * @body Updates to apply to the rule
 * @access Private
 */
router.put('/rules/:ruleId', updateAlertRule);

/**
 * @route DELETE /api/notifications/rules/:ruleId
 * @desc Remove an alert rule
 * @param ruleId - Rule ID to remove
 * @access Private
 */
router.delete('/rules/:ruleId', removeAlertRule);

export default router;