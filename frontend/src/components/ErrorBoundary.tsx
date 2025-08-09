import { Component, type ErrorInfo, type ReactNode } from 'react';
import Button from './ui/Button';
import Card from './ui/Card';
import { errorCaptureService } from '../services/errorCaptureService';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
  componentName?: string;
  componentProps?: any;
  componentState?: any;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  eventId: string | null;
  traceId: string | null;
}

class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      traceId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Generate a unique event ID for this error
    const eventId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Capture error using the error capture service
    const errorEntry = errorCaptureService.captureReactError(error, { componentStack: errorInfo.componentStack || undefined }, {
      component: this.props.componentName || 'Unknown',
      props: this.props.componentProps,
      state: this.props.componentState
    });
    
    this.setState({
      error,
      errorInfo,
      eventId,
      traceId: errorEntry.traceId,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report to error tracking service (legacy support)
    this.reportError(error, errorInfo, eventId);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when resetKeys change
    if (hasError && resetOnPropsChange && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (resetKey, idx) => prevProps.resetKeys?.[idx] !== resetKey
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo, eventId: string) => {
    // In a real application, you would send this to your error tracking service
    // For now, we'll just log it with structured data
    const errorReport = {
      eventId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error('Error Report:', errorReport);

    // You could send this to services like Sentry, LogRocket, etc.
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  };

  private resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      eventId: null,
      traceId: null,
    });
  };

  private handleRetry = () => {
    this.resetErrorBoundary();
  };

  private handleReload = () => {
    window.location.reload();
  };

  private copyErrorDetails = () => {
    const { error, errorInfo, eventId, traceId } = this.state;
    const errorDetails = {
      eventId,
      traceId,
      error: error?.message,
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      component: this.props.componentName || 'Unknown',
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2))
      .then(() => {
        alert('Error details copied to clipboard');
      })
      .catch(() => {
        console.error('Failed to copy error details');
      });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary-container">
          <Card className="error-boundary-card">
            <div className="error-boundary-content">
              <div className="error-boundary-icon">
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="error-icon"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              
              <h2 className="error-boundary-title">Something went wrong</h2>
              
              <p className="error-boundary-description">
                We're sorry, but something unexpected happened. The error has been logged 
                and our team has been notified.
              </p>

              {this.state.eventId && (
                <div className="error-boundary-ids">
                  <p className="error-boundary-event-id">
                    Error ID: <code>{this.state.eventId}</code>
                  </p>
                  {this.state.traceId && (
                    <p className="error-boundary-trace-id">
                      Trace ID: <code>{this.state.traceId}</code>
                    </p>
                  )}
                </div>
              )}

              <div className="error-boundary-actions">
                <Button onClick={this.handleRetry} variant="primary">
                  Try Again
                </Button>
                <Button onClick={this.handleReload} variant="secondary">
                  Reload Page
                </Button>
                <Button onClick={this.copyErrorDetails} variant="outline">
                  Copy Error Details
                </Button>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="error-boundary-details">
                  <summary>Error Details (Development)</summary>
                  <pre className="error-boundary-stack">
                    {this.state.error.stack}
                  </pre>
                  {this.state.errorInfo && (
                    <pre className="error-boundary-component-stack">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </details>
              )}
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;