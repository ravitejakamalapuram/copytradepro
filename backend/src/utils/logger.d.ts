/**
 * Comprehensive logging system with context tracking and structured logging
 */
import { EnhancedError } from '../types/errorTypes';
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
    logApiCall(method: string, url: string, duration: number, status: number, context?: LogContext): void;
    logUserAction(action: string, userId: string, context?: LogContext, data?: any): void;
    logBrokerOperation(operation: string, brokerName: string, context?: LogContext, data?: any): void;
    logSystemEvent(event: string, context?: LogContext, data?: any): void;
    logError(error: EnhancedError): void;
    createChildLogger(context: LogContext): Logger;
    setGlobalContext(context: LogContext): void;
}
export declare class EnhancedLogger implements Logger {
    private globalContext;
    private logLevel;
    private logEntries;
    private maxLogEntries;
    constructor(context?: LogContext);
    private getLogLevelFromEnv;
    private shouldLog;
    private createLogEntry;
    private serializeError;
    private storeLogEntry;
    private formatLogEntry;
    private log;
    private sendToExternalLoggingService;
    debug(message: string, context?: LogContext, data?: any): void;
    info(message: string, context?: LogContext, data?: any): void;
    warn(message: string, context?: LogContext, data?: any): void;
    error(message: string, contextOrError?: LogContext | any, error?: any): void;
    critical(message: string, context?: LogContext, error?: any): void;
    logApiCall(method: string, url: string, duration: number, status: number, context?: LogContext): void;
    logUserAction(action: string, userId: string, context?: LogContext, data?: any): void;
    logBrokerOperation(operation: string, brokerName: string, context?: LogContext, data?: any): void;
    logSystemEvent(event: string, context?: LogContext, data?: any): void;
    logError(error: EnhancedError): void;
    createChildLogger(context: LogContext): Logger;
    setGlobalContext(context: LogContext): void;
    getLogEntries(level?: LogLevel, limit?: number): LogEntry[];
    getErrorSummary(timeWindow?: number): {
        [key: string]: number;
    };
    clearLogs(): void;
}
export declare const logger: EnhancedLogger;
export declare const info: (message: string, context?: LogContext | any, ...args: any[]) => void;
export declare const warn: (message: string, context?: LogContext | any, ...args: any[]) => void;
export declare const error: (message: string, contextOrError?: any, errorParam?: any) => void;
export declare const debug: (message: string, context?: LogContext | any, ...args: any[]) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map