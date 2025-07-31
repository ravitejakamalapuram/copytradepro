/**
 * Startup Symbol Initialization Service
 * Handles fresh symbol data initialization on server startup
 */

import { logger } from '../utils/logger';
import { upstoxDataProcessor } from './upstoxDataProcessor';
import { symbolDatabaseService } from './symbolDatabaseService';
import { dataValidationService } from './dataValidationService';


export interface StartupInitializationStatus {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  progress: number; // 0-100
  currentStep: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  stats?: {
    totalSymbols: number;
    validSymbols: number;
    invalidSymbols: number;
    processingTime: number;
  };
}

export class StartupSymbolInitializationService {
  private initializationStatus: StartupInitializationStatus = {
    status: 'PENDING',
    progress: 0,
    currentStep: 'Waiting to start'
  };

  private isInitializing = false;

  constructor() {
    logger.info('Startup Symbol Initialization Service created', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'CONSTRUCTOR'
    });
  }

  /**
   * Get current initialization status
   */
  getStatus(): StartupInitializationStatus {
    return { ...this.initializationStatus };
  }

  /**
   * Check if initialization is currently in progress
   */
  isInProgress(): boolean {
    return this.isInitializing;
  }

  /**
   * Initialize symbol data on startup
   */
  async initializeSymbolData(): Promise<void> {
    if (this.isInitializing) {
      logger.warn('Symbol initialization already in progress', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'INITIALIZE_ALREADY_IN_PROGRESS'
      });
      return;
    }

    this.isInitializing = true;
    this.initializationStatus = {
      status: 'IN_PROGRESS',
      progress: 0,
      currentStep: 'Starting initialization',
      startedAt: new Date()
    };

    logger.info('Starting fresh symbol data initialization', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'INITIALIZE_START'
    });

    try {
      // Step 1: Clear existing symbol data (fresh start)
      await this.clearExistingData();
      this.updateProgress(20, 'Cleared existing data');

      // Step 2: Download and process Upstox data
      await this.downloadAndProcessUpstoxData();
      this.updateProgress(70, 'Downloaded and processed Upstox data');

      // Step 3: Validate data integrity
      await this.validateDataIntegrity();
      this.updateProgress(90, 'Validated data integrity');

      // Step 4: Complete initialization
      await this.completeInitialization();
      this.updateProgress(100, 'Initialization completed');

      this.initializationStatus.status = 'COMPLETED';
      this.initializationStatus.completedAt = new Date();

      logger.info('Symbol data initialization completed successfully', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'INITIALIZE_SUCCESS',
        stats: this.initializationStatus.stats
      });

    } catch (error: any) {
      this.initializationStatus.status = 'FAILED';
      this.initializationStatus.error = error.message;
      this.initializationStatus.completedAt = new Date();

      logger.error('Symbol data initialization failed', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'INITIALIZE_ERROR',
        error: error.message
      }, error);

      // Log failure (notification removed for simplicity)
      logger.error('Symbol initialization failed', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'INITIALIZATION_FAILURE_LOGGED',
        error: error.message
      });

      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Force restart symbol initialization
   */
  async forceRestart(): Promise<void> {
    if (this.isInitializing) {
      logger.warn('Cannot force restart - initialization already in progress', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'FORCE_RESTART_BLOCKED'
      });
      throw new Error('Initialization already in progress');
    }

    logger.info('Force restarting symbol initialization', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'FORCE_RESTART'
    });

    await this.initializeSymbolData();
  }

  /**
   * Update progress and current step
   */
  private updateProgress(progress: number, currentStep: string): void {
    this.initializationStatus.progress = progress;
    this.initializationStatus.currentStep = currentStep;

    logger.info('Symbol initialization progress update', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'PROGRESS_UPDATE',
      progress,
      currentStep
    });
  }

  /**
   * Clear existing symbol data for fresh start
   */
  private async clearExistingData(): Promise<void> {
    logger.info('Clearing existing symbol data', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'CLEAR_EXISTING_DATA'
    });

    try {
      // Get current symbol count for logging
      const stats = await symbolDatabaseService.getStats();
      const existingCount = stats.totalSymbols;

      if (existingCount > 0) {
        logger.info('Found existing symbol data to clear', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'CLEAR_EXISTING_DATA_FOUND',
          existingSymbols: existingCount
        });

        // Clear all existing symbols
        await symbolDatabaseService.clearAllSymbols();

        logger.info('Cleared existing symbol data', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'CLEAR_EXISTING_DATA_SUCCESS',
          clearedSymbols: existingCount
        });
      } else {
        logger.info('No existing symbol data found to clear', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'CLEAR_EXISTING_DATA_NONE'
        });
      }
    } catch (error: any) {
      logger.error('Failed to clear existing symbol data', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'CLEAR_EXISTING_DATA_ERROR'
      }, error);
      throw new Error(`Failed to clear existing data: ${error.message}`);
    }
  }

  /**
   * Download and process Upstox data
   */
  private async downloadAndProcessUpstoxData(): Promise<void> {
    logger.info('Downloading and processing Upstox data', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'DOWNLOAD_PROCESS_UPSTOX'
    });

    try {
      const startTime = Date.now();

      // Process Upstox data
      const result = await upstoxDataProcessor.processUpstoxData();

      const processingTime = Date.now() - startTime;

      // Store stats for final status
      this.initializationStatus.stats = {
        totalSymbols: result.totalProcessed,
        validSymbols: result.validSymbols,
        invalidSymbols: result.invalidSymbols,
        processingTime
      };

      logger.info('Upstox data processing completed', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'DOWNLOAD_PROCESS_UPSTOX_SUCCESS',
        stats: this.initializationStatus.stats
      });

      // Validate minimum symbol count with more flexible thresholds
      const minSymbolCount = parseInt(process.env.MIN_SYMBOL_COUNT || '1000');
      const warningThreshold = Math.floor(minSymbolCount * 0.5); // 50% of minimum
      
      if (result.validSymbols === 0) {
        throw new Error(`No symbols processed successfully. This indicates a critical issue with data source or processing.`);
      } else if (result.validSymbols < warningThreshold) {
        logger.warn('Very low symbol count detected', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'LOW_SYMBOL_COUNT_WARNING',
          validSymbols: result.validSymbols,
          expectedMinimum: minSymbolCount,
          warningThreshold
        });
        throw new Error(`Critically low symbol count: ${result.validSymbols}. Expected at least ${minSymbolCount} symbols.`);
      } else if (result.validSymbols < minSymbolCount) {
        logger.warn('Symbol count below expected minimum but proceeding', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'LOW_SYMBOL_COUNT_PROCEED',
          validSymbols: result.validSymbols,
          expectedMinimum: minSymbolCount
        });
        // Continue with warning but don't fail
      }

    } catch (error: any) {
      logger.error('Failed to download and process Upstox data', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'DOWNLOAD_PROCESS_UPSTOX_ERROR'
      }, error);
      throw new Error(`Failed to process Upstox data: ${error.message}`);
    }
  }

  /**
   * Validate data integrity after processing
   */
  private async validateDataIntegrity(): Promise<void> {
    logger.info('Validating symbol data integrity', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'VALIDATE_DATA_INTEGRITY'
    });

    try {
      // Get database stats
      const stats = await symbolDatabaseService.getStats();

      // Validate minimum counts
      const validations = [
        { check: stats.totalSymbols >= 1000, message: `Total symbols too low: ${stats.totalSymbols}` },
        { check: stats.activeSymbols >= 500, message: `Active symbols too low: ${stats.activeSymbols}` },
        { check: stats.symbolsByType.EQUITY >= 100, message: `Equity symbols too low: ${stats.symbolsByType.EQUITY}` }
      ];

      const failures = validations.filter(v => !v.check);
      if (failures.length > 0) {
        const errorMessage = failures.map(f => f.message).join(', ');
        throw new Error(`Data integrity validation failed: ${errorMessage}`);
      }

      logger.info('Data integrity validation passed', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'VALIDATE_DATA_INTEGRITY_SUCCESS',
        stats
      });

    } catch (error: any) {
      logger.error('Data integrity validation failed', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'VALIDATE_DATA_INTEGRITY_ERROR'
      }, error);
      throw new Error(`Data integrity validation failed: ${error.message}`);
    }
  }

  /**
   * Complete initialization process
   */
  private async completeInitialization(): Promise<void> {
    logger.info('Completing symbol initialization', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'COMPLETE_INITIALIZATION'
    });

    try {
      // Warm up cache with popular symbols
      await this.warmUpCache();

      // Log success (notification removed for simplicity)
      logger.info('Symbol initialization completed successfully', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'INITIALIZATION_SUCCESS_LOGGED'
      });

      logger.info('Symbol initialization completed', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'COMPLETE_INITIALIZATION_SUCCESS'
      });

    } catch (error: any) {
      logger.error('Failed to complete initialization', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'COMPLETE_INITIALIZATION_ERROR'
      }, error);
      // Don't throw here as the main initialization was successful
    }
  }

  /**
   * Warm up cache with popular symbols
   */
  private async warmUpCache(): Promise<void> {
    try {
      logger.info('Warming up symbol cache', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'WARM_UP_CACHE'
      });

      // Get popular equity symbols
      const popularEquities = await symbolDatabaseService.searchSymbolsWithFilters({
        instrumentType: 'EQUITY',
        limit: 100
      });

      // Get popular index options
      const popularOptions = await symbolDatabaseService.searchSymbolsWithFilters({
        instrumentType: 'OPTION',
        underlying: 'NIFTY',
        limit: 50
      });

      logger.info('Cache warmed up successfully', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'WARM_UP_CACHE_SUCCESS',
        equityCount: popularEquities.symbols.length,
        optionCount: popularOptions.symbols.length
      });

    } catch (error: any) {
      logger.warn('Failed to warm up cache', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'WARM_UP_CACHE_ERROR'
      }, error);
      // Don't throw as this is not critical
    }
  }



  /**
   * Check if symbol data is available and valid
   */
  async isSymbolDataReady(): Promise<boolean> {
    try {
      const stats = await symbolDatabaseService.getStats();
      return stats.totalSymbols >= 1000 && stats.activeSymbols >= 500;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get initialization statistics
   */
  getInitializationStats(): any {
    return {
      service: 'Startup Symbol Initialization',
      status: this.initializationStatus.status,
      progress: this.initializationStatus.progress,
      currentStep: this.initializationStatus.currentStep,
      startedAt: this.initializationStatus.startedAt,
      completedAt: this.initializationStatus.completedAt,
      stats: this.initializationStatus.stats,
      error: this.initializationStatus.error
    };
  }
}

// Export singleton instance
export const startupSymbolInitializationService = new StartupSymbolInitializationService();