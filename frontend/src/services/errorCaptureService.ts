/**
 * Frontend Error Capture Service
 * Captures and reports frontend errors to the backend error logging system
 * Implements Requirements: 1.2, 5.4, 5.5
 */

import { frontendLogger } from './loggingService';
import { errorNotificationService } from './errorNotificationService';
import api from './api';

export interface FrontendErrorEntry {
  id: string;
  traceId: string;
  timestamp: Date;
  source: 'UI';
  errorType: 'JAVASCRIPT' | 'REACT' | 'API' | 'NETWORK' | 'VALIDATION' | 'PROMISE_REJECTION';
  message: string;
  stackTrace?: string;
  componentStack?: string;
  context: {
    url: string;
    userAgent: string;
    userId?: string;
    sessionId?: string;
    component?: string;
    props?: any;
    state?: any;
    userActions?: Array<{
      action: string;
      timestamp: Date;
      element?: string;
    }>;
    // API-specific context
    filename?: string;
    lineno?: number;
    colno?: number;
    method?: string;
    apiUrl?: string;
    requestId?: string;
    status?: number;
    duration?: number;
    isRetryable?: boolean;
    // Resource-specific context
    resourceType?: string;
    resourceSource?: string;
    element?: string;
    // Validation-specific context
    field?: string;
    value?: any;
    rule?: string;
  };
  browserInfo: {
    name: string;
    version: string;
    platform: string;
    language: string;
    cookieEnabled: boolean;
    onLine: boolean;
    viewport: {
      width: number;
      height: number;
    };
    memory?: {
      usedJSHeapSize?: number;
      totalJSHeapSize?: number;
      jsHeapSizeLimit?: number;
    };
  };
}

export interface UserAction {
  action: string;
  timestamp: Date;
  element?: string;
  data?: any;
}

class ErrorCaptureService {
  private userActions: UserAction[] = [];
  private maxUserActions = 50;
  private errorQueue: FrontendErrorEntry[] = [];
  private maxQueueSize = 100;
  private isOnline = navigator.onLine;
  private retryInterval = 30000; // 30 seconds
  private retryTimer?: NodeJS.Timeout;
  
  // Circuit breaker for error logging API
  private circuitBreaker = {
    isOpen: false,
    failureCount: 0,
    maxFailures: 3,
    resetTimeout: 60000, // 1 minute
    lastFailureTime: 0,
    halfOpenAttempts: 0,
    maxHalfOpenAttempts: 1
  };

  constructor() {
    this.initializeGlobalErrorHandlers();
    this.initializeUserActionTracking();
    this.initializeNetworkStatusTracking();
    this.startRetryTimer();
  }

