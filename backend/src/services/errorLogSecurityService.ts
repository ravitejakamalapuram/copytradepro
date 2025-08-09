/**
 * Error Log Security Service
 * Implements security measures for error log access and data protection
 * Addresses requirements 6.3, 6.4 for security measures and data protection
 */

import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { ErrorLog } from '../models/errorLogModels';

interface SecurityConfig {
  encryptLogs: boolean;
  encryptionKey: string;
  accessControl: {
    enabled: boolean;
    allowedRoles: string[];
    requireAuthentication: boolean;
    auditAccess: boolean;
  };
  sanitization: {
    enabled: boolean;
    removePasswords: boolean;
    removeTokens: boolean;
    removePII: boolean;
    maskSensitiveData: boolean;
  };
}

interface AccessAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userRole: string;
  action: string;
  resource: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
}

interface SanitizationRule {
  name: string;
  pattern: RegExp;
  replacement: string;
  enabled: boolean;
}

export class ErrorLogSecurityService {
  private static instance: ErrorLogSecurityService;
  private config!: SecurityConfig;
  private sanitizationRules!: SanitizationRule[];
  private accessAuditLog: AccessAuditEntry[] = [];
  private encryptionAlgorithm = 'aes-256-gcm';

  private constructor() {
    this.loadConfiguration();
    this.initializeSanitizationRules();
  }

  public static getInstance(): ErrorLogSecurityService {
    if (!ErrorLogSecurityService.instance) {
      ErrorLogSecurityService.instance = new ErrorLogSecurityService();
    }
    return ErrorLogSecurityService.instance;
  }

  /**
   * Load security configuration
   */
  private loadConfiguration(): void {
    try {
      const productionConfig = require('../../config/production-error-logging.config.js');
      this.config = productionConfig.security;
      
      logger.info('Error log security configuration loaded', {
        component: 'ERROR_LOG_SECURITY_SERVICE',
        operation: 'LOAD_CONFIGURATION',
        encryptionEnabled: this.config.encryptLogs,
        accessControlEnabled: this.config.accessControl.enabled,
        sanitizationEnabled: this.config.sanitization.enabled
      });
    } catch (error) {
      logger.error('Failed to load security configuration', {
        component: 'ERROR_LOG_SECURITY_SERVICE',
        operation: 'LOAD_CONFIGURATION'
      }, error);
      
      // Fallback to secure defaults
      this.config = {
        encryptLogs: false,
        encryptionKey: '',
        accessControl: {
          enabled: true,
          allowedRoles: ['admin'],
          requireAuthentication: true,
          auditAccess: true
        },
        sanitization: {
          enabled: true,
          removePasswords: true,
          removeTokens: true,
          removePII: true,
          maskSensitiveData: true
        }
      };
    }
  }

