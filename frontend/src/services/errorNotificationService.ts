/**
 * Frontend Error Notification Service
 * Provides user-friendly error notifications with actionable messages
 * Implements Requirements: 1.2, 1.3
 */

import type { FrontendErrorEntry } from './errorCaptureService';

export interface ErrorNotification {
  id: string;
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  actions?: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
  dismissible?: boolean;
  autoHide?: boolean;
  duration?: number;
  traceId?: string;
}

export interface NotificationOptions {
  showTechnicalDetails?: boolean;
  includeRetryAction?: boolean;
  includeReportAction?: boolean;
  customActions?: Array<{
    label: string;
    action: () => void;
    primary?: boolean;
  }>;
}

class ErrorNotificationService {
  private notifications: ErrorNotification[] = [];
  private listeners: Array<(notifications: ErrorNotification[]) => void> = [];
  private maxNotifications = 5;

  /**
   * Create user-friendly notification from error entry
   */
  public createNotificationFromError(
    errorEntry: FrontendErrorEntry,
    options: NotificationOptions = {}
  ): ErrorNotification {
    const notification: ErrorNotification = {
      id: `notification_${errorEntry.id}`,
      title: this.getErrorTitle(errorEntry),
      message: this.getErrorMessage(errorEntry),
      type: this.getNotificationType(errorEntry),
      traceId: errorEntry.traceId,
      dismissible: true,
      autoHide: errorEntry.errorType !== 'REACT', // React errors should stay visible
      duration: this.getNotificationDuration(errorEntry),
      actions: this.getErrorActions(errorEntry, options)
    };

    return notification;
  }

  /**
   * Show error notification
   */
  public showErrorNotification(
    errorEntry: FrontendErrorEntry,
    options: NotificationOptions = {}
  ): void {
    const notification = this.createNotificationFromError(errorEntry, options);
    this.addNotification(notification);
  }

  /**
   * Show custom notification
   */
  public showNotification(notification: Omit<ErrorNotification, 'id'>): void {
    const fullNotification: ErrorNotification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    this.addNotification(fullNotification);
  }

  /**
   * Add notification to the list
   */
  private addNotification(notification: ErrorNotification): void {
    // Check for duplicate notifications (same error type and message)
    const isDuplicate = this.notifications.some(n => 
      n.title === notification.title && 
      n.message === notification.message &&
      Date.now() - parseInt(n.id.split('_')[1]) < 5000 // Within 5 seconds
    );

    if (isDuplicate) {
      return;
    }

    this.notifications.unshift(notification);

    // Maintain max notifications limit
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    // Auto-hide if configured
    if (notification.autoHide && notification.duration) {
      setTimeout(() => {
        this.dismissNotification(notification.id);
      }, notification.duration);
    }

    this.notifyListeners();
  }

  /**
   * Dismiss notification
   */
  public dismissNotification(id: string): void {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.notifyListeners();
  }

  /**
   * Clear all notifications
   */
  public clearAll(): void {
    this.notifications = [];
    this.notifyListeners();
  }

  /**
   * Get current notifications
   */
  public getNotifications(): ErrorNotification[] {
    return [...this.notifications];
  }

