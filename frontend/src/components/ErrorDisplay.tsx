import React from 'react';
import { getUserFriendlyError, isRetryableError, isActionableError } from '../utils/errorMessages';
import type { UserFriendlyError } from '../utils/errorMessages';
import './ErrorDisplay.css';

interface ErrorDisplayProps {
  error: unknown;
  context?: string;
  onRetry?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
  showDetails?: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  context,
  onRetry,
  onAction,
  actionLabel,
  className = '',
  showDetails = false,
  dismissible = false,
  onDismiss,
}) => {
  if (!error) return null;

  const friendlyError: UserFriendlyError = getUserFriendlyError(error, context);
  const canRetry = isRetryableError(friendlyError) && onRetry;
  const canAction = isActionableError(friendlyError) && onAction;

  const getErrorClass = () => {
    const baseClass = 'error-display';
    const typeClass = `error-display--${friendlyError.type}`;
    return `${baseClass} ${typeClass} ${className}`.trim();
  };

  return (
    <div className={getErrorClass()}>
      {dismissible && (
        <button 
          className="error-display__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
      
      <div className="error-display__content">
        <div className="error-display__header">
          <span className="error-display__icon" role="img" aria-label="Error icon">
            {friendlyError.icon}
          </span>
          <h4 className="error-display__title">
            {friendlyError.title}
          </h4>
        </div>
        
        <div className="error-display__body">
          <p className="error-display__message">
            {friendlyError.message}
          </p>
          
          <p className="error-display__suggestion">
            <strong>What you can do:</strong> {friendlyError.suggestion}
          </p>
          
          {showDetails && error && (
            <details className="error-display__details">
              <summary>Technical Details</summary>
              <pre className="error-display__technical">
                {typeof error === 'string' 
                  ? error 
                  : JSON.stringify(error, null, 2)
                }
              </pre>
            </details>
          )}
        </div>
        
        {(canRetry || canAction) && (
          <div className="error-display__actions">
            {canRetry && (
              <button 
                className="error-display__button error-display__button--retry"
                onClick={onRetry}
              >
                🔄 Try Again
              </button>
            )}
            
            {canAction && (
              <button 
                className="error-display__button error-display__button--action"
                onClick={onAction}
              >
                {actionLabel || '🔧 Fix This'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Compact error display for inline use
export const InlineErrorDisplay: React.FC<{
  error: unknown;
  context?: string;
  className?: string;
}> = ({ error, context, className = '' }) => {
  if (!error) return null;

  const friendlyError = getUserFriendlyError(error, context);
  
  return (
    <div className={`inline-error-display inline-error-display--${friendlyError.type} ${className}`}>
      <span className="inline-error-display__icon" role="img" aria-label="Error icon">
        {friendlyError.icon}
      </span>
      <span className="inline-error-display__message">
        {friendlyError.message}
      </span>
    </div>
  );
};

// Toast-style error notification
export const ErrorToast: React.FC<{
  error: unknown;
  context?: string;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}> = ({ error, context, onClose, autoClose = true, duration = 5000 }) => {
  const friendlyError = getUserFriendlyError(error, context);

  React.useEffect(() => {
    if (autoClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration, onClose]);

  return (
    <div className={`error-toast error-toast--${friendlyError.type}`}>
      <div className="error-toast__content">
        <span className="error-toast__icon" role="img" aria-label="Error icon">
          {friendlyError.icon}
        </span>
        <div className="error-toast__text">
          <div className="error-toast__title">{friendlyError.title}</div>
          <div className="error-toast__message">{friendlyError.message}</div>
        </div>
      </div>
      <button 
        className="error-toast__close"
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
};

export default ErrorDisplay;
