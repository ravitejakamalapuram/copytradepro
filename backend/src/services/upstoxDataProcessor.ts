/**
 * Legacy Upstox Data Processor - Wrapper for Unified Symbol Processor
 * This file maintains backward compatibility while using the new unified system
 */

import { unifiedSymbolProcessor, SymbolProcessingStats } from './unifiedSymbolProcessor';
import { logger } from '../utils/logger';

// Re-export types for backward compatibility
export { SymbolProcessingStats } from './unifiedSymbolProcessor';

// Legacy interface for backward compatibility
export interface UpstoxProcessingStats extends SymbolProcessingStats {}

/**
 * Legacy UpstoxDataProcessor class - now a wrapper around UnifiedSymbolProcessor
 * Maintains backward compatibility for existing code
 */
export class UpstoxDataProcessor {
  /**
   * Process Upstox data using the unified symbol processor
   */
  async processUpstoxData(): Promise<UpstoxProcessingStats> {
    logger.info('Processing Upstox data via unified symbol processor', {
      component: 'UPSTOX_DATA_PROCESSOR_LEGACY',
      operation: 'PROCESS_UPSTOX_DATA'
    });

    return await unifiedSymbolProcessor.processSymbolData();
  }

  /**
   * Initialize the processor
   */
  async initialize(): Promise<void> {
    logger.info('Initializing legacy Upstox processor', {
      component: 'UPSTOX_DATA_PROCESSOR_LEGACY',
      operation: 'INITIALIZE'
    });

    return await unifiedSymbolProcessor.initialize();
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return unifiedSymbolProcessor.isReady();
  }

  /**
   * Get processing statistics
   */
  getStats(): any {
    return unifiedSymbolProcessor.getStats();
  }

  /**
   * Check if update is needed
   */
  needsUpdate(): boolean {
    return unifiedSymbolProcessor.needsUpdate();
  }

  /**
   * Run manual update
   */
  async runManualUpdate(): Promise<UpstoxProcessingStats> {
    return await unifiedSymbolProcessor.runManualUpdate();
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    unifiedSymbolProcessor.cleanup();
  }

  /**
   * Check if local symbol data file exists
   */
  hasLocalData(): boolean {
    return unifiedSymbolProcessor.hasLocalData();
  }
}

// Export singleton instance for backward compatibility
export const upstoxDataProcessor = new UpstoxDataProcessor();

