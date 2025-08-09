/**
 * Production Error Logging Configuration
 * Comprehensive error logging setup for production environment
 * Addresses requirements 6.3, 6.4 for log levels, retention, rotation, and security
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure logs directory exists with proper permissions
const logsDir = path.join(__dirname, '../logs');
const errorLogsDir = path.join(logsDir, 'errors');
const archivedLogsDir = path.join(logsDir, 'archived');

// Create directories if they don't exist
[logsDir, errorLogsDir, archivedLogsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o750 }); // Restricted permissions
  }
});

/**
 * Production Error Logging Configuration
 */
class ProductionErrorLoggingConfig {
  constructor() {
    this.environment = process.env.NODE_ENV || 'production';
    this.initializeConfig();
  }

  initializeConfig() {
    // Log Level Configuration
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3,
      TRACE: 4
    };

    // Production Log Level (configurable via environment)
    this.currentLogLevel = this.getProductionLogLevel();

    // Log Retention Policies
    this.retention = {
      errorLogs: {
        maxAge: parseInt(process.env.ERROR_LOG_RETENTION_DAYS || '30') * 24 * 60 * 60 * 1000, // 30 days
        maxSize: parseInt(process.env.ERROR_LOG_MAX_SIZE_MB || '100') * 1024 * 1024, // 100MB
        maxFiles: parseInt(process.env.ERROR_LOG_MAX_FILES || '50') // 50 files
      },
      traceLogs: {
        maxAge: parseInt(process.env.TRACE_LOG_RETENTION_DAYS || '7') * 24 * 60 * 60 * 1000, // 7 days
        maxSize: parseInt(process.env.TRACE_LOG_MAX_SIZE_MB || '50') * 1024 * 1024, // 50MB
        maxFiles: parseInt(process.env.TRACE_LOG_MAX_FILES || '20') // 20 files
      },
      analyticsLogs: {
        maxAge: parseInt(process.env.ANALYTICS_LOG_RETENTION_DAYS || '90') * 24 * 60 * 60 * 1000, // 90 days
        maxSize: parseInt(process.env.ANALYTICS_LOG_MAX_SIZE_MB || '200') * 1024 * 1024, // 200MB
        maxFiles: parseInt(process.env.ANALYTICS_LOG_MAX_FILES || '100') // 100 files
      }
    };

    // Log Rotation Configuration
    this.rotation = {
      enabled: process.env.ERROR_LOG_ROTATION_ENABLED !== 'false',
      frequency: process.env.ERROR_LOG_ROTATION_FREQUENCY || 'daily', // daily, hourly, weekly
      maxSize: parseInt(process.env.ERROR_LOG_ROTATION_SIZE_MB || '10') * 1024 * 1024, // 10MB
      compress: process.env.ERROR_LOG_COMPRESSION_ENABLED !== 'false',
      archivePattern: process.env.ERROR_LOG_ARCHIVE_PATTERN || 'YYYY-MM-DD'
    };

    // Security Configuration
    this.security = {
      encryptLogs: process.env.ERROR_LOG_ENCRYPTION_ENABLED === 'true',
      encryptionKey: process.env.ERROR_LOG_ENCRYPTION_KEY || this.generateEncryptionKey(),
      accessControl: {
        enabled: process.env.ERROR_LOG_ACCESS_CONTROL_ENABLED !== 'false',
        allowedRoles: (process.env.ERROR_LOG_ALLOWED_ROLES || 'admin,developer').split(','),
        requireAuthentication: process.env.ERROR_LOG_REQUIRE_AUTH !== 'false',
        auditAccess: process.env.ERROR_LOG_AUDIT_ACCESS !== 'false'
      },
      sanitization: {
        enabled: process.env.ERROR_LOG_SANITIZATION_ENABLED !== 'false',
        removePasswords: true,
        removeTokens: true,
        removePII: true,
        maskSensitiveData: true
      }
    };

