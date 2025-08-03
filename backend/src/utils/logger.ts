/**
 * Comprehensive logging system with context tracking and structured logging
 */

import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { EnhancedError, ErrorContext } from '../types/errorTypes';
import { errorLoggingService } from '../services/errorLoggingService';
import { traceIdService } from '../services/traceIdService';
import { robustErrorLoggingService } from '../services/robustErrorLoggingService';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogContext {
  requestId?: string | undefined;
  userId?: string | undefined;
  brokerName?: string | undefined;
  accountId?: string | undefined;
  operation?: string | undefined;
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
  sessionId?: string | undefined;
  component?: string | undefined;
  method?: string | undefined;
  duration?: number | undefined;
  status?: number | undefined;
  url?: string | undefined;
  errorId?: string | undefined;
  errorType?: string | undefined;
  severity?: string | undefined;
  retryCount?: number | undefined;
  responseSize?: number | undefined;
  [key: string]: any;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  context: LogContext;
  data?: any;
  error?: any;
  stackTrace?: string;
}

export interface Logger {
  debug(message: string, context?: LogContext, data?: any): void;
  info(message: string, context?: LogContext, data?: any): void;
  warn(message: string, context?: LogContext, data?: any): void;
  error(message: string, context?: LogContext, error?: any): void;
  critical(message: string, context?: LogContext, error?: any): void;
  
  // Specialized logging methods
  logApiCall(method: string, url: string, duration: number, status: number, context?: LogContext): void;
  logUserAction(action: string, userId: string, context?: LogContext, data?: any): void;
  logBrokerOperation(operation: string, brokerName: string, context?: LogContext, data?: any): void;
  logSystemEvent(event: string, context?: LogContext, data?: any): void;
  logError(error: EnhancedError): void;
  
  // Enhanced error logging with trace ID
  logErrorWithTrace(message: string, error: any, context: LogContext & { component: string; operation: string }): Promise<string>;
  logWarningWithTrace(message: string, context: LogContext & { component: string; operation: string }): Promise<string>;
  logInfoWithTrace(message: string, context: LogContext & { component: string; operation: string }): Promise<string>;
  
  // Context management
  createChildLogger(context: LogContext): Logger;
  setGlobalContext(context: LogContext): void;
}

export class EnhancedLogger implements Logger {
  private globalContext: LogContext = {};
  private logLevel: LogLevel;
  private logEntries: LogEntry[] = [];
  private maxLogEntries: number = 10000;
  private fileLoggingEnabled: boolean = false;
  private databaseLoggingEnabled: boolean = false;
  private logDirectory: string = '';
  private logFiles: { [key: string]: fs.WriteStream } = {};

  constructor(context: LogContext = {}) {
    this.globalContext = context;
    this.logLevel = this.getLogLevelFromEnv();
    this.initializeFileLogging();
  }

