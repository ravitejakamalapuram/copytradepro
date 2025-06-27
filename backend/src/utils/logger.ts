export interface Logger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
  debug: (message: string, ...args: any[]) => void;
}

class SimpleLogger implements Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';

  info(message: string, ...args: any[]): void {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${new Date().toISOString()} ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.debug(`[DEBUG] ${new Date().toISOString()} ${message}`, ...args);
    }
  }
}

// Export singleton instance
export const logger = new SimpleLogger();

// Export individual functions for convenience
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const debug = logger.debug.bind(logger);

export default logger;
