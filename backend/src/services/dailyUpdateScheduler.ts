import * as cron from 'node-cron';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { dataIngestionService, IngestionSummary } from './dataIngestionService';
import { notificationService } from './notificationService';
import { symbolDatabaseService } from './symbolDatabaseService';

// Scheduler configuration
export interface SchedulerConfig {
  enabled: boolean;
  cronExpression: string;
  timezone: string;
  maxRetries: number;
  retryDelay: number; // in milliseconds
  downloadTimeout: number; // in milliseconds
  notifyOnFailure: boolean;
  notifyOnSuccess: boolean;
}

// Download source configuration
export interface DownloadSource {
  name: string;
  url: string;
  enabled: boolean;
  priority: number;
  headers?: Record<string, string>;
  timeout?: number;
}

// Retry attempt information
export interface RetryAttempt {
  attempt: number;
  timestamp: string;
  error: string;
  nextRetryAt?: string;
}

// Scheduler execution result
export interface SchedulerExecutionResult {
  executionId: string;
  startTime: string;
  endTime: string;
  success: boolean;
  ingestionSummary?: IngestionSummary;
  downloadResults: DownloadResult[];
  retryAttempts: RetryAttempt[];
  error?: string;
  totalExecutionTime: number;
}

// Download result
export interface DownloadResult {
  source: string;
  url: string;
  success: boolean;
  filePath?: string;
  fileSize?: number;
  downloadTime: number;
  error?: string;
}

/**
 * Daily Update Scheduler Service
 * Manages scheduled downloads and data processing with retry logic and notifications
 */
