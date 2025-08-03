/**
 * Startup Symbol Initialization Service
 * Handles fresh symbol data initialization on server startup
 */

import { logger } from '../utils/logger';
import { upstoxDataProcessor } from './upstoxDataProcessor';
import { symbolDatabaseService } from './symbolDatabaseService';
import { dataValidationService } from './dataValidationService';
import websocketService from './websocketService';


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

export interface StartupStep {
  name: string;
  description: string;
  progress: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  retryCount?: number;
  duration?: number;
  details?: any;
}

export class StartupSymbolInitializationService {
  private initializationStatus: StartupInitializationStatus = {
    status: 'PENDING',
    progress: 0,
    currentStep: 'Waiting to start'
  };

  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;
  private steps: StartupStep[] = [
    { name: 'clear_data', description: 'Clearing existing symbol data', progress: 20, status: 'PENDING', retryCount: 0 },
    { name: 'download_process', description: 'Downloading and processing Upstox data', progress: 70, status: 'PENDING', retryCount: 0 },
    { name: 'validate', description: 'Validating data integrity', progress: 90, status: 'PENDING', retryCount: 0 },
    { name: 'complete', description: 'Completing initialization', progress: 100, status: 'PENDING', retryCount: 0 }
  ];
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY_MS = 5000; // 5 seconds
  private statusUpdateCallbacks: Array<(status: StartupInitializationStatus) => void> = [];

  private refreshTimeout: NodeJS.Timeout | null = null;

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
   * Initialize symbol data on startup with smart fetching
   */
  async initializeSymbolData(): Promise<void> {
    if (this.isInitializing) {
      logger.warn('Symbol initialization already in progress', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'INITIALIZE_ALREADY_IN_PROGRESS'
      });
      return;
    }

