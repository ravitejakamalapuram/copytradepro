/**
 * Monitoring and Alerting Configuration
 * Production monitoring setup for the standardized symbol management system
 */

const logger = require('./logging.config');

class MonitoringConfig {
  constructor() {
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      performance: new Map(),
      symbols: new Map(),
      database: new Map()
    };
    
    this.thresholds = {
      responseTime: parseInt(process.env.RESPONSE_TIME_THRESHOLD || '5000'), // 5 seconds
      errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.05'), // 5%
      memoryUsage: parseInt(process.env.MEMORY_USAGE_THRESHOLD || '500'), // 500MB
      symbolUpdateFailures: parseInt(process.env.SYMBOL_UPDATE_FAILURE_THRESHOLD || '3'),
      databaseConnectionFailures: parseInt(process.env.DB_CONNECTION_FAILURE_THRESHOLD || '5')
    };
    
    this.alerting = {
      enabled: process.env.ALERTING_ENABLED === 'true',
      webhookUrl: process.env.ALERT_WEBHOOK_URL,
      emailEnabled: process.env.EMAIL_ALERTS_ENABLED === 'true',
      slackEnabled: process.env.SLACK_ALERTS_ENABLED === 'true'
    };
    
    // Initialize monitoring intervals
    this.initializeMonitoring();
  }

  initializeMonitoring() {
    // Collect metrics every minute
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000);
    
    // Check thresholds every 5 minutes
    setInterval(() => {
      this.checkThresholds();
    }, 300000);
    
    // Clean old metrics every hour
    setInterval(() => {
      this.cleanOldMetrics();
    }, 3600000);
  }

  // Record request metrics
  recordRequest(req, res, duration) {
    const key = `${req.method}:${req.route?.path || req.url}`;
    const timestamp = Date.now();
    
    if (!this.metrics.requests.has(key)) {
      this.metrics.requests.set(key, []);
    }
    
    this.metrics.requests.get(key).push({
      timestamp,
      duration,
      statusCode: res.statusCode,
      success: res.statusCode < 400
    });
    
    // Log slow requests
    if (duration > this.thresholds.responseTime) {
      logger.logPerformance('Slow Request', duration, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode
      });
    }
  }

  // Record error metrics
  recordError(error, context = {}) {
    const errorType = error.name || 'UnknownError';
    const timestamp = Date.now();
    
    if (!this.metrics.errors.has(errorType)) {
      this.metrics.errors.set(errorType, []);
    }
    
    this.metrics.errors.get(errorType).push({
      timestamp,
      message: error.message,
      stack: error.stack,
      context
    });
    
    logger.error(`Error recorded: ${errorType}`, {
      message: error.message,
      context
    });
  }

  // Record symbol operation metrics
  recordSymbolOperation(operation, success, duration, details = {}) {
    const key = `symbol:${operation}`;
    const timestamp = Date.now();
    
    if (!this.metrics.symbols.has(key)) {
      this.metrics.symbols.set(key, []);
    }
    
    this.metrics.symbols.get(key).push({
      timestamp,
      success,
      duration,
      details
    });
    
    logger.logSymbolOperation(operation, {
      success,
      duration,
      ...details
    });
  }

  // Record database operation metrics
  recordDatabaseOperation(operation, success, duration, details = {}) {
    const key = `db:${operation}`;
    const timestamp = Date.now();
    
    if (!this.metrics.database.has(key)) {
      this.metrics.database.set(key, []);
    }
    
    this.metrics.database.get(key).push({
      timestamp,
      success,
      duration,
      details
    });
    
    if (!success) {
      logger.error(`Database operation failed: ${operation}`, {
        duration,
        ...details
      });
    }
  }

  // Collect system metrics
  collectSystemMetrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const systemMetrics = {
      timestamp: Date.now(),
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime()
    };
    
    // Store system metrics
    if (!this.metrics.performance.has('system')) {
      this.metrics.performance.set('system', []);
    }
    
    this.metrics.performance.get('system').push(systemMetrics);
    
    // Check memory threshold
    if (systemMetrics.memory.rss > this.thresholds.memoryUsage) {
      this.sendAlert('HIGH_MEMORY_USAGE', {
        current: systemMetrics.memory.rss,
        threshold: this.thresholds.memoryUsage,
        unit: 'MB'
      });
    }
  }

  // Check all thresholds
  checkThresholds() {
    this.checkErrorRateThreshold();
    this.checkResponseTimeThreshold();
    this.checkSymbolUpdateThreshold();
    this.checkDatabaseThreshold();
  }

  // Check error rate threshold
  checkErrorRateThreshold() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    let totalRequests = 0;
    let totalErrors = 0;
    
    // Count requests in the last hour
    this.metrics.requests.forEach(requests => {
      const recentRequests = requests.filter(req => req.timestamp > oneHourAgo);
      totalRequests += recentRequests.length;
      totalErrors += recentRequests.filter(req => !req.success).length;
    });
    
    if (totalRequests > 0) {
      const errorRate = totalErrors / totalRequests;
      
      if (errorRate > this.thresholds.errorRate) {
        this.sendAlert('HIGH_ERROR_RATE', {
          errorRate: (errorRate * 100).toFixed(2),
          threshold: (this.thresholds.errorRate * 100).toFixed(2),
          totalRequests,
          totalErrors,
          timeWindow: '1 hour'
        });
      }
    }
  }

  // Check response time threshold
  checkResponseTimeThreshold() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    this.metrics.requests.forEach((requests, endpoint) => {
      const recentRequests = requests.filter(req => req.timestamp > oneHourAgo);
      
      if (recentRequests.length > 0) {
        const avgResponseTime = recentRequests.reduce((sum, req) => sum + req.duration, 0) / recentRequests.length;
        
        if (avgResponseTime > this.thresholds.responseTime) {
          this.sendAlert('HIGH_RESPONSE_TIME', {
            endpoint,
            avgResponseTime: Math.round(avgResponseTime),
            threshold: this.thresholds.responseTime,
            requestCount: recentRequests.length,
            timeWindow: '1 hour'
          });
        }
      }
    });
  }

  // Check symbol update threshold
  checkSymbolUpdateThreshold() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    this.metrics.symbols.forEach((operations, operationType) => {
      const recentOperations = operations.filter(op => op.timestamp > oneHourAgo);
      const failures = recentOperations.filter(op => !op.success);
      
      if (failures.length >= this.thresholds.symbolUpdateFailures) {
        this.sendAlert('SYMBOL_UPDATE_FAILURES', {
          operationType,
          failureCount: failures.length,
          threshold: this.thresholds.symbolUpdateFailures,
          totalOperations: recentOperations.length,
          timeWindow: '1 hour'
        });
      }
    });
  }

  // Check database threshold
  checkDatabaseThreshold() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    this.metrics.database.forEach((operations, operationType) => {
      const recentOperations = operations.filter(op => op.timestamp > oneHourAgo);
      const failures = recentOperations.filter(op => !op.success);
      
      if (failures.length >= this.thresholds.databaseConnectionFailures) {
        this.sendAlert('DATABASE_CONNECTION_FAILURES', {
          operationType,
          failureCount: failures.length,
          threshold: this.thresholds.databaseConnectionFailures,
          totalOperations: recentOperations.length,
          timeWindow: '1 hour'
        });
      }
    });
  }

  // Send alert
  async sendAlert(alertType, data) {
    if (!this.alerting.enabled) {
      return;
    }
    
    const alert = {
      type: alertType,
      timestamp: new Date().toISOString(),
      severity: this.getAlertSeverity(alertType),
      data,
      environment: process.env.NODE_ENV || 'unknown',
      service: 'copytrade-symbol-service'
    };
    
    logger.error(`ALERT: ${alertType}`, alert);
    
    // Send to configured alert channels
    if (this.alerting.webhookUrl) {
      await this.sendWebhookAlert(alert);
    }
    
    // Additional alert channels can be added here
  }

  // Get alert severity
  getAlertSeverity(alertType) {
    const severityMap = {
      HIGH_MEMORY_USAGE: 'WARNING',
      HIGH_ERROR_RATE: 'CRITICAL',
      HIGH_RESPONSE_TIME: 'WARNING',
      SYMBOL_UPDATE_FAILURES: 'CRITICAL',
      DATABASE_CONNECTION_FAILURES: 'CRITICAL'
    };
    
    return severityMap[alertType] || 'INFO';
  }

  // Send webhook alert
  async sendWebhookAlert(alert) {
    try {
      const response = await fetch(this.alerting.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(alert)
      });
      
      if (!response.ok) {
        logger.error('Failed to send webhook alert', {
          status: response.status,
          statusText: response.statusText
        });
      }
    } catch (error) {
      logger.error('Webhook alert failed', {
        error: error.message
      });
    }
  }

  // Clean old metrics (keep last 24 hours)
  cleanOldMetrics() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    [this.metrics.requests, this.metrics.errors, this.metrics.performance, 
     this.metrics.symbols, this.metrics.database].forEach(metricMap => {
      metricMap.forEach((entries, key) => {
        const filtered = entries.filter(entry => entry.timestamp > cutoff);
        metricMap.set(key, filtered);
      });
    });
  }

  // Get current metrics summary
  getMetricsSummary() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const summary = {
      timestamp: new Date().toISOString(),
      requests: {},
      errors: {},
      symbols: {},
      database: {},
      system: {}
    };
    
    // Request metrics
    this.metrics.requests.forEach((requests, endpoint) => {
      const recent = requests.filter(req => req.timestamp > oneHourAgo);
      summary.requests[endpoint] = {
        count: recent.length,
        avgDuration: recent.length > 0 ? Math.round(recent.reduce((sum, req) => sum + req.duration, 0) / recent.length) : 0,
        errorRate: recent.length > 0 ? (recent.filter(req => !req.success).length / recent.length) : 0
      };
    });
    
    // Error metrics
    this.metrics.errors.forEach((errors, errorType) => {
      const recent = errors.filter(err => err.timestamp > oneHourAgo);
      summary.errors[errorType] = recent.length;
    });
    
    // Symbol metrics
    this.metrics.symbols.forEach((operations, operationType) => {
      const recent = operations.filter(op => op.timestamp > oneHourAgo);
      summary.symbols[operationType] = {
        count: recent.length,
        successRate: recent.length > 0 ? (recent.filter(op => op.success).length / recent.length) : 0
      };
    });
    
    // Database metrics
    this.metrics.database.forEach((operations, operationType) => {
      const recent = operations.filter(op => op.timestamp > oneHourAgo);
      summary.database[operationType] = {
        count: recent.length,
        successRate: recent.length > 0 ? (recent.filter(op => op.success).length / recent.length) : 0
      };
    });
    
    // System metrics
    const systemMetrics = this.metrics.performance.get('system') || [];
    const recentSystem = systemMetrics.filter(metric => metric.timestamp > oneHourAgo);
    if (recentSystem.length > 0) {
      const latest = recentSystem[recentSystem.length - 1];
      summary.system = {
        memory: latest.memory,
        uptime: latest.uptime
      };
    }
    
    return summary;
  }

  // Express middleware for request monitoring
  requestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.recordRequest(req, res, duration);
      });
      
      next();
    };
  }
}

// Create singleton instance
const monitoring = new MonitoringConfig();

module.exports = monitoring;