export class DailyUpdateScheduler {
  private readonly config: SchedulerConfig;
  private readonly downloadSources: Map<string, DownloadSource> = new Map();
  private readonly executionHistory: SchedulerExecutionResult[] = [];
  private readonly MAX_HISTORY_ENTRIES = 100;
  
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private lastExecution: Date | null = null;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      enabled: true,
      cronExpression: '0 5 * * *', // 5:00 AM daily
      timezone: 'Asia/Kolkata',
      maxRetries: 3,
      retryDelay: 300000, // 5 minutes
      downloadTimeout: 300000, // 5 minutes
      notifyOnFailure: true,
      notifyOnSuccess: false,
      ...config
    };

    this.initializeDownloadSources();
    this.setupScheduler();
  }

  /**
   * Initialize download sources
   */
  private initializeDownloadSources(): void {
    // Upstox complete instruments CSV
    this.downloadSources.set('upstox', {
      name: 'Upstox Complete Instruments',
      url: 'https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz',
      enabled: true,
      priority: 1,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Encoding': 'gzip, deflate'
      },
      timeout: this.config.downloadTimeout
    });

    logger.info('Initialized download sources', {
      component: 'DAILY_UPDATE_SCHEDULER',
      operation: 'INITIALIZE_DOWNLOAD_SOURCES',
      sources: Array.from(this.downloadSources.keys())
    });
  }

  /**
   * Setup cron scheduler
   */
  private setupScheduler(): void {
    if (!this.config.enabled) {
      logger.info('Daily update scheduler is disabled', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'SETUP_SCHEDULER'
      });
      return;
    }

    try {
      this.cronJob = cron.schedule(this.config.cronExpression, async () => {
        logger.info('Scheduled daily update triggered', {
          component: 'DAILY_UPDATE_SCHEDULER',
          operation: 'SCHEDULED_TRIGGER'
        });
        await this.executeScheduledUpdate();
      }, {
        scheduled: false, // Don't start immediately
        timezone: this.config.timezone
      });

      logger.info('Daily update scheduler configured', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'SETUP_SCHEDULER',
        cronExpression: this.config.cronExpression,
        timezone: this.config.timezone,
        enabled: this.config.enabled
      });
    } catch (error: any) {
      logger.error('Failed to setup scheduler', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'SETUP_SCHEDULER_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (!this.cronJob) {
      throw new Error('Scheduler not configured');
    }

    if (this.cronJob && !(this.cronJob as any).running) {
      this.cronJob.start();
      logger.info('Daily update scheduler started', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'START_SCHEDULER'
      });
    } else {
      logger.warn('Scheduler is already running', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'START_SCHEDULER'
      });
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.cronJob && (this.cronJob as any).running) {
      this.cronJob.stop();
      logger.info('Daily update scheduler stopped', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'STOP_SCHEDULER'
      });
    }
  }

  /**
   * Execute scheduled update with retry logic
   */
  private async executeScheduledUpdate(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Scheduled update already running, skipping', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'EXECUTE_SCHEDULED_UPDATE'
      });
      return;
    }

    const executionId = this.generateExecutionId();
    const startTime = new Date();
    
    logger.info('Starting scheduled update execution', {
      component: 'DAILY_UPDATE_SCHEDULER',
      operation: 'EXECUTE_SCHEDULED_UPDATE',
      executionId
    });

    this.isRunning = true;
    const retryAttempts: RetryAttempt[] = [];
    let lastError: string | undefined;

    try {
      for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
        try {
          logger.info('Scheduled update attempt', {
            component: 'DAILY_UPDATE_SCHEDULER',
            operation: 'UPDATE_ATTEMPT',
            executionId,
            attempt,
            maxRetries: this.config.maxRetries
          });

          // Execute the update
          const result = await this.executeUpdate(executionId);
          
          // Success
          this.lastExecution = new Date();
          this.addToExecutionHistory(result);

          if (this.config.notifyOnSuccess) {
            await this.sendSuccessNotification(result);
          }

          logger.info('Scheduled update completed successfully', {
            component: 'DAILY_UPDATE_SCHEDULER',
            operation: 'UPDATE_SUCCESS',
            executionId,
            attempt
          });

          return;

        } catch (error: any) {
          lastError = error.message || String(error);
          
          const retryAttempt: RetryAttempt = {
            attempt,
            timestamp: new Date().toISOString(),
            error: lastError || 'Unknown error'
          };

          if (attempt < this.config.maxRetries) {
            const nextRetryTime = new Date(Date.now() + this.config.retryDelay);
            retryAttempt.nextRetryAt = nextRetryTime.toISOString();
            
            logger.warn('Scheduled update attempt failed, will retry', {
              component: 'DAILY_UPDATE_SCHEDULER',
              operation: 'UPDATE_ATTEMPT_FAILED',
              executionId,
              attempt,
              error: lastError,
              nextRetryAt: retryAttempt.nextRetryAt
            });

            // Wait before retry with exponential backoff
            const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
            await this.sleep(delay);
          } else {
            logger.error('Scheduled update attempt failed (final)', {
              component: 'DAILY_UPDATE_SCHEDULER',
              operation: 'UPDATE_ATTEMPT_FAILED_FINAL',
              executionId,
              attempt,
              error: lastError
            });
          }

          retryAttempts.push(retryAttempt);
        }
      }

      // All attempts failed
      const endTime = new Date();
      const failedResult: SchedulerExecutionResult = {
        executionId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        success: false,
        downloadResults: [],
        retryAttempts,
        error: lastError || 'Unknown error',
        totalExecutionTime: endTime.getTime() - startTime.getTime()
      };

      this.addToExecutionHistory(failedResult);

      if (this.config.notifyOnFailure) {
        await this.sendFailureNotification(failedResult);
      }

      logger.error('Scheduled update failed after all attempts', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'UPDATE_FAILED',
        executionId,
        attempts: this.config.maxRetries,
        error: lastError
      });

    } catch (error: any) {
      logger.error('Unexpected error in scheduled update', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'UPDATE_UNEXPECTED_ERROR',
        executionId
      }, error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Execute update process
   */
  private async executeUpdate(executionId: string): Promise<SchedulerExecutionResult> {
    const startTime = new Date();
    
    try {
      logger.info('Executing update process', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'EXECUTE_UPDATE',
        executionId
      });

      // Step 1: Download external data sources
      const downloadResults = await this.downloadExternalSources();

      // Step 2: Run data ingestion
      const ingestionSummary = await dataIngestionService.runFullIngestion();

      // Step 3: Create execution result
      const endTime = new Date();
      const result: SchedulerExecutionResult = {
        executionId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        success: ingestionSummary.failedSources === 0,
        ingestionSummary,
        downloadResults,
        retryAttempts: [],
        totalExecutionTime: endTime.getTime() - startTime.getTime()
      };

      if (ingestionSummary.failedSources > 0) {
        result.error = `${ingestionSummary.failedSources} data source(s) failed during ingestion`;
      }

      logger.info('Update process completed', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'EXECUTE_UPDATE_COMPLETE',
        executionId,
        success: result.success,
        totalExecutionTime: result.totalExecutionTime
      });

      return result;

    } catch (error: any) {
      const endTime = new Date();
      logger.error('Update process failed', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'EXECUTE_UPDATE_ERROR',
        executionId
      }, error);

      throw error;
    }
  }

  /**
   * Download external data sources
   */
  private async downloadExternalSources(): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    const enabledSources = Array.from(this.downloadSources.entries())
      .filter(([_, source]) => source.enabled)
      .sort(([_, a], [__, b]) => a.priority - b.priority);

    logger.info('Downloading external data sources', {
      component: 'DAILY_UPDATE_SCHEDULER',
      operation: 'DOWNLOAD_EXTERNAL_SOURCES',
      sourceCount: enabledSources.length
    });

    for (const [sourceName, source] of enabledSources) {
      const result = await this.downloadSource(sourceName, source);
      results.push(result);
    }

    const successfulDownloads = results.filter(r => r.success).length;
    logger.info('External data sources download completed', {
      component: 'DAILY_UPDATE_SCHEDULER',
      operation: 'DOWNLOAD_COMPLETE',
      totalSources: results.length,
      successfulDownloads,
      failedDownloads: results.length - successfulDownloads
    });

    return results;
  }

  /**
   * Download a single data source
   */
  private async downloadSource(sourceName: string, source: DownloadSource): Promise<DownloadResult> {
    const startTime = Date.now();
    
    try {
      logger.info('Downloading data source', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'DOWNLOAD_SOURCE',
        source: sourceName,
        url: source.url
      });

      // Create data directory if it doesn't exist
      const dataDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Determine file path
      const fileName = this.getFileNameFromUrl(source.url);
      const filePath = path.join(dataDir, `${sourceName}_${fileName}`);

      // Download file
      const response = await axios.get(source.url, {
        responseType: 'stream',
        timeout: source.timeout || this.config.downloadTimeout,
        headers: source.headers || {}
      });

      // Save file
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      // Get file size
      const stats = fs.statSync(filePath);
      const downloadTime = Date.now() - startTime;

      logger.info('Data source downloaded successfully', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'DOWNLOAD_SOURCE_SUCCESS',
        source: sourceName,
        filePath,
        fileSize: stats.size,
        downloadTime
      });

      return {
        source: sourceName,
        url: source.url,
        success: true,
        filePath,
        fileSize: stats.size,
        downloadTime
      };

    } catch (error: any) {
      const downloadTime = Date.now() - startTime;
      
      logger.error('Data source download failed', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'DOWNLOAD_SOURCE_ERROR',
        source: sourceName,
        url: source.url,
        downloadTime
      }, error);

      return {
        source: sourceName,
        url: source.url,
        success: false,
        downloadTime,
        error: error.message || String(error)
      };
    }
  }

  /**
   * Extract filename from URL
   */
  private getFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const fileName = path.basename(pathname);
      return fileName || 'download.csv';
    } catch (error) {
      return 'download.csv';
    }
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 8);
    return `exec-${timestamp}-${random}`;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add execution result to history
   */
  private addToExecutionHistory(result: SchedulerExecutionResult): void {
    this.executionHistory.unshift(result);
    
    // Keep only the most recent entries
    if (this.executionHistory.length > this.MAX_HISTORY_ENTRIES) {
      this.executionHistory.splice(this.MAX_HISTORY_ENTRIES);
    }
  }

  /**
   * Send success notification
   */
  private async sendSuccessNotification(result: SchedulerExecutionResult): Promise<void> {
    try {
      const message = `Daily symbol data update completed successfully. ` +
        `Processed ${result.ingestionSummary?.totalSources || 0} source(s) in ${Math.round(result.totalExecutionTime / 1000)}s.`;

      await (notificationService as any).sendAlert({
        type: 'DAILY_UPDATE_SUCCESS',
        severity: 'INFO',
        message,
        details: result
      });

      logger.info('Success notification sent', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'SEND_SUCCESS_NOTIFICATION',
        executionId: result.executionId
      });
    } catch (error: any) {
      logger.error('Failed to send success notification', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'SEND_SUCCESS_NOTIFICATION_ERROR',
        executionId: result.executionId
      }, error);
    }
  }

  /**
   * Send failure notification
   */
  private async sendFailureNotification(result: SchedulerExecutionResult): Promise<void> {
    try {
      const message = `Daily symbol data update failed after ${result.retryAttempts.length} attempt(s). ` +
        `Error: ${result.error || 'Unknown error'}`;

      await (notificationService as any).sendAlert({
        type: 'DAILY_UPDATE_FAILURE',
        severity: 'HIGH',
        message,
        details: result
      });

      logger.info('Failure notification sent', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'SEND_FAILURE_NOTIFICATION',
        executionId: result.executionId
      });
    } catch (error: any) {
      logger.error('Failed to send failure notification', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'SEND_FAILURE_NOTIFICATION_ERROR',
        executionId: result.executionId
      }, error);
    }
  }

  /**
   * Run manual update
   */
  async runManualUpdate(): Promise<SchedulerExecutionResult> {
    if (this.isRunning) {
      throw new Error('Update is already running');
    }

    const executionId = this.generateExecutionId();
    
    logger.info('Running manual update', {
      component: 'DAILY_UPDATE_SCHEDULER',
      operation: 'RUN_MANUAL_UPDATE',
      executionId
    });

    this.isRunning = true;

    try {
      const result = await this.executeUpdate(executionId);
      this.addToExecutionHistory(result);
      this.lastExecution = new Date();

      logger.info('Manual update completed', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'MANUAL_UPDATE_COMPLETE',
        executionId,
        success: result.success
      });

      return result;
    } catch (error: any) {
      logger.error('Manual update failed', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'MANUAL_UPDATE_ERROR',
        executionId
      }, error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get scheduler configuration
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Update scheduler configuration
   */
  updateConfig(newConfig: Partial<SchedulerConfig>): void {
    Object.assign(this.config, newConfig);
    
    // Restart scheduler if cron expression or timezone changed
    if (newConfig.cronExpression || newConfig.timezone) {
      this.stop();
      this.setupScheduler();
      if (this.config.enabled) {
        this.start();
      }
    }

    logger.info('Scheduler configuration updated', {
      component: 'DAILY_UPDATE_SCHEDULER',
      operation: 'UPDATE_CONFIG',
      config: this.config
    });
  }

  /**
   * Get download source configuration
   */
  getDownloadSource(sourceName: string): DownloadSource | null {
    return this.downloadSources.get(sourceName) || null;
  }

  /**
   * Update download source configuration
   */
  updateDownloadSource(sourceName: string, source: Partial<DownloadSource>): void {
    const existingSource = this.downloadSources.get(sourceName);
    if (!existingSource) {
      throw new Error(`Download source not found: ${sourceName}`);
    }

    const updatedSource = { ...existingSource, ...source };
    this.downloadSources.set(sourceName, updatedSource);

    logger.info('Download source configuration updated', {
      component: 'DAILY_UPDATE_SCHEDULER',
      operation: 'UPDATE_DOWNLOAD_SOURCE',
      source: sourceName,
      config: updatedSource
    });
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): SchedulerExecutionResult[] {
    const actualLimit = limit || this.executionHistory.length;
    return this.executionHistory.slice(0, actualLimit);
  }

  /**
   * Get scheduler statistics
   */
  getStats(): any {
    const recentExecution = this.executionHistory[0];
    
    return {
      service: 'Daily Update Scheduler',
      status: this.isRunning ? 'running' : 'idle',
      enabled: this.config.enabled,
      cronExpression: this.config.cronExpression,
      timezone: this.config.timezone,
      lastExecution: this.lastExecution?.toISOString(),
      isSchedulerRunning: (this.cronJob as any)?.running || false,
      downloadSources: Object.fromEntries(this.downloadSources),
      recentExecution,
      executionHistoryCount: this.executionHistory.length,
      config: this.config
    };
  }

  /**
   * Check if scheduler needs to run
   */
  needsExecution(): boolean {
    if (!this.lastExecution) return true;
    
    const now = new Date();
    const hoursSinceExecution = (now.getTime() - this.lastExecution.getTime()) / (1000 * 60 * 60);
    return hoursSinceExecution > 24;
  }

  /**
   * Initialize scheduler
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Daily Update Scheduler', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'INITIALIZE'
      });

      // Initialize dependencies
      if (!dataIngestionService.isReady()) {
        await dataIngestionService.initialize();
      }

      // Start scheduler if enabled
      if (this.config.enabled) {
        this.start();
      }

      logger.info('Daily Update Scheduler initialized', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'INITIALIZE_COMPLETE',
        enabled: this.config.enabled
      });
    } catch (error: any) {
      logger.error('Error initializing Daily Update Scheduler', {
        component: 'DAILY_UPDATE_SCHEDULER',
        operation: 'INITIALIZE_ERROR'
      }, error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    logger.info('Cleaning up Daily Update Scheduler', {
      component: 'DAILY_UPDATE_SCHEDULER',
      operation: 'CLEANUP'
    });

    this.stop();
    
    if (this.cronJob) {
      (this.cronJob as any).destroy();
      this.cronJob = null;
    }
  }

  /**
   * Check if scheduler is ready
   */
  isReady(): boolean {
    return !this.isRunning && dataIngestionService.isReady();
  }
}

// Export singleton instance
export const dailyUpdateScheduler = new DailyUpdateScheduler();