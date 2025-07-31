/**
 * Startup Symbol Initialization Service Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { StartupSymbolInitializationService } from '../services/startupSymbolInitializationService';

describe('StartupSymbolInitializationService', () => {
  let service: StartupSymbolInitializationService;

  beforeEach(() => {
    service = new StartupSymbolInitializationService();
  });

  describe('getStatus', () => {
    it('should return initial status as PENDING', () => {
      const status = service.getStatus();
      
      expect(status.status).toBe('PENDING');
      expect(status.progress).toBe(0);
      expect(status.currentStep).toBe('Waiting to start');
    });
  });

  describe('isInProgress', () => {
    it('should return false initially', () => {
      expect(service.isInProgress()).toBe(false);
    });
  });

  describe('getInitializationStats', () => {
    it('should return service statistics', () => {
      const stats = service.getInitializationStats();
      
      expect(stats.service).toBe('Startup Symbol Initialization');
      expect(stats.status).toBe('PENDING');
      expect(stats.progress).toBe(0);
    });
  });
});