  private initializeFileLogging(): void {
    try {
      // Check if file logging should be enabled
      this.fileLoggingEnabled = process.env.ENABLE_FILE_LOGGING !== 'false';
      
      // Check if database logging should be enabled
      this.databaseLoggingEnabled = process.env.ENABLE_DATABASE_LOGGING !== 'false';
      
      if (this.fileLoggingEnabled) {
        this.logDirectory = path.join(__dirname, '../../logs');
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(this.logDirectory)) {
          fs.mkdirSync(this.logDirectory, { recursive: true });
        }
        
        // Create errors subdirectory
        const errorsDir = path.join(this.logDirectory, 'errors');
        if (!fs.existsSync(errorsDir)) {
          fs.mkdirSync(errorsDir, { recursive: true });
        }
        
        // Initialize log file streams
        this.initializeLogStreams();
      }
    } catch (error) {
      console.warn('Failed to initialize file logging:', error);
      this.fileLoggingEnabled = false;
    }
  }

  private initializeLogStreams(): void {
    if (!this.fileLoggingEnabled) return;
    
    const logFiles = {
      error: 'errors/error.log',
      critical: 'errors/critical.log',
      trace: 'errors/trace.log',
      all: 'errors/all.log'
    };
    
    for (const [type, filename] of Object.entries(logFiles)) {
      const filePath = path.join(this.logDirectory, filename);
      try {
        this.logFiles[type] = fs.createWriteStream(filePath, { flags: 'a' });
      } catch (error) {
        console.warn(`Failed to create log stream for ${type}:`, error);
      }
    }
  }

  private getLogLevelFromEnv(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
    const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];
    
    if (envLevel && validLevels.includes(envLevel)) {
      return envLevel;
    }
    
    return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      critical: 4
    };
    
    return levels[level] >= levels[this.logLevel];
  }

  private createLogEntry(level: LogLevel, message: string, context: LogContext = {}, data?: any, error?: any): LogEntry {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      level,
      message,
      context: { ...this.globalContext, ...context },
      data,
      error: error ? this.serializeError(error) : undefined,
      stackTrace: error?.stack
    };

    // Store log entry for aggregation
    this.storeLogEntry(entry);
    
    return entry;
  }

  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return error;
  }

  private storeLogEntry(entry: LogEntry): void {
    this.logEntries.push(entry);
    
    // Maintain max log entries limit
    if (this.logEntries.length > this.maxLogEntries) {
      this.logEntries = this.logEntries.slice(-this.maxLogEntries);
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(8);
    const contextStr = Object.keys(entry.context).length > 0 
      ? ` [${Object.entries(entry.context)
          .filter(([_, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')}]` 
      : '';
    
    let logLine = `[${timestamp}] [${level}]${contextStr} ${entry.message}`;
    
    if (entry.data) {
      logLine += ` | Data: ${JSON.stringify(entry.data)}`;
    }
    
    if (entry.error) {
      logLine += ` | Error: ${JSON.stringify(entry.error)}`;
    }
    
    return logLine;
  }

  private log(level: LogLevel, message: string, context: LogContext = {}, data?: any, error?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, context, data, error);
    const formattedMessage = this.formatLogEntry(entry);

    // Output to appropriate console method
    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.log(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
      case 'critical':
        console.error(formattedMessage);
        if (entry.stackTrace) {
          console.error(entry.stackTrace);
        }
        break;
    }

    // Write to file if file logging is enabled
    this.writeToFile(level, formattedMessage, entry);

    // Use robust error logging service for error and critical levels (configurable)
    if ((level === 'error' || level === 'critical') && this.shouldLogToDatabase()) {
      // Don't await to prevent blocking the main thread
      robustErrorLoggingService.logError(level, message, context, { data, error })
        .catch(loggingError => {
          // Don't use logger.error here to prevent infinite loops
          console.error('Robust error logging failed:', loggingError);
        });
    }

    // In production, you might want to send critical errors to external logging service
    if (level === 'critical' && process.env.NODE_ENV === 'production') {
      this.sendToExternalLoggingService(entry);
    }
  }

  private writeToFile(level: LogLevel, formattedMessage: string, entry: LogEntry): void {
    if (!this.fileLoggingEnabled || !this.logFiles) {
      return;
    }

    try {
      // Write to all.log for all levels
      if (this.logFiles.all) {
        this.logFiles.all.write(formattedMessage + '\n');
      }

      // Write to specific level files
      if (level === 'error' && this.logFiles.error) {
        this.logFiles.error.write(formattedMessage + '\n');
        if (entry.stackTrace) {
          this.logFiles.error.write(entry.stackTrace + '\n');
        }
      } else if (level === 'critical' && this.logFiles.critical) {
        this.logFiles.critical.write(formattedMessage + '\n');
        if (entry.stackTrace) {
          this.logFiles.critical.write(entry.stackTrace + '\n');
        }
      } else if ((level === 'debug' || level === 'info' || level === 'warn') && this.logFiles.trace) {
        this.logFiles.trace.write(formattedMessage + '\n');
      }
    } catch (error) {
      // Don't use logger here to prevent infinite loops
      console.warn('Failed to write to log file:', error);
    }
  }

  private sendToExternalLoggingService(entry: LogEntry): void {
    // Placeholder for external logging service integration
    // This could be Sentry, LogRocket, CloudWatch, etc.
    console.log('📤 Sending critical error to external logging service:', entry.id);
  }

  // Core logging methods
  debug(message: string, context: LogContext = {}, data?: any): void {
    this.log('debug', message, context, data);
  }

  info(message: string, context: LogContext = {}, data?: any): void {
    this.log('info', message, context, data);
  }

  warn(message: string, context: LogContext = {}, data?: any): void {
    this.log('warn', message, context, data);
  }

  error(message: string, contextOrError?: LogContext | any, error?: any): void {
    // Handle backward compatibility: if second param looks like an error, treat it as such
    if (contextOrError && (contextOrError.message || contextOrError.stack || contextOrError instanceof Error || contextOrError.name)) {
      this.log('error', message, {}, undefined, contextOrError);
    } else {
      this.log('error', message, contextOrError || {}, undefined, error);
    }
  }

  critical(message: string, context: LogContext = {}, error?: any): void {
    this.log('critical', message, context, undefined, error);
  }

  // Specialized logging methods
  logApiCall(method: string, url: string, duration: number, status: number, context: LogContext = {}): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const message = `API ${method.toUpperCase()} ${url} - ${status} (${duration}ms)`;
    
    this.log(level, message, {
      ...context,
      component: 'API',
      method,
      url,
      duration,
      status
    });
  }

  logUserAction(action: string, userId: string, context: LogContext = {}, data?: any): void {
    this.info(`User action: ${action}`, {
      ...context,
      component: 'USER_ACTION',
      userId,
      operation: action
    }, data);
  }

  logBrokerOperation(operation: string, brokerName: string, context: LogContext = {}, data?: any): void {
    this.info(`Broker operation: ${operation}`, {
      ...context,
      component: 'BROKER',
      brokerName,
      operation
    }, data);
  }

  logSystemEvent(event: string, context: LogContext = {}, data?: any): void {
    this.info(`System event: ${event}`, {
      ...context,
      component: 'SYSTEM',
      operation: event
    }, data);
  }

  logError(error: EnhancedError): void {
    this.error(`Enhanced error: ${error.userMessage}`, {
      requestId: error.context.requestId,
      userId: error.context.userId,
      brokerName: error.context.brokerName,
      accountId: error.context.accountId,
      operation: error.context.operation,
      component: 'ERROR_HANDLER',
      errorId: error.id,
      errorType: error.type,
      severity: error.severity,
      retryCount: error.retryCount
    }, {
      classification: error.classification,
      originalError: error.originalError
    });
  }

  // Enhanced error logging with trace ID integration
  async logErrorWithTrace(
    message: string, 
    error: any, 
    context: LogContext & { component: string; operation: string }
  ): Promise<string> {
    // Log to console immediately
    this.error(message, context, error);

    // Log to enhanced error logging service
    try {
      const errorId = await errorLoggingService.logError(message, error, {
        traceId: context.requestId, // Use requestId as traceId if available
        component: context.component,
        operation: context.operation,
        source: 'BE',
        userId: context.userId,
        sessionId: context.sessionId,
        brokerName: context.brokerName,
        accountId: context.accountId,
        url: context.url,
        method: context.method,
        statusCode: context.status,
        duration: context.duration,
        retryCount: context.retryCount,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress
      });
      return errorId;
    } catch (loggingError) {
      this.error('Failed to log error to enhanced logging service', {
        component: 'LOGGER',
        operation: 'LOG_ERROR_WITH_TRACE'
      }, loggingError);
      return '';
    }
  }

  async logWarningWithTrace(
    message: string, 
    context: LogContext & { component: string; operation: string }
  ): Promise<string> {
    // Log to console immediately
    this.warn(message, context);

    // Log to enhanced error logging service
    try {
      const errorId = await errorLoggingService.logWarning(message, {
        traceId: context.requestId,
        component: context.component,
        operation: context.operation,
        source: 'BE',
        userId: context.userId,
        brokerName: context.brokerName
      });
      return errorId;
    } catch (loggingError) {
      this.error('Failed to log warning to enhanced logging service', {
        component: 'LOGGER',
        operation: 'LOG_WARNING_WITH_TRACE'
      }, loggingError);
      return '';
    }
  }

  async logInfoWithTrace(
    message: string, 
    context: LogContext & { component: string; operation: string }
  ): Promise<string> {
    // Log to console immediately
    this.info(message, context);

    // Log to enhanced error logging service
    try {
      const errorId = await errorLoggingService.logInfo(message, {
        traceId: context.requestId,
        component: context.component,
        operation: context.operation,
        source: 'BE',
        userId: context.userId,
        brokerName: context.brokerName
      });
      return errorId;
    } catch (loggingError) {
      this.error('Failed to log info to enhanced logging service', {
        component: 'LOGGER',
        operation: 'LOG_INFO_WITH_TRACE'
      }, loggingError);
      return '';
    }
  }

  // Context management
  createChildLogger(context: LogContext): Logger {
    return new EnhancedLogger({ ...this.globalContext, ...context });
  }

  setGlobalContext(context: LogContext): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  // Log aggregation and analysis methods
  getLogEntries(level?: LogLevel, limit?: number): LogEntry[] {
    let entries = level ? this.logEntries.filter(entry => entry.level === level) : this.logEntries;
    return limit ? entries.slice(-limit) : entries;
  }

  getErrorSummary(timeWindow: number = 3600000): { [key: string]: number } {
    const cutoff = new Date(Date.now() - timeWindow);
    const recentErrors = this.logEntries.filter(
      entry => entry.timestamp >= cutoff && (entry.level === 'error' || entry.level === 'critical')
    );

    const summary: { [key: string]: number } = {};
    recentErrors.forEach(entry => {
      const key = entry.context.component || 'unknown';
      summary[key] = (summary[key] || 0) + 1;
    });

    return summary;
  }

  clearLogs(): void {
    this.logEntries = [];
  }

  // File logging management
  enableFileLogging(): void {
    this.fileLoggingEnabled = true;
    this.initializeFileLogging();
  }

  disableFileLogging(): void {
    this.fileLoggingEnabled = false;
    this.closeLogStreams();
  }

  private closeLogStreams(): void {
    for (const [type, stream] of Object.entries(this.logFiles)) {
      try {
        stream.end();
      } catch (error) {
        console.warn(`Failed to close log stream for ${type}:`, error);
      }
    }
    this.logFiles = {};
  }

  // Check if database logging should be enabled
  private shouldLogToDatabase(): boolean {
    return this.databaseLoggingEnabled;
  }

  // Enable/disable database logging
  enableDatabaseLogging(): void {
    this.databaseLoggingEnabled = true;
  }

  disableDatabaseLogging(): void {
    this.databaseLoggingEnabled = false;
  }

  // Cleanup method for graceful shutdown
  shutdown(): void {
    this.closeLogStreams();
  }
}

