/**
 * Symbol Monitoring Service Tests
 * Tests for symbol monitoring and alerting functionality
 */

import { symbolMonitoringService } from '../services/symbolMonitoringService';
import { symbolAlertingService } from '../services/symbolAlertingService';

describe('Symbol Monitoring Service', () => {
  beforeAll(() => {
    // Start monitoring service for tests
    symbolMonitoringService.start();
  });

  afterAll(() => {
    // Stop monitoring service after tests
    symbolMonitoringService.stop();
  });

  describe('Update Metrics Recording', () => {
    it('should record symbol update metrics', () => {
      const metrics = {
        source: 'upstox',
        totalProcessed: 1000,
        successCount: 950,
        failureCount: 50,
        duration: 5000,
        newSymbols: 100,
        updatedSymbols: 850,
        validationErrors: 25
      };

      expect(() => {
        symbolMonitoringService.recordUpdateMetrics(metrics);
      }).not.toThrow();
    });

    it('should calculate error rate correctly', () => {
      const metrics = {
        source: 'upstox',
        totalProcessed: 100,
        successCount: 90,
        failureCount: 10,
        duration: 1000,
        newSymbols: 5,
        updatedSymbols: 85,
        validationErrors: 5
      };

      symbolMonitoringService.recordUpdateMetrics(metrics);
      
      // Error rate should be 10%
      const dashboardData = symbolMonitoringService.getDashboardData();
      const recentMetric = dashboardData.recentMetrics.updates[dashboardData.recentMetrics.updates.length - 1];
      
      expect(recentMetric).toBeDefined();
      expect(recentMetric?.errorRate).toBe(10);
    });
  });

  describe('Search Metrics Recording', () => {
    it('should record search performance metrics', () => {
      const metrics = {
        operation: 'search' as const,
        query: 'NIFTY',
        resultCount: 25,
        duration: 150,
        cacheHit: true,
        success: true
      };

      expect(() => {
        symbolMonitoringService.recordSearchMetrics(metrics);
      }).not.toThrow();
    });

    it('should record failed search metrics', () => {
      const metrics = {
        operation: 'getById' as const,
        query: 'invalid_id',
        resultCount: 0,
        duration: 50,
        cacheHit: false,
        success: false,
        errorMessage: 'Symbol not found'
      };

      expect(() => {
        symbolMonitoringService.recordSearchMetrics(metrics);
      }).not.toThrow();
    });
  });

  describe('Database Metrics Recording', () => {
    it('should record database performance metrics', () => {
      const metrics = {
        operation: 'searchSymbols',
        collection: 'standardizedsymbols',
        duration: 200,
        queryType: 'find' as const,
        indexUsed: true,
        documentsExamined: 100,
        documentsReturned: 25,
        success: true
      };

      expect(() => {
        symbolMonitoringService.recordDatabaseMetrics(metrics);
      }).not.toThrow();
    });
  });

  describe('Alert Creation', () => {
    it('should create alert for high error rate', () => {
      const highErrorMetrics = {
        source: 'upstox',
        totalProcessed: 100,
        successCount: 80,
        failureCount: 20,
        duration: 1000,
        newSymbols: 0,
        updatedSymbols: 80,
        validationErrors: 10
      };

      symbolMonitoringService.recordUpdateMetrics(highErrorMetrics);
      
      const dashboardData = symbolMonitoringService.getDashboardData();
      
      // Should have created an alert for high error rate (20%)
      expect(dashboardData.activeAlerts.length).toBeGreaterThan(0);
      
      const errorRateAlert = dashboardData.activeAlerts.find(
        alert => alert.type === 'update_failure'
      );
      
      expect(errorRateAlert).toBeDefined();
      expect(errorRateAlert?.severity).toBe('high');
    });

    it('should create alert for slow search performance', () => {
      const slowSearchMetrics = {
        operation: 'search' as const,
        query: 'complex_query',
        resultCount: 100,
        duration: 2000, // 2 seconds - very slow
        cacheHit: false,
        success: true
      };

      symbolMonitoringService.recordSearchMetrics(slowSearchMetrics);
      
      const dashboardData = symbolMonitoringService.getDashboardData();
      
      const performanceAlert = dashboardData.activeAlerts.find(
        alert => alert.type === 'performance_degradation'
      );
      
      expect(performanceAlert).toBeDefined();
    });
  });

  describe('Dashboard Data', () => {
    it('should provide comprehensive dashboard data', () => {
      const dashboardData = symbolMonitoringService.getDashboardData();
      
      expect(dashboardData).toHaveProperty('summary');
      expect(dashboardData).toHaveProperty('recentMetrics');
      expect(dashboardData).toHaveProperty('activeAlerts');
      expect(dashboardData).toHaveProperty('healthStatus');
      
      expect(dashboardData.summary).toHaveProperty('avgSearchTime');
      expect(dashboardData.summary).toHaveProperty('avgCacheHitRate');
      expect(dashboardData.summary).toHaveProperty('avgUpdateErrorRate');
      
      expect(dashboardData.recentMetrics).toHaveProperty('updates');
      expect(dashboardData.recentMetrics).toHaveProperty('searches');
      expect(dashboardData.recentMetrics).toHaveProperty('cache');
      
      expect(dashboardData.healthStatus).toHaveProperty('status');
      expect(dashboardData.healthStatus).toHaveProperty('summary');
      expect(dashboardData.healthStatus).toHaveProperty('issues');
    });
  });

  describe('Performance Statistics', () => {
    it('should calculate performance statistics correctly', () => {
      // Record some test metrics
      symbolMonitoringService.recordSearchMetrics({
        operation: 'search',
        query: 'test1',
        resultCount: 10,
        duration: 100,
        cacheHit: true,
        success: true
      });

      symbolMonitoringService.recordSearchMetrics({
        operation: 'search',
        query: 'test2',
        resultCount: 5,
        duration: 200,
        cacheHit: false,
        success: true
      });

      const stats = symbolMonitoringService.getPerformanceStats(3600000); // 1 hour
      
      expect(stats).toHaveProperty('searchPerformance');
      expect(stats).toHaveProperty('updatePerformance');
      expect(stats).toHaveProperty('cachePerformance');
      
      expect(stats.searchPerformance.averageTime).toBeGreaterThan(0);
      expect(stats.searchPerformance.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.searchPerformance.cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Alert Resolution', () => {
    it('should resolve alerts correctly', () => {
      // Create an alert first
      const highErrorMetrics = {
        source: 'test',
        totalProcessed: 100,
        successCount: 70,
        failureCount: 30,
        duration: 1000,
        newSymbols: 0,
        updatedSymbols: 70,
        validationErrors: 15
      };

      symbolMonitoringService.recordUpdateMetrics(highErrorMetrics);
      
      const dashboardData = symbolMonitoringService.getDashboardData();
      const alert = dashboardData.activeAlerts.find(a => !a.resolved);
      
      if (alert) {
        const resolved = symbolMonitoringService.resolveAlert(alert.id);
        expect(resolved).toBe(true);
        
        // Check that alert is now resolved
        const updatedDashboard = symbolMonitoringService.getDashboardData();
        const resolvedAlert = updatedDashboard.activeAlerts.find(a => a.id === alert.id);
        expect(resolvedAlert?.resolved).toBe(true);
      }
    });
  });
});

describe('Symbol Alerting Service', () => {
  describe('Channel Management', () => {
    it('should add and manage alert channels', () => {
      const testChannel = {
        id: 'test-channel',
        name: 'Test Channel',
        type: 'webhook',
        config: {
          url: 'https://example.com/webhook',
          method: 'POST'
        },
        enabled: true,
        severityFilter: ['high', 'critical']
      };

      symbolAlertingService.addChannel(testChannel);
      
      const channels = symbolAlertingService.getChannels();
      const addedChannel = channels.find(c => c.id === 'test-channel');
      
      expect(addedChannel).toBeDefined();
      expect(addedChannel?.name).toBe('Test Channel');
      expect(addedChannel?.type).toBe('webhook');
    });

    it('should update alert channels', () => {
      const updated = symbolAlertingService.updateChannel('test-channel', {
        enabled: false,
        name: 'Updated Test Channel'
      });

      expect(updated).toBe(true);
      
      const channels = symbolAlertingService.getChannels();
      const updatedChannel = channels.find(c => c.id === 'test-channel');
      
      expect(updatedChannel?.enabled).toBe(false);
      expect(updatedChannel?.name).toBe('Updated Test Channel');
    });

    it('should remove alert channels', () => {
      const removed = symbolAlertingService.removeChannel('test-channel');
      expect(removed).toBe(true);
      
      const channels = symbolAlertingService.getChannels();
      const removedChannel = channels.find(c => c.id === 'test-channel');
      
      expect(removedChannel).toBeUndefined();
    });
  });

  describe('Alert Rules Management', () => {
    it('should add custom alert rules', () => {
      const customRule = {
        name: 'Custom Test Rule',
        description: 'Test rule for unit tests',
        condition: JSON.stringify({
          type: 'data_quality',
          validationErrorThreshold: 5
        }),
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 300000,
        channels: ['console']
      };

      const ruleId = symbolAlertingService.addAlertRule(customRule);
      
      expect(ruleId).toBeDefined();
      expect(typeof ruleId).toBe('string');
      
      const rules = symbolAlertingService.getAlertRules();
      const addedRule = rules.find(r => r.id === ruleId);
      
      expect(addedRule).toBeDefined();
      expect(addedRule?.name).toBe('Custom Test Rule');
    });

    it('should update alert rules', () => {
      const rules = symbolAlertingService.getAlertRules();
      const testRule = rules.find(r => r.name === 'Custom Test Rule');
      
      if (testRule) {
        const updated = symbolAlertingService.updateAlertRule(testRule.id, {
          enabled: false,
          severity: 'high'
        });

        expect(updated).toBe(true);
        
        const updatedRules = symbolAlertingService.getAlertRules();
        const updatedRule = updatedRules.find(r => r.id === testRule.id);
        
        expect(updatedRule?.enabled).toBe(false);
        expect(updatedRule?.severity).toBe('high');
      }
    });
  });

  describe('Notification Statistics', () => {
    it('should provide notification statistics', () => {
      const stats = symbolAlertingService.getNotificationStats();
      
      expect(stats).toHaveProperty('totalSent');
      expect(stats).toHaveProperty('totalFailed');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('channelStats');
      
      expect(typeof stats.totalSent).toBe('number');
      expect(typeof stats.totalFailed).toBe('number');
      expect(typeof stats.successRate).toBe('number');
      expect(typeof stats.channelStats).toBe('object');
    });
  });
});

describe('Integration Tests', () => {
  it('should integrate monitoring and alerting services', async () => {
    // Record metrics that should trigger an alert
    const criticalMetrics = {
      source: 'integration_test',
      totalProcessed: 100,
      successCount: 50,
      failureCount: 50,
      duration: 10000,
      newSymbols: 0,
      updatedSymbols: 50,
      validationErrors: 25
    };

    symbolMonitoringService.recordUpdateMetrics(criticalMetrics);
    
    // Wait a bit for alert processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const dashboardData = symbolMonitoringService.getDashboardData();
    
    // Should have created a critical alert
    const criticalAlert = dashboardData.activeAlerts.find(
      alert => alert.severity === 'critical' && alert.type === 'update_failure'
    );
    
    expect(criticalAlert).toBeDefined();
    
    if (criticalAlert) {
      // Test alert sending (console channel should always work)
      await expect(symbolAlertingService.sendAlert(criticalAlert)).resolves.not.toThrow();
    }
  });
});