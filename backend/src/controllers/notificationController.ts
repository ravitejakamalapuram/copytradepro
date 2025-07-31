/**
 * Notification Controller
 * Handles notification management and testing endpoints
 */

import { Request, Response } from 'express';
import { notificationService } from '../services/notificationService';
import { symbolAlertingService } from '../services/symbolAlertingService';
import { logger } from '../utils/logger';

/**
 * Get notification configuration status
 */
export const getNotificationConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const configStatus = notificationService.getConfigurationStatus();
    const alertChannels = symbolAlertingService.getChannels();
    const alertRules = symbolAlertingService.getAlertRules();
    const notificationStats = symbolAlertingService.getNotificationStats();

    res.json({
      success: true,
      data: {
        configuration: configStatus,
        channels: alertChannels.map(channel => ({
          id: channel.id,
          name: channel.name,
          type: channel.type,
          enabled: channel.enabled,
          severityFilter: channel.severityFilter
        })),
        rules: alertRules.map(rule => ({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          severity: rule.severity,
          enabled: rule.enabled,
          cooldownPeriod: rule.cooldownPeriod,
          channels: rule.channels
        })),
        statistics: notificationStats
      },
      timestamp: new Date().toISOString()
    });

    logger.debug('Notification configuration retrieved', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'GET_CONFIG'
    });

  } catch (error) {
    logger.error('Failed to get notification configuration', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'GET_CONFIG_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Send a test notification
 */
export const sendTestNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { severity = 'medium', type = 'system_status', message } = req.body;

    // Validate severity
    if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
      res.status(400).json({
        success: false,
        error: 'Invalid severity level',
        validSeverities: ['low', 'medium', 'high', 'critical']
      });
      return;
    }

    // Send test notification
    await notificationService.sendTestNotification(severity);

    logger.info('Test notification sent', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'SEND_TEST'
    }, {
      severity,
      type,
      customMessage: !!message
    });

    res.json({
      success: true,
      message: 'Test notification sent successfully',
      data: {
        severity,
        type,
        sentAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to send test notification', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'SEND_TEST_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to send test notification',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Add a new alert channel
 */
export const addAlertChannel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name, type, config, enabled = true, severityFilter = ['medium', 'high', 'critical'] } = req.body;

    // Validate required fields
    if (!id || !name || !type || !config) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['id', 'name', 'type', 'config']
      });
      return;
    }

    // Validate type
    if (!['email', 'webhook', 'slack', 'console'].includes(type)) {
      res.status(400).json({
        success: false,
        error: 'Invalid channel type',
        validTypes: ['email', 'webhook', 'slack', 'console']
      });
      return;
    }

    const channel = {
      id,
      name,
      type,
      config,
      enabled,
      severityFilter
    };

    symbolAlertingService.addChannel(channel);

    logger.info('Alert channel added', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'ADD_CHANNEL'
    }, {
      channelId: id,
      channelName: name,
      channelType: type
    });

    res.json({
      success: true,
      message: 'Alert channel added successfully',
      data: {
        channelId: id,
        channelName: name,
        channelType: type,
        enabled
      }
    });

  } catch (error) {
    logger.error('Failed to add alert channel', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'ADD_CHANNEL_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to add alert channel',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update an alert channel
 */
export const updateAlertChannel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params;
    const updates = req.body;

    if (!channelId) {
      res.status(400).json({
        success: false,
        error: 'Channel ID is required'
      });
      return;
    }

    const updated = symbolAlertingService.updateChannel(channelId, updates);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Alert channel not found',
        channelId
      });
      return;
    }

    logger.info('Alert channel updated', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'UPDATE_CHANNEL'
    }, {
      channelId,
      updates
    });

    res.json({
      success: true,
      message: 'Alert channel updated successfully',
      data: {
        channelId,
        updates
      }
    });

  } catch (error) {
    logger.error('Failed to update alert channel', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'UPDATE_CHANNEL_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to update alert channel',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Remove an alert channel
 */
export const removeAlertChannel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelId } = req.params;

    if (!channelId) {
      res.status(400).json({
        success: false,
        error: 'Channel ID is required'
      });
      return;
    }

    const removed = symbolAlertingService.removeChannel(channelId);

    if (!removed) {
      res.status(404).json({
        success: false,
        error: 'Alert channel not found',
        channelId
      });
      return;
    }

    logger.info('Alert channel removed', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'REMOVE_CHANNEL'
    }, { channelId });

    res.json({
      success: true,
      message: 'Alert channel removed successfully',
      data: { channelId }
    });

  } catch (error) {
    logger.error('Failed to remove alert channel', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'REMOVE_CHANNEL_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to remove alert channel',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Add a new alert rule
 */
export const addAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, condition, severity = 'medium', enabled = true, cooldownPeriod = 300000, channels = ['console'] } = req.body;

    // Validate required fields
    if (!name || !description || !condition) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['name', 'description', 'condition']
      });
      return;
    }

    // Validate severity
    if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
      res.status(400).json({
        success: false,
        error: 'Invalid severity level',
        validSeverities: ['low', 'medium', 'high', 'critical']
      });
      return;
    }

    // Validate condition is valid JSON
    try {
      JSON.parse(condition);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Invalid condition format',
        message: 'Condition must be valid JSON'
      });
      return;
    }

    const rule = {
      name,
      description,
      condition,
      severity,
      enabled,
      cooldownPeriod,
      channels
    };

    const ruleId = symbolAlertingService.addAlertRule(rule);

    logger.info('Alert rule added', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'ADD_RULE'
    }, {
      ruleId,
      ruleName: name,
      severity
    });

    res.json({
      success: true,
      message: 'Alert rule added successfully',
      data: {
        ruleId,
        ruleName: name,
        severity,
        enabled
      }
    });

  } catch (error) {
    logger.error('Failed to add alert rule', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'ADD_RULE_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to add alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Update an alert rule
 */
export const updateAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;

    if (!ruleId) {
      res.status(400).json({
        success: false,
        error: 'Rule ID is required'
      });
      return;
    }

    // Validate condition if provided
    if (updates.condition) {
      try {
        JSON.parse(updates.condition);
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid condition format',
          message: 'Condition must be valid JSON'
        });
        return;
      }
    }

    // Validate severity if provided
    if (updates.severity && !['low', 'medium', 'high', 'critical'].includes(updates.severity)) {
      res.status(400).json({
        success: false,
        error: 'Invalid severity level',
        validSeverities: ['low', 'medium', 'high', 'critical']
      });
      return;
    }

    const updated = symbolAlertingService.updateAlertRule(ruleId, updates);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: 'Alert rule not found',
        ruleId
      });
      return;
    }

    logger.info('Alert rule updated', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'UPDATE_RULE'
    }, {
      ruleId,
      updates
    });

    res.json({
      success: true,
      message: 'Alert rule updated successfully',
      data: {
        ruleId,
        updates
      }
    });

  } catch (error) {
    logger.error('Failed to update alert rule', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'UPDATE_RULE_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to update alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Remove an alert rule
 */
export const removeAlertRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ruleId } = req.params;

    if (!ruleId) {
      res.status(400).json({
        success: false,
        error: 'Rule ID is required'
      });
      return;
    }

    const removed = symbolAlertingService.removeAlertRule(ruleId);

    if (!removed) {
      res.status(404).json({
        success: false,
        error: 'Alert rule not found',
        ruleId
      });
      return;
    }

    logger.info('Alert rule removed', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'REMOVE_RULE'
    }, { ruleId });

    res.json({
      success: true,
      message: 'Alert rule removed successfully',
      data: { ruleId }
    });

  } catch (error) {
    logger.error('Failed to remove alert rule', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'REMOVE_RULE_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to remove alert rule',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Get notification statistics
 */
export const getNotificationStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 86400000; // Default 24 hours
    
    const stats = symbolAlertingService.getNotificationStats(timeWindow);

    res.json({
      success: true,
      data: {
        timeWindow,
        statistics: stats,
        timestamp: new Date().toISOString()
      }
    });

    logger.debug('Notification statistics retrieved', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'GET_STATS'
    }, { timeWindow });

  } catch (error) {
    logger.error('Failed to get notification statistics', {
      component: 'NOTIFICATION_CONTROLLER',
      operation: 'GET_STATS_ERROR'
    }, error);

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};