/**
 * Frontend logging service that integrates with backend logging system
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface LogContext {
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  brokerName?: string;
  accountId?: string;
  page?: string;
  feature?: string;
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
  url?: string;
  userAgent?: string;
}

class FrontendLogger {
  private logLevel: LogLevel;
  private globalContext: LogContext = {};
  private logBuffer: LogEntry[] = [];
  private maxBufferSize: number = 100;
  private flushInterval: number = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.logLevel = this.getLogLevelFromEnv();
    this.initializeGlobalContext();
    this.startPeriodicFlush();
  }

  private getLogLevelFromEnv(): LogLevel {
    const envLevel = import.meta.env.VITE_LOG_LEVEL?.toLowerCase() as LogLevel;
    const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'critical'];
    
    if (envLevel && validLevels.includes(envLevel)) {
      return envLevel;
    }
    
    return import.meta.env.DEV ? 'debug' : 'info';
  }

  private initializeGlobalContext(): void {
    this.globalContext = {
      sessionId: this.getOrCreateSessionId(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      component: 'FRONTEND'
    };

    // Add user context if available
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        this.globalContext.userId = userData.id || userData.userId;
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }

  private getOrCreateSessionId(): string {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
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
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      context: { ...this.globalContext, ...context },
      data,
      error: error ? this.serializeError(error) : undefined,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
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

  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(8);
    const contextStr = Object.keys(entry.context).length > 0 
      ? ` [${Object.entries(entry.context)
          .filter(([_, value]) => value !== undefined && value !== null)
          .map(([key, value]) => `${key}=${value}`)
          .join(', ')}]` 
      : '';
    
    return `[${timestamp}] [${level}]${contextStr} ${entry.message}`;
  }

  private log(level: LogLevel, message: string, context: LogContext = {}, data?: any, error?: any): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = this.createLogEntry(level, message, context, data, error);
    
    // Add to buffer for sending to backend
    this.addToBuffer(entry);

    // Console output
    const formattedMessage = this.formatLogEntry(entry);
    
    switch (level) {
      case 'debug':
        console.debug(formattedMessage, data || '');
        break;
      case 'info':
        console.log(formattedMessage, data || '');
        break;
      case 'warn':
        console.warn(formattedMessage, data || '');
        break;
      case 'error':
      case 'critical':
        console.error(formattedMessage, error || '');
        break;
    }

    // Send critical errors immediately
    if (level === 'critical') {
      this.flushLogs();
    }
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Maintain buffer size limit
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logsToSend = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // Send logs to backend API
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      await fetch(`${apiBaseUrl}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ logs: logsToSend })
      });
    } catch (error) {
      // If sending fails, add logs back to buffer (but don't log this error to avoid recursion)
      this.logBuffer.unshift(...logsToSend);
      console.warn('Failed to send logs to backend:', error);
    }
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

  error(message: string, context: LogContext = {}, error?: any): void {
    this.log('error', message, context, undefined, error);
  }

  critical(message: string, context: LogContext = {}, error?: any): void {
    this.log('critical', message, context, undefined, error);
  }

  // Specialized logging methods
  logUserAction(action: string, context: LogContext = {}, data?: any): void {
    this.info(`User action: ${action}`, {
      ...context,
      component: 'USER_ACTION',
      action
    }, data);
  }

  logPageView(page: string, context: LogContext = {}): void {
    this.info(`Page view: ${page}`, {
      ...context,
      component: 'NAVIGATION',
      page,
      action: 'PAGE_VIEW'
    });
  }

  logApiCall(method: string, url: string, duration: number, status: number, context: LogContext = {}): void {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    this.log(level, `API ${method.toUpperCase()} ${url} - ${status} (${duration}ms)`, {
      ...context,
      component: 'API_CLIENT',
      action: 'API_CALL',
      method,
      url,
      duration,
      status
    });
  }

  logError(error: unknown, context: LogContext = {}): void {
    this.error('Application error', {
      ...context,
      component: 'ERROR_HANDLER'
    }, error);
  }

  // Context management
  setGlobalContext(context: LogContext): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  updateUserContext(userId: string): void {
    this.setGlobalContext({ userId });
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushLogs(); // Final flush
  }
}

// Export singleton instance
export const frontendLogger = new FrontendLogger();

// Export convenience functions
export const logUserAction = frontendLogger.logUserAction.bind(frontendLogger);
export const logPageView = frontendLogger.logPageView.bind(frontendLogger);
export const logApiCall = frontendLogger.logApiCall.bind(frontendLogger);
export const logError = frontendLogger.logError.bind(frontendLogger);

export default frontendLogger;