  /**
   * Initialize sanitization rules
   */
  private initializeSanitizationRules(): void {
    this.sanitizationRules = [
      {
        name: 'passwords',
        pattern: /("password"\s*:\s*")[^"]*(")/gi,
        replacement: '$1[REDACTED]$2',
        enabled: this.config.sanitization.removePasswords
      },
      {
        name: 'tokens',
        pattern: /("(?:token|jwt|bearer|auth)"\s*:\s*")[^"]*(")/gi,
        replacement: '$1[REDACTED]$2',
        enabled: this.config.sanitization.removeTokens
      },
      {
        name: 'apiKeys',
        pattern: /("(?:api[_-]?key|secret|client[_-]?secret)"\s*:\s*")[^"]*(")/gi,
        replacement: '$1[REDACTED]$2',
        enabled: this.config.sanitization.removeTokens
      },
      {
        name: 'creditCards',
        pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
        replacement: '[CREDIT_CARD_REDACTED]',
        enabled: this.config.sanitization.removePII
      },
      {
        name: 'emails',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: '[EMAIL_REDACTED]',
        enabled: this.config.sanitization.removePII
      },
      {
        name: 'phones',
        pattern: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
        replacement: '[PHONE_REDACTED]',
        enabled: this.config.sanitization.removePII
      },
      {
        name: 'ssn',
        pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
        replacement: '[SSN_REDACTED]',
        enabled: this.config.sanitization.removePII
      },
      {
        name: 'ipAddresses',
        pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
        replacement: '[IP_REDACTED]',
        enabled: this.config.sanitization.maskSensitiveData
      },
      {
        name: 'sessionIds',
        pattern: /("(?:session[_-]?id|sess)"\s*:\s*")[^"]*(")/gi,
        replacement: '$1[SESSION_REDACTED]$2',
        enabled: this.config.sanitization.maskSensitiveData
      }
    ];

    logger.debug('Sanitization rules initialized', {
      component: 'ERROR_LOG_SECURITY_SERVICE',
      operation: 'INITIALIZE_SANITIZATION_RULES',
      rulesCount: this.sanitizationRules.length,
      enabledRules: this.sanitizationRules.filter(r => r.enabled).length
    });
  }

  /**
   * Authenticate user for error log access
   */
  public async authenticateUser(token: string, requiredRole?: string): Promise<{
    success: boolean;
    user?: any;
    error?: string;
  }> {
    if (!this.config.accessControl.enabled) {
      return { success: true };
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
      
      // Check if user role is allowed
      const userRole = decoded.role || 'user';
      const allowedRoles = requiredRole ? [requiredRole] : this.config.accessControl.allowedRoles;
      
      if (!allowedRoles.includes(userRole)) {
        return {
          success: false,
          error: 'Insufficient permissions to access error logs'
        };
      }

      return {
        success: true,
        user: {
          id: decoded.id,
          email: decoded.email,
          role: userRole
        }
      };
    } catch (error) {
      logger.error('Failed to authenticate user for error log access', {
        component: 'ERROR_LOG_SECURITY_SERVICE',
        operation: 'AUTHENTICATE_USER'
      }, error);

      return {
        success: false,
        error: 'Invalid or expired authentication token'
      };
    }
  }

  /**
   * Authorize user action on error logs
   */
  public async authorizeAction(
    user: any,
    action: string,
    resource: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const auditEntry: AccessAuditEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      userId: user?.id || 'anonymous',
      userRole: user?.role || 'unknown',
      action,
      resource,
      ipAddress: context.ipAddress || 'unknown',
      userAgent: context.userAgent || 'unknown',
      success: false
    };

    try {
      // Check role-based permissions
      const permissions = this.getRolePermissions(user?.role || 'user');
      
      if (!permissions.includes(action)) {
        auditEntry.success = false;
        auditEntry.errorMessage = `Action '${action}' not permitted for role '${user?.role}'`;
        
        if (this.config.accessControl.auditAccess) {
          await this.logAccessAudit(auditEntry);
        }

        return {
          success: false,
          error: auditEntry.errorMessage
        };
      }

      // Additional resource-specific checks
      if (action === 'delete' && !this.canDeleteResource(user, resource)) {
        auditEntry.success = false;
        auditEntry.errorMessage = 'Delete operation not permitted for this resource';
        
        if (this.config.accessControl.auditAccess) {
          await this.logAccessAudit(auditEntry);
        }

        return {
          success: false,
          error: auditEntry.errorMessage
        };
      }

      auditEntry.success = true;
      
      if (this.config.accessControl.auditAccess) {
        await this.logAccessAudit(auditEntry);
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to authorize user action', {
        component: 'ERROR_LOG_SECURITY_SERVICE',
        operation: 'AUTHORIZE_ACTION',
        action,
        resource,
        userId: user?.id
      }, error);

      auditEntry.success = false;
      auditEntry.errorMessage = 'Authorization check failed';
      
      if (this.config.accessControl.auditAccess) {
        await this.logAccessAudit(auditEntry);
      }

      return {
        success: false,
        error: 'Authorization check failed'
      };
    }
  }

  /**
   * Get role-based permissions
   */
  private getRolePermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      admin: ['read', 'write', 'delete', 'export', 'configure'],
      developer: ['read', 'export'],
      support: ['read'],
      user: []
    };

    return permissions[role] || permissions.user || [];
  }

