/**
 * Error Log Cleanup Service
 * Implements automated cleanup procedures for old error logs
 * Addresses requirements 6.1, 6.3 for automated cleanup and maintenance
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

interface CleanupConfig {
  enabled: boolean;
  schedules: {
    database: string; // Cron expression for database cleanup
    files: string; // Cron expression for file cleanup
    analytics: string; // Cron expression for analytics cleanup
  };
  retention: {
    errorLogs: number; // Days to keep error logs
    traceLogs: number; // Days to keep trace logs
    analyticsLogs: number; // Days to keep analytics logs
    resolvedErrors: number; // Days to keep resolved errors
  };
  batchSize: number; // Number of records to process in each batch
  maxExecutionTime: number; // Maximum execution time in milliseconds
}

interface CleanupResult {
  timestamp: Date;
  type: 'database' | 'files' | 'analytics';
  recordsProcessed: number;
  recordsDeleted: number;
  filesDeleted: number;
  spaceFreed: number; // Bytes
  executionTime: number; // Milliseconds
  errors: string[];
}

interface CleanupStats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalRecordsDeleted: number;
  totalFilesDeleted: number;
  totalSpaceFreed: number;
  lastRun?: Date;
  lastSuccessfulRun?: Date;
  averageExecutionTime: number;
}

export class ErrorLogCleanupService {
  private static instance: ErrorLogCleanupService;
  private config!: CleanupConfig;
  private isRunning: boolean = false;
  private cleanupJobs: Map<string, cron.ScheduledTask> = new Map();
  private cleanupHistory: CleanupResult[] = [];
  private stats!: CleanupStats;
  private maxHistoryEntries = 1000;

  private constructor() {
    this.loadConfiguration();
    this.initializeStats();
  }

  public static getInstance(): ErrorLogCleanupService {
    if (!ErrorLogCleanupService.instance) {
      ErrorLogCleanupService.instance = new ErrorLogCleanupService();
    }
    return ErrorLogCleanupService.instance;
  }

  /**
   * Load cleanup configuration
   */
  private loadConfiguration(): void {
    try {
      const productionConfig = require('../../config/production-error-logging.config.js');
      
      this.config = {
        enabled: process.env.ERROR_LOG_CLEANUP_ENABLED !== 'false',
        schedules: {
          database: process.env.ERROR_LOG_DB_CLEANUP_SCHEDULE || '0 1 * * *', // Daily at 1 AM
          files: process.env.ERROR_LOG_FILE_CLEANUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
          analytics: process.env.ERROR_LOG_ANALYTICS_CLEANUP_SCHEDULE || '0 3 * * 0' // Weekly on Sunday at 3 AM
        },
        retention: {
          errorLogs: parseInt(process.env.ERROR_LOG_RETENTION_DAYS || '30'),
          traceLogs: parseInt(process.env.TRACE_LOG_RETENTION_DAYS || '7'),
          analyticsLogs: parseInt(process.env.ANALYTICS_LOG_RETENTION_DAYS || '90'),
          resolvedErrors: parseInt(process.env.RESOLVED_ERROR_RETENTION_DAYS || '7')
        },
        batchSize: parseInt(process.env.ERROR_LOG_CLEANUP_BATCH_SIZE || '1000'),
        maxExecutionTime: parseInt(process.env.ERROR_LOG_CLEANUP_MAX_TIME_MS || '300000') // 5 minutes
      };

      logger.info('Error log cleanup configuration loaded', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'LOAD_CONFIGURATION',
        enabled: this.config.enabled,
        retention: this.config.retention
      });
    } catch (error) {
      logger.error('Failed to load cleanup configuration', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'LOAD_CONFIGURATION'
      }, error);

      // Fallback to default configuration
      this.config = {
        enabled: true,
        schedules: {
          database: '0 1 * * *',
          files: '0 2 * * *',
          analytics: '0 3 * * 0'
        },
        retention: {
          errorLogs: 30,
          traceLogs: 7,
          analyticsLogs: 90,
          resolvedErrors: 7
        },
        batchSize: 1000,
        maxExecutionTime: 300000
      };
    }
  }

  /**
   * Initialize cleanup statistics
   */
  private initializeStats(): void {
    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      totalRecordsDeleted: 0,
      totalFilesDeleted: 0,
      totalSpaceFreed: 0,
      averageExecutionTime: 0
    };
  }

  /**
   * Start cleanup service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Error log cleanup service is already running', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'START'
      });
      return;
    }

    if (!this.config.enabled) {
      logger.info('Error log cleanup service is disabled', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'START'
      });
      return;
    }

    try {
      logger.info('Starting error log cleanup service', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'START'
      });

      // Schedule cleanup jobs
      await this.scheduleCleanupJobs();

      // Perform initial cleanup if needed
      await this.performInitialCleanup();

      this.isRunning = true;

      logger.info('Error log cleanup service started successfully', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'START',
        scheduledJobs: this.cleanupJobs.size
      });
    } catch (error) {
      logger.error('Failed to start error log cleanup service', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'START'
      }, error);
      throw error;
    }
  }

  /**
   * Stop cleanup service
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('Stopping error log cleanup service', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'STOP'
      });

      // Stop all scheduled jobs
      this.cleanupJobs.forEach((job, name) => {
        job.stop();
        logger.debug(`Stopped cleanup job: ${name}`, {
          component: 'ERROR_LOG_CLEANUP_SERVICE',
          operation: 'STOP_JOB'
        });
      });

      this.cleanupJobs.clear();
      this.isRunning = false;

      logger.info('Error log cleanup service stopped successfully', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'STOP'
      });
    } catch (error) {
      logger.error('Failed to stop error log cleanup service', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'STOP'
      }, error);
      throw error;
    }
  }

  /**
   * Schedule cleanup jobs
   */
  private async scheduleCleanupJobs(): Promise<void> {
    // Database cleanup job
    const databaseJob = cron.schedule(this.config.schedules.database, async () => {
      await this.performDatabaseCleanup();
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    databaseJob.start();
    this.cleanupJobs.set('database-cleanup', databaseJob);

    // File cleanup job
    const fileJob = cron.schedule(this.config.schedules.files, async () => {
      await this.performFileCleanup();
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    fileJob.start();
    this.cleanupJobs.set('file-cleanup', fileJob);

    // Analytics cleanup job
    const analyticsJob = cron.schedule(this.config.schedules.analytics, async () => {
      await this.performAnalyticsCleanup();
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    analyticsJob.start();
    this.cleanupJobs.set('analytics-cleanup', analyticsJob);

    logger.debug('Scheduled cleanup jobs', {
      component: 'ERROR_LOG_CLEANUP_SERVICE',
      operation: 'SCHEDULE_CLEANUP_JOBS',
      jobs: Array.from(this.cleanupJobs.keys())
    });
  }

  /**
   * Perform initial cleanup on service start
   */
  private async performInitialCleanup(): Promise<void> {
    logger.info('Performing initial cleanup check', {
      component: 'ERROR_LOG_CLEANUP_SERVICE',
      operation: 'INITIAL_CLEANUP'
    });

    try {
      // Check if cleanup is needed based on last run time
      const lastRun = this.stats.lastRun;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (!lastRun || lastRun < oneDayAgo) {
        logger.info('Performing initial database cleanup', {
          component: 'ERROR_LOG_CLEANUP_SERVICE',
          operation: 'INITIAL_CLEANUP'
        });
        await this.performDatabaseCleanup();
      }
    } catch (error) {
      logger.error('Failed to perform initial cleanup', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'INITIAL_CLEANUP'
      }, error);
    }
  }

  /**
   * Perform database cleanup
   */
  private async performDatabaseCleanup(): Promise<void> {
    const startTime = Date.now();
    const result: CleanupResult = {
      timestamp: new Date(),
      type: 'database',
      recordsProcessed: 0,
      recordsDeleted: 0,
      filesDeleted: 0,
      spaceFreed: 0,
      executionTime: 0,
      errors: []
    };

    try {
      logger.info('Starting database cleanup', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'PERFORM_DATABASE_CLEANUP'
      });

      // Clean up old error logs
      const errorLogResult = await this.cleanupOldErrorLogs();
      result.recordsProcessed += errorLogResult.processed;
      result.recordsDeleted += errorLogResult.deleted;
      result.errors.push(...errorLogResult.errors);

      // Clean up old trace logs
      const traceLogResult = await this.cleanupOldTraceLogs();
      result.recordsProcessed += traceLogResult.processed;
      result.recordsDeleted += traceLogResult.deleted;
      result.errors.push(...traceLogResult.errors);

      // Clean up resolved errors
      const resolvedErrorResult = await this.cleanupResolvedErrors();
      result.recordsProcessed += resolvedErrorResult.processed;
      result.recordsDeleted += resolvedErrorResult.deleted;
      result.errors.push(...resolvedErrorResult.errors);

      result.executionTime = Date.now() - startTime;

      // Update statistics
      this.updateStats(result);

      logger.info('Database cleanup completed', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'PERFORM_DATABASE_CLEANUP',
        recordsDeleted: result.recordsDeleted,
        executionTime: result.executionTime,
        errors: result.errors.length
      });
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.executionTime = Date.now() - startTime;
      
      logger.error('Database cleanup failed', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'PERFORM_DATABASE_CLEANUP'
      }, error);
    } finally {
      this.cleanupHistory.push(result);
      this.trimCleanupHistory();
    }
  }

  /**
   * Clean up old error logs
   */
  private async cleanupOldErrorLogs(): Promise<{
    processed: number;
    deleted: number;
    errors: string[];
  }> {
    const cutoffDate = new Date(Date.now() - this.config.retention.errorLogs * 24 * 60 * 60 * 1000);
    const errors: string[] = [];
    let processed = 0;
    let deleted = 0;

    try {
      const startTime = Date.now();
      
      while (Date.now() - startTime < this.config.maxExecutionTime) {
        // Find old error logs in batches
        const oldLogs = await ErrorLog.find({
          timestamp: { $lt: cutoffDate }
        })
        .limit(this.config.batchSize)
        .select('_id');

        if (oldLogs.length === 0) {
          break; // No more logs to process
        }

        processed += oldLogs.length;

        // Delete the batch
        const deleteResult = await ErrorLog.deleteMany({
          _id: { $in: oldLogs.map(log => log._id) }
        });

        deleted += deleteResult.deletedCount || 0;

        logger.debug(`Deleted batch of old error logs`, {
          component: 'ERROR_LOG_CLEANUP_SERVICE',
          operation: 'CLEANUP_OLD_ERROR_LOGS',
          batchSize: oldLogs.length,
          deleted: deleteResult.deletedCount
        });

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`Cleaned up old error logs`, {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'CLEANUP_OLD_ERROR_LOGS',
        processed,
        deleted,
        cutoffDate
      });
    } catch (error) {
      errors.push(`Error log cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Failed to cleanup old error logs', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'CLEANUP_OLD_ERROR_LOGS'
      }, error);
    }

    return { processed, deleted, errors };
  }

  /**
   * Clean up old trace logs
   */
  private async cleanupOldTraceLogs(): Promise<{
    processed: number;
    deleted: number;
    errors: string[];
  }> {
    const cutoffDate = new Date(Date.now() - this.config.retention.traceLogs * 24 * 60 * 60 * 1000);
    const errors: string[] = [];
    let processed = 0;
    let deleted = 0;

    try {
      const startTime = Date.now();
      
      while (Date.now() - startTime < this.config.maxExecutionTime) {
        // Find old trace logs in batches
        const oldTraces = await TraceLifecycle.find({
          startTime: { $lt: cutoffDate }
        })
        .limit(this.config.batchSize)
        .select('_id');

        if (oldTraces.length === 0) {
          break; // No more traces to process
        }

        processed += oldTraces.length;

        // Delete the batch
        const deleteResult = await TraceLifecycle.deleteMany({
          _id: { $in: oldTraces.map(trace => trace._id) }
        });

        deleted += deleteResult.deletedCount || 0;

        logger.debug(`Deleted batch of old trace logs`, {
          component: 'ERROR_LOG_CLEANUP_SERVICE',
          operation: 'CLEANUP_OLD_TRACE_LOGS',
          batchSize: oldTraces.length,
          deleted: deleteResult.deletedCount
        });

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`Cleaned up old trace logs`, {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'CLEANUP_OLD_TRACE_LOGS',
        processed,
        deleted,
        cutoffDate
      });
    } catch (error) {
      errors.push(`Trace log cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Failed to cleanup old trace logs', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'CLEANUP_OLD_TRACE_LOGS'
      }, error);
    }

    return { processed, deleted, errors };
  }

  /**
   * Clean up resolved errors
   */
  private async cleanupResolvedErrors(): Promise<{
    processed: number;
    deleted: number;
    errors: string[];
  }> {
    const cutoffDate = new Date(Date.now() - this.config.retention.resolvedErrors * 24 * 60 * 60 * 1000);
    const errors: string[] = [];
    let processed = 0;
    let deleted = 0;

    try {
      const startTime = Date.now();
      
      while (Date.now() - startTime < this.config.maxExecutionTime) {
        // Find old resolved errors in batches
        const resolvedErrors = await ErrorLog.find({
          resolved: true,
          resolvedAt: { $lt: cutoffDate }
        })
        .limit(this.config.batchSize)
        .select('_id');

        if (resolvedErrors.length === 0) {
          break; // No more resolved errors to process
        }

        processed += resolvedErrors.length;

        // Delete the batch
        const deleteResult = await ErrorLog.deleteMany({
          _id: { $in: resolvedErrors.map(error => error._id) }
        });

        deleted += deleteResult.deletedCount || 0;

        logger.debug(`Deleted batch of resolved errors`, {
          component: 'ERROR_LOG_CLEANUP_SERVICE',
          operation: 'CLEANUP_RESOLVED_ERRORS',
          batchSize: resolvedErrors.length,
          deleted: deleteResult.deletedCount
        });

        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`Cleaned up resolved errors`, {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'CLEANUP_RESOLVED_ERRORS',
        processed,
        deleted,
        cutoffDate
      });
    } catch (error) {
      errors.push(`Resolved error cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      logger.error('Failed to cleanup resolved errors', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'CLEANUP_RESOLVED_ERRORS'
      }, error);
    }

    return { processed, deleted, errors };
  }

  /**
   * Perform file cleanup
   */
  private async performFileCleanup(): Promise<void> {
    const startTime = Date.now();
    const result: CleanupResult = {
      timestamp: new Date(),
      type: 'files',
      recordsProcessed: 0,
      recordsDeleted: 0,
      filesDeleted: 0,
      spaceFreed: 0,
      executionTime: 0,
      errors: []
    };

    try {
      logger.info('Starting file cleanup', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'PERFORM_FILE_CLEANUP'
      });

      // Get log directories from configuration
      const productionConfig = require('../../config/production-error-logging.config.js');
      const logDirs = [
        path.dirname(productionConfig.filePaths.error),
        productionConfig.filePaths.archived
      ];

      for (const logDir of logDirs) {
        if (fs.existsSync(logDir)) {
          const cleanupResult = await this.cleanupLogDirectory(logDir);
          result.filesDeleted += cleanupResult.filesDeleted;
          result.spaceFreed += cleanupResult.spaceFreed;
          result.errors.push(...cleanupResult.errors);
        }
      }

      result.executionTime = Date.now() - startTime;

      // Update statistics
      this.updateStats(result);

      logger.info('File cleanup completed', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'PERFORM_FILE_CLEANUP',
        filesDeleted: result.filesDeleted,
        spaceFreed: result.spaceFreed,
        executionTime: result.executionTime
      });
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.executionTime = Date.now() - startTime;
      
      logger.error('File cleanup failed', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'PERFORM_FILE_CLEANUP'
      }, error);
    } finally {
      this.cleanupHistory.push(result);
      this.trimCleanupHistory();
    }
  }

  /**
   * Clean up log directory
   */
  private async cleanupLogDirectory(directory: string): Promise<{
    filesDeleted: number;
    spaceFreed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let filesDeleted = 0;
    let spaceFreed = 0;

    try {
      const files = await readdir(directory);
      const cutoffDate = new Date(Date.now() - this.config.retention.errorLogs * 24 * 60 * 60 * 1000);

      for (const file of files) {
        const filePath = path.join(directory, file);
        
        try {
          const stats = await stat(filePath);
          
          // Delete files older than retention period
          if (stats.mtime < cutoffDate && (file.endsWith('.log') || file.endsWith('.log.gz'))) {
            spaceFreed += stats.size;
            await unlink(filePath);
            filesDeleted++;
            
            logger.debug(`Deleted old log file: ${file}`, {
              component: 'ERROR_LOG_CLEANUP_SERVICE',
              operation: 'CLEANUP_LOG_DIRECTORY',
              file,
              size: stats.size,
              age: Math.floor((Date.now() - stats.mtime.getTime()) / (24 * 60 * 60 * 1000)) + ' days'
            });
          }
        } catch (fileError) {
          errors.push(`Failed to process file ${file}: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        }
      }

      logger.debug(`Cleaned up log directory: ${directory}`, {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'CLEANUP_LOG_DIRECTORY',
        directory,
        filesDeleted,
        spaceFreed
      });
    } catch (error) {
      errors.push(`Failed to cleanup directory ${directory}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { filesDeleted, spaceFreed, errors };
  }

  /**
   * Perform analytics cleanup
   */
  private async performAnalyticsCleanup(): Promise<void> {
    const startTime = Date.now();
    const result: CleanupResult = {
      timestamp: new Date(),
      type: 'analytics',
      recordsProcessed: 0,
      recordsDeleted: 0,
      filesDeleted: 0,
      spaceFreed: 0,
      executionTime: 0,
      errors: []
    };

    try {
      logger.info('Starting analytics cleanup', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'PERFORM_ANALYTICS_CLEANUP'
      });

      // Clean up old analytics data (if you have separate analytics collections)
      // This is a placeholder - implement based on your analytics data structure
      
      result.executionTime = Date.now() - startTime;

      // Update statistics
      this.updateStats(result);

      logger.info('Analytics cleanup completed', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'PERFORM_ANALYTICS_CLEANUP',
        executionTime: result.executionTime
      });
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.executionTime = Date.now() - startTime;
      
      logger.error('Analytics cleanup failed', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'PERFORM_ANALYTICS_CLEANUP'
      }, error);
    } finally {
      this.cleanupHistory.push(result);
      this.trimCleanupHistory();
    }
  }

  /**
   * Update cleanup statistics
   */
  private updateStats(result: CleanupResult): void {
    this.stats.totalRuns++;
    this.stats.lastRun = result.timestamp;

    if (result.errors.length === 0) {
      this.stats.successfulRuns++;
      this.stats.lastSuccessfulRun = result.timestamp;
    } else {
      this.stats.failedRuns++;
    }

    this.stats.totalRecordsDeleted += result.recordsDeleted;
    this.stats.totalFilesDeleted += result.filesDeleted;
    this.stats.totalSpaceFreed += result.spaceFreed;

    // Update average execution time
    const totalExecutionTime = this.cleanupHistory.reduce((sum, r) => sum + r.executionTime, 0);
    this.stats.averageExecutionTime = totalExecutionTime / this.cleanupHistory.length;
  }

  /**
   * Trim cleanup history to prevent memory issues
   */
  private trimCleanupHistory(): void {
    if (this.cleanupHistory.length > this.maxHistoryEntries) {
      this.cleanupHistory = this.cleanupHistory.slice(-this.maxHistoryEntries);
    }
  }

  /**
   * Force cleanup of all types
   */
  public async forceCleanup(): Promise<{
    database: CleanupResult;
    files: CleanupResult;
    analytics: CleanupResult;
  }> {
    logger.info('Forcing cleanup of all types', {
      component: 'ERROR_LOG_CLEANUP_SERVICE',
      operation: 'FORCE_CLEANUP'
    });

    const results = {
      database: null as CleanupResult | null,
      files: null as CleanupResult | null,
      analytics: null as CleanupResult | null
    };

    try {
      // Perform all cleanup types
      await Promise.all([
        this.performDatabaseCleanup(),
        this.performFileCleanup(),
        this.performAnalyticsCleanup()
      ]);

      // Get the latest results
      const recentResults = this.cleanupHistory.slice(-3);
      results.database = recentResults.find(r => r.type === 'database') || null;
      results.files = recentResults.find(r => r.type === 'files') || null;
      results.analytics = recentResults.find(r => r.type === 'analytics') || null;

      logger.info('Force cleanup completed', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'FORCE_CLEANUP'
      });
    } catch (error) {
      logger.error('Force cleanup failed', {
        component: 'ERROR_LOG_CLEANUP_SERVICE',
        operation: 'FORCE_CLEANUP'
      }, error);
      throw error;
    }

    return results as any;
  }

  /**
   * Get cleanup statistics
   */
  public getStats(): CleanupStats {
    return { ...this.stats };
  }

  /**
   * Get cleanup history
   */
  public getHistory(limit?: number): CleanupResult[] {
    const history = [...this.cleanupHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get service status
   */
  public getStatus(): {
    isRunning: boolean;
    enabled: boolean;
    scheduledJobs: number;
    lastRun?: Date;
    nextRun?: Date;
    stats: CleanupStats;
  } {
    return {
      isRunning: this.isRunning,
      enabled: this.config.enabled,
      scheduledJobs: this.cleanupJobs.size,
      ...(this.stats.lastRun && { lastRun: this.stats.lastRun }),
      stats: this.stats
    };
  }
}

// Export singleton instance
export const errorLogCleanupService = ErrorLogCleanupService.getInstance();