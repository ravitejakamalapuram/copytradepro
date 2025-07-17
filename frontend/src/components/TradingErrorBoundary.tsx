import React from 'react';
import ErrorBoundary from './ErrorBoundary';
import Button from './ui/Button';
import Card from './ui/Card';

interface TradingErrorBoundaryProps {
  children: React.ReactNode;
}

const TradingFallback: React.FC = () => (
  <div className="trading-error-fallback">
    <Card className="trading-error-card">
      <div className="trading-error-content">
        <div className="trading-error-icon">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--color-loss)' }}
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        
        <h3 className="trading-error-title">Trading Interface Error</h3>
        
        <p className="trading-error-description">
          There was an issue with the trading interface. Your account data is safe, 
          but some trading features may be temporarily unavailable.
        </p>
        
        <div className="trading-error-actions">
          <Button onClick={() => window.location.reload()} variant="primary">
            Reload Trading Interface
          </Button>
          <Button 
            onClick={() => window.location.href = '/dashboard'} 
            variant="secondary"
          >
            Go to Dashboard
          </Button>
        </div>
        
        <div className="trading-error-notice">
          <p>
            <strong>Important:</strong> If you have pending orders, please check your 
            broker platforms directly to ensure they are processed correctly.
          </p>
        </div>
      </div>
    </Card>
  </div>
);

const TradingErrorBoundary: React.FC<TradingErrorBoundaryProps> = ({ children }) => {
  const handleTradingError = (error: Error) => {
    console.error('Trading Error:', error);
    
    // Report trading-specific errors with high priority
    const errorReport = {
      type: 'trading_error',
      severity: 'high',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };
    
    console.error('Trading Error Report:', errorReport);
    
    // In production, send to error tracking service with high priority
    // Example: Sentry.captureException(error, { level: 'error', tags: { section: 'trading' } });
  };

  return (
    <ErrorBoundary
      fallback={<TradingFallback />}
      onError={handleTradingError}
    >
      {children}
    </ErrorBoundary>
  );
};

export default TradingErrorBoundary;