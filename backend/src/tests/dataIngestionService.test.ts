import { describe, it, expect, beforeEach } from '@jest/globals';
import { DataIngestionService, DataSourceConfig } from '../services/dataIngestionService';

// Mock dependencies
jest.mock('node-cron');
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../services/upstoxDataProcessor', () => ({
  upstoxDataProcessor: {
    processUpstoxData: jest.fn(),
    initialize: jest.fn(),
    cleanup: jest.fn()
  }
}));

jest.mock('../services/symbolDatabaseService', () => ({
  symbolDatabaseService: {
    initialize: jest.fn(),
    isReady: jest.fn(() => true)
  }
}));

jest.mock('../services/notificationService', () => ({
  notificationService: {
    sendAlert: jest.fn()
  }
}));

describe('DataIngestionService', () => {
  let service: DataIngestionService;

  beforeEach(() => {
    // Create a new service instance for each test
    service = new DataIngestionService();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default data sources', () => {
      const stats = service.getStats();
      
      expect(stats.dataSources).toBeDefined();
      expect(stats.dataSources.upstox).toBeDefined();
      expect(stats.dataSources.upstox.enabled).toBe(true);
      expect(stats.dataSources.upstox.priority).toBe(1);
    });
  });

  describe('Data Source Configuration', () => {
    it('should get data source configuration', () => {
      const config = service.getDataSourceConfig('upstox');
      
      expect(config).toBeDefined();
      expect(config?.name).toBe('Upstox');
      expect(config?.enabled).toBe(true);
      expect(config?.priority).toBe(1);
      expect(config?.retryAttempts).toBe(3);
      expect(config?.retryDelay).toBe(5000);
    });

    it('should return null for unknown data source', () => {
      const config = service.getDataSourceConfig('unknown');
      expect(config).toBeNull();
    });

    it('should update data source configuration', () => {
      const newConfig: Partial<DataSourceConfig> = {
        enabled: false,
        retryAttempts: 5
      };

      service.updateDataSourceConfig('upstox', newConfig);
      
      const updatedConfig = service.getDataSourceConfig('upstox');
      expect(updatedConfig?.enabled).toBe(false);
      expect(updatedConfig?.retryAttempts).toBe(5);
      expect(updatedConfig?.name).toBe('Upstox'); // Should preserve other fields
    });

    it('should throw error when updating unknown data source', () => {
      expect(() => {
        service.updateDataSourceConfig('unknown', { enabled: false });
      }).toThrow('Data source not found: unknown');
    });
  });

  describe('Service Status', () => {
    it('should return correct statistics', () => {
      const stats = service.getStats();

      expect(stats.service).toBe('Data Ingestion Service');
      expect(stats.status).toBe('idle');
      expect(stats.dataSources).toBeDefined();
      expect(stats.nextScheduledRun).toBe('Daily at 5:30 AM IST');
    });

    it('should indicate when ingestion is needed', () => {
      expect(service.needsIngestion()).toBe(true); // Should be true for new instance
    });

    it('should indicate readiness correctly', () => {
      expect(service.isReady()).toBe(true); // Should be true when symbol service is ready
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      service.cleanup();
      // Should not throw errors
      expect(true).toBe(true);
    });
  });
});