// Export singleton instance
export const logger = new EnhancedLogger();

// Export individual functions for convenience (backward compatibility)
export const info = (message: string, context?: LogContext | any, ...args: any[]) => {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    logger.info(message, context, args.length > 0 ? args[0] : undefined);
  } else {
    logger.info(message, {}, context);
  }
};

export const warn = (message: string, context?: LogContext | any, ...args: any[]) => {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    logger.warn(message, context, args.length > 0 ? args[0] : undefined);
  } else {
    logger.warn(message, {}, context);
  }
};

export const error = (message: string, contextOrError?: any, errorParam?: any) => {
  // If the second parameter looks like an error (has message or stack), treat it as an error
  if (contextOrError && (contextOrError.message || contextOrError.stack || contextOrError instanceof Error || contextOrError.name)) {
    logger.error(message, {}, contextOrError);
  } else if (contextOrError && typeof contextOrError === 'object' && !Array.isArray(contextOrError) && !contextOrError.message && !contextOrError.stack) {
    // If it looks like a context object (has typical context properties), use it as context
    logger.error(message, contextOrError, errorParam);
  } else {
    // Fallback: treat as error
    logger.error(message, {}, contextOrError);
  }
};

export const debug = (message: string, context?: LogContext | any, ...args: any[]) => {
  if (context && typeof context === 'object' && !Array.isArray(context)) {
    logger.debug(message, context, args.length > 0 ? args[0] : undefined);
  } else {
    logger.debug(message, {}, context);
  }
};

export default logger;
