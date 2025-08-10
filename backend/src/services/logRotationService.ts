/**
 * Log Rotation and Archival Service
 * Handles automatic log rotation, compression, and archival for production error logs
 * Addresses requirements 6.3, 6.4 for log rotation and archival processes
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const rename = promisify(fs.rename);
const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

interface LogRotationConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  maxSize: number;
  maxAge: number;
  maxFiles: number;
  compress: boolean;
  archivePattern: string;
}

interface LogFileInfo {
  path: string;
  name: string;
  size: number;
  created: Date;
  modified: Date;
  type: 'error' | 'trace' | 'analytics' | 'audit' | 'performance' | 'security';
}

export class LogRotationService {
  private static instance: LogRotationService;
  private config: any;
  private rotationJobs: Map<string, cron.ScheduledTask> = new Map();
  private cleanupJobs: Map<string, cron.ScheduledTask> = new Map();
  private isRunning: boolean = false;

  private constructor() {
    // Load configuration from production error logging config
    try {
      this.config = require('../../config/production-error-logging.config.js');
    } catch (error) {
      logger.error('Failed to load production error logging configuration', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'CONSTRUCTOR'
      }, error);
      throw error;
    }
  }

  public static getInstance(): LogRotationService {
    if (!LogRotationService.instance) {
      LogRotationService.instance = new LogRotationService();
    }
    return LogRotationService.instance;
  }

  /**
   * Start log rotation service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Log rotation service is already running', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'START'
      });
      return;
    }

    try {
      logger.info('Starting log rotation service', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'START'
      });

      // Ensure directories exist
      await this.ensureDirectories();

      // Schedule rotation jobs
      await this.scheduleRotationJobs();

      // Schedule cleanup jobs
      await this.scheduleCleanupJobs();

      // Perform initial cleanup of old logs
      await this.performInitialCleanup();

      this.isRunning = true;

      logger.info('Log rotation service started successfully', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'START',
        rotationJobs: this.rotationJobs.size,
        cleanupJobs: this.cleanupJobs.size
      });
    } catch (error) {
      logger.error('Failed to start log rotation service', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'START'
      }, error);
      throw error;
    }
  }

  /**
   * Stop log rotation service
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('Stopping log rotation service', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'STOP'
      });

      // Stop all scheduled jobs
      this.rotationJobs.forEach((job, name) => {
        job.stop();
        logger.debug(`Stopped rotation job: ${name}`, {
          component: 'LOG_ROTATION_SERVICE',
          operation: 'STOP_JOB'
        });
      });

      this.cleanupJobs.forEach((job, name) => {
        job.stop();
        logger.debug(`Stopped cleanup job: ${name}`, {
          component: 'LOG_ROTATION_SERVICE',
          operation: 'STOP_JOB'
        });
      });

      this.rotationJobs.clear();
      this.cleanupJobs.clear();
      this.isRunning = false;

      logger.info('Log rotation service stopped successfully', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'STOP'
      });
    } catch (error) {
      logger.error('Failed to stop log rotation service', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'STOP'
      }, error);
      throw error;
    }
  }

  /**
   * Ensure required directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const directories = [
      this.config.filePaths.archived,
      path.dirname(this.config.filePaths.error),
      path.dirname(this.config.filePaths.critical),
      path.dirname(this.config.filePaths.trace),
      path.dirname(this.config.filePaths.analytics)
    ];

    for (const dir of directories) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
          logger.debug(`Created directory: ${dir}`, {
            component: 'LOG_ROTATION_SERVICE',
            operation: 'ENSURE_DIRECTORIES'
          });
        }
      } catch (error) {
        logger.error(`Failed to create directory: ${dir}`, {
          component: 'LOG_ROTATION_SERVICE',
          operation: 'ENSURE_DIRECTORIES'
        }, error);
        throw error;
      }
    }
  }

  /**
   * Schedule rotation jobs based on configuration
   */
  private async scheduleRotationJobs(): Promise<void> {
    if (!this.config.rotation.enabled) {
      logger.info('Log rotation is disabled', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'SCHEDULE_ROTATION_JOBS'
      });
      return;
    }

    const schedule = this.config.getRotationSchedule();
    const logTypes = ['error', 'critical', 'trace', 'analytics', 'audit', 'performance', 'security'];

    for (const logType of logTypes) {
      const jobName = `rotation-${logType}`;
      
      try {
        const job = cron.schedule(schedule, async () => {
          await this.rotateLogFile(logType);
        }, {
          scheduled: false,
          timezone: process.env.TZ || 'UTC'
        });

        job.start();
        this.rotationJobs.set(jobName, job);

        logger.debug(`Scheduled rotation job for ${logType}`, {
          component: 'LOG_ROTATION_SERVICE',
          operation: 'SCHEDULE_ROTATION_JOBS',
          logType,
          schedule
        });
      } catch (error) {
        logger.error(`Failed to schedule rotation job for ${logType}`, {
          component: 'LOG_ROTATION_SERVICE',
          operation: 'SCHEDULE_ROTATION_JOBS',
          logType
        }, error);
      }
    }

    // Schedule size-based rotation check (every 5 minutes)
    const sizeCheckJob = cron.schedule('*/5 * * * *', async () => {
      await this.checkFileSizes();
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    sizeCheckJob.start();
    this.rotationJobs.set('size-check', sizeCheckJob);
  }

  /**
   * Schedule cleanup jobs for old log files
   */
  private async scheduleCleanupJobs(): Promise<void> {
    // Daily cleanup at 2 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldLogs();
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    cleanupJob.start();
    this.cleanupJobs.set('daily-cleanup', cleanupJob);

    // Weekly archive cleanup on Sunday at 3 AM
    const archiveCleanupJob = cron.schedule('0 3 * * 0', async () => {
      await this.cleanupArchivedLogs();
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    archiveCleanupJob.start();
    this.cleanupJobs.set('weekly-archive-cleanup', archiveCleanupJob);

    logger.debug('Scheduled cleanup jobs', {
      component: 'LOG_ROTATION_SERVICE',
      operation: 'SCHEDULE_CLEANUP_JOBS'
    });
  }

  /**
   * Rotate a specific log file
   */
  private async rotateLogFile(logType: string): Promise<void> {
    const currentLogPath = this.config.filePaths[logType];
    
    if (!currentLogPath || !fs.existsSync(currentLogPath)) {
      return;
    }

    try {
      const stats = await stat(currentLogPath);
      const rotatedPath = this.config.getLogFilePath(logType, true);
      
      logger.info(`Rotating log file: ${logType}`, {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'ROTATE_LOG_FILE',
        logType,
        currentPath: currentLogPath,
        rotatedPath,
        size: stats.size
      });

      // Move current log to rotated name
      await rename(currentLogPath, rotatedPath);

      // Compress if enabled
      if (this.config.rotation.compress) {
        await this.compressLogFile(rotatedPath);
      }

      // Move to archive directory
      await this.moveToArchive(rotatedPath, logType);

      logger.info(`Successfully rotated log file: ${logType}`, {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'ROTATE_LOG_FILE',
        logType
      });
    } catch (error) {
      logger.error(`Failed to rotate log file: ${logType}`, {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'ROTATE_LOG_FILE',
        logType
      }, error);
    }
  }

  /**
   * Check file sizes and rotate if necessary
   */
  private async checkFileSizes(): Promise<void> {
    const logTypes = ['error', 'critical', 'trace', 'analytics', 'audit', 'performance', 'security'];

    for (const logType of logTypes) {
      const logPath = this.config.filePaths[logType];
      
      if (!logPath || !fs.existsSync(logPath)) {
        continue;
      }

      try {
        const stats = await stat(logPath);
        
        if (stats.size >= this.config.rotation.maxSize) {
          logger.info(`Log file size limit exceeded, rotating: ${logType}`, {
            component: 'LOG_ROTATION_SERVICE',
            operation: 'CHECK_FILE_SIZES',
            logType,
            size: stats.size,
            maxSize: this.config.rotation.maxSize
          });

          await this.rotateLogFile(logType);
        }
      } catch (error) {
        logger.error(`Failed to check file size for: ${logType}`, {
          component: 'LOG_ROTATION_SERVICE',
          operation: 'CHECK_FILE_SIZES',
          logType
        }, error);
      }
    }
  }

  /**
   * Compress a log file
   */
  private async compressLogFile(filePath: string): Promise<void> {
    const compressedPath = `${filePath}.gz`;

    try {
      const data = await readFile(filePath);
      const compressed = zlib.gzipSync(data, { level: this.config.performance.compressionLevel });
      
      await writeFile(compressedPath, compressed);
      await unlink(filePath);

      logger.debug(`Compressed log file: ${filePath}`, {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'COMPRESS_LOG_FILE',
        originalSize: data.length,
        compressedSize: compressed.length,
        compressionRatio: ((1 - compressed.length / data.length) * 100).toFixed(2) + '%'
      });
    } catch (error) {
      logger.error(`Failed to compress log file: ${filePath}`, {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'COMPRESS_LOG_FILE'
      }, error);
      throw error;
    }
  }

  /**
   * Move log file to archive directory
   */
  private async moveToArchive(filePath: string, logType: string): Promise<void> {
    const fileName = path.basename(filePath);
    const archivePath = path.join(this.config.filePaths.archived, logType, fileName);
    const archiveDir = path.dirname(archivePath);

    try {
      // Ensure archive subdirectory exists
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true, mode: 0o750 });
      }

      await rename(filePath, archivePath);

      logger.debug(`Moved log file to archive: ${fileName}`, {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'MOVE_TO_ARCHIVE',
        logType,
        archivePath
      });
    } catch (error) {
      logger.error(`Failed to move log file to archive: ${filePath}`, {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'MOVE_TO_ARCHIVE',
        logType
      }, error);
      throw error;
    }
  }

  /**
   * Clean up old log files based on retention policies
   */
  private async cleanupOldLogs(): Promise<void> {
    logger.info('Starting cleanup of old log files', {
      component: 'LOG_ROTATION_SERVICE',
      operation: 'CLEANUP_OLD_LOGS'
    });

    const logTypes = ['error', 'critical', 'trace', 'analytics', 'audit', 'performance', 'security'];
    let totalCleaned = 0;

    for (const logType of logTypes) {
      try {
        const cleaned = await this.cleanupLogType(logType);
        totalCleaned += cleaned;
      } catch (error) {
        logger.error(`Failed to cleanup logs for type: ${logType}`, {
          component: 'LOG_ROTATION_SERVICE',
          operation: 'CLEANUP_OLD_LOGS',
          logType
        }, error);
      }
    }

    logger.info('Completed cleanup of old log files', {
      component: 'LOG_ROTATION_SERVICE',
      operation: 'CLEANUP_OLD_LOGS',
      totalCleaned
    });
  }

  /**
   * Clean up logs for a specific type
   */
  private async cleanupLogType(logType: string): Promise<number> {
    const archiveDir = path.join(this.config.filePaths.archived, logType);
    
    if (!fs.existsSync(archiveDir)) {
      return 0;
    }

    const retention = this.config.retention[`${logType}Logs`] || this.config.retention.errorLogs;
    const cutoffDate = new Date(Date.now() - retention.maxAge);
    
    try {
      const files = await readdir(archiveDir);
      const logFiles: LogFileInfo[] = [];

      // Get file information
      for (const file of files) {
        const filePath = path.join(archiveDir, file);
        const stats = await stat(filePath);
        
        logFiles.push({
          path: filePath,
          name: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          type: logType as any
        });
      }

      // Sort by modification time (oldest first)
      logFiles.sort((a, b) => a.modified.getTime() - b.modified.getTime());

      let cleaned = 0;
      let totalSize = logFiles.reduce((sum, file) => sum + file.size, 0);

      // Remove files older than retention period
      for (const file of logFiles) {
        if (file.modified < cutoffDate) {
          await unlink(file.path);
          cleaned++;
          totalSize -= file.size;
          
          logger.debug(`Removed old log file: ${file.name}`, {
            component: 'LOG_ROTATION_SERVICE',
            operation: 'CLEANUP_LOG_TYPE',
            logType,
            age: Math.floor((Date.now() - file.modified.getTime()) / (24 * 60 * 60 * 1000)) + ' days'
          });
        }
      }

      // Remove excess files if over file limit
      const remainingFiles = logFiles.filter(f => f.modified >= cutoffDate);
      if (remainingFiles.length > retention.maxFiles) {
        const excessFiles = remainingFiles.slice(0, remainingFiles.length - retention.maxFiles);
        
        for (const file of excessFiles) {
          await unlink(file.path);
          cleaned++;
          
          logger.debug(`Removed excess log file: ${file.name}`, {
            component: 'LOG_ROTATION_SERVICE',
            operation: 'CLEANUP_LOG_TYPE',
            logType,
            reason: 'file_limit_exceeded'
          });
        }
      }

      // Remove files if total size exceeds limit
      const excessCount = remainingFiles.length - retention.maxFiles;
      const excessFiles = excessCount > 0 ? remainingFiles.slice(0, excessCount) : [];
      const finalFiles = remainingFiles.slice(excessFiles.length || 0);
      let currentSize = finalFiles.reduce((sum, file) => sum + file.size, 0);
      
      if (currentSize > retention.maxSize) {
        for (const file of finalFiles) {
          if (currentSize <= retention.maxSize) break;
          
          await unlink(file.path);
          cleaned++;
          currentSize -= file.size;
          
          logger.debug(`Removed oversized log file: ${file.name}`, {
            component: 'LOG_ROTATION_SERVICE',
            operation: 'CLEANUP_LOG_TYPE',
            logType,
            reason: 'size_limit_exceeded'
          });
        }
      }

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} log files for type: ${logType}`, {
          component: 'LOG_ROTATION_SERVICE',
          operation: 'CLEANUP_LOG_TYPE',
          logType,
          cleaned
        });
      }

      return cleaned;
    } catch (error) {
      logger.error(`Failed to cleanup log type: ${logType}`, {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'CLEANUP_LOG_TYPE',
        logType
      }, error);
      return 0;
    }
  }

  /**
   * Clean up archived logs
   */
  private async cleanupArchivedLogs(): Promise<void> {
    logger.info('Starting cleanup of archived logs', {
      component: 'LOG_ROTATION_SERVICE',
      operation: 'CLEANUP_ARCHIVED_LOGS'
    });

    try {
      const archiveDir = this.config.filePaths.archived;
      
      if (!fs.existsSync(archiveDir)) {
        return;
      }

      const subdirs = await readdir(archiveDir);
      let totalCleaned = 0;

      for (const subdir of subdirs) {
        const subdirPath = path.join(archiveDir, subdir);
        const stats = await stat(subdirPath);
        
        if (stats.isDirectory()) {
          const cleaned = await this.cleanupLogType(subdir);
          totalCleaned += cleaned;
        }
      }

      logger.info('Completed cleanup of archived logs', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'CLEANUP_ARCHIVED_LOGS',
        totalCleaned
      });
    } catch (error) {
      logger.error('Failed to cleanup archived logs', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'CLEANUP_ARCHIVED_LOGS'
      }, error);
    }
  }

  /**
   * Perform initial cleanup on service start
   */
  private async performInitialCleanup(): Promise<void> {
    logger.info('Performing initial log cleanup', {
      component: 'LOG_ROTATION_SERVICE',
      operation: 'INITIAL_CLEANUP'
    });

    try {
      await this.cleanupOldLogs();
      
      logger.info('Initial log cleanup completed', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'INITIAL_CLEANUP'
      });
    } catch (error) {
      logger.error('Failed to perform initial cleanup', {
        component: 'LOG_ROTATION_SERVICE',
        operation: 'INITIAL_CLEANUP'
      }, error);
    }
  }

  /**
   * Get rotation service status
   */
  public getStatus(): {
    isRunning: boolean;
    rotationJobs: number;
    cleanupJobs: number;
    config: any;
  } {
    return {
      isRunning: this.isRunning,
      rotationJobs: this.rotationJobs.size,
      cleanupJobs: this.cleanupJobs.size,
      config: this.config.getConfigSummary()
    };
  }

  /**
   * Force rotation of all log files
   */
  public async forceRotation(): Promise<void> {
    logger.info('Forcing rotation of all log files', {
      component: 'LOG_ROTATION_SERVICE',
      operation: 'FORCE_ROTATION'
    });

    const logTypes = ['error', 'critical', 'trace', 'analytics', 'audit', 'performance', 'security'];

    for (const logType of logTypes) {
      try {
        await this.rotateLogFile(logType);
      } catch (error) {
        logger.error(`Failed to force rotate log: ${logType}`, {
          component: 'LOG_ROTATION_SERVICE',
          operation: 'FORCE_ROTATION',
          logType
        }, error);
      }
    }

    logger.info('Completed forced rotation of all log files', {
      component: 'LOG_ROTATION_SERVICE',
      operation: 'FORCE_ROTATION'
    });
  }
}

// Export singleton instance
export const logRotationService = LogRotationService.getInstance();