  /**
   * Subscribe to notification changes
   */
  public subscribe(listener: (notifications: ErrorNotification[]) => void): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener([...this.notifications]);
      } catch (error) {
        console.error('Error in notification listener:', error);
      }
    });
  }

  /**
   * Get error title based on error type
   */
  private getErrorTitle(errorEntry: FrontendErrorEntry): string {
    switch (errorEntry.errorType) {
      case 'REACT':
        return 'Component Error';
      case 'JAVASCRIPT':
        return 'Application Error';
      case 'API':
        return 'Connection Error';
      case 'NETWORK':
        return 'Network Error';
      case 'VALIDATION':
        return 'Validation Error';
      case 'PROMISE_REJECTION':
        return 'Unexpected Error';
      default:
        return 'Error';
    }
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(errorEntry: FrontendErrorEntry): string {
    switch (errorEntry.errorType) {
      case 'REACT':
        return 'A component encountered an error. The page has been reset to prevent further issues.';
      
      case 'JAVASCRIPT':
        return 'An unexpected error occurred in the application. Please try refreshing the page.';
      
      case 'API':
        if (errorEntry.context.status === 401) {
          return 'Your session has expired. Please log in again.';
        } else if (errorEntry.context.status === 403) {
          return 'You do not have permission to perform this action.';
        } else if (errorEntry.context.status === 404) {
          return 'The requested resource was not found.';
        } else if (errorEntry.context.status && errorEntry.context.status >= 500) {
          return 'Server error occurred. Please try again in a few moments.';
        } else if (errorEntry.context.status === 429) {
          return 'Too many requests. Please wait a moment before trying again.';
        }
        return 'Failed to connect to the server. Please check your internet connection.';
      
      case 'NETWORK':
        return 'Network connection error. Please check your internet connection and try again.';
      
      case 'VALIDATION':
        return errorEntry.message || 'Please check your input and try again.';
      
      case 'PROMISE_REJECTION':
        return 'An unexpected error occurred. The application will continue to work normally.';
      
      default:
        return errorEntry.message || 'An unexpected error occurred.';
    }
  }

  /**
   * Get notification type based on error
   */
  private getNotificationType(errorEntry: FrontendErrorEntry): 'error' | 'warning' | 'info' {
    switch (errorEntry.errorType) {
      case 'REACT':
      case 'JAVASCRIPT':
        return 'error';
      
      case 'API':
        if (errorEntry.context.status && errorEntry.context.status >= 500) {
          return 'error';
        } else if (errorEntry.context.status === 401 || errorEntry.context.status === 403) {
          return 'warning';
        }
        return 'error';
      
      case 'NETWORK':
        return 'error';
      
      case 'VALIDATION':
        return 'warning';
      
      case 'PROMISE_REJECTION':
        return 'warning';
      
      default:
        return 'error';
    }
  }

  /**
   * Get notification duration based on error type
   */
  private getNotificationDuration(errorEntry: FrontendErrorEntry): number {
    switch (errorEntry.errorType) {
      case 'REACT':
        return 0; // Don't auto-hide
      
      case 'JAVASCRIPT':
        return 10000; // 10 seconds
      
      case 'API':
        if (errorEntry.context.status === 401) {
          return 0; // Don't auto-hide session expiry
        }
        return 8000; // 8 seconds
      
      case 'NETWORK':
        return 8000; // 8 seconds
      
      case 'VALIDATION':
        return 6000; // 6 seconds
      
      case 'PROMISE_REJECTION':
        return 5000; // 5 seconds
      
      default:
        return 7000; // 7 seconds
    }
  }

  /**
   * Get actionable buttons for error notifications
   */
  private getErrorActions(
    errorEntry: FrontendErrorEntry,
    options: NotificationOptions
  ): ErrorNotification['actions'] {
    const actions: NonNullable<ErrorNotification['actions']> = [];

    // Add custom actions first
    if (options.customActions) {
      actions.push(...options.customActions);
    }

    // Add retry action for retryable errors
    if (options.includeRetryAction && this.isRetryableError(errorEntry)) {
      actions.push({
        label: 'Retry',
        action: () => this.retryLastAction(errorEntry),
        primary: true
      });
    }

    // Add refresh action for component errors
    if (errorEntry.errorType === 'REACT' || errorEntry.errorType === 'JAVASCRIPT') {
      actions.push({
        label: 'Refresh Page',
        action: () => window.location.reload(),
        primary: !actions.some(a => a.primary)
      });
    }

    // Add login action for auth errors
    if (errorEntry.errorType === 'API' && errorEntry.context.status === 401) {
      actions.push({
        label: 'Log In',
        action: () => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/';
        },
        primary: true
      });
    }

    // Add report action
    if (options.includeReportAction) {
      actions.push({
        label: 'Report Issue',
        action: () => this.reportIssue(errorEntry)
      });
    }

    // Add copy details action for development
    if (import.meta.env.DEV || options.showTechnicalDetails) {
      actions.push({
        label: 'Copy Details',
        action: () => this.copyErrorDetails(errorEntry)
      });
    }

    return actions.length > 0 ? actions : undefined;
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
   * Retry last action (placeholder - would need to be implemented based on app architecture)
   */
  private retryLastAction(errorEntry: FrontendErrorEntry): void {
    // This would need to be implemented based on your app's architecture
    // For now, just refresh the page for API errors
    if (errorEntry.errorType === 'API') {
      window.location.reload();
    }
  }

  /**
   * Report issue (placeholder - would integrate with support system)
   */
  private reportIssue(errorEntry: FrontendErrorEntry): void {
    const subject = encodeURIComponent(`Error Report: ${errorEntry.errorType}`);
    const body = encodeURIComponent(`
Error Details:
- ID: ${errorEntry.id}
- Trace ID: ${errorEntry.traceId}
- Type: ${errorEntry.errorType}
- Message: ${errorEntry.message}
- URL: ${errorEntry.context.url}
- Timestamp: ${errorEntry.timestamp.toISOString()}

Please describe what you were doing when this error occurred:
[Your description here]
    `);

    // Open email client or support form
    window.open(`mailto:support@copytradepro.com?subject=${subject}&body=${body}`);
  }

  /**
   * Copy error details to clipboard
   */
  private copyErrorDetails(errorEntry: FrontendErrorEntry): void {
    const details = {
      id: errorEntry.id,
      traceId: errorEntry.traceId,
      type: errorEntry.errorType,
      message: errorEntry.message,
      timestamp: errorEntry.timestamp.toISOString(),
      url: errorEntry.context.url,
      userAgent: errorEntry.context.userAgent,
      browserInfo: errorEntry.browserInfo
    };

    navigator.clipboard.writeText(JSON.stringify(details, null, 2))
      .then(() => {
        this.showNotification({
          title: 'Copied',
          message: 'Error details copied to clipboard',
          type: 'info',
          autoHide: true,
          duration: 3000,
          dismissible: true
        });
      })
      .catch(() => {
        console.error('Failed to copy error details');
      });
  }
}

// Export singleton instance
export const errorNotificationService = new ErrorNotificationService();

export default errorNotificationService;