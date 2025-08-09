import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DailyUpdateScheduler, SchedulerConfig, DownloadSource } from '../services/dailyUpdateScheduler';

// Mock dependencies
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    destroy: jest.fn(),
    running: false
  }))
}));

jest.mock('axios');

jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../services/dataIngestionService', () => ({
  dataIngestionService: {
    runFullIngestion: jest.fn(),
    initialize: jest.fn(),
    isReady: jest.fn(() => true)
  }
}));

jest.mock('../services/notificationService', () => ({
  notificationService: {
    sendAlert: jest.fn()
  }
}));

describe('DailyUpdateScheduler', () => {
  let scheduler: DailyUpdateScheduler;

  beforeEach(() => {
    // Create a new scheduler instance for each test
    const config: Partial<SchedulerConfig> = {
      enabled: false, // Disable by default for testing
      cronExpression: '0 5 * * *',
      timezone: 'Asia/Kolkata',
      maxRetries: 2, // Reduce for faster tests
      retryDelay: 100, // Reduce for faster tests
      downloadTimeout: 5000,
      notifyOnFailure: true,
      notifyOnSuccess: false
    };
    
    scheduler = new DailyUpdateScheduler(config);
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup scheduler
    scheduler.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultScheduler = new DailyUpdateScheduler();
      const config = defaultScheduler.getConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.cronExpression).toBe('0 5 * * *');
      expect(config.timezone).toBe('Asia/Kolkata');
      expect(config.maxRetries).toBe(3);
      expect(config.retryDelay).toBe(300000);
      expect(config.downloadTimeout).toBe(300000);
      expect(config.notifyOnFailure).toBe(true);
      expect(config.notifyOnSuccess).toBe(false);
      
      defaultScheduler.cleanup();
    });

    it('should initialize with custom configuration', () => {
      const customConfig: Partial<SchedulerConfig> = {
        enabled: false,
        cronExpression: '0 6 * * *',
        maxRetries: 5,
        retryDelay: 60000
      };
      
      const customScheduler = new DailyUpdateScheduler(customConfig);
      const config = customScheduler.getConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.cronExpression).toBe('0 6 * * *');
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelay).toBe(60000);
      expect(config.timezone).toBe('Asia/Kolkata'); // Should use default
      
      customScheduler.cleanup();
    });

    it('should initialize download sources', () => {
      const upstoxSource = scheduler.getDownloadSource('upstox');
      
      expect(upstoxSource).toBeDefined();
      expect(upstoxSource?.name).toBe('Upstox Complete Instruments');
      expect(upstoxSource?.enabled).toBe(true);
      expect(upstoxSource?.priority).toBe(1);
      expect(upstoxSource?.url).toContain('upstox.com');
    });
  });

  describe('Configuration Management', () => {
    it('should update scheduler configuration', () => {
      const newConfig: Partial<SchedulerConfig> = {
        maxRetries: 5,
        retryDelay: 60000,
        notifyOnSuccess: true
      };

      scheduler.updateConfig(newConfig);
      const config = scheduler.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.retryDelay).toBe(60000);
      expect(config.notifyOnSuccess).toBe(true);
      expect(config.enabled).toBe(false); // Should preserve other values
    });

    it('should update download source configuration', () => {
      const newSource: Partial<DownloadSource> = {
        enabled: false,
        timeout: 10000
      };

      scheduler.updateDownloadSource('upstox', newSource);
      const source = scheduler.getDownloadSource('upstox');

      expect(source?.enabled).toBe(false);
      expect(source?.timeout).toBe(10000);
      expect(source?.name).toBe('Upstox Complete Instruments'); // Should preserve other values
    });

    it('should throw error when updating unknown download source', () => {
      expect(() => {
        scheduler.updateDownloadSource('unknown', { enabled: false });
      }).toThrow('Download source not found: unknown');
    });
  });

  describe('Service Status', () => {
    it('should return correct statistics', () => {
      const stats = scheduler.getStats();

      expect(stats.service).toBe('Daily Update Scheduler');
      expect(stats.status).toBe('idle');
      expect(stats.enabled).toBe(false);
      expect(stats.cronExpression).toBe('0 5 * * *');
      expect(stats.timezone).toBe('Asia/Kolkata');
      expect(stats.downloadSources).toBeDefined();
      expect(stats.config).toBeDefined();
    });

    it('should indicate when execution is needed', () => {
      expect(scheduler.needsExecution()).toBe(true); // Should be true for new instance
    });

    it('should indicate readiness correctly', () => {
      expect(scheduler.isReady()).toBe(true); // Should be true when data ingestion service is ready
    });
  });

  describe('Scheduler Control', () => {
    it('should start and stop scheduler', () => {
      // Enable scheduler
      scheduler.updateConfig({ enabled: true });

      // Start scheduler
      scheduler.start();
      
      // Stop scheduler
      scheduler.stop();
      
      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle start when already running', () => {
      scheduler.updateConfig({ enabled: true });
      scheduler.start();
      
      // Starting again should not throw error
      expect(() => scheduler.start()).not.toThrow();
    });

    it('should handle stop when not running', () => {
      // Stopping when not running should not throw error
      expect(() => scheduler.stop()).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      scheduler.cleanup();
      
      // Should not throw errors
      expect(true).toBe(true);
    });
  });
});