import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { upstoxDataProcessor, UpstoxProcessingStats } from './upstoxDataProcessor';
import { symbolDatabaseService, ProcessingResult } from './symbolDatabaseService';
import { notificationService } from './notificationService';

// Data source configuration
export interface DataSourceConfig {
  name: string;
  enabled: boolean;
  priority: number;
  retryAttempts: number;
  retryDelay: number; // in milliseconds
}

// Processing result with retry information
export interface DataIngestionResult {
  source: string;
  success: boolean;
  stats?: UpstoxProcessingStats;
  error?: string;
  retryAttempt: number;
  processingTime: number;
}

// Overall ingestion summary
export interface IngestionSummary {
  totalSources: number;
  successfulSources: number;
  failedSources: number;
  results: DataIngestionResult[];
  totalProcessingTime: number;
  timestamp: string;
}

/**
 * Data Ingestion Service
 * Orchestrates the entire data processing pipeline from multiple sources
 */
export class DataIngestionService {
  private readonly dataSources: Map<string, DataSourceConfig> = new Map();
  private isRunning = false;
  private lastIngestion: Date | null = null;
  private ingestionHistory: IngestionSummary[] = [];
  private readonly MAX_HISTORY_ENTRIES = 50;

  constructor() {
    this.initializeDataSources();
    this.setupScheduledIngestion();
  }

  /**
   * Initialize data source configurations
   */
  private initializeDataSources(): void {
    // Configure Upstox as primary data source
    this.dataSources.set('upstox', {
      name: 'Upstox',
      enabled: true,
      priority: 1,
      retryAttempts: 3,
      retryDelay: 5000 // 5 seconds
    });

    logger.info('Initialized data sources', {
      component: 'DATA_INGESTION_SERVICE',
      operation: 'INITIALIZE_DATA_SOURCES',
      sources: Array.from(this.dataSources.keys())
    });
  }

  /**
   * Setup scheduled data ingestion
   */
  private setupScheduledIngestion(): void {
    // Schedule daily ingestion at 5:30 AM IST (before market opens)
    cron.schedule('30 5 * * *', async () => {
      logger.info('Scheduled data ingestion triggered', {
        component: 'DATA_INGESTION_SERVICE',
        operation: 'SCHEDULED_INGESTION_TRIGGER'
      });
      await this.runFullIngestion();
    }, {
      timezone: 'Asia/Kolkata'
    });

    logger.info('Scheduled daily data ingestion', {
      component: 'DATA_INGESTION_SERVICE',
      operation: 'SETUP_SCHEDULED_INGESTION',
      schedule: '5:30 AM IST'
    });
  }

