import React, { type ErrorInfo } from 'react';
import ErrorBoundary from './ErrorBoundary';
import Button from './ui/Button';
import Card from './ui/Card';

interface AccountErrorBoundaryProps {
  children: React.ReactNode;
}

const AccountFallback: React.FC = () => (
  <div className="account-error-fallback">
    <Card className="account-error-card">
      <div className="account-error-content">
        <div className="account-error-icon">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--color-warning-500)' }}
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </div>
        
        <h3 className="account-error-title">Account Management Error</h3>
        
        <p className="account-error-description">
          There was an issue loading your account information. Your accounts are safe, 
          but some account features may be temporarily unavailable.
        </p>
        
        <div className="account-error-actions">
          <Button onClick={() => window.location.reload()} variant="primary">
            Refresh Account Data
          </Button>
          <Button 
            onClick={() => window.location.href = '/account-setup'} 
            variant="secondary"
          >
            Account Setup
          </Button>
        </div>
        
        <div className="account-error-help">
          <p>
            If this problem persists, try:
          </p>
          <ul>
            <li>Checking your internet connection</li>
            <li>Logging out and logging back in</li>
            <li>Contacting support if the issue continues</li>
          </ul>
        </div>
      </div>
    </Card>
  </div>
);

const AccountErrorBoundary: React.FC<AccountErrorBoundaryProps> = ({ children }) => {
  const handleAccountError = (error: Error, _errorInfo: ErrorInfo) => {
    console.error('Account Error:', error);
    
    // Account errors are already captured by the ErrorBoundary component
    // Additional account-specific context can be added here
    const errorReport = {
      type: 'account_error',
      severity: 'medium',
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      section: 'accounts'
    };
    
    console.error('Account Error Report:', errorReport);
  };

  return (
    <ErrorBoundary
      fallback={<AccountFallback />}
      onError={handleAccountError}
      componentName="AccountErrorBoundary"
    >
      {children}
    </ErrorBoundary>
  );
};

export default AccountErrorBoundary;