    // Performance Configuration
    this.performance = {
      asyncLogging: process.env.ERROR_LOG_ASYNC_ENABLED !== 'false',
      batchSize: parseInt(process.env.ERROR_LOG_BATCH_SIZE || '100'),
      flushInterval: parseInt(process.env.ERROR_LOG_FLUSH_INTERVAL_MS || '5000'), // 5 seconds
      maxMemoryBuffer: parseInt(process.env.ERROR_LOG_MAX_MEMORY_MB || '50') * 1024 * 1024, // 50MB
      compressionLevel: parseInt(process.env.ERROR_LOG_COMPRESSION_LEVEL || '6') // 1-9
    };

    // File Paths Configuration
    this.filePaths = {
      error: path.join(errorLogsDir, 'error.log'),
      critical: path.join(errorLogsDir, 'critical.log'),
      trace: path.join(errorLogsDir, 'trace.log'),
      analytics: path.join(errorLogsDir, 'analytics.log'),
      audit: path.join(errorLogsDir, 'audit.log'),
      performance: path.join(errorLogsDir, 'performance.log'),
      security: path.join(errorLogsDir, 'security.log'),
      archived: archivedLogsDir
    };

    // Database Configuration for Error Logs
    this.database = {
      enabled: process.env.ERROR_LOG_DATABASE_ENABLED !== 'false',
      collection: process.env.ERROR_LOG_COLLECTION || 'error_logs',
      indexing: {
        enabled: true,
        indexes: [
          { traceId: 1, timestamp: -1 },
          { level: 1, timestamp: -1 },
          { component: 1, errorType: 1, timestamp: -1 },
          { 'context.userId': 1, timestamp: -1 },
          { 'context.brokerName': 1, timestamp: -1 },
          { timestamp: -1 }, // For time-based queries
          { resolved: 1, timestamp: -1 } // For resolution tracking
        ]
      },
      ttl: {
        enabled: process.env.ERROR_LOG_DB_TTL_ENABLED !== 'false',
        errorLogs: parseInt(process.env.ERROR_LOG_DB_TTL_DAYS || '90') * 24 * 60 * 60, // 90 days
        traceLogs: parseInt(process.env.TRACE_LOG_DB_TTL_DAYS || '30') * 24 * 60 * 60 // 30 days
      }
    };

    // Alerting Configuration
    this.alerting = {
      enabled: process.env.ERROR_LOG_ALERTING_ENABLED === 'true',
      thresholds: {
        errorRate: parseFloat(process.env.ERROR_RATE_ALERT_THRESHOLD || '0.05'), // 5%
        criticalErrors: parseInt(process.env.CRITICAL_ERROR_ALERT_THRESHOLD || '5'), // 5 per hour
        systemErrors: parseInt(process.env.SYSTEM_ERROR_ALERT_THRESHOLD || '10'), // 10 per hour
        diskUsage: parseFloat(process.env.LOG_DISK_USAGE_ALERT_THRESHOLD || '0.8') // 80%
      },
      channels: {
        email: process.env.ERROR_ALERT_EMAIL_ENABLED === 'true',
        slack: process.env.ERROR_ALERT_SLACK_ENABLED === 'true',
        webhook: process.env.ERROR_ALERT_WEBHOOK_ENABLED === 'true'
      }
    };

