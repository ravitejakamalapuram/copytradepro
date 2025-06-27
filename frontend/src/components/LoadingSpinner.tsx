import React from 'react';
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'white' | 'gray';
  className?: string;
  text?: string;
  inline?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  color = 'primary',
  className = '',
  text,
  inline = false,
}) => {
  const spinnerClass = `loading-spinner loading-spinner--${size} loading-spinner--${color} ${className}`.trim();
  const containerClass = `loading-spinner-container ${inline ? 'loading-spinner-container--inline' : ''}`.trim();

  return (
    <div className={containerClass}>
      <div className={spinnerClass}>
        <div className="loading-spinner__circle"></div>
        <div className="loading-spinner__circle"></div>
        <div className="loading-spinner__circle"></div>
        <div className="loading-spinner__circle"></div>
      </div>
      {text && <span className="loading-spinner__text">{text}</span>}
    </div>
  );
};

// Dots spinner for subtle loading states
export const DotsSpinner: React.FC<{
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'gray';
  className?: string;
}> = ({ size = 'medium', color = 'primary', className = '' }) => {
  return (
    <div className={`dots-spinner dots-spinner--${size} dots-spinner--${color} ${className}`}>
      <div className="dots-spinner__dot"></div>
      <div className="dots-spinner__dot"></div>
      <div className="dots-spinner__dot"></div>
    </div>
  );
};

// Pulse spinner for heartbeat-like loading
export const PulseSpinner: React.FC<{
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'gray';
  className?: string;
}> = ({ size = 'medium', color = 'primary', className = '' }) => {
  return (
    <div className={`pulse-spinner pulse-spinner--${size} pulse-spinner--${color} ${className}`}>
      <div className="pulse-spinner__circle"></div>
    </div>
  );
};

// Ring spinner for circular progress
export const RingSpinner: React.FC<{
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'gray';
  className?: string;
  progress?: number; // 0-100 for progress indication
}> = ({ size = 'medium', color = 'primary', className = '', progress }) => {
  const ringClass = `ring-spinner ring-spinner--${size} ring-spinner--${color} ${className}`.trim();
  
  return (
    <div className={ringClass}>
      <svg className="ring-spinner__svg" viewBox="0 0 50 50">
        <circle
          className="ring-spinner__background"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="4"
        />
        <circle
          className="ring-spinner__progress"
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          style={{
            strokeDasharray: progress !== undefined ? `${progress * 1.25} 125` : undefined,
          }}
        />
      </svg>
    </div>
  );
};

// Button loading spinner
export const ButtonSpinner: React.FC<{
  size?: 'small' | 'medium';
  color?: 'white' | 'primary' | 'gray';
  className?: string;
}> = ({ size = 'small', color = 'white', className = '' }) => {
  return (
    <div className={`button-spinner button-spinner--${size} button-spinner--${color} ${className}`}>
      <div className="button-spinner__dot"></div>
      <div className="button-spinner__dot"></div>
      <div className="button-spinner__dot"></div>
    </div>
  );
};

// Full page loading overlay
export const PageLoader: React.FC<{
  text?: string;
  subtext?: string;
  progress?: number;
  onCancel?: () => void;
}> = ({ text = 'Loading...', subtext, progress, onCancel }) => {
  return (
    <div className="page-loader">
      <div className="page-loader__backdrop"></div>
      <div className="page-loader__content">
        <RingSpinner size="large" color="primary" progress={progress} />
        <div className="page-loader__text">
          <h3 className="page-loader__title">{text}</h3>
          {subtext && <p className="page-loader__subtitle">{subtext}</p>}
          {progress !== undefined && (
            <div className="page-loader__progress">
              <div className="page-loader__progress-bar">
                <div 
                  className="page-loader__progress-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <span className="page-loader__progress-text">{Math.round(progress)}%</span>
            </div>
          )}
        </div>
        {onCancel && (
          <button className="page-loader__cancel" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

// Inline loading state for content areas
export const InlineLoader: React.FC<{
  text?: string;
  size?: 'small' | 'medium';
  className?: string;
}> = ({ text = 'Loading...', size = 'medium', className = '' }) => {
  return (
    <div className={`inline-loader inline-loader--${size} ${className}`}>
      <DotsSpinner size={size} color="gray" />
      <span className="inline-loader__text">{text}</span>
    </div>
  );
};

export default LoadingSpinner;
