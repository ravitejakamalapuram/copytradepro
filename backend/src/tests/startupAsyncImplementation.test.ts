/**
 * Test for Asynchronous Startup Implementation
 * Verifies that the server starts asynchronously and handles symbol data initialization properly
 */

import { startupStatusService } from '../services/startupStatusService';
import { startupSymbolInitializationService } from '../services/startupSymbolInitializationService';
import { startupMonitoringService } from '../services/startupMonitoringService';

describe('Asynchronous Startup Implementation', () => {
  beforeEach(() => {
    // Reset services before each test
    jest.clearAllMocks();
  });

  describe('StartupStatusService', () => {
    test('should initialize with correct default state', () => {
      const status = startupStatusService.getStatus();
      
      expect(status.serverReady).toBe(false);
      expect(status.symbolDataReady).toBe(false);
      expect(status.startupPhase).toBe('STARTING');
    });

    test('should update status when server becomes ready', () => {
      startupStatusService.markServerReady();
      const status = startupStatusService.getStatus();
      
      expect(status.serverReady).toBe(true);
      expect(status.startupPhase).toBe('SERVER_READY');
      expect(status.serverStartedAt).toBeInstanceOf(Date);
    });

    test('should update status when symbol initialization starts', () => {
      startupStatusService.markSymbolInitStarted();
      const status = startupStatusService.getStatus();
      
      expect(status.startupPhase).toBe('SYMBOL_INIT_IN_PROGRESS');
      expect(status.symbolInitStartedAt).toBeInstanceOf(Date);
    });

    test('should update status when symbol initialization completes', () => {
      startupStatusService.markSymbolInitCompleted();
      const status = startupStatusService.getStatus();
      
      expect(status.symbolDataReady).toBe(true);
      expect(status.startupPhase).toBe('FULLY_READY');
      expect(status.symbolInitCompletedAt).toBeInstanceOf(Date);
    });

    test('should provide graceful response when symbol data not ready', () => {
      const response = startupStatusService.getSymbolDataNotReadyResponse();
      
      expect(response.success).toBe(false);
      expect(response.error).toBe('SYMBOL_DATA_NOT_READY');
      expect(response.message).toContain('Symbol data is still being initialized');
      expect(response.retryAfter).toBe(30);
    });

    test('should calculate startup metrics correctly', () => {
      startupStatusService.markServerReady();
      startupStatusService.markSymbolInitStarted();
      startupStatusService.markSymbolInitCompleted();
      
      const metrics = startupStatusService.getStartupMetrics();
      
      expect(metrics.phase).toBe('FULLY_READY');
      expect(metrics.serverReady).toBe(true);
      expect(metrics.symbolDataReady).toBe(true);
      expect(metrics.fullyReady).toBe(true);
    });
  });

  describe('StartupSymbolInitializationService', () => {
    test('should initialize with correct default state', () => {
      const status = startupSymbolInitializationService.getStatus();
      
      expect(status.status).toBe('PENDING');
      expect(status.progress).toBe(0);
      expect(status.currentStep).toBe('Waiting to start');
    });

    test('should track initialization steps', () => {
      const steps = startupSymbolInitializationService.getSteps();
      
      expect(steps).toHaveLength(4);
      expect(steps[0]?.name).toBe('clear_data');
      expect(steps[1]?.name).toBe('download_process');
      expect(steps[2]?.name).toBe('validate');
      expect(steps[3]?.name).toBe('complete');
      
      steps.forEach(step => {
        expect(step.status).toBe('PENDING');
        expect(step.retryCount).toBe(0);
      });
    });

    test('should provide detailed initialization statistics', () => {
      const stats = startupSymbolInitializationService.getInitializationStats();
      
      expect(stats.service).toBe('Startup Symbol Initialization');
      expect(stats.status).toBe('PENDING');
      expect(stats.progress).toBe(0);
      expect(stats.stepMetrics).toBeDefined();
      expect(stats.performance).toBeDefined();
    });

    test('should calculate step metrics correctly', () => {
      const steps = startupSymbolInitializationService.getSteps();
      const stepMetrics = startupSymbolInitializationService['getStepMetrics']();
      
      expect(stepMetrics.totalSteps).toBe(steps.length);
      expect(stepMetrics.completedSteps).toBe(0);
      expect(stepMetrics.failedSteps).toBe(0);
      expect(stepMetrics.totalRetries).toBe(0);
    });
  });

  describe('StartupMonitoringService', () => {
    test('should initialize with correct default state', () => {
      const status = startupMonitoringService.getMonitoringStatus();
      
      expect(status.isMonitoring).toBe(false);
      expect(status.metricsCollected).toBeGreaterThanOrEqual(0);
      expect(status.alertsGenerated).toBe(0);
    });

    test('should start monitoring correctly', () => {
      startupMonitoringService.startMonitoring();
      const status = startupMonitoringService.getMonitoringStatus();
      
      expect(status.isMonitoring).toBe(true);
      expect(status.metricsCollected).toBeGreaterThan(0);
      
      // Clean up
      startupMonitoringService.stopMonitoring();
    });

    test('should collect metrics when monitoring', () => {
      startupMonitoringService.startMonitoring();
      const metrics = startupMonitoringService.getMetrics();
      
      expect(metrics.memoryUsageAtStart).toBeDefined();
      expect(metrics.cpuUsageAtStart).toBeDefined();
      expect(metrics.retryCount).toBe(0);
      expect(metrics.errorCount).toBe(0);
      
      // Clean up
      startupMonitoringService.stopMonitoring();
    });

    test('should generate startup report', () => {
      const report = startupMonitoringService.generateStartupReport();
      
      expect(report.summary).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.symbolInitialization).toBeDefined();
      expect(report.alerts).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });

    test('should manage alerts correctly', () => {
      const initialAlerts = startupMonitoringService.getAlerts();
      expect(Array.isArray(initialAlerts)).toBe(true);
      
      startupMonitoringService.clearAlerts();
      const clearedAlerts = startupMonitoringService.getAlerts();
      expect(clearedAlerts).toHaveLength(0);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete startup flow', async () => {
      // Start monitoring
      startupMonitoringService.startMonitoring();
      
      // Mark server ready
      startupStatusService.markServerReady();
      expect(startupStatusService.isServerReady()).toBe(true);
      
      // Mark symbol init started
      startupStatusService.markSymbolInitStarted();
      const statusAfterStart = startupStatusService.getStatus();
      expect(statusAfterStart.startupPhase).toBe('SYMBOL_INIT_IN_PROGRESS');
      
      // Mark symbol init completed
      startupStatusService.markSymbolInitCompleted();
      expect(startupStatusService.isSymbolDataReady()).toBe(true);
      expect(startupStatusService.isFullyReady()).toBe(true);
      
      // Check final status
      const finalStatus = startupStatusService.getStatus();
      expect(finalStatus.startupPhase).toBe('FULLY_READY');
      expect(finalStatus.serverReady).toBe(true);
      expect(finalStatus.symbolDataReady).toBe(true);
      
      // Clean up
      startupMonitoringService.stopMonitoring();
    });

    test('should handle startup failure gracefully', () => {
      const errorMessage = 'Test startup failure';
      
      startupStatusService.markStartupFailed(errorMessage);
      const status = startupStatusService.getStatus();
      
      expect(status.startupPhase).toBe('FAILED');
      expect(status.error).toBe(errorMessage);
    });

    test('should provide appropriate responses when not ready', () => {
      // Reset to initial state
      const notReadyResponse = startupStatusService.getSymbolDataNotReadyResponse();
      
      expect(notReadyResponse.success).toBe(false);
      expect(notReadyResponse.error).toBe('SYMBOL_DATA_NOT_READY');
      expect(notReadyResponse.status.phase).toBeDefined();
      expect(notReadyResponse.retryAfter).toBe(30);
    });
  });
});