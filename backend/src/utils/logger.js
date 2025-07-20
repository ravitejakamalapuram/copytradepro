"use strict";
/**
 * Comprehensive logging system with context tracking and structured logging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.debug = exports.error = exports.warn = exports.info = exports.logger = exports.EnhancedLogger = void 0;
const uuid_1 = require("uuid");
class EnhancedLogger {
    constructor(context = {}) {
        this.globalContext = {};
        this.logEntries = [];
        this.maxLogEntries = 10000;
        this.globalContext = context;
        this.logLevel = this.getLogLevelFromEnv();
    }
    getLogLevelFromEnv() {
        const envLevel = process.env.LOG_LEVEL?.toLowerCase();
        const validLevels = ['debug', 'info', 'warn', 'error', 'critical'];
        if (envLevel && validLevels.includes(envLevel)) {
            return envLevel;
        }
        return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    }
    shouldLog(level) {
        const levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            critical: 4
        };
        return levels[level] >= levels[this.logLevel];
    }
    createLogEntry(level, message, context = {}, data, error) {
        const entry = {
            id: (0, uuid_1.v4)(),
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
    serializeError(error) {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }
        return error;
    }
    storeLogEntry(entry) {
        this.logEntries.push(entry);
        // Maintain max log entries limit
        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries = this.logEntries.slice(-this.maxLogEntries);
        }
    }
    formatLogEntry(entry) {
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
    log(level, message, context = {}, data, error) {
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
        // In production, you might want to send critical errors to external logging service
        if (level === 'critical' && process.env.NODE_ENV === 'production') {
            this.sendToExternalLoggingService(entry);
        }
    }
    sendToExternalLoggingService(entry) {
        // Placeholder for external logging service integration
        // This could be Sentry, LogRocket, CloudWatch, etc.
        console.log('📤 Sending critical error to external logging service:', entry.id);
    }
    // Core logging methods
    debug(message, context = {}, data) {
        this.log('debug', message, context, data);
    }
    info(message, context = {}, data) {
        this.log('info', message, context, data);
    }
    warn(message, context = {}, data) {
        this.log('warn', message, context, data);
    }
    error(message, contextOrError, error) {
        // Handle backward compatibility: if second param looks like an error, treat it as such
        if (contextOrError && (contextOrError.message || contextOrError.stack || contextOrError instanceof Error || contextOrError.name)) {
            this.log('error', message, {}, undefined, contextOrError);
        }
        else {
            this.log('error', message, contextOrError || {}, undefined, error);
        }
    }
    critical(message, context = {}, error) {
        this.log('critical', message, context, undefined, error);
    }
    // Specialized logging methods
    logApiCall(method, url, duration, status, context = {}) {
        const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
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
    logUserAction(action, userId, context = {}, data) {
        this.info(`User action: ${action}`, {
            ...context,
            component: 'USER_ACTION',
            userId,
            operation: action
        }, data);
    }
    logBrokerOperation(operation, brokerName, context = {}, data) {
        this.info(`Broker operation: ${operation}`, {
            ...context,
            component: 'BROKER',
            brokerName,
            operation
        }, data);
    }
    logSystemEvent(event, context = {}, data) {
        this.info(`System event: ${event}`, {
            ...context,
            component: 'SYSTEM',
            operation: event
        }, data);
    }
    logError(error) {
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
    // Context management
    createChildLogger(context) {
        return new EnhancedLogger({ ...this.globalContext, ...context });
    }
    setGlobalContext(context) {
        this.globalContext = { ...this.globalContext, ...context };
    }
    // Log aggregation and analysis methods
    getLogEntries(level, limit) {
        let entries = level ? this.logEntries.filter(entry => entry.level === level) : this.logEntries;
        return limit ? entries.slice(-limit) : entries;
    }
    getErrorSummary(timeWindow = 3600000) {
        const cutoff = new Date(Date.now() - timeWindow);
        const recentErrors = this.logEntries.filter(entry => entry.timestamp >= cutoff && (entry.level === 'error' || entry.level === 'critical'));
        const summary = {};
        recentErrors.forEach(entry => {
            const key = entry.context.component || 'unknown';
            summary[key] = (summary[key] || 0) + 1;
        });
        return summary;
    }
    clearLogs() {
        this.logEntries = [];
    }
}
exports.EnhancedLogger = EnhancedLogger;
// Export singleton instance
exports.logger = new EnhancedLogger();
// Export individual functions for convenience (backward compatibility)
const info = (message, context, ...args) => {
    if (context && typeof context === 'object' && !Array.isArray(context)) {
        exports.logger.info(message, context, args.length > 0 ? args[0] : undefined);
    }
    else {
        exports.logger.info(message, {}, context);
    }
};
exports.info = info;
const warn = (message, context, ...args) => {
    if (context && typeof context === 'object' && !Array.isArray(context)) {
        exports.logger.warn(message, context, args.length > 0 ? args[0] : undefined);
    }
    else {
        exports.logger.warn(message, {}, context);
    }
};
exports.warn = warn;
const error = (message, contextOrError, errorParam) => {
    // If the second parameter looks like an error (has message or stack), treat it as an error
    if (contextOrError && (contextOrError.message || contextOrError.stack || contextOrError instanceof Error || contextOrError.name)) {
        exports.logger.error(message, {}, contextOrError);
    }
    else if (contextOrError && typeof contextOrError === 'object' && !Array.isArray(contextOrError) && !contextOrError.message && !contextOrError.stack) {
        // If it looks like a context object (has typical context properties), use it as context
        exports.logger.error(message, contextOrError, errorParam);
    }
    else {
        // Fallback: treat as error
        exports.logger.error(message, {}, contextOrError);
    }
};
exports.error = error;
const debug = (message, context, ...args) => {
    if (context && typeof context === 'object' && !Array.isArray(context)) {
        exports.logger.debug(message, context, args.length > 0 ? args[0] : undefined);
    }
    else {
        exports.logger.debug(message, {}, context);
    }
};
exports.debug = debug;
exports.default = exports.logger;
//# sourceMappingURL=logger.js.map