  /**
   * Check if user can delete specific resource
   */
  private canDeleteResource(user: any, resource: string): boolean {
    // Only admins can delete error logs
    if (user?.role !== 'admin') {
      return false;
    }

    // Additional checks can be added here
    // e.g., prevent deletion of recent logs, critical errors, etc.
    
    return true;
  }

  /**
   * Sanitize error log data
   */
  public sanitizeErrorLog(errorLog: any): any {
    if (!this.config.sanitization.enabled) {
      return errorLog;
    }

    try {
      // Convert to string for processing
      let sanitizedData = JSON.stringify(errorLog);

      // Apply sanitization rules
      for (const rule of this.sanitizationRules) {
        if (rule.enabled) {
          sanitizedData = sanitizedData.replace(rule.pattern, rule.replacement);
        }
      }

      // Parse back to object
      const sanitized = JSON.parse(sanitizedData);

      // Additional field-level sanitization
      if (sanitized.context) {
        if (this.config.sanitization.removePII) {
          // Remove or mask PII fields
          if (sanitized.context.userAgent) {
            sanitized.context.userAgent = this.maskUserAgent(sanitized.context.userAgent);
          }
          if (sanitized.context.ipAddress) {
            sanitized.context.ipAddress = this.maskIpAddress(sanitized.context.ipAddress);
          }
        }
      }

      // Remove sensitive stack trace information
      if (sanitized.stackTrace && this.config.sanitization.maskSensitiveData) {
        sanitized.stackTrace = this.sanitizeStackTrace(sanitized.stackTrace);
      }

      return sanitized;
    } catch (error) {
      logger.error('Failed to sanitize error log', {
        component: 'ERROR_LOG_SECURITY_SERVICE',
        operation: 'SANITIZE_ERROR_LOG'
      }, error);

      // Return original data if sanitization fails
      return errorLog;
    }
  }

  /**
   * Mask user agent string
   */
  private maskUserAgent(userAgent: string): string {
    // Keep browser and OS info, remove detailed version numbers
    return userAgent.replace(/\d+\.\d+\.\d+/g, 'X.X.X');
  }

  /**
   * Mask IP address
   */
  private maskIpAddress(ipAddress: string): string {
    // Mask last octet of IPv4 addresses
    return ipAddress.replace(/\.\d+$/, '.XXX');
  }

  /**
   * Sanitize stack trace
   */
  private sanitizeStackTrace(stackTrace: string): string {
    // Remove file paths that might contain sensitive information
    return stackTrace
      .replace(/\/[^\/\s]+\/[^\/\s]+\/[^\/\s]+/g, '/[PATH_REDACTED]')
      .replace(/C:\\[^\\s]+\\[^\\s]+/g, 'C:\\[PATH_REDACTED]');
  }

