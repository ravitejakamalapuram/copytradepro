/**
 * Production Logging Configuration
 * Comprehensive logging setup for production environment
 */

const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

class ProductionLogger {
  constructor() {
    this.logLevel = this.getLogLevel();
    this.enableConsole = process.env.NODE_ENV !== 'production' || process.env.ENABLE_CONSOLE_LOGGING === 'true';
    this.enableFile = process.env.ENABLE_FILE_LOGGING !== 'false';
    this.enableRequestLogging = process.env.ENABLE_REQUEST_LOGGING === 'true';
    
    // Log file paths
    this.logFiles = {
      error: path.join(logsDir, 'error.log'),
      combined: path.join(logsDir, 'combined.log'),
      symbol: path.join(logsDir, 'symbol.log'),
      performance: path.join(logsDir, 'performance.log'),
      security: path.join(logsDir, 'security.log'),
      request: path.join(logsDir, 'request.log')
    };
    
    // Initialize log rotation
    this.initLogRotation();
  }

  getLogLevel() {
    const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
    switch (level) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      case 'trace': return LogLevel.TRACE;
      default: return LogLevel.INFO;
    }
  }

  initLogRotation() {
    // Simple log rotation - keep last 7 days
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    Object.values(this.logFiles).forEach(logFile => {
      if (fs.existsSync(logFile)) {
        const stats = fs.statSync(logFile);
        if (Date.now() - stats.mtime.getTime() > maxAge) {
          const rotatedFile = `${logFile}.${new Date().toISOString().split('T')[0]}`;
          fs.renameSync(logFile, rotatedFile);
        }
      }
    });
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const pid = process.pid;
    const memoryUsage = process.memoryUsage();
    
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      pid,
      message,
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB'
      },
      ...meta
    };
    
    return JSON.stringify(logEntry);
  }

  writeToFile(filename, message) {
    if (!this.enableFile) return;
    
    try {
      fs.appendFileSync(filename, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(level, message, meta = {}) {
    const levelValue = LogLevel[level.toUpperCase()];
    if (levelValue > this.logLevel) return;
    
    const formattedMessage = this.formatMessage(level, message, meta);
    
    // Console output
    if (this.enableConsole) {
      const colors = {
        ERROR: '\x1b[31m',
        WARN: '\x1b[33m',
        INFO: '\x1b[36m',
        DEBUG: '\x1b[35m',
        TRACE: '\x1b[37m'
      };
      
      const color = colors[level.toUpperCase()] || '\x1b[0m';
      console.log(`${color}${formattedMessage}\x1b[0m`);
    }
    
    // File output
    this.writeToFile(this.logFiles.combined, formattedMessage);
    
    // Error-specific file
    if (level.toLowerCase() === 'error') {
      this.writeToFile(this.logFiles.error, formattedMessage);
    }
  }

  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  }

  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  }

  info(message, meta = {}) {
    this.log('INFO', message, meta);
  }

  debug(message, meta = {}) {
    this.log('DEBUG', message, meta);
  }

  trace(message, meta = {}) {
    this.log('TRACE', message, meta);
  }

  // Specialized logging methods
  logSymbolOperation(operation, details = {}) {
    const message = `Symbol Operation: ${operation}`;
    const meta = { category: 'symbol', operation, ...details };
    
    this.info(message, meta);
    this.writeToFile(this.logFiles.symbol, this.formatMessage('INFO', message, meta));
  }

  logPerformance(operation, duration, details = {}) {
    const message = `Performance: ${operation} completed in ${duration}ms`;
    const meta = { category: 'performance', operation, duration, ...details };
    
    this.info(message, meta);
    this.writeToFile(this.logFiles.performance, this.formatMessage('INFO', message, meta));
  }

  logSecurity(event, details = {}) {
    const message = `Security Event: ${event}`;
    const meta = { category: 'security', event, ...details };
    
    this.warn(message, meta);
    this.writeToFile(this.logFiles.security, this.formatMessage('WARN', message, meta));
  }

  logRequest(req, res, duration) {
    if (!this.enableRequestLogging) return;
    
    const message = `${req.method} ${req.url} ${res.statusCode} ${duration}ms`;
    const meta = {
      category: 'request',
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      contentLength: res.get('Content-Length')
    };
    
    this.info(message, meta);
    this.writeToFile(this.logFiles.request, this.formatMessage('INFO', message, meta));
  }

  // Express middleware for request logging
  requestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logRequest(req, res, duration);
      });
      
      next();
    };
  }

  // Error handling middleware
  errorMiddleware() {
    return (error, req, res, next) => {
      const meta = {
        category: 'error',
        url: req.url,
        method: req.method,
        stack: error.stack,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress
      };
      
      this.error(`Request Error: ${error.message}`, meta);
      next(error);
    };
  }

  // Graceful shutdown
  close() {
    this.info('Logger shutting down gracefully');
  }
}

// Create singleton instance
const logger = new ProductionLogger();

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    category: 'system',
    error: error.message,
    stack: error.stack
  });
  
  // Give time for log to be written
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    category: 'system',
    reason: reason?.toString(),
    promise: promise?.toString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  logger.close();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully');
  logger.close();
});

module.exports = logger;