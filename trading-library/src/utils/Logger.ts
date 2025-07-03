/**
 * Logger Utility for Unified Trading API
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private logLevel: LogLevel;
  private enableLogging: boolean;

  constructor(logLevel: LogLevel = 'info', enableLogging: boolean = true) {
    this.logLevel = logLevel;
    this.enableLogging = enableLogging;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.enableLogging) return false;

    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [UnifiedTradingAPI]`;
    return `${prefix} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), ...args);
    }
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  setLoggingEnabled(enabled: boolean): void {
    this.enableLogging = enabled;
  }
}
