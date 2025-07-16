import React from 'react';
import ErrorBoundary from './ErrorBoundary';

interface NavigationErrorBoundaryProps {
  children: React.ReactNode;
}

const NavigationFallback: React.FC = () => (
  <div className="navigation-error-fallback">
    <div className="navigation-error-content">
      <h3>Navigation Error</h3>
      <p>There was an issue loading the navigation. Please refresh the page.</p>
      <button 
        onClick={() => window.location.reload()}
        className="btn btn-primary"
      >
        Refresh Page
      </button>
    </div>
  </div>
);

const NavigationErrorBoundary: React.FC<NavigationErrorBoundaryProps> = ({ children }) => {
  const handleNavigationError = (error: Error) => {
    console.error('Navigation Error:', error);
    // Report navigation-specific errors
  };

  return (
    <ErrorBoundary
      fallback={<NavigationFallback />}
      onError={handleNavigationError}
    >
      {children}
    </ErrorBoundary>
  );
};

export default NavigationErrorBoundary;