  /**
   * Initialize global error handlers for unhandled JavaScript errors and promise rejections
   * Implements Requirements: 1.2, 5.4
   */
  private initializeGlobalErrorHandlers(): void {
    // Handle unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureJavaScriptError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        stack: event.error?.stack
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.capturePromiseRejection({
        reason: event.reason,
        promise: event.promise
      });
    });

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.captureResourceError({
          element: event.target as Element,
          source: (event.target as any)?.src || (event.target as any)?.href,
          message: 'Resource failed to load'
        });
      }
    }, true);
  }

  /**
   * Initialize user action tracking for error context
   * Implements Requirements: 5.4
   */
  private initializeUserActionTracking(): void {
    // Track clicks
    document.addEventListener('click', (event) => {
      this.recordUserAction('click', event.target as Element);
    }, true);

    // Track form submissions
    document.addEventListener('submit', (event) => {
      this.recordUserAction('submit', event.target as Element);
    }, true);

    // Track input changes (throttled)
    let inputTimeout: NodeJS.Timeout;
    document.addEventListener('input', (event) => {
      clearTimeout(inputTimeout);
      inputTimeout = setTimeout(() => {
        this.recordUserAction('input', event.target as Element);
      }, 1000);
    }, true);

    // Track navigation
    window.addEventListener('popstate', () => {
      this.recordUserAction('navigation', null, { url: window.location.href });
    });
  }

  /**
   * Initialize network status tracking for offline error queuing
   * Implements Requirements: 1.2
   */
  private initializeNetworkStatusTracking(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processErrorQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  /**
   * Start retry timer for failed error submissions
   */
  private startRetryTimer(): void {
    this.retryTimer = setInterval(() => {
      if (this.isOnline && this.errorQueue.length > 0) {
        this.processErrorQueue();
      }
    }, this.retryInterval);
  }

  /**
   * Record user action for error context
   */
  private recordUserAction(action: string, element: Element | null, data?: any): void {
    const userAction: UserAction = {
      action,
      timestamp: new Date(),
      element: element ? this.getElementSelector(element) : undefined,
      data
    };

    this.userActions.push(userAction);

    // Maintain max actions limit
    if (this.userActions.length > this.maxUserActions) {
      this.userActions = this.userActions.slice(-this.maxUserActions);
    }
  }

  /**
   * Get CSS selector for an element
   */
  private getElementSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }

    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }

    return element.tagName.toLowerCase();
  }

  /**
   * Generate unique trace ID or extract from existing context
   */
  private generateTraceId(): string {
    // Try to get trace ID from current request context
    const existingTraceId = this.getTraceIdFromContext();
    if (existingTraceId) {
      return existingTraceId;
    }

    // Generate new trace ID
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract trace ID from current context (headers, localStorage, etc.)
   */
  private getTraceIdFromContext(): string | null {
    // Check if there's a trace ID in session storage from recent API calls
    const recentTraceId = sessionStorage.getItem('lastTraceId');
    if (recentTraceId) {
      const traceTimestamp = sessionStorage.getItem('lastTraceTimestamp');
      if (traceTimestamp && Date.now() - parseInt(traceTimestamp) < 60000) { // 1 minute
        return recentTraceId;
      }
    }

    return null;
  }

  /**
   * Get comprehensive browser information
   * Implements Requirements: 5.5
   */
  private getBrowserInfo(): FrontendErrorEntry['browserInfo'] {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';

    // Simple browser detection
    if (userAgent.includes('Chrome')) {
      browserName = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Firefox')) {
      browserName = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Safari')) {
      browserName = 'Safari';
      const match = userAgent.match(/Version\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Edge')) {
      browserName = 'Edge';
      const match = userAgent.match(/Edge\/(\d+)/);
      browserVersion = match ? match[1] : 'Unknown';
    }

    const browserInfo: FrontendErrorEntry['browserInfo'] = {
      name: browserName,
      version: browserVersion,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };

    // Add memory information if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      browserInfo.memory = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }

    return browserInfo;
  }

  /**
   * Get current user context
   */
  private getUserContext(): { userId?: string; sessionId?: string } {
    const context: { userId?: string; sessionId?: string } = {};

    // Get user ID from localStorage
    try {
      const user = localStorage.getItem('user');
      if (user) {
        const userData = JSON.parse(user);
        context.userId = userData.id || userData.userId;
      }
    } catch (e) {
      // Ignore parsing errors
    }

    // Get session ID
    context.sessionId = sessionStorage.getItem('sessionId') || undefined;

    return context;
  }

  /**
   * Create base error entry with common properties
   */
  private createBaseErrorEntry(errorType: FrontendErrorEntry['errorType'], message: string): FrontendErrorEntry {
    const userContext = this.getUserContext();

    return {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      traceId: this.generateTraceId(),
      timestamp: new Date(),
      source: 'UI',
      errorType,
      message,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        ...userContext,
        userActions: [...this.userActions]
      },
      browserInfo: this.getBrowserInfo()
    };
  }

  /**
   * Capture JavaScript errors
   * Implements Requirements: 1.2, 5.4
   */
  private captureJavaScriptError(errorInfo: {
    message: string;
    filename?: string;
    lineno?: number;
    colno?: number;
    error?: Error;
    stack?: string;
  }): void {
    const errorEntry = this.createBaseErrorEntry('JAVASCRIPT', errorInfo.message);
    
    errorEntry.stackTrace = errorInfo.stack || errorInfo.error?.stack;
    errorEntry.context = {
      ...errorEntry.context,
      filename: errorInfo.filename,
      lineno: errorInfo.lineno,
      colno: errorInfo.colno
    };

    this.reportError(errorEntry);
  }

  /**
   * Capture promise rejection errors
   */
  private capturePromiseRejection(rejectionInfo: {
    reason: any;
    promise: Promise<any>;
  }): void {
    const message = rejectionInfo.reason instanceof Error 
      ? rejectionInfo.reason.message 
      : String(rejectionInfo.reason);

    const errorEntry = this.createBaseErrorEntry('PROMISE_REJECTION', message);
    
    if (rejectionInfo.reason instanceof Error) {
      errorEntry.stackTrace = rejectionInfo.reason.stack;
    }

    this.reportError(errorEntry);
  }

  /**
   * Capture resource loading errors
   */
  private captureResourceError(resourceInfo: {
    element: Element;
    source?: string;
    message: string;
  }): void {
    const errorEntry = this.createBaseErrorEntry('NETWORK', resourceInfo.message);
    
    errorEntry.context = {
      ...errorEntry.context,
      resourceType: resourceInfo.element.tagName.toLowerCase(),
      resourceSource: resourceInfo.source,
      element: this.getElementSelector(resourceInfo.element)
    };

    this.reportError(errorEntry);
  }

  /**
   * Capture React component errors
   * Implements Requirements: 1.2, 5.4
   */
  public captureReactError(error: Error, errorInfo: { componentStack?: string }, componentContext?: {
    component?: string;
    props?: any;
    state?: any;
  }): FrontendErrorEntry {
    const errorEntry = this.createBaseErrorEntry('REACT', error.message);
    
    errorEntry.stackTrace = error.stack;
    errorEntry.componentStack = errorInfo.componentStack;
    errorEntry.context = {
      ...errorEntry.context,
      component: componentContext?.component,
      props: this.sanitizeProps(componentContext?.props),
      state: this.sanitizeState(componentContext?.state)
    };

    this.reportError(errorEntry);
    return errorEntry;
  }

  /**
   * Capture API errors
   * Implements Requirements: 1.2, 5.4
   */
  public captureApiError(error: any, requestContext?: {
    method?: string;
    url?: string;
    requestId?: string;
    status?: number;
    duration?: number;
  }): FrontendErrorEntry {
    const message = error.userMessage || error.message || 'API request failed';
    const errorEntry = this.createBaseErrorEntry('API', message);
    
    errorEntry.context = {
      ...errorEntry.context,
      method: requestContext?.method,
      apiUrl: requestContext?.url,
      requestId: requestContext?.requestId,
      status: requestContext?.status,
      duration: requestContext?.duration,
      isRetryable: error.isRetryable
    };

    // Use trace ID from request if available
    if (requestContext?.requestId) {
      errorEntry.traceId = requestContext.requestId;
    }

    this.reportError(errorEntry);
    return errorEntry;
  }

  /**
   * Capture validation errors
   */
  public captureValidationError(message: string, validationContext?: {
    field?: string;
    value?: any;
    rule?: string;
    component?: string;
  }): FrontendErrorEntry {
    const errorEntry = this.createBaseErrorEntry('VALIDATION', message);
    
    errorEntry.context = {
      ...errorEntry.context,
      field: validationContext?.field,
      value: this.sanitizeValue(validationContext?.value),
      rule: validationContext?.rule,
      component: validationContext?.component
    };

    this.reportError(errorEntry);
    return errorEntry;
  }

  /**
   * Sanitize props to remove sensitive data
   */
  private sanitizeProps(props: any): any {
    if (!props || typeof props !== 'object') {
      return props;
    }

    const sanitized = { ...props };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential'];

    for (const key in sanitized) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize state to remove sensitive data
   */
  private sanitizeState(state: any): any {
    return this.sanitizeProps(state);
  }

  /**
   * Sanitize value to remove sensitive data
   */
  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string' && value.length > 100) {
      return value.substring(0, 100) + '...';
    }
    return value;
  }

  /**
   * Report error to backend with retry logic
   * Implements Requirements: 1.2, 1.3
   */
  private async reportError(errorEntry: FrontendErrorEntry): Promise<void> {
    // Log to console for development
    if (import.meta.env.DEV) {
      console.error('Frontend Error Captured:', errorEntry);
    }

    // Log using frontend logger
    frontendLogger.error(errorEntry.message, {
      errorId: errorEntry.id,
      traceId: errorEntry.traceId,
      component: errorEntry.context.component || 'UNKNOWN',
      errorType: errorEntry.errorType
    }, errorEntry);

    // Show user-friendly notification
    this.showUserNotification(errorEntry);

    // Add to queue for backend reporting
    this.addToQueue(errorEntry);

    // Try to send immediately if online
    if (this.isOnline) {
      await this.sendErrorToBackend(errorEntry);
    }
  }

  /**
   * Show user-friendly notification for error
   */
  private showUserNotification(errorEntry: FrontendErrorEntry): void {
    // Don't show notifications for certain error types in development
    if (import.meta.env.DEV && errorEntry.errorType === 'PROMISE_REJECTION') {
      return;
    }

    // Don't show notifications for validation errors (they should be handled by forms)
    if (errorEntry.errorType === 'VALIDATION') {
      return;
    }

    // Show notification with appropriate options
    const options = {
      includeRetryAction: this.isRetryableError(errorEntry),
      includeReportAction: errorEntry.errorType === 'REACT' || errorEntry.errorType === 'JAVASCRIPT',
      showTechnicalDetails: import.meta.env.DEV
    };

    errorNotificationService.showErrorNotification(errorEntry, options);
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(errorEntry: FrontendErrorEntry): boolean {
    if (errorEntry.errorType === 'API') {
      const status = errorEntry.context.status;
      return !status || status === 408 || status === 429 || status >= 500;
    }
    
    if (errorEntry.errorType === 'NETWORK') {
      return true;
    }

    return false;
  }

  /**
   * Add error to queue for retry logic
   */
  private addToQueue(errorEntry: FrontendErrorEntry): void {
    this.errorQueue.push(errorEntry);

    // Maintain queue size limit
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue = this.errorQueue.slice(-this.maxQueueSize);
    }
  }

  /**
   * Check if circuit breaker allows requests
   */
  private canSendToBackend(): boolean {
    const now = Date.now();
    
    // If circuit is closed, allow requests
    if (!this.circuitBreaker.isOpen) {
      return true;
    }
    
    // If enough time has passed, try to reset circuit breaker
    if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.resetTimeout) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failureCount = 0;
      this.circuitBreaker.halfOpenAttempts = 0;
      return true;
    }
    
    return false;
  }

  /**
   * Record circuit breaker success
   */
  private recordSuccess(): void {
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.halfOpenAttempts = 0;
  }

  /**
   * Record circuit breaker failure
   */
  private recordFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.maxFailures) {
      this.circuitBreaker.isOpen = true;
      console.warn('Error logging circuit breaker opened - too many failures');
    }
  }

  /**
   * Send error to backend with circuit breaker protection
   */
  private async sendErrorToBackend(errorEntry: FrontendErrorEntry): Promise<boolean> {
    // Check circuit breaker
    if (!this.canSendToBackend()) {
      console.warn('Error logging circuit breaker is open - skipping backend call');
      return false;
    }

    try {
      // Use the correct endpoint (base URL already includes /api)
      await api.post('/logs', {
        logs: [{
          level: 'error',
          message: errorEntry.message,
          context: {
            component: 'ERROR_CAPTURE',
            errorId: errorEntry.id,
            traceId: errorEntry.traceId,
            errorType: errorEntry.errorType,
            source: errorEntry.source,
            ...errorEntry.context
          },
          error: {
            message: errorEntry.message,
            stack: errorEntry.stackTrace,
            componentStack: errorEntry.componentStack,
            browserInfo: errorEntry.browserInfo,
            timestamp: errorEntry.timestamp
          }
        }]
      });
      
      // Record success
      this.recordSuccess();
      
      // Remove from queue if successful
      const index = this.errorQueue.findIndex(e => e.id === errorEntry.id);
      if (index !== -1) {
        this.errorQueue.splice(index, 1);
      }

      return true;
    } catch (error) {
      // Record failure for circuit breaker
      this.recordFailure();
      
      // Don't log this error to avoid infinite loops
      console.warn('Failed to send error to backend (circuit breaker will handle retries)');
      return false;
    }
  }

  /**
   * Process error queue for retry with backpressure control
   */
  private async processErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) {
      return;
    }

    // Don't process if circuit breaker is open
    if (!this.canSendToBackend()) {
      return;
    }

    // Process errors in small batches to avoid backpressure
    const batchSize = 5;
    const batch = this.errorQueue.slice(0, batchSize);
    
    // Process batch with delay between requests
    let successCount = 0;
    for (const error of batch) {
      const success = await this.sendErrorToBackend(error);
      if (success) {
        successCount++;
      } else {
        // If one fails, stop processing to avoid overwhelming the server
        break;
      }
      
      // Small delay between requests to avoid backpressure
      if (batch.indexOf(error) < batch.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (import.meta.env.DEV && batch.length > 0) {
      console.log(`Processed error queue batch: ${successCount}/${batch.length} sent successfully`);
    }
  }

  /**
   * Get error queue status
   */
  public getQueueStatus(): { 
    queueSize: number; 
    isOnline: boolean; 
    circuitBreakerOpen: boolean;
    failureCount: number;
  } {
    return {
      queueSize: this.errorQueue.length,
      isOnline: this.isOnline,
      circuitBreakerOpen: this.circuitBreaker.isOpen,
      failureCount: this.circuitBreaker.failureCount
    };
  }

  /**
   * Clear error queue
   */
  public clearQueue(): void {
    this.errorQueue = [];
  }

  /**
   * Cleanup service
   */
  public destroy(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
    }
    this.processErrorQueue(); // Final attempt to send queued errors
  }
}

// Export singleton instance
export const errorCaptureService = new ErrorCaptureService();

export default errorCaptureService;