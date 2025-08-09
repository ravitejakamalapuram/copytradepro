import { Request, Response } from 'express';
import { realTimeErrorMonitoringService, ErrorThreshold } from '../services/realTimeErrorMonitoringService';
import { alertingService, AlertChannel, AlertRule } from '../services/alertingService';
import { logger } from '../utils/logger';
import { traceIdService } from '../services/traceIdService';

export class RealTimeMonitoringController {
  /**
   * Start real-time monitoring
   */
  async startMonitoring(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'START_MONITORING', 'REAL_TIME_MONITORING_CONTROLLER');

      const { intervalMs = 60000 } = req.body;

      // Validate interval
      if (intervalMs < 10000 || intervalMs > 300000) {
        res.status(400).json({
          success: false,
          message: 'Interval must be between 10 seconds and 5 minutes',
          traceId
        });
        return;
      }

      realTimeErrorMonitoringService.startMonitoring(intervalMs);

      traceIdService.completeOperation(traceId, 'START_MONITORING', 'SUCCESS', { intervalMs });

      res.json({
        success: true,
        message: 'Real-time monitoring started',
        data: {
          intervalMs,
          status: 'STARTED'
        },
        traceId
      });
    } catch (error) {
      logger.error('Error starting real-time monitoring:', error, { traceId });
      traceIdService.completeOperation(traceId, 'START_MONITORING', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to start real-time monitoring',
        traceId
      });
    }
  }

  /**
   * Stop real-time monitoring
   */
  async stopMonitoring(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'STOP_MONITORING', 'REAL_TIME_MONITORING_CONTROLLER');

      realTimeErrorMonitoringService.stopMonitoring();

      traceIdService.completeOperation(traceId, 'STOP_MONITORING', 'SUCCESS');

      res.json({
        success: true,
        message: 'Real-time monitoring stopped',
        data: {
          status: 'STOPPED'
        },
        traceId
      });
    } catch (error) {
      logger.error('Error stopping real-time monitoring:', error, { traceId });
      traceIdService.completeOperation(traceId, 'STOP_MONITORING', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to stop real-time monitoring',
        traceId
      });
    }
  }

  /**
   * Get current system health
   */
  async getSystemHealth(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_SYSTEM_HEALTH', 'REAL_TIME_MONITORING_CONTROLLER');

      const healthMetrics = await realTimeErrorMonitoringService.getCurrentSystemHealth();

      traceIdService.completeOperation(traceId, 'GET_SYSTEM_HEALTH', 'SUCCESS', {
        healthScore: healthMetrics.overallHealthScore,
        errorRate: healthMetrics.errorRate
      });

      res.json({
        success: true,
        data: healthMetrics,
        traceId
      });
    } catch (error) {
      logger.error('Error getting system health:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_SYSTEM_HEALTH', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get system health',
        traceId
      });
    }
  }

  /**
   * Get monitoring statistics
   */
  async getMonitoringStats(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_MONITORING_STATS', 'REAL_TIME_MONITORING_CONTROLLER');

      const stats = realTimeErrorMonitoringService.getMonitoringStats();

      traceIdService.completeOperation(traceId, 'GET_MONITORING_STATS', 'SUCCESS');

      res.json({
        success: true,
        data: stats,
        traceId
      });
    } catch (error) {
      logger.error('Error getting monitoring stats:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_MONITORING_STATS', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get monitoring stats',
        traceId
      });
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_ACTIVE_ALERTS', 'REAL_TIME_MONITORING_CONTROLLER');

      const alerts = realTimeErrorMonitoringService.getActiveAlerts();

      traceIdService.completeOperation(traceId, 'GET_ACTIVE_ALERTS', 'SUCCESS', {
        alertCount: alerts.length
      });

      res.json({
        success: true,
        data: alerts,
        traceId
      });
    } catch (error) {
      logger.error('Error getting active alerts:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_ACTIVE_ALERTS', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get active alerts',
        traceId
      });
    }
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'ACKNOWLEDGE_ALERT', 'REAL_TIME_MONITORING_CONTROLLER');

      const { alertId } = req.params;
      const { acknowledgedBy } = req.body;

      if (!alertId) {
        res.status(400).json({
          success: false,
          message: 'alertId is required',
          traceId
        });
        return;
      }

      if (!acknowledgedBy) {
        res.status(400).json({
          success: false,
          message: 'acknowledgedBy is required',
          traceId
        });
        return;
      }

      const acknowledged = realTimeErrorMonitoringService.acknowledgeAlert(alertId, acknowledgedBy);

      if (!acknowledged) {
        res.status(404).json({
          success: false,
          message: 'Alert not found or already acknowledged',
          traceId
        });
        return;
      }

      traceIdService.completeOperation(traceId, 'ACKNOWLEDGE_ALERT', 'SUCCESS', {
        alertId,
        acknowledgedBy
      });

      res.json({
        success: true,
        message: 'Alert acknowledged successfully',
        data: {
          alertId,
          acknowledgedBy,
          acknowledgedAt: new Date()
        },
        traceId
      });
    } catch (error) {
      logger.error('Error acknowledging alert:', error, { traceId });
      traceIdService.completeOperation(traceId, 'ACKNOWLEDGE_ALERT', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to acknowledge alert',
        traceId
      });
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'RESOLVE_ALERT', 'REAL_TIME_MONITORING_CONTROLLER');

      const { alertId } = req.params;
      const { resolvedBy } = req.body;

      if (!alertId) {
        res.status(400).json({
          success: false,
          message: 'alertId is required',
          traceId
        });
        return;
      }

      if (!resolvedBy) {
        res.status(400).json({
          success: false,
          message: 'resolvedBy is required',
          traceId
        });
        return;
      }

      const resolved = realTimeErrorMonitoringService.resolveAlert(alertId, resolvedBy);

      if (!resolved) {
        res.status(404).json({
          success: false,
          message: 'Alert not found or already resolved',
          traceId
        });
        return;
      }

      traceIdService.completeOperation(traceId, 'RESOLVE_ALERT', 'SUCCESS', {
        alertId,
        resolvedBy
      });

      res.json({
        success: true,
        message: 'Alert resolved successfully',
        data: {
          alertId,
          resolvedBy,
          resolvedAt: new Date()
        },
        traceId
      });
    } catch (error) {
      logger.error('Error resolving alert:', error, { traceId });
      traceIdService.completeOperation(traceId, 'RESOLVE_ALERT', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to resolve alert',
        traceId
      });
    }
  }

  /**
   * Get error thresholds
   */
  async getThresholds(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_THRESHOLDS', 'REAL_TIME_MONITORING_CONTROLLER');

      const thresholds = realTimeErrorMonitoringService.getThresholds();

      traceIdService.completeOperation(traceId, 'GET_THRESHOLDS', 'SUCCESS', {
        thresholdCount: thresholds.length
      });

      res.json({
        success: true,
        data: thresholds,
        traceId
      });
    } catch (error) {
      logger.error('Error getting thresholds:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_THRESHOLDS', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get thresholds',
        traceId
      });
    }
  }

  /**
   * Set error threshold
   */
  async setThreshold(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'SET_THRESHOLD', 'REAL_TIME_MONITORING_CONTROLLER');

      const threshold: ErrorThreshold = req.body;

      // Validate threshold
      if (!threshold.id || !threshold.name || !threshold.condition) {
        res.status(400).json({
          success: false,
          message: 'Invalid threshold configuration',
          traceId
        });
        return;
      }

      realTimeErrorMonitoringService.setThreshold(threshold);

      traceIdService.completeOperation(traceId, 'SET_THRESHOLD', 'SUCCESS', {
        thresholdId: threshold.id,
        thresholdName: threshold.name
      });

      res.json({
        success: true,
        message: 'Threshold configured successfully',
        data: threshold,
        traceId
      });
    } catch (error) {
      logger.error('Error setting threshold:', error, { traceId });
      traceIdService.completeOperation(traceId, 'SET_THRESHOLD', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to set threshold',
        traceId
      });
    }
  }

  /**
   * Remove error threshold
   */
  async removeThreshold(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'REMOVE_THRESHOLD', 'REAL_TIME_MONITORING_CONTROLLER');

      const { thresholdId } = req.params;

      if (!thresholdId) {
        res.status(400).json({
          success: false,
          message: 'thresholdId is required',
          traceId
        });
        return;
      }

      const removed = realTimeErrorMonitoringService.removeThreshold(thresholdId);

      if (!removed) {
        res.status(404).json({
          success: false,
          message: 'Threshold not found',
          traceId
        });
        return;
      }

      traceIdService.completeOperation(traceId, 'REMOVE_THRESHOLD', 'SUCCESS', {
        thresholdId
      });

      res.json({
        success: true,
        message: 'Threshold removed successfully',
        data: {
          thresholdId
        },
        traceId
      });
    } catch (error) {
      logger.error('Error removing threshold:', error, { traceId });
      traceIdService.completeOperation(traceId, 'REMOVE_THRESHOLD', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to remove threshold',
        traceId
      });
    }
  }

  /**
   * Get alert channels
   */
  async getAlertChannels(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_ALERT_CHANNELS', 'REAL_TIME_MONITORING_CONTROLLER');

      const channels = alertingService.getChannels();

      traceIdService.completeOperation(traceId, 'GET_ALERT_CHANNELS', 'SUCCESS', {
        channelCount: channels.length
      });

      res.json({
        success: true,
        data: channels,
        traceId
      });
    } catch (error) {
      logger.error('Error getting alert channels:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_ALERT_CHANNELS', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get alert channels',
        traceId
      });
    }
  }

  /**
   * Set alert channel
   */
  async setAlertChannel(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'SET_ALERT_CHANNEL', 'REAL_TIME_MONITORING_CONTROLLER');

      const channel: AlertChannel = req.body;

      // Validate channel
      if (!channel.id || !channel.name || !channel.type) {
        res.status(400).json({
          success: false,
          message: 'Invalid channel configuration',
          traceId
        });
        return;
      }

      alertingService.setChannel(channel);

      traceIdService.completeOperation(traceId, 'SET_ALERT_CHANNEL', 'SUCCESS', {
        channelId: channel.id,
        channelType: channel.type
      });

      res.json({
        success: true,
        message: 'Alert channel configured successfully',
        data: channel,
        traceId
      });
    } catch (error) {
      logger.error('Error setting alert channel:', error, { traceId });
      traceIdService.completeOperation(traceId, 'SET_ALERT_CHANNEL', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to set alert channel',
        traceId
      });
    }
  }

  /**
   * Test alert channel
   */
  async testAlertChannel(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'TEST_ALERT_CHANNEL', 'REAL_TIME_MONITORING_CONTROLLER');

      const { channelId } = req.params;

      if (!channelId) {
        res.status(400).json({
          success: false,
          message: 'channelId is required',
          traceId
        });
        return;
      }

      const result = await alertingService.testChannel(channelId);

      traceIdService.completeOperation(traceId, 'TEST_ALERT_CHANNEL', 'SUCCESS', {
        channelId,
        success: result.success
      });

      res.json({
        success: true,
        message: 'Channel test completed',
        data: result,
        traceId
      });
    } catch (error) {
      logger.error('Error testing alert channel:', error, { traceId });
      traceIdService.completeOperation(traceId, 'TEST_ALERT_CHANNEL', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to test alert channel',
        traceId
      });
    }
  }

  /**
   * Get alert rules
   */
  async getAlertRules(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_ALERT_RULES', 'REAL_TIME_MONITORING_CONTROLLER');

      const rules = alertingService.getRules();

      traceIdService.completeOperation(traceId, 'GET_ALERT_RULES', 'SUCCESS', {
        ruleCount: rules.length
      });

      res.json({
        success: true,
        data: rules,
        traceId
      });
    } catch (error) {
      logger.error('Error getting alert rules:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_ALERT_RULES', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get alert rules',
        traceId
      });
    }
  }

  /**
   * Set alert rule
   */
  async setAlertRule(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'SET_ALERT_RULE', 'REAL_TIME_MONITORING_CONTROLLER');

      const rule: AlertRule = req.body;

      // Validate rule
      if (!rule.id || !rule.name || !rule.channels || rule.channels.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Invalid rule configuration',
          traceId
        });
        return;
      }

      alertingService.setRule(rule);

      traceIdService.completeOperation(traceId, 'SET_ALERT_RULE', 'SUCCESS', {
        ruleId: rule.id,
        ruleName: rule.name
      });

      res.json({
        success: true,
        message: 'Alert rule configured successfully',
        data: rule,
        traceId
      });
    } catch (error) {
      logger.error('Error setting alert rule:', error, { traceId });
      traceIdService.completeOperation(traceId, 'SET_ALERT_RULE', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to set alert rule',
        traceId
      });
    }
  }
}

export const realTimeMonitoringController = new RealTimeMonitoringController();