    // Monitoring Configuration
    this.monitoring = {
      enabled: process.env.ERROR_LOG_MONITORING_ENABLED !== 'false',
      healthCheck: {
        interval: parseInt(process.env.ERROR_LOG_HEALTH_CHECK_INTERVAL_MS || '60000'), // 1 minute
        timeout: parseInt(process.env.ERROR_LOG_HEALTH_CHECK_TIMEOUT_MS || '5000'), // 5 seconds
        retries: parseInt(process.env.ERROR_LOG_HEALTH_CHECK_RETRIES || '3')
      },
      metrics: {
        enabled: process.env.ERROR_LOG_METRICS_ENABLED !== 'false',
        interval: parseInt(process.env.ERROR_LOG_METRICS_INTERVAL_MS || '300000'), // 5 minutes
        retention: parseInt(process.env.ERROR_LOG_METRICS_RETENTION_HOURS || '24') * 60 * 60 * 1000 // 24 hours
      }
    };
  }

  getProductionLogLevel() {
    const envLevel = (process.env.ERROR_LOG_LEVEL || 'ERROR').toUpperCase();
    return this.logLevels[envLevel] !== undefined ? this.logLevels[envLevel] : this.logLevels.ERROR;
  }

  generateEncryptionKey() {
    if (this.environment === 'production') {
      console.warn('⚠️  ERROR_LOG_ENCRYPTION_KEY not set. Generating temporary key. Set a permanent key for production!');
    }
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get log rotation schedule based on frequency
   */
  getRotationSchedule() {
    const schedules = {
      hourly: '0 * * * *',     // Every hour
      daily: '0 0 * * *',      // Daily at midnight
      weekly: '0 0 * * 0',     // Weekly on Sunday
      monthly: '0 0 1 * *'     // Monthly on 1st
    };
    return schedules[this.rotation.frequency] || schedules.daily;
  }

  /**
   * Get file path for specific log type with rotation
   */
  getLogFilePath(logType, includeRotation = false) {
    const basePath = this.filePaths[logType];
    if (!includeRotation) {
      return basePath;
    }

    const now = new Date();
    const dateStr = this.formatDateForRotation(now);
    const ext = path.extname(basePath);
    const name = path.basename(basePath, ext);
    const dir = path.dirname(basePath);
    
    return path.join(dir, `${name}.${dateStr}${ext}`);
  }

  formatDateForRotation(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');

    switch (this.rotation.frequency) {
      case 'hourly':
        return `${year}-${month}-${day}-${hour}`;
      case 'daily':
        return `${year}-${month}-${day}`;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-W${this.getWeekNumber(weekStart)}`;
      case 'monthly':
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];

    // Check required directories
    if (!fs.existsSync(this.filePaths.archived)) {
      errors.push('Archived logs directory does not exist');
    }

    // Check disk space
    try {
      const stats = fs.statSync(logsDir);
      // Add disk space check logic here if needed
    } catch (error) {
      errors.push('Cannot access logs directory');
    }

    // Validate retention policies
    if (this.retention.errorLogs.maxAge < 24 * 60 * 60 * 1000) {
      errors.push('Error log retention period too short (minimum 1 day)');
    }

    // Validate security settings
    if (this.security.encryptLogs && !this.security.encryptionKey) {
      errors.push('Encryption enabled but no encryption key provided');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get sanitization rules for sensitive data
   */
  getSanitizationRules() {
    return {
      passwords: /password["\s]*[:=]["\s]*[^"\s,}]+/gi,
      tokens: /token["\s]*[:=]["\s]*[^"\s,}]+/gi,
      apiKeys: /api[_-]?key["\s]*[:=]["\s]*[^"\s,}]+/gi,
      secrets: /secret["\s]*[:=]["\s]*[^"\s,}]+/gi,
      creditCards: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
      emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      phones: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/g
    };
  }

  /**
   * Get configuration summary for logging
   */
  getConfigSummary() {
    return {
      environment: this.environment,
      logLevel: Object.keys(this.logLevels)[this.currentLogLevel],
      retention: {
        errorLogs: `${this.retention.errorLogs.maxAge / (24 * 60 * 60 * 1000)} days`,
        traceLogs: `${this.retention.traceLogs.maxAge / (24 * 60 * 60 * 1000)} days`
      },
      rotation: {
        enabled: this.rotation.enabled,
        frequency: this.rotation.frequency,
        compression: this.rotation.compress
      },
      security: {
        encryption: this.security.encryptLogs,
        accessControl: this.security.accessControl.enabled,
        sanitization: this.security.sanitization.enabled
      },
      performance: {
        asyncLogging: this.performance.asyncLogging,
        batchSize: this.performance.batchSize
      },
      monitoring: {
        enabled: this.monitoring.enabled,
        alerting: this.alerting.enabled
      }
    };
  }
}

// Export singleton instance
const productionErrorLoggingConfig = new ProductionErrorLoggingConfig();

// Validate configuration on startup
const validation = productionErrorLoggingConfig.validate();
if (!validation.valid) {
  console.error('❌ Production Error Logging Configuration Errors:');
  validation.errors.forEach(error => console.error(`   - ${error}`));
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
} else {
  console.log('✅ Production Error Logging Configuration validated successfully');
  console.log('📊 Configuration Summary:', JSON.stringify(productionErrorLoggingConfig.getConfigSummary(), null, 2));
}

module.exports = productionErrorLoggingConfig;