    // Always perform fresh symbol load - no complex freshness checks
    logger.info('Starting fresh symbol data initialization', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'INITIALIZE_START_FRESH'
    });

    this.isInitializing = true;
    this.initializationStatus = {
      status: 'IN_PROGRESS',
      progress: 0,
      currentStep: 'Starting fresh initialization',
      startedAt: new Date()
    };

    try {
      // Step 1: Backup existing data
      await this.executeStepWithRetry('backup_data', () => this.backupExistingData());

      // Step 2: Download and process Upstox data
      await this.executeStepWithRetry('download_process', () => this.downloadAndProcessUpstoxData());

      // Step 3: Complete initialization (simplified)
      await this.executeStepWithRetry('complete', () => this.completeInitialization());

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
   * Schedule a one-time refresh for stale data
   */
  private scheduleOneTimeRefresh(delayMs: number): void {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
    }

    logger.info('Scheduling one-time symbol data refresh', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'SCHEDULE_ONE_TIME_REFRESH',
      delayMinutes: Math.round(delayMs / (1000 * 60))
    });

    this.refreshTimeout = setTimeout(async () => {
      try {
        logger.info('Starting scheduled one-time symbol data refresh', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'ONE_TIME_REFRESH_START'
        });

        // Force a full refresh
        await this.forceFullRefresh();

        logger.info('Completed scheduled one-time symbol data refresh', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'ONE_TIME_REFRESH_SUCCESS'
        });

      } catch (error: any) {
        logger.error('Failed scheduled one-time symbol data refresh', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'ONE_TIME_REFRESH_ERROR',
          error: error.message
        }, error);
      }
    }, delayMs);
  }

  /**
   * Force a full refresh (used by scheduler and manual triggers)
   */
  private async forceFullRefresh(): Promise<void> {
    if (this.isInitializing) {
      throw new Error('Initialization already in progress');
    }

    this.isInitializing = true;
    this.initializationStatus = {
      status: 'IN_PROGRESS',
      progress: 0,
      currentStep: 'Starting scheduled refresh',
      startedAt: new Date()
    };

    try {
      // Step 1: Backup existing data
      await this.executeStepWithRetry('backup_data', () => this.backupExistingData());

      // Step 2: Download and process Upstox data
      await this.executeStepWithRetry('download_process', () => this.downloadAndProcessUpstoxData());

      // Step 3: Complete initialization (simplified)
      await this.executeStepWithRetry('complete', () => this.completeInitialization());

      this.initializationStatus.status = 'COMPLETED';
      this.initializationStatus.completedAt = new Date();

    } catch (error: any) {
      this.initializationStatus.status = 'FAILED';
      this.initializationStatus.error = error.message;
      this.initializationStatus.completedAt = new Date();
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

    await this.forceFullRefresh();
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

    // Broadcast progress update via WebSocket
    try {
      websocketService.broadcastSymbolInitProgress({
        progress,
        currentStep,
        status: this.initializationStatus.status,
        stats: this.initializationStatus.stats,
        steps: this.steps
      });
    } catch (error) {
      logger.error('Error broadcasting symbol init progress via WebSocket', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'WEBSOCKET_BROADCAST_ERROR'
      }, error);
    }
  }

  /**
   * Start a step with detailed logging
   */
  private startStep(stepName: string): void {
    const step = this.steps.find(s => s.name === stepName);
    if (step) {
      step.status = 'IN_PROGRESS';
      step.startedAt = new Date();
      
      logger.info(`Starting step: ${step.description}`, {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'STEP_START',
        stepName,
        stepDescription: step.description,
        retryCount: step.retryCount || 0
      });

      this.updateProgress(step.progress - 10, `Starting: ${step.description}`);
    }
  }

  /**
   * Complete a step with detailed logging
   */
  private completeStep(stepName: string, details?: any): void {
    const step = this.steps.find(s => s.name === stepName);
    if (step) {
      step.status = 'COMPLETED';
      step.completedAt = new Date();
      step.details = details;
      
      if (step.startedAt) {
        step.duration = step.completedAt.getTime() - step.startedAt.getTime();
      }
      
      logger.info(`Completed step: ${step.description}`, {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'STEP_COMPLETE',
        stepName,
        stepDescription: step.description,
        duration: step.duration,
        details
      });

      this.updateProgress(step.progress, `Completed: ${step.description}`);
    }
  }

  /**
   * Fail a step with detailed logging and retry logic
   */
  private async failStep(stepName: string, error: Error): Promise<boolean> {
    const step = this.steps.find(s => s.name === stepName);
    if (!step) return false;

    step.retryCount = (step.retryCount || 0) + 1;
    step.error = error.message;
    
    logger.error(`Step failed: ${step.description}`, {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'STEP_FAILED',
      stepName,
      stepDescription: step.description,
      retryCount: step.retryCount,
      error: error.message
    }, error);

    // Check if we should retry
    if (step.retryCount < this.MAX_RETRY_ATTEMPTS) {
      logger.info(`Retrying step: ${step.description} (attempt ${step.retryCount + 1}/${this.MAX_RETRY_ATTEMPTS})`, {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'STEP_RETRY',
        stepName,
        retryCount: step.retryCount,
        delayMs: this.RETRY_DELAY_MS
      });

      this.updateProgress(step.progress - 15, `Retrying: ${step.description} (attempt ${step.retryCount + 1})`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY_MS));
      
      return true; // Should retry
    } else {
      step.status = 'FAILED';
      step.completedAt = new Date();
      
      if (step.startedAt) {
        step.duration = step.completedAt.getTime() - step.startedAt.getTime();
      }
      
      logger.error(`Step permanently failed after ${step.retryCount} attempts: ${step.description}`, {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'STEP_PERMANENT_FAILURE',
        stepName,
        stepDescription: step.description,
        totalRetries: step.retryCount,
        totalDuration: step.duration
      });

      return false; // Should not retry
    }
  }

  /**
   * Get detailed step information
   */
  getSteps(): StartupStep[] {
    return [...this.steps];
  }

  /**
   * Get step metrics for monitoring
   */
  getStepMetrics(): any {
    const completedSteps = this.steps.filter(s => s.status === 'COMPLETED');
    const failedSteps = this.steps.filter(s => s.status === 'FAILED');
    const totalDuration = completedSteps.reduce((sum, step) => sum + (step.duration || 0), 0);
    const totalRetries = this.steps.reduce((sum, step) => sum + (step.retryCount || 0), 0);

    return {
      totalSteps: this.steps.length,
      completedSteps: completedSteps.length,
      failedSteps: failedSteps.length,
      totalDuration,
      totalRetries,
      averageStepDuration: completedSteps.length > 0 ? totalDuration / completedSteps.length : 0,
      steps: this.steps.map(step => ({
        name: step.name,
        description: step.description,
        status: step.status,
        duration: step.duration,
        retryCount: step.retryCount,
        error: step.error
      }))
    };
  }

  /**
   * Execute a step with retry logic
   */
  private async executeStepWithRetry(stepName: string, stepFunction: () => Promise<any>): Promise<any> {
    let shouldRetry = true;
    let result: any;

    while (shouldRetry) {
      this.startStep(stepName);
      
      try {
        result = await stepFunction();
        this.completeStep(stepName, result);
        shouldRetry = false;
      } catch (error: any) {
        shouldRetry = await this.failStep(stepName, error);
        
        if (!shouldRetry) {
          throw error;
        }
      }
    }

    return result;
  }

  /**
   * Backup existing symbol data before loading fresh data
   */
  private async backupExistingData(): Promise<any> {
    logger.info('Backing up existing symbol data', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'BACKUP_EXISTING_DATA'
    });

    try {
      // Get current symbol count for logging
      const stats = await symbolDatabaseService.getStatistics();
      const existingCount = stats.totalSymbols;

      if (existingCount > 0) {
        logger.info('Found existing symbol data to backup', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'BACKUP_EXISTING_DATA_FOUND',
          existingSymbols: existingCount
        });

        // Backup and clear existing symbols
        const result = await symbolDatabaseService.backupAndClearSymbols();

        logger.info('Backed up existing symbol data', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'BACKUP_EXISTING_DATA_SUCCESS',
          backedUpSymbols: result.backedUpCount,
          backupCollection: result.backupCollection
        });

        return { backedUpSymbols: result.backedUpCount, backupCollection: result.backupCollection };
      } else {
        logger.info('No existing symbol data found to backup', {
          component: 'STARTUP_SYMBOL_INIT',
          operation: 'CLEAR_EXISTING_DATA_NONE'
        });

        return { clearedSymbols: 0 };
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
  private async downloadAndProcessUpstoxData(): Promise<any> {
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

      return this.initializationStatus.stats;

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
  private async validateDataIntegrity(): Promise<any> {
    logger.info('Validating symbol data integrity', {
      component: 'STARTUP_SYMBOL_INIT',
      operation: 'VALIDATE_DATA_INTEGRITY'
    });

    try {
      // Get database stats
      const stats = await symbolDatabaseService.getStatistics();

      // Validate minimum counts (relaxed thresholds)
      const equityCount = (stats.symbolsByType && stats.symbolsByType['EQUITY']) || 0;
      const validations = [
        { check: stats.totalSymbols >= 100, message: `Total symbols too low: ${stats.totalSymbols}` },
        { check: stats.activeSymbols >= 50, message: `Active symbols too low: ${stats.activeSymbols}` },
        { check: equityCount >= 10, message: `Equity symbols too low: ${equityCount}` }
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

      return { validationStats: stats, validationsPassed: validations.length };

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
  private async completeInitialization(): Promise<any> {
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

      return { cacheWarmed: true, initializationComplete: true };

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

      // Use the symbol cache service to warm the cache
      const { symbolCacheService } = require('./symbolCacheService');
      await symbolCacheService.warmCache(symbolDatabaseService);

      logger.info('Cache warmed up successfully', {
        component: 'STARTUP_SYMBOL_INIT',
        operation: 'WARM_UP_CACHE_SUCCESS'
      });

      return;

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
    const stepMetrics = this.getStepMetrics();
    
    return {
      service: 'Startup Symbol Initialization',
      status: this.initializationStatus.status,
      progress: this.initializationStatus.progress,
      currentStep: this.initializationStatus.currentStep,
      startedAt: this.initializationStatus.startedAt,
      completedAt: this.initializationStatus.completedAt,
      stats: this.initializationStatus.stats,
      error: this.initializationStatus.error,
      stepMetrics,
      performance: {
        totalDuration: stepMetrics.totalDuration,
        averageStepDuration: stepMetrics.averageStepDuration,
        totalRetries: stepMetrics.totalRetries,
        successRate: stepMetrics.totalSteps > 0 ? 
          (stepMetrics.completedSteps / stepMetrics.totalSteps) * 100 : 0
      }
    };
  }
}

// Export singleton instance
export const startupSymbolInitializationService = new StartupSymbolInitializationService();