  /**
   * Encrypt error log data
   */
  public encryptErrorLog(data: any): {
    encryptedData: string;
    iv: string;
    authTag: string;
  } | null {
    if (!this.config.encryptLogs || !this.config.encryptionKey) {
      return null;
    }

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);

      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        authTag: '' // Not used with CBC mode
      };
    } catch (error) {
      logger.error('Failed to encrypt error log', {
        component: 'ERROR_LOG_SECURITY_SERVICE',
        operation: 'ENCRYPT_ERROR_LOG'
      }, error);
      return null;
    }
  }

  /**
   * Decrypt error log data
   */
  public decryptErrorLog(encryptedData: string, iv: string, authTag: string): any | null {
    if (!this.config.encryptLogs || !this.config.encryptionKey) {
      return null;
    }

    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.config.encryptionKey);

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to decrypt error log', {
        component: 'ERROR_LOG_SECURITY_SERVICE',
        operation: 'DECRYPT_ERROR_LOG'
      }, error);
      return null;
    }
  }

  /**
   * Log access audit entry
   */
  private async logAccessAudit(auditEntry: AccessAuditEntry): Promise<void> {
    try {
      // Store in memory (in production, this should go to a secure audit log)
      this.accessAuditLog.push(auditEntry);

      // Keep only last 10000 entries
      if (this.accessAuditLog.length > 10000) {
        this.accessAuditLog = this.accessAuditLog.slice(-10000);
      }

      // Log to file/database for permanent storage
      logger.info('Error log access audit', {
        component: 'ERROR_LOG_SECURITY_SERVICE',
        operation: 'ACCESS_AUDIT',
        userId: auditEntry.userId,
        action: auditEntry.action,
        resource: auditEntry.resource,
        success: auditEntry.success,
        ipAddress: auditEntry.ipAddress
      });

      // In production, you might want to send to external audit system
      if (process.env.NODE_ENV === 'production' && process.env.AUDIT_WEBHOOK_URL) {
        await this.sendToAuditSystem(auditEntry);
      }
    } catch (error) {
      logger.error('Failed to log access audit', {
        component: 'ERROR_LOG_SECURITY_SERVICE',
        operation: 'LOG_ACCESS_AUDIT'
      }, error);
    }
  }

  /**
   * Send audit entry to external audit system
   */
  private async sendToAuditSystem(auditEntry: AccessAuditEntry): Promise<void> {
    // Placeholder for external audit system integration
    // This could be Splunk, ELK Stack, or custom audit service
    logger.debug('Sending audit entry to external system', {
      component: 'ERROR_LOG_SECURITY_SERVICE',
      operation: 'SEND_TO_AUDIT_SYSTEM',
      auditId: auditEntry.id
    });
  }

  /**
   * Get access audit logs
   */
  public getAccessAuditLogs(filters: {
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  } = {}): AccessAuditEntry[] {
    let filteredLogs = this.accessAuditLog;

    if (filters.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
    }

    if (filters.action) {
      filteredLogs = filteredLogs.filter(log => log.action === filters.action);
    }

    if (filters.startDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startDate!);
    }

    if (filters.endDate) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endDate!);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (filters.limit) {
      filteredLogs = filteredLogs.slice(0, filters.limit);
    }

    return filteredLogs;
  }

  /**
   * Validate security configuration
   */
  public validateConfiguration(): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check encryption configuration
    if (this.config.encryptLogs && !this.config.encryptionKey) {
      errors.push('Encryption enabled but no encryption key provided');
    }

    if (this.config.encryptLogs && this.config.encryptionKey.length < 32) {
      warnings.push('Encryption key should be at least 32 characters long');
    }

    // Check access control configuration
    if (!this.config.accessControl.enabled) {
      warnings.push('Access control is disabled - error logs are not protected');
    }

    if (this.config.accessControl.allowedRoles.length === 0) {
      errors.push('No roles are allowed to access error logs');
    }

    // Check sanitization configuration
    if (!this.config.sanitization.enabled) {
      warnings.push('Data sanitization is disabled - sensitive data may be logged');
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  /**
   * Get security service status
   */
  public getStatus(): {
    encryptionEnabled: boolean;
    accessControlEnabled: boolean;
    sanitizationEnabled: boolean;
    auditLogEntries: number;
    sanitizationRules: number;
    configurationValid: boolean;
  } {
    const validation = this.validateConfiguration();

    return {
      encryptionEnabled: this.config.encryptLogs,
      accessControlEnabled: this.config.accessControl.enabled,
      sanitizationEnabled: this.config.sanitization.enabled,
      auditLogEntries: this.accessAuditLog.length,
      sanitizationRules: this.sanitizationRules.filter(r => r.enabled).length,
      configurationValid: validation.valid
    };
  }
}

// Export singleton instance
export const errorLogSecurityService = ErrorLogSecurityService.getInstance();