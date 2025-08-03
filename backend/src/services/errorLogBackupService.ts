/**
 * Error Log Backup and Recovery Service
 * Sets up backup and recovery procedures for error log data
 * Addresses requirements 6.1, 6.3 for backup and recovery procedures
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

interface BackupConfig {
  enabled: boolean;
  schedule: string; // Cron expression
  retention: number; // Days to keep backups
  compression: boolean;
  encryption: boolean;
  destinations: {
    local: {
      enabled: boolean;
      path: string;
    };
    cloud: {
      enabled: boolean;
      provider: 'aws' | 'gcp' | 'azure';
      bucket: string;
      region: string;
    };
  };
}

interface BackupResult {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  status: 'success' | 'failed' | 'partial';
  recordsBackedUp: number;
  filesBackedUp: number;
  backupSize: number; // Bytes
  compressionRatio?: number;
  executionTime: number; // Milliseconds
  destination: string;
  errors: string[];
}

export class ErrorLogBackupService {
  private static instance: ErrorLogBackupService;
  private config!: BackupConfig;
  private isRunning: boolean = false;
  private backupJobs: Map<string, cron.ScheduledTask> = new Map();
  private backupHistory: BackupResult[] = [];
  private maxHistoryEntries = 100;

  private constructor() {
    this.loadConfiguration();
  }

  public static getInstance(): ErrorLogBackupService {
    if (!ErrorLogBackupService.instance) {
      ErrorLogBackupService.instance = new ErrorLogBackupService();
    }
    return ErrorLogBackupService.instance;
  }

  /**
   * Load backup configuration
   */
  private loadConfiguration(): void {
    try {
      this.config = {
        enabled: process.env.ERROR_LOG_BACKUP_ENABLED === 'true',
        schedule: process.env.ERROR_LOG_BACKUP_SCHEDULE || '0 4 * * *', // Daily at 4 AM
        retention: parseInt(process.env.ERROR_LOG_BACKUP_RETENTION_DAYS || '30'),
        compression: process.env.ERROR_LOG_BACKUP_COMPRESSION !== 'false',
        encryption: process.env.ERROR_LOG_BACKUP_ENCRYPTION === 'true',
        destinations: {
          local: {
            enabled: process.env.ERROR_LOG_BACKUP_LOCAL_ENABLED !== 'false',
            path: process.env.ERROR_LOG_BACKUP_LOCAL_PATH || path.join(__dirname, '../../backups')
          },
          cloud: {
            enabled: process.env.ERROR_LOG_BACKUP_CLOUD_ENABLED === 'true',
            provider: (process.env.ERROR_LOG_BACKUP_CLOUD_PROVIDER as any) || 'aws',
            bucket: process.env.ERROR_LOG_BACKUP_CLOUD_BUCKET || '',
            region: process.env.ERROR_LOG_BACKUP_CLOUD_REGION || 'us-east-1'
          }
        }
      };

      logger.info('Error log backup configuration loaded', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'LOAD_CONFIGURATION',
        enabled: this.config.enabled,
        localEnabled: this.config.destinations.local.enabled,
        cloudEnabled: this.config.destinations.cloud.enabled
      });
    } catch (error) {
      logger.error('Failed to load backup configuration', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'LOAD_CONFIGURATION'
      }, error);
      throw error;
    }
  }

  /**
   * Start backup service
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Error log backup service is already running', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'START'
      });
      return;
    }

    if (!this.config.enabled) {
      logger.info('Error log backup service is disabled', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'START'
      });
      return;
    }

    try {
      logger.info('Starting error log backup service', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'START'
      });

      // Ensure backup directories exist
      await this.ensureBackupDirectories();

      // Schedule backup jobs
      await this.scheduleBackupJobs();

      this.isRunning = true;

      logger.info('Error log backup service started successfully', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'START'
      });
    } catch (error) {
      logger.error('Failed to start error log backup service', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'START'
      }, error);
      throw error;
    }
  }

  /**
   * Stop backup service
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('Stopping error log backup service', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'STOP'
      });

      // Stop all scheduled jobs
      this.backupJobs.forEach((job, name) => {
        job.stop();
        logger.debug(`Stopped backup job: ${name}`, {
          component: 'ERROR_LOG_BACKUP_SERVICE',
          operation: 'STOP_JOB'
        });
      });

      this.backupJobs.clear();
      this.isRunning = false;

      logger.info('Error log backup service stopped successfully', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'STOP'
      });
    } catch (error) {
      logger.error('Failed to stop error log backup service', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'STOP'
      }, error);
      throw error;
    }
  }

  /**
   * Ensure backup directories exist
   */
  private async ensureBackupDirectories(): Promise<void> {
    if (this.config.destinations.local.enabled) {
      const backupDir = this.config.destinations.local.path;
      
      try {
        if (!fs.existsSync(backupDir)) {
          await mkdir(backupDir, { recursive: true, mode: 0o750 });
          logger.debug(`Created backup directory: ${backupDir}`, {
            component: 'ERROR_LOG_BACKUP_SERVICE',
            operation: 'ENSURE_BACKUP_DIRECTORIES'
          });
        }
      } catch (error) {
        logger.error(`Failed to create backup directory: ${backupDir}`, {
          component: 'ERROR_LOG_BACKUP_SERVICE',
          operation: 'ENSURE_BACKUP_DIRECTORIES'
        }, error);
        throw error;
      }
    }
  }

  /**
   * Schedule backup jobs
   */
  private async scheduleBackupJobs(): Promise<void> {
    const backupJob = cron.schedule(this.config.schedule, async () => {
      await this.performBackup('full');
    }, {
      scheduled: false,
      timezone: process.env.TZ || 'UTC'
    });

    backupJob.start();
    this.backupJobs.set('full-backup', backupJob);

    logger.debug('Scheduled backup job', {
      component: 'ERROR_LOG_BACKUP_SERVICE',
      operation: 'SCHEDULE_BACKUP_JOBS',
      schedule: this.config.schedule
    });
  }

  /**
   * Perform backup
   */
  public async performBackup(type: 'full' | 'incremental' = 'full'): Promise<BackupResult> {
    const startTime = Date.now();
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result: BackupResult = {
      id: backupId,
      timestamp: new Date(),
      type,
      status: 'success',
      recordsBackedUp: 0,
      filesBackedUp: 0,
      backupSize: 0,
      executionTime: 0,
      destination: '',
      errors: []
    };

    try {
      logger.info(`Starting ${type} backup`, {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'PERFORM_BACKUP',
        backupId,
        type
      });

      // Backup to local destination
      if (this.config.destinations.local.enabled) {
        const localResult = await this.backupToLocal(backupId, type);
        result.recordsBackedUp += localResult.recordsBackedUp;
        result.filesBackedUp += localResult.filesBackedUp;
        result.backupSize += localResult.backupSize;
        result.errors.push(...localResult.errors);
        result.destination = 'local';
      }

      // Backup to cloud destination
      if (this.config.destinations.cloud.enabled) {
        const cloudResult = await this.backupToCloud(backupId, type);
        result.recordsBackedUp += cloudResult.recordsBackedUp;
        result.filesBackedUp += cloudResult.filesBackedUp;
        result.backupSize += cloudResult.backupSize;
        result.errors.push(...cloudResult.errors);
        result.destination += result.destination ? ',cloud' : 'cloud';
      }

      result.executionTime = Date.now() - startTime;
      result.status = result.errors.length === 0 ? 'success' : 'partial';

      logger.info(`${type} backup completed`, {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'PERFORM_BACKUP',
        backupId,
        status: result.status as any,
        recordsBackedUp: result.recordsBackedUp,
        backupSize: result.backupSize,
        executionTime: result.executionTime
      });
    } catch (error) {
      result.status = 'failed';
      result.errors.push(error instanceof Error ? error.message : String(error));
      result.executionTime = Date.now() - startTime;
      
      logger.error(`${type} backup failed`, {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'PERFORM_BACKUP',
        backupId
      }, error);
    } finally {
      this.backupHistory.push(result);
      this.trimBackupHistory();
    }

    return result;
  }

  /**
   * Backup to local destination
   */
  private async backupToLocal(backupId: string, type: 'full' | 'incremental'): Promise<{
    recordsBackedUp: number;
    filesBackedUp: number;
    backupSize: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let recordsBackedUp = 0;
    let filesBackedUp = 0;
    let backupSize = 0;

    try {
      const backupDir = path.join(this.config.destinations.local.path, backupId);
      await mkdir(backupDir, { recursive: true });

      // Backup error logs
      const errorLogResult = await this.backupErrorLogs(backupDir, type);
      recordsBackedUp += errorLogResult.recordsBackedUp;
      backupSize += errorLogResult.backupSize;
      errors.push(...errorLogResult.errors);
      filesBackedUp++;

      // Backup trace logs
      const traceLogResult = await this.backupTraceLogs(backupDir, type);
      recordsBackedUp += traceLogResult.recordsBackedUp;
      backupSize += traceLogResult.backupSize;
      errors.push(...traceLogResult.errors);
      filesBackedUp++;

      // Create backup manifest
      const manifest = {
        backupId,
        timestamp: new Date(),
        type,
        recordsBackedUp,
        filesBackedUp,
        backupSize,
        compression: this.config.compression,
        encryption: this.config.encryption
      };

      const manifestPath = path.join(backupDir, 'manifest.json');
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      filesBackedUp++;

      logger.debug('Local backup completed', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'BACKUP_TO_LOCAL',
        backupId,
        recordsBackedUp,
        filesBackedUp,
        backupSize
      });
    } catch (error) {
      errors.push(`Local backup failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { recordsBackedUp, filesBackedUp, backupSize, errors };
  }

  /**
   * Backup error logs
   */
  private async backupErrorLogs(backupDir: string, type: 'full' | 'incremental'): Promise<{
    recordsBackedUp: number;
    backupSize: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let recordsBackedUp = 0;
    let backupSize = 0;

    try {
      // Determine date range for backup
      let query: any = {};
      if (type === 'incremental') {
        const lastBackup = this.getLastSuccessfulBackup();
        if (lastBackup) {
          query.timestamp = { $gte: lastBackup.timestamp };
        }
      }

      // Stream error logs to backup file
      const errorLogs = await ErrorLog.find(query).lean();
      recordsBackedUp = errorLogs.length;

      if (recordsBackedUp > 0) {
        let backupData = JSON.stringify(errorLogs, null, 2);
        
        // Compress if enabled
        if (this.config.compression) {
          backupData = zlib.gzipSync(backupData).toString('base64');
        }

        const backupPath = path.join(backupDir, `error_logs.${this.config.compression ? 'json.gz' : 'json'}`);
        await writeFile(backupPath, backupData);
        
        const stats = await stat(backupPath);
        backupSize = stats.size;
      }

      logger.debug('Error logs backed up', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'BACKUP_ERROR_LOGS',
        recordsBackedUp,
        backupSize
      });
    } catch (error) {
      errors.push(`Error log backup failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { recordsBackedUp, backupSize, errors };
  }

  /**
   * Backup trace logs
   */
  private async backupTraceLogs(backupDir: string, type: 'full' | 'incremental'): Promise<{
    recordsBackedUp: number;
    backupSize: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let recordsBackedUp = 0;
    let backupSize = 0;

    try {
      // Determine date range for backup
      let query: any = {};
      if (type === 'incremental') {
        const lastBackup = this.getLastSuccessfulBackup();
        if (lastBackup) {
          query.startTime = { $gte: lastBackup.timestamp };
        }
      }

      // Stream trace logs to backup file
      const traceLogs = await TraceLifecycle.find(query).lean();
      recordsBackedUp = traceLogs.length;

      if (recordsBackedUp > 0) {
        let backupData = JSON.stringify(traceLogs, null, 2);
        
        // Compress if enabled
        if (this.config.compression) {
          backupData = zlib.gzipSync(backupData).toString('base64');
        }

        const backupPath = path.join(backupDir, `trace_logs.${this.config.compression ? 'json.gz' : 'json'}`);
        await writeFile(backupPath, backupData);
        
        const stats = await stat(backupPath);
        backupSize = stats.size;
      }

      logger.debug('Trace logs backed up', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'BACKUP_TRACE_LOGS',
        recordsBackedUp,
        backupSize
      });
    } catch (error) {
      errors.push(`Trace log backup failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { recordsBackedUp, backupSize, errors };
  }

  /**
   * Backup to cloud destination (placeholder)
   */
  private async backupToCloud(backupId: string, type: 'full' | 'incremental'): Promise<{
    recordsBackedUp: number;
    filesBackedUp: number;
    backupSize: number;
    errors: string[];
  }> {
    // Placeholder for cloud backup implementation
    // This would integrate with AWS S3, Google Cloud Storage, or Azure Blob Storage
    
    logger.debug('Cloud backup not implemented', {
      component: 'ERROR_LOG_BACKUP_SERVICE',
      operation: 'BACKUP_TO_CLOUD',
      backupId
    });

    return {
      recordsBackedUp: 0,
      filesBackedUp: 0,
      backupSize: 0,
      errors: ['Cloud backup not implemented']
    };
  }

  /**
   * Get last successful backup
   */
  private getLastSuccessfulBackup(): BackupResult | null {
    const successfulBackups = this.backupHistory.filter(b => b.status === 'success');
    return successfulBackups.length > 0 ? successfulBackups[successfulBackups.length - 1] || null : null;
  }

  /**
   * Trim backup history
   */
  private trimBackupHistory(): void {
    if (this.backupHistory.length > this.maxHistoryEntries) {
      this.backupHistory = this.backupHistory.slice(-this.maxHistoryEntries);
    }
  }

  /**
   * Restore from backup
   */
  public async restoreFromBackup(backupId: string): Promise<{
    success: boolean;
    recordsRestored: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let recordsRestored = 0;

    try {
      logger.info(`Starting restore from backup: ${backupId}`, {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'RESTORE_FROM_BACKUP',
        backupId
      });

      const backupDir = path.join(this.config.destinations.local.path, backupId);
      
      if (!fs.existsSync(backupDir)) {
        throw new Error(`Backup directory not found: ${backupId}`);
      }

      // Read manifest
      const manifestPath = path.join(backupDir, 'manifest.json');
      const manifestData = await readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestData);

      // Restore error logs
      const errorLogPath = path.join(backupDir, `error_logs.${manifest.compression ? 'json.gz' : 'json'}`);
      if (fs.existsSync(errorLogPath)) {
        const errorLogResult = await this.restoreErrorLogs(errorLogPath, manifest.compression);
        recordsRestored += errorLogResult.recordsRestored;
        errors.push(...errorLogResult.errors);
      }

      // Restore trace logs
      const traceLogPath = path.join(backupDir, `trace_logs.${manifest.compression ? 'json.gz' : 'json'}`);
      if (fs.existsSync(traceLogPath)) {
        const traceLogResult = await this.restoreTraceLogs(traceLogPath, manifest.compression);
        recordsRestored += traceLogResult.recordsRestored;
        errors.push(...traceLogResult.errors);
      }

      logger.info(`Restore completed from backup: ${backupId}`, {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'RESTORE_FROM_BACKUP',
        backupId,
        recordsRestored,
        errors: errors.length
      });

      return {
        success: errors.length === 0,
        recordsRestored,
        errors
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      logger.error(`Restore failed from backup: ${backupId}`, {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'RESTORE_FROM_BACKUP',
        backupId
      }, error);

      return {
        success: false,
        recordsRestored,
        errors
      };
    }
  }

  /**
   * Restore error logs
   */
  private async restoreErrorLogs(filePath: string, compressed: boolean): Promise<{
    recordsRestored: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let recordsRestored = 0;

    try {
      let backupData = await readFile(filePath, 'utf8');
      
      // Decompress if needed
      if (compressed) {
        const buffer = Buffer.from(backupData, 'base64');
        backupData = zlib.gunzipSync(buffer).toString();
      }

      const errorLogs = JSON.parse(backupData);
      
      // Insert error logs in batches
      if (errorLogs.length > 0) {
        await ErrorLog.insertMany(errorLogs, { ordered: false });
        recordsRestored = errorLogs.length;
      }

      logger.debug('Error logs restored', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'RESTORE_ERROR_LOGS',
        recordsRestored
      });
    } catch (error) {
      errors.push(`Error log restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { recordsRestored, errors };
  }

  /**
   * Restore trace logs
   */
  private async restoreTraceLogs(filePath: string, compressed: boolean): Promise<{
    recordsRestored: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let recordsRestored = 0;

    try {
      let backupData = await readFile(filePath, 'utf8');
      
      // Decompress if needed
      if (compressed) {
        const buffer = Buffer.from(backupData, 'base64');
        backupData = zlib.gunzipSync(buffer).toString();
      }

      const traceLogs = JSON.parse(backupData);
      
      // Insert trace logs in batches
      if (traceLogs.length > 0) {
        await TraceLifecycle.insertMany(traceLogs, { ordered: false });
        recordsRestored = traceLogs.length;
      }

      logger.debug('Trace logs restored', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'RESTORE_TRACE_LOGS',
        recordsRestored
      });
    } catch (error) {
      errors.push(`Trace log restore failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { recordsRestored, errors };
  }

  /**
   * List available backups
   */
  public async listBackups(): Promise<{
    id: string;
    timestamp: Date;
    type: 'full' | 'incremental';
    size: number;
    recordCount: number;
  }[]> {
    const backups: any[] = [];

    try {
      if (this.config.destinations.local.enabled) {
        const backupDir = this.config.destinations.local.path;
        
        if (fs.existsSync(backupDir)) {
          const entries = fs.readdirSync(backupDir);
          
          for (const entry of entries) {
            const entryPath = path.join(backupDir, entry);
            const manifestPath = path.join(entryPath, 'manifest.json');
            
            if (fs.existsSync(manifestPath)) {
              try {
                const manifestData = await readFile(manifestPath, 'utf8');
                const manifest = JSON.parse(manifestData);
                
                backups.push({
                  id: manifest.backupId,
                  timestamp: new Date(manifest.timestamp),
                  type: manifest.type,
                  size: manifest.backupSize,
                  recordCount: manifest.recordsBackedUp
                });
              } catch (error) {
                logger.warn(`Failed to read backup manifest: ${entry}`, {
                  component: 'ERROR_LOG_BACKUP_SERVICE',
                  operation: 'LIST_BACKUPS'
                });
              }
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to list backups', {
        component: 'ERROR_LOG_BACKUP_SERVICE',
        operation: 'LIST_BACKUPS'
      }, error);
    }

    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get backup history
   */
  public getBackupHistory(limit?: number): BackupResult[] {
    const history = [...this.backupHistory].reverse(); // Most recent first
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get service status
   */
  public getStatus(): {
    isRunning: boolean;
    enabled: boolean;
    scheduledJobs: number;
    lastBackup?: Date;
    nextBackup?: Date;
    totalBackups: number;
    successfulBackups: number;
  } {
    const successfulBackups = this.backupHistory.filter(b => b.status === 'success').length;
    const lastBackup = this.backupHistory.length > 0 
      ? this.backupHistory[this.backupHistory.length - 1]?.timestamp 
      : undefined;

    return {
      isRunning: this.isRunning,
      enabled: this.config.enabled,
      scheduledJobs: this.backupJobs.size,
      ...(lastBackup && { lastBackup }),
      totalBackups: this.backupHistory.length,
      successfulBackups
    };
  }
}

// Export singleton instance
export const errorLogBackupService = ErrorLogBackupService.getInstance();