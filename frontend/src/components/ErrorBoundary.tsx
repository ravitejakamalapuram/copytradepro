import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">⚠️</div>
            <h2 className="error-boundary__title">Something went wrong</h2>
            <p className="error-boundary__message">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-boundary__details">
                <summary>Error Details (Development)</summary>
                <pre className="error-boundary__stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            
            <div className="error-boundary__actions">
              <Button variant="primary" onClick={this.handleReload}>
                Reload Page
              </Button>
              <Button variant="outline" onClick={this.handleReset}>
                Try Again
              </Button>
            </div>
          </div>
          
          <style>{`
            .error-boundary {
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: #111827;
              color: #ffffff;
              padding: 2rem;
            }

            .error-boundary__container {
              max-width: 500px;
              text-align: center;
              background-color: #1f2937;
              padding: 3rem;
              border-radius: 1rem;
              border: 1px solid #374151;
            }

            .error-boundary__icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }

            .error-boundary__title {
              font-size: 1.5rem;
              font-weight: 600;
              margin-bottom: 1rem;
              color: #ffffff;
            }

            .error-boundary__message {
              color: #d1d5db;
              margin-bottom: 2rem;
              line-height: 1.6;
            }

            .error-boundary__details {
              text-align: left;
              margin-bottom: 2rem;
              background-color: #111827;
              border-radius: 0.5rem;
              padding: 1rem;
              border: 1px solid #374151;
            }

            .error-boundary__details summary {
              cursor: pointer;
              font-weight: 500;
              margin-bottom: 0.5rem;
              color: #f59e0b;
            }

            .error-boundary__stack {
              font-size: 0.75rem;
              color: #9ca3af;
              white-space: pre-wrap;
              overflow-x: auto;
            }

            .error-boundary__actions {
              display: flex;
              gap: 1rem;
              justify-content: center;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
