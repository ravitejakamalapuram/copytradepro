import React, { type ErrorInfo } from 'react';
import ErrorBoundary from './ErrorBoundary';
import Button from './ui/Button';

interface NavigationErrorBoundaryProps {
  children: React.ReactNode;
}

const NavigationFallback: React.FC = () => (
  <div className="navigation-error-fallback">
    <div className="navigation-error-content">
      <h3>Navigation Error</h3>
      <p>There was an issue loading the navigation. Please refresh the page.</p>
      <Button
        onClick={() => window.location.reload()}
        variant="primary"
      >
        Refresh Page
      </Button>
    </div>
  </div>
);

const NavigationErrorBoundary: React.FC<NavigationErrorBoundaryProps> = ({ children }) => {
  const handleNavigationError = (error: Error, _errorInfo: ErrorInfo) => {
    console.error('Navigation Error:', error);
    // Navigation errors are already captured by the ErrorBoundary component
    // Additional navigation-specific logging can be added here if needed
  };

  return (
    <ErrorBoundary
      fallback={<NavigationFallback />}
      onError={handleNavigationError}
      componentName="NavigationErrorBoundary"
    >
      {children}
    </ErrorBoundary>
  );
};

export default NavigationErrorBoundary;