  /**
   * Run full data ingestion from all enabled sources
   */
  async runFullIngestion(): Promise<IngestionSummary> {
    if (this.isRunning) {
      throw new Error('Data ingestion is already running');
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('Starting full data ingestion', {
        component: 'DATA_INGESTION_SERVICE',
        operation: 'RUN_FULL_INGESTION'
      });

      const results: DataIngestionResult[] = [];
      const enabledSources = Array.from(this.dataSources.entries())
        .filter(([_, config]) => config.enabled)
        .sort(([_, a], [__, b]) => a.priority - b.priority);

      // Process each data source
      for (const [sourceName, config] of enabledSources) {
        const result = await this.processDataSource(sourceName, config);
        results.push(result);

        // If a high-priority source fails, we might want to continue with others
        if (!result.success) {
          logger.warn('Data source processing failed', {
            component: 'DATA_INGESTION_SERVICE',
            operation: 'SOURCE_PROCESSING_FAILED',
            source: sourceName,
            error: result.error
          });
        }
      }

      // Create ingestion summary
      const totalProcessingTime = Date.now() - startTime;
      const summary: IngestionSummary = {
        totalSources: enabledSources.length,
        successfulSources: results.filter(r => r.success).length,
        failedSources: results.filter(r => !r.success).length,
        results,
        totalProcessingTime,
        timestamp: new Date().toISOString()
      };

      // Update ingestion history
      this.lastIngestion = new Date();
      this.addToHistory(summary);

      // Send notifications if there were failures
      if (summary.failedSources > 0) {
        await this.sendFailureNotifications(summary);
      }

      logger.info('Completed full data ingestion', {
        component: 'DATA_INGESTION_SERVICE',
        operation: 'FULL_INGESTION_COMPLETE',
        ...summary
      });

      return summary;

    } catch (error: any) {
      logger.error('Failed to run full data ingestion', {
        component: 'DATA_INGESTION_SERVICE',
        operation: 'FULL_INGESTION_ERROR'
      }, error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process a single data source with retry logic
   */
  private async processDataSource(sourceName: string, config: DataSourceConfig): Promise<DataIngestionResult> {
    const startTime = Date.now();
    let lastError: string | undefined;

    logger.info('Processing data source', {
      component: 'DATA_INGESTION_SERVICE',
      operation: 'PROCESS_DATA_SOURCE',
      source: sourceName,
      config
    });

    for (let attempt = 1; attempt <= config.retryAttempts; attempt++) {
      try {
        logger.debug('Data source processing attempt', {
          component: 'DATA_INGESTION_SERVICE',
          operation: 'PROCESS_ATTEMPT',
          source: sourceName,
          attempt,
          maxAttempts: config.retryAttempts
        });

        let stats: UpstoxProcessingStats | undefined;

        // Process based on source type
        switch (sourceName) {
          case 'upstox':
            stats = await upstoxDataProcessor.processUpstoxData();
            break;
          default:
            throw new Error(`Unknown data source: ${sourceName}`);
        }

        // Success
        const processingTime = Date.now() - startTime;
        logger.info('Data source processed successfully', {
          component: 'DATA_INGESTION_SERVICE',
          operation: 'PROCESS_SUCCESS',
          source: sourceName,
          attempt,
          processingTime,
          stats
        });

        return {
          source: sourceName,
          success: true,
          stats,
          retryAttempt: attempt,
          processingTime
        };

      } catch (error: any) {
        lastError = error.message || String(error);
        
        logger.warn('Data source processing attempt failed', {
          component: 'DATA_INGESTION_SERVICE',
          operation: 'PROCESS_ATTEMPT_FAILED',
          source: sourceName,
          attempt,
          maxAttempts: config.retryAttempts,
          error: lastError
        });

        // Wait before retry (except for last attempt)
        if (attempt < config.retryAttempts) {
          const delay = config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          logger.debug('Waiting before retry', {
            component: 'DATA_INGESTION_SERVICE',
            operation: 'RETRY_DELAY',
            source: sourceName,
            attempt,
            delay
          });
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    const processingTime = Date.now() - startTime;
    logger.error('Data source processing failed after all attempts', {
      component: 'DATA_INGESTION_SERVICE',
      operation: 'PROCESS_FAILED',
      source: sourceName,
      attempts: config.retryAttempts,
      processingTime,
      error: lastError
    });

    return {
      source: sourceName,
      success: false,
      error: lastError || 'Unknown error',
      retryAttempt: config.retryAttempts,
      processingTime
    };
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add ingestion summary to history
   */
  private addToHistory(summary: IngestionSummary): void {
    this.ingestionHistory.unshift(summary);
    
    // Keep only the most recent entries
    if (this.ingestionHistory.length > this.MAX_HISTORY_ENTRIES) {
      this.ingestionHistory = this.ingestionHistory.slice(0, this.MAX_HISTORY_ENTRIES);
    }
  }

  /**
   * Send failure notifications
   */
  private async sendFailureNotifications(summary: IngestionSummary): Promise<void> {
    try {
      const failedSources = summary.results.filter(r => !r.success);
      const message = `Data ingestion failed for ${failedSources.length} source(s): ${
        failedSources.map(r => `${r.source} (${r.error})`).join(', ')
      }`;

      logger.info('Sending failure notifications', {
        component: 'DATA_INGESTION_SERVICE',
        operation: 'SEND_FAILURE_NOTIFICATIONS',
        failedSources: failedSources.length,
        message
      });

      // Send notification (implementation depends on notification service)
      await (notificationService as any).sendAlert({
        type: 'DATA_INGESTION_FAILURE',
        severity: 'HIGH',
        message,
        details: summary
      });

    } catch (error: any) {
      logger.error('Failed to send failure notifications', {
        component: 'DATA_INGESTION_SERVICE',
        operation: 'SEND_NOTIFICATIONS_ERROR'
      }, error);
      // Don't throw error, as this is not critical
    }
  }

  /**
   * Run manual data ingestion
   */
  async runManualIngestion(sources?: string[]): Promise<IngestionSummary> {
    logger.info('Running manual data ingestion', {
      component: 'DATA_INGESTION_SERVICE',
      operation: 'RUN_MANUAL_INGESTION',
      sources: sources || 'all'
    });

    // If specific sources are requested, temporarily enable only those
    if (sources && sources.length > 0) {
      const originalConfigs = new Map(this.dataSources);
      
      try {
        // Disable all sources first
        for (const [name, config] of this.dataSources) {
          config.enabled = false;
        }
        
        // Enable only requested sources
        for (const sourceName of sources) {
          const config = this.dataSources.get(sourceName);
          if (config) {
            config.enabled = true;
          } else {
            throw new Error(`Unknown data source: ${sourceName}`);
          }
        }

        // Run ingestion
        const result = await this.runFullIngestion();
        
        // Restore original configurations
        this.dataSources.clear();
        for (const [name, config] of originalConfigs) {
          this.dataSources.set(name, config);
        }
        
        return result;
        
      } catch (error) {
        // Restore original configurations on error
        this.dataSources.clear();
        for (const [name, config] of originalConfigs) {
          this.dataSources.set(name, config);
        }
        throw error;
      }
    } else {
      return await this.runFullIngestion();
    }
  }

  /**
   * Get data source configuration
   */
  getDataSourceConfig(sourceName: string): DataSourceConfig | null {
    return this.dataSources.get(sourceName) || null;
  }

  /**
   * Update data source configuration
   */
  updateDataSourceConfig(sourceName: string, config: Partial<DataSourceConfig>): void {
    const existingConfig = this.dataSources.get(sourceName);
    if (!existingConfig) {
      throw new Error(`Data source not found: ${sourceName}`);
    }

    const updatedConfig = { ...existingConfig, ...config };
    this.dataSources.set(sourceName, updatedConfig);

    logger.info('Updated data source configuration', {
      component: 'DATA_INGESTION_SERVICE',
      operation: 'UPDATE_DATA_SOURCE_CONFIG',
      source: sourceName,
      config: updatedConfig
    });
  }

  /**
   * Get ingestion statistics
   */
  getStats(): any {
    const recentIngestion = this.ingestionHistory[0];
    
    return {
      service: 'Data Ingestion Service',
      status: this.isRunning ? 'running' : 'idle',
      lastIngestion: this.lastIngestion?.toISOString(),
      dataSources: Object.fromEntries(this.dataSources),
      recentIngestion,
      historyCount: this.ingestionHistory.length,
      nextScheduledRun: 'Daily at 5:30 AM IST'
    };
  }

  /**
   * Get ingestion history
   */
  getIngestionHistory(limit?: number): IngestionSummary[] {
    const actualLimit = limit || this.ingestionHistory.length;
    return this.ingestionHistory.slice(0, actualLimit);
  }

  /**
   * Check if ingestion is needed
   */
  needsIngestion(): boolean {
    if (!this.lastIngestion) return true;
    
    const now = new Date();
    const hoursSinceIngestion = (now.getTime() - this.lastIngestion.getTime()) / (1000 * 60 * 60);
    return hoursSinceIngestion > 24;
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Data Ingestion Service', {
        component: 'DATA_INGESTION_SERVICE',
        operation: 'INITIALIZE'
      });

      // Initialize symbol database service if not already initialized
      if (!symbolDatabaseService.isReady()) {
        await symbolDatabaseService.initialize();
      }

      // Initialize data processors
      await upstoxDataProcessor.initialize();

      // Run initial ingestion if needed
      if (this.needsIngestion()) {
        logger.info('Running initial data ingestion', {
          component: 'DATA_INGESTION_SERVICE',
          operation: 'INITIALIZE_INGESTION'
        });
        await this.runFullIngestion();
      }

      logger.info('Data Ingestion Service initialized', {
        component: 'DATA_INGESTION_SERVICE',
        operation: 'INITIALIZE_COMPLETE'
      });
    } catch (error: any) {
      logger.error('Error initializing Data Ingestion Service', {
        component: 'DATA_INGESTION_SERVICE',
        operation: 'INITIALIZE_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    logger.info('Cleaning up Data Ingestion Service', {
      component: 'DATA_INGESTION_SERVICE',
      operation: 'CLEANUP'
    });

    // Cleanup data processors
    upstoxDataProcessor.cleanup();
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return !this.isRunning && symbolDatabaseService.isReady();
  }
}

// Export singleton instance
export const dataIngestionService = new DataIngestionService();